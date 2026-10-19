"""Jejak audit modul PKG (koleksi pkg_audit_log), terpisah dari audit_logs umum.

    pkg_audit_log  {id, penilaian_id, aksi, aktor_id, aktor_nama, aktor_peran, metadata, ip_address,
                    timestamp (UTC ISO), tanggal (WIB 'YYYY-MM-DD'), jumlah, terakhir}

`catat_audit_pkg` menulis satu entri per aksi (penilaian, instrumen, unduhan). Aksi yang bisa berulang
cepat (membuka beranda, penolakan akses) memakai `catat_audit_pkg_harian`: satu entri per aktor per
hari per kunci, dengan `jumlah` dan `terakhir` diperbarui agar log tidak membanjir.
Galat audit dicatat ke logger dan tidak pernah menggagalkan permintaan.
"""
import hashlib
import logging
import re
import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Dict, List, Optional

from pkg_skema import KOLEKSI_AUDIT, KOLEKSI_UNDUHAN

logger = logging.getLogger('matsandatama')

WIB = timezone(timedelta(hours=7))

AKSI_BUKA_BERANDA = 'buka_beranda'
AKSI_TOLAK_AKSES = 'tolak_akses'
AKSI_LIHAT_TEMPLATE = 'lihat_template'
AKSI_PERIKSA_TEMPLATE = 'periksa_template'
AKSI_CETAK_TEMPLATE = 'cetak_template'

# Katalog kode aksi pkg_audit_log beserta labelnya (untuk halaman Jejak Audit PKG). Setiap aksi yang dicatat
# router PKG wajib terdaftar di sini (diuji di tests/test_pkg_validasi.py).
LABEL_AKSI = {
    AKSI_BUKA_BERANDA: 'Membuka Beranda PKG',
    AKSI_TOLAK_AKSES: 'Akses ditolak',
    'periode_buat': 'Menetapkan periode',
    'periode_ubah': 'Mengubah periode',
    'periode_berjalan': 'Memulai periode',
    'periode_ditutup': 'Menutup periode',
    'sk_buat': 'Menambah SK',
    'sk_ubah': 'Mengubah SK',
    'sk_aktifkan': 'Mengaktifkan SK',
    'sk_hapus': 'Menghapus SK',
    'sk_penilai': 'Mengubah tim penilai',
    'sk_dinilai': 'Mengubah guru yang dinilai',
    'penugasan_simpan': 'Menyimpan pembagian penilaian',
    'supervisi_tandai': 'Menandai supervisi penilai',
    'supervisi_batal': 'Membatalkan supervisi penilai',
    'instrumen_impor': 'Mengimpor instrumen',
    'instrumen_ubah': 'Mengubah instrumen',
    'instrumen_aktifkan': 'Menetapkan instrumen acuan',
    'penilaian_mulai': 'Memulai lembar penilaian',
    'penilaian_buka': 'Membuka lembar penilaian',
    'penilaian_draf': 'Menyimpan draf penilaian',
    'penilaian_kirim': 'Mengirim & mengunci penilaian',
    'lihat_rekap': 'Melihat rekap',
    'lihat_rekap_guru': 'Melihat rekap per guru',
    'rekap_hitung_ulang': 'Menghitung ulang rekap',
    AKSI_LIHAT_TEMPLATE: 'Melihat info template',
    AKSI_PERIKSA_TEMPLATE: 'Memeriksa ulang berkas template',
    AKSI_CETAK_TEMPLATE: 'Mencetak dokumen dari template',
}


async def ensure_pkg_audit_indexes(database) -> List[str]:
    gagal = []
    for keys, kwargs in [
        ([('timestamp', -1)], {'name': 'waktu'}),
        ([('penilaian_id', 1), ('timestamp', -1)], {'name': 'penilaian_waktu'}),
        ([('aktor_id', 1), ('aksi', 1), ('tanggal', 1), ('kunci', 1)], {'name': 'harian'}),
    ]:
        try:
            await database[KOLEKSI_AUDIT].create_index(keys, **kwargs)
        except Exception as e:  # noqa: BLE001
            gagal.append(f"{KOLEKSI_AUDIT} {keys}: {e}")
            logger.error(f"[pkg_audit] Gagal membuat index {keys}: {e}")
    return gagal


