"""
Student Master Records (Buku Induk Siswa) - Router
Mengelola data lengkap buku induk siswa sesuai standar Kemenag.
"""
from datetime import datetime
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from core import db, get_current_user, require_role, serialize_doc, log_audit
from models import StudentMasterRecordModel

router = APIRouter()


@router.get("/student-records")
async def list_student_records(
    search: Optional[str] = Query(None),
    class_id: Optional[str] = Query(None),
    academic_year: Optional[str] = Query(None),
    status: Optional[str] = Query('active'),  # 'active' | 'graduated' | 'mutated' | 'all'
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    user: Dict = Depends(require_role('admin'))
):
    """
    List buku induk siswa dengan filter.

    Params:
    - search: cari berdasarkan nama, NIS, NISN, NIK
    - class_id: filter berdasarkan kelas saat ini
    - academic_year: filter berdasarkan TP masuk
    - status: active (masih aktif), graduated (lulus), mutated (mutasi keluar), all
    """
    # Build query for students
    student_query = {}

    if status == 'active':
        student_query['is_active'] = True
        student_query['graduation_status'] = {'$in': [None, 'aktif']}
    elif status == 'graduated':
        student_query['graduation_status'] = 'lulus'
    elif status == 'mutated':
        student_query['graduation_status'] = 'mutasi_keluar'

    if search:
        student_query['$or'] = [
            {'full_name': {'$regex': search, '$options': 'i'}},
            {'nisn': {'$regex': search, '$options': 'i'}},
            {'nis': {'$regex': search, '$options': 'i'}},
        ]

    if class_id:
        student_query['student_class_id'] = class_id

    # Get students matching criteria
    students = await db.users.find(
        {'roles': {'$in': ['siswa']}, **student_query},
        {'_id': 0, 'password_hash': 0}
    ).skip(offset).limit(limit).to_list(limit)

    # Get master records for these students
    student_ids = [s['id'] for s in students]
    records = await db.student_records.find(
        {'student_id': {'$in': student_ids}},
        {'_id': 0}
    ).to_list(len(student_ids))

    # Map records to students
    records_map = {r['student_id']: r for r in records}

    result = []
    for student in students:
        student_data = serialize_doc(student)
        record = records_map.get(student['id'])

        if record:
            student_data['master_record'] = serialize_doc(record)
        else:
            student_data['master_record'] = None

        # Enrich with class info
        if student.get('student_class_id'):
            cls = await db.classes.find_one({'id': student['student_class_id']}, {'_id': 0})
            if cls:
                student_data['class_name'] = cls.get('name')
                student_data['grade'] = cls.get('grade')

        result.append(student_data)

    # Get total count
    total = await db.users.count_documents({'roles': {'$in': ['siswa']}, **student_query})

    return {
        'items': result,
        'total': total,
        'offset': offset,
        'limit': limit
    }


@router.get("/student-records/{student_id}")
async def get_student_record(
    student_id: str,
    user: Dict = Depends(require_role('admin', 'wali_kelas'))
):
    """Get buku induk siswa lengkap untuk 1 siswa."""
    # Get student
    student = await db.users.find_one(
        {'id': student_id, 'siswa': {'$in': ['roles']}},
        {'_id': 0, 'password_hash': 0}
    )

    if not student:
        raise HTTPException(404, "Siswa tidak ditemukan")

    # Get master record
    record = await db.student_records.find_one({'student_id': student_id}, {'_id': 0})

    # Get class history
    history = await db.class_history.find(
        {'student_id': student_id},
        {'_id': 0}
    ).sort('created_at', 1).to_list(100)

    # Enrich history
    for h in history:
        if h.get('class_id'):
            cls = await db.classes.find_one({'id': h['class_id']}, {'_id': 0})
            if cls:
                h['class_name'] = cls.get('name')
        if h.get('academic_year_id'):
            ay = await db.academic_years.find_one({'id': h['academic_year_id']}, {'_id': 0})
            if ay:
                h['academic_year_name'] = ay.get('name')

    return {
        'student': serialize_doc(student),
        'master_record': serialize_doc(record) if record else None,
        'class_history': [serialize_doc(h) for h in history]
    }


