"""
Migration: siapkan koleksi Pengaturan Formulir modul Ujian (formulir_ujian, jadwal_ujian)

Skema ada di ujian_formulir.py. Script ini (aman dijalankan berulang kali):
1. Membuat formulir bawaan (nonaktif, token tautan publik acak, template bawaan) untuk ujian yang belum punya, dan
   melengkapi token pada formulir lama yang belum bertoken.
2. Membuat index: formulir_ujian.ujian_id (unik), formulir_ujian.token (unik parsial), jadwal_ujian.id (unik),
   (ujian_id, tanggal, sesi_ke) unik.

Jalankan dari folder backend:
    python migrations/migrate_ujian_formulir.py [--dry-run]
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from ujian import KOLEKSI_FORMULIR, KOLEKSI_UJIAN
from ujian_formulir import KOLEKSI_JADWAL, dokumen_formulir_baru, pastikan_index_formulir, token_baru

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


async def migrate(db, dry_run: bool = False) -> dict:
    """Dipanggil juga oleh migrasi_otomatis saat server start (sekali per database)."""
    pengaturan = await db.settings.find_one({'id': 'global_config'}, {'_id': 0}) or {}
    ada = set(await db[KOLEKSI_FORMULIR].distinct('ujian_id'))
    tanpa = [u for u in await db[KOLEKSI_UJIAN].find({}, {'_id': 0}).to_list(10000) if u['id'] not in ada]
    tanpa_token = await db[KOLEKSI_FORMULIR].find({'token': {'$exists': False}}, {'_id': 0, 'ujian_id': 1}).to_list(10000)
    if not dry_run:
        for u in tanpa:
            await db[KOLEKSI_FORMULIR].insert_one(dokumen_formulir_baru(u, pengaturan))
        for f in tanpa_token:
            await db[KOLEKSI_FORMULIR].update_one({'ujian_id': f['ujian_id']}, {'$set': {'token': token_baru()}})
        await pastikan_index_formulir(db)
    return {
        'formulir_dibuat': len(tanpa),
        'token_dilengkapi': len(tanpa_token),
        'jadwal': await db[KOLEKSI_JADWAL].count_documents({}),
        'dry_run': dry_run,
    }


async def main():
    dry = '--dry-run' in sys.argv
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        print(">>> Starting migration: ujian pengaturan formulir" + (" (DRY RUN)" if dry else "") + "\n")
        print(f"[OK] {await migrate(client[DB_NAME], dry_run=dry)}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())
