"""Ujian Madrasah — halaman publik Info Ujian: skema konten, index (tautan & berkas unik), daftar baku 15 mapel."""
import asyncio
import os
import re
import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, os.path.dirname(__file__))

import migrasi_otomatis  # noqa: E402
import ujian_info as ui  # noqa: E402
from migrations.migrate_ujian_info_publik import migrate  # noqa: E402
from pkg_palsu import Db  # noqa: E402


def test_migrasi_index():
    assert ('2026-11-23_ujian_info_publik', migrasi_otomatis._ujian_info_publik) in migrasi_otomatis.MIGRASI
    db = Db()
    hasil = asyncio.run(migrate(db))
    assert hasil == {'konten': 0, 'tautan': 0, 'berkas': 0, 'dry_run': False}
    unik = lambda koleksi: [(k, o.get('name')) for k, o in getattr(db, koleksi).index if o.get('unique')]  # noqa: E731
    assert ([('ujian_id', 1)], None) in unik('ujian_info_konten')
    assert ([('token', 1)], 'tautan_unik_token') in unik('ujian_tautan_publik')
    assert ([('ujian_id', 1), ('jenis', 1)], 'tautan_unik_jenis') in unik('ujian_tautan_publik')
    assert ([('ujian_id', 1), ('jenis', 1), ('jenjang', 1), ('mapel', 1)], 'berkas_unik_mapel') in unik('ujian_berkas')
    assert any(k == [('ujian_id', 1), ('waktu', -1)] for k, _ in db.ujian_akses_log.index)
    assert any(k == [('berkas_id', 1), ('waktu', -1)] for k, _ in db.ujian_unduh_log.index)
    # log tanpa TTL (tanpa aturan hapus arsip)
    assert not any('expireAfterSeconds' in o for k in ('ujian_akses_log', 'ujian_unduh_log') for _, o in getattr(db, k).index)
    asyncio.run(migrate(db))  # idempoten
    db2 = Db()
    assert asyncio.run(migrate(db2, dry_run=True))['dry_run'] and not getattr(db2.ujian_berkas, 'index', [])


def test_mapel_baku_sama_dengan_frontend():
    js = (Path(__file__).resolve().parents[1] / 'frontend' / 'src' / 'lib' / 'mapelUjian.js').read_text(encoding='utf-8')
    frontend = re.findall(r"\{ kode: '([a-z_]+)', nama: '([^']+)' \}", js)
    assert tuple(frontend) == ui.MAPEL_UJIAN_BAKU
    assert len(ui.KODE_MAPEL) == 15 == len(set(ui.KODE_MAPEL))
    assert ui.nama_mapel('quran_hadits') == 'Quran Hadits' and ui.nama_mapel('lain') == 'lain'
    assert ui.JENJANG_UJIAN == (7, 8, 9)


def test_token_acak():
    t = {ui.buat_token() for _ in range(200)}
    assert len(t) == 200
    assert all(len(x) == 32 and re.fullmatch(r'[A-Za-z0-9_-]+', x) for x in t)


def test_isian_konten():
    k = ui.KontenInfoIn(tata_tertib='Peserta wajib:\r\n1. Hadir tepat waktu   \r\n\r\n\r\n\r\n2. Berseragam\n',
                        panduan_video_url='  https://youtu.be/abc  ', panduan_keterangan='  Cara   masuk\n aplikasi ')
    assert k.tata_tertib == 'Peserta wajib:\n1. Hadir tepat waktu\n\n2. Berseragam'
    assert k.panduan_video_url == 'https://youtu.be/abc' and k.panduan_keterangan == 'Cara masuk aplikasi'
    assert ui.KontenInfoIn(panduan_video_url='').panduan_video_url is None
    for salah in ('javascript:alert(1)', 'youtube.com/watch?v=x', 'https://a b', 'https://' + 'x' * 600):
        with pytest.raises(ValidationError):
            ui.KontenInfoIn(panduan_video_url=salah)
    with pytest.raises(ValidationError):
        ui.KontenInfoIn(tata_tertib='x' * (ui.TATA_TERTIB_MAKS + 1))
    with pytest.raises(ValidationError):
        ui.KontenInfoIn(panduan_keterangan='x' * (ui.PANDUAN_KETERANGAN_MAKS + 1))


