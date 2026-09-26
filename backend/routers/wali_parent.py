"""Wali Kelas dashboard + Parent endpoints."""
from typing import Dict, Optional
from datetime import datetime, timedelta
import calendar
import logging

from fastapi import APIRouter, Depends

from core import (
    db,
    get_active_academic_year,
    get_current_user,
    require_role,
    serialize_doc,
)
from journal_core import current_day_id, now_wib

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/wali-kelas/my-class")
async def wali_kelas_dashboard(user: Dict = Depends(get_current_user)):
    cls = await db.classes.find_one({'homeroom_teacher_id': user['id']}, {'_id': 0})
    if not cls:
        return {'class': None, 'today_schedule': [], 'students': []}
    day = current_day_id()
    ay = await get_active_academic_year()
    schedules = await db.schedules.find({
        'class_id': cls['id'], 'day': day,
        'academic_year_id': ay['id'] if ay else None,
    }, {'_id': 0}).sort('start_time', 1).to_list(50)
    enriched = []
    for s in schedules:
        sub = await db.subjects.find_one({'id': s.get('subject_id')}, {'_id': 0, 'name': 1})
        teacher = await db.users.find_one({'id': s.get('teacher_id')}, {'_id': 0, 'full_name': 1})
        room = await db.rooms.find_one({'id': s.get('room_id')}, {'_id': 0, 'name': 1})
        journal = await db.journals.find_one({'schedule_id': s['id']}, {'_id': 0, 'id': 1, 'materi': 1})
        s['subject_name'] = sub.get('name') if sub else None
        s['teacher_name'] = teacher.get('full_name') if teacher else None
        s['room_name'] = room.get('name') if room else None
        s['journal_filled'] = bool(journal)
        s['journal_materi'] = journal.get('materi') if journal else None
        enriched.append(serialize_doc(s))
    students = await db.users.find({'student_class_id': cls['id'], 'roles': 'siswa'},
                                   {'_id': 0, 'password_hash': 0}).to_list(200)
    return {
        'class': serialize_doc(cls),
        'today_schedule': enriched,
        'students': [serialize_doc(s) for s in students],
    }


