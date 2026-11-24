"""
Migration: index penyaringan jejak audit akses tautan publik ujian (ujian_akses_log)

Skema ada di ujian_info.py. Script ini (aman dijalankan berulang kali) memastikan index riwayat akses per ujian:
(ujian_id, waktu), (ujian_id, jenis_tautan, waktu), (ujian_id, hasil, waktu), dan (ujian_id, ip). Log lama tidak diubah;
tanpa aturan hapus arsip (tanpa TTL).

Jalankan dari folder backend:
    python migrations/migrate_ujian_akses_log.py [--dry-run]
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from ujian_info import INDEX_AKSES_LOG, KOLEKSI_AKSES_LOG

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


async def migrate(db, dry_run: bool = False) -> dict:
    """Dipanggil juga oleh migrasi_otomatis saat server start (sekali per database)."""
    if not dry_run:
        for koleksi, keys, opsi in INDEX_AKSES_LOG:
            await db[koleksi].create_index(keys, **opsi)
    return {'akses_log': await db[KOLEKSI_AKSES_LOG].count_documents({}), 'dry_run': dry_run}


async def main():
    dry = '--dry-run' in sys.argv
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        print(">>> Starting migration: ujian akses log" + (" (DRY RUN)" if dry else "") + "\n")
        print(f"[OK] {await migrate(client[DB_NAME], dry_run=dry)}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())
