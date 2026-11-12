"""Izin Kamad: izin keluar GTK & satpam yang diputuskan kepala madrasah.

Koleksi `izin_kamad` sengaja terpisah dari `gtk_izin` (gtk_izin dipakai _build_izin_checker untuk
menghitung hari izin pada rekap kehadiran GTK; izin keluar beberapa jam tidak boleh ikut terhitung).

Dokumen izin_kamad:
    id                    uuid (unik)
    pengaju_id            users.id pengaju
    pengaju_nama          nama pengaju saat mengajukan (untuk papan pantau)
    pengaju_peran         peran aktif saat mengajukan
    keperluan             teks bebas
    tanggal               'YYYY-MM-DD' (satu tanggal WIB)
    jam_mulai, jam_selesai 'HH:MM' WIB
    status                menunggu | disetujui | ditolak | dibatalkan
    alasan_penolakan      wajib bila ditolak; terlihat oleh pengaju
    diputuskan_oleh       users.id kepala madrasah yang memutuskan
    diputuskan_oleh_nama  nama pemutus
    diputuskan_pada       waktu keputusan (ISO ber-zona)
    dibuat_pada, diperbarui_pada  waktu ISO ber-zona

Dokumen izin_kamad_catatan (catatan satpam pada satu izin; hanya dibaca kepala madrasah & kepala TU):
    id, izin_id, penulis_id, penulis_nama, isi, dibuat_pada
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable

from pydantic import BaseModel, Field, field_validator

from core import GURU_MAPEL_ROLES

# Peran yang membuka dashboard satpam (admin selalu lolos require_role).
PERAN_DASHBOARD_SATPAM = ('satpam',)
# Pembaca papan izin disetujui hari ini: satpam, kepala tata usaha, kepala madrasah/kepala sekolah.
PERAN_PAPAN_IZIN = ('satpam', 'kepala_tata_usaha', 'kepala_sekolah')
# Pengaju izin: kepala tata usaha, guru mata pelajaran, tenaga kependidikan, dan satpam.
PERAN_PENGAJU_IZIN = ('kepala_tata_usaha', *GURU_MAPEL_ROLES, 'tenaga_kependidikan', 'satpam')
BATAS_PENGAJUAN_SAYA = 200
BATAS_RIWAYAT_KEPUTUSAN = 500
# Pemutus izin (menyetujui/menolak) dan boleh melihat semua izin.
PERAN_PEMUTUS_IZIN = ('kepala_sekolah',)
# Catatan satpam: ditulis satpam, HANYA dibaca kepala madrasah/kepala sekolah & kepala tata usaha.
PERAN_PENULIS_CATATAN = ('satpam',)
PERAN_PEMBACA_CATATAN = ('kepala_sekolah', 'kepala_tata_usaha')
CATATAN_MIN = 3
CATATAN_MAKS = 500

KOLEKSI_IZIN = 'izin_kamad'
KOLEKSI_CATATAN = 'izin_kamad_catatan'

STATUS_MENUNGGU = 'menunggu'
STATUS_DISETUJUI = 'disetujui'
STATUS_DITOLAK = 'ditolak'
STATUS_DIBATALKAN = 'dibatalkan'
STATUS_IZIN = (STATUS_MENUNGGU, STATUS_DISETUJUI, STATUS_DITOLAK, STATUS_DIBATALKAN)

INDEX_IZIN_KAMAD = [
    (KOLEKSI_IZIN, [('id', 1)], {'unique': True}),
    # Pengajuan Saya: milik pengaju, terbaru dulu.
    (KOLEKSI_IZIN, [('pengaju_id', 1), ('dibuat_pada', -1)], {}),
    # Papan izin hari ini (status disetujui + tanggal) & daftar menunggu kepala madrasah.
    (KOLEKSI_IZIN, [('status', 1), ('tanggal', 1), ('jam_mulai', 1)], {}),
    # Riwayat keputusan kepala madrasah: disetujui/ditolak, keputusan terbaru dulu.
    (KOLEKSI_IZIN, [('status', 1), ('diputuskan_pada', -1)], {}),
    (KOLEKSI_CATATAN, [('id', 1)], {'unique': True}),
    (KOLEKSI_CATATAN, [('izin_id', 1), ('dibuat_pada', 1)], {}),
]

WIB_TZ = timezone(timedelta(hours=7))

KEPERLUAN_MAKS = 300  # sama dengan KEPERLUAN_MAKS di frontend/src/lib/izinKamad.js
POLA_TANGGAL = r'^\d{4}-\d{2}-\d{2}$'
POLA_JAM = r'^([01]\d|2[0-3]):[0-5]\d$'


class IzinPengajuanIn(BaseModel):
    """Isian pengajuan izin (POST /izin-kamad): satu tanggal WIB + rentang jam WIB."""
    keperluan: str = Field(..., min_length=1, max_length=KEPERLUAN_MAKS)
    tanggal: str = Field(..., pattern=POLA_TANGGAL, description="YYYY-MM-DD (WIB)")
    jam_mulai: str = Field(..., pattern=POLA_JAM, description="HH:MM (WIB)")
    jam_selesai: str = Field(..., pattern=POLA_JAM, description="HH:MM (WIB)")

    @field_validator('keperluan', mode='before')
    @classmethod
    def _rapikan_keperluan(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator('tanggal')
    @classmethod
    def _tanggal_kalender(cls, v):
        datetime.strptime(v, '%Y-%m-%d')  # tolak 2026-02-30 dsb.
        return v


# Field izin yang dikirim ke klien (tanpa _id Mongo); sama dengan tipe Izin di frontend/src/lib/izinKamad.js.
FIELD_IZIN = (
    'id', 'pengaju_id', 'pengaju_nama', 'pengaju_peran', 'keperluan', 'tanggal', 'jam_mulai', 'jam_selesai',
    'status', 'alasan_penolakan', 'diputuskan_oleh_nama', 'diputuskan_pada', 'dibuat_pada',
)


def sekarang_wib() -> datetime:
    return datetime.now(WIB_TZ)


def hari_ini_wib(waktu: datetime = None) -> str:
    """Tanggal kalender WIB ('YYYY-MM-DD'); `waktu` ber-zona apa pun dikonversi ke WIB dulu."""
    return (waktu or sekarang_wib()).astimezone(WIB_TZ).strftime('%Y-%m-%d')


def ringkas_izin(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Izin untuk klien: field kontrak saja (tanpa _id, tanpa id pemutus)."""
    return {k: doc.get(k) for k in FIELD_IZIN}


