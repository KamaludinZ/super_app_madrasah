"""Tab Errors /admin/audit-logs: galat server tercatat otomatis (dengan kode & traceback), galat browser dapat
dilaporkan, dan log galat dapat diambil terpisah dari aktivitas biasa."""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pkg_log_galat  # noqa: E402
from ujian_dasar import buat_klien  # noqa: E402


@pytest.fixture
def klien(monkeypatch):
    import server
    if not any(getattr(r, 'path', '') == '/api/uji-galat-log' for r in server.app.router.routes):
        async def rusak():
            raise ValueError('contoh galat uji')
        server.app.add_api_route('/api/uji-galat-log', rusak, methods=['GET'])
    monkeypatch.setattr(pkg_log_galat, '_jejak_laporan', {})
    return buat_klien(monkeypatch)


def _galat(klien):
    return [d for d in klien.db.audit_logs.docs if d['action'] == 'error']


def test_galat_server_tercatat_dengan_kode_dan_traceback(klien):
    r = klien('guru1', 'guru', 'GET', '/uji-galat-log', headers={'CF-Connecting-IP': '203.0.113.7'})
    assert r.status_code == 500
    kode = r.json()['kode_galat']
    assert kode.startswith('G-') and kode in r.json()['detail']
    (g,) = _galat(klien)
    d = g['details']
    assert d['sumber'] == 'server' and d['kode'] == kode and d['error_type'] == 'ValueError'
    assert d['message'] == 'contoh galat uji' and d['path'] == '/api/uji-galat-log' and d['method'] == 'GET'
    assert 'contoh galat uji' in d['traceback'] and g['username'] == 'guru1' and g['ip_address'] == '203.0.113.7'


def test_laporan_galat_browser(klien):
    isi = {'jenis': 'jaringan', 'pesan': 'Network Error (ERR_NETWORK)', 'metode': 'post', 'path': '/api/students/import-combined?x=1',
           'status': None, 'halaman': '/admin/import', 'ukuran_unggahan': 9094, 'online': True}
    r = klien('admin', 'admin', 'POST', '/admin/error-logs/klien', json=isi)
    assert r.status_code == 200 and r.json()['dicatat'] is True
    (g,) = _galat(klien)
    d = g['details']
    assert d['sumber'] == 'browser' and d['error_type'] == 'Browser: Koneksi terputus' and d['method'] == 'POST'
    assert d['path'] == '/api/students/import-combined' and d['halaman'] == '/admin/import' and d['ukuran_unggahan'] == 9094
    assert klien(None, None, 'POST', '/admin/error-logs/klien', json=isi).status_code == 401
    assert klien('admin', 'admin', 'POST', '/admin/error-logs/klien', json={**isi, 'pesan': 'x' * 501}).status_code == 422


def test_laporan_browser_dibatasi(klien):
    isi = {'jenis': 'HTTP 502 dari proxy', 'status': 502, 'path': '/api/x'}
    hasil = [klien('guru1', 'guru', 'POST', '/admin/error-logs/klien', json=isi).json()['dicatat'] for _ in range(pkg_log_galat.BATAS_LAPORAN_KLIEN + 3)]
    assert hasil.count(True) == pkg_log_galat.BATAS_LAPORAN_KLIEN and hasil[-1] is False


def test_ambil_galat_terpisah_dari_audit(klien):
    db = klien.db
    db.audit_logs.docs += [{'id': f'a{i}', 'action': 'update', 'entity': 'user', 'timestamp': f'2026-11-28T01:{i:02d}:00'} for i in range(5)]
    db.audit_logs.docs.append({'id': 'e1', 'action': 'error', 'entity': 'system', 'timestamp': '2026-11-27T00:00:00', 'details': {}})
    r = klien('admin', 'admin', 'GET', '/admin/audit-logs', params={'action': 'error'})
    assert [x['id'] for x in r.json()] == ['e1']
    r = klien('admin', 'admin', 'GET', '/admin/audit-logs', params={'kecuali_action': 'error'})
    assert [x['id'] for x in r.json()] == ['a4', 'a3', 'a2', 'a1', 'a0']  # galat tidak ikut di Audit Trail
    assert klien('admin', 'admin', 'GET', '/admin/audit-logs', params={'limit': 5000}).status_code == 422
    assert klien('guru1', 'guru', 'GET', '/admin/audit-logs').status_code == 403
