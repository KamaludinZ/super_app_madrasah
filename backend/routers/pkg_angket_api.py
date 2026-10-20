"""API angket penilaian 360° PKG (sejawat, peserta didik, orang tua/wali) — angket dicetak di kertas, diisi responden
tanpa akun, lalu rekap jawabannya diinput kembali oleh kepala madrasah atau tim penilai.

Otorisasi: personil PKG pada periode (pkg_rekap.anggota_periode) yang berperan pengelola (kepala madrasah atau penilai);
guru dibatasi cakupan peran (kepala semua guru, penilai guru yang dinilainya). Cetak angket memakai bagian sheet
FORM-360-GR template resmi; PDF lewat LibreOffice dengan cadangan ReportLab berpenanda. Setiap unduhan tercatat di
riwayat unduhan & jejak audit (jenis dokumen 'angket').
"""
from datetime import date
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request

from core import db, get_current_user
from pkg_akses import keanggotaan_sk, tolak
from pkg_angket import (
    JENIS_ANGKET, AngketPenuh, angket_excel, butir_angket, daftar_jenis, responden_guru, skor_360, skor_360_periode,
    tambah_responden, ubah_responden,
)
from pkg_audit import catat_audit_pkg, catat_cetak_gagal, catat_cetak_template
from pkg_pdf_cadangan import angket_pdf_cadangan
from pkg_rekap import agregasi_rekap, anggota_periode, cakupan_rekap, periode_dan_sk
from pkg_skema import KOLEKSI_ANGKET, POLA_ID, AngketCetakRequest, AngketJawabanRequest
from pkg_template import TEMPLATE_PKG, TemplateTidakTersedia, nama_berkas_cetak
from routers.pkg_cetak_api import buat_pdf, respon_berkas

router = APIRouter()


async def konteks_pengelola(db_, user: Dict[str, Any], periode_id: Optional[str], guru_id: Optional[str]) -> Dict[str, Any]:
    """Periode, SK, dan cakupan pengguna pengelola angket; guru (bila ada) harus dalam cakupan & bukan diri sendiri.
    Hasil {periode, sk, cakupan, guru: {id, nama, nip, mapel, tugas_tambahan} | None}."""
    periode, sk = await periode_dan_sk(db_, periode_id)
    if not await anggota_periode(db_, user, periode, sk):
        raise tolak('bukan_anggota_sk', 'Anda tidak termasuk personil PKG pada periode ini.')
    cakupan = await cakupan_rekap(db_, user, await keanggotaan_sk(db_, user), periode)
    if cakupan['cakupan'] == 'pribadi':
        raise tolak('bukan_penilai', 'Angket 360° hanya dikelola kepala madrasah dan tim penilai.')
    guru = None
    if guru_id:
        if (guru_id == cakupan['diri'] and cakupan['cakupan'] != 'semua') or (
                cakupan['guru'] is not None and guru_id not in cakupan['guru']):
            raise tolak('bukan_penugasan', 'Guru ini tidak termasuk dalam cakupan Anda.')
        snap = ((sk or {}).get('snapshot_anggota') or {}).get(guru_id) or {}
        akun = await db_.users.find_one({'id': guru_id}, {'_id': 0, 'full_name': 1, 'nip': 1, 'nip_nuptk': 1, 'tugas_tambahan': 1}) or {}
        if not snap and not akun:
            raise HTTPException(404, 'Guru tidak ditemukan.')
        guru = {'id': guru_id, 'nama': snap.get('nama') or akun.get('full_name'), 'nip': snap.get('nip') or akun.get('nip') or akun.get('nip_nuptk'),
                'mapel': snap.get('mapel'), 'tugas_tambahan': akun.get('tugas_tambahan')}
    return {'periode': periode, 'sk': sk, 'cakupan': cakupan, 'guru': guru}


@router.get("/pkg/angket/jenis")
async def jenis_angket_api(user: Dict = Depends(get_current_user)):
    """Jenis angket 360° (sejawat, siswa, ortu) dengan jumlah butir, skor maksimum per responden, dan batas responden."""
    if not (await keanggotaan_sk(db, user)).get('anggota'):
        raise tolak('bukan_anggota_sk', 'Anda tidak termasuk personil PKG.')
    try:
        return daftar_jenis()
    except TemplateTidakTersedia as e:
        raise HTTPException(503, str(e)) from e


