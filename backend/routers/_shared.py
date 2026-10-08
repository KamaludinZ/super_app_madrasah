"""Shared helpers used across multiple routers (e.g. RBAC class check)."""
from typing import Any, Dict, List, Optional, Tuple

from core import GURU_MAPEL_ROLES, punya_peran_guru  # noqa: F401
from core import db, require_role

# Satu kebijakan akses untuk seluruh fitur kelengkapan data master (unduh data, template,
# impor) Siswa & GTK: hanya admin (aturan require_role: peran aktif admin, atau akun yang
# memiliki peran admin). Kepala madrasah, wali kelas, dan peran lain -> 403.
ADMIN_DATA_MASTER = require_role('admin')


def _has_value(v: Any) -> bool:
    """Anggap terisi jika bukan None/''/[]. Angka 0 tetap dianggap terisi."""
    if v is None:
        return False
    if isinstance(v, str):
        return v.strip() != ''
    if isinstance(v, (list, dict)):
        return len(v) > 0
    return True


def _count_fields(obj: Dict, fields: List[str]) -> Tuple[int, int]:
    """Return (filled, total) untuk daftar field pada satu dict."""
    total = len(fields)
    filled = sum(1 for f in fields if _has_value(obj.get(f)))
    return filled, total


def _count_parent(parent: Optional[Dict], include_kks_pkh: bool = False) -> Tuple[int, int]:
    """Hitung (filled, total) field wajib untuk satu objek ayah/ibu/wali,
    mengikuti logic show/hide kondisional yang sama seperti form di StudentDetailDialog.js."""
    parent = parent or {}
    filled, total = _count_fields(parent, ['nama', 'status'])

    status = parent.get('status')
    is_dead = status in ('Sudah Meninggal', 'Tidak Diketahui')
    if not is_dead:
        f, t = _count_fields(parent, ['tempat_lahir', 'tgl_lahir', 'pendidikan', 'pekerjaan', 'penghasilan'])
        filled += f
        total += t

        if parent.get('citizenship') == 'WNA':
            f, t = _count_fields(parent, ['asal_negara', 'nomor_izin_tinggal'])
        else:
            f, t = _count_fields(parent, ['nik'])
        filled += f
        total += t

        if not parent.get('no_hp_unavailable'):
            f, t = _count_fields(parent, ['no_hp'])
            filled += f
            total += t

    return filled, total


def _count_address(addr: Optional[Dict]) -> Tuple[int, int]:
    """Hitung (filled, total) field wajib untuk satu objek alamat (ayah/ibu/wali/siswa)."""
    addr = addr or {}
    if addr.get('tinggal_luar_negeri'):
        return _count_fields(addr, ['alamat'])
    return _count_fields(addr, [
        'status_kepemilikan', 'provinsi', 'kabupaten', 'kecamatan',
        'kelurahan', 'rt', 'rw', 'kode_pos', 'alamat',
    ])


def compute_completeness(user_doc: Dict, detail_doc: Optional[Dict] = None, jenis: Optional[str] = None) -> int:
    """
    Hitung persentase kelengkapan data wajib (0-100).

    jenis='gtk' (atau pengguna GTK tanpa peran siswa bila jenis tidak diisi) dihitung dengan
    aturan GTK per bagian (compute_completeness_gtk). Selain itu dihitung sebagai siswa,
    gabungan dari:
    Data Siswa, Data Orang Tua, Data Alamat, Kebutuhan Khusus, Upload Berkas.
    Field yang tidak applicable (mis. data wali saat hubungan_wali bukan 'Lainnya')
    tidak ikut dihitung di pembilang maupun penyebut.
    """
    if jenis == 'gtk' or (jenis is None and _adalah_gtk(user_doc)):
        return compute_completeness_gtk(user_doc)['persen']
    return compute_completeness_siswa(user_doc, detail_doc)['persen']


