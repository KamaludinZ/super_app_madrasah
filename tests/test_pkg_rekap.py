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



def _db_agregasi():
    db = _db()
    db['pkg_sk'].docs[0].update({'dinilai_ids': ['g-n1', 'g-n2', 'g-baru'],
                                 'snapshot_anggota': {'pen': {'nama': 'Penilai Satu'}, 'g-baru': {'nama': 'Zaki Baru', 'nip': '9'},
                                                      'g-n2': {'nama': 'Guru n2'}}})
    db['pkg_penugasan'] = Koleksi([{'periode_id': 'p1', 'penilai_id': 'pen', 'guru_dinilai_ids': ['g-n1', 'g-n2', 'g-baru']}])
    asyncio.run(pkg_rekap.bangun_ulang_rekap(db))
    # Data historis: rekap guru yang sudah tidak tercantum di SK tetap tampil.
    db['pkg_rekap'].docs.append({'id': 'lama', 'periode_id': 'p1', 'guru_id': 'g-lama', 'nama': 'Agus Lama', 'penilai_nama': 'X',
                                 'nilai_akhir': 18, 'nilai_maks': 20, 'capaian_persen': 90.0, 'level_capaian': 'Level 4',
                                 'predikat': 'Terpenuhi pada Jenjang Jabatan Guru Ahli Madya', 'per_kompetensi': {'1': 9, '2': 9}})
    return db


def test_agregasi_rekap():
    db = _db_agregasi()
    r = asyncio.run(pkg_rekap.agregasi_rekap(db, {'id': 'p1'}, db['pkg_sk'].docs[0]))
    assert [(b['nama'], b['status']) for b in r['guru']] == [
        ('Agus Lama', 'terkunci'), ('Guru n1', 'terkunci'), ('Guru n2', 'draf'), ('Zaki Baru', 'belum')]
    assert r['ringkasan'] == {'total': 4, 'terkunci': 2, 'draf': 1, 'belum': 1, 'rata_capaian': 72.5}
    n1 = r['guru'][1]
    assert (n1['nilai_akhir'], n1['capaian_persen'], n1['penilai_nama'], n1['per_kompetensi']) == (11, 55.0, 'Penilai Satu', {'1': 5, '2': 6})
    assert r['guru'][3]['penilai_nama'] == 'Penilai Satu' and r['guru'][3]['nilai_akhir'] is None

    st = r['statistik']
    assert (st['jumlah'], st['rata'], st['median']) == (2, 72.5, 72.5)
    assert st['tertinggi']['nama'] == 'Agus Lama' and st['terendah']['nama'] == 'Guru n1'
    assert [x['jumlah'] for x in st['sebaran_predikat']] == [1, 0, 1, 0]
    assert [x['jumlah'] for x in st['sebaran_level']] == [0, 1, 0, 1, 0]


def test_agregasi_cakupan():
    db = _db_agregasi()
    sk = db['pkg_sk'].docs[0]
    satu = asyncio.run(pkg_rekap.agregasi_rekap(db, {'id': 'p1'}, sk, saring_guru={'g-n2', 'g-baru'}))
    assert [b['guru_id'] for b in satu['guru']] == ['g-n2', 'g-baru'] and satu['statistik']['jumlah'] == 0
    pribadi = asyncio.run(pkg_rekap.agregasi_rekap(db, {'id': 'p1'}, sk, saring_guru={'g-n2'}, hanya_terkunci=True))
    assert pribadi['guru'] == [] and pribadi['ringkasan']['total'] == 0
    tanpa_sk = asyncio.run(pkg_rekap.agregasi_rekap(db, {'id': 'p1'}, None))
    assert {b['guru_id'] for b in tanpa_sk['guru']} == {'g-n1', 'g-lama'}


def test_statistik_lengkap():
    baris = [{'status': 'terkunci', 'capaian_persen': c, 'predikat': None, 'level_capaian': None, 'per_kompetensi': {'1': p1, '2': p2}}
             for c, p1, p2 in ((45.0, 4, 5), (76.67, 10, 13), (90.0, 12, 15), (100.0, 15, 15))] + [{'status': 'draf'}]
    st = pkg_rekap.statistik_lengkap(baris)
    assert [x['jumlah'] for x in st['sebaran_capaian']] == [1, 0, 0, 1, 0, 2]
    assert st['sebaran_capaian'][-1]['rentang'] == '90–100%' and st['sebaran_capaian'][0]['rentang'] == '0–50%'
    assert st['rata_per_kompetensi'] == [{'kode': '1', 'rata': 10.25}, {'kode': '2', 'rata': 12.0}]
    assert st['jumlah'] == 4 and st['median'] == 83.34
    kosong = pkg_rekap.statistik_lengkap([])
    assert kosong['rata'] is None and kosong['rata_per_kompetensi'] == [] and sum(x['jumlah'] for x in kosong['sebaran_capaian']) == 0
