"""API penilaian: daftar tugas penilai (syarat penilai tersupervisi), ringkasan, instrumen, masa penilaian."""

import asyncio
import os
import sys
from datetime import date, timedelta

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pkg_penjaga  # noqa: E402
from routers import pkg_penilaian_api as api  # noqa: E402
from tests.pkg_palsu import Db, Koleksi, Request  # noqa: E402

HARI_INI = date.today()


def GURU(uid):
    return {'id': uid, 'roles': ['guru'], 'active_role': 'guru'}


@pytest.fixture
def db(monkeypatch):
    d = Db({
        'pkg_periode': Koleksi([{'id': 'p1', 'status': 'berjalan', 'nama_periode': 'Ganjil',
                                 'tanggal_buka': str(HARI_INI - timedelta(days=5)), 'tanggal_tutup': str(HARI_INI + timedelta(days=30))}]),
        'pkg_sk': Koleksi([{'id': 's1', 'periode_id': 'p1', 'is_active': True, 'penilai_ids': ['pen', 'belum'],
                            'dinilai_ids': ['g1', 'g2', 'g3']}]),
        'pkg_penugasan': Koleksi([
            {'id': 't1', 'periode_id': 'p1', 'penilai_id': 'pen', 'guru_dinilai_ids': ['g1', 'g2', 'g3'], 'supervisi_selesai': True,
             'snapshot_guru': {'g1': {'nama': 'Ani'}, 'g2': {'nama': 'Budi'}, 'g3': {'nama': 'Cici'}}},
            {'id': 't2', 'periode_id': 'p1', 'penilai_id': 'belum', 'guru_dinilai_ids': [], 'supervisi_selesai': False},
        ]),
        'pkg_penilaian': Koleksi([
            {'id': 'n1', 'sk_id': 's1', 'penilai_id': 'pen', 'guru_dinilai_id': 'g1', 'status': 'terkunci'},
            {'id': 'n2', 'sk_id': 's1', 'penilai_id': 'pen', 'guru_dinilai_id': 'g2', 'status': 'draf', 'progres': 50},
        ]),
        'pkg_instrumen': Koleksi([{'id': 'i1', 'versi_template': '2026', 'revisi': 1, 'cocok_resmi': True, 'is_active': True}]),
    })
    for m in (api, pkg_penjaga):
        monkeypatch.setattr(m, 'db', d)
    return d


def _api(fn, *args, user):
    async def jalan():
        akses = await pkg_penjaga.penjaga_pkg('penilai')(Request(), user)
        return await fn(*args, akses=akses)
    return asyncio.run(jalan())


def test_daftar_tugas_penilai(db):
    hasil = _api(api.daftar_tugas_api, user=GURU('pen'))
    assert hasil['ringkasan'] == {'total': 3, 'belum': 1, 'draf': 1, 'terkunci': 1}
    assert [t['nama'] for t in hasil['tugas']] == ['Budi', 'Cici', 'Ani']  # draf, belum, terkunci
    assert hasil['instrumen'] == {'id': 'i1', 'versi_template': '2026', 'revisi': 1, 'cocok_resmi': True}
    assert hasil['dapat_diisi'] is True and hasil['alasan_tidak_dapat_diisi'] is None


def test_tidak_dapat_diisi(db):
    db['pkg_instrumen'] = Koleksi()
    assert _api(api.daftar_tugas_api, user=GURU('pen'))['alasan_tidak_dapat_diisi'] == 'instrumen_belum_ada'
    db['pkg_periode'].docs[0]['tanggal_tutup'] = str(HARI_INI - timedelta(days=1))
    assert _api(api.daftar_tugas_api, user=GURU('pen'))['alasan_tidak_dapat_diisi'] == 'di_luar_masa'


def test_penilai_belum_disupervisi_ditolak(db):
    with pytest.raises(HTTPException) as e:
        _api(api.daftar_tugas_api, user=GURU('belum'))
    assert e.value.detail['alasan'] == 'belum_disupervisi'
    with pytest.raises(HTTPException) as e:
        _api(api.daftar_tugas_api, user=GURU('g3'))
    assert e.value.detail['alasan'] == 'bukan_penilai'
