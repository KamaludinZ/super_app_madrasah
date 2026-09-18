"""API endpoints for Bimbingan Konseling (BK / Guidance & Counseling) Management."""
from typing import Dict, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
import uuid

from core import db, get_current_user, require_role, serialize_doc, log_audit, get_settings
from clkb_bank import CLKB_ITEMS, CLKB_PETUNJUK, CLKB_TOTAL_ITEMS
from pcl_bank import PCL_CATEGORIES, PCL_ESSAY_QUESTIONS, PCL_PETUNJUK, pcl_total_items
from ai_client import generate_text, AIError

router = APIRouter()

BK_ROLES = ('admin', 'guru_bk')


# ============================================================
# REQUEST MODELS
# ============================================================

class KunjunganKonselingRequest(BaseModel):
    """Request model for a counseling visit session."""
    siswa_id: str
    tanggal: str  # ISO format
    jenis_layanan: str  # e.g., "Konseling Individu", "Konseling Kelompok", "Konsultasi"
    masalah: str
    penanganan: Optional[str] = None
    tindak_lanjut: Optional[str] = None
    tahun_takwim_id: Optional[str] = None
    tahun_pelajaran_id: Optional[str] = None
    semester: Optional[str] = None


class CLKBSubmitRequest(BaseModel):
    """Request model for a student's CLKB (study habit checklist) submission."""
    selected: List[int] = Field(default_factory=list)  # item 'no' values the student checked
    waktu_belajar_jam: Optional[str] = None  # free text: hours/day
    waktu_belajar_dari: Optional[str] = None  # e.g., "19:00"
    waktu_belajar_sampai: Optional[str] = None
    perlu_info_cara_belajar: Optional[bool] = None
    topik_diminati: List[str] = Field(default_factory=list)  # from checkbox list + "lain-lain"
    topik_lainnya: Optional[str] = None
    kebiasaan_diperbaiki: List[str] = Field(default_factory=list)  # up to 3 free-text habits


class PCLSubmitRequest(BaseModel):
    """Request model for a student's PCL (problem checklist) submission."""
    selected: Dict[str, List[int]] = Field(default_factory=dict)  # { kategori_kode: [item indices selected] }
    masalah_lain: Optional[str] = None
    masalah_saat_ini: Optional[str] = None
    tempat_curhat: Optional[str] = None


class BKResponseRequest(BaseModel):
    """Request model for admin/guru BK manual response & recommendation on a submission."""
    tanggapan: str
    rekomendasi: Optional[str] = None


class JurnalHomeVisitRequest(BaseModel):
    """Request model for a home visit journal entry."""
    siswa_id: str
    tanggal: str
    tujuan: str
    hasil_kunjungan: str
    pihak_ditemui: Optional[str] = None  # e.g., "Orang Tua", "Wali"
    rekomendasi: Optional[str] = None
    tahun_takwim_id: Optional[str] = None
    tahun_pelajaran_id: Optional[str] = None
    semester: Optional[str] = None


class SekolahLanjutanRequest(BaseModel):
    """Request model for tracking a student's continuing school plan/outcome."""
    siswa_id: str
    jenjang_tujuan: Optional[str] = None  # e.g., "SMA", "SMK", "MA", "Pondok Pesantren"
    nama_sekolah_tujuan: Optional[str] = None
    status: Optional[str] = 'Rencana'  # Rencana, Mendaftar, Diterima, Tidak Diterima
    catatan: Optional[str] = None
    tahun_ajaran_lulus: Optional[str] = None


async def _get_siswa_or_404(siswa_id: str):
    siswa = await db.users.find_one({'id': siswa_id, 'roles': 'siswa'})
    if not siswa:
        raise HTTPException(404, "Siswa tidak ditemukan")
    return siswa


async def _siswa_fields(siswa: Dict) -> Dict:
    cls = None
    if siswa.get('student_class_id'):
        cls = await db.classes.find_one({'id': siswa['student_class_id']}, {'_id': 0, 'name': 1})
    return {
        'siswa_nama': siswa.get('full_name'),
        'siswa_nis': siswa.get('nis'),
        'siswa_nisn': siswa.get('nisn'),
        'siswa_kelas': cls.get('name') if cls else None,
    }


# ============================================================
# KUNJUNGAN KONSELING ENDPOINTS
# ============================================================

