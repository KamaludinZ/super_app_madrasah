"""Ujian Madrasah: skema, index migrasi, status formulir, susunan panitia, dan akses menu kepanitiaan."""
import asyncio
import os
import sys

import pytest
from pydantic import ValidationError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, os.path.dirname(__file__))

import migrasi_otomatis  # noqa: E402
import ujian as uj  # noqa: E402
from migrations.migrate_ujian import migrate  # noqa: E402
from pkg_palsu import Db  # noqa: E402


def test_migrasi_terdaftar_dan_membuat_index_unik():
    assert ('2026-11-20_ujian', migrasi_otomatis._ujian) in migrasi_otomatis.MIGRASI
    db = Db()
    db.semesters.docs.append({'id': 's1', 'name': 'Ganjil', 'academic_year_id': 'tp1'})
    db.academic_years.docs.append({'id': 'tp1', 'name': '2026/2027'})
    db.ujian.docs.append({'id': 'u-lama', 'semester_id': 's1', 'jenis': 'UTS'})
    hasil = asyncio.run(migrate(db))
    assert hasil['semester_dilengkapi'] == 1
    assert db.ujian.docs[0]['tahun_pelajaran'] == '2026/2027' and db.ujian.docs[0]['semester_nama'] == 'Ganjil'
    unik = {tuple(k for k, _ in keys) for keys, opsi in db.panitia_ujian.index if opsi.get('unique')}
    assert ('ujian_id', 'jabatan') in unik and ('ujian_id', 'user_id') in unik and ('id',) in unik
    assert any(opsi.get('unique') for keys, opsi in db.ujian.index if keys == [('id', 1)])
    # Berulang aman: tidak ada lagi yang perlu dilengkapi.
    assert asyncio.run(migrate(db))['semester_dilengkapi'] == 0


def test_migrasi_dry_run_tidak_mengubah():
    db = Db()
    db.ujian.docs.append({'id': 'u1', 'semester_id': 's?'})
    hasil = asyncio.run(migrate(db, dry_run=True))
    assert hasil['dry_run'] and hasil['semester_dilengkapi'] == 1
    assert 'tahun_pelajaran' not in db.ujian.docs[0]
    assert not getattr(db.ujian, 'index', [])


def test_ujian_in_validasi():
    ok = uj.UjianIn(jenis='UAS', nama='  ASAS   Ganjil 2026/2027 ', mulai='2026-12-01', selesai='2026-12-06')
    assert ok.nama == 'ASAS Ganjil 2026/2027'
    with pytest.raises(ValidationError):
        uj.UjianIn(jenis='UKK', nama='Ujian', mulai='2026-12-01', selesai='2026-12-06')
    with pytest.raises(ValidationError, match='tidak boleh sebelum'):
        uj.UjianIn(jenis='UTS', nama='ASTS', mulai='2026-12-06', selesai='2026-12-01')
    with pytest.raises(ValidationError):
        uj.UjianIn(jenis='UTS', nama='ASTS', mulai='2026-02-30', selesai='2026-03-01')


def test_status_formulir():
    u = {'mulai': '2026-12-01', 'selesai': '2026-12-06'}
    f = {'aktif': True, 'jam_buka': '07:00', 'jam_tutup': '12:00'}
    assert uj.status_formulir(u, None, '2026-12-02', '08:00') == 'tertutup'
    assert uj.status_formulir(u, f, '2026-11-30', '08:00') == 'tertutup'
    assert uj.status_formulir(u, f, '2026-12-02', '08:00') == 'dibuka'
    assert uj.status_formulir(u, f, '2026-12-02', '13:00') == 'tertutup'
    assert uj.status_formulir(u, {'aktif': True}, '2026-12-06', '23:00') == 'dibuka'
    assert uj.status_formulir(u, f, '2026-12-07', '08:00') == 'selesai'
    assert uj.status_formulir(u, None, '2026-12-07', '08:00') == 'selesai'


def test_galat_susunan_satu_orang_satu_jabatan():
    assert uj.galat_susunan_panitia({'ketua': 'a', 'sekretaris': 'b'}) == {}
    galat = uj.galat_susunan_panitia({'penanggung_jawab': 'a', 'ketua': 'a', 'bendahara': 'a'})
    assert set(galat) == {'ketua', 'bendahara'} and 'Penanggung Jawab' in galat['ketua']
    assert uj.PanitiaIn(ketua='  ', sekretaris='x').ketua is None