@router.get("/wali-kelas/dashboard-stats")
async def wali_kelas_dashboard_stats(user: Dict = Depends(get_current_user)):
    """Get comprehensive dashboard statistics for wali kelas."""
    # Get the class this user manages
    cls = await db.classes.find_one({'homeroom_teacher_id': user['id']}, {'_id': 0})
    if not cls:
        return {
            'attendance': None,
            'students': None,
            'achievements': None,
            'discipline': None,
        }

    ay = await get_active_academic_year()
    class_id = cls['id']

    # Get all students in this class
    students = await db.users.find(
        {'student_class_id': class_id, 'roles': 'siswa'},
        {'_id': 0}
    ).to_list(200)
    student_ids = [s['id'] for s in students]
    total_students = len(students)

    # 1. ATTENDANCE STATISTICS
    # Get attendance records for the current month
    today = datetime.now()
    month_pattern = today.strftime('%Y-%m')  # e.g., "2026-09"

    logger.info(f"[DASHBOARD-STATS] Class: {class_id}, Month pattern: {month_pattern}")
    logger.debug(f"[DASHBOARD-STATS] Student IDs count: {len(student_ids)}")

    # Use 'attendances' collection (with 's') and 'created_at' field - same as attendance-report endpoint
    attendance_records = await db.attendances.find({
        'student_id': {'$in': student_ids},
        'created_at': {
            '$regex': f'^{month_pattern}-',
            '$options': 'i'
        }
    }, {'_id': 0}).to_list(10000)

    logger.info(f"[DASHBOARD-STATS] Total attendance records found: {len(attendance_records)}")
    if attendance_records:
        logger.debug(f"[DASHBOARD-STATS] Sample record: {attendance_records[0]}")

    # Calculate attendance percentage
    total_records = len(attendance_records)
    present_records = len([r for r in attendance_records if r.get('status') == 'hadir'])
    attendance_percentage = (present_records / total_records * 100) if total_records > 0 else 0

    logger.info(f"[DASHBOARD-STATS] Present: {present_records}, Total: {total_records}, Percentage: {attendance_percentage}%")

    # 2. STUDENT DATA COMPLETENESS
    # Check required fields for completeness
    required_fields = ['nisn', 'nik', 'tempat_lahir', 'tanggal_lahir', 'jenis_kelamin', 'alamat']
    complete_students = 0
    for s in students:
        is_complete = all(s.get(field) for field in required_fields)
        if is_complete:
            complete_students += 1

    data_completeness = (complete_students / total_students * 100) if total_students > 0 else 0

    # 3. ACHIEVEMENTS STATISTICS
    # Get achievements grouped by level
    achievements = await db.achievements.find({
        'student_id': {'$in': student_ids}
    }, {'_id': 0}).to_list(1000)

    achievement_by_level = {
        'sekolah': 0,
        'kecamatan': 0,
        'kabupaten': 0,
        'provinsi': 0,
        'nasional': 0,
        'internasional': 0,
    }

    for ach in achievements:
        level = ach.get('level', '').lower()
        if level in achievement_by_level:
            achievement_by_level[level] += 1

    total_achievements = sum(achievement_by_level.values())

    # 4. DISCIPLINE (TATA TERTIB) STATISTICS
    # Get discipline records
    discipline_records = await db.tatib_data.find({
        'student_id': {'$in': student_ids}
    }, {'_id': 0}).to_list(1000)

    total_violation_points = 0
    total_achievement_points = 0

    for record in discipline_records:
        kategori = await db.tatib_kategori.find_one(
            {'id': record.get('kategori_id')},
            {'_id': 0, 'jenis': 1, 'poin': 1}
        )
        if kategori:
            poin = kategori.get('poin', 0)
            if kategori.get('jenis') == 'pelanggaran':
                total_violation_points += poin
            elif kategori.get('jenis') == 'prestasi':
                total_achievement_points += poin

    return {
        'attendance': {
            'total_records': total_records,
            'present_records': present_records,
            'percentage': round(attendance_percentage, 1),
        },
        'students': {
            'total': total_students,
            'complete': complete_students,
            'completeness_percentage': round(data_completeness, 1),
        },
        'achievements': {
            'by_level': achievement_by_level,
            'total': total_achievements,
        },
        'discipline': {
            'violation_points': total_violation_points,
            'achievement_points': total_achievement_points,
            'total_records': len(discipline_records),
        },
    }


@router.get("/wali-kelas/attendance-report")
async def wali_kelas_attendance_report(
    class_id: str,
    month: str,
    user: Dict = Depends(get_current_user)
):
    """Get monthly attendance report for a class.

    Returns summary of attendance (H, S, I, A) for each student in the specified month.
    """
    # Verify user is homeroom teacher of this class
    cls = await db.classes.find_one({'id': class_id, 'homeroom_teacher_id': user['id']}, {'_id': 0})
    if not cls:
        return []

    # Get all students in this class
    students = await db.users.find(
        {'student_class_id': class_id, 'roles': 'siswa'},
        {'_id': 0, 'id': 1, 'full_name': 1, 'nisn': 1}
    ).to_list(200)

    # Parse month (format: YYYY-MM)
    year, mon = month.split('-')
    start_date = f"{year}-{mon}-01"

    # Calculate end date (last day of month)
    import calendar
    last_day = calendar.monthrange(int(year), int(mon))[1]
    end_date = f"{year}-{mon}-{last_day:02d}"

    # Get all attendance records for this month
    # Use regex to match dates starting with the month, regardless of timezone format
    student_ids = [s['id'] for s in students]
    attendance_records = await db.attendances.find({
        'student_id': {'$in': student_ids},
        'created_at': {
            '$regex': f'^{year}-{mon}-',
            '$options': 'i'
        }
    }, {'_id': 0}).to_list(10000)

    logger.info(f"[WALI-KELAS-ATTENDANCE] Class: {class_id}, Month: {month}")
    logger.info(f"[WALI-KELAS-ATTENDANCE] Students count: {len(students)}, Attendance records: {len(attendance_records)}")
    if attendance_records:
        logger.debug(f"[WALI-KELAS-ATTENDANCE] Sample attendance record: {attendance_records[0]}")

    # Build report for each student
    report = []
    for student in students:
        student_id = student['id']

        # Filter records for this student
        student_records = [r for r in attendance_records if r.get('student_id') == student_id]

        # Count attendance status
        hadir = sum(1 for r in student_records if r.get('status') == 'hadir')
        sakit = sum(1 for r in student_records if r.get('status') == 'sakit')
        izin = sum(1 for r in student_records if r.get('status') == 'izin')
        alpa = sum(1 for r in student_records if r.get('status') in ['alpa', 'alpha'])

        if len(student_records) > 0:
            logger.debug(f"[WALI-KELAS-ATTENDANCE] {student['full_name']}: H={hadir}, S={sakit}, I={izin}, A={alpa}, Total={len(student_records)}")

        report.append({
            'student_id': student_id,
            'student_name': student['full_name'],
            'nisn': student.get('nisn'),
            'hadir': hadir,
            'sakit': sakit,
            'izin': izin,
            'alpa': alpa,
        })

    # Sort by student name
    report.sort(key=lambda x: x['student_name'])

    return report


