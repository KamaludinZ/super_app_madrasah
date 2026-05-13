"""Holidays (weekly + academic) and Teacher Tasks + Piket fill journal."""
import uuid
from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from core import (
    db,
    get_active_academic_year,
    get_current_user,
    log_audit,
    require_role,
    serialize_doc,
)
from journal_core import current_day_id, now_wib
from models import (
    AcademicHolidayModel,
    TeacherTaskModel,
    WeeklyHolidayModel,
)

router = APIRouter()


# ============================================================
# WEEKLY HOLIDAYS
# ============================================================
@router.get("/weekly-holidays")
async def list_weekly_holidays(user: Dict = Depends(get_current_user)):
    items = await db.weekly_holidays.find({}, {'_id': 0}).to_list(20)
    return [serialize_doc(i) for i in items]


@router.post("/weekly-holidays")
async def create_weekly_holiday(payload: Dict, request: Request, user: Dict = Depends(require_role('admin'))):
    payload['day'] = (payload.get('day') or '').strip().lower()
    if not payload['day']:
        raise HTTPException(400, "Hari wajib diisi")
    existing = await db.weekly_holidays.find_one({'day': payload['day']})
    if existing:
        raise HTTPException(400, f"Hari {payload['day']} sudah terdaftar")
    h = WeeklyHolidayModel(**payload)
    doc = h.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.weekly_holidays.insert_one(doc)
    await log_audit(user, 'create', 'weekly_holiday', h.id, details={'day': h.day}, request=request)
    return serialize_doc(doc)


@router.put("/weekly-holidays/{hid}")
async def update_weekly_holiday(hid: str, payload: Dict, request: Request, user: Dict = Depends(require_role('admin'))):
    payload.pop('id', None); payload.pop('_id', None)
    res = await db.weekly_holidays.update_one({'id': hid}, {'$set': payload})
    if res.matched_count == 0:
        raise HTTPException(404, "Tidak ditemukan")
    await log_audit(user, 'update', 'weekly_holiday', hid, request=request)
    doc = await db.weekly_holidays.find_one({'id': hid}, {'_id': 0})
    return serialize_doc(doc)


@router.delete("/weekly-holidays/{hid}")
async def delete_weekly_holiday(hid: str, request: Request, user: Dict = Depends(require_role('admin'))):
    await db.weekly_holidays.delete_one({'id': hid})
    await log_audit(user, 'delete', 'weekly_holiday', hid, request=request)
    return {'message': 'Dihapus'}


# ============================================================
# ACADEMIC HOLIDAYS
# ============================================================
@router.get("/academic-holidays")
async def list_academic_holidays(year: Optional[int] = None,
                                 academic_year_id: Optional[str] = None,
                                 user: Dict = Depends(get_current_user)):
    q = {}
    if academic_year_id:
        q['academic_year_id'] = academic_year_id
    items = await db.academic_holidays.find(q, {'_id': 0}).sort('date', 1).to_list(1000)
    if year:
        items = [i for i in items if (i.get('date') or '').startswith(str(year))]
    return [serialize_doc(i) for i in items]


@router.post("/academic-holidays")
async def create_academic_holiday(payload: Dict, request: Request, user: Dict = Depends(require_role('admin'))):
    if not payload.get('date') or not payload.get('name'):
        raise HTTPException(400, "Tanggal dan nama wajib diisi")
    h = AcademicHolidayModel(**payload)
    doc = h.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.academic_holidays.insert_one(doc)
    await log_audit(user, 'create', 'academic_holiday', h.id, details={'date': h.date, 'name': h.name}, request=request)
    return serialize_doc(doc)


@router.put("/academic-holidays/{hid}")
async def update_academic_holiday(hid: str, payload: Dict, request: Request, user: Dict = Depends(require_role('admin'))):
    payload.pop('id', None); payload.pop('_id', None)
    res = await db.academic_holidays.update_one({'id': hid}, {'$set': payload})
    if res.matched_count == 0:
        raise HTTPException(404, "Tidak ditemukan")
    await log_audit(user, 'update', 'academic_holiday', hid, request=request)
    doc = await db.academic_holidays.find_one({'id': hid}, {'_id': 0})
    return serialize_doc(doc)


@router.delete("/academic-holidays/{hid}")
async def delete_academic_holiday(hid: str, request: Request, user: Dict = Depends(require_role('admin'))):
    await db.academic_holidays.delete_one({'id': hid})
    await log_audit(user, 'delete', 'academic_holiday', hid, request=request)
    return {'message': 'Dihapus'}


