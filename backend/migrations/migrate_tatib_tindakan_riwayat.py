"""
Migration: Tindakan Tatib — koleksi riwayat perubahan `tatib_tindakan_riwayat`

Skema ada di tatib_poin.py (bagian TINDAKAN TATIB). Script ini (aman dijalankan berulang kali):
1. Membuat index riwayat per siswa+semester, per tindakan (terbaru dulu), dan id unik.
2. Memindahkan array `riwayat` yang mungkin masih tertanam di dokumen `tatib_tindakan` (rancangan
   awal) menjadi dokumen riwayat terpisah, lalu menghapus field tersebut. Entri yang id-nya sudah
   ada tidak digandakan.

Jalankan dari folder backend:
    python migrations/migrate_tatib_tindakan_riwayat.py
"""
import asyncio
import os
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from tatib_poin import KOLEKSI_RIWAYAT_TINDAKAN, KOLEKSI_TINDAKAN, pastikan_index_riwayat_tindakan

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


async def migrate(db) -> dict:
    """Dipanggil juga oleh migrasi_otomatis saat server start (sekali per database)."""
    await pastikan_index_riwayat_tindakan(db)
    dipindah = 0
    tindakan = await db[KOLEKSI_TINDAKAN].find({'riwayat': {'$exists': True}}).to_list(None)
    for t in tindakan:
        for r in t.get('riwayat') or []:
            rid = r.get('id') or str(uuid.uuid4())
            if await db[KOLEKSI_RIWAYAT_TINDAKAN].find_one({'id': rid}, {'_id': 1}):
                continue
            await db[KOLEKSI_RIWAYAT_TINDAKAN].insert_one({
                'id': rid,
                'tindakan_id': t.get('id'),
                'siswa_id': t.get('siswa_id'),
                'semester_id': t.get('semester_id'),
                'waktu': r.get('waktu'),
                'oleh_id': r.get('oleh_id'),
                'oleh_nama': r.get('oleh_nama'),
                'perubahan': r.get('perubahan') or [],
                'catatan': r.get('catatan'),
                'usulan_sp': r.get('usulan_sp'),
                'poin_negatif': r.get('poin_negatif', 0),
            })
            dipindah += 1
        await db[KOLEKSI_TINDAKAN].update_one({'_id': t['_id']}, {'$unset': {'riwayat': ''}})
    return {'riwayat_dipindah': dipindah, 'jumlah_riwayat': await db[KOLEKSI_RIWAYAT_TINDAKAN].count_documents({})}


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        print(">>> Starting migration: tatib tindakan riwayat\n")
        print(f"[OK] {await migrate(client[DB_NAME])}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())
