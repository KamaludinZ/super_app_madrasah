"""Kelengkapan data GTK: varian tendik (label "Data Tendik", NUPTK tidak diwajibkan), key bagian sama dengan guru."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))

from routers._shared import (  # noqa: E402
    BAGIAN_KELENGKAPAN_GTK, BAGIAN_KELENGKAPAN_TENDIK, adalah_tendik, compute_completeness_gtk,
)


def test_adalah_tendik_menurut_peran():
    assert adalah_tendik({'roles': ['tenaga_kependidikan']})
    assert adalah_tendik({'roles': ['kepala_tata_usaha']})
    assert not adalah_tendik({'roles': ['tenaga_kependidikan', 'guru']})
    assert not adalah_tendik({'roles': ['guru']})
    assert not adalah_tendik({'roles': ['admin']})


def test_key_bagian_sama_urutan_sama():
    assert [b['key'] for b in BAGIAN_KELENGKAPAN_GTK] == [b['key'] for b in BAGIAN_KELENGKAPAN_TENDIK]


def test_tendik_label_dan_tanpa_nuptk():
    tendik = compute_completeness_gtk({'roles': ['tenaga_kependidikan']})
    guru = compute_completeness_gtk({'roles': ['guru']})
    assert tendik['bagian'][0]['label'] == 'Data Tendik'
    assert guru['bagian'][0]['label'] == 'Data Guru'
    assert 'NUPTK' not in tendik['bagian'][0]['kurang']
    assert 'NUPTK' in guru['bagian'][0]['kurang']
    assert tendik['bagian'][0]['total'] == guru['bagian'][0]['total'] - 1


def test_jenis_eksplisit_menimpa_peran():
    assert compute_completeness_gtk({'roles': ['guru']}, 'tendik')['bagian'][0]['label'] == 'Data Tendik'


def test_kepala_madrasah_guru_dan_ktu_tendik():
    """Kepala madrasah termasuk guru (tanpa wajib jadwal); Kepala TU termasuk tendik; guru didahulukan."""
    from core import jenis_gtk_peran
    from data_master_service import jenis_gtk

    assert jenis_gtk_peran(['kepala_sekolah']) == 'guru'
    assert jenis_gtk_peran(['kepala_tata_usaha']) == 'tendik'
    assert jenis_gtk_peran(['tenaga_kependidikan', 'kepala_sekolah']) == 'guru'
    assert jenis_gtk_peran(['guru_ipa', 'tenaga_kependidikan']) == 'guru'
    assert jenis_gtk_peran(['admin']) is None
    assert jenis_gtk({'roles': ['kepala_tata_usaha']}) == 'tendik'
    assert jenis_gtk({'roles': ['kepala_sekolah']}) == 'guru'
    assert compute_completeness_gtk({'roles': ['kepala_tata_usaha']})['bagian'][0]['label'] == 'Data Tendik'
    assert compute_completeness_gtk({'roles': ['kepala_sekolah']})['bagian'][0]['label'] == 'Data Guru'
