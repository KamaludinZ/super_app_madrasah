"""API Ujian Madrasah — Kartu Peserta & Kartu Meja (PDF A4, 8 kartu per halaman, per ruang), pakai foto atau tanpa foto.

Menu 'kartu_peserta' & 'kartu_meja': admin, pimpinan (kepala madrasah & waka kurikulum), dan panitia ujian itu.
"""
import re
from typing import Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response

from core import db, get_current_user, log_audit
from routers.ujian import akses_ujian
from ujian import KOLEKSI_FORMULIR, KOLEKSI_PANITIA, KOLEKSI_RUANG
from ujian_cetak_data import _dasar
from penyimpanan import folder_unggahan
from ujian_kartu import FOTO_BAWAAN, OPSI_FOTO, ada_foto, baca_foto_siswa, pdf_kartu, peserta_kartu, ringkas_ketua, siapkan_foto
from ujian_ruang import peserta_ruang_ujian, urut_nama_ruang

router = APIRouter()

KUNCI_MENU = {'peserta': 'kartu_peserta', 'meja': 'kartu_meja'}
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
    Ketua Panitia (penanda tangan kartu peserta); serta opsi foto bawaan jenis kartu ini."""
    a = await akses_ujian(user, ujian_id, KUNCI_MENU[jenis])
    per_ruang = [(r, await peserta_ruang_ujian(db, ujian_id, r['id'])) for r in await _ruang_urut(ujian_id)]
    akun = await _akun_siswa([p.get('siswa_id') for _, ps in per_ruang for p in ps])
    ruang = [{'id': r['id'], 'nama_ruang': r.get('nama_ruang'), 'jenjang': r.get('jenjang', []), 'peserta': len(ps),
              'tanpa_nomor': sum(1 for p in ps if not p.get('nomor_peserta')),
              'ada_foto': sum(1 for p in ps if ada_foto(akun.get(p.get('siswa_id'))))} for r, ps in per_ruang]
    return {'ujian': {'id': ujian_id, 'nama': a['ujian'].get('nama'), 'jenis': a['ujian'].get('jenis')},
            'ruang': ruang, 'ketua': await _ketua(ujian_id), 'kartu_per_halaman': 8, 'foto_bawaan': FOTO_BAWAAN[jenis]}


@router.get("/ujian/{ujian_id}/kartu/{jenis}")
async def cetak_kartu(ujian_id: str, jenis: Literal['peserta', 'meja'], request: Request, ruang_id: str = '',
                      foto: Optional[Literal['pakai', 'tanpa']] = None, user: Dict = Depends(get_current_user)):
    """PDF A4 kartu peserta / kartu meja: satu ruang (`ruang_id`) atau semua ruang (kosong; tiap ruang mulai halaman
    baru). Peserta urut nomor peserta; 8 kartu per halaman. `foto`: 'pakai' (pas foto siswa; kotak kosong bila belum
    ada) atau 'tanpa' (tanpa kotak foto); bawaan kartu peserta 'pakai', kartu meja 'tanpa'."""
    foto = foto or FOTO_BAWAAN[jenis]
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
    data = {**_dasar(ujian, formulir), 'ketua': await _ketua(ujian_id), 'ruang': isi_ruang, 'foto': OPSI_FOTO[foto]}
    isi = pdf_kartu(jenis, data)
    bagian = f"ruang_{pilih[0].get('nama_ruang')}" if ruang_id else 'semua_ruang'
    dasar = f"kartu_{jenis}_{ujian.get('nama') or 'ujian'}_{bagian}_{'dengan' if OPSI_FOTO[foto] else 'tanpa'}_foto"
    nama = re.sub(r'_+', '_', re.sub(r'[^\w.-]+', '_', dasar)).strip('_') + '.pdf'
    await log_audit(user, 'ujian_cetak_kartu', KOLEKSI_RUANG, ruang_id or ujian_id, {
        'ujian_id': ujian_id, 'jenis': jenis, 'ruang_id': ruang_id or None, 'foto': foto,
        'peserta': sum(len(r['peserta']) for r in isi_ruang), 'dengan_foto': len(foto_siswa)}, request=request)
    return Response(isi, media_type='application/pdf', headers={
        'Content-Disposition': f'attachment; filename="{nama}"', 'Access-Control-Expose-Headers': 'Content-Disposition'})
