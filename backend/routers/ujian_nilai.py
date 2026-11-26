"""Ujian Madrasah — Nilai UAS: impor massal dari template (satu berkas per mapel per jenjang, satu sheet per kelas)
dengan monitoring progres.

Akses: admin serta ketua & sekretaris panitia ujian itu (menu 'nilai'). Hanya ujian UAS pada semester konteks lihat.
"""
from datetime import datetime, timedelta
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from core import db, get_active_context, get_current_user, log_audit
from routers.ujian import akses_ujian
from routers.ujian_ruang import siswa_semester
from ujian import adalah_pengelola, hari_ini_wib, sekarang_wib
from ujian_nilai import (KOLEKSI_IMPOR_LOG, KOLEKSI_MASA, KOLEKSI_NILAI, KOLEKSI_RAPOR, KOLEKSI_RIWAYAT, LABEL_TAHAP, STATUS_IMPOR,
                         dokumen_log_impor, dokumen_nilai, MasaNilaiIn, dokumen_riwayat, ke_angka, masa_terbuka, peran_pengunggah,
                         rantai_ulang, rekap_kelas, ringkas_log, simpan_dokumen_nilai)
from ujian_nilai_rapor import konteks_rapor, sinkron_rapor, status_ubah_guru, ujian_uas_semester
from ujian_nilai_impor import jalankan_impor, lokasi_teks
from ujian_nilai_xlsx import MAKS_BERKAS, buat_template_nilai, nama_berkas_template_nilai

router = APIRouter(tags=["Ujian - Nilai UAS"])
# Job impor memperbarui `diperbarui` paling lambat tiap 20 baris; tanpa aktivitas selama ini = job mati (server dimulai ulang).
MACET_SETELAH = timedelta(minutes=10)


def aktivitas_terakhir(doc: Dict[str, Any]) -> str:
    return doc.get('diperbarui') or doc.get('waktu') or ''


async def akses_nilai(user: Dict[str, Any], ujian_id: str, tulis: bool = False, cek_kunci: bool = True) -> Dict[str, Any]:
    """Penjaga menu Nilai UAS satu ujian. `tulis` = juga wajib ujian UAS pada semester konteks lihat (bukan arsip) dan —
    bila `cek_kunci` — nilai belum terkunci oleh masa ujian/remidi (lihat alasan_kunci_nilai; admin dikecualikan)."""
    akses = await akses_ujian(user, ujian_id, 'nilai')
    ujian = akses['ujian']
    if tulis:
        alasan = alasan_tidak_bisa_impor(ujian, (await get_active_context(user)).get('semester_id'))
        if alasan:
            raise HTTPException(400 if ujian.get('jenis') != 'UAS' else 409, alasan)
        if cek_kunci and not akses['pengelola']:
            kunci = alasan_kunci_nilai(await db[KOLEKSI_MASA].find_one({'ujian_id': ujian_id}, {'_id': 0}), hari_ini_wib())
            if kunci:
                raise HTTPException(423, kunci)
    return akses


def alasan_kunci_nilai(masa: Optional[Dict[str, Any]], hari_ini: str) -> Optional[str]:
    """Kunci nilai bagi panitia (ketua/sekretaris): sebelum panitia mengatur masa, nilai bebas diisi; setelah masa diatur,
    nilai hanya dapat diubah selama masa ujian/remidi terbuka. Admin selalu boleh (dengan jejak audit)."""
    if not masa or masa_terbuka(masa, hari_ini):
        return None
    return 'Nilai terkunci: masa ujian/remidi sedang ditutup. Buka masa remidi di panel Masa Ujian & Remidi atau minta admin.'


async def mapel_semester(semester_id: str) -> List[Dict[str, Any]]:
    """Mapel kurikulum semester ujian (semua mapel bila kurikulum semester tidak diatur/tidak dipetakan), urut nama."""
    semua = await db.subjects.find({}, {'_id': 0, 'id': 1, 'name': 1, 'code': 1, 'curriculum_ids': 1}).to_list(500)
    semester = await db.semesters.find_one({'id': semester_id}, {'_id': 0, 'curriculum_id': 1}) or {}
    kur = semester.get('curriculum_id')
    pilih = [m for m in semua if kur and kur in (m.get('curriculum_ids') or [])] or semua
    return sorted(pilih, key=lambda m: str(m.get('name') or '').lower())


def alasan_tidak_bisa_impor(ujian: Dict[str, Any], semester_konteks: Optional[str]) -> Optional[str]:
    if ujian.get('jenis') != 'UAS':
        return "Nilai UAS hanya dapat diimpor pada ujian UAS"
    if ujian.get('semester_id') != semester_konteks:
        return "Ujian ini milik semester lain (arsip): nilai hanya dapat dilihat"
    return None


