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


MAPEL7 = [{'kode': k, 'nama': n} for k, n in ui.MAPEL_UJIAN_BAKU]


def test_kode_mapel_dari_nama_jadwal():
    assert up.kode_mapel_dari_nama('Matematika', MAPEL7) == 'matematika'
    assert up.kode_mapel_dari_nama('  bahasa   INDONESIA ', MAPEL7) == 'bahasa_indonesia'
    assert up.kode_mapel_dari_nama("Al-Qur'an Hadits", MAPEL7) == 'quran_hadits'
    assert up.kode_mapel_dari_nama('PPKn', MAPEL7) == 'pkn' and up.kode_mapel_dari_nama('Fikih', MAPEL7) == 'fiqh'
    assert up.kode_mapel_dari_nama('ski', MAPEL7) == 'ski'  # kode baku juga dikenali
    assert up.kode_mapel_dari_nama('Prakarya', MAPEL7) is None and up.kode_mapel_dari_nama('', MAPEL7) is None
    # alias hanya berlaku bila mapel tujuannya aktif di jenjang itu
    assert up.kode_mapel_dari_nama('PPKn', [m for m in MAPEL7 if m['kode'] != 'pkn']) is None
    # nama yang diganti admin di master mapel tetap dikenali
    assert up.kode_mapel_dari_nama('Informatika & TIK', [{'kode': 'informatika', 'nama': 'Informatika & TIK'}]) == 'informatika'


def test_jendela_awal_dari_jadwal():
    jadwal = [
        {'tanggal': '2026-12-03', 'sesi_ke': 1, 'jam_mulai': '07:30', 'jam_selesai': '09:00', 'mapel': {'7': 'IPA', '8': 'Matematika'}},
        {'tanggal': '2026-12-02', 'sesi_ke': 2, 'jam_mulai': '09:30', 'jam_selesai': '11:00', 'mapel': {'7': 'Matematika'}},
        {'tanggal': '2026-12-04', 'sesi_ke': 1, 'jam_mulai': '07:30', 'jam_selesai': '09:00', 'mapel': {'7': 'Matematika (susulan)'}},
        {'tanggal': '2026-12-05', 'sesi_ke': 1, 'jam_mulai': '07:30', 'jam_selesai': '09:00', 'mapel': {'7': 'IPA'}},
    ]
    j7 = up.jendela_jadwal(jadwal, 7, MAPEL7)
    assert j7 == {
        'matematika': {'tanggal': '2026-12-02', 'sesi_ke': 2, 'mulai_at': '2026-12-02T09:30:00+07:00', 'selesai_at': '2026-12-02T11:00:00+07:00'},
        'ipa': {'tanggal': '2026-12-03', 'sesi_ke': 1, 'mulai_at': '2026-12-03T07:30:00+07:00', 'selesai_at': '2026-12-03T09:00:00+07:00'},
    }  # sesi paling awal dipakai; nama tak dikenal ("… (susulan)") dilewati
    assert set(up.jendela_jadwal(jadwal, 8, MAPEL7)) == {'matematika'} and up.jendela_jadwal(jadwal, 9, MAPEL7) == {}


def test_isian_link_soal():
    from pydantic import ValidationError
    # tanpa zona = WIB; ber-zona lain dikonversi ke WIB
    isi = up.LinkSoalIn(url=' https://cbt.id/ujian/7 ', mulai_at='2026-12-02T07:30', selesai_at='2026-12-02T02:00:00Z')
    assert isi.url == 'https://cbt.id/ujian/7' and isi.aktif is True and isi.versi is None
    assert (isi.mulai_at, isi.selesai_at) == ('2026-12-02T07:30:00+07:00', '2026-12-02T09:00:00+07:00')
    ok = up.LinkSoalIn(url='', mulai_at='2026-12-02T07:30:00+07:00', selesai_at='2026-12-02T09:00:00+07:00', aktif=False, versi='v1')
    assert ok.url == '' and ok.aktif is False and ok.versi == 'v1'
    for salah in (
        {'url': 'javascript:alert(1)'}, {'url': 'data:text/html,x'}, {'url': 'https://u:p@x.id'}, {'url': 'https://' + 'x' * 2100},
        {'selesai_at': '2026-12-02T07:30:00+07:00'}, {'selesai_at': '2026-12-02T07:00:00+07:00'}, {'mulai_at': 'besok pagi'},
    ):
        data = {'url': 'https://cbt.id', 'mulai_at': '2026-12-02T07:30:00+07:00', 'selesai_at': '2026-12-02T09:00:00+07:00', **salah}
        try:
            up.LinkSoalIn(**data)
            raise AssertionError(f'harus ditolak: {salah}')
        except ValidationError:
            pass


