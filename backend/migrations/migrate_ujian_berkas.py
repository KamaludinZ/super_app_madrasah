"""
Migration: siapkan pengumpulan berkas ujian (ujian_berkas)

Skema ada di ujian_berkas.py. Script ini (aman dijalankan berulang kali) memastikan index:
ujian_berkas (ujian_id, jenis, jenjang, mapel) unik — unggah ulang menimpa —, (ujian_id, updated_at). Folder unggahan
`ujian_berkas/` disiapkan. Berkas yang tercatat tetapi tidak ada di disk DILAPORKAN (tidak diubah).

Jalankan dari folder backend:
    python migrations/migrate_ujian_berkas.py [--dry-run]
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from penyimpanan import folder_unggahan
from ujian_berkas import pastikan_index_berkas_ujian
from ujian_info import KOLEKSI_BERKAS, SUBFOLDER_BERKAS, jalur_unggahan

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


async def migrate(db, dry_run: bool = False) -> dict:
    """Dipanggil juga oleh migrasi_otomatis saat server start (sekali per database)."""
    if not dry_run:
        await pastikan_index_berkas_ujian(db)
        folder_unggahan(SUBFOLDER_BERKAS)
    berkas = await db[KOLEKSI_BERKAS].find({}, {'_id': 0, 'id': 1, 'nama_berkas': 1}).to_list(10000)
    hilang = [b.get('id') for b in berkas if not b.get('nama_berkas') or not os.path.isfile(jalur_unggahan(SUBFOLDER_BERKAS, b['nama_berkas']))]
    return {'berkas': len(berkas), 'berkas_hilang_di_disk': len(hilang), 'id_berkas_hilang': hilang[:20],
            'dry_run': dry_run}


async def main():
    dry = '--dry-run' in sys.argv
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        print(">>> Starting migration: ujian berkas" + (" (DRY RUN)" if dry else "") + "\n")
        print(f"[OK] {await migrate(client[DB_NAME], dry_run=dry)}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())
