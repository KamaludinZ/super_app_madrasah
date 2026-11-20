"""Kerangka uji HTTP modul Ujian Madrasah: aplikasi FastAPI sungguhan (server.app, token JWT, dependensi asli) dengan
basis data tiruan dalam memori (tests/pkg_palsu.Db). Waktu server dipatok HARI_INI 08.00 WIB.

Data dasar: TP 2025/2026 (semester Genap lalu) & 2026/2027 (semester Ganjil aktif), akun admin, waka kurikulum, kepala
madrasah, dua guru, satu tendik, dan satu siswa.
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
sys.path.insert(0, os.path.dirname(__file__))

import core  # noqa: E402
from auth_utils import create_access_token  # noqa: E402
from pkg_palsu import Db  # noqa: E402

HARI_INI = '2026-12-02'


def ujian_doc(uid, jenis, semester, mulai, selesai, nama=None):
    return {'id': uid, 'jenis': jenis, 'nama': nama or f'{jenis} {uid}', 'semester_id': semester, 'semester_nama': 'Ganjil',
            'tahun_pelajaran': '2026/2027', 'mulai': mulai, 'selesai': selesai}


def buat_klien(monkeypatch, hari_ini=HARI_INI, jam='08:00'):
    from fastapi.testclient import TestClient

    import server

    db = Db()
    asli = core.db
    for modul in list(sys.modules.values()):  # semua modul yang memakai `from core import db`
        if getattr(modul, 'db', None) is asli:
            monkeypatch.setattr(modul, 'db', db)
    for modul in list(sys.modules.values()):  # waktu server dipatok pada semua router & modul ujian
        nama = getattr(modul, '__name__', '') or ''
        if nama.startswith(('routers.ujian', 'ujian')):
            if hasattr(modul, 'hari_ini_wib'):
                monkeypatch.setattr(modul, 'hari_ini_wib', lambda *_a, **_k: hari_ini)
            if hasattr(modul, 'jam_wib'):
                monkeypatch.setattr(modul, 'jam_wib', lambda *_a, **_k: jam)

    db.academic_years.docs += [{'id': 'tp-lalu', 'name': '2025/2026'}, {'id': 'tp-kini', 'name': '2026/2027', 'is_active': True}]
    db.semesters.docs += [
        {'id': 'sem-lalu', 'name': 'Genap', 'code': 'genap', 'academic_year_id': 'tp-lalu', 'is_active': False},
        {'id': 'sem-kini', 'name': 'Ganjil', 'code': 'ganjil', 'academic_year_id': 'tp-kini', 'is_active': True},
    ]
    pengguna = {
        'admin': (['admin'], 'Administrator'), 'wakakur': (['waka_kurikulum', 'guru'], 'Bu Waka'),
        'kamad': (['kepala_sekolah'], 'Pak Kamad'), 'guru1': (['guru'], 'Bu Siti'), 'guru2': (['guru'], 'Pak Hadi'),
        'tu1': (['tenaga_kependidikan'], 'Bu Laili'), 'siswa1': (['siswa'], 'Ahmad'),
    }
    for uid, (roles, nama) in pengguna.items():
        db.users.docs.append({'id': uid, 'username': uid, 'full_name': nama, 'roles': roles, 'is_active': True,
                              'token_version': 0, 'nip': f'NIP-{uid}'})

    c = TestClient(server.app)

    def minta(uid, peran, metode, path, **kw):
        headers = kw.pop('headers', {})
        if uid:
            headers['Authorization'] = f"Bearer {create_access_token({'sub': uid, 'active_role': peran, 'tv': 0})}"
        return c.request(metode, '/api' + path, headers=headers, **kw)
    minta.db = db
    return minta


def tambah_kelas_siswa(db, semester='sem-kini', kelas=(('k7a', '7A', 7), ('k8a', '8A', 8), ('k9a', '9A', 9)), per_kelas=4):
    """Rombel semester + siswa aktif per rombel. id siswa: s-<kelas>-<n>."""
    for kid, nama, grade in kelas:
        db.classes.docs.append({'id': kid, 'name': nama, 'grade': grade, 'semester_id': semester})
        for i in range(1, per_kelas + 1):
            db.users.docs.append({'id': f's-{kid}-{i}', 'username': f's-{kid}-{i}', 'full_name': f'Siswa {nama} {i}',
                                  'roles': ['siswa'], 'student_class_id': kid, 'is_active': True, 'nis': f'{grade}{i:03d}',
                                  'nisn': f'00{grade}{i:05d}', 'token_version': 0,
                                  'nomor_peserta_ujian': f'UM-{nama}-{i}' if grade == 9 else None})
