"""
Waka Kurikulum Router - Dedicated endpoints for Waka Kurikulum role.
All endpoints here are read-only access to academic data.
"""
from typing import Dict, Optional
from fastapi import APIRouter, Depends, HTTPException

from core import (
    db,
    get_current_user,
    require_role,
    serialize_doc,
    get_active_context,
    ACADEMIC_MANAGEMENT_ROLES,
)
from routers._shared import compute_completeness

router = APIRouter()


# ============================================================
# STATS & DASHBOARD
# ============================================================
@router.get("/wakakur/stats")
async def wakakur_stats(user: Dict = Depends(require_role('waka_kurikulum'))):
    """Dashboard stats for Waka Kurikulum."""
    from routers.admin import admin_stats
    return await admin_stats(user)


@router.get("/wakakur/stats/students")
async def wakakur_stats_students(user: Dict = Depends(require_role('waka_kurikulum'))):
    """Student statistics for Waka Kurikulum."""
    from routers.admin import admin_stats_students
    return await admin_stats_students(user)


@router.get("/wakakur/stats/achievements")
async def wakakur_stats_achievements(user: Dict = Depends(require_role('waka_kurikulum'))):
    """Achievement statistics for Waka Kurikulum."""
    from routers.admin import admin_stats_achievements
    return await admin_stats_achievements(user)


# ============================================================
# SISWA (STUDENTS)
# ============================================================
@router.get("/wakakur/siswa")
async def wakakur_list_students(
    class_id: Optional[str] = None,
    exclude_mutation: bool = False,
    user: Dict = Depends(require_role('waka_kurikulum'))
):
    """Get list of students - Waka Kurikulum has read-only access to all students."""
    q = {'roles': 'siswa'}

    if class_id:
        q['student_class_id'] = class_id

    if exclude_mutation:
        q['mutation_type'] = {'$exists': False}

    items = await db.users.find(q, {'_id': 0, 'password_hash': 0}).sort('full_name', 1).to_list(5000)
    student_ids = [s['id'] for s in items if s.get('id')]
    details = await db.student_details.find({'student_id': {'$in': student_ids}}, {'_id': 0}).to_list(5000)
    detail_map = {d['student_id']: d for d in details}
    enriched = []
    for s in items:
        cls = await db.classes.find_one({'id': s.get('student_class_id')}, {'_id': 0, 'name': 1})
        s['class_name'] = cls.get('name') if cls else None
        s['completeness_percentage'] = compute_completeness(s, detail_map.get(s.get('id')))
        enriched.append(serialize_doc(s))
    return enriched


@router.get("/wakakur/siswa/{sid}/detail")
async def wakakur_student_detail(sid: str, user: Dict = Depends(require_role('waka_kurikulum'))):
    """Get student detail."""
    student = await db.users.find_one({'id': sid}, {'_id': 0, 'password_hash': 0})
    if not student:
        raise HTTPException(status_code=404, detail="Siswa tidak ditemukan")
    return serialize_doc(student)


# ============================================================
# KEHADIRAN (ATTENDANCE)
# ============================================================
@router.get("/wakakur/kehadiran/by-class")
async def wakakur_attendance_by_class(
    class_id: str,
    month: Optional[int] = None,
    year: Optional[int] = None,
    user: Dict = Depends(require_role('waka_kurikulum'))
):
    """Get attendance records for a specific class."""
    from routers.admin import get_attendance_by_class
    return await get_attendance_by_class(class_id, month, year, user)


@router.get("/wakakur/kehadiran/by-grade")
async def wakakur_attendance_by_grade(
    grade_level: str,
    month: Optional[int] = None,
    year: Optional[int] = None,
    user: Dict = Depends(require_role('waka_kurikulum'))
):
    """Get attendance statistics by grade level."""
    from routers.admin import get_attendance_by_grade
    return await get_attendance_by_grade(grade_level, month, year, user)


@router.get("/wakakur/kehadiran/overall")
async def wakakur_attendance_overall(
    month: Optional[int] = None,
    year: Optional[int] = None,
    user: Dict = Depends(require_role('waka_kurikulum'))
):
    """Get overall school-wide attendance statistics."""
    from routers.admin import get_attendance_overall
    return await get_attendance_overall(month, year, user)


# ============================================================
# JURNAL (TEACHING JOURNAL)
# ============================================================
@router.get("/wakakur/jurnal")
async def wakakur_jurnal_rekap(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    class_id: Optional[str] = None,
    teacher_id: Optional[str] = None,
    subject_id: Optional[str] = None,
    semester_id: Optional[str] = None,
    limit: int = 500,
    user: Dict = Depends(require_role('waka_kurikulum'))
):
    """Get teaching journal recap - read-only access."""
    from routers.journals import admin_jurnal_rekap
    return await admin_jurnal_rekap(start_date, end_date, class_id, teacher_id, subject_id, semester_id, limit, user)


@router.get("/wakakur/jurnal/stats-by-teacher")
async def wakakur_jurnal_stats_teacher(
    class_id: Optional[str] = None,
    user: Dict = Depends(require_role('waka_kurikulum'))
):
    """Get journal statistics by teacher."""
    from routers.journals import admin_jurnal_stats_teacher
    return await admin_jurnal_stats_teacher(class_id, user)


