"""Jurnal: validate / create / my / by-class + admin jurnal rekap & stats."""
from datetime import datetime
from typing import Dict, Optional, List, Any, Set

from fastapi import APIRouter, Depends, HTTPException, Request, Query

from core import (
    db,
    get_active_context,
    get_current_user,
    get_settings,
    log_audit,
    log_security,
    require_role,
    serialize_doc,
)
from fastapi.responses import StreamingResponse
from journal_exports import (
    export_monthly_teacher_journal_excel,
    export_monthly_teacher_journal_pdf,
)
from journal_core import (
    current_day_id,
    decrypt_qr_payload,
    now_wib,
    validate_dynamic_qr,
    validate_gps,
    validate_schedule,
)
from models import JournalCreateRequest, JournalModel, QRValidateRequest

router = APIRouter()


async def _validate_qr_full(qr_token: str, user_lat: Optional[float], user_lon: Optional[float],
                            teacher_id: str) -> Dict:
    settings = await get_settings()
    result = {
        'overall_valid': False,
        'qr': {'valid': False, 'reason': 'Belum diperiksa'},
        'schedule': {'valid': False, 'reason': 'Belum diperiksa'},
        'gps': {'valid': False, 'reason': 'Belum diperiksa'},
        'context': {},
    }
    payload = decrypt_qr_payload(qr_token)
    if not payload:
        result['qr'] = {'valid': False, 'reason': 'QR Code tidak valid atau kedaluwarsa'}
        return result
    room_id = payload.get('room_id')
    result['qr'] = {'valid': True, 'reason': 'QR berhasil divalidasi', 'mode': payload.get('mode', 'static')}

    room = await db.rooms.find_one({'id': room_id}, {'_id': 0})
    if not room:
        result['qr'] = {'valid': False, 'reason': 'Ruangan tidak terdaftar dalam sistem'}
        return result

    if payload.get('mode') == 'dynamic':
        secret = room.get('qr_secret')
        if not secret:
            result['qr'] = {'valid': False, 'reason': 'Ruangan tidak memiliki secret untuk QR dinamis'}
            return result
        dyn = validate_dynamic_qr(qr_token, secret)
        if not dyn['valid']:
            result['qr'] = dyn
            return result

    # Get user to determine context - validation should use current user's context
    # However, this is a helper function. We'll get semester from schedules that exist for this room+teacher
    # OR we can pass user context as parameter. For now, get active semester globally.
    from core import get_active_context as get_ctx
    ctx = await get_ctx(None)  # None means use global active semester
    semester_id = ctx.get('semester_id')
    if not semester_id:
        result['schedule'] = {'valid': False, 'reason': 'Tidak ada semester aktif'}
        return result
    schedules = await db.schedules.find({
        'semester_id': semester_id, 'teacher_id': teacher_id, 'room_id': room_id,
    }, {'_id': 0}).to_list(100)
    for s in schedules:
        sub = await db.subjects.find_one({'id': s.get('subject_id')}, {'_id': 0, 'name': 1})
        if sub:
            s['subject_name'] = sub.get('name')
    grace = settings.get('grace_minutes', 15)
    sched_result = validate_schedule(teacher_id, room_id, schedules, grace_minutes=grace)
    result['schedule'] = sched_result
    if not sched_result['valid']:
        return result

    gps_enabled = room.get('gps_enabled', settings.get('gps_default_enabled', True))
    radius = room.get('gps_radius_meters', settings.get('gps_default_radius', 20))
    gps_result = validate_gps(user_lat, user_lon, room.get('gps_lat'), room.get('gps_lon'),
                              radius, gps_enabled=gps_enabled)
    result['gps'] = gps_result
    if not gps_result['valid']:
        return result

    result['overall_valid'] = True
    result['context'] = {
        'room': serialize_doc(room),
        'schedule': sched_result.get('schedule'),
        'start_time': sched_result.get('start_time'),
        'end_time': sched_result.get('end_time'),
    }
    return result


@router.post("/jurnal/validate")
async def validate_qr(req: QRValidateRequest, user: Dict = Depends(get_current_user)):
    return await _validate_qr_full(req.qr_token, req.user_lat, req.user_lon, user['id'])


