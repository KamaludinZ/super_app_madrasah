"""Instrumen PKG: validasi struktur kompetensi/sub/indikator, isian ubah sub, ringkasan & daftar versi."""

import asyncio
import os
import sys

import pytest
from pydantic import ValidationError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pkg_instrumen  # noqa: E402
import pkg_skema as skema  # noqa: E402
from tests.pkg_palsu import Db, Koleksi  # noqa: E402


def _indikator(n=5):
    return [{'level': i, 'teks': f'Indikator level {i}'} for i in range(1, n + 1)]


def _sub(kode='1.1', **ubah):
    return {'kode': kode, 'nama': 'Lingkungan belajar', 'bobot': 1, 'indikator': _indikator(), **ubah}


def _struktur(**ubah):
    return {'kompetensi': [{'kode': '1', 'nama': 'Pedagogik', 'sub': [_sub('1.1'), _sub('1.2')]}], **ubah}


def test_struktur_sah():
    s = skema.StrukturInstrumen(**_struktur())
    assert [x.kode for x in s.kompetensi[0].sub] == ['1.1', '1.2']
    acak = skema.SubKompetensiInstrumen(**_sub(indikator=list(reversed(_indikator()))))
    assert [i.level for i in acak.indikator] == [1, 2, 3, 4, 5]  # diurutkan
    assert skema.SubKompetensiInstrumen(**_sub(bobot='8.33')).bobot == 8.33


@pytest.mark.parametrize('ubah', [
    {'indikator': _indikator(4)},                                     # kurang dari 5 level
    {'indikator': _indikator(4) + [{'level': 4, 'teks': 'ganda'}]},   # level ganda
    {'indikator': _indikator()[:4] + [{'level': 5, 'teks': '  '}]},   # teks kosong
    {'bobot': 0}, {'bobot': 100.5}, {'bobot': 1.234}, {'bobot': 'x'},
    {'kode': '1'}, {'kode': '1.a'}, {'nama': ''},
    {'liar': 1},
])
def test_sub_tidak_sah(ubah):
    with pytest.raises(ValidationError):
        skema.SubKompetensiInstrumen(**_sub(**ubah))


def test_kompetensi_tidak_sah():
    with pytest.raises(ValidationError):  # kode sub ganda
        skema.KompetensiInstrumen(kode='1', nama='P', sub=[_sub('1.1'), _sub('1.1')])
    with pytest.raises(ValidationError):  # sub bukan milik kompetensi ini
        skema.KompetensiInstrumen(kode='1', nama='P', sub=[_sub('2.1')])
    with pytest.raises(ValidationError):  # kode kompetensi ganda
        skema.StrukturInstrumen(kompetensi=[{'kode': '1', 'nama': 'A', 'sub': [_sub('1.1')]}] * 2)
    with pytest.raises(ValidationError):
        skema.StrukturInstrumen(kompetensi=[])


def test_isian_ubah_sub():
    ok = skema.UbahSubInstrumenRequest(nama=' Baru ', bobot=2.5, indikator=_indikator(), alasan=' revisi juknis ')
    assert (ok.nama, ok.alasan) == ('Baru', 'revisi juknis')
    with pytest.raises(ValidationError):
        skema.UbahSubInstrumenRequest(nama='Baru', bobot=1, indikator=_indikator(), alasan='  ')


def test_ringkasan_dan_daftar_versi():
    doc = {'id': 'i1', 'versi_template': '2026', 'revisi': 1, 'is_active': True, 'diimpor_pada': '2026-10-01',
           **skema.StrukturInstrumen(**_struktur()).model_dump()}
    assert pkg_instrumen.ringkas_instrumen(doc) == {'kompetensi': 1, 'sub': 2, 'indikator': 10, 'skor_maks': 10}
    assert pkg_instrumen.instrumen_tampil(doc)['kompetensi'][0]['sub'][1]['kode'] == '1.2'
    assert pkg_instrumen.instrumen_tampil(None) is None

    db = Db({
        'pkg_instrumen': Koleksi([doc, {'id': 'i0', 'versi_template': '2025', 'revisi': 1, 'is_active': False,
                                         'diimpor_pada': '2025-09-01', 'kompetensi': []}]),
        'pkg_penilaian': Koleksi([{'instrumen_id': 'i0'}, {'instrumen_id': 'i0'}, {'instrumen_id': 'i1'}]),
    })
    assert asyncio.run(pkg_instrumen.instrumen_aktif(db))['id'] == 'i1'
    versi = asyncio.run(pkg_instrumen.daftar_versi(db))
    assert [(v['id'], v['dipakai_penilaian']) for v in versi] == [('i1', 1), ('i0', 2)]
    assert 'kompetensi' not in versi[0]


def test_periksa_instrumen_startup(caplog):
    import logging
    template = {'versi_template': '2026', 'berkas': [{'jenis': 'instrumen', 'versi': '2026', 'ada': True}]}
    with caplog.at_level(logging.WARNING, logger='matsandatama'):
        kosong = asyncio.run(pkg_instrumen.periksa_instrumen_startup(Db(), template))
    assert kosong == {'aktif': False, 'versi_aktif': None, 'versi_template': '2026', 'sejalan': False}
    assert 'Belum ada instrumen PKG aktif' in caplog.text

    caplog.clear()
    db = Db({'pkg_instrumen': Koleksi([{'id': 'i0', 'versi_template': '2025', 'revisi': 2, 'is_active': True}])})
    with caplog.at_level(logging.WARNING, logger='matsandatama'):
        lama = asyncio.run(pkg_instrumen.periksa_instrumen_startup(db, template))
    assert lama['sejalan'] is False and 'template 2025 (rev 2)' in caplog.text

    db['pkg_instrumen'].docs[0]['versi_template'] = '2026'
    assert asyncio.run(pkg_instrumen.periksa_instrumen_startup(db, template))['sejalan'] is True