# ============================================================
# JADWAL (SCHEDULES)
# ============================================================
@router.get("/wakakur/jadwal")
async def wakakur_list_schedules(
    class_id: Optional[str] = None,
    teacher_id: Optional[str] = None,
    semester_id: Optional[str] = None,
    user: Dict = Depends(require_role('waka_kurikulum'))
):
    """Get schedules - read-only access."""
    ctx = await get_active_context(user)
    sem_id = semester_id or ctx.get('semester_id')

    q = {}
    if sem_id:
        q['semester_id'] = sem_id
    if class_id:
        q['class_id'] = class_id
    if teacher_id:
        q['teacher_id'] = teacher_id

    items = await db.schedules.find(q, {'_id': 0}).to_list(5000)
    return [serialize_doc(i) for i in items]


# ============================================================
# USERS (GTK)
# ============================================================
@router.get("/wakakur/users")
async def wakakur_list_users(
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    user: Dict = Depends(require_role('waka_kurikulum'))
):
    """Get list of users/teachers - read-only access."""
    q = {}
    if role:
        q['roles'] = role
    if is_active is not None:
        q['is_active'] = is_active

    items = await db.users.find(q, {'_id': 0, 'password_hash': 0}).sort('full_name', 1).to_list(2000)
    return [serialize_doc(i) for i in items]


# ============================================================
# CLASSES
# ============================================================
@router.get("/wakakur/classes")
async def wakakur_list_classes(
    semester_id: Optional[str] = None,
    user: Dict = Depends(require_role('waka_kurikulum'))
):
    """Get list of classes."""
    ctx = await get_active_context(user)
    sem_id = semester_id or ctx.get('semester_id')

    q = {}
    if sem_id:
        q['semester_id'] = sem_id

    items = await db.classes.find(q, {'_id': 0}).sort('name', 1).to_list(500)
    return [serialize_doc(i) for i in items]


# ============================================================
# SUBJECTS
# ============================================================
@router.get("/wakakur/subjects")
async def wakakur_list_subjects(user: Dict = Depends(require_role('waka_kurikulum'))):
    """Get list of subjects."""
    items = await db.subjects.find({}, {'_id': 0}).sort('name', 1).to_list(200)
    return [serialize_doc(i) for i in items]


# ============================================================
# MATERI & TUGAS
# ============================================================
@router.get("/wakakur/materi")
async def wakakur_list_materi(user: Dict = Depends(require_role('waka_kurikulum'))):
    """Get all materi - read-only access."""
    items = await db.materi_mapel.find({'is_active': True}, {'_id': 0}).sort('created_at', -1).to_list(1000)

    # Enrich with teacher and subject names
    for item in items:
        if item.get('teacher_id'):
            teacher = await db.users.find_one({'id': item['teacher_id']}, {'_id': 0, 'full_name': 1})
            if teacher:
                item['teacher_name'] = teacher.get('full_name')

        if item.get('subject_id'):
            subject = await db.subjects.find_one({'id': item['subject_id']}, {'_id': 0, 'name': 1})
            if subject:
                item['subject_name'] = subject.get('name')

    return [serialize_doc(i) for i in items]


@router.get("/wakakur/materi/{materi_id}")
async def wakakur_materi_detail(materi_id: str, user: Dict = Depends(require_role('waka_kurikulum'))):
    """Get materi detail - read-only access."""
    materi = await db.materi_mapel.find_one({'id': materi_id, 'is_active': True}, {'_id': 0})
    if not materi:
        raise HTTPException(status_code=404, detail="Materi tidak ditemukan")

    # Enrich with teacher and subject names
    if materi.get('teacher_id'):
        teacher = await db.users.find_one({'id': materi['teacher_id']}, {'_id': 0, 'full_name': 1})
        if teacher:
            materi['teacher_name'] = teacher.get('full_name')

    if materi.get('subject_id'):
        subject = await db.subjects.find_one({'id': materi['subject_id']}, {'_id': 0, 'name': 1})
        if subject:
            materi['subject_name'] = subject.get('name')

    return serialize_doc(materi)


@router.get("/wakakur/tugas")
async def wakakur_list_tugas(user: Dict = Depends(require_role('waka_kurikulum'))):
    """Get all tugas - read-only access."""
    items = await db.tugas.find({'is_active': True}, {'_id': 0}).sort('created_at', -1).to_list(1000)

    # Enrich with teacher and subject names
    for item in items:
        if item.get('teacher_id'):
            teacher = await db.users.find_one({'id': item['teacher_id']}, {'_id': 0, 'full_name': 1})
            if teacher:
                item['teacher_name'] = teacher.get('full_name')

        if item.get('subject_id'):
            subject = await db.subjects.find_one({'id': item['subject_id']}, {'_id': 0, 'name': 1})
            if subject:
                item['subject_name'] = subject.get('name')

    return [serialize_doc(i) for i in items]


@router.get("/wakakur/tugas/{tugas_id}/submissions")
async def wakakur_tugas_submissions(tugas_id: str, user: Dict = Depends(require_role('waka_kurikulum'))):
    """Get submissions for a specific tugas."""
    submissions = await db.tugas_submissions.find({'tugas_id': tugas_id}, {'_id': 0}).to_list(500)

    # Enrich with student info
    for sub in submissions:
        if sub.get('student_id'):
            student = await db.users.find_one(
                {'id': sub['student_id']},
                {'_id': 0, 'full_name': 1, 'student_nis': 1}
            )
            if student:
                sub['student_name'] = student.get('full_name')
                sub['student_nis'] = student.get('student_nis')

    return {'submissions': [serialize_doc(s) for s in submissions]}
