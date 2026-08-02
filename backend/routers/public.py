"""Public endpoints (no auth): monitoring + holidays today."""
from typing import Optional

from fastapi import APIRouter

from core import db, get_active_academic_year, get_settings, serialize_doc
from journal_core import current_day_id, now_wib

router = APIRouter()


@router.get("/public/monitoring")
async def public_monitoring(day: Optional[str] = None):
    ay = await db.academic_years.find_one({'is_active': True}, {'_id': 0})
    if not ay:
        return {'time': now_wib().isoformat(), 'day': current_day_id(), 'classes': [], 'active_year': None,
                'stats': {'total': 0, 'filled': 0, 'pending': 0, 'missing': 0, 'upcoming': 0}}

    current_day = day or current_day_id()
    schedules = await db.schedules.find({
        'academic_year_id': ay['id'], 'day': current_day,
    }, {'_id': 0}).sort('start_time', 1).to_list(2000)

    now = now_wib()
    items = []
    for s in schedules:
        cls = await db.classes.find_one({'id': s.get('class_id')}, {'_id': 0, 'name': 1})
        sub = await db.subjects.find_one({'id': s.get('subject_id')}, {'_id': 0, 'name': 1})
        room = await db.rooms.find_one({'id': s.get('room_id')}, {'_id': 0, 'name': 1})
        teacher = await db.users.find_one({'id': s.get('teacher_id')}, {'_id': 0, 'full_name': 1})
        journal = await db.journals.find_one({'schedule_id': s['id']}, {'_id': 0, 'id': 1, 'materi': 1, 'started_at': 1})
        try:
            sh, sm = map(int, s['start_time'].split(':'))
            eh, em = map(int, s['end_time'].split(':'))
            start_dt = now.replace(hour=sh, minute=sm, second=0, microsecond=0)
            end_dt = now.replace(hour=eh, minute=em, second=0, microsecond=0)
        except Exception:
            continue
        if now < start_dt:
            status_label = 'upcoming'
        elif start_dt <= now <= end_dt:
            status_label = 'active'
        else:
            status_label = 'past'
        if journal:
            jurnal_status = 'filled'
        elif status_label == 'past':
            jurnal_status = 'missing'
        elif status_label == 'active':
            jurnal_status = 'pending'
        else:
            jurnal_status = 'not_started'
        items.append({
            'schedule_id': s['id'],
            'class_name': cls.get('name') if cls else '-',
            'subject_name': sub.get('name') if sub else '-',
            'teacher_name': teacher.get('full_name') if teacher else '-',
            'room_name': room.get('name') if room else '-',
            'start_time': s['start_time'], 'end_time': s['end_time'],
            'status': status_label, 'jurnal_status': jurnal_status,
            'jurnal_materi': journal.get('materi') if journal else None,
            'jurnal_filled_at': journal.get('started_at') if journal else None,
        })

    settings = await get_settings()
    return {
        'time': now.isoformat(), 'day': current_day,
        'academic_year': ay.get('name'),
        'school_name': settings.get('school_name'),
        'app_name': settings.get('app_name'),
        'logo_url': settings.get('logo_url'),
        'classes': items,
        'stats': {
            'total': len(items),
            'filled': len([i for i in items if i['jurnal_status'] == 'filled']),
            'pending': len([i for i in items if i['jurnal_status'] == 'pending']),
            'missing': len([i for i in items if i['jurnal_status'] == 'missing']),
            'upcoming': len([i for i in items if i['jurnal_status'] == 'not_started']),
        }
    }


@router.get("/public/holidays/today")
async def public_holidays_today():
    """Endpoint publik: cek apakah hari ini libur (info-only)."""
    today = now_wib().strftime('%Y-%m-%d')
    day_name = current_day_id()
    weekly = await db.weekly_holidays.find_one({'day': day_name, 'is_active': True}, {'_id': 0})
    academic = await db.academic_holidays.find_one({'date': today}, {'_id': 0})
    return {
        'date': today,
        'day': day_name,
        'is_weekly_holiday': bool(weekly),
        'weekly_holiday': serialize_doc(weekly) if weekly else None,
        'is_academic_holiday': bool(academic),
        'academic_holiday': serialize_doc(academic) if academic else None,
    }


