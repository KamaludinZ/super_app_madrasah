"""Pembagian jatah penilaian: pemetaan guru -> satu penilai, validasi, jatah, supervisi tidak tertimpa, audit."""

import asyncio
import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pkg_penjaga  # noqa: E402
from pkg_skema import PenugasanRequest  # noqa: E402
from routers import pkg_kelola as api  # noqa: E402
from tests.pkg_palsu import Db, Koleksi, Request  # noqa: E402

KEPALA = {'id': 'kep', 'roles': ['kepala_sekolah'], 'active_role': 'kepala_sekolah'}


@pytest.fixture
def db(monkeypatch):
    d = Db({
        'pkg_periode': Koleksi([{'id': 'p1', 'nama_periode': 'Ganjil', 'status': 'berjalan'}]),
        'pkg_sk': Koleksi([{'id': 's1', 'nomor_sk': 'B-1', 'periode_id': 'p1', 'is_active': True,
                            'penilai_ids': ['kep', 'g1'], 'dinilai_ids': ['g1', 'g2', 'g3']}]),
        'pkg_penugasan': Koleksi([{'id': 't1', 'periode_id': 'p1', 'penilai_id': 'g1', 'guru_dinilai_ids': [],
                                   'supervisi_selesai': True, 'tanggal_supervisi': '2026-10-08'}]),
        'users': Koleksi([{'id': u, 'full_name': u.upper(), 'roles': ['kepala_sekolah' if u == 'kep' else 'guru']}
                          for u in ('kep', 'g1', 'g2', 'g3')]),
    })
    monkeypatch.setattr(api, 'db', d)
    monkeypatch.setattr(pkg_penjaga, 'db', d)
    return d


def _api(fn, *args):
    async def jalan():
        akses = await pkg_penjaga.penjaga_pkg('kepala')(Request(), KEPALA)
        return await fn(*args, akses)
    return asyncio.run(jalan())


def _simpan(penugasan, jatah=None):
    return _api(api.simpan_pembagian_api, PenugasanRequest(penugasan=penugasan, jatah=jatah or {}), Request())


def test_ambil_dan_simpan_pembagian(db):
    awal = _api(api.pembagian_api)
    assert awal['sk'] == {'id': 's1', 'nomor_sk': 'B-1'} and awal['penugasan'] == {} and awal['penilaian_dimulai'] is False
    assert [a['id'] for a in awal['dinilai']] == ['g1', 'g2', 'g3']

    hasil = _simpan({'g1': 'kep', 'g2': 'g1', 'g3': 'g1'}, {'kep': 1, 'g1': 2})
    assert hasil['penugasan'] == {'g1': 'kep', 'g2': 'g1', 'g3': 'g1'} and hasil['jatah'] == {'kep': 1, 'g1': 2}
    g1 = next(d for d in db['pkg_penugasan'].docs if d['penilai_id'] == 'g1')
    assert g1['guru_dinilai_ids'] == ['g2', 'g3'] and g1['supervisi_selesai'] is True and g1['sk_id'] == 's1'
    kep = next(d for d in db['pkg_penugasan'].docs if d['penilai_id'] == 'kep')
    assert kep['id'] and kep['guru_dinilai_ids'] == ['g1'] and kep['supervisi_selesai'] is False

    log = db['pkg_audit_log'].docs
    assert log[-1]['aksi'] == 'penugasan_simpan' and len(log[-1]['metadata']['perubahan']) == 2
    _simpan({'g1': 'kep', 'g2': 'g1', 'g3': 'g1'}, {'kep': 1, 'g1': 2})  # tanpa perubahan -> tanpa audit
    assert len(db['pkg_audit_log'].docs) == len(log)


def test_validasi_pembagian(db):
    kasus = [
        ({'g1': 'kep', 'g2': 'g1'}, 'belum memiliki penilai'),
        ({'g1': 'g1', 'g2': 'kep', 'g3': 'kep'}, 'dirinya sendiri'),
        ({'g1': 'kep', 'g2': 'g2', 'g3': 'kep'}, 'tidak tercantum di SK aktif'),
        ({'g1': 'kep', 'g2': 'kep', 'g3': 'kep', 'asing': 'kep'}, 'tidak tercantum sebagai guru yang dinilai'),
    ]
    for penugasan, kata in kasus:
        with pytest.raises(HTTPException) as e:
            _simpan(penugasan)
        assert e.value.status_code == 400 and kata in e.value.detail, kata