@router.post("/jurnal")
async def create_journal(req: JournalCreateRequest, request: Request, user: Dict = Depends(get_current_user)):
    validation = await _validate_qr_full(req.qr_token, req.user_lat, req.user_lon, user['id'])
    if not validation['overall_valid']:
        await log_security('journal_blocked', user['username'],
                           {'reasons': [v.get('reason') for k, v in validation.items() if isinstance(v, dict) and not v.get('valid', True)]},
                           request)
        raise HTTPException(status_code=400, detail={'message': 'Validasi gagal', 'validation': validation})

    sched = validation['context']['schedule']
    room = validation['context']['room']

    # Get semester_id from schedule (validation already ensured schedule exists for active semester)
    semester_id = sched.get('semester_id')
    if not semester_id:
        raise HTTPException(status_code=400, detail="Schedule tidak memiliki semester_id")

    existing = await db.journals.find_one({'schedule_id': sched['id'], 'teacher_id': user['id']})
    if existing:
        raise HTTPException(status_code=400, detail="Jurnal untuk jadwal ini sudah diisi")

    journal = JournalModel(
        schedule_id=sched['id'], teacher_id=user['id'], class_id=sched['class_id'],
        subject_id=sched['subject_id'], room_id=room['id'], semester_id=semester_id,
        materi=req.materi, catatan=req.catatan,
        siswa_hadir=req.siswa_hadir, siswa_tidak_hadir=req.siswa_tidak_hadir,
        siswa_izin=req.siswa_izin, siswa_sakit=req.siswa_sakit,
        attendance_details=req.attendance_details,
        scheduled_start=validation['context'].get('start_time'),
        scheduled_end=validation['context'].get('end_time'),
        validations=validation,
        qr_mode=validation['qr'].get('mode', 'static'),
    )
    doc = journal.model_dump()
    if isinstance(doc.get('started_at'), datetime):
        doc['started_at'] = doc['started_at'].isoformat()
    if isinstance(doc.get('created_at'), datetime):
        doc['created_at'] = doc['created_at'].isoformat()
    await db.journals.insert_one(doc)
    await log_audit(user, 'create', 'journal', journal.id,
                    details={'class_id': sched['class_id'], 'subject_id': sched['subject_id']}, request=request)
    return serialize_doc(doc)


# ============================================================
# CLASS TOKEN FALLBACK (alternatif scan QR)
# ============================================================
import uuid
from pydantic import BaseModel


async def _validate_by_class_token(class_token: str, user_lat, user_lon, teacher_id: str) -> Dict:
    """Validate journal context using class TOKEN (not QR token).
    Fallback ketika kamera gagal — guru input token kelas manual.
    """
    settings = await get_settings()
    result = {
        'overall_valid': False,
        'qr': {'valid': True, 'reason': 'Mode token kelas (bukan QR)', 'mode': 'class_token'},
        'schedule': {'valid': False, 'reason': 'Belum diperiksa'},
        'gps': {'valid': False, 'reason': 'Belum diperiksa'},
        'context': {},
    }
    cls = await db.classes.find_one({'token': class_token}, {'_id': 0})
    if not cls:
        result['qr'] = {'valid': False, 'reason': 'Token kelas tidak ditemukan'}
        return result
    room_id = cls.get('room_id')
    if not room_id:
        result['qr'] = {'valid': False, 'reason': 'Kelas belum punya ruang utama. Hubungi admin.'}
        return result
    room = await db.rooms.find_one({'id': room_id}, {'_id': 0})
    if not room:
        result['qr'] = {'valid': False, 'reason': 'Ruangan tidak ditemukan'}
        return result

    # Get active semester context
    from core import get_active_context as get_ctx
    ctx = await get_ctx(None)  # None means use global active semester
    semester_id = ctx.get('semester_id')
    if not semester_id:
        result['schedule'] = {'valid': False, 'reason': 'Tidak ada semester aktif'}
        return result
    schedules = await db.schedules.find({
        'semester_id': semester_id, 'teacher_id': teacher_id, 'class_id': cls['id'],
    }, {'_id': 0}).to_list(100)
    for s in schedules:
        sub = await db.subjects.find_one({'id': s.get('subject_id')}, {'_id': 0, 'name': 1})
        if sub:
            s['subject_name'] = sub.get('name')
    grace = settings.get('grace_minutes', 15)
    now = now_wib()
    cur_day_id = current_day_id()
    matched = None
    from datetime import timedelta as _td
    for s in schedules:
        if s.get('day') != cur_day_id:
            continue
        try:
            sh, sm = map(int, s['start_time'].split(':'))
            eh, em = map(int, s['end_time'].split(':'))
            start_dt = now.replace(hour=sh, minute=sm, second=0, microsecond=0)
            end_dt = now.replace(hour=eh, minute=em, second=0, microsecond=0)
            if (start_dt - _td(minutes=grace)) <= now <= (end_dt + _td(minutes=grace)):
                matched = s
                break
        except Exception:
            continue
    if not matched:
        result['schedule'] = {'valid': False,
                              'reason': f'Tidak ada jadwal Anda di kelas ini saat ini (toleransi \u00b1{grace}m)'}
        return result
    result['schedule'] = {
        'valid': True, 'reason': 'Jadwal cocok',
        'schedule': serialize_doc(matched),
        'start_time': matched.get('start_time'),
        'end_time': matched.get('end_time'),
    }

    gps_enabled = room.get('gps_enabled', settings.get('gps_default_enabled', True))
    radius = room.get('gps_radius_meters', settings.get('gps_default_radius', 20))
    from journal_core import validate_gps
    gps_result = validate_gps(user_lat, user_lon, room.get('gps_lat'), room.get('gps_lon'),
                              radius, gps_enabled=gps_enabled)
    result['gps'] = gps_result
    if not gps_result['valid']:
        return result

    result['overall_valid'] = True
    result['context'] = {
        'room': serialize_doc(room), 'class': serialize_doc(cls),
        'schedule': serialize_doc(matched),
        'start_time': matched.get('start_time'), 'end_time': matched.get('end_time'),
    }
    return result


