"""API endpoints for Tata Tertib (Discipline & Code of Conduct) Management."""
from typing import Dict, List, Optional
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel, Field, field_validator
from pymongo.errors import DuplicateKeyError
import uuid
import pandas as pd
import io
import re

from core import db, get_current_user, require_role, serialize_doc, log_audit
from notify import homeroom_teacher_of, notify_roles, notify_users, spawn

from routers._shared import sembunyikan_siswa_nonaktif
from journal_core import tanggal_wib
from tatib_poin import (ASAL_INPUT, JALUR_POIN, JENIS_POIN, MAKS_BESAR_POIN, MAKS_DESKRIPSI_JENIS, MAKS_NAMA_JENIS,
                        POLA_KODE_ATURAN, field_jenis_aturan, hitung_poin_aturan, jalur_dari_jenis_poin, jenis_dari_poin,
                        jenis_poin_dari_jalur,
                        kondisi_aturan, kunci_nama, nilai_poin, normalisasi_kode, normalisasi_kondisi, poin_jenis_aturan)
from routers.tatib_poin import (batasi_query_tatib, cek_asal_input, rapikan_catatan, wajib_akses_tatib, wajib_input_tatib,
                                wajib_lihat_tatib)

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


class KondisiPoinItem(BaseModel):
    """Satu kondisi pelaksanaan aturan beserta nilainya (tanda dipaksa sesuai jenis_poin)."""
    id: Optional[str] = None
    label: str
    poin: int


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
    jenis_poin: Optional[str] = None  # 'kebaikan' | 'pelanggaran'; kosong -> dari tanda poin
    kondisi: Optional[List[KondisiPoinItem]] = None  # nilai per kondisi; kosong -> satu kondisi bawaan


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
    kondisi_id: Optional[str] = None  # kondisi pelaksanaan; nilai poin dihitung dari aturan + kondisi
    semester_id: Optional[str] = None
    asal_input: Optional[str] = None  # sumber pencatatan (ASAL_INPUT)


class JenisAturanRequest(BaseModel):
    """Isian Master Jenis Pelanggaran. Kode dinormalkan huruf besar; poin bertanda dihitung dari jalur."""
    kode_aturan: str
    nama: str
    jalur_poin: str
    besar_poin: int = Field(ge=1, le=MAKS_BESAR_POIN)
    kategori_id: str
    deskripsi: Optional[str] = None

    @field_validator('kode_aturan')
    @classmethod
    def _kode(cls, v: str) -> str:
        kode = normalisasi_kode(v)
        if not re.match(POLA_KODE_ATURAN, kode):
            raise ValueError('Kode aturan 1-20 karakter: huruf, angka, titik, garis miring, atau tanda hubung')
        return kode

    @field_validator('nama')
    @classmethod
    def _nama(cls, v: str) -> str:
        nama = ' '.join((v or '').split())
        if not nama or len(nama) > MAKS_NAMA_JENIS:
            raise ValueError(f'Nama jenis wajib diisi (maks {MAKS_NAMA_JENIS} karakter)')
        return nama

    @field_validator('jalur_poin')
    @classmethod
    def _jalur(cls, v: str) -> str:
        if v not in JALUR_POIN:
            raise ValueError("Jalur poin harus 'minus' atau 'plus'")
        return v

    @field_validator('deskripsi')
    @classmethod
    def _deskripsi(cls, v: Optional[str]) -> Optional[str]:
        v = (v or '').strip()
        if len(v) > MAKS_DESKRIPSI_JENIS:
            raise ValueError(f'Deskripsi maksimal {MAKS_DESKRIPSI_JENIS} karakter')
        return v or None


class StatusJenisRequest(BaseModel):
    aktif: bool


class TindakLanjutRequest(BaseModel):
    tanggal: str
    uraian: str


def _skema_aturan(req: TatibRequest) -> Dict:
    """jenis_poin, kondisi (rapi), dan poin aturan (= nilai kondisi pertama) dari request."""
    if req.jenis_poin and req.jenis_poin not in JENIS_POIN:
        raise HTTPException(400, "jenis_poin harus 'kebaikan' atau 'pelanggaran'")
    jenis = req.jenis_poin or jenis_dari_poin(req.poin)
    kondisi = normalisasi_kondisi([k.model_dump() for k in (req.kondisi or [])], jenis, req.poin)
    return {'jenis_poin': jenis, 'kondisi': kondisi, 'poin': kondisi[0]['poin']}


def dengan_field_lama(doc: Dict) -> Dict:
    """Lengkapi jenis_poin, poin, kode & nama_aturan dari field kanonis bila kosong, agar perhitungan
    lama (hitung_poin_aturan, kondisi) benar untuk jenis yang hanya punya field Master Jenis."""
    jenis = doc.get('jenis_poin') or (jenis_poin_dari_jalur(doc['jalur_poin']) if doc.get('jalur_poin') else jenis_dari_poin(doc.get('poin')))
    poin = doc.get('poin') if doc.get('poin') is not None else poin_jenis_aturan(doc)
    return {**doc, 'jenis_poin': jenis, 'poin': poin,
            'kode': doc.get('kode') or doc.get('kode_aturan'), 'nama_aturan': doc.get('nama_aturan') or doc.get('nama')}


def _aturan_tampil(doc: Dict) -> Dict:
    """Aturan untuk respons: selalu ada jenis_poin, poin, aktif & kondisi (aturan lama -> kondisi bawaan)."""
    doc = dengan_field_lama(doc)
    return serialize_doc({**doc, 'aktif': field_jenis_aturan(doc)['aktif'], 'kondisi': kondisi_aturan(doc)})


# ============================================================
# KATEGORI ENDPOINTS
# ============================================================

async def _cek_nama_kategori(nama: str, kecuali_id: Optional[str] = None) -> str:
    """Rapikan nama kategori; 400 bila kosong, 409 bila sudah dipakai (tanpa beda huruf besar/kecil)."""
    nama = ' '.join((nama or '').split())
    if not nama:
        raise HTTPException(400, "Nama kategori wajib diisi")
    query = {'nama_key': kunci_nama(nama)}
    if kecuali_id:
        query['id'] = {'$ne': kecuali_id}
    if await db.tatib_kategori.find_one(query, {'_id': 1}):
        raise HTTPException(409, f'Kategori "{nama}" sudah ada')
    return nama


@router.get("/tatib/kategori")
async def list_kategori(user: Dict = Depends(wajib_akses_tatib)):
    """List all kategori tata tertib."""
    items = await db.tatib_kategori.find({}, {'_id': 0}).sort([('urutan', 1), ('nama', 1)]).to_list(1000)
    return [serialize_doc(i) for i in items]


