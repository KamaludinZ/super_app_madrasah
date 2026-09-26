"""
Kelas Digital Router - Authentication, Materi Mapel, dan Tugas untuk Role Kelas, Siswa, Guru, dan Admin.
"""
import hmac
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from auth_utils import create_access_token, verify_password
from captcha_utils import is_locked, record_login_failure, reset_login_attempts, verify_captcha
from core import (
    db,
    get_current_user,
    log_audit,
    log_security,
    logger,
    serialize_doc,
    get_settings,
)
from models import (
    KelasLoginRequest,
    LoginResponse,
    MateriMapelModel,
    MateriTugasCreateRequest,
    MateriTugasUpdateRequest,
    TugasModel,
    TugasSubmissionModel,
    TugasSubmissionRequest,
)

router = APIRouter(prefix="/kelas", tags=["Kelas Digital"])


# ============================================================
# PUBLIC ENDPOINTS (for login form)
# ============================================================
@router.get("/public/academic-years")
async def get_public_academic_years():
    """Get academic years for kelas login (public endpoint)."""
    items = await db.academic_years.find({}, {'_id': 0}).sort('name', -1).to_list(100)
    return [serialize_doc(i) for i in items]


@router.get("/public/semesters")
async def get_public_semesters():
    """Get semesters for kelas login (public endpoint)."""
    items = await db.semesters.find({}, {'_id': 0}).sort('created_at', -1).to_list(200)
    return [serialize_doc(i) for i in items]


@router.get("/public/classes")
async def get_public_classes():
    """Get classes for kelas login (public endpoint)."""
    items = await db.classes.find({}, {'_id': 0, 'token': 0}).sort('name', 1).to_list(500)
    return [serialize_doc(i) for i in items]


# ============================================================
# AUTHENTICATION - LOGIN KELAS
# ============================================================
@router.post("/auth/login", response_model=LoginResponse)
async def login_kelas(req: KelasLoginRequest, request: Request):
    """Login untuk akun kelas menggunakan tahun pelajaran, semester, nama kelas, dan token."""

    lock_key = f"kelas:{req.academic_year_id}:{req.semester}:{req.class_name.strip().lower()}"
    if await is_locked(lock_key):
        await log_security('locked_attempt', f"kelas_{req.class_name}", request=request)
        raise HTTPException(status_code=423, detail="Terlalu banyak percobaan gagal. Login kelas ini terkunci 15 menit.")

    # Verify captcha
    if not await verify_captcha(req.captcha_id, req.captcha_answer):
        await log_security('captcha_failed', f"kelas_{req.class_name}", request=request)
        raise HTTPException(status_code=400, detail="Kode captcha salah atau kedaluwarsa")

    # Find semester
    semester = await db.semesters.find_one({
        'academic_year_id': req.academic_year_id,
        'code': req.semester
    })
    if not semester:
        raise HTTPException(status_code=404, detail="Semester tidak ditemukan")

    # Find class by name and semester
    kelas = await db.classes.find_one({
        'name': req.class_name,
        'semester_id': semester['id']
    })

    # Verify token (perbandingan waktu-konstan agar token tidak bisa ditebak lewat selisih waktu)
    token_ok = bool(kelas and kelas.get('token')) and hmac.compare_digest(
        str(kelas['token']).encode('utf-8'), str(req.token).encode('utf-8'))
    if not token_ok:
        attempt_info = await record_login_failure(lock_key)
        await log_security('login_failed', f"kelas_{req.class_name}",
                          {'reason': 'class_not_found' if not kelas else 'wrong_token',
                           'attempts': attempt_info.get('attempts', 0)}, request)
        if attempt_info.get('locked'):
            raise HTTPException(status_code=423, detail="Terlalu banyak percobaan gagal. Login kelas ini terkunci 15 menit.")
        raise HTTPException(status_code=401, detail="Kelas tidak ditemukan atau token salah")

    await reset_login_attempts(lock_key)

    # Create token for kelas
    wali_kelas_id_value = kelas.get('homeroom_teacher_id')
    logger.debug(f"[LOGIN] Creating JWT for kelas {kelas['name']}, homeroom_teacher_id from DB: {wali_kelas_id_value}")

    access_token = create_access_token({
        'sub': kelas['id'],
        'username': f"kelas_{kelas['name']}",
        'active_role': 'kelas',
        'class_id': kelas['id'],
        'semester_id': semester['id'],
        'academic_year_id': req.academic_year_id,
        'wali_kelas_id': wali_kelas_id_value,  # Add wali_kelas_id to JWT token
    })

    await log_security('login_success', f"kelas_{kelas['name']}",
                      {'role': 'kelas', 'class_id': kelas['id']}, request)

    # Prepare kelas data
    kelas_clean = serialize_doc(kelas.copy())

    # Get semester and academic year info
    academic_year = await db.academic_years.find_one({'id': req.academic_year_id})

    kelas_info = {
        'id': kelas_clean['id'],
        'name': kelas_clean['name'],
        'grade': kelas_clean.get('grade'),
        'parallel': kelas_clean.get('parallel'),
        'wali_kelas_id': kelas_clean.get('homeroom_teacher_id'),  # Field in DB is homeroom_teacher_id
        'semester_id': semester['id'],
        'semester_name': semester.get('name'),
        'semester_code': semester.get('code'),
        'academic_year_id': req.academic_year_id,
        'academic_year_name': academic_year.get('name') if academic_year else None,
        'roles': ['kelas'],
    }

    settings = await get_settings()
    return LoginResponse(
        access_token=access_token,
        user=kelas_info,
        active_role='kelas',
        expires_in_minutes=settings.get('session_max_hours', 12) * 60,
        idle_timeout_minutes=settings.get('idle_timeout_minutes', 30),
    )


