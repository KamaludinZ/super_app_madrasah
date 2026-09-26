"""
Authentication utilities: password hashing & JWT tokens.
Captcha gambar dan penguncian login ada di captcha_utils.py.
"""
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional, Dict, Any

import bcrypt
from dotenv import load_dotenv
from jose import jwt, JWTError

# Muat .env di sini juga: modul ini di-import oleh core.py SEBELUM core memanggil
# load_dotenv, sehingga tanpa baris ini JWT_SECRET dari file .env tidak terbaca
# dan server diam-diam memakai secret bawaan yang tertulis di repository.
load_dotenv(Path(__file__).parent / '.env', override=True)

_DEFAULT_JWT_SECRET = 'matsandatama-super-secret-key-2026-change-in-prod'
_WEAK_JWT_SECRETS = {
    _DEFAULT_JWT_SECRET,
    'change-this-jwt-secret-min-32-chars',
    'YOUR_VERY_STRONG_SECRET_KEY_HERE_MINIMUM_32_CHARACTERS',
}

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', _DEFAULT_JWT_SECRET)
if JWT_SECRET in _WEAK_JWT_SECRETS or len(JWT_SECRET) < 32:
    logging.getLogger("matsandatama").critical(
        "JWT_SECRET belum diganti / terlalu pendek. Siapa pun yang membaca repository "
        "bisa membuat token login palsu (termasuk admin). Set JWT_SECRET acak >= 32 karakter, "
        "contoh: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
    )
JWT_ALGORITHM = 'HS256'
JWT_EXPIRY_MINUTES = 60 * 12  # 12 hours (work day)

WIB_TZ = timezone(timedelta(hours=7))


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


PASSWORD_MIN_LENGTH = 8
_COMMON_PASSWORDS = {
    '12345678', '123456789', '1234567890', '87654321', '11111111', '00000000', '12341234',
    'password', 'password1', 'password123', 'passw0rd', 'qwerty123', 'qwertyuiop', 'asdfghjkl',
    'iloveyou', 'bismillah', 'bismillah123', 'indonesia', 'indonesia123', 'admin123', 'admin1234',
    'guru1234', 'siswa1234', 'madrasah', 'madrasah123', 'matsandatama', 'mtsn2malang', 'rahasia123',
}


def password_policy_error(password: str, username: Optional[str] = None) -> Optional[str]:
    """Kembalikan pesan error bila password lemah, atau None bila memenuhi aturan."""
    pw = password or ''
    if len(pw) < PASSWORD_MIN_LENGTH:
        return f"Password minimal {PASSWORD_MIN_LENGTH} karakter"
    if pw.lower() in _COMMON_PASSWORDS or len(set(pw)) <= 2:
        return "Password terlalu mudah ditebak. Gunakan kombinasi huruf dan angka yang tidak umum."
    if username and pw.lower() == username.lower():
        return "Password tidak boleh sama dengan username"
    return None


def create_access_token(payload: Dict[str, Any], expires_minutes: int = JWT_EXPIRY_MINUTES) -> str:
    to_encode = payload.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    # jti = ID unik token, dipakai untuk mencabut satu token saat logout
    to_encode.update({'exp': expire, 'jti': secrets.token_urlsafe(16)})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None
