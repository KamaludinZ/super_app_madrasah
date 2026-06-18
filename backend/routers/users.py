"""Users CRUD + Excel import + Mutation set + Mutations list."""
from datetime import datetime
from typing import Dict, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
import io

from auth_utils import hash_password
from core import (
    db,
    get_active_academic_year,
    log_audit,
    require_role,
    serialize_doc,
)
from excel_io import (
    parse_student_account_bulk_rows,
    parse_user_rows,
    student_account_bulk_template,
    user_template,
)
from models import ROLES, UserCreateRequest, UserModel, UserUpdateRequest, MutationMasukSubmit, MutationKeluarSubmit

router = APIRouter()


# IMPORTANT: Routes with literal paths MUST come before parameterized paths
# Order: /users/excel-template -> /users/import-excel -> /users/{uid} -> /users
@router.get("/users/excel-template")
async def users_template(user: Dict = Depends(require_role('admin'))):
    return StreamingResponse(
        io.BytesIO(user_template()),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': 'attachment; filename="template_pengguna_matsandatama.xlsx"'},
    )


@router.post("/users/import-excel")
async def users_import(file: UploadFile = File(...), request: Request = None,
                       user: Dict = Depends(require_role('admin'))):
    if not file.filename.lower().endswith(('.xlsx', '.xlsm')):
        raise HTTPException(400, "Hanya file .xlsx yang didukung")
    contents = await file.read()
    try:
        rows = parse_user_rows(contents)
    except Exception as e:
        raise HTTPException(400, f"Error parsing Excel: {e}")
    success = []
    errors = []
    for idx, row in enumerate(rows, start=2):
        try:
            existing = await db.users.find_one({'username': row['username']})
            if existing:
                errors.append({'row': idx, 'error': f"Username {row['username']} sudah ada"})
                continue
            u = UserModel(
                username=row['username'], password_hash=hash_password(row['password']),
                full_name=row['full_name'], nip_nuptk=row.get('nip_nuptk'),
                nisn=row.get('nisn'), email=row.get('email'), phone=row.get('phone'),
                roles=row.get('roles', ['siswa']),
            )
            doc = u.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            await db.users.insert_one(doc)
            success.append(row['username'])
        except Exception as e:
            errors.append({'row': idx, 'error': str(e)})
    if request:
        await log_audit(user, 'import_users', 'users', None, details={'success': len(success), 'errors': len(errors)}, request=request)
    return {'success': success, 'errors': errors}


@router.get("/students/bulk-account-template")
async def students_bulk_account_template(user: Dict = Depends(require_role('admin'))):
    students = await db.users.find(
        {
            'roles': 'siswa',
            '$or': [
                {'username': {'$exists': False}},
                {'username': None},
                {'username': ''},
            ]
        },
        {'_id': 0, 'id': 1, 'full_name': 1, 'nisn': 1}
    ).sort('full_name', 1).to_list(5000)

    return StreamingResponse(
        io.BytesIO(student_account_bulk_template(students)),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': 'attachment; filename="template_akun_siswa_belum_punya_akun.xlsx"'},
    )


@router.post("/students/import-bulk-accounts")
async def students_import_bulk_accounts(
    file: UploadFile = File(...),
    request: Request = None,
    user: Dict = Depends(require_role('admin'))
):
    if not file.filename.lower().endswith(('.xlsx', '.xlsm')):
        raise HTTPException(400, "Hanya file .xlsx yang didukung")

    contents = await file.read()
    try:
        rows = parse_student_account_bulk_rows(contents)
    except Exception as e:
        raise HTTPException(400, f"Error parsing Excel: {e}")

    success = []
    errors = []

    for row in rows:
        row_no = row.get('_row')
        sid = row.get('id')
        username = (row.get('username') or '').strip()
        password = row.get('password') or ''

        try:
            if not username or not password:
                errors.append({'row': row_no, 'error': 'Username dan password wajib diisi'})
                continue

            username_conflict = await db.users.find_one({'username': username})
            if username_conflict:
                errors.append({'row': row_no, 'error': f"Username {username} sudah digunakan"})
                continue

            student = await db.users.find_one({'id': sid})
            if not student:
                errors.append({'row': row_no, 'error': f"User dengan id {sid} tidak ditemukan"})
                continue

            if 'siswa' not in (student.get('roles') or []):
                errors.append({'row': row_no, 'error': "User bukan role siswa"})
                continue

            current_username = (student.get('username') or '').strip()
            if current_username:
                errors.append({'row': row_no, 'error': f"Siswa sudah memiliki akun ({current_username})"})
                continue

            await db.users.update_one(
                {'id': sid},
                {'$set': {'username': username, 'password_hash': hash_password(password)}}
            )
            success.append(username)

        except Exception as e:
            errors.append({'row': row_no, 'error': str(e)})

    if request:
        await log_audit(
            user,
            'import_bulk_student_accounts',
            'users',
            None,
            details={'success': len(success), 'errors': len(errors)},
            request=request
        )

    return {'success': success, 'errors': errors, 'total_rows': len(rows)}


