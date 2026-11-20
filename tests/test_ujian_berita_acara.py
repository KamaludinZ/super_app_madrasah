"""Ujian Madrasah — Berita Acara & Arsip: skema, index (satu berita acara per ruang per sesi), dokumen."""
import asyncio
import os
import sys

import pytest
from pydantic import ValidationError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, os.path.dirname(__file__))

import migrasi_otomatis  # noqa: E402
import ujian_berita_acara as uba  # noqa: E402
from migrations.migrate_ujian_berita_acara import migrate  # noqa: E402
from pkg_palsu import Db  # noqa: E402


def test_migrasi_index():
    assert ('2026-11-20_ujian_berita_acara', migrasi_otomatis._ujian_berita_acara) in migrasi_otomatis.MIGRASI
    db = Db()
    asyncio.run(migrate(db))
    assert any(o.get('name') == 'ba_unik_ruang_sesi' and o['unique'] for _, o in db.berita_acara.index)
    assert any(o.get('unique') for k, o in db.arsip_ujian_berkas.index if k == [('arsip_id', 1)])
    db2 = Db()
    assert asyncio.run(migrate(db2, dry_run=True))['dry_run'] and not getattr(db2.berita_acara, 'index', [])


def test_isian_dan_dokumen():
    b = uba.BeritaAcaraIn(sesi_id='s', ruang_id='r', pengawas_id='p', catatan='  Tertib   sekali \n\n  satu  terlambat ', ttd_png='data:image/png;base64,AA')
    assert b.catatan == 'Tertib sekali\n\nsatu terlambat'
    with pytest.raises(ValidationError):
        uba.BeritaAcaraIn(sesi_id='s', ruang_id='r', pengawas_id='p', ttd_png='bukan')
    with pytest.raises(ValidationError):
        uba.BeritaAcaraIn(sesi_id='s', ruang_id='r', pengawas_id='p', catatan='x' * 1001, ttd_png='data:image/png;base64,AA')
    rekap = {7: {'total': 3, 'hadir': 2, 'izin': 1, 'sakit': 0, 'alpa': 0, 'belum': 0, 'lengkap': True, 'nomor_hadir': ['1', '2'], 'nomor_tidak_hadir': ['3']},
             8: {'total': 2, 'hadir': 1, 'izin': 0, 'sakit': 0, 'alpa': 1, 'nomor_hadir': ['4'], 'nomor_tidak_hadir': ['5']}}
    d = uba.dokumen_berita_acara('u', {'id': 'r'}, {'id': 's', 'tanggal': '2026-12-02'}, {'id': 'pg', 'user_id': 'g1', 'nama': 'Bu Siti', 'nip': '1'},
                                 rekap, 'Tertib')
    assert d['jumlah_hadir'] == 3 and d['jumlah_izin'] == 2 and d['rekap']['7']['nomor_tidak_hadir'] == ['3'] and 'lengkap' not in d['rekap']['7']
    assert d['pengawas_nama'] == 'Bu Siti' and d['tanggal'] == '2026-12-02'


def _data_url(kosong=False):
    import base64
    import io

    from PIL import Image, ImageDraw
    im = Image.new('RGBA', (240, 90), (0, 0, 0, 0))
    if not kosong:
        ImageDraw.Draw(im).line([(10, 70), (120, 15), (230, 60)], fill=(0, 0, 0, 255), width=5)
    b = io.BytesIO()
    im.save(b, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def test_penyimpanan_ttd_ba():
    db = Db()
    n = asyncio.run(uba.simpan_ttd_ba(db, 'ba1', _data_url()))
    assert n > 0 and asyncio.run(uba.ambil_ttd_ba(db, 'ba1')).startswith(b'\x89PNG')
    asyncio.run(uba.simpan_ttd_ba(db, 'ba1', _data_url()))
    assert len(db.berita_acara_ttd.docs) == 1  # ditimpa, bukan digandakan
    with pytest.raises(ValueError, match='kosong'):
        asyncio.run(uba.simpan_ttd_ba(db, 'ba2', _data_url(kosong=True)))
    with pytest.raises(ValueError):
        asyncio.run(uba.simpan_ttd_ba(db, 'ba2', 'data:image/png;base64,bukan-png'))
    assert asyncio.run(uba.ambil_ttd_ba(db, 'ba2')) is None


def test_rekap_ruang_sesi_dari_daftar_hadir():
    db = Db()
    sesi = {'id': 's1', 'tanggal': '2026-12-02', 'mapel': {'7': 'Matematika', '8': 'IPA'}}
    ruang = {'id': 'r1', 'nama_ruang': '01'}
    assert asyncio.run(uba.rekap_ruang_sesi(db, 'u', ruang, sesi))['kelengkapan']['lengkap'] is False
    db.peserta_ruang.docs += [
        {'id': 'a', 'ujian_id': 'u', 'ruang_id': 'r1', 'nama': 'A', 'kelas': '7A', 'jenjang': 7, 'nomor_peserta': '01-001'},
        {'id': 'b', 'ujian_id': 'u', 'ruang_id': 'r1', 'nama': 'B', 'kelas': '7A', 'jenjang': 7, 'nomor_peserta': '01-002'},
        {'id': 'c', 'ujian_id': 'u', 'ruang_id': 'r1', 'nama': 'C', 'kelas': '8A', 'jenjang': 8, 'nomor_peserta': '01-003'},
    ]
    db.daftar_hadir.docs.append({'id': 'k1', 'peserta_id': 'a', 'sesi_id': 's1', 'status': 'hadir'})
    db.daftar_hadir_status.docs.append({'ujian_id': 'u', 'peserta_id': 'b', 'tanggal': '2026-12-02', 'status': 'izin'})
    h = asyncio.run(uba.rekap_ruang_sesi(db, 'u', ruang, sesi))
    assert h['kelengkapan'] == {'lengkap': False, 'belum': 1, 'pesan': 'Daftar hadir Ruang 01 belum lengkap: 1 peserta belum mengisi atau ditandai panitia.'}
    assert h['rekap'][7]['hadir'] == 1 and h['rekap'][7]['izin'] == 1 and h['rekap'][7]['nomor_tidak_hadir'] == ['01-002']
    db.daftar_hadir_status.docs.append({'ujian_id': 'u', 'peserta_id': 'c', 'tanggal': '2026-12-02', 'status': 'sakit'})
    h = asyncio.run(uba.rekap_ruang_sesi(db, 'u', ruang, sesi))
    assert h['kelengkapan']['lengkap']
    pub = uba.rekap_untuk_publik(h['rekap'], sesi)
    assert [(r['jenjang'], r['mapel'], r['hadir'], r['sakit']) for r in pub] == [(7, 'Matematika', 1, 0), (8, 'IPA', 0, 1)]
