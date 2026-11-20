"""
Migration: siapkan koleksi modul Ujian Madrasah (ujian, panitia_ujian, formulir_ujian)

Skema ada di ujian.py. Script ini (aman dijalankan berulang kali):
1. Membuat index: ujian.id (unik), (semester_id, mulai), panitia_ujian.id (unik), (ujian_id, jabatan) unik,
   (ujian_id, user_id) unik, (user_id), dan formulir_ujian.ujian_id (unik).
2. Melengkapi ujian lama tanpa `semester_nama`/`tahun_pelajaran` dari data semester & tahun pelajaran.

Jalankan dari folder backend:
    python migrations/migrate_ujian.py [--dry-run]
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from ujian import KOLEKSI_FORMULIR, KOLEKSI_PANITIA, KOLEKSI_UJIAN, pastikan_index_ujian

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


async def migrate(db, dry_run: bool = False) -> dict:
    """Dipanggil juga oleh migrasi_otomatis saat server start (sekali per database)."""
    if not dry_run:
        await pastikan_index_ujian(db)
    dilengkapi = 0
    lama = await db[KOLEKSI_UJIAN].find(
        {'$or': [{'semester_nama': {'$exists': False}}, {'tahun_pelajaran': {'$exists': False}}]},
        {'_id': 0, 'id': 1, 'semester_id': 1},
    ).to_list(10000)
    for u in lama:
        sem = await db.semesters.find_one({'id': u.get('semester_id')}, {'_id': 0, 'name': 1, 'academic_year_id': 1}) or {}
        tp = await db.academic_years.find_one({'id': sem.get('academic_year_id')}, {'_id': 0, 'name': 1}) or {}
        if not dry_run:
            await db[KOLEKSI_UJIAN].update_one({'id': u['id']}, {'$set': {
                'semester_nama': sem.get('name'), 'academic_year_id': sem.get('academic_year_id'), 'tahun_pelajaran': tp.get('name'),
            }})
        dilengkapi += 1
    return {
        'ujian': await db[KOLEKSI_UJIAN].count_documents({}),
        'panitia': await db[KOLEKSI_PANITIA].count_documents({}),
        'formulir': await db[KOLEKSI_FORMULIR].count_documents({}),
        'semester_dilengkapi': dilengkapi,
        'dry_run': dry_run,
    }


async def main():
    dry = '--dry-run' in sys.argv
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        print(">>> Starting migration: ujian madrasah" + (" (DRY RUN)" if dry else "") + "\n")
        print(f"[OK] {await migrate(client[DB_NAME], dry_run=dry)}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())
