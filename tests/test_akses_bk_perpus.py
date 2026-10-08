"""Data konseling BK & daftar peminjaman/kunjungan perpustakaan tidak boleh dibaca sembarang akun login."""

import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from routers import bk, perpus  # noqa: E402


def _cek_user(router, path):
    """Dependency `user` (pemeriksa peran) milik endpoint GET path."""
    for r in router.routes:
        if getattr(r, 'path', None) == path and 'GET' in r.methods:
            for d in r.dependant.dependencies:
                if d.name == 'user':
                    return d.call
    raise AssertionError(f'route {path} tidak ditemukan')


def _u(active, roles=None):
    return {'id': 'u-1', 'active_role': active, 'roles': roles or [active]}


ENDPOINT = [
    (bk.router, '/bk/kunjungan', ('guru_bk', 'kepala_sekolah', 'waka_kesiswaan')),
    (bk.router, '/bk/kunjungan/{kunjungan_id}', ('guru_bk', 'kepala_sekolah', 'waka_kesiswaan')),
    (bk.router, '/bk/sekolah-lanjutan', ('guru_bk', 'kepala_sekolah', 'waka_kesiswaan')),
    (bk.router, '/bk/home-visit', ('guru_bk',)),
    (perpus.router, '/perpus/peminjaman', ('perpustakaan', 'kepala_sekolah')),
    (perpus.router, '/perpus/kunjungan', ('perpustakaan', 'kepala_sekolah')),
]


@pytest.mark.parametrize('router,path,boleh', ENDPOINT)
async def test_peran_yang_berhak(router, path, boleh):
    cek = _cek_user(router, path)
    for role in boleh:
        assert await cek(_u(role))
    assert await cek(_u('guru', ['guru', 'admin']))  # admin di roles selalu boleh


@pytest.mark.parametrize('router,path,boleh', ENDPOINT)
async def test_siswa_dan_guru_ditolak(router, path, boleh):
    cek = _cek_user(router, path)
    for role in ('siswa', 'guru', 'wali_kelas'):
        with pytest.raises(HTTPException) as e:
            await cek(_u(role))
        assert e.value.status_code == 403
