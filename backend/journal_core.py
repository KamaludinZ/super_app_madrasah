"""
Smart Journal core logic - extracted from POC for production use.
Handles QR encryption/decryption, schedule validation, GPS check, B5 card generation.
"""
import os
import math
import json
import base64
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
import io

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

import qrcode
from PIL import Image, ImageDraw, ImageFont
import pyotp

WIB_TZ = timezone(timedelta(hours=7))
SCHOOL_ID = os.environ.get('SCHOOL_ID', 'MTSN2-MLG')
MASTER_SECRET = os.environ.get('QR_MASTER_SECRET', 'MATSANDATAMA-SECRET-KEY-2026-V1')


def now_wib() -> datetime:
    return datetime.now(WIB_TZ)


def _derive_key(secret: str = MASTER_SECRET) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"matsandatama_salt_2026",
        iterations=100_000,
    )
    return base64.urlsafe_b64encode(kdf.derive(secret.encode()))


def encrypt_qr_payload(room_id: str, school_id: str = SCHOOL_ID, ttl_seconds: int = 0,
                       extra: Optional[Dict[str, Any]] = None) -> str:
    fernet = Fernet(_derive_key())
    payload = {
        'school_id': school_id,
        'room_id': room_id,
        'issued_at': now_wib().isoformat(),
        'ttl': ttl_seconds,
    }
    if extra:
        payload.update(extra)
    token = fernet.encrypt(json.dumps(payload).encode())
    return token.decode()


def decrypt_qr_payload(token: str) -> Optional[Dict[str, Any]]:
    try:
        fernet = Fernet(_derive_key())
        decrypted = fernet.decrypt(token.encode())
        payload = json.loads(decrypted.decode())
        if payload.get('school_id') != SCHOOL_ID:
            return None
        if payload.get('ttl', 0) > 0:
            issued_at = datetime.fromisoformat(payload['issued_at'])
            if now_wib() - issued_at > timedelta(seconds=payload['ttl']):
                return None
        return payload
    except Exception:
        return None


def generate_qr_image_b64(data: str, size: int = 10) -> str:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=size,
        border=2,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return base64.b64encode(buf.getvalue()).decode('utf-8')


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def validate_gps(user_lat: Optional[float], user_lon: Optional[float],
                 room_lat: Optional[float], room_lon: Optional[float],
                 radius_meters: float, gps_enabled: bool = True) -> Dict[str, Any]:
    if not gps_enabled:
        return {'valid': True, 'reason': 'GPS validation disabled', 'distance': None}
    if room_lat is None or room_lon is None:
        return {'valid': True, 'reason': 'Room has no GPS coordinates', 'distance': None}
    if user_lat is None or user_lon is None:
        return {'valid': False, 'reason': 'GPS coordinates not provided by client', 'distance': None}
    distance = haversine_distance(user_lat, user_lon, room_lat, room_lon)
    valid = distance <= radius_meters
    return {
        'valid': valid,
        'distance': round(distance, 2),
        'radius': radius_meters,
        'reason': f"Jarak {round(distance,2)}m {'di dalam' if valid else 'di luar'} radius {radius_meters}m"
    }


DAY_MAP_ID_EN = {
    'senin': 'monday', 'selasa': 'tuesday', 'rabu': 'wednesday',
    'kamis': 'thursday', 'jumat': 'friday', 'sabtu': 'saturday', 'minggu': 'sunday'
}
DAY_MAP_EN_ID = {v: k for k, v in DAY_MAP_ID_EN.items()}


def current_day_id() -> str:
    """Return Indonesian day name in lowercase"""
    en_day = now_wib().strftime('%A').lower()
    return DAY_MAP_EN_ID.get(en_day, en_day)


def validate_schedule(teacher_id: str, room_id: str, schedules: List[Dict],
                       check_time: Optional[datetime] = None, grace_minutes: int = 15) -> Dict[str, Any]:
    if check_time is None:
        check_time = now_wib()

    day = current_day_id()

    for sched in schedules:
        if str(sched.get('teacher_id')) != str(teacher_id):
            continue
        if str(sched.get('room_id')) != str(room_id):
            continue
        sched_day = sched.get('day', '').lower()
        if sched_day != day and DAY_MAP_ID_EN.get(sched_day) != check_time.strftime('%A').lower():
            continue

        try:
            start_h, start_m = map(int, sched['start_time'].split(':'))
            end_h, end_m = map(int, sched['end_time'].split(':'))
        except Exception:
            continue

        start_dt = check_time.replace(hour=start_h, minute=start_m, second=0, microsecond=0)
        end_dt = check_time.replace(hour=end_h, minute=end_m, second=0, microsecond=0)

        grace_start = start_dt - timedelta(minutes=grace_minutes)
        grace_end = end_dt + timedelta(minutes=grace_minutes)

        if grace_start <= check_time <= grace_end:
            locked = check_time > end_dt + timedelta(minutes=grace_minutes)
            return {
                'valid': True,
                'schedule': sched,
                'start_time': start_dt.isoformat(),
                'end_time': end_dt.isoformat(),
                'locked': locked,
                'reason': f"Jadwal aktif: {sched.get('subject_name', sched.get('subject', 'Mata pelajaran'))}"
            }

    return {
        'valid': False,
        'reason': f"Tidak ada jadwal mengajar Anda di kelas ini pada hari {day} jam {check_time.strftime('%H:%M')} WIB",
        'schedule': None,
    }