class ClassTokenValidateRequest(BaseModel):
    class_token: str
    user_lat: Optional[float] = None
    user_lon: Optional[float] = None


class ClassTokenJournalRequest(BaseModel):
    class_token: str
    user_lat: Optional[float] = None
    user_lon: Optional[float] = None
    materi: str
    catatan: Optional[str] = None
    siswa_hadir: int = 0
    siswa_tidak_hadir: int = 0
    siswa_izin: int = 0
    siswa_sakit: int = 0


@router.post("/jurnal/validate-by-class-token")
async def validate_by_class_token(req: ClassTokenValidateRequest, user: Dict = Depends(get_current_user)):
    return await _validate_by_class_token(req.class_token, req.user_lat, req.user_lon, user['id'])


@router.post("/jurnal/by-class-token")
async def create_journal_by_class_token(req: ClassTokenJournalRequest, request: Request,
                                        user: Dict = Depends(get_current_user)):
    validation = await _validate_by_class_token(req.class_token, req.user_lat, req.user_lon, user['id'])
    if not validation['overall_valid']:
        raise HTTPException(status_code=400, detail={'message': 'Validasi gagal', 'validation': validation})
    sched = validation['context']['schedule']
    room = validation['context']['room']

    # Get semester_id from schedule (validation already ensured schedule exists for active semester)
    semester_id = sched.get('semester_id')
    if not semester_id:
        raise HTTPException(status_code=400, detail="Schedule tidak memiliki semester_id")

    existing = await db.journals.find_one({'schedule_id': sched['id'], 'teacher_id': user['id']})
    if existing:
        raise HTTPException(status_code=400, detail="Jurnal untuk jadwal ini sudah diisi")
    j_id = str(uuid.uuid4())
    doc = {
        'id': j_id, 'schedule_id': sched['id'], 'teacher_id': user['id'],
        'class_id': sched['class_id'], 'subject_id': sched['subject_id'],
        'room_id': room['id'], 'semester_id': semester_id,
        'materi': req.materi, 'catatan': req.catatan,
        'siswa_hadir': req.siswa_hadir, 'siswa_tidak_hadir': req.siswa_tidak_hadir,
        'siswa_izin': req.siswa_izin, 'siswa_sakit': req.siswa_sakit,
        'attendance_details': [a.model_dump() for a in req.attendance_details],
        'started_at': now_wib().isoformat(),
        'scheduled_start': validation['context'].get('start_time'),
        'scheduled_end': validation['context'].get('end_time'),
        'validations': validation, 'qr_mode': 'class_token',
        'created_at': now_wib().isoformat(),
    }
    await db.journals.insert_one(doc)
    await log_audit(user, 'create', 'journal', j_id,
                    details={'class_id': sched['class_id'], 'subject_id': sched['subject_id'], 'method': 'class_token'},
                    request=request)
    return serialize_doc(doc)



