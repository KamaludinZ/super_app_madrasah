"""Service rekap hasil penilaian PKG: materialisasi hasil akhir lembar terkunci ke koleksi pkg_rekap.

Satu baris per lembar terkunci (id = penilaian_id). Ditulis saat lembar dikirim & dikunci, dan dapat dibangun ulang
dari pkg_penilaian (migrasi). Nilai mengikuti rumus template resmi (pkg_nilai); subtotal per kompetensi dihitung
dari skor_per_indikator lembar terhadap instrumen versi lembar.
"""
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from pkg_nilai import hitung_nilai
from pkg_skema import KOLEKSI_INSTRUMEN, KOLEKSI_PENILAIAN, KOLEKSI_REKAP, KOLEKSI_SK


def per_kompetensi(instrumen: Dict[str, Any], skor: Dict[str, int]) -> Dict[str, int]:
    return {k['kode']: sum(int(skor.get(s['kode']) or 0) for s in k.get('sub') or []) for k in instrumen.get('kompetensi') or []}


async def _nama_penilai(db, penilai_id: Optional[str], sk: Optional[Dict[str, Any]]) -> Optional[str]:
    snap = ((sk or {}).get('snapshot_anggota') or {}).get(penilai_id) or {}
    if snap.get('nama'):
        return snap['nama']
    akun = await db.users.find_one({'id': penilai_id}, {'_id': 0, 'full_name': 1}) if penilai_id else None
    return (akun or {}).get('full_name')


async def baris_rekap(db, lembar: Dict[str, Any], instrumen: Optional[Dict[str, Any]] = None,
                      sk: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    """Baris rekap dari lembar terkunci; None bila lembar belum terkunci atau instrumennya tidak ditemukan."""
    if lembar.get('status') != 'terkunci':
        return None
    instrumen = instrumen or await db[KOLEKSI_INSTRUMEN].find_one({'id': lembar.get('instrumen_id')}, {'_id': 0})
    if not instrumen:
        return None
    sk = sk or await db[KOLEKSI_SK].find_one({'id': lembar.get('sk_id')}, {'_id': 0})
    nilai = hitung_nilai(instrumen, lembar.get('isian') or {})
    snap = lembar.get('snapshot_guru') or {}
    return {
        'id': lembar['id'], 'periode_id': lembar.get('periode_id'), 'sk_id': lembar.get('sk_id'),
        'guru_id': lembar.get('guru_dinilai_id'), 'penilai_id': lembar.get('penilai_id'),
        'nama': snap.get('nama'), 'nip': snap.get('nip'), 'mapel': snap.get('mapel'),
        'penilai_nama': await _nama_penilai(db, lembar.get('penilai_id'), sk),
        'instrumen_id': instrumen.get('id'), 'versi_template': instrumen.get('versi_template'), 'revisi': instrumen.get('revisi'),
        'nilai_akhir': nilai['nilai_akhir'], 'nilai_maks': nilai['nilai_maks'], 'capaian_persen': nilai['capaian_persen'],
        'level_capaian': nilai['level_capaian'], 'predikat': nilai['predikat'],
        'per_kompetensi': per_kompetensi(instrumen, nilai['skor_per_indikator']),
        'catatan_umum': lembar.get('catatan_umum') or '',
        'terkunci_pada': lembar.get('terkunci_pada'), 'dihitung_pada': datetime.now(timezone.utc).isoformat(),
    }


async def simpan_rekap_lembar(db, lembar: Dict[str, Any], instrumen: Optional[Dict[str, Any]] = None,
                              sk: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    """Tulis/perbarui baris rekap untuk satu lembar terkunci (idempoten)."""
    baris = await baris_rekap(db, lembar, instrumen, sk)
    if baris:
        await db[KOLEKSI_REKAP].update_one({'id': baris['id']}, {'$set': baris}, upsert=True)
    return baris


async def bangun_ulang_rekap(db, periode_id: Optional[str] = None) -> Dict[str, int]:
    """Bangun ulang baris rekap dari seluruh lembar terkunci (opsional satu periode). Baris tanpa lembar terkunci
    yang sah dihapus. Hasil: jumlah diproses, ditulis, dilewati (instrumen hilang), dan dihapus."""
    saring = {'status': 'terkunci', **({'periode_id': periode_id} if periode_id else {})}
    lembar = await db[KOLEKSI_PENILAIAN].find(saring, {'_id': 0}).to_list(100000)
    instrumen = {d['id']: d for d in await db[KOLEKSI_INSTRUMEN].find({}, {'_id': 0}).to_list(1000)}
    sk = {d['id']: d for d in await db[KOLEKSI_SK].find({}, {'_id': 0}).to_list(1000)}
    ditulis, dilewati, sah = 0, 0, set()
    for lb in lembar:
        baris = await simpan_rekap_lembar(db, lb, instrumen.get(lb.get('instrumen_id')), sk.get(lb.get('sk_id')))
        if baris:
            ditulis += 1
            sah.add(baris['id'])
        else:
            dilewati += 1
    lama = await db[KOLEKSI_REKAP].find({**({'periode_id': periode_id} if periode_id else {})}, {'_id': 0, 'id': 1}).to_list(100000)
    yatim = [d['id'] for d in lama if d['id'] not in sah]
    for i in yatim:
        await db[KOLEKSI_REKAP].delete_one({'id': i})
    return {'diproses': len(lembar), 'ditulis': ditulis, 'dilewati': dilewati, 'dihapus': len(yatim)}
