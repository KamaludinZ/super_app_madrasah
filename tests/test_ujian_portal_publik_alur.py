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
        {'id': 'j3', 'ujian_id': 'uas', 'tanggal': HARI_INI, 'sesi_ke': 2, 'jam_mulai': '09:30', 'jam_selesai': '11:00',
         'mapel': {'7': 'IPA'}},
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
    assert d['waktu_server'] == f'{HARI_INI}T08:00:00+07:00'
    # mapel per jenjang = mapel di jadwal sesi (urut jadwal), bukan 15 mapel baku
    assert d['mapel']['7'] == [{'kode': 'matematika', 'nama': 'Matematika'}, {'kode': 'ipa', 'nama': 'IPA'},
                               {'kode': 'bahasa_indonesia', 'nama': 'Bahasa Indonesia'}]
    # isolasi: tautan soal tidak pernah ikut payload portal
    assert 'cbt.madrasah.sch.id' not in r.text and all('url' not in s for s in d['soal'])
    s = {(x['jenjang'], x['mapel']): x for x in d['soal']}
    assert s[(7, 'matematika')] == {
        'id': 'ls-7-matematika', 'jenjang': 7, 'mapel': 'matematika', 'nama': 'Matematika', 'tanggal': HARI_INI, 'sesi_ke': 1,
        'mulai_at': f'{HARI_INI}T07:30:00+07:00', 'selesai_at': f'{HARI_INI}T09:00:00+07:00', 'status': 'berlangsung',
        'hitung_mundur': {'menuju': 'selesai', 'detik': 3600}, 'siap': True, 'ditahan': False, 'jumlah_klik': 12, 'klik_terakhir_at': f'{HARI_INI}T07:58:00+07:00'}
    assert (s[(7, 'ipa')]['status'], s[(7, 'ipa')]['siap'], s[(7, 'ipa')]['sesi_ke']) == ('belum_dimulai', False, 2)
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


def test_mapel_simulasi_dari_jadwal_tampil_dan_dapat_dikerjakan(klien):
    """Mapel di luar 15 mapel baku (mis. "Simulasi" dari menu Mata Pelajaran) yang dipasang di jadwal sesi ikut tampil di
    portal dan tombolnya dapat dipakai seperti mapel baku."""
    klien.db.jadwal_ujian.docs.append({'id': 'j4', 'ujian_id': 'uas', 'tanggal': HARI_INI, 'sesi_ke': 3, 'jam_mulai': '07:45',
                                       'jam_selesai': '08:30', 'mapel': {'8': 'Simulasi CBT'}})
    klien.db.ujian_link_soal.docs.append({**link(8, 'simulasicbt', '07:45', '08:30', url='https://cbt.madrasah.sch.id/simulasi'),
                                          'nama_mapel': 'Simulasi CBT'})
    d = get(klien, f'/publik/portal-ujian/{TOKEN_PORTAL}').json()
    assert {'kode': 'simulasicbt', 'nama': 'Simulasi CBT'} in d['mapel']['8']
    s = {(x['jenjang'], x['mapel']): x for x in d['soal']}
    assert (s[(8, 'simulasicbt')]['nama'], s[(8, 'simulasicbt')]['status'], s[(8, 'simulasicbt')]['siap']) == ('Simulasi CBT', 'berlangsung', True)
    r = kerjakan(klien, 'ls-8-simulasicbt')
    assert r.status_code == 302 and r.headers['location'] == 'https://cbt.madrasah.sch.id/simulasi'
    assert [(x['mapel'], x['nama_mapel'], x['hasil']) for x in log_klik(klien)] == [('simulasicbt', 'Simulasi CBT', 'ok')]


def test_mapel_yang_dihapus_dari_jadwal_hilang_dari_portal(klien):
    """Link soal tersimpan yang mapelnya sudah tidak ada di jadwal sesi tidak tampil di portal dan kliknya ditolak."""
    klien.db.jadwal_ujian.docs[0]['mapel'] = {'8': 'IPA', '9': 'PPKn'}  # Matematika kelas 7 dihapus dari jadwal
    d = get(klien, f'/publik/portal-ujian/{TOKEN_PORTAL}').json()
    assert (7, 'matematika') not in {(x['jenjang'], x['mapel']) for x in d['soal']}
    assert 'matematika' not in {m['kode'] for m in d['mapel']['7']}
    r = kerjakan(klien, 'ls-7-matematika')
    assert r.status_code == 404 and 'location' not in r.headers and 'tidak ada di portal' in r.text
    assert [(x['link_soal_id'], x['hasil']) for x in log_klik(klien)] == [('ls-7-matematika', 'tidak_dikenal')]
    assert klien.db.ujian_link_soal.docs[0]['jumlah_klik'] == 12


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
        {'jenjang': 7, 'mapel': 'matematika', 'nama': 'Matematika', 'mulai_at': f'{HARI_INI}T07:30:00+07:00',
         'selesai_at': f'{HARI_INI}T09:00:00+07:00'},
        {'jenjang': 9, 'mapel': 'pkn', 'nama': 'PKN', 'mulai_at': f'{HARI_INI}T07:30:00+07:00', 'selesai_at': f'{HARI_INI}T09:00:00+07:00'},
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



