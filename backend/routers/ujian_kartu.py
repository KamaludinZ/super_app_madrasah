"""API Ujian Madrasah — Kartu Peserta & Kartu Meja (PDF A4, 8 kartu per halaman, per ruang), pakai foto atau tanpa foto,
ditandatangani Ketua Panitia, Kepala Madrasah, atau tanpa tanda tangan.

Menu 'kartu_peserta' & 'kartu_meja': admin, pimpinan (kepala madrasah & waka kurikulum), dan panitia ujian itu.
Unggah/hapus berkas tanda tangan & stempel PNG kartu: admin, pimpinan, serta ketua & sekretaris panitia ujian itu.

Koleksi `ttd_kartu_ujian` (tanda tangan) & `stempel_kartu_ujian` (stempel): { ujian_id, penanda: 'ketua'|'kepala',
png (bytes, transparan), ukuran, diunggah_oleh, diunggah_oleh_nama, diunggah_pada } — satu berkas per penanda per ujian.
"""
import re
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import Response

from core import db, get_current_user, log_audit
from pkg_identitas import akun_kepala
from routers.ujian import akses_ujian
from ujian import KOLEKSI_FORMULIR, KOLEKSI_PANITIA, KOLEKSI_RUANG, sekarang_wib
from ujian_cetak_data import _dasar
from penyimpanan import folder_unggahan
from ujian_kartu import (
    BERKAS_KARTU, FOTO_BAWAAN, OPSI_FOTO, OPSI_STEMPEL, PENANDA_TTD, TTD_BAWAAN, TTD_UNGGAH_MAKS_BYTE, ada_foto, baca_foto_siswa,
    olah_ttd_unggahan, pdf_kartu, peserta_kartu, ringkas_kepala, ringkas_ketua, siapkan_foto,
)
from ujian_ruang import peserta_ruang_ujian, urut_nama_ruang

router = APIRouter()

KUNCI_MENU = {'peserta': 'kartu_peserta', 'meja': 'kartu_meja'}
KOLEKSI_TTD_KARTU = 'ttd_kartu_ujian'
KOLEKSI_BERKAS_KARTU = {'ttd': KOLEKSI_TTD_KARTU, 'stempel': 'stempel_kartu_ujian'}
JABATAN_UBAH_TTD = ('ketua', 'sekretaris')


async def _akses_ubah_ttd(user: Dict, ujian_id: str) -> Dict[str, Any]:
    """Pengelola, pimpinan, serta ketua & sekretaris panitia ujian itu boleh mengunggah/menghapus tanda tangan kartu."""
    a = await akses_ujian(user, ujian_id, 'kartu_peserta')
    if not (a['pengelola'] or a['pimpinan'] or a['jabatan'] in JABATAN_UBAH_TTD):
        raise HTTPException(403, 'Unggah tanda tangan & stempel kartu hanya untuk admin, pimpinan, serta ketua dan sekretaris panitia')
    return a


async def _kepala():
    pengaturan = await db.settings.find_one({'id': 'global_config'}, {'_id': 0}) or {}
    return ringkas_kepala(await akun_kepala(db), pengaturan)


async def _meta_berkas(ujian_id: str, berkas: str) -> Dict[str, Dict[str, Any]]:
    """{penanda: {ukuran, diunggah_oleh_nama, diunggah_pada}} berkas tanda tangan/stempel yang sudah diunggah (tanpa isi)."""
    docs = await db[KOLEKSI_BERKAS_KARTU[berkas]].find({'ujian_id': ujian_id}, {'_id': 0, 'png': 0}).to_list(10)
    return {d['penanda']: {k: d.get(k) for k in ('ukuran', 'diunggah_oleh_nama', 'diunggah_pada')} for d in docs}


async def _png_berkas(ujian_id: str, penanda: str, berkas: str = 'ttd') -> Optional[bytes]:
    d = await db[KOLEKSI_BERKAS_KARTU[berkas]].find_one({'ujian_id': ujian_id, 'penanda': penanda}, {'_id': 0, 'png': 1})
    return bytes(d['png']) if d and d.get('png') else None


