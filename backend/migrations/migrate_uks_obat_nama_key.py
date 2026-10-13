"""
Migration: lengkapi nama_key katalog obat UKS (cek nama obat ganda).

Nama obat kini dinormalisasi (spasi dirapikan) dan disimpan juga sebagai nama_key
(huruf kecil) agar nama yang sama tidak bisa didaftarkan dua kali — sama seperti BMHP.
Script ini (aman dijalankan berulang kali):
1. Mengisi nama_key pada dokumen uks_obat lama yang belum memilikinya.
2. Melengkapi batch uks_obat_masuk lama yang belum punya stok_sisa (= jumlah).
3. Melaporkan kelompok nama ganda; gabungkan lewat menu UKS > Obat (tombol
   "Gabungkan"), index unik nama_key dibuat otomatis pada start berikutnya.

Jalankan manual dari folder backend:
    python migrations/migrate_uks_obat_nama_key.py
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()


def nama_key(nama) -> str:
    return ' '.join((nama or '').split()).lower()


async def migrate(db):
    diisi = 0
    async for o in db.uks_obat.find({'nama_key': {'$exists': False}}, {'_id': 1, 'nama_obat': 1}):
        await db.uks_obat.update_one({'_id': o['_id']}, {'$set': {'nama_key': nama_key(o.get('nama_obat'))}})
        diisi += 1

    stok_sisa = 0
    async for m in db.uks_obat_masuk.find({'stok_sisa': {'$exists': False}}, {'_id': 1, 'jumlah': 1}):
        await db.uks_obat_masuk.update_one({'_id': m['_id']}, {'$set': {'stok_sisa': m.get('jumlah', 0)}})
        stok_sisa += 1

    ganda = await db.uks_obat.aggregate([
        {'$group': {'_id': '$nama_key', 'count': {'$sum': 1}}},
        {'$match': {'count': {'$gt': 1}}},
    ]).to_list(500)
    return {'nama_key_diisi': diisi, 'stok_sisa_diisi': stok_sisa, 'nama_ganda': len(ganda)}


async def main():
    client = AsyncIOMotorClient(os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017'))
    db = client[os.getenv('DB_NAME', 'super_app_madrasah')]
    print(await migrate(db))
    client.close()


if __name__ == '__main__':
    asyncio.run(main())
