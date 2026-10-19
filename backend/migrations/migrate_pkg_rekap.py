"""
Migration: siapkan koleksi rekap PKG (pkg_rekap) dan isi dari lembar penilaian yang sudah terkunci.

Skema ada di pkg_skema.py, logika di pkg_rekap.py. Script ini (aman dijalankan berulang kali):
1. Membuat seluruh index koleksi PKG (termasuk pkg_rekap).
2. Membangun ulang baris rekap dari pkg_penilaian berstatus terkunci (baris yatim dihapus).

Jalankan dari folder backend:
    python migrations/migrate_pkg_rekap.py
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from pkg_rekap import bangun_ulang_rekap
from pkg_skema import ensure_pkg_indexes

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


async def migrate(db) -> dict:
    """Dipanggil juga oleh migrasi_otomatis saat server start (sekali per database)."""
    gagal = await ensure_pkg_indexes(db)
    if gagal:
        raise RuntimeError(f'index PKG gagal: {gagal}')
    return await bangun_ulang_rekap(db)


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        print(">>> Starting migration: pkg rekap\n")
        print(f"[OK] {await migrate(client[DB_NAME])}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())
