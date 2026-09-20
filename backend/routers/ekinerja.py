"""E-Kinerja GTK: RHK (Rencana Hasil Kerja) module.

RHK is authored by admin/kepala_sekolah/kepala_tata_usaha, tagged with a
"leading sektor" for filtering, and left open for any guru/tenaga_kependidikan
to claim. Once claimed, the RHK is attributed to that person; the author roles
can lock a claimed RHK to prevent it being claimed by anyone else (a claimed
RHK is otherwise still just informational — locking is an explicit extra step).
"""
from datetime import datetime
from typing import Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import io

from core import db, get_current_user, log_audit, require_role, serialize_doc
from excel_io import rhk_template, rhk_filled_template, parse_rhk_rows
from journal_core import now_wib

router = APIRouter()

EKINERJA_AUTHOR_ROLES = ('admin', 'kepala_sekolah', 'kepala_tata_usaha')

LEADING_SEKTOR_LIST = [
    'Kepala Tata Usaha',
    'Tim Penjamin Mutu',
    'Waka Humas',
    'Waka Sarpras',
    'Waka Kesiswaan',
    'Waka Kurikulum',
]

PERILAKU_KERJA_LIST = [
    'Orientasi Pelayanan',
    'Komitmen',
    'Inisiatif Kerja',
    'Kerjasama',
    'Kepemimpinan',
]

BULAN_LIST = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
              'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']


class RHKRequest(BaseModel):
    year: int
    rhk_atasan: str  # rencana hasil kerja atasan yang menjadi acuan/turunan
    leading_sektor: str
    aspek: Optional[str] = None
    indikator_kinerja_individu: str
    target: Optional[str] = None
    target_kuantitas: Optional[str] = None
    target_kualitas: Optional[str] = None
    target_waktu: Optional[str] = None
    target_biaya: Optional[str] = None
    perilaku_kerja: List[str] = []
    bulan_berlaku: List[str] = []  # bulan-bulan di mana uraian tugas/rencana aksi ini relevan
    output_url: Optional[str] = None  # tautan dokumen/data bukti capaian (mis. Google Drive)
    satuan_hasil: Optional[str] = None  # mis. "Dokumen dan Laporan" — satuan volume tetap untuk LCKB


def _require_ekinerja_author():
    return require_role(*EKINERJA_AUTHOR_ROLES)


def _is_ekinerja_author(user: Dict) -> bool:
    """Checks the user's currently ACTIVE role, not just role membership —
    a multi-role account (e.g. guru + kepala_sekolah) must not get author
    privileges while acting as guru. Mirrors require_role()'s own logic."""
    return user.get('active_role') in EKINERJA_AUTHOR_ROLES or 'admin' in user.get('roles', [])


@router.get("/ekinerja/rhk")
async def list_rhk(
    year: Optional[int] = None,
    leading_sektor: Optional[str] = None,
    claimed: Optional[bool] = None,
    user: Dict = Depends(get_current_user),
):
    """List RHK. Any authenticated GTK can browse (to find one to claim);
    admin/kepsek/KTU see the same list enriched for oversight."""
    query = {}
    if year:
        query['year'] = year
    if leading_sektor:
        query['leading_sektor'] = leading_sektor
    if claimed is not None:
        query['claimed_by'] = {'$ne': None} if claimed else None

    items = await db.ekinerja_rhk.find(query, {'_id': 0}).sort('created_at', -1).to_list(2000)
    return [serialize_doc(i) for i in items]


@router.get("/ekinerja/rhk/meta")
async def get_rhk_meta(user: Dict = Depends(get_current_user)):
    """Static option lists for the RHK form (leading sektor, perilaku kerja, bulan)."""
    return {
        'leading_sektor': LEADING_SEKTOR_LIST,
        'perilaku_kerja': PERILAKU_KERJA_LIST,
        'bulan': BULAN_LIST,
    }


@router.get("/ekinerja/rhk/template")
async def download_rhk_template(user: Dict = Depends(_require_ekinerja_author())):
    """Template Excel kosong untuk menambahkan RHK baru secara massal."""
    content = rhk_template()
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=Template_RHK_Kosong.xlsx"},
    )


@router.get("/ekinerja/rhk/template-filled")
async def download_rhk_filled_template(year: Optional[int] = None, user: Dict = Depends(_require_ekinerja_author())):
    """Template Excel berisi data RHK tahun aktif yang sudah ada, untuk diedit
    massal dan diupload kembali."""
    query = {'year': year} if year else {}
    items = await db.ekinerja_rhk.find(query, {'_id': 0}).sort('leading_sektor', 1).to_list(2000)
    content = rhk_filled_template(items)
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=Template_RHK_Data.xlsx"},
    )


