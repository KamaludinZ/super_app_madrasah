"""Ujian Madrasah — agregasi status pengumpulan kisi-kisi & kartu soal per jenjang per mapel baku."""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, os.path.dirname(__file__))

import ujian_info as ui  # noqa: E402
import ujian_pengumpulan as up  # noqa: E402
from pkg_palsu import Db  # noqa: E402

MAPEL = [{'kode': k, 'nama': n, 'urutan': i + 1} for i, (k, n) in enumerate(ui.MAPEL_UJIAN_BAKU)]


def b(jenis, jenjang, mapel, waktu='2026-11-20T08:00:00+07:00', pj='Bu Siti', **kw):
    return {'id': f'{jenis}-{jenjang}-{mapel}', 'ujian_id': 'u1', 'jenis': jenis, 'jenjang': jenjang, 'mapel': mapel, 'status': 'terkirim',
            'guru_pj_id': 'g1', 'guru_pj_nama': pj, 'updated_at': waktu, 'nama_berkas': 'rahasia.pdf', 'ukuran_byte': 10, **kw}


def test_baris_dan_ringkasan_jenjang():
    docs = [b('kisi_kisi', 8, 'ipa', pj='A'), b('kartu_soal', 8, 'ipa', '2026-11-21T02:00:00Z', pj='B'),
            b('kisi_kisi', 8, 'ips'), b('kartu_soal', 8, 'pkn', status='belum'), b('kisi_kisi', 7, 'ipa'),
            b('kisi_kisi', 8, 'ipa', '2026-11-19T08:00:00+07:00', pj='Lama')]  # duplikat lama: diabaikan
    baris = up.baris_jenjang(docs, 8, MAPEL)
    assert [x['kode'] for x in baris] == list(ui.KODE_MAPEL) and baris[0]['nomor'] == 1
    ipa = next(x for x in baris if x['kode'] == 'ipa')
    assert ipa['lengkap'] and ipa['kisi_kisi'] == {'guru_pj_nama': 'A', 'updated_at': '2026-11-20T08:00:00+07:00'}
    assert ipa['kartu_soal']['guru_pj_nama'] == 'B' and ipa['terakhir'] == '2026-11-21T02:00:00Z'  # 09.00 WIB > 08.00 WIB
    assert next(x for x in baris if x['kode'] == 'pkn')['kartu_soal'] is None  # belum terkirim
    assert up.ringkas_jenjang(baris) == {'total': 15, 'kisi_kisi': 2, 'kartu_soal': 1, 'lengkap': 1}
    assert up.ringkas_jenjang(up.baris_jenjang(docs, 9, MAPEL)) == {'total': 15, 'kisi_kisi': 0, 'kartu_soal': 0, 'lengkap': 0}


def test_berkas_publik_tanpa_data_rahasia():
    docs = [b('kartu_soal', 7, 'matematika'), b('kisi_kisi', 7, 'matematika'), b('kisi_kisi', 7, 'mapel_lama'),
            b('kisi_kisi', 9, 'akidah_akhlak'), b('lain', 7, 'ipa'), b('kisi_kisi', 10, 'ipa')]
    hasil = up.berkas_publik(docs, {7: ['bahasa_indonesia', 'matematika'], 8: [], 9: ['akidah_akhlak']})
    assert [(x['jenjang'], x['mapel'], x['jenis']) for x in hasil] == [(7, 'matematika', 'kisi_kisi'), (7, 'matematika', 'kartu_soal'), (9, 'akidah_akhlak', 'kisi_kisi')]
    assert all(set(x) == set(up.FIELD_BERKAS_PUBLIK) for x in hasil)
    assert 'rahasia.pdf' not in str(hasil) and 'g1' not in str(hasil)


def test_agregasi_dari_db_mengikuti_master_mapel():
    db = Db()
    asyncio.run(ui.seed_mapel_baku(db))
    next(d for d in db.ujian_mapel_baku.docs if d['jenjang'] == 8 and d['kode'] == 'bahasa_jawa')['aktif'] = False
    db.ujian_berkas.docs += [b('kisi_kisi', 8, 'bahasa_jawa'), b('kisi_kisi', 8, 'ipa', '2026-11-22T10:00:00+07:00'),
                             b('kartu_soal', 8, 'ipa'), {**b('kisi_kisi', 7, 'ipa'), 'ujian_id': 'u2'}]
    a = asyncio.run(up.agregasi_pengumpulan(db, 'u1'))
    assert a['jenjang']['8']['ringkasan'] == {'total': 14, 'kisi_kisi': 1, 'kartu_soal': 1, 'lengkap': 1}  # bahasa jawa nonaktif
    assert a['jenjang']['7']['ringkasan'] == {'total': 15, 'kisi_kisi': 0, 'kartu_soal': 0, 'lengkap': 0}  # ujian lain tidak ikut
    assert [(x['mapel'], x['jenis']) for x in a['berkas']] == [('ipa', 'kisi_kisi'), ('ipa', 'kartu_soal')]
    assert a['terakhir'] == '2026-11-22T10:00:00+07:00'
    kosong = asyncio.run(up.agregasi_pengumpulan(Db(), 'u1'))
    assert kosong['berkas'] == [] and kosong['terakhir'] is None and kosong['jenjang']['9']['ringkasan']['total'] == 15
