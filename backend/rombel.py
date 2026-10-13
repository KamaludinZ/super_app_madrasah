"""Rombel (rombongan belajar) per semester & riwayat keaktifan siswa.

Model data:
- Setiap rombel (koleksi `classes`) milik SATU semester (`semester_id`). Tiap semester dibuat rombel baru.
- `users.student_class_id` = rombel siswa SAAT INI (satu nilai).
- `class_history` = riwayat lengkap: satu dokumen per masa siswa berada di satu rombel
  ({student_id, class_id, semester_id, academic_year_id, semester, semester_belajar, reason,
  from_class_id, start_date, end_date}). end_date None = masih di rombel itu.

Semua perpindahan siswa (naik kelas, lanjut semester, pindah rombel, tinggal kelas, pindah semester
kelas percepatan, lulus, mutasi) lewat fungsi di modul ini agar riwayatnya selalu tercatat sama.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from core import db
from journal_core import now_wib

# Alasan masuk ke sebuah rombel (class_history.reason)
ALASAN_LABEL = {
    'pembagian_kelas': 'Pembagian Kelas',
    'naik_kelas': 'Naik Kelas',
    'lanjut_semester': 'Lanjut Semester',
    'pindah_kelas': 'Pindah Rombel',
    'tinggal_kelas': 'Tinggal Kelas',
    'pindah_semester': 'Pindah Semester (Percepatan)',
    'mutasi_masuk': 'Mutasi Masuk',
    'mutasi_keluar': 'Mutasi Keluar',
    'lulus': 'Lulus',
}
# Aksi yang memindahkan siswa ke rombel lain (butuh rombel tujuan)
AKSI_PINDAH = ('naik_kelas', 'lanjut_semester', 'pindah_kelas', 'tinggal_kelas', 'pindah_semester')


def hari_ini() -> str:
    return now_wib().strftime('%Y-%m-%d')


async def semester_aktif_id() -> Optional[str]:
    sem = await db.semesters.find_one({'is_active': True}, {'_id': 0, 'id': 1})
    return sem['id'] if sem else None


async def info_semester(semester_id: Optional[str]) -> Dict[str, Any]:
    if not semester_id:
        return {}
    return await db.semesters.find_one({'id': semester_id}, {'_id': 0}) or {}


async def anggota_rombel_ids(cls: Dict, aktif_id: Optional[str] = None, riwayat: Optional[bool] = None) -> List[str]:
    """ID siswa anggota rombel.

    Rombel semester aktif (atau tanpa semester): siswa yang SAAT INI berada di rombel itu.
    Rombel semester lain (lampau): semua siswa yang pernah tercatat di rombel itu (riwayat), sehingga
    rombel semester lalu tetap terlihat isinya walau siswanya sudah naik/pindah.
    """
    sekarang = [u['id'] async for u in db.users.find({'roles': 'siswa', 'student_class_id': cls['id']}, {'_id': 0, 'id': 1})]
    if riwayat is None:
        if aktif_id is None:
            aktif_id = await semester_aktif_id()
        riwayat = bool(cls.get('semester_id') and aktif_id and cls['semester_id'] != aktif_id)
    if riwayat:
        riwayat = await db.class_history.distinct('student_id', {'class_id': cls['id'], 'reason': {'$nin': ['lulus', 'mutasi_keluar']}})
        sekarang = list(dict.fromkeys(sekarang + riwayat))
    return sekarang


async def kelas_perwalian(user: Dict, semester_id: Optional[str] = None, projection: Optional[Dict] = None) -> Optional[Dict]:
    """Rombel yang diampu wali kelas pada semester yang sedang dilihat (konteks lihat pengguna).
    Data lama tanpa semester_id tetap dikenali sebagai cadangan."""
    proj = projection or {'_id': 0}
    if semester_id is None:
        from core import get_active_context
        semester_id = (await get_active_context(user)).get('semester_id')
    q = {'homeroom_teacher_id': user['id']}
    if semester_id:
        cls = await db.classes.find_one({**q, 'semester_id': semester_id}, proj)
        if cls:
            return cls
        return await db.classes.find_one({**q, '$or': [{'semester_id': None}, {'semester_id': {'$exists': False}}]}, proj)
    return await db.classes.find_one(q, proj)


async def _konteks_rombel(cls: Dict) -> Dict[str, Any]:
    sem = await info_semester(cls.get('semester_id'))
    return {
        'semester_id': cls.get('semester_id'),
        'academic_year_id': sem.get('academic_year_id') or cls.get('academic_year_id'),
        'semester': sem.get('code') or sem.get('name') or cls.get('semester') or '',
    }


async def tutup_riwayat_aktif(student: Dict, tanggal: str, user: Dict) -> None:
    """Akhiri masa rombel siswa yang masih berjalan. Bila siswa punya rombel tetapi belum punya
    riwayat (data lama sebelum riwayat dicatat), riwayat rombel itu dibuat dulu agar tidak hilang."""
    sid = student['id']
    kelas_kini = student.get('student_class_id')
    if kelas_kini and not await db.class_history.find_one({'student_id': sid, 'class_id': kelas_kini}, {'_id': 1}):
        cls = await db.classes.find_one({'id': kelas_kini}, {'_id': 0})
        if cls:
            sem = await info_semester(cls.get('semester_id'))
            await db.class_history.insert_one({
                **_dok_riwayat(sid, cls, await _konteks_rombel(cls), 'pembagian_kelas', sem.get('start_date') or '', user),
                'notes': 'Dicatat otomatis dari data kelas sebelumnya',
            })
    await db.class_history.update_many({'student_id': sid, 'end_date': None}, {'$set': {'end_date': tanggal}})


def _dok_riwayat(student_id: str, cls: Dict, ktx: Dict, reason: str, tanggal: str, user: Dict, **extra) -> Dict:
    import uuid
    return {
        'id': str(uuid.uuid4()),
        'student_id': student_id,
        'class_id': cls['id'],
        'class_name': cls.get('name'),
        'semester_id': ktx.get('semester_id'),
        'academic_year_id': ktx.get('academic_year_id'),
        'semester': ktx.get('semester'),
        'reason': reason,
        'start_date': tanggal,
        'end_date': None,
        'notes': None,
        'created_by_user_id': user['id'],
        'created_at': datetime.utcnow().isoformat(),
        **{k: v for k, v in extra.items() if v is not None},
    }


async def alasan_otomatis(kelas_lama: Optional[Dict], kelas_baru: Dict) -> str:
    """Tebak alasan perpindahan dari rombel lama ke rombel baru (dipakai saat menambah siswa manual)."""
    if not kelas_lama:
        return 'pembagian_kelas'
    if kelas_lama.get('semester_id') == kelas_baru.get('semester_id'):
        return 'pindah_kelas'
    g_lama, g_baru = int(kelas_lama.get('grade') or 0), int(kelas_baru.get('grade') or 0)
    if g_baru > g_lama:
        return 'naik_kelas'
    sem_lama, sem_baru = await info_semester(kelas_lama.get('semester_id')), await info_semester(kelas_baru.get('semester_id'))
    if sem_lama.get('academic_year_id') and sem_lama.get('academic_year_id') == sem_baru.get('academic_year_id'):
        return 'lanjut_semester' if kelas_lama.get('name') == kelas_baru.get('name') else 'pindah_kelas'
    return 'tinggal_kelas'


async def pindahkan_siswa(student: Dict, to_class: Dict, reason: str, tanggal: str, user: Dict,
                          semester_belajar: Optional[str] = None, notes: Optional[str] = None) -> Dict:
    """Pindahkan siswa ke rombel tujuan dan catat riwayatnya. Mengembalikan dokumen riwayat baru."""
    dari = student.get('student_class_id')
    await tutup_riwayat_aktif(student, tanggal, user)
    await db.users.update_one({'id': student['id']}, {'$set': {'student_class_id': to_class['id'], 'graduation_status': 'aktif'}})
    doc = _dok_riwayat(student['id'], to_class, await _konteks_rombel(to_class), reason, tanggal, user,
                       from_class_id=dari, semester_belajar=semester_belajar, notes=notes)
    await db.class_history.insert_one(doc)
    doc.pop('_id', None)
    return doc


async def catat_keluar(student: Dict, reason: str, tanggal: str, user: Dict, notes: Optional[str] = None) -> Optional[Dict]:
    """Catat siswa keluar dari rombelnya (lulus / mutasi keluar) sebagai entri riwayat tertutup."""
    kelas_kini = student.get('student_class_id')
    await tutup_riwayat_aktif(student, tanggal, user)
    if not kelas_kini:
        return None
    cls = await db.classes.find_one({'id': kelas_kini}, {'_id': 0})
    if not cls:
        return None
    doc = _dok_riwayat(student['id'], cls, await _konteks_rombel(cls), reason, tanggal, user, notes=notes)
    doc['end_date'] = tanggal
    await db.class_history.insert_one(doc)
    doc.pop('_id', None)
    return doc


async def rombel_siswa_di_semester(student_ids: List[str], semester_id: str) -> Dict[str, Dict]:
    """{student_id: rombel} — rombel tiap siswa pada semester tertentu (riwayat atau saat ini).
    Bila siswa pernah di beberapa rombel dalam semester itu, yang terakhir dipakai."""
    kelas = {c['id']: c for c in await db.classes.find({'semester_id': semester_id}, {'_id': 0}).to_list(1000)}
    if not kelas:
        return {}
    hasil: Dict[str, Dict] = {}
    async for h in db.class_history.find({'student_id': {'$in': student_ids}, 'class_id': {'$in': list(kelas)},
                                          'reason': {'$nin': ['lulus', 'mutasi_keluar']}}, {'_id': 0}).sort('start_date', 1):
        hasil[h['student_id']] = kelas[h['class_id']]
    async for u in db.users.find({'id': {'$in': student_ids}, 'student_class_id': {'$in': list(kelas)}}, {'_id': 0, 'id': 1, 'student_class_id': 1}):
        hasil[u['id']] = kelas[u['student_class_id']]
    return hasil
