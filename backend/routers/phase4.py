"""Phase 4 endpoints: Achievements, Extracurriculars, Grades (E-Rapor)."""
import uuid
from datetime import datetime
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
from models_phase4 import (
    ExtracurricularMemberModel,
    ExtracurricularModel,
    StudentAchievementModel,
)

router = APIRouter()


# ============================================================
# PRESTASI SISWA / Achievements
# ============================================================
@router.get("/achievements")
async def list_achievements(student_id: Optional[str] = None,
                            holder_type: Optional[str] = None,
                            holder_id: Optional[str] = None,
                            only_verified: bool = False,
                            year: Optional[int] = None,
                            level: Optional[str] = None,
                            user: Dict = Depends(get_current_user)):
    q = {}
    if student_id:
        q['student_id'] = student_id
    if holder_type:
        q['holder_type'] = holder_type
    if holder_id:
        q['$or'] = [{'holder_id': holder_id}, {'student_id': holder_id}]
    if only_verified:
        q['is_verified'] = True
    if year:
        q['year'] = year
    if level:
        q['level'] = level
    is_admin = 'admin' in user.get('roles', [])
    is_wk = 'wali_kelas' in user.get('roles', [])
    is_pure_siswa = 'siswa' in user.get('roles', []) and len(user.get('roles', [])) == 1
    if is_pure_siswa and not is_admin and not is_wk:
        if not student_id and not holder_id:
            q['$or'] = [{'student_id': user['id']}, {'holder_id': user['id']}]
    items = await db.achievements.find(q, {'_id': 0}).sort([('year', -1), ('date', -1)]).to_list(1000)
    enriched = []
    for a in items:
        if not a.get('holder_type'):
            a['holder_type'] = 'siswa' if a.get('student_id') else 'madrasah'
        holder_uid = a.get('holder_id') or a.get('student_id')
        if holder_uid:
            u = await db.users.find_one({'id': holder_uid}, {'_id': 0, 'full_name': 1, 'nisn': 1, 'nip_nuptk': 1, 'student_class_id': 1, 'roles': 1})
            if u:
                a['holder_full_name'] = u.get('full_name')
                if a['holder_type'] == 'siswa':
                    a['student_name'] = u.get('full_name')
                    a['student_nisn'] = u.get('nisn')
                    cls = await db.classes.find_one({'id': u.get('student_class_id')}, {'_id': 0, 'name': 1})
                    a['class_name'] = cls.get('name') if cls else None
                else:
                    a['holder_nip_nuptk'] = u.get('nip_nuptk')
        elif a['holder_type'] == 'madrasah':
            a['holder_full_name'] = a.get('holder_name') or 'Madrasah'
        if a.get('verified_by'):
            v = await db.users.find_one({'id': a['verified_by']}, {'_id': 0, 'full_name': 1})
            a['verifier_name'] = v.get('full_name') if v else None
        enriched.append(serialize_doc(a))
    return enriched


def _derive_year_from_date(date_str: Optional[str]) -> Optional[int]:
    if not date_str:
        return None
    try:
        return int(date_str.split('-')[0])
    except Exception:
        return None


@router.post("/achievements")
async def create_achievement(payload: Dict, request: Request, user: Dict = Depends(get_current_user)):
    holder_type = payload.get('holder_type', 'siswa')
    if holder_type not in ('siswa', 'guru', 'tendik', 'madrasah'):
        raise HTTPException(400, "holder_type tidak valid")
    holder_id = payload.get('holder_id') or payload.get('student_id')
    is_admin = 'admin' in user.get('roles', [])
    is_wk = 'wali_kelas' in user.get('roles', [])
    if holder_type == 'siswa':
        if 'siswa' in user.get('roles', []) and not (is_admin or is_wk):
            if holder_id and holder_id != user['id']:
                raise HTTPException(403, "Siswa hanya bisa input prestasi sendiri")
            holder_id = user['id']
        if not holder_id and not (is_admin or is_wk):
            holder_id = user['id']
    elif holder_type in ('guru', 'tendik'):
        if not is_admin:
            if holder_id and holder_id != user['id']:
                raise HTTPException(403, "Anda hanya bisa input prestasi sendiri")
            holder_id = user['id']
    else:  # madrasah
        if not is_admin:
            raise HTTPException(403, "Hanya admin yang bisa input prestasi madrasah")
        holder_id = None
    year = payload.get('year') or _derive_year_from_date(payload.get('date'))
    a = StudentAchievementModel(
        holder_type=holder_type,
        student_id=holder_id if holder_type == 'siswa' else None,
        holder_id=holder_id if holder_type != 'siswa' else None,
        holder_name=payload.get('holder_name'),
        name=payload.get('name', ''),
        bidang_lomba=payload.get('bidang_lomba'),
        category=payload.get('category'),
        level=payload.get('level'),
        rank=payload.get('rank'),
        organizer=payload.get('organizer'),
        date=payload.get('date'),
        year=year,
        description=payload.get('description'),
        certificate_url=payload.get('certificate_url'),
        submitted_by=user['id'],
    )
    doc = a.model_dump()
    doc['submitted_at'] = doc['submitted_at'].isoformat()
    await db.achievements.insert_one(doc)
    await log_audit(user, 'create', 'achievement', a.id,
                    details={'name': a.name, 'holder_type': holder_type}, request=request)
    return serialize_doc(doc)


