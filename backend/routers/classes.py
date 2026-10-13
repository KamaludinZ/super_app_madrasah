"""Classes CRUD + Excel import + Token generation."""
import io
import random
import re
import string
from datetime import datetime
from journal_core import now_wib
from typing import Dict, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core import (
    db,
    get_active_academic_year,
    get_current_user,
    log_audit,
    require_role,
    serialize_doc,
)
from core import DETAIL_SISWA_VIEWER_ROLES, GURU_MAPEL_ROLES
from routers.auth import _resolve_view_context
from excel_io import class_template, parse_class_rows
from models import ClassModel
from rombel import ALASAN_LABEL, alasan_otomatis, anggota_rombel_ids, pindahkan_siswa, semester_aktif_id, tutup_riwayat_aktif
from routers._shared import FILTER_SISWA_AKTIF

router = APIRouter()


def _generate_class_token(class_name: str, ay_name: Optional[str] = None) -> str:
    """Generate a short class token like '7A-2526-X9K2'.

    Used as fallback for QR scan: teachers/students can input this token manually.
    """
    # Year part: take last 2 digits of each year in TP, e.g. "2025/2026" -> "2526"
    year_part = ''
    if ay_name:
        digits = ''.join(c for c in ay_name if c.isdigit())
        if len(digits) >= 8:
            year_part = digits[2:4] + digits[6:8]
        elif len(digits) >= 4:
            year_part = digits[-4:]
    if not year_part:
        year_part = now_wib().strftime('%y')
    # Class part: take alnum from name (e.g. "7A" -> "7A")
    class_part = ''.join(c for c in class_name if c.isalnum()).upper() or 'CLS'
    # Random suffix
    rand = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    rand = rand.replace('O', 'X').replace('0', '2').replace('I', 'K').replace('1', 'L')
    return f"{class_part}-{year_part}-{rand}"


async def _ensure_unique_token(token: str) -> str:
    """Regenerate suffix if collision."""
    for _ in range(5):
        existing = await db.classes.find_one({'token': token})
        if not existing:
            return token
        # Replace last 4 chars
        rand = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        rand = rand.replace('O', 'X').replace('0', '2').replace('I', 'K').replace('1', 'L')
        token = token.rsplit('-', 1)[0] + '-' + rand
    return token  # accept after 5 tries (extremely unlikely)


@router.get("/classes")
async def list_classes(semester_id: Optional[str] = None, user: Dict = Depends(get_current_user)):
    """List classes filtered by user's view context (semester), atau semester_id tertentu
    (dipakai halaman Proses Rombel untuk memilih rombel semester asal/tujuan)."""
    if not semester_id:
        ctx = await _resolve_view_context(user)
        semester_id = ctx.get('semester_id')
    aktif_id = await semester_aktif_id()

    # Filter by semester_id from view context
    q = {}
    if semester_id:
        q['semester_id'] = semester_id

    items = await db.classes.find(q, {'_id': 0}).sort('name', 1).to_list(500)
    enriched = []
    for c in items:
        # Rombel semester lampau: jumlah siswa yang pernah tercatat di rombel itu (riwayat).
        c['student_count'] = len(await anggota_rombel_ids(c, aktif_id))
        c['is_rombel_lampau'] = bool(c.get('semester_id') and aktif_id and c['semester_id'] != aktif_id)
        c.setdefault('capacity', 40)
        if c.get('homeroom_teacher_id'):
            t = await db.users.find_one({'id': c['homeroom_teacher_id']}, {'_id': 0, 'full_name': 1})
            c['homeroom_teacher_name'] = t.get('full_name') if t else None
        if c.get('room_id'):
            r = await db.rooms.find_one({'id': c['room_id']}, {'_id': 0, 'name': 1})
            c['room_name'] = r.get('name') if r else None

        # Enrich with semester info
        if c.get('semester_id'):
            sem = await db.semesters.find_one({'id': c['semester_id']}, {'_id': 0})
            if sem:
                c['semester_name'] = sem.get('name')
                c['semester_code'] = sem.get('code')
                # Enrich with academic year
                ay = await db.academic_years.find_one({'id': sem.get('academic_year_id')}, {'_id': 0, 'name': 1})
                if ay:
                    c['academic_year_name'] = ay.get('name')
                # Enrich with curriculum from semester
                if sem.get('curriculum_id'):
                    cur = await db.curriculums.find_one({'id': sem['curriculum_id']}, {'_id': 0, 'name': 1, 'code': 1})
                    if cur:
                        c['curriculum_name'] = cur.get('name')
                        c['curriculum_code'] = cur.get('code')

        enriched.append(serialize_doc(c))
    return enriched


