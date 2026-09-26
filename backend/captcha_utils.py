"""
Captcha gambar angka + pembatas percobaan login.

Kenapa disimpan di MongoDB (bukan dict di memori)?
Server dijalankan dengan beberapa worker uvicorn (`--workers 2`). Dict di memori
tidak dibagi antar-worker, sehingga captcha yang dibuat di worker A sering
"kedaluwarsa" saat login diproses worker B. Hal yang sama berlaku untuk
penguncian akun setelah gagal login berkali-kali.
"""
import base64
import hashlib
import hmac
import io
import math
import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from pymongo import ReturnDocument

from auth_utils import JWT_SECRET
from core import db, logger

CAPTCHA_LENGTH = 5
CAPTCHA_TTL_SECONDS = 300  # 5 menit
CAPTCHA_WIDTH = 200
CAPTCHA_HEIGHT = 70

MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 15

_rng = secrets.SystemRandom()
_indexes_ready = False

_FONT_CANDIDATES = [
    Path(__file__).parent / 'fonts' / 'Arial-Bold.ttf',
    Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'),
    Path('/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'),
]


def _load_font(size: int) -> ImageFont.ImageFont:
    for path in _FONT_CANDIDATES:
        if path.exists():
            try:
                return ImageFont.truetype(str(path), size)
            except OSError:
                continue
    return ImageFont.load_default(size=size)


async def _ensure_indexes():
    """TTL index agar MongoDB otomatis menghapus captcha/lockout yang kedaluwarsa."""
    global _indexes_ready
    if _indexes_ready:
        return
    try:
        await db.captcha_challenges.create_index('expires_at', expireAfterSeconds=0)
        await db.login_attempts.create_index('key', unique=True)
        await db.login_attempts.create_index('expires_at', expireAfterSeconds=0)
        _indexes_ready = True
    except Exception as e:  # index gagal dibuat tidak boleh menggagalkan login
        logger.warning(f"[captcha] Gagal membuat index: {e}")


def _hash_answer(challenge_id: str, answer: str) -> str:
    """Simpan hash jawaban, bukan jawaban asli, supaya tidak terbaca dari database."""
    msg = f"{challenge_id}:{answer}".encode('utf-8')
    return hmac.new(JWT_SECRET.encode('utf-8'), msg, hashlib.sha256).hexdigest()


def _normalize_answer(answer: Any) -> str:
    return ''.join(ch for ch in str(answer or '') if ch.isdigit())


def _random_color(low: int, high: int):
    return tuple(_rng.randint(low, high) for _ in range(3))


def render_captcha_image(text: str) -> bytes:
    """Gambar angka dengan rotasi, ukuran acak, garis pengganggu, bintik, dan distorsi gelombang."""
    img = Image.new('RGB', (CAPTCHA_WIDTH, CAPTCHA_HEIGHT), _random_color(235, 250))
    draw = ImageDraw.Draw(img)

    # Bintik latar
    for _ in range(350):
        draw.point((_rng.randrange(CAPTCHA_WIDTH), _rng.randrange(CAPTCHA_HEIGHT)),
                   fill=_random_color(150, 230))

    # Garis latar tipis
    for _ in range(4):
        draw.line([(_rng.randrange(CAPTCHA_WIDTH), _rng.randrange(CAPTCHA_HEIGHT)),
                   (_rng.randrange(CAPTCHA_WIDTH), _rng.randrange(CAPTCHA_HEIGHT))],
                  fill=_random_color(160, 210), width=1)

    # Setiap angka digambar di layer sendiri lalu diputar
    slot = (CAPTCHA_WIDTH - 20) / len(text)
    for i, ch in enumerate(text):
        font = _load_font(_rng.randint(32, 40))
        layer = Image.new('RGBA', (60, 70), (0, 0, 0, 0))
        ImageDraw.Draw(layer).text((12, 4), ch, font=font, fill=_random_color(10, 110) + (255,))
        layer = layer.rotate(_rng.uniform(-28, 28), resample=Image.BICUBIC, expand=False)
        x = int(10 + i * slot + _rng.uniform(-4, 4))
        y = _rng.randint(0, 6)
        img.paste(layer, (x, y), layer)

    # Distorsi gelombang (geser tiap kolom piksel naik/turun)
    amplitude = _rng.uniform(2.5, 4.5)
    period = _rng.uniform(40, 70)
    phase = _rng.uniform(0, 2 * math.pi)
    src = img.copy()
    for x in range(CAPTCHA_WIDTH):
        dy = int(amplitude * math.sin(2 * math.pi * x / period + phase))
        column = src.crop((x, 0, x + 1, CAPTCHA_HEIGHT))
        img.paste(column, (x, dy))

    # Garis pengganggu yang memotong angka
    draw = ImageDraw.Draw(img)
    for _ in range(2):
        y0 = _rng.randint(20, CAPTCHA_HEIGHT - 20)
        points = [(x, y0 + int(8 * math.sin(x / _rng.uniform(12, 25))))
                  for x in range(0, CAPTCHA_WIDTH, 6)]
        draw.line(points, fill=_random_color(40, 140), width=2)

    img = img.filter(ImageFilter.SMOOTH)
    buf = io.BytesIO()
    img.save(buf, format='PNG', optimize=True)
    return buf.getvalue()


