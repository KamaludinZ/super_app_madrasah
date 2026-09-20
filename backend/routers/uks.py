"""API endpoints for UKS (Unit Kesehatan Sekolah / School Health Unit) Management."""
import calendar
import io
from typing import Dict, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import uuid

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from core import db, get_active_academic_year, get_current_user, get_settings, require_role, serialize_doc, log_audit

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
    """Request model for a medicine catalog entry. Stock, expiry, and minimum
    threshold live on Obat Masuk batches / this record's stok_minimum policy —
    this model only covers the medicine's identity and reference info."""
    nama_obat: str
    jenis: Optional[str] = None  # e.g., "Tablet", "Sirup", "Salep"
    satuan: Optional[str] = 'pcs'
    untuk_penanganan: Optional[str] = None  # free-text: what this medicine is used for
    dosis: Optional[str] = None  # e.g., "1 tablet setiap 6 jam setelah makan"
    stok_minimum: Optional[int] = 0
    keterangan: Optional[str] = None


class ObatMasukRequest(BaseModel):
    """Request model for a restocking batch. Each batch carries its own
    expiry date and remaining quantity, consumed FEFO (earliest expiry first)
    when medicine is dispensed."""
    obat_id: str
    tanggal: str
    jumlah: int
    tanggal_kadaluarsa: Optional[str] = None
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
    """Request model for the initial UKS visit intake (patient + complaint,
    plus optional vitals taken on arrival). Treatment details are recorded
    separately via PenangananKunjunganRequest once the patient has been seen,
    so a visit can be logged immediately on arrival."""
    pasien_id: str  # user id (siswa/guru/tendik)
    tanggal: str
    waktu: Optional[str] = None
    keluhan: str
    tinggi_badan: Optional[float] = None  # cm
    berat_badan: Optional[float] = None  # kg
    tekanan_darah: Optional[str] = None  # e.g., "120/80"
    nadi: Optional[int] = None  # bpm
    suhu: Optional[float] = None  # celsius
    spo2: Optional[int] = None  # %


class ObatDipakaiItem(BaseModel):
    """One medicine dispensed as part of a treatment."""
    obat_id: str
    jumlah: int = 1


class PenangananKunjunganRequest(BaseModel):
    """Request model for recording treatment against an existing UKS visit.
    Vitals here overwrite the intake vitals if provided (e.g. re-measured
    before discharge); left blank, the intake values are kept unchanged."""
    jenis_penanganan_ids: List[str] = []
    obat_list: List[ObatDipakaiItem] = []
    penanganan: Optional[str] = None
    kondisi_pulang: Optional[str] = None  # e.g., "Membaik", "Dirujuk", "Dijemput", "Istirahat di Mahad"
    dirujuk_ke: Optional[str] = None
    keterangan: Optional[str] = None
    tinggi_badan: Optional[float] = None  # cm
    berat_badan: Optional[float] = None  # kg
    tekanan_darah: Optional[str] = None  # e.g., "120/80"
    nadi: Optional[int] = None  # bpm
    suhu: Optional[float] = None  # celsius
    spo2: Optional[int] = None  # %


class CekKesehatanRequest(BaseModel):
    """Request model for a Cek Kesehatan Gratis (CKG) screening record."""
    pasien_id: str  # user id (siswa/guru/tendik)
    tanggal: str
    tinggi_badan: Optional[float] = None  # cm
    berat_badan: Optional[float] = None  # kg
    tekanan_darah: Optional[str] = None  # e.g., "120/80"
    nadi: Optional[int] = None  # bpm
    suhu: Optional[float] = None  # celsius
    spo2: Optional[int] = None  # %
    pemeriksaan_mata: Optional[str] = None
    pemeriksaan_gigi: Optional[str] = None
    kesimpulan: Optional[str] = None
    rekomendasi: Optional[str] = None
    keterangan: Optional[str] = None


class ImunisasiRequest(BaseModel):
    """Request model for an immunization record."""
    pasien_id: str  # user id (siswa/guru/tendik)
    tanggal: str
    jenis_vaksin: str
    dosis_ke: Optional[str] = None  # e.g., "1", "2", "Booster"
    petugas_pemberi: Optional[str] = None  # e.g., "Puskesmas Lowokwaru"
    efek_samping: Optional[str] = None
    keterangan: Optional[str] = None


UKS_ROOM_NAME = 'Ruang UKS'
UKS_KATEGORI_ALAT_BAHAN = ['Alat Medis', 'Furniture', 'P3K', 'Obat & BMHP', 'Lainnya']


class AsetUKSRequest(BaseModel):
    """Request model for a UKS equipment/asset item — sama seperti pola Lab
    IPA/Komputer: disimpan di collection Sarpras (aset_tetap/aset_lancar)
    yang sama, dipisahkan lewat lokasi_room_id, agar terintegrasi penuh
    dengan /admin/sarpras/. Aset lancar (mis. obat, BMHP) pakai stok, bukan
    baik/rusak seperti aset tetap."""
    aset_tipe: str  # 'tetap' or 'lancar'
    nama: str
    sumber_dana: str = 'Komite'  # 'Komite' or 'BMN'
    kategori: Optional[str] = None
    satuan: Optional[str] = None
    jumlah_baik: int = 0
    jumlah_rusak: int = 0
    stok: int = 0
    stok_minimum: int = 0
    lokasi_penyimpanan: Optional[str] = None
    ruangan_id: Optional[str] = None  # default: Ruang UKS; bisa diganti ruangan lain
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


async def _get_active_pasien_list(jenis_pasien: str) -> List[Dict]:
    """Active patients for the CKG/Imunisasi import template: students currently
    assigned to a class in the active academic year (excluding mutasi keluar),
    or active GTK (guru/tenaga_kependidikan) — matching the same 'active' notion
    as /admin/gtk and /admin/siswa."""
    if jenis_pasien == 'gtk':
        items = await db.users.find(
            {'roles': {'$in': ['guru', 'tenaga_kependidikan']}, 'is_active': {'$ne': False}},
            {'_id': 0, 'id': 1, 'full_name': 1, 'nip_nuptk': 1, 'username': 1}
        ).sort('full_name', 1).to_list(3000)
        return [{'id': i['id'], 'full_name': i.get('full_name'), 'identitas': i.get('nip_nuptk') or i.get('username'), 'kelas': None} for i in items]

    active_ay = await get_active_academic_year()
    class_query = {'academic_year_id': active_ay['id']} if active_ay else {}
    classes = await db.classes.find(class_query, {'_id': 0, 'id': 1, 'name': 1}).to_list(500)
    class_names = {c['id']: c['name'] for c in classes}
    if not class_names:
        return []

    students = await db.users.find(
        {'roles': 'siswa', 'student_class_id': {'$in': list(class_names.keys())}, 'mutation_type': {'$ne': 'keluar'}},
        {'_id': 0, 'id': 1, 'full_name': 1, 'nisn': 1, 'student_class_id': 1}
    ).to_list(5000)
    students.sort(key=lambda s: (class_names.get(s.get('student_class_id'), ''), s.get('full_name') or ''))
    return [{'id': s['id'], 'full_name': s.get('full_name'), 'identitas': s.get('nisn'), 'kelas': class_names.get(s.get('student_class_id'))} for s in students]


async def _get_obat_or_404(obat_id: str):
    doc = await db.uks_obat.find_one({'id': obat_id})
    if not doc:
        raise HTTPException(404, "Data obat tidak ditemukan")
    return doc