# ------------------------------------------------------------
# KELENGKAPAN DATA SISWA PER BAGIAN
# ------------------------------------------------------------
_LABEL_SISWA = {
    'full_name': 'Nama Lengkap', 'nisn': 'NISN', 'gender': 'Jenis Kelamin', 'birth_place': 'Tempat Lahir', 'birth_date': 'Tanggal Lahir',
    'citizenship': 'Kewarganegaraan', 'agama': 'Agama', 'cita_cita': 'Cita-cita', 'hobi': 'Hobi', 'jumlah_saudara': 'Jumlah Saudara',
    'anak_ke': 'Anak Ke-', 'pembiaya_sekolah': 'Yang Membiayai Sekolah', 'nomor_kk': 'Nomor KK', 'nama_kepala_keluarga': 'Nama Kepala Keluarga',
    'asal_negara': 'Asal Negara', 'nomor_izin_tinggal': 'Nomor Izin Tinggal', 'nik': 'NIK',
    'nama': 'Nama', 'status': 'Status', 'tempat_lahir': 'Tempat Lahir', 'tgl_lahir': 'Tanggal Lahir', 'pendidikan': 'Pendidikan',
    'pekerjaan': 'Pekerjaan', 'penghasilan': 'Penghasilan', 'no_hp': 'No. HP',
    'status_kepemilikan': 'Status Kepemilikan Rumah', 'provinsi': 'Provinsi', 'kabupaten': 'Kabupaten/Kota', 'kecamatan': 'Kecamatan',
    'kelurahan': 'Kelurahan/Desa', 'rt': 'RT', 'rw': 'RW', 'kode_pos': 'Kode Pos', 'alamat': 'Alamat Lengkap',
    'status_tempat_tinggal': 'Status Tempat Tinggal', 'jarak_tempuh': 'Jarak Tempuh', 'transportasi': 'Transportasi', 'waktu_tempuh': 'Waktu Tempuh',
    'jenis_kebutuhan_khusus': 'Jenis Kebutuhan Khusus', 'kebutuhan_disabilitas': 'Kebutuhan Disabilitas',
    'berkas_kartu_keluarga': 'Kartu Keluarga', 'berkas_akta_kelahiran': 'Akta Kelahiran', 'berkas_ijazah_sd': 'Ijazah SD/MI',
    'berkas_kip': 'KIP', 'berkas_pkh': 'PKH', 'berkas_kks': 'KKS', 'berkas_kartu_pelajar': 'Kartu Pelajar',
}


class _Bagian:
    """Penghitung satu bagian: menambah (terisi, total) dan mencatat label field yang kurang."""

    def __init__(self, key: str, label: str):
        self.key, self.label, self.terisi, self.total, self.kurang = key, label, 0, 0, []

    def cek(self, obj: Optional[Dict], fields: List[str], awalan: str = '') -> None:
        obj = obj or {}
        for f in fields:
            self.total += 1
            if _has_value(obj.get(f)):
                self.terisi += 1
            else:
                self.kurang.append(f"{awalan}{_LABEL_SISWA.get(f, f)}")

    def ortu(self, parent: Optional[Dict], awalan: str) -> None:
        """Logika sama dengan _count_parent (field kondisional mengikuti form StudentDetailDialog)."""
        parent = parent or {}
        self.cek(parent, ['nama', 'status'], awalan)
        if parent.get('status') in ('Sudah Meninggal', 'Tidak Diketahui'):
            return
        self.cek(parent, ['tempat_lahir', 'tgl_lahir', 'pendidikan', 'pekerjaan', 'penghasilan'], awalan)
        self.cek(parent, ['asal_negara', 'nomor_izin_tinggal'] if parent.get('citizenship') == 'WNA' else ['nik'], awalan)
        if not parent.get('no_hp_unavailable'):
            self.cek(parent, ['no_hp'], awalan)

    def alamat(self, addr: Optional[Dict], awalan: str) -> None:
        """Logika sama dengan _count_address."""
        addr = addr or {}
        if addr.get('tinggal_luar_negeri'):
            self.cek(addr, ['alamat'], awalan)
        else:
            self.cek(addr, ['status_kepemilikan', 'provinsi', 'kabupaten', 'kecamatan', 'kelurahan', 'rt', 'rw', 'kode_pos', 'alamat'], awalan)

    def hasil(self) -> Dict[str, Any]:
        return {'key': self.key, 'label': self.label, 'terisi': self.terisi, 'total': self.total,
                'persen': round(self.terisi / self.total * 100) if self.total else 100, 'kurang': self.kurang}


