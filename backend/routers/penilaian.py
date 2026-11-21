"""API Input Nilai guru mapel: tab Ulangan, Sumatif, UTS (kolom penilaian) + mode kolom per kelas–mapel–semester,
template Excel & impor. UAS tetap lewat modul Ujian Madrasah (/ujian/nilai/guru) — di sini hanya ditampilkan.

Akses: admin, atau guru pengampu (jadwal mengajar kelas–mapel itu).
"""
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import Response

from core import db, get_active_academic_year, get_current_user, log_audit
from penilaian import (
    FIELD_RAPOR, JENIS_KOLOM, KKTP_BAWAAN, KOLEKSI_KOLOM, KOLEKSI_MODE, KOLEKSI_RAPOR, LABEL_JENIS, MODE_BAWAAN, KolomIn,
    KolomUbahIn, ModeIn, isian_bersih, kolom_berisi, rekap_siswa, ringkas_kolom,
)
from rombel import anggota_rombel_ids
from routers._shared import FILTER_SISWA_AKTIF
from ujian import sekarang_wib

router = APIRouter()


def _stempel(user: Dict[str, Any]) -> Dict[str, Any]:
    return {'oleh': user.get('id'), 'oleh_nama': user.get('full_name') or user.get('username'), 'pada': sekarang_wib().isoformat()}


async def _konteks(user: Dict[str, Any], class_id: str, subject_id: str, semester: str) -> Dict[str, Any]:
    """Penjaga akses + konteks: kelas, mapel, tahun ajaran aktif, kunci kelas–mapel–semester. 403 bila bukan pengampu."""
    kelas = await db.classes.find_one({'id': class_id}, {'_id': 0})
    if not kelas:
        raise HTTPException(404, 'Kelas tidak ditemukan')
    mapel = await db.subjects.find_one({'id': subject_id}, {'_id': 0, 'id': 1, 'name': 1, 'code': 1})
    if not mapel:
        raise HTTPException(404, 'Mata pelajaran tidak ditemukan')
    if 'admin' not in (user.get('roles') or []):
        if not await db.schedules.find_one({'class_id': class_id, 'subject_id': subject_id, 'teacher_id': user.get('id')}, {'_id': 0, 'id': 1}):
            raise HTTPException(403, 'Anda bukan pengampu mapel ini di kelas tersebut')
    ay = await get_active_academic_year()
    kunci = {'class_id': class_id, 'subject_id': subject_id, 'academic_year_id': (ay or {}).get('id'), 'semester': semester}
    return {'kelas': kelas, 'mapel': mapel, 'ay': ay, 'kunci': kunci}


async def _siswa(kelas: Dict[str, Any]) -> List[Dict[str, Any]]:
    ids = await anggota_rombel_ids(kelas)
    docs = await db.users.find({'id': {'$in': ids}, 'roles': 'siswa', **FILTER_SISWA_AKTIF},
                               {'_id': 0, 'id': 1, 'full_name': 1, 'nisn': 1, 'nis': 1, 'gender': 1}).to_list(500)
    jk = lambda g: 'L' if str(g or '').upper().startswith('L') else ('P' if str(g or '').upper().startswith('P') else '')  # noqa: E731
    return sorted(({'id': d['id'], 'nama': d.get('full_name') or '', 'nisn': d.get('nisn') or '', 'nis': d.get('nis') or '',
                    'jk': jk(d.get('gender'))} for d in docs), key=lambda s: s['nama'].lower())


async def _mode(kunci: Dict[str, Any]) -> str:
    d = await db[KOLEKSI_MODE].find_one(kunci, {'_id': 0, 'mode': 1})
    return (d or {}).get('mode') or MODE_BAWAAN


async def _kolom(kunci: Dict[str, Any]) -> List[Dict[str, Any]]:
    docs = await db[KOLEKSI_KOLOM].find(kunci, {'_id': 0}).to_list(500)
    return sorted(docs, key=lambda k: (JENIS_KOLOM.index(k.get('jenis')) if k.get('jenis') in JENIS_KOLOM else 9, k.get('ke') or 0, k.get('dibuat_pada') or ''))