@router.get("/wali-kelas/attendance-details")
async def wali_kelas_attendance_details(
    student_id: str,
    month: str,
    user: Dict = Depends(get_current_user)
):
    """Get detailed daily attendance records for a specific student in a month."""
    # Verify student is in homeroom teacher's class
    student = await db.users.find_one({'id': student_id}, {'_id': 0, 'student_class_id': 1})
    if not student:
        return {'daily_records': []}

    cls = await db.classes.find_one({
        'id': student.get('student_class_id'),
        'homeroom_teacher_id': user['id']
    }, {'_id': 0})

    if not cls:
        return {'daily_records': []}

    # Parse month (format: YYYY-MM)
    year, mon = month.split('-')
    start_date = f"{year}-{mon}-01"

    # Calculate end date (last day of month)
    import calendar
    last_day = calendar.monthrange(int(year), int(mon))[1]
    end_date = f"{year}-{mon}-{last_day:02d}"

    # Get all attendance records for this student in this month
    attendance_records = await db.attendances.find({
        'student_id': student_id,
        'created_at': {'$gte': f"{start_date}T00:00:00", '$lte': f"{end_date}T23:59:59"}
    }, {'_id': 0}).sort('created_at', 1).to_list(500)

    # Get journal IDs to fetch subject and teacher info
    journal_ids = list(set([r.get('journal_id') for r in attendance_records if r.get('journal_id')]))
    journals = await db.journals.find({'id': {'$in': journal_ids}}, {'_id': 0, 'id': 1, 'subject_id': 1, 'teacher_id': 1}).to_list(500) if journal_ids else []
    journal_map = {j['id']: j for j in journals}

    # Get subjects and teachers
    subject_ids = list(set([j.get('subject_id') for j in journals if j.get('subject_id')]))
    teacher_ids = list(set([j.get('teacher_id') for j in journals if j.get('teacher_id')]))

    subjects = await db.subjects.find({'id': {'$in': subject_ids}}, {'_id': 0, 'id': 1, 'name': 1}).to_list(200) if subject_ids else []
    teachers = await db.users.find({'id': {'$in': teacher_ids}}, {'_id': 0, 'id': 1, 'full_name': 1}).to_list(100) if teacher_ids else []

    subject_map = {s['id']: s for s in subjects}
    teacher_map = {t['id']: t for t in teachers}

    # Build daily records with enriched data
    daily_records = []
    for record in attendance_records:
        journal_id = record.get('journal_id')
        subject = None
        teacher = None

        if journal_id and journal_id in journal_map:
            journal = journal_map[journal_id]
            subject_id = journal.get('subject_id')
            teacher_id = journal.get('teacher_id')

            if subject_id and subject_id in subject_map:
                subject = subject_map[subject_id].get('name')

            if teacher_id and teacher_id in teacher_map:
                teacher = teacher_map[teacher_id].get('full_name')

        daily_records.append({
            'date': record.get('created_at'),
            'status': record.get('status', 'hadir'),
            'subject': subject,
            'teacher': teacher,
        })

    return {'daily_records': daily_records}


