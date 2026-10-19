"""Dependency FastAPI penjaga akses modul PKG.

Pemakaian di router:
    @router.get('/pkg/...')
    async def endpoint(akses: Dict = Depends(penjaga_pkg('kepala'))):
        user, k = akses['user'], akses['keanggotaan']

Non-anggota SK aktif (atau yang tidak memenuhi syarat) ditolak HTTP 403 {'alasan', 'pesan'} dan penolakannya
tercatat di pkg_audit_log (satu entri per pengguna/endpoint/alasan per hari). Syarat: pkg_akses.SYARAT_AKSES.
"""
from typing import Dict

from fastapi import Depends, HTTPException, Request

from core import db, get_current_user
from pkg_akses import SYARAT_AKSES, wajib_akses
from pkg_audit import AKSI_TOLAK_AKSES, catat_audit_pkg_harian


def penjaga_pkg(syarat: str = 'anggota'):
    if syarat not in SYARAT_AKSES:
        raise ValueError(f'syarat akses tidak dikenal: {syarat}')

    async def penjaga(request: Request, user: Dict = Depends(get_current_user)) -> Dict:
        try:
            k = await wajib_akses(db, user, syarat)
        except HTTPException as e:
            alasan = e.detail.get('alasan') if isinstance(e.detail, dict) else None
            endpoint = request.url.path if request is not None else f'syarat:{syarat}'
            await catat_audit_pkg_harian(db, AKSI_TOLAK_AKSES, user, kunci=f'{endpoint}:{alasan}',
                                         metadata={'endpoint': endpoint, 'alasan': alasan, 'syarat': syarat},
                                         request=request)
            raise
        return {'user': user, 'keanggotaan': k}

    penjaga.__name__ = f'penjaga_pkg_{syarat}'
    return penjaga