def test_dokumen_dan_ringkas_publik():
    pdf = {'nama_file': 'Panduan CBT.pdf', 'nama_berkas': 'u1-acak.pdf', 'ukuran_byte': 1000, 'mime': 'application/pdf'}
    lama = {**ui.konten_kosong('u1'), 'panduan_pdf': pdf}
    d = ui.dokumen_konten('u1', ui.KontenInfoIn(tata_tertib='1. Tertib', panduan_video_url='https://v.id/x'),
                          {'id': 'adm', 'full_name': 'Admin'}, lama)
    assert d['ujian_id'] == 'u1' and d['panduan_pdf'] == pdf and d['diperbarui_oleh_nama'] == 'Admin' and d['diperbarui_pada']
    r = ui.ringkas_konten_publik(d)
    assert r == {'tata_tertib': '1. Tertib',
                 'panduan_cbt': {'ada_pdf': True, 'nama_file': 'Panduan CBT.pdf', 'video_url': 'https://v.id/x', 'keterangan': None}}
    assert 'nama_berkas' not in str(r) and 'adm' not in str(r)  # lokasi berkas & pengunggah tidak bocor ke publik
    assert ui.ringkas_konten_publik(None) == {'tata_tertib': '', 'panduan_cbt': {'ada_pdf': False, 'nama_file': None, 'video_url': None, 'keterangan': None}}


def test_seed_mapel_baku():
    from migrations.migrate_ujian_mapel_baku import migrate as migrate_mapel
    assert ('2026-11-23_ujian_mapel_baku', migrasi_otomatis._ujian_mapel_baku) in migrasi_otomatis.MIGRASI
    db = Db()
    assert asyncio.run(migrate_mapel(db, dry_run=True)) == {'ditambah': 45, 'total': 0, 'dry_run': True}
    assert asyncio.run(migrate_mapel(db)) == {'ditambah': 45, 'total': 45, 'dry_run': False}
    assert ([('jenjang', 1), ('kode', 1)], 'mapel_unik_jenjang') in [(k, o.get('name')) for k, o in db.ujian_mapel_baku.index if o.get('unique')]
    for j in (7, 8, 9):
        baris = [d for d in db.ujian_mapel_baku.docs if d['jenjang'] == j]
        assert [d['kode'] for d in sorted(baris, key=lambda d: d['urutan'])] == list(ui.KODE_MAPEL)
    # penyesuaian admin tidak tertimpa saat migrasi diulang; baris yang hilang dilengkapi lagi
    d8 = next(d for d in db.ujian_mapel_baku.docs if d['jenjang'] == 8 and d['kode'] == 'bahasa_jawa')
    d8['aktif'] = False
    d8['nama'] = 'Bahasa Daerah (Jawa)'
    db.ujian_mapel_baku.docs = [d for d in db.ujian_mapel_baku.docs if not (d['jenjang'] == 9 and d['kode'] == 'ipa')]
    assert asyncio.run(migrate_mapel(db)) == {'ditambah': 1, 'total': 45, 'dry_run': False}
    assert d8['aktif'] is False and d8['nama'] == 'Bahasa Daerah (Jawa)'
    m8 = asyncio.run(ui.mapel_jenjang(db, 8))
    assert len(m8) == 14 and 'bahasa_jawa' not in [m['kode'] for m in m8] and m8[0] == {'kode': 'bahasa_indonesia', 'nama': 'Bahasa Indonesia', 'urutan': 1}
    assert [m['kode'] for m in asyncio.run(ui.mapel_jenjang(db, 9))] == list(ui.KODE_MAPEL)  # ipa kembali di urutan baku
    # master kosong -> cadangan konstanta
    assert [m['kode'] for m in asyncio.run(ui.mapel_jenjang(Db(), '7'))] == list(ui.KODE_MAPEL)


def _wib(s):
    from datetime import datetime
    return datetime.fromisoformat(s)


