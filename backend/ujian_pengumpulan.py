"""Ujian Madrasah — agregasi status pengumpulan kisi-kisi & kartu soal per jenjang per mapel baku.

Sumber: `ujian_berkas` (satu dokumen per ujian + jenis + jenjang + mapel; status 'terkirim'). Dipakai halaman monitoring
publik (/publik/monitoring-ujian/{token}) dan panel admin. Logika barisnya sama dengan pengumpulanJenjang /
ringkasPengumpulan di frontend/src/lib/ujianMonitoringPublik.js.

KERAHASIAAN: proyeksi publik (berkas_publik) hanya memuat jenis, jenjang, mapel, nama PJ, dan waktu update — tanpa id,
nama/lokasi berkas, ukuran, atau isi. Kartu soal tidak pernah dapat diunduh dari jalur publik.
"""
from typing import Any, Dict, Iterable, List, Optional

import os

from ujian_info import JENIS_BERKAS, JENJANG_UJIAN, KOLEKSI_BERKAS, SUBFOLDER_BERKAS, baca_waktu, jalur_unggahan, mapel_jenjang

FIELD_BERKAS_INTERNAL = ('id', 'nama_file', 'ukuran_byte', 'mime_type', 'guru_pj_id', 'guru_pj_nama', 'updated_at', 'jumlah_unduh')

FIELD_BERKAS_PUBLIK = ('jenis', 'jenjang', 'mapel', 'guru_pj_nama', 'updated_at')


def _urut_waktu(iso: Any) -> float:
    d = baca_waktu(iso)
    return d.timestamp() if d else float('-inf')


