"""Alur HTTP halaman publik Monitoring Pengumpulan (tanpa login): token monitoring, status per mapel, kerahasiaan, log."""
import os
import sys
from datetime import datetime

import pytest

sys.path.insert(0, os.path.dirname(__file__))

from ujian_dasar import HARI_INI, buat_klien, ujian_doc  # noqa: E402

TOKEN_MON = 'TokenMonitoringContoh_123456789a'
TOKEN_INFO = 'TokenInfoUjianContoh_123456789ab'


def berkas(jenis, jenjang, mapel, waktu='2026-11-30T09:00:00+07:00', **kw):
    return {'id': f'{jenis}-{jenjang}-{mapel}', 'ujian_id': 'uas', 'jenis': jenis, 'jenjang': jenjang, 'mapel': mapel, 'status': 'terkirim',
            'nama_file': f'{mapel}.pdf', 'nama_berkas': f'rahasia-{jenis}-{mapel}.pdf', 'mime_type': 'application/pdf', 'ukuran_byte': 2048,
            'guru_pj_id': 'guru1', 'guru_pj_nama': 'Bu Siti', 'updated_at': waktu, 'jumlah_unduh': 3, **kw}


@pytest.fixture
def klien(monkeypatch):
    import routers.ujian_info_publik as rip
    import routers.ujian_monitoring_publik as rmp
    k = buat_klien(monkeypatch)
    k.kini = datetime.fromisoformat(f'{HARI_INI}T08:00:00+07:00')
    monkeypatch.setattr(rip, 'sekarang_wib', lambda: k.kini)
    monkeypatch.setattr(rmp, 'sekarang_wib', lambda: k.kini)
    import ujian_info
    monkeypatch.setattr(ujian_info, 'sekarang_wib', lambda: k.kini)  # waktu log akses/segarkan
    db = k.db
    db.ujian.docs.append(ujian_doc('uas', 'UAS', 'sem-kini', '2026-12-01', '2026-12-06', nama='ASAS Ganjil 2026/2027'))
    db.ujian_tautan_publik.docs += [
        {'id': 't-mon', 'ujian_id': 'uas', 'jenis': 'monitoring', 'token': TOKEN_MON, 'aktif': True, 'mulai_at': None,
         'selesai_at': '2026-12-06T16:00:00+07:00'},
        {'id': 't-info', 'ujian_id': 'uas', 'jenis': 'info', 'token': TOKEN_INFO, 'aktif': True, 'mulai_at': None, 'selesai_at': None},
    ]
    db.ujian_berkas.docs += [
        berkas('kartu_soal', 8, 'ipa', '2026-12-01T10:00:00+07:00', guru_pj_nama='Pak Hadi'), berkas('kisi_kisi', 8, 'ipa'),
        berkas('kisi_kisi', 7, 'matematika'), berkas('kartu_soal', 9, 'pkn', status='belum'), berkas('kisi_kisi', 9, 'mapel_lama'),
        {**berkas('kisi_kisi', 7, 'ipa'), 'ujian_id': 'ujian-lain'},
    ]
    return k


def get(k, path, **kw):
    return k(None, None, 'GET', path, headers={'user-agent': 'LayarRuangGuru/1.0'}, **kw)