# ============================================================
# DATA SISWA - UNTUK ROLE KELAS
# ============================================================
@router.get("/siswa")
async def get_siswa_kelas(user: Dict = Depends(get_current_user)):
    """Get daftar siswa di kelas (untuk role kelas)."""

    # Only kelas role can access
    if user.get('active_role') != 'kelas':
        raise HTTPException(status_code=403, detail="Hanya akun kelas yang dapat mengakses")

    class_id = user.get('class_id')
    if not class_id:
        raise HTTPException(status_code=400, detail="Class ID tidak ditemukan")

    # Get all students in this class
    students = await db.users.find({
        'student_class_id': class_id,
        'is_active': True
    }).to_list(None)

    # Get class info for absen number (anak_ke in class)
    kelas = await db.classes.find_one({'id': class_id})

    students_data = []
    for idx, student in enumerate(students, 1):
        students_data.append({
            'no_absen': idx,
            'nama': student.get('full_name'),
            'nisn': student.get('nisn'),
            'nis': student.get('nis'),
            'jenis_kelamin': student.get('gender'),
        })

    # Sort by nama
    students_data.sort(key=lambda x: x['nama'])

    # Reassign no_absen after sorting
    for idx, s in enumerate(students_data, 1):
        s['no_absen'] = idx

    return {
        'class_id': class_id,
        'class_name': kelas.get('name') if kelas else None,
        'total_siswa': len(students_data),
        'siswa': students_data,
    }


# ============================================================
# WALI KELAS INFO - UNTUK ROLE KELAS
# ============================================================
@router.get("/wali-kelas")
async def get_wali_kelas_info(user: Dict = Depends(get_current_user)):
    """Get wali kelas information for the class (untuk role kelas)."""

    logger.debug(f"[WALI-KELAS] Endpoint hit! User: {user.get('id')}, Role: {user.get('active_role')}")
    logger.debug(f"[WALI-KELAS] wali_kelas_id: {user.get('wali_kelas_id')}")

    # Only kelas role can access
    if user.get('active_role') != 'kelas':
        logger.warning(f"[WALI-KELAS] Access denied - wrong role: {user.get('active_role')}")
        raise HTTPException(status_code=403, detail="Hanya akun kelas yang dapat mengakses")

    wali_kelas_id = user.get('wali_kelas_id')
    if not wali_kelas_id:
        raise HTTPException(status_code=404, detail="Wali kelas tidak ditemukan")

    # Get wali kelas info
    wali_kelas = await db.users.find_one({'id': wali_kelas_id})
    if not wali_kelas:
        raise HTTPException(status_code=404, detail="Data wali kelas tidak ditemukan")

    return {
        'id': wali_kelas.get('id'),
        'username': wali_kelas.get('username'),
        'full_name': wali_kelas.get('full_name'),
        'nip': wali_kelas.get('nip'),
    }


# ============================================================
# MATERI MAPEL - CRUD
# ============================================================
@router.post("/materi")
async def create_materi(
    req: MateriTugasCreateRequest,
    request: Request,
    user: Dict = Depends(get_current_user)
):
    """Create materi mapel (guru only)."""

    # Only guru can create
    if 'guru' not in user.get('roles', []) and 'admin' not in user.get('roles', []):
        raise HTTPException(status_code=403, detail="Hanya guru yang dapat membuat materi")

    # Get active semester
    semester = await db.semesters.find_one({'is_active': True})
    if not semester:
        raise HTTPException(status_code=400, detail="Tidak ada semester aktif")

    # Create materi
    materi_data = MateriMapelModel(
        judul=req.judul,
        deskripsi=req.deskripsi,
        konten=req.konten,
        file_url=req.file_url,
        target_role=req.target_role,
        target_kelas_ids=req.target_kelas_ids or [],
        target_siswa=req.target_siswa or [],
        teacher_id=user['id'],
        subject_id=req.subject_id,
        semester_id=semester['id'],
        academic_year_id=semester.get('academic_year_id'),
    )

    await db.materi_mapel.insert_one(materi_data.dict())
    await log_audit(user, 'create', 'materi_mapel', materi_data.id, request=request)

    return {'message': 'Materi berhasil dibuat', 'id': materi_data.id}