@router.post("/ekinerja/rhk/import-excel")
async def import_rhk_excel(file: UploadFile = File(...), user: Dict = Depends(_require_ekinerja_author())):
    """Import massal RHK dari file Excel (template kosong atau template berisi
    data yang sudah diedit). Baris tanpa 'id' dibuat baru; baris dengan 'id'
    yang cocok dengan RHK yang sudah ada akan diupdate (kecuali sudah dikunci)."""
    content = await file.read()
    try:
        rows = parse_rhk_rows(content)
    except Exception:
        raise HTTPException(400, "File Excel tidak valid atau format tidak sesuai template")

    if not rows:
        raise HTTPException(400, "Tidak ada baris valid ditemukan pada file. Pastikan kolom wajib (year, leading_sektor, rhk_atasan, indikator_kinerja_individu) terisi.")

    created, updated, skipped = 0, 0, 0
    now = datetime.utcnow().isoformat()

    for r in rows:
        if r['leading_sektor'] not in LEADING_SEKTOR_LIST:
            skipped += 1
            continue

        row_id = r.pop('id')
        r.pop('_row')

        if row_id:
            existing = await db.ekinerja_rhk.find_one({'id': row_id})
            if not existing:
                skipped += 1
                continue
            if existing.get('is_locked'):
                skipped += 1
                continue
            update_data = {**r, 'updated_at': now}
            await db.ekinerja_rhk.update_one({'id': row_id}, {'$set': update_data})
            updated += 1
        else:
            doc = {
                'id': str(uuid.uuid4()),
                **r,
                'claimed_by': None,
                'claimed_by_name': None,
                'claimed_at': None,
                'is_locked': False,
                'created_by': user['id'],
                'created_by_name': user.get('full_name', user.get('username')),
                'created_at': now,
                'updated_at': now,
            }
            await db.ekinerja_rhk.insert_one(doc)
            created += 1

    await log_audit(user, 'ekinerja_rhk_import', f"Import Excel RHK: {created} baru, {updated} diperbarui, {skipped} dilewati")
    return {'created': created, 'updated': updated, 'skipped': skipped}


@router.post("/ekinerja/rhk")
async def create_rhk(req: RHKRequest, user: Dict = Depends(_require_ekinerja_author())):
    if req.leading_sektor not in LEADING_SEKTOR_LIST:
        raise HTTPException(400, "Leading sektor tidak valid")
    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        'claimed_by': None,
        'claimed_by_name': None,
        'claimed_at': None,
        'is_locked': False,
        'created_by': user['id'],
        'created_by_name': user.get('full_name', user.get('username')),
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }
    await db.ekinerja_rhk.insert_one(doc)
    await log_audit(user, 'ekinerja_rhk_create', f"Created RHK: {req.indikator_kinerja_individu}")
    return serialize_doc(doc)


