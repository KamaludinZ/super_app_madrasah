"""Service SK PKG & anggotanya (dikelola kepala madrasah). Skema koleksi: lihat pkg_skema.

Bentuk SK untuk API:
    {id, nomor_sk, tanggal_sk, tentang, periode_id, is_active, penilai: [anggota], dinilai: [anggota],
     created_at, updated_at}
    anggota = {id, nama, nip, mapel} — dari snapshot_anggota SK (identitas periode) bila ada, selain itu dari akun.
Aturan:
    - Nomor SK unik (tanpa membedakan huruf besar/kecil); hanya satu SK aktif per periode.
    - SK pada periode yang sudah ditutup tidak dapat dibuat/diubah/diaktifkan.
    - Kepala madrasah pembuat SK otomatis tercatat sebagai penilai.
    - SK aktif atau SK yang sudah punya lembar penilaian tidak dapat dihapus.
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

from pkg_skema import KOLEKSI_PENILAIAN, KOLEKSI_PERIODE, KOLEKSI_SK, SkRequest


def _sekarang() -> str:
    return datetime.now(timezone.utc).isoformat()


async def identitas_akun(db, ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """{user_id: {nama, nip, mapel}} dari akun pengguna (mapel diisi saat snapshot periode)."""
    ids = [i for i in dict.fromkeys(ids) if i]
    if not ids:
        return {}
    akun = await db.users.find({'id': {'$in': ids}}, {'_id': 0, 'id': 1, 'full_name': 1, 'nip_nuptk': 1}).to_list(len(ids))
    return {u['id']: {'nama': u.get('full_name'), 'nip': u.get('nip_nuptk'), 'mapel': None} for u in akun}


async def sk_tampil_banyak(db, daftar: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    semua_id = [i for sk in daftar for i in (sk.get('penilai_ids') or []) + (sk.get('dinilai_ids') or [])]
    akun = await identitas_akun(db, semua_id)

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
    await _periode_terbuka(db, data.periode_id)
    kunci = await _nomor_unik(db, data.nomor_sk)
    ada_aktif = await db[KOLEKSI_SK].find_one({'periode_id': data.periode_id, 'is_active': True}, {'_id': 0, 'id': 1})
    sekarang = _sekarang()
    sk = {
        'id': str(uuid.uuid4()),
        'nomor_sk': data.nomor_sk, 'nomor_sk_kunci': kunci, 'tanggal_sk': data.tanggal_sk, 'tentang': data.tentang,
        'periode_id': data.periode_id, 'ditetapkan_oleh': kepala.get('id'),
        'penilai_ids': [kepala['id']] if kepala.get('id') else [], 'dinilai_ids': [],
        'snapshot_anggota': {}, 'jatah': {},
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
