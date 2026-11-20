"""Ujian Madrasah — Ruang & Peserta: skema ruang, nomor peserta, index migrasi, dan jejak audit."""
import asyncio
import os
import sys

import pytest
from pydantic import ValidationError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, os.path.dirname(__file__))

import migrasi_otomatis  # noqa: E402
import ujian_ruang as ur  # noqa: E402
from migrations.migrate_ujian_ruang import migrate  # noqa: E402
from pkg_palsu import Db  # noqa: E402


def test_migrasi_terdaftar_index_dan_pelengkapan():
    assert ('2026-11-20_ujian_ruang', migrasi_otomatis._ujian_ruang) in migrasi_otomatis.MIGRASI
    nama = [n for n, _ in migrasi_otomatis.MIGRASI]
    assert nama.index('2026-11-20_ujian') < nama.index('2026-11-20_ujian_ruang')
    db = Db()
    db.ruang_ujian.docs.append({'id': 'r1', 'ujian_id': 'u1', 'nama_ruang': ' Lab  A '})
    db.peserta_ruang.docs += [{'id': 'p1', 'nomor_peserta': ' 01-a '}, {'id': 'p2', 'nomor_peserta': ''}]
    h = asyncio.run(migrate(db))
    assert h['ruang_dilengkapi'] == 1 and h['peserta_dilengkapi'] == 2
    assert db.ruang_ujian.docs[0]['nama_kunci'] == 'lab a'
    assert [p['nomor_kunci'] for p in db.peserta_ruang.docs] == ['01-A', None]
    idx = {opsi.get('name'): (keys, opsi) for keys, opsi in db.peserta_ruang.index}
    assert idx['peserta_unik_nomor'][1]['partialFilterExpression'] == {'nomor_kunci': {'$type': 'string'}}
    assert idx['peserta_unik_siswa'][1]['unique']
    assert any(o.get('unique') for k, o in db.guru_pengawas.index if k == [('user_id', 1)])
    assert asyncio.run(migrate(db))['ruang_dilengkapi'] == 0


def test_migrasi_dry_run():
    db = Db()
    db.ruang_ujian.docs.append({'id': 'r1', 'nama_ruang': '01'})
    assert asyncio.run(migrate(db, dry_run=True))['ruang_dilengkapi'] == 1
    assert 'nama_kunci' not in db.ruang_ujian.docs[0] and not getattr(db.ruang_ujian, 'index', [])


def test_ruang_in_validasi():
    r = ur.RuangIn(nama_ruang='  01 ', jenjang=[8, 7], kapasitas=32, keterangan=' Gedung  A ')
    assert r.nama_ruang == '01' and r.jenjang == [7, 8] and r.keterangan == 'Gedung A'
    for salah in ({'jenjang': []}, {'jenjang': [7, 8, 9]}, {'jenjang': [10]}, {'jenjang': [7, 7]}, {'kapasitas': 0},
                  {'kapasitas': 61}, {'nama_ruang': '   '}):
        with pytest.raises(ValidationError):
            ur.RuangIn(**{'nama_ruang': '01', 'jenjang': [7], **salah})


def test_nomor_peserta_dan_bantuan():
    assert ur.galat_format_nomor('') == '' and ur.galat_format_nomor('01-001') == ''
    assert ur.galat_format_nomor('A/2026.7-1') == ''
    assert 'Hanya huruf' in ur.galat_format_nomor('01 001') and 'Hanya huruf' in ur.galat_format_nomor('-01')
    assert 'Maksimal' in ur.galat_format_nomor('9' * 31)
    assert ur.kunci_nomor(' 01-a ') == '01-A' and ur.kunci_nomor('  ') is None
    assert sorted(['10', '2', '01', 'Lab'], key=ur.urut_nama_ruang) == ['01', '2', '10', 'Lab']
    assert ur.jenjang_terlepas([7, 8], [7], {7: 3, 8: 2}) == [8]
    assert ur.jenjang_terlepas([7, 8], [7], {7: 3}) == []


def test_ringkas_ruang_dan_jejak():
    doc = ur.dokumen_ruang_baru('u1', ur.RuangIn(nama_ruang='03', jenjang=[7, 9]), {'id': 'a', 'full_name': 'Admin'})
    assert doc['nama_kunci'] == '03' and doc['kapasitas'] == 32
    r = ur.ringkas_ruang(doc, {7: 10, 9: 5, 8: 99})
    assert r['per_jenjang'] == {'7': 10, '9': 5} and r['jumlah_peserta'] == 15
    db = Db()
    j = asyncio.run(ur.catat_jejak(db, 'u1', 'ruang_tambah', {'id': 'a', 'full_name': 'Admin'}, 'Ruang 03 ditambahkan'))
    assert db.ujian_jejak.docs[0]['oleh_nama'] == 'Admin' and ur.ringkas_jejak(j)['aksi'] == 'ruang_tambah'