@router.put("/ekinerja/rhk/{rhk_id}")
async def update_rhk(rhk_id: str, req: RHKRequest, user: Dict = Depends(_require_ekinerja_author())):
    existing = await db.ekinerja_rhk.find_one({'id': rhk_id})
    if not existing:
        raise HTTPException(404, "RHK tidak ditemukan")
    if req.leading_sektor not in LEADING_SEKTOR_LIST:
        raise HTTPException(400, "Leading sektor tidak valid")

    update_data = req.model_dump()
    update_data['updated_at'] = datetime.utcnow().isoformat()
    await db.ekinerja_rhk.update_one({'id': rhk_id}, {'$set': update_data})
    await log_audit(user, 'ekinerja_rhk_update', f"Updated RHK: {rhk_id}")

    updated = await db.ekinerja_rhk.find_one({'id': rhk_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/ekinerja/rhk/{rhk_id}")
async def delete_rhk(rhk_id: str, user: Dict = Depends(_require_ekinerja_author())):
    existing = await db.ekinerja_rhk.find_one({'id': rhk_id})
    if not existing:
        raise HTTPException(404, "RHK tidak ditemukan")
    if existing.get('claimed_by'):
        raise HTTPException(400, "RHK sudah diambil oleh GTK dan tidak dapat dihapus. Kunci RHK ini jika ingin menghentikan pengambilan baru.")

    await db.ekinerja_rhk.delete_one({'id': rhk_id})
    await log_audit(user, 'ekinerja_rhk_delete', f"Deleted RHK: {rhk_id}")
    return {'message': 'RHK berhasil dihapus'}


@router.put("/ekinerja/rhk/{rhk_id}/lock")
async def lock_rhk(rhk_id: str, user: Dict = Depends(_require_ekinerja_author())):
    """Lock a claimed RHK so it can no longer be claimed by anyone else.
    Locking does not require the RHK to already be claimed — an author may
    also pre-lock an RHK they don't want claimed at all."""
    existing = await db.ekinerja_rhk.find_one({'id': rhk_id})
    if not existing:
        raise HTTPException(404, "RHK tidak ditemukan")

    await db.ekinerja_rhk.update_one({'id': rhk_id}, {'$set': {'is_locked': True, 'updated_at': datetime.utcnow().isoformat()}})
    await log_audit(user, 'ekinerja_rhk_lock', f"Locked RHK: {rhk_id}")
    updated = await db.ekinerja_rhk.find_one({'id': rhk_id}, {'_id': 0})
    return serialize_doc(updated)


@router.put("/ekinerja/rhk/{rhk_id}/unlock")
async def unlock_rhk(rhk_id: str, user: Dict = Depends(_require_ekinerja_author())):
    existing = await db.ekinerja_rhk.find_one({'id': rhk_id})
    if not existing:
        raise HTTPException(404, "RHK tidak ditemukan")

    await db.ekinerja_rhk.update_one({'id': rhk_id}, {'$set': {'is_locked': False, 'updated_at': datetime.utcnow().isoformat()}})
    await log_audit(user, 'ekinerja_rhk_unlock', f"Unlocked RHK: {rhk_id}")
    updated = await db.ekinerja_rhk.find_one({'id': rhk_id}, {'_id': 0})
    return serialize_doc(updated)


@router.put("/ekinerja/rhk/{rhk_id}/claim")
async def claim_rhk(rhk_id: str, user: Dict = Depends(get_current_user)):
    """Guru/tenaga kependidikan claims an open RHK for themselves."""
    if not any(r in user.get('roles', []) for r in ('guru', 'wali_kelas', 'guru_piket', 'guru_bk', 'guru_tata_tertib',
                                                       'guru_ekstrakurikuler', 'guru_ipa', 'guru_ips', 'guru_bahasa',
                                                       'guru_seni', 'guru_agama', 'guru_tik', 'tenaga_kependidikan')):
        raise HTTPException(403, "Hanya guru dan tenaga kependidikan yang dapat mengambil RHK")

    existing = await db.ekinerja_rhk.find_one({'id': rhk_id})
    if not existing:
        raise HTTPException(404, "RHK tidak ditemukan")
    if existing.get('is_locked'):
        raise HTTPException(400, "RHK ini sudah dikunci dan tidak dapat diambil")
    if existing.get('claimed_by') and existing.get('claimed_by') != user['id']:
        raise HTTPException(400, "RHK ini sudah diambil oleh GTK lain")

    await db.ekinerja_rhk.update_one({'id': rhk_id}, {'$set': {
        'claimed_by': user['id'],
        'claimed_by_name': user.get('full_name', user.get('username')),
        'claimed_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }})
    await log_audit(user, 'ekinerja_rhk_claim', f"Claimed RHK: {rhk_id}")
    updated = await db.ekinerja_rhk.find_one({'id': rhk_id}, {'_id': 0})
    return serialize_doc(updated)


@router.put("/ekinerja/rhk/{rhk_id}/unclaim")
async def unclaim_rhk(rhk_id: str, user: Dict = Depends(get_current_user)):
    """A GTK releases an RHK they previously claimed (self-service); admin/
    kepsek/KTU may also release it on someone's behalf."""
    existing = await db.ekinerja_rhk.find_one({'id': rhk_id})
    if not existing:
        raise HTTPException(404, "RHK tidak ditemukan")

    if not _is_ekinerja_author(user) and existing.get('claimed_by') != user['id']:
        raise HTTPException(403, "Anda hanya dapat melepas RHK yang Anda ambil sendiri")

    await db.ekinerja_rhk.update_one({'id': rhk_id}, {'$set': {
        'claimed_by': None,
        'claimed_by_name': None,
        'claimed_at': None,
        'updated_at': datetime.utcnow().isoformat(),
    }})
    await log_audit(user, 'ekinerja_rhk_unclaim', f"Unclaimed RHK: {rhk_id}")
    updated = await db.ekinerja_rhk.find_one({'id': rhk_id}, {'_id': 0})
    return serialize_doc(updated)


@router.get("/ekinerja/rhk/my")
async def my_rhk(user: Dict = Depends(get_current_user)):
    """RHK claimed by the current user — feeds LCKB's auto-populated content."""
    items = await db.ekinerja_rhk.find({'claimed_by': user['id']}, {'_id': 0}).sort('year', -1).to_list(500)
    return [serialize_doc(i) for i in items]


# ============================================================
# LCKB (LAPORAN CAPAIAN KINERJA BULANAN)
#
# LCKB is not authored directly: its line items come from each GTK's claimed
# RHK (ekinerja_rhk with claimed_by = that GTK), one line per RHK whose
# bulan_berlaku includes the requested month. Each RHK already carries a
# fixed satuan_hasil (e.g. "Dokumen dan Laporan") and output_url (bukti
# dukung), so the GTK only fills in the actual realisasi_volume (angka
# realisasi bulan itu, mis. 0 atau 1) via ekinerja_lckb_realisasi, keyed by
# (rhk_id, gtk_id, year, month) — the RHK content itself (indikator, target,
# satuan_hasil, output_url) is always read live from ekinerja_rhk, never
# copied, so an RHK edit is reflected instantly. Format ini mengikuti
# dokumen resmi LCKB madrasah: NO, URAIAN TUGAS/PROGRAM, VOLUME (realisasi),
# VOLUME (satuan), BUKTI DUKUNG.
# ============================================================

class LCKBRealisasiRequest(BaseModel):
    rhk_id: str
    year: int
    month: str  # e.g. 'Januari'
    realisasi_volume: Optional[str] = None
    keterangan: Optional[str] = None


async def _build_lckb_rows(gtk_id: str, year: int, month: Optional[str] = None):
    """Assemble LCKB line items for one GTK: claimed RHK for `year` whose
    bulan_berlaku includes `month` (or all months if month is None), merged
    with any saved realisasi for that RHK/year/month."""
    rhk_query = {'claimed_by': gtk_id, 'year': year}
    if month:
        rhk_query['bulan_berlaku'] = month
    rhk_items = await db.ekinerja_rhk.find(rhk_query, {'_id': 0}).to_list(1000)

    realisasi_query = {'gtk_id': gtk_id, 'year': year}
    if month:
        realisasi_query['month'] = month
    realisasi_items = await db.ekinerja_lckb_realisasi.find(realisasi_query, {'_id': 0}).to_list(2000)
    realisasi_by_key = {(r['rhk_id'], r['month']): r for r in realisasi_items}

    rows = []
    for rhk in rhk_items:
        months = rhk.get('bulan_berlaku') or []
        target_months = [month] if month else months
        for m in target_months:
            if m not in months:
                continue
            realisasi = realisasi_by_key.get((rhk['id'], m))
            rows.append({
                'rhk_id': rhk['id'],
                'year': year,
                'month': m,
                'leading_sektor': rhk.get('leading_sektor'),
                'rhk_atasan': rhk.get('rhk_atasan'),
                'indikator_kinerja_individu': rhk.get('indikator_kinerja_individu'),
                'target': rhk.get('target'),
                'satuan_hasil': rhk.get('satuan_hasil'),
                'perilaku_kerja': rhk.get('perilaku_kerja') or [],
                'output_url': rhk.get('output_url'),
                'realisasi_volume': realisasi.get('realisasi_volume') if realisasi else None,
                'keterangan': realisasi.get('keterangan') if realisasi else None,
                'realisasi_updated_at': realisasi.get('updated_at') if realisasi else None,
            })
    return rows


@router.get("/ekinerja/lckb/my")
async def my_lckb(year: int, month: Optional[str] = None, user: Dict = Depends(get_current_user)):
    """Current user's own LCKB — auto-populated from their claimed RHK."""
    rows = await _build_lckb_rows(user['id'], year, month)
    return rows


@router.put("/ekinerja/lckb/realisasi")
async def save_lckb_realisasi(req: LCKBRealisasiRequest, user: Dict = Depends(get_current_user)):
    """GTK fills in their actual realization for one RHK line item in one month."""
    if req.month not in BULAN_LIST:
        raise HTTPException(400, "Bulan tidak valid")

    rhk = await db.ekinerja_rhk.find_one({'id': req.rhk_id})
    if not rhk:
        raise HTTPException(404, "RHK tidak ditemukan")
    if rhk.get('claimed_by') != user['id']:
        raise HTTPException(403, "Anda hanya dapat mengisi realisasi RHK yang Anda ambil sendiri")
    if req.month not in (rhk.get('bulan_berlaku') or []):
        raise HTTPException(400, "RHK ini tidak berlaku pada bulan tersebut")

    now = datetime.utcnow().isoformat()
    key = {'rhk_id': req.rhk_id, 'gtk_id': user['id'], 'year': req.year, 'month': req.month}
    update_data = {
        'realisasi_volume': req.realisasi_volume,
        'keterangan': req.keterangan,
        'updated_at': now,
    }
    existing = await db.ekinerja_lckb_realisasi.find_one(key)
    if existing:
        await db.ekinerja_lckb_realisasi.update_one(key, {'$set': update_data})
    else:
        await db.ekinerja_lckb_realisasi.insert_one({
            'id': str(uuid.uuid4()), **key, **update_data, 'created_at': now,
        })
    await log_audit(user, 'ekinerja_lckb_realisasi_save', f"Saved LCKB realisasi: RHK {req.rhk_id} - {req.month} {req.year}")

    rows = await _build_lckb_rows(user['id'], req.year, req.month)
    return next((r for r in rows if r['rhk_id'] == req.rhk_id), {})


@router.get("/ekinerja/lckb")
async def list_lckb(
    year: int,
    month: Optional[str] = None,
    gtk_id: Optional[str] = None,
    user: Dict = Depends(_require_ekinerja_author()),
):
    """Admin/kepsek/KTU oversight view: LCKB for one GTK, or a summary across
    all GTK with any claimed RHK for the given year/month."""
    if gtk_id:
        rows = await _build_lckb_rows(gtk_id, year, month)
        return rows

    rhk_query = {'year': year, 'claimed_by': {'$ne': None}}
    if month:
        rhk_query['bulan_berlaku'] = month
    claimed_gtk_ids = await db.ekinerja_rhk.distinct('claimed_by', rhk_query)

    gtk_users = await db.users.find({'id': {'$in': claimed_gtk_ids}}, {'_id': 0, 'id': 1, 'full_name': 1, 'username': 1}).to_list(1000)
    gtk_by_id = {g['id']: g for g in gtk_users}

    summary = []
    for gid in claimed_gtk_ids:
        rows = await _build_lckb_rows(gid, year, month)
        filled = sum(1 for r in rows if r.get('realisasi_volume') or r.get('keterangan'))
        summary.append({
            'gtk_id': gid,
            'gtk_name': gtk_by_id.get(gid, {}).get('full_name') or gtk_by_id.get(gid, {}).get('username') or gid,
            'total_rhk': len(rows),
            'total_filled': filled,
        })
    summary.sort(key=lambda x: x['gtk_name'])
    return summary


@router.get("/ekinerja/lckb/pdf")
async def download_lckb_pdf(
    year: int,
    month: str,
    gtk_id: Optional[str] = None,
    user: Dict = Depends(get_current_user),
):
    """Cetak PDF LCKB resmi untuk satu GTK/bulan/tahun, mengikuti format
    dokumen madrasah: header identitas, tabel NO/URAIAN TUGAS/VOLUME/
    VOLUME(satuan)/BUKTI DUKUNG, dan blok tanda tangan Kepala TU + GTK.
    GTK hanya boleh mencetak miliknya sendiri; admin/kepsek/KTU bebas."""
    if month not in BULAN_LIST:
        raise HTTPException(400, "Bulan tidak valid")

    target_gtk_id = gtk_id or user['id']
    if not _is_ekinerja_author(user) and target_gtk_id != user['id']:
        raise HTTPException(403, "Anda hanya dapat mencetak LCKB milik Anda sendiri")

    gtk_user = await db.users.find_one({'id': target_gtk_id}, {'_id': 0})
    if not gtk_user:
        raise HTTPException(404, "GTK tidak ditemukan")

    rows = await _build_lckb_rows(target_gtk_id, year, month)

    jabatan_names = []
    if gtk_user.get('jabatan_ids'):
        jabatan_docs = await db.jabatan.find({'id': {'$in': gtk_user['jabatan_ids']}}, {'_id': 0, 'name': 1}).to_list(20)
        jabatan_names = [j['name'] for j in jabatan_docs]

    ktu_user = await db.users.find_one({'roles': 'kepala_tata_usaha'}, {'_id': 0, 'full_name': 1, 'nip_nuptk': 1})

    from lckb_export import export_lckb_pdf
    content = export_lckb_pdf(
        gtk_name=gtk_user.get('full_name', '-'),
        gtk_nip=gtk_user.get('nip_nuptk') or '-',
        pangkat_golongan=gtk_user.get('pangkat_golongan') or '-',
        jabatan=', '.join(jabatan_names) if jabatan_names else '-',
        month=month,
        year=year,
        rows=rows,
        ktu_name=(ktu_user or {}).get('full_name') or '-',
        ktu_nip=(ktu_user or {}).get('nip_nuptk') or '-',
    )
    filename = f"LCKB_{(gtk_user.get('nip_nuptk') or gtk_user.get('full_name', 'GTK')).replace(' ', '_')}_{month}_{year}.pdf"
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ============================================================
# PENGUMPULAN DOKUMEN (link eksternal + tracking upload)
#
# Pola generik dipakai untuk SKP dan Angka Kredit/PAK (triwulanan atau
# tahunan), LCKB dan Absensi (bulanan): admin/kepsek/KTU memasang satu link
# upload eksternal (mis. Google Form/Drive) per (type, year, period), lalu
# setiap GTK meng-upload berkas ke link tersebut secara manual dan menandai
# "Sudah Upload" di aplikasi untuk pendataan — sistem tidak menyimpan file
# itu sendiri.
# ============================================================

PENGUMPULAN_TYPES = ('skp', 'lckb', 'absensi', 'angka_kredit', 'pak', 'profesionalitas_gtk', 'sertifikasi')
PENGUMPULAN_MONTHLY_TYPES = ('lckb', 'absensi')
PENGUMPULAN_QUARTERLY_TYPES = ('skp', 'angka_kredit', 'pak', 'profesionalitas_gtk', 'sertifikasi')
QUARTERLY_PERIODS = ['TW1', 'TW2', 'TW3', 'TW4', 'TAHUNAN']
QUARTERLY_PERIOD_LABELS = {
    'TW1': 'Triwulan 1 (Jan-Mar)', 'TW2': 'Triwulan 2 (Apr-Jun)',
    'TW3': 'Triwulan 3 (Jul-Sep)', 'TW4': 'Triwulan 4 (Okt-Des)',
    'TAHUNAN': 'Tahunan',
}


class PengumpulanLinkRequest(BaseModel):
    type: str  # 'skp' | 'lckb' | 'absensi' | 'angka_kredit' | 'pak' | 'profesionalitas_gtk' | 'sertifikasi'
    year: int
    period: str  # mis. 'TW1'/'TAHUNAN' untuk skp/angka_kredit/pak/profesionalitas_gtk/sertifikasi, 'Januari' untuk lckb/absensi
    link_url: str


def _validate_pengumpulan_type_period(type_: str, period: str):
    if type_ not in PENGUMPULAN_TYPES:
        raise HTTPException(400, "Tipe pengumpulan tidak valid")
    if type_ in PENGUMPULAN_QUARTERLY_TYPES and period not in QUARTERLY_PERIODS:
        raise HTTPException(400, "Periode tidak valid")
    if type_ in PENGUMPULAN_MONTHLY_TYPES and period not in BULAN_LIST:
        raise HTTPException(400, "Periode bulan tidak valid")


@router.get("/ekinerja/pengumpulan/meta")
async def get_pengumpulan_meta(user: Dict = Depends(get_current_user)):
    quarterly = [{'value': p, 'label': QUARTERLY_PERIOD_LABELS[p]} for p in QUARTERLY_PERIODS]
    return {
        'skp_periods': quarterly,  # SKP kini juga mendukung periode 'TAHUNAN', sama seperti Angka Kredit/PAK
        'quarterly_periods': quarterly,
        'bulan': BULAN_LIST,
    }


@router.put("/ekinerja/pengumpulan/link")
async def set_pengumpulan_link(req: PengumpulanLinkRequest, user: Dict = Depends(_require_ekinerja_author())):
    """Admin/kepsek/KTU memasang atau memperbarui link upload untuk satu periode."""
    _validate_pengumpulan_type_period(req.type, req.period)
    now = datetime.utcnow().isoformat()
    key = {'type': req.type, 'year': req.year, 'period': req.period}
    update_data = {'link_url': req.link_url, 'updated_at': now, 'updated_by': user.get('full_name', user.get('username'))}
    existing = await db.ekinerja_pengumpulan_link.find_one(key)
    if existing:
        await db.ekinerja_pengumpulan_link.update_one(key, {'$set': update_data})
    else:
        await db.ekinerja_pengumpulan_link.insert_one({'id': str(uuid.uuid4()), **key, **update_data, 'created_at': now})
    await log_audit(user, 'ekinerja_pengumpulan_link_set', f"Set link {req.type} {req.period} {req.year}")
    doc = await db.ekinerja_pengumpulan_link.find_one(key, {'_id': 0})
    return serialize_doc(doc)


@router.get("/ekinerja/pengumpulan/status")
async def get_pengumpulan_status(
    type: str,
    year: int,
    period: str,
    user: Dict = Depends(get_current_user),
):
    """Status pengumpulan untuk satu (type, year, period): link aktif, dan
    untuk author — rekap siapa saja yang sudah/belum konfirmasi upload;
    untuk GTK biasa — hanya link dan status konfirmasi dirinya sendiri."""
    _validate_pengumpulan_type_period(type, period)
    link_doc = await db.ekinerja_pengumpulan_link.find_one({'type': type, 'year': year, 'period': period}, {'_id': 0})
    link_url = link_doc.get('link_url') if link_doc else None

    if _is_ekinerja_author(user):
        confirmations = await db.ekinerja_pengumpulan_konfirmasi.find(
            {'type': type, 'year': year, 'period': period}, {'_id': 0}
        ).to_list(2000)
        confirmed_ids = {c['gtk_id'] for c in confirmations}
        confirmed_by_id = {c['gtk_id']: c for c in confirmations}

        gtk_users = await db.users.find(
            {'roles': {'$in': ['guru', 'wali_kelas', 'guru_piket', 'guru_bk', 'guru_tata_tertib',
                                'guru_ekstrakurikuler', 'guru_ipa', 'guru_ips', 'guru_bahasa',
                                'guru_seni', 'guru_agama', 'guru_tik', 'tenaga_kependidikan']}},
            {'_id': 0, 'id': 1, 'full_name': 1, 'username': 1},
        ).to_list(2000)

        rekap = []
        for g in gtk_users:
            c = confirmed_by_id.get(g['id'])
            rekap.append({
                'gtk_id': g['id'],
                'gtk_name': g.get('full_name') or g.get('username'),
                'sudah_upload': g['id'] in confirmed_ids,
                'confirmed_at': c.get('confirmed_at') if c else None,
            })
        rekap.sort(key=lambda x: (x['sudah_upload'], x['gtk_name']))
        return {
            'link_url': link_url,
            'total_gtk': len(gtk_users),
            'total_confirmed': len(confirmed_ids),
            'rekap': rekap,
        }
    else:
        my_confirmation = await db.ekinerja_pengumpulan_konfirmasi.find_one(
            {'type': type, 'year': year, 'period': period, 'gtk_id': user['id']}, {'_id': 0}
        )
        return {
            'link_url': link_url,
            'sudah_upload': my_confirmation is not None,
            'confirmed_at': my_confirmation.get('confirmed_at') if my_confirmation else None,
        }


@router.put("/ekinerja/pengumpulan/confirm")
async def confirm_pengumpulan_upload(
    type: str,
    year: int,
    period: str,
    user: Dict = Depends(get_current_user),
):
    """GTK menandai bahwa mereka sudah upload dokumen ke link yang disediakan."""
    _validate_pengumpulan_type_period(type, period)
    now = datetime.utcnow().isoformat()
    key = {'type': type, 'year': year, 'period': period, 'gtk_id': user['id']}
    existing = await db.ekinerja_pengumpulan_konfirmasi.find_one(key)
    if existing:
        await db.ekinerja_pengumpulan_konfirmasi.update_one(key, {'$set': {'confirmed_at': now}})
    else:
        await db.ekinerja_pengumpulan_konfirmasi.insert_one({
            'id': str(uuid.uuid4()), **key,
            'gtk_name': user.get('full_name', user.get('username')),
            'confirmed_at': now,
        })
    await log_audit(user, 'ekinerja_pengumpulan_confirm', f"Confirmed upload {type} {period} {year}")
    return {'message': 'Konfirmasi upload berhasil disimpan'}


@router.delete("/ekinerja/pengumpulan/confirm")
async def unconfirm_pengumpulan_upload(
    type: str,
    year: int,
    period: str,
    user: Dict = Depends(get_current_user),
):
    """GTK membatalkan konfirmasi upload miliknya sendiri (mis. salah klik)."""
    _validate_pengumpulan_type_period(type, period)
    await db.ekinerja_pengumpulan_konfirmasi.delete_one({'type': type, 'year': year, 'period': period, 'gtk_id': user['id']})
    return {'message': 'Konfirmasi upload dibatalkan'}


# ============================================================
# JURNAL HARIAN
#
# Log aktivitas harian GTK di luar jurnal mengajar. Alih-alih upload bukti
# dukung per entri (berat untuk kompres/simpan), setiap GTK menyiapkan
# terlebih dahulu daftar "link penampung" miliknya sendiri (mis. folder
# Google Drive per kategori kegiatan), lalu saat mengisi jurnal harian
# tinggal memilih salah satu link yang sudah ada — tidak perlu ketik ulang
# atau upload file baru setiap hari.
# ============================================================

class JurnalLinkRequest(BaseModel):
    label: str  # mis. "Dokumentasi Rapat", "Laporan Piket"
    url: str


class JurnalHarianRequest(BaseModel):
    uraian_kegiatan: str
    volume: Optional[str] = None
    satuan_hasil: Optional[str] = None
    link_id: Optional[str] = None  # referensi ke salah satu ekinerja_jurnal_link milik GTK ini


@router.get("/ekinerja/jurnal-harian/link")
async def list_jurnal_links(user: Dict = Depends(get_current_user)):
    """Daftar link penampung bukti dukung milik GTK yang sedang login."""
    items = await db.ekinerja_jurnal_link.find({'gtk_id': user['id']}, {'_id': 0}).sort('created_at', -1).to_list(500)
    return [serialize_doc(i) for i in items]


@router.post("/ekinerja/jurnal-harian/link")
async def create_jurnal_link(req: JurnalLinkRequest, user: Dict = Depends(get_current_user)):
    now = now_wib().isoformat()
    doc = {
        'id': str(uuid.uuid4()),
        'gtk_id': user['id'],
        'label': req.label,
        'url': req.url,
        'created_at': now,
        'updated_at': now,
    }
    await db.ekinerja_jurnal_link.insert_one(doc)
    return serialize_doc(doc)


@router.put("/ekinerja/jurnal-harian/link/{link_id}")
async def update_jurnal_link(link_id: str, req: JurnalLinkRequest, user: Dict = Depends(get_current_user)):
    existing = await db.ekinerja_jurnal_link.find_one({'id': link_id})
    if not existing:
        raise HTTPException(404, "Link tidak ditemukan")
    if existing.get('gtk_id') != user['id']:
        raise HTTPException(403, "Anda hanya dapat mengubah link milik Anda sendiri")

    await db.ekinerja_jurnal_link.update_one({'id': link_id}, {'$set': {
        'label': req.label, 'url': req.url, 'updated_at': now_wib().isoformat(),
    }})
    updated = await db.ekinerja_jurnal_link.find_one({'id': link_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/ekinerja/jurnal-harian/link/{link_id}")
async def delete_jurnal_link(link_id: str, user: Dict = Depends(get_current_user)):
    existing = await db.ekinerja_jurnal_link.find_one({'id': link_id})
    if not existing:
        raise HTTPException(404, "Link tidak ditemukan")
    if existing.get('gtk_id') != user['id']:
        raise HTTPException(403, "Anda hanya dapat menghapus link milik Anda sendiri")

    await db.ekinerja_jurnal_link.delete_one({'id': link_id})
    # entri jurnal yang mereferensikan link ini tetap ada, hanya link_id-nya dikosongkan
    await db.ekinerja_jurnal_harian.update_many({'link_id': link_id}, {'$set': {'link_id': None}})
    return {'message': 'Link berhasil dihapus'}


async def _enrich_jurnal_entries(entries: List[Dict]) -> List[Dict]:
    link_ids = [e['link_id'] for e in entries if e.get('link_id')]
    links_by_id = {}
    if link_ids:
        links = await db.ekinerja_jurnal_link.find({'id': {'$in': link_ids}}, {'_id': 0}).to_list(500)
        links_by_id = {l['id']: l for l in links}
    result = []
    for e in entries:
        e = serialize_doc(e)
        link = links_by_id.get(e.get('link_id'))
        e['link_label'] = link.get('label') if link else None
        e['link_url'] = link.get('url') if link else None
        result.append(e)
    return result


@router.get("/ekinerja/jurnal-harian/my")
async def my_jurnal_harian(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: Dict = Depends(get_current_user),
):
    """Riwayat jurnal harian milik GTK yang sedang login."""
    query = {'gtk_id': user['id']}
    if date_from or date_to:
        query['tanggal'] = {}
        if date_from:
            query['tanggal']['$gte'] = date_from
        if date_to:
            query['tanggal']['$lte'] = date_to

    entries = await db.ekinerja_jurnal_harian.find(query, {'_id': 0}).sort('tanggal', -1).to_list(1000)
    return await _enrich_jurnal_entries(entries)


@router.post("/ekinerja/jurnal-harian")
async def create_jurnal_harian(req: JurnalHarianRequest, user: Dict = Depends(get_current_user)):
    if req.link_id:
        link = await db.ekinerja_jurnal_link.find_one({'id': req.link_id})
        if not link or link.get('gtk_id') != user['id']:
            raise HTTPException(400, "Link bukti dukung tidak valid")

    now = now_wib()
    doc = {
        'id': str(uuid.uuid4()),
        'gtk_id': user['id'],
        'gtk_name': user.get('full_name', user.get('username')),
        'tanggal': now.date().isoformat(),
        'uraian_kegiatan': req.uraian_kegiatan,
        'volume': req.volume,
        'satuan_hasil': req.satuan_hasil,
        'link_id': req.link_id,
        'created_at': now.isoformat(),
        'updated_at': now.isoformat(),
    }
    await db.ekinerja_jurnal_harian.insert_one(doc)
    await log_audit(user, 'ekinerja_jurnal_harian_create', f"Jurnal harian: {req.uraian_kegiatan[:60]}")
    enriched = await _enrich_jurnal_entries([doc])
    return enriched[0]


@router.put("/ekinerja/jurnal-harian/{entry_id}")
async def update_jurnal_harian(entry_id: str, req: JurnalHarianRequest, user: Dict = Depends(get_current_user)):
    existing = await db.ekinerja_jurnal_harian.find_one({'id': entry_id})
    if not existing:
        raise HTTPException(404, "Entri jurnal tidak ditemukan")
    if existing.get('gtk_id') != user['id']:
        raise HTTPException(403, "Anda hanya dapat mengubah jurnal milik Anda sendiri")
    if req.link_id:
        link = await db.ekinerja_jurnal_link.find_one({'id': req.link_id})
        if not link or link.get('gtk_id') != user['id']:
            raise HTTPException(400, "Link bukti dukung tidak valid")

    await db.ekinerja_jurnal_harian.update_one({'id': entry_id}, {'$set': {
        'uraian_kegiatan': req.uraian_kegiatan,
        'volume': req.volume,
        'satuan_hasil': req.satuan_hasil,
        'link_id': req.link_id,
        'updated_at': now_wib().isoformat(),
    }})
    updated = await db.ekinerja_jurnal_harian.find_one({'id': entry_id}, {'_id': 0})
    enriched = await _enrich_jurnal_entries([updated])
    return enriched[0]


@router.delete("/ekinerja/jurnal-harian/{entry_id}")
async def delete_jurnal_harian(entry_id: str, user: Dict = Depends(get_current_user)):
    existing = await db.ekinerja_jurnal_harian.find_one({'id': entry_id})
    if not existing:
        raise HTTPException(404, "Entri jurnal tidak ditemukan")
    if existing.get('gtk_id') != user['id']:
        raise HTTPException(403, "Anda hanya dapat menghapus jurnal milik Anda sendiri")

    await db.ekinerja_jurnal_harian.delete_one({'id': entry_id})
    return {'message': 'Entri jurnal berhasil dihapus'}


@router.get("/ekinerja/jurnal-harian")
async def list_jurnal_harian_all(
    gtk_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: Dict = Depends(_require_ekinerja_author()),
):
    """Admin/kepsek/KTU melihat jurnal harian semua GTK, atau satu GTK tertentu."""
    query = {}
    if gtk_id:
        query['gtk_id'] = gtk_id
    if date_from or date_to:
        query['tanggal'] = {}
        if date_from:
            query['tanggal']['$gte'] = date_from
        if date_to:
            query['tanggal']['$lte'] = date_to

    entries = await db.ekinerja_jurnal_harian.find(query, {'_id': 0}).sort('tanggal', -1).to_list(2000)
    return await _enrich_jurnal_entries(entries)


# ============================================================
# RIWAYAT SERTIFIKASI (catatan manual per periode)
#
# Berbeda dari pola pengumpulan biasa (1 konfirmasi per periode), di sini
# satu GTK boleh menambahkan BANYAK record dalam satu (year, period) yang
# sama — mis. beberapa sertifikat pelatihan yang diupload sekaligus ke satu
# link pengumpulan bersama (type='sertifikasi', dikelola lewat endpoint
# /ekinerja/pengumpulan/link seperti biasa). Record ini murni pencatatan
# manual (nama kegiatan, penyelenggara, tanggal, jam) — bukan file itu
# sendiri, yang tetap diupload GTK ke link bersama tsb.
# ============================================================

class SertifikasiRecordRequest(BaseModel):
    year: int
    period: str  # 'TW1'..'TW4' | 'TAHUNAN'
    nama_kegiatan: str
    penyelenggara: Optional[str] = None
    tanggal_mulai: Optional[str] = None
    tanggal_selesai: Optional[str] = None
    jumlah_jam: Optional[str] = None


@router.get("/ekinerja/sertifikasi/my")
async def my_sertifikasi_records(year: int, period: str, user: Dict = Depends(get_current_user)):
    if period not in QUARTERLY_PERIODS:
        raise HTTPException(400, "Periode tidak valid")
    items = await db.ekinerja_sertifikasi_record.find(
        {'gtk_id': user['id'], 'year': year, 'period': period}, {'_id': 0}
    ).sort('created_at', -1).to_list(500)
    return [serialize_doc(i) for i in items]


@router.post("/ekinerja/sertifikasi")
async def create_sertifikasi_record(req: SertifikasiRecordRequest, user: Dict = Depends(get_current_user)):
    if req.period not in QUARTERLY_PERIODS:
        raise HTTPException(400, "Periode tidak valid")
    now = now_wib().isoformat()
    doc = {
        'id': str(uuid.uuid4()),
        'gtk_id': user['id'],
        'gtk_name': user.get('full_name', user.get('username')),
        'year': req.year,
        'period': req.period,
        'nama_kegiatan': req.nama_kegiatan,
        'penyelenggara': req.penyelenggara,
        'tanggal_mulai': req.tanggal_mulai,
        'tanggal_selesai': req.tanggal_selesai,
        'jumlah_jam': req.jumlah_jam,
        'created_at': now,
        'updated_at': now,
    }
    await db.ekinerja_sertifikasi_record.insert_one(doc)
    await log_audit(user, 'ekinerja_sertifikasi_create', f"Sertifikasi: {req.nama_kegiatan[:60]}")
    return serialize_doc(doc)


@router.put("/ekinerja/sertifikasi/{record_id}")
async def update_sertifikasi_record(record_id: str, req: SertifikasiRecordRequest, user: Dict = Depends(get_current_user)):
    existing = await db.ekinerja_sertifikasi_record.find_one({'id': record_id})
    if not existing:
        raise HTTPException(404, "Data tidak ditemukan")
    if existing.get('gtk_id') != user['id']:
        raise HTTPException(403, "Anda hanya dapat mengubah data milik Anda sendiri")
    if req.period not in QUARTERLY_PERIODS:
        raise HTTPException(400, "Periode tidak valid")

    await db.ekinerja_sertifikasi_record.update_one({'id': record_id}, {'$set': {
        'year': req.year, 'period': req.period, 'nama_kegiatan': req.nama_kegiatan,
        'penyelenggara': req.penyelenggara, 'tanggal_mulai': req.tanggal_mulai,
        'tanggal_selesai': req.tanggal_selesai, 'jumlah_jam': req.jumlah_jam,
        'updated_at': now_wib().isoformat(),
    }})
    updated = await db.ekinerja_sertifikasi_record.find_one({'id': record_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/ekinerja/sertifikasi/{record_id}")
async def delete_sertifikasi_record(record_id: str, user: Dict = Depends(get_current_user)):
    existing = await db.ekinerja_sertifikasi_record.find_one({'id': record_id})
    if not existing:
        raise HTTPException(404, "Data tidak ditemukan")
    if existing.get('gtk_id') != user['id']:
        raise HTTPException(403, "Anda hanya dapat menghapus data milik Anda sendiri")

    await db.ekinerja_sertifikasi_record.delete_one({'id': record_id})
    return {'message': 'Data berhasil dihapus'}


@router.get("/ekinerja/sertifikasi")
async def list_sertifikasi_all(
    year: int,
    period: str,
    gtk_id: Optional[str] = None,
    user: Dict = Depends(_require_ekinerja_author()),
):
    """Admin/kepsek/KTU melihat rekaman sertifikasi semua GTK (atau satu GTK) untuk satu periode."""
    if period not in QUARTERLY_PERIODS:
        raise HTTPException(400, "Periode tidak valid")
    query = {'year': year, 'period': period}
    if gtk_id:
        query['gtk_id'] = gtk_id
    items = await db.ekinerja_sertifikasi_record.find(query, {'_id': 0}).sort('gtk_name', 1).to_list(2000)
    return [serialize_doc(i) for i in items]
