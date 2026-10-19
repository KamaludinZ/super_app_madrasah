"""Perhitungan nilai PKG mengikuti rumus template resmi pkg_template_v2026.xlsx (sama dengan frontend lib/pkgPenilaian).

    skor sub-kompetensi = jumlah indikator perilaku (Level 1–5) yang dicentang   (KOMP-n!K6 = COUNTA(centang)/5*5)
    nilai akhir         = jumlah skor seluruh sub (maks 12 x 5 = 60)             (04-RKAP-PKG!H44)
    capaian %           = nilai akhir / nilai maks x 100                          (04-RKAP-PKG!H45)
    level capaian       = <55 L1, =55 L2, <=75 L3, <=90 L4, <=100 L5              (04-RKAP-PKG!G45)
    predikat            = <=55 Ahli Pertama, <=75 Ahli Muda, <=90 Ahli Madya, <=100 Ahli Utama (04-RKAP-PKG!F45)
"""
from typing import Any, Dict, Iterable, List, Optional


def skor_sub(centang: Optional[Iterable[int]]) -> int:
    return len({lv for lv in (centang or []) if isinstance(lv, int) and 1 <= lv <= 5})


def level_capaian(persen: float) -> Optional[str]:
    if not persen:
        return None
    if persen < 55:
        return 'Level 1'
    if persen == 55:
        return 'Level 2'
    if persen <= 75:
        return 'Level 3'
    if persen <= 90:
        return 'Level 4'
    return 'Level 5'


def predikat_jenjang(persen: float) -> Optional[str]:
    if not persen:
        return None
    if persen <= 55:
        return 'Terpenuhi pada Jenjang Jabatan Guru Ahli Pertama'
    if persen <= 75:
        return 'Terpenuhi pada Jenjang Jabatan Guru Ahli Muda'
    if persen <= 90:
        return 'Terpenuhi pada Jenjang Jabatan Guru Ahli Madya'
    return 'Terpenuhi pada Jenjang Jabatan Guru Ahli Utama'


def kode_sub(instrumen: Dict[str, Any]) -> List[str]:
    return [s['kode'] for k in instrumen.get('kompetensi') or [] for s in k.get('sub') or []]


def hitung_nilai(instrumen: Dict[str, Any], isian: Dict[str, Any]) -> Dict[str, Any]:
    """Skor per sub, nilai akhir/maks, capaian %, level, predikat, jumlah sub terisi, dan progres (0–100)."""
    sub = [s for k in instrumen.get('kompetensi') or [] for s in k.get('sub') or []]
    skor = {s['kode']: skor_sub(((isian or {}).get(s['kode']) or {}).get('centang')) for s in sub}
    total = sum(skor.values())
    maks = sum(len(s.get('indikator') or []) for s in sub)
    persen = round(total / maks * 100, 2) if maks else 0.0
    terisi = sum(1 for v in skor.values() if v > 0)
    return {
        'skor_per_indikator': skor, 'nilai_akhir': total, 'nilai_maks': maks, 'capaian_persen': persen,
        'level_capaian': level_capaian(persen), 'predikat': predikat_jenjang(persen),
        'terisi': terisi, 'jumlah_sub': len(sub), 'progres': round(terisi / len(sub) * 100) if sub else 0,
    }