async def sinkron_rapor(kunci: Dict[str, Any], mode: str, siswa_ids: List[str], guru_id: Optional[str]) -> None:
    """Tulis rerata ulangan, rerata sumatif, dan nilai UTS tiap siswa ke grade_entries (baris dibuat bila belum ada)."""
    rekap = rekap_siswa(await _kolom(kunci), mode, siswa_ids)
    waktu = sekarang_wib().isoformat()
    for sid, r in rekap.items():
        kunci_rapor = {'student_id': sid, **kunci}
        ubah = {FIELD_RAPOR[j]: r[j] for j in JENIS_KOLOM}
        ubah['penilaian_diperbarui'] = waktu
        ada = await db[KOLEKSI_RAPOR].find_one(kunci_rapor, {'_id': 0, 'id': 1})
        if ada:
            await db[KOLEKSI_RAPOR].update_one({'id': ada['id']}, {'$set': ubah})
        elif any(r[j] is not None for j in JENIS_KOLOM):
            await db[KOLEKSI_RAPOR].insert_one({'id': str(uuid.uuid4()), **kunci_rapor, 'teacher_id': guru_id, 'nilai_pengetahuan': None,
                                                'nilai_keterampilan': None, 'nilai_akhir': None, 'predicate': None, 'description': None,
                                                **ubah, 'submitted_by': guru_id, 'submitted_at': waktu})


def _nilai_valid(nilai: Dict[str, Any], mode: str, siswa_ids: set) -> Dict[str, Dict[str, float]]:
    asing = [sid for sid in nilai if sid not in siswa_ids]
    if asing:
        raise HTTPException(400, f'{len(asing)} siswa bukan anggota aktif kelas ini')
    hasil = {}
    for sid, isian in nilai.items():
        bersih = isian_bersih(isian.model_dump() if hasattr(isian, 'model_dump') else dict(isian), mode)
        if bersih:
            hasil[sid] = bersih
    return hasil


async def ringkasan_penilaian(k: Dict[str, Any]) -> Dict[str, Any]:
    siswa = await _siswa(k['kelas'])
    mode = await _mode(k['kunci'])
    kolom = await _kolom(k['kunci'])
    ids = [s['id'] for s in siswa]
    uas = {g['student_id']: g.get('nilai_uas') for g in await db[KOLEKSI_RAPOR].find(
        {**k['kunci'], 'student_id': {'$in': ids}}, {'_id': 0, 'student_id': 1, 'nilai_uas': 1}).to_list(1000)}
    ringkas = [ringkas_kolom(x, mode) for x in kolom]
    rekap = rekap_siswa(kolom, mode, ids)
    for sid in ids:
        rekap[sid]['uas'] = uas.get(sid)
    return {
        'kelas': {'id': k['kelas']['id'], 'nama': k['kelas'].get('name')}, 'mapel': {'id': k['mapel']['id'], 'nama': k['mapel'].get('name')},
        'semester': k['kunci']['semester'], 'tahun_pelajaran': (k['ay'] or {}).get('name'),
        'mode': mode, 'mode_terkunci': any(kolom_berisi(x) for x in kolom), 'kktp_bawaan': KKTP_BAWAAN,
        'siswa': siswa,
        'kolom': {'ulangan': [x for x in ringkas if x['jenis'] == 'ulangan'], 'sumatif': [x for x in ringkas if x['jenis'] == 'sumatif'],
                  'uts': next((x for x in ringkas if x['jenis'] == 'uts'), None)},
        'rekap': rekap,
    }


