"""Menu Info Ujian (ber-login; key `info_ujian`): isi konten halaman publik Info Ujian siswa per ujian — tata tertib,
tautan video & keterangan panduan CBT, serta PDF panduan CBT (koleksi `ujian_info_konten`, folder unggahan `ujian_info/`).
Kontrak sama dengan frontend/src/lib/ujianInfoKonten.js; halaman publik membacanya lewat routers.ujian_info_publik.

Akses: admin (pengelola) mengubah; kepala madrasah, waka kurikulum, serta ketua & sekretaris panitia ujian itu melihat
(boleh_ubah = false) — sama dengan menu Tautan Publik. Teks & PDF disimpan terpisah: menyimpan teks tidak menyentuh PDF,
dan mengganti PDF tidak mengubah versi teks, sehingga keduanya dapat diubah bergantian tanpa saling menimpa.
"""
import os
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse
from pymongo.errors import DuplicateKeyError

from core import db, get_current_user, log_audit, logger
from routers.ujian import akses_ujian
from routers.ujian_berkas import PESAN_TERLALU_BESAR, RuteBatasUnggah, _hapus_diam
from ujian import PERAN_BUKAN_PANITIA, sekarang_wib
from ujian_berkas import galat_berkas, rapikan_nama_file
from ujian_info import (
    BERKAS_MAKS_BITA, FIELD_KONTEN_TEKS, KOLEKSI_INFO_KONTEN, SUBFOLDER_INFO, SimpanKontenInfoIn, dokumen_konten,
    inisialisasi_tautan, jalur_unggahan, konten_kosong, nama_berkas_panduan, ringkas_konten_admin, ringkas_tautan,
)

router = APIRouter()
router_unggah = APIRouter(route_class=RuteBatasUnggah)

MENU = 'info_ujian'
PESAN_HANYA_ADMIN = "Info ujian hanya dapat diubah admin."
PESAN_VERSI = "Info ujian baru saja diubah admin lain. Muat ulang halaman untuk melihat isian terbaru, lalu simpan lagi."
TANPA_CACHE = {'Cache-Control': 'no-store'}


def _ringkas_ujian(u: Dict) -> Dict:
    return {k: u.get(k) for k in ('id', 'nama', 'jenis', 'mulai', 'selesai', 'tahun_pelajaran')}


def _jalur_pdf(konten: Optional[Dict[str, Any]]) -> Optional[str]:
    nama = ((konten or {}).get('panduan_pdf') or {}).get('nama_berkas')
    return jalur_unggahan(SUBFOLDER_INFO, nama) if nama else None


def _ringkas(konten: Optional[Dict[str, Any]], ujian_id: str) -> Dict[str, Any]:
    jalur = _jalur_pdf(konten)
    return ringkas_konten_admin(konten, ujian_id, bool(jalur and os.path.isfile(jalur)))


async def _konten(ujian_id: str) -> Optional[Dict[str, Any]]:
    return await db[KOLEKSI_INFO_KONTEN].find_one({'ujian_id': ujian_id}, {'_id': 0})


async def _wajib_admin(user: Dict, ujian_id: str) -> Dict[str, Any]:
    """Penjaga ubah: menu info_ujian + pengelola (admin) dengan peran aktif bukan akun kelas/siswa."""
    a = await akses_ujian(user, ujian_id, MENU)
    if not a['pengelola'] or user.get('active_role') in PERAN_BUKAN_PANITIA:
        raise HTTPException(403, PESAN_HANYA_ADMIN)
    return a