def test_isolasi_payload_portal_info_monitoring(klien):
    """Field tambahan apa pun di dokumen link soal tidak bocor; halaman info & monitoring tidak memuat data link soal."""
    import ujian_portal as up
    klien.db.ujian_link_soal.docs[0].update({'catatan_admin': 'kunci jawaban di folder X', 'diperbarui_oleh': 'admin',
                                             'diperbarui_oleh_nama': 'Administrator', 'token_cbt': 'RAHASIA-CBT-123'})
    klien.db.ujian_tautan_publik.docs.append({'id': 't-mon', 'ujian_id': 'uas', 'jenis': 'monitoring', 'token': 'TokenMonitoringContoh_123456789a',
                                              'aktif': True, 'mulai_at': None, 'selesai_at': None})
    r = get(klien, f'/publik/portal-ujian/{TOKEN_PORTAL}')
    d = r.json()
    assert all(tuple(x) == up.FIELD_SOAL_PUBLIK for x in d['soal'])
    assert set(d['ujian']) == set(up.FIELD_UJIAN_PUBLIK) and TOKEN_PORTAL not in r.text
    for rahasia in ('cbt.madrasah.sch.id', 'RAHASIA-CBT-123', 'kunci jawaban', 'Administrator'):
        assert rahasia not in r.text, rahasia
    for path in (f'/publik/info-ujian/{TOKEN_INFO}', '/publik/monitoring-ujian/TokenMonitoringContoh_123456789a'):
        t = get(klien, path)
        assert t.status_code == 200, path
        for rahasia in ('cbt.madrasah.sch.id', 'RAHASIA-CBT-123', 'ls-7-matematika', 'jumlah_klik', TOKEN_PORTAL):
            assert rahasia not in t.text, (path, rahasia)


def test_field_soal_publik_sama_dengan_frontend():
    import re
    from pathlib import Path

    import ujian_portal as up
    js = (Path(__file__).resolve().parents[1] / 'frontend' / 'src' / 'lib' / 'ujianPortalPublik.js').read_text(encoding='utf-8')
    frontend = re.findall(r"'([a-z_]+)'", re.search(r'const FIELD_SOAL_PUBLIK = \[([^\]]+)\]', js).group(1))
    assert [f for f in up.FIELD_SOAL_PUBLIK if f != 'hitung_mundur'] == frontend


def test_rute_info_dan_monitoring_tidak_menyentuh_link_soal():
    """Penjaga statis isolasi: router halaman info & monitoring (dan modul yang mereka pakai untuk menyusun payload)
    tidak pernah membaca koleksi link soal, sehingga tautan soal mustahil ikut payload-nya walau kode berubah."""
    from pathlib import Path
    backend = Path(__file__).resolve().parents[1] / 'backend'
    for f in ('routers/ujian_info_publik.py', 'routers/ujian_monitoring_publik.py', 'ujian_pengumpulan.py'):
        teks = (backend / f).read_text(encoding='utf-8')
        for terlarang in ('ujian_link_soal', 'KOLEKSI_LINK_SOAL', 'ujian_portal', 'url_soal'):
            assert terlarang not in teks, (f, terlarang)


def test_tautan_tidak_sah_ditandai_belum_siap(klien):
    """Dokumen lama/hasil impor dengan tautan bukan http(s) tidak pernah dianggap siap — dan bukan "ditahan" (tidak ada
    tautan sah untuk dibuka) — sehingga tombol tidak tampil."""
    klien.db.ujian_link_soal.docs[0]['url'] = 'javascript:alert(document.cookie)'
    s = {(x['jenjang'], x['mapel']): x for x in get(klien, f'/publik/portal-ujian/{TOKEN_PORTAL}').json()['soal']}
    m = s[(7, 'matematika')]
    assert (m['status'], m['siap'], m['ditahan']) == ('berlangsung', False, False)
    assert (s[(9, 'pkn')]['siap'], s[(9, 'pkn')]['ditahan']) == (False, True)  # tautan sah + dimatikan admin = ditahan


# ---- Rute kerjakan: klik "Mengerjakan" ----
def kerjakan(k, soal_id, token=TOKEN_PORTAL, **kw):
    return k(None, None, 'GET', f'/publik/portal-ujian/{token}/kerjakan/{soal_id}', headers={'user-agent': 'HP Siswa'},
             follow_redirects=False, **kw)


def log_klik(k):
    return [x for x in k.db.ujian_akses_log.docs if x.get('aksi') == 'klik_mengerjakan']


