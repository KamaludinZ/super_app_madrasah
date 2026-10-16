"""API Input Tata Tertib terpadu (routers/tatib.py) di atas MongoDB sungguhan (fixture `mongo_db`)."""

import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from routers import tatib as api  # noqa: E402
from migrations.migrate_tatib_struktur_baru import migrate  # noqa: E402

PETUGAS = {'id': 'u1', 'full_name': 'Guru Tatib', 'roles': ['guru_tata_tertib'], 'active_role': 'guru_tata_tertib'}


@pytest.fixture
async def db(mongo_db, monkeypatch):
    async def _tanpa_audit(*_a, **_k):
        return None
    monkeypatch.setattr(api, 'db', mongo_db)
    monkeypatch.setattr(api, 'log_audit', _tanpa_audit)
    await migrate(mongo_db)  # index unik seperti di server
    return mongo_db


def _req(model, **isian):
    return model(**isian)


async def test_kategori_tambah_rapikan_nama_dan_tolak_ganda(db):
    k = await api.create_kategori(_req(api.KategoriTatibRequest, nama='  Kedisiplinan  ', deskripsi=' '), PETUGAS)
    assert k['nama'] == 'Kedisiplinan' and k['nama_key'] == 'kedisiplinan' and k['deskripsi'] is None
    with pytest.raises(HTTPException) as e:
        await api.create_kategori(_req(api.KategoriTatibRequest, nama='KEDISIPLINAN'), PETUGAS)
    assert e.value.status_code == 409
    with pytest.raises(HTTPException) as e:
        await api.create_kategori(_req(api.KategoriTatibRequest, nama='   '), PETUGAS)
    assert e.value.status_code == 400
    daftar = await api.list_kategori(PETUGAS)
    assert [x['nama'] for x in daftar] == ['Kedisiplinan']


async def test_kategori_ubah_nama_ikut_ke_jenis_tapi_tidak_ke_riwayat(db):
    k = await api.create_kategori(_req(api.KategoriTatibRequest, nama='Kerapian'), PETUGAS)
    lain = await api.create_kategori(_req(api.KategoriTatibRequest, nama='Akhlak'), PETUGAS)
    await db.tatib_aturan.insert_one({'id': 'a1', 'kategori_id': k['id'], 'kategori_nama': 'Kerapian', 'kode_aturan': 'KER-01'})
    await db.tatib_penanganan.insert_one({'id': 'p1', 'kategori_id': k['id'], 'kategori_nama': 'Kerapian'})

    with pytest.raises(HTTPException) as e:
        await api.update_kategori(k['id'], _req(api.KategoriTatibRequest, nama='akhlak'), PETUGAS)
    assert e.value.status_code == 409

    u = await api.update_kategori(k['id'], _req(api.KategoriTatibRequest, nama='Kerapian Seragam', deskripsi='Atribut'), PETUGAS)
    assert (u['nama'], u['nama_key'], u['deskripsi']) == ('Kerapian Seragam', 'kerapian seragam', 'Atribut')
    assert (await db.tatib_aturan.find_one({'id': 'a1'}))['kategori_nama'] == 'Kerapian Seragam'
    assert (await db.tatib_penanganan.find_one({'id': 'p1'}))['kategori_nama'] == 'Kerapian'  # riwayat tetap
    # nama sama milik sendiri boleh disimpan ulang
    await api.update_kategori(lain['id'], _req(api.KategoriTatibRequest, nama='Akhlak'), PETUGAS)


async def test_kategori_hapus_ditolak_bila_dipakai(db):
    k = await api.create_kategori(_req(api.KategoriTatibRequest, nama='Ibadah'), PETUGAS)
    await db.tatib_penanganan.insert_one({'id': 'p1', 'kategori_id': k['id']})
    with pytest.raises(HTTPException) as e:
        await api.delete_kategori(k['id'], PETUGAS)
    assert e.value.status_code == 400
    await db.tatib_penanganan.delete_many({})
    assert (await api.delete_kategori(k['id'], PETUGAS))['message']
    with pytest.raises(HTTPException) as e:
        await api.get_kategori(k['id'], PETUGAS)
    assert e.value.status_code == 404


async def test_jenis_aturan_per_kategori_bentuk_kanonis(db):
    k1 = await api.create_kategori(_req(api.KategoriTatibRequest, nama='Kedisiplinan', urutan=1), PETUGAS)
    k2 = await api.create_kategori(_req(api.KategoriTatibRequest, nama='Akhlak', urutan=2), PETUGAS)
    await db.tatib_aturan.insert_many([
        # format lama (belum dimigrasi) tetap diterjemahkan
        {'id': 'a2', 'kode': 'DIS-02', 'nama_aturan': 'Bolos', 'kategori_id': k1['id'], 'kategori_nama': 'lama', 'poin': -15, 'is_active': True},
        {'id': 'a1', 'kode_aturan': 'DIS-01', 'nama': 'Terlambat', 'jalur_poin': 'minus', 'besar_poin': 5, 'kategori_id': k1['id'], 'aktif': True},
        {'id': 'a3', 'kode_aturan': 'AKH-01', 'nama': 'Imam salat', 'jalur_poin': 'plus', 'besar_poin': 5, 'kategori_id': k2['id'], 'aktif': True, 'deskripsi': 'x'},
        {'id': 'a4', 'kode_aturan': 'AKH-02', 'nama': 'Kasar', 'jalur_poin': 'minus', 'besar_poin': 10, 'kategori_id': k2['id'], 'aktif': False},
    ])
    semua = await api.list_jenis_aturan(user=PETUGAS)
    assert [j['id'] for j in semua] == ['a1', 'a2', 'a3', 'a4']  # urut kategori lalu kode
    assert semua[1] == {'id': 'a2', 'kode_aturan': 'DIS-02', 'nama': 'Bolos', 'jalur_poin': 'minus', 'besar_poin': 15, 'aktif': True,
                        'poin': -15, 'kategori_id': k1['id'], 'kategori_nama': 'Kedisiplinan', 'deskripsi': ''}
    assert semua[2]['poin'] == 5 and semua[2]['deskripsi'] == 'x'

    per_kategori = await api.list_jenis_aturan(kategori_id=k2['id'], user=PETUGAS)
    assert [j['id'] for j in per_kategori] == ['a3', 'a4']
    aktif = await api.list_jenis_aturan(kategori_id=k2['id'], aktif=True, user=PETUGAS)
    assert [j['id'] for j in aktif] == ['a3']
    assert [j['id'] for j in await api.list_jenis_aturan(aktif=False, user=PETUGAS)] == ['a4']