@router.get("/jurnal/my")
async def my_journals(user: Dict = Depends(get_current_user)):
    """Get my journals filtered by user's view context (semester)"""
    ctx = await get_active_context(user)
    semester_id = ctx.get('semester_id')

    query = {'teacher_id': user['id']}
    if semester_id:
        query['semester_id'] = semester_id

    items = await db.journals.find(query, {'_id': 0}).sort('started_at', -1).to_list(500)
    enriched = []
    for j in items:
        cls = await db.classes.find_one({'id': j.get('class_id')}, {'_id': 0, 'name': 1})
        sub = await db.subjects.find_one({'id': j.get('subject_id')}, {'_id': 0, 'name': 1})
        room = await db.rooms.find_one({'id': j.get('room_id')}, {'_id': 0, 'name': 1})
        j['class_name'] = cls.get('name') if cls else None
        j['subject_name'] = sub.get('name') if sub else None
        j['room_name'] = room.get('name') if room else None
        enriched.append(serialize_doc(j))
    return enriched


@router.get("/jurnal/by-class/{class_id}")
async def journals_by_class(class_id: str, limit: int = 50, user: Dict = Depends(get_current_user)):
    """Get journals by class filtered by class's semester (journals should match class's semester)"""
    # Get the class to find its semester_id
    cls = await db.classes.find_one({'id': class_id}, {'_id': 0, 'semester_id': 1})
    if not cls:
        return []

    query = {'class_id': class_id}
    # Filter by semester if class has semester_id
    if cls.get('semester_id'):
        query['semester_id'] = cls['semester_id']

    items = await db.journals.find(query, {'_id': 0}).sort('started_at', -1).to_list(limit)
    enriched = []
    for j in items:
        sub = await db.subjects.find_one({'id': j.get('subject_id')}, {'_id': 0, 'name': 1})
        teacher = await db.users.find_one({'id': j.get('teacher_id')}, {'_id': 0, 'full_name': 1})
        j['subject_name'] = sub.get('name') if sub else None
        j['teacher_name'] = teacher.get('full_name') if teacher else None
        enriched.append(serialize_doc(j))
    return enriched


@router.get("/jurnal/piket-filled")
async def piket_filled_journals(user: Dict = Depends(require_role('guru_piket', 'admin'))):
    """Get journals filled by piket filtered by user's view context (semester)"""
    ctx = await get_active_context(user)
    semester_id = ctx.get('semester_id')

    query = {'filled_by_user_id': user['id']}
    if semester_id:
        query['semester_id'] = semester_id

    items = await db.journals.find(query, {'_id': 0}).sort('started_at', -1).to_list(500)
    enriched = []
    for j in items:
        cls = await db.classes.find_one({'id': j.get('class_id')}, {'_id': 0, 'name': 1})
        sub = await db.subjects.find_one({'id': j.get('subject_id')}, {'_id': 0, 'name': 1})
        room = await db.rooms.find_one({'id': j.get('room_id')}, {'_id': 0, 'name': 1})
        teacher = await db.users.find_one({'id': j.get('teacher_id')}, {'_id': 0, 'full_name': 1})
        filled_by = await db.users.find_one({'id': j.get('filled_by_user_id')}, {'_id': 0, 'full_name': 1})

        j['class_name'] = cls.get('name') if cls else None
        j['subject_name'] = sub.get('name') if sub else None
        j['room_name'] = room.get('name') if room else None
        j['teacher_name'] = teacher.get('full_name') if teacher else None
        j['filled_by_name'] = filled_by.get('full_name') if filled_by else None
        enriched.append(serialize_doc(j))
    return enriched


