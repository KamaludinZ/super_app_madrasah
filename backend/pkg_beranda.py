"""Data Beranda PKG: ringkasan kinerja periode berjalan (dan bagian beranda lain)."""
from typing import Any, Dict, Optional

from pkg_akses import KOLEKSI_PENILAIAN, PERAN_KEPALA

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
