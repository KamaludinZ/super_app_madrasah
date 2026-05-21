"""Students: list, attendance, cleanliness, today, detail, Excel import."""
import io
import uuid
from datetime import datetime
from typing import Dict, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse

from auth_utils import hash_password
from core import (
    db,
    get_active_academic_year,
    get_active_context,
    get_current_user,
    log_audit,
    require_role,
    serialize_doc,
)
from excel_io import parse_student_rows, student_template
from journal_core import current_day_id, now_wib
from models import ClassAttendanceSubmit, ClassCleanlinessSubmit, UserModel
from routers._shared import user_can_view_class

router = APIRouter()


# ============================================================
# STUDENTS LIST
# ============================================================
@router.get("/students")
async def list_students(class_id: Optional[str] = None, user: Dict = Depends(get_current_user)):
    """Get list of students. Admin sees all; wali kelas sees own class; siswa sees self only."""
    if 'siswa' in user.get('roles', []) and len(user.get('roles', [])) == 1:
        me = await db.users.find_one({'id': user['id']}, {'_id': 0, 'password_hash': 0})
        return [serialize_doc(me)] if me else []
    q = {'roles': 'siswa'}
    if class_id:
        if not await user_can_view_class(user, class_id):
            raise HTTPException(403, "Tidak diizinkan melihat siswa kelas ini")
        q['student_class_id'] = class_id
    elif 'admin' not in user.get('roles', []):
        cls = await db.classes.find_one({'homeroom_teacher_id': user['id']}, {'_id': 0, 'id': 1})
        if cls:
            q['student_class_id'] = cls['id']
        else:
            return []
    items = await db.users.find(q, {'_id': 0, 'password_hash': 0}).sort('full_name', 1).to_list(2000)
    enriched = []
    for s in items:
        cls = await db.classes.find_one({'id': s.get('student_class_id')}, {'_id': 0, 'name': 1})
        s['class_name'] = cls.get('name') if cls else None
        enriched.append(serialize_doc(s))
    return enriched


# ============================================================
# STUDENT TODAY
# ============================================================
@router.get("/student/{student_id}/today")
async def student_today(student_id: str, user: Dict = Depends(get_current_user)):
    student = await db.users.find_one({'id': student_id}, {'_id': 0, 'password_hash': 0})
    if not student:
        raise HTTPException(404, "Siswa tidak ditemukan")
    is_self = user['id'] == student_id
    is_parent = student_id in user.get('parent_of', [])
    is_admin = 'admin' in user.get('roles', [])
    cls = await db.classes.find_one({'id': student.get('student_class_id')}, {'_id': 0})
    is_homeroom = cls and cls.get('homeroom_teacher_id') == user['id']
    if not (is_self or is_parent or is_admin or is_homeroom):
        raise HTTPException(403, "Tidak diizinkan melihat data siswa ini")
    if not cls:
        return {'student': serialize_doc(student), 'class': None, 'today_schedule': []}
    day = current_day_id()

    # Get semester_id from the class to filter schedules
    semester_id = cls.get('semester_id')
    if not semester_id:
        return {'student': serialize_doc(student), 'class': serialize_doc(cls), 'today_schedule': []}

    schedules = await db.schedules.find({
        'class_id': cls['id'], 'day': day,
        'semester_id': semester_id,
    }, {'_id': 0}).sort('start_time', 1).to_list(50)
    enriched = []
    for s in schedules:
        sub = await db.subjects.find_one({'id': s.get('subject_id')}, {'_id': 0, 'name': 1})
        teacher = await db.users.find_one({'id': s.get('teacher_id')}, {'_id': 0, 'full_name': 1})
        room = await db.rooms.find_one({'id': s.get('room_id')}, {'_id': 0, 'name': 1})
        journal = await db.journals.find_one({'schedule_id': s['id']}, {'_id': 0, 'materi': 1, 'catatan': 1, 'started_at': 1})
        s['subject_name'] = sub.get('name') if sub else None
        s['teacher_name'] = teacher.get('full_name') if teacher else None
        s['room_name'] = room.get('name') if room else None
        s['journal'] = serialize_doc(journal) if journal else None
        enriched.append(serialize_doc(s))
    return {'student': serialize_doc(student), 'class': serialize_doc(cls), 'today_schedule': enriched}


# ============================================================
# CLASS ATTENDANCE (Kehadiran Siswa)
# ============================================================
@router.get("/attendance/class/{class_id}")
async def get_class_attendance(class_id: str, date: Optional[str] = None,
                               user: Dict = Depends(get_current_user)):
    if not await user_can_view_class(user, class_id):
        raise HTTPException(403, "Tidak diizinkan")
    q = {'class_id': class_id}
    if date:
        q['date'] = date
    items = await db.class_attendance.find(q, {'_id': 0}).sort('date', -1).to_list(200)
    return [serialize_doc(i) for i in items]