# ============================================================
# ADMIN JURNAL REKAP
# ============================================================
@router.get("/admin/jurnal")
async def admin_jurnal_rekap(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    class_id: Optional[str] = None,
    teacher_id: Optional[str] = None,
    subject_id: Optional[str] = None,
    semester_id: Optional[str] = None,
    limit: int = 500,
    user: Dict = Depends(require_role('admin'))
):
    """Rekap lengkap data jurnal mengajar untuk admin, filtered by user's view context (semester) or by provided semester_id"""
    # Use user's view context semester if no semester_id provided in query
    if not semester_id:
        ctx = await get_active_context(user)
        semester_id = ctx.get('semester_id')

    q = {}
    if class_id: q['class_id'] = class_id
    if teacher_id: q['teacher_id'] = teacher_id
    if subject_id: q['subject_id'] = subject_id
    if semester_id: q['semester_id'] = semester_id
    if start_date or end_date:
        date_q = {}
        if start_date: date_q['$gte'] = start_date
        if end_date: date_q['$lte'] = end_date + 'T23:59:59'
        q['started_at'] = date_q

    items = await db.journals.find(q, {'_id': 0}).sort('started_at', -1).to_list(limit)
    enriched = []
    for j in items:
        cls = await db.classes.find_one({'id': j.get('class_id')}, {'_id': 0, 'name': 1})
        sub = await db.subjects.find_one({'id': j.get('subject_id')}, {'_id': 0, 'name': 1, 'code': 1})
        teacher = await db.users.find_one({'id': j.get('teacher_id')}, {'_id': 0, 'full_name': 1})
        room = await db.rooms.find_one({'id': j.get('room_id')}, {'_id': 0, 'name': 1})
        j['class_name'] = cls.get('name') if cls else None
        j['subject_name'] = sub.get('name') if sub else None
        j['subject_code'] = sub.get('code') if sub else None
        j['teacher_name'] = teacher.get('full_name') if teacher else None
        j['room_name'] = room.get('name') if room else None
        if j.get('filled_by_user_id') and j.get('filled_by_user_id') != j.get('teacher_id'):
            fb = await db.users.find_one({'id': j['filled_by_user_id']}, {'_id': 0, 'full_name': 1})
            j['filled_by_name'] = fb.get('full_name') if fb else None
        enriched.append(serialize_doc(j))

    total_hadir = sum(j.get('siswa_hadir', 0) for j in enriched)
    total_sakit = sum(j.get('siswa_sakit', 0) for j in enriched)
    total_izin = sum(j.get('siswa_izin', 0) for j in enriched)
    total_alpa = sum(j.get('siswa_tidak_hadir', 0) for j in enriched)
    return {
        'items': enriched,
        'total': len(enriched),
        'summary': {
            'total_hadir': total_hadir, 'total_sakit': total_sakit,
            'total_izin': total_izin, 'total_alpa': total_alpa,
            'total_siswa_per_jurnal': total_hadir + total_sakit + total_izin + total_alpa,
        }
    }


@router.get("/admin/jurnal/stats-by-teacher")
async def admin_jurnal_stats_teacher(user: Dict = Depends(require_role('admin'))):
    """Aggregate jurnal count per guru, filtered by user's view context (semester)"""
    ctx = await get_active_context(user)
    semester_id = ctx.get('semester_id')
    pipeline = []
    if semester_id:
        pipeline.append({'$match': {'semester_id': semester_id}})
    pipeline.append({'$group': {'_id': '$teacher_id', 'count': {'$sum': 1}}})
    pipeline.append({'$sort': {'count': -1}})
    results = await db.journals.aggregate(pipeline).to_list(200)
    enriched = []
    for r in results:
        teacher = await db.users.find_one({'id': r['_id']}, {'_id': 0, 'full_name': 1, 'username': 1})
        enriched.append({
            'teacher_id': r['_id'],
            'teacher_name': teacher.get('full_name') if teacher else 'Unknown',
            'username': teacher.get('username') if teacher else None,
            'count': r['count'],
        })
    return enriched


async def _collect_student_names_from_journals(journals: List[Dict[str, Any]]) -> Dict[str, str]:
    student_ids: Set[str] = set()
    for j in journals:
        for rec in (j.get('attendance_details') or []):
            sid = rec.get('student_id')
            if sid:
                student_ids.add(sid)

    if not student_ids:
        return {}

    users = await db.users.find({'id': {'$in': list(student_ids)}}, {'_id': 0, 'id': 1, 'full_name': 1}).to_list(None)
    return {u.get('id'): (u.get('full_name') or u.get('id')) for u in users}


def _extract_leadership(settings: Dict[str, Any], position: str) -> Dict[str, str]:
    for item in (settings.get('leadership') or []):
        if (item.get('position') or '').strip().lower() == position:
            return {'name': item.get('name') or '-', 'nip': item.get('nip') or '-'}
    return {'name': '-', 'nip': '-'}