def test_tautan_baru_dan_jendela():
    t = ui.dokumen_tautan_baru('u1', 'info', {'id': 'adm', 'full_name': 'Admin'})
    assert t['aktif'] is False and t['mulai_at'] is None and len(t['token']) == 32 and t['dibuat_oleh_nama'] == 'Admin'
    assert ui.dokumen_tautan_baru('u1', 'info', {})['token'] != t['token']
    with pytest.raises(ValueError):
        ui.dokumen_tautan_baru('u1', 'rahasia', {})
    kini = _wib('2026-12-02T08:00:00+07:00')
    assert ui.cek_tautan(None, kini)['alasan'] == 'tidak_dikenal'
    assert ui.cek_tautan(t, kini) == {'berlaku': False, 'alasan': 'nonaktif', 'pesan': 'Tautan informasi ujian sedang ditutup panitia.',
                                      'mulai_at': None, 'selesai_at': None}
    buka = {**t, 'aktif': True}
    assert ui.cek_tautan(buka, kini)['berlaku'] is True  # tanpa jendela = tanpa batas
    jendela = {**buka, 'mulai_at': '2026-12-02T08:00:00+07:00', 'selesai_at': '2026-12-05T16:00'}  # tanpa zona = WIB
    assert ui.cek_tautan(jendela, kini)['alasan'] == 'ok'  # tepat di batas mulai: berlaku
    assert ui.cek_tautan(jendela, _wib('2026-12-02T07:59:59+07:00'))['alasan'] == 'belum_mulai'
    r = ui.cek_tautan(jendela, _wib('2026-12-05T16:00:00+07:00'))  # tepat di batas selesai: berakhir
    assert r['alasan'] == 'sudah_selesai' and r['selesai_at'] == '2026-12-05T16:00' and 'berakhir' in r['pesan']
    # zona waktu lain dibandingkan dalam WIB: 08.59 UTC = 15.59 WIB (berlaku), 09.00 UTC = 16.00 WIB (berakhir)
    assert ui.cek_tautan(jendela, _wib('2026-12-05T08:59:00+00:00'))['berlaku'] is True
    assert ui.cek_tautan(jendela, _wib('2026-12-05T09:00:00+00:00'))['alasan'] == 'sudah_selesai'
    mon = {**buka, 'jenis': 'monitoring', 'aktif': False}
    assert 'monitoring pengumpulan berkas' in ui.cek_tautan(mon, kini)['pesan']


def test_token_layak_dan_cari():
    db = Db()
    db.ujian_tautan_publik.docs.append({'id': 't1', 'ujian_id': 'u1', 'jenis': 'info', 'token': 'Abc_123-xyz', 'aktif': True})
    assert asyncio.run(ui.cari_tautan(db, 'Abc_123-xyz'))['id'] == 't1'
    assert asyncio.run(ui.cari_tautan(db, 'Abc_123-xyz', 'monitoring')) is None
    for salah in (None, '', 'x' * 101, 'ada spasi', "a'b", '{"$ne":1}'):
        assert not ui.token_layak(salah) and asyncio.run(ui.cari_tautan(db, salah)) is None


def test_penghitung_unduh():
    db = Db()
    db.ujian_berkas.docs.append({'id': 'b1', 'ujian_id': 'u1', 'jenis': 'kisi_kisi', 'jenjang': 8, 'mapel': 'ipa'})
    assert [asyncio.run(ui.tambah_jumlah_unduh(db, 'b1')) for _ in range(3)] == [1, 2, 3]
    assert asyncio.run(ui.tambah_jumlah_unduh(db, 'tidak-ada')) == 0


class _Req:
    def __init__(self, ip='10.0.0.5', ua='Mozilla/5.0 ' + 'x' * 400):
        self.client = type('C', (), {'host': ip})()
        self.headers = {'user-agent': ua}