def test_klik_sah_dicatat_dihitung_dan_dialihkan_tanpa_referrer(klien):
    r = kerjakan(klien, 'ls-7-matematika', params={'sesi': 'sesiPortalA'})
    assert r.status_code == 302 and r.headers['location'] == URL_RAHASIA
    assert r.headers['referrer-policy'] == 'no-referrer' and r.headers['cache-control'] == 'no-store'
    doc = klien.db.ujian_link_soal.docs[0]
    assert (doc['jumlah_klik'], doc['klik_terakhir_at']) == (13, f'{HARI_INI}T08:00:00+07:00')
    (log,) = log_klik(klien)
    assert (log['hasil'], log['link_soal_id'], log['jenjang'], log['mapel'], log['url_host'], log['jenis_tautan'], log['sesi'],
            log['perangkat'], log['waktu']) == ('ok', 'ls-7-matematika', 7, 'matematika', 'cbt.madrasah.sch.id', 'portal', 'sesiPortalA',
                                                'HP Siswa', f'{HARI_INI}T08:00:00+07:00')
    assert not any('rahasia-matematika' in str(v) for v in log.values())  # log hanya menyimpan host, bukan tautan lengkap
    # klik terakhir tidak mundur bila klik lain yang lebih awal selesai belakangan ($max)
    klien.kini = datetime.fromisoformat(f'{HARI_INI}T07:59:00+07:00')
    assert kerjakan(klien, 'ls-7-matematika').status_code == 302
    assert (doc['jumlah_klik'], doc['klik_terakhir_at']) == (14, f'{HARI_INI}T08:00:00+07:00')
    # penghitung di portal langsung bertambah
    s = {x['id']: x for x in get(klien, f'/publik/portal-ujian/{TOKEN_PORTAL}').json()['soal']}
    assert s['ls-7-matematika']['jumlah_klik'] == 14


@pytest.mark.parametrize('soal_id,status,hasil,pesan', [
    ('ls-7-ipa', 403, 'mapel_belum_siap', 'belum disiapkan panitia'),
    ('ls-9-pkn', 403, 'mapel_ditahan', 'ditahan panitia'),
    ('ls-8-ipa', 403, 'sudah_selesai', 'sudah ditutup'),
    ('belum-7-bahasa_indonesia', 404, 'tidak_dikenal', 'tidak ada di portal'),
    ('ls-9-ips', 404, 'tidak_dikenal', 'tidak ada di portal'),  # milik ujian lain
    ('bukan id!', 404, 'tidak_dikenal', 'tidak ada di portal'),
])
def test_klik_ditolak_tercatat_tanpa_dihitung(klien, soal_id, status, hasil, pesan):
    sebelum = [d.get('jumlah_klik') for d in klien.db.ujian_link_soal.docs]
    r = kerjakan(klien, soal_id)
    assert r.status_code == status and 'location' not in r.headers
    assert r.headers['content-type'].startswith('text/html') and pesan in r.text and 'cbt.madrasah.sch.id' not in r.text
    assert [d.get('jumlah_klik') for d in klien.db.ujian_link_soal.docs] == sebelum
    assert [x['hasil'] for x in log_klik(klien)] == [hasil]


def test_klik_sebelum_jam_mulai_dan_tepat_jam_tutup_ditolak(klien):
    klien.kini = datetime.fromisoformat(f'{HARI_INI}T07:29:59+07:00')
    r = kerjakan(klien, 'ls-7-matematika')
    assert r.status_code == 403 and 'Dibuka pukul 07.30 WIB' in r.text
    klien.kini = datetime.fromisoformat(f'{HARI_INI}T09:00:00+07:00')
    assert kerjakan(klien, 'ls-7-matematika').status_code == 403
    klien.kini = datetime.fromisoformat(f'{HARI_INI}T07:30:00+07:00')
    assert kerjakan(klien, 'ls-7-matematika').status_code == 302
    assert [x['hasil'] for x in log_klik(klien)] == ['belum_mulai', 'sudah_selesai', 'ok']
    assert klien.db.ujian_link_soal.docs[0]['jumlah_klik'] == 13


def test_klik_saat_portal_ditutup_atau_token_salah(klien):
    klien.db.ujian_tautan_publik.docs[0]['aktif'] = False
    r = kerjakan(klien, 'ls-7-matematika')
    assert r.status_code == 403 and 'ditutup panitia' in r.text and 'location' not in r.headers
    assert [(x['hasil'], x['link_soal_id']) for x in log_klik(klien)] == [('nonaktif', None)]
    r = kerjakan(klien, 'ls-7-matematika', token='TokenSalahSekali_000000000000000')
    assert r.status_code == 404 and 'Tautan tidak ditemukan' in r.text
    assert kerjakan(klien, 'ls-7-matematika', token=TOKEN_INFO).status_code == 404  # token info tidak membuka soal
    assert klien.db.ujian_link_soal.docs[0]['jumlah_klik'] == 12
    salah = [x for x in klien.db.ujian_akses_log.docs if x['hasil'] == 'tidak_dikenal']
    assert len(salah) == 1 and salah[0]['jumlah_percobaan'] == 2  # tebakan token dari IP sama digabung
