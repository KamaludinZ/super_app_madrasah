"""Validasi tanggal penugasan Guru Pengganti terhadap hari jadwal (tanpa MongoDB)."""

import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from routers import guru_pengganti as gp  # noqa: E402

# 2099-01-05 adalah Senin.
MON, TUE, NEXT_MON = '2099-01-05', '2099-01-06', '2099-01-12'


class _FakeCursor:
    def __init__(self, docs):
        self.docs = docs

    async def to_list(self, _n):
        return self.docs


class _FakeAssignments:
    def __init__(self, taken):
        self.taken = taken

    def find(self, query, _projection=None):
        dates = query['date']['$in']
        return _FakeCursor([{'date': d} for d in self.taken if d in dates])


class _FakeDb:
    def __init__(self, taken=()):
        self.substitute_assignments = _FakeAssignments(list(taken))


@pytest.fixture
def patched(monkeypatch):
    async def no_blocks(_sch, _dates):
        return {}

    async def all_free(_sch, _dates, _ids, exclude_assignment_ids=None):
        return {}

    monkeypatch.setattr(gp, 'date_block_reasons', no_blocks)
    monkeypatch.setattr(gp, 'compute_unavailability', all_free)
    monkeypatch.setattr(gp, 'db', _FakeDb())
    return monkeypatch


@pytest.mark.parametrize('raw', ['senin', 'Senin', ' SENIN '])
def test_day_key_normalizes_legacy_values(raw):
    assert gp.day_key(raw) == 'senin'


async def test_dates_on_schedule_day_are_valid(patched):
    problems = await gp._invalid_dates({'id': 's1', 'day': 'Senin'}, 'senin', [MON, NEXT_MON], 'u2')
    assert problems == {}


async def test_dates_on_other_days_are_rejected(patched):
    problems = await gp._invalid_dates({'id': 's1'}, 'senin', [MON, TUE], 'u2')
    assert problems == {TUE: ('wrong_day', 'bukan hari senin')}


async def test_wrong_day_raises_400_listing_dates(patched):
    problems = await gp._invalid_dates({'id': 's1'}, 'senin', [MON, TUE], 'u2')
    with pytest.raises(HTTPException) as exc:
        gp._raise_first_problem(problems, 'senin')
    assert exc.value.status_code == 400
    assert TUE in exc.value.detail and MON not in exc.value.detail


async def test_taken_date_reported_after_day_check(patched):
    patched.setattr(gp, 'db', _FakeDb(taken=[NEXT_MON]))
    problems = await gp._invalid_dates({'id': 's1'}, 'senin', [MON, TUE, NEXT_MON], 'u2')
    assert problems[TUE][0] == 'wrong_day'
    assert problems[NEXT_MON][0] == 'taken'
    assert MON not in problems


def test_jam_ke_label_skips_breaks():
    slots = [
        {'name': 'Jam ke-1', 'start_time': '07:00', 'end_time': '07:45'},
        {'name': 'Jam ke-2', 'start_time': '07:45', 'end_time': '08:30'},
        {'name': 'Istirahat', 'start_time': '08:30', 'end_time': '08:45', 'is_break': True},
        {'name': 'Jam ke-3', 'start_time': '08:45', 'end_time': '09:30'},
    ]
    assert gp.jam_ke_label(slots, '07:45', '09:30') == '2-3'
    assert gp.jam_ke_label(slots, '07:00', '07:45') == '1'
    assert gp.jam_ke_label(slots, '13:00', '14:00') == ''
