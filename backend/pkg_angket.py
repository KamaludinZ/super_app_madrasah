"""Angket penilaian 360° PKG (sejawat, peserta didik, orang tua/wali) mengikuti template resmi pkg_template_v2026.xlsx.

Butir angket dibaca dari sheet isian template (SEJAWAT, SISWA, ORTU: kolom C komponen, D nomor, E pernyataan) sehingga
urutan butir di aplikasi, angket cetak, dan berkas laporan selalu sama. Angket kertas dicetak dari bagian sheet
FORM-360-GR yang sesuai (identitas guru diisi, area cetak dibatasi bagian itu, sheet lain disembunyikan). Skor tiap
butir 0 (tidak ada bukti) / 1 (terpenuhi sebagian) / 2 (seluruhnya terpenuhi). DUDI tidak dipakai (khusus SMK).
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pkg_ambang import AMBANG_SEBUTAN_360, terapkan
from pkg_skema import KOLEKSI_ANGKET
from pkg_template import buka_template, isi_template_ke_bytes, muat_lebar_halaman, tampilkan_hanya

# form: rentang baris bagian FORM-360-GR (area cetak B:H); identitas: sel nama, NIP, tugas tambahan di bagian itu.
# baris: rentang baris butir pada sheet isian; kolom penilai: 10 blok (0/1/2) mulai kolom F, label nomor di baris 7.
JENIS_ANGKET: Dict[str, Dict[str, Any]] = {
    'sejawat': {'label': 'Teman Sejawat', 'sheet': 'SEJAWAT', 'baris': (9, 36), 'form': (2, 50), 'identitas': ('E6', 'E7', 'E8')},
    'siswa': {'label': 'Peserta Didik', 'sheet': 'SISWA', 'baris': (9, 48), 'form': (52, 124), 'identitas': ('E56', 'E57', 'E58')},
    'ortu': {'label': 'Orang Tua/Wali', 'sheet': 'ORTU', 'baris': (9, 16), 'form': (155, 188), 'identitas': ('E159', 'E160', 'E161')},
}
SHEET_FORM = 'FORM-360-GR'
SKOR_ANGKET = (0, 1, 2)
MAKS_RESPONDEN = 10  # template menyediakan 10 kolom penilai per sheet

_BUTIR: Dict[str, List[Dict[str, Any]]] = {}


class AngketTidakSesuai(Exception):
    """Sheet angket template tidak sesuai struktur yang diharapkan."""


def _baca_butir(wb, jenis: str) -> List[Dict[str, Any]]:
    cfg = JENIS_ANGKET[jenis]
    ws = wb[cfg['sheet']]
    butir, komponen = [], None
    for baris in range(cfg['baris'][0], cfg['baris'][1] + 1):
        if ws[f'C{baris}'].value:
            komponen = str(ws[f'C{baris}'].value).strip()
        nomor, teks = ws[f'D{baris}'].value, ws[f'E{baris}'].value
        if not isinstance(nomor, (int, float)) or not teks:
            raise AngketTidakSesuai(f"{cfg['sheet']}!D{baris}:E{baris} bukan butir angket.")
        butir.append({'no': len(butir) + 1, 'kode': f'{jenis}.{len(butir) + 1}', 'komponen': komponen,
                      'nomor': int(nomor), 'pernyataan': ' '.join(str(teks).split()), 'baris': baris})
    return butir


def butir_angket(jenis: str) -> List[Dict[str, Any]]:
    """Daftar butir angket satu jenis: [{no, kode, komponen, nomor, pernyataan, baris}] (dibaca sekali dari template)."""
    if jenis not in JENIS_ANGKET:
        raise KeyError(jenis)
    if jenis not in _BUTIR:
        wb = buka_template('instrumen')
        try:
            for j in JENIS_ANGKET:
                _BUTIR[j] = _baca_butir(wb, j)
        finally:
            wb.close()
    return _BUTIR[jenis]


def daftar_jenis() -> List[Dict[str, Any]]:
    """Jenis angket beserta jumlah butir & skor maksimum per responden (jumlah butir x 2)."""
    return [{'jenis': j, 'label': c['label'], 'sheet': c['sheet'], 'jumlah_butir': len(butir_angket(j)),
             'skor_maks': len(butir_angket(j)) * max(SKOR_ANGKET), 'maks_responden': MAKS_RESPONDEN}
            for j, c in JENIS_ANGKET.items()]


def isi_form_angket(wb, jenis: str, guru: Optional[Dict[str, Any]] = None) -> None:
    """Siapkan workbook untuk mencetak angket kertas satu jenis: identitas guru di bagian FORM-360-GR (kosong = titik-
    titik isian template dipertahankan), area cetak bagian itu saja, dan sheet lain disembunyikan."""
    cfg = JENIS_ANGKET[jenis]
    ws = wb[SHEET_FORM]
    if guru:
        for sel, nilai in zip(cfg['identitas'], (guru.get('nama'), guru.get('nip'), guru.get('tugas_tambahan'))):
            ws[sel] = f": {nilai or '-'}"
    awal, akhir = cfg['form']
    ws.print_area = f'B{awal}:H{akhir}'
    muat_lebar_halaman(ws, satu_halaman=False)  # kolom skor terakhir (H) melewati lebar kertas pada setelan template
    tampilkan_hanya(wb, [SHEET_FORM])


def angket_excel(jenis: str, guru: Optional[Dict[str, Any]] = None) -> bytes:
    """Berkas .xlsx angket kertas satu jenis dari template resmi (lihat isi_form_angket)."""
    return isi_template_ke_bytes('instrumen', lambda wb: isi_form_angket(wb, jenis, guru))


# ---------------------------------------------------------------- rekap jawaban & skor 360° (sheet SEJAWAT/SISWA/ORTU)

def nilai_responden(jawaban: List[int]) -> Dict[str, Any]:
    """Nilai satu responden seperti kolom penilai sheet angket: jumlah skor = sum(0/1/2), skor maks = jumlah butir x 2,
    nilai kinerja = jumlah skor / skor maks x 100, sebutan (<=50 Kurang ... <=100 Amat Baik)."""
    skor, maks = sum(jawaban), len(jawaban) * max(SKOR_ANGKET)
    nilai = skor / maks * 100 if maks else 0.0
    return {'skor': skor, 'skor_maks': maks, 'nilai': round(nilai, 2), 'sebutan': terapkan(AMBANG_SEBUTAN_360, nilai, kosong_bila_nol=False)}


def ringkas_jenis(jenis: str, responden: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Hasil satu jenis angket (sel AB6 'Hasil Nilai' = rata-rata nilai kinerja seluruh responden; AL40/AL52/AL20).
    Tanpa responden: nilai None (template menghasilkan #DIV/0!)."""
    nilai = [float(r['nilai_tepat']) if r.get('nilai_tepat') is not None else float(r['nilai']) for r in responden]
    rata = sum(nilai) / len(nilai) if nilai else None
    return {
        'jenis': jenis, 'label': JENIS_ANGKET[jenis]['label'], 'jumlah_responden': len(responden),
        'maks_responden': MAKS_RESPONDEN, 'nilai': round(rata, 2) if rata is not None else None, 'nilai_tepat': rata,
        'sebutan': terapkan(AMBANG_SEBUTAN_360, rata, kosong_bila_nol=False) if rata is not None else None,
    }