def test_log_akses_dan_unduh():
    db = Db()
    tautan = {'id': 't1', 'ujian_id': 'u1', 'jenis': 'info', 'token': 'tok'}
    asyncio.run(ui.catat_akses(db, tautan, 'tok', 'ok', _Req()))
    asyncio.run(ui.catat_akses(db, None, 'x' * 500, 'tidak_dikenal', None))
    a, b = db.ujian_akses_log.docs
    assert a['tautan_id'] == 't1' and a['ujian_id'] == 'u1' and a['jenis_tautan'] == 'info' and a['hasil'] == 'ok'
    assert a['ip'] == '10.0.0.5' and len(a['perangkat']) == ui.PERANGKAT_MAKS and a['waktu'] and a['id']
    assert b['tautan_id'] is None and len(b['token']) == ui.TOKEN_MAKS and b['ip'] is None
    berkas = {'id': 'b1', 'ujian_id': 'u1', 'jenis': 'kisi_kisi', 'jenjang': 8, 'mapel': 'ipa', 'nama_berkas': 'rahasia.pdf'}
    asyncio.run(ui.catat_unduh(db, berkas, 'publik', _Req(), tautan=tautan))
    asyncio.run(ui.catat_unduh(db, berkas, 'zip_jenjang', _Req(), pengunduh={'id': 'adm', 'full_name': 'Admin'}))
    p, z = db.ujian_unduh_log.docs
    assert (p['mode'], p['tautan_id'], p['pengunduh_id'], p['pengunduh_nama']) == ('publik', 't1', None, None)
    assert (z['mode'], z['pengunduh_id'], z['pengunduh_nama'], z['jenjang'], z['mapel']) == ('zip_jenjang', 'adm', 'Admin', 8, 'ipa')
    assert 'nama_berkas' not in p
    # galat audit tidak menggagalkan permintaan
    asyncio.run(ui.catat_akses(db, tautan, 'tok', 'hasil-aneh', None))
    asyncio.run(ui.catat_unduh(db, berkas, 'mode-aneh', None))
    assert len(db.ujian_akses_log.docs) == 2 and len(db.ujian_unduh_log.docs) == 2


def test_tautan_monitoring_pastikan_ganti_ringkas():
    from pymongo.errors import DuplicateKeyError
    db = Db()
    adm = {'id': 'adm', 'full_name': 'Admin'}
    mon = asyncio.run(ui.pastikan_tautan(db, 'u1', 'monitoring', adm))
    info = asyncio.run(ui.pastikan_tautan(db, 'u1', 'info', adm))
    assert mon['jenis'] == 'monitoring' and mon['aktif'] is False and mon['token'] != info['token']
    assert asyncio.run(ui.pastikan_tautan(db, 'u1', 'monitoring', adm))['id'] == mon['id']  # idempoten
    assert len(db.ujian_tautan_publik.docs) == 2
    assert ui.jalur_tautan(mon) == f"/publik/monitoring-ujian/{mon['token']}" and ui.jalur_tautan(info).startswith('/publik/info-ujian/')
    assert ui.jalur_tautan({'jenis': 'lain', 'token': 'x'}) is None
    r = ui.ringkas_tautan({**mon, 'aktif': True}, _wib('2026-12-02T08:00:00+07:00'))
    assert r['berlaku'] and r['alasan'] == 'ok' and r['jalur'].endswith(mon['token']) and '_id' not in r
    assert ui.ringkas_tautan(mon)['alasan'] == 'nonaktif' and ui.ringkas_tautan(None) is None
    # ganti token: tautan lama tidak dikenal lagi, pengaturan tetap
    db.ujian_tautan_publik.docs[0].update({'aktif': True, 'mulai_at': '2026-12-01T07:00'})
    lama = mon['token']
    baru = asyncio.run(ui.ganti_token(db, mon['id']))
    assert baru['token'] != lama and baru['aktif'] is True and baru['mulai_at'] == '2026-12-01T07:00'
    assert asyncio.run(ui.cari_tautan(db, lama)) is None and asyncio.run(ui.cari_tautan(db, baru['token'], 'monitoring'))['id'] == mon['id']

    # balapan: dokumen lain lebih dulu tersimpan -> DuplicateKeyError -> pakai yang sudah ada
    class KoleksiBalapan:
        def __init__(self):
            self.dibaca = 0

        async def find_one(self, q, _p=None):
            self.dibaca += 1
            return None if self.dibaca == 1 else {'id': 'pemenang', 'jenis': 'monitoring', 'ujian_id': 'u9'}

        async def insert_one(self, doc):
            raise DuplicateKeyError('dup')
    k = KoleksiBalapan()
    assert asyncio.run(ui.pastikan_tautan({ui.KOLEKSI_TAUTAN: k}, 'u9', 'monitoring', adm))['id'] == 'pemenang'


