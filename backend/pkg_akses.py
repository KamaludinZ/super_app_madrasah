"""Akses modul PKG (Penilaian Kinerja Guru) berbasis keanggotaan SK aktif. Skema koleksi: lihat pkg_skema.

Aturan akses:
    - Modul hanya untuk personil SK aktif (SK is_active pada periode berstatus 'berjalan').
    - Kepala madrasah selalu berperan sebagai penilai (tanpa perlu supervisi) dan tidak pernah dinilai.
    - Guru boleh merangkap penilai sekaligus dinilai pada periode yang sama.
    - Penilai selain kepala wajib disupervisi kepala lebih dahulu (pkg_penugasan.supervisi_selesai).
Penolakan dikirim sebagai HTTP 403 terstruktur: detail = {'alasan': <kode>, 'pesan': <teks>}.
"""
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import HTTPException

from pkg_skema import KOLEKSI_PENILAIAN, KOLEKSI_PENUGASAN, KOLEKSI_PERIODE, KOLEKSI_SK  # noqa: F401

PERAN_KEPALA = 'kepala_sekolah'
STATUS_BERJALAN = 'berjalan'

PESAN_TOLAK = {
    'bukan_anggota_sk': 'Akun Anda tidak terdaftar pada SK penilaian kinerja yang aktif.',
    'bukan_penilai': 'Halaman ini khusus anggota tim penilai pada periode berjalan.',
    'belum_disupervisi': 'Anda belum disupervisi kepala madrasah pada periode ini.',
    'bukan_kepala': 'Aksi ini hanya dapat dilakukan dari akun kepala madrasah.',
}


def tolak(alasan: str, pesan: Optional[str] = None) -> HTTPException:
    return HTTPException(status_code=403, detail={'alasan': alasan, 'pesan': pesan or PESAN_TOLAK[alasan]})


def adalah_kepala(user: Dict[str, Any]) -> bool:
    return PERAN_KEPALA in (user.get('roles') or [])


def periode_tampil(periode: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not periode:
        return None
    kunci = ('id', 'nama_periode', 'tahun_pelajaran', 'semester', 'tanggal_buka', 'tanggal_tutup', 'status')
    return {k: periode.get(k) for k in kunci}


def dalam_masa_penilaian(periode: Optional[Dict[str, Any]], hari_ini: Optional[str] = None) -> bool:
    """True bila hari ini (WIB) berada di antara tanggal buka dan tutup periode (inklusif)."""
    if not periode or not periode.get('tanggal_buka') or not periode.get('tanggal_tutup'):
        return False
    hari_ini = hari_ini or datetime.now(timezone(timedelta(hours=7))).strftime('%Y-%m-%d')
    return str(periode['tanggal_buka'])[:10] <= hari_ini <= str(periode['tanggal_tutup'])[:10]


async def sk_aktif(db) -> tuple:
    """(periode berjalan, SK aktif di periode itu); masing-masing None bila belum ada."""
    periode = await db[KOLEKSI_PERIODE].find_one({'status': STATUS_BERJALAN}, {'_id': 0})
    if not periode:
        return None, None
    sk = await db[KOLEKSI_SK].find_one({'periode_id': periode['id'], 'is_active': True}, {'_id': 0})
    return periode, sk


async def keanggotaan_sk(db, user: Dict[str, Any]) -> Dict[str, Any]:
    """Keanggotaan pengguna pada SK aktif. Tidak melempar galat; `anggota` False bila ditolak."""
    periode, sk = await sk_aktif(db)
    uid = user.get('id')
    kepala = adalah_kepala(user)
    sebagai_penilai = kepala or bool(sk and uid in (sk.get('penilai_ids') or []))
    # Kepala madrasah tidak menjadi objek penilaian walau tercantum di dinilai_ids.
    sebagai_dinilai = not kepala and bool(sk and uid in (sk.get('dinilai_ids') or []))

    supervisi_selesai = kepala
    if sebagai_penilai and not kepala and periode:
        penugasan = await db[KOLEKSI_PENUGASAN].find_one(
            {'periode_id': periode['id'], 'penilai_id': uid}, {'_id': 0, 'supervisi_selesai': 1})
        supervisi_selesai = bool((penugasan or {}).get('supervisi_selesai'))

    # Kepala tetap dapat membuka modul tanpa SK aktif untuk menetapkan periode & SK.
    anggota = kepala or bool(sk and (sebagai_penilai or sebagai_dinilai))
    return {
        'anggota': anggota,
        'periode': periode_tampil(periode),
        'sk_id': (sk or {}).get('id'),
        'nomor_sk': (sk or {}).get('nomor_sk'),
        'peran': 'kepala' if kepala else 'penilai' if sebagai_penilai else 'dinilai' if sebagai_dinilai else None,
        'sebagai_penilai': sebagai_penilai,
        'sebagai_dinilai': sebagai_dinilai,
        'supervisi_selesai': supervisi_selesai,
        'dalam_masa_penilaian': dalam_masa_penilaian(periode),
        'penolakan': None if anggota else {'alasan': 'bukan_anggota_sk', 'pesan': PESAN_TOLAK['bukan_anggota_sk']},
    }


# Syarat akses fitur PKG:
#   'anggota'   = semua anggota SK aktif (kepala selalu termasuk)
#   'kepala'    = hanya akun kepala madrasah (periode, SK, pembagian, supervisi, jejak audit)
#   'pengelola' = kepala atau penilai (mis. cetak dokumen)
#   'penilai'   = penilai yang sudah disupervisi (kepala selalu lolos)
SYARAT_AKSES = ('anggota', 'kepala', 'pengelola', 'penilai')


def alasan_tolak(k: Dict[str, Any], syarat: str = 'anggota') -> Optional[str]:
    """Kode alasan penolakan untuk keanggotaan `k` terhadap `syarat`, atau None bila diizinkan."""
    if syarat not in SYARAT_AKSES:
        raise ValueError(f'syarat akses tidak dikenal: {syarat}')
    if not k.get('anggota'):
        return 'bukan_anggota_sk'
    if syarat == 'kepala':
        return None if k.get('peran') == 'kepala' else 'bukan_kepala'
    if syarat in ('penilai', 'pengelola') and not k.get('sebagai_penilai'):
        return 'bukan_penilai'
    if syarat == 'penilai' and not k.get('supervisi_selesai'):
        return 'belum_disupervisi'
    return None


async def wajib_akses(db, user: Dict[str, Any], syarat: str = 'anggota') -> Dict[str, Any]:
    """Keanggotaan SK aktif yang memenuhi `syarat`, atau HTTP 403 terstruktur dengan alasannya."""
    k = await keanggotaan_sk(db, user)
    alasan = alasan_tolak(k, syarat)
    if alasan:
        raise tolak(alasan)
    return k


async def wajib_anggota_sk(db, user: Dict[str, Any]) -> Dict[str, Any]:
    """Keanggotaan SK aktif, atau HTTP 403 'bukan_anggota_sk'."""
    return await wajib_akses(db, user, 'anggota')