@router.get("/wali-kelas/cleanliness-report")
async def wali_kelas_cleanliness_report(
    class_id: str,
    month: str,
    user: Dict = Depends(get_current_user)
):
    """Get monthly cleanliness report for a class.

    Returns daily cleanliness ratings for the specified month.
    """
    # Verify user is homeroom teacher of this class
    cls = await db.classes.find_one({'id': class_id, 'homeroom_teacher_id': user['id']}, {'_id': 0})
    if not cls:
        return []

    # Parse month (format: YYYY-MM)
    year, mon = month.split('-')
    start_date = f"{year}-{mon}-01"

    # Calculate end date (last day of month)
    import calendar
    last_day = calendar.monthrange(int(year), int(mon))[1]
    end_date = f"{year}-{mon}-{last_day:02d}"

    # Get all cleanliness records for this month
    cleanliness_records = await db.class_cleanliness.find({
        'class_id': class_id,
        'date': {'$gte': start_date, '$lte': end_date}
    }, {'_id': 0}).sort('date', 1).to_list(100)

    # Build report with assessor info
    report = []
    for record in cleanliness_records:
        # Get assessor (teacher) info
        assessor = await db.users.find_one(
            {'id': record.get('recorded_by')},
            {'_id': 0, 'full_name': 1}
        )

        report.append({
            'date': record['date'],
            'rating': record.get('rating', 0),
            'condition': record.get('condition', ''),
            'assessor_name': assessor.get('full_name') if assessor else 'Unknown',
            'notes': record.get('notes', ''),
        })

    return report


@router.get("/wali-kelas/cleanliness-details")
async def wali_kelas_cleanliness_details(
    class_id: str,
    date: str,
    user: Dict = Depends(get_current_user)
):
    """Get detailed cleanliness record for a specific date."""
    # Verify user is homeroom teacher of this class
    cls = await db.classes.find_one({'id': class_id, 'homeroom_teacher_id': user['id']}, {'_id': 0})
    if not cls:
        return {}

    # Get cleanliness record for this specific date
    record = await db.class_cleanliness.find_one({
        'class_id': class_id,
        'date': date
    }, {'_id': 0})

    if not record:
        return {}

    # Get assessor (teacher) info
    assessor = await db.users.find_one(
        {'id': record.get('recorded_by')},
        {'_id': 0, 'full_name': 1}
    )

    # Get piket students info
    piket_student_ids = record.get('piket_student_ids', [])
    piket_students = []

    if piket_student_ids:
        students = await db.users.find(
            {'id': {'$in': piket_student_ids}},
            {'_id': 0, 'full_name': 1}
        ).to_list(100)
        piket_students = [s.get('full_name') for s in students]

    return {
        'date': record['date'],
        'rating': record.get('rating', 0),
        'condition': record.get('condition', ''),
        'assessor_name': assessor.get('full_name') if assessor else 'Unknown',
        'assessed_at': record.get('recorded_at', ''),
        'notes': record.get('notes', ''),
        'piket_students': piket_students,
    }


@router.get("/parent/children")
async def parent_children(user: Dict = Depends(get_current_user)):
    if 'orang_tua' not in user.get('roles', []):
        return []
    ids = user.get('parent_of', [])
    if not ids:
        return []
    items = await db.users.find({'id': {'$in': ids}}, {'_id': 0, 'password_hash': 0}).to_list(20)
    return [serialize_doc(i) for i in items]


