"""Service instrumen PKG: bentuk tampilan, ringkasan, dan pembacaan instrumen aktif. Skema: lihat pkg_skema.

Bentuk untuk API (sama dengan kontrak frontend lib/pkgInstrumen):
    instrumen = {id, versi_template, revisi, checksum, cocok_resmi, sumber, nama_berkas, is_active, diimpor_pada,
                 kompetensi: [{kode, nama, sub: [{kode, nama, bobot, indikator: [{level, teks}]}]}]}
    versi     = {id, versi_template, revisi, checksum, cocok_resmi, is_active, diimpor_pada, dipakai_penilaian}
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

from pkg_skema import KOLEKSI_INSTRUMEN, KOLEKSI_PENILAIAN, KOLEKSI_PRATINJAU_IMPOR

logger = logging.getLogger('matsandatama')

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


async def periksa_instrumen_startup(db, hasil_template: Dict[str, Any]) -> Dict[str, Any]:
    """Saat startup: peringatkan bila belum ada instrumen aktif padahal template instrumen tersedia, atau instrumen
    aktif berasal dari versi template lain. Hasil: {'aktif': bool, 'versi_aktif', 'versi_template', 'sejalan'}."""
    aktif = await db[KOLEKSI_INSTRUMEN].find_one({'is_active': True}, {'_id': 0, 'versi_template': 1, 'revisi': 1})
    berkas = next((b for b in hasil_template.get('berkas') or [] if b.get('jenis') == 'instrumen'), {})
    versi_template = berkas.get('versi') or hasil_template.get('versi_template')
    hasil = {'aktif': bool(aktif), 'versi_aktif': (aktif or {}).get('versi_template'), 'versi_template': versi_template,
             'sejalan': bool(aktif) and str(aktif.get('versi_template')) == str(versi_template)}
    if not aktif and berkas.get('ada'):
        logger.warning('[pkg] Belum ada instrumen PKG aktif; kepala madrasah perlu mengimpor dari template resmi '
                       'sebelum lembar penilaian dapat dibuka.')
    elif aktif and not hasil['sejalan']:
        logger.warning(f"[pkg] Instrumen aktif memakai template {hasil['versi_aktif']} (rev {aktif.get('revisi')}), "
                       f"sedangkan template resmi di server versi {versi_template}.")
    return hasil


MASA_PRATINJAU = timedelta(minutes=30)


async def simpan_pratinjau(db, pratinjau: Dict[str, Any], pembuat: Dict[str, Any]) -> Dict[str, Any]:
    """Simpan pratinjau impor (dibaca ulang saat diterapkan; aman untuk beberapa worker) dan beri token."""
    token = uuid.uuid4().hex
    await db[KOLEKSI_PRATINJAU_IMPOR].insert_one({
        'token': token, 'pembuat_id': pembuat.get('id'), 'pratinjau': pratinjau,
        'expire_at': datetime.now(timezone.utc) + MASA_PRATINJAU,
    })
    return {**pratinjau, 'token': token}


async def terapkan_pratinjau(db, token: str, kepala: Dict[str, Any]) -> Dict[str, Any]:
    """Jadikan pratinjau instrumen aktif baru. Instrumen lama dinonaktifkan namun tetap tersimpan (dirujuk lembar
    penilaian lama). Hasil: {'instrumen': dok, 'hasil': ringkasan, 'sebelumnya': dok | None}."""
    simpanan = await db[KOLEKSI_PRATINJAU_IMPOR].find_one({'token': token, 'pembuat_id': kepala.get('id')}, {'_id': 0})
    kedaluwarsa = simpanan and simpanan.get('expire_at') and \
        (simpanan['expire_at'] if simpanan['expire_at'].tzinfo else simpanan['expire_at'].replace(tzinfo=timezone.utc)) < datetime.now(timezone.utc)
    if not simpanan or kedaluwarsa:
        raise HTTPException(404, 'Pratinjau tidak ditemukan atau kedaluwarsa. Ulangi impor.')
    p = simpanan['pratinjau']
    sebelumnya = await instrumen_aktif(db)
    revisi_terakhir = await db[KOLEKSI_INSTRUMEN].find(
        {'versi_template': p['versi_template']}, {'_id': 0, 'revisi': 1}).to_list(1000)
    sekarang = datetime.now(timezone.utc).isoformat()
    baru = {
        'id': str(uuid.uuid4()), 'versi_template': p['versi_template'],
        'revisi': max([r.get('revisi') or 0 for r in revisi_terakhir], default=0) + 1,
        'checksum': p['checksum'], 'cocok_resmi': bool(p['cocok_resmi']), 'sumber': p['sumber'],
        'nama_berkas': p['nama_berkas'], 'revisi_dari': (sebelumnya or {}).get('id'), 'alasan_perubahan': None,
        'diimpor_oleh': kepala.get('id'), 'diimpor_pada': sekarang, 'is_active': True,
        'kompetensi': p['kompetensi'], 'created_at': sekarang, 'updated_at': sekarang,
    }
    # Index unik parsial: nonaktifkan instrumen lama lebih dahulu.
    await db[KOLEKSI_INSTRUMEN].update_many({'is_active': True}, {'$set': {'is_active': False, 'updated_at': sekarang}})
    await db[KOLEKSI_INSTRUMEN].insert_one(dict(baru))
    await db[KOLEKSI_PRATINJAU_IMPOR].delete_one({'token': token})
    r = ringkas_instrumen(baru)
    hasil = {
        'sumber': baru['sumber'], 'nama_berkas': baru['nama_berkas'], 'cocok_resmi': baru['cocok_resmi'],
        'kompetensi': r['kompetensi'], 'sub': r['sub'], 'indikator': r['indikator'],
        'instrumen_sebelumnya': {k: sebelumnya.get(k) for k in ('id', 'versi_template', 'revisi')} if sebelumnya else None,
    }
    return {'instrumen': baru, 'hasil': hasil}
