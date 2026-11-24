"""
Migration: siapkan jejak audit unduhan berkas ujian (ujian_unduh_log) untuk bundel unduh admin

Skema ada di ujian_info.py. Script ini (aman dijalankan berulang kali) memastikan index riwayat unduhan per ujian:
(ujian_id, waktu), (ujian_id, mode, waktu), (ujian_id, jenis_berkas, waktu), dan (pengunduh_id, waktu). Log lama tidak
diubah; tanpa aturan hapus arsip (tanpa TTL). Penghitung unduhan kisi-kisi yang lebih kecil dari jumlah log unduhan publiknya
dinaikkan (rekonsiliasi; dry-run hanya melaporkan).

Jalankan dari folder backend:
    python migrations/migrate_ujian_unduh_log.py [--dry-run]
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from ujian_info import INDEX_UNDUH_LOG, KOLEKSI_UNDUH_LOG, rekonsiliasi_jumlah_unduh

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


async def migrate(db, dry_run: bool = False) -> dict:
    """Dipanggil juga oleh migrasi_otomatis saat server start (sekali per database)."""
    if not dry_run:
        for koleksi, keys, opsi in INDEX_UNDUH_LOG:
            await db[koleksi].create_index(keys, **opsi)
    rek = await rekonsiliasi_jumlah_unduh(db, terapkan=not dry_run)
    return {'unduh_log': await db[KOLEKSI_UNDUH_LOG].count_documents({}), 'penghitung_selisih': len(rek['selisih']),
            'penghitung_diperbaiki': rek['diperbaiki'], 'dry_run': dry_run}


async def main():
    dry = '--dry-run' in sys.argv
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        print(">>> Starting migration: ujian unduh log" + (" (DRY RUN)" if dry else "") + "\n")
        print(f"[OK] {await migrate(client[DB_NAME], dry_run=dry)}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())
