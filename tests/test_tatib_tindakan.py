"""Tindakan Tatib: skema status pembinaan, usulan SP, dan migrasi koleksi tatib_tindakan."""

import os
import sys

import pytest
from pymongo.errors import DuplicateKeyError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from tatib_poin import AMBANG_SP_BAWAAN, entri_riwayat_tindakan, perubahan_status, usulkan_sp  # noqa: E402
from migrations.migrate_tatib_tindakan import migrate  # noqa: E402
from migrations.migrate_tatib_tindakan_riwayat import migrate as migrate_riwayat  # noqa: E402


@pytest.fixture
def db(mongo_db):
    return mongo_db


def test_usulkan_sp_dari_ambang():
    assert AMBANG_SP_BAWAAN == {'sp1': 25, 'sp2': 50, 'sp3': 75}
    assert [usulkan_sp(n) for n in (0, -24, -25, -49, -50, -75, -300)] == [None, None, 'SP1', 'SP1', 'SP2', 'SP3', 'SP3']
    assert usulkan_sp(30) == 'SP1'  # nilai mutlak
    assert usulkan_sp(-30, {'sp1': 40, 'sp2': 60, 'sp3': 80}) is None
    assert usulkan_sp(None) is None


def test_perubahan_status_hanya_field_yang_berubah():
    awal = {}  # belum ada dokumen: dibandingkan dengan status awal
    baru = {'keterangan_sp': 'SP1', 'status_panggilan_wali': 'Diajukan', 'status_sp': 'Tidak perlu', 'status_rtlpd': 'Tidak diperlukan'}
    assert perubahan_status(awal, baru) == [
        {'field': 'keterangan_sp', 'dari': None, 'ke': 'SP1'},
        {'field': 'status_panggilan_wali', 'dari': 'Tidak diperlukan', 'ke': 'Diajukan'},
    ]
    assert perubahan_status(baru, dict(baru)) == []


async def test_migrasi_tindakan_index_unik_dan_melengkapi(db):
    await db.tatib_tindakan.insert_one({'id': 't1', 'siswa_id': 's1', 'semester_id': 'sem1', 'keterangan_sp': 'SP1'})
    hasil = await migrate(db)
    doc = await db.tatib_tindakan.find_one({'id': 't1'})
    assert (doc['keterangan_sp'], doc['status_sp'], doc['status_rtlpd']) == ('SP1', 'Tidak perlu', 'Tidak diperlukan')
    assert 'riwayat' not in doc
    assert hasil['jumlah_tindakan'] == 1 and hasil['field_dilengkapi'] == 3
    with pytest.raises(DuplicateKeyError):
        await db.tatib_tindakan.insert_one({'id': 't2', 'siswa_id': 's1', 'semester_id': 'sem1'})
    await db.tatib_tindakan.insert_one({'id': 't3', 'siswa_id': 's1', 'semester_id': 'sem2'})  # semester lain boleh
    assert (await migrate(db))['field_dilengkapi'] == 4  # t3 baru dilengkapi (termasuk keterangan_sp); t1 tidak berubah lagi
    assert (await migrate(db))['field_dilengkapi'] == 0


def test_entri_riwayat_tindakan():
    e = entri_riwayat_tindakan({'id': 't1', 'siswa_id': 's1', 'semester_id': 'sem1'}, [{'field': 'status_sp', 'dari': 'Tidak perlu', 'ke': 'Diserahkan'}],
                               {'id': 'u1', 'full_name': 'Guru'}, '2026-10-16T08:00:00', catatan='', usulan_sp='SP1', poin_negatif=-30)
    assert e['id'] and (e['tindakan_id'], e['siswa_id'], e['oleh_nama'], e['catatan'], e['usulan_sp'], e['poin_negatif']) == \
        ('t1', 's1', 'Guru', None, 'SP1', -30)


async def test_migrasi_riwayat_memindahkan_array_tertanam(db):
    await db.tatib_tindakan.insert_many([
        {'id': 't1', 'siswa_id': 's1', 'semester_id': 'sem1', 'riwayat': [
            {'id': 'r1', 'waktu': '2026-10-01T00:00:00', 'oleh_nama': 'A', 'perubahan': [{'field': 'status_sp', 'dari': 'Tidak perlu', 'ke': 'Diserahkan'}]},
            {'waktu': '2026-10-02T00:00:00', 'oleh_nama': 'B', 'perubahan': []},
        ]},
        {'id': 't2', 'siswa_id': 's2', 'semester_id': 'sem1'},
    ])
    await db.tatib_tindakan_riwayat.insert_one({'id': 'r1', 'tindakan_id': 't1'})  # sudah ada: tidak digandakan
    hasil = await migrate_riwayat(db)
    assert hasil == {'riwayat_dipindah': 1, 'jumlah_riwayat': 2}
    assert 'riwayat' not in await db.tatib_tindakan.find_one({'id': 't1'})
    pindah = await db.tatib_tindakan_riwayat.find_one({'oleh_nama': 'B'})
    assert (pindah['tindakan_id'], pindah['siswa_id'], pindah['semester_id']) == ('t1', 's1', 'sem1')
    assert (await migrate_riwayat(db))['riwayat_dipindah'] == 0
    nama_index = {i['name'] for i in await db.tatib_tindakan_riwayat.list_indexes().to_list(None)}
    assert 'id_unik' in nama_index and 'siswa_id_1_semester_id_1_waktu_-1' in nama_index