def compute_completeness_siswa(user_doc: Optional[Dict], detail_doc: Optional[Dict]) -> Dict[str, Any]:
    """Kelengkapan data wajib siswa per bagian (Data Siswa, Data Orang Tua, Data Alamat, Kebutuhan
    Khusus, Upload Berkas): {persen, terisi, total, bagian: [{key, label, persen, terisi, total, kurang}]}.
    Field yang tidak berlaku (mis. data wali saat hubungan_wali bukan 'Lainnya', orang tua yang sudah
    meninggal, alamat ibu yang sama dengan ayah) tidak dihitung. Persen keseluruhan = persen lama
    compute_completeness (bobot per field)."""
    user = user_doc or {}
    detail = detail_doc or {}

    siswa = _Bagian('data_siswa', 'Data Siswa')
    siswa.cek(user, ['full_name', 'nisn', 'gender', 'birth_place', 'birth_date'])
    siswa.cek(detail, ['citizenship', 'agama', 'cita_cita', 'hobi', 'jumlah_saudara', 'anak_ke', 'pembiaya_sekolah',
                       'nomor_kk', 'nama_kepala_keluarga'])
    siswa.cek(detail, ['asal_negara', 'nomor_izin_tinggal'] if detail.get('citizenship') == 'WNA' else ['nik'])

    wali = detail.get('wali') or {}
    ada_wali = wali.get('hubungan_wali') == 'Lainnya'
    ortu = _Bagian('data_ortu', 'Data Orang Tua')
    ortu.ortu(detail.get('ayah'), 'Ayah - ')
    ortu.ortu(detail.get('ibu'), 'Ibu - ')
    if ada_wali:
        ortu.ortu(wali, 'Wali - ')

    alamat = _Bagian('data_alamat', 'Data Alamat')
    alamat.alamat(detail.get('alamat_ayah'), 'Alamat Ayah - ')
    if not (detail.get('alamat_ibu') or {}).get('sama_dengan_ayah'):
        alamat.alamat(detail.get('alamat_ibu'), 'Alamat Ibu - ')
    if ada_wali and not (detail.get('alamat_wali') or {}).get('sama_dengan_ayah'):
        alamat.alamat(detail.get('alamat_wali'), 'Alamat Wali - ')
    alamat.cek(detail.get('alamat_siswa'), ['status_tempat_tinggal', 'jarak_tempuh', 'transportasi', 'waktu_tempuh'], 'Siswa - ')

    khusus = _Bagian('kebutuhan_khusus', 'Kebutuhan Khusus')
    khusus.cek(detail, ['jenis_kebutuhan_khusus', 'kebutuhan_disabilitas'])

    berkas = _Bagian('upload_berkas', 'Upload Berkas')
    # KIP, PKH, KKS, dan Kartu Pelajar opsional (tidak semua siswa punya/sudah menerima) -> tidak dihitung.
    berkas.cek(detail, ['berkas_kartu_keluarga', 'berkas_akta_kelahiran', 'berkas_ijazah_sd'])

    bagian = [b.hasil() for b in (siswa, ortu, alamat, khusus, berkas)]
    terisi = sum(b['terisi'] for b in bagian)
    total = sum(b['total'] for b in bagian)
    return {'persen': round(terisi / total * 100) if total else 0, 'terisi': terisi, 'total': total, 'bagian': bagian}


