"""Format galat validasi masukan (HTTP 422) untuk endpoint PKG.

Galat bawaan FastAPI berupa daftar teknis berbahasa Inggris. Untuk path /api/pkg/* galat diubah menjadi
detail {pesan, galat: [{lokasi, pesan}]} berbahasa Indonesia (bentuk yang sama dengan galat impor instrumen),
sehingga frontend PKG cukup menampilkan `detail.pesan`. Path lain tetap memakai penangan bawaan FastAPI.
"""
from typing import Any, Dict, List

from fastapi import FastAPI, Request
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

PREFIKS_PKG = '/api/pkg'
SUMBER = {'body': 'isian', 'query': 'parameter', 'path': 'alamat', 'header': 'header', 'cookie': 'cookie'}


def _pesan(g: Dict[str, Any]) -> str:
    jenis, ctx = g.get('type', ''), g.get('ctx') or {}
    teks = {
        'missing': 'wajib diisi',
        'extra_forbidden': 'field tidak dikenal',
        'string_pattern_mismatch': 'format tidak valid',
        'string_type': 'harus berupa teks',
        'int_parsing': 'harus berupa angka bulat',
        'int_type': 'harus berupa angka bulat',
        'float_parsing': 'harus berupa angka',
        'bool_parsing': 'harus bernilai true/false',
        'list_type': 'harus berupa daftar',
        'dict_type': 'harus berupa objek',
        'model_attributes_type': 'harus berupa objek',
        'json_invalid': 'JSON tidak valid',
    }.get(jenis)
    if teks:
        return teks
    if jenis == 'string_too_long':
        return f"maksimal {ctx.get('max_length')} karakter"
    if jenis == 'string_too_short':
        return f"minimal {ctx.get('min_length')} karakter"
    if jenis == 'too_long':
        return f"maksimal {ctx.get('max_length')} item"
    if jenis in ('greater_than_equal', 'greater_than'):
        return f"minimal {ctx.get('ge', ctx.get('gt'))}"
    if jenis in ('less_than_equal', 'less_than'):
        return f"maksimal {ctx.get('le', ctx.get('lt'))}"
    return str(g.get('msg') or 'tidak valid').replace('Value error, ', '')


def ringkas_galat(errors: List[Dict[str, Any]]) -> Dict[str, Any]:
    """{pesan, galat: [{lokasi, pesan}]} dari daftar galat Pydantic/FastAPI (maks. 50 rincian)."""
    galat = []
    for g in errors[:50]:
        loc = [str(x) for x in g.get('loc') or ()]
        sumber = SUMBER.get(loc[0], loc[0]) if loc else 'isian'
        jalur = '.'.join(loc[1:]) if len(loc) > 1 else sumber
        galat.append({'lokasi': jalur, 'pesan': _pesan(g)})
    if not galat:
        return {'pesan': 'Masukan tidak valid.', 'galat': []}
    pertama = galat[0]
    return {'pesan': f"Masukan tidak valid: {pertama['lokasi']} {pertama['pesan']}.", 'galat': galat}


async def penangan_validasi(request: Request, exc: RequestValidationError):
    if not request.url.path.startswith(PREFIKS_PKG):
        return await request_validation_exception_handler(request, exc)
    return JSONResponse(status_code=422, content={'detail': ringkas_galat(exc.errors())})


def pasang_penangan_validasi(app: FastAPI) -> None:
    app.add_exception_handler(RequestValidationError, penangan_validasi)