@router.get("/wali-kelas/class-attendance")
async def get_class_attendance(
    user: Dict = Depends(require_role('wali_kelas')),
    month: Optional[int] = None,
    year: Optional[int] = None
):
    """Get attendance records for wali kelas's class.

    Returns all attendance records for students in the wali kelas's class
    for the specified month, with per-student breakdowns.
    """
    # Get the class this user manages
    cls = await db.classes.find_one({'homeroom_teacher_id': user['id']}, {'_id': 0})
    if not cls:
        return {
            'class': None,
            'month': month,
            'year': year,
            'students': []
        }

    # Default to current month/year if not provided
    now = now_wib()
    target_month = month if month else now.month
    target_year = year if year else now.year

    # Get first and last day of the month
    first_day = datetime(target_year, target_month, 1)
    last_day_num = calendar.monthrange(target_year, target_month)[1]
    last_day = datetime(target_year, target_month, last_day_num, 23, 59, 59)

    # Get all students in this class
    students = await db.users.find(
        {'student_class_id': cls['id'], 'roles': 'siswa'},
        {'_id': 0, 'id': 1, 'full_name': 1, 'nisn': 1}
    ).sort('full_name', 1).to_list(200)

    # Get all attendance records for this class in the month
    student_ids = [s['id'] for s in students]
    attendance_records = await db.attendances.find({
        'student_id': {'$in': student_ids},
        'created_at': {
            '$gte': first_day.isoformat(),
            '$lte': last_day.isoformat()
        }
    }, {'_id': 0}).to_list(10000)

    # Build per-student summary
    student_summaries = []
    for student in students:
        student_id = student['id']

        # Get all records for this student
        student_records = [r for r in attendance_records if r.get('student_id') == student_id]

        # Count by status
        total = len(student_records)
        hadir = sum(1 for r in student_records if r.get('status') == 'hadir')
        sakit = sum(1 for r in student_records if r.get('status') == 'sakit')
        izin = sum(1 for r in student_records if r.get('status') == 'izin')
        alpa = sum(1 for r in student_records if r.get('status') == 'alpa')

        percentage = (hadir / total * 100) if total > 0 else 0

        # Get detailed records with enriched info
        detailed_records = []
        for att in student_records:
            journal = await db.journals.find_one(
                {'id': att.get('journal_id')},
                {'_id': 0, 'started_at': 1, 'subject_id': 1, 'teacher_id': 1}
            )

            if journal:
                subject = await db.subjects.find_one(
                    {'id': journal.get('subject_id')},
                    {'_id': 0, 'name': 1, 'code': 1}
                )

                teacher = await db.users.find_one(
                    {'id': journal.get('teacher_id')},
                    {'_id': 0, 'full_name': 1}
                )

                detailed_records.append({
                    'id': att.get('id'),
                    'date': journal.get('started_at'),
                    'status': att.get('status'),
                    'subject_name': subject.get('name') if subject else None,
                    'subject_code': subject.get('code') if subject else None,
                    'teacher_name': teacher.get('full_name') if teacher else None,
                })

        student_summaries.append({
            'student_id': student_id,
            'student_name': student['full_name'],
            'nisn': student.get('nisn'),
            'summary': {
                'total': total,
                'hadir': hadir,
                'sakit': sakit,
                'izin': izin,
                'alpa': alpa,
                'percentage': round(percentage, 2)
            },
            'records': detailed_records
        })

    return {
        'class': serialize_doc(cls),
        'month': target_month,
        'year': target_year,
        'students': student_summaries
    }


