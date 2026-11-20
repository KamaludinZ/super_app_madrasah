"""Ujian Madrasah — Nilai UAS: skema, migrasi (index & log macet), validasi nilai, masa ujian/remidi."""
import asyncio
import os
import sys

import pytest
from pydantic import ValidationError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, os.path.dirname(__file__))

import migrasi_otomatis  # noqa: E402
import ujian_nilai as un  # noqa: E402
from migrations.migrate_ujian_nilai import migrate  # noqa: E402
from pkg_palsu import Db  # noqa: E402


def test_migrasi_index_dan_log_macet():
    assert ('2026-11-20_ujian_nilai', migrasi_otomatis._ujian_nilai) in migrasi_otomatis.MIGRASI
    db = Db()
    db.nilai_impor_log.docs += [{'id': 'l1', 'status': 'proses'}, {'id': 'l2', 'status': 'selesai'}]
    db.grade_entries.docs += [{'id': 'g1', 'nilai_pengetahuan': 80}, {'id': 'g2', 'nilai_uas': 77, 'nilai_uas_ujian_id': 'u'}]
    assert asyncio.run(migrate(db, dry_run=True))['rapor_dilengkapi'] == 1 and 'nilai_uas' not in db.grade_entries.docs[0]
    h = asyncio.run(migrate(db))
    assert h['log_macet'] == 1 and [d['status'] for d in db.nilai_impor_log.docs] == ['gagal', 'selesai']
    assert h['rapor_dilengkapi'] == 1 and db.grade_entries.docs[0]['nilai_uas'] is None and db.grade_entries.docs[0]['nilai_pengetahuan'] == 80
    asyncio.run(migrate(db))  # idempoten: nilai yang sudah ada tidak tertimpa
    assert db.grade_entries.docs[1]['nilai_uas'] == 77 and db.grade_entries.docs[1]['nilai_uas_ujian_id'] == 'u'
    assert any(o.get('name') == 'rapor_siswa_mapel_semester' for _, o in db.grade_entries.index)
    assert any(o.get('unique') for k, o in db.nilai_ujian_riwayat.index if k == [('id', 1)])
    assert 'dimulai ulang' in db.nilai_impor_log.docs[0]['pesan']
    assert any(o.get('name') == 'nilai_unik_siswa' and o['unique'] for _, o in db.nilai_ujian.index)
    assert any(o.get('unique') for k, o in db.nilai_masa.index if k == [('ujian_id', 1)])


def test_log_dan_validasi_nilai():
    log = un.dokumen_log_impor('u', {'id': 'm1', 'name': 'Matematika'}, 7, 'a.xlsx', {'id': 'a', 'full_name': 'Admin'})
    assert log['status'] == 'proses' and log['mapel_nama'] == 'Matematika'
    assert 'galat' not in un.ringkas_log(log) and un.ringkas_log(log, True)['galat'] == []
    assert un.galat_nilai(85) is None and un.galat_nilai('') is None and un.galat_nilai(None) is None and un.galat_nilai('87,5') is None
    assert 'bukan angka' in un.galat_nilai('delapan') and 'luar rentang' in un.galat_nilai(105) and 'luar rentang' in un.galat_nilai(-1)
    assert un.ke_angka('87,5') == 87.5 and un.ke_angka('90') == 90 and un.ke_angka(' ') is None
    assert un.rekap_kelas([{'nilai': 80}, {'nilai': 90}, {'nilai': None}], 4) == {'total': 4, 'terisi': 2, 'rata': 85.0}


def test_masa_ujian_remidi():
    assert un.MasaIn(aktif=False).mulai is None
    with pytest.raises(ValidationError):
        un.MasaIn(aktif=True, mulai='2026-12-01')
    with pytest.raises(ValidationError):
        un.MasaIn(aktif=True, mulai='2026-12-05', selesai='2026-12-01')
    doc = {'ujian': {'aktif': True, 'mulai': '2026-12-01', 'selesai': '2026-12-06'}, 'remidi': {'aktif': True, 'mulai': '2026-12-10', 'selesai': '2026-12-12'}}
    assert un.masa_terbuka(doc, '2026-12-02') == 'ujian' and un.masa_terbuka(doc, '2026-12-11') == 'remidi'
    assert un.masa_terbuka(doc, '2026-12-08') is None and un.masa_terbuka(None, '2026-12-02') is None
    assert un.masa_terbuka({**doc, 'ujian': {**doc['ujian'], 'aktif': False}}, '2026-12-02') is None


def test_riwayat_dan_kode_semester_rapor():
    dok = un.dokumen_nilai('u', 'm', {'id': 's1', 'kelas_id': 'k7a', 'kelas': '7A', 'jenjang': 7}, 88, 'input_guru',
                           {'id': 'g1', 'full_name': 'Bu Siti'}, impor_log_id=None)
    r = un.dokumen_riwayat(dok, 80)
    assert (r['nilai_lama'], r['nilai_baru'], r['sumber'], r['oleh_nama'], r['kelas_id']) == (80, 88, 'input_guru', 'Bu Siti', 'k7a')
    assert un.kode_semester_rapor({'code': 'ganjil'}) == 'ganjil' and un.kode_semester_rapor({'name': 'Genap'}) == 'genap'
    assert un.kode_semester_rapor({'code': '3'}) == 'ganjil' and un.kode_semester_rapor(None) is None
    assert set(un.SUMBER_NILAI) == set(un.LABEL_SUMBER)
