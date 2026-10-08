"""Skema & keamanan modul Simpan Akun (brankas akun pribadi GTK).

Koleksi:
    simpan_akun      {id, user_id, nama_akun, nama_aplikasi, link_web, username,
                      password_enc, created_at, updated_at}
                     password TIDAK pernah disimpan polos: dienkripsi Fernet (password_enc).
    simpan_akun_pin  {user_id, pin_hash (bcrypt), gagal, terkunci, reset_diminta_pada,
                      created_at, updated_at}

Kunci enkripsi: env SIMPAN_AKUN_KEY (kunci Fernet, disarankan di produksi). Bila kosong, kunci
diturunkan dari JWT_SECRET — mengganti JWT_SECRET berarti isi brankas lama tidak terbaca lagi.
"""
import base64
import hashlib
import logging
import os
import re
from typing import Optional

import bcrypt
from cryptography.fernet import Fernet, InvalidToken

from auth_utils import JWT_SECRET

logger = logging.getLogger('matsandatama')

KOLEKSI_AKUN = 'simpan_akun'
KOLEKSI_PIN = 'simpan_akun_pin'
BATAS_GAGAL_PIN = 5
POLA_PIN = re.compile(r'^\d{6}$')

INDEX_SIMPAN_AKUN = [
    (KOLEKSI_AKUN, [('id', 1)], {'unique': True}),
    (KOLEKSI_AKUN, [('user_id', 1), ('nama_aplikasi', 1), ('nama_akun', 1)], {}),
    (KOLEKSI_PIN, [('user_id', 1)], {'unique': True}),
    (KOLEKSI_PIN, [('reset_diminta_pada', -1)], {}),
]


def _kunci_fernet() -> bytes:
    kunci = (os.environ.get('SIMPAN_AKUN_KEY') or '').strip()
    if kunci:
        return kunci.encode()
    logger.info("[simpan-akun] SIMPAN_AKUN_KEY kosong — kunci enkripsi diturunkan dari JWT_SECRET")
    return base64.urlsafe_b64encode(hashlib.sha256(f'simpan-akun:{JWT_SECRET}'.encode()).digest())


_fernet: Optional[Fernet] = None


def fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        _fernet = Fernet(_kunci_fernet())
    return _fernet


def enkripsi(teks: str) -> str:
    return fernet().encrypt((teks or '').encode()).decode()


def dekripsi(token: Optional[str]) -> str:
    """Isi terdekripsi; '' bila kosong. ValueError bila kunci tidak cocok (data tidak terbaca)."""
    if not token:
        return ''
    try:
        return fernet().decrypt(token.encode()).decode()
    except InvalidToken as e:
        raise ValueError('Isi brankas tidak dapat dibuka dengan kunci server saat ini') from e


def pin_valid(pin: Optional[str]) -> bool:
    return bool(POLA_PIN.match(pin or ''))


def alasan_pin_lemah(pin: Optional[str]) -> str:
    """PIN mudah ditebak -> alasan, '' bila cukup kuat (sama dengan alasanPinLemah di frontend)."""
    if not pin_valid(pin):
        return 'PIN harus 6 angka'
    if re.fullmatch(r'(\d)\1{5}', pin):
        return 'PIN tidak boleh angka yang sama semua'
    if pin in '0123456789' or pin in '9876543210':
        return 'PIN tidak boleh angka berurutan'
    if re.fullmatch(r'(\d\d)\1\1', pin) or re.fullmatch(r'(\d{3})\1', pin):
        return 'PIN tidak boleh pola berulang'
    return ''


def hash_pin(pin: str) -> str:
    return bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()


def cocok_pin(pin: str, pin_hash: Optional[str]) -> bool:
    if not pin_hash or not pin_valid(pin):
        return False
    try:
        return bcrypt.checkpw(pin.encode(), pin_hash.encode())
    except ValueError:
        return False


def ringkas_akun(doc: dict) -> dict:
    """Akun untuk daftar: TANPA password."""
    return {k: doc.get(k) for k in ('id', 'nama_akun', 'nama_aplikasi', 'link_web', 'username', 'created_at', 'updated_at')}


def detail_akun(doc: dict) -> dict:
    """Akun lengkap untuk pemilik yang sudah membuka brankas: password didekripsi."""
    return {**ringkas_akun(doc), 'password': dekripsi(doc.get('password_enc'))}


async def pastikan_index_simpan_akun(db) -> None:
    for koleksi, keys, opsi in INDEX_SIMPAN_AKUN:
        await db[koleksi].create_index(keys, **opsi)