def test_jendela_tidak_terbaca_ditolak():
    kini = _wib('2026-12-02T08:00:00+07:00')
    t = {'id': 't', 'jenis': 'monitoring', 'aktif': True}
    for rusak in ({'mulai_at': '02/12/2026 07:00'}, {'selesai_at': 'besok'}, {'mulai_at': '2026-12-01T07:00', 'selesai_at': '2026-13-01'}):
        r = ui.cek_tautan({**t, **rusak}, kini)
        assert r['berlaku'] is False and r['alasan'] == 'nonaktif' and 'tidak valid' in r['pesan']
    assert ui.cek_tautan({**t, 'mulai_at': '', 'selesai_at': None}, kini)['berlaku'] is True  # kosong = tanpa batas


def test_isian_jendela_tautan():
    j = ui.JendelaTautanIn(aktif=True, mulai_at=' 2026-12-01T07:00 ', selesai_at='2026-12-06T09:00:00Z')
    assert (j.mulai_at, j.selesai_at) == ('2026-12-01T07:00:00+07:00', '2026-12-06T16:00:00+07:00')
    assert ui.JendelaTautanIn(mulai_at='', selesai_at=None).mulai_at is None
    for salah in ({'mulai_at': 'kemarin'}, {'selesai_at': '1999-01-01T00:00'}, {'mulai_at': '2026-12-06T16:00', 'selesai_at': '2026-12-06T16:00'},
                  {'mulai_at': '2026-12-06T16:00', 'selesai_at': '2026-12-06T08:00:00Z'}):
        with pytest.raises(ValidationError):
            ui.JendelaTautanIn(**salah)


def test_catat_segarkan_unit():
    db = Db()
    t = {'id': 't1', 'ujian_id': 'u1', 'jenis': 'monitoring'}
    asyncio.run(ui.catat_akses(db, t, 'tok', 'ok', None, sesi='abc'))
    assert asyncio.run(ui.catat_segarkan(db, t, 'abc')) is True
    assert asyncio.run(ui.catat_segarkan(db, t, 'tidak-ada')) is False
    assert asyncio.run(ui.catat_segarkan(db, t, None)) is False and asyncio.run(ui.catat_segarkan(db, None, 'abc')) is False
    assert db.ujian_akses_log.docs[0]['jumlah_segarkan'] == 1
    assert ui.sesi_sah('a' * 40) and not ui.sesi_sah('a' * 41) and not ui.sesi_sah('a b') and ui.sesi_sah('') is None

    class Rusak:
        async def update_one(self, *a, **k):
            raise RuntimeError('db mati')
    assert asyncio.run(ui.catat_segarkan({ui.KOLEKSI_AKSES_LOG: Rusak()}, t, 'abc')) is False


def test_migrasi_tautan_publik_dan_riwayat():
    from migrations.migrate_ujian_tautan_publik import migrate as migrate_tautan
    assert ('2026-11-23_ujian_tautan_publik', migrasi_otomatis._ujian_tautan_publik) in migrasi_otomatis.MIGRASI
    db = Db()
    db.ujian_tautan_publik.docs += [{'id': 't1', 'mulai_at': '2026-12-01T07:00'}, {'id': 't2', 'selesai_at': 'besok'}, {'id': 't3'}]
    h = asyncio.run(migrate_tautan(db))
    assert h == {'tautan': 3, 'jendela_rusak': 1, 'id_jendela_rusak': ['t2'], 'riwayat': 0, 'dry_run': False}
    unik = [(k, o.get('name')) for k, o in db.ujian_tautan_publik.index if o.get('unique')]
    assert ([('token', 1)], 'tautan_unik_token') in unik and ([('ujian_id', 1), ('jenis', 1)], 'tautan_unik_jenis') in unik
    assert any(k == [('ujian_id', 1), ('waktu', -1)] for k, _ in db.ujian_tautan_riwayat.index)
    assert db.ujian_tautan_publik.docs[1]['selesai_at'] == 'besok'  # dilaporkan, tidak diubah
    db2 = Db()
    assert asyncio.run(migrate_tautan(db2, dry_run=True))['dry_run'] and not getattr(db2.ujian_tautan_riwayat, 'index', [])