def test_menu_panitia_sesuai_jabatan():
    semua = uj.menu_panitia_ujian(True, False, [])
    assert all(m['akses'] for m in semua) and len(semua) == len(uj.MENU_UJIAN)

    bendahara = {m['key']: m for m in uj.menu_panitia_ujian(False, False, ['bendahara'])}
    assert bendahara['cetak']['akses'] and bendahara['daftar_hadir']['akses']
    assert not bendahara['arsip']['akses'] and bendahara['arsip']['alasan'] == 'jabatan_lain'
    assert not bendahara['panitia']['akses'] and bendahara['panitia']['alasan'] == 'khusus_pengelola'

    sekretaris = uj.menu_panitia_ujian(False, False, ['sekretaris'])
    assert uj.boleh_menu(sekretaris, 'arsip') and uj.boleh_menu(sekretaris, 'nilai') and not uj.boleh_menu(sekretaris, 'panitia')

    kamad = uj.menu_panitia_ujian(False, True, [])
    assert uj.boleh_menu(kamad, 'arsip') and uj.boleh_menu(kamad, 'cetak') and not uj.boleh_menu(kamad, 'nilai')

    bukan = uj.menu_panitia_ujian(False, False, [])
    assert not any(m['akses'] for m in bukan) and {m['alasan'] for m in bukan} == {'bukan_panitia'}


def test_ringkas_ujian_dan_identitas():
    doc = {'id': 'u1', 'jenis': 'UAS', 'nama': 'ASAS', 'semester_id': 's1', 'semester_nama': 'Ganjil',
           'tahun_pelajaran': '2026/2027', 'mulai': '2026-12-01', 'selesai': '2026-12-06'}
    r = uj.ringkas_ujian(doc, {'aktif': True}, '2026-12-01', '08:00', jumlah_ruang=2, jabatan_saya='ketua')
    assert r['formulir'] == {'aktif': True, 'jam_buka': None, 'jam_tutup': None, 'status': 'dibuka', 'alasan': None,
                             'pesan': 'Formulir dibuka.'}
    tutup = uj.ringkas_ujian(doc, {'aktif': True, 'jam_buka': '07:00', 'jam_tutup': '12:00'}, '2026-12-01', '13:00')['formulir']
    assert tutup['status'] == 'tertutup' and tutup['alasan'] == 'di_luar_jam' and '07:00–12:00' in tutup['pesan']
    assert r['semester'] == 'Ganjil' and r['jumlah_ruang'] == 2 and r['jabatan_saya'] == 'ketua'
    p = uj.identitas_pejabat({'id': 'g1', 'full_name': 'Bu Siti', 'nipm': '123', 'roles': ['guru']})
    assert p == {'user_id': 'g1', 'nama': 'Bu Siti', 'nip': '123', 'peran': 'guru'}
    assert uj.identitas_pejabat({'id': 'g2', 'full_name': 'X', 'peg_id': 'P9', 'nip': ' ', 'roles': []})['nip'] == 'P9'
    assert uj.identitas_pejabat({'id': 'g3', 'full_name': 'Y', 'nip': '1980', 'peg_id': 'P9'})['nip'] == '1980'
    assert uj.identitas_pejabat({'id': 'g4', 'username': 'z'}) == {'user_id': 'g4', 'nama': 'z', 'nip': '-', 'peran': None}


def test_akses_peran():
    assert uj.adalah_pengelola({'active_role': 'admin', 'roles': ['admin']})
    assert uj.adalah_pengelola({'active_role': 'guru', 'roles': ['guru', 'admin']})
    assert not uj.adalah_pengelola({'active_role': 'waka_kurikulum', 'roles': ['waka_kurikulum', 'guru']})
    assert not uj.adalah_pengelola({'active_role': 'kepala_sekolah', 'roles': ['kepala_sekolah']})
    assert uj.adalah_pimpinan({'active_role': 'kepala_sekolah'}) and uj.adalah_pimpinan({'active_role': 'waka_kurikulum'})
    assert uj.mungkin_panitia({'active_role': 'guru'}) and not uj.mungkin_panitia({'active_role': 'siswa'})


def _oleh():
    return {'id': 'admin', 'full_name': 'Administrator'}


