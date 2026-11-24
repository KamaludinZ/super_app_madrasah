"""
Migration: siapkan Portal Ujian & Link Soal (ujian_link_soal + field `aksi` di ujian_akses_log)

Skema ada di ujian_portal.py (link soal) dan ujian_info.py (tautan publik jenis 'portal', ujian_akses_log). Script ini
(aman dijalankan berulang kali):
  1. memastikan index ujian_link_soal.id (unik), (ujian_id, jenjang, mapel) unik — satu tautan soal per ujian per jenjang
     per mapel —, serta index jejak klik ujian_akses_log (link_soal_id, aksi, waktu) dan (ujian_id, aksi, waktu);
  2. MELAPORKAN jumlah entri ujian_akses_log lama tanpa field `aksi`. Entri itu TIDAK diubah — jejak audit hanya ditulis
     lewat fungsi catat_* di ujian_info.py dan tidak pernah diubah massal; pembaca memperlakukan `aksi` kosong sebagai
     'buka_tautan' (semua entri sebelum portal ada adalah pembukaan tautan), lihat ujian_portal.KUERI_BUKA;
  3. MELAPORKAN (tanpa mengubah) link soal yang tidak dapat dipakai apa adanya: jenjang bukan 7/8/9, tautan bukan
     http/https, atau jendela waktu tidak terbaca/terbalik (ujian_portal.link_soal_rusak). Link soal sendiri dibuat saat
     admin menyimpannya di menu Link Soal (satu dokumen per ujian + jenjang + mapel; jendela awal dari jadwal ujian).
Tautan publik jenis 'portal' tidak dibuat di sini: dibuat otomatis (DITUTUP) saat menu Tautan Publik/Link Soal dibuka,
sama seperti tautan info & monitoring.

Jalankan dari folder backend:
    python migrations/migrate_ujian_portal.py [--dry-run]
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from ujian_info import KOLEKSI_AKSES_LOG
from ujian_portal import INDEX_LINK_SOAL, KOLEKSI_LINK_SOAL, link_soal_rusak

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')


async def migrate(db, dry_run: bool = False) -> dict:
    """Dipanggil juga oleh migrasi_otomatis saat server start (sekali per database)."""
    if not dry_run:
        for koleksi, keys, opsi in INDEX_LINK_SOAL:
            await db[koleksi].create_index(keys, **opsi)
    log_tanpa_aksi = await db[KOLEKSI_AKSES_LOG].count_documents({'aksi': {'$exists': False}})
    link = await db[KOLEKSI_LINK_SOAL].find({}, {'_id': 0, 'id': 1, 'jenjang': 1, 'url': 1, 'mulai_at': 1, 'selesai_at': 1}).to_list(100000)
    rusak = [{'id': d.get('id'), 'alasan': a} for d in link if (a := link_soal_rusak(d))]
    return {'link_soal': len(link), 'link_rusak': len(rusak), 'contoh_link_rusak': rusak[:20],
            'log_tanpa_aksi': log_tanpa_aksi, 'dry_run': dry_run}


async def main():
    dry = '--dry-run' in sys.argv
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        print(">>> Starting migration: ujian portal & link soal" + (" (DRY RUN)" if dry else "") + "\n")
        print(f"[OK] {await migrate(client[DB_NAME], dry_run=dry)}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())