@router.post("/attendance/class")
async def submit_class_attendance(req: ClassAttendanceSubmit, request: Request,
                                  user: Dict = Depends(get_current_user)):
    if not await user_can_view_class(user, req.class_id):
        raise HTTPException(403, "Tidak diizinkan")
    summary = {'hadir': 0, 'sakit': 0, 'izin': 0, 'alpa': 0}
    for r in req.records:
        st = r.get('status', 'hadir')
        summary[st] = summary.get(st, 0) + 1
    existing = await db.class_attendance.find_one({'class_id': req.class_id, 'date': req.date})
    doc = {
        'class_id': req.class_id, 'date': req.date,
        'records': req.records, 'recorded_by': user['id'],
        'recorded_at': datetime.utcnow().isoformat(), 'summary': summary,
    }
    if existing:
        await db.class_attendance.update_one({'_id': existing['_id']}, {'$set': doc})
        doc['id'] = existing.get('id', str(uuid.uuid4()))
    else:
        doc['id'] = str(uuid.uuid4())
        await db.class_attendance.insert_one(doc)
    await log_audit(user, 'submit', 'class_attendance', doc['id'],
                    details={'class_id': req.class_id, 'date': req.date, 'summary': summary},
                    request=request)
    return serialize_doc(doc)


# ============================================================
# CLASS CLEANLINESS (Kebersihan Kelas)
# ============================================================
@router.get("/cleanliness/admin/recap")
async def get_cleanliness_recap(user: Dict = Depends(require_role('admin', 'guru_bk'))):
    """Admin & Guru BK: rekapitulasi penilaian kebersihan semua kelas, filtered by user's view context (semester)."""
    # Get all classes for active semester
    ctx = await get_active_context(user)
    semester_id = ctx.get('semester_id')
    classes = await db.classes.find(
        {'semester_id': semester_id} if semester_id else {},
        {'_id': 0}
    ).sort('name', 1).to_list(500)

    result = []
    for cls in classes:
        # Get latest cleanliness records for this class
        records = await db.class_cleanliness.find(
            {'class_id': cls['id']},
            {'_id': 0}
        ).sort('date', -1).limit(7).to_list(7)

        # Calculate stats
        if records:
            avg_rating = sum(r.get('rating', 0) for r in records) / len(records)
            condition_count = {'bersih': 0, 'cukup': 0, 'kotor': 0}
            for r in records:
                cond = r.get('condition', 'bersih')
                condition_count[cond] = condition_count.get(cond, 0) + 1
            latest = records[0]
        else:
            avg_rating = 0
            condition_count = {'bersih': 0, 'cukup': 0, 'kotor': 0}
            latest = None

        result.append({
            'class': serialize_doc(cls),
            'latest': serialize_doc(latest) if latest else None,
            'avg_rating_7days': round(avg_rating, 2),
            'condition_count_7days': condition_count,
            'total_records': len(records),
        })

    return result


@router.get("/cleanliness/guru/classes/all")
async def get_guru_all_classes(user: Dict = Depends(require_role('guru'))):
    """Guru: get all classes they teach (from their schedules), filtered by user's view context (semester)."""
    # Get active semester context
    ctx = await get_active_context(user)
    semester_id = ctx.get('semester_id')
    if not semester_id:
        return []

    # Get all schedules for this teacher in active semester
    schedules = await db.schedules.find({
        'teacher_id': user['id'],
        'semester_id': semester_id,
        'status': {'$in': ['approved', 'locked']}  # Only approved/locked schedules
    }, {'_id': 0, 'class_id': 1}).to_list(500)

    # Get unique class IDs
    class_ids = list(set(s['class_id'] for s in schedules))

    # Get class details
    classes = []
    for cid in class_ids:
        cls = await db.classes.find_one({'id': cid}, {'_id': 0})
        if cls:
            classes.append(serialize_doc(cls))

    return classes


@router.get("/cleanliness/guru/classes")
async def get_guru_teachable_classes(date: str, user: Dict = Depends(require_role('guru'))):
    """Guru: get classes they teach on a specific date based on schedule."""
    # Parse date to get day of week
    try:
        date_obj = datetime.strptime(date, '%Y-%m-%d')
        day_names = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu']
        day = day_names[date_obj.weekday()]
    except ValueError:
        raise HTTPException(400, "Format tanggal salah, gunakan YYYY-MM-DD")

    # Get active semester context
    ctx = await get_active_context(user)
    semester_id = ctx.get('semester_id')
    if not semester_id:
        return []

    # Get schedules for this teacher on this day in active semester
    schedules = await db.schedules.find({
        'teacher_id': user['id'],
        'day': day,
        'semester_id': semester_id,
        'status': {'$in': ['approved', 'locked']}  # Only approved/locked schedules
    }, {'_id': 0, 'class_id': 1}).to_list(500)

    # Get unique class IDs
    class_ids = list(set(s['class_id'] for s in schedules))

    # Get class details
    classes = []
    for cid in class_ids:
        cls = await db.classes.find_one({'id': cid}, {'_id': 0})
        if cls:
            classes.append(serialize_doc(cls))

    return classes


