"""
Smart Journal core logic - extracted from POC for production use.
"""
import os
import math
import json
import base64
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
import io

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

import qrcode
from PIL import Image, ImageDraw, ImageFont
import pyotp

# Setup logger
logger = logging.getLogger(__name__)

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
                    app_name: str = "Super Apps MATSANDATAMA",
                    class_token: Optional[str] = None) -> bytes:
    """
    Generate professional B5 portrait card (1386x1969 @ 200dpi) with highly-legible design.
    Designed for optimal readability when printed at B5 size (176mm x 250mm).

    Text sizing optimized for B5 print quality with clear hierarchy and proper spacing.
    Supports custom background templates while maintaining text legibility.
    """
    W, H = 1386, 1969

    # Load background - either custom template or default cream color
    use_template = False
    if template_bytes:
        try:
            logger.info(f"[CREATE_CARD] Loading template, size: {len(template_bytes)} bytes")
            bg = Image.open(io.BytesIO(template_bytes)).convert("RGBA")
            logger.info(f"[CREATE_CARD] Template loaded, original size: {bg.size}, mode: {bg.mode}")
            # Use LANCZOS with compatibility for both old and new PIL versions
            try:
                resample_method = Image.Resampling.LANCZOS
            except AttributeError:
                resample_method = Image.LANCZOS
            bg = bg.resize((W, H), resample_method)
            logger.info(f"[CREATE_CARD] Template resized to {W}x{H}")
            # Convert to RGB with white background for templates with transparency
            final_bg = Image.new("RGB", (W, H), color=(255, 255, 255))
            final_bg.paste(bg, (0, 0), bg if bg.mode == 'RGBA' else None)
            bg = final_bg
            use_template = True
            logger.info(f"[CREATE_CARD] Template applied successfully, use_template={use_template}")
        except Exception as e:
            logger.error(f"[CREATE_CARD] Failed to load template: {e}, using default background")
            import traceback
            logger.error(traceback.format_exc())
            bg = Image.new("RGB", (W, H), color=(251, 247, 238))
    else:
        logger.info(f"[CREATE_CARD] No template provided, using default cream background")
        bg = Image.new("RGB", (W, H), color=(251, 247, 238))

    draw = ImageDraw.Draw(bg)

    # Professional font loading with fallbacks
    font_paths_bold = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
        'C:/Windows/Fonts/arialbd.ttf',  # Windows fallback
    ]
    font_paths_regular = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
        'C:/Windows/Fonts/arial.ttf',  # Windows fallback
    ]

    def load_font(paths, size):
        for p in paths:
            if os.path.exists(p):
                try:
                    return ImageFont.truetype(p, size)
                except Exception:
                    pass
        return ImageFont.load_default()

    # PROFESSIONAL B5-OPTIMIZED FONT SIZES WITH HIERARCHY
    # All sizes properly scaled for B5 print (176mm x 250mm @ 200 DPI)
    # Minimum body text: 12pt = ~32px @ 200 DPI
    font_app_name_header = load_font(font_paths_bold, 140)      # 52pt - App name (largest)
    font_school_header = load_font(font_paths_regular, 85)      # 32pt - School name
    font_class_huge = load_font(font_paths_bold, 420)           # 158pt - Giant class number (e.g., "7A")
    font_room_label = load_font(font_paths_bold, 110)           # 41pt - "RUANGAN 7A"
    font_instruction_title = load_font(font_paths_bold, 100)    # 37pt - "E-JURNAL PRESISI"
    font_instruction_medium = load_font(font_paths_regular, 70) # 26pt - Medium text
    font_token_label = load_font(font_paths_regular, 75)        # 28pt - "TOKEN KELAS" label
    font_token_value = load_font(font_paths_bold, 130)          # 49pt - Token value (huge!)
    font_footer = load_font(font_paths_bold, 58)                # 22pt - Footer text
    font_body_text = load_font(font_paths_regular, 42)          # 16pt - Body text (min 12pt)

    # Professional color palette
    HUNTER_GREEN = (0, 104, 55)      # Deep hunter green for headers
    POLISHED_GOLD = (200, 162, 74)   # Refined gold for accents
    INK_BLACK = (14, 26, 20)         # Near-black for main text
    MEDIUM_GRAY = (80, 80, 80)       # Medium gray for secondary text

    # Only draw default bands and header if not using custom template
    if not use_template:
        # Top header band - deep hunter green
        header_height = 300
        draw.rectangle([(0, 0), (W, header_height)], fill=HUNTER_GREEN)

        # Gold accent line below header
        gold_accent_height = 14
        draw.rectangle([(0, header_height), (W, header_height + gold_accent_height)], fill=POLISHED_GOLD)

        # Bottom footer band - deep hunter green
        footer_height = 150
        draw.rectangle([(0, H - footer_height), (W, H)], fill=HUNTER_GREEN)

        # Gold accent line above footer
        draw.rectangle([(0, H - footer_height - gold_accent_height), (W, H - footer_height)], fill=POLISHED_GOLD)

        # Header text - app name and school name
        draw.text((W // 2, 120), app_name.upper(), fill="white", font=font_app_name_header, anchor="mm")
        draw.text((W // 2, 220), school_name, fill="white", font=font_school_header, anchor="mm")

    # Main content area - centered and well-spaced
    content_start_y = 450 if not use_template else 320

    # CLASS NAME - Huge, centered, highly prominent (e.g., "7A")
    draw.text((W // 2, content_start_y), class_name, fill=HUNTER_GREEN, font=font_class_huge, anchor="mm")

    # ROOM LABEL - Clear and readable below class name
    room_y = content_start_y + 250
    draw.text((W // 2, room_y), f"RUANGAN {room_name}", fill=HUNTER_GREEN, font=font_room_label, anchor="mm")

    # QR CODE - Central element in white panel with gold border
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=22, border=2)
    qr.add_data(qr_data)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")

    qr_size = 800
    # Use LANCZOS with compatibility for both old and new PIL versions
    try:
        resample_method = Image.Resampling.LANCZOS
    except AttributeError:
        resample_method = Image.LANCZOS
    qr_img = qr_img.resize((qr_size, qr_size), resample_method)
    qr_x = (W - qr_size) // 2
    qr_y = room_y + 100

    # White panel with polished gold border for QR code
    panel_padding = 40
    draw.rectangle(
        [(qr_x - panel_padding, qr_y - panel_padding),
         (qr_x + qr_size + panel_padding, qr_y + qr_size + panel_padding)],
        fill="white", outline=POLISHED_GOLD, width=8
    )
    bg.paste(qr_img, (qr_x, qr_y))

    # E-JURNAL PRESISI label below QR
    instruction_y = qr_y + qr_size + 80
    draw.text((W // 2, instruction_y), "E-JURNAL PRESISI",
              fill=INK_BLACK, font=font_instruction_title, anchor="mm")

    # TOKEN KELAS section - if provided, display in green footer band area
    if class_token and not use_template:
        # Token displayed in the lower green band area
        token_y = H - 75
        # Use two-column layout: "TOKEN KELAS" on left side, actual token on right
        token_label_x = W // 4
        token_value_x = 3 * W // 4

        draw.text((token_label_x, token_y), "TOKEN KELAS",
                  fill="white", font=font_token_label, anchor="mm")
        draw.text((token_value_x, token_y), str(class_token),
                  fill="white", font=font_token_value, anchor="mm")
    elif class_token and use_template:
        # For custom templates, show token below QR area
        token_y = instruction_y + 100
        draw.text((W // 2, token_y), "TOKEN KELAS",
                  fill=MEDIUM_GRAY, font=font_token_label, anchor="mm")
        draw.text((W // 2, token_y + 90), str(class_token),
                  fill=HUNTER_GREEN, font=font_token_value, anchor="mm")

    buf = io.BytesIO()
    bg.save(buf, "PNG", optimize=True, dpi=(200, 200))
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
