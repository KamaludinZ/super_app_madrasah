"""
Perintah: bangun ulang penghitung klik "Mengerjakan" Portal Ujian dari jejak audit

jumlah_klik & klik_terakhir_at pada ujian_link_soal hanyalah cache baca-cepat; sumber kebenarannya ujian_akses_log
(aksi=klik_mengerjakan, hasil=ok). Script ini menghitung ulang cache dari log untuk satu ujian atau semua ujian yang punya
link soal — dipakai setelah migrasi/pemulihan data atau saat angka di portal dicurigai selisih. Log tidak diubah; aman
dijalankan berulang kali. Sama dengan tombol "Bangun ulang penghitung" di menu Link Soal.

Jalankan dari folder backend:
    python migrations/bangun_ulang_klik_portal.py [--ujian <ujian_id>] [--dry-run]
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from ujian_portal import KOLEKSI_LINK_SOAL, bangun_ulang_klik

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


async def jalankan(db, ujian_id: str = None, dry_run: bool = False) -> dict:
    ujian_ids = [ujian_id] if ujian_id else sorted(await db[KOLEKSI_LINK_SOAL].distinct('ujian_id'))
    hasil = {u: await bangun_ulang_klik(db, u, dry_run=dry_run) for u in ujian_ids}
    return {'ujian': len(hasil), 'diperbaiki': sum(h['diperbaiki'] for h in hasil.values()),
            'per_ujian': {u: {k: h[k] for k in ('diperiksa', 'diperbaiki', 'selisih', 'berubah')} for u, h in hasil.items()},
            'dry_run': dry_run}


async def main():
    dry = '--dry-run' in sys.argv
    ujian_id = sys.argv[sys.argv.index('--ujian') + 1] if '--ujian' in sys.argv[:-1] else None
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        print(">>> Bangun ulang penghitung klik portal" + (" (DRY RUN)" if dry else "") + "\n")
        print(f"[OK] {await jalankan(client[DB_NAME], ujian_id, dry_run=dry)}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())
