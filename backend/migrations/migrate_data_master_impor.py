"""
Migration: siapkan koleksi riwayat impor pelengkapan data master

Script ini:
1. Membuat koleksi data_master_impor (sesi impor), data_master_impor_perubahan
   (jejak audit per field), dan data_master_impor_baris (hasil per baris) bila belum ada.
2. Membuat index (sama dengan yang dibuat otomatis saat server start).
3. Melaporkan jumlah dokumen yang ada.

Aman dijalankan berulang kali. Jalankan dari folder backend:
    python migrations/migrate_data_master_impor.py
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


async def migrate():
    from data_master_impor import KOLEKSI_BARIS, KOLEKSI_IMPOR, KOLEKSI_PERUBAHAN, ensure_data_master_impor_indexes

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    print(">>> Starting migration: riwayat impor data master\n")

    ada = set(await db.list_collection_names())
    for nama in (KOLEKSI_IMPOR, KOLEKSI_PERUBAHAN, KOLEKSI_BARIS):
        if nama not in ada:
            await db.create_collection(nama)
            print(f"[OK] Koleksi {nama} dibuat")
        else:
            print(f"[SKIP] Koleksi {nama} sudah ada")

    gagal = await ensure_data_master_impor_indexes(db)
    if gagal:
        print("[WARN] Sebagian index gagal dibuat:")
        for g in gagal:
            print(f"  - {g}")
    else:
        print("[OK] Index riwayat impor siap")

    for nama in (KOLEKSI_IMPOR, KOLEKSI_PERUBAHAN, KOLEKSI_BARIS):
        print(f"[INFO] {nama}: {await db[nama].count_documents({})} dokumen")
    client.close()


if __name__ == '__main__':
    asyncio.run(migrate())