@router.put("/achievements/{aid}")
async def update_achievement(aid: str, payload: Dict, request: Request,
                             user: Dict = Depends(get_current_user)):
    existing = await db.achievements.find_one({'id': aid})
    if not existing:
        raise HTTPException(404, "Tidak ditemukan")
    is_admin = 'admin' in user.get('roles', [])
    holder_uid = existing.get('holder_id') or existing.get('student_id')
    is_owner = existing.get('submitted_by') == user['id'] or holder_uid == user['id']
    if not (is_admin or is_owner):
        raise HTTPException(403, "Tidak diizinkan")
    payload.pop('_id', None); payload.pop('id', None)
    if 'date' in payload and not payload.get('year'):
        payload['year'] = _derive_year_from_date(payload.get('date'))
    await db.achievements.update_one({'id': aid}, {'$set': payload})
    await log_audit(user, 'update', 'achievement', aid, request=request)
    doc = await db.achievements.find_one({'id': aid}, {'_id': 0})
    return serialize_doc(doc)


@router.put("/achievements/{aid}/verify")
async def verify_achievement(aid: str, request: Request,
                             user: Dict = Depends(require_role('admin', 'wali_kelas'))):
    await db.achievements.update_one({'id': aid}, {'$set': {
        'is_verified': True, 'verified_by': user['id'],
        'verified_at': datetime.utcnow().isoformat(),
    }})
    await log_audit(user, 'verify', 'achievement', aid, request=request)
    doc = await db.achievements.find_one({'id': aid}, {'_id': 0})
    return serialize_doc(doc)


@router.delete("/achievements/{aid}")
async def delete_achievement(aid: str, request: Request, user: Dict = Depends(get_current_user)):
    existing = await db.achievements.find_one({'id': aid})
    if not existing:
        raise HTTPException(404, "Tidak ditemukan")
    is_admin = 'admin' in user.get('roles', [])
    is_owner = existing.get('submitted_by') == user['id']
    if not (is_admin or is_owner):
        raise HTTPException(403, "Tidak diizinkan")
    await db.achievements.delete_one({'id': aid})
    await log_audit(user, 'delete', 'achievement', aid, request=request)
    return {'message': 'Dihapus'}


# ============================================================
# EKSTRAKURIKULER
# ============================================================
@router.get("/extracurriculars")
async def list_extras(user: Dict = Depends(get_current_user)):
    items = await db.extracurriculars.find({}, {'_id': 0}).sort('name', 1).to_list(200)
    enriched = []
    for e in items:
        coach = await db.users.find_one({'id': e.get('coach_id')}, {'_id': 0, 'full_name': 1})
        e['coach_name'] = coach.get('full_name') if coach else None
        member_count = await db.extracurricular_members.count_documents({'extracurricular_id': e['id'], 'is_active': True})
        e['member_count'] = member_count
        enriched.append(serialize_doc(e))
    return enriched


@router.post("/extracurriculars")
async def create_extra(payload: Dict, request: Request, user: Dict = Depends(require_role('admin'))):
    ay = await get_active_academic_year()
    payload['academic_year_id'] = ay['id'] if ay else None
    e = ExtracurricularModel(**payload)
    doc = e.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.extracurriculars.insert_one(doc)
    await log_audit(user, 'create', 'extracurricular', e.id, details={'name': e.name}, request=request)
    return serialize_doc(doc)


