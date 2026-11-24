"""Jejak audit akses & unduhan ujian: HANYA BACA — tidak ada rute untuk mengubah/menghapus log, penulisan hanya lewat
fungsi pencatat, respons tidak di-cache, dan token tidak pernah dikirim."""
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, os.path.dirname(__file__))

from test_ujian_tautan_publik_alur import klien  # noqa: E402,F401 — fixture dipakai ulang

BACKEND = Path(__file__).resolve().parents[1] / 'backend'
KOLEKSI_LOG = ('KOLEKSI_AKSES_LOG', 'KOLEKSI_UNDUH_LOG', 'KOLEKSI_TAUTAN_RIWAYAT', "'ujian_akses_log'", "'ujian_unduh_log'", "'ujian_tautan_riwayat'")


def test_rute_audit_hanya_get():
    import server
    paths = server.app.openapi()['paths']
    audit = {p: set(m) for p, m in paths.items() if p.endswith(('/tautan-publik/audit', '/berkas/unduhan'))}
    assert audit == {'/api/ujian/{ujian_id}/tautan-publik/audit': {'get'}, '/api/ujian/{ujian_id}/berkas/unduhan': {'get'}}
    # tidak ada rute lain yang menyebut log audit ujian
    assert not [p for p in paths if re.search(r'akses-log|unduh-log|tautan-riwayat|audit-log', p) and '/ujian' in p]


def test_penulisan_log_hanya_lewat_pencatat():
    """Di luar ujian_info.py (fungsi catat_*) dan migrasi (index), tidak ada kode yang menulis ke koleksi log audit ujian;
    di mana pun tidak ada operasi hapus/ganti massal pada koleksi itu."""
    pelanggaran = []
    for f in list(BACKEND.glob('*.py')) + list((BACKEND / 'routers').glob('*.py')) + list((BACKEND / 'migrations').glob('*.py')):
        teks = f.read_text(encoding='utf-8')
        for k in KOLEKSI_LOG:
            for m in re.finditer(re.escape(f'db[{k}]') + r'\.(\w+)', teks):
                op = m.group(1)
                if op in ('delete_one', 'delete_many', 'replace_one', 'update_many', 'drop', 'find_one_and_delete', 'find_one_and_replace'):
                    pelanggaran.append(f'{f.name}: {op} pada {k}')
                elif op in ('insert_one', 'insert_many', 'update_one') and f.name != 'ujian_info.py':
                    pelanggaran.append(f'{f.name}: {op} pada {k}')
    assert not pelanggaran, pelanggaran


def test_respons_audit_tidak_dicache_dan_tanpa_token(klien):
    d = klien('admin', 'admin', 'GET', '/ujian/uas/tautan-publik').json()['tautan']
    klien('admin', 'admin', 'PUT', '/ujian/uas/tautan-publik/info', json={'aktif': True})
    klien(None, None, 'GET', f"/publik/info-ujian/{d['info']['token']}")
    for url in ('/ujian/uas/tautan-publik/audit', '/ujian/uas/berkas/unduhan'):
        r = klien('admin', 'admin', 'GET', url)
        assert r.status_code == 200 and r.headers['cache-control'] == 'no-store', url
        assert d['info']['token'] not in r.text and d['monitoring']['token'] not in r.text
    # metode ubah selalu ditolak dan log tidak berubah. (POST .../berkas/unduhan jatuh ke rute unggah /berkas/{jenis}
    # dan PUT .../tautan-publik/audit ke rute pengaturan /tautan-publik/{jenis}; keduanya ditolak — bukan jalur ke log.)
    sebelum = (len(klien.db.ujian_akses_log.docs), len(klien.db.ujian_unduh_log.docs), len(klien.db.ujian_tautan_riwayat.docs))
    for metode in ('POST', 'PUT', 'PATCH', 'DELETE'):
        assert klien('admin', 'admin', metode, '/ujian/uas/tautan-publik/audit').status_code in (404, 405, 422)
        assert klien('admin', 'admin', metode, '/ujian/uas/berkas/unduhan').status_code in (404, 405, 422)
    assert (len(klien.db.ujian_akses_log.docs), len(klien.db.ujian_unduh_log.docs), len(klien.db.ujian_tautan_riwayat.docs)) == sebelum