def test_tanpa_sk_aktif(db):
    db['pkg_sk'].docs[0]['is_active'] = False
    assert _api(api.pembagian_api)['sk'] is None
    with pytest.raises(HTTPException) as e:
        _simpan({})
    assert e.value.status_code == 409


def test_penilaian_dimulai(db):
    db['pkg_penilaian'] = Koleksi([{'id': 'n1', 'sk_id': 's1'}])
    assert _api(api.pembagian_api)['penilaian_dimulai'] is True


def test_validasi_akun_jatah_dan_ganda(db):
    db['users'] = Koleksi([
        {'id': 'kep', 'full_name': 'KEP', 'roles': ['kepala_sekolah']},
        {'id': 'g1', 'full_name': 'G1', 'roles': ['guru']},
        {'id': 'g2', 'full_name': 'G2', 'roles': ['guru'], 'is_active': False},  # dinonaktifkan setelah SK
        {'id': 'g3', 'full_name': 'G3', 'roles': ['guru']},
    ])
    with pytest.raises(HTTPException) as e:
        _simpan({'g1': 'kep', 'g2': 'g1', 'g3': 'g1'}, {'g1': 1})
    pesan = e.value.detail
    assert e.value.status_code == 400 and 'akun nonaktif: G2' in pesan and 'melebihi jatah' in pesan and '(2/1)' in pesan

    db['users'].docs[2]['is_active'] = True
    assert _simpan({'g1': 'kep', 'g2': 'g1', 'g3': 'g1'}, {'g1': 2})['peringatan'] == []
    assert _simpan({'g1': 'kep', 'g2': 'g1', 'g3': 'g1'}, {'g1': 0})['penugasan']['g3'] == 'g1'  # jatah 0 = tanpa batas

    # Data tersimpan tidak konsisten (guru pada dua penilai) dan akun dinonaktifkan -> peringatan di GET.
    next(d for d in db['pkg_penugasan'].docs if d['penilai_id'] == 'kep')['guru_dinilai_ids'] = ['g1', 'g2']
    db['users'].docs[3]['is_active'] = False
    peringatan = _api(api.pembagian_api)['peringatan']
    assert any('lebih dari satu penilai' in p for p in peringatan) and any('G3' in p for p in peringatan)


def test_kunci_setelah_penilaian_berjalan(db):
    _simpan({'g1': 'kep', 'g2': 'g1', 'g3': 'g1'})
    db['pkg_penilaian'] = Koleksi([{'id': 'n1', 'sk_id': 's1', 'guru_dinilai_id': 'g2', 'penilai_id': 'g1', 'status': 'draf'}])
    sebelum = [dict(d) for d in db['pkg_penugasan'].docs]

    with pytest.raises(HTTPException) as e:  # tanpa alasan: ditolak & tidak ada yang tertulis
        _simpan({'g1': 'kep', 'g2': 'g1', 'g3': 'kep'})
    assert e.value.status_code == 400 and 'alasan' in e.value.detail
    assert db['pkg_penugasan'].docs == sebelum

    with pytest.raises(HTTPException) as e:  # guru yang sudah punya lembar tidak dipindah
        _api(api.simpan_pembagian_api, PenugasanRequest(penugasan={'g1': 'g1', 'g2': 'kep', 'g3': 'g1'},
                                                        alasan_perubahan='rotasi'), Request())
    assert e.value.status_code in (400, 409)

    hasil = _api(api.simpan_pembagian_api, PenugasanRequest(penugasan={'g1': 'kep', 'g2': 'g1', 'g3': 'kep'},
                                                            alasan_perubahan=' Guru g1 cuti '), Request())
    assert hasil['penugasan']['g3'] == 'kep'
    log = db['pkg_audit_log'].docs[-1]
    assert log['metadata']['setelah_berjalan'] is True and log['metadata']['alasan'] == 'Guru g1 cuti'
    assert len(db['pkg_audit_log'].docs) == 2
    # Tanpa perubahan: tidak perlu alasan.
    assert _simpan({'g1': 'kep', 'g2': 'g1', 'g3': 'kep'})['penilaian_dimulai'] is True
