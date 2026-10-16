"""Tindakan Tatib: rekap siswa berpoin, usulan SP otomatis dari ambang, dan status pembinaan manual.

Skema koleksi ada di tatib_poin.py (bagian TINDAKAN TATIB & PENGATURAN AMBANG SP).
Baca: peran input + lihat tatib (wajib_lihat_tatib). Ubah: peran input tatib (admin, guru tata tertib,
waka kesiswaan) — sama dengan hak input tatib.
"""
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from pymongo.errors import DuplicateKeyError

from core import db, log_audit, serialize_doc
from routers._shared import sembunyikan_siswa_nonaktif
from routers.tatib_poin import query_rekap, wajib_input_tatib, wajib_lihat_tatib
from tatib_poin import (KOLEKSI_POIN, KOLEKSI_RIWAYAT_TINDAKAN, KOLEKSI_TINDAKAN, STATUS_PANGGILAN_WALI, STATUS_RTLPD,
                        STATUS_SP, STATUS_TINDAKAN_AWAL, TINGKAT_SP, ambang_berikutnya, ambil_ambang_sp,
                        entri_riwayat_tindakan, nilai_poin, perubahan_status, usulan_lebih_tinggi, usulkan_sp)

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


async def _poin_negatif_siswa(siswa_id: str, semester_id: Optional[str]) -> Dict:
    query = await query_rekap(None, semester_id, None, None, None)
    query = {'$and': [query, {'siswa_id': siswa_id}]} if query else {'siswa_id': siswa_id}
    records = await db[KOLEKSI_POIN].find(query, {'_id': 0, 'poin': 1, 'tatib_poin': 1}).to_list(5000)
    return {'poin_negatif': sum(n for n in (nilai_poin(r) for r in records) if n < 0), 'jumlah_catatan': len(records)}


@router.get("/tatib/tindakan/usulan")
async def ringkasan_usulan_sp(semester_id: Optional[str] = None, user: Dict = Depends(wajib_lihat_tatib)):
    """Ringkasan usulan SP otomatis: jumlah siswa per tingkat dan yang perlu ditinjau
    (usulan lebih berat dari keterangan SP yang ditetapkan). -> {ambang, semester_id, jumlah, perlu_ditinjau}."""
    data = await daftar_tindakan(semester_id=semester_id, user=user)
    jumlah = {sp: 0 for sp in TINGKAT_SP}
    for s in data['items']:
        if s['usulan_sp']:
            jumlah[s['usulan_sp']] += 1
    ditinjau = [s['siswa_id'] for s in data['items'] if usulan_lebih_tinggi(s['usulan_sp'], s['keterangan_sp'])]
    return {'ambang': data['ambang'], 'semester_id': semester_id, 'jumlah': jumlah, 'perlu_ditinjau': len(ditinjau),
            'siswa_perlu_ditinjau': ditinjau}


@router.get("/tatib/tindakan/{siswa_id}/usulan")
async def usulan_sp_siswa(siswa_id: str, semester_id: Optional[str] = None, user: Dict = Depends(wajib_lihat_tatib)):
    """Usulan SP otomatis satu siswa dari akumulasi pelanggaran & ambang berlaku, beserta tingkat berikutnya.
    Usulan hanya saran: keterangan SP final tetap ditetapkan manual (PUT /tatib/tindakan/{siswa_id})."""
    akun = await db.users.find_one({'id': siswa_id, 'roles': 'siswa'}, {'_id': 0, 'id': 1, 'full_name': 1})
    if not akun:
        raise HTTPException(404, "Siswa tidak ditemukan")
    ambang = await ambil_ambang_sp(db)
    poin = await _poin_negatif_siswa(siswa_id, semester_id)
    tindakan = await db[KOLEKSI_TINDAKAN].find_one({'siswa_id': siswa_id, 'semester_id': semester_id}, {'_id': 0}) or {}
    usulan = usulkan_sp(poin['poin_negatif'], ambang)
    return {
        'siswa_id': siswa_id,
        'nama': akun.get('full_name'),
        'semester_id': semester_id,
        **poin,
        'ambang': {k: ambang[k] for k in ('sp1', 'sp2', 'sp3')},
        'usulan_sp': usulan,
        'ambang_berikutnya': ambang_berikutnya(poin['poin_negatif'], ambang),
        'keterangan_sp': tindakan.get('keterangan_sp'),
        'perlu_ditinjau': usulan_lebih_tinggi(usulan, tindakan.get('keterangan_sp')),
    }


MAKS_CATATAN_TINDAKAN = 300


