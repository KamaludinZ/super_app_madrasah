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

from fastapi.responses import StreamingResponse
import io

from core import db, get_current_user, require_role, serialize_doc, log_audit, get_settings

router = APIRouter()

LAB_ROOM_NAMES = {
    'ipa': 'Lab IPA',
    'komputer': 'Lab Komputer',
    'bahasa': 'Lab Bahasa',
    'agama': 'Lab Agama',
    'ips': 'Lab IPS',
    'seni': 'Lab Seni',
}
LAB_ROLE_BY_KEY = {
    'ipa': ('admin', 'guru_ipa'),
    'komputer': ('admin', 'guru_tik'),
    'bahasa': ('admin', 'guru_bahasa'),
    'agama': ('admin', 'guru_agama'),
    'ips': ('admin', 'guru_ips'),
    'seni': ('admin', 'guru_seni'),
}
LAB_KATEGORI_ALAT_BAHAN = {
    'ipa': ['Fisika', 'Biologi', 'Kimia', 'Bahan Kimia', 'Alat Gelas', 'Umum'],
    'komputer': ['Hardware', 'Software', 'Jaringan', 'Peripheral', 'Umum'],
    'bahasa': ['Audio Visual', 'Buku & Literatur', 'Alat Peraga', 'Umum'],
    'agama': ['Alat Ibadah', 'Buku & Literatur', 'Alat Peraga', 'Umum'],
    'ips': ['Peta & Globe', 'Alat Peraga', 'Buku & Literatur', 'Umum'],
    'seni': ['Alat Musik', 'Alat Lukis/Rupa', 'Kostum & Properti', 'Umum'],
}
LAB_KERUSAKAN_STATUS = ['Diajukan', 'Proses Ganti', 'Selesai Diganti']
LAB_JADWAL_HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']


def _require_lab_key(lab_key: str) -> str:
    if lab_key not in LAB_ROOM_NAMES:
        raise HTTPException(400, f"Lab tidak dikenal. Gunakan salah satu: {', '.join(LAB_ROOM_NAMES.keys())}.")
    return lab_key


async def _get_lab_room(lab_key: str) -> Dict:
    """Ambil (atau buat otomatis jika belum ada) ruangan lab ini di
    collection rooms — guru mapel non-Sarpras tidak bisa membuat ruangan
    sendiri lewat menu Sarpras, jadi dibuat otomatis saat pertama dibutuhkan."""
    room_name = LAB_ROOM_NAMES[lab_key]
    room = await db.rooms.find_one({'name': room_name})
    if room:
        return room
    doc = {
        'id': str(uuid.uuid4()),
        'name': room_name,
        'created_at': datetime.utcnow().isoformat(),
    }
    await db.rooms.insert_one(doc)
    return doc


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

class LabAlatBahanRequest(BaseModel):
    aset_tipe: str  # 'tetap' or 'lancar'
    nama: str
    kategori: Optional[str] = None
    satuan: Optional[str] = None
    jumlah_baik: int = 0
    jumlah_rusak: int = 0
    lokasi_penyimpanan: Optional[str] = None
    ruangan_id: Optional[str] = None  # default: ruangan lab ini sendiri; bisa diganti ruangan lain (mis. gudang)
    keterangan: Optional[str] = None


class LabJadwalMingguanRequest(BaseModel):
    minggu_ke: int = 1  # 1-4
    hari: str  # 'Senin'..'Sabtu'
    jam_mulai: Optional[str] = None
    jam_selesai: Optional[str] = None
    jp_mulai: Optional[int] = None
    jp_selesai: Optional[int] = None
    kelas: str
    guru_nama: str
    keterangan: Optional[str] = None


class LabJurnalRuanganRequest(BaseModel):
    tanggal: str
    jam_mulai: Optional[str] = None
    jam_selesai: Optional[str] = None
    jp_mulai: Optional[int] = None
    jp_selesai: Optional[int] = None
    pengguna_id: Optional[str] = None
    judul_percobaan: str
    alat_bahan_digunakan: Optional[str] = None
    kegiatan: Optional[str] = None
    penanggung_jawab_id: Optional[str] = None
    kondisi_setelah: Optional[str] = None
    keterangan: Optional[str] = None


