"""
Migration: siapkan koleksi Daftar Hadir modul Ujian (daftar_hadir, daftar_hadir_ttd, daftar_hadir_status,
daftar_hadir_arsip)

Skema ada di ujian_kehadiran.py. Script ini (aman dijalankan berulang kali) membuat index:
daftar_hadir.id (unik), (peserta_id, sesi_id) unik — satu kiriman per nama per sesi —, (ujian_id, sesi_id, ruang_id);
daftar_hadir_ttd.kehadiran_id (unik); daftar_hadir_status.id (unik), (ujian_id, peserta_id, tanggal) unik — tanda
izin/sakit sekali per hari —, (ujian_id, tanggal); daftar_hadir_arsip (ujian_id, peserta_id, sesi_id).

Jalankan dari folder backend:
    python migrations/migrate_ujian_kehadiran.py [--dry-run]
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from ujian_kehadiran import KOLEKSI_DH, KOLEKSI_DH_ARSIP, KOLEKSI_DH_STATUS, pastikan_index_kehadiran

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


async def migrate(db, dry_run: bool = False) -> dict:
    """Dipanggil juga oleh migrasi_otomatis saat server start (sekali per database)."""
    if not dry_run:
        await pastikan_index_kehadiran(db)
    return {
        'kehadiran': await db[KOLEKSI_DH].count_documents({}),
        'tanda_harian': await db[KOLEKSI_DH_STATUS].count_documents({}),
        'arsip_buka_kunci': await db[KOLEKSI_DH_ARSIP].count_documents({}),
        'dry_run': dry_run,
    }


async def main():
    dry = '--dry-run' in sys.argv
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        print(">>> Starting migration: ujian daftar hadir" + (" (DRY RUN)" if dry else "") + "\n")
        print(f"[OK] {await migrate(client[DB_NAME], dry_run=dry)}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())
