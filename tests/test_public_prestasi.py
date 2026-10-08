"""Halaman publik prestasi: tanpa NISN/ID internal, statistik tingkat memakai kode data (kab_kota, dst.)."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from routers import public  # noqa: E402

ACH = [
    {'id': 'a1', 'holder_type': 'siswa', 'student_id': 's-1', 'name': 'OSN', 'level': 'provinsi', 'year': 2026,
     'is_verified': True, 'submitted_by': 's-1', 'verified_by': 'adm'},
    {'id': 'a2', 'holder_type': 'guru', 'holder_id': 'g-1', 'name': 'Guru Inovatif', 'level': 'kota', 'year': 2026, 'is_verified': True},
]
USERS = {'s-1': {'full_name': 'Siswa Satu', 'nisn': '0012345678', 'student_class_id': 'c-1'}, 'g-1': {'full_name': 'Guru Satu'}}


class _Cursor:
    def __init__(self, items):
        self.items = items

    def sort(self, *a, **k):
        return self

    def limit(self, *a, **k):
        return self

    async def to_list(self, n):
        return [dict(x) for x in self.items]


class _Ach:
    def find(self, q, proj=None):
        return _Cursor(ACH)

    async def count_documents(self, q):
        lv = q.get('level')
        if isinstance(lv, dict):
            return sum(1 for a in ACH if a.get('level') in lv['$in'])
        return len(ACH)

    def aggregate(self, pipeline):
        return _Cursor([{'_id': 2026, 'count': 2}])


class _Users:
    async def find_one(self, q, proj=None):
        u = USERS.get(q['id'])
        return {k: v for k, v in u.items() if k in proj} if u else None


class _Classes:
    async def find_one(self, q, proj=None):
        return {'name': '7A'}


class _Db:
    achievements = _Ach()
    users = _Users()
    classes = _Classes()


async def test_public_achievements_tanpa_data_pribadi(monkeypatch):
    async def settings():
        return {'school_name': 'MTsN 2'}
    monkeypatch.setattr(public, 'db', _Db())
    monkeypatch.setattr(public, 'get_settings', settings)
    res = await public.public_achievements()
    siswa = res['achievements'][0]
    assert siswa['student_name'] == 'Siswa Satu' and siswa['class_name'] == '7A'
    for a in res['achievements']:
        for k in ('student_nisn', 'student_id', 'holder_id', 'submitted_by', 'verified_by'):
            assert k not in a
    assert res['achievements'][1]['teacher_name'] == 'Guru Satu'
    assert res['stats']['by_level'] == {'kab_kota': 1, 'provinsi': 1, 'nasional': 0, 'internasional': 0}
