"""API jejak audit PKG (khusus kepala madrasah): daftar aksi tersaring & berhalaman, dan riwayat aksi lembar per guru.

Data dibaca dari pkg_audit_log (lihat pkg_audit.py); membuka halaman ini juga tercatat (lihat_audit, harian).
"""
from datetime import date
from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request

from core import db
from pkg_audit import AKSI_LIHAT_AUDIT, KATEGORI_AUDIT, LABEL_AKSI, catat_audit_pkg_harian
from pkg_jejak_audit import daftar_audit, riwayat_aksi_guru
from pkg_penjaga import penjaga_pkg
from pkg_skema import POLA_ID

router = APIRouter()

kepala = penjaga_pkg('kepala')
POLA_TANGGAL = r'^\d{4}-\d{2}-\d{2}$'


@router.get("/pkg/audit")
async def daftar_audit_api(
    request: Request,
    kategori: Optional[str] = Query(None, pattern='^(' + '|'.join(KATEGORI_AUDIT) + ')$'),
    aksi: Optional[str] = Query(None, pattern=r'^[a-z_]{1,40}$'),
    aktor_id: Optional[str] = Query(None, pattern=POLA_ID),
    guru_id: Optional[str] = Query(None, pattern=POLA_ID),
    periode_id: Optional[str] = Query(None, pattern=POLA_ID),
    dari: Optional[str] = Query(None, pattern=POLA_TANGGAL),
    sampai: Optional[str] = Query(None, pattern=POLA_TANGGAL),
    cari: Optional[str] = Query(None, max_length=100),
    halaman: int = Query(1, ge=1, le=10000),
    per_halaman: int = Query(20, ge=1, le=100),
    akses: Dict = Depends(kepala),
):
    """Jejak audit PKG terbaru dulu: saring kategori, aksi, pelaku, guru, periode, rentang tanggal WIB (inklusif), dan
    teks (pelaku, nama guru, label aksi, nama berkas, nomor SK, nama periode, kode sub, alasan). Setiap entri memuat
    label & ringkasan. Hasil {item, total, halaman, per_halaman}. Khusus kepala madrasah (403 selainnya)."""
    if aksi and aksi not in LABEL_AKSI:
        raise HTTPException(422, {'pesan': 'Jenis aksi tidak dikenal.', 'galat': [{'lokasi': 'aksi', 'pesan': 'tidak dikenal'}]})
    try:
        for tanggal in filter(None, (dari, sampai)):
            date.fromisoformat(tanggal)
    except ValueError as e:
        raise HTTPException(422, 'Tanggal saringan tidak valid.') from e
    if dari and sampai and dari > sampai:
        raise HTTPException(422, 'Tanggal awal melewati tanggal akhir.')
    hasil = await daftar_audit(db, kategori=kategori, aksi=aksi, aktor_id=aktor_id, guru_id=guru_id, periode_id=periode_id,
                               dari=dari, sampai=sampai, cari=cari, halaman=halaman, per_halaman=per_halaman)
    # Dicatat setelah membaca agar pembukaan ini tidak muncul di daftarnya sendiri.
    await catat_audit_pkg_harian(db, AKSI_LIHAT_AUDIT, akses['user'], kunci='daftar', request=request)
    return hasil


@router.get("/pkg/audit/guru/{guru_id}")
async def riwayat_aksi_guru_api(guru_id: str = Path(..., pattern=POLA_ID),
                                periode_id: Optional[str] = Query(None, pattern=POLA_ID), akses: Dict = Depends(kepala)):
    """Riwayat aksi lembar penilaian satu guru (mulai, buka, draf, kirim & kunci) oleh penilainya, terbaru dulu."""
    return await riwayat_aksi_guru(db, guru_id, periode_id)