class LabJurnalPengelolaanRequest(BaseModel):
    aset_tipe: str  # 'tetap', 'lancar', or 'room'
    aset_id: str
    tahun_ajaran: Optional[str] = None
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
    jumlah_rusak: int = 1
    deskripsi_kerusakan: str
    status: Optional[str] = 'Diajukan'  # 'Diajukan' | 'Proses Ganti' | 'Selesai Diganti'
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
async def list_warga_madrasah(
    lab_key: str,
    search: Optional[str] = None,
    peminjam_jenis: Optional[str] = None,  # 'siswa' | 'gtk'
    gtk_jenis: Optional[str] = None,  # 'guru' | 'tenaga_kependidikan' (only when peminjam_jenis='gtk')
    grade: Optional[int] = None,  # tingkat kelas (only when peminjam_jenis='siswa')
    class_id: Optional[str] = None,  # kelas spesifik (only when peminjam_jenis='siswa')
    user: Dict = Depends(get_current_user),
):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)
    query = {'is_active': {'$ne': False}}
    if search:
        query['full_name'] = {'$regex': search, '$options': 'i'}

    if peminjam_jenis == 'siswa':
        query['roles'] = 'siswa'
        if class_id:
            query['student_class_id'] = class_id
        elif grade:
            class_ids = [c['id'] for c in await db.classes.find({'grade': grade}, {'_id': 0, 'id': 1}).to_list(500)]
            query['student_class_id'] = {'$in': class_ids}
    elif peminjam_jenis == 'gtk':
        GURU_ROLES = ['guru', 'wali_kelas', 'guru_piket', 'guru_bk', 'guru_tata_tertib', 'guru_ekstrakurikuler',
                      'guru_ipa', 'guru_ips', 'guru_bahasa', 'guru_seni', 'guru_agama', 'guru_tik']
        if gtk_jenis == 'tenaga_kependidikan':
            query['roles'] = 'tenaga_kependidikan'
        elif gtk_jenis == 'guru':
            query['roles'] = {'$in': GURU_ROLES}
        else:
            query['roles'] = {'$in': GURU_ROLES + ['tenaga_kependidikan']}

    items = await db.users.find(
        query,
        {'_id': 0, 'id': 1, 'full_name': 1, 'nis': 1, 'nip_nuptk': 1, 'username': 1, 'roles': 1, 'student_class_id': 1}
    ).sort('full_name', 1).to_list(3000)
    return [serialize_doc(i) for i in items]


@router.get("/lab/{lab_key}/guru-lab")
async def list_guru_lab(lab_key: str, user: Dict = Depends(get_current_user)):
    """Daftar guru dengan role yang sesuai lab ini (mis. guru_ipa untuk Lab
    IPA, guru_bahasa untuk Lab Bahasa) — untuk dropdown 'Guru' di Jadwal Lab."""
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)
    guru_role = LAB_ROLE_BY_KEY[lab_key][1]  # index 0 selalu 'admin', index 1 role guru spesifik lab ini
    items = await db.users.find(
        {'roles': guru_role, 'is_active': {'$ne': False}},
        {'_id': 0, 'id': 1, 'full_name': 1}
    ).sort('full_name', 1).to_list(500)
    return [serialize_doc(i) for i in items]


# ============================================================
# META (dropdown option lists, per lab)
# ============================================================

@router.get("/lab/{lab_key}/meta")
async def get_lab_meta(lab_key: str, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)
    return {
        'kategori_alat_bahan': LAB_KATEGORI_ALAT_BAHAN.get(lab_key, ['Umum']),
        'kerusakan_status': LAB_KERUSAKAN_STATUS,
        'hari': LAB_JADWAL_HARI,
    }


# ============================================================
# ALAT DAN BAHAN LAB (inventory: view + add/edit/delete, scoped to this room)
# ============================================================

def _alat_bahan_doc_to_row(doc: Dict, aset_tipe: str) -> Dict:
    name_field = 'nama_aset' if aset_tipe == 'tetap' else 'nama_barang'
    return {
        'id': doc.get('id'),
        'aset_tipe': aset_tipe,
        'nama': doc.get(name_field),
        'kategori': doc.get('kategori'),
        'satuan': doc.get('satuan') or ('unit' if aset_tipe == 'tetap' else None),
        'jumlah_baik': doc.get('jumlah_baik', doc.get('jumlah', 0) if aset_tipe == 'tetap' else doc.get('stok', 0)),
        'jumlah_rusak': doc.get('jumlah_rusak', 0),
        'lokasi_penyimpanan': doc.get('lokasi_penyimpanan'),
        'ruangan_id': doc.get('lokasi_room_id'),
        'ruangan_nama': doc.get('lokasi_room_nama'),
        'keterangan': doc.get('keterangan'),
    }


