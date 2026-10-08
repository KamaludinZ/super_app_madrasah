"""Kandidat anggota ekskul: hanya pembina ekskul itu & admin, data siswa minimal."""

import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from routers import phase4  # noqa: E402


class _Cursor:
    def __init__(self, docs):
        self.docs = docs

    def sort(self, *a, **k):
        return self

    async def to_list(self, n):
        return self.docs


class _Col:
    def __init__(self, one=None, many=None):
        self.one, self.many = one, many or []

    async def find_one(self, *a, **k):
        return self.one

    def find(self, *a, **k):
        return _Cursor(self.many)


class _Db:
    extracurriculars = _Col(one={'coach_id': 'pembina-1'})
    users = _Col(many=[{'id': 's1', 'full_name': 'Siswa Satu', 'nisn': '01', 'student_class_id': 'c1', 'nik': 'rahasia'}])
    classes = _Col(many=[{'id': 'c1', 'name': '7A'}])


@pytest.fixture
def fake_db(monkeypatch):
    monkeypatch.setattr(phase4, 'db', _Db())


async def test_pembina_dapat_daftar_minimal(fake_db):
    res = await phase4.kandidat_anggota_extra('e1', None, {'id': 'pembina-1', 'roles': ['guru_ekstrakurikuler']})
    assert res == [{'id': 's1', 'full_name': 'Siswa Satu', 'nisn': '01', 'class_name': '7A'}]


async def test_bukan_pembina_ditolak(fake_db):
    with pytest.raises(HTTPException) as e:
        await phase4.kandidat_anggota_extra('e1', None, {'id': 'guru-lain', 'roles': ['guru_ekstrakurikuler']})
    assert e.value.status_code == 403


async def test_admin_boleh(fake_db):
    assert await phase4.kandidat_anggota_extra('e1', 'sis', {'id': 'adm', 'roles': ['admin']})