@router.get("/materi")
async def get_materi_list(
    class_id: Optional[str] = None,
    user: Dict = Depends(get_current_user)
):
    """Get list materi based on user role."""

    active_role = user.get('active_role')

    # Build filter based on role
    filter_query = {'is_active': True}

    if active_role == 'kelas':
        # Role kelas: show materi yang ditujukan untuk kelas ini
        class_id = user.get('class_id')
        filter_query['target_role'] = 'kelas'
        filter_query['target_kelas_ids'] = class_id

    elif active_role == 'siswa':
        # Role siswa: show materi for both kelas and siswa
        student_class_id = user.get('student_class_id')
        student_id = user['id']

        logger.debug(f"[MATERI-SISWA] student_id: {student_id}, student_class_id: {student_class_id}")

        # Fetch materi for kelas OR siswa that includes this student
        materi_list_kelas = []
        materi_list_siswa = []

        if student_class_id:
            materi_list_kelas = await db.materi_mapel.find({
                'is_active': True,
                'target_role': 'kelas',
                'target_kelas_ids': student_class_id
            }).sort('created_at', -1).to_list(None)
            logger.info(f"[MATERI-SISWA] Found {len(materi_list_kelas)} materi for kelas")

        materi_list_siswa = await db.materi_mapel.find({
            'is_active': True,
            'target_role': 'siswa',
            'target_siswa': student_id
        }).sort('created_at', -1).to_list(None)
        logger.info(f"[MATERI-SISWA] Found {len(materi_list_siswa)} materi for siswa")

        # Debug: Check total materi with target_role='siswa'
        total_siswa_materi = await db.materi_mapel.count_documents({
            'is_active': True,
            'target_role': 'siswa'
        })
        logger.debug(f"[MATERI-SISWA] DEBUG: Total materi with target_role='siswa': {total_siswa_materi}")

        # Debug: Check if student_id exists in any target_siswa array
        sample_materi = await db.materi_mapel.find_one({
            'is_active': True,
            'target_role': 'siswa'
        })
        if sample_materi:
            logger.debug(f"[MATERI-SISWA] DEBUG: Sample materi target_siswa: {sample_materi.get('target_siswa')}")
            logger.debug(f"[MATERI-SISWA] DEBUG: Looking for student_id: {student_id}")

        # Combine both lists
        materi_list = materi_list_kelas + materi_list_siswa

        # Enrich with teacher and subject info
        serialized_list = []
        for materi in materi_list:
            teacher = await db.users.find_one({'id': materi.get('teacher_id')})
            subject = await db.subjects.find_one({'id': materi.get('subject_id')})

            materi['teacher_name'] = teacher.get('full_name') if teacher else None
            materi['subject_name'] = subject.get('name') if subject else None

            serialized_list.append(serialize_doc(materi))

        return serialized_list

    elif active_role == 'guru':
        # Role guru: show materi yang dibuat oleh guru ini
        # If class_id provided, filter by class
        filter_query['teacher_id'] = user['id']
        if class_id:
            filter_query['target_kelas_ids'] = class_id

    elif active_role in ('admin', 'kepala_sekolah', 'kepala_tata_usaha', 'waka_kurikulum', 'waka_kesiswaan', 'waka_sarpras', 'waka_humas', 'penjamin_mutu'):
        # Admin and management-oversight roles can see all (used by /admin/materi, linked from their sidebars)
        if class_id:
            filter_query['target_kelas_ids'] = class_id
    else:
        raise HTTPException(status_code=403, detail="Role tidak diizinkan")

    materi_list = await db.materi_mapel.find(filter_query).sort('created_at', -1).to_list(None)

    # Enrich with teacher and subject info
    serialized_list = []
    for materi in materi_list:
        teacher = await db.users.find_one({'id': materi.get('teacher_id')})
        subject = await db.subjects.find_one({'id': materi.get('subject_id')})

        materi['teacher_name'] = teacher.get('full_name') if teacher else None
        materi['subject_name'] = subject.get('name') if subject else None

        # Serialize each document individually
        serialized_list.append(serialize_doc(materi))

    return serialized_list


@router.get("/materi/{materi_id}")
async def get_materi_detail(
    materi_id: str,
    user: Dict = Depends(get_current_user)
):
    """Get materi detail."""

    materi = await db.materi_mapel.find_one({'id': materi_id, 'is_active': True})
    if not materi:
        raise HTTPException(status_code=404, detail="Materi tidak ditemukan")

    # Check access permission
    active_role = user.get('active_role')

    if active_role == 'kelas':
        class_id = user.get('class_id')
        if class_id not in materi.get('target_kelas_ids', []):
            raise HTTPException(status_code=403, detail="Anda tidak memiliki akses ke materi ini")

    # Enrich with info
    teacher = await db.users.find_one({'id': materi.get('teacher_id')})
    subject = await db.subjects.find_one({'id': materi.get('subject_id')})

    materi['teacher_name'] = teacher.get('full_name') if teacher else None
    materi['subject_name'] = subject.get('name') if subject else None
    materi['_id'] = None

    return serialize_doc(materi)


