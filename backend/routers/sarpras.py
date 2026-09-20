"""API endpoints for Sarpras (Sarana & Prasarana / Facilities Management)."""
from typing import Dict, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import uuid

from core import db, get_current_user, require_role, serialize_doc, log_audit

router = APIRouter()

SARPRAS_ROLES = ('admin', 'waka_sarpras')


# ============================================================
# REQUEST MODELS
# ============================================================

class AsetTetapRequest(BaseModel):
    """Request model for a fixed asset (Komite-funded or BMN/state asset)."""
    nama_aset: str
    sumber_dana: str = 'Komite'  # 'Komite' or 'BMN'
    kode_aset: Optional[str] = None
    kategori: Optional[str] = None
    satuan: Optional[str] = None
    tanggal_perolehan: Optional[str] = None
    nilai_perolehan: Optional[float] = None
    jumlah_baik: int = 1
    jumlah_rusak: int = 0
    lokasi_room_id: Optional[str] = None
    lokasi_penyimpanan: Optional[str] = None
    keterangan: Optional[str] = None


class AsetLancarRequest(BaseModel):
    """Request model for a current/consumable asset. Aset lancar (bahan
    habis pakai seperti spidol, tinta, obat) tidak punya konsep baik/rusak
    seperti aset tetap — hanya satu angka stok yang berkurang saat dipakai."""
    nama_barang: str
    sumber_dana: str = 'Komite'  # 'Komite' or 'BMN'
    kategori: Optional[str] = None  # e.g., "ATK", "Bahan Habis Pakai"
    satuan: Optional[str] = 'pcs'
    stok: int = 0
    stok_minimum: Optional[int] = 0
    lokasi_room_id: Optional[str] = None
    lokasi_penyimpanan: Optional[str] = None
    keterangan: Optional[str] = None


class PenghapusanRequest(BaseModel):
    """Request model for asset write-off / disposal."""
    aset_tipe: str  # 'tetap' or 'lancar'
    aset_id: str
    tanggal: str
    alasan: str  # e.g., "Rusak Berat", "Hilang", "Usang"
    jumlah_dihapus: int = 1
    nomor_berita_acara: Optional[str] = None
    keterangan: Optional[str] = None


class PeminjamanBarangRequest(BaseModel):
    """Request model for an item/equipment loan."""
    aset_tipe: str  # 'tetap' or 'lancar'
    aset_id: str
    peminjam_id: str  # user id
    tanggal_pinjam: str
    tanggal_kembali_rencana: Optional[str] = None
    tanggal_kembali_aktual: Optional[str] = None
    jumlah: int = 1
    status: Optional[str] = 'Dipinjam'  # Dipinjam, Dikembalikan, Terlambat, Hilang/Rusak
    keperluan: Optional[str] = None
    catatan: Optional[str] = None


class PeminjamanRuanganRequest(BaseModel):
    """Request model for a room booking/loan."""
    room_id: str
    peminjam_id: str  # user id
    tanggal: str
    jam_mulai: Optional[str] = None
    jam_selesai: Optional[str] = None
    keperluan: str
    status: Optional[str] = 'Dipesan'  # Dipesan, Berlangsung, Selesai, Dibatalkan
    catatan: Optional[str] = None


class JurnalRuanganRequest(BaseModel):
    """Request model for a room usage log entry."""
    room_id: str
    tanggal: str
    jam_mulai: Optional[str] = None
    jam_selesai: Optional[str] = None
    kegiatan: str
    penanggung_jawab_id: Optional[str] = None
    kondisi_setelah: Optional[str] = None
    keterangan: Optional[str] = None


class JurnalAlatRequest(BaseModel):
    """Request model for an equipment usage log entry."""
    aset_id: str
    tanggal: str
    pengguna_id: Optional[str] = None
    kegiatan: str
    kondisi_setelah: Optional[str] = None
    keterangan: Optional[str] = None


class JurnalPerawatanRequest(BaseModel):
    """Request model for an asset maintenance log entry."""
    aset_tipe: str  # 'tetap' or 'lancar' or 'room'
    aset_id: str
    tanggal: str
    jenis_perawatan: str  # e.g., "Servis Rutin", "Pembersihan", "Kalibrasi"
    petugas_pelaksana: Optional[str] = None
    biaya: Optional[float] = None
    hasil: Optional[str] = None
    keterangan: Optional[str] = None