@router.get("/tatib/kategori/{kategori_id}")
async def get_kategori(kategori_id: str, user: Dict = Depends(wajib_akses_tatib)):
    """Get a specific kategori."""
    doc = await db.tatib_kategori.find_one({'id': kategori_id}, {'_id': 0})
    if not doc:
        raise HTTPException(404, "Kategori tidak ditemukan")
    return serialize_doc(doc)


@router.post("/tatib/kategori")
async def create_kategori(req: KategoriTatibRequest, user: Dict = Depends(wajib_input_tatib)):
    """Tambah kategori (juga langsung dari halaman Input Tata Tertib); nama unik tanpa beda huruf."""
    nama = await _cek_nama_kategori(req.nama)
    doc = {
        'id': str(uuid.uuid4()),
        'nama': nama,
        'nama_key': kunci_nama(nama),
        'deskripsi': (req.deskripsi or '').strip() or None,
        'urutan': req.urutan,
        'created_by': user['id'],
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }
    try:
        await db.tatib_kategori.insert_one(doc)
    except DuplicateKeyError:  # balapan dua penyimpanan bersamaan (index nama_key unik)
        raise HTTPException(409, f'Kategori "{nama}" sudah ada')
    await log_audit(user, 'tatib_kategori_create', f"Created kategori: {nama}")
    doc.pop('_id', None)
    return serialize_doc(doc)