@router.put("/materi/{materi_id}")
async def update_materi(
    materi_id: str,
    req: MateriTugasUpdateRequest,
    request: Request,
    user: Dict = Depends(get_current_user)
):
    """Update materi (guru or admin)."""

    materi = await db.materi_mapel.find_one({'id': materi_id, 'is_active': True})
    if not materi:
        raise HTTPException(status_code=404, detail="Materi tidak ditemukan")

    # Check permission
    if 'admin' not in user.get('roles', []):
        if materi.get('teacher_id') != user['id']:
            raise HTTPException(status_code=403, detail="Anda tidak memiliki izin untuk mengubah materi ini")

    # Update fields
    update_data = {'updated_at': datetime.utcnow()}
    if req.judul:
        update_data['judul'] = req.judul
    if req.deskripsi is not None:
        update_data['deskripsi'] = req.deskripsi
    if req.konten:
        update_data['konten'] = req.konten
    if req.file_url is not None:
        update_data['file_url'] = req.file_url
    if req.target_role:
        update_data['target_role'] = req.target_role
    if req.subject_id:
        update_data['subject_id'] = req.subject_id
    if req.target_kelas_ids is not None:
        update_data['target_kelas_ids'] = req.target_kelas_ids
    if req.target_siswa is not None:
        update_data['target_siswa'] = req.target_siswa

    await db.materi_mapel.update_one({'id': materi_id}, {'$set': update_data})
    await log_audit(user, 'update', 'materi_mapel', materi_id, request=request)

    return {'message': 'Materi berhasil diupdate'}


@router.delete("/materi/{materi_id}")
async def delete_materi(
    materi_id: str,
    request: Request,
    user: Dict = Depends(get_current_user)
):
    """Delete materi (soft delete)."""

    materi = await db.materi_mapel.find_one({'id': materi_id, 'is_active': True})
    if not materi:
        raise HTTPException(status_code=404, detail="Materi tidak ditemukan")

    # Check permission
    if 'admin' not in user.get('roles', []):
        if materi.get('teacher_id') != user['id']:
            raise HTTPException(status_code=403, detail="Anda tidak memiliki izin untuk menghapus materi ini")

    await db.materi_mapel.update_one({'id': materi_id}, {'$set': {'is_active': False}})
    await log_audit(user, 'delete', 'materi_mapel', materi_id, request=request)

    return {'message': 'Materi berhasil dihapus'}


# ============================================================
# TUGAS - CRUD (Similar to Materi)
# ============================================================
@router.post("/tugas")
async def create_tugas(
    req: MateriTugasCreateRequest,
    request: Request,
    user: Dict = Depends(get_current_user)
):
    """Create tugas (guru only)."""

    if 'guru' not in user.get('roles', []) and 'admin' not in user.get('roles', []):
        raise HTTPException(status_code=403, detail="Hanya guru yang dapat membuat tugas")

    semester = await db.semesters.find_one({'is_active': True})
    if not semester:
        raise HTTPException(status_code=400, detail="Tidak ada semester aktif")

    tugas_data = TugasModel(
        judul=req.judul,
        deskripsi=req.deskripsi,
        konten=req.konten,
        file_url=req.file_url,
        deadline=req.deadline,
        target_role=req.target_role,
        target_kelas_ids=req.target_kelas_ids or [],
        target_siswa=req.target_siswa or [],
        teacher_id=user['id'],
        subject_id=req.subject_id,
        semester_id=semester['id'],
        academic_year_id=semester.get('academic_year_id'),
    )

    await db.tugas.insert_one(tugas_data.dict())
    await log_audit(user, 'create', 'tugas', tugas_data.id, request=request)

    return {'message': 'Tugas berhasil dibuat', 'id': tugas_data.id}


