"""Template PKG: berkas resmi tersedia di folder internal, path tetap, dan peringatan startup bila hilang."""

import logging
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pkg_template  # noqa: E402


def test_berkas_template_resmi_tersedia():
    hasil = pkg_template.periksa_template()
    assert hasil['lengkap'] is True and hasil['versi'] == '2026'
    assert {b['nama_berkas'] for b in hasil['berkas']} == {'pkg_template_v2026.xlsx', 'rekap_hasil_pkg_v2026.xlsx'}
    assert all(b['ukuran'] > 0 for b in hasil['berkas'])
    assert pkg_template.path_template('rekap').startswith(pkg_template.FOLDER_TEMPLATE)
    with pytest.raises(ValueError):
        pkg_template.path_template('../rahasia')


def test_peringatan_bila_hilang(monkeypatch, tmp_path, caplog):
    monkeypatch.setattr(pkg_template, 'FOLDER_TEMPLATE', str(tmp_path))
    (tmp_path / 'pkg_template_v2026.xlsx').write_bytes(b'xlsx')
    with caplog.at_level(logging.WARNING, logger='matsandatama'):
        hasil = pkg_template.periksa_template()
    assert hasil['lengkap'] is False
    assert [b['ada'] for b in hasil['berkas']] == [True, False]
    assert 'rekap_hasil_pkg_v2026.xlsx tidak ditemukan' in caplog.text


def test_checksum_resmi_cocok_dan_terdeteksi_berubah(monkeypatch, tmp_path, caplog):
    hasil = pkg_template.periksa_template()
    assert hasil['utuh'] is True and all(b['status'] == 'cocok' for b in hasil['berkas'])
    instrumen = pkg_template.info_berkas('instrumen')
    assert instrumen['checksum'] == pkg_template.TEMPLATE_PKG['instrumen']['checksum_resmi'] and instrumen['versi'] == '2026'

    monkeypatch.setattr(pkg_template, 'FOLDER_TEMPLATE', str(tmp_path))
    (tmp_path / 'pkg_template_v2026.xlsx').write_bytes(b'berkas diubah')
    with caplog.at_level(logging.WARNING, logger='matsandatama'):
        hasil = pkg_template.periksa_template()
    status = {b['jenis']: b['status'] for b in hasil['berkas']}
    assert status == {'instrumen': 'berbeda', 'rekap': 'hilang'} and hasil['utuh'] is False
    assert 'berbeda dari checksum resmi' in caplog.text
    assert pkg_template.hitung_checksum(str(tmp_path / 'tidak-ada.xlsx')) is None