def test_dokumen_link_soal_menimpa_dan_menjaga_penghitung():
    adm = {'id': 'adm', 'full_name': 'Admin'}
    isi = up.LinkSoalIn(url='https://cbt.id/a', mulai_at='2026-12-02T07:30:00+07:00', selesai_at='2026-12-02T09:00:00+07:00')
    baru = up.dokumen_link_soal('u1', 7, 'ipa', isi, adm, waktu=_wib('2026-12-01T10:00:00+07:00'))
    assert baru['jumlah_klik'] == 0 and baru['klik_terakhir_at'] is None and baru['dibuat_pada'] == baru['diperbarui_pada']
    lama = {**baru, 'jumlah_klik': 12, 'klik_terakhir_at': '2026-12-02T08:00:00+07:00'}
    isi2 = up.LinkSoalIn(url='https://cbt.id/b', mulai_at='2026-12-02T07:45:00+07:00', selesai_at='2026-12-02T09:00:00+07:00', aktif=False)
    ubah = up.dokumen_link_soal('u1', 7, 'ipa', isi2, adm, lama=lama, waktu=_wib('2026-12-02T10:00:00+07:00'))
    assert ubah['id'] == baru['id'] and ubah['dibuat_pada'] == baru['dibuat_pada'] and ubah['diperbarui_pada'] != baru['diperbarui_pada']
    assert (ubah['url'], ubah['aktif'], ubah['jumlah_klik'], ubah['klik_terakhir_at']) == ('https://cbt.id/b', False, 12, '2026-12-02T08:00:00+07:00')
    assert not up.link_siap(ubah) and up.link_siap(baru) and not up.link_siap({**baru, 'url': ''}) and not up.link_siap(None)


def test_susun_link_admin_dan_url_untuk_pemantau():
    docs = [{'id': 'l1', 'jenjang': 7, 'mapel': 'ipa', 'url': 'https://www.cbt.id/ipa', 'mulai_at': '2026-12-03T07:45:00+07:00',
             'selesai_at': '2026-12-03T09:00:00+07:00', 'aktif': True, 'jumlah_klik': 3, 'diperbarui_pada': 'v1'}]
    jadwal = [{'tanggal': '2026-12-03', 'sesi_ke': 1, 'jam_mulai': '07:30', 'jam_selesai': '09:00', 'mapel': {'7': 'IPA', '9': 'IPS'}}]
    mapel = {str(j): MAPEL7 for j in (7, 8, 9)}
    admin = up.susun_link_admin(docs, mapel, jadwal, tampil_url=True)
    assert len(admin) == 45 and [x['mapel'] for x in admin[:3]] == ['bahasa_indonesia', 'akidah_akhlak', 'matematika']
    ipa = next(x for x in admin if (x['jenjang'], x['mapel']) == (7, 'ipa'))
    assert ipa['url'] == 'https://www.cbt.id/ipa' and ipa['url_host'] == 'cbt.id' and ipa['siap'] and ipa['versi'] == 'v1'
    assert ipa['mulai_at'] == '2026-12-03T07:45:00+07:00' and ipa['jadwal']['mulai_at'] == '2026-12-03T07:30:00+07:00'
    ips9 = next(x for x in admin if (x['jenjang'], x['mapel']) == (9, 'ips'))
    assert ips9['id'] is None and ips9['url'] == '' and not ips9['siap'] and ips9['mulai_at'] == '2026-12-03T07:30:00+07:00'
    pemantau = next(x for x in up.susun_link_admin(docs, mapel, jadwal) if x['id'] == 'l1')
    assert pemantau['url'] == '' and pemantau['url_host'] == 'cbt.id'  # pemantau tidak melihat alamat soal lengkap


def _wib(s):
    from datetime import datetime
    return datetime.fromisoformat(s)
