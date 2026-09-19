"""API endpoints for subject-lab management (Lab IPA, Lab Komputer).

This is a thin, room-scoped facade over the Sarpras collections: Lab IPA and
Lab Komputer are treated as regular Sarpras-managed rooms, so admin/Waka
Sarpras keep full visibility and control from the Sarpras menus, while
Guru IPA / Guru TIK get a narrowed view+write surface limited to their own
lab's room, assets, loans, journals, and damage reports.
"""
from typing import Dict, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import uuid

from core import db, get_current_user, require_role, serialize_doc, log_audit

router = APIRouter()

LAB_ROOM_NAMES = {
    'ipa': 'Lab IPA',
    'komputer': 'Lab Komputer',
}
LAB_ROLE_BY_KEY = {
    'ipa': ('admin', 'guru_ipa'),
    'komputer': ('admin', 'guru_tik'),
}


def _require_lab_key(lab_key: str) -> str:
    if lab_key not in LAB_ROOM_NAMES:
        raise HTTPException(400, "Lab tidak dikenal. Gunakan 'ipa' atau 'komputer'.")
    return lab_key


async def _get_lab_room(lab_key: str) -> Dict:
    room = await db.rooms.find_one({'name': LAB_ROOM_NAMES[lab_key]})
    if not room:
        raise HTTPException(404, f"Ruangan {LAB_ROOM_NAMES[lab_key]} belum terdaftar. Hubungi admin/Sarpras.")
    return room


def _check_lab_access(lab_key: str, user: Dict):
    allowed = LAB_ROLE_BY_KEY[lab_key]
    active = user.get('active_role')
    if active not in allowed and 'admin' not in user.get('roles', []):
        raise HTTPException(403, f"Akses ditolak untuk lab ini. Peran aktif: {active}")


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


async def _resolve_aset(aset_tipe: str, aset_id: str):
    if aset_tipe == 'tetap':
        doc = await db.sarpras_aset_tetap.find_one({'id': aset_id})
        if not doc:
            raise HTTPException(404, "Aset tidak ditemukan")
        return doc, db.sarpras_aset_tetap, 'nama_aset'
    elif aset_tipe == 'lancar':
        doc = await db.sarpras_aset_lancar.find_one({'id': aset_id})
        if not doc:
            raise HTTPException(404, "Aset tidak ditemukan")
        return doc, db.sarpras_aset_lancar, 'nama_barang'
    raise HTTPException(400, "aset_tipe harus 'tetap' atau 'lancar'")


# ============================================================
# REQUEST MODELS
# ============================================================

class LabPeminjamanRuanganRequest(BaseModel):
    peminjam_id: str
    tanggal: str
    jam_mulai: Optional[str] = None
    jam_selesai: Optional[str] = None
    keperluan: str
    status: Optional[str] = 'Dipesan'
    catatan: Optional[str] = None


class LabJurnalRuanganRequest(BaseModel):
    tanggal: str
    jam_mulai: Optional[str] = None
    jam_selesai: Optional[str] = None
    kegiatan: str
    penanggung_jawab_id: Optional[str] = None
    kondisi_setelah: Optional[str] = None
    keterangan: Optional[str] = None


class LabJurnalPengelolaanRequest(BaseModel):
    aset_tipe: str  # 'tetap', 'lancar', or 'room'
    aset_id: str
    tanggal: str
    jenis_perawatan: str
    petugas_pelaksana: Optional[str] = None
    biaya: Optional[float] = None
    hasil: Optional[str] = None
    keterangan: Optional[str] = None


class LabPeminjamanAlatRequest(BaseModel):
    aset_tipe: str  # 'tetap' or 'lancar'
    aset_id: str
    peminjam_id: str
    tanggal_pinjam: str
    tanggal_kembali_rencana: Optional[str] = None
    tanggal_kembali_aktual: Optional[str] = None
    jumlah: int = 1
    status: Optional[str] = 'Dipinjam'
    keperluan: Optional[str] = None
    catatan: Optional[str] = None


