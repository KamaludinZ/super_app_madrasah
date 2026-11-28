"""Pencatatan galat untuk tab "Errors" di /admin/audit-logs.

Dua sumber, disimpan di `audit_logs` dengan action='error' (format lama tab Errors tetap dipakai):
  - server : pengecualian tak tertangani di backend (respons 500). Dicatat otomatis oleh penangan galat global di
             server.py beserta traceback & kode galat pendek yang juga dikirim ke pengguna.
  - browser: permintaan yang tidak pernah sampai/dijawab backend (koneksi terputus, diblokir Cloudflare/proxy, 502/503/504
             dari proxy). Galat ini tidak terlihat di backend, jadi frontend melaporkannya lewat POST /admin/error-logs/klien.
Pencatatan tidak pernah boleh menggagalkan respons: semua galat saat mencatat ditelan (hanya ditulis ke logger).
"""
import logging
import secrets
import time
import traceback
from typing import Any, Dict, Optional

from fastapi import Request

logger = logging.getLogger('matsandatama')

MAKS_PESAN = 1000
MAKS_TRACEBACK = 8000
BATAS_LAPORAN_KLIEN = 30          # laporan browser per pengguna per jendela
JENDELA_LAPORAN_DETIK = 300
_jejak_laporan: Dict[str, list] = {}


def kode_galat() -> str:
    """Kode pendek (mis. 'G-7F3K9Q') untuk mencocokkan laporan pengguna dengan baris di tab Errors."""
    return 'G-' + secrets.token_hex(3).upper()


def ip_klien(request: Optional[Request]) -> Optional[str]:
    """IP asli pengguna di balik Cloudflare/proxy (CF-Connecting-IP, X-Forwarded-For), lalu IP koneksi."""
    if request is None:
        return None
    h = request.headers
    ip = h.get('cf-connecting-ip') or (h.get('x-forwarded-for') or '').split(',')[0].strip() or h.get('x-real-ip')
    return ip or (request.client.host if request.client else None)


def _pengguna_dari_token(request: Request) -> Dict[str, Any]:
    try:
        from auth_utils import decode_token
        auth = request.headers.get('authorization') or ''
        payload = decode_token(auth.split(' ', 1)[1]) if auth.lower().startswith('bearer ') else None
        return {'id': (payload or {}).get('sub'), 'peran': (payload or {}).get('active_role')}
    except Exception:
        return {}


async def simpan_galat(db, details: Dict[str, Any], user_id: Optional[str] = None, username: Optional[str] = None,
                       request: Optional[Request] = None) -> None:
    from models import AuditLogModel
    log = AuditLogModel(user_id=user_id, username=username, action='error', entity='system', details=details,
                        ip_address=ip_klien(request), user_agent=(request.headers.get('user-agent') if request else None))
    doc = log.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.audit_logs.insert_one(doc)


async def catat_galat_server(db, request: Request, exc: BaseException) -> str:
    """Catat pengecualian tak tertangani; mengembalikan kode galat untuk respons."""
    kode = kode_galat()
    try:
        tb = ''.join(traceback.format_exception(type(exc), exc, exc.__traceback__))
        pengguna = _pengguna_dari_token(request)
        username = None
        if pengguna.get('id'):
            u = await db.users.find_one({'id': pengguna['id']}, {'_id': 0, 'username': 1, 'full_name': 1})
            username = (u or {}).get('username') or (u or {}).get('full_name')
        await simpan_galat(db, {
            'sumber': 'server', 'kode': kode, 'error_type': type(exc).__name__, 'message': str(exc)[:MAKS_PESAN],
            'path': request.url.path, 'method': request.method, 'status': 500, 'peran': pengguna.get('peran'),
            'traceback': tb[-MAKS_TRACEBACK:],
        }, user_id=pengguna.get('id'), username=username, request=request)
    except Exception as e:  # pragma: no cover - jangan sampai pencatatan menggagalkan respons
        logger.error(f"Gagal mencatat galat ke audit_logs: {e}")
    return kode


def boleh_lapor(kunci: str, sekarang: Optional[float] = None) -> bool:
    """Batasi laporan galat browser per pengguna (cegah banjir log)."""
    t = time.time() if sekarang is None else sekarang
    jejak = [x for x in _jejak_laporan.get(kunci, []) if t - x < JENDELA_LAPORAN_DETIK]
    if len(jejak) >= BATAS_LAPORAN_KLIEN:
        _jejak_laporan[kunci] = jejak
        return False
    jejak.append(t)
    _jejak_laporan[kunci] = jejak
    return True
