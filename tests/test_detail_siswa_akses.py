"""Akses lihat detail siswa (EMIS) & detail GTK untuk Kepala Madrasah dan peran pemantau."""

import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from core import DETAIL_SISWA_VIEWER_ROLES, require_role  # noqa: E402
from routers import students  # noqa: E402

SISWA = {'id': 's-1', 'roles': ['siswa'], 'full_name': 'Siswa', 'student_class_id': 'c-1'}


class _Col:
    def __init__(self, doc):
        self.doc = doc

    async def find_one(self, *a, **k):
        return self.doc


class _Db:
    users = _Col(SISWA)
    student_details = _Col({'student_id': 's-1', 'nik': '3573'})


@pytest.fixture
def fake_db(monkeypatch):
    monkeypatch.setattr(students, 'db', _Db())

    async def tidak(user, cid):
        return False
    monkeypatch.setattr(students, 'user_can_view_class', tidak)


def _u(active, roles=None, uid='u-1'):
    return {'id': uid, 'active_role': active, 'roles': roles or [active]}


async def test_pemantau_boleh_lihat_detail_siswa(fake_db):
    for role in DETAIL_SISWA_VIEWER_ROLES:
        res = await students.get_student_detail('s-1', _u(role))
        assert res['student']['id'] == 's-1'


async def test_peran_lain_ditolak(fake_db):
    for role in ('guru', 'guru_piket', 'tenaga_kependidikan', 'unit_kesehatan'):
        with pytest.raises(HTTPException) as e:
            await students.get_student_detail('s-1', _u(role))
        assert e.value.status_code == 403
    # Siswa lain juga tidak boleh.
    with pytest.raises(HTTPException):
        await students.get_student_detail('s-1', _u('siswa', uid='s-2'))


async def test_detail_gtk_kepala_ktu():
    cek = require_role('admin', 'kepala_sekolah', 'kepala_tata_usaha')
    for role in ('kepala_sekolah', 'kepala_tata_usaha'):
        assert await cek(_u(role))
    with pytest.raises(HTTPException):
        await cek(_u('guru'))


async def test_pemantau_tidak_boleh_mengubah_detail_siswa(fake_db):
    with pytest.raises(HTTPException) as e:
        await students.upsert_student_detail('s-1', {'nik': '1'}, None, _u('kepala_sekolah'))
    assert e.value.status_code == 403