class LabKerusakanRequest(BaseModel):
    aset_tipe: str  # 'tetap', 'lancar', or 'room'
    aset_id: str
    tanggal_lapor: str
    pelapor_id: Optional[str] = None
    deskripsi_kerusakan: str
    tingkat_kerusakan: Optional[str] = 'Ringan'
    status: Optional[str] = 'Dilaporkan'
    tanggal_perbaikan: Optional[str] = None
    biaya_perbaikan: Optional[float] = None
    hasil_perbaikan: Optional[str] = None


async def _get_lab_asset_or_403(lab_key: str, room_id: str, aset_tipe: str, aset_id: str):
    """Resolve an asset and verify it actually belongs to this lab's room."""
    doc, collection, name_field = await _resolve_aset(aset_tipe, aset_id)
    if doc.get('lokasi_room_id') != room_id:
        raise HTTPException(403, "Aset ini bukan bagian dari lab ini")
    return doc, collection, name_field


# ============================================================
# WARGA MADRASAH LOOKUP (for peminjam / penanggung jawab picker)
# ============================================================

@router.get("/lab/{lab_key}/warga-madrasah")
async def list_warga_madrasah(lab_key: str, search: Optional[str] = None, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)
    query = {'is_active': {'$ne': False}}
    if search:
        query['full_name'] = {'$regex': search, '$options': 'i'}
    items = await db.users.find(
        query,
        {'_id': 0, 'id': 1, 'full_name': 1, 'nis': 1, 'nip_nuptk': 1, 'username': 1, 'roles': 1}
    ).sort('full_name', 1).to_list(3000)
    return [serialize_doc(i) for i in items]


# ============================================================
# ALAT DAN BAHAN LAB (read-only view onto Sarpras assets in this room)
# ============================================================

@router.get("/lab/{lab_key}/alat-bahan")
async def list_alat_bahan(lab_key: str, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)
    room = await _get_lab_room(lab_key)

    tetap = await db.sarpras_aset_tetap.find({'lokasi_room_id': room['id']}, {'_id': 0}).sort('nama_aset', 1).to_list(2000)
    lancar = await db.sarpras_aset_lancar.find({'lokasi_room_id': room['id']}, {'_id': 0}).sort('nama_barang', 1).to_list(2000)
    return {
        'room': serialize_doc(room),
        'aset_tetap': [serialize_doc(a) for a in tetap],
        'aset_lancar': [serialize_doc(a) for a in lancar],
    }


# ============================================================
# JADWAL PENGGUNAAN LAB (room bookings, scoped to this lab's room)
# ============================================================

@router.get("/lab/{lab_key}/jadwal")
async def list_jadwal(lab_key: str, status: Optional[str] = None, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)
    room = await _get_lab_room(lab_key)

    query = {'room_id': room['id']}
    if status:
        query['status'] = status
    items = await db.sarpras_peminjaman_ruangan.find(query, {'_id': 0}).sort('tanggal', -1).to_list(2000)
    return [serialize_doc(i) for i in items]


@router.post("/lab/{lab_key}/jadwal")
async def create_jadwal(lab_key: str, req: LabPeminjamanRuanganRequest, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)
    room = await _get_lab_room(lab_key)
    peminjam = await _get_user_or_404(req.peminjam_id)

    doc = {
        'id': str(uuid.uuid4()),
        'room_id': room['id'],
        'room_nama': room.get('name'),
        **req.model_dump(),
        **_user_fields('peminjam', peminjam),
        'petugas_id': user['id'],
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }
    await db.sarpras_peminjaman_ruangan.insert_one(doc)
    await log_audit(user, f'lab_{lab_key}_jadwal_create', f"{peminjam.get('full_name')} memesan {room.get('name')}")
    return serialize_doc(doc)


