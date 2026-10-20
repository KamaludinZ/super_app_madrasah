"""Nilai akhir PK Guru dengan penilaian 360° dan kehadiran — format penghitungan sheet 05-RKAP-PKGR template resmi.

    NKG (atasan)              = total skor kompetensi / 60 x 100                     (F32 = D35)
    Nilai kompetensi guru     = NKG x 70% + rerata kuesioner sejawat x 10%
                                + rerata kuesioner siswa x 10% + rerata kuesioner ortu x 10%   (F40; proporsi per jenjang)
    Indeks kehadiran          = INDEK-HDIR!K29                                          (E42)
    Nilai akhir PK Guru       = nilai kompetensi guru x indeks kehadiran                (E43)
    Tingkat capaian           = predikat jenjang (E44) & "pada Level n" (F44) dari nilai akhir
Komponen 360° tanpa responden dihitung 0 (template akan menampilkan #DIV/0!) dan ditandai belum lengkap; kehadiran
yang belum diinput dihitung 100% (template kosong) dan ditandai belum diinput.
"""
from typing import Any, Dict, Optional

from pkg_ambang import AMBANG_LEVEL, AMBANG_PREDIKAT_JENJANG, JENJANG, proporsi, terapkan

LABEL_KOMPONEN = {'atasan': 'Atasan (Penilai)', 'sejawat': 'Rerata Kuesioner Guru', 'siswa': 'Rerata Kuesioner Siswa',
                  'ortu': 'Rerata Kuesionar Ortu', 'dudi': 'Rerata Kuesioner DuDi'}


def hitung_nilai_akhir(nkg: Optional[float], skor_360: Optional[Dict[str, Any]], kehadiran: Optional[Dict[str, Any]],
                       jenjang: Optional[str] = None) -> Dict[str, Any]:
    """`skor_360` = pkg_angket.skor_360 (per_jenis.{jenis}.nilai_tepat), `kehadiran` = pkg_kehadiran.kehadiran_guru
    (indeks, terisi, jumlah.jumlah_tidak_hadir). Hasil: komponen (baris 35–39), nilai kompetensi guru, indeks
    kehadiran, nilai akhir, predikat & level, serta penanda kelengkapan."""
    bobot = proporsi(jenjang)
    per_jenis = (skor_360 or {}).get('per_jenis') or {}
    komponen, kurang = [], []
    for kunci, p in bobot.items():
        if kunci == 'atasan':
            hasil = nkg
        else:
            j = per_jenis.get(kunci) or {}
            hasil = j.get('nilai_tepat') if j.get('nilai_tepat') is not None else j.get('nilai')
            if hasil is None and p:
                kurang.append(kunci)
        komponen.append({'kunci': kunci, 'label': LABEL_KOMPONEN[kunci], 'hasil': hasil, 'proporsi': p,
                         'nilai': (hasil or 0) * p, 'jumlah_responden': (per_jenis.get(kunci) or {}).get('jumlah_responden')})
    nilai_kompetensi = sum(k['nilai'] for k in komponen)
    indeks = (kehadiran or {}).get('indeks', 1.0)
    akhir = nilai_kompetensi * indeks
    level = terapkan(AMBANG_LEVEL, akhir)
    return {
        'jenjang': (jenjang or JENJANG), 'komponen': komponen, 'jumlah_proporsi': sum(bobot.values()),
        'nilai_kompetensi': round(nilai_kompetensi, 2), 'nilai_kompetensi_tepat': nilai_kompetensi,
        'tidak_hadir_hari': ((kehadiran or {}).get('jumlah') or {}).get('jumlah_tidak_hadir', 0.0),
        'indeks_kehadiran': indeks, 'indeks_kehadiran_persen': round(indeks * 100, 2),
        'nilai_akhir': round(akhir, 2), 'nilai_akhir_tepat': akhir,
        'predikat': terapkan(AMBANG_PREDIKAT_JENJANG, akhir), 'level': level,
        'level_teks': f'pada {level}' if level else None,
        'lengkap': nkg is not None and not kurang and bool((kehadiran or {}).get('terisi')),
        'angket_kurang': kurang, 'kehadiran_terisi': bool((kehadiran or {}).get('terisi')),
    }
