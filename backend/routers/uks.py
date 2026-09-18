"""API endpoints for UKS (Unit Kesehatan Sekolah / School Health Unit) Management."""
from typing import Dict, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import uuid

from core import db, get_current_user, require_role, serialize_doc, log_audit

router = APIRouter()

UKS_ROLES = ('admin', 'unit_kesehatan')


# ============================================================
# REQUEST MODELS
# ============================================================

class JenisPenangananRequest(BaseModel):
    """Request model for a handling/treatment type (e.g., first aid category)."""
    nama: str
    deskripsi: Optional[str] = None
    urutan: Optional[int] = 0


class ObatRequest(BaseModel):
    """Request model for a medicine item in the UKS pharmacy stock."""
    nama_obat: str
    jenis: Optional[str] = None  # e.g., "Tablet", "Sirup", "Salep"
    satuan: Optional[str] = 'pcs'
    stok: int = 0
    stok_minimum: Optional[int] = 0
    tanggal_kadaluarsa: Optional[str] = None
    keterangan: Optional[str] = None


class ObatMasukRequest(BaseModel):
    """Request model for restocking (incoming) medicine."""
    obat_id: str
    tanggal: str
    jumlah: int
    sumber: Optional[str] = None  # e.g., "Pembelian", "Donasi", "Puskesmas"
    keterangan: Optional[str] = None


class ObatKeluarRequest(BaseModel):
    """Request model for dispensed (outgoing) medicine, optionally linked to a kunjungan."""
    obat_id: str
    tanggal: str
    jumlah: int
    kunjungan_id: Optional[str] = None
    penerima_id: Optional[str] = None  # user id (siswa/GTK) receiving the medicine
    keterangan: Optional[str] = None


class KunjunganUKSRequest(BaseModel):
    """Request model for a UKS visit."""
    pasien_id: str  # user id (siswa/guru/tendik)
    tanggal: str
    waktu: Optional[str] = None
    keluhan: str
    jenis_penanganan_id: Optional[str] = None
    penanganan: Optional[str] = None
    kondisi_pulang: Optional[str] = None  # e.g., "Membaik", "Dirujuk", "Dijemput"
    dirujuk_ke: Optional[str] = None
    keterangan: Optional[str] = None


class AsetUKSRequest(BaseModel):
    """Request model for a UKS equipment/asset item."""
    nama_aset: str
    kategori: Optional[str] = None  # e.g., "Alat Medis", "Furniture", "P3K"
    jumlah: int = 1
    kondisi: Optional[str] = 'Baik'  # Baik, Rusak Ringan, Rusak Berat
    lokasi: Optional[str] = None
    tanggal_perolehan: Optional[str] = None
    keterangan: Optional[str] = None


async def _get_user_or_404(user_id: str):
    doc = await db.users.find_one({'id': user_id}, {'_id': 0, 'password_hash': 0})
    if not doc:
        raise HTTPException(404, "Pengguna tidak ditemukan")
    return doc


def _user_fields(prefix: str, u: Dict) -> Dict:
    return {
        f'{prefix}_nama': u.get('full_name'),
        f'{prefix}_identitas': u.get('nis') or u.get('nip_nuptk') or u.get('username'),
        f'{prefix}_roles': u.get('roles'),
    }


async def _get_obat_or_404(obat_id: str):
    doc = await db.uks_obat.find_one({'id': obat_id})
    if not doc:
        raise HTTPException(404, "Data obat tidak ditemukan")
    return doc


# ============================================================
# WARGA MADRASAH LOOKUP (for pasien / penerima picker)
# ============================================================

@router.get("/uks/warga-madrasah")
async def list_warga_madrasah(search: Optional[str] = None, user: Dict = Depends(require_role(*UKS_ROLES))):
    """Minimal lookup of all active users (siswa, guru, tendik) for the patient picker."""
    query = {'is_active': {'$ne': False}}
    if search:
        query['full_name'] = {'$regex': search, '$options': 'i'}

    items = await db.users.find(
        query,
        {'_id': 0, 'id': 1, 'full_name': 1, 'nis': 1, 'nip_nuptk': 1, 'username': 1, 'roles': 1}
    ).sort('full_name', 1).to_list(3000)
    return [serialize_doc(i) for i in items]


