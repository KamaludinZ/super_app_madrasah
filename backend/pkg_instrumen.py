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

from pkg_skema import (
    KOLEKSI_AUDIT, KOLEKSI_INSTRUMEN, KOLEKSI_PENILAIAN, KOLEKSI_PRATINJAU_IMPOR, UbahSubInstrumenRequest,
)

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


async def ambil_instrumen(db, instrumen_id: str) -> Dict[str, Any]:
    """Instrumen menurut id (versi mana pun); 'aktif' = instrumen aktif. HTTP 404 bila tidak ada."""
    doc = await instrumen_aktif(db) if instrumen_id == 'aktif' else \
        await db[KOLEKSI_INSTRUMEN].find_one({'id': instrumen_id}, {'_id': 0})
    if not doc:
        raise HTTPException(404, 'Instrumen tidak ditemukan.' if instrumen_id != 'aktif' else 'Belum ada instrumen aktif.')
    return doc


def _cocok(teks: Optional[str], kata: str) -> bool:
    return kata in (teks or '').lower()


def daftar_kompetensi(instrumen: Dict[str, Any], kode_kompetensi: Optional[str] = None,
                      cari: Optional[str] = None) -> Dict[str, Any]:
    """Hierarki kompetensi -> sub -> indikator dengan bobot & porsi persen (dua desimal, terhadap total bobot
    seluruh sub). Filter opsional: kode kompetensi dan kata kunci (nama kompetensi/sub atau teks indikator)."""
    semua_sub = daftar_sub(instrumen)
    total = sum(float(s.get('bobot') or 0) for s in semua_sub)
    porsi = (lambda b: round(float(b or 0) / total * 100, 2) if total else None)
    kata = (cari or '').strip().lower()
    hasil = []
    for k in instrumen.get('kompetensi') or []:
        if kode_kompetensi and k.get('kode') != kode_kompetensi:
            continue
        sub = []
        for s in k.get('sub') or []:
            indikator = s.get('indikator') or []
            if kata and not (_cocok(k.get('nama'), kata) or _cocok(s.get('nama'), kata) or _cocok(s.get('kode'), kata)):
                indikator = [i for i in indikator if _cocok(i.get('teks'), kata)]
                if not indikator:
                    continue
            sub.append({**s, 'indikator': indikator, 'porsi_persen': porsi(s.get('bobot'))})
        if sub:
            bobot_k = sum(float(x.get('bobot') or 0) for x in k.get('sub') or [])
            hasil.append({'kode': k.get('kode'), 'nama': k.get('nama'), 'bobot': bobot_k, 'porsi_persen': porsi(bobot_k), 'sub': sub})
    return {
        'instrumen': {k: instrumen.get(k) for k in ('id', 'versi_template', 'revisi', 'is_active')},
        'ringkasan': ringkas_instrumen(instrumen),
        'total_bobot': round(total, 2),
        'kompetensi': hasil,
    }


async def ubah_sub_instrumen(db, kode: str, data: UbahSubInstrumenRequest, kepala: Dict[str, Any]) -> Dict[str, Any]:
    """Ubah satu sub-kompetensi instrumen aktif. Bila instrumen sudah dipakai lembar penilaian, perubahan disimpan
    sebagai revisi baru (instrumen lama tetap utuh untuk lembar lama); selain itu diubah langsung.
    Hasil: {'instrumen': dok, 'sebelum': sub lama, 'sesudah': sub baru, 'revisi_baru': bool}."""
    lama = await instrumen_aktif(db)
    if not lama:
        raise HTTPException(409, 'Belum ada instrumen aktif.')
    sub_lama = next((s for s in daftar_sub(lama) if s.get('kode') == kode), None)
    if not sub_lama:
        raise HTTPException(404, f'Sub-kompetensi {kode} tidak ditemukan pada instrumen aktif.')
    sub_baru = {**sub_lama, 'nama': data.nama, 'bobot': data.bobot,
                'indikator': [{'level': i.level, 'teks': i.teks} for i in data.indikator]}
    if sub_baru == sub_lama:
        raise HTTPException(400, 'Tidak ada perubahan pada sub-kompetensi.')
    kompetensi = [{**k, 'sub': [sub_baru if s.get('kode') == kode else s for s in k.get('sub') or []]}
                  for k in lama.get('kompetensi') or []]
    sekarang = datetime.now(timezone.utc).isoformat()
    dipakai = await db[KOLEKSI_PENILAIAN].count_documents({'instrumen_id': lama['id']})
    if dipakai:
        revisi = await db[KOLEKSI_INSTRUMEN].find({'versi_template': lama['versi_template']}, {'_id': 0, 'revisi': 1}).to_list(1000)
        baru = {**lama, 'id': str(uuid.uuid4()), 'revisi': max([r.get('revisi') or 0 for r in revisi], default=0) + 1,
                'revisi_dari': lama['id'], 'cocok_resmi': False, 'alasan_perubahan': data.alasan, 'kompetensi': kompetensi,
                'diimpor_oleh': kepala.get('id'), 'diimpor_pada': sekarang, 'created_at': sekarang, 'updated_at': sekarang,
                'is_active': True}
        await db[KOLEKSI_INSTRUMEN].update_one({'id': lama['id']}, {'$set': {'is_active': False, 'updated_at': sekarang}})
        await db[KOLEKSI_INSTRUMEN].insert_one(dict(baru))
    else:
        perubahan = {'kompetensi': kompetensi, 'cocok_resmi': False, 'alasan_perubahan': data.alasan, 'updated_at': sekarang}
        await db[KOLEKSI_INSTRUMEN].update_one({'id': lama['id']}, {'$set': perubahan})
        baru = {**lama, **perubahan}
    return {'instrumen': baru, 'sebelum': sub_lama, 'sesudah': sub_baru, 'revisi_baru': bool(dipakai)}