# ------------------------------------------------------------
# KELENGKAPAN DATA GTK
# ------------------------------------------------------------
# Aturan HARUS sama dengan frontend/src/lib/kelengkapanGtk.js (BAGIAN_KELENGKAPAN_GTK).
# Tiap syarat: (jenis, field, label[, field_tidak_ada]) — 'field' = field users wajib terisi;
# 'daftar' = daftar minimal satu item ATAU penanda "tidak ada" bernilai True.
_SYARAT_DATA_GURU = [
    ('full_name', 'Nama Lengkap'), ('gender', 'Jenis Kelamin'), ('birth_place', 'Tempat Lahir'), ('birth_date', 'Tanggal Lahir'),
    ('nik', 'NIK'), ('nomor_kk', 'Nomor KK'), ('nama_ibu_kandung', 'Nama Ibu Kandung'), ('agama', 'Agama'),
    ('status_kepegawaian', 'Status Kepegawaian'), ('nuptk', 'NUPTK'), ('phone', 'Nomor HP'), ('email', 'Email'),
    ('status_tempat_tinggal', 'Status Tempat Tinggal'), ('provinsi', 'Provinsi'), ('kab_kota', 'Kabupaten/Kota'),
    ('kecamatan', 'Kecamatan'), ('kelurahan', 'Kelurahan/Desa'), ('status_perkawinan', 'Status Perkawinan'),
    ('jenis_ptk', 'Jenis PTK'), ('tugas_utama', 'Tugas Utama'),
]
BAGIAN_KELENGKAPAN_GTK: List[Dict[str, Any]] = [
    {'key': 'data_guru', 'label': 'Data Guru', 'syarat': [{'jenis': 'field', 'field': f, 'label': l} for f, l in _SYARAT_DATA_GURU]},
    {'key': 'status_riwayat', 'label': 'Status & Riwayat', 'syarat': [
        {'jenis': 'daftar', 'field': 'jabatan_ids', 'label': 'Fungsi/Jabatan'},
        {'jenis': 'field', 'field': 'status_penugasan', 'label': 'Status Penugasan'},
        {'jenis': 'field', 'field': 'pangkat_golongan', 'label': 'Pangkat/Golongan'},
        {'jenis': 'field', 'field': 'status_keaktifan', 'label': 'Status Keaktifan'},
    ]},
    {'key': 'pendidikan', 'label': 'Pendidikan', 'syarat': [
        {'jenis': 'daftar', 'field': 'riwayat_pendidikan', 'label': 'Riwayat Pendidikan Formal'}]},
    {'key': 'data_anak', 'label': 'Data Anak', 'syarat': [
        {'jenis': 'daftar', 'field': 'data_anak', 'tidakAda': 'tidak_punya_anak', 'label': 'Data Anak (atau "tidak punya anak")'}]},
    {'key': 'riwayat_pesantren', 'label': 'Riwayat Pesantren', 'syarat': [
        {'jenis': 'daftar', 'field': 'riwayat_pesantren', 'tidakAda': 'tidak_pernah_pesantren', 'label': 'Riwayat Pesantren (atau "tidak pernah")'}]},
    {'key': 'arsip_berkas', 'label': 'Arsip Berkas', 'syarat': [
        {'jenis': 'field', 'field': f, 'label': l} for f, l in
        (('berkas_ktp', 'KTP'), ('berkas_kk', 'Kartu Keluarga'), ('berkas_ijazah', 'Ijazah Terakhir'), ('berkas_sk', 'SK Pengangkatan'))]},
]
_FALLBACK_GTK = {'nuptk': 'nip_nuptk'}
_GTK_ROLES = ('guru', 'wali_kelas', 'guru_piket', 'guru_bk', 'guru_tata_tertib', 'guru_ekstrakurikuler', 'tenaga_kependidikan')


def _bulat(x: float) -> int:
    """Pembulatan setengah ke atas (sama dengan Math.round di frontend; round() Python membulatkan ke genap)."""
    return int(x + 0.5)


def _adalah_gtk(user_doc: Optional[Dict]) -> bool:
    roles = (user_doc or {}).get('roles') or []
    return 'siswa' not in roles and any(r in _GTK_ROLES for r in roles)