def test_monitoring_tanpa_login(klien):
    r = get(klien, f'/publik/monitoring-ujian/{TOKEN_MON}')
    assert r.status_code == 200, r.text
    assert r.headers['cache-control'] == 'no-store'
    d = r.json()
    assert d['ujian']['nama'] == 'ASAS Ganjil 2026/2027' and d['madrasah'] and d['waktu_server'].startswith(HARI_INI)
    assert d['tautan'] == {'jenis': 'monitoring', 'mulai_at': None, 'selesai_at': '2026-12-06T16:00:00+07:00'}
    assert d['berkas'] == [
        {'jenis': 'kisi_kisi', 'jenjang': 7, 'mapel': 'matematika', 'guru_pj_nama': 'Bu Siti', 'updated_at': '2026-11-30T09:00:00+07:00'},
        {'jenis': 'kisi_kisi', 'jenjang': 8, 'mapel': 'ipa', 'guru_pj_nama': 'Bu Siti', 'updated_at': '2026-11-30T09:00:00+07:00'},
        {'jenis': 'kartu_soal', 'jenjang': 8, 'mapel': 'ipa', 'guru_pj_nama': 'Pak Hadi', 'updated_at': '2026-12-01T10:00:00+07:00'},
    ]
    assert d['terakhir'] == '2026-12-01T10:00:00+07:00'
    for rahasia in ('rahasia-', 'nama_berkas', 'ukuran_byte', 'jumlah_unduh', 'guru1', '"id"', 'mapel_lama'):
        assert rahasia not in r.text
    log = klien.db.ujian_akses_log.docs
    assert len(log) == 1 and log[0]['hasil'] == 'ok' and log[0]['jenis_tautan'] == 'monitoring' and log[0]['perangkat'] == 'LayarRuangGuru/1.0'


def test_muat_ulang_tidak_dicatat_ulang(klien):
    get(klien, f'/publik/monitoring-ujian/{TOKEN_MON}')
    for _ in range(3):
        assert get(klien, f'/publik/monitoring-ujian/{TOKEN_MON}', params={'segarkan': 1}).status_code == 200
    assert len(klien.db.ujian_akses_log.docs) == 1


def test_token_info_tidak_membuka_monitoring(klien):
    r = get(klien, f'/publik/monitoring-ujian/{TOKEN_INFO}')
    assert r.status_code == 404 and klien.db.ujian_akses_log.docs[-1]['hasil'] == 'tidak_dikenal'


@pytest.mark.parametrize('ubah,kini,alasan', [
    ({'aktif': False}, '2026-12-02T08:00:00+07:00', 'nonaktif'),
    ({'mulai_at': '2026-12-03T07:00:00+07:00'}, '2026-12-02T08:00:00+07:00', 'belum_mulai'),
    ({}, '2026-12-06T16:00:00+07:00', 'sudah_selesai'),
])
def test_tautan_monitoring_tidak_berlaku(klien, ubah, kini, alasan):
    klien.db.ujian_tautan_publik.docs[0].update(ubah)
    klien.kini = datetime.fromisoformat(kini)
    r = get(klien, f'/publik/monitoring-ujian/{TOKEN_MON}')
    assert r.status_code == 403 and r.json()['detail']['alasan'] == alasan
    assert 'monitoring pengumpulan berkas' in r.json()['detail']['pesan'] and 'berkas' not in r.json()
    assert klien.db.ujian_akses_log.docs[-1]['hasil'] == alasan


def test_tidak_ada_jalur_unduh_kartu_soal(klien):
    for path in (f'/publik/monitoring-ujian/{TOKEN_MON}/kisi-kisi/kartu_soal-8-ipa', f'/publik/info-ujian/{TOKEN_INFO}/kisi-kisi/kartu_soal-8-ipa',
                 f'/publik/monitoring-ujian/{TOKEN_MON}/kartu-soal/kartu_soal-8-ipa'):
        assert get(klien, path).status_code == 404


def test_jendela_rusak_ditolak_fail_closed(klien):
    klien.db.ujian_tautan_publik.docs[0]['selesai_at'] = '06-12-2026 16:00'
    r = get(klien, f'/publik/monitoring-ujian/{TOKEN_MON}')
    assert r.status_code == 403 and r.json()['detail']['alasan'] == 'nonaktif' and 'tidak valid' in r.json()['detail']['pesan']


SESI = '0123456789abcdef0123456789abcdef'


