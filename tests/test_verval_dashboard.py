"""Ringkasan verval untuk dashboard admin: jumlah per status per kelompok (siswa / GTK), ajuan baru 24 jam, dan ajuan
menunggu terbaru."""
import os
import sys
from datetime import datetime, timedelta

import pytest

sys.path.insert(0, os.path.dirname(__file__))

from ujian_dasar import buat_klien, tambah_kelas_siswa  # noqa: E402


def _ajuan(i, uid, tipe, status, jam_lalu, jenis='profile_update'):
    return {'id': f'v{i}', 'user_id': uid, 'user_type': tipe, 'request_type': jenis, 'status': status, 'submitted_by': uid,
            'created_at': (datetime.utcnow() - timedelta(hours=jam_lalu)).isoformat()}


@pytest.fixture
def klien(monkeypatch):
    k = buat_klien(monkeypatch)
    tambah_kelas_siswa(k.db, per_kelas=2)
    k.db.verval_requests.docs += [
        _ajuan(1, 's-k7a-1', 'siswa', 'pending', 2),
        _ajuan(2, 's-k7a-2', 'siswa', 'pending', 72),
        _ajuan(3, 's-k8a-1', 'siswa', 'approved', 5),
        _ajuan(4, 's-k8a-2', 'siswa', 'rejected', 5),
        _ajuan(5, 'guru1', 'guru', 'pending', 30, 'prestasi_create'),
        _ajuan(6, 'tu1', 'tenaga_kependidikan', 'approved', 1),
    ]
    return k


def test_rincian_verval_untuk_dashboard_admin(klien):
    r = klien('admin', 'admin', 'GET', '/verval-requests/stats/summary')
    assert r.status_code == 200, r.text
    d = r.json()
    assert d['siswa_pending'] == 2 and d['gtk_pending'] == 1  # kunci lama tetap ada
    s, g = d['rincian']['siswa'], d['rincian']['gtk']
    assert (s['pending'], s['approved'], s['rejected'], s['baru_24_jam']) == (2, 1, 1, 1)
    assert s['terbaru']['nama'] == 'Siswa 7A 1' and s['terbaru']['request_type'] == 'profile_update'
    assert (g['pending'], g['approved'], g['rejected'], g['baru_24_jam']) == (1, 1, 0, 0)
    assert g['terbaru']['nama'] == 'Bu Siti' and g['terbaru']['request_type'] == 'prestasi_create'


def test_rincian_tanpa_ajuan_menunggu(klien):
    for doc in klien.db.verval_requests.docs:
        doc['status'] = 'approved'
    s = klien('admin', 'admin', 'GET', '/verval-requests/stats/summary').json()['rincian']['siswa']
    assert s['pending'] == 0 and s['baru_24_jam'] == 0 and s['terbaru'] is None


def test_ringkasan_hanya_admin_dan_wali(klien):
    assert klien('guru2', 'guru', 'GET', '/verval-requests/stats/summary').status_code == 403
