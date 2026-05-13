"""Jurnal: validate / create / my / by-class + admin jurnal rekap & stats."""
from datetime import datetime
from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from core import (
    db,
    get_active_academic_year,
    get_current_user,
    get_settings,
    log_audit,
    log_security,
    require_role,
    serialize_doc,
)
from journal_core import (
    decrypt_qr_payload,
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

    ay = await get_active_academic_year()
    if not ay:
        result['schedule'] = {'valid': False, 'reason': 'Tidak ada tahun pelajaran aktif'}
        return result
    schedules = await db.schedules.find({
        'academic_year_id': ay['id'], 'teacher_id': teacher_id, 'room_id': room_id,
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
    ay = await get_active_academic_year()

    existing = await db.journals.find_one({'schedule_id': sched['id'], 'teacher_id': user['id']})
    if existing:
        raise HTTPException(status_code=400, detail="Jurnal untuk jadwal ini sudah diisi")

    journal = JournalModel(
        schedule_id=sched['id'], teacher_id=user['id'], class_id=sched['class_id'],
        subject_id=sched['subject_id'], room_id=room['id'], academic_year_id=ay['id'],
        semester=sched.get('semester', 'ganjil'),
        materi=req.materi, catatan=req.catatan,
        siswa_hadir=req.siswa_hadir, siswa_tidak_hadir=req.siswa_tidak_hadir,
        siswa_izin=req.siswa_izin, siswa_sakit=req.siswa_sakit,
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


@router.get("/jurnal/my")
async def my_journals(user: Dict = Depends(get_current_user)):
    items = await db.journals.find({'teacher_id': user['id']}, {'_id': 0}).sort('started_at', -1).to_list(500)
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
    items = await db.journals.find({'class_id': class_id}, {'_id': 0}).sort('started_at', -1).to_list(limit)
    enriched = []
    for j in items:
        sub = await db.subjects.find_one({'id': j.get('subject_id')}, {'_id': 0, 'name': 1})
        teacher = await db.users.find_one({'id': j.get('teacher_id')}, {'_id': 0, 'full_name': 1})
        j['subject_name'] = sub.get('name') if sub else None
        j['teacher_name'] = teacher.get('full_name') if teacher else None
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
    academic_year_id: Optional[str] = None,
    limit: int = 500,
    user: Dict = Depends(require_role('admin'))
):
    """Rekap lengkap data jurnal mengajar untuk admin"""
    q = {}
    if class_id: q['class_id'] = class_id
    if teacher_id: q['teacher_id'] = teacher_id
    if subject_id: q['subject_id'] = subject_id
    if academic_year_id: q['academic_year_id'] = academic_year_id
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
    """Aggregate jurnal count per guru"""
    ay = await get_active_academic_year()
    pipeline = []
    if ay:
        pipeline.append({'$match': {'academic_year_id': ay['id']}})
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
