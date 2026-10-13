"""Promotions - Naik kelas, pindah semester, dan kelulusan siswa.

Semua perpindahan lewat rombel.py agar users.student_class_id dan class_history (riwayat keaktifan
siswa per rombel & semester) selalu konsisten. Endpoint utama: POST /promotions/proses — satu
permintaan berisi aksi per siswa (naik kelas, lanjut semester, pindah rombel, tinggal kelas, pindah
semester kelas percepatan, lulus). Endpoint lama (naik-kelas, pindah-semester, lulus) tetap ada dan
memakai proses yang sama.
"""
from typing import Dict, List, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from core import db, require_role, serialize_doc, log_audit
from models import PromotionRequest
from rombel import AKSI_PINDAH, ALASAN_LABEL, anggota_rombel_ids, catat_keluar, hari_ini, pindahkan_siswa
from routers._shared import FILTER_SISWA_AKTIF

router = APIRouter()

PROMOSI_ROLES = ('admin', 'waka_kurikulum')

AKSI_LABEL = {**{k: ALASAN_LABEL[k] for k in AKSI_PINDAH}, 'lulus': 'Lulus'}


class ProsesItem(BaseModel):
    student_id: str
    aksi: Literal['naik_kelas', 'lanjut_semester', 'pindah_kelas', 'tinggal_kelas', 'pindah_semester', 'lulus']
    to_class_id: Optional[str] = None
    semester_belajar: Optional[str] = None  # kelas percepatan: semester belajar tujuan, mis. "2"
    notes: Optional[str] = None


class ProsesRombelRequest(BaseModel):
    tanggal: Optional[str] = None  # tanggal efektif (YYYY-MM-DD), bawaan hari ini (WIB)
    items: List[ProsesItem]
    certificate_number_prefix: Optional[str] = None
    notes: Optional[str] = None


async def _proses(items: List[ProsesItem], tanggal: str, user: Dict, notes: Optional[str] = None,
                  cert_prefix: Optional[str] = None) -> Dict:
    """Proses aksi per siswa. Satu siswa gagal tidak membatalkan siswa lain."""
    berhasil: Dict[str, int] = {}
    errors: List[str] = []
    kelas_cache: Dict[str, Optional[Dict]] = {}
    isi_rombel: Dict[str, int] = {}
    nomor_ijazah = 1

    async def kelas(cid: str) -> Optional[Dict]:
        if cid not in kelas_cache:
            kelas_cache[cid] = await db.classes.find_one({'id': cid}, {'_id': 0})
        return kelas_cache[cid]

    for it in items:
        student = await db.users.find_one({'id': it.student_id, 'roles': 'siswa', 'graduation_status': {'$ne': 'lulus'}, **FILTER_SISWA_AKTIF},
                                          {'_id': 0, 'password_hash': 0})
        if not student:
            errors.append(f"{it.student_id}: siswa aktif tidak ditemukan")
            continue
        nama = student.get('full_name') or it.student_id
        catatan = it.notes or notes

        if it.aksi == 'lulus':
            kini = await kelas(student['student_class_id']) if student.get('student_class_id') else None
            if not kini:
                errors.append(f"{nama}: belum berada di rombel mana pun")
                continue
            no = None
            if cert_prefix:
                no = f"{cert_prefix}/{nomor_ijazah:04d}"
                nomor_ijazah += 1
            await catat_keluar(student, 'lulus', tanggal, user, notes=catatan or 'Lulus')
            await db.users.update_one({'id': student['id']}, {'$set': {
                'graduation_status': 'lulus',
                'graduation_date': tanggal,
                'graduation_ay_id': kini.get('academic_year_id'),
                'graduation_class_id': kini['id'],
                'graduation_certificate_number': no,
                'student_class_id': None,
                'is_active': True,  # akun tetap aktif untuk akses alumni
            }})
            berhasil['lulus'] = berhasil.get('lulus', 0) + 1
            continue

        if not it.to_class_id:
            errors.append(f"{nama}: rombel tujuan belum dipilih")
            continue
        tujuan = await kelas(it.to_class_id)
        if not tujuan:
            errors.append(f"{nama}: rombel tujuan tidak ditemukan")
            continue
        sama = student.get('student_class_id') == tujuan['id']
        if sama and it.aksi != 'pindah_semester':
            errors.append(f"{nama}: sudah berada di rombel {tujuan.get('name')}")
            continue
        if sama and not it.semester_belajar:
            errors.append(f"{nama}: isi semester belajar tujuan untuk pindah semester di rombel yang sama")
            continue
        if not sama:
            if tujuan['id'] not in isi_rombel:
                isi_rombel[tujuan['id']] = await db.users.count_documents({'roles': 'siswa', 'student_class_id': tujuan['id'], **FILTER_SISWA_AKTIF})
            if isi_rombel[tujuan['id']] >= (tujuan.get('capacity') or 40):
                errors.append(f"{nama}: rombel {tujuan.get('name')} sudah penuh (kapasitas {tujuan.get('capacity') or 40})")
                continue
            isi_rombel[tujuan['id']] += 1
        await pindahkan_siswa(student, tujuan, it.aksi, tanggal, user, semester_belajar=it.semester_belajar, notes=catatan)
        berhasil[it.aksi] = berhasil.get(it.aksi, 0) + 1

    total = sum(berhasil.values())
    rincian = ', '.join(f"{AKSI_LABEL[k]} {v}" for k, v in berhasil.items())
    return {
        'message': f"Berhasil memproses {total} siswa" + (f" ({rincian})" if rincian else ''),
        'success_count': total,
        'rincian': berhasil,
        'failed_count': len(errors),
        'errors': errors,
    }


