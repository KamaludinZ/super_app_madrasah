"""
Migration: siapkan koleksi Nilai UAS modul Ujian (nilai_ujian, nilai_impor_log, nilai_masa)

Skema ada di ujian_nilai.py. Script ini (aman dijalankan berulang kali):
1. Membuat index: nilai_ujian.id (unik), (ujian_id, mapel_id, siswa_id) unik, (ujian_id, mapel_id, kelas_id), (siswa_id);
   nilai_impor_log.id (unik), (ujian_id, waktu), (status); nilai_masa.ujian_id (unik); nilai_ujian_riwayat.id (unik),
   (ujian_id, mapel_id, siswa_id, waktu); grade_entries (student_id, subject_id, academic_year_id, semester) untuk sinkron
   nilai UAS ke rapor.
2. Menandai log impor yang macet berstatus 'proses' (server mati di tengah impor) menjadi 'gagal' agar dapat diunggah ulang.
3. Melengkapi kolom nilai_uas* (null) pada grade_entries lama yang belum memilikinya, agar kolom UAS rapor konsisten.
4. (migrate_id, 2026-11-26) Memberi `id` pada nilai_ujian lama yang tersimpan tanpa id. Sebelum perbaikan, upsert impor/input
   nilai tidak menulis `id`, sehingga index unik `id` menolak siswa baru kedua (E11000 dup key { id: null }) dan impor gagal.

Jalankan dari folder backend:
    python migrations/migrate_ujian_nilai.py [--dry-run]
"""
import asyncio
import os
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

from ujian_nilai import FIELD_RAPOR_UAS, KOLEKSI_IMPOR_LOG, KOLEKSI_NILAI, KOLEKSI_RAPOR, pastikan_index_nilai

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')
PESAN_MACET = 'Impor terhenti karena server dimulai ulang. Unggah ulang berkas yang sama.'


async def migrate(db, dry_run: bool = False) -> dict:
    """Dipanggil juga oleh migrasi_otomatis saat server start (sekali per database)."""
    macet = await db[KOLEKSI_IMPOR_LOG].count_documents({'status': 'proses'})
    tanpa_uas = {'nilai_uas': {'$exists': False}}
    rapor_lama = await db[KOLEKSI_RAPOR].count_documents(tanpa_uas)
    if not dry_run:
        await pastikan_index_nilai(db)
        if macet:
            await db[KOLEKSI_IMPOR_LOG].update_many({'status': 'proses'}, {'$set': {'status': 'gagal', 'pesan': PESAN_MACET}})
        if rapor_lama:
            await db[KOLEKSI_RAPOR].update_many(tanpa_uas, {'$set': {k: None for k in FIELD_RAPOR_UAS}})
    return {'nilai': await db[KOLEKSI_NILAI].count_documents({}), 'log_macet': macet, 'rapor_dilengkapi': rapor_lama, 'dry_run': dry_run}


async def migrate_id(db, dry_run: bool = False) -> dict:
    """Lengkapi `id` nilai_ujian yang kosong/tidak ada lalu pastikan index (dipanggil migrasi_otomatis sekali per database).
    Kunci (ujian_id, mapel_id, siswa_id) unik, jadi tiap dokumen diperbarui satu per satu lewat kunci itu."""
    tanpa_id = await db[KOLEKSI_NILAI].find({'id': None}, {'_id': 0, 'ujian_id': 1, 'mapel_id': 1, 'siswa_id': 1}).to_list(None)
    if not dry_run:
        for d in tanpa_id:
            await db[KOLEKSI_NILAI].update_one({'ujian_id': d.get('ujian_id'), 'mapel_id': d.get('mapel_id'), 'siswa_id': d.get('siswa_id'),
                                                'id': None}, {'$set': {'id': str(uuid.uuid4())}})
        await pastikan_index_nilai(db)
    return {'nilai_tanpa_id': len(tanpa_id), 'dry_run': dry_run}


async def main():
    dry = '--dry-run' in sys.argv
    client = AsyncIOMotorClient(MONGO_URL)
    try:
        print(">>> Starting migration: ujian nilai UAS (impor, masa, riwayat, kolom UAS rapor)" + (" (DRY RUN)" if dry else "") + "\n")
        print(f"[OK] {await migrate(client[DB_NAME], dry_run=dry)}")
        print(f"[OK] id nilai_ujian: {await migrate_id(client[DB_NAME], dry_run=dry)}")
    finally:
        client.close()


if __name__ == '__main__':
    asyncio.run(main())
