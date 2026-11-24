"""Ujian Madrasah — Portal Ujian & Link Soal: skema, validasi tautan soal, tautan publik jenis portal, dan migrasi."""
import asyncio
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, os.path.dirname(__file__))

import migrasi_otomatis  # noqa: E402
import ujian_info as ui  # noqa: E402
import ujian_portal as up  # noqa: E402
from migrations.migrate_ujian_portal import migrate  # noqa: E402
from pkg_palsu import Db  # noqa: E402

FRONTEND_LIB = Path(__file__).resolve().parents[1] / 'frontend' / 'src' / 'lib'


def test_url_soal_hanya_http_https():
    for sah in ('https://cbt.madrasah.sch.id/ujian/7/ipa', 'http://10.0.0.5:8080/x?y=1', '  HTTPS://Forms.gle/abc  '):
        assert up.url_soal_aman(sah) == sah.strip()
    for salah in ('javascript:alert(1)', 'data:text/html,<b>x</b>', 'file:///etc/passwd', 'ftp://a.b/c', 'vbscript:x',
                  'https://a b.c', 'http:///x', 'https:\\\\a.com', 'https://user:sandi@evil.com', 'https://user@evil.com',
                  '//a.com', 'cbt.madrasah.sch.id', '', None, 'https://' + 'x' * up.URL_SOAL_MAKS):
        assert up.url_soal_aman(salah) is None, salah
    assert up.host_url('https://www.cbt.sch.id/x') == 'cbt.sch.id' and up.host_url('bukan url') == ''


def test_url_soal_sama_dengan_frontend():
    js = (FRONTEND_LIB / 'ujianLinkSoal.js').read_text(encoding='utf-8')
    assert re.search(r'export const URL_SOAL_MAKS = (\d+);', js).group(1) == str(up.URL_SOAL_MAKS)


def test_link_soal_rusak_dilaporkan():
    assert up.link_soal_rusak({'url': '', 'mulai_at': None, 'selesai_at': None}) is None
    assert up.link_soal_rusak({'url': 'https://a.id', 'mulai_at': '2026-12-02T07:30:00+07:00', 'selesai_at': '2026-12-02T09:00:00+07:00'}) is None
    assert up.link_soal_rusak({'url': 'javascript:1'}) == 'url_tidak_sah'
    assert up.link_soal_rusak({'url': 'https://a.id', 'mulai_at': 'kemarin'}) == 'jendela_tidak_terbaca'
    assert up.link_soal_rusak({'mulai_at': '2026-12-02T09:00:00+07:00', 'selesai_at': '2026-12-02T09:00:00+07:00'}) == 'jendela_terbalik'


def test_tautan_publik_jenis_portal_terpisah():
    assert ui.JENIS_TAUTAN == ('info', 'monitoring', 'portal')
    t = ui.dokumen_tautan_baru('u1', 'portal', {'id': 'adm', 'full_name': 'Admin'})
    assert t['aktif'] is False and t['mulai_at'] is None and len(t['token']) == 32
    assert ui.jalur_tautan(t) == f"/publik/portal-ujian/{t['token']}"
    assert ui.cek_tautan(t)['pesan'] == 'Tautan portal ujian sedang ditutup panitia.'
    js = (FRONTEND_LIB / 'ujianTautanPublik.js').read_text(encoding='utf-8')
    assert re.findall(r"\{ jenis: '([a-z]+)'", js) == list(ui.JENIS_TAUTAN)  # urutan kartu frontend = backend
    assert "pola: '/publik/portal-ujian/'" in js


def test_log_akses_punya_aksi():
    t = {'id': 't1', 'ujian_id': 'u1', 'jenis': 'portal'}
    assert ui.dokumen_akses_log(t, 'tok', 'ok')['aksi'] == 'buka_tautan'
    assert ui.dokumen_akses_log(t, 'tok', 'ok', aksi='klik_mengerjakan')['aksi'] == 'klik_mengerjakan'
    try:
        ui.dokumen_akses_log(t, 'tok', 'ok', aksi='hapus')
        raise AssertionError('aksi tidak dikenal harus ditolak')
    except ValueError:
        pass
    assert up.AKSI_AKSES == ('buka_tautan', 'klik_mengerjakan')


def test_migrasi_portal():
    assert ('2026-11-24_ujian_portal', migrasi_otomatis._ujian_portal) in migrasi_otomatis.MIGRASI
    db = Db()
    db.ujian_akses_log.docs.extend([
        {'id': 'a1', 'hasil': 'ok', 'waktu': '2026-12-01T07:00:00+07:00'},
        {'id': 'a2', 'hasil': 'ok', 'aksi': 'klik_mengerjakan', 'link_soal_id': 'l1', 'waktu': '2026-12-01T08:00:00+07:00'},
    ])
    db.ujian_link_soal.docs.extend([
        {'id': 'l1', 'ujian_id': 'u1', 'jenjang': 7, 'mapel': 'ipa', 'url': 'https://cbt.id/ipa',
         'mulai_at': '2026-12-01T07:30:00+07:00', 'selesai_at': '2026-12-01T09:00:00+07:00'},
        {'id': 'l2', 'ujian_id': 'u1', 'jenjang': 7, 'mapel': 'ips', 'url': 'javascript:alert(1)'},
    ])
    kering = asyncio.run(migrate(db, dry_run=True))
    assert kering['dry_run'] and kering['log_tanpa_aksi'] == 1 and not getattr(db.ujian_link_soal, 'index', [])

    sebelum = [dict(d) for d in db.ujian_akses_log.docs]
    hasil = asyncio.run(migrate(db))
    assert hasil == {'link_soal': 2, 'link_rusak': 1, 'contoh_link_rusak': [{'id': 'l2', 'alasan': 'url_tidak_sah'}],
                     'log_tanpa_aksi': 1, 'dry_run': False}
    assert db.ujian_akses_log.docs == sebelum  # jejak audit tidak pernah diubah migrasi
    assert db.ujian_link_soal.docs[1]['url'] == 'javascript:alert(1)'  # dilaporkan, tidak diubah
    unik = [(k, o.get('name')) for k, o in db.ujian_link_soal.index if o.get('unique')]
    assert ([('ujian_id', 1), ('jenjang', 1), ('mapel', 1)], 'link_soal_unik_mapel') in unik
    assert any(k == [('link_soal_id', 1), ('aksi', 1), ('waktu', -1)] for k, _ in db.ujian_akses_log.index)
    assert not any('expireAfterSeconds' in o for _, o in db.ujian_akses_log.index)  # log klik tanpa TTL

    assert asyncio.run(migrate(db)) == hasil  # idempoten


def test_kueri_aksi_membaca_log_lama_sebagai_buka_tautan():
    from pkg_palsu import cocok_nilai
    lama, buka, klik = {}, {'aksi': 'buka_tautan'}, {'aksi': 'klik_mengerjakan'}
    cocok = lambda d, q: all(cocok_nilai(d.get(k), v) for k, v in q.items())  # noqa: E731
    assert [cocok(d, up.KUERI_BUKA) for d in (lama, buka, klik)] == [True, True, False]
    assert [cocok(d, up.KUERI_KLIK) for d in (lama, buka, klik)] == [False, False, True]
