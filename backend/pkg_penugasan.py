"""Service pembagian jatah penilaian (kepala madrasah): petakan tiap guru yang dinilai ke satu penilai pada SK aktif
periode berjalan. Disimpan per penilai di pkg_penugasan {periode_id, sk_id, penilai_id, guru_dinilai_ids,
jumlah_jatah, snapshot_guru, ...supervisi}; field supervisi tidak disentuh di sini.

Bentuk untuk API (GET /pkg/penugasan):
    {periode, sk: {id, nomor_sk}, penilai: [anggota], dinilai: [anggota], penugasan: {guru_id: penilai_id},
     jatah: {penilai_id: n}, penilaian_dimulai}
Aturan simpan (validasi_pembagian, semua pesan dikumpulkan sekaligus):
    - setiap guru yang dinilai punya tepat satu penilai anggota SK, bukan dirinya sendiri
      (rangkap penilai–dinilai tetap boleh untuk guru lain);
    - guru & penilai harus akun guru aktif (akun yang dinonaktifkan setelah SK ditetapkan ditolak);
    - jumlah guru per penilai tidak melebihi jatahnya bila jatah diisi (> 0).
GET menyertakan `peringatan` untuk data tersimpan yang sudah tidak sah (mis. guru ganda antar penilai,
akun dinonaktifkan) agar kepala dapat memperbaikinya.
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import HTTPException

from pkg_akses import sk_aktif
from pkg_periode import periode_tampil
from pkg_sk import masalah_akun_guru, sk_tampil
from pkg_skema import KOLEKSI_PENILAIAN, KOLEKSI_PENUGASAN, PenugasanRequest


def _sekarang() -> str:
    return datetime.now(timezone.utc).isoformat()


async def ambil_pembagian(db) -> Dict[str, Any]:
    periode, sk = await sk_aktif(db)
    if not sk:
        return {'periode': periode_tampil(periode) if periode else None, 'sk': None, 'penilai': [], 'dinilai': [],
                'penugasan': {}, 'jatah': {}, 'penilaian_dimulai': False, 'peringatan': []}
    tampil = await sk_tampil(db, sk)
    dokumen = await db[KOLEKSI_PENUGASAN].find({'periode_id': periode['id']}, {'_id': 0}).to_list(500)
    penilai_sah = set(sk.get('penilai_ids') or [])
    dinilai_sah = set(sk.get('dinilai_ids') or [])
    penugasan, jatah, ganda = {}, {}, []
    for d in dokumen:
        if d.get('penilai_id') not in penilai_sah:
            continue
        jatah[d['penilai_id']] = int(d.get('jumlah_jatah') or 0)
        for g in d.get('guru_dinilai_ids') or []:
            if g in dinilai_sah:
                if g in penugasan and penugasan[g] != d['penilai_id']:
                    ganda.append(g)
                penugasan[g] = d['penilai_id']
    peringatan = []
    if ganda:
        peringatan.append(f'{len(set(ganda))} guru tercatat pada lebih dari satu penilai; simpan ulang pembagian')
    _, masalah_akun = await masalah_akun_guru(db, list(dict.fromkeys([*penugasan, *penugasan.values()])))
    peringatan.extend(masalah_akun)
    dimulai = bool(await db[KOLEKSI_PENILAIAN].find_one({'sk_id': sk['id']}, {'_id': 0, 'id': 1}))
    return {
        'periode': periode_tampil(periode), 'sk': {'id': sk['id'], 'nomor_sk': sk.get('nomor_sk')},
        'penilai': tampil['penilai'], 'dinilai': tampil['dinilai'],
        'penugasan': penugasan, 'jatah': jatah, 'penilaian_dimulai': dimulai, 'peringatan': peringatan,
    }


async def validasi_pembagian(db, sk: Dict[str, Any], penugasan: Dict[str, str], jatah: Dict[str, int]) -> List[str]:
    """Daftar pesan pelanggaran aturan pembagian; kosong bila sah."""
    cek = cek_pembagian(sk, penugasan)
    pesan = []
    if cek['bukan_dinilai']:
        pesan.append(f"{len(cek['bukan_dinilai'])} guru tidak tercantum sebagai guru yang dinilai di SK")
    if cek['bukan_penilai']:
        pesan.append('sebagian penilai tidak tercantum di SK aktif')
    if cek['diri_sendiri']:
        pesan.append('penilai tidak boleh menilai dirinya sendiri')
    if cek['tanpa_penilai']:
        pesan.append(f"{len(cek['tanpa_penilai'])} guru belum memiliki penilai")
    dipakai = list(dict.fromkeys([*penugasan.keys(), *penugasan.values()]))
    _, masalah_akun = await masalah_akun_guru(db, dipakai)
    pesan.extend(masalah_akun)
    beban: Dict[str, int] = {}
    for pid in penugasan.values():
        beban[pid] = beban.get(pid, 0) + 1
    lebih = [pid for pid, n in beban.items() if int(jatah.get(pid) or 0) > 0 and n > int(jatah[pid])]
    if lebih:
        nama = (sk.get('snapshot_anggota') or {})
        pesan.append('melebihi jatah: ' + ', '.join(f"{(nama.get(p) or {}).get('nama') or p} ({beban[p]}/{jatah[p]})" for p in lebih))
    return pesan


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
    pesan = await validasi_pembagian(db, sk, data.penugasan, data.jatah)
    if pesan:
        raise HTTPException(400, 'Pembagian tidak valid — ' + '; '.join(pesan) + '.')

    lama = {d['penilai_id']: d for d in await db[KOLEKSI_PENUGASAN].find({'periode_id': periode['id']}, {'_id': 0}).to_list(500)}
    sekarang = _sekarang()
    # Identitas guru disalin dari snapshot periode di SK (dipakai daftar tugas & cetak periode ini).
    snapshot = sk.get('snapshot_anggota') or {}
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
            {'$set': {'sk_id': sk['id'], 'guru_dinilai_ids': guru, 'jumlah_jatah': jatah, 'updated_at': sekarang,
                      'snapshot_guru': {g: snapshot[g] for g in guru if g in snapshot}},
             '$setOnInsert': {'id': str(uuid.uuid4()), 'supervisi_selesai': False}},
            upsert=True,
        )
        perubahan.append({'penilai_id': pid, 'sebelum': sebelum.get('guru_dinilai_ids') or [], 'sesudah': guru,
                          'jatah': jatah})
    hasil = await ambil_pembagian(db)
    hasil['_perubahan'] = perubahan
    return hasil