async def pastikan_index_izin_kamad(db) -> None:
    for koleksi, keys, opsi in INDEX_IZIN_KAMAD:
        await db[koleksi].create_index(keys, **opsi)


def jam_wib(waktu: datetime = None) -> str:
    """'HH:MM' WIB."""
    return (waktu or sekarang_wib()).astimezone(WIB_TZ).strftime('%H:%M')


def waktu_izin(doc: Dict[str, Any], jam: str) -> str:
    """Keadaan izin hari ini menurut jam 'HH:MM': 'akan_datang' | 'berlangsung' | 'selesai'.

    Hanya informasi (satpam tidak menandai jam keluar/kembali); sama dengan waktuIzin di web.
    """
    if jam < (doc.get('jam_mulai') or ''):
        return 'akan_datang'
    if jam >= (doc.get('jam_selesai') or ''):
        return 'selesai'
    return 'berlangsung'


def hitung_ringkasan_satpam(papan: Iterable[Dict[str, Any]], saya_menunggu: int, tanggal: str, jam: str) -> Dict[str, Any]:
    """Ringkasan dashboard satpam dari izin disetujui hari ini + jumlah pengajuan sendiri yang menunggu."""
    hitung = {'berlangsung': 0, 'akan_datang': 0, 'selesai': 0}
    total = 0
    for doc in papan:
        hitung[waktu_izin(doc, jam)] += 1
        total += 1
    return {'tanggal': tanggal, 'jam': jam, 'izin_hari_ini': total, **hitung, 'saya_menunggu': saya_menunggu}


def boleh_lihat_izin(user: Dict[str, Any], doc: Dict[str, Any]) -> bool:
    """Detail izin (hanya-lihat): pengaju melihat miliknya; kepala madrasah & admin melihat semua;
    pembaca papan (satpam, kepala TU) hanya izin yang sudah disetujui."""
    if doc.get('pengaju_id') == user.get('id'):
        return True
    peran = user.get('active_role')
    if 'admin' in (user.get('roles') or []) or peran in PERAN_PEMUTUS_IZIN:
        return True
    return peran in PERAN_PAPAN_IZIN and doc.get('status') == STATUS_DISETUJUI


def alasan_catatan_tidak_sah(isi: str) -> str:
    """Pesan galat isi catatan, '' bila sah (sama dengan validasiCatatan di web)."""
    n = len((isi or '').strip())
    if n < CATATAN_MIN:
        return f"Catatan minimal {CATATAN_MIN} karakter."
    if n > CATATAN_MAKS:
        return f"Catatan maksimal {CATATAN_MAKS} karakter."
    return ''


