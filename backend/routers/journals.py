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
from journal_core import now_wib
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

    # Save individual attendance records to attendances collection
    attendance_details = req.attendance_details or []
    if attendance_details:
        attendance_docs = []
        for record in attendance_details:
            att_id = str(uuid.uuid4())
            attendance_docs.append({
                'id': att_id,
                'journal_id': journal.id,
                'student_id': record.get('student_id'),
                'student_name': record.get('student_name'),
                'status': record.get('status'),
                'created_at': now_wib().isoformat(),
            })
        if attendance_docs:
            await db.attendances.insert_many(attendance_docs)

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
async def my_journals(user: Dict = Depends(get_current_user), semester_filter: bool = True):
    """Get my journals filtered by user's view context (semester)

    Args:
        semester_filter: If True, filter by active semester. If False, show all journals.
    """
    from core import get_teaching_slots_for_day
    import re

    query = {'teacher_id': user['id']}

    if semester_filter:
        ctx = await get_active_context(user)
        semester_id = ctx.get('semester_id')
        if semester_id:
            query['semester_id'] = semester_id

    items = await db.journals.find(query, {'_id': 0}).sort('started_at', -1).to_list(500)
    settings = await get_settings()

    enriched = []
    for j in items:
        cls = await db.classes.find_one({'id': j.get('class_id')}, {'_id': 0, 'name': 1})
        sub = await db.subjects.find_one({'id': j.get('subject_id')}, {'_id': 0, 'name': 1})
        room = await db.rooms.find_one({'id': j.get('room_id')}, {'_id': 0, 'name': 1})

        # Get schedule info for jam_ke and jtm_count
        schedule_id = j.get('schedule_id')
        if schedule_id:
            sched = await db.schedules.find_one({'id': schedule_id}, {'_id': 0, 'slot_indexes': 1, 'day': 1})
            if sched:
                slot_indexes = sched.get('slot_indexes', [])
                day = sched.get('day', '')

                if slot_indexes and len(slot_indexes) > 0:
                    # Get teaching slots for this day
                    teaching_slots = get_teaching_slots_for_day(settings, day)

                    # Extract hour numbers from slot names
                    hours = []
                    for idx in slot_indexes:
                        if 0 <= idx < len(teaching_slots):
                            slot = teaching_slots[idx]
                            slot_name = slot.get('name', '')
                            # Extract hour number from slot name like "Jam ke-3" -> 3
                            match = re.search(r'ke-?(\d+)', slot_name.lower())
                            if match:
                                hour_num = int(match.group(1))
                                if hour_num not in hours:
                                    hours.append(hour_num)
                            else:
                                # Fallback: use index+1
                                hour_num = idx + 1
                                if hour_num not in hours:
                                    hours.append(hour_num)
                        else:
                            # Fallback
                            hour_num = idx + 1
                            if hour_num not in hours:
                                hours.append(hour_num)

                    hours.sort()
                    j['jam_ke'] = "Jam ke-" + ", ".join(str(h) for h in hours) if hours else '-'
                    j['jtm_count'] = len(hours)
                else:
                    j['jam_ke'] = '-'
                    j['jtm_count'] = 1
            else:
                j['jam_ke'] = '-'
                j['jtm_count'] = 1
        else:
            j['jam_ke'] = '-'
            j['jtm_count'] = 1

        j['class_name'] = cls.get('name') if cls else None
        j['subject_name'] = sub.get('name') if sub else None
        j['room_name'] = room.get('name') if room else None

        # Get teacher name
        teacher_id = j.get('teacher_id')
        if teacher_id:
            teacher = await db.users.find_one({'id': teacher_id}, {'_id': 0, 'full_name': 1})
            j['teacher_name'] = teacher.get('full_name') if teacher else None
        else:
            j['teacher_name'] = None

        # Get filled_by name for piket/admin filled journals
        filled_by_id = j.get('filled_by')
        if filled_by_id:
            filled_by = await db.users.find_one({'id': filled_by_id}, {'_id': 0, 'full_name': 1})
            j['filled_by_name'] = filled_by.get('full_name') if filled_by else None
        else:
            j['filled_by_name'] = None

        # Get attendance details
        journal_id = j.get('id')
        if journal_id:
            attendance_records = await db.attendances.find(
                {'journal_id': journal_id},
                {'_id': 0, 'student_id': 1, 'student_name': 1, 'status': 1}
            ).to_list(1000)
            j['attendance_details'] = attendance_records
        else:
            j['attendance_details'] = []

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
async def piket_filled_journals(user: Dict = Depends(require_role('guru_piket', 'admin')), semester_filter: bool = True):
    """Get journals filled by piket filtered by user's view context (semester)

    Args:
        semester_filter: If True, filter by active semester. If False, show all journals.
    """
    from core import get_teaching_slots_for_day
    import re

    query = {'filled_by_user_id': user['id']}

    if semester_filter:
        ctx = await get_active_context(user)
        semester_id = ctx.get('semester_id')
        if semester_id:
            query['semester_id'] = semester_id

    items = await db.journals.find(query, {'_id': 0}).sort('started_at', -1).to_list(500)
    settings = await get_settings()

    enriched = []
    for j in items:
        cls = await db.classes.find_one({'id': j.get('class_id')}, {'_id': 0, 'name': 1})
        sub = await db.subjects.find_one({'id': j.get('subject_id')}, {'_id': 0, 'name': 1})
        room = await db.rooms.find_one({'id': j.get('room_id')}, {'_id': 0, 'name': 1})
        teacher = await db.users.find_one({'id': j.get('teacher_id')}, {'_id': 0, 'full_name': 1})
        filled_by = await db.users.find_one({'id': j.get('filled_by_user_id')}, {'_id': 0, 'full_name': 1})

        # Get schedule info for jam_ke and jtm_count
        schedule_id = j.get('schedule_id')
        if schedule_id:
            sched = await db.schedules.find_one({'id': schedule_id}, {'_id': 0, 'slot_indexes': 1, 'day': 1})
            if sched:
                slot_indexes = sched.get('slot_indexes', [])
                day = sched.get('day', '')

                if slot_indexes and len(slot_indexes) > 0:
                    # Get teaching slots for this day
                    teaching_slots = get_teaching_slots_for_day(settings, day)

                    # Extract hour numbers from slot names
                    hours = []
                    for idx in slot_indexes:
                        if 0 <= idx < len(teaching_slots):
                            slot = teaching_slots[idx]
                            slot_name = slot.get('name', '')
                            # Extract hour number from slot name like "Jam ke-3" -> 3
                            match = re.search(r'ke-?(\d+)', slot_name.lower())
                            if match:
                                hour_num = int(match.group(1))
                                if hour_num not in hours:
                                    hours.append(hour_num)
                            else:
                                # Fallback: use index+1
                                hour_num = idx + 1
                                if hour_num not in hours:
                                    hours.append(hour_num)
                        else:
                            # Fallback
                            hour_num = idx + 1
                            if hour_num not in hours:
                                hours.append(hour_num)

                    hours.sort()
                    j['jam_ke'] = "Jam ke-" + ", ".join(str(h) for h in hours) if hours else '-'
                    j['jtm_count'] = len(hours)
                else:
                    j['jam_ke'] = '-'
                    j['jtm_count'] = 1
            else:
                j['jam_ke'] = '-'
                j['jtm_count'] = 1
        else:
            j['jam_ke'] = '-'
            j['jtm_count'] = 1

        j['class_name'] = cls.get('name') if cls else None
        j['subject_name'] = sub.get('name') if sub else None
        j['room_name'] = room.get('name') if room else None
        j['teacher_name'] = teacher.get('full_name') if teacher else None
        j['filled_by_name'] = filled_by.get('full_name') if filled_by else None

        # Get attendance details
        journal_id = j.get('id')
        if journal_id:
            attendance_records = await db.attendances.find(
                {'journal_id': journal_id},
                {'_id': 0, 'student_id': 1, 'student_name': 1, 'status': 1}
            ).to_list(1000)
            j['attendance_details'] = attendance_records
        else:
            j['attendance_details'] = []

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
    user: Dict = Depends(require_role('admin', 'kepala_sekolah', 'wali_kelas'))
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

    # Get settings for teaching slots calculation
    import re
    from core import get_teaching_slots_for_day
    settings = await get_settings()

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

        # Calculate jam_ke and jtm_count from schedule
        schedule_id = j.get('schedule_id')
        if schedule_id:
            sched = await db.schedules.find_one({'id': schedule_id}, {'_id': 0, 'slot_indexes': 1, 'day': 1})
            if sched:
                slot_indexes = sched.get('slot_indexes', [])
                day = sched.get('day', '')

                if slot_indexes and len(slot_indexes) > 0:
                    teaching_slots = get_teaching_slots_for_day(settings, day)
                    hours = []
                    for idx in slot_indexes:
                        if 0 <= idx < len(teaching_slots):
                            slot = teaching_slots[idx]
                            slot_name = slot.get('name', '')
                            match = re.search(r'ke-?(\d+)', slot_name.lower())
                            if match:
                                hour_num = int(match.group(1))
                                if hour_num not in hours:
                                    hours.append(hour_num)
                    hours.sort()
                    j['jam_ke'] = "Jam ke-" + ", ".join(str(h) for h in hours) if hours else '-'
                    j['jtm_count'] = len(hours)
                else:
                    j['jam_ke'] = '-'
                    j['jtm_count'] = 1
            else:
                j['jam_ke'] = '-'
                j['jtm_count'] = 1
        else:
            j['jam_ke'] = '-'
            j['jtm_count'] = 1

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
async def admin_jurnal_stats_teacher(
    class_id: Optional[str] = None,
    user: Dict = Depends(require_role('admin', 'kepala_sekolah', 'wali_kelas'))
):
    """Aggregate jurnal count per guru, filtered by user's view context (semester) and optionally by class_id"""
    ctx = await get_active_context(user)
    semester_id = ctx.get('semester_id')
    pipeline = []
    match_filter = {}
    if semester_id:
        match_filter['semester_id'] = semester_id
    if class_id:
        match_filter['class_id'] = class_id
    if match_filter:
        pipeline.append({'$match': match_filter})
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


