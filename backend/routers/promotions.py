"""Promotions - Naik kelas, pindah semester, dan kelulusan siswa."""
from datetime import datetime
from typing import Dict, List
from fastapi import APIRouter, Depends, HTTPException, Request

from core import db, get_current_user, require_role, serialize_doc, log_audit
from models import PromotionRequest, ClassHistoryModel

router = APIRouter()


@router.post("/promotions/naik-kelas")
async def promote_class(
    payload: PromotionRequest,
    request: Request,
    user: Dict = Depends(require_role('admin'))
):
    """
    Naik kelas: pindahkan siswa ke kelas berikutnya di TP baru.
    - Copy siswa dengan ID tetap
    - Update student_class_id ke kelas baru
    - Catat riwayat di class_history
    - Tutup riwayat kelas lama dengan end_date
    """
    if payload.type != 'naik_kelas':
        raise HTTPException(400, "Type harus 'naik_kelas'")

    if not payload.to_class_id or not payload.to_academic_year_id:
        raise HTTPException(400, "to_class_id dan to_academic_year_id wajib diisi")

    # Validate target class exists
    target_class = await db.classes.find_one({'id': payload.to_class_id})
    if not target_class:
        raise HTTPException(404, "Kelas tujuan tidak ditemukan")

    target_ay = await db.academic_years.find_one({'id': payload.to_academic_year_id})
    if not target_ay:
        raise HTTPException(404, "Tahun pelajaran tujuan tidak ditemukan")

    success_count = 0
    errors = []
    today = datetime.utcnow().strftime('%Y-%m-%d')

    for student_id in payload.student_ids:
        try:
            student = await db.users.find_one({'id': student_id, 'siswa': {'$in': ['roles']}})
            if not student:
                errors.append(f"Siswa {student_id}: tidak ditemukan")
                continue

            old_class_id = student.get('student_class_id')

            # Close old class history (set end_date)
            if old_class_id:
                await db.class_history.update_many(
                    {'student_id': student_id, 'class_id': old_class_id, 'end_date': None},
                    {'$set': {'end_date': today}}
                )

            # Update student to new class
            await db.users.update_one(
                {'id': student_id},
                {'$set': {
                    'student_class_id': payload.to_class_id,
                    'graduation_status': 'aktif'
                }}
            )

            # Create new class history record
            history = ClassHistoryModel(
                student_id=student_id,
                class_id=payload.to_class_id,
                academic_year_id=payload.to_academic_year_id,
                semester=payload.to_semester or 'Ganjil',
                reason='naik_kelas',
                start_date=today,
                notes=payload.notes,
                created_by_user_id=user['id']
            )
            doc = history.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.class_history.insert_one(doc)

            success_count += 1

        except Exception as e:
            errors.append(f"Siswa {student_id}: {str(e)}")

    await log_audit(
        user, 'naik_kelas', 'promotion',
        payload.to_class_id,
        details={'success': success_count, 'failed': len(errors), 'to_class': target_class.get('name')},
        request=request
    )

    return {
        'message': f'Berhasil menaikkan {success_count} siswa',
        'success_count': success_count,
        'failed_count': len(errors),
        'errors': errors
    }


@router.post("/promotions/pindah-semester")
async def move_semester(
    payload: PromotionRequest,
    request: Request,
    user: Dict = Depends(require_role('admin'))
):
    """
    Pindah semester: untuk kelas accelerated yang pindah semester dalam 1 TP.
    Mirip naik kelas tapi masih di TP yang sama, hanya ganti semester.
    """
    if payload.type != 'pindah_semester':
        raise HTTPException(400, "Type harus 'pindah_semester'")

    if not payload.to_semester:
        raise HTTPException(400, "to_semester wajib diisi")

    # Get current active AY
    active_ay = await db.academic_years.find_one({'is_active': True})
    if not active_ay:
        raise HTTPException(404, "Tidak ada tahun pelajaran aktif")

    to_ay_id = payload.to_academic_year_id or active_ay['id']

    success_count = 0
    errors = []
    today = datetime.utcnow().strftime('%Y-%m-%d')

    for student_id in payload.student_ids:
        try:
            student = await db.users.find_one({'id': student_id, 'siswa': {'$in': ['roles']}})
            if not student:
                errors.append(f"Siswa {student_id}: tidak ditemukan")
                continue

            # Close current semester history
            current_class_id = student.get('student_class_id')
            if current_class_id:
                await db.class_history.update_many(
                    {'student_id': student_id, 'class_id': current_class_id, 'end_date': None},
                    {'$set': {'end_date': today}}
                )

            # If changing class too
            if payload.to_class_id and payload.to_class_id != current_class_id:
                await db.users.update_one(
                    {'id': student_id},
                    {'$set': {'student_class_id': payload.to_class_id}}
                )
                current_class_id = payload.to_class_id

            # Create new semester history
            history = ClassHistoryModel(
                student_id=student_id,
                class_id=current_class_id,
                academic_year_id=to_ay_id,
                semester=payload.to_semester,
                reason='pindah_semester',
                start_date=today,
                notes=payload.notes,
                created_by_user_id=user['id']
            )
            doc = history.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.class_history.insert_one(doc)

            success_count += 1

        except Exception as e:
            errors.append(f"Siswa {student_id}: {str(e)}")

    await log_audit(
        user, 'pindah_semester', 'promotion',
        to_ay_id,
        details={'success': success_count, 'failed': len(errors), 'to_semester': payload.to_semester},
        request=request
    )

    return {
        'message': f'Berhasil memindahkan {success_count} siswa ke semester {payload.to_semester}',
        'success_count': success_count,
        'failed_count': len(errors),
        'errors': errors
    }