@router.get("/lab/{lab_key}/alat-bahan")
async def list_alat_bahan(lab_key: str, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)
    room = await _get_lab_room(lab_key)

    tetap = await db.sarpras_aset_tetap.find({'lokasi_room_id': room['id']}, {'_id': 0}).sort('nama_aset', 1).to_list(2000)
    lancar = await db.sarpras_aset_lancar.find({'lokasi_room_id': room['id']}, {'_id': 0}).sort('nama_barang', 1).to_list(2000)
    rows = [_alat_bahan_doc_to_row(a, 'tetap') for a in tetap] + [_alat_bahan_doc_to_row(a, 'lancar') for a in lancar]
    rows.sort(key=lambda r: (r['nama'] or '').lower())
    return {
        'room': serialize_doc(room),
        'items': rows,
        'aset_tetap': [serialize_doc(a) for a in tetap],
        'aset_lancar': [serialize_doc(a) for a in lancar],
    }


async def _resolve_target_room(lab_key: str, ruangan_id: Optional[str]) -> Dict:
    """Resolve which room an alat/bahan row belongs to: the room explicitly
    picked in the form, or this lab's own room by default."""
    if ruangan_id:
        room = await db.rooms.find_one({'id': ruangan_id})
        if not room:
            raise HTTPException(404, "Ruangan tidak ditemukan")
        return room
    return await _get_lab_room(lab_key)


@router.post("/lab/{lab_key}/alat-bahan")
async def create_alat_bahan(lab_key: str, req: LabAlatBahanRequest, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)
    room = await _resolve_target_room(lab_key, req.ruangan_id)

    now = datetime.utcnow().isoformat()
    if req.aset_tipe == 'tetap':
        doc = {
            'id': str(uuid.uuid4()),
            'nama_aset': req.nama,
            'kategori': req.kategori,
            'jumlah': req.jumlah_baik + req.jumlah_rusak,
            'jumlah_baik': req.jumlah_baik,
            'jumlah_rusak': req.jumlah_rusak,
            'kondisi': 'Baik' if req.jumlah_rusak == 0 else 'Rusak Ringan',
            'satuan': req.satuan,
            'lokasi_penyimpanan': req.lokasi_penyimpanan,
            'lokasi_room_id': room['id'],
            'lokasi_room_nama': room.get('name'),
            'keterangan': req.keterangan,
            'created_at': now,
            'updated_at': now,
        }
        await db.sarpras_aset_tetap.insert_one(doc)
    elif req.aset_tipe == 'lancar':
        doc = {
            'id': str(uuid.uuid4()),
            'nama_barang': req.nama,
            'kategori': req.kategori,
            'satuan': req.satuan or 'pcs',
            'stok': req.jumlah_baik,
            'jumlah_baik': req.jumlah_baik,
            'jumlah_rusak': req.jumlah_rusak,
            'lokasi_penyimpanan': req.lokasi_penyimpanan,
            'lokasi_room_id': room['id'],
            'lokasi_room_nama': room.get('name'),
            'keterangan': req.keterangan,
            'created_at': now,
            'updated_at': now,
        }
        await db.sarpras_aset_lancar.insert_one(doc)
    else:
        raise HTTPException(400, "aset_tipe harus 'tetap' atau 'lancar'")

    await log_audit(user, f'lab_{lab_key}_alat_bahan_create', f"Tambah alat/bahan: {req.nama}")
    return _alat_bahan_doc_to_row(doc, req.aset_tipe)


