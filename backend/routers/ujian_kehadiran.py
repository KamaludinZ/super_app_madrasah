"""API Ujian Madrasah — Daftar Hadir (sisi panitia): pantauan per sesi & ruang, tanda tangan, buka kunci beralasan,
dan tanda izin/sakit/tanpa keterangan sekali per hari.

Membaca: admin, panitia ujian itu, kepala madrasah & waka kurikulum (menu 'daftar_hadir'). Mengubah (buka kunci,
tanda harian): hanya admin; setiap perubahan tercatat (arsip buka kunci / dokumen tanda + audit_logs).
"""
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response

from core import db, get_current_user, log_audit
from routers.ujian import akses_ujian, ujian_semester_konteks, wajib_pengelola
from routers.ujian_formulir import jadwal_ujian
from ujian import KOLEKSI_RUANG, hari_ini_wib, jam_wib
from ujian_formulir import sesi_aktif
from ujian_kehadiran import (
    KOLEKSI_DH, KOLEKSI_DH_STATUS, KOLEKSI_DH_TTD, BukaKunciIn, StatusIn, ambil_status_sesi, buka_kunci, rekap_jenjang,
    rekap_status, riwayat_buka, simpan_tanda,
)
from ujian_ruang import peserta_ruang_ujian, urut_nama_ruang

router = APIRouter()


def _pilih_sesi(jadwal: List[Dict[str, Any]], sesi_id: str) -> Dict[str, Any]:
    if sesi_id:
        s = next((x for x in jadwal if x['id'] == sesi_id), None)
        if not s:
            raise HTTPException(404, "Sesi tidak ditemukan pada ujian ini")
        return s
    hari_ini = hari_ini_wib()
    return sesi_aktif(jadwal, hari_ini, jam_wib()) or next((x for x in jadwal if x['tanggal'] >= hari_ini), None) or jadwal[-1]


@router.get("/ujian/{ujian_id}/daftar-hadir")
async def daftar_hadir(ujian_id: str, sesi_id: str = '', ruang_id: str = '', user: Dict = Depends(get_current_user)):
    """Daftar hadir satu sesi: rekap semua ruang (hadir/izin/sakit/alpa/belum, lengkap) dan rincian peserta satu ruang
    (status, waktu kirim, ada TTD, catatan tanda, riwayat buka kunci). Sesi bawaan: sesi yang sedang berjalan."""
    a = await akses_ujian(user, ujian_id, 'daftar_hadir')
    jadwal = await jadwal_ujian(ujian_id)
    ruang = sorted(await db[KOLEKSI_RUANG].find({'ujian_id': ujian_id}, {'_id': 0}).to_list(500),
                   key=lambda r: urut_nama_ruang(r.get('nama_ruang') or ''))
    hasil = {'boleh_ubah': a['pengelola'], 'sesi': jadwal, 'sesi_id': None,
             'ruang': [{'id': r['id'], 'nama_ruang': r['nama_ruang'], 'jenjang': r.get('jenjang', [])} for r in ruang],
             'ruang_id': None, 'rekap': [], 'items': []}
    if not jadwal:
        return hasil
    sesi = _pilih_sesi(jadwal, sesi_id)
    hasil['sesi_id'] = sesi['id']
    if not ruang:
        return hasil
    pilihan = next((r for r in ruang if r['id'] == ruang_id), None) or ruang[0]
    hasil['ruang_id'] = pilihan['id']
    for r in ruang:
        peserta = await peserta_ruang_ujian(db, ujian_id, r['id'])
        status = await ambil_status_sesi(db, ujian_id, sesi, [p['id'] for p in peserta])
        hasil['rekap'].append({'ruang_id': r['id'], 'nama_ruang': r['nama_ruang'], **rekap_status(status)})
        if r['id'] == pilihan['id']:
            buka = await riwayat_buka(db, ujian_id, sesi['id'], [p['id'] for p in peserta])
            for p in peserta:
                st = status.get(p['id']) or {}
                k, t = st.get('kehadiran') or {}, st.get('tanda') or {}
                hasil['items'].append({
                    'id': k.get('id'), 'peserta_id': p['id'], 'nomor_peserta': p['nomor_peserta'] or '', 'nama': p['nama'],
                    'kelas': p['kelas'], 'jenjang': p['jenjang'], 'status': st.get('status'),
                    'waktu_kirim': k.get('waktu_kirim'), 'ada_ttd': bool(k.get('ada_ttd')),
                    'catatan': t.get('catatan') or '', 'ditandai_oleh_nama': t.get('ditandai_oleh_nama'),
                    'tanda_status': t.get('status'), 'riwayat_buka': buka.get(p['id'], []),
                })
    return hasil


