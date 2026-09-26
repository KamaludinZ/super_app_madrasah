"""API endpoints for Perpustakaan (Library) Management."""
import re
from typing import Dict, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import uuid

from core import db, get_current_user, require_role, serialize_doc, log_audit

router = APIRouter()

PERPUS_ROLES = ('admin', 'perpustakaan')


# ============================================================
# REQUEST MODELS
# ============================================================

class KoleksiRequest(BaseModel):
    """Request model for a library collection/asset item (book or other asset)."""
    judul: str
    jenis: str = 'Buku'  # e.g., "Buku", "Majalah", "Peta", "Alat Peraga"
    penulis: Optional[str] = None
    penerbit: Optional[str] = None
    tahun_terbit: Optional[str] = None
    kategori: Optional[str] = None  # e.g., "Fiksi", "Non-Fiksi", "Referensi"
    kode_koleksi: Optional[str] = None
    jumlah: int = 1
    jumlah_tersedia: Optional[int] = None
    kondisi: Optional[str] = 'Baik'  # Baik, Rusak Ringan, Rusak Berat
    lokasi_rak: Optional[str] = None
    keterangan: Optional[str] = None


class PeminjamanRequest(BaseModel):
    """Request model for a book/collection loan."""
    koleksi_id: str
    peminjam_id: str  # user id (siswa/guru/tendik)
    tanggal_pinjam: str
    tanggal_kembali_rencana: Optional[str] = None
    tanggal_kembali_aktual: Optional[str] = None
    status: Optional[str] = 'Dipinjam'  # Dipinjam, Dikembalikan, Terlambat, Hilang
    catatan: Optional[str] = None


class KunjunganRequest(BaseModel):
    """Request model for a library visit."""
    pengunjung_id: str  # user id
    tanggal: str
    waktu: Optional[str] = None
    tujuan: Optional[str] = None  # e.g., "Membaca", "Meminjam Buku", "Tugas"
    keterangan: Optional[str] = None


async def _get_koleksi_or_404(koleksi_id: str):
    doc = await db.perpus_koleksi.find_one({'id': koleksi_id})
    if not doc:
        raise HTTPException(404, "Koleksi tidak ditemukan")
    return doc


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


# ============================================================
# WARGA MADRASAH LOOKUP (for peminjam / pengunjung picker)
# ============================================================

@router.get("/perpus/warga-madrasah")
async def list_warga_madrasah(search: Optional[str] = None, user: Dict = Depends(require_role(*PERPUS_ROLES, 'kepala_sekolah'))):
    """Minimal lookup of all active users (siswa, guru, tendik) for the borrower/visitor picker."""
    query = {'is_active': {'$ne': False}}
    if search:
        query['full_name'] = {'$regex': re.escape(search), '$options': 'i'}

    items = await db.users.find(
        query,
        {'_id': 0, 'id': 1, 'full_name': 1, 'nis': 1, 'nip_nuptk': 1, 'username': 1, 'roles': 1}
    ).sort('full_name', 1).to_list(3000)
    return [serialize_doc(i) for i in items]


# ============================================================
# KOLEKSI (DATA ASET & KOLEKSI PERPUS) ENDPOINTS
# ============================================================

@router.get("/perpus/koleksi")
async def list_koleksi(
    jenis: Optional[str] = None,
    kategori: Optional[str] = None,
    kondisi: Optional[str] = None,
    search: Optional[str] = None,
    user: Dict = Depends(get_current_user)
):
    query = {}
    if jenis:
        query['jenis'] = jenis
    if kategori:
        query['kategori'] = kategori
    if kondisi:
        query['kondisi'] = kondisi
    if search:
        query['judul'] = {'$regex': re.escape(search), '$options': 'i'}

    items = await db.perpus_koleksi.find(query, {'_id': 0}).sort('judul', 1).to_list(5000)
    return [serialize_doc(i) for i in items]


@router.get("/perpus/koleksi/{koleksi_id}")
async def get_koleksi(koleksi_id: str, user: Dict = Depends(get_current_user)):
    doc = await db.perpus_koleksi.find_one({'id': koleksi_id}, {'_id': 0})
    if not doc:
        raise HTTPException(404, "Koleksi tidak ditemukan")
    return serialize_doc(doc)


@router.post("/perpus/koleksi")
async def create_koleksi(req: KoleksiRequest, user: Dict = Depends(require_role(*PERPUS_ROLES))):
    data = req.model_dump()
    if data.get('jumlah_tersedia') is None:
        data['jumlah_tersedia'] = data['jumlah']

    doc = {
        'id': str(uuid.uuid4()),
        **data,
        'created_by': user['id'],
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }

    await db.perpus_koleksi.insert_one(doc)
    await log_audit(user, 'perpus_koleksi_create', f"Created koleksi: {req.judul}")
    return serialize_doc(doc)


