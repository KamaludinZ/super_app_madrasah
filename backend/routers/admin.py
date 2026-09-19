"""Admin: stats, audit-logs, security-logs, backup."""
import calendar
import io
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse

from core import (
    db,
    get_active_academic_year,
    get_active_context,
    get_settings,
    log_audit,
    logger,
    require_role,
    serialize_doc,
    MANAGEMENT_ROLES,
    ACADEMIC_MANAGEMENT_ROLES,
)
from journal_core import current_day_id, now_wib

router = APIRouter()


# ============================================================
# AUDIT / SECURITY LOGS
# ============================================================
@router.get("/admin/audit-logs")
async def get_audit_logs(limit: int = 200, target_id: Optional[str] = None,
                         target_type: Optional[str] = None,
                         user: Dict = Depends(require_role('admin', 'kepala_sekolah', 'waka_kurikulum'))):
    q = {}
    if target_id:
        q['entity_id'] = target_id
    if target_type:
        q['entity'] = target_type
    items = await db.audit_logs.find(q, {'_id': 0}).sort('timestamp', -1).to_list(limit)
    return [serialize_doc(i) for i in items]


@router.get("/admin/security-logs")
async def get_security_logs(limit: int = 200, user: Dict = Depends(require_role('admin'))):
    items = await db.security_logs.find({}, {'_id': 0}).sort('timestamp', -1).to_list(limit)
    return [serialize_doc(i) for i in items]


# ============================================================
# ADMIN STATS
# ============================================================
@router.get("/admin/stats")
async def admin_stats(user: Dict = Depends(require_role(*MANAGEMENT_ROLES))):
    """Dashboard stats filtered by user's view context (semester)"""
    today = current_day_id()
    ctx = await get_active_context(user)
    semester_id = ctx.get('semester_id')

    total_users = await db.users.count_documents({})
    total_classes = await db.classes.count_documents({'semester_id': semester_id} if semester_id else {})
    total_rooms = await db.rooms.count_documents({})
    total_schedules_today = await db.schedules.count_documents({
        'day': today, 'semester_id': semester_id,
    } if semester_id else {'day': today})
    now = now_wib()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    total_journals_today = await db.journals.count_documents({'started_at': {'$gte': today_start}})
    return {
        'total_users': total_users, 'total_classes': total_classes, 'total_rooms': total_rooms,
        'total_schedules_today': total_schedules_today, 'total_journals_today': total_journals_today,
        'active_semester': ctx.get('semester_name'), 'current_day': today,
        'active_academic_year': ctx.get('academic_year_name'),
    }


@router.get("/admin/stats/students")
async def admin_stats_students(user: Dict = Depends(require_role(*MANAGEMENT_ROLES))):
    """Statistik siswa: total, per tingkat (7/8/9), mutasi filtered by user's view context (semester)."""
    ctx = await get_active_context(user)
    semester_id = ctx.get('semester_id')
    academic_year_id = ctx.get('academic_year_id')

    total = await db.users.count_documents({'roles': 'siswa', 'is_active': True})
    classes = await db.classes.find({'semester_id': semester_id} if semester_id else {}, {'_id': 0, 'id': 1, 'grade': 1}).to_list(500)
    grade_map = {c['id']: c.get('grade') for c in classes}
    per_grade = {7: 0, 8: 0, 9: 0}
    siswa_users = await db.users.find({'roles': 'siswa', 'is_active': True}, {'_id': 0, 'student_class_id': 1}).to_list(5000)
    for s in siswa_users:
        g = grade_map.get(s.get('student_class_id'))
        if g in per_grade:
            per_grade[g] += 1
    mutasi_q = {'roles': 'siswa'}
    if academic_year_id:
        mutasi_q['mutation_ay_id'] = academic_year_id
    mutasi_q['mutation_type'] = {'$in': ['masuk', 'keluar']}
    total_mutasi = await db.users.count_documents(mutasi_q)
    mutasi_masuk = await db.users.count_documents({**mutasi_q, 'mutation_type': 'masuk'})
    mutasi_keluar = await db.users.count_documents({**mutasi_q, 'mutation_type': 'keluar'})
    return {
        'total': total,
        'kelas_7': per_grade[7],
        'kelas_8': per_grade[8],
        'kelas_9': per_grade[9],
        'mutasi_total': total_mutasi,
        'mutasi_masuk': mutasi_masuk,
        'mutasi_keluar': mutasi_keluar,
        'semester_name': ctx.get('semester_name'),
        'academic_year': ctx.get('academic_year_name'),
    }


