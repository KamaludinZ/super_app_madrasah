"""
Migration: siapkan koleksi Izin Kamad (izin_kamad, izin_kamad_catatan)

Skema ada di izin_kamad.py. Script ini (aman dijalankan berulang kali):
1. Membuat index: izin_kamad.id (unik), (pengaju_id, dibuat_pada), (status, tanggal, jam_mulai),
   (status, diputuskan_pada), izin_kamad_catatan.id (unik), dan (izin_id, dibuat_pada).
2. Melengkapi izin lama tanpa status menjadi 'menunggu'.

Koleksi gtk_izin (izin harian GTK untuk rekap kehadiran) tidak disentuh.

Jalankan dari folder backend:
    python migrations/migrate_izin_kamad.py
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from izin_kamad import KOLEKSI_CATATAN, KOLEKSI_IZIN, STATUS_MENUNGGU, pastikan_index_izin_kamad

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


async def migrate(db) -> dict:
    """Dipanggil juga oleh migrasi_otomatis saat server start (sekali per database)."""
    await pastikan_index_izin_kamad(db)
    tanpa_status = await db[KOLEKSI_IZIN].update_many({'status': {'$exists': False}}, {'$set': {'status': STATUS_MENUNGGU}})
    return {
        'izin': await db[KOLEKSI_IZIN].count_documents({}),
        'catatan': await db[KOLEKSI_CATATAN].count_documents({}),
        'status_dilengkapi': tanpa_status.modified_count,
    }


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        print(">>> Starting migration: izin kamad\n")
        print(f"[OK] {await migrate(client[DB_NAME])}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())
