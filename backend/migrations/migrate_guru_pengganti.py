"""
Migration: siapkan koleksi penugasan Guru Pengganti (substitute_assignments)

Skema dokumen (lihat SubstituteAssignmentModel di models.py), satu dokumen per (jadwal, tanggal):
    id, schedule_id, semester_id, date (YYYY-MM-DD), day, original_teacher_id,
    substitute_teacher_id, reason, status ('active' | 'cancelled'),
    assigned_by_user_id, assigned_by_role, assigned_by_name, assigned_at,
    created_at, cancelled_at, cancelled_by_user_id

Script ini:
1. Membuat index koleksi (sama dengan yang dibuat otomatis saat server start),
   termasuk index unik parsial (schedule_id, date) untuk penugasan berstatus 'active'.
2. Melengkapi dokumen lama: status 'active' bila belum ada.
3. Melaporkan penugasan aktif ganda (slot & tanggal sama) yang harus dirapikan manual
   sebelum index unik bisa dibuat.

Aman dijalankan berulang kali. Jalankan dari folder backend:
    python migrations/migrate_guru_pengganti.py
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
    from routers.guru_pengganti import ASSIGNMENTS, ensure_substitute_assignment_indexes

    coll = db[ASSIGNMENTS]
    res = await coll.update_many({'status': {'$exists': False}}, {'$set': {'status': 'active'}})
    dupes = await coll.aggregate([
        {'$match': {'status': 'active'}},
        {'$group': {'_id': {'schedule_id': '$schedule_id', 'date': '$date'}, 'n': {'$sum': 1}}},
        {'$match': {'n': {'$gt': 1}}},
    ]).to_list(1000)
    gagal = await ensure_substitute_assignment_indexes(db)
    return {
        'status_diisi': res.modified_count,
        'ganda': [f"{d['_id']['schedule_id']} {d['_id']['date']} ({d['n']}x)" for d in dupes],
        'index_gagal': gagal,
        'total': await coll.count_documents({}),
    }


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    print(">>> Starting migration: Guru Pengganti (substitute_assignments)")
    print()
    hasil = await migrate(client[DB_NAME])
    print(f"[OK] status diisi 'active' untuk {hasil['status_diisi']} dokumen")
    for g in hasil['ganda']:
        print(f"[!] Penugasan aktif ganda (rapikan manual): {g}")
    for g in hasil['index_gagal']:
        print(f"[!] Index gagal dibuat: {g}")
    if not hasil['index_gagal']:
        print("[OK] Index substitute_assignments siap")
    print()
    print(f"Total penugasan: {hasil['total']}")
    client.close()


if __name__ == '__main__':
    asyncio.run(main())
