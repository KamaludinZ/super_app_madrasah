"""Pilihan sesi pada tautan publik daftar hadir & berita acara: sesi aktif tetap otomatis, sesi lain hari ini & hari
sebelumnya yang belum lengkap boleh dipilih, sesi lengkap & hari berikutnya ditolak."""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from test_ujian_publik_alur import _kirim, klien as klien_dasar, png_ttd  # noqa: E402,F401
from ujian_dasar import HARI_INI  # noqa: E402
from ujian_sesi_publik import status_pilihan  # noqa: E402

KEMARIN, BESOK = '2026-12-01', '2026-12-03'


@pytest.fixture
def klien(klien_dasar):  # noqa: F811
    k = klien_dasar
    r = k('admin', 'admin', 'PUT', '/ujian/uas/formulir/jadwal', json={'sesi': [
        {'tanggal': KEMARIN, 'sesi_ke': 1, 'jam_mulai': '07:30', 'jam_selesai': '09:30', 'mapel': {'7': 'PAI'}},
        {'tanggal': HARI_INI, 'sesi_ke': 1, 'jam_mulai': '07:30', 'jam_selesai': '09:30', 'mapel': {'7': 'Matematika', '8': 'IPA'}},
        {'tanggal': HARI_INI, 'sesi_ke': 2, 'jam_mulai': '10:00', 'jam_selesai': '11:30', 'mapel': {'7': 'IPS'}},
        {'tanggal': BESOK, 'sesi_ke': 1, 'jam_mulai': '07:30', 'jam_selesai': '09:30', 'mapel': {'7': 'IPA'}}]})
    assert r.status_code == 200, r.text
    k.sesi = {(s['tanggal'], s['sesi_ke']): s['id'] for s in k.db.jadwal_ujian.docs}
    k.pr = {p['siswa_id']: p['id'] for p in k.db.peserta_ruang.docs}
    return k


def _pilihan(klien, untuk='daftar_hadir'):
    r = klien(None, None, 'GET', f'/publik/ujian/{klien.token}/sesi', params={'untuk': untuk})
    assert r.status_code == 200, r.text
    return r.json()


def _ringkas(d):
    return [(i['tanggal'], i['sesi_ke'], i['status'], i['boleh_dipilih'], i['terisi'], i['total']) for i in d['items']]


def test_status_pilihan_murni():
    s = {'id': 'a', 'tanggal': HARI_INI}
    assert status_pilihan(s, 'a', HARI_INI, True) == 'aktif'  # sesi aktif tetap boleh walau lengkap
    assert status_pilihan({'id': 'b', 'tanggal': BESOK}, 'a', HARI_INI, False) == 'belum_waktunya'
    assert status_pilihan({'id': 'c', 'tanggal': KEMARIN}, 'a', HARI_INI, False) == 'terbuka'
    assert status_pilihan({'id': 'c', 'tanggal': KEMARIN}, 'a', HARI_INI, True) == 'lengkap'


def test_daftar_pilihan_sesi_daftar_hadir(klien):
    d = _pilihan(klien)
    # Hari ini dulu (urut sesi), lalu kemarin; besok tidak dikirim — hanya tanggalnya.
    assert _ringkas(d) == [(HARI_INI, 1, 'aktif', True, 0, 4), (HARI_INI, 2, 'terbuka', True, 0, 4), (KEMARIN, 1, 'terbuka', True, 0, 4)]
    assert d['aktif_id'] == klien.sesi[(HARI_INI, 1)] and d['berikutnya'] == BESOK and d['tanggal'] == HARI_INI
    assert set(d['items'][0]) >= {'id', 'tanggal', 'sesi_ke', 'jam_mulai', 'jam_selesai', 'mapel', 'status', 'boleh_dipilih', 'lengkap'}
    # Info publik tetap memilih sesi aktif otomatis seperti sebelumnya.
    assert klien(None, None, 'GET', f'/publik/ujian/{klien.token}').json()['sesi']['id'] == klien.sesi[(HARI_INI, 1)]
    assert klien(None, None, 'GET', f'/publik/ujian/{klien.token}/sesi', params={'untuk': 'x'}).status_code == 422
    assert klien(None, None, 'GET', '/publik/ujian/salah/sesi').status_code == 404