def ringkas_catatan(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {k: doc.get(k) for k in ('id', 'izin_id', 'penulis_nama', 'isi', 'dibuat_pada')}


def dokumen_izin_baru(user: Dict[str, Any], isi: IzinPengajuanIn, waktu: datetime = None) -> Dict[str, Any]:
    """Dokumen izin_kamad baru berstatus menunggu milik pengguna login (nama & peran aktif disalin)."""
    t = (waktu or sekarang_wib()).isoformat()
    return {
        'id': str(uuid.uuid4()),
        'pengaju_id': user['id'],
        'pengaju_nama': user.get('full_name') or user.get('username') or '-',
        'pengaju_peran': user.get('active_role'),
        'keperluan': isi.keperluan,
        'tanggal': isi.tanggal,
        'jam_mulai': isi.jam_mulai,
        'jam_selesai': isi.jam_selesai,
        'status': STATUS_MENUNGGU,
        'alasan_penolakan': None,
        'diputuskan_oleh': None,
        'diputuskan_oleh_nama': None,
        'diputuskan_pada': None,
        'dibuat_pada': t,
        'diperbarui_pada': t,
    }


DURASI_MIN_MENIT = 15  # sama dengan DURASI_MIN_MENIT di frontend/src/lib/izinKamad.js


def _menit(hhmm: str) -> int:
    j, m = hhmm.split(':')
    return int(j) * 60 + int(m)


def alasan_waktu_tidak_sah(tanggal: str, jam_mulai: str, jam_selesai: str, hari_ini: str, jam: str) -> Dict[str, str]:
    """Galat waktu per isian (kosong = sah); sama dengan validasiWaktuIzin di web/aplikasi.
    Tanggal hari ini atau ke depan; jam selesai setelah jam mulai (minimal 15 menit);
    izin untuk hari ini tidak boleh sudah berakhir."""
    galat: Dict[str, str] = {}
    if tanggal < hari_ini:
        galat['tanggal'] = 'Tanggal izin hanya boleh hari ini atau ke depan'
    durasi = _menit(jam_selesai) - _menit(jam_mulai)
    if durasi <= 0:
        galat['jam_selesai'] = 'Jam selesai harus setelah jam mulai'
    elif durasi < DURASI_MIN_MENIT:
        galat['jam_selesai'] = f'Izin minimal {DURASI_MIN_MENIT} menit'
    elif tanggal == hari_ini and jam_selesai <= jam:
        galat['jam_selesai'] = f'Jam selesai sudah lewat (sekarang pukul {jam} WIB)'
    return galat


def jam_bertumpuk(a: Dict[str, Any], b: Dict[str, Any]) -> bool:
    """Dua izin pada tanggal yang sama dengan rentang jam beririsan."""
    return a.get('tanggal') == b.get('tanggal') and a['jam_mulai'] < b['jam_selesai'] and b['jam_mulai'] < a['jam_selesai']


ALASAN_TOLAK_MIN = 5    # sama dengan ALASAN_TOLAK_MIN di web & aplikasi
ALASAN_TOLAK_MAKS = 300


class TolakIn(BaseModel):
    """Isian penolakan izin: alasan wajib (terlihat oleh pengaju)."""
    alasan: str = Field(..., min_length=ALASAN_TOLAK_MIN, max_length=ALASAN_TOLAK_MAKS)

    @field_validator('alasan', mode='before')
    @classmethod
    def _rapikan(cls, v):
        return v.strip() if isinstance(v, str) else v


BATAS_PAPAN = 1000


def query_disetujui_pada(tanggal: str) -> Dict[str, Any]:
    """Kriteria papan pantau: izin berstatus disetujui pada tanggal WIB tertentu."""
    return {'status': STATUS_DISETUJUI, 'tanggal': tanggal}


async def izin_disetujui_pada(db, tanggal: str) -> list:
    """Izin disetujui pada `tanggal` (field kontrak saja), urut jam mulai lalu nama pengaju.
    Satu-satunya sumber data papan pantau (satpam, kepala TU, kepala madrasah) & ringkasan satpam."""
    proyeksi = {'_id': 0, **{k: 1 for k in FIELD_IZIN}}
    docs = await db[KOLEKSI_IZIN].find(query_disetujui_pada(tanggal), proyeksi).to_list(BATAS_PAPAN)
    docs.sort(key=lambda d: (d.get('jam_mulai') or '', (d.get('pengaju_nama') or '').lower()))
    return [ringkas_izin(d) for d in docs]


class CatatanIn(BaseModel):
    """Isian catatan satpam (POST /izin-kamad/{id}/catatan). Panjang divalidasi alasan_catatan_tidak_sah
    agar galatnya berupa pesan berbahasa Indonesia (400), sama dengan validasiCatatan di web/aplikasi."""
    isi: str = Field(..., max_length=CATATAN_MAKS * 4)  # batas kasar; batas sebenarnya dicek setelah strip


def dokumen_catatan_baru(izin_id: str, user: Dict[str, Any], isi: str, waktu: datetime = None) -> Dict[str, Any]:
    """Dokumen izin_kamad_catatan baru: menempel pada izin, penulis = pengguna login (satpam)."""
    return {
        'id': str(uuid.uuid4()),
        'izin_id': izin_id,
        'penulis_id': user['id'],
        'penulis_nama': user.get('full_name') or user.get('username') or '-',
        'isi': isi.strip(),
        'dibuat_pada': (waktu or sekarang_wib()).isoformat(),
    }