def _cek_syarat_gtk(s: Dict[str, Any], user: Dict) -> bool:
    if s['jenis'] == 'daftar':
        return _has_value(user.get(s['field'])) or (bool(s.get('tidakAda')) and user.get(s['tidakAda']) is True)
    return _has_value(user.get(s['field'])) or (s['field'] in _FALLBACK_GTK and _has_value(user.get(_FALLBACK_GTK[s['field']])))


def compute_completeness_gtk(user_doc: Optional[Dict]) -> Dict[str, Any]:
    """Kelengkapan data wajib GTK per bagian:
    {persen, terisi, total, bagian: [{key, label, persen, terisi, total, kurang: [label]}]}.
    Persen keseluruhan = syarat terpenuhi / seluruh syarat (bobot per syarat)."""
    user = user_doc or {}
    isi = total = 0
    bagian = []
    for b in BAGIAN_KELENGKAPAN_GTK:
        kurang = [s['label'] for s in b['syarat'] if not _cek_syarat_gtk(s, user)]
        t = len(b['syarat'])
        f = t - len(kurang)
        isi += f
        total += t
        bagian.append({'key': b['key'], 'label': b['label'], 'persen': _bulat(f / t * 100) if t else 100,
                       'terisi': f, 'total': t, 'kurang': kurang})
    return {'persen': _bulat(isi / total * 100) if total else 0, 'terisi': isi, 'total': total, 'bagian': bagian}


async def user_can_view_class(user: Dict, class_id: str) -> bool:
    if 'admin' in user.get('roles', []):
        return True
    cls = await db.classes.find_one({'id': class_id}, {'_id': 0})
    if cls and cls.get('homeroom_teacher_id') == user['id']:
        return True
    # Allow guru_bk, guru_tata_tertib, guru_piket, tendik, UKS staff, kepala sekolah, waka kesiswaan, and penjamin mutu to view all
    overlap = set(user.get('roles', [])) & {'guru_bk', 'guru_tata_tertib', 'guru_piket', 'tenaga_kependidikan', 'unit_kesehatan', 'kepala_sekolah', 'waka_kesiswaan', 'penjamin_mutu'}
    if overlap:
        return True
    # Allow subject teachers who teach this class to view its students
    if punya_peran_guru(user) or 'wali_kelas' in user.get('roles', []):
        sched = await db.schedules.find_one({'class_id': class_id, 'teacher_id': user['id']})
        if sched:
            return True
    return False



# ============================================================
# SISWA AKTIF — satu definisi untuk semua daftar siswa & data per siswa
# ============================================================
# Siswa aktif = bukan mutasi keluar dan akun tidak dinonaktifkan. Data siswa nonaktif TIDAK dihapus;
# hanya disembunyikan dari daftar dan muncul kembali setelah siswa diaktifkan lagi (menu Mutasi / Pengguna).
FILTER_SISWA_AKTIF: Dict[str, Any] = {'mutation_type': {'$ne': 'keluar'}, 'is_active': {'$ne': False}}


async def id_siswa_nonaktif(database=None) -> List[str]:
    """ID siswa yang tidak aktif (mutasi keluar atau akun nonaktif)."""
    database = database if database is not None else db
    return [u['id'] async for u in database.users.find(
        {'roles': 'siswa', '$or': [{'mutation_type': 'keluar'}, {'is_active': False}]}, {'_id': 0, 'id': 1}) if u.get('id')]


async def sembunyikan_siswa_nonaktif(query: Dict[str, Any], field: str, database=None) -> Dict[str, Any]:
    """Tambahkan syarat ke query daftar data per siswa agar data milik siswa nonaktif tidak tampil.
    Bila query sudah meminta siswa tertentu (field terisi), query tidak diubah."""
    if field not in query:
        nonaktif = await id_siswa_nonaktif(database)
        if nonaktif:
            query[field] = {'$nin': nonaktif}
    return query