def test_audit_pembukaan_satu_entri_per_sesi(klien):
    assert get(klien, f'/publik/monitoring-ujian/{TOKEN_MON}', params={'sesi': SESI}).status_code == 200
    log = klien.db.ujian_akses_log.docs
    assert len(log) == 1 and log[0]['sesi'] == SESI and log[0]['jumlah_segarkan'] == 0 and log[0]['terakhir_aktif'] == log[0]['waktu']
    klien.kini = datetime.fromisoformat(f'{HARI_INI}T09:30:00+07:00')
    for _ in range(3):
        assert get(klien, f'/publik/monitoring-ujian/{TOKEN_MON}', params={'sesi': SESI, 'segarkan': 1}).status_code == 200
    assert len(log) == 1 and log[0]['jumlah_segarkan'] == 3 and log[0]['terakhir_aktif'] == f'{HARI_INI}T09:30:00+07:00'
    # pembukaan baru (sesi lain) = entri baru
    get(klien, f'/publik/monitoring-ujian/{TOKEN_MON}', params={'sesi': 'sesi-lain-123'})
    assert len(log) == 2 and log[1]['sesi'] == 'sesi-lain-123'


def test_audit_sesi_tidak_sah_atau_kosong(klien):
    get(klien, f'/publik/monitoring-ujian/{TOKEN_MON}', params={'sesi': 'ada spasi!'})
    assert klien.db.ujian_akses_log.docs[0]['sesi'] is None
    assert get(klien, f'/publik/monitoring-ujian/{TOKEN_MON}', params={'sesi': 'x' * 41}).status_code == 422
    get(klien, f'/publik/monitoring-ujian/{TOKEN_MON}', params={'segarkan': 1})  # tanpa sesi: tidak dicatat
    get(klien, f'/publik/monitoring-ujian/{TOKEN_MON}', params={'segarkan': 1, 'sesi': 'belum-pernah-dibuka'})
    assert len(klien.db.ujian_akses_log.docs) == 1 and klien.db.ujian_akses_log.docs[0]['jumlah_segarkan'] == 0


def test_audit_ditolak_tetap_dicatat_dengan_sesi(klien):
    klien.db.ujian_tautan_publik.docs[0]['aktif'] = False
    get(klien, f'/publik/monitoring-ujian/{TOKEN_MON}', params={'sesi': SESI})
    get(klien, f'/publik/monitoring-ujian/{TOKEN_MON}', params={'sesi': SESI, 'segarkan': 1})  # pemeriksaan ulang otomatis: tidak menambah
    log = klien.db.ujian_akses_log.docs
    assert [(x['hasil'], x['sesi']) for x in log] == [('nonaktif', SESI)]


def test_daftar_mapel_baku_per_jenjang(klien):
    import asyncio

    import ujian_info as ui
    assert klien(None, None, 'GET', '/ujian/mapel-baku').status_code == 401  # wajib login
    r = klien('guru1', 'guru', 'GET', '/ujian/mapel-baku')
    assert r.status_code == 200
    j = r.json()['jenjang']
    assert set(j) == {'7', '8', '9'} and [m['kode'] for m in j['8']] == list(ui.KODE_MAPEL) and j['7'][0] == {'kode': 'bahasa_indonesia', 'nama': 'Bahasa Indonesia'}
    # master: mapel dinonaktifkan admin hilang dari daftar & dari status monitoring jenjang itu
    asyncio.run(ui.seed_mapel_baku(klien.db))
    next(d for d in klien.db.ujian_mapel_baku.docs if d['jenjang'] == 8 and d['kode'] == 'ipa')['aktif'] = False
    assert 'ipa' not in [m['kode'] for m in klien('guru1', 'guru', 'GET', '/ujian/mapel-baku').json()['jenjang']['8']]
    d = get(klien, f'/publik/monitoring-ujian/{TOKEN_MON}').json()
    assert len(d['mapel']['8']) == 14 and len(d['mapel']['7']) == 15
    assert [(b['jenjang'], b['mapel']) for b in d['berkas']] == [(7, 'matematika')]  # berkas IPA kelas 8 tidak dihitung
    info = get(klien, f'/publik/info-ujian/{TOKEN_INFO}').json()
    assert info['mapel'] == d['mapel']


