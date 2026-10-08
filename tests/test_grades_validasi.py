"""Input nilai massal: nilai di luar 0–100 atau bukan angka ditolak sebelum disimpan."""

import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from routers import phase4  # noqa: E402

ADMIN = {'id': 'a-1', 'roles': ['admin'], 'active_role': 'admin'}


@pytest.fixture(autouse=True)
def tanpa_db(monkeypatch):
    async def ay():
        return {'id': 'ay-1'}
    monkeypatch.setattr(phase4, 'get_active_academic_year', ay)


@pytest.mark.parametrize('nilai', [850, -1, 'abc'])
async def test_nilai_tidak_valid_ditolak(nilai):
    payload = {'class_id': 'c', 'subject_id': 's', 'entries': [{'student_id': 'x', 'nilai_pengetahuan': nilai}]}
    with pytest.raises(HTTPException) as e:
        await phase4.submit_grades_bulk(payload, None, ADMIN)
    assert e.value.status_code == 400
