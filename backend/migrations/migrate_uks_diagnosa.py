"""
Migration: siapkan koleksi master Penegakan Diagnosa UKS (uks_diagnosa)

Script ini:
1. Melengkapi dokumen lama: nama_key (nama huruf kecil untuk cek ganda),
   aktif (default True), dan urutan (default 0).
2. Melaporkan nama/kode ganda yang harus dirapikan manual sebelum index unik dibuat.
3. Membuat index uks_diagnosa (sama dengan yang dibuat otomatis saat server start).
4. Opsional: --seed-default mengisi daftar diagnosa umum UKS bila koleksi masih kosong.

Aman dijalankan berulang kali. Jalankan dari folder backend:
    python migrations/migrate_uks_diagnosa.py [--seed-default]
"""
import asyncio
import sys
import uuid
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


async def migrate(seed_default: bool = False):
    from routers.uks import DEFAULT_DIAGNOSA, bmhp_nama_key, ensure_uks_diagnosa_indexes

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print(">>> Starting migration: UKS Penegakan Diagnosa\n")

    docs = await db.uks_diagnosa.find(
        {'$or': [{'nama_key': {'$exists': False}}, {'aktif': {'$exists': False}}, {'urutan': {'$exists': False}}]}
    ).to_list(5000)
    for doc in docs:
        update = {}
        if 'nama_key' not in doc:
            update['nama_key'] = bmhp_nama_key(doc.get('nama'))
        if 'aktif' not in doc:
            update['aktif'] = True
        if 'urutan' not in doc:
            update['urutan'] = 0
        await db.uks_diagnosa.update_one({'_id': doc['_id']}, {'$set': update})
    print(f"[OK] {len(docs)} dokumen diagnosa dilengkapi (nama_key/aktif/urutan)")

    problems = []
    for field in ('nama_key', 'kode'):
        dupes = await db.uks_diagnosa.aggregate([
            {'$match': {field: {'$type': 'string', '$gt': ''}}},
            {'$group': {'_id': f'${field}', 'count': {'$sum': 1}}},
            {'$match': {'count': {'$gt': 1}}},
        ]).to_list(100)
        problems += [f"{field}={d['_id']} ({d['count']} dokumen)" for d in dupes]
    if problems:
        print("[WARN] Data ganda ditemukan, rapikan dulu sebelum index unik dibuat:")
        for p in problems:
            print(f"  - {p}")
        client.close()
        return

    gagal = await ensure_uks_diagnosa_indexes(db)
    if gagal:
        print("[WARN] Sebagian index gagal dibuat:")
        for g in gagal:
            print(f"  - {g}")
        client.close()
        return
    print("[OK] Index uks_diagnosa siap")

    if seed_default:
        if await db.uks_diagnosa.count_documents({}) > 0:
            print("[SKIP] Koleksi diagnosa sudah berisi data, seed default dilewati")
        else:
            now = datetime.utcnow().isoformat()
            rows = [{
                'id': str(uuid.uuid4()), **d, 'deskripsi': None, 'urutan': i + 1, 'aktif': True,
                'nama_key': bmhp_nama_key(d['nama']), 'created_by': 'migration', 'created_at': now, 'updated_at': now,
            } for i, d in enumerate(DEFAULT_DIAGNOSA)]
            await db.uks_diagnosa.insert_many(rows)
            print(f"[OK] {len(rows)} diagnosa default ditambahkan")

    client.close()


if __name__ == '__main__':
    asyncio.run(migrate(seed_default='--seed-default' in sys.argv))
