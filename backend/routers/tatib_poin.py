"""API Poin Tata Tertib lintas peran: poin siswa, pantauan wali kelas, rekap pengawas.

Catatan poin tersimpan di `tatib_penanganan` (skema di tatib_poin.py). Akses mengikuti peran
aktif (AKSES_TATIB_PER_PERAN): input = admin/guru tatib/waka kesiswaan, lihat = pimpinan,
kelas = wali kelas (hanya kelas yang diampu), pribadi = siswa (hanya miliknya).
"""
from datetime import datetime
from typing import Dict, List, Optional

import io

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from core import db, get_current_user, serialize_doc
from routers._shared import FILTER_SISWA_AKTIF, sembunyikan_siswa_nonaktif
from tatib_poin import (
    BATAS_MINUS_PERHATIAN, FIELD_BATAS_PERHATIAN, KOLEKSI_POIN, akses_tatib, jenis_dari_poin, nilai_poin,
    rangkum_poin, susun_rekap,
)

router = APIRouter()


def wajib_akses(*diizinkan: str):
    """Dependency: tolak (403) bila akses tatib peran aktif tidak termasuk `diizinkan`."""
    async def checker(user: Dict = Depends(get_current_user)):
        if akses_tatib(user) not in diizinkan:
            raise HTTPException(403, "Peran Anda tidak memiliki akses ke data tata tertib ini")
        return user
    return checker


# Dependency bersama: tulis data tatib (input) & baca rekap/statistik (input + lihat/pimpinan).
wajib_input_tatib = wajib_akses('input')
wajib_lihat_tatib = wajib_akses('input', 'lihat')


# ============================================================
# AMBANG "PERLU PERHATIAN"
# ============================================================

async def ambang_perhatian() -> int:
    """Batas akumulasi poin pelanggaran untuk penanda siswa perlu perhatian (bawaan -20)."""
    s = await db.settings.find_one({'id': 'global_config'}, {'_id': 0, FIELD_BATAS_PERHATIAN: 1}) or {}
    nilai = s.get(FIELD_BATAS_PERHATIAN)
    return int(nilai) if isinstance(nilai, (int, float)) and nilai < 0 else BATAS_MINUS_PERHATIAN


class AmbangRequest(BaseModel):
    batas_minus_perhatian: int = Field(..., le=-1, ge=-1000)


@router.get("/tatib/ambang")
async def lihat_ambang(user: Dict = Depends(wajib_akses('input', 'lihat', 'kelas'))):
    return {'batas_minus_perhatian': await ambang_perhatian()}


@router.put("/tatib/ambang")
async def ubah_ambang(req: AmbangRequest, user: Dict = Depends(wajib_akses('input'))):
    """Ubah batas penanda perlu perhatian (hanya peran input tatib)."""
    await db.settings.update_one({'id': 'global_config'}, {'$set': {FIELD_BATAS_PERHATIAN: req.batas_minus_perhatian}}, upsert=True)
    return {'batas_minus_perhatian': req.batas_minus_perhatian}


# ============================================================
# PANTAUAN WALI KELAS
# ============================================================

async def kelas_diampu(user: Dict) -> Optional[Dict]:
    """Kelas yang diampu wali kelas login; utamakan kelas tahun pelajaran aktif."""
    daftar = await db.classes.find({'homeroom_teacher_id': user['id']}, {'_id': 0}).to_list(20)
    if not daftar:
        return None
    if len(daftar) > 1:
        aktif = await db.academic_years.find_one({'is_active': True}, {'_id': 0, 'id': 1})
        if aktif:
            daftar.sort(key=lambda c: c.get('academic_year_id') != aktif['id'])
    return daftar[0]


async def siswa_kelas(kelas_id: str) -> List[Dict]:
    return await db.users.find(
        {'roles': 'siswa', 'student_class_id': kelas_id, **FILTER_SISWA_AKTIF},
        {'_id': 0, 'id': 1, 'full_name': 1, 'nis': 1, 'nisn': 1},
    ).sort('full_name', 1).to_list(200)


async def catatan_siswa(siswa_ids: List[str]) -> List[Dict]:
    if not siswa_ids:
        return []
    return await db[KOLEKSI_POIN].find({'siswa_id': {'$in': siswa_ids}}, {'_id': 0}).sort('tanggal', -1).to_list(5000)


def adalah_wali(user: Dict) -> bool:
    return user.get('active_role') == 'wali_kelas' or 'wali_kelas' in (user.get('roles') or [])


async def wajib_wali_kelas(user: Dict = Depends(get_current_user)) -> Dict:
    """Dependency: hanya pengguna berperan wali kelas (data tetap dibatasi ke kelas yang diampu)."""
    if not adalah_wali(user):
        raise HTTPException(403, "Pantauan kelas hanya untuk wali kelas")
    return user


