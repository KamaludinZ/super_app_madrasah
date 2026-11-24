"""Alur HTTP halaman publik Info Ujian (tanpa login): validator token + jendela waktu, isi respons, kerahasiaan, log akses."""
import os
import sys
from datetime import datetime

import pytest

sys.path.insert(0, os.path.dirname(__file__))

from ujian_dasar import HARI_INI, buat_klien, ujian_doc  # noqa: E402

TOKEN = 'TokenInfoUjianContoh_123456789ab'
TOKEN_MON = 'TokenMonitoringContoh_123456789a'


def berkas(bid, jenis, jenjang, mapel, **kw):
    return {'id': bid, 'ujian_id': 'uas', 'jenis': jenis, 'jenjang': jenjang, 'mapel': mapel, 'status': 'terkirim',
            'nama_file': f'{bid}.pdf', 'nama_berkas': f'rahasia-{bid}.pdf', 'mime_type': 'application/pdf', 'ukuran_byte': 2048,
            'guru_pj_id': 'guru1', 'guru_pj_nama': 'Bu Siti', 'updated_at': '2026-11-30T09:00:00+07:00', 'jumlah_unduh': 3, **kw}


@pytest.fixture
def klien(monkeypatch, tmp_path):
    import penyimpanan
    import routers.ujian_info_publik as rip
    monkeypatch.setattr(penyimpanan, 'UPLOAD_ROOT', str(tmp_path))
    k = buat_klien(monkeypatch)
    k.kini = datetime.fromisoformat(f'{HARI_INI}T08:00:00+07:00')
    monkeypatch.setattr(rip, 'sekarang_wib', lambda: k.kini)
    db = k.db
    db.ujian.docs.append(ujian_doc('uas', 'UAS', 'sem-kini', '2026-12-01', '2026-12-06', nama='ASAS Ganjil 2026/2027'))
    db.jadwal_ujian.docs += [
        {'id': 's2', 'ujian_id': 'uas', 'tanggal': '2026-12-02', 'sesi_ke': 1, 'jam_mulai': '07:30', 'jam_selesai': '09:00',
         'mapel': {'7': 'Matematika', '8': 'IPA', '9': 'Bahasa Indonesia'}},
        {'id': 's1', 'ujian_id': 'uas', 'tanggal': '2026-12-01', 'sesi_ke': 1, 'jam_mulai': '07:30', 'jam_selesai': '09:00',
         'mapel': {'7': 'IPS', '8': 'PKN'}},
    ]
    db.ujian_tautan_publik.docs += [
        {'id': 't-info', 'ujian_id': 'uas', 'jenis': 'info', 'token': TOKEN, 'aktif': True,
         'mulai_at': '2026-11-25T07:00:00+07:00', 'selesai_at': '2026-12-06T16:00:00+07:00'},
        {'id': 't-mon', 'ujian_id': 'uas', 'jenis': 'monitoring', 'token': TOKEN_MON, 'aktif': True, 'mulai_at': None, 'selesai_at': None},
    ]
    db.ujian_info_konten.docs.append({'ujian_id': 'uas', 'tata_tertib': '1. Hadir tepat waktu', 'panduan_video_url': 'https://youtu.be/abc',
                                      'panduan_keterangan': 'Cara masuk aplikasi', 'panduan_pdf': None})
    db.ujian_berkas.docs += [
        berkas('k8-ipa', 'kisi_kisi', 8, 'ipa'), berkas('k8-bind', 'kisi_kisi', 8, 'bahasa_indonesia'),
        berkas('k7-mtk', 'kisi_kisi', 7, 'matematika', jumlah_unduh=0),
        berkas('ks7-mtk', 'kartu_soal', 7, 'matematika'),           # rahasia: tidak boleh muncul
        berkas('k9-lain', 'kisi_kisi', 9, 'mapel_lama'),            # bukan mapel baku: tidak ditampilkan
        berkas('k9-draf', 'kisi_kisi', 9, 'ipa', status='belum'),   # belum terkirim
        {**berkas('lain', 'kisi_kisi', 7, 'ipa'), 'ujian_id': 'ujian-lain'},
    ]
    return k


def get(k, path, **kw):
    return k(None, None, 'GET', path, headers={'user-agent': 'UjiBrowser/1.0'}, **kw)


