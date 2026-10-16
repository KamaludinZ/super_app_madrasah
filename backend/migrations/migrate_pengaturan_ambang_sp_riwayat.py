"""
Migration: riwayat perubahan ambang SP (`pengaturan_ambang_sp_riwayat`)

Skema ada di tatib_poin.py (bagian PENGATURAN AMBANG SP). Script ini (aman dijalankan berulang kali):
1. Membuat index riwayat: waktu terbaru dulu, per pengubah (oleh_id), dan id unik.
2. Merapikan entri lama: field yang belum ada (oleh_id, oleh_nama, dari, alasan) diisi None/'Sistem'
   dan entri tanpa id diberi id. Isi riwayat (nilai dari/ke, waktu) tidak pernah diubah.

Jalankan dari folder backend:
    python migrations/migrate_pengaturan_ambang_sp_riwayat.py
"""
import asyncio
import os
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from tatib_poin import KOLEKSI_RIWAYAT_AMBANG_SP, pastikan_index_riwayat_ambang

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


async def migrate(db) -> dict:
    """Dipanggil juga oleh migrasi_otomatis saat server start (sekali per database)."""
    koll = db[KOLEKSI_RIWAYAT_AMBANG_SP]
    tanpa_id = 0
    async for d in koll.find({'$or': [{'id': {'$exists': False}}, {'id': None}]}, {'_id': 1}):
        await koll.update_one({'_id': d['_id']}, {'$set': {'id': str(uuid.uuid4())}})
        tanpa_id += 1
    dilengkapi = 0
    for field, nilai in (('oleh_id', None), ('oleh_nama', 'Sistem'), ('dari', None), ('alasan', None)):
        dilengkapi += (await koll.update_many({field: {'$exists': False}}, {'$set': {field: nilai}})).modified_count
    await pastikan_index_riwayat_ambang(db)
    return {'diberi_id': tanpa_id, 'field_dilengkapi': dilengkapi, 'jumlah_riwayat': await koll.count_documents({})}


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        print(">>> Starting migration: riwayat ambang SP\n")
        print(f"[OK] {await migrate(client[DB_NAME])}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())
