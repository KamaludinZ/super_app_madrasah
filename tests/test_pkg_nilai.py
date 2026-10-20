"""Rumus nilai PKG sesuai template resmi: skor = jumlah centang, capaian, level, predikat jenjang."""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pkg_nilai  # noqa: E402

INSTRUMEN = {'kompetensi': [{'kode': str(k), 'sub': [
    {'kode': f'{k}.{s}', 'indikator': [{'level': i} for i in range(1, 6)]} for s in range(1, 4)]} for k in range(1, 5)]}


def test_contoh_template_resmi():
    # Contoh pada sheet 04-RKAP-PKG: skor 4,4,4,4,4,3,3,4,4,4,4,4 = 46 -> 76,67% Level 4, Ahli Madya.
    skor = [4, 4, 4, 4, 4, 3, 3, 4, 4, 4, 4, 4]
    kode = pkg_nilai.kode_sub(INSTRUMEN)
    isian = {k: {'centang': list(range(1, n + 1))} for k, n in zip(kode, skor)}
    n = pkg_nilai.hitung_nilai(INSTRUMEN, isian)
    assert (n['nilai_akhir'], n['nilai_maks'], n['capaian_persen']) == (46, 60, 76.67)
    assert n['level_capaian'] == 'Level 4' and n['predikat'] == 'Terpenuhi pada Jenjang Jabatan Guru Ahli Madya'
    assert n['terisi'] == 12 and n['progres'] == 100


def test_skor_jumlah_centang_tidak_harus_berurutan():
    assert pkg_nilai.skor_sub([1, 3, 5]) == 3 and pkg_nilai.skor_sub([1, 1, 2]) == 2
    assert pkg_nilai.skor_sub([0, 6, 'x']) == 0 and pkg_nilai.skor_sub(None) == 0


@pytest.mark.parametrize('persen, level, jenjang', [
    (0, None, None), (50, 'Level 1', 'Ahli Pertama'), (55, 'Level 2', 'Ahli Pertama'), (60, 'Level 3', 'Ahli Muda'),
    (75, 'Level 3', 'Ahli Muda'), (80, 'Level 4', 'Ahli Madya'), (90, 'Level 4', 'Ahli Madya'), (95, 'Level 5', 'Ahli Utama'),
])
def test_level_dan_predikat(persen, level, jenjang):
    assert pkg_nilai.level_capaian(persen) == level
    assert (pkg_nilai.predikat_jenjang(persen) or '').endswith(jenjang or '')


def test_rekap_model_kompetensi_sesuai_template():
    from pkg_nilai import rekap_model_kompetensi
    instrumen = {'kompetensi': [
        {'kode': str(k), 'nama': f'K{k}', 'sub': [{'kode': f'{k}.{s}', 'nama': f'S{k}{s}', 'indikator': [{}] * 5} for s in (1, 2, 3)]}
        for k in (1, 2, 3, 4)]}
    isian = {'1.1': {'centang': [1, 2, 3]}, '1.2': {'centang': [1, 2, 3, 4, 5]}, '4.3': {'centang': [1]}}
    m = rekap_model_kompetensi(instrumen, isian)
    assert [k['jumlah_skor'] for k in m['kompetensi']] == [8, 0, 0, 1]  # 05-RKAP-PKGR F27:F30
    assert (m['total_skor'], m['skor_maks'], m['nkg']) == (9, 60, 15.0)  # F31, NKG = 9/60 x 100
    assert [s['no'] for k in m['kompetensi'] for s in k['sub']] == list(range(1, 13))
    assert m['kompetensi'][0]['sub'][1]['tingkat'] == 'Level 5' and m['kompetensi'][1]['sub'][0]['tingkat'] is None