def test_saringan_jenjang_mapel(klien):
    url = f'/publik/monitoring-ujian/{TOKEN_MON}'
    semua = get(klien, url).json()
    assert semua['saringan'] == {'jenjang': None, 'mapel': None} and set(semua['ringkasan']) == {'7', '8', '9'}
    assert semua['ringkasan']['8'] == {'total': 15, 'kisi_kisi': 1, 'kartu_soal': 1, 'lengkap': 1}
    d = get(klien, url, params={'jenjang': 8}).json()
    assert {b['jenjang'] for b in d['berkas']} == {8} and len(d['berkas']) == 2 and list(d['ringkasan']) == ['8']
    d = get(klien, url, params={'jenjang': 8, 'mapel': 'ipa'}).json()
    assert [b['jenis'] for b in d['berkas']] == ['kisi_kisi', 'kartu_soal'] and d['ringkasan']['8'] == {'total': 1, 'kisi_kisi': 1, 'kartu_soal': 1, 'lengkap': 1}
    assert d['saringan'] == {'jenjang': 8, 'mapel': 'ipa'}
    d = get(klien, url, params={'mapel': 'matematika'}).json()
    assert [(b['jenjang'], b['mapel']) for b in d['berkas']] == [(7, 'matematika')]
    assert d['ringkasan']['7']['kisi_kisi'] == 1 and d['ringkasan']['9']['total'] == 1
    assert get(klien, url, params={'jenjang': 9, 'mapel': 'ipa'}).json()['berkas'] == []
    for salah, pesan in (({'jenjang': 10}, 'Jenjang harus'), ({'mapel': 'kimia'}, 'tidak dikenal'), ({'jenjang': 'x'}, None)):
        r = get(klien, url, params=salah)
        assert r.status_code == 422 and (pesan is None or pesan in r.json()['detail'])


def test_buat_ujian_langsung_menyiapkan_tiga_tautan(klien):
    r = klien('admin', 'admin', 'POST', '/ujian', json={'jenis': 'UTS', 'nama': 'ASTS Ganjil 2026/2027', 'mulai': '2026-10-05', 'selesai': '2026-10-10'})
    assert r.status_code == 200, r.text
    uid = r.json()['id']
    t = [x for x in klien.db.ujian_tautan_publik.docs if x['ujian_id'] == uid]
    assert sorted(x['jenis'] for x in t) == ['info', 'monitoring', 'portal'] and not any(x['aktif'] for x in t)
    assert [x['aksi'] for x in klien.db.ujian_tautan_riwayat.docs if x['ujian_id'] == uid] == ['buat', 'buat', 'buat']


def test_validasi_tautan_publik(klien):
    r = get(klien, f'/publik/tautan/{TOKEN_MON}')
    assert r.status_code == 200 and r.headers['cache-control'] == 'no-store'
    d = r.json()
    assert d['jenis'] == 'monitoring' and d['berlaku'] is True and d['alasan'] == 'ok' and d['jalur'] == f'/publik/monitoring-ujian/{TOKEN_MON}'
    assert 'ujian' not in d and 'berkas' not in d and 'uas' not in r.text
    assert not klien.db.ujian_akses_log.docs  # berhasil: dicatat oleh halaman tujuan, bukan di sini
    assert get(klien, f'/publik/tautan/{TOKEN_INFO}').json()['jalur'].startswith('/publik/info-ujian/')
    klien.db.ujian_tautan_publik.docs[0]['aktif'] = False
    d = get(klien, f'/publik/tautan/{TOKEN_MON}').json()
    assert (d['berlaku'], d['alasan'], d['jenis']) == (False, 'nonaktif', 'monitoring') and d['madrasah']
    assert [x['hasil'] for x in klien.db.ujian_akses_log.docs] == ['nonaktif']
    r = get(klien, '/publik/tautan/TokenTidakAda_xxxxxxxxxxxxxxxxxxx')
    assert r.status_code == 404 and klien.db.ujian_akses_log.docs[-1]['hasil'] == 'tidak_dikenal'
