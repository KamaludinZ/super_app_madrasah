"""Jejak audit modul PKG (koleksi pkg_audit_log), terpisah dari audit_logs umum.

    pkg_audit_log  {id, penilaian_id, aksi, kategori, aktor_id, aktor_nama, aktor_peran, metadata, ip_address,
                    guru_id, periode_id, timestamp (UTC ISO, saat pertama), tanggal (WIB 'YYYY-MM-DD'),
                    waktu_urut (UTC ISO, aktivitas terakhir), entri harian: kunci, jumlah, terakhir}
    `kategori` (KATEGORI_AKSI), `guru_id`/`periode_id` (disalin dari metadata) dan `waktu_urut` disimpan agar daftar
    jejak audit dapat disaring & diurutkan lewat index. Data lama dilengkapi oleh migrations/migrate_pkg_audit.py.

`catat_audit_pkg` menulis satu entri per aksi (penilaian, instrumen, unduhan). Aksi yang bisa berulang
cepat (membuka beranda, penolakan akses) memakai `catat_audit_pkg_harian`: satu entri per aktor per
hari per kunci, dengan `jumlah` dan `terakhir` diperbarui agar log tidak membanjir.
Galat audit dicatat ke logger dan tidak pernah menggagalkan permintaan.
"""
import hashlib
import json
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
AKSI_CETAK_GAGAL = 'cetak_gagal'
AKSI_LIHAT_UNDUHAN = 'lihat_unduhan'
AKSI_LIHAT_AUDIT = 'lihat_audit'

# Katalog kode aksi pkg_audit_log beserta labelnya (untuk halaman Jejak Audit PKG). Setiap aksi yang dicatat
# router PKG wajib terdaftar di sini (diuji di tests/test_pkg_validasi.py).
LABEL_AKSI = {
    'angket_simpan': 'Menginput jawaban angket 360°',
    'angket_ubah': 'Mengubah jawaban angket 360°',
    'angket_hapus': 'Menghapus jawaban angket 360°',
    'kehadiran_simpan': 'Menyimpan rekap kehadiran guru',
    'rekomendasi_simpan': 'Menyimpan rekomendasi PKB',
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
    AKSI_CETAK_GAGAL: 'Gagal mencetak dokumen',
    AKSI_LIHAT_UNDUHAN: 'Melihat riwayat unduhan',
    AKSI_LIHAT_AUDIT: 'Melihat jejak audit',
}


# Kategori aksi untuk saringan halaman Jejak Audit (warna penanda di frontend lib/pkgAudit.KATEGORI_AUDIT).
KATEGORI_AUDIT = ('penilaian', 'komponen', 'instrumen', 'susunan', 'unduhan', 'akses')
KATEGORI_AKSI = {
    **{a: 'penilaian' for a in ('penilaian_mulai', 'penilaian_buka', 'penilaian_draf', 'penilaian_kirim', 'rekap_hitung_ulang')},
    **{a: 'komponen' for a in ('angket_simpan', 'angket_ubah', 'angket_hapus', 'kehadiran_simpan', 'rekomendasi_simpan')},
    **{a: 'instrumen' for a in ('instrumen_impor', 'instrumen_ubah', 'instrumen_aktifkan')},
    **{a: 'susunan' for a in ('periode_buat', 'periode_ubah', 'periode_berjalan', 'periode_ditutup', 'sk_buat', 'sk_ubah',
                              'sk_aktifkan', 'sk_hapus', 'sk_penilai', 'sk_dinilai', 'penugasan_simpan',
                              'supervisi_tandai', 'supervisi_batal')},
    **{a: 'unduhan' for a in (AKSI_CETAK_TEMPLATE, AKSI_CETAK_GAGAL, AKSI_LIHAT_UNDUHAN, AKSI_LIHAT_TEMPLATE,
                              AKSI_PERIKSA_TEMPLATE)},
    **{a: 'akses' for a in (AKSI_BUKA_BERANDA, AKSI_TOLAK_AKSES, AKSI_LIHAT_AUDIT, 'lihat_rekap', 'lihat_rekap_guru')},
}


def kategori_aksi(aksi: str) -> str:
    return KATEGORI_AKSI.get(aksi, 'akses')


