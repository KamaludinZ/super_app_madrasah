"""Skema PKG: validasi isian endpoint (Pydantic) dan index integritas koleksi (MongoDB sungguhan)."""

import os
import sys

import pytest
from pydantic import ValidationError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pkg_skema as skema  # noqa: E402

PERIODE = dict(nama_periode='  PKG   Ganjil ', tahun_pelajaran='2026/2027', semester='Ganjil',
               tanggal_buka='2026-10-01', tanggal_tutup='2026-11-30')


def test_validasi_periode():
    p = skema.PeriodeRequest(**PERIODE)
    assert p.nama_periode == 'PKG Ganjil' and p.semester_id is None
    for ubah in ({'tanggal_tutup': '2026-09-30'}, {'tanggal_buka': '01-10-2026'}, {'tanggal_buka': '2026-02-30'},
                 {'nama_periode': '   '}, {'semester': ''}):
        with pytest.raises(ValidationError):
            skema.PeriodeRequest(**{**PERIODE, **ubah})
    assert skema.StatusPeriodeRequest(status='berjalan').status == 'berjalan'
    with pytest.raises(ValidationError):
        skema.StatusPeriodeRequest(status='draf')


def test_validasi_sk_anggota_penugasan_supervisi():
    sk = skema.SkRequest(nomor_sk=' B-1/2026 ', tanggal_sk='2026-09-28', periode_id='p1', tentang=' Tim  penilai ')
    assert (sk.nomor_sk, sk.tentang) == ('B-1/2026', 'Tim penilai')
    with pytest.raises(ValidationError):
        skema.SkRequest(nomor_sk='', tanggal_sk='2026-09-28', periode_id='p1')
    assert skema.PenilaiSkRequest(penilai_ids=['a', ' a', '', 'b']).penilai_ids == ['a', 'b']
    assert skema.DinilaiSkRequest(dinilai_ids=['x', 'x']).dinilai_ids == ['x']
    pen = skema.PenugasanRequest(penugasan={'g1': 'p1', 'g2': ' ', ' ': 'p1'}, jatah={'p1': 3})
    assert pen.penugasan == {'g1': 'p1'}
    with pytest.raises(ValidationError):
        skema.PenugasanRequest(jatah={'p1': 100})
    assert skema.SupervisiRequest(tanggal_supervisi='2026-10-08').catatan == ''
    with pytest.raises(ValidationError):
        skema.SupervisiRequest(tanggal_supervisi='kemarin')


async def test_index_integritas_mongodb(mongo_db):
    from pymongo.errors import DuplicateKeyError
    assert await skema.ensure_pkg_indexes(mongo_db) == []
    assert await skema.ensure_pkg_indexes(mongo_db) == []  # idempoten

    periode = mongo_db[skema.KOLEKSI_PERIODE]
    await periode.insert_one({'id': 'p1', 'status': 'berjalan'})
    await periode.insert_one({'id': 'p2', 'status': 'draf'})
    await periode.insert_one({'id': 'p3', 'status': 'draf'})
    with pytest.raises(DuplicateKeyError):  # hanya satu periode berjalan
        await periode.insert_one({'id': 'p4', 'status': 'berjalan'})

    sk = mongo_db[skema.KOLEKSI_SK]
    await sk.insert_one({'id': 's1', 'nomor_sk_kunci': 'b-1', 'periode_id': 'p1', 'is_active': True})
    await sk.insert_one({'id': 's2', 'nomor_sk_kunci': 'b-2', 'periode_id': 'p1', 'is_active': False})
    with pytest.raises(DuplicateKeyError):  # satu SK aktif per periode
        await sk.insert_one({'id': 's3', 'nomor_sk_kunci': 'b-3', 'periode_id': 'p1', 'is_active': True})
    with pytest.raises(DuplicateKeyError):  # nomor SK unik
        await sk.insert_one({'id': 's4', 'nomor_sk_kunci': 'b-1', 'periode_id': 'p2', 'is_active': False})

    nilai = mongo_db[skema.KOLEKSI_PENILAIAN]
    await nilai.insert_one({'id': 'n1', 'sk_id': 's1', 'guru_dinilai_id': 'g1', 'penilai_id': 'a'})
    with pytest.raises(DuplicateKeyError):  # satu lembar per guru per SK
        await nilai.insert_one({'id': 'n2', 'sk_id': 's1', 'guru_dinilai_id': 'g1', 'penilai_id': 'b'})