@router.get("/admin/stats/achievements")
async def admin_stats_achievements(user: Dict = Depends(require_role(*MANAGEMENT_ROLES))):
    """Statistik prestasi: total, per tingkat lomba."""
    total = await db.achievements.count_documents({})
    verified = await db.achievements.count_documents({'is_verified': True})
    levels = ['sekolah', 'kecamatan', 'kab_kota', 'kota', 'kabupaten', 'provinsi', 'nasional', 'internasional']
    by_level = {}
    for lvl in levels:
        by_level[lvl] = await db.achievements.count_documents({'level': lvl})
    kab_kota = by_level.get('kab_kota', 0) + by_level.get('kota', 0) + by_level.get('kabupaten', 0)
    by_holder = {}
    for ht in ['siswa', 'guru', 'tendik', 'madrasah']:
        by_holder[ht] = await db.achievements.count_documents({'holder_type': ht})
    legacy_siswa = await db.achievements.count_documents({'holder_type': {'$exists': False}, 'student_id': {'$ne': None}})
    by_holder['siswa'] = by_holder.get('siswa', 0) + legacy_siswa
    return {
        'total': total,
        'verified': verified,
        'kab_kota': kab_kota,
        'provinsi': by_level.get('provinsi', 0),
        'nasional': by_level.get('nasional', 0),
        'internasional': by_level.get('internasional', 0),
        'by_holder': by_holder,
        'by_level': by_level,
    }


# ============================================================
# BACKUP & RESTORE
# ============================================================
BACKUP_COLLECTIONS = [
    'users', 'classes', 'rooms', 'subjects', 'schedules', 'academic_years',
    'settings', 'journals', 'attendances', 'class_attendances', 'class_cleanliness',
    'audit_logs', 'security_logs', 'piket_schedules', 'achievements',
    'extracurriculars', 'extra_members', 'extra_attendance', 'extra_grades',
    'student_grades', 'weekly_holidays', 'academic_holidays', 'teacher_tasks',
    'password_reset_tokens',
]


@router.get("/admin/backup/info")
async def backup_info(user: Dict = Depends(require_role('admin'))):
    """Statistik untuk halaman backup: total dokumen per koleksi."""
    info = {}
    for coll in BACKUP_COLLECTIONS:
        try:
            info[coll] = await db[coll].count_documents({})
        except Exception:
            info[coll] = 0
    last_backup = await db.backup_logs.find_one({}, {'_id': 0}, sort=[('created_at', -1)])
    return {
        'collections': info,
        'total_documents': sum(info.values()),
        'last_backup': serialize_doc(last_backup) if last_backup else None,
    }


@router.get("/admin/backup/export")
async def backup_export(user: Dict = Depends(require_role('admin')), request: Request = None):
    """Download backup .json semua koleksi."""
    dump = {
        'version': 1,
        'exported_at': now_wib().isoformat(),
        'school_name': (await get_settings()).get('school_name', ''),
        'collections': {},
    }
    for coll in BACKUP_COLLECTIONS:
        try:
            items = await db[coll].find({}, {'_id': 0}).to_list(100000)
            for it in items:
                for k, v in list(it.items()):
                    if isinstance(v, datetime):
                        it[k] = v.isoformat()
            dump['collections'][coll] = items
        except Exception as e:
            logger.error(f"Backup export error for {coll}: {e}")
            dump['collections'][coll] = []
    await db.backup_logs.insert_one({
        'id': str(uuid.uuid4()),
        'type': 'export',
        'user_id': user['id'],
        'user_name': user.get('full_name', user['username']),
        'total_documents': sum(len(v) for v in dump['collections'].values()),
        'created_at': now_wib().isoformat(),
    })
    if request:
        await log_audit(user, 'backup_export', 'system', '-', details={
            'total': sum(len(v) for v in dump['collections'].values())
        }, request=request)
    payload = json.dumps(dump, ensure_ascii=False, default=str).encode('utf-8')
    filename = f"backup_matsandatama_{now_wib().strftime('%Y%m%d_%H%M%S')}.json"
    return StreamingResponse(
        io.BytesIO(payload),
        media_type='application/json',
        headers={'Content-Disposition': f'attachment; filename={filename}'}
    )


@router.post("/admin/backup/import")
async def backup_import(file: UploadFile = File(...), mode: str = Form('merge'),
                       user: Dict = Depends(require_role('admin')), request: Request = None):
    """Restore dari backup .json. Mode: merge (default) atau replace."""
    if not file.filename.lower().endswith('.json'):
        raise HTTPException(400, "Hanya file .json yang didukung")
    if mode not in ('merge', 'replace'):
        raise HTTPException(400, "Mode harus 'merge' atau 'replace'")
    content = await file.read()
    try:
        dump = json.loads(content.decode('utf-8'))
    except Exception:
        raise HTTPException(400, "File backup tidak valid (bukan JSON)")
    if 'collections' not in dump:
        raise HTTPException(400, "Format backup tidak valid")
    summary = {'restored': {}, 'errors': []}
    for coll, items in dump['collections'].items():
        if coll not in BACKUP_COLLECTIONS:
            continue
        try:
            if mode == 'replace':
                await db[coll].delete_many({})
            count = 0
            for it in items:
                it.pop('_id', None)
                if mode == 'merge' and it.get('id'):
                    await db[coll].update_one({'id': it['id']}, {'$set': it}, upsert=True)
                else:
                    await db[coll].insert_one(it)
                count += 1
            summary['restored'][coll] = count
        except Exception as e:
            summary['errors'].append(f"{coll}: {str(e)[:100]}")
    await db.backup_logs.insert_one({
        'id': str(uuid.uuid4()),
        'type': f'import_{mode}',
        'user_id': user['id'],
        'user_name': user.get('full_name', user['username']),
        'total_documents': sum(summary['restored'].values()),
        'created_at': now_wib().isoformat(),
    })
    if request:
        await log_audit(user, f'backup_import_{mode}', 'system', '-', details=summary, request=request)
    return summary