async def _penanda(ujian_id: str) -> Dict[str, Optional[Dict[str, Any]]]:
    """Calon penanda tangan kartu: {ketua: {jabatan, nama, nip, ttd, stempel} | None, kepala: {...} | None}; `ttd` &
    `stempel` = info berkas PNG yang sudah diunggah (None bila belum)."""
    meta = {b: await _meta_berkas(ujian_id, b) for b in BERKAS_KARTU}
    hasil = {}
    for kunci, orang in (('ketua', await _ketua(ujian_id)), ('kepala', await _kepala())):
        hasil[kunci] = {'jabatan': PENANDA_TTD[kunci], **orang, **{b: meta[b].get(kunci) for b in BERKAS_KARTU}} if orang else None
    return hasil
PROYEKSI_FOTO = {'_id': 0, 'id': 1, 'dokumen_pas_foto': 1, 'photo_url': 1}


async def _akun_siswa(siswa_ids: List[str]) -> Dict[str, Dict]:
    ids = [i for i in dict.fromkeys(siswa_ids) if i]
    if not ids:
        return {}
    return {u['id']: u for u in await db.users.find({'id': {'$in': ids}}, PROYEKSI_FOTO).to_list(len(ids))}


async def _foto_peserta(siswa_ids: List[str]) -> Dict[str, bytes]:
    """{siswa_id: JPEG pas foto siap cetak} untuk siswa yang punya pas foto."""
    folder = folder_unggahan('dokumen_siswa')
    hasil = {}
    for sid, akun in (await _akun_siswa(siswa_ids)).items():
        jpg = siapkan_foto(baca_foto_siswa(akun, folder))
        if jpg:
            hasil[sid] = jpg
    return hasil


async def _ketua(ujian_id: str):
    """Ketua Panitia ujian itu (penanda tangan kartu peserta): nama dari akun (cadangan salinan saat ditetapkan); NIP ASN
    diutamakan, lalu NIP salinan, Peg ID, dan NIPM (Non ASN)."""
    p = await db[KOLEKSI_PANITIA].find_one({'ujian_id': ujian_id, 'jabatan': 'ketua'}, {'_id': 0})
    if not p:
        return None
    proyeksi = {'_id': 0, 'full_name': 1, 'username': 1, 'nip': 1, 'nip_nuptk': 1, 'peg_id': 1, 'nipm': 1}
    u = await db.users.find_one({'id': p.get('user_id')}, proyeksi) or {}
    return ringkas_ketua(u, p)


async def _ruang_urut(ujian_id: str):
    return sorted(await db[KOLEKSI_RUANG].find({'ujian_id': ujian_id}, {'_id': 0}).to_list(500),
                  key=lambda r: urut_nama_ruang(r.get('nama_ruang') or ''))


@router.get("/ujian/{ujian_id}/kartu/pilihan")
async def pilihan_kartu(ujian_id: str, jenis: Literal['peserta', 'meja'] = 'peserta', user: Dict = Depends(get_current_user)):
    """Pilihan cetak kartu: ruang (urut nama) beserta jumlah peserta, yang belum bernomor, dan yang punya pas foto;
    calon penanda tangan (Ketua Panitia & Kepala Madrasah, beserta status berkas tanda tangan PNG); opsi foto & tanda
    tangan bawaan jenis kartu ini; dan apakah pengguna boleh mengunggah tanda tangan."""
    a = await akses_ujian(user, ujian_id, KUNCI_MENU[jenis])
    per_ruang = [(r, await peserta_ruang_ujian(db, ujian_id, r['id'])) for r in await _ruang_urut(ujian_id)]
    akun = await _akun_siswa([p.get('siswa_id') for _, ps in per_ruang for p in ps])
    ruang = [{'id': r['id'], 'nama_ruang': r.get('nama_ruang'), 'jenjang': r.get('jenjang', []), 'peserta': len(ps),
              'tanpa_nomor': sum(1 for p in ps if not p.get('nomor_peserta')),
              'ada_foto': sum(1 for p in ps if ada_foto(akun.get(p.get('siswa_id'))))} for r, ps in per_ruang]
    penanda = await _penanda(ujian_id)
    return {'ujian': {'id': ujian_id, 'nama': a['ujian'].get('nama'), 'jenis': a['ujian'].get('jenis')},
            'ruang': ruang, 'ketua': await _ketua(ujian_id), 'kartu_per_halaman': 8, 'foto_bawaan': FOTO_BAWAAN[jenis],
            'penanda': penanda, 'ttd_bawaan': TTD_BAWAAN[jenis],
            'boleh_ubah_ttd': bool(a['pengelola'] or a['pimpinan'] or a['jabatan'] in JABATAN_UBAH_TTD)}


