"""Migrasi data otomatis saat backend start (mis. redeploy di Coolify) — tidak perlu menjalankan skrip manual.

Tiap migrasi dijalankan SEKALI per database dan dicatat di koleksi `app_migrasi`
({_id: nama, status: berjalan|selesai|gagal, mulai, selesai, hasil, galat}). Klaim atomik mencegah dua worker
uvicorn menjalankan migrasi yang sama; status `berjalan` yang macet > 30 menit boleh diambil alih.
Migrasi yang gagal (mis. unduhan data wilayah tanpa internet) dicoba lagi pada start berikutnya.
Berjalan di latar belakang agar health check tidak tertahan.

Variabel lingkungan:
  MIGRASI_OTOMATIS=0        matikan seluruh migrasi otomatis
  MIGRASI_WILAYAH_UNDUH=0   jangan unduh data wilayah resmi (muat lewat menu Master Wilayah)
"""
import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Awaitable, Callable, Dict, Optional

from pymongo.errors import DuplicateKeyError

logger = logging.getLogger('matsandatama')

KOLEKSI_MIGRASI = 'app_migrasi'
BATAS_MACET = timedelta(minutes=30)
MIN_DESA_LENGKAP = 80000  # data resmi ±83 ribu desa/kelurahan


def _sekarang() -> datetime:
    return datetime.now(timezone.utc)


def _aktif(nama_env: str) -> bool:
    return os.environ.get(nama_env, '1').strip().lower() not in ('0', 'false', 'no', 'tidak', 'off')


async def klaim(db, nama: str) -> bool:
    """True bila worker ini berhak menjalankan migrasi `nama` sekarang."""
    koll = db[KOLEKSI_MIGRASI]
    try:
        await koll.insert_one({'_id': nama, 'status': 'berjalan', 'mulai': _sekarang()})
        return True
    except DuplicateKeyError:
        pass
    batas = _sekarang() - BATAS_MACET
    r = await koll.update_one(
        {'_id': nama, '$or': [{'status': 'gagal'}, {'status': 'berjalan', 'mulai': {'$lt': batas}}]},
        {'$set': {'status': 'berjalan', 'mulai': _sekarang()}, '$unset': {'galat': ''}})
    return r.modified_count == 1


async def jalankan(db, nama: str, fungsi: Callable[[], Awaitable[Optional[Dict]]]) -> Optional[str]:
    """Jalankan satu migrasi bila belum pernah selesai. -> status akhir, atau None bila dilewati."""
    if not await klaim(db, nama):
        return None
    logger.info(f"[migrasi] {nama}: mulai")
    try:
        hasil = await fungsi()
    except Exception as e:  # noqa: BLE001 — migrasi gagal tidak boleh menghentikan server
        logger.error(f"[migrasi] {nama}: gagal — {e}")
        await db[KOLEKSI_MIGRASI].update_one({'_id': nama}, {'$set': {'status': 'gagal', 'galat': str(e)[:500], 'selesai': _sekarang()}})
        return 'gagal'
    await db[KOLEKSI_MIGRASI].update_one({'_id': nama}, {'$set': {'status': 'selesai', 'hasil': hasil or {}, 'selesai': _sekarang()}})
    logger.info(f"[migrasi] {nama}: selesai {hasil or ''}")
    return 'selesai'


# ---- daftar migrasi ----
async def _ckg_kolom_baku(db):
    from migrations.migrate_uks_ckg_kolom_baku import migrate
    return await migrate(db)


async def _gtk_nama_gelar(db):
    from migrations.migrate_gtk_nama_gelar import migrate
    stat = await migrate(db)
    return {k: stat[k] for k in ('diproses', 'bergelar')}


