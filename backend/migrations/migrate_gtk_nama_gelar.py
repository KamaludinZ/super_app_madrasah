"""
Migration: lengkapi field nama & gelar GTK

Untuk setiap GTK (guru/tenaga kependidikan) yang belum punya nama_tanpa_gelar, nama lengkap
lama dipecah menjadi gelar_depan, nama_tanpa_gelar, gelar_belakang (mis. "Dra. Siti Aminah, M.Pd"
-> "Dra." / "Siti Aminah" / "M.Pd"). full_name TIDAK diubah, sehingga tidak ada data yang hilang;
susunan nama hanya berubah bila kemudian disunting.

Aman dijalankan berulang kali. Jalankan dari folder backend:
    python migrations/migrate_gtk_nama_gelar.py [--dry-run]
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
ROLES_GTK = ['guru', 'wali_kelas', 'guru_piket', 'guru_bk', 'guru_tata_tertib', 'guru_ekstrakurikuler', 'tenaga_kependidikan']


async def migrate(db, dry_run: bool = False) -> dict:
    from nama_gelar import pecah_nama_gelar

    q = {'roles': {'$in': ROLES_GTK}, '$or': [{'nama_tanpa_gelar': {'$exists': False}}, {'nama_tanpa_gelar': None}, {'nama_tanpa_gelar': ''}]}
    docs = await db.users.find(q, {'_id': 1, 'id': 1, 'full_name': 1}).to_list(10000)
    stat = {'diproses': len(docs), 'bergelar': 0, 'contoh': []}
    for d in docs:
        depan, nama, belakang = pecah_nama_gelar(d.get('full_name'))
        if not nama:
            continue
        if depan or belakang:
            stat['bergelar'] += 1
        if len(stat['contoh']) < 5:
            stat['contoh'].append(f"{d.get('full_name')!r} -> depan={depan!r} nama={nama!r} belakang={belakang!r}")
        if not dry_run:
            await db.users.update_one({'_id': d['_id']}, {'$set': {'nama_tanpa_gelar': nama, 'gelar_depan': depan, 'gelar_belakang': belakang}})
    return stat


async def main():
    dry = '--dry-run' in sys.argv
    client = AsyncIOMotorClient(MONGO_URL)
    print(">>> Starting migration: nama & gelar GTK" + (" (DRY RUN)" if dry else "") + "\n")
    stat = await migrate(client[DB_NAME], dry)
    print(f"[OK] {stat['diproses']} GTK dilengkapi field nama/gelar ({stat['bergelar']} memiliki gelar)")
    for c in stat['contoh']:
        print(f"  - {c}")
    client.close()


if __name__ == '__main__':
    asyncio.run(main())