class LaporanKerusakanRequest(BaseModel):
    """Request model for a damage/repair report."""
    aset_tipe: str  # 'tetap', 'lancar', or 'room'
    aset_id: str
    tanggal_lapor: str
    pelapor_id: Optional[str] = None
    deskripsi_kerusakan: str
    tingkat_kerusakan: Optional[str] = 'Ringan'  # Ringan, Sedang, Berat
    status: Optional[str] = 'Dilaporkan'  # Dilaporkan, Diperbaiki, Selesai, Tidak Dapat Diperbaiki
    tanggal_perbaikan: Optional[str] = None
    biaya_perbaikan: Optional[float] = None
    hasil_perbaikan: Optional[str] = None


async def _get_user_or_404(user_id: str):
    doc = await db.users.find_one({'id': user_id}, {'_id': 0, 'password_hash': 0})
    if not doc:
        raise HTTPException(404, "Pengguna tidak ditemukan")
    return doc


def _user_fields(prefix: str, u: Dict) -> Dict:
    return {
        f'{prefix}_nama': u.get('full_name'),
        f'{prefix}_identitas': u.get('nis') or u.get('nip_nuptk') or u.get('username'),
    }


async def _get_room_or_404(room_id: str):
    doc = await db.rooms.find_one({'id': room_id})
    if not doc:
        raise HTTPException(404, "Ruangan tidak ditemukan")
    return doc


async def _resolve_aset(aset_tipe: str, aset_id: str):
    """Resolve an asset (fixed or current) and return (doc, collection, name_field)."""
    if aset_tipe == 'tetap':
        doc = await db.sarpras_aset_tetap.find_one({'id': aset_id})
        if not doc:
            raise HTTPException(404, "Aset tetap tidak ditemukan")
        return doc, db.sarpras_aset_tetap, 'nama_aset'
    elif aset_tipe == 'lancar':
        doc = await db.sarpras_aset_lancar.find_one({'id': aset_id})
        if not doc:
            raise HTTPException(404, "Aset lancar tidak ditemukan")
        return doc, db.sarpras_aset_lancar, 'nama_barang'
    elif aset_tipe == 'room':
        doc = await db.rooms.find_one({'id': aset_id})
        if not doc:
            raise HTTPException(404, "Ruangan tidak ditemukan")
        return doc, db.rooms, 'name'
    raise HTTPException(400, "aset_tipe harus 'tetap', 'lancar', atau 'room'")


# ============================================================
# WARGA MADRASAH LOOKUP (for peminjam / petugas picker)
# ============================================================

@router.get("/sarpras/warga-madrasah")
async def list_warga_madrasah(search: Optional[str] = None, user: Dict = Depends(require_role(*SARPRAS_ROLES, 'kepala_sekolah'))):
    query = {'is_active': {'$ne': False}}
    if search:
        query['full_name'] = {'$regex': search, '$options': 'i'}
    items = await db.users.find(
        query,
        {'_id': 0, 'id': 1, 'full_name': 1, 'nis': 1, 'nip_nuptk': 1, 'username': 1, 'roles': 1}
    ).sort('full_name', 1).to_list(3000)
    return [serialize_doc(i) for i in items]


# ============================================================
# DATA ASET TETAP (KOMITE & BMN) ENDPOINTS
# ============================================================

@router.get("/sarpras/aset-tetap")
async def list_aset_tetap(sumber_dana: Optional[str] = None, kondisi: Optional[str] = None, search: Optional[str] = None, user: Dict = Depends(get_current_user)):
    query = {}
    if sumber_dana:
        query['sumber_dana'] = sumber_dana
    if kondisi:
        query['kondisi'] = kondisi
    if search:
        query['nama_aset'] = {'$regex': search, '$options': 'i'}
    items = await db.sarpras_aset_tetap.find(query, {'_id': 0}).sort('nama_aset', 1).to_list(5000)
    return [serialize_doc(i) for i in items]