def test_info_berhasil_tanpa_login(klien):
    r = get(klien, f'/publik/info-ujian/{TOKEN}')
    assert r.status_code == 200, r.text
    assert r.headers['cache-control'] == 'no-store'
    d = r.json()
    assert d['ujian'] == {'nama': 'ASAS Ganjil 2026/2027', 'jenis': 'UAS', 'tahun_pelajaran': '2026/2027', 'mulai': '2026-12-01', 'selesai': '2026-12-06'}
    assert d['tautan'] == {'jenis': 'info', 'mulai_at': '2026-11-25T07:00:00+07:00', 'selesai_at': '2026-12-06T16:00:00+07:00'}
    assert [s['id'] for s in d['jadwal']] == ['s1', 's2'] and d['jadwal'][1]['mapel']['9'] == 'Bahasa Indonesia'
    assert d['tata_tertib'] == '1. Hadir tepat waktu'
    assert d['panduan_cbt'] == {'ada_pdf': False, 'nama_file': None, 'video_url': 'https://youtu.be/abc', 'keterangan': 'Cara masuk aplikasi'}
    # kisi-kisi: hanya terkirim, mapel baku, ujian ini; urut jenjang lalu urutan baku (Bahasa Indonesia sebelum IPA)
    assert [(x['jenjang'], x['mapel']) for x in d['kisi_kisi']] == [(7, 'matematika'), (8, 'bahasa_indonesia'), (8, 'ipa')]
    assert d['kisi_kisi'][2] == {'id': 'k8-ipa', 'jenjang': 8, 'mapel': 'ipa', 'nama_file': 'k8-ipa.pdf', 'ukuran_byte': 2048,
                                 'updated_at': '2026-11-30T09:00:00+07:00', 'jumlah_unduh': 3}
    teks = r.text
    assert 'kartu_soal' not in teks and 'ks7-mtk' not in teks and 'rahasia-' not in teks and 'guru1' not in teks and 'Bu Siti' not in teks
    log = klien.db.ujian_akses_log.docs
    assert len(log) == 1 and log[0]['hasil'] == 'ok' and log[0]['tautan_id'] == 't-info' and log[0]['perangkat'] == 'UjiBrowser/1.0'


def test_token_tidak_dikenal_dan_salah_jenis(klien):
    for token in ('TokenTidakAda_xxxxxxxxxxxxxxxxxxx', TOKEN_MON):  # tautan monitoring tidak membuka halaman info
        r = get(klien, f'/publik/info-ujian/{token}')
        assert r.status_code == 404 and r.json()['detail'] == 'Tautan tidak ditemukan atau sudah diganti panitia.'
    # percobaan token salah dari IP yang sama dalam 1 menit digabung menjadi satu entri
    assert [(x['hasil'], x['jumlah_percobaan']) for x in klien.db.ujian_akses_log.docs] == [('tidak_dikenal', 2)]
    r = get(klien, '/publik/info-ujian/' + 'x' * 150)  # bentuk mustahil: ditolak tanpa query & tanpa log
    assert r.status_code == 404 and klien.db.ujian_akses_log.docs[0]['jumlah_percobaan'] == 2


def test_ujian_terhapus_dianggap_tidak_dikenal(klien):
    klien.db.ujian.docs.clear()
    assert get(klien, f'/publik/info-ujian/{TOKEN}').status_code == 404


@pytest.mark.parametrize('ubah,kini,alasan', [
    ({'aktif': False}, '2026-12-02T08:00:00+07:00', 'nonaktif'),
    ({}, '2026-11-25T06:59:00+07:00', 'belum_mulai'),
    ({}, '2026-12-06T16:00:00+07:00', 'sudah_selesai'),
])
def test_tautan_tidak_berlaku(klien, ubah, kini, alasan):
    klien.db.ujian_tautan_publik.docs[0].update(ubah)
    klien.kini = datetime.fromisoformat(kini)
    r = get(klien, f'/publik/info-ujian/{TOKEN}')
    assert r.status_code == 403, r.text
    d = r.json()['detail']
    assert d['alasan'] == alasan and d['pesan'] and 'madrasah' in d and d['selesai_at'] == '2026-12-06T16:00:00+07:00'
    assert 'jadwal' not in r.text and 'Hadir tepat waktu' not in r.text
    assert klien.db.ujian_akses_log.docs[-1]['hasil'] == alasan


def test_panduan_cbt_pdf(klien, tmp_path):
    r = get(klien, f'/publik/info-ujian/{TOKEN}/panduan-cbt')
    assert r.status_code == 404 and r.json()['detail'] == 'Panduan CBT belum tersedia.'
    folder = tmp_path / 'ujian_info'
    folder.mkdir(exist_ok=True)
    (folder / 'uas-acak.pdf').write_bytes(b'%PDF-1.4 panduan')
    klien.db.ujian_info_konten.docs[0]['panduan_pdf'] = {'nama_file': 'Panduan CBT Siswa.pdf', 'nama_berkas': 'uas-acak.pdf'}
    assert get(klien, f'/publik/info-ujian/{TOKEN}').json()['panduan_cbt']['ada_pdf'] is True
    r = get(klien, f'/publik/info-ujian/{TOKEN}/panduan-cbt')
    assert r.status_code == 200 and r.content == b'%PDF-1.4 panduan'
    assert r.headers['content-type'] == 'application/pdf' and r.headers['content-disposition'].startswith('inline')
    klien.db.ujian_tautan_publik.docs[0]['aktif'] = False
    assert get(klien, f'/publik/info-ujian/{TOKEN}/panduan-cbt').status_code == 403


def _tulis_berkas(tmp_path, nama, isi=b'%PDF-1.4 kisi'):
    folder = tmp_path / 'ujian_berkas'
    folder.mkdir(exist_ok=True)
    (folder / nama).write_bytes(isi)


