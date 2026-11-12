"""API Izin Kamad: izin keluar GTK & satpam yang diputuskan kepala madrasah (koleksi izin_kamad).

Skema & aturan murni ada di izin_kamad.py. Akses dibatasi per peran memakai require_role
(admin selalu lolos).
"""
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, Request

from core import db, get_current_user, log_audit, require_role
from izin_kamad import (
    BATAS_PENGAJUAN_SAYA, BATAS_RIWAYAT_KEPUTUSAN, FIELD_IZIN, KOLEKSI_CATATAN, KOLEKSI_IZIN, PERAN_DASHBOARD_SATPAM,
    PERAN_PAPAN_IZIN, PERAN_PEMBACA_CATATAN, PERAN_PEMUTUS_IZIN, PERAN_PENGAJU_IZIN, PERAN_PENULIS_CATATAN,
    STATUS_DIBATALKAN, STATUS_DISETUJUI, STATUS_DITOLAK, STATUS_MENUNGGU,
    CatatanIn, IzinPengajuanIn, TolakIn, alasan_catatan_tidak_sah, alasan_waktu_tidak_sah, boleh_lihat_izin,
    dokumen_catatan_baru, dokumen_izin_baru,
    hari_ini_wib, hitung_ringkasan_satpam, izin_disetujui_pada, jam_bertumpuk, jam_wib, ringkas_catatan, ringkas_izin,
    sekarang_wib,
)

router = APIRouter()

# Penjaga semua endpoint keputusan izin (daftar menunggu, setujui, tolak, riwayat keputusan):
# hanya kepala madrasah/kepala sekolah (admin selalu lolos require_role).
wajib_pemutus_izin = require_role(*PERAN_PEMUTUS_IZIN)


@router.post("/izin-kamad")
async def ajukan_izin(body: IzinPengajuanIn, request: Request, user: Dict = Depends(require_role(*PERAN_PENGAJU_IZIN))):
    """Ajukan izin keluar (kepala TU, guru mapel, tendik, satpam): tersimpan berstatus menunggu dan
    diteruskan ke kepala madrasah. Waktu divalidasi menurut jam server WIB."""
    galat = alasan_waktu_tidak_sah(body.tanggal, body.jam_mulai, body.jam_selesai, hari_ini_wib(), jam_wib())
    if galat:
        raise HTTPException(400, '; '.join(galat.values()))
    aktif = await db[KOLEKSI_IZIN].find(
        {'pengaju_id': user['id'], 'tanggal': body.tanggal, 'status': {'$in': [STATUS_MENUNGGU, STATUS_DISETUJUI]}},
        {'_id': 0, 'tanggal': 1, 'jam_mulai': 1, 'jam_selesai': 1},
    ).to_list(100)
    baru = body.model_dump()
    if any(jam_bertumpuk(baru, i) for i in aktif):
        raise HTTPException(409, "Anda sudah punya pengajuan izin pada rentang jam ini (menunggu/disetujui)")
    doc = dokumen_izin_baru(user, body)
    await db[KOLEKSI_IZIN].insert_one(dict(doc))
    await log_audit(user, 'izin_kamad_ajukan', KOLEKSI_IZIN, doc['id'],
                    {'tanggal': doc['tanggal'], 'jam': f"{doc['jam_mulai']}-{doc['jam_selesai']}"}, request=request)
    return ringkas_izin(doc)


@router.get("/izin-kamad/ringkasan-satpam")
async def ringkasan_satpam(user: Dict = Depends(require_role(*PERAN_DASHBOARD_SATPAM))):
    """Ringkasan dashboard satpam: izin disetujui hari ini (total, sedang izin, belum mulai, selesai)
    menurut jam server WIB, dan jumlah pengajuan izin milik sendiri yang masih menunggu."""
    tanggal = hari_ini_wib()
    papan = await izin_disetujui_pada(db, tanggal)
    menunggu = await db[KOLEKSI_IZIN].count_documents({'pengaju_id': user['id'], 'status': STATUS_MENUNGGU})
    return hitung_ringkasan_satpam(papan, menunggu, tanggal, jam_wib())


@router.get("/izin-kamad/papan-hari-ini")
async def papan_hari_ini(_user: Dict = Depends(require_role(*PERAN_PAPAN_IZIN))):
    """Papan pantau: izin berstatus disetujui pada tanggal berjalan (WIB), urut jam mulai lalu nama.
    Hanya-lihat; tanpa catatan satpam (catatan dibaca lewat endpoint tersendiri)."""
    tanggal = hari_ini_wib()
    return {'tanggal': tanggal, 'items': await izin_disetujui_pada(db, tanggal)}


