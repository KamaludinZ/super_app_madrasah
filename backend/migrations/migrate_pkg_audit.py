"""
Migration: lengkapi koleksi jejak audit PKG (pkg_audit_log) untuk daftar tersaring & terurut.

Skema & index ada di pkg_audit.py. Script ini (aman dijalankan berulang kali):
1. Membuat index pkg_audit_log (pkg_audit.INDEX_AUDIT).
2. Mengisi field turunan pada entri lama yang belum memilikinya: kategori (dari kode aksi), guru_id & periode_id
   (dari metadata), penilaian_id (dari metadata bila kosong), dan waktu_urut (terakhir atau timestamp).

Jalankan dari folder backend:
    python migrations/migrate_pkg_audit.py
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from pkg_audit import ensure_pkg_audit_indexes, kategori_aksi
from pkg_skema import KOLEKSI_AUDIT

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


def field_turunan(doc: dict) -> dict:
    meta = doc.get('metadata') or {}
    return {
        'kategori': kategori_aksi(doc.get('aksi') or ''),
        'guru_id': doc.get('guru_id') or meta.get('guru_id'),
        'periode_id': doc.get('periode_id') or meta.get('periode_id'),
        'penilaian_id': doc.get('penilaian_id') or meta.get('penilaian_id'),
        'waktu_urut': doc.get('terakhir') or doc.get('timestamp'),
    }


async def migrate(db) -> dict:
    """Dipanggil juga oleh migrasi_otomatis saat server start (sekali per database)."""
    gagal = await ensure_pkg_audit_indexes(db)
    if gagal:
        raise RuntimeError(f'index jejak audit PKG gagal: {gagal}')
    docs = await db[KOLEKSI_AUDIT].find(
        {'$or': [{'kategori': {'$exists': False}}, {'waktu_urut': {'$exists': False}}]},
        {'_id': 0, 'id': 1, 'aksi': 1, 'metadata': 1, 'guru_id': 1, 'periode_id': 1, 'penilaian_id': 1,
         'terakhir': 1, 'timestamp': 1}).to_list(None)
    diisi = 0
    for doc in docs:
        if not doc.get('id'):
            continue
        hasil = await db[KOLEKSI_AUDIT].update_one({'id': doc['id']}, {'$set': field_turunan(doc)})
        diisi += hasil.modified_count
    return {'diperiksa': len(docs), 'diisi': diisi}


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        print(">>> Starting migration: pkg audit\n")
        print(f"[OK] {await migrate(client[DB_NAME])}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())
