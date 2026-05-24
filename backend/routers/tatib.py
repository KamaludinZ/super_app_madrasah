"""API endpoints for Tata Tertib (Discipline & Code of Conduct) Management."""
from typing import Dict, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
import uuid
import pandas as pd
import io

from core import db, get_current_user, require_role, serialize_doc, log_audit

router = APIRouter()


# ============================================================
# REQUEST MODELS
# ============================================================

class KategoriTatibRequest(BaseModel):
    """Request model for creating/updating kategori tata tertib."""
    nama: str
    deskripsi: Optional[str] = None
    urutan: Optional[int] = 0


class JenisTatibRequest(BaseModel):
    """Request model for creating/updating jenis tata tertib."""
    kategori_id: str
    nama: str
    deskripsi: Optional[str] = None
    urutan: Optional[int] = 0


class TatibRequest(BaseModel):
    """Request model for creating/updating tata tertib."""
    kategori_id: str
    jenis_id: str
    kode: str
    nama_aturan: str
    deskripsi: Optional[str] = None
    poin: int  # Positive for prestasi, negative for pelanggaran
    tingkat_kelas: Optional[str] = None  # e.g., "7", "8", "9", or empty for all
    is_active: bool = True


class PenangananRequest(BaseModel):
    """Request model for recording pelanggaran or prestasi."""
    siswa_id: str
    tatib_id: str
    tanggal: str  # ISO format
    tahun_takwim_id: Optional[str] = None
    tahun_pelajaran_id: Optional[str] = None
    semester: Optional[str] = None
    catatan: Optional[str] = None
    bukti_url: Optional[str] = None  # Photo/document evidence


# ============================================================
# KATEGORI ENDPOINTS
# ============================================================

@router.get("/tatib/kategori")
async def list_kategori(user: Dict = Depends(get_current_user)):
    """List all kategori tata tertib."""
    items = await db.tatib_kategori.find({}, {'_id': 0}).sort('urutan', 1).to_list(1000)
    return [serialize_doc(i) for i in items]


@router.get("/tatib/kategori/{kategori_id}")
async def get_kategori(kategori_id: str, user: Dict = Depends(get_current_user)):
    """Get a specific kategori."""
    doc = await db.tatib_kategori.find_one({'id': kategori_id}, {'_id': 0})
    if not doc:
        raise HTTPException(404, "Kategori tidak ditemukan")
    return serialize_doc(doc)


@router.post("/tatib/kategori")
async def create_kategori(req: KategoriTatibRequest, user: Dict = Depends(require_role('admin'))):
    """Create a new kategori tata tertib."""
    doc = {
        'id': str(uuid.uuid4()),
        'nama': req.nama,
        'deskripsi': req.deskripsi,
        'urutan': req.urutan,
        'created_by': user['id'],
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }

    await db.tatib_kategori.insert_one(doc)
    await log_audit(user['id'], 'tatib_kategori_create', f"Created kategori: {req.nama}")
    return serialize_doc(doc)


