"""Master Jenis Pelanggaran: skema (normalisasi kode, model request) dan migrasi data jenis."""

import os
import sys

import pytest
from pydantic import ValidationError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from tatib_poin import normalisasi_kode  # noqa: E402
from routers.tatib import JenisAturanRequest  # noqa: E402
from migrations.migrate_tatib_jenis_pelanggaran import migrate  # noqa: E402


@pytest.fixture
def db(mongo_db):
    return mongo_db


def test_normalisasi_kode():
    assert normalisasi_kode(' dis-01 ') == 'DIS-01'
    assert normalisasi_kode('ker 02') == 'KER02'
    assert normalisasi_kode(None) == ''


def _isian(**kw):
    return {'kode_aturan': 'dis-01', 'nama': '  Terlambat   masuk ', 'jalur_poin': 'minus', 'besar_poin': 5, 'kategori_id': 'k1', **kw}


def test_model_request_jenis_merapikan_dan_memvalidasi():
    r = JenisAturanRequest(**_isian(deskripsi='  '))
    assert (r.kode_aturan, r.nama, r.deskripsi) == ('DIS-01', 'Terlambat masuk', None)
    for salah in ({'kode_aturan': ''}, {'kode_aturan': '-AB'}, {'kode_aturan': 'A' * 21}, {'kode_aturan': 'AB#1'},
                  {'nama': '  '}, {'nama': 'x' * 151}, {'jalur_poin': 'kebaikan'},
                  {'besar_poin': 0}, {'besar_poin': -5}, {'besar_poin': 1001}, {'deskripsi': 'x' * 501}):
        with pytest.raises(ValidationError):
            JenisAturanRequest(**_isian(**salah))


async def test_migrasi_jenis_menormalkan_kode_dan_merapikan_field(db):
    await db.tatib_aturan.insert_many([
        {'id': 'a1', 'kode_aturan': 'dis-01 ', 'nama': 'Terlambat', 'jalur_poin': 'minus', 'besar_poin': 5, 'aktif': True},
        {'id': 'a2', 'kode': 'akh-01', 'nama_aturan': 'Imam', 'poin': 10, 'jenis_poin': 'kebaikan'},  # format lama
        {'id': 'a3', 'kode_aturan': 'X-1', 'nama': 'Rusak', 'jalur_poin': 'aneh', 'besar_poin': '7', 'aktif': 'ya'},
    ])
    hasil = await migrate(db)
    assert hasil['kode_dinormalkan'] == 2 and hasil['kode_bentrok'] == [] and hasil['jenis_dirapikan'] == 2
    assert hasil['index']['kode_aturan_unik'] == 'ok'
    a1, a2, a3 = [await db.tatib_aturan.find_one({'id': i}) for i in ('a1', 'a2', 'a3')]
    assert a1['kode_aturan'] == 'DIS-01'
    assert (a2['kode_aturan'], a2['jalur_poin'], a2['besar_poin'], a2['aktif'], a2['nama']) == ('AKH-01', 'plus', 10, True, 'Imam')
    assert (a3['jalur_poin'], a3['besar_poin'], a3['aktif']) == ('minus', 7, True)

    ulang = await migrate(db)
    assert (ulang['kode_dinormalkan'], ulang['jenis_dirapikan']) == (0, 0)


async def test_migrasi_jenis_melaporkan_kode_bentrok(db):
    await db.tatib_aturan.insert_many([
        {'id': 'a1', 'kode_aturan': 'dis-01', 'nama': 'A', 'jalur_poin': 'minus', 'besar_poin': 1, 'aktif': True},
        {'id': 'a2', 'kode_aturan': 'DIS-01 ', 'nama': 'B', 'jalur_poin': 'minus', 'besar_poin': 1, 'aktif': True},
    ])
    hasil = await migrate(db)
    assert hasil['kode_bentrok'] == ['DIS-01'] and hasil['index']['kode_aturan_unik'] == 'dilewati'
    assert (await db.tatib_aturan.find_one({'id': 'a1'}))['kode_aturan'] == 'dis-01'  # tidak diubah
