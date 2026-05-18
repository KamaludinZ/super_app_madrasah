"""Alumni management - menampung data siswa yang sudah lulus."""
from typing import Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from core import db, get_current_user, require_role, serialize_doc, log_audit

router = APIRouter()


@router.get("/alumni")
async def list_alumni(
    academic_year_id: Optional[str] = Query(None),
    grade: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    user: Dict = Depends(require_role('admin'))
):
    """List all alumni (graduated students) with optional filters."""
    query = {'graduation_status': 'lulus', 'is_active': True}

    if academic_year_id:
        query['graduation_ay_id'] = academic_year_id

    if search:
        # Search by name, NISN, or NIS
        query['$or'] = [
            {'full_name': {'$regex': search, '$options': 'i'}},
            {'nisn': {'$regex': search, '$options': 'i'}},
            {'nis': {'$regex': search, '$options': 'i'}},
        ]

    items = await db.users.find(query, {'_id': 0, 'password_hash': 0}).sort('graduation_date', -1).to_list(1000)

    # Enrich with class history and graduation class info
    for item in items:
        if item.get('graduation_class_id'):
            cls = await db.classes.find_one({'id': item['graduation_class_id']}, {'_id': 0})
            if cls:
                item['graduation_class_name'] = cls.get('name')
                item['graduation_grade'] = cls.get('grade')

        # Get full class history
        history = await db.class_history.find(
            {'student_id': item['id']},
            {'_id': 0}
        ).sort('created_at', 1).to_list(100)
        item['class_history'] = [serialize_doc(h) for h in history]

    return [serialize_doc(i) for i in items]


@router.get("/alumni/stats")
async def alumni_stats(user: Dict = Depends(require_role('admin'))):
    """Get alumni statistics by graduation year and grade."""
    pipeline = [
        {'$match': {'graduation_status': 'lulus', 'is_active': True}},
        {'$group': {
            '_id': {
                'ay_id': '$graduation_ay_id',
                'class_id': '$graduation_class_id'
            },
            'count': {'$sum': 1}
        }}
    ]

    results = await db.users.aggregate(pipeline).to_list(1000)

    # Enrich with AY and class names
    stats = []
    for r in results:
        ay_id = r['_id'].get('ay_id')
        class_id = r['_id'].get('class_id')

        ay_name = None
        class_name = None
        grade = None

        if ay_id:
            ay = await db.academic_years.find_one({'id': ay_id}, {'_id': 0})
            if ay:
                ay_name = ay.get('name')

        if class_id:
            cls = await db.classes.find_one({'id': class_id}, {'_id': 0})
            if cls:
                class_name = cls.get('name')
                grade = cls.get('grade')

        stats.append({
            'academic_year_id': ay_id,
            'academic_year_name': ay_name,
            'class_id': class_id,
            'class_name': class_name,
            'grade': grade,
            'count': r['count']
        })

    return stats


@router.get("/alumni/{student_id}")
async def get_alumni_detail(
    student_id: str,
    user: Dict = Depends(require_role('admin'))
):
    """Get detailed info for one alumni."""
    student = await db.users.find_one(
        {'id': student_id, 'graduation_status': 'lulus'},
        {'_id': 0, 'password_hash': 0}
    )

    if not student:
        raise HTTPException(404, "Alumni tidak ditemukan")

    # Get class history
    history = await db.class_history.find(
        {'student_id': student_id},
        {'_id': 0}
    ).sort('created_at', 1).to_list(100)

    # Enrich history with class names
    for h in history:
        if h.get('class_id'):
            cls = await db.classes.find_one({'id': h['class_id']}, {'_id': 0})
            if cls:
                h['class_name'] = cls.get('name')
                h['grade'] = cls.get('grade')
        if h.get('academic_year_id'):
            ay = await db.academic_years.find_one({'id': h['academic_year_id']}, {'_id': 0})
            if ay:
                h['academic_year_name'] = ay.get('name')

    student['class_history'] = [serialize_doc(h) for h in history]

    # Get student details if exists
    details = await db.student_details.find_one({'student_id': student_id}, {'_id': 0})
    if details:
        student['details'] = serialize_doc(details)

    return serialize_doc(student)


@router.put("/alumni/{student_id}")
async def update_alumni(
    student_id: str,
    payload: Dict,
    request: Request,
    user: Dict = Depends(require_role('admin'))
):
    """Update alumni data (e.g., certificate number, contact info)."""
    existing = await db.users.find_one({'id': student_id, 'graduation_status': 'lulus'})
    if not existing:
        raise HTTPException(404, "Alumni tidak ditemukan")

    # Only allow updating specific fields
    allowed_fields = [
        'graduation_certificate_number', 'email', 'phone', 'address',
        'photo_url', 'graduation_date', 'full_name'
    ]

    update_data = {k: v for k, v in payload.items() if k in allowed_fields}

    if not update_data:
        raise HTTPException(400, "Tidak ada field yang bisa diupdate")

    await db.users.update_one({'id': student_id}, {'$set': update_data})
    await log_audit(user, 'update', 'alumni', student_id, details=update_data, request=request)

    updated = await db.users.find_one({'id': student_id}, {'_id': 0, 'password_hash': 0})
    return serialize_doc(updated)


@router.get("/alumni/export/excel")
async def export_alumni_excel(
    academic_year_id: Optional[str] = Query(None),
    user: Dict = Depends(require_role('admin'))
):
    """Export alumni data to Excel."""
    # TODO: Implement Excel export
    raise HTTPException(501, "Fitur export Excel belum diimplementasikan")
