"""Service SK PKG & anggotanya (dikelola kepala madrasah). Skema koleksi: lihat pkg_skema.

Bentuk SK untuk API:
    {id, nomor_sk, tanggal_sk, tentang, periode_id, is_active, penilaian_berjalan, penilai: [anggota],
     dinilai: [anggota], created_at, updated_at}
    anggota = {id, nama, nip, mapel} — dari snapshot_anggota SK (identitas periode) bila ada, selain itu dari akun.
Aturan:
    - Nomor SK unik (tanpa membedakan huruf besar/kecil); hanya satu SK aktif per periode.
    - SK pada periode yang sudah ditutup tidak dapat dibuat/diubah/diaktifkan.
    - Kepala madrasah pembuat SK otomatis tercatat sebagai penilai.
    - SK aktif atau SK yang sudah punya lembar penilaian tidak dapat dihapus.
    - Anggota hanya akun guru aktif (PERAN_GURU_PKG); tenaga kependidikan & akun nonaktif ditolak.
    - Penilai yang sudah memiliki lembar penilaian atau masih memegang guru dalam pembagian tidak dapat dilepas.
    - Setelah penilaian SK berjalan (sudah ada lembar), perubahan tim penilai/guru dinilai wajib disertai alasan
      dan tercatat di audit sebagai perubahan setelah berjalan.
    - Snapshot identitas (nama, NIP/Peg ID, mapel dari jadwal semester periode) disalin ke `snapshot_anggota`
      setiap kali anggota ditetapkan selama periode belum ditutup, agar cetak periode lalu tetap utuh walau
      akun berubah atau dinonaktifkan.
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

from core import GURU_MAPEL_ROLES
from pkg_skema import KOLEKSI_PENILAIAN, KOLEKSI_PENUGASAN, KOLEKSI_PERIODE, KOLEKSI_SK, SkRequest

# Peran akun yang dihitung sebagai guru (boleh menjadi penilai / guru yang dinilai pada SK PKG).
PERAN_GURU_PKG = (*GURU_MAPEL_ROLES, 'wali_kelas', 'guru_piket', 'guru_bk', 'guru_tata_tertib', 'guru_ekstrakurikuler',
                  'kepala_sekolah', 'waka_kurikulum', 'waka_kesiswaan', 'waka_sarpras', 'waka_humas')


def _sekarang() -> str:
    return datetime.now(timezone.utc).isoformat()


async def identitas_akun(db, ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """{user_id: {nama, nip, mapel, ...identitas GTK}} dari akun pengguna saat ini (NIP, atau Peg ID bila NIP kosong;
    tanpa mapel). Identitas GTK (pkg_identitas.FIELD_GTK) ikut disalin ke snapshot periode untuk lampiran cetak."""
    from pkg_identitas import FIELD_GTK
    ids = [i for i in dict.fromkeys(ids) if i]
    if not ids:
        return {}
    akun = await db.users.find({'id': {'$in': ids}},
                               {'_id': 0, 'id': 1, 'full_name': 1, 'nip_nuptk': 1, **{f: 1 for f in FIELD_GTK}}).to_list(len(ids))
    return {u['id']: {**{f: u[f] for f in FIELD_GTK if u.get(f) and f not in ('nip', 'peg_id')},
                      'nama': u.get('full_name'), 'nip': u.get('nip_nuptk') or u.get('peg_id'), 'mapel': None} for u in akun}


async def mapel_diampu(db, ids: List[str], semester_id: Optional[str]) -> Dict[str, str]:
    """{guru_id: 'Mapel A, Mapel B'} dari jadwal mengajar terbit pada semester periode."""
    if not ids or not semester_id:
        return {}
    jadwal = await db.schedules.find(
        {'teacher_id': {'$in': ids}, 'semester_id': semester_id, 'is_published': {'$ne': False}},
        {'_id': 0, 'teacher_id': 1, 'subject_id': 1},
    ).to_list(10000)
    subject_ids = list({j.get('subject_id') for j in jadwal if j.get('subject_id')})
    nama = {m['id']: m.get('name') for m in await db.subjects.find(
        {'id': {'$in': subject_ids}}, {'_id': 0, 'id': 1, 'name': 1}).to_list(len(subject_ids) or 1)}
    per_guru: Dict[str, set] = {}
    for j in jadwal:
        if nama.get(j.get('subject_id')):
            per_guru.setdefault(j['teacher_id'], set()).add(nama[j['subject_id']])
    return {g: ', '.join(sorted(m)) for g, m in per_guru.items()}


async def ambil_snapshot(db, ids: List[str], periode: Optional[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """Snapshot identitas periode untuk `ids`: {id: {nama, nip, mapel}}."""
    akun = await identitas_akun(db, ids)
    mapel = await mapel_diampu(db, list(akun), (periode or {}).get('semester_id'))
    return {i: {**ident, 'mapel': mapel.get(i)} for i, ident in akun.items()}


async def sk_tampil_banyak(db, daftar: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    semua_id = [i for sk in daftar for i in (sk.get('penilai_ids') or []) + (sk.get('dinilai_ids') or [])]
    akun = await identitas_akun(db, semua_id)
    sk_ids = [sk['id'] for sk in daftar]
    berjalan = {p['sk_id'] for p in await db[KOLEKSI_PENILAIAN].find(
        {'sk_id': {'$in': sk_ids}}, {'_id': 0, 'sk_id': 1}).to_list(5000)} if sk_ids else set()

    def anggota(sk, uid):
        ident = (sk.get('snapshot_anggota') or {}).get(uid) or akun.get(uid) or {}
        return {'id': uid, 'nama': ident.get('nama') or '(akun tidak ditemukan)', 'nip': ident.get('nip'), 'mapel': ident.get('mapel')}

    return [{
        'id': sk['id'],
        'nomor_sk': sk.get('nomor_sk'),
        'tanggal_sk': sk.get('tanggal_sk'),
        'tentang': sk.get('tentang') or '',
        'periode_id': sk.get('periode_id'),
        'is_active': bool(sk.get('is_active')),
        'penilaian_berjalan': sk['id'] in berjalan,
        'penilai': [anggota(sk, u) for u in sk.get('penilai_ids') or []],
        'dinilai': [anggota(sk, u) for u in sk.get('dinilai_ids') or []],
        'created_at': sk.get('created_at'),
        'updated_at': sk.get('updated_at'),
    } for sk in daftar]


async def sk_tampil(db, sk: Dict[str, Any]) -> Dict[str, Any]:
    return (await sk_tampil_banyak(db, [sk]))[0]


async def daftar_sk(db) -> List[Dict[str, Any]]:
    daftar = await db[KOLEKSI_SK].find({}, {'_id': 0}).to_list(500)
    daftar.sort(key=lambda s: (s.get('tanggal_sk') or '', s.get('created_at') or ''), reverse=True)
    return await sk_tampil_banyak(db, daftar)


async def ambil_sk(db, sk_id: str) -> Dict[str, Any]:
    sk = await db[KOLEKSI_SK].find_one({'id': sk_id}, {'_id': 0})
    if not sk:
        raise HTTPException(404, 'SK tidak ditemukan.')
    return sk


async def _periode_terbuka(db, periode_id: str) -> Dict[str, Any]:
    periode = await db[KOLEKSI_PERIODE].find_one({'id': periode_id}, {'_id': 0})
    if not periode:
        raise HTTPException(404, 'Periode PKG tidak ditemukan.')
    if periode.get('status') == 'ditutup':
        raise HTTPException(409, 'Periode sudah ditutup; SK pada periode ini tidak dapat diubah.')
    return periode


async def _nomor_unik(db, nomor: str, kecuali_id: Optional[str] = None) -> str:
    kunci = nomor.lower()
    lain = await db[KOLEKSI_SK].find_one({'nomor_sk_kunci': kunci}, {'_id': 0, 'id': 1})
    if lain and lain['id'] != kecuali_id:
        raise HTTPException(409, 'Nomor SK sudah dipakai SK lain.')
    return kunci


async def buat_sk(db, data: SkRequest, kepala: Dict[str, Any]) -> Dict[str, Any]:
    periode = await _periode_terbuka(db, data.periode_id)
    kunci = await _nomor_unik(db, data.nomor_sk)
    ada_aktif = await db[KOLEKSI_SK].find_one({'periode_id': data.periode_id, 'is_active': True}, {'_id': 0, 'id': 1})
    sekarang = _sekarang()
    sk = {
        'id': str(uuid.uuid4()),
        'nomor_sk': data.nomor_sk, 'nomor_sk_kunci': kunci, 'tanggal_sk': data.tanggal_sk, 'tentang': data.tentang,
        'periode_id': data.periode_id, 'ditetapkan_oleh': kepala.get('id'),
        'penilai_ids': [kepala['id']] if kepala.get('id') else [], 'dinilai_ids': [],
        'snapshot_anggota': await ambil_snapshot(db, [kepala['id']] if kepala.get('id') else [], periode),
        'is_active': not ada_aktif,  # SK pertama pada periode langsung aktif
        'created_at': sekarang, 'updated_at': sekarang,
    }
    await db[KOLEKSI_SK].insert_one(dict(sk))
    return sk


async def ubah_sk(db, sk_id: str, data: SkRequest) -> Dict[str, Any]:
    sk = await ambil_sk(db, sk_id)
    await _periode_terbuka(db, sk['periode_id'])
    if data.periode_id != sk['periode_id']:
        await _periode_terbuka(db, data.periode_id)
        if sk.get('is_active'):
            raise HTTPException(409, 'SK aktif tidak dapat dipindah ke periode lain. Aktifkan SK lain lebih dahulu.')
        if await db[KOLEKSI_PENILAIAN].find_one({'sk_id': sk_id}, {'_id': 0, 'id': 1}):
            raise HTTPException(409, 'SK sudah memiliki lembar penilaian; periodenya tidak dapat diubah.')
    kunci = await _nomor_unik(db, data.nomor_sk, kecuali_id=sk_id)
    perubahan = {
        'nomor_sk': data.nomor_sk, 'nomor_sk_kunci': kunci, 'tanggal_sk': data.tanggal_sk, 'tentang': data.tentang,
        'periode_id': data.periode_id, 'updated_at': _sekarang(),
    }
    await db[KOLEKSI_SK].update_one({'id': sk_id}, {'$set': perubahan})
    return {**sk, **perubahan}


async def aktifkan_sk(db, sk_id: str) -> Dict[str, Any]:
    sk = await ambil_sk(db, sk_id)
    await _periode_terbuka(db, sk['periode_id'])
    sekarang = _sekarang()
    # Nonaktifkan SK lain di periode yang sama lebih dahulu (index unik parsial: satu SK aktif per periode).
    await db[KOLEKSI_SK].update_many({'periode_id': sk['periode_id'], 'is_active': True, 'id': {'$ne': sk_id}},
                                     {'$set': {'is_active': False, 'updated_at': sekarang}})
    await db[KOLEKSI_SK].update_one({'id': sk_id}, {'$set': {'is_active': True, 'updated_at': sekarang}})
    return {**sk, 'is_active': True, 'updated_at': sekarang}


async def hapus_sk(db, sk_id: str) -> Dict[str, Any]:
    sk = await ambil_sk(db, sk_id)
    if sk.get('is_active'):
        raise HTTPException(409, 'SK aktif tidak dapat dihapus. Aktifkan SK lain lebih dahulu.')
    if await db[KOLEKSI_PENILAIAN].find_one({'sk_id': sk_id}, {'_id': 0, 'id': 1}):
        raise HTTPException(409, 'SK sudah memiliki lembar penilaian dan tidak dapat dihapus.')
    await db[KOLEKSI_SK].delete_one({'id': sk_id})
    return sk


async def guru_aktif(db) -> List[Dict[str, Any]]:
    """Akun guru aktif untuk ceklist anggota SK: [{id, full_name, nip, roles}] urut nama."""
    akun = await db.users.find(
        {'roles': {'$in': list(PERAN_GURU_PKG)}, 'is_active': {'$ne': False}},
        {'_id': 0, 'id': 1, 'full_name': 1, 'nip_nuptk': 1, 'roles': 1},
    ).to_list(2000)
    hasil = [{'id': u['id'], 'full_name': u.get('full_name'), 'nip': u.get('nip_nuptk'), 'roles': u.get('roles') or []}
             for u in akun if set(u.get('roles') or []) & set(PERAN_GURU_PKG)]
    hasil.sort(key=lambda u: (u.get('full_name') or '').lower())
    return hasil


async def masalah_akun_guru(db, ids: List[str]) -> tuple:
    """(akun {id: dok}, daftar pesan masalah) untuk akun yang tidak ditemukan, nonaktif, atau bukan guru."""
    if not ids:
        return {}, []
    akun = {u['id']: u for u in await db.users.find(
        {'id': {'$in': ids}}, {'_id': 0, 'id': 1, 'full_name': 1, 'roles': 1, 'is_active': 1}).to_list(len(ids))}
    tidak_ada = [i for i in ids if i not in akun]
    nonaktif = [akun[i].get('full_name') or i for i in ids if i in akun and akun[i].get('is_active') is False]
    bukan_guru = [akun[i].get('full_name') or i for i in ids
                  if i in akun and not set(akun[i].get('roles') or []) & set(PERAN_GURU_PKG)]
    pesan = []
    if tidak_ada:
        pesan.append(f'{len(tidak_ada)} akun tidak ditemukan')
    if nonaktif:
        pesan.append('akun nonaktif: ' + ', '.join(nonaktif))
    if bukan_guru:
        pesan.append('bukan akun guru: ' + ', '.join(bukan_guru))
    return akun, pesan


async def validasi_akun_guru(db, ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """Akun untuk `ids`; HTTP 400 bila ada yang tidak ditemukan, nonaktif, atau bukan guru."""
    akun, pesan = await masalah_akun_guru(db, ids)
    if pesan:
        raise HTTPException(400, 'Anggota SK tidak valid — ' + '; '.join(pesan) + '.')
    return akun


async def penilaian_berjalan(db, sk_id: str) -> bool:
    """True bila SK sudah memiliki lembar penilaian (susunan dianggap terkunci)."""
    return bool(await db[KOLEKSI_PENILAIAN].find_one({'sk_id': sk_id}, {'_id': 0, 'id': 1}))


def wajib_alasan_bila_berjalan(berjalan: bool, alasan: str) -> None:
    if berjalan and not (alasan or '').strip():
        raise HTTPException(400, 'Penilaian SK ini sudah berjalan; perubahan susunan wajib disertai alasan perubahan.')


async def _snapshot_anggota(db, sk: Dict[str, Any], penilai_ids: List[str], dinilai_ids: List[str],
                            periode: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """Snapshot terbaru seluruh anggota SK; anggota yang akunnya sudah tidak ada memakai snapshot lama."""
    ids = list(dict.fromkeys([*penilai_ids, *dinilai_ids]))
    baru = await ambil_snapshot(db, ids, periode)
    lama = sk.get('snapshot_anggota') or {}
    return {i: baru.get(i) or lama[i] for i in ids if baru.get(i) or lama.get(i)}


async def atur_penilai(db, sk_id: str, penilai_ids: List[str], kepala: Dict[str, Any], alasan: str = '') -> Dict[str, Any]:
    """Tetapkan tim penilai SK. Kepala madrasah (pengubah & kepala yang sudah tercatat) selalu disertakan."""
    sk = await ambil_sk(db, sk_id)
    periode = await _periode_terbuka(db, sk['periode_id'])
    berjalan = await penilaian_berjalan(db, sk_id)
    wajib_alasan_bila_berjalan(berjalan, alasan)
    lama = list(sk.get('penilai_ids') or [])
    akun_lama = await db.users.find({'id': {'$in': lama}}, {'_id': 0, 'id': 1, 'roles': 1}).to_list(len(lama) or 1)
    kepala_ids = [kepala['id']] + [u['id'] for u in akun_lama if 'kepala_sekolah' in (u.get('roles') or [])]
    baru = list(dict.fromkeys([*kepala_ids, *penilai_ids]))
    await validasi_akun_guru(db, baru)

    dilepas = [i for i in lama if i not in baru]
    if dilepas:
        if await db[KOLEKSI_PENILAIAN].find_one({'sk_id': sk_id, 'penilai_id': {'$in': dilepas}}, {'_id': 0, 'id': 1}):
            raise HTTPException(409, 'Penilai yang sudah mengisi lembar penilaian tidak dapat dilepas dari SK.')
        tugas = await db[KOLEKSI_PENUGASAN].find(
            {'periode_id': sk['periode_id'], 'penilai_id': {'$in': dilepas}}, {'_id': 0, 'guru_dinilai_ids': 1}).to_list(len(dilepas))
        if any(t.get('guru_dinilai_ids') for t in tugas):
            raise HTTPException(409, 'Pindahkan dahulu guru yang dibagikan kepada penilai yang akan dilepas.')
    perubahan = {'penilai_ids': baru, 'updated_at': _sekarang(),
                 'snapshot_anggota': await _snapshot_anggota(db, sk, baru, sk.get('dinilai_ids') or [], periode)}
    await db[KOLEKSI_SK].update_one({'id': sk_id}, {'$set': perubahan})
    return {**sk, **perubahan, '_ditambah': [i for i in baru if i not in lama], '_dilepas': dilepas,
            '_setelah_berjalan': berjalan}


async def atur_dinilai(db, sk_id: str, dinilai_ids: List[str], alasan: str = '') -> Dict[str, Any]:
    """Tetapkan guru yang dinilai pada SK. Kepala madrasah ditolak (bukan objek penilaian); guru yang dilepas
    dikeluarkan dari pembagian penilai, kecuali sudah memiliki lembar penilaian."""
    sk = await ambil_sk(db, sk_id)
    periode = await _periode_terbuka(db, sk['periode_id'])
    berjalan = await penilaian_berjalan(db, sk_id)
    wajib_alasan_bila_berjalan(berjalan, alasan)
    baru = list(dict.fromkeys(dinilai_ids))
    akun = await validasi_akun_guru(db, baru)
    kepala = [akun[i].get('full_name') or i for i in baru if 'kepala_sekolah' in (akun[i].get('roles') or [])]
    if kepala:
        raise HTTPException(400, 'Kepala madrasah tidak menjadi objek penilaian: ' + ', '.join(kepala) + '.')

    lama = list(sk.get('dinilai_ids') or [])
    dilepas = [i for i in lama if i not in baru]
    if dilepas:
        if await db[KOLEKSI_PENILAIAN].find_one({'sk_id': sk_id, 'guru_dinilai_id': {'$in': dilepas}}, {'_id': 0, 'id': 1}):
            raise HTTPException(409, 'Guru yang sudah memiliki lembar penilaian tidak dapat dilepas dari SK.')
        tugas = await db[KOLEKSI_PENUGASAN].find({'periode_id': sk['periode_id']}, {'_id': 0}).to_list(500)
        for t in tugas:
            sisa = [g for g in t.get('guru_dinilai_ids') or [] if g not in dilepas]
            if len(sisa) != len(t.get('guru_dinilai_ids') or []):
                await db[KOLEKSI_PENUGASAN].update_one({'id': t['id']}, {'$set': {'guru_dinilai_ids': sisa, 'updated_at': _sekarang()}})
    perubahan = {'dinilai_ids': baru, 'updated_at': _sekarang(),
                 'snapshot_anggota': await _snapshot_anggota(db, sk, sk.get('penilai_ids') or [], baru, periode)}
    await db[KOLEKSI_SK].update_one({'id': sk_id}, {'$set': perubahan})
    return {**sk, **perubahan, '_ditambah': [i for i in baru if i not in lama], '_dilepas': dilepas,
            '_setelah_berjalan': berjalan}