@router.put("/extracurriculars/{eid}")
async def update_extra(eid: str, payload: Dict, request: Request, user: Dict = Depends(require_role('admin'))):
    payload.pop('_id', None); payload.pop('id', None)
    await db.extracurriculars.update_one({'id': eid}, {'$set': payload})
    await log_audit(user, 'update', 'extracurricular', eid, request=request)
    doc = await db.extracurriculars.find_one({'id': eid}, {'_id': 0})
    return serialize_doc(doc)


@router.delete("/extracurriculars/{eid}")
async def delete_extra(eid: str, request: Request, user: Dict = Depends(require_role('admin'))):
    await db.extracurriculars.delete_one({'id': eid})
    await db.extracurricular_members.delete_many({'extracurricular_id': eid})
    await log_audit(user, 'delete', 'extracurricular', eid, request=request)
    return {'message': 'Dihapus'}


@router.get("/extracurriculars/{eid}/members")
async def list_extra_members(eid: str, user: Dict = Depends(get_current_user)):
    members = await db.extracurricular_members.find({'extracurricular_id': eid}, {'_id': 0}).to_list(500)
    enriched = []
    for m in members:
        s = await db.users.find_one({'id': m.get('student_id')}, {'_id': 0, 'full_name': 1, 'nisn': 1, 'student_class_id': 1})
        if s:
            cls = await db.classes.find_one({'id': s.get('student_class_id')}, {'_id': 0, 'name': 1})
            m['student_name'] = s.get('full_name')
            m['student_nisn'] = s.get('nisn')
            m['class_name'] = cls.get('name') if cls else None
        enriched.append(serialize_doc(m))
    return enriched


@router.post("/extracurriculars/{eid}/members")
async def add_extra_members(eid: str, payload: Dict, request: Request,
                            user: Dict = Depends(get_current_user)):
    extra = await db.extracurriculars.find_one({'id': eid})
    if not extra:
        raise HTTPException(404, "Ekskul tidak ditemukan")
    is_admin = 'admin' in user.get('roles', [])
    is_coach = extra.get('coach_id') == user['id']
    if not (is_admin or is_coach):
        raise HTTPException(403, "Tidak diizinkan")
    student_ids = payload.get('student_ids', [])
    inserted = 0
    for sid in student_ids:
        existing = await db.extracurricular_members.find_one({'extracurricular_id': eid, 'student_id': sid})
        if existing:
            await db.extracurricular_members.update_one({'_id': existing['_id']}, {'$set': {'is_active': True}})
            continue
        m = ExtracurricularMemberModel(extracurricular_id=eid, student_id=sid)
        doc = m.model_dump()
        doc['joined_at'] = doc['joined_at'].isoformat()
        await db.extracurricular_members.insert_one(doc)
        inserted += 1
    await log_audit(user, 'add_members', 'extracurricular', eid, details={'count': len(student_ids)}, request=request)
    return {'inserted': inserted, 'total': len(student_ids)}


@router.delete("/extracurriculars/{eid}/members/{mid}")
async def remove_extra_member(eid: str, mid: str, request: Request,
                              user: Dict = Depends(get_current_user)):
    extra = await db.extracurriculars.find_one({'id': eid})
    is_admin = 'admin' in user.get('roles', [])
    is_coach = extra and extra.get('coach_id') == user['id']
    if not (is_admin or is_coach):
        raise HTTPException(403, "Tidak diizinkan")
    await db.extracurricular_members.delete_one({'id': mid})
    return {'message': 'Dihapus'}


@router.post("/extracurriculars/{eid}/attendance")
async def submit_extra_attendance(eid: str, payload: Dict, request: Request,
                                  user: Dict = Depends(get_current_user)):
    extra = await db.extracurriculars.find_one({'id': eid})
    is_admin = 'admin' in user.get('roles', [])
    is_coach = extra and extra.get('coach_id') == user['id']
    if not (is_admin or is_coach):
        raise HTTPException(403, "Tidak diizinkan")
    date = payload.get('date')
    records = payload.get('records', [])
    summary = {'hadir': 0, 'sakit': 0, 'izin': 0, 'alpa': 0}
    for r in records:
        st = r.get('status', 'hadir')
        summary[st] = summary.get(st, 0) + 1
    existing = await db.extracurricular_attendance.find_one({'extracurricular_id': eid, 'date': date})
    doc = {
        'extracurricular_id': eid, 'date': date, 'records': records,
        'recorded_by': user['id'], 'recorded_at': datetime.utcnow().isoformat(),
        'summary': summary,
    }
    if existing:
        await db.extracurricular_attendance.update_one({'_id': existing['_id']}, {'$set': doc})
        doc['id'] = existing.get('id', str(uuid.uuid4()))
    else:
        doc['id'] = str(uuid.uuid4())
        await db.extracurricular_attendance.insert_one(doc)
    await log_audit(user, 'attendance', 'extracurricular', eid, details={'date': date, 'summary': summary}, request=request)
    return serialize_doc(doc)


