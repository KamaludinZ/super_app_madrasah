"""Periode PKG: tetapkan/ubah oleh kepala, transisi status draf -> berjalan -> ditutup, satu periode berjalan."""

import asyncio
import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pkg_penjaga  # noqa: E402
from pkg_skema import PeriodeRequest, StatusPeriodeRequest  # noqa: E402
from routers import pkg_kelola as api  # noqa: E402
from tests.pkg_palsu import Db, Request  # noqa: E402

KEPALA = {'id': 'kep', 'roles': ['kepala_sekolah'], 'active_role': 'kepala_sekolah'}
GURU = {'id': 'g1', 'roles': ['guru'], 'active_role': 'guru'}


@pytest.fixture
def db(monkeypatch):
    d = Db()
    monkeypatch.setattr(api, 'db', d)
    monkeypatch.setattr(pkg_penjaga, 'db', d)
    return d


def _api(fn, *args, user=KEPALA):
    async def jalan():
        akses = await pkg_penjaga.penjaga_pkg('kepala')(Request(), user)
        return await fn(*args, akses)
    return asyncio.run(jalan())


def _periode(nama='PKG Ganjil', buka='2026-10-01', tutup='2026-11-30'):
    return PeriodeRequest(nama_periode=nama, tahun_pelajaran='2026/2027', semester='Ganjil', semester_id='sem1',
                          tanggal_buka=buka, tanggal_tutup=tutup)


def _status(periode_id, status):
    return _api(api.status_periode_api, periode_id, StatusPeriodeRequest(status=status), Request())


def test_alur_periode(db):
    p1 = _api(api.buat_periode_api, _periode('Ganjil'), Request())
    assert p1['status'] == 'draf' and p1['semester_id'] == 'sem1'
    p2 = _api(api.buat_periode_api, _periode('Genap', '2027-03-01', '2027-04-30'), Request())
    assert [p['nama_periode'] for p in _api(api.daftar_periode_api)] == ['Genap', 'Ganjil']

    ubah = _api(api.ubah_periode_api, p1['id'], _periode('Ganjil Revisi'), Request())
    assert ubah['nama_periode'] == 'Ganjil Revisi' and ubah['status'] == 'draf'

    with pytest.raises(HTTPException) as e:  # draf tidak langsung ditutup
        _status(p1['id'], 'ditutup')
    assert e.value.status_code == 409
    assert _status(p1['id'], 'berjalan')['status'] == 'berjalan'
    with pytest.raises(HTTPException) as e:  # hanya satu periode berjalan
        _status(p2['id'], 'berjalan')
    assert e.value.status_code == 409 and 'masih berjalan' in e.value.detail

    assert _status(p1['id'], 'ditutup')['status'] == 'ditutup'
    with pytest.raises(HTTPException) as e:  # tidak bisa dibuka lagi
        _status(p1['id'], 'berjalan')
    assert e.value.status_code == 409
    with pytest.raises(HTTPException) as e:  # periode ditutup terkunci
        _api(api.ubah_periode_api, p1['id'], _periode('X'), Request())
    assert e.value.status_code == 409
    assert _status(p2['id'], 'berjalan')['status'] == 'berjalan'

    with pytest.raises(HTTPException) as e:
        _api(api.rincian_periode_api, 'tidak-ada')
    assert e.value.status_code == 404

    aksi = [d['aksi'] for d in db['pkg_audit_log'].docs]
    assert aksi == ['periode_buat', 'periode_buat', 'periode_ubah', 'periode_berjalan', 'periode_ditutup', 'periode_berjalan']


def test_non_kepala_ditolak(db):
    with pytest.raises(HTTPException) as e:
        _api(api.daftar_periode_api, user=GURU)
    assert e.value.status_code == 403 and e.value.detail['alasan'] == 'bukan_anggota_sk'
