"""API Ujian Madrasah — Cetak & Arsip Administrasi Ujian.

Cetak (menu 'cetak'): admin, panitia ujian itu, kepala madrasah & waka kurikulum.
Arsip (menu 'arsip', AKSES TERBATAS): admin, waka kurikulum, kepala madrasah, serta ketua & sekretaris panitia ujian
itu — jabatan diperiksa PADA ujian pemilik arsip (bendahara/penanggung jawab dan GTK lain ditolak 403).
"""
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field

from core import db, get_current_user, log_audit
from routers.ujian import akses_ujian
from ujian import JABATAN_PEMBUKA_ARSIP, KOLEKSI_PANITIA, KOLEKSI_UJIAN, PESAN_TOLAK_ARSIP, adalah_pengelola, adalah_pimpinan, mungkin_panitia
from routers.ujian_formulir import jadwal_ujian
from routers.ujian_ruang import per_jenjang_ruang
from ujian import KOLEKSI_FORMULIR, KOLEKSI_RUANG, boleh_akses_ujian
from ujian_berita_acara import KOLEKSI_BA, rekap_ruang_sesi
from ujian_ruang import urut_nama_ruang
from ujian_arsip import ambil_berkas_arsip, daftar_jenjang_arsip, dokumen_arsip, mode_arsip, nama_berkas_cetak, ringkas_arsip, simpan_arsip
from ujian_berita_acara import KOLEKSI_ARSIP
from ujian_cetak import MIME, buat_dokumen, kemampuan_cetak
from ujian_cetak_data import PERAKIT, label_jenjang
from ujian_cetak_docx import hari_tanggal

router = APIRouter()


async def akses_arsip(user: Dict[str, Any], ujian_id: str) -> Dict[str, Any]:
    """Penjaga arsip satu ujian (403 dengan pesan pembuka arsip yang berhak)."""
    return await akses_ujian(user, ujian_id, 'arsip')


@router.get("/ujian/{ujian_id}/arsip")
async def daftar_arsip(ujian_id: str, jenis: str = '', ruang_id: str = '', jenjang: int = 0, mode: str = '',
                       user: Dict = Depends(get_current_user)):
    """Arsip administrasi satu ujian, terbaru dulu; dapat disaring jenis dokumen, ruang, jenjang, dan mode dokumen
    ('jenjang' = per jenjang per ruang, 'ruang' = per ruang)."""
    await akses_arsip(user, ujian_id)
    q: Dict[str, Any] = {'ujian_id': ujian_id}
    if jenis:
        q['jenis_dokumen'] = jenis
    if ruang_id:
        q['ruang_id'] = ruang_id
    if jenjang:
        q['jenjang'] = jenjang
    docs = await db[KOLEKSI_ARSIP].find(q, {'_id': 0}).sort('waktu', -1).to_list(2000)
    return {'items': [ringkas_arsip(d) for d in docs if not mode or mode_arsip(d) == mode]}