@router.get("/extracurriculars/{eid}/attendance")
async def get_extra_attendance(eid: str, user: Dict = Depends(get_current_user)):
    items = await db.extracurricular_attendance.find({'extracurricular_id': eid}, {'_id': 0}).sort('date', -1).to_list(200)
    return [serialize_doc(i) for i in items]


@router.post("/extracurriculars/{eid}/grades")
async def submit_extra_grades(eid: str, payload: Dict, request: Request,
                              user: Dict = Depends(get_current_user)):
    extra = await db.extracurriculars.find_one({'id': eid})
    is_admin = 'admin' in user.get('roles', [])
    is_coach = extra and extra.get('coach_id') == user['id']
    if not (is_admin or is_coach):
        raise HTTPException(403, "Tidak diizinkan")
    ay = await get_active_academic_year()
    semester = payload.get('semester', 'ganjil')
    grades = payload.get('grades', [])
    inserted = 0
    for g in grades:
        existing = await db.extracurricular_grades.find_one({
            'extracurricular_id': eid, 'student_id': g['student_id'],
            'academic_year_id': ay['id'] if ay else None, 'semester': semester,
        })
        doc = {
            'extracurricular_id': eid, 'student_id': g['student_id'],
            'academic_year_id': ay['id'] if ay else None, 'semester': semester,
            'predicate': g.get('predicate'), 'description': g.get('description'),
            'submitted_by': user['id'], 'submitted_at': datetime.utcnow().isoformat(),
        }
        if existing:
            await db.extracurricular_grades.update_one({'_id': existing['_id']}, {'$set': doc})
        else:
            doc['id'] = str(uuid.uuid4())
            await db.extracurricular_grades.insert_one(doc)
        inserted += 1
    await log_audit(user, 'grades', 'extracurricular', eid, details={'count': inserted, 'semester': semester}, request=request)
    return {'success': inserted}


@router.get("/extracurriculars/{eid}/grades")
async def get_extra_grades(eid: str, semester: Optional[str] = None, user: Dict = Depends(get_current_user)):
    q = {'extracurricular_id': eid}
    if semester: q['semester'] = semester
    items = await db.extracurricular_grades.find(q, {'_id': 0}).to_list(500)
    return [serialize_doc(i) for i in items]


# ============================================================
# E-RAPOR (Grade entries)
# ============================================================
@router.post("/grades/bulk")
async def submit_grades_bulk(payload: Dict, request: Request, user: Dict = Depends(get_current_user)):
    """Bulk submit grades for one class+subject+semester."""
    ay = await get_active_academic_year()
    class_id = payload.get('class_id')
    subject_id = payload.get('subject_id')
    semester = payload.get('semester', 'ganjil')
    entries = payload.get('entries', [])

    is_admin = 'admin' in user.get('roles', [])
    if not is_admin:
        sched = await db.schedules.find_one({
            'class_id': class_id, 'subject_id': subject_id,
            'teacher_id': user['id'], 'academic_year_id': ay['id'] if ay else None,
        })
        if not sched:
            raise HTTPException(403, "Anda bukan pengampu mapel ini di kelas tersebut")

    inserted = 0
    for e in entries:
        nilai_p = e.get('nilai_pengetahuan')
        nilai_k = e.get('nilai_keterampilan')
        nilai_akhir = None
        if nilai_p is not None and nilai_k is not None:
            try:
                nilai_akhir = (float(nilai_p) + float(nilai_k)) / 2
            except Exception:
                nilai_akhir = None
        elif nilai_p is not None:
            nilai_akhir = float(nilai_p)
        predicate = e.get('predicate')
        if not predicate and nilai_akhir is not None:
            if nilai_akhir >= 88: predicate = 'A'
            elif nilai_akhir >= 76: predicate = 'B'
            elif nilai_akhir >= 60: predicate = 'C'
            else: predicate = 'D'
        existing = await db.grade_entries.find_one({
            'student_id': e['student_id'], 'class_id': class_id,
            'subject_id': subject_id, 'semester': semester,
            'academic_year_id': ay['id'] if ay else None,
        })
        doc = {
            'student_id': e['student_id'], 'class_id': class_id,
            'subject_id': subject_id, 'teacher_id': user['id'],
            'academic_year_id': ay['id'] if ay else None, 'semester': semester,
            'nilai_pengetahuan': float(nilai_p) if nilai_p is not None else None,
            'nilai_keterampilan': float(nilai_k) if nilai_k is not None else None,
            'nilai_akhir': nilai_akhir, 'predicate': predicate,
            'description': e.get('description'),
            'submitted_by': user['id'], 'submitted_at': datetime.utcnow().isoformat(),
        }
        if existing:
            await db.grade_entries.update_one({'_id': existing['_id']}, {'$set': doc})
        else:
            doc['id'] = str(uuid.uuid4())
            await db.grade_entries.insert_one(doc)
        inserted += 1
    await log_audit(user, 'grades_bulk', 'grade_entries', None,
                    details={'class_id': class_id, 'subject_id': subject_id, 'count': inserted}, request=request)
    return {'success': inserted}


