"""Ujian Madrasah (UTS/UAS): skema, aturan murni, dan akses modul ujian.

Semua data ujian terikat pada tahun pelajaran + semester. Beranda hanya menampilkan ujian semester konteks lihat
pengguna; ujian semester lalu menjadi arsip (tetap tersimpan, dibuka lewat Arsip Semester Lalu).

Dokumen `ujian`:
    id                      uuid (unik)
    jenis                   'UTS' | 'UAS'
    nama                    mis. "ASAS Ganjil 2026/2027"
    semester_id             semesters.id tempat ujian berlangsung
    semester_nama           nama semester saat dibuat (Ganjil/Genap)
    academic_year_id        academic_years.id
    tahun_pelajaran         nama tahun pelajaran saat dibuat ('2026/2027')
    mulai, selesai          'YYYY-MM-DD' (WIB)
    dibuat_oleh, dibuat_oleh_nama, dibuat_pada, diperbarui_pada

Dokumen `panitia_ujian` (satu dokumen per jabatan per ujian):
    id, ujian_id, jabatan ('penanggung_jawab'|'ketua'|'sekretaris'|'bendahara'),
    user_id, nama, nip, peran      (salinan identitas GTK saat ditetapkan)
    ditetapkan_oleh, ditetapkan_oleh_nama, ditetapkan_pada
    Unik: (ujian_id, jabatan) dan (ujian_id, user_id) — satu orang satu jabatan per ujian.

Dokumen `formulir_ujian` (pengaturan formulir daftar hadir & berita acara, satu per ujian; diatur pada fase 2):
    ujian_id (unik), aktif, jam_buka, jam_tutup, ...
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from pkg_identitas import nip_akun

KOLEKSI_UJIAN = 'ujian'
KOLEKSI_PANITIA = 'panitia_ujian'
KOLEKSI_FORMULIR = 'formulir_ujian'
KOLEKSI_RUANG = 'ruang_ujian'
KOLEKSI_PESERTA = 'peserta_ruang'

JENIS_UJIAN = ('UTS', 'UAS')
STATUS_FORMULIR = ('tertutup', 'dibuka', 'selesai')
NAMA_JENIS = {'UTS': 'Asesmen Sumatif Tengah Semester', 'UAS': 'Asesmen Sumatif Akhir Semester'}

# Sama dengan PERAN_PENGELOLA_UJIAN / PERAN_PIMPINAN_UJIAN di frontend/src/lib/ujian.js.
# Pengelola (membuat ujian, menyusun panitia, ruang, formulir): admin saja, sesuai alur PRD "Admin menyusun ...".
# Pimpinan/pemantau: kepala madrasah & waka kurikulum (daftar hadir, berita acara, cetak, arsip).
PERAN_PENGELOLA_UJIAN = ('admin',)
PERAN_PIMPINAN_UJIAN = ('kepala_sekolah', 'waka_kurikulum')
# Peran non-GTK tidak pernah menjadi panitia (sama dengan PERAN_NON_GTK di frontend/src/lib/menuUmum.js).
PERAN_BUKAN_PANITIA = ('siswa', 'kelas', 'orang_tua', 'alumni', 'satpam')

JABATAN_PANITIA = ('penanggung_jawab', 'ketua', 'sekretaris', 'bendahara')
LABEL_JABATAN = {
    'penanggung_jawab': 'Penanggung Jawab',
    'ketua': 'Ketua Panitia',
    'sekretaris': 'Sekretaris Panitia',
    'bendahara': 'Bendahara Panitia',
}

# Katalog sub-menu modul ujian (sama dengan MENU_UJIAN & AKSES_MENU_UJIAN di frontend/src/lib/ujian.js).
MENU_UJIAN = (
    ('panitia', 'Kepanitiaan', '/ujian/panitia', 'Susun panitia UTS/UAS dari akun GTK'),
    ('ruang', 'Ruang & Peserta', '/ujian/ruang', 'Ruang ujian, peserta, dan nomor peserta'),
    ('pengawas', 'Guru Pengawas', '/ujian/pengawas', 'Master pilihan guru pengawas'),
    ('formulir', 'Pengaturan Formulir', '/ujian/formulir', 'Jendela waktu & template cetak'),
    ('tautan_publik', 'Tautan Publik', '/ujian/tautan-publik', 'Info ujian siswa & monitoring pengumpulan soal'),
    ('info_ujian', 'Info Ujian', '/ujian/info-ujian', 'Tata tertib & panduan CBT untuk siswa'),
    ('berkas_soal', 'Berkas Soal', '/ujian/berkas-soal', 'Status kisi-kisi & kartu soal, PJ, unduh ZIP'),
    ('audit_publik', 'Jejak Audit Publik', '/ujian/audit-publik', 'Riwayat akses tautan & unduhan berkas'),
    ('daftar_hadir', 'Daftar Hadir', '/ujian/daftar-hadir', 'Pantau kehadiran, izin & sakit'),
    ('berita_acara', 'Berita Acara', '/ujian/berita-acara', 'Berita acara pengawas per ruang'),
    ('cetak', 'Cetak Dokumen', '/ujian/cetak', 'Daftar hadir & berita acara per jenjang'),
    ('kartu_peserta', 'Kartu Peserta', '/ujian/kartu-peserta', 'Cetak kartu peserta per ruang · A4'),
    ('kartu_meja', 'Kartu Meja', '/ujian/kartu-meja', 'Cetak kartu meja peserta per ruang · A4'),
    ('arsip', 'Arsip Administrasi', '/ujian/arsip', 'Dokumen ujian tercetak · akses terbatas'),
    ('nilai', 'Nilai UAS', '/ujian/nilai', 'Template & impor nilai UAS'),
)
AKSES_MENU_UJIAN = {
    'panitia': {'pimpinan': False, 'jabatan': ()},
    'ruang': {'pimpinan': False, 'jabatan': ('ketua', 'sekretaris')},
    'pengawas': {'pimpinan': False, 'jabatan': ('ketua', 'sekretaris')},
    'formulir': {'pimpinan': False, 'jabatan': ('ketua', 'sekretaris')},
    # Tautan publik: pimpinan & ketua/sekretaris melihat; mengubah (buka/tutup, jendela, ganti token) admin saja.
    'tautan_publik': {'pimpinan': True, 'jabatan': ('ketua', 'sekretaris')},
    # Info ujian (tata tertib & panduan CBT halaman siswa): pemantau melihat; mengisi admin saja.
    'info_ujian': {'pimpinan': True, 'jabatan': ('ketua', 'sekretaris')},
    # Berkas soal: pimpinan & ketua/sekretaris memantau status; isi kartu soal (unduh) admin saja.
    'berkas_soal': {'pimpinan': True, 'jabatan': ('ketua', 'sekretaris')},
    'audit_publik': {'pimpinan': True, 'jabatan': ('ketua', 'sekretaris')},
    'daftar_hadir': {'pimpinan': True, 'jabatan': JABATAN_PANITIA},
    'berita_acara': {'pimpinan': True, 'jabatan': JABATAN_PANITIA},
    'cetak': {'pimpinan': True, 'jabatan': JABATAN_PANITIA},
    'kartu_peserta': {'pimpinan': True, 'jabatan': JABATAN_PANITIA},
    'kartu_meja': {'pimpinan': True, 'jabatan': JABATAN_PANITIA},
    'arsip': {'pimpinan': True, 'jabatan': ('ketua', 'sekretaris')},
    'nilai': {'pimpinan': False, 'jabatan': ('ketua', 'sekretaris')},
}

INDEX_UJIAN = [
    (KOLEKSI_UJIAN, [('id', 1)], {'unique': True}),
    # Beranda (semester aktif) & arsip semester lalu, urut tanggal mulai.
    (KOLEKSI_UJIAN, [('semester_id', 1), ('mulai', 1)], {}),
    (KOLEKSI_PANITIA, [('id', 1)], {'unique': True}),
    (KOLEKSI_PANITIA, [('ujian_id', 1), ('jabatan', 1)], {'unique': True, 'name': 'panitia_unik_jabatan'}),
    (KOLEKSI_PANITIA, [('ujian_id', 1), ('user_id', 1)], {'unique': True, 'name': 'panitia_unik_orang'}),
    # Menu panitia otomatis: jabatan seorang pengguna.
    (KOLEKSI_PANITIA, [('user_id', 1)], {}),
    (KOLEKSI_FORMULIR, [('ujian_id', 1)], {'unique': True}),
]

WIB_TZ = timezone(timedelta(hours=7))
POLA_TANGGAL = r'^\d{4}-\d{2}-\d{2}$'
NAMA_UJIAN_MIN = 3
NAMA_UJIAN_MAKS = 120  # sama dengan NAMA_UJIAN_MAKS di frontend FormUjianDialog.js


async def pastikan_index_ujian(db) -> None:
    for koleksi, keys, opsi in INDEX_UJIAN:
        await db[koleksi].create_index(keys, **opsi)


# ---- Waktu WIB ----
def sekarang_wib() -> datetime:
    return datetime.now(WIB_TZ)


def hari_ini_wib(waktu: datetime = None) -> str:
    return (waktu or sekarang_wib()).astimezone(WIB_TZ).strftime('%Y-%m-%d')


def jam_wib(waktu: datetime = None) -> str:
    return (waktu or sekarang_wib()).astimezone(WIB_TZ).strftime('%H:%M')


# ---- Isian ----
class UjianIn(BaseModel):
    """Isian ujian baru (POST /ujian). Semester diambil dari konteks lihat pengelola."""
    jenis: str = Field(..., pattern=r'^(UTS|UAS)$')
    nama: str = Field(..., min_length=NAMA_UJIAN_MIN, max_length=NAMA_UJIAN_MAKS)
    mulai: str = Field(..., pattern=POLA_TANGGAL)
    selesai: str = Field(..., pattern=POLA_TANGGAL)

    @field_validator('nama')
    @classmethod
    def _rapikan_nama(cls, v):
        v = ' '.join(v.split())
        if len(v) < NAMA_UJIAN_MIN:
            raise ValueError(f'Nama ujian minimal {NAMA_UJIAN_MIN} karakter')
        return v

    @field_validator('mulai', 'selesai')
    @classmethod
    def _tanggal_kalender(cls, v):
        try:
            datetime.strptime(v, '%Y-%m-%d')
        except ValueError as e:
            raise ValueError('Tanggal tidak valid') from e
        return v

    @model_validator(mode='after')
    def _urutan(self):
        if self.selesai < self.mulai:
            raise ValueError('Tanggal selesai tidak boleh sebelum tanggal mulai')
        return self


class PanitiaIn(BaseModel):
    """Susunan panitia satu ujian (PUT /ujian/{id}/panitia): user_id per jabatan atau null.

    `versi` (opsional) = `diubah.pada` yang dilihat klien saat membuka penyunting; bila susunan sudah diubah pengguna
    lain sejak itu, server menolak (409) agar perubahan orang lain tidak tertimpa diam-diam."""
    penanggung_jawab: Optional[str] = None
    ketua: Optional[str] = None
    sekretaris: Optional[str] = None
    bendahara: Optional[str] = None
    versi: Optional[str] = None

    @field_validator(*JABATAN_PANITIA)
    @classmethod
    def _kosong_jadi_none(cls, v):
        v = (v or '').strip()
        return v or None

    def susunan(self) -> Dict[str, Optional[str]]:
        return {j: getattr(self, j) for j in JABATAN_PANITIA}


def galat_susunan_panitia(isian: Dict[str, Optional[str]]) -> Dict[str, str]:
    """Satu orang hanya satu jabatan per ujian -> {jabatan: pesan} (sama dengan galatSusunanPanitia frontend)."""
    galat, dipakai = {}, {}
    for j in JABATAN_PANITIA:
        uid = isian.get(j)
        if not uid:
            continue
        if uid in dipakai:
            galat[j] = f'Orang yang sama sudah menjabat {LABEL_JABATAN[dipakai[uid]]}'
        else:
            dipakai[uid] = j
    return galat


# ---- Dokumen ----
def dokumen_ujian_baru(user: Dict[str, Any], isi: UjianIn, semester: Dict[str, Any], tahun: Optional[Dict[str, Any]],
                       waktu: datetime = None) -> Dict[str, Any]:
    t = (waktu or sekarang_wib()).isoformat()
    return {
        'id': str(uuid.uuid4()),
        'jenis': isi.jenis,
        'nama': isi.nama,
        'semester_id': semester['id'],
        'semester_nama': semester.get('name'),
        'academic_year_id': semester.get('academic_year_id'),
        'tahun_pelajaran': (tahun or {}).get('name'),
        'mulai': isi.mulai,
        'selesai': isi.selesai,
        'dibuat_oleh': user.get('id'),
        'dibuat_oleh_nama': user.get('full_name') or user.get('username'),
        'dibuat_pada': t,
        'diperbarui_pada': t,
    }


def akun_gtk_sah(u: Optional[Dict[str, Any]]) -> bool:
    """Akun aktif yang boleh menjadi panitia/pengawas: punya minimal satu peran GTK/pimpinan (bukan siswa, kelas,
    orang tua, alumni, atau satpam)."""
    if not u or not u.get('is_active', True):
        return False
    return any(r not in PERAN_BUKAN_PANITIA for r in (u.get('roles') or []))


def galat_tanggal_semester(isi: 'UjianIn', semester: Dict[str, Any]) -> Optional[str]:
    """Tanggal ujian harus di dalam rentang semester bila rentangnya diatur."""
    awal, akhir = semester.get('start_date'), semester.get('end_date')
    if awal and isi.mulai < awal or akhir and isi.selesai > akhir:
        return f"Tanggal ujian harus di dalam rentang semester {semester.get('name') or ''} ({awal or '…'} s.d. {akhir or '…'})".replace('  ', ' ')
    return None


# Field akun untuk identitas_pejabat (nama + NIP tampil).
PROYEKSI_PEJABAT = {'_id': 0, 'id': 1, 'full_name': 1, 'username': 1, 'roles': 1, 'is_active': 1, 'nip': 1, 'nip_nuptk': 1,
                    'peg_id': 1, 'nipm': 1}


def identitas_pejabat(u: Dict[str, Any]) -> Dict[str, Any]:
    """Pejabat = { user_id, nama, nip, peran } dari dokumen users. NIP mengikuti aturan tampil PKG (NIP ASN, lalu
    nip_nuptk, lalu Peg ID), dengan NIPM sebagai cadangan; '-' bila kosong."""
    roles = u.get('roles') or []
    return {
        'user_id': u.get('id'),
        'nama': u.get('full_name') or u.get('username') or '-',
        'nip': nip_akun(u) or (str(u.get('nipm') or '').strip() or None) or '-',
        'peran': roles[0] if roles else None,
    }


def dokumen_panitia(ujian_id: str, jabatan: str, pejabat: Dict[str, Any], oleh: Dict[str, Any], waktu: datetime = None) -> Dict[str, Any]:
    """Satu baris panitia_ujian: identitas pejabat disalin saat ditetapkan (nama/NIP tetap utuh di arsip)."""
    return {
        'id': str(uuid.uuid4()),
        'ujian_id': ujian_id,
        'jabatan': jabatan,
        'user_id': pejabat['user_id'],
        'nama': pejabat.get('nama'),
        'nip': pejabat.get('nip'),
        'peran': pejabat.get('peran'),
        'ditetapkan_oleh': oleh.get('id'),
        'ditetapkan_oleh_nama': oleh.get('full_name') or oleh.get('username'),
        'ditetapkan_pada': (waktu or sekarang_wib()).isoformat(),
    }


def susunan_dari_dokumen(docs: Iterable[Dict[str, Any]]) -> Dict[str, Optional[Dict[str, Any]]]:
    """Dokumen panitia_ujian satu ujian -> Panitia { jabatan: Pejabat | None }."""
    hasil = {j: None for j in JABATAN_PANITIA}
    for d in docs:
        if d.get('jabatan') in hasil:
            hasil[d['jabatan']] = {'user_id': d.get('user_id'), 'nama': d.get('nama'), 'nip': d.get('nip'), 'peran': d.get('peran')}
    return hasil


def perubahan_terakhir(docs: Iterable[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """{ oleh_nama, pada } penetapan panitia paling baru, atau None."""
    docs = [d for d in docs if d.get('ditetapkan_pada')]
    if not docs:
        return None
    d = max(docs, key=lambda x: x['ditetapkan_pada'])
    return {'oleh_nama': d.get('ditetapkan_oleh_nama'), 'pada': d['ditetapkan_pada']}


async def terapkan_susunan_panitia(db, ujian_id: str, isian: Dict[str, Optional[str]], pejabat: Dict[str, Dict[str, Any]],
                                   oleh: Dict[str, Any], waktu: datetime = None) -> Dict[str, Any]:
    """Simpan susunan panitia satu ujian. Jabatan yang orangnya tidak berubah dibiarkan (waktu penetapan tetap);
    jabatan yang berubah dihapus lebih dulu lalu ditulis ulang, sehingga pertukaran dua orang tidak bentrok dengan
    index unik (ujian_id, user_id). Mengembalikan { berubah: [jabatan], sebelum: {jabatan: user_id} }."""
    lama = {d['jabatan']: d for d in await db[KOLEKSI_PANITIA].find({'ujian_id': ujian_id}, {'_id': 0}).to_list(20)}
    berubah = [j for j in JABATAN_PANITIA if (lama.get(j) or {}).get('user_id') != isian.get(j)]
    if berubah:
        await db[KOLEKSI_PANITIA].delete_many({'ujian_id': ujian_id, 'jabatan': {'$in': berubah}})
        for j in berubah:
            if isian.get(j):
                await db[KOLEKSI_PANITIA].insert_one(dokumen_panitia(ujian_id, j, pejabat[isian[j]], oleh, waktu))
    return {'berubah': berubah, 'sebelum': {j: (lama.get(j) or {}).get('user_id') for j in JABATAN_PANITIA}}


def cek_waktu_formulir(ujian: Dict[str, Any], f: Optional[Dict[str, Any]], hari_ini: str, jam: str) -> Dict[str, Any]:
    """Status rinci formulir menurut jam server WIB -> { status, terbuka, alasan, pesan }.

    alasan: None (terbuka) | 'nonaktif' | 'belum_mulai' | 'sudah_selesai' | 'di_luar_jam'. `pesan` siap ditampilkan
    ke peserta/pengawas pada tautan publik.
    """
    f = f or {}
    buka, tutup = f.get('jam_buka'), f.get('jam_tutup')
    if ujian.get('selesai') and hari_ini > ujian['selesai']:
        return {'status': 'selesai', 'terbuka': False, 'alasan': 'sudah_selesai', 'pesan': 'Masa ujian sudah berakhir; formulir ditutup.'}
    if not f.get('aktif'):
        return {'status': 'tertutup', 'terbuka': False, 'alasan': 'nonaktif', 'pesan': 'Formulir belum dibuka panitia.'}
    if ujian.get('mulai') and hari_ini < ujian['mulai']:
        return {'status': 'tertutup', 'terbuka': False, 'alasan': 'belum_mulai',
                'pesan': f"Formulir baru dapat diisi mulai tanggal {ujian['mulai']}."}
    if buka and tutup and not (buka <= jam <= tutup):
        return {'status': 'tertutup', 'terbuka': False, 'alasan': 'di_luar_jam',
                'pesan': f'Formulir hanya dapat diisi pukul {buka}–{tutup} WIB.'}
    return {'status': 'dibuka', 'terbuka': True, 'alasan': None, 'pesan': 'Formulir dibuka.'}


def status_formulir(ujian: Dict[str, Any], formulir: Optional[Dict[str, Any]], hari_ini: str, jam: str) -> str:
    """'tertutup' | 'dibuka' | 'selesai' (lihat cek_waktu_formulir)."""
    return cek_waktu_formulir(ujian, formulir, hari_ini, jam)['status']


def ringkas_formulir(ujian: Dict[str, Any], formulir: Optional[Dict[str, Any]], hari_ini: str, jam: str) -> Dict[str, Any]:
    """Status formulir untuk daftar ujian: { aktif, jam_buka, jam_tutup, status, alasan, pesan } (aturan sama dengan
    tautan publik, sehingga badge di daftar ujian selalu sesuai dengan yang dialami peserta & pengawas)."""
    f = formulir or {}
    cek = cek_waktu_formulir(ujian, f, hari_ini, jam)
    return {
        'aktif': bool(f.get('aktif')),
        'jam_buka': f.get('jam_buka'),
        'jam_tutup': f.get('jam_tutup'),
        'status': cek['status'],
        'alasan': cek['alasan'],
        'pesan': cek['pesan'],
    }


def ringkas_ujian(doc: Dict[str, Any], formulir: Optional[Dict[str, Any]] = None, hari_ini: str = None, jam: str = None,
                  jumlah_ruang: int = 0, jumlah_peserta: int = 0, jabatan_saya: Optional[str] = None) -> Dict[str, Any]:
    """Ujian untuk antarmuka (kontrak `Ujian` di frontend/src/lib/ujian.js)."""
    hari_ini = hari_ini or hari_ini_wib()
    jam = jam or jam_wib()
    return {
        'id': doc['id'],
        'jenis': doc.get('jenis'),
        'nama': doc.get('nama'),
        'tahun_pelajaran': doc.get('tahun_pelajaran'),
        'semester': doc.get('semester_nama'),
        'semester_id': doc.get('semester_id'),
        'mulai': doc.get('mulai'),
        'selesai': doc.get('selesai'),
        'formulir': ringkas_formulir(doc, formulir, hari_ini, jam),
        'jumlah_ruang': jumlah_ruang,
        'jumlah_peserta': jumlah_peserta,
        'jabatan_saya': jabatan_saya,
    }


# ---- Akses ----
def adalah_pengelola(user: Dict[str, Any]) -> bool:
    """Pengelola ujian: admin — peran aktif admin, atau memiliki peran admin (sama dengan require_role: admin selalu
    lolos)."""
    return user.get('active_role') in PERAN_PENGELOLA_UJIAN or any(r in PERAN_PENGELOLA_UJIAN for r in (user.get('roles') or []))


def adalah_pimpinan(user: Dict[str, Any]) -> bool:
    return user.get('active_role') in PERAN_PIMPINAN_UJIAN


def mungkin_panitia(user: Dict[str, Any]) -> bool:
    return bool(user.get('active_role')) and user.get('active_role') not in PERAN_BUKAN_PANITIA


def menu_panitia_ujian(pengelola: bool, pimpinan: bool, jabatan: Iterable[str]) -> List[Dict[str, Any]]:
    """Katalog menu dengan akses sesuai peran pengelola/pimpinan atau gabungan jabatan panitia."""
    jabatan = list(jabatan or [])
    hasil = []
    for key, label, to, keterangan in MENU_UJIAN:
        aturan = AKSES_MENU_UJIAN[key]
        akses = pengelola or (pimpinan and aturan['pimpinan']) or any(j in aturan['jabatan'] for j in jabatan)
        alasan = None
        if not akses:
            if not jabatan and not pimpinan:
                alasan = 'bukan_panitia'
            else:
                alasan = 'jabatan_lain' if aturan['jabatan'] else 'khusus_pengelola'
        hasil.append({'key': key, 'label': label, 'to': to, 'keterangan': keterangan, 'akses': akses, 'alasan': alasan})
    return hasil


# Pembuka arsip (Arsip Semester Lalu & Arsip Administrasi): admin, waka kurikulum, kepala madrasah, ketua & sekretaris.
JABATAN_PEMBUKA_ARSIP = AKSES_MENU_UJIAN['arsip']['jabatan']
PESAN_TOLAK_ARSIP = 'Arsip ujian hanya dapat dibuka admin, waka kurikulum, kepala madrasah, serta ketua dan sekretaris panitia'


def kelompokkan_per_semester(docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Ujian (sudah diringkas) -> [{ semester_id, semester_nama, tahun_pelajaran, items }], semester terbaru dulu
    (menurut tanggal mulai ujian paling akhir di semester itu); ujian di dalamnya urut tanggal mulai."""
    grup: Dict[str, Dict[str, Any]] = {}
    for d in docs:
        g = grup.setdefault(d.get('semester_id'), {
            'semester_id': d.get('semester_id'), 'semester_nama': d.get('semester'),
            'tahun_pelajaran': d.get('tahun_pelajaran'), 'items': [],
        })
        g['items'].append(d)
    for g in grup.values():
        g['items'].sort(key=lambda u: (u.get('mulai') or '', u.get('nama') or ''))
    return sorted(grup.values(), key=lambda g: max((u.get('mulai') or '') for u in g['items']), reverse=True)