@router.get("/tugas")
async def get_tugas_list(
    class_id: Optional[str] = None,
    user: Dict = Depends(get_current_user)
):
    """Get list tugas based on user role."""

    active_role = user.get('active_role')
    filter_query = {'is_active': True}

    if active_role == 'kelas':
        class_id = user.get('class_id')
        filter_query['target_role'] = 'kelas'
        filter_query['target_kelas_ids'] = class_id

    elif active_role == 'siswa':
        # Role siswa: show tugas for both kelas and siswa
        # Get student's class_id
        student_class_id = user.get('student_class_id')
        student_id = user['id']

        logger.debug(f"[TUGAS-SISWA] student_id: {student_id}, student_class_id: {student_class_id}")

        # Fetch tugas for kelas OR siswa that includes this student
        tugas_list_kelas = []
        tugas_list_siswa = []

        if student_class_id:
            tugas_list_kelas = await db.tugas.find({
                'is_active': True,
                'target_role': 'kelas',
                'target_kelas_ids': student_class_id
            }).sort('created_at', -1).to_list(None)
            logger.info(f"[TUGAS-SISWA] Found {len(tugas_list_kelas)} tugas for kelas")

        tugas_list_siswa = await db.tugas.find({
            'is_active': True,
            'target_role': 'siswa',
            'target_siswa': student_id
        }).sort('created_at', -1).to_list(None)
        logger.info(f"[TUGAS-SISWA] Found {len(tugas_list_siswa)} tugas for siswa")

        # Debug: Check total tugas with target_role='siswa'
        total_siswa_tugas = await db.tugas.count_documents({
            'is_active': True,
            'target_role': 'siswa'
        })
        logger.debug(f"[TUGAS-SISWA] DEBUG: Total tugas with target_role='siswa': {total_siswa_tugas}")

        # Debug: Check if student_id exists in any target_siswa array
        sample_tugas = await db.tugas.find_one({
            'is_active': True,
            'target_role': 'siswa'
        })
        if sample_tugas:
            logger.debug(f"[TUGAS-SISWA] DEBUG: Sample tugas target_siswa: {sample_tugas.get('target_siswa')}")
            logger.debug(f"[TUGAS-SISWA] DEBUG: Looking for student_id: {student_id}")

        # Combine both lists
        tugas_list = tugas_list_kelas + tugas_list_siswa

        # Enrich with teacher, subject info, and submission status
        serialized_list = []
        for tugas in tugas_list:
            teacher = await db.users.find_one({'id': tugas.get('teacher_id')})
            subject = await db.subjects.find_one({'id': tugas.get('subject_id')})

            tugas['teacher_name'] = teacher.get('full_name') if teacher else None
            tugas['subject_name'] = subject.get('name') if subject else None

            # Check if student has submitted this tugas
            submission = await db.tugas_submissions.find_one({
                'tugas_id': tugas.get('id'),
                'student_id': student_id
            })
            tugas['submission_status'] = 'submitted' if submission else 'not_submitted'

            serialized_list.append(serialize_doc(tugas))

        return serialized_list

    elif active_role == 'guru':
        filter_query['teacher_id'] = user['id']
        if class_id:
            filter_query['target_kelas_ids'] = class_id

    elif active_role in ('admin', 'kepala_sekolah', 'kepala_tata_usaha', 'waka_kurikulum', 'waka_kesiswaan', 'waka_sarpras', 'waka_humas', 'penjamin_mutu'):
        # Admin and management-oversight roles can see all (used by /admin/tugas, linked from their sidebars)
        if class_id:
            filter_query['target_kelas_ids'] = class_id
    else:
        raise HTTPException(status_code=403, detail="Role tidak diizinkan")

    tugas_list = await db.tugas.find(filter_query).sort('created_at', -1).to_list(None)

    # Enrich with teacher and subject info
    serialized_list = []
    for tugas in tugas_list:
        teacher = await db.users.find_one({'id': tugas.get('teacher_id')})
        subject = await db.subjects.find_one({'id': tugas.get('subject_id')})

        tugas['teacher_name'] = teacher.get('full_name') if teacher else None
        tugas['subject_name'] = subject.get('name') if subject else None

        # Serialize each document individually
        serialized_list.append(serialize_doc(tugas))

    return serialized_list


@router.get("/tugas/{tugas_id}")
async def get_tugas_detail(
    tugas_id: str,
    user: Dict = Depends(get_current_user)
):
    """Get tugas detail."""

    tugas = await db.tugas.find_one({'id': tugas_id, 'is_active': True})
    if not tugas:
        raise HTTPException(status_code=404, detail="Tugas tidak ditemukan")

    active_role = user.get('active_role')
    if active_role == 'kelas':
        class_id = user.get('class_id')
        if class_id not in tugas.get('target_kelas_ids', []):
            raise HTTPException(status_code=403, detail="Anda tidak memiliki akses ke tugas ini")

    teacher = await db.users.find_one({'id': tugas.get('teacher_id')})
    subject = await db.subjects.find_one({'id': tugas.get('subject_id')})

    tugas['teacher_name'] = teacher.get('full_name') if teacher else None
    tugas['subject_name'] = subject.get('name') if subject else None
    tugas['_id'] = None

    return serialize_doc(tugas)


@router.put("/tugas/{tugas_id}")
async def update_tugas(
    tugas_id: str,
    req: MateriTugasUpdateRequest,
    request: Request,
    user: Dict = Depends(get_current_user)
):
    """Update tugas (guru or admin)."""

    tugas = await db.tugas.find_one({'id': tugas_id, 'is_active': True})
    if not tugas:
        raise HTTPException(status_code=404, detail="Tugas tidak ditemukan")

    if 'admin' not in user.get('roles', []):
        if tugas.get('teacher_id') != user['id']:
            raise HTTPException(status_code=403, detail="Anda tidak memiliki izin untuk mengubah tugas ini")

    update_data = {'updated_at': datetime.utcnow()}
    if req.judul:
        update_data['judul'] = req.judul
    if req.deskripsi is not None:
        update_data['deskripsi'] = req.deskripsi
    if req.konten:
        update_data['konten'] = req.konten
    if req.file_url is not None:
        update_data['file_url'] = req.file_url
    if req.deadline is not None:
        update_data['deadline'] = req.deadline
    if req.target_role:
        update_data['target_role'] = req.target_role
    if req.subject_id:
        update_data['subject_id'] = req.subject_id
    if req.target_kelas_ids is not None:
        update_data['target_kelas_ids'] = req.target_kelas_ids
    if req.target_siswa is not None:
        update_data['target_siswa'] = req.target_siswa

    await db.tugas.update_one({'id': tugas_id}, {'$set': update_data})
    await log_audit(user, 'update', 'tugas', tugas_id, request=request)

    return {'message': 'Tugas berhasil diupdate'}


