"""
Migration: kode ruang pada penanda Masterplan

Penanda kini memakai kode ruang (mis. R-07A) + nama ruang. Script ini (aman dijalankan berulang kali):
1. Index unik (denah_id, kode_ruang) hanya untuk penanda yang sudah punya kode
   (penanda lama tanpa kode tetap tampil dan dapat dilengkapi admin).
2. Melaporkan jumlah penanda yang belum memiliki kode.

Jalankan dari folder backend:
    python migrations/migrate_masterplan_kode.py
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


async def migrate(db) -> dict:
    """Dipanggil juga oleh migrasi_otomatis saat server start (sekali per database)."""
    await db['masterplan_marker'].create_index(
        [('denah_id', 1), ('kode_ruang', 1)],
        unique=True,
        partialFilterExpression={'kode_ruang': {'$type': 'string'}},
        name='denah_kode_ruang_unik',
    )
    tanpa_kode = await db['masterplan_marker'].count_documents({'kode_ruang': {'$not': {'$type': 'string'}}})
    return {'penanda_tanpa_kode': tanpa_kode}


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        print(">>> Starting migration: masterplan kode ruang")
        print(f"[OK] {await migrate(client[DB_NAME])}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())