@router.post("/promotions/proses")
async def proses_rombel(payload: ProsesRombelRequest, request: Request, user: Dict = Depends(require_role(*PROMOSI_ROLES))):
    """Proses semester baru / kenaikan / kelulusan / pindah semester percepatan, aksi per siswa."""
    if not payload.items:
        raise HTTPException(400, "Pilih minimal satu siswa")
    tanggal = payload.tanggal or hari_ini()
    hasil = await _proses(payload.items, tanggal, user, payload.notes, payload.certificate_number_prefix)
    await log_audit(user, 'proses_rombel', 'promotion', None,
                    details={'tanggal': tanggal, **hasil['rincian'], 'gagal': hasil['failed_count']}, request=request)
    return hasil


@router.post("/promotions/naik-kelas")
async def promote_class(payload: PromotionRequest, request: Request, user: Dict = Depends(require_role(*PROMOSI_ROLES))):
    """Naik kelas ke rombel tujuan (kompatibilitas; gunakan /promotions/proses)."""
    if payload.type != 'naik_kelas':
        raise HTTPException(400, "Type harus 'naik_kelas'")
    if not payload.to_class_id:
        raise HTTPException(400, "to_class_id wajib diisi")
    items = [ProsesItem(student_id=s, aksi='naik_kelas', to_class_id=payload.to_class_id) for s in payload.student_ids]
    hasil = await _proses(items, hari_ini(), user, payload.notes)
    await log_audit(user, 'naik_kelas', 'promotion', payload.to_class_id, details=hasil['rincian'], request=request)
    return hasil


@router.post("/promotions/pindah-semester")
async def move_semester(payload: PromotionRequest, request: Request, user: Dict = Depends(require_role(*PROMOSI_ROLES))):
    """Pindah semester (kelas percepatan), dengan atau tanpa pindah rombel (kompatibilitas)."""
    if payload.type != 'pindah_semester':
        raise HTTPException(400, "Type harus 'pindah_semester'")
    if not payload.to_semester:
        raise HTTPException(400, "to_semester wajib diisi")
    items = []
    for sid in payload.student_ids:
        s = await db.users.find_one({'id': sid}, {'_id': 0, 'student_class_id': 1}) or {}
        items.append(ProsesItem(student_id=sid, aksi='pindah_semester', to_class_id=payload.to_class_id or s.get('student_class_id'),
                                semester_belajar=payload.to_semester))
    hasil = await _proses(items, hari_ini(), user, payload.notes)
    await log_audit(user, 'pindah_semester', 'promotion', None, details=hasil['rincian'], request=request)
    return hasil


