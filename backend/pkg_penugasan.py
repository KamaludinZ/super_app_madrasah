"""Service pembagian jatah penilaian (kepala madrasah): petakan tiap guru yang dinilai ke satu penilai pada SK aktif
periode berjalan. Disimpan per penilai di pkg_penugasan {periode_id, sk_id, penilai_id, guru_dinilai_ids,
jumlah_jatah, ...supervisi}; field supervisi tidak disentuh di sini.

Bentuk untuk API (GET /pkg/penugasan):
    {periode, sk: {id, nomor_sk}, penilai: [anggota], dinilai: [anggota], penugasan: {guru_id: penilai_id},
     jatah: {penilai_id: n}, penilaian_dimulai}
Aturan simpan: setiap guru yang dinilai punya tepat satu penilai anggota SK, bukan dirinya sendiri
(rangkap penilai–dinilai tetap boleh untuk guru lain).
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import HTTPException

from pkg_akses import sk_aktif
from pkg_periode import periode_tampil
from pkg_sk import sk_tampil
from pkg_skema import KOLEKSI_PENILAIAN, KOLEKSI_PENUGASAN, PenugasanRequest


def _sekarang() -> str:
    return datetime.now(timezone.utc).isoformat()


async def ambil_pembagian(db) -> Dict[str, Any]:
    periode, sk = await sk_aktif(db)
    if not sk:
        return {'periode': periode_tampil(periode) if periode else None, 'sk': None, 'penilai': [], 'dinilai': [],
                'penugasan': {}, 'jatah': {}, 'penilaian_dimulai': False}
    tampil = await sk_tampil(db, sk)
    dokumen = await db[KOLEKSI_PENUGASAN].find({'periode_id': periode['id']}, {'_id': 0}).to_list(500)
    penilai_sah = set(sk.get('penilai_ids') or [])
    dinilai_sah = set(sk.get('dinilai_ids') or [])
    penugasan, jatah = {}, {}
    for d in dokumen:
        if d.get('penilai_id') not in penilai_sah:
            continue
        jatah[d['penilai_id']] = int(d.get('jumlah_jatah') or 0)
        for g in d.get('guru_dinilai_ids') or []:
            if g in dinilai_sah:
                penugasan[g] = d['penilai_id']
    dimulai = bool(await db[KOLEKSI_PENILAIAN].find_one({'sk_id': sk['id']}, {'_id': 0, 'id': 1}))
    return {
        'periode': periode_tampil(periode), 'sk': {'id': sk['id'], 'nomor_sk': sk.get('nomor_sk')},
        'penilai': tampil['penilai'], 'dinilai': tampil['dinilai'],
        'penugasan': penugasan, 'jatah': jatah, 'penilaian_dimulai': dimulai,
    }


def cek_pembagian(sk: Dict[str, Any], penugasan: Dict[str, str]) -> Dict[str, List[str]]:
    penilai = set(sk.get('penilai_ids') or [])
    dinilai = list(sk.get('dinilai_ids') or [])
    return {
        'tanpa_penilai': [g for g in dinilai if not penugasan.get(g)],
        'diri_sendiri': [g for g in dinilai if penugasan.get(g) == g],
        'bukan_penilai': [g for g in dinilai if penugasan.get(g) and penugasan[g] not in penilai],
        'bukan_dinilai': [g for g in penugasan if g not in set(dinilai)],
    }


async def simpan_pembagian(db, data: PenugasanRequest) -> Dict[str, Any]:
    periode, sk = await sk_aktif(db)
    if not sk:
        raise HTTPException(409, 'Belum ada SK aktif pada periode berjalan.')
    cek = cek_pembagian(sk, data.penugasan)
    if cek['bukan_dinilai']:
        raise HTTPException(400, f"{len(cek['bukan_dinilai'])} guru tidak tercantum sebagai guru yang dinilai di SK.")
    if cek['bukan_penilai']:
        raise HTTPException(400, 'Sebagian penilai tidak tercantum di SK aktif.')
    if cek['diri_sendiri']:
        raise HTTPException(400, 'Penilai tidak boleh menilai dirinya sendiri.')
    if cek['tanpa_penilai']:
        raise HTTPException(400, f"{len(cek['tanpa_penilai'])} guru belum memiliki penilai.")

    lama = {d['penilai_id']: d for d in await db[KOLEKSI_PENUGASAN].find({'periode_id': periode['id']}, {'_id': 0}).to_list(500)}
    sekarang = _sekarang()
    perubahan = []
    penilai_ids = list(dict.fromkeys([*(sk.get('penilai_ids') or []), *lama.keys()]))
    for pid in penilai_ids:
        guru = [g for g in sk.get('dinilai_ids') or [] if data.penugasan.get(g) == pid] if pid in (sk.get('penilai_ids') or []) else []
        jatah = int(data.jatah.get(pid) or 0) if pid in (sk.get('penilai_ids') or []) else 0
        sebelum = lama.get(pid) or {}
        if pid in lama and sebelum.get('guru_dinilai_ids') == guru and int(sebelum.get('jumlah_jatah') or 0) == jatah \
                and sebelum.get('sk_id') == sk['id']:
            continue
        await db[KOLEKSI_PENUGASAN].update_one(
            {'periode_id': periode['id'], 'penilai_id': pid},
            {'$set': {'sk_id': sk['id'], 'guru_dinilai_ids': guru, 'jumlah_jatah': jatah, 'updated_at': sekarang},
             '$setOnInsert': {'id': str(uuid.uuid4()), 'supervisi_selesai': False}},
            upsert=True,
        )
        perubahan.append({'penilai_id': pid, 'sebelum': sebelum.get('guru_dinilai_ids') or [], 'sesudah': guru,
                          'jatah': jatah})
    hasil = await ambil_pembagian(db)
    hasil['_perubahan'] = perubahan
    return hasil
