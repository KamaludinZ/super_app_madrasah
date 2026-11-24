"""Alur HTTP Portal Ujian publik (tanpa login): token portal terpisah, status mapel menurut waktu server, isolasi data
(tanpa tautan soal), penolakan di luar masa ujian beserta jadwal berikutnya, dan log akses."""
import os
import sys
from datetime import datetime

import pytest

sys.path.insert(0, os.path.dirname(__file__))

from ujian_dasar import HARI_INI, buat_klien, ujian_doc  # noqa: E402

TOKEN_PORTAL = 'TokenPortalUjianContoh_123456789'
TOKEN_INFO = 'TokenInfoUjianContoh_123456789ab'
BESOK = '2026-12-03'
URL_RAHASIA = 'https://cbt.madrasah.sch.id/ujian/rahasia-matematika-7'


def link(jenjang, mapel, mulai, selesai, url='', aktif=True, **kw):
    return {'id': f'ls-{jenjang}-{mapel}', 'ujian_id': 'uas', 'jenjang': jenjang, 'mapel': mapel, 'url': url,
            'mulai_at': f'{HARI_INI}T{mulai}:00+07:00', 'selesai_at': f'{HARI_INI}T{selesai}:00+07:00', 'aktif': aktif,
            'jumlah_klik': 0, 'klik_terakhir_at': None, **kw}


@pytest.fixture
def klien(monkeypatch):
    import routers.ujian_info_publik as rip
    import routers.ujian_portal_publik as rpp
    import ujian_info
    k = buat_klien(monkeypatch)
    k.kini = datetime.fromisoformat(f'{HARI_INI}T08:00:00+07:00')
    for modul in (rip, rpp, ujian_info):
        monkeypatch.setattr(modul, 'sekarang_wib', lambda: k.kini)
    db = k.db
    db.ujian.docs.append(ujian_doc('uas', 'UAS', 'sem-kini', '2026-12-01', '2026-12-06', nama='ASAS Ganjil 2026/2027'))
    db.ujian_tautan_publik.docs += [
        {'id': 't-portal', 'ujian_id': 'uas', 'jenis': 'portal', 'token': TOKEN_PORTAL, 'aktif': True,
         'mulai_at': '2026-12-01T06:00:00+07:00', 'selesai_at': '2026-12-06T16:00:00+07:00'},
        {'id': 't-info', 'ujian_id': 'uas', 'jenis': 'info', 'token': TOKEN_INFO, 'aktif': True, 'mulai_at': None, 'selesai_at': None},
    ]
    db.jadwal_ujian.docs += [
        {'id': 'j1', 'ujian_id': 'uas', 'tanggal': HARI_INI, 'sesi_ke': 1, 'jam_mulai': '07:30', 'jam_selesai': '09:00',
         'mapel': {'7': 'Matematika', '8': 'IPA', '9': 'PPKn'}},
        {'id': 'j2', 'ujian_id': 'uas', 'tanggal': BESOK, 'sesi_ke': 1, 'jam_mulai': '07:30', 'jam_selesai': '09:00',
         'mapel': {'7': 'Bahasa Indonesia', '8': 'Fiqh', '9': 'IPS'}},
    ]
    db.ujian_link_soal.docs += [
        link(7, 'matematika', '07:30', '09:00', url=URL_RAHASIA, jumlah_klik=12, klik_terakhir_at=f'{HARI_INI}T07:58:00+07:00'),
        link(7, 'ipa', '09:30', '11:00'),                                                  # tautan belum diisi
        link(8, 'ipa', '07:00', '07:45', url='https://cbt.madrasah.sch.id/ujian/ipa-8'),   # sudah ditutup
        link(9, 'pkn', '07:30', '09:00', url='https://cbt.madrasah.sch.id/ujian/pkn-9', aktif=False),  # ditahan admin
        {**link(9, 'ips', '07:30', '09:00', url='https://cbt.madrasah.sch.id/x'), 'ujian_id': 'ujian-lain'},
    ]
    return k


def get(k, path, **kw):
    return k(None, None, 'GET', path, headers={'user-agent': 'HP Siswa'}, **kw)