@router.get("/ujian/{ujian_id}/kartu/{jenis_berkas}/{penanda}")
async def lihat_berkas_kartu(ujian_id: str, jenis_berkas: Literal['ttd', 'stempel'], penanda: Literal['ketua', 'kepala'],
                             user: Dict = Depends(get_current_user)):
    """Pratinjau berkas tanda tangan / stempel PNG kartu (transparan) untuk penanda ini."""
    await akses_ujian(user, ujian_id, 'kartu_peserta')
    png = await _png_berkas(ujian_id, penanda, jenis_berkas)
    if not png:
        raise HTTPException(404, f"{BERKAS_KARTU[jenis_berkas]['label']} belum diunggah")
    return Response(png, media_type='image/png', headers={'Cache-Control': 'no-store'})


@router.post("/ujian/{ujian_id}/kartu/{jenis_berkas}/{penanda}")
async def unggah_berkas_kartu(ujian_id: str, jenis_berkas: Literal['ttd', 'stempel'], penanda: Literal['ketua', 'kepala'],
                              request: Request, berkas: UploadFile = File(...), user: Dict = Depends(get_current_user)):
    """Unggah berkas tanda tangan / stempel PNG (maks. 2 MB) Ketua Panitia / Kepala Madrasah untuk kartu ujian ini.
    Latar putih dibuat transparan, tepi kosong dipangkas, dan gambar dikecilkan; berkas lama diganti."""
    await _akses_ubah_ttd(user, ujian_id)
    isi = await berkas.read(TTD_UNGGAH_MAKS_BYTE + 1)
    try:
        png = olah_ttd_unggahan(isi, jenis_berkas)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    meta = {'ukuran': len(png), 'diunggah_oleh': user.get('id'), 'diunggah_oleh_nama': user.get('full_name') or user.get('username'),
            'diunggah_pada': sekarang_wib().isoformat()}
    koleksi = KOLEKSI_BERKAS_KARTU[jenis_berkas]
    await db[koleksi].update_one({'ujian_id': ujian_id, 'penanda': penanda},
                                 {'$set': {'ujian_id': ujian_id, 'penanda': penanda, 'png': png, **meta}}, upsert=True)
    await log_audit(user, f'ujian_kartu_{jenis_berkas}_unggah', koleksi, ujian_id, {'penanda': penanda, 'ukuran': len(png)}, request=request)
    return {'penanda': penanda, 'berkas': jenis_berkas, jenis_berkas: {k: meta[k] for k in ('ukuran', 'diunggah_oleh_nama', 'diunggah_pada')}}


@router.delete("/ujian/{ujian_id}/kartu/{jenis_berkas}/{penanda}")
async def hapus_berkas_kartu(ujian_id: str, jenis_berkas: Literal['ttd', 'stempel'], penanda: Literal['ketua', 'kepala'],
                             request: Request, user: Dict = Depends(get_current_user)):
    """Hapus berkas tanda tangan / stempel PNG kartu. Tanpa tanda tangan, ruang tanda tangan dicetak kosong (tanda
    tangan basah); tanpa stempel, kartu dicetak tanpa cap."""
    await _akses_ubah_ttd(user, ujian_id)
    koleksi = KOLEKSI_BERKAS_KARTU[jenis_berkas]
    await db[koleksi].delete_many({'ujian_id': ujian_id, 'penanda': penanda})
    await log_audit(user, f'ujian_kartu_{jenis_berkas}_hapus', koleksi, ujian_id, {'penanda': penanda}, request=request)
    return {'penanda': penanda, 'berkas': jenis_berkas, jenis_berkas: None}