async def id_siswa_kelas_diampu(user: Dict) -> List[str]:
    kelas = await kelas_diampu(user)
    return [s['id'] for s in await siswa_kelas(kelas['id'])] if kelas else []


async def batasi_query_tatib(user: Dict, query: Dict, field: str = 'siswa_id') -> Dict:
    """Batasi query catatan tatib sesuai cakupan peran aktif:
    input/lihat -> semua; kelas -> siswa kelas yang diampu; pribadi -> milik sendiri; lainnya -> 403.
    Bila query sudah meminta siswa tertentu, siswa itu harus berada dalam cakupan."""
    akses = akses_tatib(user)
    if akses in ('input', 'lihat'):
        return query
    if akses == 'kelas':
        boleh = await id_siswa_kelas_diampu(user)
    elif akses == 'pribadi':
        boleh = [user['id']]
    else:
        raise HTTPException(403, "Peran Anda tidak memiliki akses ke data tata tertib")
    diminta = query.get(field)
    if isinstance(diminta, str):
        if diminta not in boleh:
            raise HTTPException(403, "Data tata tertib siswa ini di luar cakupan Anda")
        return query
    query[field] = {'$in': boleh}
    return query


@router.get("/tatib/walikelas/siswa")
async def daftar_siswa_walikelas(user: Dict = Depends(wajib_wali_kelas)):
    """Daftar siswa kelas yang diampu wali kelas login + rangkuman poin masing-masing.
    -> {kelas: {id, name} | null, siswa: [{id, full_name, nis, nisn, class_name, total_plus, total_minus,
        saldo, jumlah_kebaikan, jumlah_pelanggaran, perlu_perhatian}]}"""
    kelas = await kelas_diampu(user)
    if not kelas:
        return {'kelas': None, 'siswa': []}
    siswa = await siswa_kelas(kelas['id'])
    records = await catatan_siswa([s['id'] for s in siswa])
    per_siswa: Dict[str, List[Dict]] = {}
    for r in records:
        per_siswa.setdefault(r.get('siswa_id'), []).append(r)
    batas = await ambang_perhatian()
    hasil = [{**s, 'class_name': kelas.get('name'), **rangkum_poin(per_siswa.get(s['id'], []), batas)} for s in siswa]
    return {
        'kelas': {'id': kelas['id'], 'name': kelas.get('name')},
        'batas_minus_perhatian': batas,
        'siswa': [serialize_doc(h) for h in hasil],
    }


@router.get("/tatib/walikelas/perlu-perhatian")
async def siswa_perlu_perhatian(user: Dict = Depends(wajib_wali_kelas)):
    """Siswa kelas yang diampu dengan akumulasi pelanggaran mencapai ambang, minus terbesar dulu."""
    data = await daftar_siswa_walikelas(user)
    siswa = sorted((s for s in data['siswa'] if s['perlu_perhatian']), key=lambda s: s['total_minus'])
    batas = data.get('batas_minus_perhatian') or await ambang_perhatian()
    return {'kelas': data['kelas'], 'batas_minus_perhatian': batas, 'siswa': siswa}


# ============================================================
# RINGKASAN POIN & RIWAYAT SATU SISWA
# ============================================================

def _rapikan_catatan(r: Dict) -> Dict:
    """Catatan untuk tampilan: nilai bertanda + jenis + field poin baku walau catatan lama."""
    poin = nilai_poin(r)
    return serialize_doc({
        **r,
        'poin': poin,
        'jenis_poin': r.get('jenis_poin') or jenis_dari_poin(poin),
        'kondisi': r.get('kondisi'),
        'tindak_lanjut': r.get('tindak_lanjut') or [],
    })


async def paket_poin_siswa(siswa_id: str, filter_periode: Optional[Dict] = None) -> Dict:
    """{siswa, total_plus, total_minus, saldo, jumlah_kebaikan, jumlah_pelanggaran, perlu_perhatian,
    records (terbaru dulu)} — bentuk yang sama dengan data tiruan frontend (ambilPoinSayaTiruan)."""
    akun = await db.users.find_one({'id': siswa_id}, {'_id': 0, 'id': 1, 'full_name': 1, 'nis': 1, 'nisn': 1, 'student_class_id': 1})
    if not akun:
        raise HTTPException(404, "Siswa tidak ditemukan")
    kelas = await db.classes.find_one({'id': akun.get('student_class_id')}, {'_id': 0, 'name': 1}) if akun.get('student_class_id') else None
    query = {'siswa_id': siswa_id, **(filter_periode or {})}
    records = await db[KOLEKSI_POIN].find(query, {'_id': 0}).to_list(2000)
    records.sort(key=lambda r: (r.get('tanggal') or '', r.get('created_at') or ''), reverse=True)
    batas = await ambang_perhatian()
    return {
        'siswa': {'id': akun['id'], 'nama': akun.get('full_name'), 'nis': akun.get('nis'), 'nisn': akun.get('nisn'),
                  'kelas': (kelas or {}).get('name')},
        **rangkum_poin(records, batas),
        'batas_minus_perhatian': batas,
        'records': [_rapikan_catatan(r) for r in records],
    }