async def _master_wilayah(db):
    """Muat data wilayah resmi bila master belum lengkap (butuh internet dari server)."""
    from wilayah_master import ensure_wilayah_indexes, seed_provinsi
    await ensure_wilayah_indexes(db)
    await seed_provinsi(db, _sekarang().isoformat())
    desa = await db.wilayah.count_documents({'tingkat': 'desa'})
    if desa >= MIN_DESA_LENGKAP:
        return {'desa': desa, 'keterangan': 'master sudah lengkap'}
    if not _aktif('MIGRASI_WILAYAH_UNDUH'):
        return {'desa': desa, 'keterangan': 'unduhan dimatikan; muat lewat menu Master Wilayah'}
    from wilayah_impor import impor_paket_wilayah
    from wilayah_sumber import URL_KODEPOS, URL_WILAYAH, baris_paket_dari_sql, paket_csv, unduh
    sql_w, sql_k = await asyncio.gather(asyncio.to_thread(unduh, URL_WILAYAH), asyncio.to_thread(unduh, URL_KODEPOS))
    baris = await asyncio.to_thread(baris_paket_dari_sql, sql_w, sql_k)
    if len(baris) < MIN_DESA_LENGKAP:
        raise RuntimeError(f'data wilayah unduhan tidak lengkap ({len(baris)} baris)')
    h = await impor_paket_wilayah(db, paket_csv(baris), 'wilayah_resmi.csv')
    return {k: h[k] for k in ('total', 'baru', 'diperbarui', 'gagal', 'yatim')}


async def _alamat_kode_wilayah(db):
    """Cocokkan alamat siswa & GTK tersimpan (tanpa kode wilayah) ke master — setelah master lengkap."""
    if await db.wilayah.count_documents({'tingkat': 'desa'}) < MIN_DESA_LENGKAP:
        raise RuntimeError('master wilayah belum lengkap; dicoba lagi pada start berikutnya')
    from wilayah_cocok import cocokkan_alamat_tersimpan
    return await cocokkan_alamat_tersimpan(db)


async def _guru_pengganti(db):
    from migrations.migrate_guru_pengganti import migrate
    hasil = await migrate(db)
    if hasil['index_gagal']:
        raise RuntimeError(f"index gagal: {hasil['index_gagal']}")
    return {k: hasil[k] for k in ('status_diisi', 'total')} | {'ganda': len(hasil['ganda'])}


async def _journal_pengisi(db):
    from migrations.migrate_journal_pengisi import migrate
    return await migrate(db)


async def _tatib_poin(db):
    from migrations.migrate_tatib_poin import migrate
    return await migrate(db)


async def _tatib_aturan_kondisi(db):
    from migrations.migrate_tatib_aturan_kondisi import migrate
    return await migrate(db)


async def _simpan_akun(db):
    from migrations.migrate_simpan_akun import migrate
    return await migrate(db)


async def _masterplan(db):
    from migrations.migrate_masterplan import migrate
    return await migrate(db)


MIGRASI = [
    ('2026-10-06_uks_ckg_kolom_baku', _ckg_kolom_baku),
    ('2026-10-06_gtk_nama_gelar', _gtk_nama_gelar),
    ('2026-10-06_master_wilayah', _master_wilayah),
    ('2026-10-06_alamat_kode_wilayah', _alamat_kode_wilayah),
    ('2026-10-07_guru_pengganti', _guru_pengganti),
    ('2026-10-07_journal_pengisi', _journal_pengisi),
    ('2026-10-08_tatib_poin', _tatib_poin),
    ('2026-10-08_tatib_aturan_kondisi', _tatib_aturan_kondisi),
    ('2026-10-08_simpan_akun', _simpan_akun),
    ('2026-10-08_masterplan', _masterplan),
]


# Migrasi yang hanya boleh dijalankan setelah migrasi lain berstatus selesai.
PRASYARAT = {'2026-10-06_alamat_kode_wilayah': '2026-10-06_master_wilayah'}


async def jalankan_semua(db, jeda_detik: float = 5) -> Dict[str, Optional[str]]:
    """Jalankan semua migrasi berurutan (dipanggil sebagai task latar belakang saat startup)."""
    if not _aktif('MIGRASI_OTOMATIS'):
        logger.info("[migrasi] MIGRASI_OTOMATIS=0 — migrasi otomatis dilewati")
        return {}
    if jeda_detik:
        await asyncio.sleep(jeda_detik)
    hasil = {}
    for nama, fungsi in MIGRASI:
        syarat = PRASYARAT.get(nama)
        if syarat and ((await db[KOLEKSI_MIGRASI].find_one({'_id': syarat}, {'status': 1})) or {}).get('status') != 'selesai':
            hasil[nama] = None  # prasyarat belum selesai (gagal / sedang dijalankan worker lain): coba lagi start berikutnya
            continue
        hasil[nama] = await jalankan(db, nama, lambda f=fungsi: f(db))
    return hasil