@router.get("/ujian/{ujian_id}/kartu/{jenis}")
async def cetak_kartu(ujian_id: str, jenis: Literal['peserta', 'meja'], request: Request, ruang_id: str = '',
                      foto: Optional[Literal['pakai', 'tanpa']] = None, ttd: Optional[Literal['ketua', 'kepala', 'tanpa']] = None,
                      stempel: Literal['pakai', 'tanpa'] = 'pakai', user: Dict = Depends(get_current_user)):
    """PDF A4 kartu peserta / kartu meja: satu ruang (`ruang_id`) atau semua ruang (kosong; tiap ruang mulai halaman
    baru). Peserta urut nomor peserta; 8 kartu per halaman. `foto`: 'pakai' (pas foto siswa; kotak kosong bila belum
    ada) atau 'tanpa' (tanpa kotak foto); bawaan kartu peserta 'pakai', kartu meja 'tanpa'. `ttd`: 'ketua' (Ketua
    Panitia), 'kepala' (Kepala Madrasah), atau 'tanpa'; bawaan kartu peserta 'ketua', kartu meja 'tanpa'. Bila berkas
    tanda tangan PNG penanda itu sudah diunggah, gambarnya ikut tercetak; bila belum, ruang tanda tangan dibiarkan kosong.
    `stempel`: 'pakai' (bawaan; stempel PNG penanda itu ikut tercetak bila sudah diunggah) atau 'tanpa'."""
    foto = foto or FOTO_BAWAAN[jenis]
    ttd = ttd or TTD_BAWAAN[jenis]
    a = await akses_ujian(user, ujian_id, KUNCI_MENU[jenis])
    ujian = a['ujian']
    semua = await _ruang_urut(ujian_id)
    pilih = [r for r in semua if r['id'] == ruang_id] if ruang_id else semua
    if ruang_id and not pilih:
        raise HTTPException(404, "Ruang tidak ditemukan pada ujian ini")
    per_ruang = [(r, await peserta_ruang_ujian(db, ujian_id, r['id'])) for r in pilih]
    foto_siswa = await _foto_peserta([p.get('siswa_id') for _, ps in per_ruang for p in ps]) if OPSI_FOTO[foto] else {}
    isi_ruang = [{'nama_ruang': r.get('nama_ruang') or '', 'peserta': peserta_kartu(ps, foto_siswa)} for r, ps in per_ruang]
    if not any(r['peserta'] for r in isi_ruang):
        raise HTTPException(400, "Belum ada peserta pada ruang yang dipilih" if ruang_id else "Belum ada peserta pada ujian ini")
    formulir = await db[KOLEKSI_FORMULIR].find_one({'ujian_id': ujian_id}, {'_id': 0})
    blok_ttd = None
    if ttd != 'tanpa':
        orang = await _ketua(ujian_id) if ttd == 'ketua' else await _kepala()
        blok_ttd = {'jabatan': PENANDA_TTD[ttd], 'nama': '', 'nip': '', **(orang or {}), 'png': await _png_berkas(ujian_id, ttd, 'ttd'),
                    'stempel': await _png_berkas(ujian_id, ttd, 'stempel') if OPSI_STEMPEL[stempel] else None}
    data = {**_dasar(ujian, formulir), 'ttd': blok_ttd, 'ruang': isi_ruang, 'foto': OPSI_FOTO[foto]}
    isi = pdf_kartu(jenis, data)
    bagian = f"ruang_{pilih[0].get('nama_ruang')}" if ruang_id else 'semua_ruang'
    dasar = f"kartu_{jenis}_{ujian.get('nama') or 'ujian'}_{bagian}_{'dengan' if OPSI_FOTO[foto] else 'tanpa'}_foto"
    nama = re.sub(r'_+', '_', re.sub(r'[^\w.-]+', '_', dasar)).strip('_') + '.pdf'
    await log_audit(user, 'ujian_cetak_kartu', KOLEKSI_RUANG, ruang_id or ujian_id, {
        'ujian_id': ujian_id, 'jenis': jenis, 'ruang_id': ruang_id or None, 'foto': foto, 'ttd': ttd, 'stempel': stempel,
        'peserta': sum(len(r['peserta']) for r in isi_ruang), 'dengan_foto': len(foto_siswa)}, request=request)
    return Response(isi, media_type='application/pdf', headers={
        'Content-Disposition': f'attachment; filename="{nama}"', 'Access-Control-Expose-Headers': 'Content-Disposition'})
