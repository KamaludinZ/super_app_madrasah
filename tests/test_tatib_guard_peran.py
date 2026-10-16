"""Guard peran: setiap endpoint tatib (routers/tatib.py, tatib_poin.py, tatib_tindakan.py) dibatasi per peran —
lewat dependency penjaga (wajib_akses/wajib_wali_kelas/require_role) atau pembatasan cakupan di dalam endpoint
(batasi_query_tatib: siswa miliknya, wali kelas kelasnya, peran tanpa akses 403). Tidak ada yang sekadar login."""

import inspect
import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from routers import tatib, tatib_poin, tatib_tindakan  # noqa: E402

PENJAGA = ('wajib_akses', 'wajib_wali_kelas', 'require_role')


def _semua_rute():
    for modul in (tatib, tatib_poin, tatib_tindakan):
        for route in modul.router.routes:
            for method in route.methods:
                yield modul.__name__, method, route


def _berpenjaga(route) -> bool:
    calls = [d.call for d in route.dependant.dependencies]
    if any(any(p in (c.__qualname__ or '') for p in PENJAGA) for c in calls):
        return True
    return 'batasi_query_tatib' in inspect.getsource(route.endpoint)


def test_semua_rute_tatib_berpenjaga_peran():
    rute = list(_semua_rute())
    assert len(rute) > 40, 'router tatib tidak termuat lengkap'
    tanpa = [f'{m} {r.path} ({mod})' for mod, m, r in rute if not _berpenjaga(r)]
    assert tanpa == [], f'endpoint tanpa penjaga peran: {tanpa}'


def test_semua_rute_tulis_hanya_peran_input_atau_admin():
    for mod, method, route in _semua_rute():
        if method == 'GET':
            continue
        calls = [d.call for d in route.dependant.dependencies]
        nama = [c.__qualname__ for c in calls]
        tulis_input = tatib_poin.wajib_input_tatib in calls
        admin = any('require_role' in n and any(cell.cell_contents == ('admin',) for cell in (c.__closure__ or []))
                    for n, c in zip(nama, calls))
        assert tulis_input or admin, f'{method} {route.path} ({mod}) boleh ditulis peran non-input'


PERAN = {
    'admin': 'input', 'guru_tata_tertib': 'input', 'waka_kesiswaan': 'input',
    'guru_bk': 'lihat', 'kepala_sekolah': 'lihat', 'penjamin_mutu': 'lihat', 'kepala_tata_usaha': 'lihat', 'waka_kurikulum': 'lihat',
    'wali_kelas': 'kelas', 'siswa': 'pribadi',
    'guru_mapel': None, 'guru_piket': None, 'staf_gtk': None, 'tenaga_kependidikan': None,
}


@pytest.mark.parametrize('peran,akses', PERAN.items())
async def test_penjaga_akses_per_peran(peran, akses):
    user = {'id': 'x', 'roles': [peran], 'active_role': peran}
    assert tatib_poin.akses_tatib(user) == akses
    harapan = {
        tatib_poin.wajib_input_tatib: akses == 'input',
        tatib_poin.wajib_lihat_tatib: akses in ('input', 'lihat'),
        tatib_poin.wajib_akses_tatib: akses is not None,
    }
    for penjaga, boleh in harapan.items():
        if boleh:
            assert await penjaga(user)
        else:
            with pytest.raises(HTTPException) as e:
                await penjaga(user)
            assert e.value.status_code == 403
    query = {}
    if akses in ('input', 'lihat'):
        assert await tatib_poin.batasi_query_tatib(user, query) == {}
    elif akses == 'pribadi':
        assert (await tatib_poin.batasi_query_tatib(user, query))['siswa_id'] == {'$in': ['x']}
        with pytest.raises(HTTPException):
            await tatib_poin.batasi_query_tatib(user, {'siswa_id': 'orang-lain'})
    elif akses is None:
        with pytest.raises(HTTPException) as e:
            await tatib_poin.batasi_query_tatib(user, query)
        assert e.value.status_code == 403


async def test_admin_di_roles_tetap_input_walau_peran_aktif_lain():
    user = {'id': 'x', 'roles': ['admin', 'guru_mapel'], 'active_role': 'guru_mapel'}
    assert tatib_poin.akses_tatib(user) == 'input'
    assert await tatib_poin.wajib_input_tatib(user)
