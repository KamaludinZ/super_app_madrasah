"""
Migration: lengkapi catatan tatib lama dengan skema poin plus/minus

Skema lengkap ada di tatib_poin.py. Script ini (aman dijalankan berulang kali):
1. Mengisi jenis_poin ('kebaikan'/'pelanggaran') dan poin bertanda dari tatib_poin
   pada catatan tatib_penanganan yang belum memilikinya.
2. Mengisi kondisi (None) dan tindak_lanjut ([]) yang belum ada.
3. Membuat index riwayat per siswa, rekap per kelas/periode, dan jenis poin.

Jalankan dari folder backend:
    python migrations/migrate_tatib_poin.py
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from tatib_poin import KOLEKSI_POIN, field_poin, pastikan_index_poin

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


def _kosong(field: str) -> dict:
    return {'$or': [{field: {'$exists': False}}, {field: None}]}


async def migrate(db) -> dict:
    """Dipanggil juga oleh migrasi_otomatis saat server start (sekali per database)."""
    koll = db[KOLEKSI_POIN]
    tanpa_jenis = await koll.find(_kosong('jenis_poin'), {'_id': 1, 'tatib_poin': 1}).to_list(None)
    for d in tanpa_jenis:
        f = field_poin(d.get('tatib_poin'))
        f.pop('kondisi')
        await koll.update_one({'_id': d['_id']}, {'$set': f})

    kondisi = await koll.update_many({'kondisi': {'$exists': False}}, {'$set': {'kondisi': None}})
    tindak = await koll.update_many(_kosong('tindak_lanjut'), {'$set': {'tindak_lanjut': []}})
    await pastikan_index_poin(db)
    return {
        'jenis_diisi': len(tanpa_jenis),
        'kondisi_diisi': kondisi.modified_count,
        'tindak_lanjut_diisi': tindak.modified_count,
        'total': await koll.count_documents({}),
    }


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        print(">>> Starting migration: tatib poin plus/minus\n")
        print(f"[OK] {await migrate(client[DB_NAME])}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())
