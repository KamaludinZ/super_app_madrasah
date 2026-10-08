"""Hak akses Data Prestasi per peran aktif — dipakai router prestasi (phase4) & verval.

Peran (admin dikenali dari daftar peran, sama seperti require_role):
- admin      : kelola semua prestasi & proses semua ajuan.
- kesiswaan  : Waka Kesiswaan — pemegang data prestasi SISWA: lihat semua, proses ajuan prestasi siswa,
               verifikasi, tambah/ubah/hapus prestasi siswa.
- wali_kelas : proses & verifikasi prestasi siswa kelas binaannya saja.
- viewer     : pimpinan/pemantau (kepala, penjamin mutu, waka lain, unit pelayanan, guru BK) — lihat semua
               prestasi termasuk ajuan yang menunggu, tanpa aksi.
"""
from typing import Dict, List, Optional

from core import db

PRESTASI_VIEWER_ROLES = (
    'kepala_sekolah', 'penjamin_mutu', 'waka_kurikulum', 'waka_humas', 'waka_sarpras', 'unit_pelayanan', 'guru_bk',
)


def peran_prestasi(user: Dict) -> Optional[str]:
    if 'admin' in (user.get('roles') or []):
        return 'admin'
    active = user.get('active_role')
    if active == 'waka_kesiswaan':
        return 'kesiswaan'
    if active == 'wali_kelas':
        return 'wali_kelas'
    if active in PRESTASI_VIEWER_ROLES:
        return 'viewer'
    return None


async def siswa_kelas_wali(user: Dict) -> List[str]:
    cls_id = user.get('homeroom_class_id')
    if not cls_id:
        return []
    students = await db.users.find(
        {'roles': 'siswa', 'student_class_id': cls_id, 'is_active': {'$ne': False}}, {'_id': 0, 'id': 1}
    ).to_list(2000)
    return [s['id'] for s in students if s.get('id')]


def pemegang_siswa_ajuan(req: Dict) -> Optional[str]:
    """ID siswa yang menjadi subjek ajuan: pemegang prestasi siswa (termasuk ajuan yang diajukan pihak lain
    atas nama siswa) atau pemilik ajuan perubahan data siswa. None bila bukan ajuan milik/untuk siswa."""
    if req.get('request_type') == 'prestasi_create':
        nd = req.get('new_data') or {}
        if (nd.get('holder_type') or 'siswa') != 'siswa':
            return None
        return nd.get('student_id') or nd.get('holder_id') or (req.get('user_id') if req.get('user_type') == 'siswa' else None)
    return req.get('user_id') if req.get('user_type') == 'siswa' else None


def rapikan_pemegang(ach: Dict, fallback_user_id: Optional[str]) -> Dict:
    """Prestasi siswa memakai student_id, guru/tendik memakai holder_id (sesuai StudentAchievementModel)."""
    ht = ach.get('holder_type') or 'siswa'
    ach['holder_type'] = ht
    hid = ach.get('student_id') or ach.get('holder_id') or fallback_user_id
    if ht == 'siswa':
        ach['student_id'], ach['holder_id'] = hid, None
    elif ht in ('guru', 'tendik'):
        ach['holder_id'], ach['student_id'] = hid, None
    else:
        ach['holder_id'] = ach['student_id'] = None
    return ach
