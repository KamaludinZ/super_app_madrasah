"""
Migration: lengkapi riwayat rombel siswa (class_history) agar riwayat keaktifan per semester utuh.

Latar: rombel dibuat per semester, tetapi fitur Naik Kelas sebelumnya gagal (query siswa salah)
sehingga banyak siswa berada di rombel tanpa catatan riwayat. Script ini (aman dijalankan berulang):
1. Mengisi semester_id & class_name pada riwayat lama dari data rombelnya.
2. Siswa aktif yang punya rombel (student_class_id) tetapi tidak punya riwayat terbuka untuk rombel
   itu: riwayat terbuka lain ditutup, lalu dibuat riwayat 'pembagian_kelas' untuk rombel saat ini
   (tanggal mulai = tanggal mulai semester rombel, bila ada).

Jalankan manual dari folder backend:
    python migrations/migrate_riwayat_rombel.py
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()


async def migrate(db):
    kelas = {c['id']: c async for c in db.classes.find({}, {'_id': 0, 'id': 1, 'name': 1, 'semester_id': 1, 'academic_year_id': 1})}
    semester = {s['id']: s async for s in db.semesters.find({}, {'_id': 0, 'id': 1, 'code': 1, 'name': 1, 'academic_year_id': 1, 'start_date': 1})}

    dilengkapi = 0
    async for h in db.class_history.find({'$or': [{'semester_id': {'$exists': False}}, {'class_name': {'$exists': False}}]}, {'_id': 1, 'class_id': 1}):
        c = kelas.get(h.get('class_id'))
        if c:
            await db.class_history.update_one({'_id': h['_id']}, {'$set': {'semester_id': c.get('semester_id'), 'class_name': c.get('name')}})
            dilengkapi += 1

    dibuat = 0
    async for u in db.users.find({'roles': 'siswa', 'student_class_id': {'$nin': [None, '']}}, {'_id': 0, 'id': 1, 'student_class_id': 1}):
        cid = u['student_class_id']
        if await db.class_history.find_one({'student_id': u['id'], 'class_id': cid, 'end_date': None}, {'_id': 1}):
            continue
        c = kelas.get(cid)
        if not c:
            continue
        sem = semester.get(c.get('semester_id')) or {}
        mulai = sem.get('start_date') or ''
        await db.class_history.update_many({'student_id': u['id'], 'end_date': None}, {'$set': {'end_date': mulai or datetime.utcnow().strftime('%Y-%m-%d')}})
        await db.class_history.insert_one({
            'id': str(uuid.uuid4()), 'student_id': u['id'], 'class_id': cid, 'class_name': c.get('name'),
            'semester_id': c.get('semester_id'), 'academic_year_id': sem.get('academic_year_id') or c.get('academic_year_id'),
            'semester': sem.get('code') or sem.get('name') or '', 'reason': 'pembagian_kelas',
            'start_date': mulai, 'end_date': None, 'notes': 'Dicatat otomatis dari data kelas saat ini',
            'created_by_user_id': 'system', 'created_at': datetime.utcnow().isoformat(),
        })
        dibuat += 1
    await db.class_history.create_index([('student_id', 1), ('end_date', 1)])
    await db.class_history.create_index('class_id')
    return {'riwayat_dilengkapi': dilengkapi, 'riwayat_dibuat': dibuat}


async def main():
    client = AsyncIOMotorClient(os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017'))
    db = client[os.getenv('DB_NAME', 'super_app_madrasah')]
    print(await migrate(db))
    client.close()


if __name__ == '__main__':
    asyncio.run(main())