@router.get("/ujian/{ujian_id}/info-konten")
async def info_konten_ujian(ujian_id: str, response: Response, user: Dict = Depends(get_current_user)):
    """Konten halaman Info Ujian satu ujian beserta tautan info-nya (untuk membuka halaman siswa):
    { ujian, boleh_ubah, konten: { tata_tertib, panduan_video_url, panduan_keterangan, panduan_pdf|null, diperbarui_pada,
      diperbarui_oleh_nama, versi }, tautan_info }. Tautan yang belum ada dibuat tertutup."""
    a = await akses_ujian(user, ujian_id, MENU)
    tautan = await inisialisasi_tautan(db, ujian_id, user)
    response.headers.update(TANPA_CACHE)
    return {'ujian': _ringkas_ujian(a['ujian']), 'boleh_ubah': a['pengelola'] and user.get('active_role') not in PERAN_BUKAN_PANITIA,
            'konten': _ringkas(await _konten(ujian_id), ujian_id),
            'tautan_info': ringkas_tautan(tautan['info'], sekarang_wib())}


@router.put("/ujian/{ujian_id}/info-konten")
async def simpan_info_konten(ujian_id: str, body: SimpanKontenInfoIn, request: Request, user: Dict = Depends(get_current_user)):
    """Simpan tata tertib, tautan video, dan keterangan panduan (admin). Teks dirapikan & divalidasi (422 dengan pesan jelas).
    `versi` harus sama dengan diperbarui_pada tersimpan (409 bila admin lain sudah mengubah). PDF panduan tidak tersentuh.
    -> { konten }"""
    await _wajib_admin(user, ujian_id)
    lama = await _konten(ujian_id)
    if (body.versi or None) != ((lama or {}).get('diperbarui_pada') or None):
        raise HTTPException(409, PESAN_VERSI)
    baru = dokumen_konten(ujian_id, body, user, lama, sekarang_wib())
    ubah = {k: baru[k] for k in (*FIELD_KONTEN_TEKS, 'diperbarui_pada', 'diperbarui_oleh', 'diperbarui_oleh_nama')}
    try:
        if lama:  # bersyarat versi: dua admin menyimpan bersamaan -> hanya satu yang berhasil
            hasil = await db[KOLEKSI_INFO_KONTEN].update_one(
                {'ujian_id': ujian_id, 'diperbarui_pada': lama.get('diperbarui_pada')}, {'$set': ubah})
            if not hasil.matched_count:
                raise HTTPException(409, PESAN_VERSI)
        else:
            await db[KOLEKSI_INFO_KONTEN].update_one(
                {'ujian_id': ujian_id}, {'$set': ubah, '$setOnInsert': {'panduan_pdf': None}}, upsert=True)
    except DuplicateKeyError:
        raise HTTPException(409, PESAN_VERSI)
    await log_audit(user, 'ujian_info_konten_ubah', KOLEKSI_INFO_KONTEN, ujian_id,
                    {'ujian_id': ujian_id, 'panjang_tata_tertib': len(body.tata_tertib), 'ada_video': bool(body.panduan_video_url)},
                    request=request)
    return {'konten': _ringkas(await _konten(ujian_id), ujian_id)}


