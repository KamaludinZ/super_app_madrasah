"""Ujian Madrasah — berkas ujian (kisi-kisi & kartu soal) yang diunggah guru: daftar guru PJ, aturan format, deteksi isi
berkas, dan penyimpanan.

Dokumen `ujian_berkas` (skema di ujian_info.py): satu per ujian + jenis + jenjang + mapel; unggah ulang MENIMPA.

Guru PJ TIDAK ditugaskan lebih dulu: siapa pun GTK yang login boleh mengunggah, dan pada formulir unggah ia MEMILIH
nama guru PJ dari daftar guru aktif (daftar_guru_pj). Nama itulah yang tampil di monitoring ("nama PJ dari daftar guru
pengunggah").

Berkas disimpan di folder unggahan `ujian_berkas/` dengan nama acak `<id-berkas>-<acak>.<ext>` (bukan nama asli),
tidak pernah disajikan statis; isi kartu soal hanya dapat diunduh admin.
"""
import io
import os
import re
import secrets
import uuid
import zipfile
import logging
import time
from datetime import datetime
from typing import Any, Dict, Optional

from ujian import sekarang_wib
from models import ROLES
from penyimpanan import folder_unggahan
from ujian_info import BERKAS_MAKS_BITA, JENIS_BERKAS, KOLEKSI_BERKAS, SUBFOLDER_BERKAS, jalur_unggahan, mapel_jenjang, nama_mapel

logger = logging.getLogger('matsandatama')