@router.get("/cleanliness/guru/history")
async def get_guru_cleanliness_history(limit: int = 100, user: Dict = Depends(require_role('guru'))):
    """Get cleanliness history filled by this teacher across all classes, filtered by user's view context (semester)."""
    # Get user's view context for semester filtering
    ctx = await get_active_context(user)
    semester_id = ctx.get('semester_id')

    # Get classes for this semester
    class_ids = []
    if semester_id:
        classes = await db.classes.find({'semester_id': semester_id}, {'_id': 0, 'id': 1}).to_list(None)
        class_ids = [c['id'] for c in classes]

    # Build query
    query = {'recorded_by': user['id']}
    if class_ids:
        query['class_id'] = {'$in': class_ids}

    items = await db.class_cleanliness.find(query, {'_id': 0}).sort('recorded_at', -1).to_list(limit)

    # Enrich with class names
    enriched = []
    for item in items:
        cls = await db.classes.find_one({'id': item.get('class_id')}, {'_id': 0, 'name': 1})
        item['class_name'] = cls.get('name') if cls else 'Unknown'
        enriched.append(serialize_doc(item))

    return enriched


@router.get("/cleanliness/class/{class_id}")
async def get_class_cleanliness(class_id: str, limit: int = 30,
                                user: Dict = Depends(get_current_user)):
    if not await user_can_view_class(user, class_id):
        raise HTTPException(403, "Tidak diizinkan")

    # Verify class belongs to current semester context
    cls = await db.classes.find_one({'id': class_id}, {'_id': 0, 'semester_id': 1})
    if not cls:
        return []

    ctx = await get_active_context(user)
    semester_id = ctx.get('semester_id')

    # Only show cleanliness data if class is in current semester
    if semester_id and cls.get('semester_id') != semester_id:
        return []

    items = await db.class_cleanliness.find({'class_id': class_id}, {'_id': 0}).sort('date', -1).to_list(limit)
    return [serialize_doc(i) for i in items]


@router.post("/cleanliness/class")
async def submit_class_cleanliness(req: ClassCleanlinessSubmit, request: Request,
                                   user: Dict = Depends(get_current_user)):
    """Submit cleanliness record. For guru: validates schedule on that date."""
    is_guru = 'guru' in user.get('roles', []) and 'admin' not in user.get('roles', []) and 'wali_kelas' not in user.get('roles', [])

    # For guru: validate they teach this class (on any day) and can only fill for today's date
    if is_guru:
        # Parse date and ensure it's today
        try:
            date_obj = datetime.strptime(req.date, '%Y-%m-%d')
            today = datetime.now().date()
            if date_obj.date() != today:
                raise HTTPException(403, "Guru hanya dapat mengisi kebersihan untuk hari ini")
        except ValueError:
            raise HTTPException(400, "Format tanggal salah")

        # Get active semester context
        ctx = await get_active_context(user)
        semester_id = ctx.get('semester_id')
        if not semester_id:
            raise HTTPException(400, "Tidak ada semester aktif")

        # Check if guru teaches this class (on any day) in active semester
        schedule = await db.schedules.find_one({
            'teacher_id': user['id'],
            'class_id': req.class_id,
            'semester_id': semester_id,
            'status': {'$in': ['approved', 'locked']}
        })

        if not schedule:
            raise HTTPException(403, "Anda tidak mengajar di kelas ini")

    # For admin and wali_kelas: use existing permission check
    elif not await user_can_view_class(user, req.class_id):
        raise HTTPException(403, "Tidak diizinkan")

    existing = await db.class_cleanliness.find_one({'class_id': req.class_id, 'date': req.date})
    doc = req.model_dump()
    doc['recorded_by'] = user['id']
    doc['recorded_at'] = datetime.utcnow().isoformat()
    if existing:
        await db.class_cleanliness.update_one({'_id': existing['_id']}, {'$set': doc})
        doc['id'] = existing.get('id', str(uuid.uuid4()))
    else:
        doc['id'] = str(uuid.uuid4())
        await db.class_cleanliness.insert_one(doc)
    await log_audit(user, 'submit', 'class_cleanliness', doc['id'],
                    details={'class_id': req.class_id, 'date': req.date, 'condition': req.condition},
                    request=request)
    return serialize_doc(doc)


