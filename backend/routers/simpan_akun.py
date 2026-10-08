"""API Simpan Akun: brankas akun pribadi GTK, dikunci PIN 6 angka.

Isi brankas hanya untuk PEMILIKNYA: setiap query selalu memakai user_id dari token login,
dan endpoint isi brankas mewajibkan token brankas (X-Simpan-Akun-Token) yang terbit setelah
PIN benar (berlaku singkat). Daftar akun tidak pernah memuat password.
"""
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from jose import JWTError, jwt
from pydantic import BaseModel, Field

from auth_utils import JWT_ALGORITHM, JWT_SECRET
from core import db, get_current_user, log_audit, require_role
from simpan_akun import (
    BATAS_GAGAL_PIN, KOLEKSI_AKUN, KOLEKSI_PIN, alasan_pin_lemah, cocok_pin, detail_akun, enkripsi, hash_pin,
    ringkas_akun,
)

router = APIRouter()

# Peran non-GTK yang tidak memakai Simpan Akun.
PERAN_NON_GTK = {'siswa', 'kelas', 'orang_tua', 'alumni'}
CAKUPAN_TOKEN = 'simpan_akun'
UMUR_TOKEN_MENIT = 15


def adalah_gtk(user: Dict) -> bool:
    if user.get('active_role') in PERAN_NON_GTK:
        return False
    return any(r not in PERAN_NON_GTK for r in (user.get('roles') or []))


async def wajib_gtk(user: Dict = Depends(get_current_user)) -> Dict:
    if not adalah_gtk(user):
        raise HTTPException(403, "Simpan Akun hanya untuk GTK")
    return user


