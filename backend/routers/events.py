"""Events router - Madrasah events and staff events management."""
from typing import Dict, Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request

from core import db, get_current_user, log_audit, require_role, serialize_doc
from journal_core import now_wib
from models import MadrasahEventModel, StaffEventModel

router = APIRouter()


# ============================================================
# MADRASAH EVENTS (Admin + Waka Humas)
# ============================================================
@router.get("/madrasah-events")
async def list_madrasah_events(
    year: Optional[int] = None,
    month: Optional[int] = None,
    is_active: Optional[bool] = None,
    user: Dict = Depends(require_role('admin', 'waka_humas', 'kepala_sekolah', 'unit_pelayanan'))
):
    """List madrasah events - accessible by admin, waka humas, kepala sekolah, and unit pelayanan."""
    q = {}

    if is_active is not None:
        q['is_active'] = is_active

    # Filter by year/month if provided
    if year and month:
        import calendar
        from_date = f"{year}-{month:02d}-01"
        last_day = calendar.monthrange(year, month)[1]
        to_date = f"{year}-{month:02d}-{last_day}"
        q['date'] = {'$gte': from_date, '$lte': to_date}
    elif year:
        q['date'] = {'$gte': f"{year}-01-01", '$lte': f"{year}-12-31"}

    items = await db.madrasah_events.find(q, {'_id': 0}).sort('date', -1).sort('start_time', 1).to_list(1000)

    # Enrich with creator name
    for item in items:
        if item.get('created_by'):
            creator = await db.users.find_one({'id': item['created_by']}, {'_id': 0, 'full_name': 1})
            if creator:
                item['created_by_name'] = creator.get('full_name')

    return [serialize_doc(i) for i in items]


@router.post("/madrasah-events")
async def create_madrasah_event(
    payload: Dict,
    request: Request,
    user: Dict = Depends(require_role('admin', 'waka_humas', 'kepala_sekolah', 'unit_pelayanan'))
):
    """Create madrasah event - accessible by admin, waka humas, kepala sekolah, and unit pelayanan."""
    if not payload.get('name') or not payload.get('date') or not payload.get('location'):
        raise HTTPException(400, "Nama, tanggal, dan tempat wajib diisi")

    if not payload.get('start_time') or not payload.get('end_time'):
        raise HTTPException(400, "Waktu mulai dan selesai wajib diisi")

    event = MadrasahEventModel(
        name=payload['name'],
        description=payload.get('description'),
        date=payload['date'],
        end_date=payload.get('end_date'),
        start_time=payload['start_time'],
        end_time=payload['end_time'],
        location=payload['location'],
        participants_count=int(payload.get('participants_count', 0)),
        academic_year_id=payload.get('academic_year_id'),
        created_by=user['id']
    )

    doc = event.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()

    await db.madrasah_events.insert_one(doc)
    await log_audit(user, 'create', 'madrasah_event', event.id, details={'name': event.name, 'date': event.date}, request=request)

    return serialize_doc(doc)


@router.put("/madrasah-events/{event_id}")
async def update_madrasah_event(
    event_id: str,
    payload: Dict,
    request: Request,
    user: Dict = Depends(require_role('admin', 'waka_humas', 'kepala_sekolah', 'unit_pelayanan'))
):
    """Update madrasah event - accessible by admin, waka humas, kepala sekolah, and unit pelayanan."""
    existing = await db.madrasah_events.find_one({'id': event_id})
    if not existing:
        raise HTTPException(404, "Event tidak ditemukan")

    # Remove fields that shouldn't be updated
    payload.pop('id', None)
    payload.pop('_id', None)
    payload.pop('created_at', None)
    payload.pop('created_by', None)

    await db.madrasah_events.update_one({'id': event_id}, {'$set': payload})
    await log_audit(user, 'update', 'madrasah_event', event_id, request=request)

    doc = await db.madrasah_events.find_one({'id': event_id}, {'_id': 0})
    return serialize_doc(doc)