@router.get("/ujian/{ujian_id}/nilai/pilihan")
async def pilihan_nilai(ujian_id: str, user: Dict = Depends(get_current_user)):
    """Pilihan untuk impor massal nilai UAS: mapel (kurikulum semester ujian) dan jenjang beserta kelasnya (jumlah siswa
    aktif) pada semester ujian. -> { mapel: [{id, nama, kode}], jenjang: [{jenjang, kelas: [{id, nama, jumlah_siswa}]}],
    boleh_impor, pesan }"""
    akses = await akses_nilai(user, ujian_id)
    ujian = akses['ujian']
    ctx = await get_active_context(user)
    alasan = alasan_tidak_bisa_impor(ujian, ctx.get('semester_id'))
    if not alasan and not akses['pengelola']:
        alasan = alasan_kunci_nilai(await db[KOLEKSI_MASA].find_one({'ujian_id': ujian_id}, {'_id': 0}), hari_ini_wib())
    kelas = await db.classes.find({'semester_id': ujian['semester_id']}, {'_id': 0, 'id': 1, 'name': 1, 'grade': 1}).to_list(1000)
    jumlah: Dict[str, int] = {}
    for s in await siswa_semester(ujian['semester_id']):
        jumlah[s['kelas_id']] = jumlah.get(s['kelas_id'], 0) + 1
    per_jenjang: Dict[int, List[Dict[str, Any]]] = {}
    for c in kelas:
        try:
            j = int(c.get('grade'))
        except (TypeError, ValueError):
            continue
        per_jenjang.setdefault(j, []).append({'id': c['id'], 'nama': c.get('name'), 'jumlah_siswa': jumlah.get(c['id'], 0)})
    return {
        'mapel': [{'id': m['id'], 'nama': m.get('name'), 'kode': m.get('code')} for m in await mapel_semester(ujian['semester_id'])],
        'jenjang': [{'jenjang': j, 'kelas': sorted(per_jenjang[j], key=lambda k: str(k['nama'] or ''))} for j in sorted(per_jenjang)],
        'boleh_impor': alasan is None, 'pesan': alasan,
    }


async def kelas_jenjang(semester_id: str, jenjang: int) -> List[Dict[str, Any]]:
    kelas = await db.classes.find({'semester_id': semester_id}, {'_id': 0, 'id': 1, 'name': 1, 'grade': 1}).to_list(1000)
    return sorted([c for c in kelas if str(c.get('grade')) == str(jenjang)], key=lambda c: str(c.get('name') or ''))


@router.post("/ujian/{ujian_id}/nilai/impor")
async def unggah_impor_nilai(ujian_id: str, request: Request, latar: BackgroundTasks, berkas: UploadFile = File(...),
                             mapel_id: str = Form(..., min_length=1, max_length=64), jenjang: int = Form(..., ge=1, le=12),
                             ulang_dari: Optional[str] = Form(None, max_length=64), user: Dict = Depends(get_current_user)):
    """Unggah SATU berkas nilai UAS (beberapa sheet kelas) untuk satu mapel & jenjang lalu mulai job impor di latar
    belakang. -> { log_id } segera; progres & hasil dipantau lewat GET /ujian/{id}/nilai/impor/{log_id}.
    Ditolak 409 bila impor mapel & jenjang yang sama masih berjalan.

    `ulang_dari` = id log impor sebelumnya (selesai, masih ada baris gagal, mapel & jenjang sama): UNGGAH ULANG HANYA
    BARIS GAGAL — siswa yang sudah berhasil pada log itu (dan unggah ulang sebelumnya) dilewati, sehingga nilai yang sudah
    masuk tidak tertimpa walau berkas perbaikan berisi semua baris."""
    akses = await akses_nilai(user, ujian_id, tulis=True)
    ujian = akses['ujian']
    if not (berkas.filename or '').lower().endswith('.xlsx'):
        raise HTTPException(400, "Berkas harus .xlsx (template nilai UAS dari aplikasi)")
    isi = await berkas.read(MAKS_BERKAS + 1)
    if not isi:
        raise HTTPException(400, "Berkas kosong")
    if len(isi) > MAKS_BERKAS:
        raise HTTPException(413, "Ukuran berkas maksimal 5 MB")
    mapel = await db.subjects.find_one({'id': mapel_id}, {'_id': 0, 'id': 1, 'name': 1})
    if not mapel:
        raise HTTPException(404, "Mata pelajaran tidak ditemukan")
    kelas = await kelas_jenjang(ujian['semester_id'], jenjang)
    if not kelas:
        raise HTTPException(400, f"Tidak ada kelas {jenjang} pada semester ujian ini")

    batas = (sekarang_wib() - MACET_SETELAH).isoformat()
    berjalan = next((d for d in await db[KOLEKSI_IMPOR_LOG].find(
        {'ujian_id': ujian_id, 'mapel_id': mapel_id, 'jenjang': jenjang, 'status': 'proses'},
        {'_id': 0, 'id': 1, 'diunggah_oleh_nama': 1, 'waktu': 1, 'diperbarui': 1}).to_list(50) if aktivitas_terakhir(d) >= batas), None)
    if berjalan:
        raise HTTPException(409, f"Impor nilai {mapel['name']} kelas {jenjang} masih diproses (oleh {berjalan.get('diunggah_oleh_nama')}). "
                                 "Tunggu sampai selesai sebelum mengunggah lagi.")

    lewati: List[str] = []
    if ulang_dari:
        asal = await db[KOLEKSI_IMPOR_LOG].find_one({'id': ulang_dari, 'ujian_id': ujian_id}, {'_id': 0})
        if not asal:
            raise HTTPException(404, "Riwayat impor asal tidak ditemukan pada ujian ini")
        if asal.get('mapel_id') != mapel_id or asal.get('jenjang') != jenjang:
            raise HTTPException(400, "Unggah ulang harus untuk mapel & jenjang yang sama dengan impor asal "
                                     f"({asal.get('mapel_nama')} kelas {asal.get('jenjang')})")
        if asal.get('status') != 'selesai' or not asal.get('gagal'):
            raise HTTPException(409, "Impor asal tidak memiliki baris gagal untuk diunggah ulang")
        lewati = sorted({sid for lg in await rantai_ulang(db, asal) for sid in (lg.get('siswa_berhasil') or [])})
    # Konteks disusun SEBELUM log dibuat: bila gagal, klien menerima galat HTTP langsung (bukan log 'proses' yang menggantung).
    siswa = [s for s in await siswa_semester(ujian['semester_id']) if s.get('kelas_id') in {c['id'] for c in kelas}]
    nama_mapel = {m['id']: m.get('name') for m in await db.subjects.find({}, {'_id': 0, 'id': 1, 'name': 1}).to_list(500)}
    konteks = {'ujian_id': ujian_id, 'mapel_id': mapel_id, 'jenjang': jenjang, 'nama_mapel': nama_mapel,
               'kelas': kelas, 'siswa': siswa, 'lewati_siswa': lewati, 'rapor': await konteks_rapor(db, ujian),
               'oleh': {'id': user.get('id'), 'full_name': user.get('full_name'), 'username': user.get('username')}}
    log = dokumen_log_impor(ujian_id, mapel, jenjang, (berkas.filename or 'nilai.xlsx')[:200], user,
                            sebagai=peran_pengunggah(akses), ukuran=len(isi), ulang_dari=ulang_dari)
    await db[KOLEKSI_IMPOR_LOG].insert_one(dict(log))
    latar.add_task(jalankan_impor, db, log['id'], isi, konteks)
    await log_audit(user, 'ujian_nilai_impor', KOLEKSI_IMPOR_LOG, log['id'],
                    {'ujian_id': ujian_id, 'mapel_id': mapel_id, 'jenjang': jenjang, 'berkas': log['berkas'], 'ukuran': len(isi),
                     'ulang_dari': ulang_dari}, request=request)
    return {'log_id': log['id'], 'status': 'proses'}


