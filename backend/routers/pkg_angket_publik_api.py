"""API publik angket 360° online PKG — tanpa login, dibuka lewat satu tautan per periode (/public/angket-360/<token>,
token dari GET /pkg/angket/tautan). Responden memilih jenis angket (sejawat, peserta didik, orang tua/wali), menulis
namanya, memilih guru yang dinilai, mengisi skor 0/1/2 setiap butir, lalu menandatangani di kanvas.

Jawaban disimpan sama seperti rekap angket kertas (pkg_angket, sumber 'publik') sehingga ikut skor 360°, sheet
SEJAWAT/SISWA/ORTU, dan nilai akhir; tanda tangan disimpan terpisah (pkg_angket_ttd). Hanya diterima selama tautan
aktif (sakelar buka/tutup kepala madrasah) dan periode berjalan, maks. 10 responden per jenis per guru (kolom penilai
template). Satu nama responden hanya sekali per guru
per jenis. Data yang dibuka ke publik hanya nama periode, butir angket, serta nama & mata pelajaran guru yang dinilai.
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Path, Request

from core import db
from pkg_akses import PERAN_KEPALA
from pkg_angket import (
    JENIS_ANGKET, MAKS_RESPONDEN, AngketPenuh, butir_angket, olah_tanda_tangan, responden_guru, tambah_responden,
)
from pkg_audit import catat_audit_pkg
from pkg_skema import KOLEKSI_ANGKET, KOLEKSI_ANGKET_TAUTAN, KOLEKSI_ANGKET_TTD, KOLEKSI_PERIODE, KOLEKSI_SK, AngketPublikRequest
from pkg_template import TemplateTidakTersedia

router = APIRouter()

POLA_TOKEN = r'^[A-Za-z0-9_-]{16,64}$'


async def _konteks_tautan(token: str) -> tuple:
    """(periode, sk aktif periode, pesan tutup) milik token tautan angket; 404 bila token tidak dikenal (mis. sudah
    diganti). Pesan tutup None = pengisian dibuka."""
    t = await db[KOLEKSI_ANGKET_TAUTAN].find_one({'token': token}, {'_id': 0, 'periode_id': 1, 'aktif': 1})
    periode = await db[KOLEKSI_PERIODE].find_one({'id': t['periode_id']}, {'_id': 0}) if t else None
    if not periode:
        raise HTTPException(404, 'Tautan angket tidak ditemukan atau sudah tidak berlaku.')
    sk = await db[KOLEKSI_SK].find_one({'periode_id': periode['id'], 'is_active': True}, {'_id': 0})
    if not t.get('aktif', True):
        tutup = 'Pengisian angket sudah ditutup oleh madrasah. Terima kasih atas partisipasi Anda.'
    elif periode.get('status') != 'berjalan':
        tutup = 'Periode penilaian kinerja ini tidak sedang berjalan; pengisian angket ditutup.'
    else:
        tutup = None
    return periode, sk, tutup


async def _guru_dinilai(sk: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Guru yang dinilai pada SK (kepala madrasah tidak dinilai), urut nama: [{id, nama, mapel}]."""
    ids = list(dict.fromkeys((sk or {}).get('dinilai_ids') or []))
    if not ids:
        return []
    akun = {u['id']: u for u in await db.users.find({'id': {'$in': ids}}, {'_id': 0, 'id': 1, 'full_name': 1, 'roles': 1}).to_list(len(ids))}
    snap = (sk or {}).get('snapshot_anggota') or {}
    hasil = []
    for gid in ids:
        u, s = akun.get(gid) or {}, snap.get(gid) or {}
        nama = s.get('nama') or u.get('full_name')
        if nama and PERAN_KEPALA not in (u.get('roles') or []):
            hasil.append({'id': gid, 'nama': nama, 'mapel': s.get('mapel')})
    hasil.sort(key=lambda g: g['nama'].lower())
    return hasil


def _kunci_nama(nama: Optional[str]) -> str:
    return ' '.join((nama or '').split()).casefold()