def boleh_menu(menu: List[Dict[str, Any]], key: str) -> bool:
    return any(m['key'] == key and m['akses'] for m in menu)


def boleh_akses_ujian(pengelola: bool, pimpinan: bool, jabatan: Optional[str], key: str) -> bool:
    """Akses menu `key` pada SATU ujian: pengelola selalu; pimpinan sesuai aturan; panitia hanya menurut jabatannya
    pada ujian itu (bendahara UTS tidak otomatis berhak atas ujian UAS)."""
    aturan = AKSES_MENU_UJIAN[key]
    return pengelola or (pimpinan and aturan['pimpinan']) or (jabatan in aturan['jabatan'])


def pesan_tolak_menu(key: str) -> str:
    label = next((m[1] for m in MENU_UJIAN if m[0] == key), key)
    aturan = AKSES_MENU_UJIAN[key]
    if not aturan['jabatan']:
        return f'Menu {label} hanya untuk admin'
    jabatan = ', '.join(LABEL_JABATAN[j].lower() for j in aturan['jabatan'])
    return f'Menu {label} pada ujian ini hanya untuk admin{", pimpinan" if aturan["pimpinan"] else ""}, serta {jabatan}'


# ---- Kueri bersama ----
async def jabatan_pengguna(db, user_id: str, ujian_ids: Iterable[str]) -> Dict[str, str]:
    """{ujian_id: jabatan} pengguna pada ujian-ujian tertentu."""
    ids = list(ujian_ids)
    if not ids or not user_id:
        return {}
    docs = await db[KOLEKSI_PANITIA].find({'user_id': user_id, 'ujian_id': {'$in': ids}}, {'_id': 0, 'ujian_id': 1, 'jabatan': 1}).to_list(1000)
    return {d['ujian_id']: d['jabatan'] for d in docs}


async def ringkas_daftar_ujian(db, docs: List[Dict[str, Any]], jabatan: Dict[str, str], hari_ini: str = None,
                               jam: str = None) -> List[Dict[str, Any]]:
    """Ujian lengkap untuk antarmuka: formulir, jumlah ruang & peserta, jabatan pengguna."""
    ids = [d['id'] for d in docs]
    formulir = {}
    if ids:
        for f in await db[KOLEKSI_FORMULIR].find({'ujian_id': {'$in': ids}}, {'_id': 0}).to_list(1000):
            formulir[f['ujian_id']] = f
    hasil = []
    for d in docs:
        hasil.append(ringkas_ujian(
            d, formulir.get(d['id']), hari_ini, jam,
            jumlah_ruang=await db[KOLEKSI_RUANG].count_documents({'ujian_id': d['id']}),
            jumlah_peserta=await db[KOLEKSI_PESERTA].count_documents({'ujian_id': d['id']}),
            jabatan_saya=jabatan.get(d['id']),
        ))
    return hasil
