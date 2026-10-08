"""Absensi GTK: tanggal jurnal menurut WIB (format started_at campuran) & hari ini/mendatang tidak dihitung alpha."""

import os
import sys
from datetime import date, datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from routers import absensi_gtk  # noqa: E402
from routers.absensi_gtk import _status_tanpa_bukti, _summarize, _tanggal_wib  # noqa: E402


def test_tanggal_wib_format_campuran():
    assert _tanggal_wib('2026-10-08T03:10:00') == '2026-10-08'          # UTC naive 10:10 WIB
    assert _tanggal_wib('2026-10-07T23:30:00') == '2026-10-08'          # UTC naive 06:30 WIB hari berikutnya
    assert _tanggal_wib('2026-10-08T06:30:00+07:00') == '2026-10-08'    # WIB ber-offset


def test_hari_ini_belum_dan_mendatang_dilewati(monkeypatch):
    monkeypatch.setattr(absensi_gtk, 'now_wib', lambda: datetime(2026, 10, 8, 8, 0))
    assert _status_tanpa_bukti(date(2026, 10, 7), None)['status'] == 'alpha'
    assert _status_tanpa_bukti(date(2026, 10, 8), None)['status'] == 'belum'
    assert _status_tanpa_bukti(date(2026, 10, 9), None) is None
    izin = {'id': 'i1', 'jenis': 'sakit'}
    assert _status_tanpa_bukti(date(2026, 10, 9), izin)['status'] == 'sakit'
    # 'belum' tidak dihitung sebagai hari wajib
    s = _summarize([{'date': '2026-10-07', 'status': 'hadir'}, {'date': '2026-10-08', 'status': 'belum'}])
    assert s['total_hari_wajib'] == 1 and s['persentase_hadir'] == 100.0
