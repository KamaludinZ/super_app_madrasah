"""Status pengumpulan E-Kinerja: penyusun yang juga GTK (kepala madrasah/KTU) mendapat rekap sekaligus status
unggah dirinya sendiri; GTK biasa hanya status dirinya. Pengaturan madrasah memuat NSM & wilayah untuk cetak PKG."""

import os
import sys

import httpx
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import server  # noqa: E402
from core import get_current_user  # noqa: E402
from models import SettingsModel  # noqa: E402
from routers import ekinerja  # noqa: E402

KUNCI = {'type': 'profesionalitas_gtk', 'year': 2026, 'period': 'TW1'}


@pytest.fixture
async def klien(mongo_db, monkeypatch):
    monkeypatch.setattr(ekinerja, 'db', mongo_db)
    await mongo_db.users.insert_many([
        {'id': 'u-ktu', 'full_name': 'Kepala TU', 'roles': ['kepala_tata_usaha'], 'is_active': True},
        {'id': 'u-guru', 'full_name': 'Guru A', 'roles': ['guru'], 'is_active': True},
    ])
    await mongo_db.ekinerja_pengumpulan_konfirmasi.insert_one(
        {'id': 'k1', **KUNCI, 'gtk_id': 'u-ktu', 'gtk_name': 'Kepala TU', 'confirmed_at': '2026-01-10T00:00:00'})

    async def minta(user):
        server.app.dependency_overrides[get_current_user] = lambda: user
        transport = httpx.ASGITransport(app=server.app)
        async with httpx.AsyncClient(transport=transport, base_url='http://test') as c:
            return await c.get('/api/ekinerja/pengumpulan/status', params=KUNCI)

    yield minta
    server.app.dependency_overrides.pop(get_current_user, None)


async def test_penyusun_gtk_mendapat_rekap_dan_status_sendiri(klien):
    res = await klien({'id': 'u-ktu', 'username': 'ktu', 'full_name': 'Kepala TU',
                       'roles': ['kepala_tata_usaha'], 'active_role': 'kepala_tata_usaha'})
    assert res.status_code == 200
    data = res.json()
    assert {r['gtk_id'] for r in data['rekap']} == {'u-ktu', 'u-guru'}
    assert data['sudah_upload'] is True
    assert data['confirmed_at'] == '2026-01-10T00:00:00'


async def test_kepala_madrasah_tanpa_konfirmasi_belum_upload(klien):
    res = await klien({'id': 'u-ks', 'username': 'ks', 'full_name': 'Kepala', 'roles': ['kepala_sekolah'],
                       'active_role': 'kepala_sekolah'})
    data = res.json()
    assert 'rekap' in data and data['sudah_upload'] is False and data['confirmed_at'] is None


async def test_gtk_biasa_hanya_status_sendiri(klien):
    res = await klien({'id': 'u-guru', 'username': 'guru', 'full_name': 'Guru A', 'roles': ['guru'], 'active_role': 'guru'})
    data = res.json()
    assert 'rekap' not in data and data['sudah_upload'] is False


def test_pengaturan_memuat_nsm_dan_wilayah():
    data = SettingsModel(nsm='121135730002', city='Kota Malang').model_dump()
    assert data['nsm'] == '121135730002' and data['city'] == 'Kota Malang'
    for kunci in ('village', 'district', 'province'):
        assert kunci in data