@router.get("/public/pkg/angket/{token}")
async def angket_publik_api(token: str = Path(..., pattern=POLA_TOKEN)):
    """Isi halaman angket online: periode, butir setiap jenis angket, dan guru yang dinilai beserta jumlah responden
    yang sudah mengisi per jenis (untuk dropdown). Tautan ditutup / periode tidak berjalan: `terbuka` False, `pesan`
    alasannya, dan daftar guru kosong."""
    periode, sk, tutup = await _konteks_tautan(token)
    terbuka = tutup is None
    try:
        jenis = [{'jenis': j, 'label': c['label'], 'jumlah_butir': len(butir_angket(j)),
                  'butir': [{k: b[k] for k in ('no', 'komponen', 'nomor', 'pernyataan')} for b in butir_angket(j)]}
                 for j, c in JENIS_ANGKET.items()]
    except TemplateTidakTersedia as e:
        raise HTTPException(503, str(e)) from e
    guru = await _guru_dinilai(sk) if terbuka else []
    jumlah: Dict[tuple, int] = {}
    if guru:
        for d in await db[KOLEKSI_ANGKET].find({'periode_id': periode['id'], 'guru_dinilai_id': {'$in': [g['id'] for g in guru]}},
                                               {'_id': 0, 'guru_dinilai_id': 1, 'jenis': 1}).to_list(100000):
            jumlah[(d['guru_dinilai_id'], d['jenis'])] = jumlah.get((d['guru_dinilai_id'], d['jenis']), 0) + 1
    return {
        'periode': {k: periode.get(k) for k in ('nama_periode', 'tahun_pelajaran', 'semester')},
        'terbuka': terbuka, 'pesan': tutup, 'maks_responden': MAKS_RESPONDEN, 'jenis': jenis,
        'guru': [{**g, 'jumlah': {j: jumlah.get((g['id'], j), 0) for j in JENIS_ANGKET}} for g in guru],
    }


@router.post("/public/pkg/angket/{token}/jawaban")
async def isi_angket_publik_api(data: AngketPublikRequest, request: Request, token: str = Path(..., pattern=POLA_TOKEN)):
    """Simpan jawaban satu responden angket online beserta tanda tangannya. 404 tautan tidak berlaku; 409 tautan
    ditutup / periode tidak berjalan, kuota 10 responden penuh, atau nama responden sudah mengisi untuk guru & jenis
    yang sama; 422 guru di luar daftar, jumlah jawaban tidak sesuai butir, atau tanda tangan kosong/tidak sah."""
    periode, sk, tutup = await _konteks_tautan(token)
    if tutup:
        raise HTTPException(409, tutup)
    guru = next((g for g in await _guru_dinilai(sk) if g['id'] == data.guru_id), None)
    if not guru:
        raise HTTPException(422, 'Guru yang dinilai tidak ditemukan pada daftar periode ini.')
    label = JENIS_ANGKET[data.jenis_angket]['label']
    lama = await responden_guru(db, periode['id'], data.guru_id, data.jenis_angket)
    if any(_kunci_nama(r.get('nama_responden')) == _kunci_nama(data.nama_responden) for r in lama):
        raise HTTPException(409, f"{data.nama_responden} sudah mengisi angket {label} untuk {guru['nama']}.")
    try:
        png = olah_tanda_tangan(data.tanda_tangan)
        doc = await tambah_responden(db, periode['id'], data.guru_id, data.jenis_angket, data.jawaban, data.nama_responden,
                                     None, sumber='publik', tambahan={'ada_ttd': True})
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
    except AngketPenuh as e:
        raise HTTPException(409, f"Angket {label} untuk {guru['nama']} sudah diisi {MAKS_RESPONDEN} responden (kuota penuh).") from e
    except TemplateTidakTersedia as e:
        raise HTTPException(503, str(e)) from e
    await db[KOLEKSI_ANGKET_TTD].insert_one({'responden_id': doc['id'], 'png': png, 'dibuat_pada': doc['tanggal_input']})
    await catat_audit_pkg(db, 'angket_isi_publik', {'full_name': f'{data.nama_responden} (responden online)'},
                          {'periode_id': periode['id'], 'guru_id': data.guru_id, 'jenis_angket': data.jenis_angket,
                           'urutan': doc['urutan'], 'nilai': doc['nilai']}, request=request)
    jumlah = await db[KOLEKSI_ANGKET].count_documents({'periode_id': periode['id'], 'guru_dinilai_id': data.guru_id, 'jenis': data.jenis_angket})
    return {'jenis': data.jenis_angket, 'label': label, 'guru_nama': guru['nama'], 'urutan': doc['urutan'],
            'jumlah_responden': jumlah, 'maks_responden': MAKS_RESPONDEN}
