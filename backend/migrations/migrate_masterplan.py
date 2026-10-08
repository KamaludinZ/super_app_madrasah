"""
Migration: siapkan koleksi Masterplan / Denah Sekolah (masterplan_denah, masterplan_marker)

Script ini (aman dijalankan berulang kali):
1. Index unik masterplan_denah.id (satu denah aktif ber-id 'aktif').
2. Index unik masterplan_marker.id dan (denah_id, room_id) — satu penanda per ruang.
3. Menyiapkan subfolder unggahan `masterplan` di penyimpanan terpusat.

Jalankan dari folder backend:
    python migrations/migrate_masterplan.py
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from penyimpanan import folder_unggahan

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


async def migrate(db) -> dict:
    """Dipanggil juga oleh migrasi_otomatis saat server start (sekali per database)."""
    await db['masterplan_denah'].create_index([('id', 1)], unique=True)
    await db['masterplan_marker'].create_index([('id', 1)], unique=True)
    await db['masterplan_marker'].create_index([('denah_id', 1), ('room_id', 1)], unique=True)
    folder_unggahan('masterplan')
    return {
        'denah': await db['masterplan_denah'].count_documents({}),
        'penanda': await db['masterplan_marker'].count_documents({}),
    }


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        print(">>> Starting migration: masterplan")
        print(f"[OK] {await migrate(client[DB_NAME])}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())
