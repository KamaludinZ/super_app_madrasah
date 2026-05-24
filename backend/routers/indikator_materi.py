"""API endpoints for KD/Indikator and Materi/Pokok Bahasan."""
from typing import Dict, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
import uuid
import pandas as pd
import io

from core import db, get_current_user, require_role, serialize_doc, log_audit

router = APIRouter()


class IndikatorCreateRequest(BaseModel):
    """Request model for creating KD/Indikator."""
    kode: str
    nama: str
    mapel_id: str
    semester_id: str
    tingkat_kelas: Optional[str] = None  # e.g., "VII", "VIII", "IX"


class IndikatorUpdateRequest(BaseModel):
    """Request model for updating KD/Indikator."""
    kode: Optional[str] = None
    nama: Optional[str] = None
    mapel_id: Optional[str] = None
    semester_id: Optional[str] = None
    tingkat_kelas: Optional[str] = None


class MateriCreateRequest(BaseModel):
    """Request model for creating Materi/Pokok Bahasan."""
    nama: str
    deskripsi: Optional[str] = None
    mapel_id: str
    semester_id: str
    tingkat_kelas: Optional[str] = None
    indikator_id: Optional[str] = None  # Link to related KD/Indikator


class MateriUpdateRequest(BaseModel):
    """Request model for updating Materi/Pokok Bahasan."""
    nama: Optional[str] = None
    deskripsi: Optional[str] = None
    mapel_id: Optional[str] = None
    semester_id: Optional[str] = None
    tingkat_kelas: Optional[str] = None
    indikator_id: Optional[str] = None


# ============================================================
# KD/INDIKATOR ENDPOINTS
# ============================================================

@router.get("/indikator")
async def list_indikator(
    semester_id: Optional[str] = None,
    mapel_id: Optional[str] = None,
    guru_id: Optional[str] = None,
    user: Dict = Depends(get_current_user)
):
    """List all KD/Indikator with optional filters."""
    query = {}

    # If guru_id is provided, filter by guru (for admin view)
    if guru_id:
        query['created_by'] = guru_id
    # If user is guru (not admin), only show their own data
    elif 'guru' in user.get('roles', []) and 'admin' not in user.get('roles', []):
        query['created_by'] = user['id']

    if semester_id:
        query['semester_id'] = semester_id
    if mapel_id:
        query['mapel_id'] = mapel_id

    items = await db.indikator.find(query, {'_id': 0}).sort('created_at', -1).to_list(1000)
    return [serialize_doc(i) for i in items]


@router.get("/indikator/{indikator_id}")
async def get_indikator(indikator_id: str, user: Dict = Depends(get_current_user)):
    """Get a specific KD/Indikator by ID."""
    doc = await db.indikator.find_one({'id': indikator_id}, {'_id': 0})
    if not doc:
        raise HTTPException(404, "Indikator tidak ditemukan")
    return serialize_doc(doc)


@router.post("/indikator")
async def create_indikator(req: IndikatorCreateRequest, user: Dict = Depends(get_current_user)):
    """Create a new KD/Indikator."""
    # Check if user is guru or admin
    if 'guru' not in user.get('roles', []) and 'admin' not in user.get('roles', []):
        raise HTTPException(403, "Hanya guru atau admin yang dapat membuat indikator")

    doc = {
        'id': str(uuid.uuid4()),
        'kode': req.kode,
        'nama': req.nama,
        'mapel_id': req.mapel_id,
        'semester_id': req.semester_id,
        'tingkat_kelas': req.tingkat_kelas,
        'created_by': user['id'],
        'created_by_name': user.get('full_name', user.get('username')),
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }

    await db.indikator.insert_one(doc)
    return serialize_doc(doc)


