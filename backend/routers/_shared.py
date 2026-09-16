"""Shared helpers used across multiple routers (e.g. RBAC class check)."""
from typing import Any, Dict, List, Optional, Tuple

from core import db


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


def compute_completeness(user_doc: Dict, detail_doc: Optional[Dict]) -> int:
    """
    Hitung persentase kelengkapan data wajib siswa (0-100), gabungan dari:
    Data Siswa, Data Orang Tua, Data Alamat, Kebutuhan Khusus, Upload Berkas.
    Field yang tidak applicable (mis. data wali saat hubungan_wali bukan 'Lainnya')
    tidak ikut dihitung di pembilang maupun penyebut.
    """
    detail = detail_doc or {}
    filled_total = 0
    field_total = 0

    # === 1. Data Siswa ===
    f, t = _count_fields(user_doc or {}, ['full_name', 'nisn', 'gender', 'birth_place', 'birth_date'])
    filled_total += f
    field_total += t

    f, t = _count_fields(detail, [
        'citizenship', 'agama', 'cita_cita', 'hobi', 'jumlah_saudara',
        'anak_ke', 'pembiaya_sekolah', 'nomor_kk', 'nama_kepala_keluarga',
    ])
    filled_total += f
    field_total += t

    if detail.get('citizenship') == 'WNA':
        f, t = _count_fields(detail, ['asal_negara', 'nomor_izin_tinggal'])
    else:
        f, t = _count_fields(detail, ['nik'])
    filled_total += f
    field_total += t

    # === 2. Data Orang Tua ===
    f, t = _count_parent(detail.get('ayah'))
    filled_total += f
    field_total += t
    f, t = _count_parent(detail.get('ibu'))
    filled_total += f
    field_total += t

    wali = detail.get('wali') or {}
    if wali.get('hubungan_wali') == 'Lainnya':
        f, t = _count_parent(wali)
        filled_total += f
        field_total += t

    # === 3. Data Alamat ===
    f, t = _count_address(detail.get('alamat_ayah'))
    filled_total += f
    field_total += t

    alamat_ibu = detail.get('alamat_ibu') or {}
    if not alamat_ibu.get('sama_dengan_ayah'):
        f, t = _count_address(alamat_ibu)
        filled_total += f
        field_total += t

    if wali.get('hubungan_wali') == 'Lainnya':
        alamat_wali = detail.get('alamat_wali') or {}
        if not alamat_wali.get('sama_dengan_ayah'):
            f, t = _count_address(alamat_wali)
            filled_total += f
            field_total += t

    f, t = _count_fields(detail.get('alamat_siswa') or {}, [
        'status_tempat_tinggal', 'jarak_tempuh', 'transportasi', 'waktu_tempuh',
    ])
    filled_total += f
    field_total += t

    # === 4. Kebutuhan Khusus ===
    f, t = _count_fields(detail, ['jenis_kebutuhan_khusus', 'kebutuhan_disabilitas'])
    filled_total += f
    field_total += t

    # === 5. Upload Berkas ===
    f, t = _count_fields(detail, [
        'berkas_kartu_keluarga', 'berkas_akta_kelahiran', 'berkas_ijazah_sd',
        'berkas_kip', 'berkas_pkh', 'berkas_kks', 'berkas_kartu_pelajar',
    ])
    filled_total += f
    field_total += t

    if field_total == 0:
        return 0
    return round((filled_total / field_total) * 100)


async def user_can_view_class(user: Dict, class_id: str) -> bool:
    if 'admin' in user.get('roles', []):
        return True
    cls = await db.classes.find_one({'id': class_id}, {'_id': 0})
    if cls and cls.get('homeroom_teacher_id') == user['id']:
        return True
    # Allow guru_bk, guru_tata_tertib, guru_piket, tendik to view all
    overlap = set(user.get('roles', [])) & {'guru_bk', 'guru_tata_tertib', 'guru_piket', 'tenaga_kependidikan'}
    if overlap:
        return True
    # Allow subject teachers who teach this class to view its students
    if 'guru' in user.get('roles', []) or 'wali_kelas' in user.get('roles', []):
        sched = await db.schedules.find_one({'class_id': class_id, 'teacher_id': user['id']})
        if sched:
            return True
    return False