@router.get("/admin/backup/logs")
async def backup_logs(user: Dict = Depends(require_role('admin'))):
    items = await db.backup_logs.find({}, {'_id': 0}).sort('created_at', -1).to_list(50)
    return [serialize_doc(i) for i in items]



# ============================================================
# EXCEL EXPORTS (Snapshot data to .xlsx)
# ============================================================
def _xlsx_response(content: bytes, filename: str):
    return StreamingResponse(
        io.BytesIO(content),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )


def _ts() -> str:
    return now_wib().strftime('%Y%m%d_%H%M%S')


@router.get("/admin/export/users-excel")
async def export_users_excel(user: Dict = Depends(require_role('admin')), request: Request = None):
    from excel_io import export_users_xlsx
    items = await db.users.find({}, {'_id': 0, 'password_hash': 0}).sort('username', 1).to_list(5000)
    if request:
        await log_audit(user, 'export_excel', 'user', None, details={'count': len(items)}, request=request)
    return _xlsx_response(export_users_xlsx([serialize_doc(i) for i in items]),
                          f"export_users_{_ts()}.xlsx")


@router.get("/admin/export/students-excel")
async def export_students_excel(user: Dict = Depends(require_role('admin')), request: Request = None):
    from excel_io import export_students_xlsx
    siswa = await db.users.find({'roles': 'siswa'}, {'_id': 0, 'password_hash': 0}).sort('full_name', 1).to_list(5000)
    classes_map = {c['id']: c.get('name') for c in await db.classes.find({}, {'_id': 0, 'id': 1, 'name': 1}).to_list(1000)}
    enriched = []
    for s in siswa:
        s = serialize_doc(s)
        s['class_name'] = classes_map.get(s.get('student_class_id'), '')
        enriched.append(s)
    if request:
        await log_audit(user, 'export_excel', 'student', None, details={'count': len(enriched)}, request=request)
    return _xlsx_response(export_students_xlsx(enriched), f"export_siswa_{_ts()}.xlsx")


@router.get("/admin/export/schedules-excel")
async def export_schedules_excel(academic_year_id: Optional[str] = None,
                                 user: Dict = Depends(require_role('admin')),
                                 request: Request = None):
    from excel_io import export_schedules_xlsx
    q = {}
    if academic_year_id:
        q['academic_year_id'] = academic_year_id
    schedules = await db.schedules.find(q, {'_id': 0}).sort([('day', 1), ('start_time', 1)]).to_list(5000)
    classes_map = {c['id']: c.get('name') for c in await db.classes.find({}, {'_id': 0, 'id': 1, 'name': 1}).to_list(1000)}
    subjects_map = {s['id']: s for s in await db.subjects.find({}, {'_id': 0}).to_list(1000)}
    rooms_map = {r['id']: r.get('name') for r in await db.rooms.find({}, {'_id': 0, 'id': 1, 'name': 1}).to_list(1000)}
    teachers_map = {u['id']: u.get('full_name') for u in await db.users.find({}, {'_id': 0, 'id': 1, 'full_name': 1}).to_list(5000)}
    enriched = []
    for s in schedules:
        s = serialize_doc(s)
        s['class_name'] = classes_map.get(s.get('class_id'), '')
        sub = subjects_map.get(s.get('subject_id'), {})
        s['subject_name'] = sub.get('name', '') if sub else ''
        s['subject_code'] = sub.get('code', '') if sub else ''
        s['room_name'] = rooms_map.get(s.get('room_id'), '')
        s['teacher_name'] = teachers_map.get(s.get('teacher_id'), '')
        enriched.append(s)
    if request:
        await log_audit(user, 'export_excel', 'schedule', None, details={'count': len(enriched)}, request=request)
    return _xlsx_response(export_schedules_xlsx(enriched), f"export_jadwal_{_ts()}.xlsx")