@router.get("/penilaian/kelas/{class_id}/mapel/{subject_id}")
async def ambil_penilaian(class_id: str, subject_id: str, semester: str = Query(..., min_length=1, max_length=20),
                          user: Dict = Depends(get_current_user)):
    """Seluruh penilaian satu kelas–mapel–semester: siswa, mode kolom, kolom ulangan & sumatif, kolom UTS (atau null),
    serta rekap per siswa {ulangan: rerata, sumatif: rerata, uts, uas}."""
    return await ringkasan_penilaian(await _konteks(user, class_id, subject_id, semester))


@router.put("/penilaian/kelas/{class_id}/mapel/{subject_id}/mode")
async def ubah_mode(class_id: str, subject_id: str, body: ModeIn, request: Request, user: Dict = Depends(get_current_user)):
    """Ganti mode kolom ('nilai' | 'pk') kelas–mapel–semester. Ditolak (409) bila sudah ada nilai yang diisi."""
    k = await _konteks(user, class_id, subject_id, body.semester)
    lama = await _mode(k['kunci'])
    if lama != body.mode:
        if any(kolom_berisi(x) for x in await _kolom(k['kunci'])):
            raise HTTPException(409, 'Mode kolom tidak dapat diganti karena sudah ada nilai yang diisi. Kosongkan/hapus nilai terlebih dahulu.')
        s = _stempel(user)
        await db[KOLEKSI_MODE].update_one(k['kunci'], {'$set': {**k['kunci'], 'mode': body.mode, 'diubah_oleh': s['oleh'],
                                                                'diubah_oleh_nama': s['oleh_nama'], 'diubah_pada': s['pada']}}, upsert=True)
        await log_audit(user, 'penilaian_mode', KOLEKSI_MODE, class_id, {**k['kunci'], 'dari': lama, 'ke': body.mode}, request=request)
    return await ringkasan_penilaian(k)


async def simpan_kolom_baru(k: Dict[str, Any], body: KolomIn, user: Dict[str, Any]) -> Dict[str, Any]:
    """Buat kolom ulangan/sumatif baru, atau isi/ubah kolom UTS (satu per kelas–mapel–semester)."""
    mode = await _mode(k['kunci'])
    siswa_ids = {s['id'] for s in await _siswa(k['kelas'])}
    nilai = _nilai_valid(body.nilai, mode, siswa_ids)
    s = _stempel(user)
    if body.jenis == 'uts':
        ada = await db[KOLEKSI_KOLOM].find_one({**k['kunci'], 'jenis': 'uts'}, {'_id': 0, 'id': 1})
        if ada:
            await db[KOLEKSI_KOLOM].update_one({'id': ada['id']}, {'$set': {'ringkasan': body.ringkasan, 'kktp': body.kktp, 'nilai': nilai,
                                                                            'diubah_oleh': s['oleh'], 'diubah_oleh_nama': s['oleh_nama'],
                                                                            'diubah_pada': s['pada']}})
            return {'id': ada['id'], 'baru': False}
    elif await db[KOLEKSI_KOLOM].find_one({**k['kunci'], 'jenis': body.jenis, 'ke': body.ke}, {'_id': 0, 'id': 1}):
        raise HTTPException(409, f"{LABEL_JENIS[body.jenis]} ke-{body.ke} sudah ada. Gunakan nomor lain atau ubah kolom tersebut.")
    dok = {'id': str(uuid.uuid4()), **k['kunci'], 'jenis': body.jenis, 'ke': 1 if body.jenis == 'uts' else body.ke,
           'ringkasan': body.ringkasan, 'kktp': body.kktp, 'nilai': nilai, 'dibuat_oleh': s['oleh'], 'dibuat_oleh_nama': s['oleh_nama'],
           'dibuat_pada': s['pada'], 'diubah_oleh': s['oleh'], 'diubah_oleh_nama': s['oleh_nama'], 'diubah_pada': s['pada']}
    await db[KOLEKSI_KOLOM].insert_one(dict(dok))
    return {'id': dok['id'], 'baru': True}


