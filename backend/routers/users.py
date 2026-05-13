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
from excel_io import parse_user_rows, user_template
from models import ROLES, UserCreateRequest, UserModel, UserUpdateRequest

router = APIRouter()


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
        raise HTTPException(400, f"Gagal membaca Excel: {e}")
    success = 0
    errors = []
    new_docs = []
    classes_map = {c['name']: c['id'] for c in await db.classes.find({}, {'_id': 0}).to_list(500)}
    valid_roles = set(ROLES)
    for r in rows:
        try:
            if not r['username'] or not r['password'] or not r['full_name']:
                errors.append(f"Baris {r['_row']}: username/password/nama wajib"); continue
            if not r['roles']:
                errors.append(f"Baris {r['_row']}: roles wajib"); continue
            invalid = [x for x in r['roles'] if x not in valid_roles]
            if invalid:
                errors.append(f"Baris {r['_row']}: roles tidak valid {invalid}"); continue
            existing = await db.users.find_one({'username': r['username']})
            if existing:
                errors.append(f"Baris {r['_row']}: username '{r['username']}' sudah ada"); continue
            student_class_id = None
            homeroom_class_id = None
            if 'siswa' in r['roles'] and r.get('kelas_siswa'):
                student_class_id = classes_map.get(r['kelas_siswa'])
                if not student_class_id:
                    errors.append(f"Baris {r['_row']}: kelas '{r['kelas_siswa']}' tidak ditemukan"); continue
            if 'wali_kelas' in r['roles'] and r.get('wali_kelas'):
                homeroom_class_id = classes_map.get(r['wali_kelas'])
                if not homeroom_class_id:
                    errors.append(f"Baris {r['_row']}: wali_kelas '{r['wali_kelas']}' tidak ditemukan"); continue
            u = UserModel(
                username=r['username'], password_hash=hash_password(r['password']),
                full_name=r['full_name'], roles=r['roles'],
                nip_nuptk=r.get('nip_nuptk'), nisn=r.get('nisn'),
                email=r.get('email'), phone=r.get('phone'), gender=r.get('gender'),
                student_class_id=student_class_id,
                homeroom_class_id=homeroom_class_id,
            )
            doc = u.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            new_docs.append(doc)
            success += 1
            if homeroom_class_id:
                await db.classes.update_one({'id': homeroom_class_id}, {'$set': {'homeroom_teacher_id': u.id}})
        except Exception as e:
            errors.append(f"Baris {r['_row']}: {e}")
    if new_docs:
        await db.users.insert_many(new_docs)
    await log_audit(user, 'import_excel', 'user', None,
                    details={'success': success, 'errors': len(errors), 'filename': file.filename}, request=request)
    return {'success': success, 'errors': errors, 'total_rows': len(rows)}


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