@router.get("/admin/export/grades-excel")
async def export_grades_excel(class_id: Optional[str] = None,
                              subject_id: Optional[str] = None,
                              semester: Optional[str] = None,
                              academic_year_id: Optional[str] = None,
                              user: Dict = Depends(require_role('admin')),
                              request: Request = None):
    from excel_io import export_grades_xlsx
    q = {}
    if class_id: q['class_id'] = class_id
    if subject_id: q['subject_id'] = subject_id
    if semester: q['semester'] = semester
    if academic_year_id: q['academic_year_id'] = academic_year_id
    grades = await db.grade_entries.find(q, {'_id': 0}).to_list(20000)
    students_map = {u['id']: u for u in await db.users.find({'roles': 'siswa'},
                                                            {'_id': 0, 'id': 1, 'full_name': 1, 'nisn': 1, 'student_class_id': 1}).to_list(5000)}
    classes_map = {c['id']: c.get('name') for c in await db.classes.find({}, {'_id': 0, 'id': 1, 'name': 1}).to_list(1000)}
    subjects_map = {s['id']: s for s in await db.subjects.find({}, {'_id': 0}).to_list(1000)}
    enriched = []
    for g in grades:
        g = serialize_doc(g)
        st = students_map.get(g.get('student_id'), {})
        g['student_name'] = st.get('full_name', '') if st else ''
        g['student_nisn'] = st.get('nisn', '') if st else ''
        g['class_name'] = classes_map.get(g.get('class_id'), '') or classes_map.get(st.get('student_class_id'), '')
        sub = subjects_map.get(g.get('subject_id'), {})
        g['subject_name'] = sub.get('name', '') if sub else ''
        g['subject_code'] = sub.get('code', '') if sub else ''
        enriched.append(g)
    if request:
        await log_audit(user, 'export_excel', 'grade', None, details={'count': len(enriched)}, request=request)
    return _xlsx_response(export_grades_xlsx(enriched), f"export_nilai_{_ts()}.xlsx")


# ============================================================
# ATTENDANCE ENDPOINTS FOR ADMIN
# ============================================================
@router.get("/admin/attendance/by-class")
async def get_attendance_by_class(
    class_id: str,
    month: Optional[int] = None,
    year: Optional[int] = None,
    user: Dict = Depends(require_role(*ACADEMIC_MANAGEMENT_ROLES, 'waka_kesiswaan', 'guru_tata_tertib'))
):
    """Get attendance records for a specific class.

    Returns per-student summary with detailed records for the specified class.
    """
    # Default to current month/year if not provided
    now = now_wib()
    target_month = month if month else now.month
    target_year = year if year else now.year

    # Get first and last day of the month
    first_day = datetime(target_year, target_month, 1)
    last_day_num = calendar.monthrange(target_year, target_month)[1]
    last_day = datetime(target_year, target_month, last_day_num, 23, 59, 59)

    # Get class info
    cls = await db.classes.find_one({'id': class_id}, {'_id': 0})
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    # Get all students in this class
    students = await db.users.find(
        {'student_class_id': class_id, 'roles': 'siswa'},
        {'_id': 0, 'id': 1, 'full_name': 1, 'nisn': 1}
    ).sort('full_name', 1).to_list(200)
    student_ids = [s['id'] for s in students]

    # Get all attendance records for this class in the month
    attendance_records = await db.attendances.find({
        'student_id': {'$in': student_ids},
        'created_at': {
            '$gte': first_day.isoformat(),
            '$lte': last_day.isoformat()
        }
    }, {'_id': 0}).to_list(10000)

    # Enrich attendance records with journal data (subject, teacher info)
    journal_ids = list(set([r.get('journal_id') for r in attendance_records if r.get('journal_id')]))
    journals = await db.journals.find({'id': {'$in': journal_ids}}, {'_id': 0, 'id': 1, 'subject_id': 1, 'teacher_id': 1}).to_list(1000) if journal_ids else []
    journal_map = {j['id']: j for j in journals}

    # Get subjects and teachers
    subject_ids = list(set([j.get('subject_id') for j in journals if j.get('subject_id')]))
    teacher_ids = list(set([j.get('teacher_id') for j in journals if j.get('teacher_id')]))

    subjects = await db.subjects.find({'id': {'$in': subject_ids}}, {'_id': 0, 'id': 1, 'name': 1, 'code': 1}).to_list(500) if subject_ids else []
    teachers = await db.users.find({'id': {'$in': teacher_ids}}, {'_id': 0, 'id': 1, 'full_name': 1}).to_list(200) if teacher_ids else []

    subject_map = {s['id']: s for s in subjects}
    teacher_map = {t['id']: t for t in teachers}

    # Enrich each attendance record
    enriched_count = 0
    for record in attendance_records:
        journal_id = record.get('journal_id')
        if journal_id and journal_id in journal_map:
            journal = journal_map[journal_id]
            subject_id = journal.get('subject_id')
            teacher_id = journal.get('teacher_id')

            if subject_id and subject_id in subject_map:
                record['subject_name'] = subject_map[subject_id].get('name')
                record['subject_code'] = subject_map[subject_id].get('code')

            if teacher_id and teacher_id in teacher_map:
                record['teacher_name'] = teacher_map[teacher_id].get('full_name')

            enriched_count += 1

    # Build per-student summary
    student_summaries = []
    logger.info(f"[ATTENDANCE-BY-CLASS] Total students: {len(students)}, Total attendance records: {len(attendance_records)}, Enriched: {enriched_count}")
    for student in students:
        student_id = student['id']
        student_records = [r for r in attendance_records if r.get('student_id') == student_id]

        # Count by status
        total = len(student_records)
        hadir = sum(1 for r in student_records if r.get('status') == 'hadir')
        sakit = sum(1 for r in student_records if r.get('status') == 'sakit')
        izin = sum(1 for r in student_records if r.get('status') == 'izin')
        alpa = sum(1 for r in student_records if r.get('status') in ['alpa', 'alpha'])

        if len(student_records) > 0:
            logger.info(f"[ATTENDANCE-BY-CLASS] Student {student['full_name']}: total={total}, hadir={hadir}, sakit={sakit}, izin={izin}, alpa={alpa}")
            logger.info(f"[ATTENDANCE-BY-CLASS] Sample statuses for {student['full_name']}: {[r.get('status') for r in student_records[:5]]}")

        percentage = (hadir / total * 100) if total > 0 else 0

        # Prepare records with serialized dates
        serialized_records = []
        for record in student_records:
            # Handle datetime serialization more robustly
            created_at_value = record.get('created_at')
            if isinstance(created_at_value, datetime):
                date_str = created_at_value.isoformat()
            elif isinstance(created_at_value, str):
                date_str = created_at_value
            else:
                date_str = str(created_at_value) if created_at_value else None

            serialized_record = {
                'id': record.get('id'),
                'student_id': record.get('student_id'),
                'status': record.get('status'),
                'date': date_str,
                'subject_name': record.get('subject_name'),
                'subject_code': record.get('subject_code'),
                'teacher_name': record.get('teacher_name'),
                'created_at': date_str,
                'journal_id': record.get('journal_id'),
            }
            serialized_records.append(serialized_record)

        if len(serialized_records) > 0:
            logger.info(f"[ATTENDANCE-BY-CLASS] Student {student['full_name']}: {len(serialized_records)} records prepared")
            logger.info(f"[ATTENDANCE-BY-CLASS] Sample record: {serialized_records[0] if serialized_records else 'None'}")

        student_summaries.append({
            'student_id': student_id,
            'student_name': student['full_name'],
            'nisn': student.get('nisn'),
            'total': total,
            'hadir': hadir,
            'sakit': sakit,
            'izin': izin,
            'alpa': alpa,
            'percentage': round(percentage, 2),
            'records': serialized_records
        })

    # Calculate class-level statistics
    total_records = len(attendance_records)
    total_hadir = sum(1 for a in attendance_records if a.get('status') == 'hadir')
    total_sakit = sum(1 for a in attendance_records if a.get('status') == 'sakit')
    total_izin = sum(1 for a in attendance_records if a.get('status') == 'izin')
    total_alpa = sum(1 for a in attendance_records if a.get('status') in ['alpa', 'alpha'])
    class_percentage = (total_hadir / total_records * 100) if total_records > 0 else 0

    return {
        'class': serialize_doc(cls),
        'month': target_month,
        'year': target_year,
        'class_statistics': {
            'total': total_records,
            'hadir': total_hadir,
            'sakit': total_sakit,
            'izin': total_izin,
            'alpa': total_alpa,
            'percentage': round(class_percentage, 2)
        },
        'students': student_summaries
    }


