"""Rekap PKG: materialisasi hasil akhir lembar terkunci, bangun ulang dari lembar, dan migrasi."""

import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pkg_rekap  # noqa: E402
from tests.pkg_palsu import Db, Koleksi  # noqa: E402

INSTRUMEN = {'id': 'i1', 'versi_template': '2026', 'revisi': 2, 'kompetensi': [
    {'kode': str(k), 'sub': [{'kode': f'{k}.{s}', 'indikator': [{'level': i} for i in range(1, 6)]} for s in (1, 2)]}
    for k in (1, 2)]}


def _lembar(lid, status='terkunci', isian=None, **kw):
    return {'id': lid, 'status': status, 'periode_id': 'p1', 'sk_id': 's1', 'guru_dinilai_id': f'g-{lid}', 'penilai_id': 'pen',
            'instrumen_id': 'i1', 'snapshot_guru': {'nama': f'Guru {lid}', 'nip': '1', 'mapel': 'IPA'},
            'isian': isian if isian is not None else {'1.1': {'centang': [1, 2, 3]}, '1.2': {'centang': [1, 2]},
                                                      '2.1': {'centang': [1, 2, 3, 4, 5]}, '2.2': {'centang': [1]}},
            'catatan_umum': 'baik', 'terkunci_pada': '2026-10-18T00:00:00Z', **kw}


def _db():
    return Db({
        'pkg_instrumen': Koleksi([INSTRUMEN]),
        'pkg_sk': Koleksi([{'id': 's1', 'snapshot_anggota': {'pen': {'nama': 'Penilai Satu'}}}]),
        'pkg_penilaian': Koleksi([_lembar('n1'), _lembar('n2', status='draf'), _lembar('n3', instrumen_id='hilang')]),
    })


def test_baris_rekap():
    db = _db()
    b = asyncio.run(pkg_rekap.baris_rekap(db, db['pkg_penilaian'].docs[0]))
    assert (b['id'], b['guru_id'], b['nama'], b['penilai_nama']) == ('n1', 'g-n1', 'Guru n1', 'Penilai Satu')
    assert (b['nilai_akhir'], b['nilai_maks'], b['capaian_persen'], b['level_capaian']) == (11, 20, 55.0, 'Level 2')
    assert b['predikat'].endswith('Ahli Pertama') and b['per_kompetensi'] == {'1': 5, '2': 6}
    assert (b['versi_template'], b['revisi'], b['catatan_umum']) == ('2026', 2, 'baik')
    assert asyncio.run(pkg_rekap.baris_rekap(db, db['pkg_penilaian'].docs[1])) is None  # draf


def test_bangun_ulang_rekap_dan_migrasi():
    db = _db()
    db['pkg_rekap'] = Koleksi([{'id': 'yatim', 'periode_id': 'p1'}])
    hasil = asyncio.run(pkg_rekap.bangun_ulang_rekap(db))
    assert hasil == {'diproses': 2, 'ditulis': 1, 'dilewati': 1, 'dihapus': 1}
    assert [d['id'] for d in db['pkg_rekap'].docs] == ['n1']
    assert asyncio.run(pkg_rekap.bangun_ulang_rekap(db))['ditulis'] == 1 and len(db['pkg_rekap'].docs) == 1  # idempoten

    import migrasi_otomatis
    assert ('2026-10-19_pkg_rekap', migrasi_otomatis._pkg_rekap) in migrasi_otomatis.MIGRASI