@router.post("/penilaian/kelas/{class_id}/mapel/{subject_id}/kolom")
async def tambah_kolom(class_id: str, subject_id: str, body: KolomIn, request: Request, user: Dict = Depends(get_current_user)):
    """Tambah kolom Ulangan/Sumatif (TP/LM ke-n, ringkasan, KKTP, nilai siswa) atau simpan kolom UTS."""
    k = await _konteks(user, class_id, subject_id, body.semester)
    h = await simpan_kolom_baru(k, body, user)
    await sinkron_rapor(k['kunci'], await _mode(k['kunci']), [s['id'] for s in await _siswa(k['kelas'])], user.get('id'))
    await log_audit(user, 'penilaian_kolom_simpan', KOLEKSI_KOLOM, h['id'],
                    {**k['kunci'], 'jenis': body.jenis, 'ke': body.ke, 'kktp': body.kktp, 'jumlah_nilai': len(body.nilai)}, request=request)
    return {'kolom_id': h['id'], **await ringkasan_penilaian(k)}


async def _kolom_akses(user: Dict[str, Any], kolom_id: str):
    kolom = await db[KOLEKSI_KOLOM].find_one({'id': kolom_id}, {'_id': 0})
    if not kolom:
        raise HTTPException(404, 'Kolom nilai tidak ditemukan')
    k = await _konteks(user, kolom['class_id'], kolom['subject_id'], kolom['semester'])
    return kolom, k


@router.put("/penilaian/kolom/{kolom_id}")
async def ubah_kolom(kolom_id: str, body: KolomUbahIn, request: Request, user: Dict = Depends(get_current_user)):
    """Ubah TP/LM ke, ringkasan, KKTP, dan/atau seluruh nilai satu kolom (nilai dikirim lengkap menggantikan yang lama)."""
    kolom, k = await _kolom_akses(user, kolom_id)
    mode = await _mode(k['kunci'])
    ubah: Dict[str, Any] = {}
    if body.ke is not None and kolom['jenis'] != 'uts' and body.ke != kolom.get('ke'):
        if await db[KOLEKSI_KOLOM].find_one({**k['kunci'], 'jenis': kolom['jenis'], 'ke': body.ke}, {'_id': 0, 'id': 1}):
            raise HTTPException(409, f"{LABEL_JENIS[kolom['jenis']]} ke-{body.ke} sudah ada")
        ubah['ke'] = body.ke
    if body.ringkasan is not None:
        ubah['ringkasan'] = body.ringkasan
    if body.kktp is not None:
        ubah['kktp'] = body.kktp
    siswa_ids = [s['id'] for s in await _siswa(k['kelas'])]
    if body.nilai is not None:
        ubah['nilai'] = _nilai_valid(body.nilai, mode, set(siswa_ids))
    s = _stempel(user)
    ubah.update(diubah_oleh=s['oleh'], diubah_oleh_nama=s['oleh_nama'], diubah_pada=s['pada'])
    await db[KOLEKSI_KOLOM].update_one({'id': kolom_id}, {'$set': ubah})
    await sinkron_rapor(k['kunci'], mode, siswa_ids, user.get('id'))
    await log_audit(user, 'penilaian_kolom_ubah', KOLEKSI_KOLOM, kolom_id,
                    {'jenis': kolom['jenis'], 'ubah': sorted(k for k in ubah if not k.startswith('diubah'))}, request=request)
    return {'kolom_id': kolom_id, **await ringkasan_penilaian(k)}


@router.delete("/penilaian/kolom/{kolom_id}")
async def hapus_kolom(kolom_id: str, request: Request, user: Dict = Depends(get_current_user)):
    """Hapus satu kolom nilai beserta isinya; rerata siswa di rapor dihitung ulang."""
    kolom, k = await _kolom_akses(user, kolom_id)
    await db[KOLEKSI_KOLOM].delete_one({'id': kolom_id})
    await sinkron_rapor(k['kunci'], await _mode(k['kunci']), [s['id'] for s in await _siswa(k['kelas'])], user.get('id'))
    await log_audit(user, 'penilaian_kolom_hapus', KOLEKSI_KOLOM, kolom_id,
                    {'jenis': kolom['jenis'], 'ke': kolom.get('ke'), 'jumlah_nilai': len(kolom.get('nilai') or {})}, request=request)
    return await ringkasan_penilaian(k)