@router.put("/indikator/{indikator_id}")
async def update_indikator(indikator_id: str, req: IndikatorUpdateRequest, user: Dict = Depends(get_current_user)):
    """Update an existing KD/Indikator."""
    existing = await db.indikator.find_one({'id': indikator_id})
    if not existing:
        raise HTTPException(404, "Indikator tidak ditemukan")

    # Check permission: owner or admin
    if existing.get('created_by') != user['id'] and 'admin' not in user.get('roles', []):
        raise HTTPException(403, "Anda tidak memiliki izin untuk mengubah indikator ini")

    update_data = {k: v for k, v in req.model_dump(exclude_unset=True).items() if v is not None}
    update_data['updated_at'] = datetime.utcnow().isoformat()

    await db.indikator.update_one({'id': indikator_id}, {'$set': update_data})

    updated = await db.indikator.find_one({'id': indikator_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/indikator/{indikator_id}")
async def delete_indikator(indikator_id: str, user: Dict = Depends(get_current_user)):
    """Delete a KD/Indikator."""
    existing = await db.indikator.find_one({'id': indikator_id})
    if not existing:
        raise HTTPException(404, "Indikator tidak ditemukan")

    # Check permission: owner or admin
    if existing.get('created_by') != user['id'] and 'admin' not in user.get('roles', []):
        raise HTTPException(403, "Anda tidak memiliki izin untuk menghapus indikator ini")

    await db.indikator.delete_one({'id': indikator_id})
    return {'message': 'Indikator berhasil dihapus'}


# ============================================================
# MATERI/POKOK BAHASAN ENDPOINTS
# ============================================================

@router.get("/materi")
async def list_materi(
    semester_id: Optional[str] = None,
    mapel_id: Optional[str] = None,
    guru_id: Optional[str] = None,
    user: Dict = Depends(get_current_user)
):
    """List all Materi/Pokok Bahasan with optional filters."""
    query = {}

    # If guru_id is provided, filter by guru (for admin view)
    if guru_id:
        query['created_by'] = guru_id
    # If user is guru (not admin), only show their own data
    elif 'guru' in user.get('roles', []) and 'admin' not in user.get('roles', []):
        query['created_by'] = user['id']

    if semester_id:
        query['semester_id'] = semester_id
    if mapel_id:
        query['mapel_id'] = mapel_id

    items = await db.materi.find(query, {'_id': 0}).sort('created_at', -1).to_list(1000)
    return [serialize_doc(i) for i in items]


@router.get("/materi/{materi_id}")
async def get_materi(materi_id: str, user: Dict = Depends(get_current_user)):
    """Get a specific Materi by ID."""
    doc = await db.materi.find_one({'id': materi_id}, {'_id': 0})
    if not doc:
        raise HTTPException(404, "Materi tidak ditemukan")
    return serialize_doc(doc)


@router.post("/materi")
async def create_materi(req: MateriCreateRequest, user: Dict = Depends(get_current_user)):
    """Create a new Materi/Pokok Bahasan."""
    # Check if user is guru or admin
    if 'guru' not in user.get('roles', []) and 'admin' not in user.get('roles', []):
        raise HTTPException(403, "Hanya guru atau admin yang dapat membuat materi")

    doc = {
        'id': str(uuid.uuid4()),
        'nama': req.nama,
        'deskripsi': req.deskripsi,
        'mapel_id': req.mapel_id,
        'semester_id': req.semester_id,
        'tingkat_kelas': req.tingkat_kelas,
        'indikator_id': req.indikator_id,
        'created_by': user['id'],
        'created_by_name': user.get('full_name', user.get('username')),
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }

    await db.materi.insert_one(doc)
    return serialize_doc(doc)


@router.put("/materi/{materi_id}")
async def update_materi(materi_id: str, req: MateriUpdateRequest, user: Dict = Depends(get_current_user)):
    """Update an existing Materi."""
    existing = await db.materi.find_one({'id': materi_id})
    if not existing:
        raise HTTPException(404, "Materi tidak ditemukan")

    # Check permission: owner or admin
    if existing.get('created_by') != user['id'] and 'admin' not in user.get('roles', []):
        raise HTTPException(403, "Anda tidak memiliki izin untuk mengubah materi ini")

    update_data = {k: v for k, v in req.model_dump(exclude_unset=True).items() if v is not None}
    update_data['updated_at'] = datetime.utcnow().isoformat()

    await db.materi.update_one({'id': materi_id}, {'$set': update_data})

    updated = await db.materi.find_one({'id': materi_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/materi/{materi_id}")
async def delete_materi(materi_id: str, user: Dict = Depends(get_current_user)):
    """Delete a Materi."""
    existing = await db.materi.find_one({'id': materi_id})
    if not existing:
        raise HTTPException(404, "Materi tidak ditemukan")

    # Check permission: owner or admin
    if existing.get('created_by') != user['id'] and 'admin' not in user.get('roles', []):
        raise HTTPException(403, "Anda tidak memiliki izin untuk menghapus materi ini")

    await db.materi.delete_one({'id': materi_id})
    return {'message': 'Materi berhasil dihapus'}


# ============================================================
# IMPORT ENDPOINTS
# ============================================================

@router.post("/indikator/import")
async def import_indikator(
    file: UploadFile = File(...),
    user: Dict = Depends(get_current_user)
):
    """
    Import indikator from CSV/Excel file.
    Expected columns: kode, nama, mapel_id, tingkat_kelas, semester_id
    """
    # Check if user is guru or admin
    if 'guru' not in user.get('roles', []) and 'admin' not in user.get('roles', []):
        raise HTTPException(403, "Hanya guru atau admin yang dapat mengimpor indikator")

    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(400, "File harus berformat Excel (.xlsx, .xls) atau CSV (.csv)")

    try:
        contents = await file.read()

        # Parse file based on extension
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))

        # Validate required columns
        required_cols = ['kode', 'nama', 'mapel_id', 'semester_id']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            raise HTTPException(400, f"Kolom yang hilang: {', '.join(missing_cols)}")

        imported = 0
        errors = []

        for idx, row in df.iterrows():
            try:
                # Verify mapel exists
                mapel = await db.subjects.find_one({'id': row['mapel_id']})
                if not mapel:
                    errors.append(f"Baris {idx + 2}: Mata Pelajaran ID '{row['mapel_id']}' tidak ditemukan")
                    continue

                # Verify semester exists
                semester = await db.semesters.find_one({'id': row['semester_id']})
                if not semester:
                    errors.append(f"Baris {idx + 2}: Semester ID '{row['semester_id']}' tidak ditemukan")
                    continue

                # Check for duplicate kode for this user
                existing = await db.indikator.find_one({
                    'kode': row['kode'],
                    'created_by': user['id'],
                    'mapel_id': row['mapel_id'],
                    'semester_id': row['semester_id']
                })
                if existing:
                    errors.append(f"Baris {idx + 2}: Indikator dengan kode '{row['kode']}' sudah ada")
                    continue

                doc = {
                    'id': str(uuid.uuid4()),
                    'kode': str(row['kode']),
                    'nama': str(row['nama']),
                    'mapel_id': str(row['mapel_id']),
                    'semester_id': str(row['semester_id']),
                    'tingkat_kelas': str(row.get('tingkat_kelas', '')) if pd.notna(row.get('tingkat_kelas')) else '',
                    'created_by': user['id'],
                    'created_by_name': user.get('full_name', user.get('username')),
                    'created_at': datetime.utcnow().isoformat(),
                    'updated_at': datetime.utcnow().isoformat(),
                }

                await db.indikator.insert_one(doc)
                imported += 1

            except Exception as e:
                errors.append(f"Baris {idx + 2}: {str(e)}")

        return {
            'imported': imported,
            'errors': errors,
            'total_rows': len(df)
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Gagal memproses file: {str(e)}")


@router.post("/materi/import")
async def import_materi(
    file: UploadFile = File(...),
    user: Dict = Depends(get_current_user)
):
    """
    Import materi from CSV/Excel file.
    Expected columns: nama, deskripsi, mapel_id, tingkat_kelas, semester_id, indikator_id (optional)
    """
    # Check if user is guru or admin
    if 'guru' not in user.get('roles', []) and 'admin' not in user.get('roles', []):
        raise HTTPException(403, "Hanya guru atau admin yang dapat mengimpor materi")

    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(400, "File harus berformat Excel (.xlsx, .xls) atau CSV (.csv)")

    try:
        contents = await file.read()

        # Parse file based on extension
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))

        # Validate required columns
        required_cols = ['nama', 'mapel_id', 'semester_id']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            raise HTTPException(400, f"Kolom yang hilang: {', '.join(missing_cols)}")

        imported = 0
        errors = []

        for idx, row in df.iterrows():
            try:
                # Verify mapel exists
                mapel = await db.subjects.find_one({'id': row['mapel_id']})
                if not mapel:
                    errors.append(f"Baris {idx + 2}: Mata Pelajaran ID '{row['mapel_id']}' tidak ditemukan")
                    continue

                # Verify semester exists
                semester = await db.semesters.find_one({'id': row['semester_id']})
                if not semester:
                    errors.append(f"Baris {idx + 2}: Semester ID '{row['semester_id']}' tidak ditemukan")
                    continue

                # Verify indikator if provided
                indikator_id = row.get('indikator_id')
                if pd.notna(indikator_id) and indikator_id:
                    indikator = await db.indikator.find_one({'id': str(indikator_id)})
                    if not indikator:
                        errors.append(f"Baris {idx + 2}: Indikator ID '{indikator_id}' tidak ditemukan")
                        continue
                else:
                    indikator_id = None

                # Check for duplicate nama for this user
                existing = await db.materi.find_one({
                    'nama': row['nama'],
                    'created_by': user['id'],
                    'mapel_id': row['mapel_id'],
                    'semester_id': row['semester_id']
                })
                if existing:
                    errors.append(f"Baris {idx + 2}: Materi dengan nama '{row['nama']}' sudah ada")
                    continue

                doc = {
                    'id': str(uuid.uuid4()),
                    'nama': str(row['nama']),
                    'deskripsi': str(row.get('deskripsi', '')) if pd.notna(row.get('deskripsi')) else '',
                    'mapel_id': str(row['mapel_id']),
                    'semester_id': str(row['semester_id']),
                    'tingkat_kelas': str(row.get('tingkat_kelas', '')) if pd.notna(row.get('tingkat_kelas')) else '',
                    'indikator_id': str(indikator_id) if indikator_id else None,
                    'created_by': user['id'],
                    'created_by_name': user.get('full_name', user.get('username')),
                    'created_at': datetime.utcnow().isoformat(),
                    'updated_at': datetime.utcnow().isoformat(),
                }

                await db.materi.insert_one(doc)
                imported += 1

            except Exception as e:
                errors.append(f"Baris {idx + 2}: {str(e)}")

        return {
            'imported': imported,
            'errors': errors,
            'total_rows': len(df)
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Gagal memproses file: {str(e)}")