@router.put("/tatib/kategori/{kategori_id}")
async def update_kategori(kategori_id: str, req: KategoriTatibRequest, user: Dict = Depends(wajib_input_tatib)):
    """Ubah kategori. Nama baru ikut diperbarui pada jenis aturan; riwayat pencatatan tetap
    menyimpan nama kategori saat dicatat."""
    existing = await db.tatib_kategori.find_one({'id': kategori_id})
    if not existing:
        raise HTTPException(404, "Kategori tidak ditemukan")

    nama = await _cek_nama_kategori(req.nama, kecuali_id=kategori_id)
    update_data = {
        'nama': nama,
        'nama_key': kunci_nama(nama),
        'updated_at': datetime.utcnow().isoformat(),
    }
    isian = req.model_dump(exclude_unset=True)
    if 'deskripsi' in isian:
        update_data['deskripsi'] = (req.deskripsi or '').strip() or None
    if req.urutan is not None and 'urutan' in isian:
        update_data['urutan'] = req.urutan

    try:
        await db.tatib_kategori.update_one({'id': kategori_id}, {'$set': update_data})
    except DuplicateKeyError:
        raise HTTPException(409, f'Kategori "{nama}" sudah ada')
    if nama != existing.get('nama'):
        await db.tatib_aturan.update_many({'kategori_id': kategori_id}, {'$set': {'kategori_nama': nama}})
        await db.tatib_jenis.update_many({'kategori_id': kategori_id}, {'$set': {'kategori_nama': nama}})
    await log_audit(user, 'tatib_kategori_update', f"Updated kategori: {kategori_id}")

    updated = await db.tatib_kategori.find_one({'id': kategori_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/tatib/kategori/{kategori_id}")
async def delete_kategori(kategori_id: str, user: Dict = Depends(wajib_input_tatib)):
    """Hapus kategori; ditolak bila masih dipakai jenis aturan atau pencatatan."""
    existing = await db.tatib_kategori.find_one({'id': kategori_id})
    if not existing:
        raise HTTPException(404, "Kategori tidak ditemukan")

    jenis_count = await db.tatib_jenis.count_documents({'kategori_id': kategori_id})
    tatib_count = await db.tatib_aturan.count_documents({'kategori_id': kategori_id})
    catatan_count = await db.tatib_penanganan.count_documents({'kategori_id': kategori_id})

    if jenis_count or tatib_count or catatan_count:
        raise HTTPException(
            400, f"Kategori masih digunakan oleh {tatib_count} jenis aturan, {jenis_count} sub-jenis, dan {catatan_count} pencatatan")

    await db.tatib_kategori.delete_one({'id': kategori_id})
    await log_audit(user, 'tatib_kategori_delete', f"Deleted kategori: {kategori_id}")
    return {'message': 'Kategori berhasil dihapus'}


# ============================================================
# JENIS ENDPOINTS
# ============================================================

@router.get("/tatib/jenis")
async def list_jenis(kategori_id: Optional[str] = None, user: Dict = Depends(wajib_akses_tatib)):
    """List all jenis tata tertib, optionally filtered by kategori."""
    query = {}
    if kategori_id:
        query['kategori_id'] = kategori_id

    items = await db.tatib_jenis.find(query, {'_id': 0}).sort('urutan', 1).to_list(1000)
    return [serialize_doc(i) for i in items]


@router.post("/tatib/jenis")
async def create_jenis(req: JenisTatibRequest, user: Dict = Depends(wajib_input_tatib)):
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
    await log_audit(user, 'tatib_jenis_create', f"Created jenis: {req.nama}")
    return serialize_doc(doc)


@router.put("/tatib/jenis/{jenis_id}")
async def update_jenis(jenis_id: str, req: JenisTatibRequest, user: Dict = Depends(wajib_input_tatib)):
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
    await log_audit(user, 'tatib_jenis_update', f"Updated jenis: {jenis_id}")

    updated = await db.tatib_jenis.find_one({'id': jenis_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/tatib/jenis/{jenis_id}")
async def delete_jenis(jenis_id: str, user: Dict = Depends(wajib_input_tatib)):
    """Delete a jenis."""
    existing = await db.tatib_jenis.find_one({'id': jenis_id})
    if not existing:
        raise HTTPException(404, "Jenis tidak ditemukan")

    # Check if any tatib uses this jenis
    tatib_count = await db.tatib_aturan.count_documents({'jenis_id': jenis_id})
    if tatib_count > 0:
        raise HTTPException(400, f"Jenis masih digunakan oleh {tatib_count} aturan")

    await db.tatib_jenis.delete_one({'id': jenis_id})
    await log_audit(user, 'tatib_jenis_delete', f"Deleted jenis: {jenis_id}")
    return {'message': 'Jenis berhasil dihapus'}


# ============================================================
# MASTER JENIS ATURAN (struktur baru; dokumen di koleksi tatib_aturan)
# ============================================================

def jenis_aturan_tampil(doc: Dict, nama_kategori: Optional[Dict] = None) -> Dict:
    """Bentuk kanonis satu jenis aturan untuk Input Tata Tertib (field lama diterjemahkan)."""
    return {
        'id': doc.get('id'),
        **field_jenis_aturan(doc),
        'poin': poin_jenis_aturan(doc),
        'kategori_id': doc.get('kategori_id'),
        'kategori_nama': (nama_kategori or {}).get(doc.get('kategori_id')) or doc.get('kategori_nama') or 'Lainnya',
        'deskripsi': doc.get('deskripsi') or '',
    }


async def jumlah_catatan_per_jenis(jenis_ids: Optional[List[str]] = None) -> Dict[str, int]:
    """{jenis_id: jumlah pencatatan} — catatan lama dihitung lewat tatib_id."""
    kunci = {'$ifNull': ['$jenis_id', '$tatib_id']}
    pipeline: List[Dict] = []
    if jenis_ids is not None:
        pipeline.append({'$match': {'$or': [{'jenis_id': {'$in': jenis_ids}}, {'tatib_id': {'$in': jenis_ids}}]}})
    pipeline.append({'$group': {'_id': kunci, 'n': {'$sum': 1}}})
    return {d['_id']: d['n'] async for d in db.tatib_penanganan.aggregate(pipeline) if d['_id']}


def _cocok_cari(item: Dict, kata: List[str]) -> bool:
    teks = f"{item.get('kode_aturan') or ''} {item.get('nama') or ''}".lower()
    return all(k in teks for k in kata)


@router.get("/tatib/jenis-aturan")
async def list_jenis_aturan(
    kategori_id: Optional[str] = None,
    aktif: Optional[bool] = None,
    cari: Optional[str] = None,
    user: Dict = Depends(wajib_akses_tatib),
):
    """Master jenis aturan (pelanggaran/kebaikan) per kategori, urut kategori lalu kode aturan.
    `aktif=true` untuk pilihan pencatatan; tanpa filter untuk melihat semua termasuk nonaktif.
    `cari`: kata kunci kode/nama (tanpa beda huruf, semua kata harus cocok).
    Tiap jenis memuat `jumlah_catatan` (riwayat pencatatan yang memakai jenis itu)."""
    query = {'kategori_id': kategori_id} if kategori_id else {}
    docs = await db.tatib_aturan.find(query, {'_id': 0}).to_list(2000)
    kategori = await db.tatib_kategori.find({}, {'_id': 0, 'id': 1, 'nama': 1, 'urutan': 1}).to_list(1000)
    nama_kategori = {k['id']: k.get('nama') for k in kategori}
    urutan = {k['id']: (k.get('urutan') or 0, k.get('nama') or '') for k in kategori}
    items = [jenis_aturan_tampil(d, nama_kategori) for d in docs]
    if aktif is not None:
        items = [i for i in items if i['aktif'] is aktif]
    kata = (cari or '').lower().split()
    if kata:
        items = [i for i in items if _cocok_cari(i, kata)]
    jumlah = await jumlah_catatan_per_jenis([i['id'] for i in items])
    for i in items:
        i['jumlah_catatan'] = jumlah.get(i['id'], 0)
    items.sort(key=lambda i: (urutan.get(i['kategori_id'], (10**6, i['kategori_nama'])), i['kode_aturan'] or ''))
    return items


async def _cek_kode_unik(kode: str, kecuali_id: Optional[str] = None) -> None:
    """409 bila kode aturan sudah dipakai jenis lain (kode tersimpan sudah huruf besar; field lama `kode` ikut dicek)."""
    query: Dict = {'$or': [{'kode_aturan': kode}, {'kode': kode}]}
    if kecuali_id:
        query['id'] = {'$ne': kecuali_id}
    lain = await db.tatib_aturan.find_one(query, {'_id': 0, 'nama': 1, 'nama_aturan': 1})
    if lain:
        raise HTTPException(409, f'Kode {kode} sudah dipakai oleh "{lain.get("nama") or lain.get("nama_aturan") or "-"}"')


def _field_jenis_dari_request(req: JenisAturanRequest, kategori: Dict) -> Dict:
    """Field kanonis + field lama (kode, nama_aturan, jenis_poin, poin, is_active) agar endpoint lama tetap konsisten."""
    jenis_poin = jenis_poin_dari_jalur(req.jalur_poin)
    poin = -req.besar_poin if req.jalur_poin == 'minus' else req.besar_poin
    return {
        'kode_aturan': req.kode_aturan,
        'kode': req.kode_aturan,
        'nama': req.nama,
        'nama_aturan': req.nama,
        'jalur_poin': req.jalur_poin,
        'jenis_poin': jenis_poin,
        'besar_poin': req.besar_poin,
        'poin': poin,
        'kategori_id': req.kategori_id,
        'kategori_nama': kategori.get('nama'),
        'deskripsi': req.deskripsi,
    }


async def _kategori_atau_404(kategori_id: str) -> Dict:
    kategori = await db.tatib_kategori.find_one({'id': kategori_id}, {'_id': 0, 'id': 1, 'nama': 1})
    if not kategori:
        raise HTTPException(404, "Kategori tidak ditemukan")
    return kategori


async def _jenis_tampil_lengkap(jenis_id: str) -> Dict:
    doc = await db.tatib_aturan.find_one({'id': jenis_id}, {'_id': 0})
    item = jenis_aturan_tampil(doc)
    item['jumlah_catatan'] = (await jumlah_catatan_per_jenis([jenis_id])).get(jenis_id, 0)
    return item


@router.post("/tatib/jenis-aturan")
async def tambah_jenis_aturan(req: JenisAturanRequest, user: Dict = Depends(wajib_input_tatib)):
    """Tambah jenis aturan di Master Jenis Pelanggaran. Kode aturan unik tanpa beda huruf (409)."""
    kategori = await _kategori_atau_404(req.kategori_id)
    await _cek_kode_unik(req.kode_aturan)
    field = _field_jenis_dari_request(req, kategori)
    sekarang = datetime.utcnow().isoformat()
    doc = {
        'id': str(uuid.uuid4()),
        **field,
        # satu kondisi bawaan: nilai pencatatan = besar poin jenis (alur Catat Poin lama tetap bisa memakainya)
        'kondisi': normalisasi_kondisi([], field['jenis_poin'], field['poin']),
        'aktif': True,
        'is_active': True,
        'jenis_id': None,
        'tingkat_kelas': None,
        'created_by': user['id'],
        'created_at': sekarang,
        'updated_at': sekarang,
    }
    try:
        await db.tatib_aturan.insert_one(doc)
    except DuplicateKeyError:  # balapan dua penyimpanan bersamaan (index kode_aturan unik)
        raise HTTPException(409, f'Kode {req.kode_aturan} sudah dipakai')
    await log_audit(user, 'tatib_jenis_aturan_create', f"Tambah jenis aturan {req.kode_aturan} - {req.nama} ({field['poin']})")
    return await _jenis_tampil_lengkap(doc['id'])


@router.put("/tatib/jenis-aturan/{jenis_id}")
async def ubah_jenis_aturan(jenis_id: str, req: JenisAturanRequest, user: Dict = Depends(wajib_input_tatib)):
    """Ubah jenis aturan. Riwayat pencatatan lama tetap memakai poin & nama saat dicatat."""
    lama = await db.tatib_aturan.find_one({'id': jenis_id}, {'_id': 0})
    if not lama:
        raise HTTPException(404, "Jenis aturan tidak ditemukan")
    kategori = await _kategori_atau_404(req.kategori_id)
    await _cek_kode_unik(req.kode_aturan, kecuali_id=jenis_id)
    field = _field_jenis_dari_request(req, kategori)
    f_lama = field_jenis_aturan(lama)
    isian = {**field, 'updated_at': datetime.utcnow().isoformat(), 'diubah_oleh_id': user['id']}
    # Nilai berubah (atau aturan lama tanpa kondisi) -> kondisi diganti satu kondisi bawaan bernilai baru.
    if (f_lama['jalur_poin'], f_lama['besar_poin']) != (req.jalur_poin, req.besar_poin) or not lama.get('kondisi'):
        isian['kondisi'] = normalisasi_kondisi([], field['jenis_poin'], field['poin'])
    try:
        await db.tatib_aturan.update_one({'id': jenis_id}, {'$set': isian})
    except DuplicateKeyError:
        raise HTTPException(409, f'Kode {req.kode_aturan} sudah dipakai')
    await log_audit(user, 'tatib_jenis_aturan_update',
                    f"Ubah jenis aturan {f_lama['kode_aturan']} -> {req.kode_aturan} ({field['poin']})")
    return await _jenis_tampil_lengkap(jenis_id)


@router.patch("/tatib/jenis-aturan/{jenis_id}/aktif")
async def ubah_status_jenis_aturan(jenis_id: str, req: StatusJenisRequest, user: Dict = Depends(wajib_input_tatib)):
    """Aktif/nonaktifkan jenis aturan. Jenis nonaktif tidak bisa dipilih saat mencatat, tetapi tidak dihapus:
    riwayat pencatatan yang memakainya tetap utuh dan tetap bisa diperbaiki."""
    lama = await db.tatib_aturan.find_one({'id': jenis_id}, {'_id': 0, 'id': 1, 'kode_aturan': 1, 'kode': 1})
    if not lama:
        raise HTTPException(404, "Jenis aturan tidak ditemukan")
    await db.tatib_aturan.update_one({'id': jenis_id}, {'$set': {
        'aktif': req.aktif, 'is_active': req.aktif,
        'updated_at': datetime.utcnow().isoformat(), 'diubah_oleh_id': user['id'],
    }})
    await log_audit(user, 'tatib_jenis_aturan_status',
                    f"{'Aktifkan' if req.aktif else 'Nonaktifkan'} jenis aturan {lama.get('kode_aturan') or lama.get('kode')}")
    return await _jenis_tampil_lengkap(jenis_id)


# ============================================================
# TATA TERTIB (ATURAN) ENDPOINTS
# ============================================================

def _kanonis_dari_lama(doc: Dict) -> Dict:
    """Field jenis kanonis yang diturunkan dari field lama — dipakai endpoint /tatib/aturan lama agar
    perubahan lewat jalur itu (mis. is_active) tetap sinkron dengan Master Jenis Pelanggaran."""
    jenis = doc.get('jenis_poin') or jenis_dari_poin(doc.get('poin'))
    return {
        'kode_aturan': normalisasi_kode(doc.get('kode')) or None,
        'nama': doc.get('nama_aturan'),
        'jalur_poin': jalur_dari_jenis_poin(jenis),
        'besar_poin': abs(int(doc.get('poin') or 0)),
        'aktif': doc.get('is_active', True) is not False,
    }


@router.get("/tatib/aturan")
async def list_aturan(
    kategori_id: Optional[str] = None,
    jenis_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    jenis_poin: Optional[str] = None,
    user: Dict = Depends(wajib_akses_tatib)
):
    """List all tata tertib rules (opsional per jalur jenis_poin: kebaikan/pelanggaran)."""
    query = {}
    if jenis_poin == 'pelanggaran':
        query['$or'] = [{'jenis_poin': 'pelanggaran'}, {'jenis_poin': None, 'jalur_poin': 'minus'},
                        {'jenis_poin': None, 'jalur_poin': None, 'poin': {'$lt': 0}}]
    elif jenis_poin == 'kebaikan':
        query['$or'] = [{'jenis_poin': 'kebaikan'}, {'jenis_poin': None, 'jalur_poin': 'plus'},
                        {'jenis_poin': None, 'jalur_poin': None, 'poin': {'$gte': 0}}]
    if kategori_id:
        query['kategori_id'] = kategori_id
    if jenis_id:
        query['jenis_id'] = jenis_id
    items = await db.tatib_aturan.find(query, {'_id': 0}).sort([('kategori_id', 1), ('jenis_id', 1), ('kode', 1)]).to_list(1000)
    if is_active is not None:
        # status kanonis (aktif, cadangan is_active; aturan lama tanpa keduanya = aktif)
        items = [i for i in items if field_jenis_aturan(i)['aktif'] is is_active]
    return [_aturan_tampil(i) for i in items]


@router.get("/tatib/aturan/{aturan_id}")
async def get_aturan(aturan_id: str, user: Dict = Depends(wajib_akses_tatib)):
    """Get a specific tata tertib rule."""
    doc = await db.tatib_aturan.find_one({'id': aturan_id}, {'_id': 0})
    if not doc:
        raise HTTPException(404, "Aturan tidak ditemukan")
    return _aturan_tampil(doc)


@router.post("/tatib/aturan")
async def create_aturan(req: TatibRequest, user: Dict = Depends(wajib_input_tatib)):
    """Create a new tata tertib rule."""
    # Verify kategori and jenis exist
    kategori = await db.tatib_kategori.find_one({'id': req.kategori_id})
    if not kategori:
        raise HTTPException(404, "Kategori tidak ditemukan")

    jenis = await db.tatib_jenis.find_one({'id': req.jenis_id})
    if not jenis:
        raise HTTPException(404, "Jenis tidak ditemukan")

    await _cek_kode_unik(normalisasi_kode(req.kode))

    doc = {
        'id': str(uuid.uuid4()),
        'kategori_id': req.kategori_id,
        'kategori_nama': kategori.get('nama'),
        'jenis_id': req.jenis_id,
        'jenis_nama': jenis.get('nama'),
        'kode': normalisasi_kode(req.kode),
        'nama_aturan': req.nama_aturan,
        'deskripsi': req.deskripsi,
        **_skema_aturan(req),
        'tingkat_kelas': req.tingkat_kelas,
        'is_active': req.is_active,
        'created_by': user['id'],
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }

    doc.update(_kanonis_dari_lama(doc))
    await db.tatib_aturan.insert_one(doc)
    await log_audit(user, 'tatib_aturan_create', f"Created aturan: {req.kode} - {req.nama_aturan}")
    doc.pop('_id', None)
    return _aturan_tampil(doc)


@router.put("/tatib/aturan/{aturan_id}")
async def update_aturan(aturan_id: str, req: TatibRequest, user: Dict = Depends(wajib_input_tatib)):
    """Update a tata tertib rule."""
    existing = await db.tatib_aturan.find_one({'id': aturan_id})
    if not existing:
        raise HTTPException(404, "Aturan tidak ditemukan")

    await _cek_kode_unik(normalisasi_kode(req.kode), kecuali_id=aturan_id)

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

    update_data.update(req.model_dump(exclude_unset=True, exclude={'kondisi', 'jenis_poin', 'poin'}))
    update_data.update(_skema_aturan(req))
    update_data['updated_at'] = datetime.utcnow().isoformat()

    update_data['kode'] = normalisasi_kode(req.kode)
    update_data.update(_kanonis_dari_lama({**existing, **update_data}))
    await db.tatib_aturan.update_one({'id': aturan_id}, {'$set': update_data})
    await log_audit(user, 'tatib_aturan_update', f"Updated aturan: {aturan_id}")

    updated = await db.tatib_aturan.find_one({'id': aturan_id}, {'_id': 0})
    return _aturan_tampil(updated)


@router.delete("/tatib/aturan/{aturan_id}")
async def delete_aturan(aturan_id: str, user: Dict = Depends(wajib_input_tatib)):
    """Delete a tata tertib rule."""
    existing = await db.tatib_aturan.find_one({'id': aturan_id})
    if not existing:
        raise HTTPException(404, "Aturan tidak ditemukan")

    # Check if any penanganan uses this aturan
    penanganan_count = await db.tatib_penanganan.count_documents({'tatib_id': aturan_id})
    if penanganan_count > 0:
        raise HTTPException(400, f"Aturan masih digunakan oleh {penanganan_count} data penanganan")

    await db.tatib_aturan.delete_one({'id': aturan_id})
    await log_audit(user, 'tatib_aturan_delete', f"Deleted aturan: {aturan_id}")
    return {'message': 'Aturan berhasil dihapus'}


# ============================================================
# IMPORT EXCEL ENDPOINT
# ============================================================

@router.post("/tatib/aturan/import")
async def import_aturan_excel(
    file: UploadFile = File(...),
    user: Dict = Depends(wajib_input_tatib)
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

                # Check for duplicate kode (tanpa beda huruf, sama dengan Master Jenis Pelanggaran)
                kode = normalisasi_kode(str(row['kode']))
                if await db.tatib_aturan.find_one({'$or': [{'kode_aturan': kode}, {'kode': kode}]}, {'_id': 1}):
                    errors.append(f"Baris {idx + 2}: Kode '{row['kode']}' sudah ada")
                    continue

                doc = {
                    'id': str(uuid.uuid4()),
                    'kategori_id': row['kategori_id'],
                    'kategori_nama': kategori.get('nama'),
                    'jenis_id': row['jenis_id'],
                    'jenis_nama': jenis.get('nama'),
                    'kode': kode,
                    'nama_aturan': row['nama_aturan'],
                    'deskripsi': row.get('deskripsi', ''),
                    'poin': int(row['poin']),
                    'tingkat_kelas': row.get('tingkat_kelas', ''),
                    'is_active': True,
                    'created_by': user['id'],
                    'created_at': datetime.utcnow().isoformat(),
                    'updated_at': datetime.utcnow().isoformat(),
                }
                doc.update(_kanonis_dari_lama(doc))

                await db.tatib_aturan.insert_one(doc)
                imported += 1

            except Exception as e:
                errors.append(f"Baris {idx + 2}: {str(e)}")

        await log_audit(user, 'tatib_aturan_import', f"Imported {imported} aturan from Excel")

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
    asal_input: Optional[str] = None,
    user: Dict = Depends(get_current_user)
):
    """Daftar catatan poin (pelanggaran & kebaikan), terbaru dulu; tiap catatan memuat asal_input
    (catatan lama = null). Filter opsional: siswa, aturan, periode, rentang tanggal, asal input."""
    query = {}
    if asal_input:
        query['asal_input'] = cek_asal_input(asal_input)
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

    await batasi_query_tatib(user, query)  # siswa: miliknya; wali kelas: kelasnya; peran lain tanpa akses: 403
    await sembunyikan_siswa_nonaktif(query, 'siswa_id', db)  # data siswa nonaktif disembunyikan, tidak dihapus
    items = await db.tatib_penanganan.find(query, {'_id': 0}).sort('tanggal', -1).to_list(1000)
    return [rapikan_catatan(i) for i in items]


@router.get("/tatib/penanganan/{penanganan_id}")
async def get_penanganan(penanganan_id: str, user: Dict = Depends(get_current_user)):
    """Get a specific penanganan."""
    doc = await db.tatib_penanganan.find_one({'id': penanganan_id}, {'_id': 0})
    if not doc:
        raise HTTPException(404, "Penanganan tidak ditemukan")
    await batasi_query_tatib(user, {'siswa_id': doc.get('siswa_id')})
    return rapikan_catatan(doc)


async def _notify_tatib(doc: Dict, siswa: Dict, poin):
    """Catatan tata tertib → wali kelas siswa (dan guru BK untuk pelanggaran)."""
    class_id = siswa.get('class_id') or siswa.get('student_class_id')
    if not class_id:
        akun = await db.users.find_one({'id': doc['siswa_id']}, {'_id': 0, 'student_class_id': 1}) or {}
        class_id = akun.get('student_class_id')
    wali = await homeroom_teacher_of(class_id, siswa.get('class_name'))
    is_prestasi = (poin or 0) > 0
    jenis = 'Prestasi' if is_prestasi else 'Pelanggaran'
    body = f"{doc.get('tatib_nama') or '-'} ({poin or 0} poin) · dicatat {doc.get('petugas_nama') or '-'}"
    kelas = f" · {doc['siswa_kelas']}" if doc.get('siswa_kelas') else ''
    title = f"{jenis} tata tertib: {doc.get('siswa_nama') or 'siswa'}{kelas}"
    # Ke Pantauan Walikelas (poin), bukan Data Siswa; siswa_id agar aplikasi membuka poin siswa itu.
    await notify_users([wali], title, body, type='tatib_record', route='/wali-kelas/poin-tatib',
                       data={'penanganan_id': doc['id'], 'siswa_id': doc.get('siswa_id')}, exclude=[doc.get('petugas_id')])
    if not is_prestasi:
        await notify_roles(['guru_bk'], title, body, type='tatib_record', route='/admin/tatib/data',
                           data={'penanganan_id': doc['id']}, exclude=[doc.get('petugas_id'), wali])


async def _cari_siswa(siswa_id: str) -> Optional[Dict]:
    """Akun siswa (users, dipakai /students & seluruh aplikasi); cadangan: koleksi lama `students`."""
    akun = await db.users.find_one({'id': siswa_id, 'roles': 'siswa'},
                                   {'_id': 0, 'id': 1, 'full_name': 1, 'nis': 1, 'nisn': 1, 'student_class_id': 1})
    if akun:
        kelas = None
        if akun.get('student_class_id'):
            kelas = await db.classes.find_one({'id': akun['student_class_id']}, {'_id': 0, 'name': 1})
        return {**akun, 'class_id': akun.get('student_class_id'), 'class_name': (kelas or {}).get('name')}
    return await db.students.find_one({'id': siswa_id}, {'_id': 0})


def _nilai_atau_400(tatib: Dict, kondisi_id: Optional[str]) -> Dict:
    try:
        return hitung_poin_aturan(tatib, kondisi_id)
    except ValueError as e:
        raise HTTPException(400, str(e))


async def catat_poin(req: PenangananRequest, user: Dict, jenis_wajib: Optional[str] = None) -> Dict:
    """Simpan satu catatan poin. Nilai SELALU dihitung server dari aturan + kondisi;
    `jenis_wajib` memastikan aturan sesuai jalur (kebaikan/pelanggaran). Asal input wajib untuk catatan baru."""
    asal_input = cek_asal_input(req.asal_input, wajib=True)
    siswa = await _cari_siswa(req.siswa_id)
    if not siswa:
        raise HTTPException(404, "Siswa tidak ditemukan")
    tatib = await db.tatib_aturan.find_one({'id': req.tatib_id}, {'_id': 0})
    if not tatib:
        raise HTTPException(404, "Aturan tata tertib tidak ditemukan")
    tatib = dengan_field_lama(tatib)
    if not field_jenis_aturan(tatib)['aktif']:
        raise HTTPException(400, "Aturan tata tertib ini sudah tidak aktif")
    nilai = _nilai_atau_400(tatib, req.kondisi_id)
    if jenis_wajib and nilai['jenis_poin'] != jenis_wajib:
        raise HTTPException(400, f"Aturan ini bukan untuk jalur poin {jenis_wajib}")

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
        **nilai,
        'tindak_lanjut': [],
        'kategori_id': tatib.get('kategori_id'),
        'kategori_nama': tatib.get('kategori_nama'),
        'jenis_id': req.tatib_id,
        'jenis_nama': tatib.get('jenis_nama'),
        'tanggal': req.tanggal,
        'tahun_takwim_id': req.tahun_takwim_id,
        'tahun_pelajaran_id': req.tahun_pelajaran_id,
        'semester': req.semester,
        'semester_id': req.semester_id,
        'catatan': req.catatan,
        'keterangan': req.catatan,
        'asal_input': asal_input,
        'bukti_url': req.bukti_url,
        'petugas_id': user['id'],
        'petugas_nama': user.get('full_name', user.get('username')),
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }

    await db.tatib_penanganan.insert_one(doc)
    spawn(_notify_tatib(dict(doc), siswa, nilai['poin']))
    await log_audit(
        user,
        'tatib_penanganan_create',
        f"Recorded {nilai['jenis_poin']} ({nilai['poin']}) for {siswa.get('full_name')}: {tatib.get('nama_aturan')}"
    )
    doc.pop('_id', None)
    return serialize_doc(doc)


@router.post("/tatib/penanganan")
async def create_penanganan(req: PenangananRequest, user: Dict = Depends(wajib_input_tatib)):
    """Record a new pelanggaran or kebaikan (nilai dari aturan + kondisi)."""
    return await catat_poin(req, user)


@router.post("/tatib/poin/{jenis}")
async def catat_poin_jalur(jenis: str, req: PenangananRequest, user: Dict = Depends(wajib_input_tatib)):
    """Jalur pencatatan terpisah: /tatib/poin/kebaikan (PLUS) atau /tatib/poin/pelanggaran (MINUS).
    Poin kebaikan tidak terhubung ke data prestasi siswa."""
    if jenis not in JENIS_POIN:
        raise HTTPException(404, "Jalur poin tidak dikenal")
    return await catat_poin(req, user, jenis_wajib=jenis)


# ============================================================
# INPUT TATA TERTIB TERPADU (struktur baru: poin dari master jenis aturan)
# ============================================================

MAKS_KETERANGAN = 500


class InputTatibRequest(BaseModel):
    """Satu pencatatan dari halaman Input Tata Tertib; poin TIDAK dikirim — dihitung dari jenis."""
    siswa_id: str
    jenis_id: str
    tanggal: str  # YYYY-MM-DD (tanggal kejadian)
    asal_input: str
    keterangan: Optional[str] = None
    semester_id: Optional[str] = None
    tahun_takwim_id: Optional[str] = None


def catatan_input_tampil(doc: Dict) -> Dict:
    """Catatan poin dalam bentuk daftar Input Tata Tertib (catatan lama ikut diterjemahkan)."""
    return serialize_doc({
        **doc,
        'jenis_id': doc.get('jenis_id') or doc.get('tatib_id'),
        'kode_aturan': doc.get('tatib_kode'),
        'jenis_nama': doc.get('tatib_nama'),
        'keterangan': doc.get('keterangan') if doc.get('keterangan') is not None else doc.get('catatan'),
        'asal_input': doc.get('asal_input'),
        'poin': nilai_poin(doc),
    })


async def _isian_input_tatib(req: InputTatibRequest, jenis_lama_id: Optional[str] = None) -> Dict:
    """Validasi isian & susun field catatan. Jenis nonaktif ditolak, kecuali tetap jenis lama saat memperbaiki."""
    try:
        tanggal = date.fromisoformat((req.tanggal or '')[:10]).isoformat()
    except ValueError:
        raise HTTPException(400, "Tanggal kejadian tidak valid (format YYYY-MM-DD)")
    if tanggal > tanggal_wib():
        raise HTTPException(400, "Tanggal kejadian tidak boleh melewati hari ini")
    cek_asal_input(req.asal_input, wajib=True)
    keterangan = (req.keterangan or '').strip()
    if len(keterangan) > MAKS_KETERANGAN:
        raise HTTPException(400, f"Keterangan maksimal {MAKS_KETERANGAN} karakter")

    siswa = await _cari_siswa(req.siswa_id)
    if not siswa:
        raise HTTPException(404, "Siswa tidak ditemukan")
    jenis = await db.tatib_aturan.find_one({'id': req.jenis_id}, {'_id': 0})
    if not jenis:
        raise HTTPException(404, "Jenis aturan tidak ditemukan")
    f = field_jenis_aturan(jenis)
    if not f['aktif'] and req.jenis_id != jenis_lama_id:
        raise HTTPException(400, "Jenis aturan ini sudah tidak aktif")
    kategori = await db.tatib_kategori.find_one({'id': jenis.get('kategori_id')}, {'_id': 0, 'nama': 1}) or {}
    poin = poin_jenis_aturan(jenis)

    return {
        'siswa': siswa,
        'isian': {
            'siswa_id': req.siswa_id,
            'siswa_nama': siswa.get('full_name'),
            'siswa_nis': siswa.get('nis'),
            'siswa_nisn': siswa.get('nisn'),
            'siswa_kelas': siswa.get('class_name'),
            'jenis_id': req.jenis_id,
            'tatib_id': req.jenis_id,  # kompatibilitas endpoint & rekap lama
            'tatib_kode': f['kode_aturan'],
            'tatib_nama': f['nama'],
            'jenis_nama': f['nama'],
            'tatib_poin': poin,
            'jenis_poin': jenis_poin_dari_jalur(f['jalur_poin']),
            'poin': poin,
            'kondisi_id': None,
            'kondisi': None,
            'kategori_id': jenis.get('kategori_id'),
            'kategori_nama': kategori.get('nama') or jenis.get('kategori_nama'),
            'tanggal': tanggal,
            'asal_input': req.asal_input,
            'keterangan': keterangan or None,
            'catatan': keterangan or None,
            'semester_id': req.semester_id,
            'tahun_takwim_id': req.tahun_takwim_id,
        },
    }


@router.post("/tatib/input")
async def simpan_input_tatib(req: InputTatibRequest, user: Dict = Depends(wajib_input_tatib)):
    """Simpan satu pencatatan dari Input Tata Tertib. Poin selalu mengikuti master jenis (server)."""
    hasil = await _isian_input_tatib(req)
    sekarang = datetime.utcnow().isoformat()
    doc = {
        'id': str(uuid.uuid4()),
        **hasil['isian'],
        'tindak_lanjut': [],
        'bukti_url': None,
        'petugas_id': user['id'],
        'petugas_nama': user.get('full_name', user.get('username')),
        'created_at': sekarang,
        'updated_at': sekarang,
    }
    await db.tatib_penanganan.insert_one(doc)
    spawn(_notify_tatib(dict(doc), hasil['siswa'], doc['poin']))
    await log_audit(user, 'tatib_input_create',
                    f"Input tatib {doc['tatib_kode']} ({doc['poin']}) untuk {doc['siswa_nama']} · {doc['asal_input']}")
    doc.pop('_id', None)
    return catatan_input_tampil(doc)


@router.get("/tatib/input/terbaru")
async def daftar_input_terbaru(
    batas: int = 10,
    siswa_id: Optional[str] = None,
    user: Dict = Depends(wajib_lihat_tatib),
):
    """Pencatatan terbaru (urut waktu input) untuk diperiksa di halaman Input Tata Tertib.
    -> {items, ada_lagi}. `siswa_id` membatasi ke satu siswa."""
    batas = max(1, min(batas, 100))
    query: Dict = {'siswa_id': siswa_id} if siswa_id else {}
    await sembunyikan_siswa_nonaktif(query, 'siswa_id', db)
    items = await db.tatib_penanganan.find(query, {'_id': 0}).sort([('created_at', -1), ('tanggal', -1)]).to_list(batas + 1)
    return {'items': [catatan_input_tampil(i) for i in items[:batas]], 'ada_lagi': len(items) > batas}


@router.put("/tatib/input/{catatan_id}")
async def ubah_input_tatib(catatan_id: str, req: InputTatibRequest, user: Dict = Depends(wajib_input_tatib)):
    """Perbaiki pencatatan yang salah input. Poin dihitung ulang dari jenis; jenis lama yang kini nonaktif
    tetap boleh dipertahankan. Tindak lanjut, petugas awal, dan waktu input tidak berubah."""
    lama = await db.tatib_penanganan.find_one({'id': catatan_id}, {'_id': 0})
    if not lama:
        raise HTTPException(404, "Catatan tata tertib tidak ditemukan")
    hasil = await _isian_input_tatib(req, jenis_lama_id=lama.get('jenis_id') or lama.get('tatib_id'))
    isian = {k: v for k, v in hasil['isian'].items() if k not in ('semester_id', 'tahun_takwim_id') or v}
    isian.update({
        'updated_at': datetime.utcnow().isoformat(),
        'diubah_oleh_id': user['id'],
        'diubah_oleh_nama': user.get('full_name', user.get('username')),
    })
    await db.tatib_penanganan.update_one({'id': catatan_id}, {'$set': isian})
    await log_audit(user, 'tatib_input_update',
                    f"Perbaiki catatan tatib {catatan_id}: {lama.get('tatib_kode')} ({nilai_poin(lama)}) -> {isian['tatib_kode']} ({isian['poin']})")
    return catatan_input_tampil(await db.tatib_penanganan.find_one({'id': catatan_id}, {'_id': 0}))


@router.delete("/tatib/input/{catatan_id}")
async def hapus_input_tatib(catatan_id: str, user: Dict = Depends(require_role('admin'))):
    """Hapus pencatatan (hanya admin, sama dengan hapus catatan poin lainnya)."""
    lama = await db.tatib_penanganan.find_one({'id': catatan_id}, {'_id': 0, 'tatib_kode': 1, 'siswa_nama': 1})
    if not lama:
        raise HTTPException(404, "Catatan tata tertib tidak ditemukan")
    await db.tatib_penanganan.delete_one({'id': catatan_id})
    await log_audit(user, 'tatib_input_delete', f"Hapus catatan tatib {catatan_id}: {lama.get('tatib_kode')} · {lama.get('siswa_nama')}")
    return {'message': 'Catatan tata tertib dihapus'}


@router.post("/tatib/penanganan/{penanganan_id}/tindak-lanjut")
async def tambah_tindak_lanjut(penanganan_id: str, req: TindakLanjutRequest,
                               user: Dict = Depends(wajib_input_tatib)):
    """Tambah tindak lanjut penanganan pada catatan PELANGGARAN (menumpang endpoint penanganan)."""
    doc = await db.tatib_penanganan.find_one({'id': penanganan_id}, {'_id': 0})
    if not doc:
        raise HTTPException(404, "Penanganan tidak ditemukan")
    nilai = doc.get('poin') if doc.get('poin') is not None else doc.get('tatib_poin')
    if (doc.get('jenis_poin') or jenis_dari_poin(nilai)) != 'pelanggaran':
        raise HTTPException(400, "Tindak lanjut hanya untuk catatan pelanggaran")
    uraian = (req.uraian or '').strip()
    if not uraian or not req.tanggal:
        raise HTTPException(400, "Tanggal dan uraian tindak lanjut wajib diisi")
    item = {
        'id': str(uuid.uuid4()),
        'tanggal': req.tanggal,
        'uraian': uraian,
        'petugas_id': user['id'],
        'petugas_nama': user.get('full_name', user.get('username')),
        'created_at': datetime.utcnow().isoformat(),
    }
    await db.tatib_penanganan.update_one(
        {'id': penanganan_id},
        {'$push': {'tindak_lanjut': item}, '$set': {'updated_at': datetime.utcnow().isoformat()}})
    await log_audit(user, 'tatib_tindak_lanjut_create', f"Tindak lanjut penanganan {penanganan_id}")
    updated = await db.tatib_penanganan.find_one({'id': penanganan_id}, {'_id': 0})
    return serialize_doc(updated)


@router.put("/tatib/penanganan/{penanganan_id}")
async def update_penanganan(penanganan_id: str, req: PenangananRequest, user: Dict = Depends(wajib_input_tatib)):
    """Update a penanganan record."""
    existing = await db.tatib_penanganan.find_one({'id': penanganan_id})
    if not existing:
        raise HTTPException(404, "Penanganan tidak ditemukan")

    # Verify siswa and tatib if changed
    update_data = {}

    if req.siswa_id != existing.get('siswa_id'):
        siswa = await _cari_siswa(req.siswa_id)
        if not siswa:
            raise HTTPException(404, "Siswa tidak ditemukan")
        update_data.update({
            'siswa_nama': siswa.get('full_name'),
            'siswa_nis': siswa.get('nis'),
            'siswa_nisn': siswa.get('nisn'),
            'siswa_kelas': siswa.get('class_name'),
        })

    kondisi_berubah = 'kondisi_id' in req.model_fields_set and req.kondisi_id != existing.get('kondisi_id')
    if req.tatib_id != existing.get('tatib_id') or kondisi_berubah:
        tatib = await db.tatib_aturan.find_one({'id': req.tatib_id}, {'_id': 0})
        if not tatib:
            raise HTTPException(404, "Aturan tidak ditemukan")
        if req.tatib_id != existing.get('tatib_id') and not field_jenis_aturan(tatib)['aktif']:
            raise HTTPException(400, "Aturan tata tertib ini sudah tidak aktif")
        tatib = dengan_field_lama(tatib)
        kondisi_id = req.kondisi_id if 'kondisi_id' in req.model_fields_set else None
        update_data.update({
            'tatib_kode': tatib.get('kode'),
            'tatib_nama': tatib.get('nama_aturan'),
            'tatib_poin': tatib.get('poin'),
            **_nilai_atau_400(tatib, kondisi_id),
            'kategori_id': tatib.get('kategori_id'),
            'kategori_nama': tatib.get('kategori_nama'),
            'jenis_nama': tatib.get('jenis_nama'),
        })

    update_data.update(req.model_dump(exclude_unset=True, exclude={'kondisi_id'}))
    if 'asal_input' in req.model_fields_set:
        update_data['asal_input'] = cek_asal_input(req.asal_input)
    if 'catatan' in req.model_fields_set:
        update_data['keterangan'] = req.catatan
    if 'tatib_id' in update_data:
        update_data['jenis_id'] = update_data['tatib_id']
    update_data['updated_at'] = datetime.utcnow().isoformat()

    await db.tatib_penanganan.update_one({'id': penanganan_id}, {'$set': update_data})
    await log_audit(user, 'tatib_penanganan_update', f"Updated penanganan: {penanganan_id}")

    updated = await db.tatib_penanganan.find_one({'id': penanganan_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/tatib/penanganan/{penanganan_id}")
async def delete_penanganan(penanganan_id: str, user: Dict = Depends(require_role('admin'))):
    """Delete a penanganan record."""
    existing = await db.tatib_penanganan.find_one({'id': penanganan_id})
    if not existing:
        raise HTTPException(404, "Penanganan tidak ditemukan")

    await db.tatib_penanganan.delete_one({'id': penanganan_id})
    await log_audit(user, 'tatib_penanganan_delete', f"Deleted penanganan: {penanganan_id}")
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
    await batasi_query_tatib(user, query)
    if tahun_takwim_id:
        query['tahun_takwim_id'] = tahun_takwim_id
    if tahun_pelajaran_id:
        query['tahun_pelajaran_id'] = tahun_pelajaran_id
    if semester:
        query['semester'] = semester

    records = await db.tatib_penanganan.find(query, {'_id': 0}).to_list(1000)

    # Nilai bertanda per catatan (catatan lama: tatib_poin); records memuat asal_input & keterangan.
    total_poin = sum(nilai_poin(r) for r in records)
    total_pelanggaran = sum(1 for r in records if nilai_poin(r) < 0)
    total_prestasi = sum(1 for r in records if nilai_poin(r) > 0)

    by_kategori = {}
    for r in records:
        kat = r.get('kategori_nama') or 'Lainnya'
        if kat not in by_kategori:
            by_kategori[kat] = {'count': 0, 'total_poin': 0}
        by_kategori[kat]['count'] += 1
        by_kategori[kat]['total_poin'] += nilai_poin(r)

    by_asal_input = {}
    for r in records:
        asal = r.get('asal_input') or '-'
        by_asal_input[asal] = by_asal_input.get(asal, 0) + 1

    return {
        'siswa_id': siswa_id,
        'total_records': len(records),
        'total_poin': total_poin,
        'total_pelanggaran': total_pelanggaran,
        'total_prestasi': total_prestasi,
        'by_kategori': by_kategori,
        'by_asal_input': by_asal_input,
        'records': [rapikan_catatan(r) for r in records]
    }


@router.get("/tatib/stats/summary")
async def get_summary_stats(
    tahun_takwim_id: Optional[str] = None,
    tahun_pelajaran_id: Optional[str] = None,
    semester: Optional[str] = None,
    kelas: Optional[str] = None,
    user: Dict = Depends(wajib_lihat_tatib)
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