def test_portal_tanpa_login_hanya_jadwal_dan_status(klien):
    r = get(klien, f'/publik/portal-ujian/{TOKEN_PORTAL}')
    assert r.status_code == 200, r.text
    assert r.headers['cache-control'] == 'no-store'
    d = r.json()
    assert set(d) == {'madrasah', 'ujian', 'tautan', 'waktu_server', 'mapel', 'soal', 'batas_berikutnya_at'}  # tanpa kisi-kisi/berkas/tata tertib
    assert d['batas_berikutnya_at'] == f'{HARI_INI}T09:00:00+07:00'  # matematika & PPKn ditutup pukul 09.00
    assert d['tautan'] == {'jenis': 'portal', 'mulai_at': '2026-12-01T06:00:00+07:00', 'selesai_at': '2026-12-06T16:00:00+07:00'}
    assert d['waktu_server'] == f'{HARI_INI}T08:00:00+07:00' and len(d['mapel']['7']) == 15
    # isolasi: tautan soal tidak pernah ikut payload portal
    assert 'cbt.madrasah.sch.id' not in r.text and all('url' not in s for s in d['soal'])
    s = {(x['jenjang'], x['mapel']): x for x in d['soal']}
    assert s[(7, 'matematika')] == {
        'id': 'ls-7-matematika', 'jenjang': 7, 'mapel': 'matematika', 'tanggal': HARI_INI, 'sesi_ke': 1,
        'mulai_at': f'{HARI_INI}T07:30:00+07:00', 'selesai_at': f'{HARI_INI}T09:00:00+07:00', 'status': 'berlangsung',
        'hitung_mundur': {'menuju': 'selesai', 'detik': 3600}, 'siap': True, 'ditahan': False, 'jumlah_klik': 12, 'klik_terakhir_at': f'{HARI_INI}T07:58:00+07:00'}
    assert (s[(7, 'ipa')]['status'], s[(7, 'ipa')]['siap'], s[(7, 'ipa')]['sesi_ke']) == ('belum_dimulai', False, None)
    assert (s[(8, 'ipa')]['status'], s[(8, 'ipa')]['siap'], s[(8, 'ipa')]['hitung_mundur']) == ('ditutup', True, None)
    assert s[(7, 'ipa')]['hitung_mundur'] == {'menuju': 'mulai', 'detik': 5400}
    assert (s[(9, 'pkn')]['status'], s[(9, 'pkn')]['siap'], s[(9, 'pkn')]['ditahan']) == ('berlangsung', False, True)
    # mapel dari jadwal yang belum diatur admin: tampil, belum siap, id sementara
    bi = s[(7, 'bahasa_indonesia')]
    assert (bi['id'], bi['tanggal'], bi['status'], bi['siap'], bi['ditahan']) == ('belum-7-bahasa_indonesia', BESOK, 'belum_dimulai', False, False)
    assert (9, 'ips') in s and s[(9, 'ips')]['id'] == 'belum-9-ips'  # link soal ujian lain tidak ikut
    # urut jenjang lalu jam mulai
    assert [(x['jenjang'], x['mapel']) for x in d['soal'] if x['jenjang'] == 7] == [(7, 'matematika'), (7, 'ipa'), (7, 'bahasa_indonesia')]
    log = klien.db.ujian_akses_log.docs
    assert [(x['jenis_tautan'], x['aksi'], x['hasil'], x['perangkat']) for x in log] == [('portal', 'buka_tautan', 'ok', 'HP Siswa')]


def test_status_mengikuti_waktu_server(klien):
    klien.kini = datetime.fromisoformat(f'{HARI_INI}T09:00:00+07:00')  # tepat jam tutup: sudah ditutup
    s = {(x['jenjang'], x['mapel']): x['status'] for x in get(klien, f'/publik/portal-ujian/{TOKEN_PORTAL}').json()['soal']}
    assert s[(7, 'matematika')] == 'ditutup' and s[(7, 'ipa')] == 'belum_dimulai'
    klien.kini = datetime.fromisoformat(f'{HARI_INI}T09:30:00+07:00')  # tepat jam mulai: berlangsung
    s = {(x['jenjang'], x['mapel']): x['status'] for x in get(klien, f'/publik/portal-ujian/{TOKEN_PORTAL}').json()['soal']}
    assert s[(7, 'ipa')] == 'berlangsung'


def test_token_portal_dan_info_tidak_tertukar(klien):
    assert get(klien, f'/publik/portal-ujian/{TOKEN_INFO}').status_code == 404
    assert get(klien, f'/publik/info-ujian/{TOKEN_PORTAL}').status_code == 404
    r = get(klien, '/publik/portal-ujian/TokenSalahSekali_000000000000000')
    assert r.status_code == 404 and r.json()['detail'] == 'Tautan tidak ditemukan atau sudah diganti panitia.'
    assert get(klien, '/publik/portal-ujian/bukan token!').status_code == 404
    info = get(klien, f'/publik/info-ujian/{TOKEN_INFO}')
    assert info.status_code == 200 and 'cbt.madrasah.sch.id' not in info.text  # halaman info tidak memuat tautan soal