async def create_captcha() -> Dict[str, Any]:
    await _ensure_indexes()
    text = ''.join(str(_rng.randrange(10)) for _ in range(CAPTCHA_LENGTH))
    challenge_id = secrets.token_urlsafe(24)
    await db.captcha_challenges.insert_one({
        'id': challenge_id,
        'answer_hash': _hash_answer(challenge_id, text),
        'expires_at': datetime.now(timezone.utc) + timedelta(seconds=CAPTCHA_TTL_SECONDS),
    })
    png = render_captcha_image(text)
    return {
        'challenge_id': challenge_id,
        'image': 'data:image/png;base64,' + base64.b64encode(png).decode('ascii'),
        'length': CAPTCHA_LENGTH,
        'expires_in': CAPTCHA_TTL_SECONDS,
    }


async def verify_captcha(challenge_id: str, user_answer: Any) -> bool:
    """Captcha hanya bisa dipakai sekali: dokumen langsung dihapus saat diverifikasi."""
    if not challenge_id:
        return False
    item = await db.captcha_challenges.find_one_and_delete({'id': challenge_id})
    if not item:
        return False
    expires_at = item.get('expires_at')
    if isinstance(expires_at, datetime):
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            return False
    answer = _normalize_answer(user_answer)
    if len(answer) != CAPTCHA_LENGTH:
        return False
    return hmac.compare_digest(item.get('answer_hash', ''), _hash_answer(challenge_id, answer))


# ============================================================
# PENGUNCIAN SETELAH GAGAL LOGIN (dibagi antar-worker via MongoDB)
# ============================================================
async def is_locked(key: str) -> int:
    """Kembalikan sisa detik terkunci (0 jika tidak terkunci)."""
    await _ensure_indexes()
    entry = await db.login_attempts.find_one({'key': key})
    if not entry or not entry.get('locked_until'):
        return 0
    locked_until = entry['locked_until']
    if locked_until.tzinfo is None:
        locked_until = locked_until.replace(tzinfo=timezone.utc)
    remaining = (locked_until - datetime.now(timezone.utc)).total_seconds()
    return int(remaining) if remaining > 0 else 0


async def record_login_failure(key: str) -> Dict[str, Any]:
    """Tambah hitungan gagal; kunci LOCKOUT_MINUTES menit bila mencapai batas."""
    await _ensure_indexes()
    now = datetime.now(timezone.utc)
    entry = await db.login_attempts.find_one_and_update(
        {'key': key},
        {'$inc': {'attempts': 1},
         '$set': {'expires_at': now + timedelta(minutes=LOCKOUT_MINUTES)}},
        upsert=True, return_document=ReturnDocument.AFTER,
    )
    attempts = entry.get('attempts', 1)
    if attempts >= MAX_LOGIN_ATTEMPTS:
        await db.login_attempts.update_one({'key': key}, {'$set': {
            'attempts': 0,
            'locked_until': now + timedelta(minutes=LOCKOUT_MINUTES),
            'expires_at': now + timedelta(minutes=LOCKOUT_MINUTES),
        }})
        return {'locked': True, 'attempts': attempts, 'remaining': MAX_LOGIN_ATTEMPTS - attempts}
    return {'locked': False, 'attempts': attempts, 'remaining': MAX_LOGIN_ATTEMPTS - attempts}


async def reset_login_attempts(key: str):
    await db.login_attempts.delete_one({'key': key})
