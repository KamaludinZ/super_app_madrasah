"""
Migration: siapkan koleksi Simpan Akun (simpan_akun, simpan_akun_pin)

Skema ada di simpan_akun.py. Script ini (aman dijalankan berulang kali):
1. Membuat index: simpan_akun.id (unik), (user_id, nama_aplikasi, nama_akun),
   simpan_akun_pin.user_id (unik), dan reset_diminta_pada.
2. Melengkapi field PIN lama yang belum ada (gagal = 0, terkunci = False).

Jalankan dari folder backend:
    python migrations/migrate_simpan_akun.py
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from simpan_akun import KOLEKSI_AKUN, KOLEKSI_PIN, pastikan_index_simpan_akun

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


async def migrate(db) -> dict:
    """Dipanggil juga oleh migrasi_otomatis saat server start (sekali per database)."""
    await pastikan_index_simpan_akun(db)
    gagal = await db[KOLEKSI_PIN].update_many({'gagal': {'$exists': False}}, {'$set': {'gagal': 0}})
    terkunci = await db[KOLEKSI_PIN].update_many({'terkunci': {'$exists': False}}, {'$set': {'terkunci': False}})
    return {
        'akun': await db[KOLEKSI_AKUN].count_documents({}),
        'pin': await db[KOLEKSI_PIN].count_documents({}),
        'pin_dilengkapi': max(gagal.modified_count, terkunci.modified_count),
    }


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        print(">>> Starting migration: simpan akun\n")
        print(f"[OK] {await migrate(client[DB_NAME])}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())