@router.delete("/madrasah-events/{event_id}")
async def delete_madrasah_event(
    event_id: str,
    request: Request,
    user: Dict = Depends(require_role('admin'))
):
    """Delete madrasah event - only admin can delete."""
    result = await db.madrasah_events.delete_one({'id': event_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Event tidak ditemukan")

    await log_audit(user, 'delete', 'madrasah_event', event_id, request=request)
    return {'message': 'Event berhasil dihapus'}


# ============================================================
# STAFF EVENTS (Admin can see all, Guru/Tendik can see/manage own)
# ============================================================
@router.get("/staff-events")
async def list_staff_events(
    year: Optional[int] = None,
    month: Optional[int] = None,
    date: Optional[str] = None,
    user_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    is_public: Optional[bool] = None,
    user: Dict = Depends(get_current_user)
):
    """List staff events - admin can see all, others see only their own."""
    q = {}

    # Admin and unit_pelayanan can filter by user_id, others only see their own
    is_admin = 'admin' in user.get('roles', [])
    is_unit_pelayanan = 'unit_pelayanan' in user.get('roles', [])
    if user_id and (is_admin or is_unit_pelayanan):
        q['user_id'] = user_id
    elif not (is_admin or is_unit_pelayanan):
        q['user_id'] = user['id']

    if is_active is not None:
        q['is_active'] = is_active

    if is_public is not None:
        q['is_public'] = is_public

    # Filter by date
    if date:
        q['date'] = date
    elif year and month:
        import calendar
        from_date = f"{year}-{month:02d}-01"
        last_day = calendar.monthrange(year, month)[1]
        to_date = f"{year}-{month:02d}-{last_day}"
        q['date'] = {'$gte': from_date, '$lte': to_date}
    elif year:
        q['date'] = {'$gte': f"{year}-01-01", '$lte': f"{year}-12-31"}

    items = await db.staff_events.find(q, {'_id': 0}).sort('date', -1).sort('start_time', 1).to_list(1000)

    # Enrich with user info
    for item in items:
        if item.get('user_id'):
            staff = await db.users.find_one({'id': item['user_id']}, {'_id': 0, 'full_name': 1, 'nip': 1})
            if staff:
                item['user_name'] = staff.get('full_name')
                item['nip'] = staff.get('nip')

        if item.get('created_by'):
            creator = await db.users.find_one({'id': item['created_by']}, {'_id': 0, 'full_name': 1})
            if creator:
                item['created_by_name'] = creator.get('full_name')

    return [serialize_doc(i) for i in items]


@router.post("/staff-events")
async def create_staff_event(
    payload: Dict,
    request: Request,
    user: Dict = Depends(get_current_user)
):
    """Create staff event - guru/tendik create for themselves, admin can create for anyone."""
    if not payload.get('event_name') or not payload.get('date'):
        raise HTTPException(400, "Nama kegiatan dan tanggal wajib diisi")

    if not payload.get('start_time') or not payload.get('end_time'):
        raise HTTPException(400, "Waktu mulai dan selesai wajib diisi")

    # Determine user_id
    is_admin = 'admin' in user.get('roles', [])
    is_unit_pelayanan = 'unit_pelayanan' in user.get('roles', [])
    if (is_admin or is_unit_pelayanan) and payload.get('user_id'):
        user_id = payload['user_id']
    else:
        user_id = user['id']

    # Validate user exists and is guru/tendik
    target_user = await db.users.find_one({'id': user_id}, {'_id': 0, 'roles': 1})
    if not target_user:
        raise HTTPException(404, "User tidak ditemukan")

    roles = target_user.get('roles', [])
    if not any(r in roles for r in ['guru', 'tenaga_kependidikan', 'admin']):
        raise HTTPException(400, "Kegiatan pegawai hanya untuk guru dan tenaga kependidikan")

    event = StaffEventModel(
        user_id=user_id,
        event_name=payload['event_name'],
        description=payload.get('description'),
        date=payload['date'],
        end_date=payload.get('end_date'),
        start_time=payload['start_time'],
        end_time=payload['end_time'],
        location=payload.get('location'),
        category=payload.get('category'),
        priority=payload.get('priority'),
        status=payload.get('status', 'pending'),
        is_public=payload.get('is_public', True),  # Default true
        academic_year_id=payload.get('academic_year_id'),
        created_by=user['id']
    )

    doc = event.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()

    await db.staff_events.insert_one(doc)
    await log_audit(user, 'create', 'staff_event', event.id, details={'event_name': event.event_name, 'user_id': user_id}, request=request)

    return serialize_doc(doc)


@router.put("/staff-events/{event_id}")
async def update_staff_event(
    event_id: str,
    payload: Dict,
    request: Request,
    user: Dict = Depends(get_current_user)
):
    """Update staff event - can only update own events unless admin."""
    existing = await db.staff_events.find_one({'id': event_id})
    if not existing:
        raise HTTPException(404, "Event tidak ditemukan")

    # Check permission
    is_admin = 'admin' in user.get('roles', [])
    is_unit_pelayanan = 'unit_pelayanan' in user.get('roles', [])
    if not (is_admin or is_unit_pelayanan) and existing.get('user_id') != user['id']:
        raise HTTPException(403, "Anda hanya dapat mengubah kegiatan Anda sendiri")

    # Remove fields that shouldn't be updated
    payload.pop('id', None)
    payload.pop('_id', None)
    payload.pop('created_at', None)
    payload.pop('created_by', None)
    payload.pop('user_id', None)  # Can't change user_id

    await db.staff_events.update_one({'id': event_id}, {'$set': payload})
    await log_audit(user, 'update', 'staff_event', event_id, request=request)

    doc = await db.staff_events.find_one({'id': event_id}, {'_id': 0})
    return serialize_doc(doc)


@router.delete("/staff-events/{event_id}")
async def delete_staff_event(
    event_id: str,
    request: Request,
    user: Dict = Depends(get_current_user)
):
    """Delete staff event - only admin can delete."""
    existing = await db.staff_events.find_one({'id': event_id})
    if not existing:
        raise HTTPException(404, "Event tidak ditemukan")

    # Check permission - only admin can delete
    is_admin = 'admin' in user.get('roles', [])
    if not is_admin:
        raise HTTPException(403, "Hanya admin yang dapat menghapus agenda GTK")

    result = await db.staff_events.delete_one({'id': event_id})
    await log_audit(user, 'delete', 'staff_event', event_id, request=request)

    return {'message': 'Event berhasil dihapus'}


# ============================================================
# EVENT STATISTICS
# ============================================================
@router.get("/staff-events/stats/duration")
async def get_staff_events_duration_stats(
    user_id: Optional[str] = None,
    user: Dict = Depends(get_current_user)
):
    """Get duration statistics for staff events - average duration in days and hours."""
    q = {}

    # Admin and unit_pelayanan can filter by user_id, others only see their own
    is_admin = 'admin' in user.get('roles', [])
    is_unit_pelayanan = 'unit_pelayanan' in user.get('roles', [])
    if user_id and (is_admin or is_unit_pelayanan):
        q['user_id'] = user_id
    elif not (is_admin or is_unit_pelayanan):
        q['user_id'] = user['id']

    # Get all events
    events = await db.staff_events.find(q, {'_id': 0, 'date': 1, 'end_date': 1, 'start_time': 1, 'end_time': 1}).to_list(10000)

    if not events:
        return {
            'total_events': 0,
            'avg_duration_days': 0,
            'avg_duration_hours': 0,
            'total_duration_days': 0,
            'multi_day_count': 0,
            'single_day_count': 0
        }

    total_duration_days = 0
    total_duration_hours = 0
    multi_day_count = 0
    single_day_count = 0

    for event in events:
        start_date_str = event.get('date')
        end_date_str = event.get('end_date')
        start_time_str = event.get('start_time', '00:00')
        end_time_str = event.get('end_time', '23:59')

        if not start_date_str:
            continue

        try:
            # Parse dates
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date() if end_date_str else start_date

            # Calculate day duration
            day_duration = (end_date - start_date).days + 1  # +1 to include both start and end day
            total_duration_days += day_duration

            if day_duration > 1:
                multi_day_count += 1
            else:
                single_day_count += 1

            # Calculate hour duration for single-day events
            if day_duration == 1:
                try:
                    start_time = datetime.strptime(start_time_str, '%H:%M').time()
                    end_time = datetime.strptime(end_time_str, '%H:%M').time()

                    start_datetime = datetime.combine(start_date, start_time)
                    end_datetime = datetime.combine(start_date, end_time)

                    hour_duration = (end_datetime - start_datetime).total_seconds() / 3600
                    total_duration_hours += hour_duration
                except:
                    pass
        except:
            continue

    total_events = len(events)
    avg_duration_days = total_duration_days / total_events if total_events > 0 else 0
    avg_duration_hours = total_duration_hours / single_day_count if single_day_count > 0 else 0

    return {
        'total_events': total_events,
        'avg_duration_days': round(avg_duration_days, 1),
        'avg_duration_hours': round(avg_duration_hours, 1),
        'total_duration_days': total_duration_days,
        'multi_day_count': multi_day_count,
        'single_day_count': single_day_count
    }