@router.get("/izin-kamad/saya")
async def pengajuan_saya(user: Dict = Depends(require_role(*PERAN_PENGAJU_IZIN))):
    """Pengajuan izin milik pengguna login (semua status), terbaru dulu. Selalu disaring pengaju_id dari
    token, sehingga pengguna tidak dapat melihat pengajuan orang lain."""
    docs = await db[KOLEKSI_IZIN].find(
        {'pengaju_id': user['id']}, {'_id': 0, **{k: 1 for k in FIELD_IZIN}},
    ).sort('dibuat_pada', -1).to_list(BATAS_PENGAJUAN_SAYA)
    return {'items': [ringkas_izin(d) for d in docs]}


@router.get("/izin-kamad/menunggu")
async def daftar_menunggu(_user: Dict = Depends(wajib_pemutus_izin)):
    """Semua pengajuan berstatus menunggu untuk diputuskan kepala madrasah, tanggal & jam terdekat dulu
    (termasuk yang waktunya sudah lewat agar tetap terlihat dan bisa diputuskan/ditolak)."""
    docs = await db[KOLEKSI_IZIN].find(
        {'status': STATUS_MENUNGGU}, {'_id': 0, **{k: 1 for k in FIELD_IZIN}},
    ).sort([('tanggal', 1), ('jam_mulai', 1)]).to_list(500)
    return {'items': [ringkas_izin(d) for d in docs]}


@router.get("/izin-kamad/riwayat-keputusan")
async def riwayat_keputusan(_user: Dict = Depends(wajib_pemutus_izin)):
    """Arsip keputusan: izin disetujui/ditolak beserta alasan & pemutus, keputusan terbaru dulu."""
    docs = await db[KOLEKSI_IZIN].find(
        {'status': {'$in': [STATUS_DISETUJUI, STATUS_DITOLAK]}}, {'_id': 0, **{k: 1 for k in FIELD_IZIN}},
    ).sort('diputuskan_pada', -1).to_list(BATAS_RIWAYAT_KEPUTUSAN)
    return {'items': [ringkas_izin(d) for d in docs]}


# PERHATIAN: rute GET statis /izin-kamad/<nama> (mis. daftar menunggu) WAJIB didaftarkan di atas rute
# berparameter ini; bila di bawahnya, '<nama>' terbaca sebagai izin_id dan menjadi 404.
@router.get("/izin-kamad/{izin_id}")
async def detail_izin(izin_id: str, user: Dict = Depends(get_current_user)):
    """Rincian satu izin, hanya-lihat (tanpa aksi). Hak baca: lihat izin_kamad.boleh_lihat_izin."""
    doc = await db[KOLEKSI_IZIN].find_one({'id': izin_id}, {'_id': 0})
    if not doc:
        raise HTTPException(404, "Izin tidak ditemukan")
    if not boleh_lihat_izin(user, doc):
        raise HTTPException(403, "Anda tidak berhak melihat izin ini")
    return ringkas_izin(doc)


@router.post("/izin-kamad/{izin_id}/batalkan")
async def batalkan_izin(izin_id: str, request: Request, user: Dict = Depends(require_role(*PERAN_PENGAJU_IZIN))):
    """Pengaju membatalkan pengajuannya sendiri selama status masih menunggu. Pembaruan bersyarat
    status (atomik) sehingga tidak menimpa keputusan kepala madrasah yang terjadi bersamaan."""
    izin = await db[KOLEKSI_IZIN].find_one({'id': izin_id}, {'_id': 0})
    if not izin:
        raise HTTPException(404, "Izin tidak ditemukan")
    if izin.get('pengaju_id') != user['id']:
        raise HTTPException(403, "Hanya pengaju yang dapat membatalkan pengajuan ini")
    if izin.get('status') != STATUS_MENUNGGU:
        raise HTTPException(400, "Hanya pengajuan yang masih menunggu yang dapat dibatalkan")
    t = sekarang_wib().isoformat()
    r = await db[KOLEKSI_IZIN].update_one(
        {'id': izin_id, 'pengaju_id': user['id'], 'status': STATUS_MENUNGGU},
        {'$set': {'status': STATUS_DIBATALKAN, 'dibatalkan_pada': t, 'diperbarui_pada': t}},
    )
    if r.modified_count != 1:
        raise HTTPException(409, "Pengajuan sudah diputuskan kepala madrasah; muat ulang untuk melihat statusnya")
    await log_audit(user, 'izin_kamad_batalkan', KOLEKSI_IZIN, izin_id, request=request)
    return ringkas_izin({**izin, 'status': STATUS_DIBATALKAN})