MIME = {'pdf': 'application/pdf', 'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}
# Format yang diterima tiap jenis (sama dengan ATURAN_BERKAS di frontend/src/lib/ujianBerkas.js).
FORMAT_JENIS = {'kisi_kisi': ('pdf',), 'kartu_soal': ('pdf', 'docx')}
LABEL_JENIS = {'kisi_kisi': 'Kisi-kisi', 'kartu_soal': 'Kartu soal'}
NAMA_FILE_MAKS = 150

INDEX_BERKAS_UJIAN = [
    # ujian_berkas (unik per ujian+jenis+jenjang+mapel) dibuat migrasi ujian_info_publik; dipastikan ulang di sini.
    (KOLEKSI_BERKAS, [('ujian_id', 1), ('jenis', 1), ('jenjang', 1), ('mapel', 1)], {'unique': True, 'name': 'berkas_unik_mapel'}),
    (KOLEKSI_BERKAS, [('ujian_id', 1), ('updated_at', -1)], {}),
]


async def pastikan_index_berkas_ujian(db) -> None:
    for koleksi, keys, opsi in INDEX_BERKAS_UJIAN:
        await db[koleksi].create_index(keys, **opsi)


# ---- Format & isi berkas ----
def deteksi_format(isi: bytes) -> Optional[str]:
    """Format sebenarnya dari ISI berkas (bukan nama/MIME kiriman): 'pdf' (diawali %PDF-), 'docx' (arsip ZIP berisi
    word/document.xml), atau None. Berkas yang hanya diganti namanya (mis. foto .jpg -> .pdf) menghasilkan None."""
    if not isi:
        return None
    if isi[:5] == b'%PDF-':
        return 'pdf'
    if isi[:4] == b'PK\x03\x04':
        try:
            with zipfile.ZipFile(io.BytesIO(isi)) as z:
                nama = set(z.namelist())
            return 'docx' if 'word/document.xml' in nama and '[Content_Types].xml' in nama else None
        except (zipfile.BadZipFile, ValueError, OSError):
            return None
    return None


# Konten aktif yang ditolak (terbaik-upaya): makro VBA di DOCX (biasanya .docm yang diganti nama) dan aksi otomatis /
# skrip / berkas tersemat di PDF. Kisi-kisi dibagikan ke siswa dan kartu soal dibuka admin, jadi keduanya harus "pasif".
_PDF_AKTIF = re.compile(rb'/(JavaScript|JS|Launch|EmbeddedFile|OpenAction\s*<<[^>]*/S\s*/JavaScript)\b')


def galat_konten_aktif(ext: str, isi: bytes) -> Optional[str]:
    if ext == 'docx':
        try:
            with zipfile.ZipFile(io.BytesIO(isi)) as z:
                if any(n.lower().endswith('vbaproject.bin') or n.lower().endswith('.bin') and 'vba' in n.lower() for n in z.namelist()):
                    return 'Berkas DOCX berisi makro, tidak diterima. Simpan ulang sebagai "Word Document (.docx)" tanpa makro.'
        except (zipfile.BadZipFile, ValueError, OSError):
            return None
    if ext == 'pdf' and _PDF_AKTIF.search(isi):
        return 'PDF berisi skrip, aksi otomatis, atau berkas tersemat sehingga tidak diterima. Ekspor ulang sebagai PDF biasa (mis. "Simpan sebagai PDF").'
    return None


def galat_berkas(jenis: str, nama_file: str, isi: bytes) -> Optional[str]:
    """Validasi server -> pesan galat yang jelas (bahasa manusia) atau None. Ukuran dicek dulu, lalu ekstensi, lalu ISI."""
    label = LABEL_JENIS.get(jenis, 'Berkas')
    boleh = FORMAT_JENIS.get(jenis)
    if not boleh:
        return 'Jenis berkas tidak dikenal.'
    if not isi:
        return 'Berkas kosong. Pilih berkas yang benar.'
    if len(isi) > BERKAS_MAKS_BITA:
        return f'Ukuran berkas {len(isi) / (1024 * 1024):.1f} MB melebihi batas 10 MB.'.replace('.', ',', 1)
    teks_format = ' atau '.join(f.upper() for f in boleh)
    ext = os.path.splitext(str(nama_file or ''))[1].lower().lstrip('.')
    if ext not in boleh:
        return f'{label} harus berformat {teks_format}.'
    asli = deteksi_format(isi)
    if asli != ext:
        return f'Isi berkas bukan {ext.upper()} yang sah (mungkin hanya diganti namanya). Simpan ulang sebagai {ext.upper()} lalu unggah lagi.'
    return galat_konten_aktif(ext, isi)


def rapikan_nama_file(nama: str, ext: str) -> str:
    """Nama asli untuk ditampilkan/diunduh: tanpa jalur & karakter kendali, maks NAMA_FILE_MAKS, ekstensi sesuai format."""
    dasar = os.path.basename(str(nama or '').replace('\\', '/'))
    dasar = ''.join(c for c in dasar if c.isprintable() and c not in '<>:"|?*').strip() or f'berkas.{ext}'
    akar, e = os.path.splitext(dasar)
    if e.lower().lstrip('.') != ext:
        akar = dasar
    akar = akar[: NAMA_FILE_MAKS - len(ext) - 1].strip() or 'berkas'
    return f'{akar}.{ext}'


def nama_berkas_disk(berkas_id: str, ext: str) -> str:
    """Nama di folder unggahan: id + akhiran acak (nama lama tidak dapat ditebak setelah diganti)."""
    return f'{berkas_id}-{secrets.token_hex(8)}.{ext}'


# ---- Dokumen ----
# ---- Daftar guru PJ (pilihan di formulir unggah) ----
# Peran guru yang dapat dipilih sebagai PJ: semua peran guru_* dan wali kelas (akun aktif).
PERAN_GURU_PJ = tuple(r for r in ROLES if r.startswith('guru')) + ('wali_kelas',)


def _nama_akun(u: Dict[str, Any]) -> str:
    return u.get('full_name') or u.get('username') or '-'


async def daftar_guru_pj(db) -> list:
    """Guru aktif yang dapat dipilih sebagai PJ berkas: [{id, nama}] urut nama."""
    docs = await db.users.find({'is_active': True, 'roles': {'$in': list(PERAN_GURU_PJ)}},
                               {'_id': 0, 'id': 1, 'full_name': 1, 'username': 1, 'roles': 1, 'is_active': 1}).to_list(2000)
    guru = [{'id': d['id'], 'nama': _nama_akun(d)} for d in docs
            if d.get('id') and d.get('is_active') and any(r in PERAN_GURU_PJ for r in (d.get('roles') or []))]
    return sorted(guru, key=lambda g: g['nama'].lower())


async def guru_pj_sah(db, guru_id: Optional[str]) -> Optional[Dict[str, Any]]:
    """Akun guru aktif yang dipilih sebagai PJ -> {id, full_name}, atau None bila tidak ada di daftar guru."""
    if not guru_id or len(guru_id) > 64:
        return None
    u = await db.users.find_one({'id': guru_id}, {'_id': 0})
    if not u or not u.get('is_active') or not any(r in PERAN_GURU_PJ for r in (u.get('roles') or [])):
        return None
    return {'id': u['id'], 'full_name': _nama_akun(u)}


def dokumen_berkas(lama: Optional[Dict[str, Any]], ujian_id: str, jenis: str, jenjang: int, mapel: str, nama_file: str, ext: str,
                   ukuran: int, pj: Dict[str, Any], nama_disk: str, waktu: datetime = None) -> Dict[str, Any]:
    """Dokumen ujian_berkas setelah unggah. Unggah ulang memakai id yang sama (menimpa) dan mempertahankan jumlah_unduh."""
    if jenis not in JENIS_BERKAS:
        raise ValueError('Jenis berkas tidak dikenal')
    return {
        'id': (lama or {}).get('id') or str(uuid.uuid4()), 'ujian_id': ujian_id, 'jenis': jenis, 'jenjang': jenjang, 'mapel': mapel,
        'guru_pj_id': pj.get('id'), 'guru_pj_nama': pj.get('full_name') or pj.get('username') or pj.get('nama'),
        'nama_file': nama_file, 'nama_berkas': nama_disk, 'mime_type': MIME[ext], 'ukuran_byte': ukuran, 'status': 'terkirim',
        'updated_at': (waktu or sekarang_wib()).isoformat(), 'jumlah_unduh': int((lama or {}).get('jumlah_unduh') or 0),
    }


def ringkas_berkas_pj(b: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Berkas untuk halaman unggah guru PJ (tanpa lokasi berkas di disk) — sama dengan tipe Berkas di frontend."""
    if not b:
        return None
    return {k: b.get(k) for k in ('id', 'jenis', 'jenjang', 'mapel', 'nama_file', 'ukuran_byte', 'mime_type', 'guru_pj_id', 'guru_pj_nama',
                                  'updated_at')}


def judul_tugas(jenjang: int, mapel: str) -> str:
    return f'{nama_mapel(mapel)} Kelas {jenjang}'


# ---- Berkas yatim ----
UMUR_YATIM_DETIK = 60 * 60  # berkas lebih muda dari ini mungkin sedang diunggah — dibiarkan


async def bersihkan_berkas_yatim(db, sekarang: float = None, dry_run: bool = False) -> Dict[str, Any]:
    """Hapus berkas di folder ujian_berkas yang tidak dirujuk dokumen ujian_berkas mana pun (sisa server mati di antara
    menulis berkas & mencatat DB, atau sisa unggah ulang) beserta berkas sementara `.sedang`, bila umurnya > 1 jam.
    Penting untuk kartu soal: tidak ada salinan rahasia tak terlacak. -> { dihapus, dibiarkan, dry_run }"""
    folder = folder_unggahan(SUBFOLDER_BERKAS)
    dirujuk = {d.get('nama_berkas') for d in await db[KOLEKSI_BERKAS].find({}, {'_id': 0, 'nama_berkas': 1}).to_list(20000)}
    kini = sekarang if sekarang is not None else time.time()
    dihapus, dibiarkan = [], 0
    for nama in os.listdir(folder):
        jalur = os.path.join(folder, nama)
        if not os.path.isfile(jalur) or (nama in dirujuk and not nama.endswith('.sedang')):
            continue
        if kini - os.path.getmtime(jalur) < UMUR_YATIM_DETIK:
            dibiarkan += 1
            continue
        if not dry_run:
            try:
                os.remove(jalur)
            except OSError as e:
                logger.warning(f'[ujian_berkas] gagal menghapus berkas yatim {nama}: {e}')
                continue
        dihapus.append(nama)
    if dihapus:
        logger.info(f'[ujian_berkas] {len(dihapus)} berkas yatim {"akan " if dry_run else ""}dihapus')
    return {'dihapus': len(dihapus), 'dibiarkan': dibiarkan, 'dry_run': dry_run}


# ---- Kumpulan berkas satu jenjang (bahan bundel ZIP admin) ----
def _aman_zip(teks: str) -> str:
    return ''.join(c for c in str(teks or '') if c.isprintable() and c not in '\\/:*?"<>|').strip()


def nama_entri_zip(urutan: int, nama_mapel_: str, nama_file: str, ext: str) -> str:
    """Nama berkas di dalam ZIP: "03 Matematika - <nama asli>.pdf" — urut mapel baku, unik, tanpa jalur."""
    akar = os.path.splitext(_aman_zip(os.path.basename(str(nama_file or '').replace('\\', '/'))))[0][:80].strip()
    return f'{urutan:02d} {_aman_zip(nama_mapel_)}{f" - {akar}" if akar else ""}.{ext}'


async def kumpulan_berkas_jenjang(db, ujian_id: str, jenis: str, jenjang: int) -> Dict[str, Any]:
    """Berkas satu jenis untuk satu jenjang, urut mapel baku aktif -> { ada: [{ berkas, jalur, nama_zip }],
    kosong: [{ kode, nama }] (belum mengirim), hilang: [{ kode, nama }] (tercatat tetapi berkasnya tidak ada di disk) }.
    Hanya berkas berstatus terkirim; berkas yang hilang di disk tidak dimasukkan ZIP dan dilaporkan."""
    if jenis not in JENIS_BERKAS:
        raise ValueError(f'Jenis berkas tidak dikenal: {jenis}')
    mapel = await mapel_jenjang(db, jenjang)
    docs = await db[KOLEKSI_BERKAS].find({'ujian_id': ujian_id, 'jenis': jenis, 'jenjang': jenjang, 'status': 'terkirim'}, {'_id': 0}).to_list(100)
    peta = {d.get('mapel'): d for d in docs}
    ada, kosong, hilang = [], [], []
    for i, m in enumerate(mapel, start=1):
        d = peta.get(m['kode'])
        if not d:
            kosong.append({'kode': m['kode'], 'nama': m['nama']})
            continue
        jalur = jalur_unggahan(SUBFOLDER_BERKAS, d['nama_berkas']) if d.get('nama_berkas') else None
        if not jalur or not os.path.isfile(jalur):
            hilang.append({'kode': m['kode'], 'nama': m['nama']})
            continue
        ext = os.path.splitext(d['nama_berkas'])[1].lstrip('.').lower() or 'pdf'
        ada.append({'berkas': d, 'jalur': jalur, 'nama_zip': nama_entri_zip(i, m['nama'], d.get('nama_file'), ext)})
    return {'ada': ada, 'kosong': kosong, 'hilang': hilang}


def teks_keterangan_zip(jenis: str, jenjang: int, nama_ujian: str, kumpulan: Dict[str, Any], waktu: datetime = None) -> str:
    """Isi KETERANGAN.txt di dalam ZIP: ringkasan isi & mapel yang belum mengirim / berkasnya hilang."""
    label = LABEL_JENIS.get(jenis, jenis)
    baris = [f'{label} Kelas {jenjang} — {nama_ujian or "-"}',
             f'Dibuat: {(waktu or sekarang_wib()).strftime("%d-%m-%Y %H:%M")} WIB', '',
             f'Berisi {len(kumpulan["ada"])} mapel:'] + [f'  - {x["nama_zip"]}' for x in kumpulan['ada']]
    if kumpulan['kosong']:
        baris += ['', f'Belum mengirim ({len(kumpulan["kosong"])} mapel):'] + [f'  - {m["nama"]}' for m in kumpulan['kosong']]
    if kumpulan['hilang']:
        baris += ['', 'Tercatat tetapi berkas tidak ditemukan di server (minta PJ mengunggah ulang):'] + [f'  - {m["nama"]}' for m in kumpulan['hilang']]
    return '\r\n'.join(baris) + '\r\n'