@router.get("/bk/kunjungan")
async def list_kunjungan(
    siswa_id: Optional[str] = None,
    jenis_layanan: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    tahun_pelajaran_id: Optional[str] = None,
    semester: Optional[str] = None,
    user: Dict = Depends(get_current_user)
):
    """List counseling visits, optionally filtered."""
    query = {}
    if siswa_id:
        query['siswa_id'] = siswa_id
    if jenis_layanan:
        query['jenis_layanan'] = jenis_layanan
    if tahun_pelajaran_id:
        query['tahun_pelajaran_id'] = tahun_pelajaran_id
    if semester:
        query['semester'] = semester
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query['$gte'] = start_date
        if end_date:
            date_query['$lte'] = end_date
        query['tanggal'] = date_query

    items = await db.bk_kunjungan.find(query, {'_id': 0}).sort('tanggal', -1).to_list(2000)
    return [serialize_doc(i) for i in items]


@router.get("/bk/kunjungan/{kunjungan_id}")
async def get_kunjungan(kunjungan_id: str, user: Dict = Depends(get_current_user)):
    doc = await db.bk_kunjungan.find_one({'id': kunjungan_id}, {'_id': 0})
    if not doc:
        raise HTTPException(404, "Data kunjungan tidak ditemukan")
    return serialize_doc(doc)


@router.post("/bk/kunjungan")
async def create_kunjungan(req: KunjunganKonselingRequest, user: Dict = Depends(require_role(*BK_ROLES))):
    siswa = await _get_siswa_or_404(req.siswa_id)

    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        **(await _siswa_fields(siswa)),
        'petugas_id': user['id'],
        'petugas_nama': user.get('full_name', user.get('username')),
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }

    await db.bk_kunjungan.insert_one(doc)
    await log_audit(user['id'], 'bk_kunjungan_create', f"Recorded kunjungan konseling for {siswa.get('full_name')}")
    return serialize_doc(doc)


