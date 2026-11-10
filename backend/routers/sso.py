"""API login lewat tiket (SSO) — lihat sso.py untuk alur lengkap.

Pengguna Super App:
  GET  /sso/aplikasi-saya                 aplikasi yang boleh dibuka pengguna
  POST /sso/aplikasi/{id}/masuk           tiket sekali pakai -> {url} halaman penerima aplikasi tujuan
Server aplikasi tujuan (Authorization: Bearer <kunci rahasia aplikasi>):
  GET  /sso/cek                           uji kunci (dipakai saat memasang)
  POST /sso/tukar {tiket}                 tukar tiket -> data pengguna (tiket langsung hangus)
Admin:
  GET/POST /admin/sso/aplikasi, PUT/DELETE /admin/sso/aplikasi/{id}, POST /admin/sso/aplikasi/{id}/kunci-baru,
  GET /admin/sso/pengguna?cari=           pilih pengguna untuk izin/blokir khusus
"""
import re
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, Field, field_validator

import sso
from core import db, get_current_user, log_audit, log_security
from models import ROLES

router = APIRouter(tags=['sso'])

PERAN_SAH = [r for r in ROLES if r not in sso.PERAN_TIDAK_SSO]
_POLA_URL = re.compile(r'^(https://[^\s/?#]+[^\s]*|http://(localhost|127\.0\.0\.1)(:\d+)?(/[^\s]*)?)$', re.IGNORECASE)


def _ip(request: Optional[Request]) -> Optional[str]:
    if request is None:
        return None
    maju = request.headers.get('x-forwarded-for') if hasattr(request, 'headers') else None
    if maju:
        return maju.split(',')[0].strip()
    return getattr(getattr(request, 'client', None), 'host', None)


def _galat(e: 'sso.GalatSso'):
    return HTTPException(status_code=e.status, detail={'kode': e.kode, 'pesan': e.pesan})


def _admin(user: Dict = Depends(get_current_user)) -> Dict:
    if 'admin' not in (user.get('roles') or []) or user.get('active_role') == 'kelas':
        raise HTTPException(403, 'Hanya admin yang dapat mengatur aplikasi terhubung.')
    return user


class AplikasiBase(BaseModel):
    nama: str = Field(..., min_length=2, max_length=80)
    deskripsi: Optional[str] = Field('', max_length=300)
    url_masuk: str = Field(..., max_length=500)
    url_ikon: Optional[str] = Field('', max_length=500)
    aktif: bool = True
    urutan: int = Field(0, ge=0, le=999)
    peran: List[str] = Field(default_factory=list)
    izin_pengguna: List[str] = Field(default_factory=list, max_length=2000)
    blokir_pengguna: List[str] = Field(default_factory=list, max_length=2000)

    @field_validator('nama', 'deskripsi')
    @classmethod
    def _rapikan(cls, v):
        return ' '.join((v or '').split())

    @field_validator('url_masuk')
    @classmethod
    def _url(cls, v):
        v = (v or '').strip()
        if not _POLA_URL.match(v):
            raise ValueError('alamat penerima harus diawali https:// (http:// hanya untuk localhost saat uji coba)')
        return v

    @field_validator('url_ikon')
    @classmethod
    def _ikon(cls, v):
        v = (v or '').strip()
        if v and not re.match(r'^(https://|/)', v, re.IGNORECASE):
            raise ValueError('alamat ikon harus diawali https:// atau /')
        return v

    @field_validator('peran')
    @classmethod
    def _peran(cls, v):
        tidak_dikenal = [r for r in v if r not in PERAN_SAH]
        if tidak_dikenal:
            raise ValueError(f"peran tidak dikenal: {', '.join(tidak_dikenal)}")
        return list(dict.fromkeys(v))

    @field_validator('izin_pengguna', 'blokir_pengguna')
    @classmethod
    def _ids(cls, v):
        return list(dict.fromkeys(str(x).strip() for x in v if str(x).strip()))


class AplikasiBaru(AplikasiBase):
    id: str = Field(..., pattern=sso.POLA_ID_APLIKASI, description='kode singkat, mis. koperasi, absensi, ptsp')


class TukarRequest(BaseModel):
    tiket: str = Field(..., min_length=10, max_length=200)


