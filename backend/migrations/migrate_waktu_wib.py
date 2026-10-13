"""
Migration: seragamkan zona waktu jam aktivitas yang tersimpan tanpa zona.

Masalah: jurnal mengajar lewat Scan QR / Token QR dibuat dengan JournalModel yang memakai
datetime.utcnow(), sehingga `started_at` tersimpan sebagai UTC TANPA zona, mis.
'2026-10-12T00:35:00' untuk jurnal yang diisi 07.35 WIB. Web dan aplikasi membaca string tanpa
zona sebagai waktu lokal/WIB sehingga jam tampil 7 jam lebih awal, dan jurnal yang diisi sebelum
07.00 WIB terhitung di tanggal kemarin pada filter tanggal. Jurnal piket/pengganti/token kelas
sudah menyimpan WIB ber-offset '+07:00'.

Script ini (aman dijalankan berulang kali):
1. journals.started_at tanpa zona (string/BSON datetime) -> dianggap UTC -> disimpan WIB '+07:00'.
2. ekinerja_pengumpulan_konfirmasi.confirmed_at tanpa zona (utcnow) -> ditambah '+00:00'.

Jalankan manual dari folder backend:
    python migrations/migrate_waktu_wib.py
"""
import asyncio
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

WIB = timezone(timedelta(hours=7))
_BERZONA = re.compile(r'([zZ]|[+-]\d{2}:?\d{2})$')


def utc_naif_ke_wib(nilai):
    """'2026-10-12T00:35:00' (UTC tanpa zona) -> '2026-10-12T07:35:00+07:00'. None bila tidak perlu diubah."""
    if isinstance(nilai, datetime):
        dt = nilai if nilai.tzinfo else nilai.replace(tzinfo=timezone.utc)
        return dt.astimezone(WIB).isoformat()
    if not isinstance(nilai, str) or 'T' not in nilai or _BERZONA.search(nilai):
        return None
    try:
        dt = datetime.fromisoformat(nilai)
    except ValueError:
        return None
    return dt.replace(tzinfo=timezone.utc).astimezone(WIB).isoformat()


async def migrate(db) -> dict:
    """Dipanggil juga oleh migrasi_otomatis saat server start (sekali per database)."""
    jurnal = 0
    kursor = db.journals.find(
        {'$or': [{'started_at': {'$type': 'date'}},
                 {'started_at': {'$type': 'string', '$not': re.compile(r'([zZ]|[+-]\d{2}:?\d{2})$')}}]},
        {'_id': 1, 'started_at': 1})
    async for j in kursor:
        baru = utc_naif_ke_wib(j.get('started_at'))
        if baru:
            await db.journals.update_one({'_id': j['_id']}, {'$set': {'started_at': baru}})
            jurnal += 1

    konfirmasi = 0
    kursor = db.ekinerja_pengumpulan_konfirmasi.find(
        {'confirmed_at': {'$type': 'string', '$not': re.compile(r'([zZ]|[+-]\d{2}:?\d{2})$')}},
        {'_id': 1, 'confirmed_at': 1})
    async for k in kursor:
        if 'T' in (k.get('confirmed_at') or ''):
            await db.ekinerja_pengumpulan_konfirmasi.update_one(
                {'_id': k['_id']}, {'$set': {'confirmed_at': k['confirmed_at'] + '+00:00'}})
            konfirmasi += 1
    return {'jurnal_diubah': jurnal, 'konfirmasi_diubah': konfirmasi}


async def main():
    client = AsyncIOMotorClient(os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017'))
    db = client[os.getenv('DB_NAME', 'super_app_madrasah')]
    print(await migrate(db))
    client.close()


if __name__ == '__main__':
    asyncio.run(main())
