"""
Authentication utilities: password hashing & JWT tokens.
Captcha gambar dan penguncian login ada di captcha_utils.py.
"""
import logging
import os
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


def create_access_token(payload: Dict[str, Any], expires_minutes: int = JWT_EXPIRY_MINUTES) -> str:
    to_encode = payload.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    to_encode.update({'exp': expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None