async def responden_guru(db, periode_id: str, guru_id: str, jenis: Optional[str] = None) -> List[Dict[str, Any]]:
    saring = {'periode_id': periode_id, 'guru_dinilai_id': guru_id, **({'jenis': jenis} if jenis else {})}
    docs = await db[KOLEKSI_ANGKET].find(saring, {'_id': 0}).to_list(100)
    docs.sort(key=lambda d: (list(JENIS_ANGKET).index(d['jenis']), d.get('urutan') or 0))
    return docs


async def skor_360(db, periode_id: str, guru_id: str) -> Dict[str, Any]:
    """Skor 360° satu guru pada periode: hasil per jenis (sejawat, siswa, ortu) dan `lengkap` (setiap jenis punya
    minimal satu responden)."""
    docs = await responden_guru(db, periode_id, guru_id)
    per_jenis = {j: ringkas_jenis(j, [d for d in docs if d['jenis'] == j]) for j in JENIS_ANGKET}
    return {'per_jenis': per_jenis, 'lengkap': all(v['jumlah_responden'] for v in per_jenis.values())}


async def skor_360_periode(db, periode_id: str, guru_ids: Optional[List[str]] = None) -> Dict[str, Dict[str, Any]]:
    """skor_360 untuk banyak guru sekaligus: {guru_id: {per_jenis, lengkap}}."""
    saring: Dict[str, Any] = {'periode_id': periode_id}
    if guru_ids is not None:
        saring['guru_dinilai_id'] = {'$in': list(guru_ids)}
    docs = await db[KOLEKSI_ANGKET].find(saring, {'_id': 0, 'guru_dinilai_id': 1, 'jenis': 1, 'nilai': 1, 'nilai_tepat': 1}).to_list(100000)
    hasil = {}
    for gid in set(guru_ids or []) | {d['guru_dinilai_id'] for d in docs}:
        milik = [d for d in docs if d['guru_dinilai_id'] == gid]
        per_jenis = {j: ringkas_jenis(j, [d for d in milik if d['jenis'] == j]) for j in JENIS_ANGKET}
        hasil[gid] = {'per_jenis': per_jenis, 'lengkap': all(v['jumlah_responden'] for v in per_jenis.values())}
    return hasil


