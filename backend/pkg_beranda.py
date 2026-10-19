"""Data Beranda PKG: ringkasan kinerja periode berjalan dan daftar tugas penilaian pengguna."""
from typing import Any, Dict, List, Optional

from pkg_akses import KOLEKSI_PENILAIAN, KOLEKSI_PENUGASAN, PERAN_KEPALA

# Urutan kemajuan status penilaian; bila satu guru punya beberapa lembar, yang paling maju dipakai.
URUTAN_STATUS = {'draf': 1, 'terkunci': 2}


async def ringkasan_kinerja(db, sk: Optional[Dict[str, Any]]) -> Dict[str, int]:
    """Jumlah guru dinilai pada SK aktif: sudah dinilai (terkunci), sedang (draf), belum dimulai.
    Kepala madrasah tidak dihitung sebagai objek penilaian."""
    if not sk:
        return {'total': 0, 'selesai': 0, 'sedang': 0, 'belum': 0}
    dinilai = list(dict.fromkeys(sk.get('dinilai_ids') or []))
    kepala = {u['id'] for u in await db.users.find(
        {'id': {'$in': dinilai}, 'roles': PERAN_KEPALA}, {'_id': 0, 'id': 1}).to_list(len(dinilai) or 1)}
    dinilai = [g for g in dinilai if g not in kepala]
    lembar = await db[KOLEKSI_PENILAIAN].find(
        {'sk_id': sk['id'], 'guru_dinilai_id': {'$in': dinilai}},
        {'_id': 0, 'guru_dinilai_id': 1, 'status': 1},
    ).to_list(len(dinilai) * 5 or 1)
    status_guru: Dict[str, int] = {}
    for p in lembar:
        tingkat = URUTAN_STATUS.get(p.get('status'), 0)
        status_guru[p['guru_dinilai_id']] = max(tingkat, status_guru.get(p['guru_dinilai_id'], 0))
    selesai = sum(1 for t in status_guru.values() if t == URUTAN_STATUS['terkunci'])
    sedang = sum(1 for t in status_guru.values() if t == URUTAN_STATUS['draf'])
    return {'total': len(dinilai), 'selesai': selesai, 'sedang': sedang, 'belum': len(dinilai) - selesai - sedang}


# Urutan tampil tugas: yang sedang dikerjakan dulu, lalu belum dimulai, terakhir yang sudah terkunci.
URUTAN_TAMPIL_TUGAS = {'draf': 0, 'belum': 1, 'terkunci': 2}


def _progres(lembar: Optional[Dict[str, Any]]) -> int:
    if not lembar:
        return 0
    if lembar.get('status') == 'terkunci':
        return 100
    try:
        return max(0, min(100, int(lembar.get('progres') or 0)))
    except (TypeError, ValueError):
        return 0


async def tugas_penilaian_saya(db, user: Dict[str, Any], periode: Optional[Dict[str, Any]],
                               sk: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Guru yang dibagikan kepala madrasah kepada pengguna (penilai) pada periode berjalan.
    Item: {id (guru), penilaian_id, nama, nip, mapel, status ('belum'|'draf'|'terkunci'), progres, updated_at}."""
    if not periode or not sk:
        return []
    uid = user.get('id')
    penugasan = await db[KOLEKSI_PENUGASAN].find_one({'periode_id': periode['id'], 'penilai_id': uid}, {'_id': 0})
    if not penugasan:
        return []
    # Penilai tidak menilai dirinya sendiri walau merangkap sebagai guru yang dinilai.
    ids = [g for g in dict.fromkeys(penugasan.get('guru_dinilai_ids') or []) if g and g != uid]
    if not ids:
        return []

    lembar_list = await db[KOLEKSI_PENILAIAN].find(
        {'sk_id': sk['id'], 'penilai_id': uid, 'guru_dinilai_id': {'$in': ids}},
        {'_id': 0, 'id': 1, 'guru_dinilai_id': 1, 'status': 1, 'progres': 1, 'updated_at': 1},
    ).to_list(len(ids) * 5)
    lembar_guru: Dict[str, Dict[str, Any]] = {}
    for p in lembar_list:
        lama = lembar_guru.get(p['guru_dinilai_id'])
        if not lama or URUTAN_STATUS.get(p.get('status'), 0) > URUTAN_STATUS.get(lama.get('status'), 0):
            lembar_guru[p['guru_dinilai_id']] = p

    snapshot = penugasan.get('snapshot_guru') or {}
    akun = {u['id']: u for u in await db.users.find(
        {'id': {'$in': ids}}, {'_id': 0, 'id': 1, 'full_name': 1, 'nip_nuptk': 1}).to_list(len(ids))}

    hasil = []
    for gid in ids:
        snap = snapshot.get(gid) or {}
        u = akun.get(gid) or {}
        lembar = lembar_guru.get(gid)
        status = lembar.get('status') if lembar and lembar.get('status') in URUTAN_STATUS else 'belum'
        hasil.append({
            'id': gid,
            'penilaian_id': (lembar or {}).get('id'),
            'nama': snap.get('nama') or u.get('full_name') or '(akun tidak ditemukan)',
            'nip': snap.get('nip') or u.get('nip_nuptk'),
            'mapel': snap.get('mapel'),
            'status': status,
            'progres': _progres(lembar),
            'updated_at': (lembar or {}).get('updated_at'),
        })
    hasil.sort(key=lambda t: (URUTAN_TAMPIL_TUGAS[t['status']], (t['nama'] or '').lower()))
    return hasil
