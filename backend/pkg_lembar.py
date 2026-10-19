"""Service lembar penilaian kinerja (satu guru oleh penilai yang ditugaskan). Skema: lihat pkg_skema.

Bentuk untuk API (kontrak frontend lib/pkgPenilaian):
    lembar = {id | None, status ('belum'|'draf'|'terkunci'), guru {id, nama, nip, mapel, akun_aktif, juga_penilai},
              periode {id, nama_periode, tanggal_buka, tanggal_tutup}, instrumen {id, versi_template, revisi, kompetensi},
              isian {kode_sub: {centang, catatan_bukti, tanggapan}}, catatan_umum, hasil | None,
              dapat_diisi, alasan_tidak_dapat_diisi, updated_at}
Aturan akses: guru harus dibagikan kepada penilai pada periode berjalan (pkg_penugasan); lembar milik penilai lain
ditolak. Lembar yang sudah ada memakai instrumen versi saat lembar dibuat; lembar baru memakai instrumen aktif.
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import HTTPException

from pkg_akses import sk_aktif, tolak
from pkg_instrumen import instrumen_aktif
from pymongo.errors import DuplicateKeyError

from pkg_nilai import hitung_nilai, kode_sub
from pkg_skema import KOLEKSI_INSTRUMEN, KOLEKSI_PENILAIAN, KOLEKSI_PENUGASAN, DrafPenilaianRequest

KUNCI_HASIL = ('nilai_akhir', 'nilai_maks', 'capaian_persen', 'level_capaian', 'predikat', 'terkunci_pada')


async def konteks_lembar(db, user: Dict[str, Any], keanggotaan: Dict[str, Any], guru_id: str) -> Dict[str, Any]:
    """Periksa hak penilai atas guru & kumpulkan konteks lembar: periode, sk, penugasan, lembar (atau None),
    dan instrumen yang berlaku. 403 bila guru tidak dibagikan / lembar milik penilai lain; 409 tanpa instrumen."""
    periode, sk = await sk_aktif(db)
    if not periode or not sk:
        raise HTTPException(409, 'Belum ada SK aktif pada periode berjalan.')
    penugasan = await db[KOLEKSI_PENUGASAN].find_one({'periode_id': periode['id'], 'penilai_id': user['id']}, {'_id': 0})
    if not penugasan or guru_id not in (penugasan.get('guru_dinilai_ids') or []) or guru_id == user['id']:
        raise tolak('bukan_penugasan')
    lembar = await db[KOLEKSI_PENILAIAN].find_one({'sk_id': sk['id'], 'guru_dinilai_id': guru_id}, {'_id': 0})
    if lembar and lembar.get('penilai_id') != user['id']:
        raise tolak('bukan_penugasan', 'Lembar penilaian guru ini dipegang penilai lain.')
    if lembar and lembar.get('instrumen_id'):
        instrumen = await db[KOLEKSI_INSTRUMEN].find_one({'id': lembar['instrumen_id']}, {'_id': 0})
    else:
        instrumen = await instrumen_aktif(db)
    if not instrumen:
        raise HTTPException(409, 'Instrumen PKG belum dimuat. Hubungi kepala madrasah.')
    return {'periode': periode, 'sk': sk, 'penugasan': penugasan, 'lembar': lembar, 'instrumen': instrumen,
            'keanggotaan': keanggotaan}


def alasan_tidak_dapat_diisi(ktx: Dict[str, Any]) -> Optional[str]:
    lembar = ktx['lembar'] or {}
    if lembar.get('status') == 'terkunci':
        return 'terkunci'
    if not ktx['keanggotaan'].get('dalam_masa_penilaian'):
        return 'di_luar_masa'
    return None


async def identitas_guru(db, ktx: Dict[str, Any], guru_id: str) -> Dict[str, Any]:
    """Identitas guru dari snapshot periode (penugasan, lalu SK) dengan cadangan akun; status akun & rangkap penilai."""
    snap = ((ktx['penugasan'].get('snapshot_guru') or {}).get(guru_id)
            or (ktx['sk'].get('snapshot_anggota') or {}).get(guru_id) or {})
    akun = await db.users.find_one({'id': guru_id}, {'_id': 0, 'full_name': 1, 'nip_nuptk': 1, 'is_active': 1}) or {}
    return {
        'id': guru_id,
        'nama': snap.get('nama') or akun.get('full_name') or '(akun tidak ditemukan)',
        'nip': snap.get('nip') or akun.get('nip_nuptk'),
        'mapel': snap.get('mapel'),
        'akun_aktif': bool(akun) and akun.get('is_active') is not False,
        'juga_penilai': guru_id in (ktx['sk'].get('penilai_ids') or []),
    }


async def lembar_tampil(db, ktx: Dict[str, Any], guru_id: str) -> Dict[str, Any]:
    lembar = ktx['lembar'] or {}
    periode = ktx['periode']
    instrumen = ktx['instrumen']
    alasan = alasan_tidak_dapat_diisi(ktx)
    return {
        'id': lembar.get('id'),
        'status': lembar.get('status') or 'belum',
        'guru': await identitas_guru(db, ktx, guru_id),
        'periode': {k: periode.get(k) for k in ('id', 'nama_periode', 'tanggal_buka', 'tanggal_tutup')},
        'instrumen': {k: instrumen.get(k) for k in ('id', 'versi_template', 'revisi', 'kompetensi')},
        'isian': lembar.get('isian') or {},
        'catatan_umum': lembar.get('catatan_umum') or '',
        'hasil': {k: lembar.get(k) for k in KUNCI_HASIL} if lembar.get('status') == 'terkunci' else None,
        'dapat_diisi': alasan is None,
        'alasan_tidak_dapat_diisi': alasan,
        'updated_at': lembar.get('updated_at'),
    }


def wajib_dapat_diisi(ktx: Dict[str, Any]) -> None:
    alasan = alasan_tidak_dapat_diisi(ktx)
    if alasan == 'terkunci':
        raise HTTPException(409, 'Lembar penilaian ini sudah dikirim dan dikunci.')
    if alasan == 'di_luar_masa':
        raise tolak('di_luar_masa')


def wajib_kode_sub_sah(ktx: Dict[str, Any], data: DrafPenilaianRequest) -> None:
    asing = sorted(set(data.isian) - set(kode_sub(ktx['instrumen'])))
    if asing:
        raise HTTPException(400, f"Sub-kompetensi tidak ada di instrumen lembar: {', '.join(asing[:5])}.")


async def simpan_draf(db, ktx: Dict[str, Any], data: DrafPenilaianRequest) -> Dict[str, Any]:
    """Simpan isian sebagai draf. Lembar dibuat saat draf pertama (instrumen aktif & snapshot guru disalin).
    Hasil: dokumen lembar terbaru (+ '_baru': bool)."""
    wajib_dapat_diisi(ktx)
    wajib_kode_sub_sah(ktx, data)
    isian = {k: v.model_dump() for k, v in data.isian.items()}
    nilai = hitung_nilai(ktx['instrumen'], isian)
    sekarang = datetime.now(timezone.utc).isoformat()
    perubahan = {'isian': isian, 'catatan_umum': data.catatan_umum, 'skor_per_indikator': nilai['skor_per_indikator'],
                 'progres': nilai['progres'], 'status': 'draf', 'updated_at': sekarang}
    lembar = ktx['lembar']
    baru = lembar is None
    if baru:
        guru = await identitas_guru(db, ktx, data.guru_id)
        dok = {
            'id': str(uuid.uuid4()), 'sk_id': ktx['sk']['id'], 'periode_id': ktx['periode']['id'],
            'penilai_id': ktx['penugasan']['penilai_id'], 'guru_dinilai_id': data.guru_id,
            'instrumen_id': ktx['instrumen']['id'],
            'snapshot_guru': {k: guru[k] for k in ('nama', 'nip', 'mapel')},
            'created_at': sekarang, **perubahan,
        }
        try:
            await db[KOLEKSI_PENILAIAN].insert_one(dict(dok))
            return {**dok, '_baru': True}
        except DuplicateKeyError:
            # Dua simpan bersamaan (mis. autosave ganda): lembar sudah dibuat permintaan lain -> perbarui saja.
            lembar = await db[KOLEKSI_PENILAIAN].find_one({'sk_id': ktx['sk']['id'], 'guru_dinilai_id': data.guru_id}, {'_id': 0})
            if not lembar or lembar.get('penilai_id') != ktx['penugasan']['penilai_id']:
                raise tolak('bukan_penugasan', 'Lembar penilaian guru ini dipegang penilai lain.')
            baru = False
    # Filter status 'draf' mencegah menimpa lembar yang baru saja dikunci oleh permintaan lain.
    hasil = await db[KOLEKSI_PENILAIAN].update_one({'id': lembar['id'], 'status': 'draf'}, {'$set': perubahan})
    if getattr(hasil, 'matched_count', 1) == 0:
        raise HTTPException(409, 'Lembar penilaian ini sudah dikirim dan dikunci.')
    return {**lembar, **perubahan, '_baru': baru}