# PERHATIAN: /ujian/arsip/cari harus terdaftar sebelum /ujian/arsip/{arsip_id}.
@router.get("/ujian/arsip/cari")
async def cari_arsip(q: str = '', jenis: str = '', user: Dict = Depends(get_current_user)):
    """Cari arsip lintas ujian (termasuk semester lalu) menurut nama ujian, ruang, kelas, sesi, atau nama berkas.
    Pengelola & pimpinan: semua ujian; ketua/sekretaris: hanya ujian tempat ia menjabat; selain itu 403."""
    if adalah_pengelola(user) or adalah_pimpinan(user):
        ujian_ids = None
    else:
        ujian_ids = [p['ujian_id'] for p in await db[KOLEKSI_PANITIA].find(
            {'user_id': user.get('id'), 'jabatan': {'$in': list(JABATAN_PEMBUKA_ARSIP)}}, {'_id': 0, 'ujian_id': 1}).to_list(1000)] \
            if mungkin_panitia(user) else []
        if not ujian_ids:
            raise HTTPException(403, PESAN_TOLAK_ARSIP)
    filt: Dict[str, Any] = {}
    if ujian_ids is not None:
        filt['ujian_id'] = {'$in': ujian_ids}
    if jenis:
        filt['jenis_dokumen'] = jenis
    docs = await db[KOLEKSI_ARSIP].find(filt, {'_id': 0}).sort('waktu', -1).to_list(5000)
    nama_ujian = {u['id']: u for u in await db[KOLEKSI_UJIAN].find(
        {'id': {'$in': list({d['ujian_id'] for d in docs})}}, {'_id': 0, 'id': 1, 'nama': 1, 'jenis': 1, 'tahun_pelajaran': 1, 'semester_nama': 1}).to_list(1000)}
    kata = [k for k in q.lower().split() if k]
    hasil = []
    for d in docs:
        u = nama_ujian.get(d['ujian_id'], {})
        per_ruang = ' per ruang' if mode_arsip(d) == 'ruang' else ''
        teks = f"{u.get('nama', '')} {u.get('jenis', '')} {u.get('tahun_pelajaran', '')} ruang {d.get('nama_ruang')} kelas {label_jenjang(daftar_jenjang_arsip(d))}{per_ruang} " \
               f"{d.get('sesi_label', '')} {d.get('nama_berkas', '')} {d.get('jenis_dokumen', '').replace('_', ' ')}".lower()
        if all(k in teks for k in kata):
            hasil.append({**ringkas_arsip(d), 'ujian_nama': u.get('nama'), 'tahun_pelajaran': u.get('tahun_pelajaran')})
    return {'items': hasil[:500], 'total': len(hasil)}


@router.get("/ujian/arsip/{arsip_id}")
async def buka_arsip(arsip_id: str, user: Dict = Depends(get_current_user)):
    """Rincian satu arsip beserta dokumen terkait (mode, ruang, jenjang, dan sesi yang sama — pasangan daftar hadir/berita acara
    serta cetakan ulang). Hak akses diperiksa terhadap ujian pemilik arsip."""
    meta = await db[KOLEKSI_ARSIP].find_one({'id': arsip_id}, {'_id': 0})
    if not meta:
        raise HTTPException(404, "Arsip tidak ditemukan")
    await akses_arsip(user, meta['ujian_id'])
    terkait = await db[KOLEKSI_ARSIP].find({'ujian_id': meta['ujian_id'], 'ruang_id': meta['ruang_id'], 'jenjang': meta['jenjang'],
                                           'sesi_id': meta['sesi_id']}, {'_id': 0}).sort('waktu', -1).to_list(100)
    return {'arsip': ringkas_arsip(meta), 'terkait': [ringkas_arsip(t) for t in terkait if t['id'] != arsip_id and mode_arsip(t) == mode_arsip(meta)]}


@router.get("/ujian/arsip/{arsip_id}/berkas")
async def unduh_berkas_arsip(arsip_id: str, user: Dict = Depends(get_current_user)):
    """Unduh berkas arsip; hak akses diperiksa terhadap ujian pemilik arsip."""
    hasil = await ambil_berkas_arsip(db, arsip_id)
    if not hasil:
        raise HTTPException(404, "Arsip tidak ditemukan")
    meta, isi = hasil
    await akses_arsip(user, meta['ujian_id'])
    mime = 'application/pdf' if meta.get('format') == 'pdf' else 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    return Response(isi, media_type=mime, headers={'Content-Disposition': f'attachment; filename="{meta.get("nama_berkas")}"'})


@router.get("/ujian/{ujian_id}/cetak/pilihan")
async def pilihan_cetak(ujian_id: str, user: Dict = Depends(get_current_user)):
    """Pilihan cetak satu ujian: sesi (jadwal), ruang beserta jenjang & jumlah peserta per jenjang (ruang campuran =
    beberapa jenjang), mesin cetak yang aktif, dan apakah pengguna boleh membuka arsip."""
    a = await akses_ujian(user, ujian_id, 'cetak')
    ruang = sorted(await db[KOLEKSI_RUANG].find({'ujian_id': ujian_id}, {'_id': 0}).to_list(500),
                   key=lambda r: urut_nama_ruang(r.get('nama_ruang') or ''))
    per = await per_jenjang_ruang(ujian_id)
    return {
        'mesin': kemampuan_cetak(),
        'sesi': await jadwal_ujian(ujian_id),
        'ruang': [{'id': r['id'], 'nama_ruang': r['nama_ruang'], 'jenjang': r.get('jenjang', []),
                   'per_jenjang': {str(j): int(per.get(r['id'], {}).get(j, 0)) for j in r.get('jenjang', [])}} for r in ruang],
        'boleh_arsip': boleh_akses_ujian(a['pengelola'], a['pimpinan'], a['jabatan'], 'arsip'),
    }