@router.put("/lab/{lab_key}/alat-bahan/{aset_tipe}/{item_id}")
async def update_alat_bahan(lab_key: str, aset_tipe: str, item_id: str, req: LabAlatBahanRequest, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)
    lab_room = await _get_lab_room(lab_key)

    _, collection, _ = await _get_lab_asset_or_403(lab_key, lab_room['id'], aset_tipe, item_id)
    target_room = await _resolve_target_room(lab_key, req.ruangan_id)
    now = datetime.utcnow().isoformat()

    if aset_tipe == 'tetap':
        update_data = {
            'nama_aset': req.nama, 'kategori': req.kategori, 'satuan': req.satuan,
            'jumlah': req.jumlah_baik + req.jumlah_rusak,
            'jumlah_baik': req.jumlah_baik, 'jumlah_rusak': req.jumlah_rusak,
            'kondisi': 'Baik' if req.jumlah_rusak == 0 else 'Rusak Ringan',
            'lokasi_penyimpanan': req.lokasi_penyimpanan,
            'lokasi_room_id': target_room['id'], 'lokasi_room_nama': target_room.get('name'),
            'keterangan': req.keterangan, 'updated_at': now,
        }
    else:
        update_data = {
            'nama_barang': req.nama, 'kategori': req.kategori, 'satuan': req.satuan or 'pcs',
            'stok': req.jumlah_baik, 'jumlah_baik': req.jumlah_baik, 'jumlah_rusak': req.jumlah_rusak,
            'lokasi_penyimpanan': req.lokasi_penyimpanan,
            'lokasi_room_id': target_room['id'], 'lokasi_room_nama': target_room.get('name'),
            'keterangan': req.keterangan, 'updated_at': now,
        }

    await collection.update_one({'id': item_id}, {'$set': update_data})
    await log_audit(user, f'lab_{lab_key}_alat_bahan_update', f"Update alat/bahan: {item_id}")

    updated = await collection.find_one({'id': item_id}, {'_id': 0})
    return _alat_bahan_doc_to_row(updated, aset_tipe)


@router.delete("/lab/{lab_key}/alat-bahan/{aset_tipe}/{item_id}")
async def delete_alat_bahan(lab_key: str, aset_tipe: str, item_id: str, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)
    room = await _get_lab_room(lab_key)

    _, collection, _ = await _get_lab_asset_or_403(lab_key, room['id'], aset_tipe, item_id)
    await collection.delete_one({'id': item_id})
    await log_audit(user, f'lab_{lab_key}_alat_bahan_delete', f"Hapus alat/bahan: {item_id}")
    return {'message': 'Data alat/bahan berhasil dihapus'}


# ============================================================
# JADWAL PENGGUNAAN LAB (room bookings, scoped to this lab's room)
# ============================================================

@router.get("/lab/{lab_key}/jadwal")
async def list_jadwal(lab_key: str, minggu_ke: Optional[int] = None, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)

    query = {'lab_key': lab_key}
    if minggu_ke:
        query['minggu_ke'] = minggu_ke
    items = await db.lab_jadwal_mingguan.find(query, {'_id': 0}).to_list(2000)
    hari_order = {h: i for i, h in enumerate(LAB_JADWAL_HARI)}
    items.sort(key=lambda i: (hari_order.get(i.get('hari'), 99), i.get('jam_mulai') or ''))
    return [serialize_doc(i) for i in items]


@router.post("/lab/{lab_key}/jadwal")
async def create_jadwal(lab_key: str, req: LabJadwalMingguanRequest, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)

    if req.hari not in LAB_JADWAL_HARI:
        raise HTTPException(400, "Hari tidak valid")
    if req.minggu_ke not in (1, 2, 3, 4):
        raise HTTPException(400, "Minggu ke- harus 1-4")

    doc = {
        'id': str(uuid.uuid4()),
        'lab_key': lab_key,
        **req.model_dump(),
        'petugas_id': user['id'],
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }
    await db.lab_jadwal_mingguan.insert_one(doc)
    await log_audit(user, f'lab_{lab_key}_jadwal_create', f"Jadwal {req.hari} kelas {req.kelas}")
    return serialize_doc(doc)