def _filter_periode(tahun_takwim_id: Optional[str], semester: Optional[str], semester_id: Optional[str]) -> Dict:
    f = {}
    if tahun_takwim_id:
        f['tahun_takwim_id'] = tahun_takwim_id
    if semester:
        f['semester'] = semester
    if semester_id:
        f['semester_id'] = semester_id
    return f


@router.get("/tatib/poin-saya")
async def poin_saya(
    tahun_takwim_id: Optional[str] = None,
    semester: Optional[str] = None,
    semester_id: Optional[str] = None,
    user: Dict = Depends(wajib_akses('pribadi')),
):
    """Poin tata tertib milik siswa login (siswa ditentukan dari token, tanpa parameter siswa)."""
    return await paket_poin_siswa(user['id'], _filter_periode(tahun_takwim_id, semester, semester_id))


@router.get("/tatib/poin/siswa/{siswa_id}")
async def poin_siswa(
    siswa_id: str,
    tahun_takwim_id: Optional[str] = None,
    semester: Optional[str] = None,
    semester_id: Optional[str] = None,
    user: Dict = Depends(get_current_user),
):
    """Ringkasan poin & riwayat satu siswa, dibatasi cakupan peran (batasi_query_tatib)."""
    await batasi_query_tatib(user, {'siswa_id': siswa_id})
    return await paket_poin_siswa(siswa_id, _filter_periode(tahun_takwim_id, semester, semester_id))


@router.get("/tatib/walikelas/siswa/{siswa_id}")
async def poin_siswa_walikelas(siswa_id: str, user: Dict = Depends(wajib_wali_kelas)):
    """Poin & riwayat satu siswa — hanya bila siswa berada di kelas yang diampu (selain itu 403)."""
    if siswa_id not in await id_siswa_kelas_diampu(user):
        raise HTTPException(403, "Siswa ini bukan siswa di kelas yang Anda ampu")
    return await paket_poin_siswa(siswa_id)


@router.get("/tatib/poin/catatan/{catatan_id}")
async def detail_catatan_poin(catatan_id: str, user: Dict = Depends(get_current_user)):
    """Rincian satu catatan poin (kategori, nilai, kondisi, tanggal, pencatat, tindak lanjut).
    404 bila tidak ada; 403 bila siswanya di luar cakupan peran (siswa lain / kelas lain)."""
    doc = await db[KOLEKSI_POIN].find_one({'id': catatan_id}, {'_id': 0})
    if not doc:
        raise HTTPException(404, "Catatan poin tidak ditemukan")
    await batasi_query_tatib(user, {'siswa_id': doc.get('siswa_id')})
    return _rapikan_catatan(doc)


# ============================================================
# REKAP PENGAWAS (read-only pimpinan & pengelola tatib)
# ============================================================

def _tanggal_valid(nilai: Optional[str], nama: str) -> Optional[str]:
    """Tanggal filter harus YYYY-MM-DD (400 bila tidak)."""
    if not nilai:
        return None
    try:
        datetime.strptime(nilai, '%Y-%m-%d')
    except ValueError:
        raise HTTPException(400, f"Format {nama} harus YYYY-MM-DD")
    return nilai


def _rentang_tanggal(dari: Optional[str], sampai: Optional[str]) -> Dict:
    rentang = {}
    if dari:
        rentang['$gte'] = dari
    if sampai:
        rentang['$lte'] = sampai + 'T23:59:59'
    return rentang


async def query_rekap(kelas: Optional[str], semester_id: Optional[str], tahun_takwim_id: Optional[str],
                      start_date: Optional[str], end_date: Optional[str], semester: Optional[str] = None) -> Dict:
    """Query catatan untuk rekap (filter kelas & periode).
    semester_id: catatan ber-semester_id itu, atau catatan lama tanpa semester_id yang tanggalnya
    di dalam rentang semester. semester (kode lama, mis. 'ganjil') mencocokkan field `semester`."""
    syarat: List[Dict] = []
    if kelas:
        syarat.append({'siswa_kelas': kelas})
    if semester:
        syarat.append({'semester': semester})
    if tahun_takwim_id:
        syarat.append({'$or': [{'tahun_takwim_id': tahun_takwim_id}, {'tahun_takwim_id': None}]})
    if semester_id:
        sem = await db.semesters.find_one({'id': semester_id}, {'_id': 0, 'start_date': 1, 'end_date': 1}) or {}
        lama: Dict = {'semester_id': None}
        rentang = _rentang_tanggal(sem.get('start_date'), sem.get('end_date'))
        if rentang:
            lama['tanggal'] = rentang
        syarat.append({'$or': [{'semester_id': semester_id}, lama]})
    if start_date or end_date:
        syarat.append({'tanggal': _rentang_tanggal(start_date, end_date)})
    if not syarat:
        return {}
    return syarat[0] if len(syarat) == 1 else {'$and': syarat}


