"""Supervisi penilai: tandai/batalkan oleh kepala, kepala dikecualikan, gerbang pembukaan lembar penilaian."""

import asyncio
import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pkg_akses  # noqa: E402
import pkg_penjaga  # noqa: E402
from pkg_skema import SupervisiRequest  # noqa: E402
from routers import pkg_kelola as api  # noqa: E402
from tests.pkg_palsu import Db, Koleksi, Request  # noqa: E402

KEPALA = {'id': 'kep', 'full_name': 'Kepala Madrasah', 'roles': ['kepala_sekolah'], 'active_role': 'kepala_sekolah'}
GURU = {'id': 'g1', 'roles': ['guru'], 'active_role': 'guru'}


@pytest.fixture
def db(monkeypatch):
    d = Db({
        'pkg_periode': Koleksi([{'id': 'p1', 'status': 'berjalan'}]),
        'pkg_sk': Koleksi([{'id': 's1', 'nomor_sk': 'B-1', 'periode_id': 'p1', 'is_active': True,
                            'penilai_ids': ['kep', 'g1', 'g2'], 'dinilai_ids': ['g3']}]),
        'pkg_penugasan': Koleksi([{'id': 't1', 'periode_id': 'p1', 'penilai_id': 'g1', 'guru_dinilai_ids': ['g3']}]),
        'users': Koleksi([
            {'id': 'kep', 'full_name': 'Kepala', 'roles': ['kepala_sekolah']},
            {'id': 'g1', 'full_name': 'Budi', 'roles': ['guru']},
            {'id': 'g2', 'full_name': 'Ani', 'roles': ['guru']},
        ]),
    })
    monkeypatch.setattr(api, 'db', d)
    monkeypatch.setattr(pkg_penjaga, 'db', d)
    return d


def _api(fn, *args, user=KEPALA):
    async def jalan():
        akses = await pkg_penjaga.penjaga_pkg('kepala')(Request(), user)
        return await fn(*args, akses)
    return asyncio.run(jalan())


def _boleh_menilai(db, uid):
    try:
        asyncio.run(pkg_akses.wajib_akses(db, {'id': uid, 'roles': ['guru']}, 'penilai'))
        return True
    except HTTPException as e:
        assert e.detail['alasan'] == 'belum_disupervisi'
        return False


def test_tandai_dan_batalkan_supervisi(db):
    daftar = _api(api.daftar_supervisi_api)
    assert [(b['penilai']['id'], b['supervisi_selesai'], b['jumlah_guru']) for b in daftar] == [('g1', False, 1), ('g2', False, 0)]
    assert not _boleh_menilai(db, 'g1')

    hasil = _api(api.tandai_supervisi_api, 'g1', SupervisiRequest(tanggal_supervisi='2026-10-08', catatan=' kelas 8B '), Request())
    assert (hasil['supervisi_selesai'], hasil['tanggal_supervisi'], hasil['catatan'], hasil['disupervisi_oleh']) == \
        (True, '2026-10-08', 'kelas 8B', 'Kepala Madrasah')
    assert _boleh_menilai(db, 'g1')
    assert db['pkg_penugasan'].docs[0]['guru_dinilai_ids'] == ['g3']  # pembagian tidak tersentuh

    baru = _api(api.tandai_supervisi_api, 'g2', SupervisiRequest(tanggal_supervisi='2026-10-09'), Request())
    assert baru['supervisi_selesai'] and baru['jumlah_guru'] == 0  # dokumen penugasan dibuat
    assert _boleh_menilai(db, 'g2')

    batal = _api(api.batalkan_supervisi_api, 'g1', Request())
    assert (batal['supervisi_selesai'], batal['tanggal_supervisi'], batal['catatan']) == (False, None, '')
    assert not _boleh_menilai(db, 'g1')
    assert [d['aksi'] for d in db['pkg_audit_log'].docs] == ['supervisi_tandai', 'supervisi_tandai', 'supervisi_batal']


def test_validasi_supervisi(db):
    for pid, tanggal, kode in (('kep', '2026-10-08', 400), ('asing', '2026-10-08', 404), ('g1', '2999-01-01', 400)):
        with pytest.raises(HTTPException) as e:
            _api(api.tandai_supervisi_api, pid, SupervisiRequest(tanggal_supervisi=tanggal), Request())
        assert e.value.status_code == kode, pid
    with pytest.raises(HTTPException) as e:
        _api(api.daftar_supervisi_api, user=GURU)
    assert e.value.detail['alasan'] == 'bukan_kepala'
    db['pkg_sk'].docs[0]['is_active'] = False
    assert _api(api.daftar_supervisi_api) == []
    with pytest.raises(HTTPException) as e:
        _api(api.tandai_supervisi_api, 'g1', SupervisiRequest(tanggal_supervisi='2026-10-08'), Request())
    assert e.value.status_code == 409