def test_riwayat_tautan_tanpa_token():
    db = Db()
    t = {'id': 't1', 'ujian_id': 'u1', 'jenis': 'info', 'token': 'RAHASIA_TOKEN_123', 'aktif': False, 'mulai_at': None, 'selesai_at': None}
    sesudah = {**t, 'aktif': True}
    asyncio.run(ui.catat_riwayat_tautan(db, t, 'buka', {'id': 'adm', 'full_name': 'Admin'}, sebelum=t, sesudah=sesudah))
    r = db.ujian_tautan_riwayat.docs[0]
    assert (r['aksi'], r['jenis'], r['oleh_nama'], r['sebelum']['aktif'], r['sesudah']['aktif']) == ('buka', 'info', 'Admin', False, True)
    assert 'RAHASIA_TOKEN_123' not in str(r)
    asyncio.run(ui.catat_riwayat_tautan(db, t, 'aksi-aneh', {}))  # galat tidak menggagalkan
    assert len(db.ujian_tautan_riwayat.docs) == 1
    assert ui.dokumen_riwayat_tautan(t, 'ganti_token', {}, detail='x' * 400)['detail'] == 'x' * 300


def test_inisialisasi_tiga_tautan():
    db = Db()
    adm = {'id': 'adm', 'full_name': 'Admin'}
    t = asyncio.run(ui.inisialisasi_tautan(db, 'u1', adm))
    assert set(t) == {'info', 'monitoring', 'portal'} and len({x['token'] for x in t.values()}) == 3
    assert all(x['aktif'] is False and x['mulai_at'] is None and len(x['token']) == 32 for x in t.values())
    assert [r['aksi'] for r in db.ujian_tautan_riwayat.docs] == ['buat', 'buat', 'buat']
    t2 = asyncio.run(ui.inisialisasi_tautan(db, 'u1', adm))  # idempoten: tidak membuat & tidak mencatat ulang
    assert t2['info']['id'] == t['info']['id'] and len(db.ujian_tautan_publik.docs) == 3 and len(db.ujian_tautan_riwayat.docs) == 3


def test_tabrakan_token_dicoba_ulang():
    from pymongo.errors import DuplicateKeyError

    class Koleksi:
        def __init__(self):
            self.docs, self.tolak = [], 2

        async def find_one(self, q, _p=None):
            return next((d for d in self.docs if all(d.get(k) == v for k, v in q.items())), None)

        async def insert_one(self, doc):
            if self.tolak:  # dua kali bentrok token (dokumen ujian+jenis belum ada)
                self.tolak -= 1
                raise DuplicateKeyError('token')
            self.docs.append(doc)
    k = Koleksi()
    t = asyncio.run(ui.pastikan_tautan({ui.KOLEKSI_TAUTAN: k}, 'u9', 'info', {}))
    assert t['ujian_id'] == 'u9' and len(k.docs) == 1
    k2 = Koleksi()
    k2.tolak = 99
    with pytest.raises(RuntimeError):
        asyncio.run(ui.pastikan_tautan({ui.KOLEKSI_TAUTAN: k2}, 'u9', 'info', {}))


class _ReqProxy:
    def __init__(self, headers, host='172.18.0.5'):
        self.client = type('C', (), {'host': host})()
        self.headers = headers


def test_ip_sumber_di_balik_proxy():
    assert ui.ip_peminta(_ReqProxy({'x-real-ip': '36.71.10.2', 'x-forwarded-for': '1.1.1.1, 36.71.10.2'})) == ('36.71.10.2', '1.1.1.1, 36.71.10.2')
    # tanpa X-Real-IP: entri paling kanan (ditambahkan proxy), bukan yang paling kiri (bisa dipalsukan klien)
    assert ui.ip_peminta(_ReqProxy({'x-forwarded-for': '6.6.6.6, 36.71.10.9'}))[0] == '36.71.10.9'
    assert ui.ip_peminta(_ReqProxy({'x-forwarded-for': '2001:db8::1'}))[0] == '2001:db8::1'
    assert ui.ip_peminta(_ReqProxy({'x-real-ip': 'bukan-ip<script>', 'x-forwarded-for': 'sampah'}))[0] == '172.18.0.5'
    assert ui.ip_peminta(_ReqProxy({})) == ('172.18.0.5', None)
    assert ui.ip_peminta(None) == (None, None)
    db = Db()
    asyncio.run(ui.catat_akses(db, {'id': 't1'}, 'tok', 'ok', _ReqProxy({'x-forwarded-for': '9.9.9.9, 36.71.10.9', 'user-agent': 'UA'})))
    d = db.ujian_akses_log.docs[0]
    assert (d['ip'], d['ip_rantai'], d['perangkat']) == ('36.71.10.9', '9.9.9.9, 36.71.10.9', 'UA')
    asyncio.run(ui.catat_unduh(db, {'id': 'b1'}, 'publik', _ReqProxy({'x-real-ip': '36.71.10.3'})))
    assert db.ujian_unduh_log.docs[0]['ip'] == '36.71.10.3' and db.ujian_unduh_log.docs[0]['ip_rantai'] is None


