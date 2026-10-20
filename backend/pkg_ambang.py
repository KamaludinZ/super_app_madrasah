"""Konfigurasi ambang & bobot penilaian PKG — satu sumber, disalin apa adanya dari rumus template resmi
pkg_template_v2026.xlsx dan rekap_hasil_pkg_v2026.xlsx. Ambang SENGAJA tidak dapat diubah dari aplikasi: berkas Excel
hasil cetak menghitung ulang dengan rumus template yang sama, sehingga ambang berbeda akan membuat nilai di aplikasi
dan di dokumen resmi tidak cocok. Cermin frontend: frontend/src/lib/pkgAmbang.js (dijaga tests/test_pkg_ambang.py).

Setiap ambang = daftar (operator, batas, label) yang dicek berurutan; nilai 0/kosong menghasilkan None (template: "").
    Level capaian / tingkat kompetensi  04-RKAP-PKG!G45, 05-RKAP-PKGR!F44   (<55 L1, =55 L2, <=75 L3, <=90 L4, <=100 L5)
    Predikat jenjang jabatan             04-RKAP-PKG!F45, 05-RKAP-PKGR!E44   (<=55 Pertama, <=75 Muda, <=90 Madya, <=100 Utama)
    Predikat rekap                       Rekap hasil PKG!G6                  (>=91 Sangat Baik, >=76 Baik, >=61 Cukup, >=60 Sedang, Kurang)
    Sebutan angket 360°                  SEJAWAT/SISWA/ORTU baris Sebutan     (<=50 Kurang, <=60 Sedang, <=75 Cukup, <=90 Baik, <=100 Amat Baik)
    Proporsi nilai kompetensi guru       05-RKAP-PKGR!E35:E39 menurut jenjang ('00-DATA'!M2)
"""
import os
from typing import Any, Dict, List, Optional, Sequence, Tuple

Ambang = Sequence[Tuple[str, float, str]]

AMBANG_LEVEL: Ambang = (('<', 55, 'Level 1'), ('==', 55, 'Level 2'), ('<=', 75, 'Level 3'), ('<=', 90, 'Level 4'),
                        ('<=', 100, 'Level 5'))
AMBANG_PREDIKAT_JENJANG: Ambang = (
    ('<=', 55, 'Terpenuhi pada Jenjang Jabatan Guru Ahli Pertama'),
    ('<=', 75, 'Terpenuhi pada Jenjang Jabatan Guru Ahli Muda'),
    ('<=', 90, 'Terpenuhi pada Jenjang Jabatan Guru Ahli Madya'),
    ('<=', 100, 'Terpenuhi pada Jenjang Jabatan Guru Ahli Utama'),
)
AMBANG_PREDIKAT_REKAP: Ambang = (('>=', 91, 'Sangat Baik'), ('>=', 76, 'Baik'), ('>=', 61, 'Cukup'), ('>=', 60, 'Sedang'),
                                 ('>=', float('-inf'), 'Kurang'))
AMBANG_SEBUTAN_360: Ambang = (('<=', 50, 'Kurang'), ('<=', 60, 'Sedang'), ('<=', 75, 'Cukup'), ('<=', 90, 'Baik'),
                              ('<=', 100, 'Amat Baik'))

# Proporsi 05-RKAP-PKGR per jenjang; jenjang lain (MI/MTs/MA/SD/SMP/SMA) memakai 'umum'.
PROPORSI_NILAI: Dict[str, Dict[str, float]] = {
    'umum': {'atasan': 0.7, 'sejawat': 0.1, 'siswa': 0.1, 'ortu': 0.1},
    'SMK': {'atasan': 0.7, 'sejawat': 0.1, 'siswa': 0.1, 'ortu': 0.05, 'dudi': 0.05},
    'PAUD': {'atasan': 0.7, 'sejawat': 0.15, 'siswa': 0.0, 'ortu': 0.15},
    'SLB': {'atasan': 0.7, 'sejawat': 0.15, 'siswa': 0.0, 'ortu': 0.15},
}
# Jenjang madrasah untuk '00-DATA'!M2 (bawaan MTs); DUDI tidak dipakai di luar SMK.
JENJANG = os.environ.get('PKG_JENJANG', 'MTs').strip() or 'MTs'

# Kehadiran (INDEK-HDIR): menit terlambat + pulang cepat dikonversi ke hari per 8 jam; persentase tidak hadir dibagi
# 46 hari (konstanta template).
MENIT_PER_HARI = 8 * 60
PEMBAGI_HARI_KEHADIRAN = 46

_OPERATOR = {
    '<': lambda n, b: n < b, '<=': lambda n, b: n <= b, '==': lambda n, b: n == b, '>=': lambda n, b: n >= b,
}


def terapkan(ambang: Ambang, nilai: Optional[float], kosong_bila_nol: bool = True) -> Optional[str]:
    """Label pertama yang syaratnya terpenuhi; None bila nilai kosong (atau 0, seperti IF(x=0,"",...) template)."""
    if nilai is None or (kosong_bila_nol and not nilai):
        return None
    for op, batas, label in ambang:
        if _OPERATOR[op](nilai, batas):
            return label
    return None


def level_dari_label(label: Optional[str]) -> Optional[int]:
    """'Level 3' / 'pada Level 3' -> 3 (01-LAPORN!L6:L7)."""
    if not label:
        return None
    angka = label.rsplit(' ', 1)[-1]
    return int(angka) if angka.isdigit() else None


def simpulan_level(level_normal: Optional[int], level_plus: Optional[int]) -> Dict[str, Any]:
    """Simpulan 01-LAPORN: rata-rata level Normal & Plus 360 (L8 = AVERAGE(L6:L7)); hasil evaluasi (M7) hanya terisi
    bila rata-ratanya bilangan bulat 1–5 — rata-rata pecahan (mis. 3,5) dibiarkan kosong seperti template."""
    ada = [n for n in (level_normal, level_plus) if n is not None]
    rata = sum(ada) / len(ada) if ada else None
    bulat = rata is not None and float(rata).is_integer() and 1 <= rata <= 5
    return {'rata': rata, 'level': f'Level {int(rata)}' if bulat else None, 'angka': int(rata) if bulat else None}


def proporsi(jenjang: Optional[str] = None) -> Dict[str, float]:
    """Bobot komponen nilai kompetensi guru menurut jenjang (05-RKAP-PKGR!E35:E39)."""
    return PROPORSI_NILAI.get((jenjang or JENJANG).upper(), PROPORSI_NILAI['umum'])


def konfigurasi() -> Dict[str, Any]:
    """Seluruh ambang & bobot untuk ditampilkan di aplikasi (GET /pkg/ambang)."""
    def daftar(ambang: Ambang) -> List[Dict[str, Any]]:
        return [{'operator': op, 'batas': None if batas == float('-inf') else batas, 'label': label} for op, batas, label in ambang]
    return {
        'level': daftar(AMBANG_LEVEL), 'predikat_jenjang': daftar(AMBANG_PREDIKAT_JENJANG),
        'predikat_rekap': daftar(AMBANG_PREDIKAT_REKAP), 'sebutan_360': daftar(AMBANG_SEBUTAN_360),
        'jenjang': JENJANG, 'proporsi': proporsi(),
        'kehadiran': {'menit_per_hari': MENIT_PER_HARI, 'pembagi_hari': PEMBAGI_HARI_KEHADIRAN},
        'sumber': 'Rumus template resmi pkg_template_v2026.xlsx & rekap_hasil_pkg_v2026.xlsx',
    }
