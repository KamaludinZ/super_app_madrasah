"""Service query data master untuk fitur kelengkapan data (unduh, template, impor).

Dipakai router agar logika "siswa mana yang termasuk tingkat X" konsisten di semua alur.
"""
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

SEMUA = ('', 'all', 'semua', 'keseluruhan')


def normalisasi_tingkat(tingkat: Optional[str]) -> Optional[int]:
    """'7'/'8'/'9' -> int; kosong/'all'/'semua' -> None (keseluruhan); selain itu 400."""
    t = (tingkat or '').strip().lower()
    if t in SEMUA:
        return None
    if not t.isdigit() or not 1 <= int(t) <= 12:
        raise HTTPException(400, "Tingkat harus berupa angka kelas (mis. 7, 8, 9) atau kosong untuk semua")
    return int(t)


async def kelas_per_tingkat(db, tingkat: Optional[int]) -> List[Dict[str, Any]]:
    """Kelas tahun ajaran aktif (bila ada) dengan grade = tingkat (atau semua grade)."""
    q: Dict[str, Any] = {}
    ay = await db.academic_years.find_one({'is_active': True}, {'_id': 0, 'id': 1})
    if ay:
        q['academic_year_id'] = ay['id']
    if tingkat is not None:
        q['grade'] = tingkat
    return await db.classes.find(q, {'_id': 0, 'id': 1, 'name': 1, 'grade': 1}).sort('name', 1).to_list(1000)


async def siswa_per_tingkat(db, tingkat: Optional[int], with_detail: bool = True) -> List[Dict[str, Any]]:
    """Siswa aktif (bukan mutasi keluar) untuk satu tingkat atau keseluruhan.

    Mengembalikan [{'user', 'detail', 'kelas', 'tingkat'}] terurut nama kelas lalu nama siswa.
    - tingkat diisi: hanya siswa di kelas tahun ajaran aktif dengan grade tersebut.
    - keseluruhan: semua siswa aktif, termasuk yang kelasnya belum dipindah ke tahun ajaran aktif.
    """
    q: Dict[str, Any] = {'roles': 'siswa', 'mutation_type': {'$ne': 'keluar'}, 'is_active': {'$ne': False}}
    if tingkat is not None:
        q['student_class_id'] = {'$in': [c['id'] for c in await kelas_per_tingkat(db, tingkat)]}
    users = await db.users.find(q, {'_id': 0, 'password_hash': 0}).to_list(5000)

    class_ids = list({u.get('student_class_id') for u in users if u.get('student_class_id')})
    kelas = {c['id']: c for c in await db.classes.find(
        {'id': {'$in': class_ids}}, {'_id': 0, 'id': 1, 'name': 1, 'grade': 1}).to_list(len(class_ids) or 1)}
    details: Dict[str, Dict] = {}
    if with_detail:
        ids = [u['id'] for u in users if u.get('id')]
        details = {d['student_id']: d for d in await db.student_details.find(
            {'student_id': {'$in': ids}}, {'_id': 0}).to_list(len(ids) or 1)}

    data = []
    for u in users:
        k = kelas.get(u.get('student_class_id')) or {}
        data.append({'user': u, 'detail': details.get(u.get('id')), 'kelas': k.get('name') or '', 'tingkat': k.get('grade')})
    data.sort(key=lambda x: (x['kelas'] or '~', (x['user'].get('full_name') or '').lower()))
    return data


async def alasan_siswa_kosong(db, tingkat: Optional[int]) -> List[str]:
    """Penjelasan mengapa unduhan siswa kosong, untuk sheet Keterangan."""
    label = f'tingkat {tingkat}' if tingkat is not None else 'semua tingkat'
    pesan = [f'Belum ada siswa aktif pada {label}.']
    if tingkat is not None:
        ay = await db.academic_years.find_one({'is_active': True}, {'_id': 0, 'id': 1, 'name': 1})
        if not ay:
            pesan.append('Belum ada tahun ajaran aktif; aktifkan tahun ajaran di menu Tahun Ajaran.')
        elif not await kelas_per_tingkat(db, tingkat):
            pesan.append(f"Belum ada kelas tingkat {tingkat} pada tahun ajaran aktif ({ay.get('name') or ay['id']}).")
        else:
            pesan.append(f'Kelas tingkat {tingkat} sudah ada, tetapi belum memiliki siswa (atau semua siswanya berstatus mutasi keluar).')
    pesan.append('Sheet Data Siswa tetap berisi baris judul kolom sehingga bisa dipakai sebagai acuan pengisian.')
    return pesan