@router.get("/ujian/{ujian_id}/cetak/kesiapan")
async def kesiapan_cetak(ujian_id: str, sesi_id: str, user: Dict = Depends(get_current_user)):
    """Kesiapan tiap ruang–jenjang pada satu sesi: jumlah peserta, daftar hadir lengkap (sisa belum), berita acara terisi."""
    await akses_ujian(user, ujian_id, 'cetak')
    sesi = await db['jadwal_ujian'].find_one({'id': sesi_id, 'ujian_id': ujian_id}, {'_id': 0})
    if not sesi:
        raise HTTPException(404, "Sesi tidak ditemukan pada ujian ini")
    ruang = await db[KOLEKSI_RUANG].find({'ujian_id': ujian_id}, {'_id': 0}).to_list(500)
    ba = {b['ruang_id'] for b in await db[KOLEKSI_BA].find({'ujian_id': ujian_id, 'sesi_id': sesi_id}, {'_id': 0, 'ruang_id': 1}).to_list(500)}
    items = []
    for r in sorted(ruang, key=lambda x: urut_nama_ruang(x.get('nama_ruang') or '')):
        rekap = (await rekap_ruang_sesi(db, ujian_id, r, sesi))['rekap']
        for j in r.get('jenjang', []):
            x = rekap.get(j) or {'total': 0, 'belum': 0, 'lengkap': False}
            items.append({'ruang_id': r['id'], 'jenjang': j, 'peserta': x['total'], 'dh_lengkap': bool(x.get('lengkap')),
                          'belum': x.get('belum', 0), 'ba_terisi': r['id'] in ba})
    return {'items': items}


class CetakIn(BaseModel):
    jenis: Literal['daftar_hadir', 'berita_acara']
    # 'jenjang' = per jenjang per ruang (wajib isi jenjang); 'ruang' = per ruang: seluruh jenjang ruang dalam satu dokumen.
    mode: Literal['jenjang', 'ruang'] = 'jenjang'
    ruang_id: str = Field(..., min_length=1, max_length=64)
    jenjang: Optional[int] = Field(None, ge=7, le=9)
    sesi_id: str = Field(..., min_length=1, max_length=64)
    format: Literal['pdf', 'docx'] = 'pdf'
    pratinjau: bool = False


def label_sesi(sesi: Dict[str, Any]) -> str:
    return f"{hari_tanggal(sesi['tanggal'])} · Sesi {sesi.get('sesi_ke')} · {sesi.get('jam_mulai')}–{sesi.get('jam_selesai')}"


async def _sumber_cetak(ujian_id: str, ruang_id: str, jenjang: Optional[int], sesi_id: str):
    """jenjang None = per ruang (ruang harus memuat minimal satu jenjang)."""
    ruang = await db[KOLEKSI_RUANG].find_one({'id': ruang_id, 'ujian_id': ujian_id}, {'_id': 0})
    if not ruang:
        raise HTTPException(404, "Ruang tidak ditemukan pada ujian ini")
    if jenjang is None:
        if not ruang.get('jenjang'):
            raise HTTPException(400, f"Ruang {ruang.get('nama_ruang')} belum memuat jenjang apa pun")
    elif jenjang not in (ruang.get('jenjang') or []):
        raise HTTPException(400, f"Ruang {ruang.get('nama_ruang')} tidak memuat kelas {jenjang}")
    sesi = await db['jadwal_ujian'].find_one({'id': sesi_id, 'ujian_id': ujian_id}, {'_id': 0})
    if not sesi:
        raise HTTPException(404, "Sesi tidak ditemukan pada ujian ini")
    return ruang, sesi