@router.get("/admin/attendance/by-grade")
async def get_attendance_by_grade(
    grade_level: str,
    month: Optional[int] = None,
    year: Optional[int] = None,
    user: Dict = Depends(require_role(*ACADEMIC_MANAGEMENT_ROLES, 'waka_kesiswaan', 'guru_tata_tertib'))
):
    """Get attendance statistics aggregated by grade level (tingkat).

    Returns statistics for all classes in the specified grade level.
    Grade level examples: '7', '8', '9' (tingkat)
    """
    # Default to current month/year if not provided
    from core import get_active_context
    now = now_wib()
    target_month = month if month else now.month
    target_year = year if year else now.year

    # Get active context to filter by active semester and academic year
    active_context = await get_active_context(user)

    # Get first and last day of the month
    first_day = datetime(target_year, target_month, 1)
    last_day_num = calendar.monthrange(target_year, target_month)[1]
    last_day = datetime(target_year, target_month, last_day_num, 23, 59, 59)

    # Build filter for active classes in the specified tingkat
    class_filter = {}
    if active_context:
        class_filter['academic_year_id'] = active_context.get('academic_year_id')
        class_filter['semester_id'] = active_context.get('semester_id')

    logger.info(f"[ATTENDANCE BY GRADE] Searching for tingkat: {grade_level}")
    logger.info(f"[ATTENDANCE BY GRADE] Active context filter: {class_filter}")

    # Get all classes (we'll filter by tingkat after extraction)
    all_classes = await db.classes.find(
        class_filter,
        {'_id': 0, 'id': 1, 'name': 1, 'tingkat': 1, 'grade_level': 1}
    ).sort('name', 1).to_list(100)

    logger.info(f"[ATTENDANCE BY GRADE] Found {len(all_classes)} active classes total")

    # Filter classes by tingkat (extract from name if needed)
    import re
    classes = []
    for cls in all_classes:
        # Try to get tingkat from field, or extract from class name
        tingkat = cls.get('tingkat') or cls.get('grade_level')

        # If still None, try to extract from class name (e.g., "7A" -> 7)
        if not tingkat:
            class_name = cls.get('name', '')
            match = re.match(r'^(\d+)', class_name)
            if match:
                tingkat = int(match.group(1))

        # Convert grade_level to int for comparison
        try:
            target_tingkat = int(grade_level)
            if tingkat == target_tingkat:
                classes.append(cls)
                logger.debug(f"[ATTENDANCE BY GRADE] Matched class: {cls.get('name')} (tingkat={tingkat})")
        except (ValueError, TypeError):
            logger.warning(f"[ATTENDANCE BY GRADE] Invalid grade_level parameter: {grade_level}")
            continue

    logger.info(f"[ATTENDANCE BY GRADE] Found {len(classes)} classes for tingkat {grade_level}")

    if not classes:
        return {
            'grade_level': grade_level,
            'month': target_month,
            'year': target_year,
            'classes': [],
            'grade_statistics': {
                'total': 0,
                'hadir': 0,
                'sakit': 0,
                'izin': 0,
                'alpa': 0,
                'percentage': 0
            }
        }

    # Get statistics for each class
    class_summaries = []
    all_attendance_records = []

    for cls in classes:
        class_id = cls['id']

        # Get all students in this class
        students = await db.users.find(
            {'student_class_id': class_id, 'roles': 'siswa'},
            {'_id': 0, 'id': 1}
        ).to_list(200)
        student_ids = [s['id'] for s in students]

        if not student_ids:
            continue

        # Get attendance records for this class
        attendance_records = await db.attendances.find({
            'student_id': {'$in': student_ids},
            'created_at': {
                '$gte': first_day.isoformat(),
                '$lte': last_day.isoformat()
            }
        }, {'_id': 0}).to_list(10000)

        logger.info(f"[ATTENDANCE BY GRADE] Class {cls['name']}: {len(student_ids)} students, {len(attendance_records)} attendance records")

        all_attendance_records.extend(attendance_records)

        # Calculate class statistics
        total = len(attendance_records)
        hadir = sum(1 for a in attendance_records if a.get('status') == 'hadir')
        sakit = sum(1 for a in attendance_records if a.get('status') == 'sakit')
        izin = sum(1 for a in attendance_records if a.get('status') == 'izin')
        alpa = sum(1 for a in attendance_records if a.get('status') in ['alpa', 'alpha'])
        percentage = (hadir / total * 100) if total > 0 else 0

        class_summaries.append({
            'class_id': class_id,
            'class_name': cls['name'],
            'student_count': len(student_ids),
            'total': total,
            'hadir': hadir,
            'sakit': sakit,
            'izin': izin,
            'alpa': alpa,
            'percentage': round(percentage, 2)
        })

    # Calculate grade-level statistics
    grade_total = len(all_attendance_records)
    grade_hadir = sum(1 for a in all_attendance_records if a.get('status') == 'hadir')
    grade_sakit = sum(1 for a in all_attendance_records if a.get('status') == 'sakit')
    grade_izin = sum(1 for a in all_attendance_records if a.get('status') == 'izin')
    grade_alpa = sum(1 for a in all_attendance_records if a.get('status') in ['alpa', 'alpha'])
    grade_percentage = (grade_hadir / grade_total * 100) if grade_total > 0 else 0

    logger.info(f"[ATTENDANCE BY GRADE] Grade {grade_level} statistics: total={grade_total}, hadir={grade_hadir}, sakit={grade_sakit}, izin={grade_izin}, alpa={grade_alpa}")

    return {
        'grade_level': grade_level,
        'month': target_month,
        'year': target_year,
        'classes': class_summaries,
        'grade_statistics': {
            'total': grade_total,
            'hadir': grade_hadir,
            'sakit': grade_sakit,
            'izin': grade_izin,
            'alpa': grade_alpa,
            'percentage': round(grade_percentage, 2)
        }
    }