async def jumlah_siswa_per_tingkat(db) -> Dict[str, int]:
    """{'7': n, '8': n, '9': n, 'all': total} untuk tingkat kelas tahun ajaran aktif."""
    rows = await siswa_per_tingkat(db, None, with_detail=False)
    hasil: Dict[str, int] = {'all': len(rows)}
    aktif = {c['id'] for c in await kelas_per_tingkat(db, None)}
    for r in rows:
        if r['user'].get('student_class_id') in aktif and r['tingkat'] is not None:
            hasil[str(r['tingkat'])] = hasil.get(str(r['tingkat']), 0) + 1
    return hasil


# ------------------------------------------------------------
# GTK (guru & tenaga kependidikan)
# ------------------------------------------------------------
# Sama dengan pengelompokan menu Data GTK (frontend AdminGTKPage / dataGtkKolom.js).
GURU_ROLES = ('guru', 'wali_kelas', 'guru_piket', 'guru_bk', 'guru_tata_tertib', 'guru_ekstrakurikuler')
TENDIK_ROLES = ('tenaga_kependidikan',)
JENIS_GTK = {'guru': 'Guru', 'tendik': 'Tenaga Kependidikan'}


def normalisasi_jenis_gtk(jenis: Optional[str]) -> Optional[str]:
    """'guru' | 'tendik' ; kosong/'all'/'semua' -> None (keseluruhan); selain itu 400."""
    j = (jenis or '').strip().lower()
    if j in SEMUA:
        return None
    alias = {'guru': 'guru', 'tendik': 'tendik', 'tenaga_kependidikan': 'tendik', 'tenaga kependidikan': 'tendik'}
    if j not in alias:
        raise HTTPException(400, "Jenis GTK harus 'guru', 'tendik', atau kosong untuk keseluruhan")
    return alias[j]


def jenis_gtk(user: Dict[str, Any]) -> Optional[str]:
    """'guru' | 'tendik' | None — guru didahulukan bila punya kedua peran."""
    roles = user.get('roles') or []
    if any(r in GURU_ROLES for r in roles):
        return 'guru'
    if any(r in TENDIK_ROLES for r in roles):
        return 'tendik'
    return None


async def gtk_per_jenis(db, jenis: Optional[str]) -> List[Dict[str, Any]]:
    """GTK (bukan mutasi keluar) untuk satu jenis atau keseluruhan, terurut nama.
    Mengembalikan [{'user', 'jenis'}]; 'jenis' = 'guru' | 'tendik'."""
    if jenis == 'guru':
        roles = list(GURU_ROLES)
    elif jenis == 'tendik':
        roles = list(TENDIK_ROLES)
    else:
        roles = list(GURU_ROLES + TENDIK_ROLES)
    q: Dict[str, Any] = {'roles': {'$in': roles}, 'mutation_type': {'$ne': 'keluar'}}
    users = await db.users.find(q, {'_id': 0, 'password_hash': 0}).to_list(5000)
    data = []
    for u in users:
        j = jenis_gtk(u)
        # Tendik yang juga guru dihitung sebagai guru (sama dengan tab di menu Data GTK).
        if j and (jenis is None or j == jenis):
            data.append({'user': u, 'jenis': j})
    data.sort(key=lambda x: (x['user'].get('full_name') or '').lower())
    return data


async def jumlah_gtk_per_jenis(db) -> Dict[str, int]:
    rows = await gtk_per_jenis(db, None)
    guru = sum(1 for r in rows if r['jenis'] == 'guru')
    return {'all': len(rows), 'guru': guru, 'tendik': len(rows) - guru}

