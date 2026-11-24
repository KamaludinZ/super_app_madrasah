"""Kartu soal RAHASIA: tidak ada jalur publik untuk isinya; percobaan lewat tautan publik ditolak (404) dan dicatat."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, os.path.dirname(__file__))

import ujian_info as ui  # noqa: E402
from test_ujian_info_publik_alur import TOKEN, _tulis_berkas, get, klien  # noqa: E402,F401 — fixture klien dipakai ulang

RUTE_PUBLIK_UJIAN = {
    '/api/publik/info-ujian/{token}',
    '/api/publik/info-ujian/{token}/panduan-cbt',
    '/api/publik/info-ujian/{token}/kisi-kisi/{berkas_id}',
    '/api/publik/monitoring-ujian/{token}',
    '/api/publik/tautan/{token}',
}


def test_penjaga_terpusat():
    assert ui.boleh_unduh_publik({'jenis': 'kisi_kisi', 'status': 'terkirim'})
    for b in (None, {}, {'jenis': 'kartu_soal', 'status': 'terkirim'}, {'jenis': 'kisi_kisi', 'status': 'belum'}, {'jenis': 'lain', 'status': 'terkirim'}):
        assert not ui.boleh_unduh_publik(b)
    assert 'kartu_soal_ditolak' in ui.HASIL_AKSES


def test_inventaris_rute_publik_dan_tanpa_static_unggahan():
    """Rute publik modul ini harus persis allowlist — rute publik baru wajib ditinjau (dan ditambahkan di sini) dulu."""
    import server
    paths = set(server.app.openapi()['paths'])
    assert {p for p in paths if p.startswith(('/api/publik/info-ujian', '/api/publik/monitoring-ujian', '/api/publik/tautan'))} == RUTE_PUBLIK_UJIAN
    assert not [p for p in paths if p.startswith(('/api/publik', '/api/public')) and ('kartu' in p or 'berkas-ujian' in p)]
    assert not [r for r in server.app.routes if type(r).__name__ == 'Mount' and type(getattr(r, 'app', None)).__name__ == 'StaticFiles']


def test_percobaan_unduh_kartu_soal_ditolak_dan_dicatat(klien, tmp_path):
    _tulis_berkas(tmp_path, 'rahasia-ks7-mtk.pdf', b'ISI KARTU SOAL RAHASIA')
    r = get(klien, f'/publik/info-ujian/{TOKEN}/kisi-kisi/ks7-mtk')
    tidak_ada = get(klien, f'/publik/info-ujian/{TOKEN}/kisi-kisi/berkas-tidak-ada')
    assert r.status_code == tidak_ada.status_code == 404 and r.json() == tidak_ada.json()  # tidak membocorkan keberadaan
    assert b'RAHASIA' not in r.content
    log = [x for x in klien.db.ujian_akses_log.docs if x['hasil'] == 'kartu_soal_ditolak']
    assert len(log) == 1 and log[0]['tautan_id'] == 't-info' and log[0]['perangkat'] == 'UjiBrowser/1.0'
    assert not klien.db.ujian_unduh_log.docs
    assert next(b for b in klien.db.ujian_berkas.docs if b['id'] == 'ks7-mtk')['jumlah_unduh'] == 3