# ---- Template Excel & impor (hasil impor dikembalikan ke layar untuk diperiksa, lalu disimpan lewat endpoint kolom) ----


@router.get("/penilaian/kelas/{class_id}/mapel/{subject_id}/template")
async def unduh_template(class_id: str, subject_id: str, semester: str = Query(..., min_length=1, max_length=20),
                         jenis: str = Query(..., pattern='^(ulangan|sumatif|uts|uas)$'), kolom_id: str = '',
                         user: Dict = Depends(get_current_user)):
    """Template .xlsx berisi siswa kelas ini (urut nama). Kolom Nilai, atau Pengetahuan & Keterampilan sesuai mode
    (UAS selalu satu kolom Nilai). Nilai yang sudah ada (kolom `kolom_id`, kolom UTS, atau nilai UAS) ikut terisi."""
    from penilaian_xlsx import buat_template, nama_berkas_template
    k = await _konteks(user, class_id, subject_id, semester)
    siswa = await _siswa(k['kelas'])
    mode = await _mode(k['kunci'])
    kolom, nilai = None, {}
    if jenis == 'uas':
        nilai = {g['student_id']: {'nilai': g.get('nilai_uas')} for g in await db[KOLEKSI_RAPOR].find(
            {**k['kunci'], 'student_id': {'$in': [s['id'] for s in siswa]}}, {'_id': 0, 'student_id': 1, 'nilai_uas': 1}).to_list(1000)
            if g.get('nilai_uas') is not None}
    else:
        q = {'id': kolom_id, **k['kunci']} if kolom_id else ({**k['kunci'], 'jenis': 'uts'} if jenis == 'uts' else None)
        kolom = await db[KOLEKSI_KOLOM].find_one(q, {'_id': 0}) if q else None
        if kolom_id and not kolom:
            raise HTTPException(404, 'Kolom nilai tidak ditemukan')
        nilai = (kolom or {}).get('nilai') or {}
    isi = buat_template(jenis, mode, k['kelas'], k['mapel'], semester, (k['ay'] or {}).get('name'), siswa, nilai, kolom)
    nama = nama_berkas_template(jenis, k['mapel'], k['kelas'], semester, (kolom or {}).get('ke') if jenis in ('ulangan', 'sumatif') else None)
    return Response(isi, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    headers={'Content-Disposition': f'attachment; filename="{nama}"', 'Access-Control-Expose-Headers': 'Content-Disposition'})


@router.post("/penilaian/kelas/{class_id}/mapel/{subject_id}/impor")
async def baca_impor_nilai(class_id: str, subject_id: str, semester: str = Form(..., min_length=1, max_length=20),
                           jenis: str = Form(..., pattern='^(ulangan|sumatif|uts|uas)$'), berkas: UploadFile = File(...),
                           user: Dict = Depends(get_current_user)):
    """Baca berkas .xlsx (template atau buatan sendiri berkolom ID Siswa/NISN/Nama + Nilai) dan kembalikan nilai per
    siswa untuk ditampilkan di layar. TIDAK menyimpan apa pun. -> { nilai, terbaca, kosong, galat, galat_total }"""
    from penilaian_xlsx import MAKS_BERKAS, GalatBerkas, baca_impor
    k = await _konteks(user, class_id, subject_id, semester)
    isi = await berkas.read(MAKS_BERKAS + 1)
    try:
        return baca_impor(isi, jenis, await _mode(k['kunci']), class_id, subject_id, await _siswa(k['kelas']))
    except GalatBerkas as e:
        raise HTTPException(400, str(e)) from e