async def aktifkan_instrumen(db, instrumen_id: str) -> Dict[str, Any]:
    """Jadikan versi `instrumen_id` acuan aktif lembar penilaian baru. Lembar yang sudah ada tetap memakai
    instrumen yang dirujuknya. Hasil: {'instrumen': dok, 'sebelumnya': dok | None}."""
    target = await db[KOLEKSI_INSTRUMEN].find_one({'id': instrumen_id}, {'_id': 0})
    if not target:
        raise HTTPException(404, 'Instrumen tidak ditemukan.')
    if target.get('is_active'):
        raise HTTPException(400, 'Instrumen ini sudah menjadi acuan aktif.')
    if not target.get('kompetensi'):
        raise HTTPException(409, 'Instrumen tanpa kompetensi tidak dapat dijadikan acuan.')
    sebelumnya = await instrumen_aktif(db)
    sekarang = datetime.now(timezone.utc).isoformat()
    await db[KOLEKSI_INSTRUMEN].update_many({'is_active': True}, {'$set': {'is_active': False, 'updated_at': sekarang}})
    await db[KOLEKSI_INSTRUMEN].update_one({'id': instrumen_id}, {'$set': {'is_active': True, 'updated_at': sekarang}})
    return {'instrumen': {**target, 'is_active': True, 'updated_at': sekarang}, 'sebelumnya': sebelumnya}


def ringkas_perubahan_sub(sebelum: Dict[str, Any], sesudah: Dict[str, Any]) -> List[str]:
    """Ringkasan perubahan sub-kompetensi yang mudah dibaca untuk jejak audit."""
    hasil = []
    if sebelum.get('nama') != sesudah.get('nama'):
        hasil.append(f"Nama: \"{sebelum.get('nama')}\" -> \"{sesudah.get('nama')}\"")
    if float(sebelum.get('bobot') or 0) != float(sesudah.get('bobot') or 0):
        hasil.append(f"Bobot: {sebelum.get('bobot')} -> {sesudah.get('bobot')}")
    lama = {i['level']: i['teks'] for i in sebelum.get('indikator') or []}
    baru = {i['level']: i['teks'] for i in sesudah.get('indikator') or []}
    berubah = sorted(lv for lv in set(lama) | set(baru) if lama.get(lv) != baru.get(lv))
    if berubah:
        hasil.append('Teks indikator diubah: ' + ', '.join(f'Level {lv}' for lv in berubah))
    return hasil


AKSI_INSTRUMEN = ('instrumen_impor', 'instrumen_ubah', 'instrumen_aktifkan')


async def riwayat_instrumen(db, batas: int = 100) -> List[Dict[str, Any]]:
    """Riwayat perubahan instrumen dari jejak audit PKG (terbaru dulu)."""
    from pkg_audit import LABEL_AKSI
    docs = await db[KOLEKSI_AUDIT].find({'aksi': {'$in': list(AKSI_INSTRUMEN)}}, {'_id': 0}).to_list(1000)
    docs.sort(key=lambda d: d.get('timestamp') or '', reverse=True)
    hasil = []
    for d in docs[:batas]:
        m = d.get('metadata') or {}
        hasil.append({
            'id': d.get('id'), 'aksi': d.get('aksi'), 'label': LABEL_AKSI.get(d.get('aksi'), d.get('aksi')),
            'aktor_nama': d.get('aktor_nama'), 'timestamp': d.get('timestamp'),
            'instrumen_id': m.get('instrumen_id'), 'versi_template': m.get('versi_template'), 'revisi': m.get('revisi'),
            'kode_sub': m.get('kode_sub'), 'alasan': m.get('alasan'), 'perubahan': m.get('perubahan') or [],
            'sumber': m.get('sumber'), 'nama_berkas': m.get('nama_berkas'),
        })
    return hasil
