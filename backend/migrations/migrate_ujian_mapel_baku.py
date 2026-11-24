"""
Migration: seed master 15 mata pelajaran baku ujian untuk jenjang 7, 8, dan 9 (koleksi ujian_mapel_baku, 45 baris)

Daftar & urutan dari ujian_info.MAPEL_UJIAN_BAKU (sama dengan frontend/src/lib/mapelUjian.js). Aman dijalankan berulang
kali: index (jenjang, kode) unik, dan baris yang sudah ada TIDAK diubah ($setOnInsert) sehingga penyesuaian admin
(nama/aktif) tetap terjaga. Tidak ada data yang dihapus.

Jalankan dari folder backend:
    python migrations/migrate_ujian_mapel_baku.py [--dry-run]
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from ujian_info import seed_mapel_baku

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


async def migrate(db, dry_run: bool = False) -> dict:
    """Dipanggil juga oleh migrasi_otomatis saat server start (sekali per database)."""
    return {**await seed_mapel_baku(db, dry_run=dry_run), 'dry_run': dry_run}


async def main():
    dry = '--dry-run' in sys.argv
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        print(">>> Starting migration: seed 15 mapel baku ujian x 3 jenjang" + (" (DRY RUN)" if dry else "") + "\n")
        print(f"[OK] {await migrate(client[DB_NAME], dry_run=dry)}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())
