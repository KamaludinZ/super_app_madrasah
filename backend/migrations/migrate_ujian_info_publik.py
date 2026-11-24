"""
Migration: siapkan koleksi halaman publik Info Ujian & pengumpulan berkas ujian (ujian_info_konten, ujian_tautan_publik,
ujian_berkas, ujian_akses_log, ujian_unduh_log)

Skema ada di ujian_info.py. Script ini (aman dijalankan berulang kali) membuat index:
ujian_info_konten.ujian_id (unik); ujian_tautan_publik.id (unik), token (unik), (ujian_id, jenis) unik — satu tautan
info & satu tautan monitoring per ujian —; ujian_berkas.id (unik), (ujian_id, jenis, jenjang, mapel) unik — unggah ulang
menimpa —, guru_pj_id; ujian_akses_log & ujian_unduh_log: (ujian_id, waktu) dan (tautan_id/berkas_id, waktu).
Folder unggahan `ujian_info/` dan `ujian_berkas/` juga disiapkan. Tidak ada data yang diubah atau dihapus.

Jalankan dari folder backend:
    python migrations/migrate_ujian_info_publik.py [--dry-run]
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from penyimpanan import folder_unggahan
from ujian_info import (
    KOLEKSI_BERKAS, KOLEKSI_INFO_KONTEN, KOLEKSI_TAUTAN, SUBFOLDER_BERKAS, SUBFOLDER_INFO, pastikan_index_ujian_info,
)

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


async def migrate(db, dry_run: bool = False) -> dict:
    """Dipanggil juga oleh migrasi_otomatis saat server start (sekali per database)."""
    if not dry_run:
        await pastikan_index_ujian_info(db)
        for sub in (SUBFOLDER_INFO, SUBFOLDER_BERKAS):
            folder_unggahan(sub)
    return {
        'konten': await db[KOLEKSI_INFO_KONTEN].count_documents({}),
        'tautan': await db[KOLEKSI_TAUTAN].count_documents({}),
        'berkas': await db[KOLEKSI_BERKAS].count_documents({}),
        'dry_run': dry_run,
    }


async def main():
    dry = '--dry-run' in sys.argv
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        print(">>> Starting migration: ujian info publik & berkas ujian" + (" (DRY RUN)" if dry else "") + "\n")
        print(f"[OK] {await migrate(client[DB_NAME], dry_run=dry)}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())
