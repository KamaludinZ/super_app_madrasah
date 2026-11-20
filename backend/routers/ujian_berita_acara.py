"""API Ujian Madrasah — Berita Acara (sisi panitia) & tanda tangan pengawas.

Membaca: admin, panitia ujian itu, kepala madrasah & waka kurikulum (menu 'berita_acara'). Kiriman berita acara
dilakukan pengawas lewat tautan publik (routers/ujian_publik.py).
"""
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from core import db, get_current_user
from routers.ujian import akses_ujian
from routers.ujian_formulir import jadwal_ujian
from ujian import KOLEKSI_RUANG
from ujian_berita_acara import KOLEKSI_BA, ambil_ttd_ba, rekap_ruang_sesi
from ujian_ruang import urut_nama_ruang

router = APIRouter()


@router.get("/ujian/{ujian_id}/berita-acara")
async def daftar_berita_acara(ujian_id: str, tanggal: str = '', user: Dict = Depends(get_current_user)):
    """Berita acara satu ujian per sesi per ruang (opsional satu tanggal): sudah/belum diisi, pengawas, jam kirim,
    jumlah hadir & tidak hadir (dari daftar hadir), catatan, dan kelengkapan daftar hadir ruang itu."""
    await akses_ujian(user, ujian_id, 'berita_acara')
    jadwal = [s for s in await jadwal_ujian(ujian_id) if not tanggal or s['tanggal'] == tanggal]
    ruang = sorted(await db[KOLEKSI_RUANG].find({'ujian_id': ujian_id}, {'_id': 0}).to_list(500),
                   key=lambda r: urut_nama_ruang(r.get('nama_ruang') or ''))
    ba = {(b['sesi_id'], b['ruang_id']): b for b in await db[KOLEKSI_BA].find({'ujian_id': ujian_id}, {'_id': 0}).to_list(5000)}
    hasil = []
    for s in jadwal:
        baris = []
        for r in ruang:
            b = ba.get((s['id'], r['id']))
            item = {'ruang_id': r['id'], 'nama_ruang': r['nama_ruang'], 'jenjang': r.get('jenjang', []), 'berita_acara': None}
            if b:
                item['berita_acara'] = {k: b.get(k) for k in ('id', 'pengawas_nama', 'pengawas_nip', 'waktu_kirim', 'catatan',
                                                              'jumlah_hadir', 'jumlah_izin', 'ada_ttd', 'rekap')}
                item['dh_lengkap'] = True
            else:
                item['dh_lengkap'] = (await rekap_ruang_sesi(db, ujian_id, r, s))['kelengkapan']['lengkap']
            baris.append(item)
        hasil.append({'sesi': s, 'ruang': baris, 'terisi': sum(1 for x in baris if x['berita_acara']), 'total': len(baris)})
    return {'items': hasil}


@router.get("/ujian/{ujian_id}/berita-acara/{berita_acara_id}/ttd")
async def ttd_berita_acara(ujian_id: str, berita_acara_id: str, user: Dict = Depends(get_current_user)):
    """PNG tanda tangan pengawas pada satu berita acara."""
    await akses_ujian(user, ujian_id, 'berita_acara')
    ba = await db[KOLEKSI_BA].find_one({'id': berita_acara_id, 'ujian_id': ujian_id}, {'_id': 0, 'id': 1})
    png = await ambil_ttd_ba(db, berita_acara_id) if ba else None
    if not png:
        raise HTTPException(404, "Tanda tangan tidak ditemukan")
    return Response(png, media_type='image/png', headers={'Cache-Control': 'private, max-age=300'})