INDEX_AUDIT = [
    ([('id', 1)], {'name': 'id_unik', 'unique': True, 'partialFilterExpression': {'id': {'$exists': True}}}),
    ([('timestamp', -1)], {'name': 'waktu'}),
    ([('waktu_urut', -1)], {'name': 'waktu_urut'}),
    ([('kategori', 1), ('waktu_urut', -1)], {'name': 'kategori_waktu'}),
    ([('aksi', 1), ('waktu_urut', -1)], {'name': 'aksi_waktu_urut'}),
    ([('aktor_id', 1), ('waktu_urut', -1)], {'name': 'aktor_waktu'}),
    ([('guru_id', 1), ('waktu_urut', -1)], {'name': 'guru_waktu'}),
    ([('periode_id', 1), ('waktu_urut', -1)], {'name': 'periode_waktu'}),
    ([('penilaian_id', 1), ('timestamp', -1)], {'name': 'penilaian_waktu'}),
    ([('aktor_id', 1), ('aksi', 1), ('tanggal', 1), ('kunci', 1)], {'name': 'harian'}),
]


async def ensure_pkg_audit_indexes(database) -> List[str]:
    gagal = []
    for keys, kwargs in INDEX_AUDIT:
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
    metadata = metadata or {}
    return {
        'id': str(uuid.uuid4()),
        'penilaian_id': penilaian_id or metadata.get('penilaian_id'),
        'aksi': aksi,
        'kategori': kategori_aksi(aksi),
        'guru_id': metadata.get('guru_id'),
        'periode_id': metadata.get('periode_id'),
        'aktor_id': aktor.get('id'),
        'aktor_nama': aktor.get('full_name') or aktor.get('username'),
        'aktor_peran': aktor.get('active_role'),
        'metadata': metadata,
        'ip_address': request.client.host if request is not None and getattr(request, 'client', None) else None,
        'timestamp': sekarang.isoformat(),
        'waktu_urut': sekarang.isoformat(),
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
                                 penilaian_id: Optional[str] = None, perbarui_metadata: bool = False) -> None:
    """Satu entri per (aktor, aksi, tanggal WIB, kunci); kunjungan berikutnya menaikkan `jumlah`.
    `perbarui_metadata=True`: metadata diganti yang terbaru setiap kali (yang pertama disimpan di `metadata_awal`)."""
    try:
        doc = _dasar(aksi, aktor, metadata, penilaian_id, request)
        saring = {'aktor_id': doc['aktor_id'], 'aksi': aksi, 'tanggal': doc['tanggal'], 'kunci': kunci}
        selalu = {'terakhir': doc['timestamp'], 'waktu_urut': doc['timestamp'], 'ip_address': doc['ip_address']}
        if perbarui_metadata:
            selalu['metadata'] = doc['metadata']
        sekali = {k: v for k, v in doc.items() if k not in saring and k not in selalu}
        if perbarui_metadata:
            sekali['metadata_awal'] = doc['metadata']
        await db[KOLEKSI_AUDIT].update_one(saring, {'$setOnInsert': sekali, '$set': selalu, '$inc': {'jumlah': 1}},
                                           upsert=True)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[pkg_audit] gagal mencatat {aksi}: {e}")


def _identitas_lembar(lembar: Dict[str, Any]) -> Dict[str, Any]:
    return {'penilaian_id': lembar.get('id'), 'guru_id': lembar.get('guru_dinilai_id'), 'periode_id': lembar.get('periode_id'),
            'sk_id': lembar.get('sk_id'), 'penilai_id': lembar.get('penilai_id'), 'instrumen_id': lembar.get('instrumen_id')}