def test_isi_sesi_kemarin_sampai_lengkap_lalu_terkunci(klien):
    kemarin = klien.sesi[(KEMARIN, 1)]
    pr = klien.pr
    assert _kirim(klien, pr['s-k7a-1'], kemarin).status_code == 200  # sesi hari sebelumnya yang belum lengkap boleh
    assert _kirim(klien, pr['s-k7a-2'], kemarin).status_code == 200
    assert _kirim(klien, pr['s-k9a-1'], kemarin, ruang_id=klien.r2['id']).status_code == 200
    assert klien.db.daftar_hadir.docs[0]['tanggal'] == KEMARIN
    assert _ringkas(_pilihan(klien))[2] == (KEMARIN, 1, 'terbuka', True, 3, 4)
    # Peserta terakhir ditandai izin oleh panitia pada tanggal itu -> sesi kemarin lengkap & tidak dapat dipilih.
    klien.db.daftar_hadir_status.docs.append({'id': 't1', 'ujian_id': 'uas', 'peserta_id': pr['s-k8a-1'], 'tanggal': KEMARIN, 'status': 'izin'})
    assert _ringkas(_pilihan(klien))[2] == (KEMARIN, 1, 'lengkap', False, 4, 4)
    r = _kirim(klien, pr['s-k8a-1'], kemarin)
    assert r.status_code == 403 and 'sudah lengkap' in r.json()['detail']
    # Hari berikutnya tidak dapat dibuka sebelum harinya.
    r = _kirim(klien, pr['s-k7a-1'], klien.sesi[(BESOK, 1)])
    assert r.status_code == 403 and 'belum dibuka' in r.json()['detail']
    # Sesi lain hari ini tetap boleh seperti semula.
    assert _kirim(klien, pr['s-k7a-1'], klien.sesi[(HARI_INI, 2)]).status_code == 200


def test_sesi_hari_ini_lengkap_tidak_dapat_dipilih_kecuali_aktif(klien):
    pr = klien.pr
    for s in (klien.sesi[(HARI_INI, 1)], klien.sesi[(HARI_INI, 2)]):
        for sid, rid in (('s-k7a-1', None), ('s-k7a-2', None), ('s-k8a-1', None), ('s-k9a-1', klien.r2['id'])):
            assert _kirim(klien, pr[sid], s, ruang_id=rid).status_code == 200
    d = _ringkas(_pilihan(klien))
    assert d[0] == (HARI_INI, 1, 'aktif', True, 4, 4) and d[1] == (HARI_INI, 2, 'lengkap', False, 4, 4)


def test_pilihan_sesi_berita_acara_per_ruang(klien):
    db, pr = klien.db, klien.pr
    kemarin = klien.sesi[(KEMARIN, 1)]
    klien('admin', 'admin', 'POST', '/ujian/pengawas', json={'user_ids': ['guru1']})
    pg = db.guru_pengawas.docs[0]['id']
    assert _ringkas(_pilihan(klien, 'berita_acara'))[2] == (KEMARIN, 1, 'terbuka', True, 0, 2)
    for sid, rid in (('s-k7a-1', None), ('s-k7a-2', None), ('s-k8a-1', None), ('s-k9a-1', klien.r2['id'])):
        _kirim(klien, pr[sid], kemarin, ruang_id=rid)
    url = f'/publik/ujian/{klien.token}/berita-acara'
    isi = {'sesi_id': kemarin, 'ruang_id': klien.r1['id'], 'pengawas_id': pg, 'catatan': 'Susulan.', 'ttd_png': png_ttd()}
    r = klien(None, None, 'POST', url, json=isi)
    assert r.status_code == 200, r.text
    assert db.berita_acara.docs[0]['tanggal'] == KEMARIN and r.json()['sesi']['id'] == kemarin
    assert _ringkas(_pilihan(klien, 'berita_acara'))[2] == (KEMARIN, 1, 'terbuka', True, 1, 2)
    # Riwayat per sesi yang dipilih (bukan hanya hari ini).
    rw = klien(None, None, 'GET', f'{url}/riwayat', params={'sesi_id': kemarin}).json()
    assert rw['tanggal'] == KEMARIN and [(i['nama_ruang'], i['sesi_ke']) for i in rw['items']] == [('01', 1)]
    assert klien(None, None, 'GET', f'{url}/riwayat').json()['items'] == []  # bawaan: hari ini
    assert klien(None, None, 'POST', url, json={**isi, 'ruang_id': klien.r2['id']}).status_code == 200
    assert _ringkas(_pilihan(klien, 'berita_acara'))[2] == (KEMARIN, 1, 'lengkap', False, 2, 2)
    r = klien(None, None, 'POST', url, json={**isi, 'ruang_id': klien.r2['id']})
    assert r.status_code == 403 and 'sudah lengkap' in r.json()['detail']
    r = klien(None, None, 'POST', url, json={**isi, 'sesi_id': klien.sesi[(BESOK, 1)]})
    assert r.status_code == 403 and 'belum dibuka' in r.json()['detail']
