"""API Ujian Madrasah — Pengaturan Formulir: aktivasi & jendela waktu (semua ruang sekaligus), jadwal sesi, template
cetak, pola tanda tangan, dan token tautan publik.

Membaca: admin, ketua & sekretaris panitia ujian itu (menu 'formulir'). Mengubah: hanya admin, hanya ujian semester
konteks lihat; tiap perubahan menyimpan stempel bagian (oleh & waktu) dan tercatat di audit_logs.
"""
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Request

from core import db, get_current_user, get_settings, log_audit
from routers.ujian import akses_ujian, ujian_semester_konteks, wajib_pengelola
from ujian import KOLEKSI_FORMULIR, hari_ini_wib, jam_wib, ringkas_daftar_ujian
from ujian_formulir import (
    KOLEKSI_JADWAL, AktivasiIn, JadwalIn, PolaTtdIn, TemplateIn, dokumen_sesi, galat_jadwal, cek_waktu_formulir, template_bawaan, dokumen_formulir_baru, ringkas_pengaturan, ringkas_sesi, sesi_aktif,
    sesi_pada, set_ubah,
)

router = APIRouter()


async def formulir_ujian(ujian: Dict[str, Any]) -> Dict[str, Any]:
    """Pengaturan formulir satu ujian; dibuat dengan nilai bawaan (nonaktif, token acak) bila belum ada."""
    f = await db[KOLEKSI_FORMULIR].find_one({'ujian_id': ujian['id']}, {'_id': 0})
    if f:
        return f
    baru = dokumen_formulir_baru(ujian, await get_settings())
    await db[KOLEKSI_FORMULIR].update_one({'ujian_id': ujian['id']}, {'$setOnInsert': baru}, upsert=True)
    return await db[KOLEKSI_FORMULIR].find_one({'ujian_id': ujian['id']}, {'_id': 0}) or baru


async def jadwal_ujian(ujian_id: str):
    docs = await db[KOLEKSI_JADWAL].find({'ujian_id': ujian_id}, {'_id': 0}).to_list(200)
    return [ringkas_sesi(d) for d in sorted(docs, key=lambda d: (d.get('tanggal') or '', d.get('sesi_ke') or 0))]


async def _respons(ujian: Dict[str, Any], f: Dict[str, Any]) -> Dict[str, Any]:
    return ringkas_pengaturan(ujian, f, hari_ini_wib(), jam_wib())


@router.get("/ujian/{ujian_id}/formulir")
async def pengaturan_formulir(ujian_id: str, user: Dict = Depends(get_current_user)):
    """Pengaturan formulir satu ujian: aktivasi, jendela waktu, status, tautan publik, template, pola TTD, dan jadwal."""
    a = await akses_ujian(user, ujian_id, 'formulir')
    ujian = a['ujian']
    f = await formulir_ujian(ujian)
    ringkas = (await ringkas_daftar_ujian(db, [ujian], {ujian_id: a['jabatan']} if a['jabatan'] else {}, hari_ini_wib(), jam_wib()))[0]
    return {'ujian': ringkas, 'boleh_ubah': a['pengelola'], 'formulir': await _respons(ujian, f), 'jadwal': await jadwal_ujian(ujian_id)}


@router.put("/ujian/{ujian_id}/formulir/aktivasi")
async def simpan_aktivasi(ujian_id: str, body: AktivasiIn, request: Request, user: Dict = Depends(wajib_pengelola)):
    """Nyalakan/matikan formulir daftar hadir & berita acara beserta jam buka–tutup (WIB) untuk SEMUA ruang ujian ini
    sekaligus (admin). Formulir publik hanya menerima kiriman pada tanggal masa ujian di dalam jendela jam ini."""
    ujian = await ujian_semester_konteks(user, ujian_id)
    lama = await formulir_ujian(ujian)
    isi = body.model_dump()
    await db[KOLEKSI_FORMULIR].update_one({'ujian_id': ujian_id}, {'$set': set_ubah('aktivasi', isi, user)})
    await log_audit(user, 'ujian_formulir_aktivasi', KOLEKSI_FORMULIR, ujian_id, {
        'dari': {k: lama.get(k) for k in isi}, 'ke': isi}, request=request)
    return await _respons(ujian, await db[KOLEKSI_FORMULIR].find_one({'ujian_id': ujian_id}, {'_id': 0}))


@router.get("/ujian/{ujian_id}/formulir/status")
async def status_formulir_rinci(ujian_id: str, user: Dict = Depends(get_current_user)):
    """Status formulir saat ini menurut jam server WIB (terbuka/alasan/pesan) beserta sesi hari ini dan sesi aktif —
    aturan yang sama dipakai tautan publik daftar hadir & berita acara."""
    a = await akses_ujian(user, ujian_id, 'daftar_hadir')
    ujian = a['ujian']
    f = await formulir_ujian(ujian)
    hari_ini, jam = hari_ini_wib(), jam_wib()
    jadwal = await jadwal_ujian(ujian_id)
    return {'tanggal': hari_ini, 'jam': jam, **cek_waktu_formulir(ujian, f, hari_ini, jam),
            'sesi_hari_ini': sesi_pada(jadwal, hari_ini), 'sesi_aktif': sesi_aktif(jadwal, hari_ini, jam)}


