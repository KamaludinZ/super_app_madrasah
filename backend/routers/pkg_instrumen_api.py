"""API instrumen PKG: baca instrumen aktif & daftar versi (anggota SK), impor dari template/unggahan (kepala)."""
from typing import Dict, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Path, Query, Request, UploadFile

from core import db
from pkg_audit import catat_audit_instrumen
from pkg_instrumen import (
    ambil_instrumen, daftar_kompetensi, daftar_versi, instrumen_aktif, instrumen_tampil, simpan_pratinjau,
    aktifkan_instrumen, ringkas_perubahan_sub, riwayat_instrumen, terapkan_pratinjau, ubah_sub_instrumen,
)
from pkg_instrumen_impor import BATAS_UKURAN_BERKAS, GalatImporInstrumen, pratinjau_dari_bytes, pratinjau_dari_template
from pkg_penjaga import penjaga_pkg
from pkg_skema import (
    POLA_ID, POLA_KODE_SUB, AktifkanInstrumenRequest, TerapkanImporRequest, UbahSubInstrumenRequest,
)
from pkg_template import TemplateTidakTersedia

router = APIRouter()

anggota_sk = penjaga_pkg('anggota')
kepala = penjaga_pkg('kepala')


@router.get("/pkg/instrumen/aktif")
async def instrumen_aktif_api(akses: Dict = Depends(anggota_sk)):
    """Instrumen aktif acuan lembar penilaian baru; null bila belum diimpor."""
    return instrumen_tampil(await instrumen_aktif(db))


@router.get("/pkg/instrumen")
async def daftar_versi_api(akses: Dict = Depends(anggota_sk)):
    """Semua versi instrumen (terbaru dulu) dengan jumlah lembar penilaian yang memakainya."""
    return await daftar_versi(db)


@router.post("/pkg/instrumen/impor/pratinjau")
async def pratinjau_impor_api(
    sumber: str = Form('template', pattern='^(template|unggah)$'),
    berkas: Optional[UploadFile] = File(None),
    akses: Dict = Depends(kepala),
):
    """Baca instrumen dari template resmi di server (`sumber=template`) atau berkas .xlsx unggahan (`sumber=unggah`)
    tanpa menyimpan apa pun; kembalikan pratinjau + token untuk diterapkan. Galat baca: 422 {pesan, galat}."""
    try:
        if sumber == 'template':
            pratinjau = pratinjau_dari_template()
        else:
            if berkas is None or not (berkas.filename or '').lower().endswith('.xlsx'):
                raise HTTPException(400, 'Unggah berkas Excel berformat .xlsx.')
            isi = await berkas.read(BATAS_UKURAN_BERKAS + 1)
            pratinjau = pratinjau_dari_bytes(isi, 'unggah', (berkas.filename or 'instrumen.xlsx')[-120:])
    except GalatImporInstrumen as e:
        raise HTTPException(422, {'pesan': e.pesan, 'galat': e.galat[:50]}) from e
    except TemplateTidakTersedia as e:
        raise HTTPException(503, str(e)) from e
    return await simpan_pratinjau(db, pratinjau, akses['user'])


@router.post("/pkg/instrumen/impor")
async def terapkan_impor_api(data: TerapkanImporRequest, request: Request, akses: Dict = Depends(kepala)):
    """Terapkan pratinjau sebagai instrumen aktif baru (revisi berikutnya); instrumen lama tetap tersimpan."""
    hasil = await terapkan_pratinjau(db, data.token, akses['user'])
    baru = hasil['instrumen']
    await catat_audit_instrumen(db, 'instrumen_impor', akses['user'], baru, hasil['sebelumnya'], {
        'sumber': baru['sumber'], 'nama_berkas': baru['nama_berkas'], 'checksum': baru['checksum'],
        'cocok_resmi': baru['cocok_resmi'], 'instrumen_sebelumnya': hasil['hasil']['instrumen_sebelumnya'],
    }, request=request)
    return {'instrumen': instrumen_tampil(baru), 'hasil': hasil['hasil']}


@router.put("/pkg/instrumen/aktif/sub/{kode}")
async def ubah_sub_api(data: UbahSubInstrumenRequest, request: Request, kode: str = Path(..., pattern=POLA_KODE_SUB),
                       akses: Dict = Depends(kepala)):
    """Ubah nama, bobot, dan teks indikator satu sub-kompetensi instrumen aktif (alasan wajib). Instrumen yang sudah
    dipakai lembar penilaian disimpan sebagai revisi baru agar penilaian lama tetap utuh."""
    hasil = await ubah_sub_instrumen(db, kode, data, akses['user'])
    baru = hasil['instrumen']
    await catat_audit_instrumen(db, 'instrumen_ubah', akses['user'], baru, hasil['sebelumnya'], {
        'revisi_baru': hasil['revisi_baru'], 'kode_sub': kode,
        'alasan': data.alasan, 'perubahan': ringkas_perubahan_sub(hasil['sebelum'], hasil['sesudah']),
        'sebelum': hasil['sebelum'], 'sesudah': hasil['sesudah'],
    }, request=request)
    return instrumen_tampil(baru)


@router.get("/pkg/instrumen/riwayat")
async def riwayat_instrumen_api(akses: Dict = Depends(kepala)):
    """Riwayat perubahan instrumen (impor, ubah sub, penetapan acuan) dari jejak audit PKG, terbaru dulu."""
    return await riwayat_instrumen(db)


# Rute literal (/aktif, /riwayat, /impor/...) didaftarkan lebih dahulu sehingga tidak tertangkap parameter {instrumen_id}.
@router.get("/pkg/instrumen/{instrumen_id}")
async def rincian_instrumen_api(instrumen_id: str = Path(..., pattern=POLA_ID), akses: Dict = Depends(anggota_sk)):
    """Instrumen versi tertentu (mis. yang dirujuk lembar penilaian lama)."""
    return instrumen_tampil(await ambil_instrumen(db, instrumen_id))


@router.get("/pkg/instrumen/{instrumen_id}/kompetensi")
async def daftar_kompetensi_api(
    instrumen_id: str = Path(..., pattern=POLA_ID),
    kompetensi: Optional[str] = Query(None, pattern=r'^\d{1,2}$'),
    cari: Optional[str] = Query(None, max_length=100),
    akses: Dict = Depends(anggota_sk),
):
    """Daftar kompetensi & indikator dengan bobot dan porsi persen; `instrumen_id` boleh 'aktif'.
    Filter: `kompetensi` (kode) dan `cari` (nama kompetensi/sub atau teks indikator)."""
    return daftar_kompetensi(await ambil_instrumen(db, instrumen_id), kompetensi, cari)


@router.post("/pkg/instrumen/{instrumen_id}/aktifkan")
async def aktifkan_instrumen_api(data: AktifkanInstrumenRequest, request: Request,
                                 instrumen_id: str = Path(..., pattern=POLA_ID), akses: Dict = Depends(kepala)):
    """Tandai versi instrumen sebagai acuan aktif lembar penilaian baru (mis. kembali ke revisi sebelumnya).
    Alasan wajib; lembar yang sudah ada tetap memakai versinya."""
    hasil = await aktifkan_instrumen(db, instrumen_id)
    baru, lama = hasil['instrumen'], hasil['sebelumnya']
    await catat_audit_instrumen(db, 'instrumen_aktifkan', akses['user'], baru, lama, {
        'alasan': data.alasan,
        'sebelumnya': {k: lama.get(k) for k in ('id', 'versi_template', 'revisi')} if lama else None,
    }, request=request)
    return instrumen_tampil(baru)