@router.get("/ujian/{ujian_id}/daftar-hadir/rekap")
async def rekap_daftar_hadir(ujian_id: str, tanggal: str = '', user: Dict = Depends(get_current_user)):
    """Rekap daftar hadir per sesi -> per ruang -> per jenjang (total, hadir, izin, sakit, alpa, belum, lengkap, nomor
    hadir & tidak hadir) untuk satu tanggal (bawaan: hari ini bila ada sesi, selain itu semua sesi), beserta kelengkapan
    tiap ruang pada tanggal itu (semua sesinya lengkap)."""
    await akses_ujian(user, ujian_id, 'daftar_hadir')
    jadwal = await jadwal_ujian(ujian_id)
    if not tanggal and any(s['tanggal'] == hari_ini_wib() for s in jadwal):
        tanggal = hari_ini_wib()
    sesi_dipilih = [s for s in jadwal if not tanggal or s['tanggal'] == tanggal]
    ruang = sorted(await db[KOLEKSI_RUANG].find({'ujian_id': ujian_id}, {'_id': 0}).to_list(500),
                   key=lambda r: urut_nama_ruang(r.get('nama_ruang') or ''))
    peserta = {r['id']: await peserta_ruang_ujian(db, ujian_id, r['id']) for r in ruang}
    hasil, lengkap_ruang = [], {r['id']: True for r in ruang}
    for s in sesi_dipilih:
        per_ruang = []
        for r in ruang:
            st = await ambil_status_sesi(db, ujian_id, s, [p['id'] for p in peserta[r['id']]])
            semua = rekap_status(st)
            lengkap_ruang[r['id']] = lengkap_ruang[r['id']] and semua['lengkap']
            per_ruang.append({'ruang_id': r['id'], 'nama_ruang': r['nama_ruang'], **semua,
                              'jenjang': [{'jenjang': j, **x} for j, x in rekap_jenjang(peserta[r['id']], st).items()]})
        hasil.append({'sesi': s, 'ruang': per_ruang})
    return {'tanggal': tanggal or None, 'sesi': hasil,
            'kelengkapan': [{'ruang_id': r['id'], 'nama_ruang': r['nama_ruang'], 'lengkap': bool(sesi_dipilih) and lengkap_ruang[r['id']]}
                            for r in ruang]}


@router.get("/ujian/{ujian_id}/daftar-hadir/{kehadiran_id}/ttd")
async def ttd_kehadiran(ujian_id: str, kehadiran_id: str, user: Dict = Depends(get_current_user)):
    """PNG tanda tangan satu kiriman daftar hadir (hanya pengguna yang berhak membuka daftar hadir ujian ini)."""
    await akses_ujian(user, ujian_id, 'daftar_hadir')
    k = await db[KOLEKSI_DH].find_one({'id': kehadiran_id, 'ujian_id': ujian_id}, {'_id': 0, 'id': 1})
    t = await db[KOLEKSI_DH_TTD].find_one({'kehadiran_id': kehadiran_id}, {'_id': 0}) if k else None
    if not t or not t.get('png'):
        raise HTTPException(404, "Tanda tangan tidak ditemukan")
    return Response(bytes(t['png']), media_type='image/png', headers={'Cache-Control': 'private, max-age=300'})