async def kelas_dan_siswa(kelas: Optional[str]) -> Dict[str, List[str]]:
    """{nama_kelas: [id siswa aktif]} untuk kelas yang ditampilkan di rekap (kelas tahun pelajaran aktif)."""
    q_kelas: Dict = {'name': kelas} if kelas else {}
    aktif = await db.academic_years.find_one({'is_active': True}, {'_id': 0, 'id': 1})
    if aktif and not kelas:
        q_kelas['academic_year_id'] = aktif['id']
    daftar = await db.classes.find(q_kelas, {'_id': 0, 'id': 1, 'name': 1}).to_list(200)
    nama_dari_id = {c['id']: c['name'] for c in daftar if c.get('name')}
    hasil: Dict[str, List[str]] = {n: [] for n in nama_dari_id.values()}
    if nama_dari_id:
        siswa = await db.users.find(
            {'roles': 'siswa', 'student_class_id': {'$in': list(nama_dari_id)}, **FILTER_SISWA_AKTIF},
            {'_id': 0, 'id': 1, 'student_class_id': 1}).to_list(5000)
        for s in siswa:
            hasil[nama_dari_id[s['student_class_id']]].append(s['id'])
    return hasil


async def data_rekap(kelas=None, semester_id=None, tahun_takwim_id=None, start_date=None, end_date=None,
                     semester=None) -> Dict:
    start_date = _tanggal_valid(start_date, 'tanggal awal')
    end_date = _tanggal_valid(end_date, 'tanggal akhir')
    if start_date and end_date and start_date > end_date:
        raise HTTPException(400, "Tanggal awal tidak boleh setelah tanggal akhir")
    query = await query_rekap(kelas, semester_id, tahun_takwim_id, start_date, end_date, semester)
    await sembunyikan_siswa_nonaktif(query, 'siswa_id', db)
    records = await db[KOLEKSI_POIN].find(query, {'_id': 0}).to_list(20000)
    return susun_rekap(records, await kelas_dan_siswa(kelas), await ambang_perhatian())


@router.get("/tatib/rekap")
async def rekap_poin(
    kelas: Optional[str] = None,
    semester_id: Optional[str] = None,
    tahun_takwim_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    semester: Optional[str] = None,
    user: Dict = Depends(wajib_akses('input', 'lihat')),
):
    """Rekap poin lintas kelas & periode: ringkasan, per kelas, aturan terbanyak (kebaikan & pelanggaran).
    Filter: kelas (nama), semester_id / semester (kode lama), tahun_takwim_id, start_date..end_date (YYYY-MM-DD)."""
    return await data_rekap(kelas, semester_id, tahun_takwim_id, start_date, end_date, semester)



@router.get("/tatib/rekap/export")
async def ekspor_rekap_poin(
    kelas: Optional[str] = None,
    semester_id: Optional[str] = None,
    tahun_takwim_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    semester: Optional[str] = None,
    user: Dict = Depends(wajib_akses('input', 'lihat')),
):
    """Unduh Rekap Pengawas (.xlsx) dengan filter yang sama seperti GET /tatib/rekap."""
    from excel_io import export_rekap_tatib_xlsx
    rekap = await data_rekap(kelas, semester_id, tahun_takwim_id, start_date, end_date, semester)
    sem = await db.semesters.find_one({'id': semester_id}, {'_id': 0, 'name': 1}) if semester_id else None
    bagian = [f"Kelas {kelas}" if kelas else 'Semua kelas']
    if sem:
        bagian.append(f"Semester {sem.get('name')}")
    if start_date or end_date:
        bagian.append(f"Tanggal {start_date or '…'} s.d. {end_date or '…'}")
    keterangan = 'Filter: ' + ' · '.join(bagian) + f" · diunduh {datetime.now().strftime('%Y-%m-%d %H:%M')}"
    nama = '_'.join(filter(None, ['rekap_poin_tatib', f"kelas-{kelas}" if kelas else '', start_date, end_date,
                                  datetime.now().strftime('%Y%m%d')]))
    return StreamingResponse(
        io.BytesIO(export_rekap_tatib_xlsx(rekap, keterangan)),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename="{nama}.xlsx"'},
    )