@router.put("/lab/{lab_key}/jadwal/{item_id}")
async def update_jadwal(lab_key: str, item_id: str, req: LabPeminjamanRuanganRequest, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)
    room = await _get_lab_room(lab_key)

    existing = await db.sarpras_peminjaman_ruangan.find_one({'id': item_id, 'room_id': room['id']})
    if not existing:
        raise HTTPException(404, "Data jadwal tidak ditemukan")

    update_data = req.model_dump()
    if req.peminjam_id != existing.get('peminjam_id'):
        peminjam = await _get_user_or_404(req.peminjam_id)
        update_data.update(_user_fields('peminjam', peminjam))
    update_data['updated_at'] = datetime.utcnow().isoformat()

    await db.sarpras_peminjaman_ruangan.update_one({'id': item_id}, {'$set': update_data})
    await log_audit(user, f'lab_{lab_key}_jadwal_update', f"Updated jadwal: {item_id}")

    updated = await db.sarpras_peminjaman_ruangan.find_one({'id': item_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/lab/{lab_key}/jadwal/{item_id}")
async def delete_jadwal(lab_key: str, item_id: str, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)
    room = await _get_lab_room(lab_key)

    existing = await db.sarpras_peminjaman_ruangan.find_one({'id': item_id, 'room_id': room['id']})
    if not existing:
        raise HTTPException(404, "Data jadwal tidak ditemukan")

    await db.sarpras_peminjaman_ruangan.delete_one({'id': item_id})
    await log_audit(user, f'lab_{lab_key}_jadwal_delete', f"Deleted jadwal: {item_id}")
    return {'message': 'Data jadwal berhasil dihapus'}


# ============================================================
# JURNAL PENGGUNAAN LAB (room usage log, scoped to this lab's room)
# ============================================================

@router.get("/lab/{lab_key}/jurnal-penggunaan")
async def list_jurnal_penggunaan(lab_key: str, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)
    room = await _get_lab_room(lab_key)

    items = await db.sarpras_jurnal_ruangan.find({'room_id': room['id']}, {'_id': 0}).sort('tanggal', -1).to_list(2000)
    return [serialize_doc(i) for i in items]


@router.post("/lab/{lab_key}/jurnal-penggunaan")
async def create_jurnal_penggunaan(lab_key: str, req: LabJurnalRuanganRequest, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)
    room = await _get_lab_room(lab_key)

    doc = {
        'id': str(uuid.uuid4()),
        'room_id': room['id'],
        'room_nama': room.get('name'),
        **req.model_dump(),
        'petugas_id': user['id'],
        'created_at': datetime.utcnow().isoformat(),
    }
    if req.penanggung_jawab_id:
        pj = await _get_user_or_404(req.penanggung_jawab_id)
        doc.update(_user_fields('penanggung_jawab', pj))

    await db.sarpras_jurnal_ruangan.insert_one(doc)
    await log_audit(user, f'lab_{lab_key}_jurnal_penggunaan_create', f"Jurnal penggunaan {room.get('name')}")
    return serialize_doc(doc)


@router.delete("/lab/{lab_key}/jurnal-penggunaan/{item_id}")
async def delete_jurnal_penggunaan(lab_key: str, item_id: str, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)
    room = await _get_lab_room(lab_key)

    existing = await db.sarpras_jurnal_ruangan.find_one({'id': item_id, 'room_id': room['id']})
    if not existing:
        raise HTTPException(404, "Data jurnal tidak ditemukan")

    await db.sarpras_jurnal_ruangan.delete_one({'id': item_id})
    await log_audit(user, f'lab_{lab_key}_jurnal_penggunaan_delete', f"Deleted jurnal penggunaan: {item_id}")
    return {'message': 'Data jurnal berhasil dihapus'}


# ============================================================
# JURNAL PENGELOLAAN (asset/room maintenance log, scoped to this lab)
# ============================================================

@router.get("/lab/{lab_key}/jurnal-pengelolaan")
async def list_jurnal_pengelolaan(lab_key: str, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)
    room = await _get_lab_room(lab_key)

    tetap_ids = [a['id'] for a in await db.sarpras_aset_tetap.find({'lokasi_room_id': room['id']}, {'_id': 0, 'id': 1}).to_list(2000)]
    lancar_ids = [a['id'] for a in await db.sarpras_aset_lancar.find({'lokasi_room_id': room['id']}, {'_id': 0, 'id': 1}).to_list(2000)]
    all_ids = tetap_ids + lancar_ids + [room['id']]

    items = await db.sarpras_jurnal_perawatan.find({'aset_id': {'$in': all_ids}}, {'_id': 0}).sort('tanggal', -1).to_list(2000)
    return [serialize_doc(i) for i in items]


@router.post("/lab/{lab_key}/jurnal-pengelolaan")
async def create_jurnal_pengelolaan(lab_key: str, req: LabJurnalPengelolaanRequest, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)
    room = await _get_lab_room(lab_key)

    if req.aset_tipe == 'room':
        if req.aset_id != room['id']:
            raise HTTPException(403, "Ruangan ini bukan bagian dari lab ini")
        aset_nama = room.get('name')
    else:
        aset_doc, _, name_field = await _get_lab_asset_or_403(lab_key, room['id'], req.aset_tipe, req.aset_id)
        aset_nama = aset_doc.get(name_field)

    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        'aset_nama': aset_nama,
        'petugas_id': user['id'],
        'petugas_nama': user.get('full_name', user.get('username')),
        'created_at': datetime.utcnow().isoformat(),
    }
    await db.sarpras_jurnal_perawatan.insert_one(doc)
    await log_audit(user, f'lab_{lab_key}_jurnal_pengelolaan_create', f"Pengelolaan: {aset_nama}")
    return serialize_doc(doc)


@router.delete("/lab/{lab_key}/jurnal-pengelolaan/{item_id}")
async def delete_jurnal_pengelolaan(lab_key: str, item_id: str, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)

    existing = await db.sarpras_jurnal_perawatan.find_one({'id': item_id})
    if not existing:
        raise HTTPException(404, "Data jurnal pengelolaan tidak ditemukan")

    await db.sarpras_jurnal_perawatan.delete_one({'id': item_id})
    await log_audit(user, f'lab_{lab_key}_jurnal_pengelolaan_delete', f"Deleted jurnal pengelolaan: {item_id}")
    return {'message': 'Data jurnal pengelolaan berhasil dihapus'}


# ============================================================
# PEMINJAMAN ALAT (item loans, scoped to assets in this lab)
# ============================================================

@router.get("/lab/{lab_key}/peminjaman-alat")
async def list_peminjaman_alat(lab_key: str, status: Optional[str] = None, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)
    room = await _get_lab_room(lab_key)

    tetap_ids = [a['id'] for a in await db.sarpras_aset_tetap.find({'lokasi_room_id': room['id']}, {'_id': 0, 'id': 1}).to_list(2000)]
    lancar_ids = [a['id'] for a in await db.sarpras_aset_lancar.find({'lokasi_room_id': room['id']}, {'_id': 0, 'id': 1}).to_list(2000)]

    query = {'aset_id': {'$in': tetap_ids + lancar_ids}}
    if status:
        query['status'] = status
    items = await db.sarpras_peminjaman_barang.find(query, {'_id': 0}).sort('tanggal_pinjam', -1).to_list(2000)
    return [serialize_doc(i) for i in items]


@router.post("/lab/{lab_key}/peminjaman-alat")
async def create_peminjaman_alat(lab_key: str, req: LabPeminjamanAlatRequest, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)
    room = await _get_lab_room(lab_key)

    aset_doc, _, name_field = await _get_lab_asset_or_403(lab_key, room['id'], req.aset_tipe, req.aset_id)
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
    await log_audit(user, f'lab_{lab_key}_peminjaman_alat_create', f"{peminjam.get('full_name')} meminjam {aset_doc.get(name_field)}")
    return serialize_doc(doc)


@router.put("/lab/{lab_key}/peminjaman-alat/{item_id}")
async def update_peminjaman_alat(lab_key: str, item_id: str, req: LabPeminjamanAlatRequest, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)
    room = await _get_lab_room(lab_key)

    existing = await db.sarpras_peminjaman_barang.find_one({'id': item_id})
    if not existing:
        raise HTTPException(404, "Data peminjaman tidak ditemukan")

    update_data = req.model_dump()
    if req.aset_id != existing.get('aset_id') or req.aset_tipe != existing.get('aset_tipe'):
        aset_doc, _, name_field = await _get_lab_asset_or_403(lab_key, room['id'], req.aset_tipe, req.aset_id)
        update_data['aset_nama'] = aset_doc.get(name_field)
    if req.peminjam_id != existing.get('peminjam_id'):
        peminjam = await _get_user_or_404(req.peminjam_id)
        update_data.update(_user_fields('peminjam', peminjam))
    update_data['updated_at'] = datetime.utcnow().isoformat()

    await db.sarpras_peminjaman_barang.update_one({'id': item_id}, {'$set': update_data})
    await log_audit(user, f'lab_{lab_key}_peminjaman_alat_update', f"Updated peminjaman alat: {item_id}")

    updated = await db.sarpras_peminjaman_barang.find_one({'id': item_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/lab/{lab_key}/peminjaman-alat/{item_id}")
async def delete_peminjaman_alat(lab_key: str, item_id: str, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)

    existing = await db.sarpras_peminjaman_barang.find_one({'id': item_id})
    if not existing:
        raise HTTPException(404, "Data peminjaman tidak ditemukan")

    await db.sarpras_peminjaman_barang.delete_one({'id': item_id})
    await log_audit(user, f'lab_{lab_key}_peminjaman_alat_delete', f"Deleted peminjaman alat: {item_id}")
    return {'message': 'Data peminjaman berhasil dihapus'}


# ============================================================
# LAPORAN KERUSAKAN (damage reports, scoped to this lab's assets/room)
# ============================================================

@router.get("/lab/{lab_key}/kerusakan")
async def list_kerusakan(lab_key: str, status: Optional[str] = None, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)
    room = await _get_lab_room(lab_key)

    tetap_ids = [a['id'] for a in await db.sarpras_aset_tetap.find({'lokasi_room_id': room['id']}, {'_id': 0, 'id': 1}).to_list(2000)]
    lancar_ids = [a['id'] for a in await db.sarpras_aset_lancar.find({'lokasi_room_id': room['id']}, {'_id': 0, 'id': 1}).to_list(2000)]
    all_ids = tetap_ids + lancar_ids + [room['id']]

    query = {'aset_id': {'$in': all_ids}}
    if status:
        query['status'] = status
    items = await db.sarpras_kerusakan.find(query, {'_id': 0}).sort('tanggal_lapor', -1).to_list(2000)
    return [serialize_doc(i) for i in items]


@router.post("/lab/{lab_key}/kerusakan")
async def create_kerusakan(lab_key: str, req: LabKerusakanRequest, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)
    room = await _get_lab_room(lab_key)

    if req.aset_tipe == 'room':
        if req.aset_id != room['id']:
            raise HTTPException(403, "Ruangan ini bukan bagian dari lab ini")
        aset_nama = room.get('name')
    else:
        aset_doc, _, name_field = await _get_lab_asset_or_403(lab_key, room['id'], req.aset_tipe, req.aset_id)
        aset_nama = aset_doc.get(name_field)

    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        'aset_nama': aset_nama,
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }
    if req.pelapor_id:
        pelapor = await _get_user_or_404(req.pelapor_id)
        doc.update(_user_fields('pelapor', pelapor))

    await db.sarpras_kerusakan.insert_one(doc)
    await log_audit(user, f'lab_{lab_key}_kerusakan_create', f"Laporan kerusakan: {aset_nama}")
    return serialize_doc(doc)


@router.put("/lab/{lab_key}/kerusakan/{item_id}")
async def update_kerusakan(lab_key: str, item_id: str, req: LabKerusakanRequest, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)

    existing = await db.sarpras_kerusakan.find_one({'id': item_id})
    if not existing:
        raise HTTPException(404, "Data laporan kerusakan tidak ditemukan")

    update_data = req.model_dump()
    update_data['updated_at'] = datetime.utcnow().isoformat()

    await db.sarpras_kerusakan.update_one({'id': item_id}, {'$set': update_data})
    await log_audit(user, f'lab_{lab_key}_kerusakan_update', f"Updated laporan kerusakan: {item_id}")

    updated = await db.sarpras_kerusakan.find_one({'id': item_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/lab/{lab_key}/kerusakan/{item_id}")
async def delete_kerusakan(lab_key: str, item_id: str, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)

    existing = await db.sarpras_kerusakan.find_one({'id': item_id})
    if not existing:
        raise HTTPException(404, "Data laporan kerusakan tidak ditemukan")

    await db.sarpras_kerusakan.delete_one({'id': item_id})
    await log_audit(user, f'lab_{lab_key}_kerusakan_delete', f"Deleted laporan kerusakan: {item_id}")
    return {'message': 'Data laporan kerusakan berhasil dihapus'}