@router.post("/classes")
async def create_class(payload: Dict, request: Request, user: Dict = Depends(require_role('admin'))):
    """Create a new class. semester_id is required."""
    if not payload.get('semester_id'):
        raise HTTPException(400, "semester_id wajib diisi")

    cls = ClassModel(**payload)

    # Auto-generate token if not provided
    if not cls.token:
        ay = await db.academic_years.find_one({'id': cls.academic_year_id}, {'_id': 0, 'name': 1})
        token = _generate_class_token(cls.name, ay.get('name') if ay else None)
        token = await _ensure_unique_token(token)
        cls.token = token

    doc = cls.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.classes.insert_one(doc)
    await log_audit(user, 'create', 'class', cls.id, details={'name': cls.name, 'token': cls.token}, request=request)
    return serialize_doc(doc)


class SalinStrukturRequest(BaseModel):
    from_semester_id: str
    to_semester_id: str
    naik_tingkat: bool = False  # Genap -> Ganjil TP baru: 7A -> 8A (tingkat akhir tidak disalin)
    salin_wali: bool = True
    tingkat_akhir: int = 9


_ROMAWI = {1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X', 11: 'XI', 12: 'XII'}


def _nama_rombel_naik(nama: str, grade: int, parallel: str) -> str:
    """'7A' -> '8A', '7 A' -> '8 A', 'VII-A' -> 'VIII-A'; bila pola tidak dikenali: '<grade+1><paralel>'."""
    m = re.match(r'^(\D*?)(\d+)(.*)$', nama or '')
    if m and int(m.group(2)) == grade:
        return f"{m.group(1)}{grade + 1}{m.group(3)}"
    r = _ROMAWI.get(grade)
    if r and re.match(rf'^{r}(?![IVX])', nama or ''):
        return _ROMAWI.get(grade + 1, str(grade + 1)) + nama[len(r):]
    return f"{grade + 1}{parallel or ''}"


@router.post("/classes/salin-struktur")
async def salin_struktur_rombel(req: SalinStrukturRequest, request: Request, user: Dict = Depends(require_role('admin', 'waka_kurikulum'))):
    """Buat rombel semester tujuan dari struktur rombel semester asal (nama, paralel, wali kelas,
    ruang, kapasitas, percepatan). Rombel yang namanya sudah ada di semester tujuan dilewati.
    Siswa TIDAK ikut dipindah — proses siswa lewat menu Naik Kelas / Proses Rombel."""
    if req.from_semester_id == req.to_semester_id:
        raise HTTPException(400, "Semester asal dan tujuan harus berbeda")
    tujuan = await db.semesters.find_one({'id': req.to_semester_id}, {'_id': 0})
    if not tujuan or not await db.semesters.find_one({'id': req.from_semester_id}, {'_id': 1}):
        raise HTTPException(404, "Semester tidak ditemukan")
    ay = await db.academic_years.find_one({'id': tujuan.get('academic_year_id')}, {'_id': 0, 'name': 1})
    sudah = {c['name'] for c in await db.classes.find({'semester_id': req.to_semester_id}, {'_id': 0, 'name': 1}).to_list(1000)}
    dibuat, dilewati = [], []
    for c in await db.classes.find({'semester_id': req.from_semester_id}, {'_id': 0}).sort('name', 1).to_list(1000):
        grade = int(c.get('grade') or 0)
        if req.naik_tingkat:
            if grade >= req.tingkat_akhir:
                dilewati.append(f"{c['name']} (tingkat akhir)")
                continue
            nama, grade_baru = _nama_rombel_naik(c['name'], grade, c.get('parallel')), grade + 1
        else:
            nama, grade_baru = c['name'], grade
        if nama in sudah:
            dilewati.append(f"{nama} (sudah ada)")
            continue
        baru = ClassModel(
            name=nama, grade=grade_baru, parallel=c.get('parallel') or '', academic_year_id=tujuan.get('academic_year_id'),
            semester_id=req.to_semester_id, homeroom_teacher_id=c.get('homeroom_teacher_id') if req.salin_wali else None,
            room_id=c.get('room_id'), capacity=c.get('capacity') or 40, is_accelerated=bool(c.get('is_accelerated')),
            curriculum_id=tujuan.get('curriculum_id') or c.get('curriculum_id'),
        )
        baru.token = await _ensure_unique_token(_generate_class_token(nama, ay.get('name') if ay else None))
        doc = baru.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['disalin_dari_class_id'] = c['id']
        await db.classes.insert_one(doc)
        sudah.add(nama)
        dibuat.append(nama)
    await log_audit(user, 'salin_struktur_rombel', 'class', req.to_semester_id,
                    details={'dari': req.from_semester_id, 'dibuat': len(dibuat), 'dilewati': len(dilewati)}, request=request)
    return {'message': f"{len(dibuat)} rombel dibuat" + (f", {len(dilewati)} dilewati" if dilewati else ''),
            'dibuat': dibuat, 'dilewati': dilewati}


@router.put("/classes/{cid}")
async def update_class(cid: str, payload: Dict, request: Request, user: Dict = Depends(require_role('admin'))):
    payload.pop('token', None)  # token tidak boleh diubah via update; gunakan regenerate-token
    res = await db.classes.update_one({'id': cid}, {'$set': payload})
    if res.matched_count == 0:
        raise HTTPException(404, "Kelas tidak ditemukan")
    await log_audit(user, 'update', 'class', cid, details=payload, request=request)
    doc = await db.classes.find_one({'id': cid}, {'_id': 0})
    return serialize_doc(doc)


@router.delete("/classes/{cid}")
async def delete_class(cid: str, request: Request, user: Dict = Depends(require_role('admin'))):
    await db.classes.delete_one({'id': cid})
    await log_audit(user, 'delete', 'class', cid, request=request)
    return {'message': 'Dihapus'}


@router.post("/classes/{cid}/regenerate-token")
async def regenerate_class_token(cid: str, request: Request, user: Dict = Depends(require_role('admin'))):
    """Generate ulang token kelas. Token lama tidak bisa digunakan lagi setelah ini."""
    cls = await db.classes.find_one({'id': cid}, {'_id': 0})
    if not cls:
        raise HTTPException(404, "Kelas tidak ditemukan")
    ay = await db.academic_years.find_one({'id': cls.get('academic_year_id')}, {'_id': 0, 'name': 1})
    new_token = _generate_class_token(cls['name'], ay.get('name') if ay else None)
    new_token = await _ensure_unique_token(new_token)
    await db.classes.update_one({'id': cid}, {'$set': {'token': new_token}})
    await log_audit(user, 'regenerate_token', 'class', cid, details={'new_token': new_token}, request=request)
    return {'token': new_token, 'message': 'Token baru dibuat. Token lama tidak berlaku lagi.'}


# Backfill: ensure every class has a token (run once on first access)
@router.post("/classes/backfill-tokens")
async def backfill_tokens(request: Request, user: Dict = Depends(require_role('admin'))):
    """Bulk: generate token untuk semua kelas yang belum punya."""
    classes = await db.classes.find({'$or': [{'token': None}, {'token': {'$exists': False}}]},
                                    {'_id': 0}).to_list(500)
    updated = 0
    for c in classes:
        ay = await db.academic_years.find_one({'id': c.get('academic_year_id')}, {'_id': 0, 'name': 1})
        token = _generate_class_token(c['name'], ay.get('name') if ay else None)
        token = await _ensure_unique_token(token)
        await db.classes.update_one({'id': c['id']}, {'$set': {'token': token}})
        updated += 1
    await log_audit(user, 'backfill_tokens', 'class', None, details={'count': updated}, request=request)
    return {'updated': updated}


@router.get("/classes/excel-template")
async def classes_template_dl(user: Dict = Depends(require_role('admin'))):
    return StreamingResponse(
        io.BytesIO(class_template()),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': 'attachment; filename="template_kelas_matsandatama.xlsx"'},
    )


@router.post("/classes/import-excel")
async def classes_import(file: UploadFile = File(...), request: Request = None,
                         user: Dict = Depends(require_role('admin'))):
    if not file.filename.lower().endswith(('.xlsx', '.xlsm')):
        raise HTTPException(400, "Hanya .xlsx")
    contents = await file.read()
    rows = parse_class_rows(contents)

    # Get active semester context for creating classes
    ctx = await get_active_context(user)
    semester_id = ctx.get('semester_id')
    if not semester_id:
        raise HTTPException(400, "Tidak ada semester aktif")

    users_map = {u['username']: u['id'] for u in await db.users.find({}, {'_id': 0, 'username': 1, 'id': 1}).to_list(2000)}
    rooms_map = {r['name']: r['id'] for r in await db.rooms.find({}, {'_id': 0, 'name': 1, 'id': 1}).to_list(500)}
    success = 0
    errors = []
    new_docs = []
    for r in rows:
        try:
            if not r['name']:
                errors.append(f"Baris {r['_row']}: nama kelas wajib"); continue
            existing = await db.classes.find_one({'name': r['name'], 'semester_id': semester_id})
            if existing:
                errors.append(f"Baris {r['_row']}: kelas '{r['name']}' sudah ada di semester aktif"); continue
            homeroom_id = users_map.get(r.get('wali_kelas_username')) if r.get('wali_kelas_username') else None
            room_id = rooms_map.get(r.get('ruang_kode')) if r.get('ruang_kode') else None
            cls = ClassModel(
                name=r['name'], grade=r['grade'], parallel=r['parallel'],
                semester_id=semester_id,
                homeroom_teacher_id=homeroom_id, room_id=room_id,
                is_accelerated=r.get('is_accelerated', False),
            )
            doc = cls.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            new_docs.append(doc)
            success += 1
        except Exception as e:
            errors.append(f"Baris {r['_row']}: {e}")
    if new_docs:
        await db.classes.insert_many(new_docs)
    await log_audit(user, 'import_excel', 'class', None, details={'success': success, 'errors': len(errors)}, request=request)
    return {'success': success, 'errors': errors, 'total_rows': len(rows)}


# ==================== Class Student Management ====================

@router.get("/classes/{cid}/students")  # Allow admin, wali_kelas, and guru
async def get_class_students(cid: str, user: Dict = Depends(require_role('admin', 'wali_kelas', *GURU_MAPEL_ROLES))):
    """Get list of students in a specific class."""
    cls = await db.classes.find_one({'id': cid}, {'_id': 0})
    if not cls:
        raise HTTPException(404, "Kelas tidak ditemukan")

    aktif_id = await semester_aktif_id()
    ids = await anggota_rombel_ids(cls, aktif_id)
    students = await db.users.find({'id': {'$in': ids}, 'roles': 'siswa'}, {'_id': 0, 'password_hash': 0}).sort('full_name', 1).to_list(500)
    lampau = bool(cls.get('semester_id') and aktif_id and cls['semester_id'] != aktif_id)
    if not lampau:
        students = [st for st in students if st.get('is_active', True) is not False]
    else:
        # Masa siswa di rombel lampau ini + rombel sesudahnya
        for st in students:
            h = await db.class_history.find_one({'student_id': st['id'], 'class_id': cid}, {'_id': 0}, sort=[('start_date', -1)])
            st['periode_mulai'] = (h or {}).get('start_date')
            st['periode_selesai'] = (h or {}).get('end_date')
            berikut = await db.class_history.find_one({'student_id': st['id'], 'from_class_id': cid}, {'_id': 0, 'reason': 1, 'class_name': 1})
            keluar = await db.class_history.find_one({'student_id': st['id'], 'class_id': cid, 'reason': {'$in': ['lulus', 'mutasi_keluar']}}, {'_id': 0, 'reason': 1})
            st['keterangan_lanjut'] = (
                f"{ALASAN_LABEL.get(berikut['reason'], berikut['reason'])} ke {berikut.get('class_name') or '-'}" if berikut
                else (ALASAN_LABEL.get(keluar['reason']) if keluar else None))

    return {
        'class': serialize_doc(cls),
        'students': [serialize_doc(s) for s in students],
        'count': len(students),
        'is_rombel_lampau': lampau,
    }


@router.get("/classes/{cid}/available-students")
async def get_available_students(cid: str, user: Dict = Depends(require_role('admin'))):
    """Get list of students without class assignment (available to be added to class)."""
    # Get class to check its grade level and academic year
    cls = await db.classes.find_one({'id': cid}, {'_id': 0})
    if not cls:
        raise HTTPException(404, "Kelas tidak ditemukan")

    # Siswa aktif yang belum punya rombel, atau rombelnya masih di semester lain (mis. semester lalu
    # yang belum diproses) — sehingga rombel semester baru bisa diisi langsung dari sini.
    kelas_semester_ini = [c['id'] for c in await db.classes.find({'semester_id': cls.get('semester_id')}, {'_id': 0, 'id': 1}).to_list(1000)] if cls.get('semester_id') else [cid]
    students = await db.users.find({
        'roles': 'siswa', **FILTER_SISWA_AKTIF, 'graduation_status': {'$ne': 'lulus'},
        '$or': [
            {'student_class_id': None},
            {'student_class_id': {'$exists': False}},
            {'student_class_id': {'$nin': kelas_semester_ini}},
        ],
    }, {'_id': 0, 'password_hash': 0}).sort('full_name', 1).to_list(2000)
    nama_kelas = {c['id']: c.get('name') for c in await db.classes.find(
        {'id': {'$in': list({s.get('student_class_id') for s in students if s.get('student_class_id')})}}, {'_id': 0, 'id': 1, 'name': 1}).to_list(1000)}
    for st in students:
        st['kelas_sebelumnya'] = nama_kelas.get(st.get('student_class_id'))
    return [serialize_doc(s) for s in students]


@router.post("/classes/{cid}/students/{student_id}")
async def add_student_to_class(
    cid: str,
    student_id: str,
    payload: Dict,
    request: Request,
    user: Dict = Depends(require_role('admin'))
):
    """Add a student to a class and record in history."""
    cls = await db.classes.find_one({'id': cid}, {'_id': 0})
    if not cls:
        raise HTTPException(404, "Kelas tidak ditemukan")

    student = await db.users.find_one({'id': student_id, 'roles': 'siswa'}, {'_id': 0})
    if not student:
        raise HTTPException(404, "Siswa tidak ditemukan")

    kelas_lama = await db.classes.find_one({'id': student.get('student_class_id')}, {'_id': 0}) if student.get('student_class_id') else None
    if kelas_lama and kelas_lama['id'] == cid:
        raise HTTPException(400, "Siswa sudah berada di kelas ini")
    if kelas_lama and kelas_lama.get('semester_id') == cls.get('semester_id'):
        raise HTTPException(400, f"Siswa masih di rombel {kelas_lama.get('name')} pada semester yang sama. Pindahkan lewat menu Naik Kelas / Proses Rombel atau hapus dari rombel lama dulu.")

    # Check class capacity
    current_count = await db.users.count_documents({'roles': 'siswa', 'student_class_id': cid, **FILTER_SISWA_AKTIF})
    capacity = cls.get('capacity', 40)
    if current_count >= capacity:
        raise HTTPException(400, f"Kelas sudah penuh (kapasitas: {capacity})")
    if not cls.get('semester_id'):
        raise HTTPException(400, "Kelas tidak memiliki semester_id")

    # Siswa dari rombel semester lain dipindahkan (riwayat rombel lama ditutup otomatis).
    reason = payload.get('reason') or await alasan_otomatis(kelas_lama, cls)
    if reason not in ALASAN_LABEL or reason in ('lulus', 'mutasi_keluar'):
        raise HTTPException(400, "Alasan tidak valid")
    doc = await pindahkan_siswa(student, cls, reason, payload.get('start_date') or now_wib().strftime('%Y-%m-%d'), user,
                                semester_belajar=payload.get('semester_belajar'), notes=payload.get('notes'))

    await log_audit(user, 'add_student_to_class', 'class', cid,
                    details={'student_id': student_id, 'student_name': student.get('full_name'), 'reason': reason},
                    request=request)

    return {'message': 'Siswa berhasil ditambahkan ke kelas', 'history': serialize_doc(doc)}


@router.delete("/classes/{cid}/students/{student_id}")
async def remove_student_from_class(
    cid: str,
    student_id: str,
    payload: Dict,
    request: Request,
    user: Dict = Depends(require_role('admin'))
):
    """Remove a student from a class and update history."""
    cls = await db.classes.find_one({'id': cid}, {'_id': 0})
    if not cls:
        raise HTTPException(404, "Kelas tidak ditemukan")

    student = await db.users.find_one({'id': student_id, 'roles': 'siswa'}, {'_id': 0})
    if not student:
        raise HTTPException(404, "Siswa tidak ditemukan")

    if student.get('student_class_id') != cid:
        raise HTTPException(400, "Siswa tidak terdaftar di kelas ini")

    end_date = payload.get('end_date') or now_wib().strftime('%Y-%m-%d')
    await tutup_riwayat_aktif(student, end_date, user)
    await db.users.update_one({'id': student_id}, {'$set': {'student_class_id': None}})

    await log_audit(user, 'remove_student_from_class', 'class', cid,
                    details={'student_id': student_id, 'student_name': student.get('full_name')},
                    request=request)

    return {'message': 'Siswa berhasil dihapus dari kelas'}


@router.get("/students/{student_id}/class-history")
async def get_student_class_history(student_id: str, user: Dict = Depends(get_current_user)):
    """Get class history for a specific student (admin, wali kelas, atau siswa itu sendiri — Profil Saya)."""
    roles = user.get('roles', [])
    if not ('admin' in roles or 'wali_kelas' in roles or user.get('id') == student_id or set(roles) & set(DETAIL_SISWA_VIEWER_ROLES)):
        raise HTTPException(403, "Tidak diizinkan")
    student = await db.users.find_one({'id': student_id, 'roles': 'siswa'}, {'_id': 0})
    if not student:
        raise HTTPException(404, "Siswa tidak ditemukan")

    history = await db.class_history.find(
        {'student_id': student_id},
        {'_id': 0}
    ).sort([('start_date', -1), ('created_at', -1)]).to_list(500)

    # Lengkapi nama rombel, TP, semester, rombel asal, dan label alasan (riwayat keaktifan siswa)
    enriched = []
    for h in history:
        cls = await db.classes.find_one({'id': h.get('class_id')}, {'_id': 0, 'name': 1, 'semester_id': 1, 'is_accelerated': 1})
        sem_id = h.get('semester_id') or (cls or {}).get('semester_id')
        sem = await db.semesters.find_one({'id': sem_id}, {'_id': 0, 'name': 1, 'academic_year_id': 1}) if sem_id else None
        ay = await db.academic_years.find_one({'id': h.get('academic_year_id') or (sem or {}).get('academic_year_id')}, {'_id': 0, 'name': 1})
        asal = await db.classes.find_one({'id': h['from_class_id']}, {'_id': 0, 'name': 1}) if h.get('from_class_id') else None
        h['class_name'] = (cls or {}).get('name') or h.get('class_name')
        h['academic_year_name'] = ay.get('name') if ay else None
        h['semester_name'] = (sem or {}).get('name') or h.get('semester')
        h['from_class_name'] = asal.get('name') if asal else None
        h['reason_label'] = ALASAN_LABEL.get(h.get('reason'), h.get('reason'))
        h['is_accelerated'] = bool((cls or {}).get('is_accelerated'))
        enriched.append(serialize_doc(h))

    return enriched


@router.post("/classes/migrate-semester-ids", dependencies=[Depends(require_role('admin'))])
async def migrate_class_semester_ids(request: Request, user: Dict = Depends(get_current_user)):
    """
    MIGRATION ENDPOINT: Populate semester_id for existing classes.

    Matches classes with semesters based on academic_year_id and semester code.
    """
    # Get all classes without semester_id
    classes_to_update = await db.classes.find(
        {'$or': [{'semester_id': None}, {'semester_id': {'$exists': False}}]},
        {'_id': 0}
    ).to_list(500)

    if not classes_to_update:
        return {'message': 'Semua kelas sudah memiliki semester_id', 'updated': 0}

    # Get all semesters for matching
    all_semesters = await db.semesters.find({}, {'_id': 0}).to_list(500)

    updated_count = 0
    failed = []

    for cls in classes_to_update:
        academic_year_id = cls.get('academic_year_id')
        semester_str = cls.get('semester', '').lower()  # 'ganjil' or 'genap'

        if not academic_year_id or not semester_str:
            failed.append({
                'class_id': cls['id'],
                'name': cls.get('name'),
                'reason': 'Missing academic_year_id or semester'
            })
            continue

        # Find matching semester
        matching_semester = None
        for sem in all_semesters:
            if (sem.get('academic_year_id') == academic_year_id and
                sem.get('code', '').lower() == semester_str):
                matching_semester = sem
                break

        if matching_semester:
            # Update class with semester_id
            await db.classes.update_one(
                {'id': cls['id']},
                {'$set': {'semester_id': matching_semester['id']}}
            )
            updated_count += 1
        else:
            failed.append({
                'class_id': cls['id'],
                'name': cls.get('name'),
                'reason': f"No semester found for AY {academic_year_id} / {semester_str}"
            })

    await log_audit(
        user, 'migrate_semester_ids', 'classes', None,
        details={'updated': updated_count, 'failed_count': len(failed)},
        request=request
    )

    return {
        'message': f'Migrasi selesai: {updated_count} kelas diupdate',
        'updated': updated_count,
        'failed_count': len(failed),
        'failed': failed[:10]  # Show first 10 failures only
    }