def pesan_macet(doc: Dict[str, Any]) -> str:
    terakhir = aktivitas_terakhir(doc)
    try:
        jam = datetime.fromisoformat(terakhir).strftime('%d/%m/%Y %H.%M')
    except (TypeError, ValueError):
        jam = '-'
    tahap = LABEL_TAHAP.get(doc.get('tahap') or 'diterima', doc.get('tahap') or '-').lower()
    return (f"Impor terhenti: tidak ada aktivitas sejak {jam} WIB pada tahap {tahap}{lokasi_teks({'sheet': doc.get('sheet_aktif')})} "
            f"(lebih dari {int(MACET_SETELAH.total_seconds() // 60)} menit). Kemungkinan server dimulai ulang/redeploy saat impor "
            "berjalan. Baris yang sudah berhasil tetap tersimpan; unggah ulang berkas yang sama.")


async def _tandai_macet(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Log 'proses' tanpa aktivitas (`diperbarui`) lebih dari MACET_SETELAH dianggap gagal agar panitia dapat mengunggah ulang."""
    if doc.get('status') == 'proses' and aktivitas_terakhir(doc) < (sekarang_wib() - MACET_SETELAH).isoformat():
        ubah = {'status': 'gagal', 'pesan': pesan_macet(doc), 'selesai_pada': sekarang_wib().isoformat(), 'sheet_aktif': None,
                'gagal_di': {'tahap': doc.get('tahap') or 'diterima', 'sheet': doc.get('sheet_aktif'), 'baris': None, 'nama': None},
                'galat_teknis': None}
        await db[KOLEKSI_IMPOR_LOG].update_one({'id': doc['id'], 'status': 'proses'}, {'$set': ubah})
        doc = {**doc, **ubah}
    return doc


@router.get("/ujian/{ujian_id}/nilai/impor")
async def riwayat_impor_nilai(ujian_id: str, status: Optional[Literal['proses', 'selesai', 'gagal']] = None,
                              mapel_id: Optional[str] = None, jenjang: Optional[int] = None, oleh: Optional[str] = None,
                              batas: int = Query(50, ge=1, le=200), user: Dict = Depends(get_current_user)):
    """Riwayat impor nilai satu ujian, terbaru dulu (tanpa daftar baris gagal) beserta metadata pengunggah: nama,
    kapasitas (jabatan panitia/Admin), berkas & ukurannya, waktu unggah, selesai, dan durasi.
    -> { items, ringkasan: {status: jumlah}, pengunggah: [{ id, nama, sebagai, jumlah, terakhir }] }.
    Saring opsional status / mapel_id / jenjang / oleh (id pengunggah); ringkasan & pengunggah dihitung dari seluruh riwayat."""
    await akses_nilai(user, ujian_id)
    semua = [await _tandai_macet(d) for d in await db[KOLEKSI_IMPOR_LOG].find(
        {'ujian_id': ujian_id}, {'_id': 0, 'galat': 0, 'siswa_berhasil': 0}).sort('waktu', -1).to_list(1000)]
    ringkasan = {s: sum(1 for d in semua if d.get('status') == s) for s in STATUS_IMPOR}
    pengunggah: Dict[str, Dict[str, Any]] = {}
    for d in semua:  # terbaru dulu -> 'terakhir' & 'sebagai' dari unggahan terbarunya
        p = pengunggah.setdefault(d.get('diunggah_oleh') or '-', {
            'id': d.get('diunggah_oleh'), 'nama': d.get('diunggah_oleh_nama'), 'sebagai': d.get('diunggah_sebagai'),
            'jumlah': 0, 'terakhir': d.get('waktu')})
        p['jumlah'] += 1
    items = [d for d in semua if (not status or d.get('status') == status) and (not mapel_id or d.get('mapel_id') == mapel_id)
             and (jenjang is None or d.get('jenjang') == jenjang) and (not oleh or d.get('diunggah_oleh') == oleh)]
    return {'items': [ringkas_log(d) for d in items[:batas]], 'ringkasan': ringkasan,
            'pengunggah': sorted(pengunggah.values(), key=lambda p: p['terakhir'] or '', reverse=True)}


@router.get("/ujian/{ujian_id}/nilai/impor/{log_id}")
async def progres_impor_nilai(ujian_id: str, log_id: str, user: Dict = Depends(get_current_user)):
    """Progres satu impor (dipolling selama status 'proses') dan hasil akhirnya: ringkasan per sheet, baris gagal beserta
    penyebabnya, serta `persen` progres (0–100)."""
    await akses_nilai(user, ujian_id)
    doc = await db[KOLEKSI_IMPOR_LOG].find_one({'id': log_id, 'ujian_id': ujian_id}, {'_id': 0})
    if not doc:
        raise HTTPException(404, "Riwayat impor tidak ditemukan pada ujian ini")
    doc = await _tandai_macet(doc)
    total = doc.get('total_baris') or 0
    persen = 100 if doc.get('status') != 'proses' else (round(100 * (doc.get('diproses') or 0) / total) if total else 0)
    return {**ringkas_log(doc, dengan_galat=True), 'persen': persen}


MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'


@router.get("/ujian/{ujian_id}/nilai/template")
async def unduh_template_nilai(ujian_id: str, mapel_id: str = Query(..., min_length=1), jenjang: int = Query(..., ge=1, le=12),
                               user: Dict = Depends(get_current_user)):
    """Template nilai UAS (.xlsx) SATU mapel & SATU jenjang: satu sheet per kelas jenjang itu pada semester ujian, nama
    siswa aktif sudah terisi (urut nama) beserta nilai UAS yang sudah tersimpan. Diunggah kembali lewat POST nilai/impor."""
    ujian = (await akses_nilai(user, ujian_id))['ujian']
    mapel = await db.subjects.find_one({'id': mapel_id}, {'_id': 0, 'id': 1, 'name': 1})
    if not mapel:
        raise HTTPException(404, "Mata pelajaran tidak ditemukan")
    kelas = await kelas_jenjang(ujian['semester_id'], jenjang)
    if not kelas:
        raise HTTPException(404, f"Tidak ada kelas {jenjang} pada semester ujian ini")
    ids = {c['id'] for c in kelas}
    siswa = [s for s in await siswa_semester(ujian['semester_id']) if s.get('kelas_id') in ids]
    nilai = {d['siswa_id']: d.get('nilai') for d in await db[KOLEKSI_NILAI].find(
        {'ujian_id': ujian_id, 'mapel_id': mapel_id}, {'_id': 0, 'siswa_id': 1, 'nilai': 1}).to_list(20000)}
    isi = buat_template_nilai(ujian, mapel, jenjang, kelas, siswa, nilai)
    return Response(isi, media_type=MIME_XLSX,
                    headers={'Content-Disposition': f'attachment; filename="{nama_berkas_template_nilai(mapel, jenjang)}"',
                             'Access-Control-Expose-Headers': 'Content-Disposition'})


# ---- Nilai UAS di akun guru mata pelajaran & rapor ----
class EntriUasGuru(BaseModel):
    student_id: str = Field(..., min_length=1, max_length=64)
    nilai_uas: Optional[float] = Field(None, ge=0, le=100)


class UasGuruIn(BaseModel):
    class_id: str = Field(..., min_length=1, max_length=64)
    subject_id: str = Field(..., min_length=1, max_length=64)
    entries: List[EntriUasGuru] = Field(..., min_length=1, max_length=200)


async def _pengampu(user: Dict[str, Any], class_id: str, subject_id: str) -> bool:
    if adalah_pengelola(user):
        return True
    return bool(await db.schedules.find_one({'class_id': class_id, 'subject_id': subject_id, 'teacher_id': user.get('id')}, {'_id': 0, 'id': 1}))


@router.get("/ujian/nilai/masa-guru")
async def masa_nilai_guru(class_id: str = Query(..., min_length=1), subject_id: str = Query(..., min_length=1),
                          user: Dict = Depends(get_current_user)):
    """Status ubah nilai UAS untuk halaman Input Nilai guru: UAS semester konteks lihat & masa ujian/remidi yang sedang
    dibuka. -> { boleh_ubah, pesan, masa: {jenis, mulai, selesai}|null, ujian_id, ujian_nama }. Bukan pengampu: boleh_ubah false."""
    ctx = await get_active_context(user)
    status = await status_ubah_guru(db, await ujian_uas_semester(db, ctx.get('semester_id')), hari_ini_wib(), adalah_pengelola(user))
    if status['boleh_ubah'] and not await _pengampu(user, class_id, subject_id):
        status = {**status, 'boleh_ubah': False, 'pesan': 'Anda bukan pengampu mapel ini di kelas tersebut.'}
    return status


@router.put("/ujian/nilai/guru")
async def simpan_uas_guru(body: UasGuruIn, request: Request, user: Dict = Depends(get_current_user)):
    """Guru pengampu mengubah nilai UAS kelasnya (hanya di dalam masa ujian/remidi; admin selalu). Nilai tersimpan di
    nilai_ujian (sumber input_guru) beserta jejak riwayat, lalu langsung tersinkron ke kolom UAS rapor. -> { disimpan }"""
    if not await _pengampu(user, body.class_id, body.subject_id):
        raise HTTPException(403, "Anda bukan pengampu mapel ini di kelas tersebut")
    ctx = await get_active_context(user)
    ujian = await ujian_uas_semester(db, ctx.get('semester_id'))
    status = await status_ubah_guru(db, ujian, hari_ini_wib(), adalah_pengelola(user))
    if not status['boleh_ubah']:
        raise HTTPException(403, status['pesan'])
    kelas = await db.classes.find_one({'id': body.class_id, 'semester_id': ujian['semester_id']}, {'_id': 0, 'id': 1, 'name': 1, 'grade': 1})
    if not kelas:
        raise HTTPException(404, "Kelas tidak ditemukan pada semester UAS ini")
    siswa = {s['id']: s for s in await siswa_semester(ujian['semester_id']) if s.get('kelas_id') == body.class_id}
    asing = [e.student_id for e in body.entries if e.student_id not in siswa]
    if asing:
        raise HTTPException(400, f"{len(asing)} siswa bukan anggota aktif kelas {kelas.get('name')}")
    hasil = await simpan_nilai(ujian, body.subject_id, [(siswa[e.student_id], e.nilai_uas) for e in body.entries], 'input_guru', user)
    await log_audit(user, 'ujian_nilai_guru', KOLEKSI_NILAI, ujian['id'],
                    {'class_id': body.class_id, 'subject_id': body.subject_id, 'berubah': hasil['berubah'], 'masa': (status['masa'] or {}).get('jenis')},
                    request=request)
    return {'disimpan': hasil['berubah'], 'ujian_id': ujian['id']}


async def simpan_nilai(ujian: Dict[str, Any], mapel_id: str, isian: List[Any], sumber: str, user: Dict[str, Any]) -> Dict[str, int]:
    """Simpan [(siswa, nilai|None)] ke nilai_ujian: hanya yang berubah, masing-masing dengan jejak riwayat & sinkron rapor."""
    ada = {d['siswa_id']: d.get('nilai') for d in await db[KOLEKSI_NILAI].find(
        {'ujian_id': ujian['id'], 'mapel_id': mapel_id, 'siswa_id': {'$in': [s['id'] for s, _ in isian]}},
        {'_id': 0, 'siswa_id': 1, 'nilai': 1}).to_list(5000)}
    rapor = await konteks_rapor(db, ujian)
    berubah = 0
    for s, nilai in isian:
        nilai = ke_angka(nilai)
        if s['id'] in ada and ada[s['id']] == nilai or (s['id'] not in ada and nilai is None):
            continue
        dok = dokumen_nilai(ujian['id'], mapel_id, s, nilai, sumber, user)
        await simpan_dokumen_nilai(db, dok)
        await db[KOLEKSI_RIWAYAT].insert_one(dokumen_riwayat(dok, ada.get(s['id'])))
        await sinkron_rapor(db, rapor, dok, user.get('id') if sumber == 'input_guru' else None)
        berubah += 1
    return {'berubah': berubah}


@router.get("/grades/student/{student_id}")
async def nilai_rapor_siswa(student_id: str, user: Dict = Depends(get_current_user)):
    """Seluruh baris rapor satu siswa lintas tahun (dipakai tabel "Nilai Kelas 7–9" di halaman Rapor): mapel, kelas,
    nilai UAS hasil sinkron modul ujian, serta rerata ulangan (nilai_harian), rerata sumatif (nilai_sumatif) dan UTS dari
    Input Nilai guru mapel. Akses sama dengan /grades/rapor: admin, siswa itu sendiri, wali kelasnya."""
    siswa = await db.users.find_one({'id': student_id}, {'_id': 0, 'id': 1, 'student_class_id': 1})
    if not siswa:
        raise HTTPException(404, "Siswa tidak ditemukan")
    kelas_kini = await db.classes.find_one({'id': siswa.get('student_class_id')}, {'_id': 0, 'homeroom_teacher_id': 1}) or {}
    if not (adalah_pengelola(user) or user.get('id') == student_id or kelas_kini.get('homeroom_teacher_id') == user.get('id')):
        raise HTTPException(403, "Tidak diizinkan")
    baris = await db[KOLEKSI_RAPOR].find({'student_id': student_id}, {'_id': 0}).to_list(500)
    mapel = {m['id']: m for m in await db.subjects.find({'id': {'$in': list({b.get('subject_id') for b in baris})}},
                                                        {'_id': 0, 'id': 1, 'name': 1, 'code': 1}).to_list(500)}
    kelas = {c['id']: c for c in await db.classes.find({'id': {'$in': list({b.get('class_id') for b in baris})}},
                                                       {'_id': 0, 'id': 1, 'name': 1, 'grade': 1}).to_list(500)}
    tahun = {t['id']: t.get('name') for t in await db.academic_years.find(
        {'id': {'$in': list({b.get('academic_year_id') for b in baris})}}, {'_id': 0, 'id': 1, 'name': 1}).to_list(100)}
    hasil = []
    for b in baris:
        hasil.append({**{k: b.get(k) for k in ('id', 'subject_id', 'class_id', 'academic_year_id', 'semester', 'nilai_pengetahuan',
                                               'nilai_keterampilan', 'nilai_akhir', 'predicate', 'nilai_uas', 'nilai_uas_sumber')},
                      'nilai_uts': b.get('nilai_uts'), 'nilai_harian': b.get('nilai_harian'), 'nilai_sumatif': b.get('nilai_sumatif'),
                      'subject_name': (mapel.get(b.get('subject_id')) or {}).get('name'), 'subject_code': (mapel.get(b.get('subject_id')) or {}).get('code'),
                      'class_name': (kelas.get(b.get('class_id')) or {}).get('name'), 'jenjang': (kelas.get(b.get('class_id')) or {}).get('grade'),
                      'tahun_pelajaran': tahun.get(b.get('academic_year_id'))})
    # urut kronologis: tahun pelajaran ('2025/2026' < '2026/2027'), ganjil sebelum genap, lalu nama mapel
    return sorted(hasil, key=lambda x: (str(x.get('tahun_pelajaran') or ''), {'ganjil': 0, 'genap': 1}.get(x.get('semester'), 2),
                                        str(x.get('subject_name') or '')))


# ---- Masa ujian & remidi (jendela guru mapel boleh mengubah nilai UAS) ----
MASA_KOSONG = {'aktif': False, 'mulai': None, 'selesai': None}


def ringkas_masa(doc: Optional[Dict[str, Any]], boleh_ubah: bool) -> Dict[str, Any]:
    doc = doc or {}
    return {'boleh_ubah': boleh_ubah, 'ujian': {**MASA_KOSONG, **(doc.get('ujian') or {})}, 'remidi': {**MASA_KOSONG, **(doc.get('remidi') or {})},
            'terbuka_sekarang': masa_terbuka(doc, hari_ini_wib()), 'diubah': doc.get('diubah')}


@router.get("/ujian/{ujian_id}/nilai/masa")
async def ambil_masa_nilai(ujian_id: str, user: Dict = Depends(get_current_user)):
    """Masa ujian & remidi satu UAS -> { boleh_ubah, ujian: Masa, remidi: Masa, terbuka_sekarang, diubah }.
    `boleh_ubah` false untuk ujian arsip/bukan UAS (hanya dilihat)."""
    ujian = (await akses_nilai(user, ujian_id))['ujian']
    boleh = alasan_tidak_bisa_impor(ujian, (await get_active_context(user)).get('semester_id')) is None
    return ringkas_masa(await db[KOLEKSI_MASA].find_one({'ujian_id': ujian_id}, {'_id': 0}), boleh)


@router.put("/ujian/{ujian_id}/nilai/masa")
async def simpan_masa_nilai(ujian_id: str, body: MasaNilaiIn, request: Request, user: Dict = Depends(get_current_user)):
    """Atur masa ujian & remidi (admin, ketua & sekretaris panitia). Selama salah satu masa terbuka (tanggal WIB), guru
    pengampu dapat mengubah nilai UAS kelasnya di Input Nilai; di luar masa nilai terkunci bagi guru."""
    await akses_nilai(user, ujian_id, tulis=True, cek_kunci=False)
    isi = body.model_dump()
    diubah = {'oleh': user.get('id'), 'oleh_nama': user.get('full_name') or user.get('username'), 'pada': sekarang_wib().isoformat()}
    lama = await db[KOLEKSI_MASA].find_one({'ujian_id': ujian_id}, {'_id': 0})
    await db[KOLEKSI_MASA].update_one({'ujian_id': ujian_id}, {'$set': {**isi, 'diubah': diubah}}, upsert=True)
    await log_audit(user, 'ujian_nilai_masa', KOLEKSI_MASA, ujian_id,
                    {'sebelum': {k: (lama or {}).get(k) for k in ('ujian', 'remidi')}, 'sesudah': isi}, request=request)
    return ringkas_masa({**isi, 'diubah': diubah}, True)


# ---- Edit nilai per kelas oleh panitia (dengan jejak audit) ----
class EntriNilaiKelas(BaseModel):
    siswa_id: str = Field(..., min_length=1, max_length=64)
    nilai: Optional[float] = Field(None, ge=0, le=100)


class NilaiKelasIn(BaseModel):
    mapel_id: str = Field(..., min_length=1, max_length=64)
    entries: List[EntriNilaiKelas] = Field(..., min_length=1, max_length=200)


async def _kelas_ujian(ujian: Dict[str, Any], kelas_id: str) -> Dict[str, Any]:
    kelas = await db.classes.find_one({'id': kelas_id, 'semester_id': ujian['semester_id']}, {'_id': 0, 'id': 1, 'name': 1, 'grade': 1})
    if not kelas:
        raise HTTPException(404, "Kelas tidak ditemukan pada semester ujian ini")
    return kelas


async def _mapel(mapel_id: str) -> Dict[str, Any]:
    mapel = await db.subjects.find_one({'id': mapel_id}, {'_id': 0, 'id': 1, 'name': 1})
    if not mapel:
        raise HTTPException(404, "Mata pelajaran tidak ditemukan")
    return mapel


@router.get("/ujian/{ujian_id}/nilai/kelas/{kelas_id}")
async def nilai_kelas(ujian_id: str, kelas_id: str, mapel_id: str = Query(..., min_length=1), user: Dict = Depends(get_current_user)):
    """Nilai UAS satu kelas & mapel untuk form edit panitia -> { kelas, mapel, boleh_ubah, alasan_kunci, items: [{ siswa_id,
    nis, nama, nilai, sumber, diedit_oleh_nama, waktu }] } (siswa aktif urut nama)."""
    akses = await akses_nilai(user, ujian_id)
    ujian = akses['ujian']
    kelas, mapel = await _kelas_ujian(ujian, kelas_id), await _mapel(mapel_id)
    alasan = alasan_tidak_bisa_impor(ujian, (await get_active_context(user)).get('semester_id'))
    if not alasan and not akses['pengelola']:
        alasan = alasan_kunci_nilai(await db[KOLEKSI_MASA].find_one({'ujian_id': ujian_id}, {'_id': 0}), hari_ini_wib())
    nilai = {d['siswa_id']: d for d in await db[KOLEKSI_NILAI].find({'ujian_id': ujian_id, 'mapel_id': mapel_id, 'kelas_id': kelas_id},
                                                                    {'_id': 0}).to_list(2000)}
    siswa = sorted((s for s in await siswa_semester(ujian['semester_id']) if s.get('kelas_id') == kelas_id),
                   key=lambda s: ' '.join(str(s.get('full_name') or '').lower().split()))
    return {
        'kelas': {'id': kelas['id'], 'nama': kelas.get('name'), 'jenjang': kelas.get('grade')}, 'mapel': {'id': mapel['id'], 'nama': mapel.get('name')},
        'boleh_ubah': alasan is None, 'alasan_kunci': alasan,
        'items': [{'siswa_id': s['id'], 'nis': s.get('nis'), 'nama': s.get('full_name'), 'nilai': (nilai.get(s['id']) or {}).get('nilai'),
                   'sumber': (nilai.get(s['id']) or {}).get('sumber'), 'diedit_oleh_nama': (nilai.get(s['id']) or {}).get('diedit_oleh_nama'),
                   'waktu': (nilai.get(s['id']) or {}).get('waktu')} for s in siswa],
    }


@router.put("/ujian/{ujian_id}/nilai/kelas/{kelas_id}")
async def simpan_nilai_kelas(ujian_id: str, kelas_id: str, body: NilaiKelasIn, request: Request, user: Dict = Depends(get_current_user)):
    """Panitia (admin, ketua, sekretaris) mengedit nilai UAS satu kelas & mapel. Hanya nilai yang berubah disimpan
    (sumber input_panitia), masing-masing tercatat di nilai_ujian_riwayat (nilai lama -> baru, oleh, waktu), tersinkron ke
    rapor, dan dirangkum di audit log. Ditolak 423 bila nilai terkunci masa ujian/remidi (kecuali admin). -> { disimpan }"""
    ujian = (await akses_nilai(user, ujian_id, tulis=True))['ujian']
    kelas, _ = await _kelas_ujian(ujian, kelas_id), await _mapel(body.mapel_id)
    siswa = {s['id']: s for s in await siswa_semester(ujian['semester_id']) if s.get('kelas_id') == kelas_id}
    asing = [e.siswa_id for e in body.entries if e.siswa_id not in siswa]
    if asing:
        raise HTTPException(400, f"{len(asing)} siswa bukan anggota aktif kelas {kelas.get('name')}")
    sebelum = {d['siswa_id']: d.get('nilai') for d in await db[KOLEKSI_NILAI].find(
        {'ujian_id': ujian_id, 'mapel_id': body.mapel_id, 'siswa_id': {'$in': list(siswa)}}, {'_id': 0, 'siswa_id': 1, 'nilai': 1}).to_list(2000)}
    hasil = await simpan_nilai(ujian, body.mapel_id, [(siswa[e.siswa_id], e.nilai) for e in body.entries], 'input_panitia', user)
    perubahan = [{'siswa_id': e.siswa_id, 'lama': sebelum.get(e.siswa_id), 'baru': ke_angka(e.nilai)} for e in body.entries
                 if sebelum.get(e.siswa_id) != ke_angka(e.nilai)]
    await log_audit(user, 'ujian_nilai_edit', KOLEKSI_NILAI, ujian_id,
                    {'kelas_id': kelas_id, 'mapel_id': body.mapel_id, 'berubah': hasil['berubah'], 'perubahan': perubahan[:200]}, request=request)
    return {'disimpan': hasil['berubah']}


@router.get("/ujian/{ujian_id}/nilai/riwayat")
async def riwayat_nilai(ujian_id: str, mapel_id: str = Query(..., min_length=1), siswa_id: Optional[str] = None,
                        kelas_id: Optional[str] = None, batas: int = Query(200, ge=1, le=1000), user: Dict = Depends(get_current_user)):
    """Jejak perubahan nilai UAS (terbaru dulu) satu mapel, opsional satu siswa/kelas -> { items: [{ siswa_id, kelas_id,
    nilai_lama, nilai_baru, sumber, oleh_nama, waktu, impor_log_id }] }."""
    await akses_nilai(user, ujian_id)
    q: Dict[str, Any] = {'ujian_id': ujian_id, 'mapel_id': mapel_id}
    if siswa_id:
        q['siswa_id'] = siswa_id
    if kelas_id:
        q['kelas_id'] = kelas_id
    docs = await db[KOLEKSI_RIWAYAT].find(q, {'_id': 0}).sort('waktu', -1).to_list(batas)
    return {'items': [{k: d.get(k) for k in ('siswa_id', 'kelas_id', 'nilai_lama', 'nilai_baru', 'sumber', 'oleh_nama', 'waktu', 'impor_log_id')}
                      for d in docs]}


# ---- Rekap & integrasi rapor ----
@router.get("/ujian/{ujian_id}/nilai/rekap")
async def rekap_nilai(ujian_id: str, mapel_id: str = Query(..., min_length=1), jenjang: int = Query(..., ge=1, le=12),
                      user: Dict = Depends(get_current_user)):
    """Keterisian nilai UAS satu mapel per kelas pada satu jenjang -> { kelas: [{ kelas_id, nama, total, terisi, rata,
    guru_nama, tersinkron }] }: total = siswa aktif, terisi = yang sudah bernilai, tersinkron = baris rapor kelas itu yang
    sudah memuat nilai UAS ujian ini, guru_nama = pengampu mapel di kelas itu (jadwal)."""
    ujian = (await akses_nilai(user, ujian_id))['ujian']
    await _mapel(mapel_id)
    kelas = await kelas_jenjang(ujian['semester_id'], jenjang)
    ids = [c['id'] for c in kelas]
    jumlah: Dict[str, int] = {}
    for s in await siswa_semester(ujian['semester_id']):
        if s.get('kelas_id') in ids:
            jumlah[s['kelas_id']] = jumlah.get(s['kelas_id'], 0) + 1
    nilai: Dict[str, List[Dict[str, Any]]] = {}
    for d in await db[KOLEKSI_NILAI].find({'ujian_id': ujian_id, 'mapel_id': mapel_id, 'kelas_id': {'$in': ids}},
                                          {'_id': 0, 'kelas_id': 1, 'nilai': 1}).to_list(20000):
        nilai.setdefault(d['kelas_id'], []).append(d)
    jadwal = {j['class_id']: j.get('teacher_id') for j in await db.schedules.find(
        {'class_id': {'$in': ids}, 'subject_id': mapel_id}, {'_id': 0, 'class_id': 1, 'teacher_id': 1}).to_list(500)}
    guru = {u['id']: u.get('full_name') for u in await db.users.find(
        {'id': {'$in': [t for t in jadwal.values() if t]}}, {'_id': 0, 'id': 1, 'full_name': 1}).to_list(500)}
    sinkron: Dict[str, int] = {}
    for g in await db[KOLEKSI_RAPOR].find({'class_id': {'$in': ids}, 'subject_id': mapel_id, 'nilai_uas_ujian_id': ujian_id,
                                           'nilai_uas': {'$ne': None}}, {'_id': 0, 'class_id': 1}).to_list(20000):
        sinkron[g['class_id']] = sinkron.get(g['class_id'], 0) + 1
    return {'kelas': [{'kelas_id': c['id'], 'nama': c.get('name'), **rekap_kelas(nilai.get(c['id'], []), jumlah.get(c['id'], 0)),
                       'guru_nama': guru.get(jadwal.get(c['id'])), 'tersinkron': sinkron.get(c['id'], 0)} for c in kelas]}


class SinkronIn(BaseModel):
    mapel_id: Optional[str] = Field(None, max_length=64)


@router.post("/ujian/{ujian_id}/nilai/sinkron-rapor")
async def sinkron_ulang_rapor(ujian_id: str, request: Request, body: SinkronIn = SinkronIn(), user: Dict = Depends(get_current_user)):
    """Sinkron ulang seluruh nilai UAS satu ujian (opsional satu mapel) ke kolom UAS rapor — untuk memulihkan baris rapor
    yang terhapus/dibuat ulang modul E-Rapor. Hanya admin. -> { disinkron }"""
    akses = await akses_nilai(user, ujian_id, tulis=True, cek_kunci=False)
    if not akses['pengelola']:
        raise HTTPException(403, "Sinkron ulang rapor hanya untuk admin")
    q: Dict[str, Any] = {'ujian_id': ujian_id}
    if body.mapel_id:
        q['mapel_id'] = body.mapel_id
    rapor = await konteks_rapor(db, akses['ujian'])
    if not rapor:
        raise HTTPException(400, "Semester ujian tidak dikenali (ganjil/genap); periksa data semester")
    docs = await db[KOLEKSI_NILAI].find(q, {'_id': 0}).to_list(50000)
    for d in docs:
        await sinkron_rapor(db, rapor, d)
    await log_audit(user, 'ujian_nilai_sinkron_rapor', KOLEKSI_RAPOR, ujian_id, {'mapel_id': body.mapel_id, 'jumlah': len(docs)}, request=request)
    return {'disinkron': len(docs)}
