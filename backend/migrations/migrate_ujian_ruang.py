"""
Migration: siapkan koleksi Ruang & Peserta modul Ujian (ruang_ujian, peserta_ruang, ujian_jejak, guru_pengawas)

Skema ada di ujian_ruang.py. Script ini (aman dijalankan berulang kali):
1. Membuat index: ruang_ujian.id (unik), (ujian_id, nama_kunci) unik; peserta_ruang.id (unik), (ujian_id, siswa_id)
   unik, (ujian_id, nomor_kunci) unik parsial (hanya nomor terisi), (ruang_id, nomor_kunci); ujian_jejak.id (unik),
   (ujian_id, waktu); guru_pengawas.id (unik), guru_pengawas.user_id (unik).
2. Melengkapi `nama_kunci` ruang dan `nomor_kunci` peserta lama dari nama/nomor yang ada.

Jalankan dari folder backend:
    python migrations/migrate_ujian_ruang.py [--dry-run]
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from ujian import KOLEKSI_PESERTA, KOLEKSI_RUANG
from ujian_ruang import KOLEKSI_PENGAWAS, kunci_nama, kunci_nomor, pastikan_index_ruang

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


async def migrate(db, dry_run: bool = False) -> dict:
    """Dipanggil juga oleh migrasi_otomatis saat server start (sekali per database)."""
    ruang = await db[KOLEKSI_RUANG].find({'nama_kunci': {'$exists': False}}, {'_id': 0, 'id': 1, 'nama_ruang': 1}).to_list(10000)
    peserta = await db[KOLEKSI_PESERTA].find({'nomor_kunci': {'$exists': False}}, {'_id': 0, 'id': 1, 'nomor_peserta': 1}).to_list(100000)
    if not dry_run:
        for r in ruang:
            await db[KOLEKSI_RUANG].update_one({'id': r['id']}, {'$set': {'nama_kunci': kunci_nama(r.get('nama_ruang'))}})
        for p in peserta:
            await db[KOLEKSI_PESERTA].update_one({'id': p['id']}, {'$set': {'nomor_kunci': kunci_nomor(p.get('nomor_peserta'))}})
        await pastikan_index_ruang(db)
    return {
        'ruang': await db[KOLEKSI_RUANG].count_documents({}),
        'peserta': await db[KOLEKSI_PESERTA].count_documents({}),
        'pengawas': await db[KOLEKSI_PENGAWAS].count_documents({}),
        'ruang_dilengkapi': len(ruang),
        'peserta_dilengkapi': len(peserta),
        'dry_run': dry_run,
    }


async def main():
    dry = '--dry-run' in sys.argv
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        print(">>> Starting migration: ujian ruang & peserta" + (" (DRY RUN)" if dry else "") + "\n")
        print(f"[OK] {await migrate(client[DB_NAME], dry_run=dry)}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())