@router.put("/bk/kunjungan/{kunjungan_id}")
async def update_kunjungan(kunjungan_id: str, req: KunjunganKonselingRequest, user: Dict = Depends(require_role(*BK_ROLES))):
    existing = await db.bk_kunjungan.find_one({'id': kunjungan_id})
    if not existing:
        raise HTTPException(404, "Data kunjungan tidak ditemukan")

    update_data = req.model_dump()
    if req.siswa_id != existing.get('siswa_id'):
        siswa = await _get_siswa_or_404(req.siswa_id)
        update_data.update(await _siswa_fields(siswa))
    update_data['updated_at'] = datetime.utcnow().isoformat()

    await db.bk_kunjungan.update_one({'id': kunjungan_id}, {'$set': update_data})
    await log_audit(user['id'], 'bk_kunjungan_update', f"Updated kunjungan konseling: {kunjungan_id}")

    updated = await db.bk_kunjungan.find_one({'id': kunjungan_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/bk/kunjungan/{kunjungan_id}")
async def delete_kunjungan(kunjungan_id: str, user: Dict = Depends(require_role(*BK_ROLES))):
    existing = await db.bk_kunjungan.find_one({'id': kunjungan_id})
    if not existing:
        raise HTTPException(404, "Data kunjungan tidak ditemukan")

    await db.bk_kunjungan.delete_one({'id': kunjungan_id})
    await log_audit(user['id'], 'bk_kunjungan_delete', f"Deleted kunjungan konseling: {kunjungan_id}")
    return {'message': 'Data kunjungan berhasil dihapus'}


# ============================================================
# CLKB (CEK LIST KEBIASAAN BELAJAR) — FORM & SCHEDULE
# ============================================================

def _clkb_window_open(settings: Dict) -> bool:
    if not settings.get('clkb_open'):
        return False
    now = datetime.utcnow().isoformat()
    start = settings.get('clkb_open_start')
    end = settings.get('clkb_open_end')
    if start and now < start:
        return False
    if end and now > end:
        return False
    return True


@router.get("/bk/clkb/form")
async def get_clkb_form(user: Dict = Depends(get_current_user)):
    """Form definition + open/closed status, used by the student-facing CLKB page."""
    settings = await get_settings()
    return {
        'items': CLKB_ITEMS,
        'petunjuk': CLKB_PETUNJUK,
        'total_items': CLKB_TOTAL_ITEMS,
        'is_open': _clkb_window_open(settings),
        'info': settings.get('clkb_info'),
    }


def _score_clkb(selected: List[int]) -> Dict:
    selected_set = set(selected)
    key_map = {item['no']: item['kunci'] for item in CLKB_ITEMS}
    valid_selected = [n for n in selected_set if n in key_map]
    plus = sum(1 for n in valid_selected if key_map[n] == '+')
    minus = sum(1 for n in valid_selected if key_map[n] == '-')
    total_selected = len(valid_selected)
    return {
        'plus_count': plus,
        'minus_count': minus,
        'total_selected': total_selected,
        'plus_percentage': round(plus / CLKB_TOTAL_ITEMS * 100, 1),
        'minus_percentage': round(minus / CLKB_TOTAL_ITEMS * 100, 1),
        'completion_percentage': round(total_selected / CLKB_TOTAL_ITEMS * 100, 1),
    }


@router.post("/bk/clkb/submit")
async def submit_clkb(req: CLKBSubmitRequest, user: Dict = Depends(get_current_user)):
    """Student submits a new CLKB attempt."""
    if 'siswa' not in user.get('roles', []):
        raise HTTPException(403, "Hanya siswa yang dapat mengisi CLKB")

    settings = await get_settings()
    if not _clkb_window_open(settings):
        raise HTTPException(400, "Pengisian CLKB sedang ditutup oleh admin/sekolah")

    siswa = await _get_siswa_or_404(user['id'])
    scoring = _score_clkb(req.selected)

    doc = {
        'id': str(uuid.uuid4()),
        'siswa_id': siswa['id'],
        **(await _siswa_fields(siswa)),
        'selected': sorted(set(req.selected)),
        'waktu_belajar_jam': req.waktu_belajar_jam,
        'waktu_belajar_dari': req.waktu_belajar_dari,
        'waktu_belajar_sampai': req.waktu_belajar_sampai,
        'perlu_info_cara_belajar': req.perlu_info_cara_belajar,
        'topik_diminati': req.topik_diminati,
        'topik_lainnya': req.topik_lainnya,
        'kebiasaan_diperbaiki': req.kebiasaan_diperbaiki,
        'scoring': scoring,
        'ai_summary': None,
        'tanggapan_bk': None,
        'rekomendasi_bk': None,
        'ditanggapi_oleh': None,
        'ditanggapi_pada': None,
        'submitted_at': datetime.utcnow().isoformat(),
    }

    await db.bk_clkb_submissions.insert_one(doc)
    await log_audit(user['id'], 'bk_clkb_submit', f"CLKB submission by {siswa.get('full_name')}")
    return serialize_doc(doc)


@router.get("/bk/clkb/my-history")
async def my_clkb_history(user: Dict = Depends(get_current_user)):
    """Student's own CLKB submission history."""
    if 'siswa' not in user.get('roles', []):
        raise HTTPException(403, "Hanya siswa yang dapat mengakses riwayat ini")
    items = await db.bk_clkb_submissions.find({'siswa_id': user['id']}, {'_id': 0}).sort('submitted_at', -1).to_list(200)
    return [serialize_doc(i) for i in items]


@router.get("/bk/clkb")
async def list_clkb_submissions(
    siswa_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: Dict = Depends(require_role(*BK_ROLES))
):
    """Admin/Guru BK: list all CLKB submissions."""
    query = {}
    if siswa_id:
        query['siswa_id'] = siswa_id
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query['$gte'] = start_date
        if end_date:
            date_query['$lte'] = end_date
        query['submitted_at'] = date_query

    items = await db.bk_clkb_submissions.find(query, {'_id': 0}).sort('submitted_at', -1).to_list(2000)
    return [serialize_doc(i) for i in items]


@router.get("/bk/clkb/{submission_id}")
async def get_clkb_submission(submission_id: str, user: Dict = Depends(get_current_user)):
    doc = await db.bk_clkb_submissions.find_one({'id': submission_id}, {'_id': 0})
    if not doc:
        raise HTTPException(404, "Data CLKB tidak ditemukan")
    is_owner = 'siswa' in user.get('roles', []) and doc.get('siswa_id') == user['id']
    is_staff = 'admin' in user.get('roles', []) or 'guru_bk' in user.get('roles', [])
    if not (is_owner or is_staff):
        raise HTTPException(403, "Tidak diizinkan melihat data ini")
    return serialize_doc(doc)


@router.post("/bk/clkb/{submission_id}/ai-summary")
async def generate_clkb_ai_summary(submission_id: str, user: Dict = Depends(require_role(*BK_ROLES))):
    """Generate (or regenerate) an AI-written summary of a CLKB submission — staff only."""
    doc = await db.bk_clkb_submissions.find_one({'id': submission_id})
    if not doc:
        raise HTTPException(404, "Data CLKB tidak ditemukan")

    settings = await get_settings()
    key_map = {item['no']: item for item in CLKB_ITEMS}
    selected_texts = [f"[{n}{key_map[n]['kunci']}] {key_map[n]['pernyataan']}" for n in doc.get('selected', []) if n in key_map]
    scoring = doc.get('scoring', {})

    prompt = (
        f"Siswa: {doc.get('siswa_nama')} kelas {doc.get('siswa_kelas')}.\n"
        f"Hasil Cek List Kebiasaan Belajar (CLKB): {scoring.get('total_selected')} dari {CLKB_TOTAL_ITEMS} pernyataan dipilih "
        f"({scoring.get('plus_count')} bersifat positif, {scoring.get('minus_count')} bersifat negatif; "
        f"{scoring.get('completion_percentage')}% keterisian).\n"
        f"Pernyataan yang dipilih siswa:\n" + "\n".join(selected_texts) + "\n\n"
        "Sebagai asisten guru BK, buat ringkasan singkat (3-5 kalimat) mengenai kondisi kebiasaan belajar siswa ini "
        "berdasarkan pola jawaban di atas, sebutkan kekuatan dan area yang perlu diperbaiki. Gunakan Bahasa Indonesia yang suportif dan tidak menghakimi."
    )

    try:
        summary = await generate_text(
            settings, prompt,
            system="Kamu adalah asisten analisa untuk guru Bimbingan Konseling (BK) di sekolah. Bantu merangkum data secara singkat, objektif, dan suportif."
        )
    except AIError as e:
        raise HTTPException(400, str(e))

    await db.bk_clkb_submissions.update_one({'id': submission_id}, {'$set': {'ai_summary': summary, 'ai_summary_at': datetime.utcnow().isoformat()}})
    await log_audit(user['id'], 'bk_clkb_ai_summary', f"Generated AI summary for CLKB {submission_id}")
    return {'ai_summary': summary}


@router.put("/bk/clkb/{submission_id}/respond")
async def respond_clkb(submission_id: str, req: BKResponseRequest, user: Dict = Depends(require_role(*BK_ROLES))):
    """Admin/Guru BK gives a manual response & recommendation to a student's CLKB submission."""
    existing = await db.bk_clkb_submissions.find_one({'id': submission_id})
    if not existing:
        raise HTTPException(404, "Data CLKB tidak ditemukan")

    update_data = {
        'tanggapan_bk': req.tanggapan,
        'rekomendasi_bk': req.rekomendasi,
        'ditanggapi_oleh': user.get('full_name', user.get('username')),
        'ditanggapi_pada': datetime.utcnow().isoformat(),
    }
    await db.bk_clkb_submissions.update_one({'id': submission_id}, {'$set': update_data})
    await log_audit(user['id'], 'bk_clkb_respond', f"Responded to CLKB {submission_id}")

    updated = await db.bk_clkb_submissions.find_one({'id': submission_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/bk/clkb/{submission_id}")
async def delete_clkb_submission(submission_id: str, user: Dict = Depends(require_role(*BK_ROLES))):
    existing = await db.bk_clkb_submissions.find_one({'id': submission_id})
    if not existing:
        raise HTTPException(404, "Data CLKB tidak ditemukan")
    await db.bk_clkb_submissions.delete_one({'id': submission_id})
    await log_audit(user['id'], 'bk_clkb_delete', f"Deleted CLKB submission: {submission_id}")
    return {'message': 'Data CLKB berhasil dihapus'}


# ============================================================
# PCL (PROBLEM CEK LIST) — FORM & SCHEDULE
# ============================================================

def _pcl_window_open(settings: Dict) -> bool:
    if not settings.get('pcl_open'):
        return False
    now = datetime.utcnow().isoformat()
    start = settings.get('pcl_open_start')
    end = settings.get('pcl_open_end')
    if start and now < start:
        return False
    if end and now > end:
        return False
    return True


@router.get("/bk/pcl/form")
async def get_pcl_form(user: Dict = Depends(get_current_user)):
    settings = await get_settings()
    return {
        'categories': PCL_CATEGORIES,
        'essay_questions': PCL_ESSAY_QUESTIONS,
        'petunjuk': PCL_PETUNJUK,
        'total_items': pcl_total_items(),
        'is_open': _pcl_window_open(settings),
        'info': settings.get('pcl_info'),
    }


def _score_pcl(selected: Dict[str, List[int]]) -> Dict:
    total_items = pcl_total_items()
    by_category = []
    total_selected = 0
    for cat in PCL_CATEGORIES:
        cat_items = cat['items']
        picked = selected.get(cat['kode'], []) or []
        valid_picked = sorted({i for i in picked if isinstance(i, int) and 0 <= i < len(cat_items)})
        count = len(valid_picked)
        total_selected += count
        by_category.append({
            'kode': cat['kode'],
            'nama': cat['nama'],
            'total_item': len(cat_items),
            'jumlah_dipilih': count,
            'persentase': round(count / len(cat_items) * 100, 1) if cat_items else 0,
            'item_dipilih': valid_picked,
        })
    return {
        'by_category': by_category,
        'total_item_keseluruhan': total_items,
        'total_dipilih': total_selected,
        'persentase_keseluruhan': round(total_selected / total_items * 100, 1) if total_items else 0,
    }


@router.post("/bk/pcl/submit")
async def submit_pcl(req: PCLSubmitRequest, user: Dict = Depends(get_current_user)):
    """Student submits a new PCL attempt."""
    if 'siswa' not in user.get('roles', []):
        raise HTTPException(403, "Hanya siswa yang dapat mengisi PCL")

    settings = await get_settings()
    if not _pcl_window_open(settings):
        raise HTTPException(400, "Pengisian PCL sedang ditutup oleh admin/sekolah")

    siswa = await _get_siswa_or_404(user['id'])
    scoring = _score_pcl(req.selected)

    doc = {
        'id': str(uuid.uuid4()),
        'siswa_id': siswa['id'],
        **(await _siswa_fields(siswa)),
        'selected': req.selected,
        'masalah_lain': req.masalah_lain,
        'masalah_saat_ini': req.masalah_saat_ini,
        'tempat_curhat': req.tempat_curhat,
        'scoring': scoring,
        'ai_summary': None,
        'tanggapan_bk': None,
        'rekomendasi_bk': None,
        'ditanggapi_oleh': None,
        'ditanggapi_pada': None,
        'submitted_at': datetime.utcnow().isoformat(),
    }

    await db.bk_pcl_submissions.insert_one(doc)
    await log_audit(user['id'], 'bk_pcl_submit', f"PCL submission by {siswa.get('full_name')}")
    return serialize_doc(doc)


@router.get("/bk/pcl/my-history")
async def my_pcl_history(user: Dict = Depends(get_current_user)):
    """Student's own PCL submission history."""
    if 'siswa' not in user.get('roles', []):
        raise HTTPException(403, "Hanya siswa yang dapat mengakses riwayat ini")
    items = await db.bk_pcl_submissions.find({'siswa_id': user['id']}, {'_id': 0}).sort('submitted_at', -1).to_list(200)
    return [serialize_doc(i) for i in items]


@router.get("/bk/pcl")
async def list_pcl_submissions(
    siswa_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: Dict = Depends(require_role(*BK_ROLES))
):
    """Admin/Guru BK: list all PCL submissions."""
    query = {}
    if siswa_id:
        query['siswa_id'] = siswa_id
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query['$gte'] = start_date
        if end_date:
            date_query['$lte'] = end_date
        query['submitted_at'] = date_query

    items = await db.bk_pcl_submissions.find(query, {'_id': 0}).sort('submitted_at', -1).to_list(2000)
    return [serialize_doc(i) for i in items]


@router.get("/bk/pcl/{submission_id}")
async def get_pcl_submission(submission_id: str, user: Dict = Depends(get_current_user)):
    doc = await db.bk_pcl_submissions.find_one({'id': submission_id}, {'_id': 0})
    if not doc:
        raise HTTPException(404, "Data PCL tidak ditemukan")
    is_owner = 'siswa' in user.get('roles', []) and doc.get('siswa_id') == user['id']
    is_staff = 'admin' in user.get('roles', []) or 'guru_bk' in user.get('roles', [])
    if not (is_owner or is_staff):
        raise HTTPException(403, "Tidak diizinkan melihat data ini")
    return serialize_doc(doc)


@router.post("/bk/pcl/{submission_id}/ai-summary")
async def generate_pcl_ai_summary(submission_id: str, user: Dict = Depends(require_role(*BK_ROLES))):
    """Generate (or regenerate) an AI-written summary of a PCL submission — staff only."""
    doc = await db.bk_pcl_submissions.find_one({'id': submission_id})
    if not doc:
        raise HTTPException(404, "Data PCL tidak ditemukan")

    settings = await get_settings()
    scoring = doc.get('scoring', {})
    category_lines = []
    item_lookup = {cat['kode']: cat for cat in PCL_CATEGORIES}
    for cat_score in scoring.get('by_category', []):
        if cat_score['jumlah_dipilih'] == 0:
            continue
        cat_def = item_lookup.get(cat_score['kode'])
        picked_texts = [cat_def['items'][i] for i in cat_score['item_dipilih']] if cat_def else []
        category_lines.append(
            f"- {cat_score['nama']}: {cat_score['jumlah_dipilih']}/{cat_score['total_item']} "
            f"({cat_score['persentase']}%) dipilih. Contoh: " + "; ".join(picked_texts[:5])
        )

    extra = []
    if doc.get('masalah_lain'):
        extra.append(f"Masalah lain yang disebutkan: {doc['masalah_lain']}")
    if doc.get('masalah_saat_ini'):
        extra.append(f"Masalah saat ini: {doc['masalah_saat_ini']}")
    if doc.get('tempat_curhat'):
        extra.append(f"Tempat curhat: {doc['tempat_curhat']}")

    prompt = (
        f"Siswa: {doc.get('siswa_nama')} kelas {doc.get('siswa_kelas')}.\n"
        f"Hasil Problem Check List (PCL): total {scoring.get('total_dipilih')} dari {scoring.get('total_item_keseluruhan')} "
        f"item masalah dipilih ({scoring.get('persentase_keseluruhan')}% keseluruhan).\n"
        "Rincian per kategori masalah (hanya yang ada pilihan):\n" + "\n".join(category_lines) + "\n\n"
        + ("\n".join(extra) + "\n\n" if extra else "")
        + "Sebagai asisten guru BK, buat ringkasan singkat (4-6 kalimat) mengenai kondisi dan area masalah utama siswa ini "
        "berdasarkan data di atas, urutkan kategori paling menonjol, dan beri catatan area yang perlu diprioritaskan guru BK. "
        "Gunakan Bahasa Indonesia yang suportif, tidak menghakimi, dan menjaga kerahasiaan/martabat siswa."
    )

    try:
        summary = await generate_text(
            settings, prompt,
            system="Kamu adalah asisten analisa untuk guru Bimbingan Konseling (BK) di sekolah. Bantu merangkum data secara singkat, objektif, dan suportif."
        )
    except AIError as e:
        raise HTTPException(400, str(e))

    await db.bk_pcl_submissions.update_one({'id': submission_id}, {'$set': {'ai_summary': summary, 'ai_summary_at': datetime.utcnow().isoformat()}})
    await log_audit(user['id'], 'bk_pcl_ai_summary', f"Generated AI summary for PCL {submission_id}")
    return {'ai_summary': summary}


@router.put("/bk/pcl/{submission_id}/respond")
async def respond_pcl(submission_id: str, req: BKResponseRequest, user: Dict = Depends(require_role(*BK_ROLES))):
    """Admin/Guru BK gives a manual response & recommendation to a student's PCL submission."""
    existing = await db.bk_pcl_submissions.find_one({'id': submission_id})
    if not existing:
        raise HTTPException(404, "Data PCL tidak ditemukan")

    update_data = {
        'tanggapan_bk': req.tanggapan,
        'rekomendasi_bk': req.rekomendasi,
        'ditanggapi_oleh': user.get('full_name', user.get('username')),
        'ditanggapi_pada': datetime.utcnow().isoformat(),
    }
    await db.bk_pcl_submissions.update_one({'id': submission_id}, {'$set': update_data})
    await log_audit(user['id'], 'bk_pcl_respond', f"Responded to PCL {submission_id}")

    updated = await db.bk_pcl_submissions.find_one({'id': submission_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/bk/pcl/{submission_id}")
async def delete_pcl_submission(submission_id: str, user: Dict = Depends(require_role(*BK_ROLES))):
    existing = await db.bk_pcl_submissions.find_one({'id': submission_id})
    if not existing:
        raise HTTPException(404, "Data PCL tidak ditemukan")
    await db.bk_pcl_submissions.delete_one({'id': submission_id})
    await log_audit(user['id'], 'bk_pcl_delete', f"Deleted PCL submission: {submission_id}")
    return {'message': 'Data PCL berhasil dihapus'}


# ============================================================
# JURNAL HOME VISIT ENDPOINTS
# ============================================================

@router.get("/bk/home-visit")
async def list_home_visit(
    siswa_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    tahun_pelajaran_id: Optional[str] = None,
    semester: Optional[str] = None,
    user: Dict = Depends(get_current_user)
):
    query = {}
    if siswa_id:
        query['siswa_id'] = siswa_id
    if tahun_pelajaran_id:
        query['tahun_pelajaran_id'] = tahun_pelajaran_id
    if semester:
        query['semester'] = semester
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query['$gte'] = start_date
        if end_date:
            date_query['$lte'] = end_date
        query['tanggal'] = date_query

    items = await db.bk_home_visit.find(query, {'_id': 0}).sort('tanggal', -1).to_list(2000)
    return [serialize_doc(i) for i in items]


@router.post("/bk/home-visit")
async def create_home_visit(req: JurnalHomeVisitRequest, user: Dict = Depends(require_role(*BK_ROLES))):
    siswa = await _get_siswa_or_404(req.siswa_id)

    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        **(await _siswa_fields(siswa)),
        'petugas_id': user['id'],
        'petugas_nama': user.get('full_name', user.get('username')),
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }

    await db.bk_home_visit.insert_one(doc)
    await log_audit(user['id'], 'bk_home_visit_create', f"Recorded home visit for {siswa.get('full_name')}")
    return serialize_doc(doc)


@router.put("/bk/home-visit/{hv_id}")
async def update_home_visit(hv_id: str, req: JurnalHomeVisitRequest, user: Dict = Depends(require_role(*BK_ROLES))):
    existing = await db.bk_home_visit.find_one({'id': hv_id})
    if not existing:
        raise HTTPException(404, "Data home visit tidak ditemukan")

    update_data = req.model_dump()
    if req.siswa_id != existing.get('siswa_id'):
        siswa = await _get_siswa_or_404(req.siswa_id)
        update_data.update(await _siswa_fields(siswa))
    update_data['updated_at'] = datetime.utcnow().isoformat()

    await db.bk_home_visit.update_one({'id': hv_id}, {'$set': update_data})
    await log_audit(user['id'], 'bk_home_visit_update', f"Updated home visit: {hv_id}")

    updated = await db.bk_home_visit.find_one({'id': hv_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/bk/home-visit/{hv_id}")
async def delete_home_visit(hv_id: str, user: Dict = Depends(require_role(*BK_ROLES))):
    existing = await db.bk_home_visit.find_one({'id': hv_id})
    if not existing:
        raise HTTPException(404, "Data home visit tidak ditemukan")

    await db.bk_home_visit.delete_one({'id': hv_id})
    await log_audit(user['id'], 'bk_home_visit_delete', f"Deleted home visit: {hv_id}")
    return {'message': 'Data home visit berhasil dihapus'}


# ============================================================
# DATA SEKOLAH LANJUTAN ENDPOINTS
# ============================================================

@router.get("/bk/sekolah-lanjutan")
async def list_sekolah_lanjutan(
    siswa_id: Optional[str] = None,
    status: Optional[str] = None,
    jenjang_tujuan: Optional[str] = None,
    user: Dict = Depends(get_current_user)
):
    query = {}
    if siswa_id:
        query['siswa_id'] = siswa_id
    if status:
        query['status'] = status
    if jenjang_tujuan:
        query['jenjang_tujuan'] = jenjang_tujuan

    items = await db.bk_sekolah_lanjutan.find(query, {'_id': 0}).sort('created_at', -1).to_list(2000)
    return [serialize_doc(i) for i in items]


@router.post("/bk/sekolah-lanjutan")
async def create_sekolah_lanjutan(req: SekolahLanjutanRequest, user: Dict = Depends(require_role(*BK_ROLES))):
    siswa = await _get_siswa_or_404(req.siswa_id)

    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        **(await _siswa_fields(siswa)),
        'petugas_id': user['id'],
        'petugas_nama': user.get('full_name', user.get('username')),
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }

    await db.bk_sekolah_lanjutan.insert_one(doc)
    await log_audit(user['id'], 'bk_sekolah_lanjutan_create', f"Recorded sekolah lanjutan for {siswa.get('full_name')}")
    return serialize_doc(doc)


@router.put("/bk/sekolah-lanjutan/{item_id}")
async def update_sekolah_lanjutan(item_id: str, req: SekolahLanjutanRequest, user: Dict = Depends(require_role(*BK_ROLES))):
    existing = await db.bk_sekolah_lanjutan.find_one({'id': item_id})
    if not existing:
        raise HTTPException(404, "Data tidak ditemukan")

    update_data = req.model_dump()
    if req.siswa_id != existing.get('siswa_id'):
        siswa = await _get_siswa_or_404(req.siswa_id)
        update_data.update(await _siswa_fields(siswa))
    update_data['updated_at'] = datetime.utcnow().isoformat()

    await db.bk_sekolah_lanjutan.update_one({'id': item_id}, {'$set': update_data})
    await log_audit(user['id'], 'bk_sekolah_lanjutan_update', f"Updated sekolah lanjutan: {item_id}")

    updated = await db.bk_sekolah_lanjutan.find_one({'id': item_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/bk/sekolah-lanjutan/{item_id}")
async def delete_sekolah_lanjutan(item_id: str, user: Dict = Depends(require_role(*BK_ROLES))):
    existing = await db.bk_sekolah_lanjutan.find_one({'id': item_id})
    if not existing:
        raise HTTPException(404, "Data tidak ditemukan")

    await db.bk_sekolah_lanjutan.delete_one({'id': item_id})
    await log_audit(user['id'], 'bk_sekolah_lanjutan_delete', f"Deleted sekolah lanjutan: {item_id}")
    return {'message': 'Data berhasil dihapus'}


# ============================================================
# LAPORAN BK (SUMMARY STATISTICS)
# ============================================================

@router.get("/bk/laporan/summary")
async def get_laporan_summary(
    tahun_pelajaran_id: Optional[str] = None,
    semester: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: Dict = Depends(require_role(*BK_ROLES))
):
    """Aggregate BK activity counts across kunjungan, CLKB, PCL, and home visit."""
    base_query = {}
    if tahun_pelajaran_id:
        base_query['tahun_pelajaran_id'] = tahun_pelajaran_id
    if semester:
        base_query['semester'] = semester

    date_query = {}
    if start_date:
        date_query['$gte'] = start_date
    if end_date:
        date_query['$lte'] = end_date

    def with_date(q):
        merged = dict(q)
        if date_query:
            merged['tanggal'] = date_query
        return merged

    kunjungan = await db.bk_kunjungan.find(with_date(base_query), {'_id': 0}).to_list(10000)
    home_visit = await db.bk_home_visit.find(with_date(base_query), {'_id': 0}).to_list(10000)

    clkb_date_query = {'submitted_at': date_query} if date_query else {}
    pcl_date_query = {'submitted_at': date_query} if date_query else {}
    clkb = await db.bk_clkb_submissions.find(clkb_date_query, {'_id': 0}).to_list(10000)
    pcl = await db.bk_pcl_submissions.find(pcl_date_query, {'_id': 0}).to_list(10000)

    def by_field(records, field):
        counts = {}
        for r in records:
            key = r.get(field) or 'Lainnya'
            counts[key] = counts.get(key, 0) + 1
        return counts

    settings = await get_settings()
    clkb_belum_ditanggapi = sum(1 for r in clkb if not r.get('tanggapan_bk'))
    pcl_belum_ditanggapi = sum(1 for r in pcl if not r.get('tanggapan_bk'))

    return {
        'total_kunjungan': len(kunjungan),
        'kunjungan_by_jenis': by_field(kunjungan, 'jenis_layanan'),
        'total_clkb': len(clkb),
        'clkb_belum_ditanggapi': clkb_belum_ditanggapi,
        'clkb_schedule_open': _clkb_window_open(settings),
        'total_pcl': len(pcl),
        'pcl_belum_ditanggapi': pcl_belum_ditanggapi,
        'pcl_schedule_open': _pcl_window_open(settings),
        'total_home_visit': len(home_visit),
    }