@router.post("/ujian/{ujian_id}/daftar-hadir/{kehadiran_id}/buka-kunci")
async def buka_kunci_kehadiran(ujian_id: str, kehadiran_id: str, body: BukaKunciIn, request: Request,
                               user: Dict = Depends(wajib_pengelola)):
    """Buka kunci kiriman daftar hadir satu peserta (admin, alasan wajib 5–300 karakter). Kiriman lama beserta tanda
    tangannya dipindah ke arsip buka kunci (tidak dihapus permanen) sehingga peserta dapat mengirim ulang pada sesi itu.
    Alasan tersimpan di arsip & audit_logs."""
    await ujian_semester_konteks(user, ujian_id)
    k = await db[KOLEKSI_DH].find_one({'id': kehadiran_id, 'ujian_id': ujian_id}, {'_id': 0})
    if not k:
        raise HTTPException(404, "Kiriman daftar hadir tidak ditemukan (mungkin kuncinya sudah dibuka)")
    await buka_kunci(db, k, user, body.alasan)
    await log_audit(user, 'ujian_daftar_hadir_buka_kunci', KOLEKSI_DH, kehadiran_id, {
        'ujian_id': ujian_id, 'sesi_id': k.get('sesi_id'), 'peserta_id': k.get('peserta_id'), 'alasan': body.alasan}, request=request)
    return {'ok': True, 'peserta_id': k['peserta_id'],
            'riwayat_buka': (await riwayat_buka(db, ujian_id, k['sesi_id'], [k['peserta_id']])).get(k['peserta_id'], [])}


# PERHATIAN: rute statis /daftar-hadir/status harus terdaftar sebelum rute berparameter /daftar-hadir/{id}/... (beda
# metode, tetapi tetap dijaga agar jelas).
@router.put("/ujian/{ujian_id}/daftar-hadir/status")
async def tandai_status(ujian_id: str, body: StatusIn, request: Request, user: Dict = Depends(wajib_pengelola)):
    """Tandai peserta izin/sakit/tanpa keterangan beserta catatannya (admin) — CUKUP SEKALI PER HARI: satu tanda per
    peserta per tanggal, berlaku untuk semua sesi tanggal itu yang tidak diisi hadir oleh peserta. Catatan wajib untuk
    izin & sakit; status null menghapus tanda. Tanggal harus tanggal yang punya sesi ujian."""
    await ujian_semester_konteks(user, ujian_id)
    galat = body.galat()
    if galat:
        raise HTTPException(400, galat)
    p = await db['peserta_ruang'].find_one({'id': body.peserta_id, 'ujian_id': ujian_id}, {'_id': 0, 'id': 1, 'nama': 1})
    if not p:
        raise HTTPException(404, "Peserta tidak ditemukan pada ujian ini")
    sesi = [s for s in await jadwal_ujian(ujian_id) if s['tanggal'] == body.tanggal]
    if not sesi:
        raise HTTPException(400, f"Tidak ada sesi ujian pada tanggal {body.tanggal}")
    lama = await simpan_tanda(db, ujian_id, body, user)
    hadir = await db[KOLEKSI_DH].count_documents({'peserta_id': body.peserta_id, 'sesi_id': {'$in': [s['id'] for s in sesi]}})
    await log_audit(user, 'ujian_daftar_hadir_tanda', KOLEKSI_DH_STATUS, body.peserta_id, {
        'ujian_id': ujian_id, 'tanggal': body.tanggal, 'dari': (lama or {}).get('status'), 'ke': body.status, 'catatan': body.catatan,
    }, request=request)
    return {'tanggal': body.tanggal, 'status': body.status, 'peserta': p.get('nama'), 'sesi_diterapkan': len(sesi) - hadir}