@router.delete("/tugas/{tugas_id}")
async def delete_tugas(
    tugas_id: str,
    request: Request,
    user: Dict = Depends(get_current_user)
):
    """Delete tugas (soft delete)."""

    tugas = await db.tugas.find_one({'id': tugas_id, 'is_active': True})
    if not tugas:
        raise HTTPException(status_code=404, detail="Tugas tidak ditemukan")

    if 'admin' not in user.get('roles', []):
        if tugas.get('teacher_id') != user['id']:
            raise HTTPException(status_code=403, detail="Anda tidak memiliki izin untuk menghapus tugas ini")

    await db.tugas.update_one({'id': tugas_id}, {'$set': {'is_active': False}})
    await log_audit(user, 'delete', 'tugas', tugas_id, request=request)

    return {'message': 'Tugas berhasil dihapus'}


# ============================================================
# TUGAS SUBMISSIONS - Get submissions for a tugas
# ============================================================
@router.get("/tugas/{tugas_id}/submissions")
async def get_tugas_submissions(
    tugas_id: str,
    user: Dict = Depends(get_current_user)
):
    """Get all submissions for a specific tugas (guru/admin only)."""

    # Check if tugas exists
    tugas = await db.tugas.find_one({'id': tugas_id, 'is_active': True})
    if not tugas:
        raise HTTPException(status_code=404, detail="Tugas tidak ditemukan")

    # Only guru who created the tugas or admin can view submissions
    if 'admin' not in user.get('roles', []):
        if tugas.get('teacher_id') != user['id']:
            raise HTTPException(status_code=403, detail="Anda tidak memiliki izin untuk melihat submissions tugas ini")

    # Get all submissions for this tugas
    submissions = await db.tugas_submissions.find({
        'tugas_id': tugas_id
    }).sort('submitted_at', -1).to_list(None)

    # Enrich submissions with student info
    enriched_submissions = []
    for submission in submissions:
        student_id = submission.get('student_id')
        if student_id:
            student = await db.users.find_one({'id': student_id})
            if student:
                submission['student_name'] = student.get('full_name')
                submission['student_nis'] = student.get('nis')
                submission['student_nisn'] = student.get('nisn')

        enriched_submissions.append(serialize_doc(submission))

    return {
        'tugas_id': tugas_id,
        'tugas_judul': tugas.get('judul'),
        'total_submissions': len(enriched_submissions),
        'submissions': enriched_submissions
    }


@router.post("/tugas/{tugas_id}/submit")
async def submit_tugas(
    tugas_id: str,
    req: TugasSubmissionRequest,
    request: Request,
    user: Dict = Depends(get_current_user)
):
    """Submit tugas (siswa only)."""

    # Only siswa can submit
    if user.get('active_role') != 'siswa':
        raise HTTPException(status_code=403, detail="Hanya siswa yang dapat mengumpulkan tugas")

    # Check if tugas exists
    tugas = await db.tugas.find_one({'id': tugas_id, 'is_active': True})
    if not tugas:
        raise HTTPException(status_code=404, detail="Tugas tidak ditemukan")

    # Verify student has access to this tugas
    student_id = user['id']
    student_class_id = user.get('student_class_id')

    # Check if tugas is for this student's class OR specifically for this student
    has_access = False

    # Check if tugas is for kelas and student's class
    if 'kelas' in tugas.get('target_role', []):
        if student_class_id and student_class_id in tugas.get('target_kelas_ids', []):
            has_access = True

    # Check if tugas is specifically for this student
    if 'siswa' in tugas.get('target_role', []):
        if student_id in tugas.get('target_siswa', []):
            has_access = True

    if not has_access:
        raise HTTPException(status_code=403, detail="Anda tidak memiliki akses ke tugas ini")

    # Check if student has already submitted
    existing_submission = await db.tugas_submissions.find_one({
        'tugas_id': tugas_id,
        'student_id': student_id
    })

    if existing_submission:
        # Update existing submission
        await db.tugas_submissions.update_one(
            {'id': existing_submission['id']},
            {
                '$set': {
                    'jawaban': req.jawaban,
                    'file_url': req.file_url,
                    'updated_at': datetime.utcnow()
                }
            }
        )
        await log_audit(user, 'update', 'tugas_submission', existing_submission['id'], request=request)
        return {'message': 'Tugas berhasil diperbarui', 'id': existing_submission['id']}
    else:
        # Create new submission
        submission_data = TugasSubmissionModel(
            tugas_id=tugas_id,
            student_id=student_id,
            jawaban=req.jawaban,
            file_url=req.file_url
        )

        await db.tugas_submissions.insert_one(submission_data.dict())
        await log_audit(user, 'create', 'tugas_submission', submission_data.id, request=request)

        return {'message': 'Tugas berhasil dikumpulkan', 'id': submission_data.id}