@router.get("/wali-kelas/class-attendance/stats")
async def get_class_attendance_stats(
    user: Dict = Depends(require_role('wali_kelas')),
    month: Optional[int] = None,
    year: Optional[int] = None
):
    """Get attendance statistics for wali kelas's class (daily, weekly, monthly).

    Returns comprehensive statistics including:
    - Overall class statistics (monthly)
    - Weekly trends (last 7 days)
    - Daily statistics (today)
    - Per-student summary
    """
    # Get the class this user manages
    cls = await db.classes.find_one({'homeroom_teacher_id': user['id']}, {'_id': 0})
    if not cls:
        return {
            'class': None,
            'monthly': None,
            'weekly': None,
            'daily': None,
            'students': []
        }

    # Default to current month/year if not provided
    now = now_wib()
    target_month = month if month else now.month
    target_year = year if year else now.year

    # Get first and last day of the month (timezone-aware)
    from zoneinfo import ZoneInfo
    tz = ZoneInfo('Asia/Jakarta')
    first_day = datetime(target_year, target_month, 1, tzinfo=tz)
    last_day_num = calendar.monthrange(target_year, target_month)[1]
    last_day = datetime(target_year, target_month, last_day_num, 23, 59, 59, tzinfo=tz)

    # Get all students in this class
    students = await db.users.find(
        {'student_class_id': cls['id'], 'roles': 'siswa'},
        {'_id': 0, 'id': 1, 'full_name': 1, 'nisn': 1}
    ).to_list(200)
    student_ids = [s['id'] for s in students]

    # Get all attendance records for this class in the month
    attendance_records = await db.attendances.find({
        'student_id': {'$in': student_ids},
        'created_at': {
            '$gte': first_day.isoformat(),
            '$lte': last_day.isoformat()
        }
    }, {'_id': 0}).to_list(10000)

    # Calculate monthly stats (handle both 'alpa' and 'alpha')
    total = len(attendance_records)
    hadir = sum(1 for a in attendance_records if a.get('status') == 'hadir')
    sakit = sum(1 for a in attendance_records if a.get('status') == 'sakit')
    izin = sum(1 for a in attendance_records if a.get('status') == 'izin')
    alpa = sum(1 for a in attendance_records if a.get('status') in ['alpa', 'alpha'])

    monthly_percentage = (hadir / total * 100) if total > 0 else 0

    # Calculate weekly stats (last 7 days)
    week_ago = now - timedelta(days=7)
    weekly_records = [a for a in attendance_records
                     if datetime.fromisoformat(a.get('created_at')) >= week_ago]
    weekly_total = len(weekly_records)
    weekly_hadir = sum(1 for a in weekly_records if a.get('status') == 'hadir')
    weekly_sakit = sum(1 for a in weekly_records if a.get('status') == 'sakit')
    weekly_izin = sum(1 for a in weekly_records if a.get('status') == 'izin')
    weekly_alpa = sum(1 for a in weekly_records if a.get('status') in ['alpa', 'alpha'])
    weekly_percentage = (weekly_hadir / weekly_total * 100) if weekly_total > 0 else 0

    # Calculate daily stats (today - timezone-aware)
    today_start = datetime(now.year, now.month, now.day, tzinfo=tz)
    today_end = datetime(now.year, now.month, now.day, 23, 59, 59, tzinfo=tz)
    daily_records = [a for a in attendance_records
                    if today_start <= datetime.fromisoformat(a.get('created_at')) <= today_end]
    daily_total = len(daily_records)
    daily_hadir = sum(1 for a in daily_records if a.get('status') == 'hadir')
    daily_sakit = sum(1 for a in daily_records if a.get('status') == 'sakit')
    daily_izin = sum(1 for a in daily_records if a.get('status') == 'izin')
    daily_alpa = sum(1 for a in daily_records if a.get('status') in ['alpa', 'alpha'])
    daily_percentage = (daily_hadir / daily_total * 100) if daily_total > 0 else 0

    # Calculate per-student summary
    student_summaries = []
    for student in students:
        student_id = student['id']
        student_records = [r for r in attendance_records if r.get('student_id') == student_id]

        s_total = len(student_records)
        s_hadir = sum(1 for r in student_records if r.get('status') == 'hadir')
        s_sakit = sum(1 for r in student_records if r.get('status') == 'sakit')
        s_izin = sum(1 for r in student_records if r.get('status') == 'izin')
        s_alpa = sum(1 for r in student_records if r.get('status') in ['alpa', 'alpha'])
        s_percentage = (s_hadir / s_total * 100) if s_total > 0 else 0

        student_summaries.append({
            'student_id': student_id,
            'student_name': student['full_name'],
            'nisn': student.get('nisn'),
            'total': s_total,
            'hadir': s_hadir,
            'sakit': s_sakit,
            'izin': s_izin,
            'alpa': s_alpa,
            'percentage': round(s_percentage, 2)
        })

    # Sort by percentage (lowest first to highlight students needing attention)
    student_summaries.sort(key=lambda x: x['percentage'])

    return {
        'class': serialize_doc(cls),
        'month': target_month,
        'year': target_year,
        'monthly': {
            'total': total,
            'hadir': hadir,
            'sakit': sakit,
            'izin': izin,
            'alpa': alpa,
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
        'students': student_summaries
    }
