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
import logging
from typing import Any, Dict, Optional

from fastapi import HTTPException

from pkg_akses import sk_aktif, tolak
from pkg_instrumen import instrumen_aktif
from pymongo.errors import DuplicateKeyError

from pkg_nilai import hitung_nilai, kode_sub
from pkg_skema import (
    KOLEKSI_AUDIT, KOLEKSI_INSTRUMEN, KOLEKSI_PENILAIAN, KOLEKSI_PENUGASAN, DrafPenilaianRequest, KirimPenilaianRequest,
)

logger = logging.getLogger('matsandatama')

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


def galat_kelengkapan(instrumen: Dict[str, Any], isian: Dict[str, Any]) -> Dict[str, str]:
    """{kode_sub: pesan} untuk sub yang belum dinilai (aturan sama dengan validasiLembar di frontend)."""
    skor = hitung_nilai(instrumen, isian)['skor_per_indikator']
    return {kode: 'Belum dinilai: centang minimal satu indikator.' for kode, n in skor.items() if n == 0}


async def kirim_dan_kunci(db, ktx: Dict[str, Any], data: KirimPenilaianRequest, penilai: Dict[str, Any]) -> Dict[str, Any]:
    """Validasi kelengkapan, simpan isian terakhir, lalu kunci lembar permanen dengan nilai akhir resmi."""
    wajib_dapat_diisi(ktx)
    wajib_kode_sub_sah(ktx, data)
    isian = {k: v.model_dump() for k, v in data.isian.items()}
    galat = galat_kelengkapan(ktx['instrumen'], isian)
    if galat:
        raise HTTPException(400, {'pesan': f'{len(galat)} sub-kompetensi belum dinilai.', 'galat': galat})
    lembar = await simpan_draf(db, ktx, data)
    nilai = hitung_nilai(ktx['instrumen'], isian)
    sekarang = datetime.now(timezone.utc).isoformat()
    kunci = {
        'status': 'terkunci', 'skor_per_indikator': nilai['skor_per_indikator'], 'progres': 100,
        'nilai_akhir': nilai['nilai_akhir'], 'nilai_maks': nilai['nilai_maks'], 'capaian_persen': nilai['capaian_persen'],
        'level_capaian': nilai['level_capaian'], 'predikat': nilai['predikat'],
        'dikirim_pada': sekarang, 'terkunci_pada': sekarang, 'terkunci_oleh': penilai.get('id'), 'updated_at': sekarang,
    }
    hasil = await db[KOLEKSI_PENILAIAN].update_one({'id': lembar['id'], 'status': 'draf'}, {'$set': kunci})
    if getattr(hasil, 'matched_count', 1) == 0:
        raise HTTPException(409, 'Lembar penilaian ini sudah dikirim dan dikunci.')
    lembar.pop('_baru', None)
    terkunci = {**lembar, **kunci}
    # Hasil akhir langsung dimaterialisasi untuk rekap (dapat dibangun ulang lewat migrasi bila gagal).
    from pkg_rekap import simpan_rekap_lembar
    await simpan_rekap_lembar(db, terkunci, ktx['instrumen'], ktx['sk'])
    return terkunci


async def riwayat_lembar(db, penilaian_id: Optional[str]) -> list:
    """Jejak aksi satu lembar (mulai, draf, buka, kirim) dari pkg_audit_log, terbaru dulu."""
    if not penilaian_id:
        return []
    from pkg_audit import LABEL_AKSI
    docs = await db[KOLEKSI_AUDIT].find({'penilaian_id': penilaian_id}, {'_id': 0}).to_list(500)
    docs.sort(key=lambda d: d.get('terakhir') or d.get('timestamp') or '', reverse=True)
    return [{
        'aksi': d.get('aksi'), 'label': LABEL_AKSI.get(d.get('aksi'), d.get('aksi')), 'aktor_nama': d.get('aktor_nama'),
        'timestamp': d.get('timestamp'), 'terakhir': d.get('terakhir'), 'jumlah': d.get('jumlah'),
        'progres': (d.get('metadata') or {}).get('progres'), 'nilai_akhir': (d.get('metadata') or {}).get('nilai_akhir'),
    } for d in docs]


async def periksa_penilaian_startup(db) -> Dict[str, int]:
    """Saat startup: peringatkan lembar yang merujuk instrumen tidak ditemukan (tidak dapat dibuka/dicetak) dan
    catat lembar draf yang tertinggal pada periode yang sudah ditutup."""
    lembar = await db[KOLEKSI_PENILAIAN].find({}, {'_id': 0, 'instrumen_id': 1, 'periode_id': 1, 'status': 1}).to_list(100000)
    ada = {d['id'] for d in await db[KOLEKSI_INSTRUMEN].find({}, {'_id': 0, 'id': 1}).to_list(1000)}
    from pkg_skema import KOLEKSI_PERIODE
    ditutup = {d['id'] for d in await db[KOLEKSI_PERIODE].find({'status': 'ditutup'}, {'_id': 0, 'id': 1}).to_list(1000)}
    hasil = {
        'lembar': len(lembar),
        'instrumen_hilang': sum(1 for d in lembar if d.get('instrumen_id') and d['instrumen_id'] not in ada),
        'draf_periode_ditutup': sum(1 for d in lembar if d.get('status') == 'draf' and d.get('periode_id') in ditutup),
    }
    if hasil['instrumen_hilang']:
        logger.warning(f"[pkg] {hasil['instrumen_hilang']} lembar penilaian merujuk instrumen yang tidak ditemukan; "
                       'lembar tersebut tidak dapat dibuka atau dicetak.')
    if hasil['draf_periode_ditutup']:
        logger.info(f"[pkg] {hasil['draf_periode_ditutup']} lembar masih draf pada periode yang sudah ditutup.")
    return hasil
