"""Ambang & bobot PKG: nilai sesuai rumus template resmi dan cermin frontend lib/pkgAmbang.js identik."""

import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pkg_ambang as a  # noqa: E402

JS = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'src', 'lib', 'pkgAmbang.js')


def _ambang_js(nama):
    teks = open(JS, encoding='utf-8').read()
    blok = re.search(rf'export const {nama} = \[(.*?)\n\];', teks, re.S).group(1)
    hasil = []
    for op, batas, label in re.findall(r"\['([<>=]+)', (-?Infinity|[\d.]+), '([^']+)'\]", blok):
        hasil.append((op, float('-inf') if batas == '-Infinity' else float(batas), label))
    return hasil


def test_cermin_frontend_identik():
    for nama in ('AMBANG_LEVEL', 'AMBANG_PREDIKAT_JENJANG', 'AMBANG_PREDIKAT_REKAP', 'AMBANG_SEBUTAN_360'):
        assert _ambang_js(nama) == [(op, float(b), lbl) for op, b, lbl in getattr(a, nama)], nama


def test_level_dan_predikat_sesuai_template():
    lv = lambda n: a.terapkan(a.AMBANG_LEVEL, n)  # noqa: E731
    assert [lv(n) for n in (0, 54.99, 55, 55.01, 75, 90, 90.01, 100)] == \
        [None, 'Level 1', 'Level 2', 'Level 3', 'Level 3', 'Level 4', 'Level 5', 'Level 5']
    assert a.terapkan(a.AMBANG_PREDIKAT_JENJANG, 55).endswith('Ahli Pertama')
    assert a.terapkan(a.AMBANG_PREDIKAT_JENJANG, 75.5).endswith('Ahli Madya')
    rekap = lambda n: a.terapkan(a.AMBANG_PREDIKAT_REKAP, n, kosong_bila_nol=False)  # noqa: E731
    assert [rekap(n) for n in (0, 59.9, 60, 61, 76, 91)] == ['Kurang', 'Kurang', 'Sedang', 'Cukup', 'Baik', 'Sangat Baik']
    s = lambda n: a.terapkan(a.AMBANG_SEBUTAN_360, n)  # noqa: E731
    assert [s(n) for n in (50, 60, 75, 90, 100)] == ['Kurang', 'Sedang', 'Cukup', 'Baik', 'Amat Baik']


def test_simpulan_level_dan_proporsi():
    assert a.level_dari_label('pada Level 4') == 4 and a.level_dari_label(None) is None
    assert a.simpulan_level(3, 3)['level'] == 'Level 3'
    pecahan = a.simpulan_level(3, 4)
    assert pecahan['rata'] == 3.5 and pecahan['level'] is None  # 01-LAPORN!M7 kosong bila rata-rata pecahan
    assert a.proporsi('MTs') == {'atasan': 0.7, 'sejawat': 0.1, 'siswa': 0.1, 'ortu': 0.1}
    assert a.proporsi('smk')['dudi'] == 0.05 and a.proporsi('PAUD')['siswa'] == 0.0
    assert abs(sum(a.proporsi('SLB').values()) - 1) < 1e-9
    k = a.konfigurasi()
    assert k['predikat_rekap'][-1]['batas'] is None and k['kehadiran'] == {'menit_per_hari': 480, 'pembagi_hari': 46}
