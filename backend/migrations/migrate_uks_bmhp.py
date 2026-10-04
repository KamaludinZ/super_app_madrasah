"""
Migration: siapkan koleksi BMHP (Bahan Medis Habis Pakai) UKS

Script ini:
1. Membuat index untuk uks_bmhp, uks_bmhp_masuk, dan uks_bmhp_keluar
   (sama dengan yang dibuat otomatis saat server start).
2. Melengkapi batch uks_bmhp_masuk lama: stok_sisa (= jumlah bila belum ada)
   dan bmhp_nama (dari master), karena stok dihitung dari stok_sisa tiap batch.
3. Melengkapi uks_bmhp_keluar lama: bmhp_nama (dari master) dan batch_alokasi
   (list kosong bila belum ada, artinya stok dikembalikan ke batch terdekat).
4. Mengisi field nama_key pada dokumen uks_bmhp lama yang belum memilikinya,
   dan melaporkan nama ganda yang harus dirapikan manual sebelum index unik bisa dibuat.

Aman dijalankan berulang kali. Jalankan dari folder backend:
    python migrations/migrate_uks_bmhp.py
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


async def migrate():
    from routers.uks import bmhp_nama_key, ensure_uks_bmhp_indexes

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print(">>> Starting migration: UKS BMHP collections\n")

    docs = await db.uks_bmhp.find({'nama_key': {'$exists': False}}).to_list(5000)
    for doc in docs:
        await db.uks_bmhp.update_one({'_id': doc['_id']}, {'$set': {'nama_key': bmhp_nama_key(doc.get('nama_bmhp'))}})
    print(f"[OK] nama_key diisi untuk {len(docs)} dokumen BMHP")

    masuk_docs = await db.uks_bmhp_masuk.find(
        {'$or': [{'stok_sisa': {'$exists': False}}, {'bmhp_nama': {'$exists': False}}]}
    ).to_list(10000)
    names = {b['id']: b.get('nama_bmhp') for b in await db.uks_bmhp.find({}, {'_id': 0, 'id': 1, 'nama_bmhp': 1}).to_list(5000)}
    for m in masuk_docs:
        update = {}
        if 'stok_sisa' not in m:
            update['stok_sisa'] = m.get('jumlah', 0)
        if 'bmhp_nama' not in m:
            update['bmhp_nama'] = names.get(m.get('bmhp_id'))
        await db.uks_bmhp_masuk.update_one({'_id': m['_id']}, {'$set': update})
    print(f"[OK] {len(masuk_docs)} batch BMHP masuk dilengkapi (stok_sisa/bmhp_nama)")

    keluar_docs = await db.uks_bmhp_keluar.find(
        {'$or': [{'bmhp_nama': {'$exists': False}}, {'batch_alokasi': {'$exists': False}}]}
    ).to_list(20000)
    for k in keluar_docs:
        update = {}
        if 'bmhp_nama' not in k:
            update['bmhp_nama'] = names.get(k.get('bmhp_id'))
        if 'batch_alokasi' not in k:
            update['batch_alokasi'] = []
        await db.uks_bmhp_keluar.update_one({'_id': k['_id']}, {'$set': update})
    print(f"[OK] {len(keluar_docs)} catatan BMHP keluar dilengkapi (bmhp_nama/batch_alokasi)")

    dupes = await db.uks_bmhp.aggregate([
        {'$group': {'_id': '$nama_key', 'count': {'$sum': 1}}},
        {'$match': {'count': {'$gt': 1}}},
    ]).to_list(100)
    if dupes:
        print("[WARN] Nama BMHP ganda ditemukan, rapikan dulu sebelum index unik dibuat:")
        for d in dupes:
            print(f"  - {d['_id']} ({d['count']} dokumen)")
        client.close()
        return

    gagal = await ensure_uks_bmhp_indexes(db)
    if gagal:
        print("[WARN] Sebagian index gagal dibuat:")
        for g in gagal:
            print(f"  - {g}")
        client.close()
        return
    print("[OK] Index uks_bmhp, uks_bmhp_masuk, uks_bmhp_keluar siap")

    client.close()


if __name__ == '__main__':
    asyncio.run(migrate())
