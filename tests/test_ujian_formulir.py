"""Ujian Madrasah — Pengaturan Formulir: skema, migrasi, aktivasi, template, pola TTD, dan jadwal sesi."""
import asyncio
import os
import sys

import pytest
from pydantic import ValidationError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, os.path.dirname(__file__))

import migrasi_otomatis  # noqa: E402
import ujian_formulir as uf  # noqa: E402
from migrations.migrate_ujian_formulir import migrate  # noqa: E402
from pkg_palsu import Db  # noqa: E402


def test_migrasi_formulir_bawaan_token_dan_index():
    assert ('2026-11-20_ujian_formulir', migrasi_otomatis._ujian_formulir) in migrasi_otomatis.MIGRASI
    db = Db()
    db.settings.docs.append({'id': 'global_config', 'school_name': 'MTsN 9 Contoh', 'address': 'Jl. Contoh 1', 'city': 'Kota Malang'})
    db.ujian.docs += [{'id': 'u1', 'jenis': 'UTS'}, {'id': 'u2', 'jenis': 'UAS'}]
    db.formulir_ujian.docs.append({'ujian_id': 'u2', 'aktif': True})
    h = asyncio.run(migrate(db))
    assert h['formulir_dibuat'] == 1 and h['token_dilengkapi'] == 1
    f1 = next(f for f in db.formulir_ujian.docs if f['ujian_id'] == 'u1')
    assert f1['aktif'] is False and len(f1['token']) >= 20
    assert f1['template']['nama_madrasah'] == 'MTsN 9 Contoh' and f1['template']['kota_ttd'] == 'Malang'
    assert f1['template']['singkatan_ujian'] == 'ASTS' and f1['template']['nama_kegiatan'] == 'Asesmen Sumatif Tengah Semester'
    assert next(f for f in db.formulir_ujian.docs if f['ujian_id'] == 'u2')['token']
    idx = {o.get('name'): o for _, o in db.formulir_ujian.index}
    assert idx['formulir_unik_token']['unique'] and 'partialFilterExpression' in idx['formulir_unik_token']
    assert any(o.get('name') == 'jadwal_unik_sesi' and o['unique'] for _, o in db.jadwal_ujian.index)
    assert asyncio.run(migrate(db))['formulir_dibuat'] == 0
    assert uf.token_baru() != uf.token_baru()


def test_aktivasi_template_pola_validasi():
    assert uf.AktivasiIn(aktif=False, jam_buka='', jam_tutup=None).jam_buka is None
    assert uf.AktivasiIn(aktif=True, jam_buka='07:00', jam_tutup='12:00').aktif
    for salah in ({'aktif': True, 'jam_buka': '07:00'}, {'aktif': False, 'jam_buka': '12:00', 'jam_tutup': '07:00'},
                  {'aktif': True, 'jam_buka': '7:00', 'jam_tutup': '12:00'}):
        with pytest.raises(ValidationError):
            uf.AktivasiIn(**salah)
    t = uf.TemplateIn(**{**uf.TEMPLATE_BAWAAN, 'alamat': '  Jl.  Raya  '})
    assert t.alamat == 'Jl. Raya'
    with pytest.raises(ValidationError):
        uf.TemplateIn(**{**uf.TEMPLATE_BAWAAN, 'kota_ttd': '  '})
    with pytest.raises(ValidationError):
        uf.PolaTtdIn(tinggi_mm=25)


def test_jadwal_sesi():
    s = [uf.SesiIn(tanggal='2026-12-01', sesi_ke=1, jam_mulai='07:30', jam_selesai='09:30', mapel={'7': ' Matematika ', 8: 'IPA', '9': ''}),
         uf.SesiIn(tanggal='2026-12-01', sesi_ke=2, jam_mulai='09:00', jam_selesai='11:00'),
         uf.SesiIn(tanggal='2026-12-09', sesi_ke=1, jam_mulai='07:30', jam_selesai='09:30'),
         uf.SesiIn(tanggal='2026-12-02', sesi_ke=1, jam_mulai='07:30', jam_selesai='09:30'),
         uf.SesiIn(tanggal='2026-12-02', sesi_ke=1, jam_mulai='10:00', jam_selesai='11:30')]
    assert s[0].mapel == {'7': 'Matematika', '8': 'IPA'}
    galat = uf.galat_jadwal(s, '2026-12-01', '2026-12-06')
    assert any('bertumpuk' in g for g in galat) and any('di luar masa ujian' in g for g in galat) and any('ganda' in g for g in galat)
    assert uf.galat_jadwal(s[:1], '2026-12-01', '2026-12-06') == []
    with pytest.raises(ValidationError):
        uf.SesiIn(tanggal='2026-12-01', jam_mulai='10:00', jam_selesai='09:00')
    with pytest.raises(ValidationError):
        uf.SesiIn(tanggal='2026-12-01', jam_mulai='07:00', jam_selesai='09:00', mapel={'10': 'X'})