@router_unggah.post("/ujian/{ujian_id}/info-konten/panduan-pdf")
async def unggah_panduan_pdf(ujian_id: str, request: Request, berkas: UploadFile = File(...), user: Dict = Depends(get_current_user)):
    """Unggah/ganti PDF panduan CBT (admin), maks. 10 MB. Isi diperiksa (tanda PDF asli, tanpa JavaScript/Launch/berkas
    sisipan). Berkas baru disimpan dengan nama acak; berkas lama dihapus setelah berkas baru tercatat. -> { konten }"""
    await _wajib_admin(user, ujian_id)
    isi = await berkas.read(BERKAS_MAKS_BITA + 1)
    if len(isi) > BERKAS_MAKS_BITA:
        raise HTTPException(413, PESAN_TERLALU_BESAR)
    pesan = galat_berkas('kisi_kisi', berkas.filename, isi)  # aturan PDF yang sama dengan kisi-kisi
    if pesan:
        raise HTTPException(400, pesan.replace('Kisi-kisi harus', 'Panduan CBT harus'))
    lama = await _konten(ujian_id)
    waktu = sekarang_wib().isoformat()
    meta = {'nama_file': rapikan_nama_file(berkas.filename, 'pdf'), 'nama_berkas': nama_berkas_panduan(ujian_id),
            'ukuran_byte': len(isi), 'mime': 'application/pdf', 'diunggah_pada': waktu, 'diunggah_oleh': user.get('id'),
            'diunggah_oleh_nama': user.get('full_name') or user.get('username')}
    jalur_baru = jalur_unggahan(SUBFOLDER_INFO, meta['nama_berkas'])
    sementara = f'{jalur_baru}.sedang'
    awal = {k: v for k, v in konten_kosong(ujian_id).items() if k not in ('ujian_id', 'panduan_pdf')}
    try:
        with open(sementara, 'wb') as f:
            f.write(isi)
        os.replace(sementara, jalur_baru)
        await db[KOLEKSI_INFO_KONTEN].update_one({'ujian_id': ujian_id}, {'$set': {'panduan_pdf': meta},
                                                                          '$setOnInsert': awal}, upsert=True)
    except Exception as e:  # noqa: BLE001 — PDF lama tetap berlaku bila penyimpanan gagal
        _hapus_diam(sementara)
        _hapus_diam(jalur_baru)
        logger.error(f'[ujian_info] gagal menyimpan panduan CBT {ujian_id}: {e}')
        raise HTTPException(500, "Panduan belum tersimpan karena gangguan server. PDF lama (bila ada) tetap berlaku.")
    jalur_lama = _jalur_pdf(lama)
    if jalur_lama and jalur_lama != jalur_baru:
        _hapus_diam(jalur_lama)
    await log_audit(user, 'ujian_panduan_cbt_unggah', KOLEKSI_INFO_KONTEN, ujian_id,
                    {'ujian_id': ujian_id, 'ukuran': len(isi), 'ganti': bool(jalur_lama)}, request=request)
    return {'konten': _ringkas(await _konten(ujian_id), ujian_id)}


@router.delete("/ujian/{ujian_id}/info-konten/panduan-pdf")
async def hapus_panduan_pdf(ujian_id: str, request: Request, user: Dict = Depends(get_current_user)):
    """Hapus PDF panduan CBT (admin); halaman siswa tidak lagi menampilkan tombol PDF. -> { konten }"""
    await _wajib_admin(user, ujian_id)
    lama = await _konten(ujian_id)
    if not (lama or {}).get('panduan_pdf'):
        raise HTTPException(404, "Belum ada PDF panduan CBT.")
    await db[KOLEKSI_INFO_KONTEN].update_one({'ujian_id': ujian_id}, {'$set': {'panduan_pdf': None}})
    _hapus_diam(_jalur_pdf(lama))
    await log_audit(user, 'ujian_panduan_cbt_hapus', KOLEKSI_INFO_KONTEN, ujian_id, {'ujian_id': ujian_id}, request=request)
    return {'konten': _ringkas(await _konten(ujian_id), ujian_id)}


@router.get("/ujian/{ujian_id}/info-konten/panduan-pdf")
async def lihat_panduan_pdf(ujian_id: str, user: Dict = Depends(get_current_user)):
    """Pratinjau PDF panduan CBT untuk admin & pemantau (tanpa token publik; tidak dihitung sebagai unduhan siswa)."""
    await akses_ujian(user, ujian_id, MENU)
    konten = await _konten(ujian_id)
    jalur = _jalur_pdf(konten)
    if not jalur or not os.path.isfile(jalur):
        raise HTTPException(404, "PDF panduan CBT belum diunggah atau berkasnya hilang di server. Unggah ulang.")
    return FileResponse(jalur, media_type='application/pdf', filename=konten['panduan_pdf'].get('nama_file') or 'Panduan CBT.pdf',
                        content_disposition_type='inline', headers=TANPA_CACHE)
