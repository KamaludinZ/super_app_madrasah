"""Riwayat kelas siswa: admin, wali kelas, dan siswa itu sendiri (Profil Saya); siswa lain ditolak."""

import os
import sys

import httpx
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import server  # noqa: E402
from core import get_current_user  # noqa: E402
from routers import classes  # noqa: E402


class _Cursor:
    def sort(self, *args, **kwargs):
        return self

    async def to_list(self, n):
        return [{'student_id': 's-1', 'class_id': 'c-1', 'academic_year_id': 'ay-1', 'start_date': '2025-07-14'}]


class _Coll:
    def __init__(self, doc=None):
        self.doc = doc

    async def find_one(self, *args, **kwargs):
        return self.doc

    def find(self, *args, **kwargs):
        return _Cursor()


class _FakeDb:
    users = _Coll({'id': 's-1', 'roles': ['siswa']})
    class_history = _Coll()
    classes = _Coll({'name': '7A'})
    academic_years = _Coll({'name': '2025/2026'})


@pytest.fixture
def fake_db(monkeypatch):
    monkeypatch.setattr(classes, 'db', _FakeDb())
    yield
    server.app.dependency_overrides.pop(get_current_user, None)


async def _get_as(uid, roles):
    server.app.dependency_overrides[get_current_user] = lambda: {'id': uid, 'username': uid, 'active_role': roles[0], 'roles': roles}
    transport = httpx.ASGITransport(app=server.app)
    async with httpx.AsyncClient(transport=transport, base_url='http://test') as client:
        return await client.get('/api/students/s-1/class-history')


@pytest.mark.parametrize('uid,roles', [('s-1', ['siswa']), ('a-1', ['admin']), ('w-1', ['guru', 'wali_kelas'])])
async def test_allowed(fake_db, uid, roles):
    r = await _get_as(uid, roles)
    assert r.status_code == 200
    assert r.json()[0]['class_name'] == '7A'


@pytest.mark.parametrize('uid,roles', [('s-2', ['siswa']), ('g-1', ['guru'])])
async def test_rejected(fake_db, uid, roles):
    r = await _get_as(uid, roles)
    assert r.status_code == 403
