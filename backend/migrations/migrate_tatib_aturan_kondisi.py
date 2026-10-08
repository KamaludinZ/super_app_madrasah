"""
Migration: aturan tatib -> jenis_poin + kondisi (nilai mengikuti kategori & kondisi)

Skema ada di tatib_poin.py. Script ini (aman dijalankan berulang kali):
1. Mengisi jenis_poin aturan dari tanda `poin` bila belum ada.
2. Mengisi kondisi aturan dengan satu kondisi bawaan ("Setiap kejadian") bernilai `poin`.
3. Mengisi kondisi_id ('umum') pada catatan poin lama yang belum memilikinya.
4. Membuat index aturan (jenis_poin, kategori_id).

Jalankan dari folder backend:
    python migrations/migrate_tatib_aturan_kondisi.py
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from tatib_poin import KONDISI_BAWAAN_ID, KOLEKSI_POIN, jenis_dari_poin, kondisi_aturan, pastikan_index_aturan

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


def _kosong(field: str) -> dict:
    return {'$or': [{field: {'$exists': False}}, {field: None}]}


async def migrate(db) -> dict:
    """Dipanggil juga oleh migrasi_otomatis saat server start (sekali per database)."""
    aturan = await db.tatib_aturan.find(
        {'$or': [_kosong('jenis_poin'), _kosong('kondisi')]}, {'_id': 1, 'poin': 1, 'jenis_poin': 1, 'kondisi': 1}
    ).to_list(None)
    for a in aturan:
        jenis = a.get('jenis_poin') or jenis_dari_poin(a.get('poin'))
        await db.tatib_aturan.update_one(
            {'_id': a['_id']}, {'$set': {'jenis_poin': jenis, 'kondisi': kondisi_aturan({**a, 'jenis_poin': jenis})}})

    catatan = await db[KOLEKSI_POIN].update_many(_kosong('kondisi_id'), {'$set': {'kondisi_id': KONDISI_BAWAAN_ID}})
    await pastikan_index_aturan(db)
    return {'aturan_dilengkapi': len(aturan), 'catatan_kondisi_id': catatan.modified_count}


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        print(">>> Starting migration: tatib aturan kondisi\n")
        print(f"[OK] {await migrate(client[DB_NAME])}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())