# ============================================================
# TEACHER TASKS
# ============================================================
@router.get("/teacher-tasks")
async def list_teacher_tasks(date: Optional[str] = None,
                             status: Optional[str] = None,
                             schedule_id: Optional[str] = None,
                             user: Dict = Depends(get_current_user)):
    q = {}
    if date:
        q['date'] = date
    if status:
        q['status'] = status
    if schedule_id:
        q['schedule_id'] = schedule_id
    is_piket = 'guru_piket' in user.get('roles', [])
    is_admin = 'admin' in user.get('roles', [])
    is_teacher = bool(set(user.get('roles', [])) & {'guru', 'wali_kelas'})
    if not (is_admin or is_piket) and is_teacher:
        q['teacher_id'] = user['id']
    items = await db.teacher_tasks.find(q, {'_id': 0}).sort('date', -1).to_list(500)
    enriched = []
    for t in items:
        sch = await db.schedules.find_one({'id': t.get('schedule_id')}, {'_id': 0})
        if sch:
            t['class_id'] = sch.get('class_id')
            t['subject_id'] = sch.get('subject_id')
            t['room_id'] = sch.get('room_id')
            t['day'] = sch.get('day')
            t['start_time'] = sch.get('start_time')
            t['end_time'] = sch.get('end_time')
            cls = await db.classes.find_one({'id': sch.get('class_id')}, {'_id': 0, 'name': 1})
            t['class_name'] = cls.get('name') if cls else None
            sub = await db.subjects.find_one({'id': sch.get('subject_id')}, {'_id': 0, 'name': 1, 'code': 1})
            if sub:
                t['subject_name'] = sub.get('name')
                t['subject_code'] = sub.get('code')
            room = await db.rooms.find_one({'id': sch.get('room_id')}, {'_id': 0, 'name': 1})
            t['room_name'] = room.get('name') if room else None
        tch = await db.users.find_one({'id': t.get('teacher_id')}, {'_id': 0, 'full_name': 1})
        t['teacher_name'] = tch.get('full_name') if tch else None
        if t.get('completed_by_user_id'):
            cb = await db.users.find_one({'id': t['completed_by_user_id']}, {'_id': 0, 'full_name': 1})
            t['completed_by_name'] = cb.get('full_name') if cb else None
        enriched.append(serialize_doc(t))
    return enriched


@router.post("/teacher-tasks")
async def create_teacher_task(payload: Dict, request: Request, user: Dict = Depends(get_current_user)):
    if not payload.get('schedule_id') or not payload.get('date') or not payload.get('task_content'):
        raise HTTPException(400, "schedule_id, date, task_content wajib")
    sch = await db.schedules.find_one({'id': payload['schedule_id']})
    if not sch:
        raise HTTPException(404, "Jadwal tidak ditemukan")
    if not ('admin' in user.get('roles', [])) and sch.get('teacher_id') != user['id']:
        raise HTTPException(403, "Hanya guru pengampu yang bisa menitipkan tugas pada jadwalnya")
    task = TeacherTaskModel(
        schedule_id=payload['schedule_id'],
        teacher_id=sch.get('teacher_id'),
        date=payload['date'],
        task_content=payload['task_content'],
        notes=payload.get('notes'),
    )
    doc = task.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.teacher_tasks.insert_one(doc)
    await log_audit(user, 'create', 'teacher_task', task.id, details={'date': task.date}, request=request)
    return serialize_doc(doc)


@router.put("/teacher-tasks/{tid}")
async def update_teacher_task(tid: str, payload: Dict, request: Request, user: Dict = Depends(get_current_user)):
    existing = await db.teacher_tasks.find_one({'id': tid})
    if not existing:
        raise HTTPException(404, "Tidak ditemukan")
    is_admin = 'admin' in user.get('roles', [])
    if not is_admin and existing.get('teacher_id') != user['id']:
        raise HTTPException(403, "Hanya guru pengampu/admin yang bisa edit")
    if existing.get('status') == 'completed':
        raise HTTPException(400, "Tugas yang sudah selesai tidak bisa diubah")
    payload.pop('id', None); payload.pop('_id', None); payload.pop('status', None)
    await db.teacher_tasks.update_one({'id': tid}, {'$set': payload})
    doc = await db.teacher_tasks.find_one({'id': tid}, {'_id': 0})
    return serialize_doc(doc)


@router.delete("/teacher-tasks/{tid}")
async def delete_teacher_task(tid: str, request: Request, user: Dict = Depends(get_current_user)):
    existing = await db.teacher_tasks.find_one({'id': tid})
    if not existing:
        raise HTTPException(404, "Tidak ditemukan")
    is_admin = 'admin' in user.get('roles', [])
    if not is_admin and existing.get('teacher_id') != user['id']:
        raise HTTPException(403, "Tidak diizinkan")
    if existing.get('status') == 'completed':
        raise HTTPException(400, "Tugas yang sudah selesai tidak bisa dihapus")
    await db.teacher_tasks.delete_one({'id': tid})
    await log_audit(user, 'delete', 'teacher_task', tid, request=request)
    return {'message': 'Dihapus'}


