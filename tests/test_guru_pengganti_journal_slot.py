"""Validasi slot jadwal sebelum jurnal guru pengganti / guru asli disimpan (tanpa MongoDB)."""

import os
import sys
from datetime import datetime

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from journal_core import WIB_TZ  # noqa: E402
from routers import guru_pengganti as gp  # noqa: E402

ASSIGNMENT = {'schedule_id': 's1', 'original_teacher_id': 't-orig'}
SCHEDULE = {'id': 's1', 'teacher_id': 't-orig', 'day': 'Rabu', 'start_time': '09:00',
            'end_time': '10:20', 'semester_id': 'sem-1', 'is_published': True}


class _Schedules:
    def __init__(self, doc):
        self.doc = doc

    async def find_one(self, *_args, **_kwargs):
        return dict(self.doc) if self.doc else None


class _Db:
    def __init__(self, doc):
        self.schedules = _Schedules(doc)


@pytest.fixture
def setup(monkeypatch):
    def apply(schedule=SCHEDULE, now=datetime(2026, 10, 7, 9, 30, tzinfo=WIB_TZ), today='rabu'):
        async def active_sem():
            return 'sem-1'
        monkeypatch.setattr(gp, 'db', _Db(schedule))
        monkeypatch.setattr(gp, '_active_semester_id', active_sem)
        monkeypatch.setattr(gp, 'current_day_id', lambda: today)
        monkeypatch.setattr(gp, 'now_wib', lambda: now)
    return apply


async def test_valid_slot_returns_schedule(setup):
    setup()
    assert (await gp.validate_slot_for_journal(ASSIGNMENT))['id'] == 's1'


async def test_missing_or_unpublished_schedule_rejected(setup):
    setup(schedule=None)
    with pytest.raises(HTTPException) as exc:
        await gp.validate_slot_for_journal(ASSIGNMENT)
    assert exc.value.status_code == 404
    setup(schedule={**SCHEDULE, 'is_published': False})
    with pytest.raises(HTTPException):
        await gp.validate_slot_for_journal(ASSIGNMENT)


async def test_schedule_reassigned_to_other_teacher_rejected(setup):
    setup(schedule={**SCHEDULE, 'teacher_id': 't-new'})
    with pytest.raises(HTTPException) as exc:
        await gp.validate_slot_for_journal(ASSIGNMENT)
    assert exc.value.status_code == 409


async def test_wrong_day_rejected(setup):
    setup(today='kamis')
    with pytest.raises(HTTPException) as exc:
        await gp.validate_slot_for_journal(ASSIGNMENT)
    assert exc.value.status_code == 400


async def test_other_semester_rejected(setup):
    setup(schedule={**SCHEDULE, 'semester_id': 'sem-lama'})
    with pytest.raises(HTTPException):
        await gp.validate_slot_for_journal(ASSIGNMENT)


async def test_before_lesson_start_rejected_but_grace_allowed(setup):
    setup(now=datetime(2026, 10, 7, 8, 40, tzinfo=WIB_TZ))
    with pytest.raises(HTTPException) as exc:
        await gp.validate_slot_for_journal(ASSIGNMENT)
    assert '08:45' in exc.value.detail
    setup(now=datetime(2026, 10, 7, 8, 50, tzinfo=WIB_TZ))
    assert await gp.validate_slot_for_journal(ASSIGNMENT)
