"""Struktur baru tatib: kategori -> jenis aturan -> pencatatan (helper skema & migrasi).

Uji migrasi memakai fixture `mongo_db` (tests/conftest.py): MongoDB sungguhan pada database sementara.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from tatib_poin import ASAL_INPUT, field_jenis_aturan, jalur_dari_jenis_poin, kunci_nama, poin_jenis_aturan  # noqa: E402
from migrations.migrate_tatib_struktur_baru import migrate  # noqa: E402


def test_helper_struktur():
    assert ASAL_INPUT == ('BIPH', 'Screening pagi', 'Ibadah', 'Keputrian', 'Whatsapp', 'BAP', 'Razia', 'Laporan langsung')
    assert jalur_dari_jenis_poin('pelanggaran') == 'minus' and jalur_dari_jenis_poin('kebaikan') == 'plus'
    assert kunci_nama('  Akhlak   &  IBADAH ') == 'akhlak & ibadah'
    lama = {'kode': 'DIS-01', 'nama_aturan': 'Terlambat', 'poin': -5, 'jenis_poin': 'pelanggaran'}
    assert field_jenis_aturan(lama) == {'kode_aturan': 'DIS-01', 'nama': 'Terlambat', 'jalur_poin': 'minus', 'besar_poin': 5, 'aktif': True}
    assert poin_jenis_aturan(lama) == -5
    assert poin_jenis_aturan({'jalur_poin': 'plus', 'besar_poin': 10}) == 10
    assert field_jenis_aturan({'kode': 'X', 'poin': 3, 'is_active': False})['aktif'] is False


@pytest.fixture
def db(mongo_db):
    return mongo_db


async def _isi_data_lama(db):
    await db.tatib_kategori.insert_many([
        {'id': 'k1', 'nama': 'Kedisiplinan', 'urutan': 1},
        {'id': 'k2', 'nama': 'Kerapian', 'urutan': 2},
    ])
    await db.tatib_aturan.insert_many([
        {'id': 'a1', 'kode': 'DIS-01', 'nama_aturan': 'Terlambat', 'kategori_id': 'k1', 'poin': -5, 'jenis_poin': 'pelanggaran', 'is_active': True},
        {'id': 'a2', 'kode': 'AKH-01', 'nama_aturan': 'Imam salat', 'kategori_id': 'k2', 'poin': 10, 'is_active': False},
    ])
    await db.tatib_penanganan.insert_many([
        {'id': 'p1', 'siswa_id': 's1', 'tatib_id': 'a1', 'catatan': 'Telat 10 menit', 'poin': -5, 'tanggal': '2026-10-01'},
        {'id': 'p2', 'siswa_id': 's2', 'tatib_id': 'a2', 'catatan': None, 'poin': 10, 'tanggal': '2026-10-02',
         'jenis_id': 'a2', 'kategori_id': 'k2', 'keterangan': None, 'asal_input': 'Ibadah'},
    ])


async def test_migrasi_struktur_baru_mengisi_data_lama_dan_aman_diulang(db):
    await _isi_data_lama(db)
    hasil = await migrate(db)
    assert hasil['kategori_diisi'] == 2 and hasil['aturan_diisi'] == 2 and hasil['catatan_diisi'] == 1
    assert hasil['kategori_ganda'] == [] and hasil['kode_aturan_ganda'] == []
    assert all(v == 'ok' for v in hasil['index'].values()), hasil['index']

    a1 = await db.tatib_aturan.find_one({'id': 'a1'})
    assert (a1['kode_aturan'], a1['nama'], a1['jalur_poin'], a1['besar_poin'], a1['aktif']) == ('DIS-01', 'Terlambat', 'minus', 5, True)
    a2 = await db.tatib_aturan.find_one({'id': 'a2'})
    assert (a2['jalur_poin'], a2['besar_poin'], a2['aktif']) == ('plus', 10, False)
    assert a2['kode'] == 'AKH-01' and a2['is_active'] is False  # field lama tetap ada

    p1 = await db.tatib_penanganan.find_one({'id': 'p1'})
    assert (p1['jenis_id'], p1['kategori_id'], p1['keterangan'], p1['asal_input']) == ('a1', 'k1', 'Telat 10 menit', None)
    p2 = await db.tatib_penanganan.find_one({'id': 'p2'})
    assert p2['asal_input'] == 'Ibadah'  # catatan yang sudah lengkap tidak diubah

    ulang = await migrate(db)
    assert (ulang['kategori_diisi'], ulang['aturan_diisi'], ulang['catatan_diisi']) == (0, 0, 0)


async def test_migrasi_index_unik_menolak_ganda(db):
    await _isi_data_lama(db)
    await migrate(db)
    from pymongo.errors import DuplicateKeyError
    with pytest.raises(DuplicateKeyError):
        await db.tatib_aturan.insert_one({'id': 'a3', 'kode_aturan': 'DIS-01'})
    with pytest.raises(DuplicateKeyError):
        await db.tatib_kategori.insert_one({'id': 'k3', 'nama': 'KEDISIPLINAN', 'nama_key': 'kedisiplinan'})
    # dokumen tanpa kode_aturan/nama_key (belum dimigrasi) tidak terkena index unik parsial
    await db.tatib_aturan.insert_one({'id': 'a4'})
    await db.tatib_aturan.insert_one({'id': 'a5'})


async def test_migrasi_melaporkan_data_ganda_tanpa_gagal(db):
    await db.tatib_kategori.insert_many([{'id': 'k1', 'nama': 'Kerapian'}, {'id': 'k2', 'nama': ' kerapian '}])
    await db.tatib_aturan.insert_many([
        {'id': 'a1', 'kode': 'X-1', 'nama_aturan': 'A', 'poin': -1},
        {'id': 'a2', 'kode': 'X-1', 'nama_aturan': 'B', 'poin': -2},
    ])
    hasil = await migrate(db)
    assert hasil['kategori_ganda'] == ['kerapian'] and hasil['kode_aturan_ganda'] == ['X-1']
    assert hasil['index']['tatib_kategori.nama_key_unik'] == 'dilewati'
    assert hasil['index']['tatib_aturan.kode_aturan_unik'] == 'dilewati'
