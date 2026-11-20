"""
Migration: siapkan koleksi Berita Acara & Arsip modul Ujian (berita_acara, berita_acara_ttd, arsip_ujian,
arsip_ujian_berkas)

Skema ada di ujian_berita_acara.py. Script ini (aman dijalankan berulang kali) membuat index:
berita_acara.id (unik), (ujian_id, ruang_id, sesi_id) unik — satu berita acara per ruang per sesi —, (ujian_id, tanggal),
(pengawas_id); berita_acara_ttd.berita_acara_id (unik); arsip_ujian.id (unik), (ujian_id, waktu),
(ujian_id, ruang_id, jenjang, sesi_id); arsip_ujian_berkas.arsip_id (unik).

Jalankan dari folder backend:
    python migrations/migrate_ujian_berita_acara.py [--dry-run]
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from ujian_berita_acara import KOLEKSI_ARSIP, KOLEKSI_BA, pastikan_index_berita_acara

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


async def migrate(db, dry_run: bool = False) -> dict:
    """Dipanggil juga oleh migrasi_otomatis saat server start (sekali per database)."""
    if not dry_run:
        await pastikan_index_berita_acara(db)
    return {'berita_acara': await db[KOLEKSI_BA].count_documents({}), 'arsip': await db[KOLEKSI_ARSIP].count_documents({}), 'dry_run': dry_run}


async def main():
    dry = '--dry-run' in sys.argv
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        print(">>> Starting migration: ujian berita acara & arsip" + (" (DRY RUN)" if dry else "") + "\n")
        print(f"[OK] {await migrate(client[DB_NAME], dry_run=dry)}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())