@router.put("/lab/{lab_key}/jadwal/{item_id}")
async def update_jadwal(lab_key: str, item_id: str, req: LabJadwalMingguanRequest, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)

    existing = await db.lab_jadwal_mingguan.find_one({'id': item_id, 'lab_key': lab_key})
    if not existing:
        raise HTTPException(404, "Data jadwal tidak ditemukan")
    if req.hari not in LAB_JADWAL_HARI:
        raise HTTPException(400, "Hari tidak valid")
    if req.minggu_ke not in (1, 2, 3, 4):
        raise HTTPException(400, "Minggu ke- harus 1-4")

    update_data = req.model_dump()
    update_data['updated_at'] = datetime.utcnow().isoformat()

    await db.lab_jadwal_mingguan.update_one({'id': item_id}, {'$set': update_data})
    await log_audit(user, f'lab_{lab_key}_jadwal_update', f"Updated jadwal: {item_id}")

    updated = await db.lab_jadwal_mingguan.find_one({'id': item_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/lab/{lab_key}/jadwal/{item_id}")
async def delete_jadwal(lab_key: str, item_id: str, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)

    existing = await db.lab_jadwal_mingguan.find_one({'id': item_id, 'lab_key': lab_key})
    if not existing:
        raise HTTPException(404, "Data jadwal tidak ditemukan")

    await db.lab_jadwal_mingguan.delete_one({'id': item_id})
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

    pengguna_id = req.pengguna_id or user['id']
    pengguna = await _get_user_or_404(pengguna_id)

    doc = {
        'id': str(uuid.uuid4()),
        'room_id': room['id'],
        'room_nama': room.get('name'),
        **req.model_dump(),
        'pengguna_id': pengguna_id,
        **_user_fields('pengguna', pengguna),
        'petugas_id': user['id'],
        'created_at': datetime.utcnow().isoformat(),
    }
    if req.penanggung_jawab_id:
        pj = await _get_user_or_404(req.penanggung_jawab_id)
        doc.update(_user_fields('penanggung_jawab', pj))

    await db.sarpras_jurnal_ruangan.insert_one(doc)
    await log_audit(user, f'lab_{lab_key}_jurnal_penggunaan_create', f"Jurnal penggunaan {room.get('name')}")
    return serialize_doc(doc)


@router.get("/lab/{lab_key}/jurnal-penggunaan/pdf")
async def export_jurnal_penggunaan_pdf_endpoint(lab_key: str, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)
    room = await _get_lab_room(lab_key)

    rows = await db.sarpras_jurnal_ruangan.find({'room_id': room['id']}, {'_id': 0}).sort('tanggal', -1).to_list(2000)
    settings = await get_settings()

    kepala_madrasah = {'name': '-', 'nip': '-'}
    for item in (settings.get('leadership') or []):
        if (item.get('position') or '').strip().lower() == 'kepala_madrasah':
            kepala_madrasah = {'name': item.get('name') or '-', 'nip': item.get('nip') or '-'}
            break
    penyusun = {'name': user.get('full_name', user.get('username')), 'nip': user.get('nip_nuptk') or '-'}

    from lab_export import export_jurnal_penggunaan_pdf
    content = export_jurnal_penggunaan_pdf(
        settings=settings, lab_name=LAB_ROOM_NAMES[lab_key].replace('Lab ', ''),
        rows=rows, penyusun=penyusun, kepala_madrasah=kepala_madrasah,
    )
    filename = f"Jurnal_Penggunaan_{LAB_ROOM_NAMES[lab_key].replace(' ', '_')}.pdf"
    return StreamingResponse(
        io.BytesIO(content), media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


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


@router.get("/lab/{lab_key}/jurnal-pengelolaan/pdf")
async def export_jurnal_pengelolaan_pdf_endpoint(lab_key: str, user: Dict = Depends(get_current_user)):
    lab_key = _require_lab_key(lab_key)
    _check_lab_access(lab_key, user)
    room = await _get_lab_room(lab_key)

    tetap_ids = [a['id'] for a in await db.sarpras_aset_tetap.find({'lokasi_room_id': room['id']}, {'_id': 0, 'id': 1}).to_list(2000)]
    lancar_ids = [a['id'] for a in await db.sarpras_aset_lancar.find({'lokasi_room_id': room['id']}, {'_id': 0, 'id': 1}).to_list(2000)]
    all_ids = tetap_ids + lancar_ids + [room['id']]
    rows = await db.sarpras_jurnal_perawatan.find({'aset_id': {'$in': all_ids}}, {'_id': 0}).sort('tanggal', -1).to_list(2000)
    settings = await get_settings()

    kepala_madrasah = {'name': '-', 'nip': '-'}
    for item in (settings.get('leadership') or []):
        if (item.get('position') or '').strip().lower() == 'kepala_madrasah':
            kepala_madrasah = {'name': item.get('name') or '-', 'nip': item.get('nip') or '-'}
            break
    penyusun = {'name': user.get('full_name', user.get('username')), 'nip': user.get('nip_nuptk') or '-'}

    from lab_export import export_jurnal_pengelolaan_pdf
    content = export_jurnal_pengelolaan_pdf(
        settings=settings, lab_name=LAB_ROOM_NAMES[lab_key].replace('Lab ', ''),
        rows=rows, penyusun=penyusun, kepala_madrasah=kepala_madrasah,
    )
    filename = f"Jurnal_Pengelolaan_{LAB_ROOM_NAMES[lab_key].replace(' ', '_')}.pdf"
    return StreamingResponse(
        io.BytesIO(content), media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


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