# ---- Keputusan kepala madrasah ----
async def _putuskan(izin_id: str, user: Dict, perubahan: Dict, aksi: str, request: Request) -> Dict:
    """Ubah izin menunggu menjadi disetujui/ditolak secara atomik (bersyarat status menunggu), sehingga
    keputusan tidak menimpa pembatalan pengaju atau keputusan lain yang terjadi bersamaan."""
    izin = await db[KOLEKSI_IZIN].find_one({'id': izin_id}, {'_id': 0})
    if not izin:
        raise HTTPException(404, "Izin tidak ditemukan")
    if izin.get('status') != STATUS_MENUNGGU:
        raise HTTPException(409, f"Izin sudah berstatus {izin.get('status')}; muat ulang daftar")
    t = sekarang_wib().isoformat()
    pemutus = user.get('full_name') or user.get('username') or '-'
    isi = {**perubahan, 'diputuskan_oleh': user['id'], 'diputuskan_oleh_nama': pemutus,
           'diputuskan_pada': t, 'diperbarui_pada': t}
    r = await db[KOLEKSI_IZIN].update_one({'id': izin_id, 'status': STATUS_MENUNGGU}, {'$set': isi})
    if r.modified_count != 1:
        raise HTTPException(409, "Izin baru saja berubah (dibatalkan/diputuskan); muat ulang daftar")
    await log_audit(user, aksi, KOLEKSI_IZIN, izin_id, {'pengaju_id': izin.get('pengaju_id')}, request=request)
    return ringkas_izin({**izin, **isi})


@router.post("/izin-kamad/{izin_id}/setujui")
async def setujui_izin(izin_id: str, request: Request, user: Dict = Depends(wajib_pemutus_izin)):
    """Kepala madrasah menyetujui izin menunggu; bila tanggalnya hari ini langsung tampil di papan pantau."""
    return await _putuskan(izin_id, user, {'status': STATUS_DISETUJUI, 'alasan_penolakan': None}, 'izin_kamad_setujui', request)


@router.post("/izin-kamad/{izin_id}/tolak")
async def tolak_izin(izin_id: str, body: TolakIn, request: Request, user: Dict = Depends(wajib_pemutus_izin)):
    """Kepala madrasah menolak izin menunggu dengan alasan wajib (5–300 karakter, terlihat oleh pengaju)."""
    perubahan = {'status': STATUS_DITOLAK, 'alasan_penolakan': body.alasan}
    return await _putuskan(izin_id, user, perubahan, 'izin_kamad_tolak', request)


# ---- Catatan satpam (pembaca terbatas) ----
async def _izin_atau_404(izin_id: str) -> Dict:
    doc = await db[KOLEKSI_IZIN].find_one({'id': izin_id}, {'_id': 0})
    if not doc:
        raise HTTPException(404, "Izin tidak ditemukan")
    return doc


@router.post("/izin-kamad/{izin_id}/catatan")
async def tulis_catatan(izin_id: str, body: CatatanIn, request: Request,
                        user: Dict = Depends(require_role(*PERAN_PENULIS_CATATAN))):
    """Satpam menulis catatan pada satu izin yang sudah disetujui. Catatan menempel pada izin dan hanya
    dapat dibaca kepala madrasah/kepala sekolah & kepala tata usaha (GET di bawah)."""
    galat = alasan_catatan_tidak_sah(body.isi)
    if galat:
        raise HTTPException(400, galat)
    izin = await _izin_atau_404(izin_id)
    if izin.get('status') != STATUS_DISETUJUI:
        raise HTTPException(400, "Catatan hanya dapat ditulis pada izin yang sudah disetujui")
    doc = dokumen_catatan_baru(izin_id, user, body.isi)
    await db[KOLEKSI_CATATAN].insert_one(dict(doc))
    await log_audit(user, 'izin_kamad_catatan_tulis', KOLEKSI_CATATAN, doc['id'], {'izin_id': izin_id}, request=request)
    return ringkas_catatan(doc)


@router.get("/izin-kamad/{izin_id}/catatan")
async def daftar_catatan(izin_id: str, _user: Dict = Depends(require_role(*PERAN_PEMBACA_CATATAN))):
    """Riwayat catatan satpam pada satu izin (terlama dulu) — hanya kepala madrasah & kepala tata usaha."""
    await _izin_atau_404(izin_id)
    docs = await db[KOLEKSI_CATATAN].find({'izin_id': izin_id}, {'_id': 0}).sort('dibuat_pada', 1).to_list(500)
    return {'items': [ringkas_catatan(d) for d in docs]}
