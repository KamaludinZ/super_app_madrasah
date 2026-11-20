"""Ujian Madrasah — Arsip Administrasi Ujian: setiap hasil cetak daftar hadir & berita acara tersimpan dan dapat
ditelusuri kembali per ujian (akses terbatas: admin, waka kurikulum, kepala madrasah, ketua & sekretaris panitia).

Koleksi & index didefinisikan bersama berita acara (ujian_berita_acara.INDEX_BERITA_ACARA; migrasi
migrate_ujian_berita_acara):
  `arsip_ujian`         metadata arsip (kontrak `Arsip` di frontend/src/lib/ujianCetak.js)
  `arsip_ujian_berkas`  isi berkas (bytes) terpisah agar daftar arsip ringan
"""
import re
import uuid
from datetime import datetime
from typing import Any, Dict, Optional, Tuple

from ujian import sekarang_wib
from ujian_berita_acara import KOLEKSI_ARSIP, KOLEKSI_ARSIP_BERKAS

FIELD_ARSIP = ('id', 'ujian_id', 'ruang_id', 'nama_ruang', 'jenjang', 'sesi_id', 'sesi_label', 'jenis_dokumen', 'format',
               'nama_berkas', 'ukuran', 'mesin', 'dibuat_oleh_nama', 'waktu')
MIME = {'pdf': 'application/pdf', 'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}
ARSIP_MAKS_BYTE = 15 * 1024 * 1024  # batas aman di bawah 16 MB dokumen MongoDB


def nama_berkas_cetak(jenis: str, ujian: Dict[str, Any], ruang: Dict[str, Any], jenjang: int, sesi: Dict[str, Any], fmt: str) -> str:
    """mis. berita_acara_ASAS_Ganjil_2026_2027_ruang_01_kelas_7_2026-12-02_sesi_1.pdf"""
    dasar = f"{jenis}_{ujian.get('nama') or 'ujian'}_ruang_{ruang.get('nama_ruang')}_kelas_{jenjang}_{sesi.get('tanggal')}_sesi_{sesi.get('sesi_ke')}"
    return re.sub(r'_+', '_', re.sub(r'[^\w.-]+', '_', dasar)).strip('_') + f'.{fmt}'


def dokumen_arsip(ujian_id: str, jenis: str, fmt: str, ruang: Dict[str, Any], jenjang: int, sesi: Dict[str, Any], sesi_label: str,
                  nama_berkas: str, ukuran: int, mesin: str, oleh: Dict[str, Any], waktu: datetime = None) -> Dict[str, Any]:
    return {
        'id': str(uuid.uuid4()), 'ujian_id': ujian_id, 'ruang_id': ruang['id'], 'nama_ruang': ruang.get('nama_ruang'), 'jenjang': jenjang,
        'sesi_id': sesi['id'], 'sesi_label': sesi_label, 'jenis_dokumen': jenis, 'format': fmt, 'nama_berkas': nama_berkas,
        'ukuran': ukuran, 'mesin': mesin, 'dibuat_oleh': oleh.get('id'), 'dibuat_oleh_nama': oleh.get('full_name') or oleh.get('username'),
        'waktu': (waktu or sekarang_wib()).isoformat(),
    }


async def simpan_arsip(db, meta: Dict[str, Any], isi: bytes) -> Dict[str, Any]:
    """Simpan metadata + isi berkas. ValueError bila berkas terlalu besar untuk diarsipkan."""
    if len(isi) > ARSIP_MAKS_BYTE:
        raise ValueError('Berkas terlalu besar untuk diarsipkan')
    await db[KOLEKSI_ARSIP_BERKAS].insert_one({'arsip_id': meta['id'], 'isi': isi, 'mime': MIME.get(meta['format'], 'application/octet-stream')})
    await db[KOLEKSI_ARSIP].insert_one(dict(meta))
    return meta


async def ambil_berkas_arsip(db, arsip_id: str) -> Optional[Tuple[Dict[str, Any], bytes]]:
    meta = await db[KOLEKSI_ARSIP].find_one({'id': arsip_id}, {'_id': 0})
    b = await db[KOLEKSI_ARSIP_BERKAS].find_one({'arsip_id': arsip_id}, {'_id': 0}) if meta else None
    return (meta, bytes(b['isi'])) if meta and b and b.get('isi') is not None else None


def ringkas_arsip(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {k: doc.get(k) for k in FIELD_ARSIP}