@router.put("/tatib/kategori/{kategori_id}")
async def update_kategori(kategori_id: str, req: KategoriTatibRequest, user: Dict = Depends(require_role('admin'))):
    """Update a kategori."""
    existing = await db.tatib_kategori.find_one({'id': kategori_id})
    if not existing:
        raise HTTPException(404, "Kategori tidak ditemukan")

    update_data = {k: v for k, v in req.model_dump(exclude_unset=True).items() if v is not None}
    update_data['updated_at'] = datetime.utcnow().isoformat()

    await db.tatib_kategori.update_one({'id': kategori_id}, {'$set': update_data})
    await log_audit(user['id'], 'tatib_kategori_update', f"Updated kategori: {kategori_id}")

    updated = await db.tatib_kategori.find_one({'id': kategori_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/tatib/kategori/{kategori_id}")
async def delete_kategori(kategori_id: str, user: Dict = Depends(require_role('admin'))):
    """Delete a kategori."""
    existing = await db.tatib_kategori.find_one({'id': kategori_id})
    if not existing:
        raise HTTPException(404, "Kategori tidak ditemukan")

    # Check if any jenis or tatib uses this kategori
    jenis_count = await db.tatib_jenis.count_documents({'kategori_id': kategori_id})
    tatib_count = await db.tatib_aturan.count_documents({'kategori_id': kategori_id})

    if jenis_count > 0 or tatib_count > 0:
        raise HTTPException(400, f"Kategori masih digunakan oleh {jenis_count} jenis dan {tatib_count} aturan")

    await db.tatib_kategori.delete_one({'id': kategori_id})
    await log_audit(user['id'], 'tatib_kategori_delete', f"Deleted kategori: {kategori_id}")
    return {'message': 'Kategori berhasil dihapus'}


# ============================================================
# JENIS ENDPOINTS
# ============================================================

@router.get("/tatib/jenis")
async def list_jenis(kategori_id: Optional[str] = None, user: Dict = Depends(get_current_user)):
    """List all jenis tata tertib, optionally filtered by kategori."""
    query = {}
    if kategori_id:
        query['kategori_id'] = kategori_id

    items = await db.tatib_jenis.find(query, {'_id': 0}).sort('urutan', 1).to_list(1000)
    return [serialize_doc(i) for i in items]


@router.post("/tatib/jenis")
async def create_jenis(req: JenisTatibRequest, user: Dict = Depends(require_role('admin'))):
    """Create a new jenis tata tertib."""
    # Verify kategori exists
    kategori = await db.tatib_kategori.find_one({'id': req.kategori_id})
    if not kategori:
        raise HTTPException(404, "Kategori tidak ditemukan")

    doc = {
        'id': str(uuid.uuid4()),
        'kategori_id': req.kategori_id,
        'kategori_nama': kategori.get('nama'),
        'nama': req.nama,
        'deskripsi': req.deskripsi,
        'urutan': req.urutan,
        'created_by': user['id'],
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }

    await db.tatib_jenis.insert_one(doc)
    await log_audit(user['id'], 'tatib_jenis_create', f"Created jenis: {req.nama}")
    return serialize_doc(doc)


@router.put("/tatib/jenis/{jenis_id}")
async def update_jenis(jenis_id: str, req: JenisTatibRequest, user: Dict = Depends(require_role('admin'))):
    """Update a jenis."""
    existing = await db.tatib_jenis.find_one({'id': jenis_id})
    if not existing:
        raise HTTPException(404, "Jenis tidak ditemukan")

    # If kategori changed, verify new kategori exists
    if req.kategori_id != existing.get('kategori_id'):
        kategori = await db.tatib_kategori.find_one({'id': req.kategori_id})
        if not kategori:
            raise HTTPException(404, "Kategori baru tidak ditemukan")
        update_data = {
            'kategori_id': req.kategori_id,
            'kategori_nama': kategori.get('nama'),
        }
    else:
        update_data = {}

    update_data.update({k: v for k, v in req.model_dump(exclude_unset=True).items() if v is not None and k != 'kategori_id'})
    update_data['updated_at'] = datetime.utcnow().isoformat()

    await db.tatib_jenis.update_one({'id': jenis_id}, {'$set': update_data})
    await log_audit(user['id'], 'tatib_jenis_update', f"Updated jenis: {jenis_id}")

    updated = await db.tatib_jenis.find_one({'id': jenis_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/tatib/jenis/{jenis_id}")
async def delete_jenis(jenis_id: str, user: Dict = Depends(require_role('admin'))):
    """Delete a jenis."""
    existing = await db.tatib_jenis.find_one({'id': jenis_id})
    if not existing:
        raise HTTPException(404, "Jenis tidak ditemukan")

    # Check if any tatib uses this jenis
    tatib_count = await db.tatib_aturan.count_documents({'jenis_id': jenis_id})
    if tatib_count > 0:
        raise HTTPException(400, f"Jenis masih digunakan oleh {tatib_count} aturan")

    await db.tatib_jenis.delete_one({'id': jenis_id})
    await log_audit(user['id'], 'tatib_jenis_delete', f"Deleted jenis: {jenis_id}")
    return {'message': 'Jenis berhasil dihapus'}


# ============================================================
# TATA TERTIB (ATURAN) ENDPOINTS
# ============================================================

@router.get("/tatib/aturan")
async def list_aturan(
    kategori_id: Optional[str] = None,
    jenis_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    user: Dict = Depends(get_current_user)
):
    """List all tata tertib rules."""
    query = {}
    if kategori_id:
        query['kategori_id'] = kategori_id
    if jenis_id:
        query['jenis_id'] = jenis_id
    if is_active is not None:
        query['is_active'] = is_active

    items = await db.tatib_aturan.find(query, {'_id': 0}).sort([('kategori_id', 1), ('jenis_id', 1), ('kode', 1)]).to_list(1000)
    return [serialize_doc(i) for i in items]


@router.get("/tatib/aturan/{aturan_id}")
async def get_aturan(aturan_id: str, user: Dict = Depends(get_current_user)):
    """Get a specific tata tertib rule."""
    doc = await db.tatib_aturan.find_one({'id': aturan_id}, {'_id': 0})
    if not doc:
        raise HTTPException(404, "Aturan tidak ditemukan")
    return serialize_doc(doc)


@router.post("/tatib/aturan")
async def create_aturan(req: TatibRequest, user: Dict = Depends(require_role('admin'))):
    """Create a new tata tertib rule."""
    # Verify kategori and jenis exist
    kategori = await db.tatib_kategori.find_one({'id': req.kategori_id})
    if not kategori:
        raise HTTPException(404, "Kategori tidak ditemukan")

    jenis = await db.tatib_jenis.find_one({'id': req.jenis_id})
    if not jenis:
        raise HTTPException(404, "Jenis tidak ditemukan")

    # Check for duplicate kode
    existing = await db.tatib_aturan.find_one({'kode': req.kode})
    if existing:
        raise HTTPException(400, f"Kode '{req.kode}' sudah digunakan")

    doc = {
        'id': str(uuid.uuid4()),
        'kategori_id': req.kategori_id,
        'kategori_nama': kategori.get('nama'),
        'jenis_id': req.jenis_id,
        'jenis_nama': jenis.get('nama'),
        'kode': req.kode,
        'nama_aturan': req.nama_aturan,
        'deskripsi': req.deskripsi,
        'poin': req.poin,
        'tingkat_kelas': req.tingkat_kelas,
        'is_active': req.is_active,
        'created_by': user['id'],
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }

    await db.tatib_aturan.insert_one(doc)
    await log_audit(user['id'], 'tatib_aturan_create', f"Created aturan: {req.kode} - {req.nama_aturan}")
    return serialize_doc(doc)


@router.put("/tatib/aturan/{aturan_id}")
async def update_aturan(aturan_id: str, req: TatibRequest, user: Dict = Depends(require_role('admin'))):
    """Update a tata tertib rule."""
    existing = await db.tatib_aturan.find_one({'id': aturan_id})
    if not existing:
        raise HTTPException(404, "Aturan tidak ditemukan")

    # Check for duplicate kode (excluding current aturan)
    if req.kode != existing.get('kode'):
        duplicate = await db.tatib_aturan.find_one({'kode': req.kode})
        if duplicate:
            raise HTTPException(400, f"Kode '{req.kode}' sudah digunakan")

    # Verify kategori and jenis if changed
    update_data = {}
    if req.kategori_id != existing.get('kategori_id'):
        kategori = await db.tatib_kategori.find_one({'id': req.kategori_id})
        if not kategori:
            raise HTTPException(404, "Kategori tidak ditemukan")
        update_data['kategori_nama'] = kategori.get('nama')

    if req.jenis_id != existing.get('jenis_id'):
        jenis = await db.tatib_jenis.find_one({'id': req.jenis_id})
        if not jenis:
            raise HTTPException(404, "Jenis tidak ditemukan")
        update_data['jenis_nama'] = jenis.get('nama')

    update_data.update(req.model_dump(exclude_unset=True))
    update_data['updated_at'] = datetime.utcnow().isoformat()

    await db.tatib_aturan.update_one({'id': aturan_id}, {'$set': update_data})
    await log_audit(user['id'], 'tatib_aturan_update', f"Updated aturan: {aturan_id}")

    updated = await db.tatib_aturan.find_one({'id': aturan_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/tatib/aturan/{aturan_id}")
async def delete_aturan(aturan_id: str, user: Dict = Depends(require_role('admin'))):
    """Delete a tata tertib rule."""
    existing = await db.tatib_aturan.find_one({'id': aturan_id})
    if not existing:
        raise HTTPException(404, "Aturan tidak ditemukan")

    # Check if any penanganan uses this aturan
    penanganan_count = await db.tatib_penanganan.count_documents({'tatib_id': aturan_id})
    if penanganan_count > 0:
        raise HTTPException(400, f"Aturan masih digunakan oleh {penanganan_count} data penanganan")

    await db.tatib_aturan.delete_one({'id': aturan_id})
    await log_audit(user['id'], 'tatib_aturan_delete', f"Deleted aturan: {aturan_id}")
    return {'message': 'Aturan berhasil dihapus'}


# ============================================================
# IMPORT EXCEL ENDPOINT
# ============================================================

@router.post("/tatib/aturan/import")
async def import_aturan_excel(
    file: UploadFile = File(...),
    user: Dict = Depends(require_role('admin'))
):
    """
    Import tata tertib rules from Excel.
    Expected columns: kode, nama_aturan, kategori_id, jenis_id, poin, deskripsi, tingkat_kelas
    """
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(400, "File harus berformat Excel (.xlsx atau .xls)")

    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))

        # Validate required columns
        required_cols = ['kode', 'nama_aturan', 'kategori_id', 'jenis_id', 'poin']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            raise HTTPException(400, f"Kolom yang hilang: {', '.join(missing_cols)}")

        imported = 0
        errors = []

        for idx, row in df.iterrows():
            try:
                # Verify kategori and jenis
                kategori = await db.tatib_kategori.find_one({'id': row['kategori_id']})
                if not kategori:
                    errors.append(f"Baris {idx + 2}: Kategori ID '{row['kategori_id']}' tidak ditemukan")
                    continue

                jenis = await db.tatib_jenis.find_one({'id': row['jenis_id']})
                if not jenis:
                    errors.append(f"Baris {idx + 2}: Jenis ID '{row['jenis_id']}' tidak ditemukan")
                    continue

                # Check for duplicate kode
                existing = await db.tatib_aturan.find_one({'kode': row['kode']})
                if existing:
                    errors.append(f"Baris {idx + 2}: Kode '{row['kode']}' sudah ada")
                    continue

                doc = {
                    'id': str(uuid.uuid4()),
                    'kategori_id': row['kategori_id'],
                    'kategori_nama': kategori.get('nama'),
                    'jenis_id': row['jenis_id'],
                    'jenis_nama': jenis.get('nama'),
                    'kode': row['kode'],
                    'nama_aturan': row['nama_aturan'],
                    'deskripsi': row.get('deskripsi', ''),
                    'poin': int(row['poin']),
                    'tingkat_kelas': row.get('tingkat_kelas', ''),
                    'is_active': True,
                    'created_by': user['id'],
                    'created_at': datetime.utcnow().isoformat(),
                    'updated_at': datetime.utcnow().isoformat(),
                }

                await db.tatib_aturan.insert_one(doc)
                imported += 1

            except Exception as e:
                errors.append(f"Baris {idx + 2}: {str(e)}")

        await log_audit(user['id'], 'tatib_aturan_import', f"Imported {imported} aturan from Excel")

        return {
            'imported': imported,
            'errors': errors,
            'total_rows': len(df)
        }

    except Exception as e:
        raise HTTPException(400, f"Error membaca file Excel: {str(e)}")


# ============================================================
# PENANGANAN (PELANGGARAN & PRESTASI) ENDPOINTS
# ============================================================

@router.get("/tatib/penanganan")
async def list_penanganan(
    siswa_id: Optional[str] = None,
    tatib_id: Optional[str] = None,
    tahun_takwim_id: Optional[str] = None,
    tahun_pelajaran_id: Optional[str] = None,
    semester: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: Dict = Depends(get_current_user)
):
    """List all penanganan (violations and achievements)."""
    query = {}
    if siswa_id:
        query['siswa_id'] = siswa_id
    if tatib_id:
        query['tatib_id'] = tatib_id
    if tahun_takwim_id:
        query['tahun_takwim_id'] = tahun_takwim_id
    if tahun_pelajaran_id:
        query['tahun_pelajaran_id'] = tahun_pelajaran_id
    if semester:
        query['semester'] = semester

    # Date range filter
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query['$gte'] = start_date
        if end_date:
            date_query['$lte'] = end_date
        if date_query:
            query['tanggal'] = date_query

    items = await db.tatib_penanganan.find(query, {'_id': 0}).sort('tanggal', -1).to_list(1000)
    return [serialize_doc(i) for i in items]


@router.get("/tatib/penanganan/{penanganan_id}")
async def get_penanganan(penanganan_id: str, user: Dict = Depends(get_current_user)):
    """Get a specific penanganan."""
    doc = await db.tatib_penanganan.find_one({'id': penanganan_id}, {'_id': 0})
    if not doc:
        raise HTTPException(404, "Penanganan tidak ditemukan")
    return serialize_doc(doc)


@router.post("/tatib/penanganan")
async def create_penanganan(req: PenangananRequest, user: Dict = Depends(get_current_user)):
    """Record a new pelanggaran or prestasi."""
    # Verify siswa exists
    siswa = await db.students.find_one({'id': req.siswa_id})
    if not siswa:
        raise HTTPException(404, "Siswa tidak ditemukan")

    # Verify tatib exists
    tatib = await db.tatib_aturan.find_one({'id': req.tatib_id})
    if not tatib:
        raise HTTPException(404, "Aturan tata tertib tidak ditemukan")

    doc = {
        'id': str(uuid.uuid4()),
        'siswa_id': req.siswa_id,
        'siswa_nama': siswa.get('full_name'),
        'siswa_nis': siswa.get('nis'),
        'siswa_nisn': siswa.get('nisn'),
        'siswa_kelas': siswa.get('class_name'),
        'tatib_id': req.tatib_id,
        'tatib_kode': tatib.get('kode'),
        'tatib_nama': tatib.get('nama_aturan'),
        'tatib_poin': tatib.get('poin'),
        'kategori_nama': tatib.get('kategori_nama'),
        'jenis_nama': tatib.get('jenis_nama'),
        'tanggal': req.tanggal,
        'tahun_takwim_id': req.tahun_takwim_id,
        'tahun_pelajaran_id': req.tahun_pelajaran_id,
        'semester': req.semester,
        'catatan': req.catatan,
        'bukti_url': req.bukti_url,
        'petugas_id': user['id'],
        'petugas_nama': user.get('full_name', user.get('username')),
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }

    await db.tatib_penanganan.insert_one(doc)

    action_type = "prestasi" if tatib.get('poin', 0) > 0 else "pelanggaran"
    await log_audit(
        user['id'],
        'tatib_penanganan_create',
        f"Recorded {action_type} for {siswa.get('full_name')}: {tatib.get('nama_aturan')}"
    )

    return serialize_doc(doc)


@router.put("/tatib/penanganan/{penanganan_id}")
async def update_penanganan(penanganan_id: str, req: PenangananRequest, user: Dict = Depends(get_current_user)):
    """Update a penanganan record."""
    existing = await db.tatib_penanganan.find_one({'id': penanganan_id})
    if not existing:
        raise HTTPException(404, "Penanganan tidak ditemukan")

    # Verify siswa and tatib if changed
    update_data = {}

    if req.siswa_id != existing.get('siswa_id'):
        siswa = await db.students.find_one({'id': req.siswa_id})
        if not siswa:
            raise HTTPException(404, "Siswa tidak ditemukan")
        update_data.update({
            'siswa_nama': siswa.get('full_name'),
            'siswa_nis': siswa.get('nis'),
            'siswa_nisn': siswa.get('nisn'),
            'siswa_kelas': siswa.get('class_name'),
        })

    if req.tatib_id != existing.get('tatib_id'):
        tatib = await db.tatib_aturan.find_one({'id': req.tatib_id})
        if not tatib:
            raise HTTPException(404, "Aturan tidak ditemukan")
        update_data.update({
            'tatib_kode': tatib.get('kode'),
            'tatib_nama': tatib.get('nama_aturan'),
            'tatib_poin': tatib.get('poin'),
            'kategori_nama': tatib.get('kategori_nama'),
            'jenis_nama': tatib.get('jenis_nama'),
        })

    update_data.update(req.model_dump(exclude_unset=True))
    update_data['updated_at'] = datetime.utcnow().isoformat()

    await db.tatib_penanganan.update_one({'id': penanganan_id}, {'$set': update_data})
    await log_audit(user['id'], 'tatib_penanganan_update', f"Updated penanganan: {penanganan_id}")

    updated = await db.tatib_penanganan.find_one({'id': penanganan_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/tatib/penanganan/{penanganan_id}")
async def delete_penanganan(penanganan_id: str, user: Dict = Depends(require_role('admin'))):
    """Delete a penanganan record."""
    existing = await db.tatib_penanganan.find_one({'id': penanganan_id})
    if not existing:
        raise HTTPException(404, "Penanganan tidak ditemukan")

    await db.tatib_penanganan.delete_one({'id': penanganan_id})
    await log_audit(user['id'], 'tatib_penanganan_delete', f"Deleted penanganan: {penanganan_id}")
    return {'message': 'Penanganan berhasil dihapus'}


# ============================================================
# STATISTICS / REKAPITULASI ENDPOINTS
# ============================================================

@router.get("/tatib/stats/siswa/{siswa_id}")
async def get_siswa_stats(
    siswa_id: str,
    tahun_takwim_id: Optional[str] = None,
    tahun_pelajaran_id: Optional[str] = None,
    semester: Optional[str] = None,
    user: Dict = Depends(get_current_user)
):
    """Get tatib statistics for a specific student."""
    query = {'siswa_id': siswa_id}
    if tahun_takwim_id:
        query['tahun_takwim_id'] = tahun_takwim_id
    if tahun_pelajaran_id:
        query['tahun_pelajaran_id'] = tahun_pelajaran_id
    if semester:
        query['semester'] = semester

    records = await db.tatib_penanganan.find(query, {'_id': 0}).to_list(1000)

    total_poin = sum(r.get('tatib_poin', 0) for r in records)
    total_pelanggaran = sum(1 for r in records if r.get('tatib_poin', 0) < 0)
    total_prestasi = sum(1 for r in records if r.get('tatib_poin', 0) > 0)

    # Group by kategori
    by_kategori = {}
    for r in records:
        kat = r.get('kategori_nama', 'Lainnya')
        if kat not in by_kategori:
            by_kategori[kat] = {'count': 0, 'total_poin': 0}
        by_kategori[kat]['count'] += 1
        by_kategori[kat]['total_poin'] += r.get('tatib_poin', 0)

    return {
        'siswa_id': siswa_id,
        'total_records': len(records),
        'total_poin': total_poin,
        'total_pelanggaran': total_pelanggaran,
        'total_prestasi': total_prestasi,
        'by_kategori': by_kategori,
        'records': [serialize_doc(r) for r in records]
    }


@router.get("/tatib/stats/summary")
async def get_summary_stats(
    tahun_takwim_id: Optional[str] = None,
    tahun_pelajaran_id: Optional[str] = None,
    semester: Optional[str] = None,
    kelas: Optional[str] = None,
    user: Dict = Depends(require_role('admin'))
):
    """Get overall tatib statistics summary."""
    query = {}
    if tahun_takwim_id:
        query['tahun_takwim_id'] = tahun_takwim_id
    if tahun_pelajaran_id:
        query['tahun_pelajaran_id'] = tahun_pelajaran_id
    if semester:
        query['semester'] = semester
    if kelas:
        query['siswa_kelas'] = kelas

    records = await db.tatib_penanganan.find(query, {'_id': 0}).to_list(10000)

    total_records = len(records)
    total_pelanggaran = sum(1 for r in records if r.get('tatib_poin', 0) < 0)
    total_prestasi = sum(1 for r in records if r.get('tatib_poin', 0) > 0)

    # Top violators (most negative points)
    siswa_poin = {}
    for r in records:
        sid = r.get('siswa_id')
        if sid not in siswa_poin:
            siswa_poin[sid] = {
                'siswa_id': sid,
                'siswa_nama': r.get('siswa_nama'),
                'siswa_kelas': r.get('siswa_kelas'),
                'total_poin': 0,
                'count_pelanggaran': 0,
                'count_prestasi': 0
            }
        poin = r.get('tatib_poin', 0)
        siswa_poin[sid]['total_poin'] += poin
        if poin < 0:
            siswa_poin[sid]['count_pelanggaran'] += 1
        elif poin > 0:
            siswa_poin[sid]['count_prestasi'] += 1

    # Sort by total points (ascending for top violators)
    top_violators = sorted(siswa_poin.values(), key=lambda x: x['total_poin'])[:10]
    top_achievers = sorted(siswa_poin.values(), key=lambda x: x['total_poin'], reverse=True)[:10]

    # By kategori
    by_kategori = {}
    for r in records:
        kat = r.get('kategori_nama', 'Lainnya')
        if kat not in by_kategori:
            by_kategori[kat] = {'count': 0, 'pelanggaran': 0, 'prestasi': 0}
        by_kategori[kat]['count'] += 1
        if r.get('tatib_poin', 0) < 0:
            by_kategori[kat]['pelanggaran'] += 1
        else:
            by_kategori[kat]['prestasi'] += 1

    return {
        'total_records': total_records,
        'total_pelanggaran': total_pelanggaran,
        'total_prestasi': total_prestasi,
        'by_kategori': by_kategori,
        'top_violators': top_violators,
        'top_achievers': top_achievers
    }
