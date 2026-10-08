"""Uji Notifikasi (khusus admin): kirim contoh SETIAP jenis notifikasi ke akun admin itu sendiri.

Dipakai untuk memeriksa di HP bahwa tiap jenis muncul, memakai kanal Android yang benar, dan saat
diketuk membuka layar yang tepat. Penerima SELALU pengguna yang memanggil — tidak pernah orang lain.
Judul diberi awalan [UJI]; isi tersimpan di lonceng notifikasi seperti notifikasi asli.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from core import db, log_audit, require_role
from notify import COLLECTION, RETENTION_DAYS
from routers.mobile import DEVICES, _expo_enabled, _is_expo_token, send_expo_push_to_users
from routers.push import _push_configured, send_push_to_users

router = APIRouter()

# Contoh per jenis: (jenis, label, kanal Android, rute web, data tambahan, judul, isi).
# Kanal & rute mengikuti pengirim aslinya (notify_users / pengumuman / pengingat mengajar).
JENIS_UJI: List[Dict] = [
    {'type': 'announcement', 'label': 'Pengumuman madrasah', 'channel': 'pengumuman', 'route': None,
     'title': 'Pengumuman: Rapat dinas', 'body': 'Rapat dinas seluruh GTK hari Sabtu pukul 08.00 di aula.', 'simpan': False},
    {'type': 'teaching_reminder', 'label': 'Pengingat mengajar', 'channel': 'pengingat-mengajar', 'route': None,
     'title': 'Jam mengajar 10 menit lagi', 'body': 'Kelas 7A · Matematika · jam ke-3 (contoh).', 'simpan': False},
    {'type': 'substitute_assignment', 'label': 'Ditugaskan sebagai guru pengganti', 'channel': 'guru-pengganti', 'route': '/dashboard',
     'title': 'Anda ditugaskan sebagai guru pengganti', 'body': 'Kelas 8B · IPA · jam ke-2 (contoh).'},
    {'type': 'substitute_assignment_cancelled', 'label': 'Penugasan guru pengganti dibatalkan', 'channel': 'guru-pengganti', 'route': '/dashboard',
     'title': 'Penugasan guru pengganti dibatalkan', 'body': 'Kelas 8B · IPA · jam ke-2 (contoh).'},
    {'type': 'class_task_new', 'label': 'Tugas kelas baru (siswa)', 'channel': 'umum', 'route': '/siswa/tugas',
     'title': 'Tugas baru: Latihan pecahan', 'body': 'Matematika · tenggat 3 hari lagi (contoh).'},
    {'type': 'class_material_new', 'label': 'Materi kelas baru (siswa)', 'channel': 'umum', 'route': '/siswa/materi',
     'title': 'Materi baru: Sistem pencernaan', 'body': 'IPA · dibagikan guru mapel (contoh).'},
    {'type': 'teacher_task_new', 'label': 'Tugas titipan baru (guru piket)', 'channel': 'umum', 'route': '/piket/tugas',
     'title': 'Tugas titipan baru', 'body': 'Kelas 9A · Bahasa Indonesia · jam ke-4 (contoh).'},
    {'type': 'teacher_task_accepted', 'label': 'Tugas titipan diterima piket', 'channel': 'umum', 'route': '/piket/tugas',
     'title': 'Tugas titipan Anda diterima guru piket', 'body': 'Kelas 9A · Bahasa Indonesia (contoh).'},
    {'type': 'piket_journal_filled', 'label': 'Jurnal diisi guru piket', 'channel': 'umum', 'route': '/jurnal/riwayat',
     'title': 'Jurnal Anda diisi guru piket', 'body': 'Kelas 7C · jam ke-1 (contoh).'},
    {'type': 'tatib_record', 'label': 'Catatan tata tertib (wali kelas/BK)', 'channel': 'umum', 'route': '/admin/tatib/data',
     'title': 'Pelanggaran tata tertib: Siswa contoh · 7A', 'body': 'Terlambat masuk madrasah (-5 poin) (contoh).'},
    {'type': 'verval_new', 'label': 'Ajuan verval baru', 'channel': 'umum', 'route': '/admin/verval-siswa',
     'title': 'Ajuan verval data siswa baru', 'body': 'Perubahan alamat · Siswa contoh (contoh).'},
    {'type': 'verval_approved', 'label': 'Ajuan verval disetujui', 'channel': 'umum', 'route': '/verval/ajuan-saya',
     'title': 'Ajuan verval Anda disetujui', 'body': 'Perubahan data diri telah diterapkan (contoh).'},
    {'type': 'verval_rejected', 'label': 'Ajuan verval ditolak', 'channel': 'umum', 'route': '/verval/ajuan-saya',
     'title': 'Ajuan verval Anda ditolak', 'body': 'Lampiran belum sesuai (contoh).'},
    {'type': 'achievement_new', 'label': 'Prestasi menunggu verifikasi', 'channel': 'umum', 'route': '/prestasi',
     'title': 'Prestasi baru menunggu verifikasi', 'body': 'Juara 2 lomba pidato tingkat kota (contoh).'},
    {'type': 'achievement_verified', 'label': 'Prestasi terverifikasi', 'channel': 'umum', 'route': '/prestasi',
     'title': 'Prestasi Anda terverifikasi', 'body': 'Juara 2 lomba pidato tingkat kota (contoh).'},
    {'type': 'damage_report', 'label': 'Laporan kerusakan baru (sarpras)', 'channel': 'umum', 'route': '/admin/sarpras/kerusakan',
     'title': 'Laporan kerusakan baru', 'body': 'Proyektor kelas 8A tidak menyala (contoh).'},
    {'type': 'damage_status', 'label': 'Status laporan kerusakan', 'channel': 'umum', 'route': '/admin/sarpras/kerusakan',
     'title': 'Laporan kerusakan Anda diproses', 'body': 'Status: sedang diperbaiki (contoh).'},
    {'type': 'loan_item', 'label': 'Peminjaman barang', 'channel': 'umum', 'route': '/dashboard',
     'title': 'Peminjaman barang disetujui', 'body': 'Speaker portabel · 2 hari (contoh).'},
    {'type': 'loan_room', 'label': 'Peminjaman ruangan', 'channel': 'umum', 'route': '/dashboard',
     'title': 'Peminjaman ruangan disetujui', 'body': 'Aula · Jumat 13.00 (contoh).'},
    {'type': 'bk_response', 'label': 'Tanggapan BK atas CLKB/PCL', 'channel': 'umum', 'route': '/siswa/clkb',
     'title': 'Guru BK menanggapi CLKB Anda', 'body': 'Lihat rekomendasi cara belajar (contoh).'},
]
JENIS_PER_KODE = {j['type']: j for j in JENIS_UJI}
AWALAN = '[UJI] '


class UjiRequest(BaseModel):
    jenis: Optional[List[str]] = None  # kosong = semua jenis


async def _status_perangkat(user_id: str) -> Dict:
    perangkat = await db[DEVICES].find({'user_id': user_id}, {'_id': 0, 'expo_push_token': 1, 'platform': 1}).to_list(50)
    return {
        'perangkat_aplikasi': sum(1 for d in perangkat if _is_expo_token(d.get('expo_push_token'))),
        'web_push_langganan': await db.push_subscriptions.count_documents({'user_id': user_id}),
        'expo_aktif': _expo_enabled(),
        'web_push_aktif': _push_configured(),
    }


@router.get("/admin/notifikasi/uji")
async def daftar_jenis_uji(user: Dict = Depends(require_role('admin'))):
    """Daftar jenis notifikasi yang bisa diuji + status perangkat admin yang memanggil."""
    return {
        'jenis': [{k: j[k] for k in ('type', 'label', 'channel', 'route')} for j in JENIS_UJI],
        'perangkat': await _status_perangkat(user['id']),
    }


@router.post("/admin/notifikasi/uji")
async def kirim_uji(req: UjiRequest, request: Request, user: Dict = Depends(require_role('admin'))):
    """Kirim contoh notifikasi (semua atau jenis tertentu) HANYA ke admin yang memanggil.
    -> hasil per jenis: {type, aplikasi: {sent, failed}, web: {sent, failed}}."""
    pilihan = req.jenis or [j['type'] for j in JENIS_UJI]
    tidak_dikenal = [t for t in pilihan if t not in JENIS_PER_KODE]
    if tidak_dikenal:
        raise HTTPException(400, f"Jenis tidak dikenal: {', '.join(tidak_dikenal)}")
    sekarang = datetime.now(timezone.utc)
    hasil = []
    for kode in pilihan:
        j = JENIS_PER_KODE[kode]
        judul = AWALAN + j['title']
        data = {'type': j['type'], 'uji': True, **({'route': j['route']} if j['route'] else {})}
        if j.get('simpan', True):
            await db[COLLECTION].insert_one({
                'id': str(uuid.uuid4()), 'user_id': user['id'], 'type': j['type'], 'title': judul, 'body': j['body'],
                'route': j['route'], 'data': {'uji': True}, 'is_read': False, 'created_at': sekarang.isoformat(),
                'expire_at': sekarang + timedelta(days=RETENTION_DAYS),
            })
        aplikasi = await send_expo_push_to_users([user['id']], judul, j['body'], data, channel_id=j['channel'])
        web = await send_push_to_users([user['id']], {
            'title': judul, 'body': j['body'], 'url': j['route'] or '/dashboard', 'tag': f"uji-{j['type']}",
            'icon': '/icon-192.png', 'badge': '/icon-192.png', 'data': {**data, 'url': j['route'] or '/dashboard'},
        })
        hasil.append({'type': j['type'], 'label': j['label'], 'channel': j['channel'],
                      'aplikasi': {k: aplikasi.get(k, 0) for k in ('sent', 'failed', 'removed')} | {'skipped': bool(aplikasi.get('skipped'))},
                      'web': {k: web.get(k, 0) for k in ('sent', 'failed', 'removed')} | {'skipped': bool(web.get('skipped'))}})
    await log_audit(user, 'notifikasi_uji', 'notifications', user['id'], details={'jenis': pilihan}, request=request)
    return {'perangkat': await _status_perangkat(user['id']), 'hasil': hasil}
