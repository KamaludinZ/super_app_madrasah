"""Impor pelengkapan data master (Siswa / GTK) — khusus Admin.

Alur: frontend mengunggah berkas -> server memvalidasi & membuat sesi impor (riwayat) ->
frontend mengirim baris per batch dengan impor_id -> server memproses tiap baris.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field

from core import db, log_audit
from data_master_impor import (
    KOLEKSI_BARIS, KOLEKSI_IMPOR, KOLEKSI_PERUBAHAN, MAKS_BARIS, MAKS_KESALAHAN_TERSIMPAN, MAKS_UKURAN_BERKAS, BarisImporModel,
    ImporModel, PerubahanModel,
    RingkasanImpor, baca_berkas_impor, cocokkan_baris, dokumen, rencanakan_perubahan, terapkan_perubahan,
)
from routers._shared import ADMIN_DATA_MASTER

router = APIRouter()

MODE_VALID = ('isi_kosong', 'timpa')


async def _unggah(jenis: str, file: UploadFile, mode: str, konfirmasi_timpa: bool, request: Request, user: Dict) -> Dict:
    if mode not in MODE_VALID:
        raise HTTPException(400, "Mode impor harus 'isi_kosong' atau 'timpa'")
    # Timpa nilai berbeda bersifat opsional & harus dikonfirmasi eksplisit (default: isi yang kosong).
    if mode == 'timpa' and not konfirmasi_timpa:
        raise HTTPException(400, 'Mode timpa memerlukan konfirmasi (konfirmasi_timpa=true)')
    nama = (file.filename or '').strip()
    if not nama.lower().endswith('.xlsx'):
        raise HTTPException(400, 'Berkas harus berformat Excel .xlsx (unduhan atau template dari aplikasi)')
    content = await file.read(MAKS_UKURAN_BERKAS + 1)
    if len(content) > MAKS_UKURAN_BERKAS:
        raise HTTPException(413, 'Ukuran berkas maksimal 5 MB')
    if not content:
        raise HTTPException(400, 'Berkas kosong')
    try:
        hasil = baca_berkas_impor(content, jenis)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if hasil['masalah_header']:
        raise HTTPException(422, {'pesan': 'Susunan kolom berkas tidak sesuai template', 'masalah': hasil['masalah_header']})
    total = len(hasil['baris'])
    if total == 0:
        raise HTTPException(400, 'Tidak ada baris data yang bisa diimpor (berkas hanya berisi judul/keterangan)')
    if total > MAKS_BARIS:
        raise HTTPException(413, f'Maksimal {MAKS_BARIS} baris per berkas; bagi berkas menjadi beberapa bagian')

    sesi = ImporModel(jenis=jenis, mode=mode, nama_berkas=nama[:200], ringkasan=RingkasanImpor(total=total),
                      dibuat_oleh=user.get('id'), dibuat_oleh_nama=user.get('full_name') or user.get('username'))
    await db[KOLEKSI_IMPOR].insert_one(dokumen(sesi))
    await log_audit(user, 'import_start', f'{jenis}_kelengkapan', sesi.id,
                    details={'mode': mode, 'berkas': sesi.nama_berkas, 'total': total}, request=request)
    return {
        'impor_id': sesi.id,
        'jenis': jenis,
        'mode': mode,
        'sheet': hasil['sheet'],
        'total': total,
        'dilewati': hasil['dilewati'],
        'dibuat_pada': datetime.utcnow().isoformat(),
    }


@router.post("/students/import-kelengkapan/unggah")
async def unggah_impor_siswa(request: Request, file: UploadFile = File(...), mode: str = Form('isi_kosong'),
                             konfirmasi_timpa: bool = Form(False), user: Dict = Depends(ADMIN_DATA_MASTER)):
    """Unggah berkas pelengkapan Data Siswa: validasi berkas & kolom, buat sesi impor."""
    return await _unggah('siswa', file, mode, konfirmasi_timpa, request, user)


@router.post("/gtk/import-kelengkapan/unggah")
async def unggah_impor_gtk(request: Request, file: UploadFile = File(...), mode: str = Form('isi_kosong'),
                           konfirmasi_timpa: bool = Form(False), user: Dict = Depends(ADMIN_DATA_MASTER)):
    """Unggah berkas pelengkapan Data GTK: validasi berkas & kolom, buat sesi impor."""
    return await _unggah('gtk', file, mode, konfirmasi_timpa, request, user)


# ------------------------------------------------------------
# PROSES BATCH, PROGRES & RINGKASAN
# ------------------------------------------------------------
MAKS_BARIS_PER_BATCH = 200


class BarisImpor(BaseModel):
    baris: int
    data: Dict[str, Any] = Field(default_factory=dict)


class BatchImporRequest(BaseModel):
    impor_id: str
    mode: Optional[str] = None  # diabaikan: mode mengikuti sesi saat unggah
    baris: List[BarisImpor]
    terakhir: bool = False


def _ringkas_perubahan(perubahan: List[Dict[str, Any]]) -> str:
    isi = sum(1 for p in perubahan if p['aksi'] == 'isi')
    timpa = len(perubahan) - isi
    bagian = [f'{isi} field diisi'] if isi else []
    if timpa:
        bagian.append(f'{timpa} field ditimpa')
    nama = ', '.join(p['label'] for p in perubahan[:4]) + (' dst.' if len(perubahan) > 4 else '')
    return f"{' & '.join(bagian)}: {nama}"


async def _sesi_atau_404(jenis: str, impor_id: str) -> Dict[str, Any]:
    sesi = await db[KOLEKSI_IMPOR].find_one({'id': impor_id, 'jenis': jenis}, {'_id': 0})
    if not sesi:
        raise HTTPException(404, 'Sesi impor tidak ditemukan; unggah ulang berkas')
    return sesi


async def _proses_batch(jenis: str, req: BatchImporRequest, request: Request, user: Dict) -> Dict:
    sesi = await _sesi_atau_404(jenis, req.impor_id)
    if sesi['status'] != 'berjalan':
        raise HTTPException(409, 'Sesi impor sudah selesai; unggah ulang berkas untuk impor baru')
    if sesi.get('dibuat_oleh') != user.get('id'):
        raise HTTPException(403, 'Sesi impor milik admin lain')
    if not req.baris:
        raise HTTPException(400, 'Batch kosong')
    if len(req.baris) > MAKS_BARIS_PER_BATCH:
        raise HTTPException(413, f'Maksimal {MAKS_BARIS_PER_BATCH} baris per batch')
    mode = sesi['mode']
    baris = [b.model_dump() for b in req.baris]
    sudah = dict(sesi.get('target_baris') or {})
    sebelum = set(sudah)
    cocok = await cocokkan_baris(db, jenis, baris, sudah)

    detail_map: Dict[str, Dict] = {}
    if jenis == 'siswa':
        ids = [c['target']['id'] for c in cocok if c['target']]
        detail_map = {d['student_id']: d for d in await db.student_details.find(
            {'student_id': {'$in': ids}}, {'_id': 0}).to_list(len(ids) or 1)}

    hasil, dok_perubahan, kesalahan = [], [], []
    inc = {'berhasil': 0, 'tanpa_perubahan': 0, 'gagal': 0, 'field_diisi': 0, 'field_ditimpa': 0}
    for b, c in zip(baris, cocok):
        r = {'baris': b['baris'], 'identitas': c['identitas'], 'target_id': (c['target'] or {}).get('id')}
        if not c['target']:
            r.update(status='gagal', pesan=c['pesan'], kolom=c['kolom'])
        else:
            t = c['target']
            r['nama'] = t.get('full_name')
            detail = detail_map.get(t['id'])
            rc = rencanakan_perubahan(jenis, b['data'], t, detail, mode)
            if rc['kesalahan']:
                # Satu baris diterapkan utuh atau tidak sama sekali: nilai salah -> baris gagal.
                r.update(status='gagal', kolom=', '.join(e['kolom'] for e in rc['kesalahan'][:3]),
                         pesan='; '.join(e['pesan'] for e in rc['kesalahan'][:3]) + (' dst.' if len(rc['kesalahan']) > 3 else ''))
            elif not rc['perubahan']:
                r.update(status='tanpa_perubahan', pesan='Tidak ada field kosong yang perlu diisi' if mode == 'isi_kosong' else 'Semua nilai sudah sama')
            else:
                try:
                    await terapkan_perubahan(db, jenis, t, rc['perubahan'], user.get('id'), detail)
                except Exception as e:  # noqa: BLE001 - kegagalan tulis satu baris tidak menghentikan batch
                    r.update(status='gagal', pesan=f'Gagal menyimpan: {e}', kolom=None)
                else:
                    r.update(status='berhasil', pesan=_ringkas_perubahan(rc['perubahan']),
                             field_diisi=sum(1 for p in rc['perubahan'] if p['aksi'] == 'isi'),
                             field_ditimpa=sum(1 for p in rc['perubahan'] if p['aksi'] == 'timpa'))
                    inc['field_diisi'] += r['field_diisi']
                    inc['field_ditimpa'] += r['field_ditimpa']
                    dok_perubahan += [dokumen(PerubahanModel(
                        impor_id=sesi['id'], jenis=jenis, target_id=t['id'], baris=b['baris'], kolom=p['kolom'], path=p['path'],
                        aksi=p['aksi'], nilai_lama=p['lama'], nilai_baru=p['baru'], oleh=user.get('id'))) for p in rc['perubahan']]
        inc[r['status']] += 1
        if r['status'] == 'gagal':
            kesalahan.append({k: r.get(k) for k in ('baris', 'identitas', 'kolom', 'pesan')})
        hasil.append(r)

    if dok_perubahan:
        await db[KOLEKSI_PERUBAHAN].insert_many(dok_perubahan)
    # Jejak lengkap setiap baris (berhasil, tanpa perubahan, gagal) untuk audit & penelusuran.
    await db[KOLEKSI_BARIS].insert_many([dokumen(BarisImporModel(
        impor_id=sesi['id'], jenis=jenis, baris=r['baris'], identitas=r.get('identitas') or '-', target_id=r.get('target_id'),
        status=r['status'], kolom=r.get('kolom'), pesan=r.get('pesan'), field_diisi=r.get('field_diisi', 0),
        field_ditimpa=r.get('field_ditimpa', 0), oleh=user.get('id'))) for r in hasil])
    baru = {f'target_baris.{tid}': n for tid, n in sudah.items() if tid not in sebelum}
    tambah = {f'ringkasan.{k}': v for k, v in inc.items()}
    tambah['diproses'] = len(baris)
    update: Dict[str, Any] = {'$inc': tambah, '$set': {'diperbarui_pada': datetime.utcnow().isoformat(), **baru}}
    if kesalahan:
        update['$push'] = {'kesalahan': {'$each': kesalahan, '$slice': MAKS_KESALAHAN_TERSIMPAN}}
    if req.terakhir:
        update['$set']['status'] = 'selesai'
    await db[KOLEKSI_IMPOR].update_one({'id': sesi['id']}, update)
    if req.terakhir:
        akhir = await db[KOLEKSI_IMPOR].find_one({'id': sesi['id']}, {'_id': 0, 'ringkasan': 1, 'diproses': 1})
        await log_audit(user, 'import_finish', f'{jenis}_kelengkapan', sesi['id'],
                        details={'mode': mode, **akhir['ringkasan'], 'diproses': akhir.get('diproses', 0)}, request=request)
    return {'impor_id': sesi['id'], 'mode': mode, 'hasil': hasil, 'ringkasan_batch': inc}


async def _status(jenis: str, impor_id: str) -> Dict:
    sesi = await _sesi_atau_404(jenis, impor_id)
    sesi.pop('target_baris', None)
    total = sesi['ringkasan'].get('total') or 0
    diproses = sesi.get('diproses', 0)
    sesi['diproses'] = diproses
    sesi['persen'] = round(diproses / total * 100) if total else 0
    return sesi


@router.post("/students/import-kelengkapan")
async def proses_impor_siswa(req: BatchImporRequest, request: Request, user: Dict = Depends(ADMIN_DATA_MASTER)):
    """Proses satu batch baris pelengkapan Data Siswa dalam sesi impor; hasil per baris."""
    return await _proses_batch('siswa', req, request, user)


@router.post("/gtk/import-kelengkapan")
async def proses_impor_gtk(req: BatchImporRequest, request: Request, user: Dict = Depends(ADMIN_DATA_MASTER)):
    """Proses satu batch baris pelengkapan Data GTK dalam sesi impor; hasil per baris."""
    return await _proses_batch('gtk', req, request, user)


# ------------------------------------------------------------
# RIWAYAT & JEJAK AUDIT IMPOR
# ------------------------------------------------------------
@router.get("/data-master/impor/riwayat")
async def riwayat_impor(jenis: Optional[str] = None, limit: int = 50, user: Dict = Depends(ADMIN_DATA_MASTER)):
    """Riwayat sesi impor terbaru (tanpa daftar kesalahan), opsional per jenis siswa/gtk."""
    q: Dict[str, Any] = {}
    if jenis:
        if jenis not in ('siswa', 'gtk'):
            raise HTTPException(400, "Jenis harus 'siswa' atau 'gtk'")
        q['jenis'] = jenis
    limit = max(1, min(limit, 200))
    return await db[KOLEKSI_IMPOR].find(q, {'_id': 0, 'target_baris': 0, 'kesalahan': 0}).sort('dibuat_pada', -1).to_list(limit)


@router.get("/data-master/impor/{impor_id}/baris")
async def baris_impor(impor_id: str, status: Optional[str] = None, user: Dict = Depends(ADMIN_DATA_MASTER)):
    """Hasil per baris satu sesi impor (urut baris Excel); status=gagal untuk daftar kesalahan lengkap."""
    if not await db[KOLEKSI_IMPOR].find_one({'id': impor_id}, {'_id': 1}):
        raise HTTPException(404, 'Sesi impor tidak ditemukan')
    q: Dict[str, Any] = {'impor_id': impor_id}
    if status:
        if status not in ('berhasil', 'tanpa_perubahan', 'gagal'):
            raise HTTPException(400, 'Status tidak dikenal')
        q['status'] = status
    return await db[KOLEKSI_BARIS].find(q, {'_id': 0}).sort('baris', 1).to_list(MAKS_BARIS)


@router.get("/data-master/impor/{impor_id}/perubahan")
async def perubahan_impor(impor_id: str, user: Dict = Depends(ADMIN_DATA_MASTER)):
    """Jejak per field (nilai lama -> baru) yang diubah satu sesi impor."""
    if not await db[KOLEKSI_IMPOR].find_one({'id': impor_id}, {'_id': 1}):
        raise HTTPException(404, 'Sesi impor tidak ditemukan')
    return await db[KOLEKSI_PERUBAHAN].find({'impor_id': impor_id}, {'_id': 0}).sort([('baris', 1), ('kolom', 1)]).to_list(MAKS_BARIS * 50)


@router.get("/students/import-kelengkapan/{impor_id}")
async def status_impor_siswa(impor_id: str, user: Dict = Depends(ADMIN_DATA_MASTER)):
    """Progres & ringkasan sesi impor Data Siswa (jumlah diproses, berhasil/gagal, daftar kesalahan)."""
    return await _status('siswa', impor_id)


@router.get("/gtk/import-kelengkapan/{impor_id}")
async def status_impor_gtk(impor_id: str, user: Dict = Depends(ADMIN_DATA_MASTER)):
    """Progres & ringkasan sesi impor Data GTK."""
    return await _status('gtk', impor_id)
