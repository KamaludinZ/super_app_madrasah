"""Filter started_at satu hari WIB untuk format jurnal campuran (UTC tanpa zona & WIB +07:00)."""

import os
import re
import sys
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from journal_core import day_started_at_filter  # noqa: E402


def _matches(f, value):
    """Evaluasi sederhana filter $or yang dihasilkan (cukup untuk operator yang dipakai)."""
    for cond in f['$or']:
        c = cond['started_at']
        if '$regex' in c:
            if re.search(c['$regex'], value):
                return True
        elif c['$gte'] <= value < c['$lt'] and not c['$not'].search(value):
            return True
    return False


def test_matches_wib_and_naive_utc_on_same_wib_day():
    f = day_started_at_filter(date(2026, 10, 7))
    assert _matches(f, '2026-10-07T07:30:00.123+07:00')        # piket/pengganti (WIB)
    assert _matches(f, '2026-10-07T00:30:00.123')              # scan QR 07:30 WIB (UTC naive)
    assert _matches(f, '2026-10-06T23:30:00')                  # scan QR 06:30 WIB (UTC naive, tanggal UTC kemarin)


def test_excludes_other_days():
    f = day_started_at_filter(date(2026, 10, 7))
    assert not _matches(f, '2026-10-06T20:00:00+07:00')        # kemarin malam WIB
    assert not _matches(f, '2026-10-07T17:30:00')              # 00:30 WIB tanggal 8 (UTC naive)
    assert not _matches(f, '2026-09-30T08:00:00+07:00')        # minggu lalu (jadwal berulang)
