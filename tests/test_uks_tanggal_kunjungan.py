"""Tanggal kunjungan UKS: wajib YYYY-MM-DD dan tidak boleh setelah hari ini (WIB)."""

import os
import sys
from datetime import datetime

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from routers import uks  # noqa: E402


@pytest.fixture
def hari_ini(monkeypatch):
    monkeypatch.setattr(uks, '_today_wib', lambda: datetime(2026, 10, 8, 9, 0))


def test_hari_ini_dan_lampau_diterima(hari_ini):
    uks._cek_tanggal_kunjungan('2026-10-08')
    uks._cek_tanggal_kunjungan('2026-10-01')
    uks._cek_tanggal_kunjungan('2025-12-31')


def test_tanggal_masa_depan_ditolak(hari_ini):
    with pytest.raises(HTTPException) as e:
        uks._cek_tanggal_kunjungan('2026-10-26')
    assert e.value.status_code == 400


@pytest.mark.parametrize('nilai', ['', '26-10-2026', 'besok'])
def test_format_salah_ditolak(hari_ini, nilai):
    with pytest.raises(HTTPException):
        uks._cek_tanggal_kunjungan(nilai)
