"""API pengelolaan PKG oleh kepala madrasah: SK & anggotanya (periode, pembagian, supervisi menyusul).

Semua endpoint memakai penjaga_pkg('kepala'): selain akun kepala madrasah ditolak 403 {'alasan': 'bukan_kepala'}
dan penolakannya tercatat. Setiap perubahan tercatat di pkg_audit_log.
"""
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, Request
from pymongo.errors import DuplicateKeyError

from core import db
from pkg_audit import catat_audit_pkg
from pkg_penjaga import penjaga_pkg
from pkg_sk import aktifkan_sk, ambil_sk, buat_sk, daftar_sk, hapus_sk, sk_tampil, ubah_sk
from pkg_skema import SkRequest

router = APIRouter()

kepala = penjaga_pkg('kepala')


def _ringkas_sk(sk: Dict) -> Dict:
    return {'sk_id': sk['id'], 'nomor_sk': sk.get('nomor_sk'), 'periode_id': sk.get('periode_id')}


@router.get("/pkg/sk")
async def daftar_sk_api(akses: Dict = Depends(kepala)):
    """Semua SK PKG (terbaru dulu) beserta tim penilai & guru yang dinilai."""
    return await daftar_sk(db)


@router.get("/pkg/sk/{sk_id}")
async def rincian_sk_api(sk_id: str, akses: Dict = Depends(kepala)):
    return await sk_tampil(db, await ambil_sk(db, sk_id))


@router.post("/pkg/sk")
async def buat_sk_api(data: SkRequest, request: Request, akses: Dict = Depends(kepala)):
    """Tambah SK. SK pertama pada periode langsung aktif; kepala pembuat otomatis menjadi penilai."""
    try:
        sk = await buat_sk(db, data, akses['user'])
    except DuplicateKeyError as e:
        raise HTTPException(409, 'Nomor SK sudah dipakai atau periode sudah memiliki SK aktif.') from e
    await catat_audit_pkg(db, 'sk_buat', akses['user'], {**_ringkas_sk(sk), 'is_active': sk['is_active']}, request=request)
    return await sk_tampil(db, sk)


@router.put("/pkg/sk/{sk_id}")
async def ubah_sk_api(sk_id: str, data: SkRequest, request: Request, akses: Dict = Depends(kepala)):
    try:
        sk = await ubah_sk(db, sk_id, data)
    except DuplicateKeyError as e:
        raise HTTPException(409, 'Nomor SK sudah dipakai SK lain.') from e
    await catat_audit_pkg(db, 'sk_ubah', akses['user'], _ringkas_sk(sk), request=request)
    return await sk_tampil(db, sk)


@router.post("/pkg/sk/{sk_id}/aktifkan")
async def aktifkan_sk_api(sk_id: str, request: Request, akses: Dict = Depends(kepala)):
    """Jadikan SK aktif pada periodenya; SK lain di periode yang sama dinonaktifkan."""
    sk = await aktifkan_sk(db, sk_id)
    await catat_audit_pkg(db, 'sk_aktifkan', akses['user'], _ringkas_sk(sk), request=request)
    return await sk_tampil(db, sk)


@router.delete("/pkg/sk/{sk_id}")
async def hapus_sk_api(sk_id: str, request: Request, akses: Dict = Depends(kepala)):
    """Hapus SK yang tidak aktif dan belum memiliki lembar penilaian."""
    sk = await hapus_sk(db, sk_id)
    await catat_audit_pkg(db, 'sk_hapus', akses['user'], _ringkas_sk(sk), request=request)
    return {'id': sk_id, 'dihapus': True}