def test_portal_ditutup_ditolak_dengan_jadwal_berikutnya(klien):
    klien.db.ujian_tautan_publik.docs[0]['aktif'] = False
    r = get(klien, f'/publik/portal-ujian/{TOKEN_PORTAL}')
    assert r.status_code == 403 and r.headers['cache-control'] == 'no-store'
    d = r.json()['detail']
    assert d['alasan'] == 'nonaktif' and d['pesan'] == 'Tautan portal ujian sedang ditutup panitia.' and d['madrasah']
    assert 'soal' not in r.json() and 'cbt.madrasah.sch.id' not in r.text
    # 08.00: matematika (7) & PPKn (9) masih berlangsung, IPA (8) sudah ditutup -> hari ini, mapel pertama yang belum lewat
    assert d['jadwal_berikutnya'] == {'tanggal': HARI_INI, 'soal': [
        {'jenjang': 7, 'mapel': 'matematika', 'mulai_at': f'{HARI_INI}T07:30:00+07:00', 'selesai_at': f'{HARI_INI}T09:00:00+07:00'},
        {'jenjang': 9, 'mapel': 'pkn', 'mulai_at': f'{HARI_INI}T07:30:00+07:00', 'selesai_at': f'{HARI_INI}T09:00:00+07:00'},
    ]}
    assert [x['hasil'] for x in klien.db.ujian_akses_log.docs] == ['nonaktif']


def test_di_luar_masa_ujian_ditolak(klien):
    klien.kini = datetime.fromisoformat('2026-12-01T05:00:00+07:00')
    d = get(klien, f'/publik/portal-ujian/{TOKEN_PORTAL}').json()['detail']
    assert d['alasan'] == 'belum_mulai' and d['mulai_at'] == '2026-12-01T06:00:00+07:00'
    assert d['jadwal_berikutnya']['tanggal'] == HARI_INI
    klien.kini = datetime.fromisoformat('2026-12-06T16:00:00+07:00')
    r = get(klien, f'/publik/portal-ujian/{TOKEN_PORTAL}')
    assert r.status_code == 403 and r.json()['detail']['alasan'] == 'sudah_selesai' and r.json()['detail']['jadwal_berikutnya'] is None


def test_muat_ulang_tidak_menambah_log(klien):
    url = f'/publik/portal-ujian/{TOKEN_PORTAL}'
    assert get(klien, url, params={'sesi': 'sesiPortalA'}).status_code == 200
    for _ in range(3):
        assert get(klien, url, params={'sesi': 'sesiPortalA', 'segarkan': 1}).status_code == 200
    log = klien.db.ujian_akses_log.docs
    assert len(log) == 1 and log[0]['sesi'] == 'sesiPortalA' and log[0]['jumlah_segarkan'] == 3


def test_tanpa_jendela_tautan_portal_tetap_terkunci_di_luar_masa_ujian(klien):
    t = klien.db.ujian_tautan_publik.docs[0]
    t['mulai_at'] = t['selesai_at'] = None  # admin membuka portal tanpa mengisi jendela
    url = f'/publik/portal-ujian/{TOKEN_PORTAL}'
    klien.kini = datetime.fromisoformat('2026-11-30T23:59:00+07:00')  # sehari sebelum masa ujian (1–6 Des)
    r = get(klien, url)
    assert r.status_code == 403 and r.json()['detail']['alasan'] == 'belum_mulai'
    assert r.json()['detail']['mulai_at'] == '2026-12-01T00:00:00+07:00' and r.json()['detail']['pesan'] == 'Tautan portal ujian belum dibuka.'
    klien.kini = datetime.fromisoformat('2026-12-06T23:59:00+07:00')  # hari terakhir masih terbuka
    assert get(klien, url).status_code == 200
    klien.kini = datetime.fromisoformat('2026-12-07T00:00:00+07:00')
    r = get(klien, url)
    assert r.status_code == 403 and r.json()['detail']['alasan'] == 'sudah_selesai' and r.json()['detail']['selesai_at'] == '2026-12-07T00:00:00+07:00'
    # satu entri log per permintaan, dengan hasil akhirnya
    assert [x['hasil'] for x in klien.db.ujian_akses_log.docs] == ['belum_mulai', 'ok', 'sudah_selesai']


def test_jendela_admin_tetap_dipakai_bila_diisi(klien):
    t = klien.db.ujian_tautan_publik.docs[0]
    t['mulai_at'], t['selesai_at'] = f'{HARI_INI}T09:00:00+07:00', None  # admin mempersempit awal; akhir ikut masa ujian
    assert get(klien, f'/publik/portal-ujian/{TOKEN_PORTAL}').json()['detail']['alasan'] == 'belum_mulai'
    klien.kini = datetime.fromisoformat(f'{HARI_INI}T09:00:00+07:00')
    assert get(klien, f'/publik/portal-ujian/{TOKEN_PORTAL}').status_code == 200