def _pejabat(*ids):
    return {i: {'user_id': i, 'nama': f'Nama {i}', 'nip': f'NIP {i}', 'peran': 'guru'} for i in ids}


def test_terapkan_susunan_panitia_dan_pertukaran():
    db = Db()
    pj = _pejabat('a', 'b', 'c')
    h = asyncio.run(uj.terapkan_susunan_panitia(db, 'u1', {'ketua': 'a', 'sekretaris': 'b'}, pj, _oleh()))
    assert h['berubah'] == ['ketua', 'sekretaris']
    susunan = uj.susunan_dari_dokumen(db.panitia_ujian.docs)
    assert susunan['ketua']['nama'] == 'Nama a' and susunan['bendahara'] is None
    waktu_ketua = next(d for d in db.panitia_ujian.docs if d['jabatan'] == 'ketua')['ditetapkan_pada']

    # Tukar ketua <-> sekretaris & tambah bendahara: dihapus dulu baru ditulis (aman bagi index unik).
    h = asyncio.run(uj.terapkan_susunan_panitia(db, 'u1', {'ketua': 'b', 'sekretaris': 'a', 'bendahara': 'c'}, pj, _oleh()))
    assert h['berubah'] == ['ketua', 'sekretaris', 'bendahara'] and h['sebelum']['ketua'] == 'a'
    assert {d['jabatan']: d['user_id'] for d in db.panitia_ujian.docs} == {'ketua': 'b', 'sekretaris': 'a', 'bendahara': 'c'}

    # Tanpa perubahan: tidak menulis apa pun; mengosongkan jabatan menghapus barisnya.
    assert asyncio.run(uj.terapkan_susunan_panitia(db, 'u1', {'ketua': 'b', 'sekretaris': 'a', 'bendahara': 'c'}, pj, _oleh()))['berubah'] == []
    asyncio.run(uj.terapkan_susunan_panitia(db, 'u1', {'ketua': 'b', 'sekretaris': 'a'}, pj, _oleh()))
    assert {d['jabatan'] for d in db.panitia_ujian.docs} == {'ketua', 'sekretaris'}
    assert uj.perubahan_terakhir(db.panitia_ujian.docs)['oleh_nama'] == 'Administrator'
    assert waktu_ketua  # penetapan awal tercatat


async def test_index_unik_panitia_di_mongodb(mongo_db):
    """Index unik sungguhan: satu jabatan satu orang & satu orang satu jabatan per ujian."""
    from pymongo.errors import DuplicateKeyError
    await uj.pastikan_index_ujian(mongo_db)
    pj = _pejabat('a', 'b')
    await mongo_db.panitia_ujian.insert_one(uj.dokumen_panitia('u1', 'ketua', pj['a'], _oleh()))
    with pytest.raises(DuplicateKeyError):
        await mongo_db.panitia_ujian.insert_one(uj.dokumen_panitia('u1', 'ketua', pj['b'], _oleh()))
    with pytest.raises(DuplicateKeyError):
        await mongo_db.panitia_ujian.insert_one(uj.dokumen_panitia('u1', 'sekretaris', pj['a'], _oleh()))
    await mongo_db.panitia_ujian.insert_one(uj.dokumen_panitia('u2', 'ketua', pj['a'], _oleh()))  # ujian lain boleh
    h = await uj.terapkan_susunan_panitia(mongo_db, 'u1', {'ketua': 'b', 'sekretaris': 'a'}, pj, _oleh())
    assert h['berubah'] == ['ketua', 'sekretaris']


def test_akses_per_ujian_menurut_jabatan_di_ujian_itu():
    assert uj.boleh_akses_ujian(True, False, None, 'panitia')
    assert uj.boleh_akses_ujian(False, True, None, 'arsip') and not uj.boleh_akses_ujian(False, True, None, 'ruang')
    assert uj.boleh_akses_ujian(False, False, 'ketua', 'arsip')
    assert not uj.boleh_akses_ujian(False, False, 'bendahara', 'arsip')
    assert not uj.boleh_akses_ujian(False, False, None, 'cetak')
    assert uj.pesan_tolak_menu('panitia') == 'Menu Kepanitiaan hanya untuk admin'
    assert 'ketua panitia, sekretaris panitia' in uj.pesan_tolak_menu('arsip')