def buat_token_brankas(user_id: str) -> Dict:
    """Token brankas berumur pendek, hanya berlaku untuk Simpan Akun milik `user_id`."""
    berlaku = datetime.now(timezone.utc) + timedelta(minutes=UMUR_TOKEN_MENIT)
    token = jwt.encode({'sub': user_id, 'scope': CAKUPAN_TOKEN, 'exp': berlaku}, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return {'token': token, 'berlaku_sampai': berlaku.isoformat()}


async def wajib_brankas(
    user: Dict = Depends(wajib_gtk),
    x_simpan_akun_token: Optional[str] = Header(None),
) -> Dict:
    """Dependency isi brankas: token brankas sah, belum kedaluwarsa, dan milik pengguna login."""
    if not x_simpan_akun_token:
        raise HTTPException(401, "Brankas terkunci. Masukkan PIN terlebih dahulu.")
    try:
        data = jwt.decode(x_simpan_akun_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(401, "Sesi brankas berakhir. Masukkan PIN kembali.")
    if data.get('scope') != CAKUPAN_TOKEN or data.get('sub') != user['id']:
        raise HTTPException(401, "Sesi brankas tidak sah. Masukkan PIN kembali.")
    return user


@router.get("/simpan-akun")
async def daftar_akun(
    q: Optional[str] = None,
    aplikasi: Optional[str] = None,
    user: Dict = Depends(wajib_brankas),
):
    """Daftar akun milik pengguna login (tanpa password), urut nama aplikasi lalu nama akun.
    q mencari di nama akun / nama aplikasi (tanpa membedakan huruf besar/kecil)."""
    items = await db[KOLEKSI_AKUN].find({'user_id': user['id']}, {'_id': 0}).to_list(1000)
    kata = (q or '').strip().lower()
    hasil = [
        ringkas_akun(a) for a in items
        if (not aplikasi or a.get('nama_aplikasi') == aplikasi)
        and (not kata or kata in f"{a.get('nama_akun') or ''} {a.get('nama_aplikasi') or ''}".lower())
    ]
    hasil.sort(key=lambda a: ((a.get('nama_aplikasi') or '').lower(), (a.get('nama_akun') or '').lower()))
    return hasil


# ============================================================
# PIN BRANKAS
# ============================================================

class PinRequest(BaseModel):
    pin: str


class LupaPinRequest(BaseModel):
    keterangan: Optional[str] = Field(None, max_length=200)


def _sekarang() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _dokumen_pin(user_id: str) -> Optional[Dict]:
    return await db[KOLEKSI_PIN].find_one({'user_id': user_id}, {'_id': 0})


@router.get("/simpan-akun/pin/status")
async def status_pin(user: Dict = Depends(wajib_gtk)):
    """Status PIN pemilik: sudah dibuat?, terkunci?, sisa percobaan, permintaan & waktu reset."""
    doc = await _dokumen_pin(user['id']) or {}
    gagal = int(doc.get('gagal') or 0)
    return {
        'sudah_dibuat': bool(doc.get('pin_hash')),
        'terkunci': bool(doc.get('terkunci')),
        'sisa_percobaan': max(BATAS_GAGAL_PIN - gagal, 0),
        'reset_diminta_pada': doc.get('reset_diminta_pada'),
        'direset_pada': doc.get('direset_pada'),
    }


@router.post("/simpan-akun/pin")
async def buat_pin(req: PinRequest, request: Request, user: Dict = Depends(wajib_gtk)):
    """Buat PIN 6 angka (pertama kali atau setelah direset admin). PIN disimpan ter-hash (bcrypt).
    -> token brankas agar isi langsung bisa dibuka."""
    lemah = alasan_pin_lemah(req.pin)
    if lemah:
        raise HTTPException(400, lemah)
    doc = await _dokumen_pin(user['id'])
    if doc and doc.get('pin_hash'):
        raise HTTPException(409, "PIN sudah dibuat. Gunakan PIN Anda atau ajukan reset ke admin.")
    sekarang = _sekarang()
    await db[KOLEKSI_PIN].update_one(
        {'user_id': user['id']},
        {'$set': {'pin_hash': hash_pin(req.pin), 'gagal': 0, 'terkunci': False, 'updated_at': sekarang,
                  'reset_diminta_pada': None, 'keterangan_reset': None, 'direset_pada': None},
         '$setOnInsert': {'user_id': user['id'], 'created_at': sekarang}},
        upsert=True,
    )
    await log_audit(user, 'simpan_akun_pin_buat', 'simpan_akun_pin', user['id'], request=request)
    return buat_token_brankas(user['id'])


@router.post("/simpan-akun/pin/verifikasi")
async def verifikasi_pin(req: PinRequest, request: Request, user: Dict = Depends(wajib_gtk)):
    """Buka brankas dengan PIN -> token brankas. Salah 5x -> terkunci sampai admin mereset."""
    doc = await _dokumen_pin(user['id'])
    if not doc or not doc.get('pin_hash'):
        raise HTTPException(404, "PIN belum dibuat")
    if doc.get('terkunci'):
        raise HTTPException(423, {'pesan': 'Simpan Akun terkunci. Ajukan reset PIN ke admin.', 'terkunci': True, 'sisa_percobaan': 0})
    if not cocok_pin(req.pin, doc['pin_hash']):
        gagal = int(doc.get('gagal') or 0) + 1
        terkunci = gagal >= BATAS_GAGAL_PIN
        await db[KOLEKSI_PIN].update_one({'user_id': user['id']}, {'$set': {'gagal': gagal, 'terkunci': terkunci, 'updated_at': _sekarang()}})
        if terkunci:
            await log_audit(user, 'simpan_akun_pin_terkunci', 'simpan_akun_pin', user['id'], request=request)
        sisa = max(BATAS_GAGAL_PIN - gagal, 0)
        pesan = f'PIN salah. Sisa {sisa} percobaan.' if sisa else 'PIN salah. Simpan Akun terkunci, ajukan reset PIN ke admin.'
        raise HTTPException(401, {'pesan': pesan, 'terkunci': terkunci, 'sisa_percobaan': sisa})
    if doc.get('gagal'):
        await db[KOLEKSI_PIN].update_one({'user_id': user['id']}, {'$set': {'gagal': 0, 'updated_at': _sekarang()}})
    return buat_token_brankas(user['id'])


@router.post("/simpan-akun/pin/lupa")
async def lupa_pin(req: LupaPinRequest, request: Request, user: Dict = Depends(wajib_gtk)):
    """Ajukan reset PIN ke admin (admin hanya mereset PIN, tidak bisa membuka isi brankas)."""
    doc = await _dokumen_pin(user['id'])
    if not doc or not doc.get('pin_hash'):
        raise HTTPException(400, "PIN belum pernah dibuat")
    diminta = doc.get('reset_diminta_pada') or _sekarang()
    await db[KOLEKSI_PIN].update_one(
        {'user_id': user['id']},
        {'$set': {'reset_diminta_pada': diminta, 'keterangan_reset': (req.keterangan or '').strip() or None, 'updated_at': _sekarang()}},
    )
    await log_audit(user, 'simpan_akun_pin_lupa', 'simpan_akun_pin', user['id'], request=request)
    return {'reset_diminta_pada': diminta}


# ============================================================
# KELOLA AKUN (pemilik, butuh token brankas)
# ============================================================

def _rapikan_link(link: Optional[str]) -> str:
    link = (link or '').strip()
    if not link:
        return ''
    if not re.match(r'^https?://', link, re.I):
        link = f'https://{link}'
    host = urlparse(link).hostname or ''
    if not ('.' in host or host == 'localhost'):
        raise HTTPException(400, "Link web tidak valid (contoh: emis.kemenag.go.id)")
    return link


class AkunRequest(BaseModel):
    nama_akun: str = Field(..., min_length=1, max_length=120)
    link_web: Optional[str] = Field('', max_length=500)
    nama_aplikasi: str = Field(..., min_length=1, max_length=120)
    username: str = Field(..., min_length=1, max_length=200)
    password: Optional[str] = Field(None, max_length=500)  # wajib saat tambah; kosong saat ubah = tidak diganti


def _isi_akun(req: AkunRequest) -> Dict:
    isi = {
        'nama_akun': req.nama_akun.strip(),
        'link_web': _rapikan_link(req.link_web),
        'nama_aplikasi': req.nama_aplikasi.strip(),
        'username': req.username.strip(),
    }
    if not all(isi[k] for k in ('nama_akun', 'nama_aplikasi', 'username')):
        raise HTTPException(400, "Nama akun, nama aplikasi, dan username wajib diisi")
    return isi


async def _cek_duplikat(user_id: str, isi: Dict, kecuali_id: Optional[str] = None) -> None:
    milik = await db[KOLEKSI_AKUN].find({'user_id': user_id}, {'_id': 0, 'id': 1, 'nama_aplikasi': 1, 'username': 1}).to_list(1000)
    kunci = (isi['nama_aplikasi'].lower(), isi['username'].lower())
    if any(a['id'] != kecuali_id and ((a.get('nama_aplikasi') or '').lower(), (a.get('username') or '').lower()) == kunci for a in milik):
        raise HTTPException(409, "Akun dengan aplikasi & username ini sudah tersimpan")


async def _akun_milik(akun_id: str, user: Dict) -> Dict:
    """Akun milik pengguna login; akun orang lain diperlakukan tidak ada (404)."""
    doc = await db[KOLEKSI_AKUN].find_one({'id': akun_id, 'user_id': user['id']}, {'_id': 0})
    if not doc:
        raise HTTPException(404, "Akun tidak ditemukan")
    return doc


@router.get("/simpan-akun/{akun_id}")
async def detail_akun_tersimpan(akun_id: str, user: Dict = Depends(wajib_brankas)):
    """Rincian satu akun milik sendiri, termasuk password terdekripsi."""
    doc = await _akun_milik(akun_id, user)
    try:
        return detail_akun(doc)
    except ValueError as e:
        raise HTTPException(500, str(e))


@router.post("/simpan-akun")
async def tambah_akun(req: AkunRequest, request: Request, user: Dict = Depends(wajib_brankas)):
    isi = _isi_akun(req)
    if not req.password:
        raise HTTPException(400, "Password wajib diisi")
    await _cek_duplikat(user['id'], isi)
    sekarang = _sekarang()
    doc = {'id': str(uuid.uuid4()), 'user_id': user['id'], **isi, 'password_enc': enkripsi(req.password),
           'created_at': sekarang, 'updated_at': sekarang}
    await db[KOLEKSI_AKUN].insert_one(doc)
    await log_audit(user, 'simpan_akun_tambah', 'simpan_akun', doc['id'], request=request)  # tanpa isi akun
    return ringkas_akun(doc)


@router.put("/simpan-akun/{akun_id}")
async def ubah_akun(akun_id: str, req: AkunRequest, request: Request, user: Dict = Depends(wajib_brankas)):
    await _akun_milik(akun_id, user)
    isi = _isi_akun(req)
    await _cek_duplikat(user['id'], isi, kecuali_id=akun_id)
    perubahan = {**isi, 'updated_at': _sekarang()}
    if req.password:
        perubahan['password_enc'] = enkripsi(req.password)
    await db[KOLEKSI_AKUN].update_one({'id': akun_id, 'user_id': user['id']}, {'$set': perubahan})
    await log_audit(user, 'simpan_akun_ubah', 'simpan_akun', akun_id, request=request)
    return ringkas_akun(await _akun_milik(akun_id, user))


@router.delete("/simpan-akun/{akun_id}")
async def hapus_akun(akun_id: str, request: Request, user: Dict = Depends(wajib_brankas)):
    await _akun_milik(akun_id, user)
    await db[KOLEKSI_AKUN].delete_one({'id': akun_id, 'user_id': user['id']})
    await log_audit(user, 'simpan_akun_hapus', 'simpan_akun', akun_id, request=request)
    return {'ok': True}


# ============================================================
# RESET PIN OLEH ADMIN (tanpa akses ke isi brankas)
# ============================================================

@router.get("/admin/simpan-akun/reset-pin")
async def daftar_permintaan_reset(user: Dict = Depends(require_role('admin'))):
    """Permintaan reset PIN yang belum ditangani: nama, peran, waktu, keterangan. Tidak memuat isi brankas."""
    pin = await db[KOLEKSI_PIN].find(
        {'reset_diminta_pada': {'$nin': [None, '']}},
        {'_id': 0, 'user_id': 1, 'reset_diminta_pada': 1, 'keterangan_reset': 1, 'terkunci': 1},
    ).to_list(500)
    ids = [p['user_id'] for p in pin]
    pengguna = {u['id']: u for u in await db.users.find(
        {'id': {'$in': ids}}, {'_id': 0, 'id': 1, 'full_name': 1, 'username': 1, 'roles': 1}).to_list(len(ids) or 1)}
    hasil = []
    for p in pin:
        u = pengguna.get(p['user_id'], {})
        hasil.append({
            'user_id': p['user_id'],
            'nama': u.get('full_name') or u.get('username') or '-',
            'peran': next((r for r in (u.get('roles') or []) if r not in PERAN_NON_GTK), None),
            'reset_diminta_pada': p.get('reset_diminta_pada'),
            'keterangan': p.get('keterangan_reset') or '',
            'terkunci': bool(p.get('terkunci')),
        })
    hasil.sort(key=lambda x: x['reset_diminta_pada'] or '')
    return hasil


@router.post("/admin/simpan-akun/reset-pin/{user_id}")
async def reset_pin_oleh_admin(user_id: str, request: Request, user: Dict = Depends(require_role('admin'))):
    """Hapus PIN GTK agar pemilik membuat PIN baru. Akun tersimpan tidak dibuka/diubah."""
    doc = await _dokumen_pin(user_id)
    if not doc or not doc.get('pin_hash'):
        raise HTTPException(404, "Pengguna ini belum memiliki PIN Simpan Akun")
    sekarang = _sekarang()
    await db[KOLEKSI_PIN].update_one(
        {'user_id': user_id},
        {'$set': {'pin_hash': None, 'gagal': 0, 'terkunci': False, 'reset_diminta_pada': None,
                  'keterangan_reset': None, 'direset_pada': sekarang, 'direset_oleh': user['id'], 'updated_at': sekarang}},
    )
    await log_audit(user, 'simpan_akun_pin_reset', 'simpan_akun_pin', user_id, request=request)
    return {'ok': True, 'direset_pada': sekarang}