def create_b5_card(qr_data: str, room_name: str, class_name: str,
                    template_bytes: Optional[bytes] = None,
                    school_name: str = "MTsN 2 Kota Malang",
                    app_name: str = "Super Apps MATSANDATAMA") -> bytes:
    """Generate B5 portrait card (1386x1969 @ 200dpi) and return PNG bytes"""
    W, H = 1386, 1969

    if template_bytes:
        try:
            bg = Image.open(io.BytesIO(template_bytes)).convert("RGB")
            # Resize to B5 portrait
            bg = bg.resize((W, H))
            use_template = True
        except Exception:
            bg = Image.new("RGB", (W, H), color=(251, 247, 238))  # cream
            use_template = False
    else:
        bg = Image.new("RGB", (W, H), color=(251, 247, 238))
        use_template = False

    draw = ImageDraw.Draw(bg)

    try:
        font_huge = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 80)
        font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 60)
        font_subtitle = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 42)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 30)
    except Exception:
        font_huge = ImageFont.load_default()
        font_title = ImageFont.load_default()
        font_subtitle = ImageFont.load_default()
        font_small = ImageFont.load_default()

    if not use_template:
        # Top banner: Kemenag green
        draw.rectangle([(0, 0), (W, 280)], fill=(0, 104, 55))
        # Bottom banner
        draw.rectangle([(0, H-150), (W, H)], fill=(0, 104, 55))
        # Decorative gold lines
        draw.rectangle([(0, 280), (W, 290)], fill=(200, 162, 74))
        draw.rectangle([(0, H-160), (W, H-150)], fill=(200, 162, 74))
        draw.text((W//2, 100), app_name.upper(), fill="white", font=font_title, anchor="mm")
        draw.text((W//2, 200), school_name, fill="white", font=font_subtitle, anchor="mm")

    # Class/Room info
    draw.text((W//2, 420), class_name, fill=(0, 50, 30), font=font_huge, anchor="mm")
    draw.text((W//2, 510), f"Ruangan: {room_name}", fill=(50, 50, 50), font=font_subtitle, anchor="mm")

    # QR code
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=18, border=2)
    qr.add_data(qr_data)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    qr_size = 900
    qr_img = qr_img.resize((qr_size, qr_size))
    qr_x = (W - qr_size) // 2
    qr_y = 620

    # White background card for QR
    pad = 30
    draw.rectangle([(qr_x - pad, qr_y - pad), (qr_x + qr_size + pad, qr_y + qr_size + pad)],
                   fill="white", outline=(200, 162, 74), width=4)
    bg.paste(qr_img, (qr_x, qr_y))

    # Instructions
    draw.text((W//2, qr_y + qr_size + 100),
              "Scan QR ini dengan aplikasi", fill=(50, 50, 50), font=font_subtitle, anchor="mm")
    draw.text((W//2, qr_y + qr_size + 160),
              "SUPER APPS MATSANDATAMA", fill=(0, 104, 55), font=font_title, anchor="mm")
    draw.text((W//2, qr_y + qr_size + 220),
              "untuk mengisi Jurnal Mengajar", fill=(80, 80, 80), font=font_small, anchor="mm")

    if not use_template:
        draw.text((W//2, H-75),
                  "✦ JURNAL PRESISI - Sistem Anti-Manipulasi ✦",
                  fill="white", font=font_small, anchor="mm")

    buf = io.BytesIO()
    bg.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def generate_dynamic_qr_payload(room_id: str, room_secret: str) -> str:
    """TOTP-based dynamic QR (refresh every 30s)"""
    totp = pyotp.TOTP(room_secret, interval=30)
    current_code = totp.now()
    fernet = Fernet(_derive_key())
    payload = {
        'school_id': SCHOOL_ID,
        'room_id': room_id,
        'totp_code': current_code,
        'issued_at': now_wib().isoformat(),
        'ttl': 60,
        'mode': 'dynamic',
    }
    return fernet.encrypt(json.dumps(payload).encode()).decode()


def validate_dynamic_qr(token: str, room_secret: str) -> Dict[str, Any]:
    payload = decrypt_qr_payload(token)
    if not payload:
        return {'valid': False, 'reason': 'QR tidak valid atau kedaluwarsa'}
    code = payload.get('totp_code')
    if not code:
        return {'valid': False, 'reason': 'Bukan QR dinamis'}
    totp = pyotp.TOTP(room_secret, interval=30)
    if totp.verify(code, valid_window=1):
        return {'valid': True, 'reason': 'QR dinamis valid', 'payload': payload}
    return {'valid': False, 'reason': 'Kode TOTP tidak valid/kedaluwarsa'}