# ============================================================
# JENIS PENANGANAN ENDPOINTS
# ============================================================

@router.get("/uks/jenis-penanganan")
async def list_jenis_penanganan(user: Dict = Depends(get_current_user)):
    items = await db.uks_jenis_penanganan.find({}, {'_id': 0}).sort('urutan', 1).to_list(1000)
    return [serialize_doc(i) for i in items]


@router.post("/uks/jenis-penanganan")
async def create_jenis_penanganan(req: JenisPenangananRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        'created_by': user['id'],
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }
    await db.uks_jenis_penanganan.insert_one(doc)
    await log_audit(user['id'], 'uks_jenis_penanganan_create', f"Created jenis penanganan: {req.nama}")
    return serialize_doc(doc)


@router.put("/uks/jenis-penanganan/{item_id}")
async def update_jenis_penanganan(item_id: str, req: JenisPenangananRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    existing = await db.uks_jenis_penanganan.find_one({'id': item_id})
    if not existing:
        raise HTTPException(404, "Jenis penanganan tidak ditemukan")

    update_data = req.model_dump()
    update_data['updated_at'] = datetime.utcnow().isoformat()
    await db.uks_jenis_penanganan.update_one({'id': item_id}, {'$set': update_data})
    await log_audit(user['id'], 'uks_jenis_penanganan_update', f"Updated jenis penanganan: {item_id}")

    updated = await db.uks_jenis_penanganan.find_one({'id': item_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/uks/jenis-penanganan/{item_id}")
async def delete_jenis_penanganan(item_id: str, user: Dict = Depends(require_role(*UKS_ROLES))):
    existing = await db.uks_jenis_penanganan.find_one({'id': item_id})
    if not existing:
        raise HTTPException(404, "Jenis penanganan tidak ditemukan")

    used = await db.uks_kunjungan.count_documents({'jenis_penanganan_id': item_id})
    if used > 0:
        raise HTTPException(400, f"Jenis penanganan masih digunakan oleh {used} data kunjungan")

    await db.uks_jenis_penanganan.delete_one({'id': item_id})
    await log_audit(user['id'], 'uks_jenis_penanganan_delete', f"Deleted jenis penanganan: {item_id}")
    return {'message': 'Jenis penanganan berhasil dihapus'}


# ============================================================
# DATA OBAT (DAFTAR OBAT) ENDPOINTS
# ============================================================

@router.get("/uks/obat")
async def list_obat(search: Optional[str] = None, user: Dict = Depends(get_current_user)):
    query = {}
    if search:
        query['nama_obat'] = {'$regex': search, '$options': 'i'}
    items = await db.uks_obat.find(query, {'_id': 0}).sort('nama_obat', 1).to_list(2000)
    return [serialize_doc(i) for i in items]


@router.post("/uks/obat")
async def create_obat(req: ObatRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        'created_by': user['id'],
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }
    await db.uks_obat.insert_one(doc)
    await log_audit(user['id'], 'uks_obat_create', f"Created obat: {req.nama_obat}")
    return serialize_doc(doc)


@router.put("/uks/obat/{obat_id}")
async def update_obat(obat_id: str, req: ObatRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    await _get_obat_or_404(obat_id)

    update_data = req.model_dump()
    update_data['updated_at'] = datetime.utcnow().isoformat()
    await db.uks_obat.update_one({'id': obat_id}, {'$set': update_data})
    await log_audit(user['id'], 'uks_obat_update', f"Updated obat: {obat_id}")

    updated = await db.uks_obat.find_one({'id': obat_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/uks/obat/{obat_id}")
async def delete_obat(obat_id: str, user: Dict = Depends(require_role(*UKS_ROLES))):
    await _get_obat_or_404(obat_id)

    await db.uks_obat.delete_one({'id': obat_id})
    await log_audit(user['id'], 'uks_obat_delete', f"Deleted obat: {obat_id}")
    return {'message': 'Data obat berhasil dihapus'}


# ============================================================
# OBAT MASUK ENDPOINTS
# ============================================================

@router.get("/uks/obat-masuk")
async def list_obat_masuk(
    obat_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: Dict = Depends(get_current_user)
):
    query = {}
    if obat_id:
        query['obat_id'] = obat_id
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query['$gte'] = start_date
        if end_date:
            date_query['$lte'] = end_date
        query['tanggal'] = date_query

    items = await db.uks_obat_masuk.find(query, {'_id': 0}).sort('tanggal', -1).to_list(3000)
    return [serialize_doc(i) for i in items]


@router.post("/uks/obat-masuk")
async def create_obat_masuk(req: ObatMasukRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    obat = await _get_obat_or_404(req.obat_id)
    if req.jumlah <= 0:
        raise HTTPException(400, "Jumlah harus lebih dari 0")

    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        'obat_nama': obat.get('nama_obat'),
        'petugas_id': user['id'],
        'petugas_nama': user.get('full_name', user.get('username')),
        'created_at': datetime.utcnow().isoformat(),
    }
    await db.uks_obat_masuk.insert_one(doc)
    await db.uks_obat.update_one({'id': req.obat_id}, {'$inc': {'stok': req.jumlah}})
    await log_audit(user['id'], 'uks_obat_masuk_create', f"Obat masuk: {obat.get('nama_obat')} +{req.jumlah}")
    return serialize_doc(doc)


@router.delete("/uks/obat-masuk/{entry_id}")
async def delete_obat_masuk(entry_id: str, user: Dict = Depends(require_role(*UKS_ROLES))):
    existing = await db.uks_obat_masuk.find_one({'id': entry_id})
    if not existing:
        raise HTTPException(404, "Data obat masuk tidak ditemukan")

    await db.uks_obat.update_one({'id': existing['obat_id']}, {'$inc': {'stok': -existing.get('jumlah', 0)}})
    await db.uks_obat_masuk.delete_one({'id': entry_id})
    await log_audit(user['id'], 'uks_obat_masuk_delete', f"Deleted obat masuk: {entry_id}")
    return {'message': 'Data obat masuk berhasil dihapus'}


# ============================================================
# OBAT KELUAR ENDPOINTS
# ============================================================

@router.get("/uks/obat-keluar")
async def list_obat_keluar(
    obat_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: Dict = Depends(get_current_user)
):
    query = {}
    if obat_id:
        query['obat_id'] = obat_id
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query['$gte'] = start_date
        if end_date:
            date_query['$lte'] = end_date
        query['tanggal'] = date_query

    items = await db.uks_obat_keluar.find(query, {'_id': 0}).sort('tanggal', -1).to_list(3000)
    return [serialize_doc(i) for i in items]


@router.post("/uks/obat-keluar")
async def create_obat_keluar(req: ObatKeluarRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    obat = await _get_obat_or_404(req.obat_id)
    if req.jumlah <= 0:
        raise HTTPException(400, "Jumlah harus lebih dari 0")
    if obat.get('stok', 0) < req.jumlah:
        raise HTTPException(400, f"Stok tidak mencukupi (tersedia: {obat.get('stok', 0)})")

    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        'obat_nama': obat.get('nama_obat'),
        'petugas_id': user['id'],
        'petugas_nama': user.get('full_name', user.get('username')),
        'created_at': datetime.utcnow().isoformat(),
    }

    if req.penerima_id:
        penerima = await _get_user_or_404(req.penerima_id)
        doc.update(_user_fields('penerima', penerima))

    await db.uks_obat_keluar.insert_one(doc)
    await db.uks_obat.update_one({'id': req.obat_id}, {'$inc': {'stok': -req.jumlah}})
    await log_audit(user['id'], 'uks_obat_keluar_create', f"Obat keluar: {obat.get('nama_obat')} -{req.jumlah}")
    return serialize_doc(doc)


@router.delete("/uks/obat-keluar/{entry_id}")
async def delete_obat_keluar(entry_id: str, user: Dict = Depends(require_role(*UKS_ROLES))):
    existing = await db.uks_obat_keluar.find_one({'id': entry_id})
    if not existing:
        raise HTTPException(404, "Data obat keluar tidak ditemukan")

    await db.uks_obat.update_one({'id': existing['obat_id']}, {'$inc': {'stok': existing.get('jumlah', 0)}})
    await db.uks_obat_keluar.delete_one({'id': entry_id})
    await log_audit(user['id'], 'uks_obat_keluar_delete', f"Deleted obat keluar: {entry_id}")
    return {'message': 'Data obat keluar berhasil dihapus'}


# ============================================================
# DATA KUNJUNGAN UKS ENDPOINTS (input + riwayat)
# ============================================================

@router.get("/uks/kunjungan")
async def list_kunjungan(
    pasien_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    jenis_penanganan_id: Optional[str] = None,
    user: Dict = Depends(get_current_user)
):
    query = {}
    if pasien_id:
        query['pasien_id'] = pasien_id
    if jenis_penanganan_id:
        query['jenis_penanganan_id'] = jenis_penanganan_id
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query['$gte'] = start_date
        if end_date:
            date_query['$lte'] = end_date
        query['tanggal'] = date_query

    items = await db.uks_kunjungan.find(query, {'_id': 0}).sort('tanggal', -1).to_list(5000)
    return [serialize_doc(i) for i in items]


@router.post("/uks/kunjungan")
async def create_kunjungan(req: KunjunganUKSRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    pasien = await _get_user_or_404(req.pasien_id)

    jenis_nama = None
    if req.jenis_penanganan_id:
        jenis = await db.uks_jenis_penanganan.find_one({'id': req.jenis_penanganan_id})
        if not jenis:
            raise HTTPException(404, "Jenis penanganan tidak ditemukan")
        jenis_nama = jenis.get('nama')

    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        **_user_fields('pasien', pasien),
        'jenis_penanganan_nama': jenis_nama,
        'petugas_id': user['id'],
        'petugas_nama': user.get('full_name', user.get('username')),
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }

    await db.uks_kunjungan.insert_one(doc)
    await log_audit(user['id'], 'uks_kunjungan_create', f"Recorded kunjungan UKS: {pasien.get('full_name')}")
    return serialize_doc(doc)


@router.put("/uks/kunjungan/{kunjungan_id}")
async def update_kunjungan(kunjungan_id: str, req: KunjunganUKSRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    existing = await db.uks_kunjungan.find_one({'id': kunjungan_id})
    if not existing:
        raise HTTPException(404, "Data kunjungan tidak ditemukan")

    update_data = req.model_dump()

    if req.pasien_id != existing.get('pasien_id'):
        pasien = await _get_user_or_404(req.pasien_id)
        update_data.update(_user_fields('pasien', pasien))

    if req.jenis_penanganan_id != existing.get('jenis_penanganan_id'):
        if req.jenis_penanganan_id:
            jenis = await db.uks_jenis_penanganan.find_one({'id': req.jenis_penanganan_id})
            if not jenis:
                raise HTTPException(404, "Jenis penanganan tidak ditemukan")
            update_data['jenis_penanganan_nama'] = jenis.get('nama')
        else:
            update_data['jenis_penanganan_nama'] = None

    update_data['updated_at'] = datetime.utcnow().isoformat()

    await db.uks_kunjungan.update_one({'id': kunjungan_id}, {'$set': update_data})
    await log_audit(user['id'], 'uks_kunjungan_update', f"Updated kunjungan UKS: {kunjungan_id}")

    updated = await db.uks_kunjungan.find_one({'id': kunjungan_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/uks/kunjungan/{kunjungan_id}")
async def delete_kunjungan(kunjungan_id: str, user: Dict = Depends(require_role(*UKS_ROLES))):
    existing = await db.uks_kunjungan.find_one({'id': kunjungan_id})
    if not existing:
        raise HTTPException(404, "Data kunjungan tidak ditemukan")

    await db.uks_kunjungan.delete_one({'id': kunjungan_id})
    await log_audit(user['id'], 'uks_kunjungan_delete', f"Deleted kunjungan UKS: {kunjungan_id}")
    return {'message': 'Data kunjungan berhasil dihapus'}


# ============================================================
# ASET UKS ENDPOINTS
# ============================================================

@router.get("/uks/aset")
async def list_aset(kategori: Optional[str] = None, user: Dict = Depends(get_current_user)):
    query = {}
    if kategori:
        query['kategori'] = kategori
    items = await db.uks_aset.find(query, {'_id': 0}).sort('nama_aset', 1).to_list(2000)
    return [serialize_doc(i) for i in items]


@router.post("/uks/aset")
async def create_aset(req: AsetUKSRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        'created_by': user['id'],
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }
    await db.uks_aset.insert_one(doc)
    await log_audit(user['id'], 'uks_aset_create', f"Created aset UKS: {req.nama_aset}")
    return serialize_doc(doc)


@router.put("/uks/aset/{aset_id}")
async def update_aset(aset_id: str, req: AsetUKSRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    existing = await db.uks_aset.find_one({'id': aset_id})
    if not existing:
        raise HTTPException(404, "Aset tidak ditemukan")

    update_data = req.model_dump()
    update_data['updated_at'] = datetime.utcnow().isoformat()
    await db.uks_aset.update_one({'id': aset_id}, {'$set': update_data})
    await log_audit(user['id'], 'uks_aset_update', f"Updated aset UKS: {aset_id}")

    updated = await db.uks_aset.find_one({'id': aset_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/uks/aset/{aset_id}")
async def delete_aset(aset_id: str, user: Dict = Depends(require_role(*UKS_ROLES))):
    existing = await db.uks_aset.find_one({'id': aset_id})
    if not existing:
        raise HTTPException(404, "Aset tidak ditemukan")

    await db.uks_aset.delete_one({'id': aset_id})
    await log_audit(user['id'], 'uks_aset_delete', f"Deleted aset UKS: {aset_id}")
    return {'message': 'Aset berhasil dihapus'}


# ============================================================
# LAPORAN UKS (SUMMARY STATISTICS)
# ============================================================

@router.get("/uks/laporan/summary")
async def get_laporan_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: Dict = Depends(require_role(*UKS_ROLES))
):
    date_query = {}
    if start_date:
        date_query['$gte'] = start_date
    if end_date:
        date_query['$lte'] = end_date

    kunjungan_query = {'tanggal': date_query} if date_query else {}
    kunjungan = await db.uks_kunjungan.find(kunjungan_query, {'_id': 0}).to_list(10000)

    obat_keluar_query = {'tanggal': date_query} if date_query else {}
    obat_keluar = await db.uks_obat_keluar.find(obat_keluar_query, {'_id': 0}).to_list(10000)

    obat_list = await db.uks_obat.find({}, {'_id': 0}).to_list(2000)

    def by_field(records, field):
        counts = {}
        for r in records:
            key = r.get(field) or 'Lainnya'
            counts[key] = counts.get(key, 0) + 1
        return counts

    obat_usage = {}
    for r in obat_keluar:
        key = r.get('obat_nama') or r.get('obat_id')
        obat_usage[key] = obat_usage.get(key, 0) + r.get('jumlah', 0)
    most_used_obat = sorted(obat_usage.items(), key=lambda x: x[1], reverse=True)[:10]

    low_stock = [o for o in obat_list if o.get('stok', 0) <= o.get('stok_minimum', 0)]

    return {
        'total_kunjungan': len(kunjungan),
        'kunjungan_by_jenis_penanganan': by_field(kunjungan, 'jenis_penanganan_nama'),
        'kunjungan_by_kondisi_pulang': by_field(kunjungan, 'kondisi_pulang'),
        'total_obat_keluar_transaksi': len(obat_keluar),
        'most_used_obat': [{'nama_obat': k, 'jumlah': v} for k, v in most_used_obat],
        'total_jenis_obat': len(obat_list),
        'obat_stok_menipis': [serialize_doc(o) for o in low_stock],
    }