@router.post("/sarpras/aset-tetap")
async def create_aset_tetap(req: AsetTetapRequest, user: Dict = Depends(require_role(*SARPRAS_ROLES))):
    data = req.model_dump()
    room_name = None
    if data.get('lokasi_room_id'):
        room = await _get_room_or_404(data['lokasi_room_id'])
        room_name = room.get('name')

    doc = {
        'id': str(uuid.uuid4()),
        **data,
        'jumlah': req.jumlah_baik + req.jumlah_rusak,
        'kondisi': 'Baik' if req.jumlah_rusak == 0 else 'Rusak Ringan',
        'lokasi_room_nama': room_name,
        'created_by': user['id'],
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }
    await db.sarpras_aset_tetap.insert_one(doc)
    await log_audit(user, 'sarpras_aset_tetap_create', f"Created aset tetap: {req.nama_aset}")
    return serialize_doc(doc)


@router.put("/sarpras/aset-tetap/{aset_id}")
async def update_aset_tetap(aset_id: str, req: AsetTetapRequest, user: Dict = Depends(require_role(*SARPRAS_ROLES))):
    existing = await db.sarpras_aset_tetap.find_one({'id': aset_id})
    if not existing:
        raise HTTPException(404, "Aset tetap tidak ditemukan")

    update_data = req.model_dump()
    update_data['jumlah'] = req.jumlah_baik + req.jumlah_rusak
    update_data['kondisi'] = 'Baik' if req.jumlah_rusak == 0 else 'Rusak Ringan'
    if update_data.get('lokasi_room_id'):
        room = await _get_room_or_404(update_data['lokasi_room_id'])
        update_data['lokasi_room_nama'] = room.get('name')
    else:
        update_data['lokasi_room_nama'] = None
    update_data['updated_at'] = datetime.utcnow().isoformat()

    await db.sarpras_aset_tetap.update_one({'id': aset_id}, {'$set': update_data})
    await log_audit(user, 'sarpras_aset_tetap_update', f"Updated aset tetap: {aset_id}")

    updated = await db.sarpras_aset_tetap.find_one({'id': aset_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/sarpras/aset-tetap/{aset_id}")
async def delete_aset_tetap(aset_id: str, user: Dict = Depends(require_role(*SARPRAS_ROLES))):
    existing = await db.sarpras_aset_tetap.find_one({'id': aset_id})
    if not existing:
        raise HTTPException(404, "Aset tetap tidak ditemukan")
    await db.sarpras_aset_tetap.delete_one({'id': aset_id})
    await log_audit(user, 'sarpras_aset_tetap_delete', f"Deleted aset tetap: {aset_id}")
    return {'message': 'Aset tetap berhasil dihapus'}


# ============================================================
# ASET LANCAR ENDPOINTS
# ============================================================

@router.get("/sarpras/aset-lancar")
async def list_aset_lancar(sumber_dana: Optional[str] = None, search: Optional[str] = None, user: Dict = Depends(get_current_user)):
    query = {}
    if sumber_dana:
        query['sumber_dana'] = sumber_dana
    if search:
        query['nama_barang'] = {'$regex': search, '$options': 'i'}
    items = await db.sarpras_aset_lancar.find(query, {'_id': 0}).sort('nama_barang', 1).to_list(5000)
    return [serialize_doc(i) for i in items]


@router.post("/sarpras/aset-lancar")
async def create_aset_lancar(req: AsetLancarRequest, user: Dict = Depends(require_role(*SARPRAS_ROLES))):
    data = req.model_dump()
    room_name = None
    if data.get('lokasi_room_id'):
        room = await _get_room_or_404(data['lokasi_room_id'])
        room_name = room.get('name')

    doc = {
        'id': str(uuid.uuid4()),
        **data,
        'lokasi_room_nama': room_name,
        'created_by': user['id'],
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }
    await db.sarpras_aset_lancar.insert_one(doc)
    await log_audit(user, 'sarpras_aset_lancar_create', f"Created aset lancar: {req.nama_barang}")
    return serialize_doc(doc)


@router.put("/sarpras/aset-lancar/{aset_id}")
async def update_aset_lancar(aset_id: str, req: AsetLancarRequest, user: Dict = Depends(require_role(*SARPRAS_ROLES))):
    existing = await db.sarpras_aset_lancar.find_one({'id': aset_id})
    if not existing:
        raise HTTPException(404, "Aset lancar tidak ditemukan")

    update_data = req.model_dump()
    if update_data.get('lokasi_room_id'):
        room = await _get_room_or_404(update_data['lokasi_room_id'])
        update_data['lokasi_room_nama'] = room.get('name')
    else:
        update_data['lokasi_room_nama'] = None
    update_data['updated_at'] = datetime.utcnow().isoformat()

    await db.sarpras_aset_lancar.update_one({'id': aset_id}, {'$set': update_data})
    await log_audit(user, 'sarpras_aset_lancar_update', f"Updated aset lancar: {aset_id}")

    updated = await db.sarpras_aset_lancar.find_one({'id': aset_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/sarpras/aset-lancar/{aset_id}")
async def delete_aset_lancar(aset_id: str, user: Dict = Depends(require_role(*SARPRAS_ROLES))):
    existing = await db.sarpras_aset_lancar.find_one({'id': aset_id})
    if not existing:
        raise HTTPException(404, "Aset lancar tidak ditemukan")
    await db.sarpras_aset_lancar.delete_one({'id': aset_id})
    await log_audit(user, 'sarpras_aset_lancar_delete', f"Deleted aset lancar: {aset_id}")
    return {'message': 'Aset lancar berhasil dihapus'}


# ============================================================
# DATA RUANGAN DAN ASET (rooms reused; assets filtered by room)
# ============================================================

@router.get("/sarpras/ruangan-aset")
async def list_ruangan_dengan_aset(user: Dict = Depends(get_current_user)):
    """List all rooms enriched with counts of fixed/current assets located in each."""
    rooms = await db.rooms.find({}, {'_id': 0}).sort('name', 1).to_list(500)
    result = []
    for r in rooms:
        tetap_count = await db.sarpras_aset_tetap.count_documents({'lokasi_room_id': r['id']})
        lancar_count = await db.sarpras_aset_lancar.count_documents({'lokasi_room_id': r['id']})
        result.append({**serialize_doc(r), 'jumlah_aset_tetap': tetap_count, 'jumlah_aset_lancar': lancar_count})
    return result


@router.get("/sarpras/ruangan-aset/{room_id}")
async def get_ruangan_dengan_aset(room_id: str, user: Dict = Depends(get_current_user)):
    room = await _get_room_or_404(room_id)
    aset_tetap = await db.sarpras_aset_tetap.find({'lokasi_room_id': room_id}, {'_id': 0}).to_list(1000)
    aset_lancar = await db.sarpras_aset_lancar.find({'lokasi_room_id': room_id}, {'_id': 0}).to_list(1000)
    return {
        'room': serialize_doc(room),
        'aset_tetap': [serialize_doc(a) for a in aset_tetap],
        'aset_lancar': [serialize_doc(a) for a in aset_lancar],
    }


# ============================================================
# PENGHAPUSAN BARANG ENDPOINTS
# ============================================================

@router.get("/sarpras/penghapusan")
async def list_penghapusan(aset_tipe: Optional[str] = None, user: Dict = Depends(get_current_user)):
    query = {}
    if aset_tipe:
        query['aset_tipe'] = aset_tipe
    items = await db.sarpras_penghapusan.find(query, {'_id': 0}).sort('tanggal', -1).to_list(3000)
    return [serialize_doc(i) for i in items]


@router.post("/sarpras/penghapusan")
async def create_penghapusan(req: PenghapusanRequest, user: Dict = Depends(require_role(*SARPRAS_ROLES))):
    aset_doc, collection, name_field = await _resolve_aset(req.aset_tipe, req.aset_id)

    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        'aset_nama': aset_doc.get(name_field),
        'petugas_id': user['id'],
        'petugas_nama': user.get('full_name', user.get('username')),
        'created_at': datetime.utcnow().isoformat(),
    }
    await db.sarpras_penghapusan.insert_one(doc)

    if req.aset_tipe in ('tetap', 'lancar'):
        current_jumlah = aset_doc.get('jumlah') if req.aset_tipe == 'tetap' else aset_doc.get('stok')
        field = 'jumlah' if req.aset_tipe == 'tetap' else 'stok'
        new_val = max(0, (current_jumlah or 0) - req.jumlah_dihapus)
        await collection.update_one({'id': req.aset_id}, {'$set': {field: new_val}})

    await log_audit(user, 'sarpras_penghapusan_create', f"Penghapusan: {aset_doc.get(name_field)}")
    return serialize_doc(doc)


@router.delete("/sarpras/penghapusan/{item_id}")
async def delete_penghapusan(item_id: str, user: Dict = Depends(require_role(*SARPRAS_ROLES))):
    existing = await db.sarpras_penghapusan.find_one({'id': item_id})
    if not existing:
        raise HTTPException(404, "Data penghapusan tidak ditemukan")
    await db.sarpras_penghapusan.delete_one({'id': item_id})
    await log_audit(user, 'sarpras_penghapusan_delete', f"Deleted penghapusan: {item_id}")
    return {'message': 'Data penghapusan berhasil dihapus'}


# ============================================================
# PEMINJAMAN BARANG ENDPOINTS
# ============================================================

@router.get("/sarpras/peminjaman-barang")
async def list_peminjaman_barang(status: Optional[str] = None, user: Dict = Depends(get_current_user)):
    query = {}
    if status:
        query['status'] = status
    items = await db.sarpras_peminjaman_barang.find(query, {'_id': 0}).sort('tanggal_pinjam', -1).to_list(3000)
    return [serialize_doc(i) for i in items]


@router.post("/sarpras/peminjaman-barang")
async def create_peminjaman_barang(req: PeminjamanBarangRequest, user: Dict = Depends(require_role(*SARPRAS_ROLES))):
    aset_doc, collection, name_field = await _resolve_aset(req.aset_tipe, req.aset_id)
    peminjam = await _get_user_or_404(req.peminjam_id)

    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        'aset_nama': aset_doc.get(name_field),
        **_user_fields('peminjam', peminjam),
        'petugas_id': user['id'],
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }
    await db.sarpras_peminjaman_barang.insert_one(doc)
    await log_audit(user, 'sarpras_peminjaman_barang_create', f"{peminjam.get('full_name')} meminjam {aset_doc.get(name_field)}")
    return serialize_doc(doc)


@router.put("/sarpras/peminjaman-barang/{item_id}")
async def update_peminjaman_barang(item_id: str, req: PeminjamanBarangRequest, user: Dict = Depends(require_role(*SARPRAS_ROLES))):
    existing = await db.sarpras_peminjaman_barang.find_one({'id': item_id})
    if not existing:
        raise HTTPException(404, "Data peminjaman tidak ditemukan")

    update_data = req.model_dump()
    if req.aset_id != existing.get('aset_id') or req.aset_tipe != existing.get('aset_tipe'):
        aset_doc, _, name_field = await _resolve_aset(req.aset_tipe, req.aset_id)
        update_data['aset_nama'] = aset_doc.get(name_field)
    if req.peminjam_id != existing.get('peminjam_id'):
        peminjam = await _get_user_or_404(req.peminjam_id)
        update_data.update(_user_fields('peminjam', peminjam))
    update_data['updated_at'] = datetime.utcnow().isoformat()

    await db.sarpras_peminjaman_barang.update_one({'id': item_id}, {'$set': update_data})
    await log_audit(user, 'sarpras_peminjaman_barang_update', f"Updated peminjaman barang: {item_id}")

    updated = await db.sarpras_peminjaman_barang.find_one({'id': item_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/sarpras/peminjaman-barang/{item_id}")
async def delete_peminjaman_barang(item_id: str, user: Dict = Depends(require_role(*SARPRAS_ROLES))):
    existing = await db.sarpras_peminjaman_barang.find_one({'id': item_id})
    if not existing:
        raise HTTPException(404, "Data peminjaman tidak ditemukan")
    await db.sarpras_peminjaman_barang.delete_one({'id': item_id})
    await log_audit(user, 'sarpras_peminjaman_barang_delete', f"Deleted peminjaman barang: {item_id}")
    return {'message': 'Data peminjaman berhasil dihapus'}


# ============================================================
# PEMINJAMAN RUANGAN ENDPOINTS
# ============================================================

@router.get("/sarpras/peminjaman-ruangan")
async def list_peminjaman_ruangan(status: Optional[str] = None, room_id: Optional[str] = None, user: Dict = Depends(get_current_user)):
    query = {}
    if status:
        query['status'] = status
    if room_id:
        query['room_id'] = room_id
    items = await db.sarpras_peminjaman_ruangan.find(query, {'_id': 0}).sort('tanggal', -1).to_list(3000)
    return [serialize_doc(i) for i in items]


@router.post("/sarpras/peminjaman-ruangan")
async def create_peminjaman_ruangan(req: PeminjamanRuanganRequest, user: Dict = Depends(require_role(*SARPRAS_ROLES))):
    room = await _get_room_or_404(req.room_id)
    peminjam = await _get_user_or_404(req.peminjam_id)

    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        'room_nama': room.get('name'),
        **_user_fields('peminjam', peminjam),
        'petugas_id': user['id'],
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }
    await db.sarpras_peminjaman_ruangan.insert_one(doc)
    await log_audit(user, 'sarpras_peminjaman_ruangan_create', f"{peminjam.get('full_name')} memesan ruangan {room.get('name')}")
    return serialize_doc(doc)


@router.put("/sarpras/peminjaman-ruangan/{item_id}")
async def update_peminjaman_ruangan(item_id: str, req: PeminjamanRuanganRequest, user: Dict = Depends(require_role(*SARPRAS_ROLES))):
    existing = await db.sarpras_peminjaman_ruangan.find_one({'id': item_id})
    if not existing:
        raise HTTPException(404, "Data peminjaman ruangan tidak ditemukan")

    update_data = req.model_dump()
    if req.room_id != existing.get('room_id'):
        room = await _get_room_or_404(req.room_id)
        update_data['room_nama'] = room.get('name')
    if req.peminjam_id != existing.get('peminjam_id'):
        peminjam = await _get_user_or_404(req.peminjam_id)
        update_data.update(_user_fields('peminjam', peminjam))
    update_data['updated_at'] = datetime.utcnow().isoformat()

    await db.sarpras_peminjaman_ruangan.update_one({'id': item_id}, {'$set': update_data})
    await log_audit(user, 'sarpras_peminjaman_ruangan_update', f"Updated peminjaman ruangan: {item_id}")

    updated = await db.sarpras_peminjaman_ruangan.find_one({'id': item_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/sarpras/peminjaman-ruangan/{item_id}")
async def delete_peminjaman_ruangan(item_id: str, user: Dict = Depends(require_role(*SARPRAS_ROLES))):
    existing = await db.sarpras_peminjaman_ruangan.find_one({'id': item_id})
    if not existing:
        raise HTTPException(404, "Data peminjaman ruangan tidak ditemukan")
    await db.sarpras_peminjaman_ruangan.delete_one({'id': item_id})
    await log_audit(user, 'sarpras_peminjaman_ruangan_delete', f"Deleted peminjaman ruangan: {item_id}")
    return {'message': 'Data peminjaman ruangan berhasil dihapus'}


# ============================================================
# JURNAL PENGGUNAAN RUANGAN ENDPOINTS
# ============================================================

@router.get("/sarpras/jurnal-ruangan")
async def list_jurnal_ruangan(room_id: Optional[str] = None, user: Dict = Depends(get_current_user)):
    query = {}
    if room_id:
        query['room_id'] = room_id
    items = await db.sarpras_jurnal_ruangan.find(query, {'_id': 0}).sort('tanggal', -1).to_list(3000)
    return [serialize_doc(i) for i in items]


@router.post("/sarpras/jurnal-ruangan")
async def create_jurnal_ruangan(req: JurnalRuanganRequest, user: Dict = Depends(require_role(*SARPRAS_ROLES))):
    room = await _get_room_or_404(req.room_id)

    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        'room_nama': room.get('name'),
        'petugas_id': user['id'],
        'created_at': datetime.utcnow().isoformat(),
    }

    if req.penanggung_jawab_id:
        pj = await _get_user_or_404(req.penanggung_jawab_id)
        doc.update(_user_fields('penanggung_jawab', pj))

    await db.sarpras_jurnal_ruangan.insert_one(doc)
    await log_audit(user, 'sarpras_jurnal_ruangan_create', f"Jurnal penggunaan ruangan: {room.get('name')}")
    return serialize_doc(doc)


@router.delete("/sarpras/jurnal-ruangan/{item_id}")
async def delete_jurnal_ruangan(item_id: str, user: Dict = Depends(require_role(*SARPRAS_ROLES))):
    existing = await db.sarpras_jurnal_ruangan.find_one({'id': item_id})
    if not existing:
        raise HTTPException(404, "Data jurnal tidak ditemukan")
    await db.sarpras_jurnal_ruangan.delete_one({'id': item_id})
    await log_audit(user, 'sarpras_jurnal_ruangan_delete', f"Deleted jurnal ruangan: {item_id}")
    return {'message': 'Data jurnal berhasil dihapus'}


# ============================================================
# JURNAL PENGGUNAAN ALAT ENDPOINTS
# ============================================================

@router.get("/sarpras/jurnal-alat")
async def list_jurnal_alat(aset_id: Optional[str] = None, user: Dict = Depends(get_current_user)):
    query = {}
    if aset_id:
        query['aset_id'] = aset_id
    items = await db.sarpras_jurnal_alat.find(query, {'_id': 0}).sort('tanggal', -1).to_list(3000)
    return [serialize_doc(i) for i in items]


@router.post("/sarpras/jurnal-alat")
async def create_jurnal_alat(req: JurnalAlatRequest, user: Dict = Depends(require_role(*SARPRAS_ROLES))):
    aset_doc, _, name_field = await _resolve_aset('tetap', req.aset_id)

    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        'aset_nama': aset_doc.get(name_field),
        'petugas_id': user['id'],
        'created_at': datetime.utcnow().isoformat(),
    }

    if req.pengguna_id:
        pengguna = await _get_user_or_404(req.pengguna_id)
        doc.update(_user_fields('pengguna', pengguna))

    await db.sarpras_jurnal_alat.insert_one(doc)
    await log_audit(user, 'sarpras_jurnal_alat_create', f"Jurnal penggunaan alat: {aset_doc.get(name_field)}")
    return serialize_doc(doc)


@router.delete("/sarpras/jurnal-alat/{item_id}")
async def delete_jurnal_alat(item_id: str, user: Dict = Depends(require_role(*SARPRAS_ROLES))):
    existing = await db.sarpras_jurnal_alat.find_one({'id': item_id})
    if not existing:
        raise HTTPException(404, "Data jurnal tidak ditemukan")
    await db.sarpras_jurnal_alat.delete_one({'id': item_id})
    await log_audit(user, 'sarpras_jurnal_alat_delete', f"Deleted jurnal alat: {item_id}")
    return {'message': 'Data jurnal berhasil dihapus'}


# ============================================================
# JURNAL PERAWATAN ASET ENDPOINTS
# ============================================================

@router.get("/sarpras/jurnal-perawatan")
async def list_jurnal_perawatan(aset_tipe: Optional[str] = None, user: Dict = Depends(get_current_user)):
    query = {}
    if aset_tipe:
        query['aset_tipe'] = aset_tipe
    items = await db.sarpras_jurnal_perawatan.find(query, {'_id': 0}).sort('tanggal', -1).to_list(3000)
    return [serialize_doc(i) for i in items]


@router.post("/sarpras/jurnal-perawatan")
async def create_jurnal_perawatan(req: JurnalPerawatanRequest, user: Dict = Depends(require_role(*SARPRAS_ROLES))):
    aset_doc, _, name_field = await _resolve_aset(req.aset_tipe, req.aset_id)

    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        'aset_nama': aset_doc.get(name_field),
        'petugas_id': user['id'],
        'petugas_nama': user.get('full_name', user.get('username')),
        'created_at': datetime.utcnow().isoformat(),
    }
    await db.sarpras_jurnal_perawatan.insert_one(doc)
    await log_audit(user, 'sarpras_jurnal_perawatan_create', f"Perawatan aset: {aset_doc.get(name_field)}")
    return serialize_doc(doc)


@router.delete("/sarpras/jurnal-perawatan/{item_id}")
async def delete_jurnal_perawatan(item_id: str, user: Dict = Depends(require_role(*SARPRAS_ROLES))):
    existing = await db.sarpras_jurnal_perawatan.find_one({'id': item_id})
    if not existing:
        raise HTTPException(404, "Data jurnal perawatan tidak ditemukan")
    await db.sarpras_jurnal_perawatan.delete_one({'id': item_id})
    await log_audit(user, 'sarpras_jurnal_perawatan_delete', f"Deleted jurnal perawatan: {item_id}")
    return {'message': 'Data jurnal perawatan berhasil dihapus'}


# ============================================================
# LAPORAN KERUSAKAN & PERBAIKAN ENDPOINTS
# ============================================================

@router.get("/sarpras/kerusakan")
async def list_kerusakan(status: Optional[str] = None, aset_tipe: Optional[str] = None, user: Dict = Depends(get_current_user)):
    query = {}
    if status:
        query['status'] = status
    if aset_tipe:
        query['aset_tipe'] = aset_tipe
    items = await db.sarpras_kerusakan.find(query, {'_id': 0}).sort('tanggal_lapor', -1).to_list(3000)
    return [serialize_doc(i) for i in items]


@router.post("/sarpras/kerusakan")
async def create_kerusakan(req: LaporanKerusakanRequest, user: Dict = Depends(require_role(*SARPRAS_ROLES))):
    aset_doc, _, name_field = await _resolve_aset(req.aset_tipe, req.aset_id)

    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        'aset_nama': aset_doc.get(name_field),
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }

    if req.pelapor_id:
        pelapor = await _get_user_or_404(req.pelapor_id)
        doc.update(_user_fields('pelapor', pelapor))

    await db.sarpras_kerusakan.insert_one(doc)
    await log_audit(user, 'sarpras_kerusakan_create', f"Laporan kerusakan: {aset_doc.get(name_field)}")
    return serialize_doc(doc)


@router.put("/sarpras/kerusakan/{item_id}")
async def update_kerusakan(item_id: str, req: LaporanKerusakanRequest, user: Dict = Depends(require_role(*SARPRAS_ROLES))):
    existing = await db.sarpras_kerusakan.find_one({'id': item_id})
    if not existing:
        raise HTTPException(404, "Data laporan kerusakan tidak ditemukan")

    update_data = req.model_dump()
    if req.aset_id != existing.get('aset_id') or req.aset_tipe != existing.get('aset_tipe'):
        aset_doc, _, name_field = await _resolve_aset(req.aset_tipe, req.aset_id)
        update_data['aset_nama'] = aset_doc.get(name_field)
    if req.pelapor_id and req.pelapor_id != existing.get('pelapor_id'):
        pelapor = await _get_user_or_404(req.pelapor_id)
        update_data.update(_user_fields('pelapor', pelapor))
    update_data['updated_at'] = datetime.utcnow().isoformat()

    await db.sarpras_kerusakan.update_one({'id': item_id}, {'$set': update_data})
    await log_audit(user, 'sarpras_kerusakan_update', f"Updated laporan kerusakan: {item_id}")

    updated = await db.sarpras_kerusakan.find_one({'id': item_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/sarpras/kerusakan/{item_id}")
async def delete_kerusakan(item_id: str, user: Dict = Depends(require_role(*SARPRAS_ROLES))):
    existing = await db.sarpras_kerusakan.find_one({'id': item_id})
    if not existing:
        raise HTTPException(404, "Data laporan kerusakan tidak ditemukan")
    await db.sarpras_kerusakan.delete_one({'id': item_id})
    await log_audit(user, 'sarpras_kerusakan_delete', f"Deleted laporan kerusakan: {item_id}")
    return {'message': 'Data laporan kerusakan berhasil dihapus'}


@router.get("/sarpras/kerusakan/summary")
async def get_kerusakan_summary(user: Dict = Depends(require_role(*SARPRAS_ROLES, 'kepala_sekolah'))):
    items = await db.sarpras_kerusakan.find({}, {'_id': 0}).to_list(10000)

    def by_field(records, field):
        counts = {}
        for r in records:
            key = r.get(field) or 'Lainnya'
            counts[key] = counts.get(key, 0) + 1
        return counts

    total_biaya = sum(r.get('biaya_perbaikan') or 0 for r in items)

    return {
        'total_laporan': len(items),
        'by_status': by_field(items, 'status'),
        'by_tingkat': by_field(items, 'tingkat_kerusakan'),
        'by_aset_tipe': by_field(items, 'aset_tipe'),
        'total_biaya_perbaikan': total_biaya,
    }