@router.post("/promotions/lulus")
async def graduate_students(
    payload: PromotionRequest,
    request: Request,
    user: Dict = Depends(require_role('admin'))
):
    """
    Kelulusan: tandai siswa sebagai lulus.
    - Set graduation_status = 'lulus'
    - Set graduation_date, graduation_ay_id, graduation_class_id
    - Generate certificate number if prefix provided
    - Close class history with reason='lulus'
    - Student masih tersimpan di database sebagai alumni
    """
    if payload.type != 'lulus':
        raise HTTPException(400, "Type harus 'lulus'")

    if not payload.graduation_date:
        raise HTTPException(400, "graduation_date wajib diisi")

    # Get current active AY
    active_ay = await db.academic_years.find_one({'is_active': True})
    if not active_ay:
        raise HTTPException(404, "Tidak ada tahun pelajaran aktif")

    success_count = 0
    errors = []
    today = datetime.utcnow().strftime('%Y-%m-%d')

    # For certificate numbering
    cert_counter = 1

    for student_id in payload.student_ids:
        try:
            student = await db.users.find_one({'id': student_id, 'siswa': {'$in': ['roles']}})
            if not student:
                errors.append(f"Siswa {student_id}: tidak ditemukan")
                continue

            current_class_id = student.get('student_class_id')
            if not current_class_id:
                errors.append(f"Siswa {student_id}: tidak memiliki kelas aktif")
                continue

            # Generate certificate number if prefix provided
            cert_number = None
            if payload.certificate_number_prefix:
                cert_number = f"{payload.certificate_number_prefix}/{cert_counter:04d}"
                cert_counter += 1

            # Close current class history with reason=lulus
            await db.class_history.update_many(
                {'student_id': student_id, 'end_date': None},
                {'$set': {'end_date': payload.graduation_date}}
            )

            # Create final graduation history record
            history = ClassHistoryModel(
                student_id=student_id,
                class_id=current_class_id,
                academic_year_id=active_ay['id'],
                semester=active_ay.get('active_semester', 'Genap'),
                reason='lulus',
                start_date=payload.graduation_date,
                end_date=payload.graduation_date,
                notes=payload.notes or 'Lulus',
                created_by_user_id=user['id']
            )
            doc = history.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.class_history.insert_one(doc)

            # Update student to graduated status
            await db.users.update_one(
                {'id': student_id},
                {'$set': {
                    'graduation_status': 'lulus',
                    'graduation_date': payload.graduation_date,
                    'graduation_ay_id': active_ay['id'],
                    'graduation_class_id': current_class_id,
                    'graduation_certificate_number': cert_number,
                    'student_class_id': None,  # Remove from active class
                    'is_active': True  # Keep account active for alumni access
                }}
            )

            success_count += 1

        except Exception as e:
            errors.append(f"Siswa {student_id}: {str(e)}")

    await log_audit(
        user, 'lulus', 'promotion',
        active_ay['id'],
        details={'success': success_count, 'failed': len(errors), 'graduation_date': payload.graduation_date},
        request=request
    )

    return {
        'message': f'Berhasil meluluskan {success_count} siswa',
        'success_count': success_count,
        'failed_count': len(errors),
        'errors': errors
    }


@router.get("/promotions/preview")
async def preview_promotion(
    from_class_id: str,
    type: str,
    user: Dict = Depends(require_role('admin'))
):
    """
    Preview siswa yang akan diproses untuk naik kelas/semester/lulus.
    Returns list of students in the source class.
    """
    if type not in ['naik_kelas', 'pindah_semester', 'lulus']:
        raise HTTPException(400, "Type tidak valid")

    # Get students in the class
    students = await db.users.find(
        {'student_class_id': from_class_id, 'siswa': {'$in': ['roles']}, 'is_active': True},
        {'_id': 0, 'password_hash': 0}
    ).to_list(500)

    # Get class info
    cls = await db.classes.find_one({'id': from_class_id}, {'_id': 0})

    return {
        'class': serialize_doc(cls) if cls else None,
        'student_count': len(students),
        'students': [serialize_doc(s) for s in students]
    }


@router.get("/promotions/history")
async def promotion_history(
    student_id: str = None,
    user: Dict = Depends(require_role('admin'))
):
    """Get promotion history for a student or all students."""
    query = {}
    if student_id:
        query['student_id'] = student_id

    history = await db.class_history.find(
        query,
        {'_id': 0}
    ).sort('created_at', -1).to_list(1000)

    # Enrich with class and AY names
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

        if h.get('student_id'):
            student = await db.users.find_one({'id': h['student_id']}, {'_id': 0, 'password_hash': 0})
            if student:
                h['student_name'] = student.get('full_name')
                h['student_nisn'] = student.get('nisn')

    return [serialize_doc(h) for h in history]