@router.get("/admin/attendance/overall")
async def get_attendance_overall(
    month: Optional[int] = None,
    year: Optional[int] = None,
    user: Dict = Depends(require_role(*ACADEMIC_MANAGEMENT_ROLES, 'waka_kesiswaan', 'guru_tata_tertib'))
):
    """Get overall school-wide attendance statistics.

    Returns comprehensive statistics including:
    - Overall school statistics (monthly, weekly, daily)
    - Breakdown by grade level
    - Breakdown by class
    """
    # Default to current month/year if not provided
    now = now_wib()
    target_month = month if month else now.month
    target_year = year if year else now.year

    # Get active context to filter by active semester and academic year
    from core import get_active_context
    active_context = await get_active_context(user)

    # Get first and last day of the month
    first_day = datetime(target_year, target_month, 1)
    last_day_num = calendar.monthrange(target_year, target_month)[1]
    last_day = datetime(target_year, target_month, last_day_num, 23, 59, 59)

    # Get only classes from active academic year and semester
    class_filter = {}
    if active_context:
        class_filter['academic_year_id'] = active_context.get('academic_year_id')
        class_filter['semester_id'] = active_context.get('semester_id')

    # Get active classes to filter students
    active_classes = await db.classes.find(class_filter, {'_id': 0, 'id': 1}).to_list(500)
    active_class_ids = [c['id'] for c in active_classes]

    logger.info(f"[ATTENDANCE] Active class IDs: {len(active_class_ids)} classes")
    logger.info(f"[ATTENDANCE] Filter: academic_year={active_context.get('academic_year_id') if active_context else 'None'}, semester={active_context.get('semester_id') if active_context else 'None'}")

    # Get students only from active classes
    all_students = await db.users.find(
        {
            'roles': 'siswa',
            'student_class_id': {'$in': active_class_ids}
        },
        {'_id': 0, 'id': 1, 'student_class_id': 1}
    ).to_list(5000)
    all_student_ids = [s['id'] for s in all_students]

    logger.info(f"[ATTENDANCE] Active students: {len(all_student_ids)} students in active classes")

    # Get attendance records for active students in the month
    attendance_records = await db.attendances.find({
        'student_id': {'$in': all_student_ids},
        'created_at': {
            '$gte': first_day.isoformat(),
            '$lte': last_day.isoformat()
        }
    }, {'_id': 0}).to_list(50000)

    logger.info(f"[ATTENDANCE] Attendance records: {len(attendance_records)} records for the month")

    # IMPORTANT: Convert all created_at to timezone-naive datetime objects NOW
    # This prevents timezone comparison errors later
    for record in attendance_records:
        created_at = record.get('created_at')
        if created_at:
            if isinstance(created_at, str):
                # Parse string to datetime and make it naive
                try:
                    dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    # Create new naive datetime from components
                    record['created_at'] = datetime(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second, dt.microsecond)
                except:
                    # If parsing fails, try without timezone
                    try:
                        record['created_at'] = datetime.fromisoformat(created_at)
                    except:
                        pass
            elif isinstance(created_at, datetime):
                # Already a datetime, create new naive datetime from components
                record['created_at'] = datetime(
                    created_at.year, created_at.month, created_at.day,
                    created_at.hour, created_at.minute, created_at.second,
                    created_at.microsecond
                )

    # Calculate monthly stats
    monthly_total = len(attendance_records)
    monthly_hadir = sum(1 for a in attendance_records if a.get('status') == 'hadir')
    monthly_sakit = sum(1 for a in attendance_records if a.get('status') == 'sakit')
    monthly_izin = sum(1 for a in attendance_records if a.get('status') == 'izin')
    monthly_alpa = sum(1 for a in attendance_records if a.get('status') in ['alpa', 'alpha'])
    monthly_percentage = (monthly_hadir / monthly_total * 100) if monthly_total > 0 else 0

    # Calculate weekly stats (last 7 days)
    # Make week_ago timezone-naive for comparison
    now_naive = datetime(now.year, now.month, now.day, now.hour, now.minute, now.second, now.microsecond)
    week_ago_naive = now_naive - timedelta(days=7)
    weekly_records = []
    for a in attendance_records:
        try:
            created_at = a.get('created_at')
            # created_at is already timezone-naive from preprocessing above
            if created_at and isinstance(created_at, datetime):
                if created_at >= week_ago_naive:
                    weekly_records.append(a)
        except (ValueError, AttributeError, TypeError) as e:
            logger.error(f"[ATTENDANCE] Error comparing created_at: {created_at}, type: {type(created_at)}, error: {e}")
            continue
    weekly_total = len(weekly_records)
    weekly_hadir = sum(1 for a in weekly_records if a.get('status') == 'hadir')
    weekly_sakit = sum(1 for a in weekly_records if a.get('status') == 'sakit')
    weekly_izin = sum(1 for a in weekly_records if a.get('status') == 'izin')
    weekly_alpa = sum(1 for a in weekly_records if a.get('status') in ['alpa', 'alpha'])
    weekly_percentage = (weekly_hadir / weekly_total * 100) if weekly_total > 0 else 0

    # Calculate daily stats (today)
    # Use the same now_naive we created for weekly stats
    today_start = datetime(now_naive.year, now_naive.month, now_naive.day)
    today_end = datetime(now_naive.year, now_naive.month, now_naive.day, 23, 59, 59)
    daily_records = []
    for a in attendance_records:
        try:
            created_at = a.get('created_at')
            # created_at is already timezone-naive from preprocessing above
            if created_at and isinstance(created_at, datetime):
                if today_start <= created_at <= today_end:
                    daily_records.append(a)
        except (ValueError, AttributeError, TypeError) as e:
            logger.error(f"[ATTENDANCE] Error comparing created_at: {created_at}, type: {type(created_at)}, error: {e}")
            continue
    daily_total = len(daily_records)
    daily_hadir = sum(1 for a in daily_records if a.get('status') == 'hadir')
    daily_sakit = sum(1 for a in daily_records if a.get('status') == 'sakit')
    daily_izin = sum(1 for a in daily_records if a.get('status') == 'izin')
    daily_alpa = sum(1 for a in daily_records if a.get('status') in ['alpa', 'alpha'])
    daily_percentage = (daily_hadir / daily_total * 100) if daily_total > 0 else 0

    # Use the same class_filter we created above for active classes
    # Fetch both tingkat and grade_level to see which one exists
    all_classes = await db.classes.find(class_filter, {'_id': 0, 'id': 1, 'name': 1, 'tingkat': 1, 'grade_level': 1}).to_list(500)

    # DEBUG: Log class data
    logger.info(f"[ATTENDANCE] Total classes found: {len(all_classes)}")
    if all_classes:
        logger.info(f"[ATTENDANCE] Sample class data (full): {all_classes[0]}")
        tingkat_sample = [cls.get('tingkat') for cls in all_classes[:5]]
        grade_level_sample = [cls.get('grade_level') for cls in all_classes[:5]]
        logger.info(f"[ATTENDANCE] Sample tingkat values: {tingkat_sample}")
        logger.info(f"[ATTENDANCE] Sample grade_level values: {grade_level_sample}")

    # Build breakdown by tingkat
    tingkat_levels = {}
    for cls in all_classes:
        # Try to get tingkat from field, or extract from class name
        tingkat = cls.get('tingkat') or cls.get('grade_level')

        # If still None, try to extract from class name (e.g., "7A" -> 7)
        if not tingkat:
            class_name = cls.get('name', '')
            # Extract first digit from class name
            import re
            match = re.match(r'^(\d+)', class_name)
            if match:
                tingkat = int(match.group(1))
            else:
                tingkat = 'Unknown'

        logger.debug(f"[ATTENDANCE] Class {cls.get('name')}: tingkat={tingkat}")
        if tingkat not in tingkat_levels:
            tingkat_levels[tingkat] = {
                'tingkat': tingkat,  # Hanya angka tingkat (7, 8, 9)
                'class_count': 0,  # Jumlah kelas di tingkat ini
                'classes': [],
                'total': 0,
                'hadir': 0,
                'sakit': 0,
                'izin': 0,
                'alpa': 0
            }

        # Increment class count for this tingkat
        tingkat_levels[tingkat]['class_count'] += 1

        # Get students in this class
        class_students = [s['id'] for s in all_students if s.get('student_class_id') == cls['id']]
        class_records = [r for r in attendance_records if r.get('student_id') in class_students]

        # Count by status
        class_total = len(class_records)
        class_hadir = sum(1 for r in class_records if r.get('status') == 'hadir')
        class_sakit = sum(1 for r in class_records if r.get('status') == 'sakit')
        class_izin = sum(1 for r in class_records if r.get('status') == 'izin')
        class_alpa = sum(1 for r in class_records if r.get('status') in ['alpa', 'alpha'])
        class_percentage = (class_hadir / class_total * 100) if class_total > 0 else 0

        tingkat_levels[tingkat]['classes'].append({
            'class_id': cls['id'],
            'class_name': cls['name'],
            'total': class_total,
            'hadir': class_hadir,
            'sakit': class_sakit,
            'izin': class_izin,
            'alpa': class_alpa,
            'percentage': round(class_percentage, 2)
        })

        # Accumulate for tingkat
        tingkat_levels[tingkat]['total'] += class_total
        tingkat_levels[tingkat]['hadir'] += class_hadir
        tingkat_levels[tingkat]['sakit'] += class_sakit
        tingkat_levels[tingkat]['izin'] += class_izin
        tingkat_levels[tingkat]['alpa'] += class_alpa

    # Calculate percentages for tingkat levels
    for tingkat in tingkat_levels.values():
        tingkat['percentage'] = (tingkat['hadir'] / tingkat['total'] * 100) if tingkat['total'] > 0 else 0
        tingkat['percentage'] = round(tingkat['percentage'], 2)

    return {
        'month': target_month,
        'year': target_year,
        'monthly': {
            'total': monthly_total,
            'hadir': monthly_hadir,
            'sakit': monthly_sakit,
            'izin': monthly_izin,
            'alpa': monthly_alpa,
            'percentage': round(monthly_percentage, 2)
        },
        'weekly': {
            'total': weekly_total,
            'hadir': weekly_hadir,
            'sakit': weekly_sakit,
            'izin': weekly_izin,
            'alpa': weekly_alpa,
            'percentage': round(weekly_percentage, 2)
        },
        'daily': {
            'total': daily_total,
            'hadir': daily_hadir,
            'sakit': daily_sakit,
            'izin': daily_izin,
            'alpa': daily_alpa,
            'percentage': round(daily_percentage, 2)
        },
        'by_grade': list(tingkat_levels.values())
    }
