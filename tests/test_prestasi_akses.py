"""Hak akses Data Prestasi per peran: siapa yang memproses ajuan prestasi & milik siapa prestasi yang disetujui."""

import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from routers import prestasi_akses, verval  # noqa: E402
from routers.prestasi_akses import pemegang_siswa_ajuan, peran_prestasi, rapikan_pemegang  # noqa: E402


def _u(active, roles=None, uid='u-1'):
    return {'id': uid, 'active_role': active, 'roles': roles or [active], 'homeroom_class_id': 'c-1'}


def test_peran_prestasi():
    assert peran_prestasi(_u('guru', ['guru', 'admin'])) == 'admin'
    assert peran_prestasi(_u('waka_kesiswaan', ['guru', 'waka_kesiswaan', 'wali_kelas'])) == 'kesiswaan'
    assert peran_prestasi(_u('wali_kelas', ['guru', 'wali_kelas'])) == 'wali_kelas'
    assert peran_prestasi(_u('kepala_sekolah')) == 'viewer'
    assert peran_prestasi(_u('guru_bk')) == 'viewer'
    assert peran_prestasi(_u('siswa')) is None


def test_pemegang_siswa_ajuan():
    sendiri = {'request_type': 'prestasi_create', 'user_type': 'siswa', 'user_id': 's-1', 'new_data': {'holder_type': 'siswa', 'holder_id': 's-1'}}
    atas_nama = {'request_type': 'prestasi_create', 'user_type': 'guru', 'user_id': 'g-1', 'new_data': {'holder_type': 'siswa', 'holder_id': 's-2'}}
    guru = {'request_type': 'prestasi_create', 'user_type': 'guru', 'user_id': 'g-1', 'new_data': {'holder_type': 'guru', 'holder_id': 'g-1'}}
    profil = {'request_type': 'profile_update', 'user_type': 'siswa', 'user_id': 's-3'}
    assert pemegang_siswa_ajuan(sendiri) == 's-1'
    assert pemegang_siswa_ajuan(atas_nama) == 's-2'
    assert pemegang_siswa_ajuan(guru) is None
    assert pemegang_siswa_ajuan(profil) == 's-3'


def test_rapikan_pemegang():
    assert rapikan_pemegang({'holder_type': 'siswa', 'holder_id': 's-2'}, 'g-1') == {'holder_type': 'siswa', 'student_id': 's-2', 'holder_id': None}
    # Dulu prestasi guru ikut tercatat sebagai student_id milik guru.
    assert rapikan_pemegang({'holder_type': 'guru'}, 'g-1') == {'holder_type': 'guru', 'holder_id': 'g-1', 'student_id': None}
    assert rapikan_pemegang({'holder_type': 'madrasah', 'holder_id': 'x'}, 'g-1')['holder_id'] is None


@pytest.fixture
def kelas_wali(monkeypatch):
    async def fake(user):
        return ['s-1']
    monkeypatch.setattr(verval, 'siswa_kelas_wali', fake)
    monkeypatch.setattr(prestasi_akses, 'siswa_kelas_wali', fake)


PRESTASI_SISWA = {'request_type': 'prestasi_create', 'user_type': 'siswa', 'user_id': 's-1', 'new_data': {'holder_type': 'siswa', 'holder_id': 's-1'}}
PRESTASI_GURU = {'request_type': 'prestasi_create', 'user_type': 'guru', 'user_id': 'g-9', 'new_data': {'holder_type': 'guru', 'holder_id': 'g-9'}}
PROFIL_SISWA = {'request_type': 'profile_update', 'user_type': 'siswa', 'user_id': 's-1'}


async def test_kesiswaan_hanya_prestasi_siswa(kelas_wali):
    k = _u('waka_kesiswaan', ['guru', 'waka_kesiswaan'])
    assert await verval._cek_peninjau(k, PRESTASI_SISWA) == 'waka_kesiswaan'
    for req in (PRESTASI_GURU, PROFIL_SISWA):
        with pytest.raises(HTTPException) as e:
            await verval._cek_peninjau(k, req)
        assert e.value.status_code == 403


async def test_wali_kelas_hanya_siswa_kelasnya(kelas_wali):
    w = _u('wali_kelas', ['guru', 'wali_kelas'])
    assert await verval._cek_peninjau(w, PRESTASI_SISWA) == 'wali_kelas'
    assert await verval._cek_peninjau(w, PROFIL_SISWA) == 'wali_kelas'
    lain = {**PRESTASI_SISWA, 'user_id': 's-7', 'new_data': {'holder_type': 'siswa', 'holder_id': 's-7'}}
    for req in (lain, PRESTASI_GURU):
        with pytest.raises(HTTPException):
            await verval._cek_peninjau(w, req)


async def test_admin_semua(kelas_wali):
    a = _u('guru', ['guru', 'admin'])
    for req in (PRESTASI_SISWA, PRESTASI_GURU, PROFIL_SISWA):
        assert await verval._cek_peninjau(a, req) == 'admin'