def test_rencana_nomor_unik_per_ujian():
    semua = [
        {'id': 'a', 'ruang_id': 'r1', 'nama': 'A', 'nomor_peserta': '01-001'},
        {'id': 'b', 'ruang_id': 'r1', 'nama': 'B', 'nomor_peserta': '01-002'},
        {'id': 'c', 'ruang_id': 'r2', 'nama': 'C', 'nomor_peserta': '02-001'},
        {'id': 'd', 'ruang_id': 'r1', 'nama': 'D', 'nomor_peserta': ''},
    ]
    # Tukar nomor a <-> b dalam satu kiriman sah; d memakai nomor ruang lain (tanpa beda huruf) ditolak.
    ubah, galat = ur.rencana_nomor(semua, 'r1', [
        {'peserta_id': 'a', 'nomor_peserta': '01-002'}, {'peserta_id': 'b', 'nomor_peserta': '01-001'},
        {'peserta_id': 'd', 'nomor_peserta': '02-001 '}, {'peserta_id': 'c', 'nomor_peserta': '9'},
        {'peserta_id': 'x', 'nomor_peserta': '9'},
    ])
    assert ubah == {'a': '01-002', 'b': '01-001'}
    assert {g['peserta_id']: g['pesan'] for g in galat} == {
        'd': 'No. Peserta 02-001 sudah dipakai C', 'c': 'Peserta tidak ada di ruang ini', 'x': 'Peserta tidak ada di ruang ini'}
    # Dua peserta diberi nomor sama dalam satu kiriman: keduanya ditolak; format salah ditolak; kosong = hapus nomor.
    ubah, galat = ur.rencana_nomor(semua, 'r1', [{'peserta_id': 'b', 'nomor_peserta': 'X'}, {'peserta_id': 'd', 'nomor_peserta': 'x'},
                                                {'peserta_id': 'a', 'nomor_peserta': '01 001'}])
    assert ubah == {} and len(galat) == 3
    ubah, galat = ur.rencana_nomor(semua, 'r1', [{'peserta_id': 'a', 'nomor_peserta': ''}, {'peserta_id': 'b', 'nomor_peserta': '01-002'}])
    assert ubah == {'a': ''} and galat == []


def test_terapkan_nomor_kosongkan_dulu():
    db = Db()
    db.peserta_ruang.docs += [{'id': 'a', 'nomor_peserta': '1', 'nomor_kunci': '1'}, {'id': 'b', 'nomor_peserta': '2', 'nomor_kunci': '2'}]
    assert asyncio.run(ur.terapkan_nomor(db, {'a': '2', 'b': '1'})) == []
    assert {d['id']: d['nomor_kunci'] for d in db.peserta_ruang.docs} == {'a': '2', 'b': '1'}


def test_penetapan_sekali_untuk_seluruh_ujian():
    db = Db()
    db.ruang_ujian.docs += [{'id': 'r1', 'nama_ruang': '01', 'jenjang': [7, 8]}, {'id': 'r2', 'nama_ruang': '02', 'jenjang': [9]}]
    db.peserta_ruang.docs += [
        {'id': 'a', 'ujian_id': 'u', 'ruang_id': 'r1', 'siswa_id': 's1', 'nama': 'B', 'kelas': '8A', 'jenjang': 8, 'nomor_peserta': '01-002'},
        {'id': 'b', 'ujian_id': 'u', 'ruang_id': 'r1', 'siswa_id': 's2', 'nama': 'A', 'kelas': '7A', 'jenjang': 7, 'nomor_peserta': '01-001'},
        {'id': 'c', 'ujian_id': 'u', 'ruang_id': 'r1', 'siswa_id': 's3', 'nama': 'C', 'kelas': '7A', 'jenjang': 7, 'nomor_peserta': ''},
    ]
    semua = asyncio.run(ur.peserta_ruang_ujian(db, 'u', 'r1'))
    assert [p['id'] for p in semua] == ['b', 'a', 'c']
    assert [p['id'] for p in asyncio.run(ur.peserta_ruang_ujian(db, 'u', 'r1', jenjang=7))] == ['b', 'c']
    t = asyncio.run(ur.penempatan_siswa(db, 'u', 's1'))
    assert t['ruang']['nama_ruang'] == '01' and t['peserta']['nomor_peserta'] == '01-002'
    assert asyncio.run(ur.penempatan_siswa(db, 'u', 'tidak-ada')) is None
    k = ur.kesiapan_plotting(db.ruang_ujian.docs, db.peserta_ruang.docs, 2)
    assert k == {'ruang_kosong': ['02'], 'tanpa_nomor': 1, 'belum_ditempatkan': 2, 'siap': False}
    assert ur.kesiapan_plotting(db.ruang_ujian.docs[:1], db.peserta_ruang.docs[:2], 0)['siap'] is True
