"""Service penandaan supervisi penilai oleh kepala madrasah — gerbang pembukaan lembar penilaian.

Disimpan di dokumen pkg_penugasan penilai (periode berjalan): supervisi_selesai, tanggal_supervisi,
catatan_supervisi, disupervisi_oleh {id, nama}. Alternatifnya kepala dapat memberi izin menilai dengan alasan
(izin_menilai, izin_alasan, izin_oleh {id, nama}, izin_pada) bila supervisi belum dapat dilaksanakan; izin tidak
mengubah status supervisi. keanggotaan_sk() membuka lembar penilaian bila supervisi_selesai atau izin_menilai.
Kepala madrasah tidak memerlukan supervisi dan tidak ditampilkan.

Bentuk untuk API: {penilai: anggota, supervisi_selesai, tanggal_supervisi, catatan, disupervisi_oleh, jumlah_guru,
izin_menilai, izin_alasan, izin_oleh, izin_pada, boleh_menilai}
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from fastapi import HTTPException

from pkg_akses import PERAN_KEPALA, sk_aktif
from pkg_sk import sk_tampil
from pkg_skema import KOLEKSI_PENUGASAN, IzinMenilaiRequest, SupervisiRequest

WIB = timezone(timedelta(hours=7))


def _sekarang() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _konteks(db):
    periode, sk = await sk_aktif(db)
    if not sk:
        raise HTTPException(409, 'Belum ada SK aktif pada periode berjalan.')
    return periode, sk


async def _kepala_ids(db, ids: List[str]) -> set:
    akun = await db.users.find({'id': {'$in': ids}, 'roles': PERAN_KEPALA}, {'_id': 0, 'id': 1}).to_list(len(ids) or 1)
    return {u['id'] for u in akun}


def _baris(anggota: Dict[str, Any], dok: Dict[str, Any]) -> Dict[str, Any]:
    selesai = bool(dok.get('supervisi_selesai'))
    izin = bool(dok.get('izin_menilai'))
    oleh = dok.get('disupervisi_oleh') or {}
    return {
        'penilai': anggota,
        'supervisi_selesai': selesai,
        'tanggal_supervisi': dok.get('tanggal_supervisi') if selesai else None,
        'catatan': (dok.get('catatan_supervisi') or '') if selesai else '',
        'disupervisi_oleh': oleh.get('nama') if selesai else None,
        'jumlah_guru': len(dok.get('guru_dinilai_ids') or []),
        'izin_menilai': izin,
        'izin_alasan': (dok.get('izin_alasan') or '') if izin else '',
        'izin_oleh': (dok.get('izin_oleh') or {}).get('nama') if izin else None,
        'izin_pada': dok.get('izin_pada') if izin else None,
        'boleh_menilai': selesai or izin,
    }


async def daftar_supervisi(db) -> List[Dict[str, Any]]:
    periode, sk = await sk_aktif(db)
    if not sk:
        return []
    tampil = await sk_tampil(db, sk)
    kepala = await _kepala_ids(db, sk.get('penilai_ids') or [])
    dok = {d['penilai_id']: d for d in await db[KOLEKSI_PENUGASAN].find({'periode_id': periode['id']}, {'_id': 0}).to_list(500)}
    return [_baris(a, dok.get(a['id']) or {}) for a in tampil['penilai'] if a['id'] not in kepala]


async def _penilai_sah(db, sk: Dict[str, Any], penilai_id: str) -> Dict[str, Any]:
    if penilai_id not in (sk.get('penilai_ids') or []):
        raise HTTPException(404, 'Penilai tidak tercantum di SK aktif.')
    if penilai_id in await _kepala_ids(db, [penilai_id]):
        raise HTTPException(400, 'Kepala madrasah tidak memerlukan supervisi.')
    tampil = await sk_tampil(db, sk)
    return next(a for a in tampil['penilai'] if a['id'] == penilai_id)


async def tandai_supervisi(db, penilai_id: str, data: SupervisiRequest, kepala: Dict[str, Any]) -> Dict[str, Any]:
    periode, sk = await _konteks(db)
    anggota = await _penilai_sah(db, sk, penilai_id)
    if data.tanggal_supervisi > datetime.now(WIB).strftime('%Y-%m-%d'):
        raise HTTPException(400, 'Tanggal supervisi tidak boleh di masa depan.')
    perubahan = {
        'supervisi_selesai': True, 'tanggal_supervisi': data.tanggal_supervisi, 'catatan_supervisi': data.catatan,
        'disupervisi_oleh': {'id': kepala.get('id'), 'nama': kepala.get('full_name') or kepala.get('username')},
        'sk_id': sk['id'], 'updated_at': _sekarang(),
    }
    await db[KOLEKSI_PENUGASAN].update_one(
        {'periode_id': periode['id'], 'penilai_id': penilai_id},
        {'$set': perubahan, '$setOnInsert': {'id': str(uuid.uuid4()), 'guru_dinilai_ids': [], 'jumlah_jatah': 0}},
        upsert=True,
    )
    dok = await db[KOLEKSI_PENUGASAN].find_one({'periode_id': periode['id'], 'penilai_id': penilai_id}, {'_id': 0})
    return _baris(anggota, dok or perubahan)


async def batalkan_supervisi(db, penilai_id: str) -> Dict[str, Any]:
    periode, sk = await _konteks(db)
    anggota = await _penilai_sah(db, sk, penilai_id)
    await db[KOLEKSI_PENUGASAN].update_one(
        {'periode_id': periode['id'], 'penilai_id': penilai_id},
        {'$set': {'supervisi_selesai': False, 'updated_at': _sekarang()},
         '$unset': {'tanggal_supervisi': '', 'catatan_supervisi': '', 'disupervisi_oleh': ''}},
    )
    dok = await db[KOLEKSI_PENUGASAN].find_one({'periode_id': periode['id'], 'penilai_id': penilai_id}, {'_id': 0})
    return _baris(anggota, dok or {})


async def beri_izin_menilai(db, penilai_id: str, data: IzinMenilaiRequest, kepala: Dict[str, Any]) -> Dict[str, Any]:
    """Izinkan penilai membuka lembar penilaian sebelum supervisi tercatat (alasan wajib). Status supervisi tetap."""
    periode, sk = await _konteks(db)
    anggota = await _penilai_sah(db, sk, penilai_id)
    await db[KOLEKSI_PENUGASAN].update_one(
        {'periode_id': periode['id'], 'penilai_id': penilai_id},
        {'$set': {'izin_menilai': True, 'izin_alasan': data.alasan, 'izin_pada': _sekarang(), 'sk_id': sk['id'],
                  'izin_oleh': {'id': kepala.get('id'), 'nama': kepala.get('full_name') or kepala.get('username')},
                  'updated_at': _sekarang()},
         '$setOnInsert': {'id': str(uuid.uuid4()), 'guru_dinilai_ids': [], 'jumlah_jatah': 0, 'supervisi_selesai': False}},
        upsert=True,
    )
    dok = await db[KOLEKSI_PENUGASAN].find_one({'periode_id': periode['id'], 'penilai_id': penilai_id}, {'_id': 0})
    return _baris(anggota, dok or {})


async def cabut_izin_menilai(db, penilai_id: str) -> Dict[str, Any]:
    """Cabut izin menilai; lembar penilaian terkunci kembali kecuali penilai sudah disupervisi."""
    periode, sk = await _konteks(db)
    anggota = await _penilai_sah(db, sk, penilai_id)
    await db[KOLEKSI_PENUGASAN].update_one(
        {'periode_id': periode['id'], 'penilai_id': penilai_id},
        {'$set': {'izin_menilai': False, 'updated_at': _sekarang()},
         '$unset': {'izin_alasan': '', 'izin_oleh': '', 'izin_pada': ''}},
    )
    dok = await db[KOLEKSI_PENUGASAN].find_one({'periode_id': periode['id'], 'penilai_id': penilai_id}, {'_id': 0})
    return _baris(anggota, dok or {})
