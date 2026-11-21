"""Perakit data lembar cetak ujian (Daftar Hadir & Berita Acara) untuk SATU ruang dan SATU sesi, dalam dua mode:
- per jenjang per ruang (`jenjang` = 7/8/9): hanya peserta jenjang itu (ruang campuran dicetak per jenjang);
- per ruang (`jenjang` = None): SELURUH jenjang di ruang itu dalam satu dokumen (kelas "7 dan 8", mapel per jenjang).

Sumber: pengaturan formulir (template teks & pola TTD), jadwal sesi (tanggal, jam, mapel per jenjang), peserta ruang
(penetapan sekali untuk seluruh ujian), daftar hadir (kiriman + TTD peserta, tanda izin/sakit), dan berita acara
pengawas (nama, NIP, catatan, TTD, rekap tersalin). Keluaran = dict masukan ujian_cetak_docx / ujian_cetak_pdf.
"""
from typing import Any, Dict, List, Optional

from ujian_berita_acara import KOLEKSI_BA, ambil_ttd_ba
from ujian_cetak_docx import hari_tanggal, jam_titik, tanggal_panjang
from ujian_formulir import TINGGI_TTD_BAWAAN, template_bawaan
from ujian_kehadiran import KOLEKSI_DH_TTD, ambil_status_sesi, rekap_jenjang
from ujian_ruang import peserta_ruang_ujian


def _pukul(sesi: Dict[str, Any]) -> str:
    return f"{jam_titik(sesi.get('jam_mulai'))} – {jam_titik(sesi.get('jam_selesai'))} WIB"


async def _pengawas(db, ujian_id: str, ruang_id: str, sesi_id: str) -> Dict[str, Any]:
    ba = await db[KOLEKSI_BA].find_one({'ujian_id': ujian_id, 'ruang_id': ruang_id, 'sesi_id': sesi_id}, {'_id': 0})
    if not ba:
        return {'ba': None, 'pengawas': {'nama': '', 'nip': '', 'ttd_png': None}}
    return {'ba': ba, 'pengawas': {'nama': ba.get('pengawas_nama') or '', 'nip': ba.get('pengawas_nip') or '',
                                   'ttd_png': await ambil_ttd_ba(db, ba['id'])}}


def label_jenjang(jenjang: List[int]) -> str:
    """[7] -> '7'; [7, 8] -> '7 dan 8'; [7, 8, 9] -> '7, 8 dan 9'."""
    j = [str(x) for x in jenjang]
    return ' dan '.join([', '.join(j[:-1]), j[-1]]) if len(j) > 1 else ''.join(j)


def jenjang_cetak(ruang: Dict[str, Any], jenjang: Optional[int]) -> List[int]:
    """Jenjang yang masuk dokumen: satu jenjang (mode per jenjang) atau seluruh jenjang ruang (mode per ruang)."""
    return [jenjang] if jenjang is not None else sorted(ruang.get('jenjang') or [])


def mapel_cetak(sesi: Dict[str, Any], jenjang: List[int]) -> str:
    """Mapel sesi untuk jenjang dokumen. Beberapa jenjang dengan mapel berbeda -> 'Matematika (kelas 7); IPA (kelas 8)'."""
    m = sesi.get('mapel') or {}
    nilai = [(j, m.get(str(j)) or '') for j in jenjang]
    unik = list(dict.fromkeys(v for _, v in nilai if v))
    if len(unik) <= 1:
        return unik[0] if unik else ''
    return '; '.join(f"{v or '-'} (kelas {j})" for j, v in nilai)


