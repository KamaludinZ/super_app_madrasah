"""Perakit data lembar cetak ujian (Daftar Hadir & Berita Acara) untuk SATU ruang, SATU jenjang, SATU sesi.

Sumber: pengaturan formulir (template teks & pola TTD), jadwal sesi (tanggal, jam, mapel per jenjang), peserta ruang
(penetapan sekali untuk seluruh ujian), daftar hadir (kiriman + TTD peserta, tanda izin/sakit), dan berita acara
pengawas (nama, NIP, catatan, TTD, rekap tersalin). Keluaran = dict masukan ujian_cetak_docx / ujian_cetak_pdf.
"""
from typing import Any, Dict, Optional

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


def _dasar(ujian: Dict[str, Any], formulir: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    f = formulir or {}
    return {
        'template': {**template_bawaan(ujian.get('jenis')), **(f.get('template') or {})},
        'pola_ttd': {'tampil_di_cetak': True, 'tinggi_mm': TINGGI_TTD_BAWAAN, **(f.get('pola_ttd') or {})},
        'tahun_pelajaran': ujian.get('tahun_pelajaran') or '',
    }


async def data_daftar_hadir(db, ujian: Dict[str, Any], formulir: Optional[Dict[str, Any]], ruang: Dict[str, Any], jenjang: int,
                            sesi: Dict[str, Any]) -> Dict[str, Any]:
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
        'mapel': (sesi.get('mapel') or {}).get(str(jenjang)) or '', 'ruang': ruang.get('nama_ruang') or '',
        'kota_tanggal': f"{d['template'].get('kota_ttd') or ''}, {tanggal_panjang(sesi['tanggal'])}",
        'pengawas': p_ba['pengawas'],
        'peserta': [{'nomor_peserta': p['nomor_peserta'] or '', 'nama': p['nama'], 'kelas': p['kelas'], 'ttd_png': ttd.get(p['id'])}
                    for p in peserta],
    }


async def data_berita_acara(db, ujian: Dict[str, Any], formulir: Optional[Dict[str, Any]], ruang: Dict[str, Any], jenjang: int,
                            sesi: Dict[str, Any]) -> Dict[str, Any]:
    p_ba = await _pengawas(db, ujian['id'], ruang['id'], sesi['id'])
    ba = p_ba['ba']
    r = (ba or {}).get('rekap', {}).get(str(jenjang))  # rekap tersalin saat berita acara dikirim
    if r is None:
        peserta = await peserta_ruang_ujian(db, ujian['id'], ruang['id'], jenjang=jenjang)
        status = await ambil_status_sesi(db, ujian['id'], sesi, [p['id'] for p in peserta])
        r = rekap_jenjang(peserta, status).get(jenjang, {'total': 0, 'nomor_hadir': [], 'nomor_tidak_hadir': []})
    return {
        **_dasar(ujian, formulir),
        'tanggal': sesi['tanggal'], 'jenjang': jenjang, 'jam_mulai': sesi.get('jam_mulai'), 'jam_selesai': sesi.get('jam_selesai'),
        'ruang': ruang.get('nama_ruang') or '', 'mapel': (sesi.get('mapel') or {}).get(str(jenjang)) or '',
        'jumlah_peserta': r.get('total') or 0, 'hadir': r.get('nomor_hadir') or [], 'tidak_hadir': r.get('nomor_tidak_hadir') or [],
        'catatan': (ba or {}).get('catatan') or '', 'pengawas': p_ba['pengawas'],
    }


PERAKIT = {'daftar_hadir': data_daftar_hadir, 'berita_acara': data_berita_acara}
