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


@pytest.fixture
async def data_input(db, monkeypatch):
    """Kategori, jenis aturan (aktif/nonaktif), dan satu siswa ber-kelas."""
    def _tanpa_notifikasi(coro):
        coro.close()
    monkeypatch.setattr(api, 'spawn', _tanpa_notifikasi)
    k = await api.create_kategori(_req(api.KategoriTatibRequest, nama='Kedisiplinan'), PETUGAS)
    await db.classes.insert_one({'id': 'c7a', 'name': 'VII A'})
    await db.users.insert_one({'id': 's1', 'roles': ['siswa'], 'full_name': 'Ahmad', 'nis': '2401', 'nisn': '001', 'student_class_id': 'c7a'})
    await db.tatib_aturan.insert_many([
        {'id': 'j1', 'kode_aturan': 'DIS-01', 'nama': 'Terlambat', 'jalur_poin': 'minus', 'besar_poin': 5, 'kategori_id': k['id'], 'aktif': True},
        {'id': 'j2', 'kode_aturan': 'AKH-01', 'nama': 'Imam salat', 'jalur_poin': 'plus', 'besar_poin': 10, 'kategori_id': k['id'], 'aktif': True},
        {'id': 'j3', 'kode_aturan': 'DIS-09', 'nama': 'Lama', 'jalur_poin': 'minus', 'besar_poin': 3, 'kategori_id': k['id'], 'aktif': False},
    ])
    return {'kategori': k}


def _input(**isian):
    dasar = {'siswa_id': 's1', 'jenis_id': 'j1', 'tanggal': '2026-10-01', 'asal_input': 'Razia'}
    return api.InputTatibRequest(**{**dasar, **isian})


async def test_simpan_input_poin_dari_master_jenis(db, data_input):
    c = await api.simpan_input_tatib(_input(keterangan='  Telat 10 menit  ', semester_id='sem1'), PETUGAS)
    assert (c['poin'], c['jenis_poin'], c['kode_aturan'], c['jenis_nama']) == (-5, 'pelanggaran', 'DIS-01', 'Terlambat')
    assert (c['siswa_nama'], c['siswa_kelas'], c['kategori_nama']) == ('Ahmad', 'VII A', 'Kedisiplinan')
    assert (c['asal_input'], c['keterangan'], c['petugas_nama'], c['semester_id']) == ('Razia', 'Telat 10 menit', 'Guru Tatib', 'sem1')
    tersimpan = await db.tatib_penanganan.find_one({'id': c['id']}, {'_id': 0})
    # kompatibel dengan endpoint & rekap lama
    assert (tersimpan['tatib_id'], tersimpan['tatib_poin'], tersimpan['catatan'], tersimpan['tindak_lanjut']) == ('j1', -5, 'Telat 10 menit', [])

    plus = await api.simpan_input_tatib(_input(jenis_id='j2', asal_input='Ibadah'), PETUGAS)
    assert plus['poin'] == 10 and plus['jenis_poin'] == 'kebaikan' and plus['keterangan'] is None


@pytest.mark.parametrize('isian,status,pesan', [
    ({'asal_input': 'Lainnya'}, 400, 'Asal input'),
    ({'asal_input': ''}, 400, 'Asal input'),
    ({'tanggal': '2999-01-01'}, 400, 'melewati hari ini'),
    ({'tanggal': '01-10-2026'}, 400, 'tidak valid'),
    ({'keterangan': 'x' * 501}, 400, 'maksimal'),
    ({'siswa_id': 'tidak-ada'}, 404, 'Siswa'),
    ({'jenis_id': 'tidak-ada'}, 404, 'Jenis'),
    ({'jenis_id': 'j3'}, 400, 'tidak aktif'),
])
async def test_simpan_input_validasi(db, data_input, isian, status, pesan):
    with pytest.raises(HTTPException) as e:
        await api.simpan_input_tatib(_input(**isian), PETUGAS)
    assert e.value.status_code == status and pesan in e.value.detail
    assert await db.tatib_penanganan.count_documents({}) == 0