def berkas_terkirim(docs: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Berkas yang dihitung: status terkirim, jenis & jenjang dikenal. Bila ada duplikat kunci (data lama), ambil yang
    paling akhir diperbarui."""
    pilih: Dict[tuple, Dict[str, Any]] = {}
    for d in docs or []:
        if d.get('status') != 'terkirim' or d.get('jenis') not in JENIS_BERKAS or d.get('jenjang') not in JENJANG_UJIAN:
            continue
        k = (d['jenis'], d['jenjang'], d.get('mapel'))
        if k not in pilih or _urut_waktu(d.get('updated_at')) > _urut_waktu(pilih[k].get('updated_at')):
            pilih[k] = d
    return list(pilih.values())


def ringkas_berkas(d: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    return {'guru_pj_nama': d.get('guru_pj_nama') or None, 'updated_at': d.get('updated_at') or None} if d else None


def baris_jenjang(docs: Iterable[Dict[str, Any]], jenjang: int, mapel: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Baris status satu jenjang untuk daftar mapel aktif `mapel` ([{kode, nama, urutan}], urutan baku):
    [{ nomor, kode, nama, kisi_kisi: {guru_pj_nama, updated_at}|None, kartu_soal: …|None, lengkap, terakhir }]."""
    peta = {(d['jenis'], d.get('mapel')): d for d in berkas_terkirim(docs) if d['jenjang'] == jenjang}
    hasil = []
    for i, m in enumerate(mapel):
        kisi, kartu = peta.get(('kisi_kisi', m['kode'])), peta.get(('kartu_soal', m['kode']))
        waktu = sorted((x['updated_at'] for x in (kisi, kartu) if x and x.get('updated_at')), key=_urut_waktu)
        hasil.append({'nomor': i + 1, 'kode': m['kode'], 'nama': m['nama'], 'kisi_kisi': ringkas_berkas(kisi),
                      'kartu_soal': ringkas_berkas(kartu), 'lengkap': bool(kisi and kartu), 'terakhir': waktu[-1] if waktu else None})
    return hasil


def ringkas_jenjang(baris: List[Dict[str, Any]]) -> Dict[str, int]:
    return {'total': len(baris), 'kisi_kisi': sum(1 for b in baris if b['kisi_kisi']),
            'kartu_soal': sum(1 for b in baris if b['kartu_soal']), 'lengkap': sum(1 for b in baris if b['lengkap'])}


def berkas_publik(docs: Iterable[Dict[str, Any]], mapel_aktif: Dict[int, Iterable[str]]) -> List[Dict[str, Any]]:
    """Daftar status untuk publik: hanya berkas terkirim pada mapel baku aktif jenjangnya, field dibatasi
    FIELD_BERKAS_PUBLIK, urut jenjang -> urutan mapel -> jenis."""
    urutan = {(j, k): i for j, kode in mapel_aktif.items() for i, k in enumerate(kode)}
    hasil = [{f: d.get(f) for f in FIELD_BERKAS_PUBLIK} for d in berkas_terkirim(docs) if (d['jenjang'], d.get('mapel')) in urutan]
    return sorted(hasil, key=lambda b: (b['jenjang'], urutan[(b['jenjang'], b['mapel'])], JENIS_BERKAS.index(b['jenis'])))


async def agregasi_pengumpulan(db, ujian_id: str) -> Dict[str, Any]:
    """Status pengumpulan satu ujian -> { berkas (publik), jenjang: { '7': { ringkasan, baris } , … }, terakhir }.
    Mapel mengikuti master ujian_mapel_baku (mapel nonaktif tidak dihitung)."""
    docs = await db[KOLEKSI_BERKAS].find({'ujian_id': ujian_id, 'status': 'terkirim'}, {'_id': 0}).to_list(1000)
    mapel = {j: await mapel_jenjang(db, j) for j in JENJANG_UJIAN}
    jenjang = {}
    for j in JENJANG_UJIAN:
        baris = baris_jenjang(docs, j, mapel[j])
        jenjang[str(j)] = {'ringkasan': ringkas_jenjang(baris), 'baris': baris}
    publik = berkas_publik(docs, {j: [m['kode'] for m in mapel[j]] for j in JENJANG_UJIAN})
    waktu = sorted((b['updated_at'] for b in publik if b.get('updated_at')), key=_urut_waktu)
    return {'berkas': publik, 'jenjang': jenjang, 'terakhir': waktu[-1] if waktu else None}


async def status_internal(db, ujian_id: str) -> Dict[str, Any]:
    """Status pengumpulan untuk admin & pemantau (ber-login): seperti agregasi_pengumpulan, tetapi tiap baris memuat
    metadata berkas (id, nama_file, ukuran, jumlah_unduh — tanpa lokasi di disk) dan nama PJ yang dipilih pengunggah
    (pj: [nama] dari kisi-kisi & kartu soal). -> { jenjang: { '7': { ringkasan, baris } }, terakhir,
    belum_mengirim: [{ jenjang, mapel, nama, pj, kurang }] }"""
    docs = await db[KOLEKSI_BERKAS].find({'ujian_id': ujian_id, 'status': 'terkirim'}, {'_id': 0}).to_list(1000)
    peta = {(d['jenis'], d['jenjang'], d.get('mapel')): d for d in berkas_terkirim(docs)}
    hasil, belum, semua_waktu = {}, [], []
    for j in JENJANG_UJIAN:
        baris = baris_jenjang(docs, j, await mapel_jenjang(db, j))
        for b in baris:
            for jenis in JENIS_BERKAS:
                d = peta.get((jenis, j, b['kode']))
                b[jenis] = {**{f: d.get(f) for f in FIELD_BERKAS_INTERNAL},  # ada_di_disk: False = tercatat tetapi berkas hilang
                            'ada_di_disk': bool(d.get('nama_berkas')) and os.path.isfile(jalur_unggahan(SUBFOLDER_BERKAS, d['nama_berkas']))} if d else None
            b['pj'] = list(dict.fromkeys(x['guru_pj_nama'] for x in (b['kisi_kisi'], b['kartu_soal']) if x and x.get('guru_pj_nama')))
            if b['terakhir']:
                semua_waktu.append(b['terakhir'])
            if not b['lengkap']:
                belum.append({'jenjang': j, 'mapel': b['kode'], 'nama': b['nama'], 'pj': b['pj'],
                              'kurang': [jenis for jenis in JENIS_BERKAS if not b[jenis]]})
        hasil[str(j)] = {'ringkasan': ringkas_jenjang(baris), 'baris': baris}
    semua_waktu.sort(key=_urut_waktu)
    return {'jenjang': hasil, 'terakhir': semua_waktu[-1] if semua_waktu else None, 'belum_mengirim': belum}