class StatusTindakanRequest(BaseModel):
    """Keputusan status pembinaan satu siswa (manual). Nilai harus dari daftar baku."""
    semester_id: Optional[str] = None
    keterangan_sp: Optional[str] = None
    status_panggilan_wali: str
    status_sp: str
    status_rtlpd: str
    catatan: Optional[str] = None

    @field_validator('keterangan_sp')
    @classmethod
    def _sp(cls, v):
        if v in (None, ''):
            return None
        if v not in TINGKAT_SP:
            raise ValueError(f"Keterangan SP harus salah satu dari {', '.join(TINGKAT_SP)} atau kosong")
        return v

    @field_validator('status_panggilan_wali')
    @classmethod
    def _wali(cls, v):
        if v not in STATUS_PANGGILAN_WALI:
            raise ValueError(f"Status panggilan wali harus salah satu dari: {', '.join(STATUS_PANGGILAN_WALI)}")
        return v

    @field_validator('status_sp')
    @classmethod
    def _status_sp(cls, v):
        if v not in STATUS_SP:
            raise ValueError(f"Status SP harus salah satu dari: {', '.join(STATUS_SP)}")
        return v

    @field_validator('status_rtlpd')
    @classmethod
    def _rtlpd(cls, v):
        if v not in STATUS_RTLPD:
            raise ValueError(f"Status RTLPD harus salah satu dari: {', '.join(STATUS_RTLPD)}")
        return v

    @field_validator('catatan')
    @classmethod
    def _catatan(cls, v):
        v = (v or '').strip()
        if len(v) > MAKS_CATATAN_TINDAKAN:
            raise ValueError(f'Catatan maksimal {MAKS_CATATAN_TINDAKAN} karakter')
        return v or None


async def _baris_siswa(siswa_id: str, semester_id: Optional[str]) -> Dict:
    """Baris rekap satu siswa (bentuk sama dengan item GET /tatib/tindakan)."""
    query = await query_rekap(None, semester_id, None, None, None)
    query = {'$and': [query, {'siswa_id': siswa_id}]} if query else {'siswa_id': siswa_id}
    records = await db[KOLEKSI_POIN].find(query, {'_id': 0}).to_list(5000)
    tindakan = await db[KOLEKSI_TINDAKAN].find_one({'siswa_id': siswa_id, 'semester_id': semester_id}, {'_id': 0}) or {}
    ambang = await ambil_ambang_sp(db)
    akun = await _akun_siswa([siswa_id])
    baris = rekap_siswa_berpoin(records, akun, {siswa_id: tindakan}, ambang)
    if baris:
        return baris[0]
    a = akun.get(siswa_id) or {}
    return {'siswa_id': siswa_id, 'nisn': a.get('nisn'), 'nis': a.get('nis'), 'nama': a.get('full_name') or '-',
            'kelas': a.get('class_name'), 'poin_positif': 0, 'kategori_positif': [], 'poin_negatif': 0, 'kategori_negatif': [],
            'jumlah_catatan': 0, 'usulan_sp': None, **{f: tindakan.get(f, v) for f, v in STATUS_TINDAKAN_AWAL.items()},
            'catatan': tindakan.get('catatan'), 'diubah_pada': tindakan.get('diubah_pada'), 'diubah_oleh_nama': tindakan.get('diubah_oleh_nama')}


@router.put("/tatib/tindakan/{siswa_id}")
async def ubah_status_tindakan(siswa_id: str, req: StatusTindakanRequest, user: Dict = Depends(wajib_input_tatib)):
    """Tetapkan status pembinaan siswa untuk satu semester (keterangan SP, panggilan wali, status SP, RTLPD).
    Hanya admin, guru tata tertib, dan waka kesiswaan. Setiap perubahan (atau catatan) dicatat di riwayat
    beserta usulan SP & akumulasi pelanggaran saat itu. -> baris rekap siswa terbaru."""
    if not await db.users.find_one({'id': siswa_id, 'roles': 'siswa'}, {'_id': 1}):
        raise HTTPException(404, "Siswa tidak ditemukan")
    lama = await db[KOLEKSI_TINDAKAN].find_one({'siswa_id': siswa_id, 'semester_id': req.semester_id}, {'_id': 0})
    baru = {f: getattr(req, f) for f in STATUS_TINDAKAN_AWAL}
    perubahan = perubahan_status(lama or {}, baru)
    sekarang = datetime.now(timezone.utc).isoformat()
    oleh_nama = user.get('full_name') or user.get('username')

    if perubahan or req.catatan or not lama:
        isian = {**baru, 'catatan': req.catatan, 'diubah_pada': sekarang, 'diubah_oleh_id': user['id'], 'diubah_oleh_nama': oleh_nama}
        try:
            await db[KOLEKSI_TINDAKAN].update_one(
                {'siswa_id': siswa_id, 'semester_id': req.semester_id},
                {'$set': isian, '$setOnInsert': {'id': str(uuid.uuid4()), 'created_at': sekarang}},
                upsert=True)
        except DuplicateKeyError:  # dua penyimpanan pertama bersamaan: yang kalah cukup memperbarui
            await db[KOLEKSI_TINDAKAN].update_one({'siswa_id': siswa_id, 'semester_id': req.semester_id}, {'$set': isian})
    tindakan = await db[KOLEKSI_TINDAKAN].find_one({'siswa_id': siswa_id, 'semester_id': req.semester_id}, {'_id': 0})

    if perubahan or req.catatan:
        poin = await _baris_siswa(siswa_id, req.semester_id)
        await db[KOLEKSI_RIWAYAT_TINDAKAN].insert_one(entri_riwayat_tindakan(
            tindakan, perubahan, user, sekarang, catatan=req.catatan, usulan_sp=poin['usulan_sp'], poin_negatif=poin['poin_negatif']))
        await log_audit(user, 'tatib_tindakan_update',
                        f"Tindakan tatib {siswa_id}: " + (', '.join(f"{p['field']} {p['dari']}->{p['ke']}" for p in perubahan) or 'catatan'))
    return serialize_doc(await _baris_siswa(siswa_id, req.semester_id))