@router.post("/student-records")
async def create_student_record(
    payload: Dict,
    request: Request,
    user: Dict = Depends(require_role('admin'))
):
    """Create atau update buku induk siswa."""
    student_id = payload.get('student_id')

    if not student_id:
        raise HTTPException(400, "student_id wajib diisi")

    # Validate student exists
    student = await db.users.find_one({'id': student_id, 'siswa': {'$in': ['roles']}})
    if not student:
        raise HTTPException(404, "Siswa tidak ditemukan")

    # Check if record already exists
    existing = await db.student_records.find_one({'student_id': student_id})

    if existing:
        # Update
        update_data = {k: v for k, v in payload.items() if k != 'student_id' and v is not None}
        update_data['updated_at'] = datetime.utcnow()
        update_data['updated_by'] = user['id']

        await db.student_records.update_one(
            {'student_id': student_id},
            {'$set': update_data}
        )

        await log_audit(user, 'update', 'student_record', student_id, details=update_data, request=request)

        record = await db.student_records.find_one({'student_id': student_id}, {'_id': 0})
        return serialize_doc(record)
    else:
        # Create new
        from datetime import datetime
        record = StudentMasterRecordModel(**payload)
        record.created_at = datetime.utcnow()
        record.updated_by = user['id']

        doc = record.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        if doc.get('updated_at'):
            doc['updated_at'] = doc['updated_at'].isoformat()

        await db.student_records.insert_one(doc)
        await log_audit(user, 'create', 'student_record', student_id, request=request)

        return serialize_doc(doc)


@router.put("/student-records/{student_id}")
async def update_student_record(
    student_id: str,
    payload: Dict,
    request: Request,
    user: Dict = Depends(require_role('admin'))
):
    """Update buku induk siswa."""
    from datetime import datetime

    existing = await db.student_records.find_one({'student_id': student_id})
    if not existing:
        raise HTTPException(404, "Buku induk siswa belum dibuat")

    update_data = {k: v for k, v in payload.items() if k not in ['id', 'student_id', 'created_at']}
    update_data['updated_at'] = datetime.utcnow()
    update_data['updated_by'] = user['id']

    await db.student_records.update_one(
        {'student_id': student_id},
        {'$set': update_data}
    )

    await log_audit(user, 'update', 'student_record', student_id, details=update_data, request=request)

    record = await db.student_records.find_one({'student_id': student_id}, {'_id': 0})
    return serialize_doc(record)


@router.get("/student-records/{student_id}/export")
async def export_student_record_pdf(
    student_id: str,
    user: Dict = Depends(require_role('admin'))
):
    """Export buku induk siswa ke PDF."""
    # TODO: Implement PDF export
    raise HTTPException(501, "Fitur export PDF belum diimplementasikan")


@router.get("/student-records/export/excel")
async def export_all_records_excel(
    class_id: Optional[str] = Query(None),
    academic_year: Optional[str] = Query(None),
    user: Dict = Depends(require_role('admin'))
):
    """Export semua buku induk siswa ke Excel."""
    # TODO: Implement Excel export
    raise HTTPException(501, "Fitur export Excel belum diimplementasikan")


@router.get("/student-records/stats/summary")
async def get_records_stats(user: Dict = Depends(require_role('admin'))):
    """Get statistik buku induk siswa."""
    # Count total records
    total_students = await db.users.count_documents({'roles': {'$in': ['siswa']}, 'is_active': True})
    total_records = await db.student_records.count_documents({})

    # Count by completion status (approximate based on key fields)
    pipeline = [
        {
            '$project': {
                'student_id': 1,
                'has_basic': {
                    '$and': [
                        {'$ne': ['$full_name', None]},
                        {'$ne': ['$nis', None]},
                        {'$ne': ['$nisn', None]}
                    ]
                },
                'has_family': {
                    '$and': [
                        {'$ne': ['$father_name', None]},
                        {'$ne': ['$mother_name', None]}
                    ]
                },
                'has_address': {'$ne': ['$address', None]},
                'has_admission': {'$ne': ['$admission_date', None]}
            }
        },
        {
            '$group': {
                '_id': None,
                'complete': {
                    '$sum': {
                        '$cond': [
                            {
                                '$and': [
                                    '$has_basic',
                                    '$has_family',
                                    '$has_address',
                                    '$has_admission'
                                ]
                            },
                            1,
                            0
                        ]
                    }
                },
                'partial': {
                    '$sum': {
                        '$cond': [
                            {
                                '$or': [
                                    '$has_basic',
                                    '$has_family',
                                    '$has_address'
                                ]
                            },
                            1,
                            0
                        ]
                    }
                }
            }
        }
    ]

    stats_result = await db.student_records.aggregate(pipeline).to_list(1)
    stats = stats_result[0] if stats_result else {'complete': 0, 'partial': 0}

    return {
        'total_students': total_students,
        'total_records': total_records,
        'complete_records': stats.get('complete', 0),
        'incomplete_records': total_records - stats.get('complete', 0),
        'no_records': total_students - total_records
    }