@router.get("/public/achievements")
async def public_achievements(
    year: Optional[int] = None,
    level: Optional[str] = None,
    holder_type: Optional[str] = None,
    limit: int = 100
):
    """Endpoint publik: prestasi madrasah yang telah diverifikasi."""
    q = {'is_verified': True}

    if year:
        q['year'] = year
    if level:
        q['level'] = level
    if holder_type:
        q['holder_type'] = holder_type

    # Get achievements
    achievements = await db.achievements.find(
        q, {'_id': 0}
    ).sort([('year', -1), ('date', -1)]).limit(limit).to_list(limit)

    # Enrich with student/teacher/extracurricular names
    for a in achievements:
        if a.get('student_id'):
            student = await db.students.find_one({'id': a['student_id']}, {'_id': 0, 'full_name': 1, 'nisn': 1})
            if student:
                a['student_name'] = student.get('full_name')
                a['student_nisn'] = student.get('nisn')

        if a.get('teacher_id'):
            teacher = await db.users.find_one({'id': a['teacher_id']}, {'_id': 0, 'full_name': 1})
            if teacher:
                a['teacher_name'] = teacher.get('full_name')

        if a.get('extracurricular_id'):
            ekskul = await db.extracurriculars.find_one({'id': a['extracurricular_id']}, {'_id': 0, 'name': 1})
            if ekskul:
                a['extracurricular_name'] = ekskul.get('name')

    # Get stats
    stats = {
        'total': await db.achievements.count_documents({'is_verified': True}),
        'by_level': {},
        'by_holder_type': {},
        'by_year': {}
    }

    levels = ['Kabupaten/Kota', 'Provinsi', 'Nasional', 'Internasional']
    for lvl in levels:
        stats['by_level'][lvl] = await db.achievements.count_documents({'is_verified': True, 'level': lvl})

    holder_types = ['siswa', 'guru', 'tendik', 'madrasah']
    for ht in holder_types:
        stats['by_holder_type'][ht] = await db.achievements.count_documents({'is_verified': True, 'holder_type': ht})

    # Get recent years
    pipeline = [
        {'$match': {'is_verified': True}},
        {'$group': {'_id': '$year', 'count': {'$sum': 1}}},
        {'$sort': {'_id': -1}},
        {'$limit': 5}
    ]
    year_stats = await db.achievements.aggregate(pipeline).to_list(5)
    for ys in year_stats:
        stats['by_year'][ys['_id']] = ys['count']

    settings = await get_settings()

    return {
        'achievements': achievements,
        'stats': stats,
        'school_name': settings.get('school_name'),
        'app_name': settings.get('app_name'),
        'logo_url': settings.get('logo_url'),
    }


@router.get("/public/agenda")
async def public_agenda(
    year: Optional[int] = None,
    month: Optional[int] = None,
    date: Optional[str] = None,
    page: int = 1,
    per_page: int = 10
):
    """Endpoint publik: agenda kegiatan madrasah dan pegawai."""
    from datetime import datetime as dt
    import calendar

    # Determine date range
    if date:
        # Specific date for staff events
        from_date = date
        to_date = date
    elif year and month:
        # Specific month
        from_date = f"{year}-{month:02d}-01"
        last_day = calendar.monthrange(year, month)[1]
        to_date = f"{year}-{month:02d}-{last_day}"
    elif year:
        # Whole year
        from_date = f"{year}-01-01"
        to_date = f"{year}-12-31"
    else:
        # Default: current month
        now = dt.now()
        from_date = f"{now.year}-{now.month:02d}-01"
        last_day = calendar.monthrange(now.year, now.month)[1]
        to_date = f"{now.year}-{now.month:02d}-{last_day}"

    # Get madrasah events
    events_q = {
        'is_active': True,
        'date': {'$gte': from_date, '$lte': to_date}
    }

    total_events = await db.madrasah_events.count_documents(events_q)
    skip = (page - 1) * per_page

    madrasah_events = await db.madrasah_events.find(
        events_q, {'_id': 0}
    ).sort('date', 1).sort('start_time', 1).skip(skip).limit(per_page).to_list(per_page)

    # Get staff events for specific date or date range - ONLY PUBLIC
    staff_events_q = {
        'is_active': True,
        'is_public': True,  # Only show public events
        'date': {'$gte': from_date, '$lte': to_date}
    }

    staff_events = await db.staff_events.find(
        staff_events_q, {'_id': 0}
    ).sort('date', 1).sort('start_time', 1).to_list(1000)

    # Enrich staff events with user info
    now_wib_dt = now_wib()
    for se in staff_events:
        if se.get('user_id'):
            user = await db.users.find_one({'id': se['user_id']}, {'_id': 0, 'full_name': 1, 'nip': 1, 'roles': 1})
            if user:
                se['user_name'] = user.get('full_name')
                se['nip'] = user.get('nip')
                # Get jabatan from roles
                roles = user.get('roles', [])
                # Find first jabatan role
                from models import ROLE_LABELS
                jabatan = None
                for role in roles:
                    if role != 'admin' and role != 'siswa':
                        jabatan = ROLE_LABELS.get(role, role)
                        break
                se['jabatan'] = jabatan or '-'

        # Determine status based on date and time
        event_date = se.get('date', '')
        start_time = se.get('start_time', '00:00')
        end_time = se.get('end_time', '23:59')

        try:
            event_dt_start = dt.fromisoformat(f"{event_date}T{start_time}:00")
            event_dt_end = dt.fromisoformat(f"{event_date}T{end_time}:00")

            if now_wib_dt < event_dt_start:
                se['computed_status'] = 'upcoming'
            elif event_dt_start <= now_wib_dt <= event_dt_end:
                se['computed_status'] = 'ongoing'
            else:
                se['computed_status'] = 'completed'
        except Exception:
            se['computed_status'] = 'upcoming'

    settings = await get_settings()

    return {
        'madrasah_events': madrasah_events,
        'staff_events': staff_events,
        'pagination': {
            'page': page,
            'per_page': per_page,
            'total': total_events,
            'total_pages': (total_events + per_page - 1) // per_page
        },
        'date_range': {
            'from': from_date,
            'to': to_date
        },
        'school_name': settings.get('school_name'),
        'app_name': settings.get('app_name'),
        'logo_url': settings.get('logo_url'),
    }
