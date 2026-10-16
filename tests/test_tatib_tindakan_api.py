"""API Tindakan Tatib (routers/tatib_tindakan.py) di atas MongoDB sungguhan (fixture `mongo_db`)."""

import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from routers import tatib_poin as poin_api  # noqa: E402
from routers import tatib_tindakan as api  # noqa: E402

PIMPINAN = {'id': 'k1', 'full_name': 'Kepsek', 'roles': ['kepala_sekolah'], 'active_role': 'kepala_sekolah'}


@pytest.fixture
async def db(mongo_db, monkeypatch):
    monkeypatch.setattr(api, 'db', mongo_db)
    monkeypatch.setattr(poin_api, 'db', mongo_db)
    await mongo_db.classes.insert_many([{'id': 'c7a', 'name': 'VII A'}, {'id': 'c8b', 'name': 'VIII B'}])
    await mongo_db.users.insert_many([
        {'id': 's1', 'roles': ['siswa'], 'full_name': 'Ahmad', 'nisn': '001', 'nis': '2401', 'student_class_id': 'c7a'},
        {'id': 's2', 'roles': ['siswa'], 'full_name': 'Budi', 'nisn': '002', 'nis': '2402', 'student_class_id': 'c8b'},
        {'id': 's3', 'roles': ['siswa'], 'full_name': 'Citra', 'nisn': '003', 'nis': '2403', 'student_class_id': 'c7a'},
    ])

    def catat(i, sid, poin, kategori, semester='sem1', tanggal='2026-10-01'):
        return {'id': f'p{i}', 'siswa_id': sid, 'poin': poin, 'jenis_poin': 'pelanggaran' if poin < 0 else 'kebaikan',
                'kategori_nama': kategori, 'semester_id': semester, 'tanggal': tanggal, 'siswa_kelas': 'lama'}
    await mongo_db.tatib_penanganan.insert_many([
        catat(1, 's1', -20, 'Kedisiplinan'), catat(2, 's1', -10, 'Kerapian'), catat(3, 's1', -5, 'Kedisiplinan'), catat(4, 's1', 10, 'Akhlak'),
        catat(5, 's2', -60, 'Kedisiplinan'),
        catat(6, 's3', 15, 'Akhlak'),
        catat(7, 's2', -100, 'Kedisiplinan', semester='sem0'),  # semester lain
    ])
    return mongo_db


async def test_rekap_siswa_berpoin_per_semester(db):
    hasil = await api.daftar_tindakan(semester_id='sem1', user=PIMPINAN)
    assert hasil['ambang'] == {'sp1': 25, 'sp2': 50, 'sp3': 75} and hasil['semester_id'] == 'sem1'
    assert [s['siswa_id'] for s in hasil['items']] == ['s2', 's1', 's3']  # pelanggaran terbesar dulu
    s1 = hasil['items'][1]
    assert (s1['nisn'], s1['nama'], s1['kelas'], s1['poin_positif'], s1['poin_negatif'], s1['usulan_sp']) == ('001', 'Ahmad', 'VII A', 10, -35, 'SP1')
    assert s1['kategori_negatif'] == [{'nama': 'Kedisiplinan', 'poin': -25, 'jumlah': 2}, {'nama': 'Kerapian', 'poin': -10, 'jumlah': 1}]
    assert s1['kategori_positif'] == [{'nama': 'Akhlak', 'poin': 10, 'jumlah': 1}]
    assert (s1['keterangan_sp'], s1['status_panggilan_wali'], s1['status_sp'], s1['status_rtlpd']) == (None, 'Tidak diperlukan', 'Tidak perlu', 'Tidak diperlukan')
    assert hasil['items'][0]['usulan_sp'] == 'SP2' and hasil['items'][2]['usulan_sp'] is None
    # tanpa semester: semua catatan
    semua = await api.daftar_tindakan(user=PIMPINAN)
    assert semua['items'][0]['poin_negatif'] == -160 and semua['items'][0]['usulan_sp'] == 'SP3'


async def test_rekap_memakai_ambang_tersimpan_dan_status_tindakan(db):
    await db.pengaturan_ambang_sp.insert_one({'_id': 'ambang_sp', 'sp1': 30, 'sp2': 40, 'sp3': 60})
    await db.tatib_tindakan.insert_one({'id': 't1', 'siswa_id': 's1', 'semester_id': 'sem1', 'keterangan_sp': 'SP1',
                                        'status_panggilan_wali': 'Terlaksana', 'status_sp': 'Diserahkan', 'status_rtlpd': 'Tidak diperlukan',
                                        'diubah_oleh_nama': 'Guru Tatib', 'diubah_pada': '2026-10-02T00:00:00'})
    await db.tatib_tindakan.insert_one({'id': 't0', 'siswa_id': 's1', 'semester_id': 'sem0', 'keterangan_sp': 'SP3'})
    hasil = await api.daftar_tindakan(semester_id='sem1', user=PIMPINAN)
    s1 = next(s for s in hasil['items'] if s['siswa_id'] == 's1')
    assert hasil['ambang'] == {'sp1': 30, 'sp2': 40, 'sp3': 60}
    assert (s1['usulan_sp'], s1['keterangan_sp'], s1['status_panggilan_wali'], s1['diubah_oleh_nama']) == ('SP1', 'SP1', 'Terlaksana', 'Guru Tatib')
    s2 = next(s for s in hasil['items'] if s['siswa_id'] == 's2')
    assert s2['usulan_sp'] == 'SP3'


async def test_rekap_filter_kelas_cari_dan_usulan(db):
    q = lambda **kw: api.daftar_tindakan(semester_id='sem1', user=PIMPINAN, **kw)  # noqa: E731
    assert [s['siswa_id'] for s in (await q(cari='ahm'))['items']] == ['s1']
    assert [s['siswa_id'] for s in (await q(cari='002'))['items']] == ['s2']
    assert [s['siswa_id'] for s in (await q(usulan_sp='SP2'))['items']] == ['s2']
    assert [s['siswa_id'] for s in (await q(usulan_sp='tanpa'))['items']] == ['s3']
    assert (await q(kelas='VII A'))['items'] == []  # kelas = kelas saat dicatat ('lama' di data uji)
    assert [s['siswa_id'] for s in (await q(kelas='lama'))['items']] == ['s2', 's1', 's3']


async def test_rekap_hak_akses():
    from routers.tatib_poin import wajib_lihat_tatib
    route = next(r for r in api.router.routes if r.path == '/tatib/tindakan')
    assert wajib_lihat_tatib in [d.call for d in route.dependant.dependencies]
    for r in ('wali_kelas', 'siswa', 'guru_mapel'):
        with pytest.raises(HTTPException):
            await wajib_lihat_tatib({'id': 'x', 'roles': [r], 'active_role': r})