@router.post("/promotions/lulus")
async def graduate_students(payload: PromotionRequest, request: Request, user: Dict = Depends(require_role(*PROMOSI_ROLES))):
    """Kelulusan (kompatibilitas). Siswa tetap tersimpan sebagai alumni."""
    if payload.type != 'lulus':
        raise HTTPException(400, "Type harus 'lulus'")
    if not payload.graduation_date:
        raise HTTPException(400, "graduation_date wajib diisi")
    items = [ProsesItem(student_id=s, aksi='lulus') for s in payload.student_ids]
    hasil = await _proses(items, payload.graduation_date, user, payload.notes, payload.certificate_number_prefix)
    await log_audit(user, 'lulus', 'promotion', None, details=hasil['rincian'], request=request)
    return hasil


@router.get("/promotions/preview")
async def preview_promotion(
    from_class_id: str,
    type: str,
    user: Dict = Depends(require_role(*PROMOSI_ROLES, 'penjamin_mutu'))
):
    """
    Preview siswa yang akan diproses untuk naik kelas/semester/lulus.
    Returns list of students in the source class.
    """
    if type not in ['naik_kelas', 'pindah_semester', 'lulus', 'proses']:
        raise HTTPException(400, "Type tidak valid")

    # Siswa yang SAAT INI berada di rombel asal (yang sudah diproses tidak muncul lagi)
    students = await db.users.find(
        {'student_class_id': from_class_id, 'roles': 'siswa', **FILTER_SISWA_AKTIF},
        {'_id': 0, 'password_hash': 0}
    ).sort('full_name', 1).to_list(500)

    cls = await db.classes.find_one({'id': from_class_id}, {'_id': 0})
    # Semester belajar terakhir tiap siswa (kelas percepatan)
    for st in students:
        h = await db.class_history.find_one({'student_id': st['id'], 'end_date': None}, {'_id': 0, 'semester_belajar': 1})
        st['semester_belajar'] = (h or {}).get('semester_belajar')
    sudah_diproses = 0
    if cls:
        sudah_diproses = max(0, len(await anggota_rombel_ids(cls, riwayat=True)) - len(students))

    return {
        'class': serialize_doc(cls) if cls else None,
        'student_count': len(students),
        'students': [serialize_doc(s) for s in students],
        'sudah_diproses': sudah_diproses,
    }


@router.get("/promotions/history")
async def promotion_history(
    student_id: str = None,
    user: Dict = Depends(require_role(*PROMOSI_ROLES))
):
    """Get promotion history for a student or all students."""
    query = {}
    if student_id:
        query['student_id'] = student_id

    history = await db.class_history.find(
        query,
        {'_id': 0}
    ).sort('created_at', -1).to_list(1000)

    # Enrich with class and AY names
    for h in history:
        if h.get('class_id'):
            cls = await db.classes.find_one({'id': h['class_id']}, {'_id': 0})
            if cls:
                h['class_name'] = cls.get('name')
                h['grade'] = cls.get('grade')

        if h.get('academic_year_id'):
            ay = await db.academic_years.find_one({'id': h['academic_year_id']}, {'_id': 0})
            if ay:
                h['academic_year_name'] = ay.get('name')

        if h.get('student_id'):
            student = await db.users.find_one({'id': h['student_id']}, {'_id': 0, 'password_hash': 0})
            if student:
                h['student_name'] = student.get('full_name')
                h['student_nisn'] = student.get('nisn')

    return [serialize_doc(h) for h in history]