# ============================================================
# PIKET — today's schedules + fill journal
# ============================================================
@router.get("/piket/schedules/today")
async def piket_schedules_today(user: Dict = Depends(require_role('guru_piket', 'admin'))):
    """Daftar jadwal mengajar hari ini yang BELUM dibuat jurnal — guru piket bisa isi titipan."""
    today = current_day_id()
    today_date = now_wib().strftime('%Y-%m-%d')
    ay = await get_active_academic_year()
    if not ay:
        return []
    schedules = await db.schedules.find({
        'day': today, 'academic_year_id': ay['id']
    }, {'_id': 0}).sort('start_time', 1).to_list(200)
    today_start = now_wib().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    journals_today = await db.journals.find({
        'started_at': {'$gte': today_start}
    }, {'_id': 0, 'schedule_id': 1, 'fill_mode': 1, 'filled_by_user_id': 1}).to_list(500)
    journaled_set = {j['schedule_id']: j for j in journals_today}
    tasks_today = await db.teacher_tasks.find({'date': today_date}, {'_id': 0}).to_list(200)
    task_by_sched = {}
    for t in tasks_today:
        task_by_sched[t['schedule_id']] = t
    enriched = []
    for s in schedules:
        s = serialize_doc(s)
        s['has_journal'] = s['id'] in journaled_set
        s['journal_info'] = serialize_doc(journaled_set[s['id']]) if s['has_journal'] else None
        s['task'] = serialize_doc(task_by_sched.get(s['id'])) if s['id'] in task_by_sched else None
        tch = await db.users.find_one({'id': s.get('teacher_id')}, {'_id': 0, 'full_name': 1})
        s['teacher_name'] = tch.get('full_name') if tch else None
        cls = await db.classes.find_one({'id': s.get('class_id')}, {'_id': 0, 'name': 1})
        s['class_name'] = cls.get('name') if cls else None
        sub = await db.subjects.find_one({'id': s.get('subject_id')}, {'_id': 0, 'name': 1, 'code': 1})
        if sub:
            s['subject_name'] = sub.get('name'); s['subject_code'] = sub.get('code')
        room = await db.rooms.find_one({'id': s.get('room_id')}, {'_id': 0, 'name': 1})
        s['room_name'] = room.get('name') if room else None
        enriched.append(s)
    return enriched


@router.post("/piket/fill-journal")
async def piket_fill_journal(payload: Dict, request: Request,
                             user: Dict = Depends(require_role('guru_piket', 'admin'))):
    """Guru piket isi jurnal atas nama guru pengajar (titipan tugas)."""
    schedule_id = payload.get('schedule_id')
    if not schedule_id:
        raise HTTPException(400, "schedule_id wajib")
    sch = await db.schedules.find_one({'id': schedule_id})
    if not sch:
        raise HTTPException(404, "Jadwal tidak ditemukan")
    today_start = now_wib().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    existing = await db.journals.find_one({
        'schedule_id': schedule_id, 'started_at': {'$gte': today_start}
    })
    if existing:
        raise HTTPException(400, "Jurnal hari ini untuk jadwal ini sudah ada")
    ay = await get_active_academic_year()
    j_id = str(uuid.uuid4())
    fill_role = 'admin' if 'admin' in user.get('roles', []) and 'guru_piket' not in user.get('roles', []) else 'guru_piket'
    journal_doc = {
        'id': j_id,
        'schedule_id': schedule_id,
        'teacher_id': sch['teacher_id'],
        'class_id': sch['class_id'],
        'subject_id': sch['subject_id'],
        'room_id': sch['room_id'],
        'academic_year_id': ay['id'] if ay else sch.get('academic_year_id'),
        'semester': (ay or {}).get('active_semester', 'ganjil'),
        'materi': payload.get('materi', ''),
        'catatan': payload.get('catatan'),
        'siswa_hadir': int(payload.get('siswa_hadir') or 0),
        'siswa_tidak_hadir': int(payload.get('siswa_tidak_hadir') or 0),
        'siswa_izin': int(payload.get('siswa_izin') or 0),
        'siswa_sakit': int(payload.get('siswa_sakit') or 0),
        'started_at': now_wib().isoformat(),
        'scheduled_start': sch.get('start_time'),
        'scheduled_end': sch.get('end_time'),
        'validations': {'piket_fill': True},
        'qr_mode': 'piket',
        'is_locked': True,
        'fill_mode': 'piket',
        'filled_by_user_id': user['id'],
        'filled_by_role': fill_role,
        'task_id': payload.get('task_id'),
        'piket_note': payload.get('piket_note'),
        'created_at': now_wib().isoformat(),
    }
    await db.journals.insert_one(journal_doc)
    if payload.get('task_id'):
        await db.teacher_tasks.update_one({'id': payload['task_id']}, {'$set': {
            'status': 'completed',
            'completed_journal_id': j_id,
            'completed_by_user_id': user['id'],
            'completed_at': now_wib().isoformat(),
        }})
    await log_audit(user, 'piket_fill_journal', 'journal', j_id, details={
        'schedule_id': schedule_id, 'for_teacher_id': sch['teacher_id'],
    }, request=request)
    return serialize_doc(journal_doc)
