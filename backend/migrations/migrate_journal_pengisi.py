"""
Migration: lengkapi field pengisi (kolom "diisi oleh") pada koleksi journals

Field pengisi jurnal:
    fill_mode         'self' | 'piket' | 'admin' | 'substitute'
    filled_by_user_id id pengguna yang mengisi
    filled_by_role    'guru' | 'guru_piket' | 'admin' | 'guru_pengganti'
    filled_by_name    snapshot nama pengisi saat diisi

Script ini (aman dijalankan berulang kali):
1. Mengisi fill_mode 'self' pada jurnal lama yang belum memilikinya.
2. Jurnal 'self' tanpa pengisi: filled_by_user_id = teacher_id, filled_by_role = 'guru'.
3. Mengisi filled_by_name dari users.full_name untuk semua jurnal yang belum memilikinya.

Jalankan dari folder backend:
    python migrations/migrate_journal_pengisi.py
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



def _kosong(field: str) -> dict:
    return {'$or': [{field: {'$exists': False}}, {field: None}]}


async def migrate(db) -> dict:
    """Dipanggil juga oleh migrasi_otomatis saat server start (sekali per database)."""
    mode = await db.journals.update_many(_kosong('fill_mode'), {'$set': {'fill_mode': 'self'}})
    pengisi = await db.journals.update_many(
        {'fill_mode': 'self', **_kosong('filled_by_user_id')},
        [{'$set': {'filled_by_user_id': '$teacher_id', 'filled_by_role': {'$ifNull': ['$filled_by_role', 'guru']}}}],
    )

    tanpa_nama = await db.journals.find(
        {**_kosong('filled_by_name'), 'filled_by_user_id': {'$type': 'string'}},
        {'_id': 1, 'filled_by_user_id': 1},
    ).to_list(None)
    ids = list({j['filled_by_user_id'] for j in tanpa_nama})
    nama = {
        u['id']: u.get('full_name') for u in await db.users.find(
            {'id': {'$in': ids}}, {'_id': 0, 'id': 1, 'full_name': 1}).to_list(len(ids) or 1)
    }
    diberi_nama = 0
    for j in tanpa_nama:
        n = nama.get(j['filled_by_user_id'])
        if n:
            await db.journals.update_one({'_id': j['_id']}, {'$set': {'filled_by_name': n}})
            diberi_nama += 1
    return {
        'fill_mode_diisi': mode.modified_count,
        'pengisi_diisi': pengisi.modified_count,
        'nama_diisi': diberi_nama,
        'nama_tidak_ditemukan': len(tanpa_nama) - diberi_nama,
    }


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    print(">>> Starting migration: field pengisi journals")
    hasil = await migrate(client[DB_NAME])
    for k, v in hasil.items():
        print(f"[OK] {k}: {v}")
    client.close()


if __name__ == '__main__':
    asyncio.run(main())