@router.get("/jurnal/export/excel")
async def export_jurnal_excel(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    class_id: Optional[str] = None,
    teacher_id: Optional[str] = None,
    user: Dict = Depends(get_current_user),
):
    roles = user.get('roles', [])
    is_admin = 'admin' in roles

    target_teacher_id = teacher_id if (is_admin and teacher_id) else user['id']
    if teacher_id and not is_admin:
        raise HTTPException(status_code=403, detail="Hanya admin yang bisa memilih teacher_id")

    start_bound = f"{year}-{month:02d}-01T00:00:00"
    if month == 12:
        end_bound = f"{year + 1}-01-01T00:00:00"
    else:
        end_bound = f"{year}-{month + 1:02d}-01T00:00:00"

    q: Dict[str, Any] = {
        'teacher_id': target_teacher_id,
        'started_at': {'$gte': start_bound, '$lt': end_bound},
    }
    if class_id:
        q['class_id'] = class_id

    ctx = await get_active_context(user)
    if ctx.get('semester_id'):
        q['semester_id'] = ctx['semester_id']

    journals = await db.journals.find(q, {'_id': 0}).sort('started_at', 1).to_list(2000)
    if not journals:
        raise HTTPException(status_code=404, detail="Data jurnal tidak ditemukan")

    teacher = await db.users.find_one({'id': target_teacher_id}, {'_id': 0, 'full_name': 1})
    teacher_name = teacher.get('full_name') if teacher else 'Guru'

    for j in journals:
        cls = await db.classes.find_one({'id': j.get('class_id')}, {'_id': 0, 'name': 1})
        j['class_name'] = cls.get('name') if cls else '-'

    student_map = await _collect_student_names_from_journals(journals)
    payload = export_monthly_teacher_journal_excel(
        journals=journals,
        teacher_name=teacher_name,
        month=month,
        year=year,
        student_name_map=student_map,
    )
    filename = f"jurnal_{teacher_name.replace(' ', '_')}_{year}_{month:02d}.xlsx"
    return StreamingResponse(
        iter([payload]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/jurnal/export/pdf")
async def export_jurnal_pdf(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    class_id: Optional[str] = None,
    teacher_id: Optional[str] = None,
    user: Dict = Depends(get_current_user),
):
    roles = user.get('roles', [])
    is_admin = 'admin' in roles

    target_teacher_id = teacher_id if (is_admin and teacher_id) else user['id']
    if teacher_id and not is_admin:
        raise HTTPException(status_code=403, detail="Hanya admin yang bisa memilih teacher_id")

    start_bound = f"{year}-{month:02d}-01T00:00:00"
    if month == 12:
        end_bound = f"{year + 1}-01-01T00:00:00"
    else:
        end_bound = f"{year}-{month + 1:02d}-01T00:00:00"

    q: Dict[str, Any] = {
        'teacher_id': target_teacher_id,
        'started_at': {'$gte': start_bound, '$lt': end_bound},
    }
    if class_id:
        q['class_id'] = class_id

    ctx = await get_active_context(user)
    if ctx.get('semester_id'):
        q['semester_id'] = ctx['semester_id']

    journals = await db.journals.find(q, {'_id': 0}).sort('started_at', 1).to_list(2000)
    if not journals:
        raise HTTPException(status_code=404, detail="Data jurnal tidak ditemukan")

    teacher = await db.users.find_one({'id': target_teacher_id}, {'_id': 0, 'full_name': 1, 'nip_nuptk': 1})
    teacher_name = teacher.get('full_name') if teacher else 'Guru'
    teacher_nip = teacher.get('nip_nuptk') if teacher else '-'

    for j in journals:
        cls = await db.classes.find_one({'id': j.get('class_id')}, {'_id': 0, 'name': 1})
        j['class_name'] = cls.get('name') if cls else '-'

    settings = await get_settings()
    head = _extract_leadership(settings, 'kepala_madrasah')
    student_map = await _collect_student_names_from_journals(journals)

    payload = export_monthly_teacher_journal_pdf(
        journals=journals,
        teacher_name=teacher_name,
        teacher_nip=teacher_nip or '-',
        month=month,
        year=year,
        city_label='Malang',
        head_name=head['name'],
        head_nip=head['nip'],
        student_name_map=student_map,
    )
    filename = f"jurnal_{teacher_name.replace(' ', '_')}_{year}_{month:02d}.pdf"
    return StreamingResponse(
        iter([payload]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