async def _get_obat_stock_summary(obat_id: str) -> Dict:
    """Aggregate remaining stock and nearest expiry across all Obat Masuk
    batches for one medicine. Stock and expiry are derived here, never stored
    on the uks_obat catalog record."""
    batches = await db.uks_obat_masuk.find(
        {'obat_id': obat_id, 'stok_sisa': {'$gt': 0}}, {'_id': 0}
    ).sort('tanggal_kadaluarsa', 1).to_list(1000)

    stok_tersisa = sum(b.get('stok_sisa', 0) for b in batches)
    stok_masuk_total = await db.uks_obat_masuk.aggregate([
        {'$match': {'obat_id': obat_id}},
        {'$group': {'_id': None, 'total': {'$sum': '$jumlah'}}},
    ]).to_list(1)
    stok_masuk = stok_masuk_total[0]['total'] if stok_masuk_total else 0
    stok_terpakai = stok_masuk - stok_tersisa

    with_expiry = [b for b in batches if b.get('tanggal_kadaluarsa')]
    tanggal_kadaluarsa_terdekat = with_expiry[0]['tanggal_kadaluarsa'] if with_expiry else None

    return {
        'stok_masuk': stok_masuk,
        'stok_terpakai': stok_terpakai,
        'stok_tersisa': stok_tersisa,
        'tanggal_kadaluarsa_terdekat': tanggal_kadaluarsa_terdekat,
        'jumlah_batch_aktif': len(batches),
    }


async def _dispense_obat(obat_id: str, jumlah: int, tanggal: str, user: Dict,
                          kunjungan_id: Optional[str] = None, penerima: Optional[Dict] = None,
                          keterangan: Optional[str] = None) -> Dict:
    """Record an obat-keluar entry and deduct stock FEFO (earliest expiry
    batch first) across Obat Masuk batches. Shared by the manual Obat Keluar
    form and the Penanganan Kunjungan flow."""
    obat = await _get_obat_or_404(obat_id)
    if jumlah <= 0:
        raise HTTPException(400, "Jumlah harus lebih dari 0")

    summary = await _get_obat_stock_summary(obat_id)
    if summary['stok_tersisa'] < jumlah:
        raise HTTPException(400, f"Stok '{obat.get('nama_obat')}' tidak mencukupi (tersedia: {summary['stok_tersisa']})")

    batches = await db.uks_obat_masuk.find(
        {'obat_id': obat_id, 'stok_sisa': {'$gt': 0}}, {'_id': 0}
    ).sort('tanggal_kadaluarsa', 1).to_list(1000)

    remaining = jumlah
    for batch in batches:
        if remaining <= 0:
            break
        take = min(batch['stok_sisa'], remaining)
        await db.uks_obat_masuk.update_one({'id': batch['id']}, {'$inc': {'stok_sisa': -take}})
        remaining -= take

    doc = {
        'id': str(uuid.uuid4()),
        'obat_id': obat_id,
        'obat_nama': obat.get('nama_obat'),
        'tanggal': tanggal,
        'jumlah': jumlah,
        'kunjungan_id': kunjungan_id,
        'keterangan': keterangan,
        'petugas_id': user['id'],
        'petugas_nama': user.get('full_name', user.get('username')),
        'created_at': datetime.utcnow().isoformat(),
    }
    if penerima:
        doc.update(_user_fields('penerima', penerima))

    await db.uks_obat_keluar.insert_one(doc)
    return doc


async def _restore_obat_stock(obat_id: str, jumlah: int):
    """Reverse a dispense (e.g. when an obat-keluar entry is deleted) by
    returning quantity to the batch with the nearest expiry that still has
    room, or the most recent batch if all are exhausted."""
    batches = await db.uks_obat_masuk.find({'obat_id': obat_id}, {'_id': 0}).sort('tanggal_kadaluarsa', 1).to_list(1000)
    if not batches:
        return
    target = next((b for b in batches if b.get('stok_sisa', 0) < b.get('jumlah', 0)), batches[-1])
    await db.uks_obat_masuk.update_one({'id': target['id']}, {'$inc': {'stok_sisa': jumlah}})


# ============================================================
# WARGA MADRASAH LOOKUP (for pasien / penerima picker)
# ============================================================

@router.get("/uks/warga-madrasah")
async def list_warga_madrasah(search: Optional[str] = None, role: Optional[str] = None, user: Dict = Depends(require_role(*UKS_ROLES))):
    """Minimal lookup of active users for the patient picker, optionally filtered by role
    (e.g. role=guru or role=tenaga_kependidikan for the GTK patient-type selector)."""
    query = {'is_active': {'$ne': False}}
    if role:
        query['roles'] = role
    if search:
        query['full_name'] = {'$regex': search, '$options': 'i'}

    items = await db.users.find(
        query,
        {'_id': 0, 'id': 1, 'full_name': 1, 'nis': 1, 'nip_nuptk': 1, 'username': 1, 'roles': 1}
    ).sort('full_name', 1).to_list(3000)
    return [serialize_doc(i) for i in items]


def _calc_umur(birth_date: Optional[str]) -> Optional[str]:
    if not birth_date:
        return None
    try:
        birth = datetime.fromisoformat(birth_date[:10])
    except (ValueError, TypeError):
        return None
    today = datetime.utcnow()
    years = today.year - birth.year
    months = today.month - birth.month
    if today.day < birth.day:
        months -= 1
    if months < 0:
        years -= 1
        months += 12
    return f"{years} tahun {months} bulan"


@router.get("/uks/pasien/{pasien_id}/profile")
async def get_pasien_profile(pasien_id: str, user: Dict = Depends(require_role(*UKS_ROLES, 'kepala_sekolah'))):
    """Rich profile for the Detail Kunjungan dialog: identity, wali kelas
    (from the student's currently assigned class), address, parent/wali
    contacts, and mahad status — siswa only fields are None for GTK patients."""
    pasien = await _get_user_or_404(pasien_id)
    is_siswa = 'siswa' in (pasien.get('roles') or [])

    profile = {
        'jenis_pasien': 'siswa' if is_siswa else 'gtk',
        'full_name': pasien.get('full_name'),
        'nik': None,
        'tempat_lahir': pasien.get('birth_place'),
        'tanggal_lahir': pasien.get('birth_date'),
        'umur': _calc_umur(pasien.get('birth_date')),
        'class_name': None,
        'wali_kelas_nama': None,
        'alamat_siswa': None,
        'ayah_nama': None,
        'ayah_no_hp': None,
        'ibu_nama': None,
        'ibu_no_hp': None,
        'wali_nama': None,
        'wali_no_hp': None,
        'santri_mahad': False,
        'kamar_mahad': None,
    }

    if not is_siswa:
        return profile

    if pasien.get('student_class_id'):
        cls = await db.classes.find_one({'id': pasien['student_class_id']}, {'_id': 0, 'name': 1, 'homeroom_teacher_id': 1})
        if cls:
            profile['class_name'] = cls.get('name')
            if cls.get('homeroom_teacher_id'):
                wali_kelas = await db.users.find_one({'id': cls['homeroom_teacher_id']}, {'_id': 0, 'full_name': 1})
                profile['wali_kelas_nama'] = wali_kelas.get('full_name') if wali_kelas else None

    detail = await db.student_details.find_one({'student_id': pasien_id}, {'_id': 0})
    if detail:
        ayah = detail.get('ayah') or {}
        ibu = detail.get('ibu') or {}
        wali = detail.get('wali') or {}
        alamat_siswa = detail.get('alamat_siswa') or {}
        profile.update({
            'nik': detail.get('nik'),
            'alamat_siswa': alamat_siswa.get('alamat'),
            'ayah_nama': ayah.get('nama'),
            'ayah_no_hp': ayah.get('no_hp'),
            'ibu_nama': ibu.get('nama'),
            'ibu_no_hp': ibu.get('no_hp'),
            'wali_nama': wali.get('nama'),
            'wali_no_hp': wali.get('no_hp'),
            'santri_mahad': bool(detail.get('santri_mahad')),
            'kamar_mahad': detail.get('kamar_mahad'),
        })

    return profile


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
    await log_audit(user, 'uks_jenis_penanganan_create', f"Created jenis penanganan: {req.nama}")
    return serialize_doc(doc)


