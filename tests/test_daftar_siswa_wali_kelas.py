"""GET /students untuk peran aktif wali kelas (menu Data Siswa & E-Rapor Kelas): hanya siswa rombel perwaliannya,
walau akun merangkap peran yang boleh melihat semua kelas (admin, guru piket, BK, ...)."""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, os.path.dirname(__file__))

import rombel  # noqa: E402
from routers import _shared, students  # noqa: E402
from pkg_palsu import Db, Koleksi  # noqa: E402

SEM = 'sem-aktif'


def _db():
    db = Db()
    db['semesters'] = Koleksi([{'id': SEM, 'is_active': True}])
    db['classes'] = Koleksi([
        {'id': 'k7a', 'name': '7A', 'grade': 7, 'semester_id': SEM, 'homeroom_teacher_id': 'wali-1'},
        {'id': 'k7b', 'name': '7B', 'grade': 7, 'semester_id': SEM, 'homeroom_teacher_id': 'wali-2'},
    ])
    db['users'] = Koleksi([
        {'id': 's1', 'roles': ['siswa'], 'full_name': 'Ahmad', 'student_class_id': 'k7a'},
        {'id': 's2', 'roles': ['siswa'], 'full_name': 'Budi', 'student_class_id': 'k7a'},
        {'id': 's3', 'roles': ['siswa'], 'full_name': 'Citra', 'student_class_id': 'k7b'},
    ])
    return db


def _jalankan(user, monkeypatch, **kw):
    db = _db()
    for modul in (students, rombel, _shared):
        monkeypatch.setattr(modul, 'db', db)

    async def konteks(_user=None):
        return {'semester_id': SEM}
    monkeypatch.setattr(students, 'get_active_context', konteks)
    monkeypatch.setattr(rombel, 'get_active_context', konteks, raising=False)
    hasil = asyncio.run(students.list_students(user=user, **kw))
    return sorted(s['id'] for s in hasil)


def _u(active, roles):
    return {'id': 'wali-1', 'active_role': active, 'roles': roles}


def test_wali_kelas_merangkap_peran_luas_hanya_lihat_kelasnya(monkeypatch):
    for roles in (['guru', 'wali_kelas'], ['guru', 'wali_kelas', 'guru_piket'], ['wali_kelas', 'guru_bk'],
                  ['admin', 'wali_kelas'], ['wali_kelas', 'tenaga_kependidikan']):
        assert _jalankan(_u('wali_kelas', roles), monkeypatch) == ['s1', 's2'], roles


def test_peran_lain_tetap_melihat_semua_kelas(monkeypatch):
    # Akun yang sama setelah berganti ke peran luasnya tetap melihat seluruh siswa.
    assert _jalankan(_u('guru_piket', ['guru', 'wali_kelas', 'guru_piket']), monkeypatch) == ['s1', 's2', 's3']
    assert _jalankan(_u('admin', ['admin', 'wali_kelas']), monkeypatch) == ['s1', 's2', 's3']


def test_wali_kelas_tanpa_perwalian_kosong(monkeypatch):
    user = {'id': 'guru-lain', 'active_role': 'wali_kelas', 'roles': ['wali_kelas', 'guru_piket']}
    assert _jalankan(user, monkeypatch) == []
