"""
Migration: siapkan pengelolaan Tautan Publik ujian (ujian_tautan_publik & ujian_tautan_riwayat)

Skema ada di ujian_info.py. Script ini (aman dijalankan berulang kali) memastikan index:
ujian_tautan_publik.id (unik), token (unik), (ujian_id, jenis) unik — satu tautan info & satu tautan monitoring per
ujian —; ujian_tautan_riwayat.id (unik), (ujian_id, waktu), (tautan_id, waktu). Tautan yang jendela waktunya tersimpan
tetapi tidak terbaca DILAPORKAN (jumlah & id) tanpa diubah — tautan itu ditolak fail-closed sampai admin memperbaikinya.
Tidak ada data yang diubah atau dihapus.

Jalankan dari folder backend:
    python migrations/migrate_ujian_tautan_publik.py [--dry-run]
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from ujian_info import INDEX_TAUTAN_PUBLIK, KOLEKSI_TAUTAN, KOLEKSI_TAUTAN_RIWAYAT, jendela_rusak

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


async def migrate(db, dry_run: bool = False) -> dict:
    """Dipanggil juga oleh migrasi_otomatis saat server start (sekali per database)."""
    if not dry_run:
        for koleksi, keys, opsi in INDEX_TAUTAN_PUBLIK:
            await db[koleksi].create_index(keys, **opsi)
    tautan = await db[KOLEKSI_TAUTAN].find({}, {'_id': 0, 'id': 1, 'mulai_at': 1, 'selesai_at': 1}).to_list(10000)
    rusak = [t.get('id') for t in tautan if jendela_rusak(t)]
    return {'tautan': len(tautan), 'jendela_rusak': len(rusak), 'id_jendela_rusak': rusak[:20],
            'riwayat': await db[KOLEKSI_TAUTAN_RIWAYAT].count_documents({}), 'dry_run': dry_run}


async def main():
    dry = '--dry-run' in sys.argv
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        print(">>> Starting migration: ujian tautan publik" + (" (DRY RUN)" if dry else "") + "\n")
        print(f"[OK] {await migrate(client[DB_NAME], dry_run=dry)}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())