@router.post("/pkg/angket/cetak")
async def cetak_angket_api(data: AngketCetakRequest, request: Request, user: Dict = Depends(get_current_user)):
    """Unduh angket kertas 360° satu jenis (bagian FORM-360-GR) — identitas guru terisi bila `guru_id` diberikan,
    tanpa guru_id berupa angket kosong. Excel dari template resmi atau PDF (LibreOffice; cadangan ReportLab
    berpenanda). 403 di luar hak/cakupan, 503 bila template tidak tersedia/berubah."""
    meta = {'jenis_dokumen': 'angket', 'jenis_angket': data.jenis_angket, 'format': data.format,
            'periode_id': data.periode_id, 'guru_id': data.guru_id, 'endpoint': request.url.path}
    try:
        try:
            ktx = await konteks_pengelola(db, user, data.periode_id, data.guru_id)
            xlsx = angket_excel(data.jenis_angket, ktx['guru'])
        except TemplateTidakTersedia as e:
            raise HTTPException(503, str(e)) from e
    except HTTPException as e:
        await catat_cetak_gagal(db, user, e.status_code, e.detail, meta, request=request)
        raise
    guru = ktx['guru']
    label = JENIS_ANGKET[data.jenis_angket]['label'].replace(' ', '_').replace('/', '_')
    siap = {'xlsx': xlsx, 'dasar_nama': f"Angket_360_{label}_{(guru or {}).get('nama') or 'Kosong'}",
            'cadangan': lambda: angket_pdf_cadangan(data.jenis_angket, guru)}
    if data.format == 'pdf':
        isi, mesin, alasan = await buat_pdf(siap)
    else:
        isi, mesin, alasan = xlsx, 'openpyxl', None
    nama = nama_berkas_cetak(siap['dasar_nama'], data.format)
    info = TEMPLATE_PKG['instrumen']
    await catat_cetak_template(db, user, 'instrumen', data.format, nama, info['versi'], info['checksum_resmi'],
                               periode_id=ktx['periode']['id'], request=request, jenis_dokumen='angket',
                               guru_id=data.guru_id, mesin=mesin, isi=isi,
                               metadata={'jenis_angket': data.jenis_angket, 'tanggal_cetak': date.today().isoformat(),
                                         'alasan_cadangan': alasan, 'endpoint': meta['endpoint']})
    return respon_berkas(isi, nama, data.format, mesin, alasan)


# ---------------------------------------------------------------- rekap jawaban angket per responden

def _wajib_berjalan(periode: Dict[str, Any]) -> None:
    if periode.get('status') != 'berjalan':
        raise HTTPException(409, 'Jawaban angket hanya dapat diubah pada periode yang sedang berjalan.')


def _responden_publik(d: Dict[str, Any]) -> Dict[str, Any]:
    return {k: d.get(k) for k in ('id', 'jenis', 'urutan', 'nama_responden', 'jawaban', 'skor', 'skor_maks', 'nilai',
                                  'diinput_oleh_nama', 'tanggal_input', 'diubah_pada')}


@router.get("/pkg/angket/ringkasan")
async def ringkasan_angket_api(periode_id: Optional[str] = Query(None, pattern=POLA_ID), user: Dict = Depends(get_current_user)):
    """Ringkasan angket 360° seluruh guru dalam cakupan pada periode: jumlah responden, nilai & sebutan per jenis, dan
    status lengkap (setiap jenis minimal satu responden)."""
    ktx = await konteks_pengelola(db, user, periode_id, None)
    cakupan = ktx['cakupan']
    saring = cakupan['guru'] - {cakupan['diri']} if cakupan['guru'] is not None else None
    agregat = await agregasi_rekap(db, ktx['periode'], ktx['sk'], saring_guru=saring)
    skor = await skor_360_periode(db, ktx['periode']['id'], [g['guru_id'] for g in agregat['guru']])
    return {
        'periode': {k: ktx['periode'].get(k) for k in ('id', 'nama_periode', 'status')},
        'guru': [{'guru_id': g['guru_id'], 'nama': g['nama'], 'mapel': g['mapel'], 'penilai_nama': g['penilai_nama'],
                  'status': g['status'], **skor[g['guru_id']]} for g in agregat['guru']],
    }