# GET /users/{uid} must be BEFORE GET /users to avoid path conflicts
@router.get("/users/{uid}")
async def get_user(uid: str, user: Dict = Depends(require_role('admin'))):
    doc = await db.users.find_one({'id': uid}, {'_id': 0, 'password_hash': 0})
    if not doc:
        raise HTTPException(404, "User tidak ditemukan")
    return serialize_doc(doc)


@router.get("/users")
async def list_users(role: Optional[str] = None, user: Dict = Depends(require_role('admin'))):
    q = {}
    if role:
        q['roles'] = role
    items = await db.users.find(q, {'_id': 0, 'password_hash': 0}).to_list(2000)
    return [serialize_doc(i) for i in items]


@router.post("/users")
async def create_user(req: UserCreateRequest, request: Request, user: Dict = Depends(require_role('admin'))):
    existing = await db.users.find_one({'username': req.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username sudah digunakan")
    invalid = [r for r in req.roles if r not in ROLES]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Peran tidak valid: {invalid}")
    u = UserModel(
        username=req.username, password_hash=hash_password(req.password),
        full_name=req.full_name, nip_nuptk=req.nip_nuptk, nisn=req.nisn,
        email=req.email, phone=req.phone, roles=req.roles,
        homeroom_class_id=req.homeroom_class_id, student_class_id=req.student_class_id,
        parent_of=req.parent_of,
    )
    doc = u.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.users.insert_one(doc)
    await log_audit(user, 'create', 'user', u.id, details={'username': req.username, 'roles': req.roles}, request=request)
    doc.pop('password_hash', None)
    return serialize_doc(doc)


@router.put("/users/{uid}")
async def update_user(uid: str, req: UserUpdateRequest, request: Request, user: Dict = Depends(require_role('admin'))):
    update = {k: v for k, v in req.model_dump(exclude_unset=True).items() if v is not None}

    # Validasi NIK & Nomor KK harus 16 digit angka
    nik = update.get('nik')
    if nik is not None:
        nik = ''.join(ch for ch in str(nik) if ch.isdigit())
        if len(nik) != 16:
            raise HTTPException(400, "NIK harus 16 digit angka")
        update['nik'] = nik

    nomor_kk = update.get('nomor_kk')
    if nomor_kk is not None:
        nomor_kk = ''.join(ch for ch in str(nomor_kk) if ch.isdigit())
        if len(nomor_kk) != 16:
            raise HTTPException(400, "Nomor KK harus 16 digit angka")
        update['nomor_kk'] = nomor_kk

    if 'new_password' in update:
        update['password_hash'] = hash_password(update.pop('new_password'))
    res = await db.users.update_one({'id': uid}, {'$set': update})
    if res.matched_count == 0:
        raise HTTPException(404, "User tidak ditemukan")
    await log_audit(user, 'update', 'user', uid, details={'keys': list(update.keys())}, request=request)
    doc = await db.users.find_one({'id': uid}, {'_id': 0, 'password_hash': 0})
    return serialize_doc(doc)


@router.delete("/users/{uid}")
async def delete_user(uid: str, request: Request, user: Dict = Depends(require_role('admin'))):
    await db.users.delete_one({'id': uid})
    await log_audit(user, 'delete', 'user', uid, request=request)
    return {'message': 'Dihapus'}


# ============================================================
# MUTATION (set on user)
# ============================================================
@router.put("/admin/users/{uid}/mutation")
async def set_student_mutation(uid: str, payload: Dict, request: Request,
                               user: Dict = Depends(require_role('admin'))):
    """Set/clear mutation status pada user (terutama siswa)."""
    existing = await db.users.find_one({'id': uid})
    if not existing:
        raise HTTPException(404, "User tidak ditemukan")
    mtype = payload.get('mutation_type')  # 'masuk' | 'keluar' | null/empty (clear)
    if mtype and mtype not in ('masuk', 'keluar'):
        raise HTTPException(400, "mutation_type harus 'masuk', 'keluar', atau kosong untuk clear")
    ay = await get_active_academic_year()
    update = {
        'mutation_type': mtype or None,
        'mutation_ay_id': ay['id'] if ay and mtype else None,
        'mutation_date': payload.get('mutation_date') if mtype else None,
        'mutation_note': payload.get('mutation_note') if mtype else None,
    }
    if mtype == 'keluar':
        update['is_active'] = False
    elif mtype == 'masuk':
        update['is_active'] = True
    await db.users.update_one({'id': uid}, {'$set': update})
    await log_audit(user, 'set_mutation', 'user', uid, details=update, request=request)
    doc = await db.users.find_one({'id': uid}, {'_id': 0, 'password_hash': 0})
    return serialize_doc(doc)


# ============================================================
# MUTATIONS LIST (untuk halaman Mutasi)
# ============================================================
@router.get("/admin/mutations")
async def list_mutations(mutation_type: str, role_group: str = 'siswa',
                         academic_year_id: Optional[str] = None,
                         user: Dict = Depends(require_role('admin'))):
    """Daftar user dengan mutation_type='masuk' atau 'keluar'.
    role_group: 'siswa' atau 'staff' (guru+tendik).
    """
    if mutation_type not in ('masuk', 'keluar'):
        raise HTTPException(400, "mutation_type harus 'masuk' atau 'keluar'")
    if role_group not in ('siswa', 'staff'):
        raise HTTPException(400, "role_group harus 'siswa' atau 'staff'")
    ay = None
    if academic_year_id:
        ay = await db.academic_years.find_one({'id': academic_year_id}, {'_id': 0})
    else:
        ay = await get_active_academic_year()
    q = {'mutation_type': mutation_type}
    if ay:
        q['mutation_ay_id'] = ay['id']
    if role_group == 'siswa':
        q['roles'] = 'siswa'
    else:
        staff_roles = ['guru', 'wali_kelas', 'guru_piket', 'guru_bk', 'guru_tata_tertib',
                       'guru_ekstrakurikuler', 'tenaga_kependidikan']
        q['roles'] = {'$in': staff_roles}
    items = await db.users.find(q, {'_id': 0, 'password_hash': 0}).sort('mutation_date', -1).to_list(500)
    enriched = []
    for u in items:
        if u.get('student_class_id'):
            cls = await db.classes.find_one({'id': u['student_class_id']}, {'_id': 0, 'name': 1})
            u['class_name'] = cls.get('name') if cls else None
        enriched.append(serialize_doc(u))
    return enriched


@router.post("/admin/mutations/masuk")
async def process_mutation_masuk(req: MutationMasukSubmit, request: Request,
                                   user: Dict = Depends(require_role('admin'))):
    """Proses mutasi masuk (create new user or update existing)."""
    ay = await get_active_academic_year()
    if not ay:
        raise HTTPException(400, "Tidak ada tahun pelajaran aktif")

    # Determine role group from the request data
    is_siswa = bool(req.nisn or req.class_id)

    # Generate username based on type
    if is_siswa:
        username = req.nisn or f"siswa_{req.nis or datetime.now().strftime('%Y%m%d%H%M%S')}"
        default_roles = ['siswa']
    else:
        username = req.nip_nuptk or f"staff_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        default_roles = req.roles or ['guru']

    # Check if user already exists
    existing = await db.users.find_one({'username': username})

    user_data = {
        'full_name': req.full_name,
        'mutation_type': 'masuk',
        'mutation_ay_id': ay['id'],
        'mutation_date': req.mutation_date,
        'mutation_note': req.mutation_note,
        'mutation_document_url': req.mutation_document_url,
        'is_active': True,
    }

    if is_siswa:
        user_data.update({
            'nisn': req.nisn,
            'nis': req.nis,
            'gender': req.gender,
            'birth_place': req.birth_place,
            'birth_date': req.birth_date,
            'address': req.address,
            'student_class_id': req.class_id,
        })
    else:
        user_data.update({
            'nip_nuptk': req.nip_nuptk,
            'email': req.email,
            'phone': req.phone,
        })

    if existing:
        # Update existing user
        await db.users.update_one({'id': existing['id']}, {'$set': user_data})
        await log_audit(request, user, 'update', 'users', existing['id'],
                       f"Update mutasi masuk: {req.full_name}")
        result_user = await db.users.find_one({'id': existing['id']}, {'_id': 0, 'password_hash': 0})
    else:
        # Create new user
        import uuid
        new_user = UserModel(
            id=str(uuid.uuid4()),
            username=username,
            password_hash=hash_password('12345678'),  # default password
            roles=default_roles,
            **user_data
        )
        await db.users.insert_one(new_user.model_dump())
        await log_audit(request, user, 'create', 'users', new_user.id,
                       f"Create mutasi masuk: {req.full_name}")
        result_user = new_user.model_dump()
        del result_user['password_hash']

    return serialize_doc(result_user)


@router.post("/admin/mutations/keluar")
async def process_mutation_keluar(req: MutationKeluarSubmit, request: Request,
                                    user: Dict = Depends(require_role('admin'))):
    """Proses mutasi keluar (set user as inactive and mark mutation)."""
    ay = await get_active_academic_year()
    if not ay:
        raise HTTPException(400, "Tidak ada tahun pelajaran aktif")

    # Get user
    target_user = await db.users.find_one({'id': req.user_id})
    if not target_user:
        raise HTTPException(404, "User tidak ditemukan")

    # Determine if siswa or staff
    is_siswa = 'siswa' in target_user.get('roles', [])

    update_data = {
        'mutation_type': 'keluar',
        'mutation_ay_id': ay['id'],
        'mutation_date': req.mutation_date,
        'mutation_note': req.mutation_note,
        'mutation_document_url': req.mutation_document_url,
        'is_active': False,  # Set user as inactive
    }

    # For staff, add keluar type and destination
    if not is_siswa:
        if not req.mutation_keluar_type:
            raise HTTPException(400, "mutation_keluar_type wajib diisi untuk staff")
        update_data['mutation_keluar_type'] = req.mutation_keluar_type
        if req.mutation_keluar_type == 'pindah':
            if not req.mutation_destination:
                raise HTTPException(400, "mutation_destination wajib diisi untuk mutasi pindah")
            update_data['mutation_destination'] = req.mutation_destination

    await db.users.update_one({'id': req.user_id}, {'$set': update_data})
    await log_audit(request, user, 'update', 'users', req.user_id,
                   f"Mutasi keluar: {target_user.get('full_name')}")

    result_user = await db.users.find_one({'id': req.user_id}, {'_id': 0, 'password_hash': 0})
    return serialize_doc(result_user)


@router.get("/admin/mutations/eligible-users")
async def get_eligible_users_for_keluar(role_group: str = 'siswa',
                                         user: Dict = Depends(require_role('admin'))):
    """Get list of active users yang bisa di-mutasi keluar."""
    if role_group not in ('siswa', 'staff'):
        raise HTTPException(400, "role_group harus 'siswa' atau 'staff'")

    q = {
        'is_active': True,
        '$or': [
            {'mutation_type': {'$exists': False}},
            {'mutation_type': None},
            {'mutation_type': 'masuk'}
        ]
    }

    if role_group == 'siswa':
        q['roles'] = 'siswa'
    else:
        staff_roles = ['guru', 'wali_kelas', 'guru_piket', 'guru_bk', 'guru_tata_tertib',
                       'guru_ekstrakurikuler', 'tenaga_kependidikan']
        q['roles'] = {'$in': staff_roles}

    items = await db.users.find(q, {'_id': 0, 'id': 1, 'full_name': 1, 'nisn': 1, 'nip_nuptk': 1,
                                      'student_class_id': 1, 'roles': 1}).sort('full_name', 1).to_list(500)

    # Enrich with class name for siswa
    enriched = []
    for u in items:
        if u.get('student_class_id'):
            cls = await db.classes.find_one({'id': u['student_class_id']}, {'_id': 0, 'name': 1})
            u['class_name'] = cls.get('name') if cls else None
        enriched.append(serialize_doc(u))

    return enriched