# ============================================================
# JADWAL MENGAJAR - Untuk Kelas (menampilkan mata pelajaran dengan guru)
# ============================================================
@router.get("/jadwal")
async def get_jadwal_kelas(user: Dict = Depends(get_current_user)):
    """Get jadwal mengajar untuk kelas dengan format grouped (seperti di walikelas)."""
    logger.debug(f"[JADWAL] NEW VERSION - Endpoint hit for class_id: {user.get('class_id')}")

    if user.get('active_role') != 'kelas':
        raise HTTPException(status_code=403, detail="Hanya akun kelas yang dapat mengakses")

    class_id = user.get('class_id')
    semester_id = user.get('semester_id')

    if not class_id or not semester_id:
        raise HTTPException(status_code=400, detail="Class ID atau Semester ID tidak ditemukan")

    # Get all schedules for this class, sorted by day and start_time
    schedules = await db.schedules.find({
        'class_id': class_id,
        'semester_id': semester_id
    }, {'_id': 0}).sort([('day', 1), ('start_time', 1)]).to_list(2000)

    logger.info(f"[JADWAL] Found {len(schedules)} raw schedules")

    # Enrich with teacher, subject, room, and class details
    for item in schedules:
        teacher_id = item.get('teacher_id')
        subject_id = item.get('subject_id')
        room_id = item.get('room_id')

        if teacher_id:
            teacher = await db.users.find_one({'id': teacher_id}, {'_id': 0, 'full_name': 1, 'username': 1, 'nip': 1})
            if teacher:
                item['teacher_name'] = teacher.get('full_name') or teacher.get('username')
                item['teacher_nip'] = teacher.get('nip')

        if subject_id:
            subject = await db.subjects.find_one({'id': subject_id}, {'_id': 0, 'name': 1, 'code': 1})
            if subject:
                item['subject_name'] = subject.get('name')
                item['subject_code'] = subject.get('code')

        if room_id:
            room = await db.rooms.find_one({'id': room_id}, {'_id': 0, 'name': 1, 'code': 1})
            if room:
                item['room_name'] = room.get('name')
                item['room_code'] = room.get('code')

    # Group consecutive hours by day, subject, and teacher
    grouped = _group_consecutive_schedules(schedules)
    logger.info(f"[JADWAL] Returning {len(grouped)} grouped schedules")

    # Extract unique subjects with teachers for the frontend
    subjects_map = {}
    for item in schedules:
        subject_id = item.get('subject_id')
        teacher_id = item.get('teacher_id')
        if subject_id and subject_id not in subjects_map:
            subjects_map[subject_id] = {
                'subject_id': subject_id,
                'subject_name': item.get('subject_name'),
                'subject_code': item.get('subject_code'),
                'teacher_id': teacher_id,
                'teacher_name': item.get('teacher_name'),
                'teacher_nip': item.get('teacher_nip'),
            }

    subjects = list(subjects_map.values())
    logger.info(f"[JADWAL] Found {len(subjects)} unique subjects")

    return {
        'class_id': class_id,
        'semester_id': semester_id,
        'schedules': [serialize_doc(s) for s in schedules],
        'grouped': grouped,
        'subjects': subjects  # Add unique subjects list for materi/tugas pages
    }


def _group_consecutive_schedules(schedules: List[Dict]) -> List[Dict]:
    """Group consecutive teaching hours in same class, day, subject."""
    if not schedules:
        return []

    grouped = []
    current_group = None

    for sch in schedules:
        # Key for grouping: day + class_id + subject_id + teacher_id
        key = (sch.get('day'), sch.get('class_id'), sch.get('subject_id'), sch.get('teacher_id'))

        if current_group and current_group['key'] == key:
            # Check if consecutive
            if sch.get('start_time') == current_group['end_time']:
                # Extend current group
                current_group['end_time'] = sch.get('end_time')
                current_group['duration_minutes'] += (
                    _time_diff_minutes(sch.get('start_time'), sch.get('end_time'))
                )
                current_group['schedule_ids'].append(sch.get('id'))
                continue

        # Start new group
        if current_group:
            grouped.append(current_group)

        current_group = {
            'key': key,
            'day': sch.get('day'),
            'start_time': sch.get('start_time'),
            'end_time': sch.get('end_time'),
            'class_id': sch.get('class_id'),
            'class_name': sch.get('class_name'),
            'subject_id': sch.get('subject_id'),
            'subject_name': sch.get('subject_name'),
            'subject_code': sch.get('subject_code'),
            'teacher_id': sch.get('teacher_id'),
            'teacher_name': sch.get('teacher_name'),
            'teacher_nip': sch.get('teacher_nip'),
            'room_id': sch.get('room_id'),
            'room_name': sch.get('room_name'),
            'room_code': sch.get('room_code'),
            'duration_minutes': _time_diff_minutes(sch.get('start_time'), sch.get('end_time')),
            'schedule_ids': [sch.get('id')],
            'is_published': sch.get('is_published', True),
        }

    # Don't forget the last group
    if current_group:
        grouped.append(current_group)

    return grouped


def _time_diff_minutes(start: str, end: str) -> int:
    """Calculate time difference in minutes."""
    from datetime import datetime
    try:
        fmt = '%H:%M'
        t1 = datetime.strptime(start, fmt)
        t2 = datetime.strptime(end, fmt)
        return int((t2 - t1).total_seconds() / 60)
    except:
        return 0




