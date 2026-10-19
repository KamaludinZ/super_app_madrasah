"""API instrumen PKG: baca instrumen aktif & daftar versi (anggota SK), impor dari template/unggahan (kepala)."""
from typing import Dict, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile

from core import db
from pkg_audit import catat_audit_pkg
from pkg_instrumen import daftar_versi, instrumen_aktif, instrumen_tampil, simpan_pratinjau, terapkan_pratinjau
from pkg_instrumen_impor import BATAS_UKURAN_BERKAS, GalatImporInstrumen, pratinjau_dari_bytes, pratinjau_dari_template
from pkg_penjaga import penjaga_pkg
from pkg_skema import TerapkanImporRequest
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
    sumber: str = Form('template'),
    berkas: Optional[UploadFile] = File(None),
    akses: Dict = Depends(kepala),
):
    """Baca instrumen dari template resmi di server (`sumber=template`) atau berkas .xlsx unggahan (`sumber=unggah`)
    tanpa menyimpan apa pun; kembalikan pratinjau + token untuk diterapkan. Galat baca: 422 {pesan, galat}."""
    try:
        if sumber == 'template':
            pratinjau = pratinjau_dari_template()
        elif sumber == 'unggah':
            if berkas is None or not (berkas.filename or '').lower().endswith('.xlsx'):
                raise HTTPException(400, 'Unggah berkas Excel berformat .xlsx.')
            isi = await berkas.read(BATAS_UKURAN_BERKAS + 1)
            pratinjau = pratinjau_dari_bytes(isi, 'unggah', (berkas.filename or 'instrumen.xlsx')[-120:])
        else:
            raise HTTPException(400, "Sumber harus 'template' atau 'unggah'.")
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
    await catat_audit_pkg(db, 'instrumen_impor', akses['user'], {
        'instrumen_id': baru['id'], 'versi_template': baru['versi_template'], 'revisi': baru['revisi'],
        'sumber': baru['sumber'], 'nama_berkas': baru['nama_berkas'], 'checksum': baru['checksum'],
        'cocok_resmi': baru['cocok_resmi'], 'instrumen_sebelumnya': hasil['hasil']['instrumen_sebelumnya'],
    }, request=request)
    return {'instrumen': instrumen_tampil(baru), 'hasil': hasil['hasil']}
