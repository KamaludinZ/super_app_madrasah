"""Rekomendasi Pengembangan Keprofesian Berkelanjutan (PKB) per guru per periode — dipilih dari opsi baku dan/atau
diisi bebas oleh penilai maupun kepala madrasah. Template resmi tidak memiliki sheet khusus; rekomendasi tampil di
aplikasi, kolom "Rekomendasi" rekap hasil PKG, dan berkas laporan per guru.

Opsi baku mengikuti unsur PKB (pengembangan diri, publikasi ilmiah, karya inovatif) serta tindak lanjut hasil PKG;
saran otomatis disesuaikan dengan level guru (RUBRIK-CAPAIAN: level rendah dibimbing, level tinggi mengimbaskan).
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pkg_skema import KOLEKSI_REKOMENDASI

OPSI_PKB: Dict[str, str] = {
    'diklat': 'Mengikuti diklat fungsional/pelatihan peningkatan kompetensi',
    'kolektif': 'Aktif dalam kegiatan kolektif guru (KKG/MGMP/KKM)',
    'pendampingan': 'Pendampingan/mentoring oleh rekan sejawat atau kepala madrasah',
    'supervisi': 'Supervisi akademik lanjutan dan observasi pembelajaran',
    'ptk': 'Melaksanakan penelitian tindakan kelas (PTK) dan publikasi ilmiah',
    'karya_inovatif': 'Menyusun karya inovatif (media/alat peraga, modul, teknologi tepat guna)',
    'pengimbasan': 'Mengimbaskan praktik baik sebagai narasumber/mentor bagi rekan sejawat',
}
FOKUS_KOMPETENSI: Dict[str, str] = {
    'pedagogik': 'Pedagogik', 'kepribadian': 'Kepribadian', 'sosial': 'Sosial', 'profesional': 'Profesional',
}
SARAN_PER_LEVEL = {1: ['diklat', 'pendampingan', 'supervisi'], 2: ['diklat', 'pendampingan', 'kolektif'],
                   3: ['kolektif', 'ptk'], 4: ['ptk', 'karya_inovatif', 'pengimbasan'], 5: ['pengimbasan', 'karya_inovatif', 'ptk']}


def saran_pkb(level_angka: Optional[int]) -> List[str]:
    return list(SARAN_PER_LEVEL.get(level_angka or 0, []))


def teks_rekomendasi(rek: Optional[Dict[str, Any]]) -> str:
    """Teks ringkas untuk kolom/lembar cetak: opsi terpilih, fokus kompetensi, lalu catatan bebas."""
    if not rek:
        return ''
    pilihan, dipilih_fokus = set(rek.get('pilihan_pkb') or []), set(rek.get('fokus_kompetensi') or [])
    bagian = [v for k, v in OPSI_PKB.items() if k in pilihan]
    fokus = [v for k, v in FOKUS_KOMPETENSI.items() if k in dipilih_fokus]
    teks = '; '.join(bagian)
    if fokus:
        teks = f"{teks} (fokus kompetensi {', '.join(fokus).lower()})" if teks else f"Fokus kompetensi {', '.join(fokus).lower()}"
    if rek.get('catatan'):
        teks = f"{teks}. {rek['catatan']}" if teks else rek['catatan']
    return teks


async def rekomendasi_guru(db, periode_id: str, guru_id: str) -> Optional[Dict[str, Any]]:
    return await db[KOLEKSI_REKOMENDASI].find_one({'periode_id': periode_id, 'guru_dinilai_id': guru_id}, {'_id': 0})


async def rekomendasi_periode(db, periode_id: str, guru_ids: Optional[List[str]] = None) -> Dict[str, Dict[str, Any]]:
    saring: Dict[str, Any] = {'periode_id': periode_id}
    if guru_ids is not None:
        saring['guru_dinilai_id'] = {'$in': list(guru_ids)}
    return {d['guru_dinilai_id']: d for d in await db[KOLEKSI_REKOMENDASI].find(saring, {'_id': 0}).to_list(10000)}


async def simpan_rekomendasi(db, periode_id: str, guru_id: str, pilihan: List[str], fokus: List[str],
                             catatan: Optional[str], aktor: Dict[str, Any], peran: str) -> Dict[str, Any]:
    """Simpan (ganti) rekomendasi PKB satu guru pada periode; penyusun terakhir & perannya dicatat."""
    sekarang = datetime.now(timezone.utc).isoformat()
    lama = await rekomendasi_guru(db, periode_id, guru_id)
    isi = {'pilihan_pkb': [k for k in OPSI_PKB if k in set(pilihan)], 'fokus_kompetensi': [k for k in FOKUS_KOMPETENSI if k in set(fokus)],
           'catatan': (catatan or '').strip() or None, 'disusun_oleh': aktor.get('id'), 'disusun_oleh_nama': aktor.get('full_name'),
           'peran_penyusun': peran, 'tanggal': sekarang}
    if lama:
        await db[KOLEKSI_REKOMENDASI].update_one({'id': lama['id']}, {'$set': isi})
        return {**lama, **isi}
    doc = {'id': str(uuid.uuid4()), 'periode_id': periode_id, 'guru_dinilai_id': guru_id, 'dibuat_pada': sekarang, **isi}
    await db[KOLEKSI_REKOMENDASI].insert_one(dict(doc))
    return doc
