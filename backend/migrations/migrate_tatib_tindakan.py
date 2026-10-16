"""
Migration: Tindakan Tatib — koleksi status pembinaan `tatib_tindakan`

Skema ada di tatib_poin.py (bagian TINDAKAN TATIB). Script ini (aman dijalankan berulang kali):
1. Membuat index unik (siswa_id, semester_id) dan index keterangan_sp pada `tatib_tindakan`,
   serta index (semester_id, siswa_id) pada catatan poin untuk rekap tindakan per semester.
2. Melengkapi dokumen tindakan yang belum punya field status dengan nilai awal
   (status 'Tidak diperlukan'/'Tidak perlu'). Tidak ada data lama yang dipindahkan: status pembinaan
   sebelumnya belum pernah disimpan. Riwayat perubahan ada di migrate_tatib_tindakan_riwayat.py.

Jalankan dari folder backend:
    python migrations/migrate_tatib_tindakan.py
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from tatib_poin import KOLEKSI_TINDAKAN, STATUS_TINDAKAN_AWAL, pastikan_index_tindakan

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


async def migrate(db) -> dict:
    """Dipanggil juga oleh migrasi_otomatis saat server start (sekali per database)."""
    await pastikan_index_tindakan(db)
    dilengkapi = 0
    for field, nilai in STATUS_TINDAKAN_AWAL.items():
        r = await db[KOLEKSI_TINDAKAN].update_many({field: {'$exists': False}}, {'$set': {field: nilai}})
        dilengkapi += r.modified_count
    return {'field_dilengkapi': dilengkapi, 'jumlah_tindakan': await db[KOLEKSI_TINDAKAN].count_documents({})}


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        print(">>> Starting migration: tatib tindakan\n")
        print(f"[OK] {await migrate(client[DB_NAME])}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())