def _dasar(ujian: Dict[str, Any], formulir: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    f = formulir or {}
    return {
        'template': {**template_bawaan(ujian.get('jenis')), **(f.get('template') or {})},
        'pola_ttd': {'tampil_di_cetak': True, 'tinggi_mm': TINGGI_TTD_BAWAAN, **(f.get('pola_ttd') or {})},
        'tahun_pelajaran': ujian.get('tahun_pelajaran') or '',
    }


async def data_daftar_hadir(db, ujian: Dict[str, Any], formulir: Optional[Dict[str, Any]], ruang: Dict[str, Any], jenjang: Optional[int],
                            sesi: Dict[str, Any]) -> Dict[str, Any]:
    """jenjang None = per ruang: seluruh peserta ruang (semua jenjang) urut nomor peserta dalam satu daftar hadir."""
    peserta = await peserta_ruang_ujian(db, ujian['id'], ruang['id'], jenjang=jenjang)
    status = await ambil_status_sesi(db, ujian['id'], sesi, [p['id'] for p in peserta])
    ids_hadir = {status[p['id']]['kehadiran']['id']: p['id'] for p in peserta
                 if (status.get(p['id']) or {}).get('status') == 'hadir' and (status[p['id']].get('kehadiran') or {}).get('id')}
    ttd = {}
    if ids_hadir:
        for t in await db[KOLEKSI_DH_TTD].find({'kehadiran_id': {'$in': list(ids_hadir)}}, {'_id': 0}).to_list(500):
            ttd[ids_hadir[t['kehadiran_id']]] = bytes(t['png']) if t.get('png') else None
    p_ba = await _pengawas(db, ujian['id'], ruang['id'], sesi['id'])
    d = _dasar(ujian, formulir)
    return {
        **d,
        'hari_tanggal': hari_tanggal(sesi['tanggal']), 'pukul': _pukul(sesi),
        'mapel': mapel_cetak(sesi, jenjang_cetak(ruang, jenjang)), 'ruang': ruang.get('nama_ruang') or '',
        'kota_tanggal': f"{d['template'].get('kota_ttd') or ''}, {tanggal_panjang(sesi['tanggal'])}",
        'pengawas': p_ba['pengawas'],
        'peserta': [{'nomor_peserta': p['nomor_peserta'] or '', 'nama': p['nama'], 'kelas': p['kelas'], 'ttd_png': ttd.get(p['id'])}
                    for p in peserta],
    }


async def data_berita_acara(db, ujian: Dict[str, Any], formulir: Optional[Dict[str, Any]], ruang: Dict[str, Any], jenjang: Optional[int],
                            sesi: Dict[str, Any]) -> Dict[str, Any]:
    """jenjang None = per ruang: satu berita acara untuk seluruh jenjang ruang (jumlah & nomor peserta digabung)."""
    p_ba = await _pengawas(db, ujian['id'], ruang['id'], sesi['id'])
    ba = p_ba['ba']
    daftar = jenjang_cetak(ruang, jenjang)
    tersalin = (ba or {}).get('rekap') or {}  # rekap tersalin saat berita acara dikirim
    if not all(str(j) in tersalin for j in daftar):
        peserta = await peserta_ruang_ujian(db, ujian['id'], ruang['id'], jenjang=jenjang)
        status = await ambil_status_sesi(db, ujian['id'], sesi, [p['id'] for p in peserta])
        hitung = rekap_jenjang(peserta, status)
        tersalin = {**{str(j): v for j, v in hitung.items()}, **tersalin}
    kosong = {'total': 0, 'nomor_hadir': [], 'nomor_tidak_hadir': []}
    rekap = [tersalin.get(str(j)) or kosong for j in daftar]
    return {
        **_dasar(ujian, formulir),
        'tanggal': sesi['tanggal'], 'jenjang': label_jenjang(daftar), 'jam_mulai': sesi.get('jam_mulai'), 'jam_selesai': sesi.get('jam_selesai'),
        'ruang': ruang.get('nama_ruang') or '', 'mapel': mapel_cetak(sesi, daftar),
        'jumlah_peserta': sum(r.get('total') or 0 for r in rekap),
        'hadir': [n for r in rekap for n in (r.get('nomor_hadir') or [])],
        'tidak_hadir': [n for r in rekap for n in (r.get('nomor_tidak_hadir') or [])],
        'catatan': (ba or {}).get('catatan') or '', 'pengawas': p_ba['pengawas'],
    }


PERAKIT = {'daftar_hadir': data_daftar_hadir, 'berita_acara': data_berita_acara}