# ============================================================
# JURNAL KELAS - View journals for the class
# ============================================================
@router.get("/jurnal")
async def get_jurnal_kelas(user: Dict = Depends(get_current_user)):
    """Get jurnal mengajar untuk kelas ini."""
    logger.debug(f"[JURNAL] Endpoint hit for class_id: {user.get('class_id')}")

    if user.get('active_role') != 'kelas':
        raise HTTPException(status_code=403, detail="Hanya akun kelas yang dapat mengakses")

    class_id = user.get('class_id')
    semester_id = user.get('semester_id')

    if not class_id or not semester_id:
        raise HTTPException(status_code=400, detail="Class ID atau Semester ID tidak ditemukan")

    # Get all journals for this class
    journals = await db.journals.find({
        'class_id': class_id,
        'semester_id': semester_id
    }).sort('created_at', -1).limit(50).to_list(50)

    logger.info(f"[JURNAL] Found {len(journals)} journals for class {class_id}")

    # Enrich with teacher, subject, and piket info
    for journal in journals:
        teacher_id = journal.get('teacher_id')
        subject_id = journal.get('subject_id')
        filled_by_user_id = journal.get('filled_by_user_id')  # For piket-filled journals

        if teacher_id:
            teacher = await db.users.find_one({'id': teacher_id}, {'_id': 0, 'full_name': 1, 'username': 1})
            if teacher:
                journal['teacher_name'] = teacher.get('full_name') or teacher.get('username')

        if subject_id:
            subject = await db.subjects.find_one({'id': subject_id}, {'_id': 0, 'name': 1, 'code': 1})
            if subject:
                journal['subject_name'] = subject.get('name')
                journal['subject_code'] = subject.get('code')

        # Add filled_by_name for piket-filled journals
        if filled_by_user_id and journal.get('fill_mode') == 'piket':
            piket_user = await db.users.find_one({'id': filled_by_user_id}, {'_id': 0, 'full_name': 1, 'username': 1})
            if piket_user:
                journal['filled_by_name'] = piket_user.get('full_name') or piket_user.get('username')

    return {
        'class_id': class_id,
        'semester_id': semester_id,
        'journals': [serialize_doc(j) for j in journals]
    }


# ============================================================
# KEHADIRAN SISWA - View attendance for students in the class
# ============================================================
@router.get("/kehadiran")
async def get_kehadiran_kelas(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020, le=2100),
    user: Dict = Depends(get_current_user)
):
    """Get kehadiran siswa untuk kelas ini berdasarkan bulan dan tahun."""

    logger.debug(f"[KELAS-KEHADIRAN] Endpoint hit for class_id: {user.get('class_id')}, month: {month}, year: {year}")

    if user.get('active_role') != 'kelas':
        raise HTTPException(status_code=403, detail="Hanya akun kelas yang dapat mengakses")

    class_id = user.get('class_id')
    if not class_id:
        raise HTTPException(status_code=400, detail="Class ID tidak ditemukan")

    # Get all students in this class from users collection with role siswa
    students = await db.users.find({
        'student_class_id': class_id,
        'is_active': True
    }).to_list(None)

    logger.info(f"[KELAS-KEHADIRAN] Found {len(students)} students in class {class_id}")

    student_ids = [s.get('id') for s in students]
    if not student_ids:
        return {
            'class_id': class_id,
            'month': month,
            'year': year,
            'total_hari': 0,
            'students': []
        }

    # Build month pattern for regex (e.g., "2026-09")
    mon_str = str(month).zfill(2)
    month_pattern = f'{year}-{mon_str}'

    logger.info(f"[KELAS-KEHADIRAN] Month pattern: {month_pattern}")

    # Get all attendance records for this month using regex pattern (same as wali-kelas)
    attendance_records = await db.attendances.find({
        'student_id': {'$in': student_ids},
        'created_at': {
            '$regex': f'^{month_pattern}-',
            '$options': 'i'
        }
    }, {'_id': 0}).to_list(10000)

    logger.info(f"[KELAS-KEHADIRAN] Found {len(attendance_records)} attendance records")
    if attendance_records:
        logger.debug(f"[KELAS-KEHADIRAN] Sample record: {attendance_records[0]}")

    # Calculate total unique days (from created_at dates)
    unique_days = set()
    for record in attendance_records:
        created_at = record.get('created_at', '')
        if created_at:
            # Extract date part (YYYY-MM-DD)
            day = created_at.split('T')[0] if 'T' in created_at else created_at[:10]
            unique_days.add(day)

    total_hari = len(unique_days)
    logger.info(f"[KELAS-KEHADIRAN] Total unique days: {total_hari}")

    # Group attendance by student
    student_attendance = {}
    for student in students:
        student_id = student.get('id')
        student_attendance[student_id] = {
            'id': student_id,
            'nama': student.get('full_name'),
            'nis': student.get('nis'),
            'hadir': 0,
            'sakit': 0,
            'izin': 0,
            'alpa': 0,
        }

    # Count attendance by status
    for record in attendance_records:
        student_id = record.get('student_id')
        status = record.get('status', '').lower()

        if student_id in student_attendance:
            if status == 'hadir':
                student_attendance[student_id]['hadir'] += 1
            elif status == 'sakit':
                student_attendance[student_id]['sakit'] += 1
            elif status == 'izin':
                student_attendance[student_id]['izin'] += 1
            elif status in ['alpa', 'alpha']:
                student_attendance[student_id]['alpa'] += 1

    logger.info(f"[KELAS-KEHADIRAN] Processed {len(student_attendance)} students")

    return {
        'class_id': class_id,
        'month': month,
        'year': year,
        'total_hari': total_hari,
        'students': list(student_attendance.values())
    }
# trigger reload