# ============================================================
# STUDENT DETAILS (Tab DATA SISWA - DATA ORANG TUA - DATA ALAMAT)
# ============================================================
@router.get("/students/{sid}/detail")
async def get_student_detail(sid: str, user: Dict = Depends(get_current_user)):
    """Ambil detail siswa. Siswa sendiri/admin/wali kelas bisa lihat."""
    student = await db.users.find_one({'id': sid}, {'_id': 0, 'password_hash': 0})
    if not student:
        raise HTTPException(404, "Siswa tidak ditemukan")
    if 'siswa' not in (student.get('roles') or []):
        raise HTTPException(400, "Bukan siswa")
    is_admin = 'admin' in user.get('roles', [])
    is_self = sid == user['id']
    is_wk = False
    if 'wali_kelas' in user.get('roles', []):
        is_wk = await user_can_view_class(user, student.get('student_class_id'))
    if not (is_admin or is_self or is_wk):
        raise HTTPException(403, "Tidak diizinkan")
    detail = await db.student_details.find_one({'student_id': sid}, {'_id': 0})
    return {
        'student': serialize_doc(student),
        'detail': serialize_doc(detail) if detail else None,
    }


@router.put("/students/{sid}/detail")
async def upsert_student_detail(sid: str, payload: Dict, request: Request, user: Dict = Depends(get_current_user)):
    """Upsert detail siswa. Hanya admin atau wali kelas atau siswa itu sendiri."""
    student = await db.users.find_one({'id': sid})
    if not student or 'siswa' not in (student.get('roles') or []):
        raise HTTPException(404, "Siswa tidak ditemukan")
    is_admin = 'admin' in user.get('roles', [])
    is_self = sid == user['id']
    is_wk = False
    if 'wali_kelas' in user.get('roles', []):
        is_wk = await user_can_view_class(user, student.get('student_class_id'))
    if not (is_admin or is_self or is_wk):
        raise HTTPException(403, "Tidak diizinkan")
    payload.pop('id', None); payload.pop('_id', None); payload.pop('student_id', None)
    payload.pop('created_at', None)
    payload['updated_at'] = now_wib().isoformat()
    payload['updated_by'] = user['id']
    existing = await db.student_details.find_one({'student_id': sid})
    if existing:
        await db.student_details.update_one({'student_id': sid}, {'$set': payload})
    else:
        from models import StudentDetailModel
        doc = StudentDetailModel(student_id=sid, **payload).model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        if isinstance(doc.get('updated_at'), datetime):
            doc['updated_at'] = doc['updated_at'].isoformat()
        await db.student_details.insert_one(doc)
    await log_audit(user, 'update', 'student_detail', sid, request=request)
    out = await db.student_details.find_one({'student_id': sid}, {'_id': 0})
    return serialize_doc(out)


# ============================================================
# STUDENT EXCEL IMPORT
# ============================================================
@router.get("/students/excel-template")
async def students_template_dl(user: Dict = Depends(require_role('admin'))):
    return StreamingResponse(
        io.BytesIO(student_template()),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': 'attachment; filename="template_siswa_matsandatama.xlsx"'},
    )


@router.post("/students/import-excel")
async def students_import(file: UploadFile = File(...), request: Request = None,
                          user: Dict = Depends(require_role('admin'))):
    if not file.filename.lower().endswith(('.xlsx', '.xlsm')):
        raise HTTPException(400, "Hanya .xlsx")
    contents = await file.read()
    rows = parse_student_rows(contents)
    classes_map = {c['name']: c['id'] for c in await db.classes.find({}, {'_id': 0}).to_list(500)}
    success = 0
    errors = []
    new_docs = []
    for r in rows:
        try:
            if not all([r['username'], r['password'], r['full_name'], r['nisn'], r['kelas']]):
                errors.append(f"Baris {r['_row']}: username/password/nama/NISN/kelas wajib"); continue
            cls_id = classes_map.get(r['kelas'])
            if not cls_id:
                errors.append(f"Baris {r['_row']}: kelas '{r['kelas']}' tidak ditemukan"); continue
            existing = await db.users.find_one({'username': r['username']})
            if existing:
                errors.append(f"Baris {r['_row']}: username '{r['username']}' sudah ada"); continue
            u = UserModel(
                username=r['username'], password_hash=hash_password(r['password']),
                full_name=r['full_name'], roles=['siswa'], nisn=r['nisn'],
                gender=r.get('gender'), student_class_id=cls_id,
                birth_place=r.get('birth_place'), birth_date=r.get('birth_date'),
                address=r.get('address'), email=r.get('email'), phone=r.get('phone'),
            )
            doc = u.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            new_docs.append(doc)
            success += 1
        except Exception as e:
            errors.append(f"Baris {r['_row']}: {e}")
    if new_docs:
        await db.users.insert_many(new_docs)
    await log_audit(user, 'import_excel', 'student', None, details={'success': success, 'errors': len(errors)}, request=request)
    return {'success': success, 'errors': errors, 'total_rows': len(rows)}