@router.put("/ujian/{ujian_id}/formulir/template")
async def simpan_template(ujian_id: str, body: TemplateIn, request: Request, user: Dict = Depends(wajib_pengelola)):
    """Template cetak per ujian (admin): teks tetap lembar daftar hadir & berita acara (nama/kop madrasah, alamat, kota
    tanda tangan, singkatan & nama kegiatan, catatan kaki), mengikuti template docx madrasah."""
    ujian = await ujian_semester_konteks(user, ujian_id)
    lama = (await formulir_ujian(ujian)).get('template') or {}
    isi = body.model_dump()
    await db[KOLEKSI_FORMULIR].update_one({'ujian_id': ujian_id}, {'$set': set_ubah('template', {'template': isi}, user)})
    berubah = {k: {'dari': lama.get(k), 'ke': v} for k, v in isi.items() if lama.get(k) != v}
    await log_audit(user, 'ujian_formulir_template', KOLEKSI_FORMULIR, ujian_id, {'perubahan': berubah}, request=request)
    return await _respons(ujian, await db[KOLEKSI_FORMULIR].find_one({'ujian_id': ujian_id}, {'_id': 0}))


@router.get("/ujian/{ujian_id}/formulir/template-bawaan")
async def template_bawaan_ujian(ujian_id: str, user: Dict = Depends(get_current_user)):
    """Isian template bawaan untuk jenis ujian ini (nama & alamat madrasah dari Pengaturan) — tombol "Kembalikan Bawaan"."""
    a = await akses_ujian(user, ujian_id, 'formulir')
    return template_bawaan(a['ujian'].get('jenis'), await get_settings())


@router.put("/ujian/{ujian_id}/formulir/pola-ttd")
async def simpan_pola_ttd(ujian_id: str, body: PolaTtdIn, request: Request, user: Dict = Depends(wajib_pengelola)):
    """Pola tanda tangan per ujian (admin): apakah PNG tanda tangan (digambar di layar seperti angket) tampil di lembar
    cetak, dan tingginya (8–20 mm). Bila dimatikan, kolom TTD dicetak kosong untuk tanda tangan basah."""
    ujian = await ujian_semester_konteks(user, ujian_id)
    lama = (await formulir_ujian(ujian)).get('pola_ttd') or {}
    isi = body.model_dump()
    await db[KOLEKSI_FORMULIR].update_one({'ujian_id': ujian_id}, {'$set': set_ubah('pola_ttd', {'pola_ttd': isi}, user)})
    await log_audit(user, 'ujian_formulir_pola_ttd', KOLEKSI_FORMULIR, ujian_id, {'dari': lama, 'ke': isi}, request=request)
    return await _respons(ujian, await db[KOLEKSI_FORMULIR].find_one({'ujian_id': ujian_id}, {'_id': 0}))


@router.put("/ujian/{ujian_id}/formulir/jadwal")
async def simpan_jadwal(ujian_id: str, body: JadwalIn, request: Request, user: Dict = Depends(wajib_pengelola)):
    """Jadwal sesi ujian (admin): seluruh sesi diganti dengan isian ini. Tiap sesi = tanggal (dalam masa ujian),
    sesi ke-, jam mulai–selesai, dan mapel per jenjang — mengisi "Hari, tanggal", "Pukul", dan "Mata Pelajaran" pada
    daftar hadir & berita acara. Sesi yang sudah dipakai daftar hadir tidak boleh dihapus (409)."""
    ujian = await ujian_semester_konteks(user, ujian_id)
    await formulir_ujian(ujian)
    galat = galat_jadwal(body.sesi, ujian['mulai'], ujian['selesai'])
    if galat:
        raise HTTPException(400, '; '.join(galat))
    lama = {(d['tanggal'], d['sesi_ke']): d for d in await db[KOLEKSI_JADWAL].find({'ujian_id': ujian_id}, {'_id': 0}).to_list(200)}
    baru_kunci = {(s.tanggal, s.sesi_ke) for s in body.sesi}
    terpakai = [k for k, d in lama.items() if k not in baru_kunci
                and await db['daftar_hadir'].count_documents({'ujian_id': ujian_id, 'sesi_id': d['id']})]
    if terpakai:
        raise HTTPException(409, 'Sesi sudah dipakai daftar hadir dan tidak dapat dihapus: '
                                 + ', '.join(f'{t} sesi {s}' for t, s in sorted(terpakai)))
    # id sesi lama dipertahankan (daftar hadir & berita acara merujuk sesi_id); sesi baru diberi id baru.
    await db[KOLEKSI_JADWAL].delete_many({'ujian_id': ujian_id})
    for s in sorted(body.sesi, key=lambda x: (x.tanggal, x.sesi_ke)):
        doc = dokumen_sesi(ujian_id, s)
        if (s.tanggal, s.sesi_ke) in lama:
            doc['id'] = lama[(s.tanggal, s.sesi_ke)]['id']
        await db[KOLEKSI_JADWAL].insert_one(doc)
    await db[KOLEKSI_FORMULIR].update_one({'ujian_id': ujian_id}, {'$set': set_ubah('jadwal', {}, user)})
    await log_audit(user, 'ujian_formulir_jadwal', KOLEKSI_JADWAL, ujian_id, {
        'sebelum': len(lama), 'sesudah': len(body.sesi), 'sesi': [f'{s.tanggal} #{s.sesi_ke}' for s in body.sesi]}, request=request)
    return {'jadwal': await jadwal_ujian(ujian_id), 'formulir': await _respons(ujian, await db[KOLEKSI_FORMULIR].find_one({'ujian_id': ujian_id}, {'_id': 0}))}