@router.get("/pkg/angket/guru/{guru_id}")
async def angket_guru_api(guru_id: str = Path(..., pattern=POLA_ID), periode_id: Optional[str] = Query(None, pattern=POLA_ID),
                          user: Dict = Depends(get_current_user)):
    """Angket 360° satu guru: butir setiap jenis (urutan sheet template), responden beserta jawabannya, dan skor 360°
    per jenis (rata-rata nilai responden, seperti sel Hasil Nilai sheet SEJAWAT/SISWA/ORTU)."""
    ktx = await konteks_pengelola(db, user, periode_id, guru_id)
    responden = await responden_guru(db, ktx['periode']['id'], guru_id)
    skor = await skor_360(db, ktx['periode']['id'], guru_id)
    return {
        'periode': {k: ktx['periode'].get(k) for k in ('id', 'nama_periode', 'status')},
        'guru': ktx['guru'],
        'jenis': [{**skor['per_jenis'][j], 'butir': [{k: b[k] for k in ('no', 'komponen', 'nomor', 'pernyataan')} for b in butir_angket(j)],
                   'responden': [_responden_publik(d) for d in responden if d['jenis'] == j]} for j in JENIS_ANGKET],
        'lengkap': skor['lengkap'],
    }


@router.post("/pkg/angket/guru/{guru_id}/jawaban")
async def tambah_jawaban_api(data: AngketJawabanRequest, request: Request, guru_id: str = Path(..., pattern=POLA_ID),
                             user: Dict = Depends(get_current_user)):
    """Input rekap jawaban angket kertas satu responden (skor 0/1/2 setiap butir). Responden menempati kolom penilai
    kosong pertama (maks. 10 per jenis seperti template). 409 bila penuh atau periode tidak berjalan; 422 bila jumlah
    jawaban tidak sama dengan jumlah butir."""
    ktx = await konteks_pengelola(db, user, data.periode_id, guru_id)
    _wajib_berjalan(ktx['periode'])
    try:
        doc = await tambah_responden(db, ktx['periode']['id'], guru_id, data.jenis_angket, data.jawaban, data.nama_responden, user)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
    except AngketPenuh as e:
        raise HTTPException(409, str(e)) from e
    await catat_audit_pkg(db, 'angket_simpan', user, {'periode_id': ktx['periode']['id'], 'guru_id': guru_id,
                                                      'jenis_angket': data.jenis_angket, 'urutan': doc['urutan'], 'nilai': doc['nilai']},
                          request=request)
    return _responden_publik(doc)


async def _responden_milik(user: Dict[str, Any], responden_id: str) -> tuple:
    doc = await db[KOLEKSI_ANGKET].find_one({'id': responden_id}, {'_id': 0})
    if not doc:
        raise HTTPException(404, 'Jawaban angket tidak ditemukan.')
    ktx = await konteks_pengelola(db, user, doc['periode_id'], doc['guru_dinilai_id'])
    _wajib_berjalan(ktx['periode'])
    return doc, ktx


@router.put("/pkg/angket/jawaban/{responden_id}")
async def ubah_jawaban_api(data: AngketJawabanRequest, request: Request, responden_id: str = Path(..., pattern=POLA_ID),
                           user: Dict = Depends(get_current_user)):
    """Ubah rekap jawaban satu responden (jenis angket tidak dapat diganti)."""
    doc, ktx = await _responden_milik(user, responden_id)
    if data.jenis_angket != doc['jenis']:
        raise HTTPException(422, 'Jenis angket responden tidak dapat diganti.')
    try:
        baru = await ubah_responden(db, doc, data.jawaban, data.nama_responden)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
    await catat_audit_pkg(db, 'angket_ubah', user, {'periode_id': doc['periode_id'], 'guru_id': doc['guru_dinilai_id'],
                                                    'jenis_angket': doc['jenis'], 'urutan': doc['urutan'],
                                                    'nilai_sebelum': doc.get('nilai'), 'nilai': baru['nilai']}, request=request)
    return _responden_publik(baru)


@router.delete("/pkg/angket/jawaban/{responden_id}")
async def hapus_jawaban_api(request: Request, responden_id: str = Path(..., pattern=POLA_ID), user: Dict = Depends(get_current_user)):
    """Hapus rekap jawaban satu responden; kolom penilainya kosong kembali."""
    doc, _ = await _responden_milik(user, responden_id)
    await db[KOLEKSI_ANGKET].delete_one({'id': responden_id})
    await catat_audit_pkg(db, 'angket_hapus', user, {'periode_id': doc['periode_id'], 'guru_id': doc['guru_dinilai_id'],
                                                     'jenis_angket': doc['jenis'], 'urutan': doc['urutan'], 'nilai': doc.get('nilai')},
                          request=request)
    return {'id': responden_id, 'dihapus': True}
