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


# ---- Log klik "Mengerjakan" portal: agregasi dari log, larangan hapus ----
OPERASI_TERLARANG = ('delete_one', 'delete_many', 'replace_one', 'update_many', 'drop', 'find_one_and_delete',
                     'find_one_and_replace', 'find_one_and_update', 'bulk_write', 'rename')


def test_log_tidak_dihapus_lewat_alias_atau_atribut():
    """Penjaga tambahan: koleksi log audit juga tidak boleh dihapus/diubah massal lewat alias (`log = db[KOLEKSI_AKSES_LOG]`)
    atau akses atribut (`db.ujian_akses_log`), dan tidak ada indeks TTL yang menghapus log klik diam-diam."""
    pelanggaran = []
    nama_koleksi = ('ujian_akses_log', 'ujian_unduh_log', 'ujian_tautan_riwayat')
    for f in list(BACKEND.glob('*.py')) + list((BACKEND / 'routers').glob('*.py')) + list((BACKEND / 'migrations').glob('*.py')):
        teks = f.read_text(encoding='utf-8')
        alias = set(re.findall(r'(\w+)\s*=\s*db\[(?:' + '|'.join(re.escape(k) for k in KOLEKSI_LOG) + r')\]', teks))
        for a in alias:
            for m in re.finditer(rf'\b{re.escape(a)}\.(\w+)\(', teks):
                if m.group(1) in OPERASI_TERLARANG or (m.group(1) in ('insert_one', 'insert_many', 'update_one') and f.name != 'ujian_info.py'):
                    pelanggaran.append(f'{f.name}: {a}.{m.group(1)}')
        for k in nama_koleksi:
            for m in re.finditer(rf'db\.{k}\.(\w+)\(', teks):
                if m.group(1) in OPERASI_TERLARANG or m.group(1) in ('insert_one', 'insert_many', 'update_one'):
                    pelanggaran.append(f'{f.name}: db.{k}.{m.group(1)}')
        if 'expireAfterSeconds' in teks and any(k in teks for k in ('KOLEKSI_AKSES_LOG', 'ujian_akses_log')):
            pelanggaran.append(f'{f.name}: indeks TTL di dekat log akses')
    assert not pelanggaran, pelanggaran


def test_rute_portal_dan_link_soal_tanpa_hapus():
    import server
    paths = server.app.openapi()['paths']
    rute = {p: set(m) for p, m in paths.items() if '/link-soal' in p or '/portal-ujian' in p}
    assert rute == {
        '/api/ujian/{ujian_id}/link-soal': {'get'},
        '/api/ujian/{ujian_id}/link-soal/intensitas': {'get'},
        '/api/ujian/{ujian_id}/link-soal/bangun-ulang-klik': {'post'},
        '/api/ujian/{ujian_id}/link-soal/{jenjang}/{mapel}': {'put'},
        '/api/ujian/{ujian_id}/link-soal/{link_soal_id}/klik': {'get'},
        '/api/publik/portal-ujian/{token}': {'get'},
        '/api/publik/portal-ujian/{token}/kerjakan/{soal_id}': {'get'},
    }


def test_intensitas_dan_rincian_dari_log_bukan_cache(klien):
    """Cache jumlah_klik pada dokumen link soal tidak pernah menjadi sumber intensitas/rincian: tanpa log, angkanya 0
    walau cache berisi angka; bangun ulang menyamakan cache dengan log tanpa mengubah log."""
    db = klien.db
    db.ujian.docs.append({'id': 'uas2', 'jenis': 'UAS', 'nama': 'UAS 2', 'semester_id': 'sem-kini', 'mulai': '2026-12-01', 'selesai': '2026-12-06'})
    db.ujian_link_soal.docs.append({'id': 'lx', 'ujian_id': 'uas2', 'jenjang': 7, 'mapel': 'ipa', 'url': 'https://cbt.id/x', 'aktif': True,
                                    'mulai_at': '2026-12-02T07:30:00+07:00', 'selesai_at': '2026-12-02T09:00:00+07:00',
                                    'jumlah_klik': 999, 'klik_terakhir_at': '2026-12-02T08:00:00+07:00', 'diperbarui_pada': 'v1'})
    d = klien('admin', 'admin', 'GET', '/ujian/uas2/link-soal/intensitas').json()
    x = next(i for i in d['intensitas'] if i['link_soal_id'] == 'lx')
    assert (x['jumlah_klik'], x['klik_terakhir_at'], x['harian'], d['ringkasan']['total_klik']) == (0, None, [], 0)
    assert klien('admin', 'admin', 'GET', '/ujian/uas2/link-soal/lx/klik').json()['total'] == 0
    assert klien('admin', 'admin', 'POST', '/ujian/uas2/link-soal/bangun-ulang-klik').json()['selisih'][0]['sesudah'] == 0
    assert db.ujian_link_soal.docs[-1]['jumlah_klik'] == 0 and db.ujian_akses_log.docs == []