@router.get("/grades")
async def list_grades(class_id: Optional[str] = None, subject_id: Optional[str] = None,
                     student_id: Optional[str] = None, semester: Optional[str] = None,
                     academic_year_id: Optional[str] = None,
                     user: Dict = Depends(get_current_user)):
    q = {}
    if class_id: q['class_id'] = class_id
    if subject_id: q['subject_id'] = subject_id
    if student_id: q['student_id'] = student_id
    if semester: q['semester'] = semester
    if academic_year_id: q['academic_year_id'] = academic_year_id
    if 'admin' not in user.get('roles', []) and 'siswa' in user.get('roles', []):
        q['student_id'] = user['id']
    items = await db.grade_entries.find(q, {'_id': 0}).to_list(2000)
    enriched = []
    for g in items:
        s = await db.users.find_one({'id': g.get('student_id')}, {'_id': 0, 'full_name': 1, 'nisn': 1})
        sub = await db.subjects.find_one({'id': g.get('subject_id')}, {'_id': 0, 'name': 1, 'code': 1})
        if s: g['student_name'] = s.get('full_name'); g['student_nisn'] = s.get('nisn')
        if sub: g['subject_name'] = sub.get('name'); g['subject_code'] = sub.get('code')
        enriched.append(serialize_doc(g))
    return enriched


@router.get("/grades/rapor/{student_id}")
async def get_student_rapor(student_id: str, semester: Optional[str] = None,
                            user: Dict = Depends(get_current_user)):
    """Get rapor view for a student"""
    student = await db.users.find_one({'id': student_id}, {'_id': 0, 'password_hash': 0})
    if not student:
        raise HTTPException(404, "Siswa tidak ditemukan")
    is_admin = 'admin' in user.get('roles', [])
    is_self = user['id'] == student_id
    cls = await db.classes.find_one({'id': student.get('student_class_id')}, {'_id': 0})
    is_homeroom = cls and cls.get('homeroom_teacher_id') == user['id']
    if not (is_admin or is_self or is_homeroom):
        raise HTTPException(403, "Tidak diizinkan")
    ay = await get_active_academic_year()
    q = {'student_id': student_id}
    if semester: q['semester'] = semester
    if ay: q['academic_year_id'] = ay['id']
    items = await db.grade_entries.find(q, {'_id': 0}).to_list(200)
    enriched = []
    for g in items:
        sub = await db.subjects.find_one({'id': g.get('subject_id')}, {'_id': 0, 'name': 1, 'code': 1})
        teacher = await db.users.find_one({'id': g.get('teacher_id')}, {'_id': 0, 'full_name': 1})
        if sub: g['subject_name'] = sub.get('name'); g['subject_code'] = sub.get('code')
        if teacher: g['teacher_name'] = teacher.get('full_name')
        enriched.append(serialize_doc(g))
    return {
        'student': serialize_doc(student),
        'class': serialize_doc(cls) if cls else None,
        'academic_year': ay,
        'grades': enriched,
        'average': round(sum(g.get('nilai_akhir', 0) or 0 for g in enriched) / len(enriched), 2) if enriched else 0,
    }