def test_ringkas_pengaturan():
    ujian = {'id': 'u1', 'jenis': 'UTS', 'mulai': '2026-12-01', 'selesai': '2026-12-06'}
    f = uf.dokumen_formulir_baru(ujian)
    f.update(uf.set_ubah('aktivasi', {'aktif': True, 'jam_buka': '07:00', 'jam_tutup': '12:00'}, {'id': 'a', 'full_name': 'Admin'}))
    f['diubah'] = {'aktivasi': f.pop('diubah.aktivasi')}
    r = uf.ringkas_pengaturan(ujian, f, '2026-12-01', '08:00', 'https://x')
    assert r['status'] == 'dibuka' and r['tautan']['daftar_hadir'] == f"https://x/publik/ujian/{f['token']}/daftar-hadir"
    assert r['diubah']['aktivasi']['oleh_nama'] == 'Admin' and r['diubah']['template'] is None
    assert r['pola_ttd'] == {'tampil_di_cetak': True, 'tinggi_mm': 12} and r['template']['singkatan_ujian'] == 'ASTS'


def test_cek_waktu_formulir_dan_sesi_aktif():
    u = {'mulai': '2026-12-01', 'selesai': '2026-12-06'}
    f = {'aktif': True, 'jam_buka': '07:00', 'jam_tutup': '12:00'}
    assert uf.cek_waktu_formulir(u, f, '2026-12-02', '08:00')['terbuka']
    assert uf.cek_waktu_formulir(u, {**f, 'aktif': False}, '2026-12-02', '08:00')['alasan'] == 'nonaktif'
    assert uf.cek_waktu_formulir(u, f, '2026-11-30', '08:00')['alasan'] == 'belum_mulai'
    r = uf.cek_waktu_formulir(u, f, '2026-12-02', '12:01')
    assert r['alasan'] == 'di_luar_jam' and r['pesan'] == 'Formulir hanya dapat diisi pukul 07:00–12:00 WIB.'
    assert uf.cek_waktu_formulir(u, f, '2026-12-07', '08:00')['status'] == 'selesai'
    assert uf.cek_waktu_formulir(u, None, '2026-12-02', '08:00')['alasan'] == 'nonaktif'

    jadwal = [{'id': 'a', 'tanggal': '2026-12-02', 'sesi_ke': 1, 'jam_mulai': '07:30', 'jam_selesai': '09:30'},
              {'id': 'b', 'tanggal': '2026-12-02', 'sesi_ke': 2, 'jam_mulai': '10:00', 'jam_selesai': '12:00'},
              {'id': 'c', 'tanggal': '2026-12-03', 'sesi_ke': 1, 'jam_mulai': '07:30', 'jam_selesai': '09:30'}]
    assert [s['id'] for s in uf.sesi_pada(jadwal, '2026-12-02')] == ['a', 'b']
    assert uf.sesi_aktif(jadwal, '2026-12-02', '06:00')['id'] == 'a'   # belum ada yang dimulai -> sesi pertama
    assert uf.sesi_aktif(jadwal, '2026-12-02', '06:45')['id'] == 'a'   # dalam toleransi 60 menit
    assert uf.sesi_aktif(jadwal, '2026-12-02', '09:45')['id'] == 'b'   # toleransi sesi 2
    assert uf.sesi_aktif(jadwal, '2026-12-02', '13:00')['id'] == 'b'   # sesi terakhir yang sudah dimulai
    assert uf.sesi_aktif(jadwal, '2026-12-04', '08:00') is None
