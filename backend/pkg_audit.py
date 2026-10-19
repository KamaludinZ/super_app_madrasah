"""Jejak audit modul PKG (koleksi pkg_audit_log), terpisah dari audit_logs umum.

    pkg_audit_log  {id, penilaian_id, aksi, aktor_id, aktor_nama, aktor_peran, metadata, ip_address,
                    timestamp (UTC ISO), tanggal (WIB 'YYYY-MM-DD'), jumlah, terakhir}

`catat_audit_pkg` menulis satu entri per aksi (penilaian, instrumen, unduhan). Aksi yang bisa berulang
cepat (membuka beranda, penolakan akses) memakai `catat_audit_pkg_harian`: satu entri per aktor per
hari per kunci, dengan `jumlah` dan `terakhir` diperbarui agar log tidak membanjir.
Galat audit dicatat ke logger dan tidak pernah menggagalkan permintaan.
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from pkg_skema import KOLEKSI_AUDIT

logger = logging.getLogger('matsandatama')

WIB = timezone(timedelta(hours=7))

AKSI_BUKA_BERANDA = 'buka_beranda'
AKSI_TOLAK_AKSES = 'tolak_akses'


async def ensure_pkg_audit_indexes(database) -> List[str]:
    gagal = []
    for keys, kwargs in [
        ([('timestamp', -1)], {'name': 'waktu'}),
        ([('penilaian_id', 1), ('timestamp', -1)], {'name': 'penilaian_waktu'}),
        ([('aktor_id', 1), ('aksi', 1), ('tanggal', 1), ('kunci', 1)], {'name': 'harian'}),
    ]:
        try:
            await database[KOLEKSI_AUDIT].create_index(keys, **kwargs)
        except Exception as e:  # noqa: BLE001
            gagal.append(f"{KOLEKSI_AUDIT} {keys}: {e}")
            logger.error(f"[pkg_audit] Gagal membuat index {keys}: {e}")
    return gagal


def _dasar(aksi: str, aktor: Optional[Dict[str, Any]], metadata: Optional[Dict[str, Any]],
           penilaian_id: Optional[str], request) -> Dict[str, Any]:
    sekarang = datetime.now(timezone.utc)
    aktor = aktor or {}
    return {
        'id': str(uuid.uuid4()),
        'penilaian_id': penilaian_id,
        'aksi': aksi,
        'aktor_id': aktor.get('id'),
        'aktor_nama': aktor.get('full_name') or aktor.get('username'),
        'aktor_peran': aktor.get('active_role'),
        'metadata': metadata or {},
        'ip_address': request.client.host if request is not None and getattr(request, 'client', None) else None,
        'timestamp': sekarang.isoformat(),
        'tanggal': sekarang.astimezone(WIB).strftime('%Y-%m-%d'),
    }


async def catat_audit_pkg(db, aksi: str, aktor: Optional[Dict[str, Any]], metadata: Optional[Dict[str, Any]] = None,
                          penilaian_id: Optional[str] = None, request=None) -> None:
    try:
        await db[KOLEKSI_AUDIT].insert_one(_dasar(aksi, aktor, metadata, penilaian_id, request))
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[pkg_audit] gagal mencatat {aksi}: {e}")


async def catat_audit_pkg_harian(db, aksi: str, aktor: Optional[Dict[str, Any]], kunci: str = '',
                                 metadata: Optional[Dict[str, Any]] = None, request=None) -> None:
    """Satu entri per (aktor, aksi, tanggal WIB, kunci); kunjungan berikutnya menaikkan `jumlah`."""
    try:
        doc = _dasar(aksi, aktor, metadata, None, request)
        saring = {'aktor_id': doc['aktor_id'], 'aksi': aksi, 'tanggal': doc['tanggal'], 'kunci': kunci}
        await db[KOLEKSI_AUDIT].update_one(
            saring,
            {
                '$setOnInsert': {k: v for k, v in doc.items() if k not in saring and k != 'ip_address'},
                '$set': {'terakhir': doc['timestamp'], 'ip_address': doc['ip_address']},
                '$inc': {'jumlah': 1},
            },
            upsert=True,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[pkg_audit] gagal mencatat {aksi}: {e}")