def checksum_isian(isian: Optional[Dict[str, Any]]) -> str:
    """SHA-256 isian lembar (JSON kanonis: kunci terurut, centang terurut) sebagai bukti isi yang dikunci."""
    kanonis = {k: {**(v or {}), 'centang': sorted((v or {}).get('centang') or [])} for k, v in (isian or {}).items()}
    return hashlib.sha256(json.dumps(kanonis, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()


async def catat_audit_draf(db, aktor: Optional[Dict[str, Any]], lembar: Dict[str, Any], baru: bool,
                           request=None) -> None:
    """Audit simpan draf lembar penilaian. Draf pertama mencatat `penilaian_mulai` (instrumen yang dipakai);
    autosave berikutnya digabung menjadi satu entri `penilaian_draf` per lembar per hari: `jumlah` simpan, progres
    terakhir di `metadata` dan progres saat simpan pertama hari itu di `metadata_awal`."""
    sub_diisi = sum(1 for v in (lembar.get('isian') or {}).values() if (v or {}).get('centang'))
    meta = {**_identitas_lembar(lembar), 'progres': lembar.get('progres'), 'sub_diisi': sub_diisi}
    if baru:
        await catat_audit_pkg(db, 'penilaian_mulai', aktor, meta, penilaian_id=lembar.get('id'), request=request)
    await catat_audit_pkg_harian(db, 'penilaian_draf', aktor, kunci=lembar.get('id') or '', metadata=meta, request=request,
                                 penilaian_id=lembar.get('id'), perbarui_metadata=True)


async def catat_audit_kirim(db, aktor: Optional[Dict[str, Any]], lembar: Dict[str, Any], request=None) -> None:
    """Audit kirim & kunci lembar: nilai resmi (jumlah, maks, capaian, level, predikat), waktu kunci, dan checksum
    isian yang dikunci sehingga perubahan data setelah penguncian dapat dideteksi."""
    meta = {**_identitas_lembar(lembar), 'progres': lembar.get('progres'),
            **{k: lembar.get(k) for k in ('nilai_akhir', 'nilai_maks', 'capaian_persen', 'level_capaian', 'predikat',
                                          'terkunci_pada')},
            'checksum_isian': checksum_isian(lembar.get('isian'))}
    await catat_audit_pkg(db, 'penilaian_kirim', aktor, meta, penilaian_id=lembar.get('id'), request=request)


def checksum_struktur(instrumen: Optional[Dict[str, Any]]) -> Optional[str]:
    """SHA-256 struktur instrumen (kompetensi, sub, bobot, indikator; JSON kanonis) sebagai sidik versi acuan."""
    if not instrumen:
        return None
    teks = json.dumps(instrumen.get('kompetensi') or [], sort_keys=True, ensure_ascii=False, separators=(',', ':'))
    return hashlib.sha256(teks.encode()).hexdigest()


def acuan_versi(instrumen: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Identitas versi instrumen acuan: id, versi template, revisi, revisi_dari, kecocokan resmi, sidik struktur."""
    if not instrumen:
        return None
    return {**{k: instrumen.get(k) for k in ('id', 'versi_template', 'revisi', 'revisi_dari', 'cocok_resmi')},
            'checksum_struktur': checksum_struktur(instrumen)}


def beda_instrumen(lama: Optional[Dict[str, Any]], baru: Optional[Dict[str, Any]]) -> Dict[str, List[str]]:
    """Kode sub-kompetensi yang ditambah, dihapus, dan diubah (nama/bobot/indikator) dari `lama` ke `baru`."""
    def per_sub(ins):
        return {s.get('kode'): s for k in (ins or {}).get('kompetensi') or [] for s in k.get('sub') or []}
    a, b = per_sub(lama), per_sub(baru)
    urut = lambda kode: [int(x) if x.isdigit() else x for x in str(kode).split('.')]  # noqa: E731
    return {'sub_ditambah': sorted(set(b) - set(a), key=urut), 'sub_dihapus': sorted(set(a) - set(b), key=urut),
            'sub_diubah': sorted((k for k in set(a) & set(b) if a[k] != b[k]), key=urut)}


async def _pemakaian_lembar(db, instrumen_id: Optional[str]) -> Optional[Dict[str, int]]:
    if not instrumen_id:
        return None
    from pkg_skema import KOLEKSI_PENILAIAN
    return {status: await db[KOLEKSI_PENILAIAN].count_documents({'instrumen_id': instrumen_id, 'status': status})
            for status in ('draf', 'terkunci')}


async def catat_audit_instrumen(db, aksi: str, aktor: Optional[Dict[str, Any]], baru: Dict[str, Any],
                                sebelumnya: Optional[Dict[str, Any]], metadata: Optional[Dict[str, Any]] = None,
                                request=None) -> None:
    """Audit perubahan instrumen & acuan versi (impor, ubah sub, penetapan acuan): versi acuan baru dan sebelumnya
    beserta sidik strukturnya, perbedaan sub-kompetensi, serta jumlah lembar (draf/terkunci) yang tetap memakai
    versi sebelumnya — lembar lama tidak ikut berubah."""
    ganti_versi = bool(sebelumnya) and sebelumnya.get('id') != baru.get('id')
    meta = {
        'instrumen_id': baru.get('id'), 'versi_template': baru.get('versi_template'), 'revisi': baru.get('revisi'),
        'acuan': acuan_versi(baru), 'acuan_sebelumnya': acuan_versi(sebelumnya),
        'beda': beda_instrumen(sebelumnya, baru) if sebelumnya else None,
        'lembar_versi_sebelumnya': await _pemakaian_lembar(db, sebelumnya.get('id')) if ganti_versi else None,
        **(metadata or {}),
    }
    await catat_audit_pkg(db, aksi, aktor, meta, request=request)


async def catat_cetak_template(db, aktor: Optional[Dict[str, Any]], jenis_template: str, format_berkas: str,
                               nama_berkas: str, versi_template: str, checksum_template: Optional[str],
                               periode_id: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None,
                               request=None, jenis_dokumen: Optional[str] = None, guru_id: Optional[str] = None,
                               mesin: Optional[str] = None, isi: Optional[bytes] = None) -> None:
    """Catat satu cetak/unduh dokumen (Excel atau PDF) dari template resmi: jejak audit (aksi cetak_template) dan
    riwayat unduhan (pkg_unduhan) dengan id yang sama (`audit_id`) — siapa, kapan, dokumen & guru, template &
    versi/checksum, mesin cetak (openpyxl/libreoffice/reportlab, alasan cadangan), format, nama, ukuran, dan SHA-256
    berkas hasil (bukti isi yang diunduh). Galat pencatatan hanya dicatat ke logger."""
    checksum_berkas = hashlib.sha256(isi).hexdigest() if isi is not None else None
    meta = {'jenis_dokumen': jenis_dokumen or jenis_template, 'jenis_template': jenis_template, 'format': format_berkas,
            'nama_berkas': nama_berkas, 'versi_template': versi_template, 'checksum_template': checksum_template,
            'periode_id': periode_id, 'guru_id': guru_id, 'mesin': mesin, 'checksum_berkas': checksum_berkas,
            'ukuran': len(isi) if isi is not None else None, **(metadata or {})}
    dasar = _dasar(AKSI_CETAK_TEMPLATE, aktor, meta, None, request)
    try:
        await db[KOLEKSI_AUDIT].insert_one(dict(dasar))
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[pkg_audit] gagal mencatat {AKSI_CETAK_TEMPLATE}: {e}")
    try:
        await db[KOLEKSI_UNDUHAN].insert_one({
            'id': dasar['id'], 'audit_id': dasar['id'], 'jenis': meta['jenis_dokumen'], 'jenis_template': jenis_template,
            'format': format_berkas, 'mesin': mesin, 'alasan_cadangan': meta.get('alasan_cadangan'),
            'periode_id': periode_id, 'guru_id': guru_id, 'nama_berkas': nama_berkas, 'ukuran': meta['ukuran'],
            'checksum_berkas': checksum_berkas, 'versi_template': versi_template, 'checksum_template': checksum_template,
            'aktor_id': dasar['aktor_id'], 'aktor_nama': dasar['aktor_nama'], 'aktor_peran': dasar['aktor_peran'],
            'ip_address': dasar['ip_address'], 'endpoint': meta.get('endpoint'), 'timestamp': dasar['timestamp'],
            'tanggal': dasar['tanggal'],
        })
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[pkg_audit] gagal mencatat riwayat unduhan: {e}")


async def catat_cetak_gagal(db, aktor: Optional[Dict[str, Any]], status: int, detail: Any, metadata: Dict[str, Any],
                            request=None) -> None:
    """Catat percobaan cetak/unduh yang ditolak atau gagal (403/409/422/503). Harian per aktor & kombinasi
    dokumen-status agar percobaan berulang tidak membanjiri log; `jumlah` menghitung percobaannya."""
    alasan = detail.get('alasan') if isinstance(detail, dict) else None
    pesan = detail.get('pesan') if isinstance(detail, dict) else str(detail)
    kunci = ':'.join(str(metadata.get(k) or '-') for k in ('jenis_dokumen', 'format', 'periode_id', 'guru_id')) + f':{status}'
    await catat_audit_pkg_harian(db, AKSI_CETAK_GAGAL, aktor, kunci=kunci, request=request,
                                 metadata={**metadata, 'status': status, 'alasan': alasan, 'pesan': (pesan or '')[:300]})


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
