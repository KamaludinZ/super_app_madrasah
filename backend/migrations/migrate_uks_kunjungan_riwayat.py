"""
Migration: lengkapi skema uks_kunjungan untuk fitur Riwayat Kunjungan

Script ini:
1. Mengisi field yang belum ada pada kunjungan lama dengan nilai default:
   diagnosa (None / list kosong), bmhp_dipakai, obat_dipakai, jenis_penanganan_*,
   serta catatan_surat (+ catatan_surat_oleh / catatan_surat_pada) untuk surat keterangan UKS.
2. Mengisi salinan pasien_tipe ('siswa'/'gtk') dan pasien_kelas dari data pengguna.
   Catatan: kelas diisi dari kelas siswa SAAT INI karena kelas saat kunjungan
   tidak tercatat di data lama.
3. Membuat index (pasien_id, tanggal) untuk riwayat per pasien.

Aman dijalankan berulang kali. Jalankan dari folder backend:
    python migrations/migrate_uks_kunjungan_riwayat.py
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URL = os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'super_app_madrasah')

DEFAULTS = {
    'diagnosa_utama_id': None,
    'diagnosa_utama_nama': None,
    'diagnosa_utama_kode': None,
    'diagnosa_tambahan_ids': [],
    'diagnosa_tambahan_nama': [],
    'jenis_penanganan_ids': [],
    'jenis_penanganan_nama': [],
    'obat_dipakai': [],
    'bmhp_dipakai': [],
    'catatan_surat': None,
    'catatan_surat_oleh': None,
    'catatan_surat_pada': None,
}


async def migrate():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print(">>> Starting migration: UKS kunjungan (riwayat)\n")

    docs = await db.uks_kunjungan.find({}, {'_id': 1, 'pasien_id': 1, 'pasien_tipe': 1, **{k: 1 for k in DEFAULTS}}).to_list(50000)
    pasien_ids = list({d.get('pasien_id') for d in docs if d.get('pasien_id') and not d.get('pasien_tipe')})
    users = {u['id']: u for u in await db.users.find(
        {'id': {'$in': pasien_ids}}, {'_id': 0, 'id': 1, 'roles': 1, 'student_class_id': 1}
    ).to_list(len(pasien_ids) or 1)}
    class_ids = list({u.get('student_class_id') for u in users.values() if u.get('student_class_id')})
    kelas = {c['id']: c.get('name') for c in await db.classes.find(
        {'id': {'$in': class_ids}}, {'_id': 0, 'id': 1, 'name': 1}
    ).to_list(len(class_ids) or 1)}

    updated = 0
    for d in docs:
        update = {k: v for k, v in DEFAULTS.items() if k not in d}
        if not d.get('pasien_tipe'):
            u = users.get(d.get('pasien_id'))
            if u:
                is_siswa = 'siswa' in (u.get('roles') or [])
                update['pasien_tipe'] = 'siswa' if is_siswa else 'gtk'
                update['pasien_kelas'] = kelas.get(u.get('student_class_id')) if is_siswa else None
        if update:
            await db.uks_kunjungan.update_one({'_id': d['_id']}, {'$set': update})
            updated += 1
    print(f"[OK] {updated} dari {len(docs)} kunjungan dilengkapi")

    await db.uks_kunjungan.create_index([('pasien_id', 1), ('tanggal', -1)])
    await db.uks_kunjungan.create_index([('pasien_id', 1), ('tanggal', -1), ('waktu', -1), ('created_at', -1)])
    print("[OK] Index uks_kunjungan (pasien_id, tanggal[, waktu, created_at]) siap")
    await db.uks_ckg.create_index([('pasien_id', 1), ('tanggal', -1), ('created_at', -1)])
    print("[OK] Index uks_ckg (pasien_id, tanggal, created_at) siap")
    client.close()


if __name__ == '__main__':
    asyncio.run(migrate())
