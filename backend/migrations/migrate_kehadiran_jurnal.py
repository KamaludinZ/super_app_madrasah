"""
Migration: pulihkan kehadiran per siswa jurnal mengajar ke koleksi attendances.

Masalah: POST /jurnal (Scan QR, juga dari aplikasi HP) dan /journals/submit-offline membaca daftar
kehadiran sebagai dict padahal berupa model, sehingga gagal menyimpan ke koleksi attendances setelah
jurnal tersimpan. Daftar per siswa (student_id + status) tetap ada di field attendance_details pada
dokumen jurnal. Script ini (aman dijalankan berulang) menyalin daftar itu ke attendances untuk jurnal
yang belum punya catatan kehadiran, melengkapi nama siswa, menormalkan 'alpha' -> 'alpa', dan
menghitung ulang jumlah H/S/I/A dari daftar per siswa. Setiap catatan kehadiran juga diberi
`tanggal` pelajaran (WIB) agar riwayat kehadiran di akun siswa tepat per hari/bulan.

Jurnal yang dulu hanya menyimpan jumlah (form web) tidak punya daftar nama sehingga tidak bisa
dipulihkan; di aplikasi ditandai "perkiraan" dan bisa diperbaiki lewat Edit Jurnal.

    python migrations/migrate_kehadiran_jurnal.py
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

STATUS = ('hadir', 'sakit', 'izin', 'alpa')


def _status(s):
    s = str(s or 'hadir').strip().lower()
    return 'alpa' if s in ('alpha', 'alpa', 'a') else (s if s in STATUS else 'hadir')


async def migrate(db):
    dipulihkan = 0
    waktu = datetime.now(timezone(timedelta(hours=7))).isoformat()
    async for j in db.journals.find({'attendance_details.0': {'$exists': True}}, {'_id': 0, 'id': 1, 'attendance_details': 1, 'started_at': 1}):
        if not j.get('id') or await db.attendances.find_one({'journal_id': j['id']}, {'_id': 1}):
            continue
        baris = {}
        for r in j['attendance_details']:
            if isinstance(r, dict) and r.get('student_id'):
                baris[r['student_id']] = {'student_id': r['student_id'], 'student_name': r.get('student_name'), 'status': _status(r.get('status'))}
        if not baris:
            continue
        tanpa = [k for k, v in baris.items() if not v.get('student_name') or v['student_name'] == '-']
        if tanpa:
            async for u in db.users.find({'id': {'$in': tanpa}}, {'_id': 0, 'id': 1, 'full_name': 1, 'username': 1}):
                baris[u['id']]['student_name'] = u.get('full_name') or u.get('username')
        await db.attendances.insert_many([{'id': str(uuid.uuid4()), 'journal_id': j['id'], **{**v, 'student_name': v.get('student_name') or '-'},
                                           'created_at': j.get('started_at') or waktu} for v in baris.values()])
        n = {s: sum(1 for v in baris.values() if v['status'] == s) for s in STATUS}
        await db.journals.update_one({'id': j['id']}, {'$set': {
            'attendance_details': list(baris.values()),
            'siswa_hadir': n['hadir'], 'siswa_sakit': n['sakit'], 'siswa_izin': n['izin'], 'siswa_tidak_hadir': n['alpa']}})
        dipulihkan += 1
    dinormalkan = (await db.attendances.update_many({'status': 'alpha'}, {'$set': {'status': 'alpa'}})).modified_count

    # Tanggal pelajaran di setiap catatan kehadiran (dipakai riwayat kehadiran di akun siswa):
    # dari started_at jurnal, dinormalkan ke WIB; cadangan: created_at catatan.
    from journal_core import tanggal_wib
    bertanggal = 0
    cache = {}
    async for a in db.attendances.find({'tanggal': {'$exists': False}}, {'_id': 1, 'journal_id': 1, 'created_at': 1}):
        jid = a.get('journal_id')
        if jid not in cache:
            cache[jid] = await db.journals.find_one({'id': jid}, {'_id': 0, 'started_at': 1, 'class_id': 1, 'subject_id': 1}) or {}
        j = cache[jid]
        sumber = j.get('started_at') or a.get('created_at')
        if not sumber:
            continue
        await db.attendances.update_one({'_id': a['_id']}, {'$set': {
            'tanggal': tanggal_wib(sumber), 'class_id': j.get('class_id'), 'subject_id': j.get('subject_id')}})
        bertanggal += 1
    await db.attendances.create_index('journal_id')
    await db.attendances.create_index([('student_id', 1), ('tanggal', -1)])
    return {'jurnal_dipulihkan': dipulihkan, 'status_alpha_dinormalkan': dinormalkan, 'tanggal_dilengkapi': bertanggal}


async def main():
    client = AsyncIOMotorClient(os.getenv('MONGO_URL') or os.getenv('MONGO_URI', 'mongodb://localhost:27017'))
    db = client[os.getenv('DB_NAME', 'super_app_madrasah')]
    print(await migrate(db))
    client.close()


if __name__ == '__main__':
    asyncio.run(main())
