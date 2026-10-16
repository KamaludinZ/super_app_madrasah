"""
Migration: pengaturan ambang SP (Tindakan Tatib)

Skema ada di tatib_poin.py (bagian PENGATURAN AMBANG SP). Script ini (aman dijalankan berulang kali):
1. Mengisi dokumen ambang SP berlaku dengan nilai bawaan (AMBANG_SP_BAWAAN) bila belum ada, atau
   bila nilainya rusak (tidak naik/ bukan angka) — nilai rusak dicatat di riwayat sebagai perbaikan sistem.
2. Membuat index riwayat perubahan ambang (waktu terbaru dulu, id unik).

Jalankan dari folder backend:
    python migrations/migrate_pengaturan_ambang_sp.py
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from tatib_poin import (AMBANG_SP_BAWAAN, ID_AMBANG_SP, KOLEKSI_AMBANG_SP, KOLEKSI_RIWAYAT_AMBANG_SP,
                        validasi_ambang_sp)

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


async def migrate(db) -> dict:
    """Dipanggil juga oleh migrasi_otomatis saat server start (sekali per database)."""
    await db[KOLEKSI_RIWAYAT_AMBANG_SP].create_index([('waktu', -1)])
    await db[KOLEKSI_RIWAYAT_AMBANG_SP].create_index([('id', 1)], unique=True, name='id_unik')

    doc = await db[KOLEKSI_AMBANG_SP].find_one({'_id': ID_AMBANG_SP})
    if doc:
        try:
            validasi_ambang_sp(doc.get('sp1'), doc.get('sp2'), doc.get('sp3'))
            return {'ambang': 'sudah ada'}
        except ValueError:
            pass
    sekarang = datetime.now(timezone.utc).isoformat()
    await db[KOLEKSI_AMBANG_SP].update_one({'_id': ID_AMBANG_SP}, {'$set': {
        **AMBANG_SP_BAWAAN, 'diubah_oleh_id': None, 'diubah_oleh_nama': 'Sistem', 'diubah_pada': sekarang,
    }}, upsert=True)
    if doc:
        await db[KOLEKSI_RIWAYAT_AMBANG_SP].insert_one({
            'id': str(uuid.uuid4()), 'waktu': sekarang, 'oleh_id': None, 'oleh_nama': 'Sistem',
            'dari': {k: doc.get(k) for k in ('sp1', 'sp2', 'sp3')}, 'ke': dict(AMBANG_SP_BAWAAN),
            'alasan': 'Nilai ambang tidak valid, dikembalikan ke bawaan',
        })
        return {'ambang': 'diperbaiki ke bawaan'}
    return {'ambang': 'diisi bawaan'}


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        print(">>> Starting migration: pengaturan ambang SP\n")
        print(f"[OK] {await migrate(client[DB_NAME])}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())
