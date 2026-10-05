"""
Migration: rapikan data CKG lama ke susunan kolom baku

Kolom baku: NO, Nama Lengkap, NIK, Nama Sekolah, Tgl Lahir, Jenis Kelamin, Alamat Lengkap, BB, TB,
TD, Jumlah Karies, Visus Mata, Kesehatan Kulit, Fungsi Pendengaran, Hemoglobin, GDS.

Script ini (tanpa menghapus/mengubah isi lama):
1. Menambahkan field pemeriksaan baku yang belum ada (jumlah_karies, visus_mata, kesehatan_kulit,
   fungsi_pendengaran, hemoglobin, gds) dengan nilai kosong.
2. Mengisi visus_mata dari catatan pemeriksaan_mata (mis. "6/6") dan jumlah_karies dari catatan
   pemeriksaan_gigi (mis. "2 karies", "tidak ada karies") bila dapat dipastikan.
3. Menambahkan pasien_tipe (siswa/gtk). Identitas (NIK, tgl lahir, JK, alamat, kelas, sekolah)
   tidak disalin — selalu dibaca terkini dari data siswa/GTK saat ditampilkan.
4. Membuat index uks_ckg (tanggal, pasien_id).

Aman dijalankan berulang kali. Jalankan dari folder backend:
    python migrations/migrate_uks_ckg_kolom_baku.py [--dry-run]
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


async def migrate(db, dry_run: bool = False) -> dict:
    from ckg_kolom import FIELD_PEMERIKSAAN_BAKU, rencana_perapian_ckg

    docs = await db.uks_ckg.find({}, {'_id': 1, 'pasien_id': 1, 'pasien_roles': 1, 'pasien_tipe': 1, 'pemeriksaan_mata': 1,
                                      'pemeriksaan_gigi': 1, **{f: 1 for f in FIELD_PEMERIKSAAN_BAKU}}).to_list(100000)
    ids = list({d.get('pasien_id') for d in docs if d.get('pasien_id')})
    users = {u['id']: u for u in await db.users.find({'id': {'$in': ids}}, {'_id': 0, 'id': 1, 'roles': 1}).to_list(len(ids) or 1)}
    stat = {'total': len(docs), 'dirapikan': 0, 'visus_ditebak': 0, 'karies_ditebak': 0}
    for d in docs:
        set_ = rencana_perapian_ckg(d, users.get(d.get('pasien_id')))
        if not set_:
            continue
        stat['dirapikan'] += 1
        stat['visus_ditebak'] += 1 if set_.get('visus_mata') else 0
        stat['karies_ditebak'] += 1 if set_.get('jumlah_karies') is not None else 0
        if not dry_run:
            await db.uks_ckg.update_one({'_id': d['_id']}, {'$set': set_})
    if not dry_run:
        await db.uks_ckg.create_index([('tanggal', -1)])
        await db.uks_ckg.create_index([('pasien_id', 1), ('tanggal', -1), ('created_at', -1)])
    return stat


async def main():
    dry = '--dry-run' in sys.argv
    client = AsyncIOMotorClient(MONGO_URL)
    print(">>> Starting migration: CKG kolom baku" + (" (DRY RUN)" if dry else "") + "\n")
    stat = await migrate(client[DB_NAME], dry)
    print(f"[OK] {stat['dirapikan']} dari {stat['total']} data CKG dirapikan "
          f"(visus dari catatan: {stat['visus_ditebak']}, karies dari catatan: {stat['karies_ditebak']})")
    client.close()


if __name__ == '__main__':
    asyncio.run(main())
