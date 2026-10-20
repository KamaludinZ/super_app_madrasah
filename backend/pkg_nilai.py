"""Perhitungan nilai PKG mengikuti rumus template resmi pkg_template_v2026.xlsx (sama dengan frontend lib/pkgPenilaian).

    skor sub-kompetensi = jumlah indikator perilaku (Level 1–5) yang dicentang   (KOMP-n!K6 = COUNTA(centang)/5*5)
    nilai akhir         = jumlah skor seluruh sub (maks 12 x 5 = 60)             (04-RKAP-PKG!H44)
    capaian %           = nilai akhir / nilai maks x 100                          (04-RKAP-PKG!H45)
    level capaian       = <55 L1, =55 L2, <=75 L3, <=90 L4, <=100 L5              (04-RKAP-PKG!G45)
    predikat            = <=55 Ahli Pertama, <=75 Ahli Muda, <=90 Ahli Madya, <=100 Ahli Utama (04-RKAP-PKG!F45)
Ambang diambil dari pkg_ambang (satu sumber dengan cetak & frontend).
"""
from typing import Any, Dict, Iterable, List, Optional

from pkg_ambang import AMBANG_LEVEL, AMBANG_PREDIKAT_JENJANG, terapkan


def skor_sub(centang: Optional[Iterable[int]]) -> int:
    return len({lv for lv in (centang or []) if isinstance(lv, int) and 1 <= lv <= 5})


def level_capaian(persen: float) -> Optional[str]:
    return terapkan(AMBANG_LEVEL, persen)


def predikat_jenjang(persen: float) -> Optional[str]:
    return terapkan(AMBANG_PREDIKAT_JENJANG, persen)


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


def tingkat_kompetensi(skor: int) -> Optional[str]:
    """Tingkat kompetensi sub dari nilai rating 1–5 (04-RKAP-PKG!G29:G43); kosong bila belum ada centang."""
    return f'Level {skor}' if 1 <= skor <= 5 else None


def rekap_model_kompetensi(instrumen: Dict[str, Any], isian: Dict[str, Any]) -> Dict[str, Any]:
    """Rekapitulasi hasil penilaian model kompetensi guru (04-RKAP-PKG) dan format penghitungan NKG (05-RKAP-PKGR
    baris 27–32): nilai rating & tingkat per sub, jumlah skor per kompetensi (KOMP-1..KOMP (4)), total, dan
    NKG = total / skor maks x 100 beserta level & predikat jenjangnya."""
    nilai = hitung_nilai(instrumen, isian)
    skor = nilai['skor_per_indikator']
    kompetensi, no = [], 0
    for urut, k in enumerate(instrumen.get('kompetensi') or [], 1):
        sub = []
        for s in k.get('sub') or []:
            no += 1
            sub.append({'no': no, 'kode': s['kode'], 'nama': s.get('nama'), 'nilai_rating': skor.get(s['kode'], 0),
                        'tingkat': tingkat_kompetensi(skor.get(s['kode'], 0)), 'skor_maks': len(s.get('indikator') or [])})
        kompetensi.append({
            'kode': k.get('kode'), 'nama': k.get('nama'), 'label': f'KOMPETENSI {urut}',
            'jumlah_skor': sum(x['nilai_rating'] for x in sub), 'skor_maks': sum(x['skor_maks'] for x in sub), 'sub': sub,
        })
    return {
        'kompetensi': kompetensi, 'total_skor': nilai['nilai_akhir'], 'skor_maks': nilai['nilai_maks'],
        'nkg': nilai['capaian_persen'], 'level_capaian': nilai['level_capaian'], 'predikat': nilai['predikat'],
        'terisi': nilai['terisi'], 'jumlah_sub': nilai['jumlah_sub'],
    }
