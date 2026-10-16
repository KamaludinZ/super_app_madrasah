"""Tindakan Tatib: rekap siswa berpoin, usulan SP otomatis dari ambang, dan status pembinaan manual.

Skema koleksi ada di tatib_poin.py (bagian TINDAKAN TATIB & PENGATURAN AMBANG SP).
Baca: peran input + lihat tatib (wajib_lihat_tatib). Ubah: peran input tatib (admin, guru tata tertib,
waka kesiswaan) — sama dengan hak input tatib.
"""
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends

from core import db, serialize_doc
from routers._shared import sembunyikan_siswa_nonaktif
from routers.tatib_poin import query_rekap, wajib_lihat_tatib
from tatib_poin import (KOLEKSI_POIN, KOLEKSI_TINDAKAN, STATUS_TINDAKAN_AWAL, TINGKAT_SP, ambil_ambang_sp, nilai_poin,
                        usulkan_sp)

router = APIRouter()


def _per_kategori(records: List[Dict]) -> List[Dict]:
    """[{nama, poin, jumlah}] per kategori, poin terbesar (mutlak) dulu."""
    per: Dict[str, Dict] = {}
    for r in records:
        nama = r.get('kategori_nama') or 'Lainnya'
        k = per.setdefault(nama, {'nama': nama, 'poin': 0, 'jumlah': 0})
        k['poin'] += nilai_poin(r)
        k['jumlah'] += 1
    return sorted(per.values(), key=lambda k: (-abs(k['poin']), k['nama']))


def rekap_siswa_berpoin(records: List[Dict], siswa: Dict[str, Dict], tindakan: Dict[str, Dict], ambang: Dict) -> List[Dict]:
    """Satu baris per siswa yang punya catatan poin: jumlah & kategori poin plus/minus, usulan SP, status pembinaan.
    `siswa`: {id: akun siswa saat ini}; `tindakan`: {siswa_id: dokumen tatib_tindakan}. Urut pelanggaran terbesar dulu."""
    per_siswa: Dict[str, List[Dict]] = {}
    for r in records:
        if r.get('siswa_id'):
            per_siswa.setdefault(r['siswa_id'], []).append(r)
    hasil = []
    for sid, rs in per_siswa.items():
        plus = [r for r in rs if nilai_poin(r) > 0]
        minus = [r for r in rs if nilai_poin(r) < 0]
        poin_negatif = sum(nilai_poin(r) for r in minus)
        akun = siswa.get(sid) or {}
        terbaru = max(rs, key=lambda r: (r.get('tanggal') or '', r.get('created_at') or ''))
        t = tindakan.get(sid) or {}
        hasil.append({
            'siswa_id': sid,
            'nisn': akun.get('nisn') or terbaru.get('siswa_nisn'),
            'nis': akun.get('nis') or terbaru.get('siswa_nis'),
            'nama': akun.get('full_name') or terbaru.get('siswa_nama') or '-',
            'kelas': akun.get('class_name') or terbaru.get('siswa_kelas'),
            'poin_positif': sum(nilai_poin(r) for r in plus),
            'kategori_positif': _per_kategori(plus),
            'poin_negatif': poin_negatif,
            'kategori_negatif': _per_kategori(minus),
            'jumlah_catatan': len(rs),
            'usulan_sp': usulkan_sp(poin_negatif, ambang),
            **{f: t.get(f, v) for f, v in STATUS_TINDAKAN_AWAL.items()},
            'catatan': t.get('catatan'),
            'diubah_pada': t.get('diubah_pada'),
            'diubah_oleh_nama': t.get('diubah_oleh_nama'),
        })
    hasil.sort(key=lambda s: (s['poin_negatif'], -s['poin_positif'], s['nama']))
    return hasil


async def _akun_siswa(ids: List[str]) -> Dict[str, Dict]:
    """{id: {nisn, nis, full_name, class_name}} dari akun siswa saat ini (kelas mengikuti rombel sekarang)."""
    akun = await db.users.find({'id': {'$in': ids}}, {'_id': 0, 'id': 1, 'nisn': 1, 'nis': 1, 'full_name': 1,
                                                       'student_class_id': 1}).to_list(len(ids) or 1)
    kelas_ids = list({a['student_class_id'] for a in akun if a.get('student_class_id')})
    kelas = {k['id']: k.get('name') for k in await db.classes.find({'id': {'$in': kelas_ids}}, {'_id': 0, 'id': 1, 'name': 1}).to_list(500)}
    return {a['id']: {**a, 'class_name': kelas.get(a.get('student_class_id'))} for a in akun}


@router.get("/tatib/tindakan")
async def daftar_tindakan(
    semester_id: Optional[str] = None,
    kelas: Optional[str] = None,
    cari: Optional[str] = None,
    usulan_sp: Optional[str] = None,
    user: Dict = Depends(wajib_lihat_tatib),
):
    """Siswa yang tercatat poin (plus & minus) beserta usulan SP otomatis & status pembinaan.
    Filter: semester_id (catatan semester itu; catatan lama tanpa semester_id menurut rentang tanggal),
    kelas (nama, kelas saat dicatat), cari (nama/NISN/NIS), usulan_sp (SP1|SP2|SP3|tanpa).
    -> {ambang, semester_id, items}."""
    query = await query_rekap(kelas, semester_id, None, None, None)
    await sembunyikan_siswa_nonaktif(query, 'siswa_id', db)
    records = await db[KOLEKSI_POIN].find(query, {'_id': 0}).to_list(20000)
    ids = list({r['siswa_id'] for r in records if r.get('siswa_id')})
    tindakan = {t['siswa_id']: t for t in await db[KOLEKSI_TINDAKAN].find(
        {'siswa_id': {'$in': ids}, 'semester_id': semester_id}, {'_id': 0}).to_list(len(ids) or 1)}
    ambang = await ambil_ambang_sp(db)
    items = rekap_siswa_berpoin(records, await _akun_siswa(ids), tindakan, ambang)

    kata = (cari or '').lower().split()
    if kata:
        items = [s for s in items if all(k in f"{s['nama']} {s['nisn'] or ''} {s['nis'] or ''}".lower() for k in kata)]
    if usulan_sp in TINGKAT_SP:
        items = [s for s in items if s['usulan_sp'] == usulan_sp]
    elif usulan_sp == 'tanpa':
        items = [s for s in items if not s['usulan_sp']]
    return serialize_doc({
        'ambang': {k: ambang[k] for k in ('sp1', 'sp2', 'sp3')},
        'semester_id': semester_id,
        'items': items,
    })