def _dasar(aksi: str, aktor: Optional[Dict[str, Any]], metadata: Optional[Dict[str, Any]],
           penilaian_id: Optional[str], request) -> Dict[str, Any]:
    sekarang = datetime.now(timezone.utc)
    aktor = aktor or {}
    return {
        'id': str(uuid.uuid4()),
        'penilaian_id': penilaian_id,
        'aksi': aksi,
        'aktor_id': aktor.get('id'),
        'aktor_nama': aktor.get('full_name') or aktor.get('username'),
        'aktor_peran': aktor.get('active_role'),
        'metadata': metadata or {},
        'ip_address': request.client.host if request is not None and getattr(request, 'client', None) else None,
        'timestamp': sekarang.isoformat(),
        'tanggal': sekarang.astimezone(WIB).strftime('%Y-%m-%d'),
    }


async def catat_audit_pkg(db, aksi: str, aktor: Optional[Dict[str, Any]], metadata: Optional[Dict[str, Any]] = None,
                          penilaian_id: Optional[str] = None, request=None) -> None:
    try:
        await db[KOLEKSI_AUDIT].insert_one(_dasar(aksi, aktor, metadata, penilaian_id, request))
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[pkg_audit] gagal mencatat {aksi}: {e}")


async def catat_audit_pkg_harian(db, aksi: str, aktor: Optional[Dict[str, Any]], kunci: str = '',
                                 metadata: Optional[Dict[str, Any]] = None, request=None,
                                 penilaian_id: Optional[str] = None) -> None:
    """Satu entri per (aktor, aksi, tanggal WIB, kunci); kunjungan berikutnya menaikkan `jumlah`."""
    try:
        doc = _dasar(aksi, aktor, metadata, penilaian_id, request)
        saring = {'aktor_id': doc['aktor_id'], 'aksi': aksi, 'tanggal': doc['tanggal'], 'kunci': kunci}
        await db[KOLEKSI_AUDIT].update_one(
            saring,
            {
                '$setOnInsert': {k: v for k, v in doc.items() if k not in saring and k != 'ip_address'},
                '$set': {'terakhir': doc['timestamp'], 'ip_address': doc['ip_address']},
                '$inc': {'jumlah': 1},
            },
            upsert=True,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[pkg_audit] gagal mencatat {aksi}: {e}")


async def catat_cetak_template(db, aktor: Optional[Dict[str, Any]], jenis_template: str, format_berkas: str,
                               nama_berkas: str, versi_template: str, checksum_template: Optional[str],
                               periode_id: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None,
                               request=None, jenis_dokumen: Optional[str] = None, guru_id: Optional[str] = None,
                               mesin: Optional[str] = None, isi: Optional[bytes] = None) -> None:
    """Catat satu cetak/unduh dokumen dari template resmi: jejak audit (aksi cetak_template) dan riwayat unduhan
    (pkg_unduhan) — siapa, kapan, dokumen & guru, template & versi/checksum, mesin cetak, format, nama, ukuran, dan
    SHA-256 berkas hasil (bukti isi yang diunduh)."""
    checksum_berkas = hashlib.sha256(isi).hexdigest() if isi is not None else None
    meta = {'jenis_dokumen': jenis_dokumen or jenis_template, 'jenis_template': jenis_template, 'format': format_berkas,
            'nama_berkas': nama_berkas, 'versi_template': versi_template, 'checksum_template': checksum_template,
            'periode_id': periode_id, 'guru_id': guru_id, 'mesin': mesin, 'checksum_berkas': checksum_berkas,
            **(metadata or {})}
    await catat_audit_pkg(db, AKSI_CETAK_TEMPLATE, aktor, meta, request=request)
    try:
        dasar = _dasar(AKSI_CETAK_TEMPLATE, aktor, meta, None, request)
        await db[KOLEKSI_UNDUHAN].insert_one({
            'id': dasar['id'], 'jenis': jenis_dokumen or jenis_template, 'jenis_template': jenis_template,
            'format': format_berkas, 'mesin': mesin, 'periode_id': periode_id, 'guru_id': guru_id,
            'nama_berkas': nama_berkas, 'ukuran': len(isi) if isi is not None else None, 'checksum_berkas': checksum_berkas,
            'versi_template': versi_template, 'checksum_template': checksum_template,
            'aktor_id': dasar['aktor_id'], 'aktor_nama': dasar['aktor_nama'], 'aktor_peran': dasar['aktor_peran'],
            'ip_address': dasar['ip_address'], 'timestamp': dasar['timestamp'],
        })
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[pkg_audit] gagal mencatat riwayat unduhan: {e}")


# ---------------------------------------------------------------- daftar berhalaman (riwayat unduhan & jejak audit)

def saring_waktu_wib(dari: Optional[str], sampai: Optional[str]) -> Dict[str, str]:
    """Syarat Mongo untuk field `timestamp` (UTC ISO) dari rentang tanggal WIB 'YYYY-MM-DD' (keduanya inklusif)."""
    syarat = {}
    if dari:
        syarat['$gte'] = datetime.combine(date.fromisoformat(dari), time.min, WIB).astimezone(timezone.utc).isoformat()
    if sampai:
        akhir = datetime.combine(date.fromisoformat(sampai) + timedelta(days=1), time.min, WIB)
        syarat['$lt'] = akhir.astimezone(timezone.utc).isoformat()
    return syarat


def syarat_cari(teks: Optional[str], field: tuple) -> Optional[Dict[str, Any]]:
    """Syarat $or pencarian teks (tanpa beda huruf besar/kecil, karakter regex di-escape) atas beberapa field."""
    teks = (teks or '').strip()
    if not teks:
        return None
    pola = re.escape(teks)
    return {'$or': [{f: {'$regex': pola, '$options': 'i'}} for f in field]}


async def daftar_berhalaman(db, koleksi: str, q: Dict[str, Any], urut: str = 'timestamp', arah: str = 'desc',
                            halaman: int = 1, per_halaman: int = 25) -> Dict[str, Any]:
    """{item, total, halaman, per_halaman, urut, arah} dari koleksi; urutan kedua selalu timestamp lalu id agar stabil."""
    total = await db[koleksi].count_documents(q)
    a = -1 if arah == 'desc' else 1
    kunci = [(urut, a)] + ([('timestamp', -1)] if urut != 'timestamp' else []) + [('id', 1)]
    item = await db[koleksi].find(q, {'_id': 0}).sort(kunci).skip((halaman - 1) * per_halaman).limit(per_halaman) \
        .to_list(per_halaman)
    return {'item': item, 'total': total, 'halaman': halaman, 'per_halaman': per_halaman, 'urut': urut, 'arah': arah}


URUT_UNDUHAN = ('timestamp', 'nama_berkas', 'ukuran', 'aktor_nama', 'format', 'jenis', 'mesin')


async def daftar_unduhan(db, *, periode_id: Optional[str] = None, jenis: Optional[str] = None,
                         format_berkas: Optional[str] = None, mesin: Optional[str] = None, guru_id: Optional[str] = None,
                         aktor_id: Optional[str] = None, dari: Optional[str] = None, sampai: Optional[str] = None,
                         cari: Optional[str] = None, urut: str = 'timestamp', arah: str = 'desc', halaman: int = 1,
                         per_halaman: int = 25) -> Dict[str, Any]:
    """Riwayat unduhan (pkg_unduhan) tersaring & terurut, berhalaman. `cari` mencocokkan nama berkas/pengunduh."""
    q: Dict[str, Any] = {k: v for k, v in {'periode_id': periode_id, 'jenis': jenis, 'format': format_berkas,
                                           'mesin': mesin, 'guru_id': guru_id, 'aktor_id': aktor_id}.items() if v}
    waktu = saring_waktu_wib(dari, sampai)
    if waktu:
        q['timestamp'] = waktu
    teks = syarat_cari(cari, ('nama_berkas', 'aktor_nama'))
    if teks:
        q.update(teks)
    return await daftar_berhalaman(db, KOLEKSI_UNDUHAN, q, urut, arah, halaman, per_halaman)
