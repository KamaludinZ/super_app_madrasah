"""Skema jejak audit PKG: field turunan (kategori, guru/periode, waktu_urut), entri harian, index, migrasi data lama."""

import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pkg_audit  # noqa: E402
from migrations import migrate_pkg_audit  # noqa: E402
from tests.pkg_palsu import Db, Koleksi  # noqa: E402

AKTOR = {'id': 'pen', 'full_name': 'Penilai Satu', 'active_role': 'guru'}


def test_entri_menyimpan_field_turunan():
    d = Db()
    asyncio.run(pkg_audit.catat_audit_pkg(d, 'penilaian_kirim', AKTOR,
                                          {'penilaian_id': 'n1', 'guru_id': 'g1', 'periode_id': 'p1', 'nilai_akhir': 40}))
    e = d['pkg_audit_log'].docs[0]
    assert e['kategori'] == 'penilaian' and e['guru_id'] == 'g1' and e['periode_id'] == 'p1' and e['penilaian_id'] == 'n1'
    assert e['waktu_urut'] == e['timestamp'] and e['metadata']['nilai_akhir'] == 40
    asyncio.run(pkg_audit.catat_audit_pkg(d, 'aksi_baru_tak_dikenal', AKTOR))
    assert d['pkg_audit_log'].docs[1]['kategori'] == 'akses' and d['pkg_audit_log'].docs[1]['guru_id'] is None


def test_entri_harian_memperbarui_waktu_urut():
    d = Db()
    for _ in range(2):
        asyncio.run(pkg_audit.catat_audit_pkg_harian(d, 'penilaian_draf', AKTOR, kunci='n1', metadata={'guru_id': 'g1'}))
    [e] = d['pkg_audit_log'].docs
    assert e['jumlah'] == 2 and e['kategori'] == 'penilaian' and e['waktu_urut'] == e['terakhir'] >= e['timestamp']


def test_index_audit():
    d = Db()
    assert asyncio.run(pkg_audit.ensure_pkg_audit_indexes(d)) == []
    nama = {kw['name'] for _, kw in d['pkg_audit_log'].index}
    assert {'kategori_waktu', 'aktor_waktu', 'guru_waktu', 'periode_waktu', 'waktu_urut', 'harian', 'id_unik'} <= nama


def test_migrasi_mengisi_entri_lama_dan_idempoten():
    d = Db({'pkg_audit_log': Koleksi([
        {'id': 'a1', 'aksi': 'cetak_template', 'metadata': {'periode_id': 'p1', 'guru_id': 'g2'}, 'timestamp': '2026-10-18T01:00:00+00:00'},
        {'id': 'a2', 'aksi': 'penilaian_draf', 'metadata': {'penilaian_id': 'n9'}, 'timestamp': '2026-10-18T01:00:00+00:00',
         'terakhir': '2026-10-18T03:00:00+00:00', 'jumlah': 4},
        {'id': 'a3', 'aksi': 'sk_buat', 'kategori': 'susunan', 'waktu_urut': '2026-10-17T00:00:00+00:00', 'metadata': {}},
    ])})
    assert asyncio.run(migrate_pkg_audit.migrate(d)) == {'diperiksa': 2, 'diisi': 2}
    a1, a2, a3 = d['pkg_audit_log'].docs
    assert (a1['kategori'], a1['periode_id'], a1['guru_id'], a1['waktu_urut']) == ('unduhan', 'p1', 'g2', a1['timestamp'])
    assert (a2['kategori'], a2['penilaian_id'], a2['waktu_urut']) == ('penilaian', 'n9', '2026-10-18T03:00:00+00:00')
    assert 'guru_id' not in a3
    assert asyncio.run(migrate_pkg_audit.migrate(d)) == {'diperiksa': 0, 'diisi': 0}


def test_beda_dan_sidik_instrumen():
    def ins(*sub):
        return {'kompetensi': [{'kode': '1', 'sub': [dict(s) for s in sub]}]}
    a = ins({'kode': '1.1', 'nama': 'A'}, {'kode': '1.2', 'nama': 'B'}, {'kode': '1.10', 'nama': 'J'})
    b = ins({'kode': '1.1', 'nama': 'A'}, {'kode': '1.2', 'nama': 'B2'}, {'kode': '1.3', 'nama': 'C'}, {'kode': '1.11', 'nama': 'K'})
    assert pkg_audit.beda_instrumen(a, b) == {'sub_ditambah': ['1.3', '1.11'], 'sub_dihapus': ['1.10'], 'sub_diubah': ['1.2']}
    assert pkg_audit.checksum_struktur(a) == pkg_audit.checksum_struktur(ins(*a['kompetensi'][0]['sub']))
    assert pkg_audit.checksum_struktur(a) != pkg_audit.checksum_struktur(b) and pkg_audit.checksum_struktur(None) is None
    assert pkg_audit.acuan_versi(None) is None