def test_unduh_kisi_kisi_menambah_penghitung_dan_log(klien, tmp_path):
    _tulis_berkas(tmp_path, 'rahasia-k8-ipa.pdf')
    for n in (4, 5):
        r = get(klien, f'/publik/info-ujian/{TOKEN}/kisi-kisi/k8-ipa')
        assert r.status_code == 200, r.text
        assert r.content == b'%PDF-1.4 kisi' and r.headers['content-type'] == 'application/pdf'
        assert r.headers['x-jumlah-unduh'] == str(n) and r.headers['cache-control'] == 'no-store'
        assert r.headers['content-disposition'].startswith('attachment') and 'k8-ipa.pdf' in r.headers['content-disposition']
    assert next(b for b in klien.db.ujian_berkas.docs if b['id'] == 'k8-ipa')['jumlah_unduh'] == 5
    assert get(klien, f'/publik/info-ujian/{TOKEN}').json()['kisi_kisi'][2]['jumlah_unduh'] == 5  # tampil di halaman info
    log = klien.db.ujian_unduh_log.docs
    assert len(log) == 2 and log[0]['mode'] == 'publik' and log[0]['tautan_id'] == 't-info' and log[0]['pengunduh_id'] is None
    assert (log[0]['berkas_id'], log[0]['jenjang'], log[0]['mapel'], log[0]['perangkat']) == ('k8-ipa', 8, 'ipa', 'UjiBrowser/1.0')
    # unduhan berhasil tidak menambah log akses halaman (hanya pembukaan halaman info di atas)
    assert [x['hasil'] for x in klien.db.ujian_akses_log.docs] == ['ok']


@pytest.mark.parametrize('bid', ['ks7-mtk', 'k9-lain', 'k9-draf', 'lain', 'tidak-ada', 'x' * 80])
def test_unduh_ditolak_untuk_berkas_terlarang(klien, tmp_path, bid):
    for nama in ('rahasia-ks7-mtk.pdf', 'rahasia-k9-lain.pdf', 'rahasia-k9-draf.pdf', 'rahasia-lain.pdf'):
        _tulis_berkas(tmp_path, nama)
    r = get(klien, f'/publik/info-ujian/{TOKEN}/kisi-kisi/{bid}')
    assert r.status_code == 404 and 'tidak ditemukan' in r.json()['detail']
    assert not klien.db.ujian_unduh_log.docs
    assert all(int(b.get('jumlah_unduh') or 0) == 3 for b in klien.db.ujian_berkas.docs if b['id'] != 'k7-mtk')


def test_unduh_berkas_hilang_di_disk_tidak_dihitung(klien):
    r = get(klien, f'/publik/info-ujian/{TOKEN}/kisi-kisi/k7-mtk')
    assert r.status_code == 404
    assert next(b for b in klien.db.ujian_berkas.docs if b['id'] == 'k7-mtk')['jumlah_unduh'] == 0 and not klien.db.ujian_unduh_log.docs


def test_unduh_dengan_tautan_ditutup(klien, tmp_path):
    _tulis_berkas(tmp_path, 'rahasia-k8-ipa.pdf')
    klien.db.ujian_tautan_publik.docs[0]['aktif'] = False
    r = get(klien, f'/publik/info-ujian/{TOKEN}/kisi-kisi/k8-ipa')
    assert r.status_code == 403 and r.json()['detail']['alasan'] == 'nonaktif'
    assert not klien.db.ujian_unduh_log.docs and klien.db.ujian_akses_log.docs[-1]['hasil'] == 'nonaktif'
    # tautan monitoring tidak dapat dipakai mengunduh kisi-kisi
    klien.db.ujian_tautan_publik.docs[0]['aktif'] = True
    assert get(klien, f'/publik/info-ujian/{TOKEN_MON}/kisi-kisi/k8-ipa').status_code == 404


def test_cors_mengekspos_penghitung():
    import server
    cors = next(m for m in server.app.user_middleware if m.cls.__name__ == 'CORSMiddleware')
    assert 'X-Jumlah-Unduh' in cors.kwargs['expose_headers']


def test_penghitung_kisi_sesuai_log_publik(klien, tmp_path):
    import asyncio

    import ujian_info as ui
    _tulis_berkas(tmp_path, 'rahasia-k8-ipa.pdf')
    awal = next(b for b in klien.db.ujian_berkas.docs if b['id'] == 'k8-ipa')['jumlah_unduh']
    for _ in range(4):
        assert get(klien, f'/publik/info-ujian/{TOKEN}/kisi-kisi/k8-ipa').status_code == 200
    b = next(b for b in klien.db.ujian_berkas.docs if b['id'] == 'k8-ipa')
    log = [x for x in klien.db.ujian_unduh_log.docs if x['berkas_id'] == 'k8-ipa' and x['mode'] == 'publik']
    assert b['jumlah_unduh'] == awal + 4 and len(log) == 4  # satu klik = +1 penghitung = +1 log
    assert asyncio.run(ui.rekonsiliasi_jumlah_unduh(klien.db, 'uas'))['selisih'] == []
