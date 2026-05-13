"""
Smart Journal core logic - extracted from POC for production use.
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


def validate_gps(user_lat, user_lon, room_lat, room_lon,
                 radius_meters: float, gps_enabled: bool = True) -> Dict[str, Any]:
    if not gps_enabled:
        return {'valid': True, 'reason': 'Validasi GPS dinonaktifkan', 'distance': None}
    if room_lat is None or room_lon is None:
        return {'valid': True, 'reason': 'Ruangan belum diset koordinat GPS', 'distance': None}
    if user_lat is None or user_lon is None:
        return {'valid': False, 'reason': 'Koordinat GPS tidak terkirim dari perangkat', 'distance': None}
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


def _wrap_text(text: str, font, max_width: int, draw) -> List[str]:
    """Wrap text to fit within max_width pixels."""
    if not text:
        return []
    words = text.split()
    lines = []
    current = ''
    for w in words:
        test = (current + ' ' + w).strip()
        bbox = draw.textbbox((0, 0), test, font=font)
        width = bbox[2] - bbox[0]
        if width <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = w
    if current:
        lines.append(current)
    return lines


def create_b5_card(qr_data: str, room_name: str, class_name: str,
                    template_bytes: Optional[bytes] = None,
                    school_name: str = "MTsN 2 Kota Malang",
                    app_name: str = "Super Apps MATSANDATAMA") -> bytes:
    """Generate B5 portrait card (1386x1969 @ 200dpi) with optimized text sizing."""
    W, H = 1386, 1969

    use_template = False
    if template_bytes:
        try:
            bg = Image.open(io.BytesIO(template_bytes)).convert("RGB")
            bg = bg.resize((W, H))
            use_template = True
        except Exception:
            bg = Image.new("RGB", (W, H), color=(251, 247, 238))
    else:
        bg = Image.new("RGB", (W, H), color=(251, 247, 238))

    draw = ImageDraw.Draw(bg)

    # Try to find best available font - bumped sizes significantly
    font_paths_bold = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    ]
    font_paths_regular = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    ]

    def load_font(paths, size):
        for p in paths:
            if os.path.exists(p):
                try:
                    return ImageFont.truetype(p, size)
                except Exception:
                    pass
        return ImageFont.load_default()

    # MUCH bigger fonts for B5 print clarity
    font_app_name = load_font(font_paths_bold, 64)
    font_school = load_font(font_paths_regular, 44)
    font_class_huge = load_font(font_paths_bold, 200)  # The big "7A" - very prominent
    font_room_label = load_font(font_paths_bold, 56)
    font_instruction_main = load_font(font_paths_bold, 56)
    font_instruction_sub = load_font(font_paths_regular, 38)
    font_footer = load_font(font_paths_bold, 32)

    BRAND = (0, 104, 55)
    GOLD = (200, 162, 74)
    INK = (14, 26, 20)
    SOFT = (60, 60, 60)

    if not use_template:
        # Top banner: solid brand
        draw.rectangle([(0, 0), (W, 290)], fill=BRAND)
        # Bottom banner
        draw.rectangle([(0, H - 130), (W, H)], fill=BRAND)
        # Gold accents
        draw.rectangle([(0, 290), (W, 304)], fill=GOLD)
        draw.rectangle([(0, H - 144), (W, H - 130)], fill=GOLD)
        # Header text
        draw.text((W // 2, 110), app_name.upper(), fill="white", font=font_app_name, anchor="mm")
        draw.text((W // 2, 200), school_name, fill="white", font=font_school, anchor="mm")

    # Class name (BIG and prominent)
    class_y = 460 if not use_template else 350
    draw.text((W // 2, class_y), class_name, fill=BRAND, font=font_class_huge, anchor="mm")

    # Room label below
    room_y = class_y + 170
    draw.text((W // 2, room_y), f"RUANGAN: {room_name}", fill=INK, font=font_room_label, anchor="mm")

    # QR Code (large, well-spaced)
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=20, border=2)
    qr.add_data(qr_data)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    qr_size = 900
    qr_img = qr_img.resize((qr_size, qr_size))
    qr_x = (W - qr_size) // 2
    qr_y = room_y + 80

    # White card frame for QR
    pad = 36
    draw.rectangle([(qr_x - pad, qr_y - pad), (qr_x + qr_size + pad, qr_y + qr_size + pad)],
                   fill="white", outline=GOLD, width=6)
    bg.paste(qr_img, (qr_x, qr_y))

    # Instructions below QR (much larger now)
    inst_y = qr_y + qr_size + 90
    draw.text((W // 2, inst_y), "Scan dengan aplikasi", fill=SOFT, font=font_instruction_sub, anchor="mm")
    draw.text((W // 2, inst_y + 65), app_name.upper(), fill=BRAND, font=font_instruction_main, anchor="mm")
    draw.text((W // 2, inst_y + 130), "untuk mengisi Jurnal Mengajar", fill=SOFT, font=font_instruction_sub, anchor="mm")

    if not use_template:
        draw.text((W // 2, H - 65),
                  "✦ JURNAL PRESISI - Sistem Anti-Manipulasi ✦",
                  fill="white", font=font_footer, anchor="mm")

    buf = io.BytesIO()
    bg.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def generate_dynamic_qr_payload(room_id: str, room_secret: str) -> str:
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
