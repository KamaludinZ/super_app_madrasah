"""Tindakan Tatib: skema status pembinaan, usulan SP, dan migrasi koleksi tatib_tindakan."""

import os
import sys

import pytest
from pymongo.errors import DuplicateKeyError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from tatib_poin import AMBANG_SP_BAWAAN, perubahan_status, usulkan_sp  # noqa: E402
from migrations.migrate_tatib_tindakan import migrate  # noqa: E402


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
    assert (doc['keterangan_sp'], doc['status_sp'], doc['status_rtlpd'], doc['riwayat']) == ('SP1', 'Tidak perlu', 'Tidak diperlukan', [])
    assert hasil['jumlah_tindakan'] == 1 and hasil['field_dilengkapi'] == 4
    with pytest.raises(DuplicateKeyError):
        await db.tatib_tindakan.insert_one({'id': 't2', 'siswa_id': 's1', 'semester_id': 'sem1'})
    await db.tatib_tindakan.insert_one({'id': 't3', 'siswa_id': 's1', 'semester_id': 'sem2'})  # semester lain boleh
    assert (await migrate(db))['field_dilengkapi'] == 5  # t3 baru dilengkapi (termasuk keterangan_sp); t1 tidak berubah lagi
    assert (await migrate(db))['field_dilengkapi'] == 0