@router.put("/admin/jurnal/{journal_id}")
async def admin_update_journal(journal_id: str, update_data: Dict, user: Dict = Depends(require_role('admin'))):
    """Update jurnal (materi dan catatan only)"""
    # Find the journal
    journal = await db.journals.find_one({'id': journal_id}, {'_id': 0})
    if not journal:
        raise HTTPException(status_code=404, detail='Jurnal tidak ditemukan')

    # Only allow updating materi, catatan, and jenis_izin
    allowed_fields = {'materi', 'catatan', 'jenis_izin'}
    update_payload = {k: v for k, v in update_data.items() if k in allowed_fields}

    if not update_payload:
        raise HTTPException(status_code=400, detail='Tidak ada data yang dapat diupdate')

    # Update journal
    result = await db.journals.update_one(
        {'id': journal_id},
        {'$set': update_payload}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Jurnal tidak ditemukan')

    return {'message': 'Jurnal berhasil diperbarui', 'updated_fields': list(update_payload.keys())}


@router.get("/jurnal/{journal_id}")
async def get_journal_by_id(journal_id: str, user: Dict = Depends(get_current_user)):
    """Get single journal with full details including attendance"""
    import re
    from core import get_teaching_slots_for_day

    journal = await db.journals.find_one({'id': journal_id}, {'_id': 0})
    if not journal:
        raise HTTPException(status_code=404, detail='Jurnal tidak ditemukan')

    # Enrich with class, subject, teacher, and room info
    cls = await db.classes.find_one({'id': journal.get('class_id')}, {'_id': 0, 'name': 1})
    sub = await db.subjects.find_one({'id': journal.get('subject_id')}, {'_id': 0, 'name': 1, 'code': 1})
    teacher = await db.users.find_one({'id': journal.get('teacher_id')}, {'_id': 0, 'full_name': 1})
    room = await db.rooms.find_one({'id': journal.get('room_id')}, {'_id': 0, 'name': 1})

    journal['class_name'] = cls.get('name') if cls else None
    journal['subject_name'] = sub.get('name') if sub else None
    journal['subject_code'] = sub.get('code') if sub else None
    journal['teacher_name'] = teacher.get('full_name') if teacher else None
    journal['room_name'] = room.get('name') if room else None

    # If filled by someone else, get their name
    if journal.get('filled_by_user_id') and journal.get('filled_by_user_id') != journal.get('teacher_id'):
        fb = await db.users.find_one({'id': journal['filled_by_user_id']}, {'_id': 0, 'full_name': 1})
        journal['filled_by_name'] = fb.get('full_name') if fb else None

    # Enrich with attendance details
    attendance_records = await db.attendances.find(
        {'journal_id': journal_id},
        {'_id': 0, 'student_id': 1, 'student_name': 1, 'status': 1}
    ).to_list(1000)
    journal['attendance_details'] = attendance_records

    # Get settings
    settings = await get_settings()

    # Get schedule info for jam_ke and jtm_count
    schedule_id = journal.get('schedule_id')
    if schedule_id:
        sched = await db.schedules.find_one({'id': schedule_id}, {'_id': 0, 'slot_indexes': 1, 'day': 1})
        if sched:
            slot_indexes = sched.get('slot_indexes', [])
            day = sched.get('day', '')

            if slot_indexes and len(slot_indexes) > 0:
                teaching_slots = get_teaching_slots_for_day(settings, day)
                hours = []
                for idx in slot_indexes:
                    if 0 <= idx < len(teaching_slots):
                        slot = teaching_slots[idx]
                        slot_name = slot.get('name', '')
                        match = re.search(r'ke-?(\d+)', slot_name.lower())
                        if match:
                            hour_num = int(match.group(1))
                            if hour_num not in hours:
                                hours.append(hour_num)
                hours.sort()
                journal['jam_ke'] = "Jam ke-" + ", ".join(str(h) for h in hours) if hours else '-'
                journal['jtm_count'] = len(hours)
            else:
                journal['jam_ke'] = '-'
                journal['jtm_count'] = 1
        else:
            journal['jam_ke'] = '-'
            journal['jtm_count'] = 1
    else:
        journal['jam_ke'] = '-'
        journal['jtm_count'] = 1

    return journal


@router.put("/admin/jurnal/{journal_id}/attendances")
async def admin_update_journal_attendances(journal_id: str, update_data: Dict, user: Dict = Depends(require_role('admin'))):
    """Update student attendances for a journal"""
    # Verify journal exists
    journal = await db.journals.find_one({'id': journal_id}, {'_id': 0})
    if not journal:
        raise HTTPException(status_code=404, detail='Jurnal tidak ditemukan')

    attendances = update_data.get('attendances', [])
    if not isinstance(attendances, list):
        raise HTTPException(status_code=400, detail='Format attendances tidak valid')

    # Update each attendance record
    updated_count = 0
    for att in attendances:
        student_id = att.get('student_id')
        new_status = att.get('status')

        if not student_id or not new_status:
            continue

        # Validate status
        if new_status not in ['hadir', 'sakit', 'izin', 'alpa']:
            continue

        result = await db.attendances.update_one(
            {'journal_id': journal_id, 'student_id': student_id},
            {'$set': {'status': new_status}}
        )

        if result.matched_count > 0:
            updated_count += 1

    # Recalculate attendance counts for the journal
    attendance_records = await db.attendances.find({'journal_id': journal_id}).to_list(None)
    siswa_hadir = sum(1 for a in attendance_records if a.get('status') == 'hadir')
    siswa_sakit = sum(1 for a in attendance_records if a.get('status') == 'sakit')
    siswa_izin = sum(1 for a in attendance_records if a.get('status') == 'izin')
    siswa_tidak_hadir = sum(1 for a in attendance_records if a.get('status') == 'alpa')

    # Update journal with new counts
    await db.journals.update_one(
        {'id': journal_id},
        {'$set': {
            'siswa_hadir': siswa_hadir,
            'siswa_sakit': siswa_sakit,
            'siswa_izin': siswa_izin,
            'siswa_tidak_hadir': siswa_tidak_hadir,
        }}
    )

    return {
        'message': 'Kehadiran berhasil diperbarui',
        'updated_count': updated_count,
        'summary': {
            'hadir': siswa_hadir,
            'sakit': siswa_sakit,
            'izin': siswa_izin,
            'tidak_hadir': siswa_tidak_hadir,
        }
    }


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


# ============================================================
# OFFLINE JOURNAL SUBMISSION with Server-Side Validation
# ============================================================

from datetime import timedelta

@router.post("/journals/submit-offline")
async def submit_offline_journal(req: JournalCreateRequest, request: Request, user: Dict = Depends(get_current_user)):
    """
    Submit journal from offline queue with server-side timestamp validation

    Features:
    - Validates deadline based on SERVER TIME (not client time)
    - Grace period of 30 minutes after deadline
    - Tracks offline metadata for audit trail
    - Prevents deadline manipulation
    """

    # Extract offline metadata
    metadata = req.dict().get('_offline_metadata', {})
    queue_id = metadata.get('queue_id')
    created_at_client = metadata.get('created_at_client')
    deadline_at = metadata.get('deadline_at')
    was_offline = metadata.get('was_offline', True)

    # Validate using current server time (trusted source)
    server_now = now_wib()

    # Get schedule to calculate deadline
    validation = await _validate_qr_full(req.qr_token, req.user_lat, req.user_lon, user['id'])
    if not validation['overall_valid']:
        await log_security('journal_blocked', user['username'],
                           {'reasons': [v.get('reason') for k, v in validation.items() if isinstance(v, dict) and not v.get('valid', True)]},
                           request)
        raise HTTPException(status_code=400, detail={'message': 'Validasi gagal', 'validation': validation})

    sched = validation['context']['schedule']
    room = validation['context']['room']

    # Calculate server-side deadline (H+1 after schedule ends)
    # Parse schedule end time
    end_time_str = sched.get('end_time', '')  # Format: "HH:MM"
    if ':' in end_time_str:
        end_hour, end_minute = map(int, end_time_str.split(':'))

        # Get today's date with schedule end time
        schedule_end = server_now.replace(hour=end_hour, minute=end_minute, second=0, microsecond=0)

        # If schedule end is in the future (not yet ended), use that date
        # If it's in the past, it means schedule was yesterday (edge case for late night schedules)
        if schedule_end > server_now + timedelta(hours=12):
            # Schedule is more than 12 hours in future, likely yesterday's schedule
            schedule_end = schedule_end - timedelta(days=1)

        # Deadline is H+1 after schedule end
        deadline = schedule_end + timedelta(hours=1)
        grace_deadline = deadline + timedelta(minutes=30)

        # Check if past deadline
        if server_now > grace_deadline:
            late_minutes = int((server_now - grace_deadline).total_seconds() / 60)
            raise HTTPException(
                status_code=400,
                detail=f"Deadline pengisian jurnal sudah lewat lebih dari 30 menit (terlambat {late_minutes} menit). "
                       f"Batas waktu: {grace_deadline.strftime('%Y-%m-%d %H:%M')} WIB, "
                       f"Waktu sekarang: {server_now.strftime('%Y-%m-%d %H:%M')} WIB"
            )

        # Check if late but within grace period
        is_late = server_now > deadline
        late_minutes = int((server_now - deadline).total_seconds() / 60) if is_late else 0

    else:
        # Cannot calculate deadline without valid end_time
        is_late = False
        late_minutes = 0

    # Get semester_id from schedule
    semester_id = sched.get('semester_id')
    if not semester_id:
        raise HTTPException(status_code=400, detail="Schedule tidak memiliki semester_id")

    # Check for duplicate
    existing = await db.journals.find_one({'schedule_id': sched['id'], 'teacher_id': user['id']})
    if existing:
        raise HTTPException(status_code=400, detail="Jurnal untuk jadwal ini sudah diisi")

    # Create journal with offline metadata
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

    # Add offline submission metadata
    doc['offline_submission'] = {
        'was_offline': was_offline,
        'queue_id': queue_id,
        'created_at_client': created_at_client,
        'submitted_at_server': server_now.isoformat(),
        'deadline_at': deadline_at,
        'is_late': is_late,
        'late_minutes': late_minutes,
        'sync_attempts': metadata.get('sync_attempts', 1)
    }

    await db.journals.insert_one(doc)

    # Save individual attendance records
    attendance_details = req.attendance_details or []
    if attendance_details:
        attendance_docs = []
        for record in attendance_details:
            att_id = str(uuid.uuid4())
            attendance_docs.append({
                'id': att_id,
                'journal_id': journal.id,
                'student_id': record.get('student_id'),
                'student_name': record.get('student_name'),
                'status': record.get('status'),
                'created_at': now_wib().isoformat(),
            })
        if attendance_docs:
            await db.attendances.insert_many(attendance_docs)

    # Log with offline metadata
    await log_audit(user, 'create', 'journal', journal.id,
                    details={
                        'class_id': sched['class_id'],
                        'subject_id': sched['subject_id'],
                        'offline': was_offline,
                        'late': is_late,
                        'late_minutes': late_minutes
                    }, request=request)

    # Return with late warning if applicable
    response_data = serialize_doc(doc)
    if is_late:
        response_data['warning'] = f"Jurnal disimpan terlambat {late_minutes} menit dari deadline normal"

    return response_data