@router.put("/perpus/koleksi/{koleksi_id}")
async def update_koleksi(koleksi_id: str, req: KoleksiRequest, user: Dict = Depends(require_role(*PERPUS_ROLES))):
    existing = await _get_koleksi_or_404(koleksi_id)

    update_data = req.model_dump()
    if update_data.get('jumlah_tersedia') is None:
        update_data['jumlah_tersedia'] = existing.get('jumlah_tersedia', update_data['jumlah'])
    update_data['updated_at'] = datetime.utcnow().isoformat()

    await db.perpus_koleksi.update_one({'id': koleksi_id}, {'$set': update_data})
    await log_audit(user, 'perpus_koleksi_update', f"Updated koleksi: {koleksi_id}")

    updated = await db.perpus_koleksi.find_one({'id': koleksi_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/perpus/koleksi/{koleksi_id}")
async def delete_koleksi(koleksi_id: str, user: Dict = Depends(require_role(*PERPUS_ROLES))):
    await _get_koleksi_or_404(koleksi_id)

    active_loans = await db.perpus_peminjaman.count_documents({'koleksi_id': koleksi_id, 'status': 'Dipinjam'})
    if active_loans > 0:
        raise HTTPException(400, f"Koleksi masih dipinjam ({active_loans} peminjaman aktif)")

    await db.perpus_koleksi.delete_one({'id': koleksi_id})
    await log_audit(user, 'perpus_koleksi_delete', f"Deleted koleksi: {koleksi_id}")
    return {'message': 'Koleksi berhasil dihapus'}


# ============================================================
# PEMINJAMAN (DATA PEMINJAMAN BUKU) ENDPOINTS
# ============================================================

@router.get("/perpus/peminjaman")
async def list_peminjaman(
    status: Optional[str] = None,
    peminjam_id: Optional[str] = None,
    koleksi_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: Dict = Depends(get_current_user)
):
    query = {}
    if status:
        query['status'] = status
    if peminjam_id:
        query['peminjam_id'] = peminjam_id
    if koleksi_id:
        query['koleksi_id'] = koleksi_id
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query['$gte'] = start_date
        if end_date:
            date_query['$lte'] = end_date
        query['tanggal_pinjam'] = date_query

    items = await db.perpus_peminjaman.find(query, {'_id': 0}).sort('tanggal_pinjam', -1).to_list(5000)
    return [serialize_doc(i) for i in items]


@router.post("/perpus/peminjaman")
async def create_peminjaman(req: PeminjamanRequest, user: Dict = Depends(require_role(*PERPUS_ROLES))):
    koleksi = await _get_koleksi_or_404(req.koleksi_id)
    peminjam = await _get_user_or_404(req.peminjam_id)

    if koleksi.get('jumlah_tersedia', 0) <= 0:
        raise HTTPException(400, "Stok koleksi tidak tersedia")

    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        'koleksi_judul': koleksi.get('judul'),
        **_user_fields('peminjam', peminjam),
        'petugas_id': user['id'],
        'petugas_nama': user.get('full_name', user.get('username')),
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }

    await db.perpus_peminjaman.insert_one(doc)
    await db.perpus_koleksi.update_one({'id': req.koleksi_id}, {'$inc': {'jumlah_tersedia': -1}})
    await log_audit(user, 'perpus_peminjaman_create', f"{peminjam.get('full_name')} meminjam {koleksi.get('judul')}")
    return serialize_doc(doc)


@router.put("/perpus/peminjaman/{peminjaman_id}")
async def update_peminjaman(peminjaman_id: str, req: PeminjamanRequest, user: Dict = Depends(require_role(*PERPUS_ROLES))):
    existing = await db.perpus_peminjaman.find_one({'id': peminjaman_id})
    if not existing:
        raise HTTPException(404, "Data peminjaman tidak ditemukan")

    update_data = req.model_dump()

    if req.koleksi_id != existing.get('koleksi_id'):
        koleksi = await _get_koleksi_or_404(req.koleksi_id)
        update_data['koleksi_judul'] = koleksi.get('judul')
    if req.peminjam_id != existing.get('peminjam_id'):
        peminjam = await _get_user_or_404(req.peminjam_id)
        update_data.update(_user_fields('peminjam', peminjam))

    # Restore stock when a loan transitions into a returned/lost state for the first time
    was_active = existing.get('status') == 'Dipinjam'
    now_inactive = req.status in ('Dikembalikan', 'Hilang')
    if was_active and now_inactive:
        await db.perpus_koleksi.update_one({'id': existing['koleksi_id']}, {'$inc': {'jumlah_tersedia': 1}})
    was_inactive = existing.get('status') in ('Dikembalikan', 'Hilang')
    now_active = req.status == 'Dipinjam'
    if was_inactive and now_active:
        await db.perpus_koleksi.update_one({'id': existing['koleksi_id']}, {'$inc': {'jumlah_tersedia': -1}})

    update_data['updated_at'] = datetime.utcnow().isoformat()

    await db.perpus_peminjaman.update_one({'id': peminjaman_id}, {'$set': update_data})
    await log_audit(user, 'perpus_peminjaman_update', f"Updated peminjaman: {peminjaman_id}")

    updated = await db.perpus_peminjaman.find_one({'id': peminjaman_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/perpus/peminjaman/{peminjaman_id}")
async def delete_peminjaman(peminjaman_id: str, user: Dict = Depends(require_role(*PERPUS_ROLES))):
    existing = await db.perpus_peminjaman.find_one({'id': peminjaman_id})
    if not existing:
        raise HTTPException(404, "Data peminjaman tidak ditemukan")

    if existing.get('status') == 'Dipinjam':
        await db.perpus_koleksi.update_one({'id': existing['koleksi_id']}, {'$inc': {'jumlah_tersedia': 1}})

    await db.perpus_peminjaman.delete_one({'id': peminjaman_id})
    await log_audit(user, 'perpus_peminjaman_delete', f"Deleted peminjaman: {peminjaman_id}")
    return {'message': 'Data peminjaman berhasil dihapus'}


# ============================================================
# KUNJUNGAN PERPUS ENDPOINTS
# ============================================================

@router.get("/perpus/kunjungan")
async def list_kunjungan(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    pengunjung_id: Optional[str] = None,
    user: Dict = Depends(get_current_user)
):
    query = {}
    if pengunjung_id:
        query['pengunjung_id'] = pengunjung_id
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query['$gte'] = start_date
        if end_date:
            date_query['$lte'] = end_date
        query['tanggal'] = date_query

    items = await db.perpus_kunjungan.find(query, {'_id': 0}).sort('tanggal', -1).to_list(5000)
    return [serialize_doc(i) for i in items]


@router.post("/perpus/kunjungan")
async def create_kunjungan(req: KunjunganRequest, user: Dict = Depends(require_role(*PERPUS_ROLES))):
    pengunjung = await _get_user_or_404(req.pengunjung_id)

    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        **_user_fields('pengunjung', pengunjung),
        'petugas_id': user['id'],
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }

    await db.perpus_kunjungan.insert_one(doc)
    await log_audit(user, 'perpus_kunjungan_create', f"Recorded kunjungan: {pengunjung.get('full_name')}")
    return serialize_doc(doc)


@router.delete("/perpus/kunjungan/{kunjungan_id}")
async def delete_kunjungan(kunjungan_id: str, user: Dict = Depends(require_role(*PERPUS_ROLES))):
    existing = await db.perpus_kunjungan.find_one({'id': kunjungan_id})
    if not existing:
        raise HTTPException(404, "Data kunjungan tidak ditemukan")

    await db.perpus_kunjungan.delete_one({'id': kunjungan_id})
    await log_audit(user, 'perpus_kunjungan_delete', f"Deleted kunjungan: {kunjungan_id}")
    return {'message': 'Data kunjungan berhasil dihapus'}


# ============================================================
# LAPORAN PERPUS (SUMMARY STATISTICS)
# ============================================================

@router.get("/perpus/laporan/summary")
async def get_laporan_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: Dict = Depends(require_role(*PERPUS_ROLES, 'kepala_sekolah'))
):
    date_query = {}
    if start_date:
        date_query['$gte'] = start_date
    if end_date:
        date_query['$lte'] = end_date

    koleksi = await db.perpus_koleksi.find({}, {'_id': 0}).to_list(10000)
    peminjaman_query = {'tanggal_pinjam': date_query} if date_query else {}
    peminjaman = await db.perpus_peminjaman.find(peminjaman_query, {'_id': 0}).to_list(10000)
    kunjungan_query = {'tanggal': date_query} if date_query else {}
    kunjungan = await db.perpus_kunjungan.find(kunjungan_query, {'_id': 0}).to_list(10000)

    total_koleksi = sum(k.get('jumlah', 0) for k in koleksi)
    total_tersedia = sum(k.get('jumlah_tersedia', 0) for k in koleksi)

    def by_field(records, field):
        counts = {}
        for r in records:
            key = r.get(field) or 'Lainnya'
            counts[key] = counts.get(key, 0) + 1
        return counts

    peminjaman_aktif = sum(1 for p in peminjaman if p.get('status') == 'Dipinjam')
    peminjaman_terlambat = sum(1 for p in peminjaman if p.get('status') == 'Terlambat')

    # Most borrowed collections
    borrow_counts = {}
    for p in peminjaman:
        key = p.get('koleksi_judul') or p.get('koleksi_id')
        borrow_counts[key] = borrow_counts.get(key, 0) + 1
    most_borrowed = sorted(borrow_counts.items(), key=lambda x: x[1], reverse=True)[:10]

    return {
        'total_judul_koleksi': len(koleksi),
        'total_eksemplar': total_koleksi,
        'total_eksemplar_tersedia': total_tersedia,
        'koleksi_by_jenis': by_field(koleksi, 'jenis'),
        'total_peminjaman': len(peminjaman),
        'peminjaman_aktif': peminjaman_aktif,
        'peminjaman_terlambat': peminjaman_terlambat,
        'most_borrowed': [{'judul': k, 'jumlah': v} for k, v in most_borrowed],
        'total_kunjungan': len(kunjungan),
        'kunjungan_by_tujuan': by_field(kunjungan, 'tujuan'),
    }