@router.post("/ujian/{ujian_id}/cetak")
async def cetak_dokumen(ujian_id: str, body: CetakIn, request: Request, user: Dict = Depends(get_current_user)):
    """Cetak Daftar Hadir / Berita Acara pada SATU ruang dan satu sesi, dengan template & pola TTD ujian:
    mode 'jenjang' = satu jenjang (ruang campuran dicetak per jenjang); mode 'ruang' = seluruh jenjang ruang dalam satu
    dokumen. Setiap cetakan (bukan pratinjau) OTOMATIS direkam ke Arsip Administrasi Ujian (header X-Arsip-Id).
    Pratinjau selalu PDF dan tidak diarsipkan."""
    a = await akses_ujian(user, ujian_id, 'cetak')
    ujian = a['ujian']
    if body.mode == 'jenjang' and body.jenjang is None:
        raise HTTPException(400, "Pilih jenjang untuk cetak per jenjang per ruang")
    jenjang = body.jenjang if body.mode == 'jenjang' else None
    ruang, sesi = await _sumber_cetak(ujian_id, body.ruang_id, jenjang, body.sesi_id)
    formulir = await db[KOLEKSI_FORMULIR].find_one({'ujian_id': ujian_id}, {'_id': 0})
    data = await PERAKIT[body.jenis](db, ujian, formulir, ruang, jenjang, sesi)
    fmt = 'pdf' if body.pratinjau else body.format
    isi, mesin = await buat_dokumen(body.jenis, data, fmt)
    nama = nama_berkas_cetak(body.jenis, ujian, ruang, jenjang, sesi, fmt)
    header = {'Content-Disposition': f'attachment; filename="{nama}"', 'X-Mesin-Cetak': mesin,
              'Access-Control-Expose-Headers': 'Content-Disposition, X-Arsip-Id, X-Mesin-Cetak'}
    if not body.pratinjau:
        meta = dokumen_arsip(ujian_id, body.jenis, fmt, ruang, jenjang, sesi, label_sesi(sesi), nama, len(isi), mesin, user)
        try:
            await simpan_arsip(db, meta, isi)
            header['X-Arsip-Id'] = meta['id']
        except ValueError as e:
            raise HTTPException(413, str(e)) from e
        await log_audit(user, 'ujian_cetak', KOLEKSI_ARSIP, meta['id'], {
            'ujian_id': ujian_id, 'jenis': body.jenis, 'mode': body.mode, 'ruang_id': ruang['id'], 'jenjang': jenjang, 'sesi_id': sesi['id'], 'format': fmt,
        }, request=request)
    return Response(isi, media_type=MIME[fmt], headers=header)


class CetakJenjangIn(BaseModel):
    ruang_id: str = Field(..., min_length=1, max_length=64)
    jenjang: int = Field(..., ge=7, le=9)
    sesi_id: str = Field(..., min_length=1, max_length=64)
    format: Literal['pdf', 'docx'] = 'pdf'
    pratinjau: bool = False


@router.post("/ujian/{ujian_id}/cetak/daftar-hadir")
async def cetak_daftar_hadir(ujian_id: str, body: CetakJenjangIn, request: Request, user: Dict = Depends(get_current_user)):
    """Daftar Hadir Peserta untuk SATU jenjang pada SATU ruang (ruang campuran dicetak per jenjang): peserta jenjang itu
    urut nomor peserta, tanda tangan yang sudah dikirim pada sesi itu, mapel jenjang, dan pengawas dari berita acara.
    Diarsipkan otomatis (kecuali pratinjau)."""
    return await cetak_dokumen(ujian_id, CetakIn(jenis='daftar_hadir', **body.model_dump()), request, user)


@router.post("/ujian/{ujian_id}/cetak/berita-acara")
async def cetak_berita_acara(ujian_id: str, body: CetakJenjangIn, request: Request, user: Dict = Depends(get_current_user)):
    """Berita Acara untuk SATU jenjang pada SATU ruang & sesi: kelas, pukul, ruang, jumlah peserta (terbilang), nomor
    peserta hadir & tidak hadir (dari rekap yang tersalin saat pengawas mengirim berita acara; bila belum dikirim,
    dihitung dari daftar hadir saat ini), mapel jenjang, catatan, serta nama/NIP/TTD pengawas. Diarsipkan otomatis."""
    return await cetak_dokumen(ujian_id, CetakIn(jenis='berita_acara', **body.model_dump()), request, user)