def _kunci_dari_header(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    jenis, _, nilai = authorization.strip().partition(' ')
    return nilai.strip() if jenis.lower() == 'bearer' else None


# ---------------------------------------------------------------- pengguna

@router.get('/sso/aplikasi-saya')
async def aplikasi_saya(user: Dict = Depends(get_current_user)):
    """Aplikasi terhubung yang boleh dibuka pengguna ini (tampil di dashboard)."""
    return await sso.aplikasi_milik(db, user)


@router.post('/sso/aplikasi/{aplikasi_id}/masuk')
async def masuk_aplikasi(aplikasi_id: str, request: Request, user: Dict = Depends(get_current_user)):
    """Buat tiket sekali pakai (berlaku 60 detik) dan kembalikan URL halaman penerima aplikasi tujuan."""
    try:
        hasil = await sso.terbitkan_tiket(db, aplikasi_id, user, _ip(request))
    except sso.GalatSso as e:
        await log_security('sso_tiket_ditolak', user.get('username'), {'aplikasi': aplikasi_id, 'kode': e.kode}, request)
        raise _galat(e)
    await log_audit(user, 'sso_masuk', 'sso_aplikasi', aplikasi_id, {'peran_aktif': user.get('active_role')}, request)
    return hasil


# ---------------------------------------------------------------- server aplikasi tujuan

@router.get('/sso/cek')
async def cek_kunci(request: Request, authorization: Optional[str] = Header(None)):
    """Uji kunci aplikasi dari server aplikasi tujuan: {aplikasi, nama} bila kunci benar."""
    try:
        app = await sso.aplikasi_dari_kunci(db, _kunci_dari_header(authorization))
    except sso.GalatSso as e:
        await log_security('sso_kunci_ditolak', None, {'kode': e.kode, 'jalur': 'cek'}, request)
        raise _galat(e)
    return {'aplikasi': app['id'], 'nama': app.get('nama'), 'umur_tiket_detik': sso.UMUR_TIKET_DETIK}


@router.post('/sso/tukar')
async def tukar(data: TukarRequest, request: Request, authorization: Optional[str] = Header(None)):
    """Tukar tiket menjadi data pengguna. Hanya untuk server aplikasi tujuan (kunci rahasia di header)."""
    try:
        hasil = await sso.tukar_tiket(db, _kunci_dari_header(authorization), data.tiket, _ip(request))
    except sso.GalatSso as e:
        await log_security('sso_tukar_gagal', None, {'kode': e.kode}, request)
        raise _galat(e)
    p = hasil['pengguna']
    await log_audit({'id': p['id'], 'username': p['username']}, 'sso_tukar', 'sso_aplikasi', hasil['aplikasi'],
                    {'jenis': p['jenis']}, request)
    return hasil


# ---------------------------------------------------------------- admin

@router.get('/admin/sso/aplikasi')
async def admin_daftar(user: Dict = Depends(_admin)):
    semua = await db[sso.KOLEKSI_APLIKASI].find({}, {'_id': 0}).to_list(200)
    semua.sort(key=lambda a: (a.get('urutan') or 0, (a.get('nama') or '').lower()))
    return {'aplikasi': [sso.aplikasi_tampil(a, lengkap=True) for a in semua],
            'peran': PERAN_SAH, 'umur_tiket_detik': sso.UMUR_TIKET_DETIK}


@router.post('/admin/sso/aplikasi')
async def admin_tambah(data: AplikasiBaru, request: Request, user: Dict = Depends(_admin)):
    """Daftarkan aplikasi baru. Kunci rahasia hanya ditampilkan di respons ini — simpan di aplikasi tujuan."""
    if await db[sso.KOLEKSI_APLIKASI].find_one({'id': data.id}, {'_id': 1}):
        raise HTTPException(409, f"Kode aplikasi '{data.id}' sudah dipakai.")
    kunci = sso.buat_kunci_rahasia()
    t = sso.sekarang().isoformat()
    doc = {**data.model_dump(), **sso.data_kunci(kunci), 'created_at': t, 'updated_at': t, 'dibuat_oleh': user.get('id')}
    await db[sso.KOLEKSI_APLIKASI].insert_one(dict(doc))
    await log_audit(user, 'sso_aplikasi_tambah', 'sso_aplikasi', data.id, {'nama': data.nama, 'peran': data.peran}, request)
    return {'aplikasi': sso.aplikasi_tampil(doc, lengkap=True), 'kunci_rahasia': kunci}


@router.put('/admin/sso/aplikasi/{aplikasi_id}')
async def admin_ubah(aplikasi_id: str, data: AplikasiBase, request: Request, user: Dict = Depends(_admin)):
    lama = await db[sso.KOLEKSI_APLIKASI].find_one({'id': aplikasi_id}, {'_id': 0})
    if not lama:
        raise HTTPException(404, 'Aplikasi tidak ditemukan.')
    ubah = {**data.model_dump(), 'updated_at': sso.sekarang().isoformat()}
    await db[sso.KOLEKSI_APLIKASI].update_one({'id': aplikasi_id}, {'$set': ubah})
    await log_audit(user, 'sso_aplikasi_ubah', 'sso_aplikasi', aplikasi_id,
                    {'peran': data.peran, 'aktif': data.aktif, 'izin': len(data.izin_pengguna),
                     'blokir': len(data.blokir_pengguna)}, request)
    return sso.aplikasi_tampil({**lama, **ubah}, lengkap=True)


@router.post('/admin/sso/aplikasi/{aplikasi_id}/kunci-baru')
async def admin_kunci_baru(aplikasi_id: str, request: Request, user: Dict = Depends(_admin)):
    """Buat ulang kunci rahasia (kunci lama langsung tidak berlaku). Kunci baru hanya tampil di respons ini."""
    if not await db[sso.KOLEKSI_APLIKASI].find_one({'id': aplikasi_id}, {'_id': 1}):
        raise HTTPException(404, 'Aplikasi tidak ditemukan.')
    kunci = sso.buat_kunci_rahasia()
    await db[sso.KOLEKSI_APLIKASI].update_one({'id': aplikasi_id}, {'$set': {**sso.data_kunci(kunci),
                                                                              'updated_at': sso.sekarang().isoformat()}})
    await log_audit(user, 'sso_aplikasi_kunci_baru', 'sso_aplikasi', aplikasi_id, {}, request)
    app = await db[sso.KOLEKSI_APLIKASI].find_one({'id': aplikasi_id}, {'_id': 0})
    return {'aplikasi': sso.aplikasi_tampil(app, lengkap=True), 'kunci_rahasia': kunci}


@router.delete('/admin/sso/aplikasi/{aplikasi_id}')
async def admin_hapus(aplikasi_id: str, request: Request, user: Dict = Depends(_admin)):
    hasil = await db[sso.KOLEKSI_APLIKASI].delete_one({'id': aplikasi_id})
    if not getattr(hasil, 'deleted_count', 0):
        raise HTTPException(404, 'Aplikasi tidak ditemukan.')
    await db[sso.KOLEKSI_TIKET].delete_many({'aplikasi_id': aplikasi_id})
    await log_audit(user, 'sso_aplikasi_hapus', 'sso_aplikasi', aplikasi_id, {}, request)
    return {'ok': True}


@router.get('/admin/sso/pengguna')
async def admin_cari_pengguna(cari: str = Query('', max_length=60), ids: str = Query('', max_length=20000),
                              user: Dict = Depends(_admin)):
    """Cari pengguna (nama / username / NIP / NISN / Peg ID) untuk izin & blokir khusus; `ids` (dipisah koma) untuk
    menampilkan nama pengguna yang sudah dipilih."""
    proyeksi = {'_id': 0, 'id': 1, 'full_name': 1, 'username': 1, 'roles': 1, 'is_active': 1, 'nip': 1, 'nisn': 1, 'peg_id': 1}
    if ids:
        daftar = [i for i in ids.split(',') if i][:2000]
        docs = await db.users.find({'id': {'$in': daftar}}, proyeksi).to_list(len(daftar) or 1)
    else:
        kata = cari.strip()
        if len(kata) < 2:
            return []
        pola = {'$regex': re.escape(kata), '$options': 'i'}
        docs = await db.users.find({'$or': [{f: pola} for f in ('full_name', 'username', 'nip', 'nisn', 'peg_id', 'email')]},
                                   proyeksi).limit(20).to_list(20)
    return [{'id': d['id'], 'nama': d.get('full_name'), 'username': d.get('username'), 'peran': d.get('roles') or [],
             'aktif': d.get('is_active') is not False,
             'nomor': d.get('nip') or d.get('nisn') or d.get('peg_id')} for d in docs]