def test_migrasi_dan_log_unduh_zip():
    from migrations.migrate_ujian_unduh_log import migrate as migrate_unduh
    assert ('2026-11-23_ujian_unduh_log', migrasi_otomatis._ujian_unduh_log) in migrasi_otomatis.MIGRASI
    db = Db()
    assert asyncio.run(migrate_unduh(db)) == {'unduh_log': 0, 'penghitung_selisih': 0, 'penghitung_diperbaiki': 0, 'dry_run': False}
    nama = [o.get('name') for _, o in db.ujian_unduh_log.index]
    assert 'unduh_ujian_mode_waktu' in nama and 'unduh_ujian_jenis_waktu' in nama
    assert not any('expireAfterSeconds' in o for _, o in db.ujian_unduh_log.index)
    asyncio.run(ui.catat_unduh_zip(db, 'u1', 'kartu_soal', 8, [{'id': 'b1'}, {'id': 'b2'}], ['pjok'], {'id': 'adm', 'full_name': 'Admin'},
                                   _ReqProxy({'x-real-ip': '36.71.1.1', 'user-agent': 'UA'})))
    d = db.ujian_unduh_log.docs[0]
    assert (d['mode'], d['jenis_berkas'], d['jenjang'], d['berkas_id'], d['mapel'], d['berkas_ids'], d['jumlah_berkas'], d['mapel_kosong']) == \
        ('zip_jenjang', 'kartu_soal', 8, None, None, ['b1', 'b2'], 2, ['pjok'])
    assert (d['pengunduh_id'], d['pengunduh_nama'], d['ip'], d['perangkat']) == ('adm', 'Admin', '36.71.1.1', 'UA')
    asyncio.run(ui.catat_unduh_zip(db, 'u1', 'lain', 8, [], [], {}))  # galat tidak menggagalkan
    assert len(db.ujian_unduh_log.docs) == 1


def test_skema_saringan_audit():
    from migrations.migrate_ujian_akses_log import migrate as migrate_akses
    assert ('2026-11-23_ujian_akses_log', migrasi_otomatis._ujian_akses_log) in migrasi_otomatis.MIGRASI
    db = Db()
    assert asyncio.run(migrate_akses(db)) == {'akses_log': 0, 'dry_run': False}
    nama = [o.get('name') for _, o in db.ujian_akses_log.index]
    assert {'akses_ujian_jenis_waktu', 'akses_ujian_hasil_waktu', 'akses_ujian_ip'} <= set(nama)
    assert ui.galat_saringan_audit('2026-11-01', '2026-11-30', '36.71') is None
    assert ui.galat_saringan_audit(None, None, None) is None
    assert 'YYYY-MM-DD' in ui.galat_saringan_audit('01/11/2026', None, None)
    assert 'tidak valid' in ui.galat_saringan_audit('2026-02-30', None, None)
    assert 'sebelum atau sama' in ui.galat_saringan_audit('2026-12-02', '2026-12-01', None)
    assert 'maksimal' in ui.galat_saringan_audit(None, None, 'x' * 61)
    q = ui.kueri_saringan_audit('u1', '2026-12-01', '2026-12-02', ' 36.71.(1 ')
    assert q['ujian_id'] == 'u1' and q['waktu'] == {'$gte': '2026-12-01T00:00:00', '$lt': '2026-12-02T99'}
    assert q['$or'][0]['ip']['$regex'] == r'36\.71\.\(1'  # di-escape
    log = [{'ujian_id': 'u1', 'waktu': w, 'ip': ip, 'perangkat': 'Chrome'} for w, ip in (
        ('2026-11-30T23:59:59+07:00', '1.1.1.1'), ('2026-12-01T00:00:00+07:00', '36.71.(1'), ('2026-12-02T23:59:59.5+07:00', '36.71.(1'),
        ('2026-12-03T00:00:00+07:00', '36.71.(1'))]
    db.ujian_akses_log.docs += log
    hasil = asyncio.run(db.ujian_akses_log.find(q).to_list(10))
    assert [h['waktu'][:10] for h in hasil] == ['2026-12-01', '2026-12-02']
    assert asyncio.run(db.ujian_akses_log.find(ui.kueri_saringan_audit('u1', cari='CHROME')).to_list(10)).__len__() == 4


