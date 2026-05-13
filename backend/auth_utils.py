"""
Authentication utilities: password hashing, JWT tokens, math captcha, rate limiting.
"""
import os
import random
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

import bcrypt
from jose import jwt, JWTError

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'matsandatama-super-secret-key-2026-change-in-prod')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRY_MINUTES = 60 * 12  # 12 hours (work day)

# Rate limit settings
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 15

# In-memory captcha & rate-limit storage
_captcha_store: Dict[str, Dict[str, Any]] = {}
_login_attempts: Dict[str, Dict[str, Any]] = {}

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


# ============================================================
# MATH CAPTCHA
# ============================================================
def generate_math_captcha() -> Dict[str, Any]:
    """Generate a simple math captcha (addition/subtraction)"""
    a = random.randint(1, 20)
    b = random.randint(1, 20)
    op = random.choice(['+', '-'])
    if op == '+':
        answer = a + b
    else:
        # Ensure positive result
        if a < b:
            a, b = b, a
        answer = a - b

    challenge_id = secrets.token_urlsafe(16)
    _captcha_store[challenge_id] = {
        'answer': answer,
        'expires_at': time.time() + 300,  # 5 minutes
    }
    # Cleanup expired captchas
    _cleanup_captchas()
    return {
        'challenge_id': challenge_id,
        'question': f"Berapa {a} {op} {b} = ?",
        'expires_in': 300,
    }


def verify_captcha(challenge_id: str, user_answer: int) -> bool:
    item = _captcha_store.get(challenge_id)
    if not item:
        return False
    if item['expires_at'] < time.time():
        _captcha_store.pop(challenge_id, None)
        return False
    valid = item['answer'] == user_answer
    # Single-use captcha
    _captcha_store.pop(challenge_id, None)
    return valid


def _cleanup_captchas():
    now = time.time()
    expired = [k for k, v in _captcha_store.items() if v['expires_at'] < now]
    for k in expired:
        _captcha_store.pop(k, None)


# ============================================================
# RATE LIMITING (Login attempts)
# ============================================================
def record_login_attempt(username: str, success: bool) -> Dict[str, Any]:
    """Track login attempts. Returns lockout info if locked."""
    now = time.time()
    entry = _login_attempts.get(username, {'attempts': 0, 'locked_until': 0})

    if entry['locked_until'] > now:
        return {'locked': True, 'remaining': int(entry['locked_until'] - now)}

    if success:
        # Reset on success
        _login_attempts.pop(username, None)
        return {'locked': False, 'remaining': 0, 'attempts': 0}

    # Failed attempt
    entry['attempts'] = entry.get('attempts', 0) + 1
    if entry['attempts'] >= MAX_LOGIN_ATTEMPTS:
        entry['locked_until'] = now + (LOCKOUT_MINUTES * 60)
        entry['attempts'] = 0
        _login_attempts[username] = entry
        return {'locked': True, 'remaining': LOCKOUT_MINUTES * 60}

    _login_attempts[username] = entry
    return {'locked': False, 'remaining': 0, 'attempts': entry['attempts']}


def is_locked(username: str) -> bool:
    entry = _login_attempts.get(username)
    if not entry:
        return False
    return entry.get('locked_until', 0) > time.time()
