"""Service instrumen PKG: bentuk tampilan, ringkasan, dan pembacaan instrumen aktif. Skema: lihat pkg_skema.

Bentuk untuk API (sama dengan kontrak frontend lib/pkgInstrumen):
    instrumen = {id, versi_template, revisi, checksum, cocok_resmi, sumber, nama_berkas, is_active, diimpor_pada,
                 kompetensi: [{kode, nama, sub: [{kode, nama, bobot, indikator: [{level, teks}]}]}]}
    versi     = {id, versi_template, revisi, checksum, cocok_resmi, is_active, diimpor_pada, dipakai_penilaian}
"""
from typing import Any, Dict, List, Optional

from pkg_skema import KOLEKSI_INSTRUMEN, KOLEKSI_PENILAIAN

KUNCI_TAMPIL = ('id', 'versi_template', 'revisi', 'checksum', 'cocok_resmi', 'sumber', 'nama_berkas', 'is_active',
                'diimpor_pada', 'revisi_dari')


def instrumen_tampil(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not doc:
        return None
    return {**{k: doc.get(k) for k in KUNCI_TAMPIL}, 'kompetensi': doc.get('kompetensi') or []}


def daftar_sub(instrumen: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [s for k in (instrumen or {}).get('kompetensi') or [] for s in k.get('sub') or []]


def ringkas_instrumen(instrumen: Optional[Dict[str, Any]]) -> Dict[str, int]:
    """Jumlah kompetensi, sub-kompetensi, indikator, dan skor maksimal (5 per sub, rumus template resmi)."""
    sub = daftar_sub(instrumen)
    return {
        'kompetensi': len((instrumen or {}).get('kompetensi') or []),
        'sub': len(sub),
        'indikator': sum(len(s.get('indikator') or []) for s in sub),
        'skor_maks': sum(len(s.get('indikator') or []) for s in sub),
    }


async def instrumen_aktif(db) -> Optional[Dict[str, Any]]:
    return await db[KOLEKSI_INSTRUMEN].find_one({'is_active': True}, {'_id': 0})


async def daftar_versi(db) -> List[Dict[str, Any]]:
    """Semua versi instrumen (terbaru dulu) beserta jumlah lembar penilaian yang memakainya."""
    docs = await db[KOLEKSI_INSTRUMEN].find({}, {'_id': 0, 'kompetensi': 0}).to_list(500)
    docs.sort(key=lambda d: (d.get('diimpor_pada') or '', d.get('revisi') or 0), reverse=True)
    hasil = []
    for d in docs:
        dipakai = await db[KOLEKSI_PENILAIAN].count_documents({'instrumen_id': d['id']})
        hasil.append({k: d.get(k) for k in ('id', 'versi_template', 'revisi', 'checksum', 'cocok_resmi', 'is_active',
                                             'diimpor_pada')} | {'dipakai_penilaian': dipakai})
    return hasil