def test_token_tidak_dikenal_digabung_per_ip(monkeypatch):
    from datetime import timedelta
    db = Db()
    kini = [_wib('2026-12-02T08:00:00+07:00')]
    monkeypatch.setattr(ui, 'sekarang_wib', lambda: kini[0])
    req = lambda ip: _ReqProxy({'x-real-ip': ip, 'user-agent': 'Bot'})  # noqa: E731
    for i in range(5):
        kini[0] += timedelta(seconds=5)
        asyncio.run(ui.catat_akses(db, None, f'tebak{i}', 'tidak_dikenal', req('6.6.6.6')))
    asyncio.run(ui.catat_akses(db, None, 'lain', 'tidak_dikenal', req('7.7.7.7')))
    log = db.ujian_akses_log.docs
    assert [(x['ip'], x['jumlah_percobaan']) for x in log] == [('6.6.6.6', 5), ('7.7.7.7', 1)]
    assert log[0]['token_terakhir'] == 'tebak4' and log[0]['terakhir_aktif'] == '2026-12-02T08:00:25+07:00'
    kini[0] += timedelta(minutes=2)  # lewat jendela gabung: entri baru
    asyncio.run(ui.catat_akses(db, None, 'tebak9', 'tidak_dikenal', req('6.6.6.6')))
    assert len(db.ujian_akses_log.docs) == 3
    # kegagalan lain (tautan dikenal) tetap satu entri per percobaan
    t = {'id': 't1', 'ujian_id': 'u1', 'jenis': 'info'}
    asyncio.run(ui.catat_akses(db, t, 'tok', 'nonaktif', req('6.6.6.6')))
    asyncio.run(ui.catat_akses(db, t, 'tok', 'nonaktif', req('6.6.6.6')))
    assert [x['hasil'] for x in db.ujian_akses_log.docs].count('nonaktif') == 2



def test_rekonsiliasi_penghitung_unduh():
    from migrations.migrate_ujian_unduh_log import migrate as migrate_unduh
    db = Db()
    db.ujian_berkas.docs += [{'id': 'k1', 'ujian_id': 'u1', 'jenis': 'kisi_kisi', 'jumlah_unduh': 1},
                             {'id': 'k2', 'ujian_id': 'u1', 'jenis': 'kisi_kisi', 'jumlah_unduh': 9},   # unduhan sebelum ada log: tidak diturunkan
                             {'id': 'ks', 'ujian_id': 'u1', 'jenis': 'kartu_soal', 'jumlah_unduh': 0}]
    db.ujian_unduh_log.docs += [{'berkas_id': 'k1', 'mode': 'publik'}] * 3 + [{'berkas_id': 'k1', 'mode': 'tunggal'}, {'berkas_id': 'k2', 'mode': 'publik'},
                                                                              {'berkas_id': 'ks', 'mode': 'tunggal'}]
    r = asyncio.run(ui.rekonsiliasi_jumlah_unduh(db, 'u1'))
    assert r == {'diperiksa': 2, 'selisih': [{'id': 'k1', 'jumlah_unduh': 1, 'jumlah_log': 3}], 'diperbaiki': 0}
    assert asyncio.run(migrate_unduh(db, dry_run=True))['penghitung_selisih'] == 1 and db.ujian_berkas.docs[0]['jumlah_unduh'] == 1
    h = asyncio.run(migrate_unduh(db))
    assert (h['penghitung_selisih'], h['penghitung_diperbaiki']) == (1, 1)
    assert [b['jumlah_unduh'] for b in db.ujian_berkas.docs] == [3, 9, 0]