@router.put("/uks/jenis-penanganan/{item_id}")
async def update_jenis_penanganan(item_id: str, req: JenisPenangananRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    existing = await db.uks_jenis_penanganan.find_one({'id': item_id})
    if not existing:
        raise HTTPException(404, "Jenis penanganan tidak ditemukan")

    update_data = req.model_dump()
    update_data['updated_at'] = datetime.utcnow().isoformat()
    await db.uks_jenis_penanganan.update_one({'id': item_id}, {'$set': update_data})
    await log_audit(user, 'uks_jenis_penanganan_update', f"Updated jenis penanganan: {item_id}")

    updated = await db.uks_jenis_penanganan.find_one({'id': item_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/uks/jenis-penanganan/{item_id}")
async def delete_jenis_penanganan(item_id: str, user: Dict = Depends(require_role(*UKS_ROLES))):
    existing = await db.uks_jenis_penanganan.find_one({'id': item_id})
    if not existing:
        raise HTTPException(404, "Jenis penanganan tidak ditemukan")

    used = await db.uks_kunjungan.count_documents({'jenis_penanganan_ids': item_id})
    if used > 0:
        raise HTTPException(400, f"Jenis penanganan masih digunakan oleh {used} data kunjungan")

    await db.uks_jenis_penanganan.delete_one({'id': item_id})
    await log_audit(user, 'uks_jenis_penanganan_delete', f"Deleted jenis penanganan: {item_id}")
    return {'message': 'Jenis penanganan berhasil dihapus'}


# ============================================================
# DATA OBAT (DAFTAR OBAT) ENDPOINTS
# ============================================================

@router.get("/uks/obat")
async def list_obat(search: Optional[str] = None, user: Dict = Depends(get_current_user)):
    """List the medicine catalog, each enriched with stock aggregated live
    from its Obat Masuk batches (stok_masuk, stok_terpakai, stok_tersisa,
    nearest expiry, and low-stock flag)."""
    query = {}
    if search:
        query['nama_obat'] = {'$regex': search, '$options': 'i'}
    items = await db.uks_obat.find(query, {'_id': 0}).sort('nama_obat', 1).to_list(2000)

    enriched = []
    for i in items:
        summary = await _get_obat_stock_summary(i['id'])
        doc = {**i, **summary}
        doc['stok_menipis'] = summary['stok_tersisa'] <= (i.get('stok_minimum') or 0)
        enriched.append(serialize_doc(doc))
    return enriched


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
    await log_audit(user, 'uks_obat_create', f"Created obat: {req.nama_obat}")
    return serialize_doc(doc)


@router.put("/uks/obat/{obat_id}")
async def update_obat(obat_id: str, req: ObatRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    await _get_obat_or_404(obat_id)

    update_data = req.model_dump()
    update_data['updated_at'] = datetime.utcnow().isoformat()
    await db.uks_obat.update_one({'id': obat_id}, {'$set': update_data})
    await log_audit(user, 'uks_obat_update', f"Updated obat: {obat_id}")

    updated = await db.uks_obat.find_one({'id': obat_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/uks/obat/{obat_id}")
async def delete_obat(obat_id: str, user: Dict = Depends(require_role(*UKS_ROLES))):
    await _get_obat_or_404(obat_id)

    has_batches = await db.uks_obat_masuk.count_documents({'obat_id': obat_id})
    if has_batches > 0:
        raise HTTPException(400, f"Obat ini masih memiliki {has_batches} riwayat obat masuk dan tidak dapat dihapus")

    await db.uks_obat.delete_one({'id': obat_id})
    await log_audit(user, 'uks_obat_delete', f"Deleted obat: {obat_id}")
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
    """Record a new stock batch. stok_sisa starts equal to jumlah and is
    depleted FEFO as the medicine is dispensed via Obat Keluar / Penanganan."""
    obat = await _get_obat_or_404(req.obat_id)
    if req.jumlah <= 0:
        raise HTTPException(400, "Jumlah harus lebih dari 0")

    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        'stok_sisa': req.jumlah,
        'obat_nama': obat.get('nama_obat'),
        'petugas_id': user['id'],
        'petugas_nama': user.get('full_name', user.get('username')),
        'created_at': datetime.utcnow().isoformat(),
    }
    await db.uks_obat_masuk.insert_one(doc)
    await log_audit(user, 'uks_obat_masuk_create', f"Obat masuk: {obat.get('nama_obat')} +{req.jumlah}")
    return serialize_doc(doc)


@router.delete("/uks/obat-masuk/{entry_id}")
async def delete_obat_masuk(entry_id: str, user: Dict = Depends(require_role(*UKS_ROLES))):
    existing = await db.uks_obat_masuk.find_one({'id': entry_id})
    if not existing:
        raise HTTPException(404, "Data obat masuk tidak ditemukan")

    if existing.get('stok_sisa', 0) < existing.get('jumlah', 0):
        raise HTTPException(400, "Batch ini sudah terpakai sebagian dan tidak dapat dihapus. Hapus data obat keluar terkait terlebih dahulu.")

    await db.uks_obat_masuk.delete_one({'id': entry_id})
    await log_audit(user, 'uks_obat_masuk_delete', f"Deleted obat masuk: {entry_id}")
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
    penerima = await _get_user_or_404(req.penerima_id) if req.penerima_id else None
    doc = await _dispense_obat(
        req.obat_id, req.jumlah, req.tanggal, user,
        kunjungan_id=req.kunjungan_id, penerima=penerima, keterangan=req.keterangan,
    )
    await log_audit(user, 'uks_obat_keluar_create', f"Obat keluar: {doc['obat_nama']} -{req.jumlah}")
    return serialize_doc(doc)


@router.delete("/uks/obat-keluar/{entry_id}")
async def delete_obat_keluar(entry_id: str, user: Dict = Depends(require_role(*UKS_ROLES))):
    existing = await db.uks_obat_keluar.find_one({'id': entry_id})
    if not existing:
        raise HTTPException(404, "Data obat keluar tidak ditemukan")

    await _restore_obat_stock(existing['obat_id'], existing.get('jumlah', 0))
    await db.uks_obat_keluar.delete_one({'id': entry_id})
    await log_audit(user, 'uks_obat_keluar_delete', f"Deleted obat keluar: {entry_id}")
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
    status: Optional[str] = None,
    user: Dict = Depends(get_current_user)
):
    query = {}
    if pasien_id:
        query['pasien_id'] = pasien_id
    if jenis_penanganan_id:
        query['jenis_penanganan_ids'] = jenis_penanganan_id
    if status:
        query['status'] = status
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

    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        **_user_fields('pasien', pasien),
        'status': 'Belum Ditangani',
        'jenis_penanganan_ids': [],
        'jenis_penanganan_nama': [],
        'obat_dipakai': [],
        'penanganan': None,
        'kondisi_pulang': None,
        'dirujuk_ke': None,
        'keterangan': None,
        'ditangani_oleh': None,
        'ditangani_pada': None,
        'petugas_id': user['id'],
        'petugas_nama': user.get('full_name', user.get('username')),
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }

    await db.uks_kunjungan.insert_one(doc)
    await log_audit(user, 'uks_kunjungan_create', f"Recorded kunjungan UKS: {pasien.get('full_name')}")
    return serialize_doc(doc)


@router.put("/uks/kunjungan/{kunjungan_id}")
async def update_kunjungan(kunjungan_id: str, req: KunjunganUKSRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    """Update the intake portion of a visit (patient, date/time, complaint).
    Treatment fields are managed separately via /uks/kunjungan/{id}/penanganan."""
    existing = await db.uks_kunjungan.find_one({'id': kunjungan_id})
    if not existing:
        raise HTTPException(404, "Data kunjungan tidak ditemukan")

    update_data = req.model_dump()

    if req.pasien_id != existing.get('pasien_id'):
        pasien = await _get_user_or_404(req.pasien_id)
        update_data.update(_user_fields('pasien', pasien))

    update_data['updated_at'] = datetime.utcnow().isoformat()

    await db.uks_kunjungan.update_one({'id': kunjungan_id}, {'$set': update_data})
    await log_audit(user, 'uks_kunjungan_update', f"Updated kunjungan UKS: {kunjungan_id}")

    updated = await db.uks_kunjungan.find_one({'id': kunjungan_id}, {'_id': 0})
    return serialize_doc(updated)


@router.put("/uks/kunjungan/{kunjungan_id}/penanganan")
async def submit_penanganan(kunjungan_id: str, req: PenangananKunjunganRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    """Record treatment for a visit: one or more jenis penanganan, and any
    obat dispensed (each automatically logged to Obat Keluar with stock deducted)."""
    existing = await db.uks_kunjungan.find_one({'id': kunjungan_id})
    if not existing:
        raise HTTPException(404, "Data kunjungan tidak ditemukan")

    jenis_names = []
    for jid in req.jenis_penanganan_ids:
        jenis = await db.uks_jenis_penanganan.find_one({'id': jid})
        if not jenis:
            raise HTTPException(404, f"Jenis penanganan tidak ditemukan: {jid}")
        jenis_names.append(jenis.get('nama'))

    # Validate stock for every requested medicine before dispensing any of them,
    # so a mid-list failure never leaves a partially-applied treatment.
    for item in req.obat_list:
        obat = await _get_obat_or_404(item.obat_id)
        if item.jumlah <= 0:
            raise HTTPException(400, "Jumlah obat harus lebih dari 0")
        summary = await _get_obat_stock_summary(item.obat_id)
        if summary['stok_tersisa'] < item.jumlah:
            raise HTTPException(400, f"Stok '{obat.get('nama_obat')}' tidak mencukupi (tersedia: {summary['stok_tersisa']})")

    pasien = await db.users.find_one({'id': existing['pasien_id']}, {'_id': 0, 'password_hash': 0})
    obat_dipakai = []
    for item in req.obat_list:
        dispensed = await _dispense_obat(
            item.obat_id, item.jumlah, existing['tanggal'], user,
            kunjungan_id=kunjungan_id, penerima=pasien,
            keterangan=f"Penanganan kunjungan UKS {existing.get('pasien_nama')}",
        )
        obat_dipakai.append({'obat_id': item.obat_id, 'obat_nama': dispensed['obat_nama'], 'jumlah': item.jumlah})

    update_data = {
        'jenis_penanganan_ids': req.jenis_penanganan_ids,
        'jenis_penanganan_nama': jenis_names,
        'obat_dipakai': obat_dipakai,
        'penanganan': req.penanganan,
        'kondisi_pulang': req.kondisi_pulang,
        'dirujuk_ke': req.dirujuk_ke,
        'keterangan': req.keterangan,
        'status': 'Sudah Ditangani',
        'ditangani_oleh': user.get('full_name', user.get('username')),
        'ditangani_pada': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }
    # Vitals re-measured during treatment overwrite the intake values; if left
    # blank on this request, the intake values recorded on arrival are kept.
    for field in ('tinggi_badan', 'berat_badan', 'tekanan_darah', 'nadi', 'suhu', 'spo2'):
        value = getattr(req, field)
        if value is not None:
            update_data[field] = value
    await db.uks_kunjungan.update_one({'id': kunjungan_id}, {'$set': update_data})
    await log_audit(user, 'uks_kunjungan_penanganan', f"Penanganan kunjungan UKS: {kunjungan_id}")

    updated = await db.uks_kunjungan.find_one({'id': kunjungan_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/uks/kunjungan/{kunjungan_id}")
async def delete_kunjungan(kunjungan_id: str, user: Dict = Depends(require_role(*UKS_ROLES))):
    existing = await db.uks_kunjungan.find_one({'id': kunjungan_id})
    if not existing:
        raise HTTPException(404, "Data kunjungan tidak ditemukan")

    await db.uks_kunjungan.delete_one({'id': kunjungan_id})
    await log_audit(user, 'uks_kunjungan_delete', f"Deleted kunjungan UKS: {kunjungan_id}")
    return {'message': 'Data kunjungan berhasil dihapus'}


# ============================================================
# DATA CKG (CEK KESEHATAN GRATIS) ENDPOINTS
# ============================================================

@router.get("/uks/ckg")
async def list_ckg(
    pasien_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: Dict = Depends(get_current_user)
):
    query = {}
    if pasien_id:
        query['pasien_id'] = pasien_id
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query['$gte'] = start_date
        if end_date:
            date_query['$lte'] = end_date
        query['tanggal'] = date_query

    items = await db.uks_ckg.find(query, {'_id': 0}).sort('tanggal', -1).to_list(5000)
    return [serialize_doc(i) for i in items]


@router.post("/uks/ckg")
async def create_ckg(req: CekKesehatanRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    pasien = await _get_user_or_404(req.pasien_id)
    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        **_user_fields('pasien', pasien),
        'petugas_id': user['id'],
        'petugas_nama': user.get('full_name', user.get('username')),
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }
    await db.uks_ckg.insert_one(doc)
    await log_audit(user, 'uks_ckg_create', f"Recorded CKG: {pasien.get('full_name')}")
    return serialize_doc(doc)


@router.put("/uks/ckg/{ckg_id}")
async def update_ckg(ckg_id: str, req: CekKesehatanRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    existing = await db.uks_ckg.find_one({'id': ckg_id})
    if not existing:
        raise HTTPException(404, "Data CKG tidak ditemukan")

    update_data = req.model_dump()
    if req.pasien_id != existing.get('pasien_id'):
        pasien = await _get_user_or_404(req.pasien_id)
        update_data.update(_user_fields('pasien', pasien))
    update_data['updated_at'] = datetime.utcnow().isoformat()

    await db.uks_ckg.update_one({'id': ckg_id}, {'$set': update_data})
    await log_audit(user, 'uks_ckg_update', f"Updated CKG: {ckg_id}")

    updated = await db.uks_ckg.find_one({'id': ckg_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/uks/ckg/{ckg_id}")
async def delete_ckg(ckg_id: str, user: Dict = Depends(require_role(*UKS_ROLES))):
    existing = await db.uks_ckg.find_one({'id': ckg_id})
    if not existing:
        raise HTTPException(404, "Data CKG tidak ditemukan")

    await db.uks_ckg.delete_one({'id': ckg_id})
    await log_audit(user, 'uks_ckg_delete', f"Deleted CKG: {ckg_id}")
    return {'message': 'Data CKG berhasil dihapus'}


def _style_import_header(ws, headers: List[str]):
    header_fill = PatternFill(start_color="006837", end_color="006837", fill_type="solid")
    locked_fill = PatternFill(start_color="E8F5E9", end_color="E8F5E9", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)
    header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    for col_num, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_num, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_alignment
    ws.row_dimensions[1].height = 32
    return locked_fill


@router.get("/uks/ckg/template")
async def download_ckg_template(jenis_pasien: str = Query('siswa'), user: Dict = Depends(require_role(*UKS_ROLES))):
    """Excel template pre-filled with active patients (siswa in the active
    academic year's classes, or active GTK), ready for petugas UKS to fill
    in the CKG examination columns and re-upload."""
    pasien_list = await _get_active_pasien_list(jenis_pasien)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Template CKG"

    headers = [
        'ID (jangan diubah)', 'NISN/NIP', 'Nama', 'Kelas', 'Tanggal (YYYY-MM-DD)',
        'Tinggi Badan (cm)', 'Berat Badan (kg)', 'Tekanan Darah', 'Nadi (bpm)', 'Suhu (C)', 'SpO2 (%)',
        'Pemeriksaan Mata', 'Pemeriksaan Gigi', 'Kesimpulan', 'Rekomendasi', 'Keterangan',
    ]
    locked_fill = _style_import_header(ws, headers)

    for row_num, p in enumerate(pasien_list, 2):
        ws.cell(row=row_num, column=1, value=p['id']).fill = locked_fill
        ws.cell(row=row_num, column=2, value=p.get('identitas') or '').fill = locked_fill
        ws.cell(row=row_num, column=3, value=p.get('full_name') or '').fill = locked_fill
        ws.cell(row=row_num, column=4, value=p.get('kelas') or '').fill = locked_fill

    widths = [28, 14, 26, 10, 16, 12, 12, 12, 10, 10, 10, 20, 20, 24, 24, 20]
    for idx, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(idx)].width = w
    ws.column_dimensions['A'].hidden = True

    ws2 = wb.create_sheet("PETUNJUK")
    ws2['A1'] = "Petunjuk Pengisian Template CKG"
    ws2['A1'].font = Font(bold=True, size=13, color='006837')
    ws2.column_dimensions['A'].width = 100
    for line in [
        '', "Kolom ID, NISN/NIP, Nama, dan Kelas sudah terisi otomatis — JANGAN diubah atau dihapus urutannya.",
        "Isi kolom Tanggal dan hasil pemeriksaan pada baris siswa/GTK yang diperiksa.",
        "Baris yang kolom Tanggal-nya dikosongkan akan dilewati saat diimpor.",
        "Format Tanggal: YYYY-MM-DD (contoh: 2026-09-19).",
    ]:
        ws2.append([line])

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    filename = f"Template_CKG_{jenis_pasien}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/uks/ckg/import-excel")
async def import_ckg_excel(file: UploadFile = File(...), user: Dict = Depends(require_role(*UKS_ROLES))):
    if not file.filename.lower().endswith(('.xlsx', '.xlsm')):
        raise HTTPException(400, "Hanya file .xlsx yang didukung")
    contents = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(contents), read_only=True, data_only=True)
    ws = wb['Template CKG'] if 'Template CKG' in wb.sheetnames else wb.active

    success = 0
    errors = []
    for idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not row or not row[0] or not row[4]:
            continue  # skip rows without ID or Tanggal
        pasien_id = str(row[0]).strip()
        tanggal = str(row[4]).strip() if not hasattr(row[4], 'isoformat') else row[4].date().isoformat() if hasattr(row[4], 'date') else row[4].isoformat()
        try:
            pasien = await db.users.find_one({'id': pasien_id}, {'_id': 0, 'password_hash': 0})
            if not pasien:
                errors.append(f"Baris {idx}: pasien tidak ditemukan")
                continue

            def num(v, cast=float):
                if v is None or str(v).strip() == '':
                    return None
                try:
                    return cast(v)
                except (TypeError, ValueError):
                    return None

            doc = {
                'id': str(uuid.uuid4()),
                'pasien_id': pasien_id,
                'tanggal': tanggal,
                'tinggi_badan': num(row[5]),
                'berat_badan': num(row[6]),
                'tekanan_darah': str(row[7]).strip() if row[7] else None,
                'nadi': num(row[8], int),
                'suhu': num(row[9]),
                'spo2': num(row[10], int),
                'pemeriksaan_mata': str(row[11]).strip() if row[11] else None,
                'pemeriksaan_gigi': str(row[12]).strip() if row[12] else None,
                'kesimpulan': str(row[13]).strip() if row[13] else None,
                'rekomendasi': str(row[14]).strip() if row[14] else None,
                'keterangan': str(row[15]).strip() if len(row) > 15 and row[15] else None,
                **_user_fields('pasien', pasien),
                'petugas_id': user['id'],
                'petugas_nama': user.get('full_name', user.get('username')),
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            }
            await db.uks_ckg.insert_one(doc)
            success += 1
        except Exception as e:
            errors.append(f"Baris {idx}: {e}")

    await log_audit(user, 'uks_ckg_import', f"Import CKG dari Excel: {success} baris berhasil")
    return {'success': success, 'errors': errors, 'total_rows': success + len(errors)}


# ============================================================
# DATA IMUNISASI ENDPOINTS
# ============================================================

@router.get("/uks/imunisasi")
async def list_imunisasi(
    pasien_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: Dict = Depends(get_current_user)
):
    query = {}
    if pasien_id:
        query['pasien_id'] = pasien_id
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query['$gte'] = start_date
        if end_date:
            date_query['$lte'] = end_date
        query['tanggal'] = date_query

    items = await db.uks_imunisasi.find(query, {'_id': 0}).sort('tanggal', -1).to_list(5000)
    return [serialize_doc(i) for i in items]


@router.post("/uks/imunisasi")
async def create_imunisasi(req: ImunisasiRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    pasien = await _get_user_or_404(req.pasien_id)
    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        **_user_fields('pasien', pasien),
        'petugas_id': user['id'],
        'petugas_nama': user.get('full_name', user.get('username')),
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }
    await db.uks_imunisasi.insert_one(doc)
    await log_audit(user, 'uks_imunisasi_create', f"Recorded imunisasi: {pasien.get('full_name')} - {req.jenis_vaksin}")
    return serialize_doc(doc)


@router.put("/uks/imunisasi/{imunisasi_id}")
async def update_imunisasi(imunisasi_id: str, req: ImunisasiRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    existing = await db.uks_imunisasi.find_one({'id': imunisasi_id})
    if not existing:
        raise HTTPException(404, "Data imunisasi tidak ditemukan")

    update_data = req.model_dump()
    if req.pasien_id != existing.get('pasien_id'):
        pasien = await _get_user_or_404(req.pasien_id)
        update_data.update(_user_fields('pasien', pasien))
    update_data['updated_at'] = datetime.utcnow().isoformat()

    await db.uks_imunisasi.update_one({'id': imunisasi_id}, {'$set': update_data})
    await log_audit(user, 'uks_imunisasi_update', f"Updated imunisasi: {imunisasi_id}")

    updated = await db.uks_imunisasi.find_one({'id': imunisasi_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/uks/imunisasi/{imunisasi_id}")
async def delete_imunisasi(imunisasi_id: str, user: Dict = Depends(require_role(*UKS_ROLES))):
    existing = await db.uks_imunisasi.find_one({'id': imunisasi_id})
    if not existing:
        raise HTTPException(404, "Data imunisasi tidak ditemukan")

    await db.uks_imunisasi.delete_one({'id': imunisasi_id})
    await log_audit(user, 'uks_imunisasi_delete', f"Deleted imunisasi: {imunisasi_id}")
    return {'message': 'Data imunisasi berhasil dihapus'}


@router.get("/uks/imunisasi/template")
async def download_imunisasi_template(jenis_pasien: str = Query('siswa'), user: Dict = Depends(require_role(*UKS_ROLES))):
    """Excel template pre-filled with active patients, ready for petugas UKS
    to fill in the immunization columns and re-upload."""
    pasien_list = await _get_active_pasien_list(jenis_pasien)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Template Imunisasi"

    headers = [
        'ID (jangan diubah)', 'NISN/NIP', 'Nama', 'Kelas', 'Tanggal (YYYY-MM-DD)',
        'Jenis Vaksin', 'Dosis/Tahap', 'Petugas/Lokasi Pemberi', 'Efek Samping', 'Keterangan',
    ]
    locked_fill = _style_import_header(ws, headers)

    for row_num, p in enumerate(pasien_list, 2):
        ws.cell(row=row_num, column=1, value=p['id']).fill = locked_fill
        ws.cell(row=row_num, column=2, value=p.get('identitas') or '').fill = locked_fill
        ws.cell(row=row_num, column=3, value=p.get('full_name') or '').fill = locked_fill
        ws.cell(row=row_num, column=4, value=p.get('kelas') or '').fill = locked_fill

    widths = [28, 14, 26, 10, 16, 20, 12, 22, 24, 20]
    for idx, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(idx)].width = w
    ws.column_dimensions['A'].hidden = True

    ws2 = wb.create_sheet("PETUNJUK")
    ws2['A1'] = "Petunjuk Pengisian Template Imunisasi"
    ws2['A1'].font = Font(bold=True, size=13, color='006837')
    ws2.column_dimensions['A'].width = 100
    for line in [
        '', "Kolom ID, NISN/NIP, Nama, dan Kelas sudah terisi otomatis — JANGAN diubah atau dihapus urutannya.",
        "Isi kolom Tanggal dan Jenis Vaksin pada baris siswa/GTK yang diimunisasi.",
        "Baris yang kolom Tanggal atau Jenis Vaksin-nya dikosongkan akan dilewati saat diimpor.",
        "Format Tanggal: YYYY-MM-DD (contoh: 2026-09-19).",
    ]:
        ws2.append([line])

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    filename = f"Template_Imunisasi_{jenis_pasien}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/uks/imunisasi/import-excel")
async def import_imunisasi_excel(file: UploadFile = File(...), user: Dict = Depends(require_role(*UKS_ROLES))):
    if not file.filename.lower().endswith(('.xlsx', '.xlsm')):
        raise HTTPException(400, "Hanya file .xlsx yang didukung")
    contents = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(contents), read_only=True, data_only=True)
    ws = wb['Template Imunisasi'] if 'Template Imunisasi' in wb.sheetnames else wb.active

    success = 0
    errors = []
    for idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not row or not row[0] or not row[4] or not row[5]:
            continue  # skip rows without ID, Tanggal, or Jenis Vaksin
        pasien_id = str(row[0]).strip()
        tanggal = str(row[4]).strip() if not hasattr(row[4], 'isoformat') else row[4].date().isoformat() if hasattr(row[4], 'date') else row[4].isoformat()
        try:
            pasien = await db.users.find_one({'id': pasien_id}, {'_id': 0, 'password_hash': 0})
            if not pasien:
                errors.append(f"Baris {idx}: pasien tidak ditemukan")
                continue

            doc = {
                'id': str(uuid.uuid4()),
                'pasien_id': pasien_id,
                'tanggal': tanggal,
                'jenis_vaksin': str(row[5]).strip(),
                'dosis_ke': str(row[6]).strip() if row[6] else None,
                'petugas_pemberi': str(row[7]).strip() if row[7] else None,
                'efek_samping': str(row[8]).strip() if row[8] else None,
                'keterangan': str(row[9]).strip() if len(row) > 9 and row[9] else None,
                **_user_fields('pasien', pasien),
                'petugas_id': user['id'],
                'petugas_nama': user.get('full_name', user.get('username')),
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            }
            await db.uks_imunisasi.insert_one(doc)
            success += 1
        except Exception as e:
            errors.append(f"Baris {idx}: {e}")

    await log_audit(user, 'uks_imunisasi_import', f"Import imunisasi dari Excel: {success} baris berhasil")
    return {'success': success, 'errors': errors, 'total_rows': success + len(errors)}


# ============================================================
# ASET UKS ENDPOINTS (terintegrasi dengan Sarpras: aset_tetap/aset_lancar
# yang sama, discope lewat ruangan "Ruang UKS" — sama seperti pola Lab IPA/
# Komputer di backend/routers/lab.py)
# ============================================================

async def _get_uks_room() -> Dict:
    """Ambil (atau buat otomatis jika belum ada) ruangan 'Ruang UKS' di
    collection rooms — UKS tidak punya akses membuat ruangan sendiri lewat
    menu Sarpras, jadi dibuat otomatis saat pertama kali dibutuhkan."""
    room = await db.rooms.find_one({'name': UKS_ROOM_NAME})
    if room:
        return room
    doc = {
        'id': str(uuid.uuid4()),
        'name': UKS_ROOM_NAME,
        'created_at': datetime.utcnow().isoformat(),
    }
    await db.rooms.insert_one(doc)
    return doc


async def _resolve_uks_target_room(ruangan_id: Optional[str]) -> Dict:
    if ruangan_id:
        room = await db.rooms.find_one({'id': ruangan_id})
        if not room:
            raise HTTPException(404, "Ruangan tidak ditemukan")
        return room
    return await _get_uks_room()


async def _resolve_uks_aset(aset_tipe: str, aset_id: str):
    if aset_tipe == 'tetap':
        doc = await db.sarpras_aset_tetap.find_one({'id': aset_id})
        if not doc:
            raise HTTPException(404, "Aset tidak ditemukan")
        return doc, db.sarpras_aset_tetap
    elif aset_tipe == 'lancar':
        doc = await db.sarpras_aset_lancar.find_one({'id': aset_id})
        if not doc:
            raise HTTPException(404, "Aset tidak ditemukan")
        return doc, db.sarpras_aset_lancar
    raise HTTPException(400, "aset_tipe harus 'tetap' atau 'lancar'")


async def _get_uks_asset_or_403(uks_room_id: str, aset_tipe: str, aset_id: str):
    doc, collection = await _resolve_uks_aset(aset_tipe, aset_id)
    if doc.get('lokasi_room_id') != uks_room_id:
        raise HTTPException(403, "Aset ini bukan bagian dari UKS")
    return doc, collection


def _uks_aset_doc_to_row(doc: Dict, aset_tipe: str) -> Dict:
    name_field = 'nama_aset' if aset_tipe == 'tetap' else 'nama_barang'
    row = {
        'id': doc.get('id'),
        'aset_tipe': aset_tipe,
        'nama': doc.get(name_field),
        'sumber_dana': doc.get('sumber_dana', 'Komite'),
        'kategori': doc.get('kategori'),
        'satuan': doc.get('satuan') or ('unit' if aset_tipe == 'tetap' else None),
        'lokasi_penyimpanan': doc.get('lokasi_penyimpanan'),
        'ruangan_id': doc.get('lokasi_room_id'),
        'ruangan_nama': doc.get('lokasi_room_nama'),
        'keterangan': doc.get('keterangan'),
    }
    if aset_tipe == 'tetap':
        row['jumlah_baik'] = doc.get('jumlah_baik', doc.get('jumlah', 0))
        row['jumlah_rusak'] = doc.get('jumlah_rusak', 0)
    else:
        row['stok'] = doc.get('stok', 0)
        row['stok_minimum'] = doc.get('stok_minimum', 0)
    return row


@router.get("/uks/aset/meta")
async def get_uks_aset_meta(user: Dict = Depends(get_current_user)):
    return {'kategori_alat_bahan': UKS_KATEGORI_ALAT_BAHAN}


@router.get("/uks/aset")
async def list_aset(user: Dict = Depends(get_current_user)):
    room = await _get_uks_room()
    tetap = await db.sarpras_aset_tetap.find({'lokasi_room_id': room['id']}, {'_id': 0}).sort('nama_aset', 1).to_list(2000)
    lancar = await db.sarpras_aset_lancar.find({'lokasi_room_id': room['id']}, {'_id': 0}).sort('nama_barang', 1).to_list(2000)
    rows = [_uks_aset_doc_to_row(a, 'tetap') for a in tetap] + [_uks_aset_doc_to_row(a, 'lancar') for a in lancar]
    rows.sort(key=lambda r: (r['nama'] or '').lower())
    return {
        'room': serialize_doc(room),
        'items': rows,
    }


@router.post("/uks/aset")
async def create_aset(req: AsetUKSRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    room = await _resolve_uks_target_room(req.ruangan_id)
    now = datetime.utcnow().isoformat()

    if req.aset_tipe == 'tetap':
        doc = {
            'id': str(uuid.uuid4()),
            'nama_aset': req.nama,
            'sumber_dana': req.sumber_dana,
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
            'created_by': user['id'],
            'created_at': now,
            'updated_at': now,
        }
        await db.sarpras_aset_tetap.insert_one(doc)
    elif req.aset_tipe == 'lancar':
        doc = {
            'id': str(uuid.uuid4()),
            'nama_barang': req.nama,
            'sumber_dana': req.sumber_dana,
            'kategori': req.kategori,
            'satuan': req.satuan or 'pcs',
            'stok': req.stok,
            'stok_minimum': req.stok_minimum,
            'lokasi_penyimpanan': req.lokasi_penyimpanan,
            'lokasi_room_id': room['id'],
            'lokasi_room_nama': room.get('name'),
            'keterangan': req.keterangan,
            'created_by': user['id'],
            'created_at': now,
            'updated_at': now,
        }
        await db.sarpras_aset_lancar.insert_one(doc)
    else:
        raise HTTPException(400, "aset_tipe harus 'tetap' atau 'lancar'")

    await log_audit(user, 'uks_aset_create', f"Created aset UKS: {req.nama}")
    return _uks_aset_doc_to_row(doc, req.aset_tipe)


@router.put("/uks/aset/{aset_tipe}/{aset_id}")
async def update_aset(aset_tipe: str, aset_id: str, req: AsetUKSRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    uks_room = await _get_uks_room()
    _, collection = await _get_uks_asset_or_403(uks_room['id'], aset_tipe, aset_id)
    target_room = await _resolve_uks_target_room(req.ruangan_id)
    now = datetime.utcnow().isoformat()

    if aset_tipe == 'tetap':
        update_data = {
            'nama_aset': req.nama, 'sumber_dana': req.sumber_dana, 'kategori': req.kategori, 'satuan': req.satuan,
            'jumlah': req.jumlah_baik + req.jumlah_rusak,
            'jumlah_baik': req.jumlah_baik, 'jumlah_rusak': req.jumlah_rusak,
            'kondisi': 'Baik' if req.jumlah_rusak == 0 else 'Rusak Ringan',
            'lokasi_penyimpanan': req.lokasi_penyimpanan,
            'lokasi_room_id': target_room['id'], 'lokasi_room_nama': target_room.get('name'),
            'keterangan': req.keterangan, 'updated_at': now,
        }
    else:
        update_data = {
            'nama_barang': req.nama, 'sumber_dana': req.sumber_dana, 'kategori': req.kategori, 'satuan': req.satuan or 'pcs',
            'stok': req.stok, 'stok_minimum': req.stok_minimum,
            'lokasi_penyimpanan': req.lokasi_penyimpanan,
            'lokasi_room_id': target_room['id'], 'lokasi_room_nama': target_room.get('name'),
            'keterangan': req.keterangan, 'updated_at': now,
        }

    await collection.update_one({'id': aset_id}, {'$set': update_data})
    await log_audit(user, 'uks_aset_update', f"Updated aset UKS: {aset_id}")

    updated = await collection.find_one({'id': aset_id}, {'_id': 0})
    return _uks_aset_doc_to_row(updated, aset_tipe)


@router.delete("/uks/aset/{aset_tipe}/{aset_id}")
async def delete_aset(aset_tipe: str, aset_id: str, user: Dict = Depends(require_role(*UKS_ROLES))):
    uks_room = await _get_uks_room()
    _, collection = await _get_uks_asset_or_403(uks_room['id'], aset_tipe, aset_id)

    await collection.delete_one({'id': aset_id})
    await log_audit(user, 'uks_aset_delete', f"Deleted aset UKS: {aset_id}")
    return {'message': 'Aset berhasil dihapus'}


# ============================================================
# LAPORAN UKS (SUMMARY STATISTICS)
# ============================================================

@router.get("/uks/laporan/summary")
async def get_laporan_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: Dict = Depends(require_role(*UKS_ROLES, 'kepala_sekolah'))
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
    for o in obat_list:
        o.update(await _get_obat_stock_summary(o['id']))

    def by_field(records, field):
        """Count occurrences of a field's value. If the value is a list (e.g.
        multiple jenis penanganan per visit), each entry counts separately."""
        counts = {}
        for r in records:
            val = r.get(field)
            keys = val if isinstance(val, list) else [val]
            if not keys:
                keys = ['Lainnya']
            for key in keys:
                key = key or 'Lainnya'
                counts[key] = counts.get(key, 0) + 1
        return counts

    obat_usage = {}
    for r in obat_keluar:
        key = r.get('obat_nama') or r.get('obat_id')
        obat_usage[key] = obat_usage.get(key, 0) + r.get('jumlah', 0)
    most_used_obat = sorted(obat_usage.items(), key=lambda x: x[1], reverse=True)[:10]

    low_stock = [o for o in obat_list if o.get('stok_tersisa', 0) <= (o.get('stok_minimum') or 0)]

    return {
        'total_kunjungan': len(kunjungan),
        'kunjungan_by_jenis_penanganan': by_field(kunjungan, 'jenis_penanganan_nama'),
        'kunjungan_by_kondisi_pulang': by_field(kunjungan, 'kondisi_pulang'),
        'total_obat_keluar_transaksi': len(obat_keluar),
        'most_used_obat': [{'nama_obat': k, 'jumlah': v} for k, v in most_used_obat],
        'total_jenis_obat': len(obat_list),
        'obat_stok_menipis': [serialize_doc(o) for o in low_stock],
    }


# ============================================================
# REKAP KUNJUNGAN (per hari/bulan/semester/tahun, siswa vs GTK)
# ============================================================

BULAN_NAMA_ID = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]


async def _resolve_rekap_period(period: str, bulan: Optional[str], semester_id: Optional[str], tahun: Optional[str]):
    """Resolve a rekap period into (start_date, end_date, label, group_by).
    group_by is 'hari' for a single month, 'bulan' for semester/tahun."""
    if period == 'bulan':
        if not bulan:
            raise HTTPException(400, "Parameter bulan wajib diisi (format YYYY-MM)")
        try:
            year, month = (int(x) for x in bulan.split('-'))
        except ValueError:
            raise HTTPException(400, "Format bulan tidak valid, gunakan YYYY-MM")
        last_day = calendar.monthrange(year, month)[1]
        start_date = f"{year:04d}-{month:02d}-01"
        end_date = f"{year:04d}-{month:02d}-{last_day:02d}"
        label = f"{BULAN_NAMA_ID[month - 1]} {year}"
        return start_date, end_date, label, 'hari'

    if period == 'semester':
        if not semester_id:
            raise HTTPException(400, "Parameter semester_id wajib diisi")
        sem = await db.semesters.find_one({'id': semester_id}, {'_id': 0})
        if not sem:
            raise HTTPException(404, "Semester tidak ditemukan")
        ay = await db.academic_years.find_one({'id': sem.get('academic_year_id')}, {'_id': 0, 'name': 1})
        label = f"Semester {sem.get('name')} {ay.get('name') if ay else ''}".strip()
        return sem.get('start_date'), sem.get('end_date'), label, 'bulan'

    if period == 'tahun':
        if not tahun:
            raise HTTPException(400, "Parameter tahun wajib diisi (format YYYY)")
        try:
            year = int(tahun)
        except ValueError:
            raise HTTPException(400, "Format tahun tidak valid")
        start_date = f"{year:04d}-01-01"
        end_date = f"{year:04d}-12-31"
        return start_date, end_date, f"Tahun {year}", 'bulan'

    raise HTTPException(400, "Parameter period tidak valid (bulan/semester/tahun)")


async def _build_rekap_kunjungan(period: str, bulan: Optional[str], semester_id: Optional[str], tahun: Optional[str]) -> Dict:
    start_date, end_date, label, group_by = await _resolve_rekap_period(period, bulan, semester_id, tahun)

    kunjungan = await db.uks_kunjungan.find(
        {'tanggal': {'$gte': start_date, '$lte': end_date}}, {'_id': 0}
    ).to_list(20000)

    def is_siswa(k):
        return 'siswa' in (k.get('pasien_roles') or [])

    if group_by == 'hari':
        year, month = (int(x) for x in bulan.split('-'))
        last_day = calendar.monthrange(year, month)[1]
        rows = []
        for day in range(1, last_day + 1):
            tanggal = f"{year:04d}-{month:02d}-{day:02d}"
            day_records = [k for k in kunjungan if k.get('tanggal') == tanggal]
            siswa_count = sum(1 for k in day_records if is_siswa(k))
            gtk_count = len(day_records) - siswa_count
            rows.append({'label': tanggal, 'siswa': siswa_count, 'gtk': gtk_count, 'total': len(day_records)})
    else:
        # group by bulan across the period's date range
        rows = []
        cur_year, cur_month = int(start_date[:4]), int(start_date[5:7])
        end_year, end_month = int(end_date[:4]), int(end_date[5:7])
        while (cur_year, cur_month) <= (end_year, end_month):
            month_start = f"{cur_year:04d}-{cur_month:02d}-01"
            month_last_day = calendar.monthrange(cur_year, cur_month)[1]
            month_end = f"{cur_year:04d}-{cur_month:02d}-{month_last_day:02d}"
            month_records = [k for k in kunjungan if month_start <= k.get('tanggal', '') <= month_end]
            siswa_count = sum(1 for k in month_records if is_siswa(k))
            gtk_count = len(month_records) - siswa_count
            rows.append({
                'label': f"{BULAN_NAMA_ID[cur_month - 1]} {cur_year}",
                'siswa': siswa_count, 'gtk': gtk_count, 'total': len(month_records),
            })
            if cur_month == 12:
                cur_year += 1
                cur_month = 1
            else:
                cur_month += 1

    total_siswa = sum(r['siswa'] for r in rows)
    total_gtk = sum(r['gtk'] for r in rows)

    return {
        'period': period,
        'label': label,
        'start_date': start_date,
        'end_date': end_date,
        'group_by': group_by,
        'rows': rows,
        'total_siswa': total_siswa,
        'total_gtk': total_gtk,
        'total': total_siswa + total_gtk,
    }


@router.get("/uks/laporan/rekap-kunjungan")
async def get_rekap_kunjungan(
    period: str = Query(..., description="bulan | semester | tahun"),
    bulan: Optional[str] = Query(None, description="YYYY-MM, wajib jika period=bulan"),
    semester_id: Optional[str] = Query(None, description="wajib jika period=semester"),
    tahun: Optional[str] = Query(None, description="YYYY, wajib jika period=tahun"),
    user: Dict = Depends(require_role(*UKS_ROLES, 'kepala_sekolah')),
):
    return await _build_rekap_kunjungan(period, bulan, semester_id, tahun)


def _rekap_row_label_header(group_by: str) -> str:
    return 'Tanggal' if group_by == 'hari' else 'Bulan'


@router.get("/uks/laporan/rekap-kunjungan/export-excel")
async def export_rekap_kunjungan_excel(
    period: str = Query(...),
    bulan: Optional[str] = Query(None),
    semester_id: Optional[str] = Query(None),
    tahun: Optional[str] = Query(None),
    user: Dict = Depends(require_role(*UKS_ROLES)),
):
    rekap = await _build_rekap_kunjungan(period, bulan, semester_id, tahun)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Rekap Kunjungan UKS"

    header_fill = PatternFill(start_color="006837", end_color="006837", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)
    header_alignment = Alignment(horizontal="center", vertical="center")
    border = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))

    ws.merge_cells('A1:D1')
    ws['A1'] = f"Rekap Kunjungan UKS — {rekap['label']}"
    ws['A1'].font = Font(bold=True, size=13)

    headers = [_rekap_row_label_header(rekap['group_by']), 'Kunjungan Siswa', 'Kunjungan GTK', 'Total']
    for col_num, header in enumerate(headers, 1):
        cell = ws.cell(row=3, column=col_num, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_alignment
        cell.border = border

    row_num = 4
    for row in rekap['rows']:
        ws.cell(row=row_num, column=1, value=row['label']).border = border
        ws.cell(row=row_num, column=2, value=row['siswa']).border = border
        ws.cell(row=row_num, column=3, value=row['gtk']).border = border
        ws.cell(row=row_num, column=4, value=row['total']).border = border
        row_num += 1

    total_font = Font(bold=True)
    ws.cell(row=row_num, column=1, value='TOTAL').font = total_font
    ws.cell(row=row_num, column=1).border = border
    ws.cell(row=row_num, column=2, value=rekap['total_siswa']).font = total_font
    ws.cell(row=row_num, column=2).border = border
    ws.cell(row=row_num, column=3, value=rekap['total_gtk']).font = total_font
    ws.cell(row=row_num, column=3).border = border
    ws.cell(row=row_num, column=4, value=rekap['total']).font = total_font
    ws.cell(row=row_num, column=4).border = border

    for col_idx in range(1, len(headers) + 1):
        column = get_column_letter(col_idx)
        max_length = max(
            (len(str(ws.cell(row=r, column=col_idx).value or '')) for r in range(3, row_num + 1)),
            default=0,
        )
        ws.column_dimensions[column].width = min(max_length + 4, 40)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    filename = f"Rekap_Kunjungan_UKS_{rekap['label'].replace(' ', '_')}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/uks/laporan/rekap-kunjungan/export-pdf")
async def export_rekap_kunjungan_pdf(
    period: str = Query(...),
    bulan: Optional[str] = Query(None),
    semester_id: Optional[str] = Query(None),
    tahun: Optional[str] = Query(None),
    user: Dict = Depends(require_role(*UKS_ROLES)),
):
    rekap = await _build_rekap_kunjungan(period, bulan, semester_id, tahun)
    settings = await get_settings()

    output = io.BytesIO()
    doc = SimpleDocTemplate(output, pagesize=A4, topMargin=1.5 * cm, bottomMargin=1.5 * cm)
    styles = getSampleStyleSheet()
    elements = []

    elements.append(Paragraph(settings.get('school_name') or 'MTsN 2 Kota Malang', styles['Title']))
    elements.append(Paragraph(f"Rekap Kunjungan UKS — {rekap['label']}", styles['Heading2']))
    elements.append(Spacer(1, 0.5 * cm))

    header = [_rekap_row_label_header(rekap['group_by']), 'Kunjungan Siswa', 'Kunjungan GTK', 'Total']
    data = [header] + [[r['label'], str(r['siswa']), str(r['gtk']), str(r['total'])] for r in rekap['rows']]
    data.append(['TOTAL', str(rekap['total_siswa']), str(rekap['total_gtk']), str(rekap['total'])])

    table = Table(data, colWidths=[6 * cm, 4 * cm, 4 * cm, 4 * cm], repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#006837')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#E8F5E9')),
    ]))
    elements.append(table)

    doc.build(elements)
    output.seek(0)

    filename = f"Rekap_Kunjungan_UKS_{rekap['label'].replace(' ', '_')}.pdf"
    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