class AngketPenuh(Exception):
    """Responden satu jenis sudah mencapai batas kolom penilai template."""


def _dokumen_jawaban(jawaban: List[int]) -> Dict[str, Any]:
    n = nilai_responden(jawaban)
    return {'jawaban': list(jawaban), 'skor': n['skor'], 'skor_maks': n['skor_maks'], 'nilai': n['nilai'],
            'nilai_tepat': n['skor'] / n['skor_maks'] * 100 if n['skor_maks'] else 0.0}


def periksa_jawaban(jenis: str, jawaban: List[int]) -> None:
    """Jumlah jawaban harus sama dengan jumlah butir angket jenis itu (ValueError bila tidak)."""
    n = len(butir_angket(jenis))
    if len(jawaban) != n:
        raise ValueError(f"Angket {JENIS_ANGKET[jenis]['label']} memiliki {n} butir; diterima {len(jawaban)} jawaban.")


async def tambah_responden(db, periode_id: str, guru_id: str, jenis: str, jawaban: List[int], nama: Optional[str],
                           aktor: Dict[str, Any]) -> Dict[str, Any]:
    """Simpan rekap jawaban satu responden pada kolom penilai kosong pertama (urutan 1–10)."""
    periksa_jawaban(jenis, jawaban)
    terpakai = {d.get('urutan') for d in await responden_guru(db, periode_id, guru_id, jenis)}
    urutan = next((i for i in range(1, MAKS_RESPONDEN + 1) if i not in terpakai), None)
    if urutan is None:
        raise AngketPenuh(f"Responden angket {JENIS_ANGKET[jenis]['label']} sudah {MAKS_RESPONDEN} (batas kolom penilai template).")
    sekarang = datetime.now(timezone.utc).isoformat()
    doc = {'id': str(uuid.uuid4()), 'periode_id': periode_id, 'guru_dinilai_id': guru_id, 'jenis': jenis, 'urutan': urutan,
           'nama_responden': nama, **_dokumen_jawaban(jawaban), 'diinput_oleh': aktor.get('id'),
           'diinput_oleh_nama': aktor.get('full_name'), 'tanggal_input': sekarang, 'diubah_pada': sekarang}
    await db[KOLEKSI_ANGKET].insert_one(dict(doc))
    return doc


async def ubah_responden(db, doc: Dict[str, Any], jawaban: List[int], nama: Optional[str]) -> Dict[str, Any]:
    periksa_jawaban(doc['jenis'], jawaban)
    perubahan = {**_dokumen_jawaban(jawaban), 'nama_responden': nama, 'diubah_pada': datetime.now(timezone.utc).isoformat()}
    await db[KOLEKSI_ANGKET].update_one({'id': doc['id']}, {'$set': perubahan})
    return {**doc, **perubahan}
