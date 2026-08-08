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


def _fit_font_size(text: str, font_paths: List[str], start_size: int, min_size: int, max_width: int, draw):
    """Shrink font size until text fits max_width."""
    size = start_size
    while size >= min_size:
        font = None
        for p in font_paths:
            if os.path.exists(p):
                try:
                    font = ImageFont.truetype(p, size)
                    break
                except Exception:
                    pass
        if font is None:
            font = ImageFont.load_default()
            return font, size

        bbox = draw.textbbox((0, 0), text, font=font)
        width = bbox[2] - bbox[0]
        if width <= max_width:
            return font, size
        size -= 4

    # Fallback min size
    font = None
    for p in font_paths:
        if os.path.exists(p):
            try:
                font = ImageFont.truetype(p, min_size)
                break
            except Exception:
                pass
    if font is None:
        font = ImageFont.load_default()
    return font, min_size


def create_b5_card(qr_data: str, room_name: str, class_name: str,
                    template_bytes: Optional[bytes] = None,
                    school_name: str = "MTsN 2 Kota Malang",
                    app_name: str = "Super Apps MATSANDATAMA",
                    class_token: Optional[str] = None) -> bytes:
    """
    Generate professional B5 portrait card (4158x5880 @ 300dpi) with highly-legible design.
    Designed for optimal readability when printed at B5 size (176mm x 250mm).

    Text sizing optimized for B5 print quality with clear hierarchy and proper spacing.
    Supports custom background templates while maintaining text legibility.
    Updated to 300 DPI for higher print quality.
    """
    W, H = 4158, 5880  # B3 size at 300 DPI (was 2772x3920 at 200 DPI)

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
    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))

    font_paths_bold = [
        # Bundled fonts (highest priority)
        os.path.join(script_dir, 'fonts', 'DejaVuSans-Bold.ttf'),
        os.path.join(script_dir, 'fonts', 'Arial-Bold.ttf'),
        # Linux system fonts
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
        '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf',
        '/System/Library/Fonts/Supplemental/Arial Bold.ttf',  # macOS
        # Windows fallback
        'C:/Windows/Fonts/arialbd.ttf',
        'C:/Windows/Fonts/Arial.ttf',
    ]
    font_paths_regular = [
        # Bundled fonts (highest priority)
        os.path.join(script_dir, 'fonts', 'DejaVuSans.ttf'),
        os.path.join(script_dir, 'fonts', 'Arial.ttf'),
        # Linux system fonts
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
        '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
        '/System/Library/Fonts/Supplemental/Arial.ttf',  # macOS
        # Windows fallback
        'C:/Windows/Fonts/arial.ttf',
        'C:/Windows/Fonts/Arial.ttf',
    ]

    def load_font(paths, size, font_type="unknown"):
        """Load font with extensive logging for debugging production issues"""
        for i, p in enumerate(paths):
            if os.path.exists(p):
                try:
                    font = ImageFont.truetype(p, size)
                    logger.info(f"[FONT] Successfully loaded {font_type} font: {p} at size {size}")
                    return font
                except Exception as e:
                    logger.warning(f"[FONT] Failed to load {font_type} font from {p}: {e}")
                    continue

        # If we get here, no fonts were found - this is critical!
        logger.error(f"[FONT] CRITICAL: No {font_type} font found! Tried {len(paths)} paths. Using default font (will be small and blurry).")
        logger.error(f"[FONT] Paths tried: {paths[:3]}...")  # Log first 3 paths

        # Last resort: try to use a basic TrueType font with larger size to compensate
        try:
            # Try to create a simple bitmap font at larger size
            return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size * 2)
        except:
            return ImageFont.load_default()

    # PROFESSIONAL B5-OPTIMIZED FONT SIZES AT 300 DPI
    # All sizes scaled by 1.5x from 200 DPI to maintain visual proportions
    font_app_name_header = load_font(font_paths_bold, 128, "app_name_header")  # 85 * 1.5
    font_school_header = load_font(font_paths_regular, 78, "school_header")  # 52 * 1.5
    font_class_huge = load_font(font_paths_bold, 369, "class_huge")  # 246 * 1.5
    font_room_label = load_font(font_paths_bold, 135, "room_label")  # 90 * 1.5
    font_instruction_title = load_font(font_paths_bold, 78, "instruction_title")  # 52 * 1.5
    font_instruction_medium = load_font(font_paths_regular, 51, "instruction_medium")  # 34 * 1.5
    font_token_label = load_font(font_paths_regular, 78, "token_label")  # 52 * 1.5
    font_token_value = load_font(font_paths_bold, 107, "token_value")  # 71 * 1.5
    font_footer = load_font(font_paths_bold, 51, "footer")  # 34 * 1.5
    font_body_text = load_font(font_paths_regular, 33, "body_text")  # 22 * 1.5

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

    # Main content safe zones
    content_top = 360 if use_template else 430
    content_bottom = H - (230 if not use_template else 180)
    max_text_width = int(W * 0.86)

    # Dynamic fit for class text
    class_text = str(class_name or "")
    font_class_huge, _ = _fit_font_size(
        class_text,
        font_paths_bold,
        start_size=369,  # 246 * 1.5 for 300 DPI
        min_size=156,  # 104 * 1.5 for 300 DPI
        max_width=max_text_width,
        draw=draw,
    )

    class_y = int(content_top * 1.68)
    draw.text((W // 2, class_y), class_text, fill=HUNTER_GREEN, font=font_class_huge, anchor="mm")

    # Dynamic fit for room label
    room_text = f"RUANGAN {room_name}"
    font_room_label, _ = _fit_font_size(
        room_text,
        font_paths_bold,
        start_size=135,  # 90 * 1.5 for 300 DPI
        min_size=72,  # 48 * 1.5 for 300 DPI
        max_width=max_text_width,
        draw=draw,
    )
    room_y = class_y + 423
    draw.text((W // 2, room_y), room_text, fill=HUNTER_GREEN, font=font_room_label, anchor="mm")

    # QR CODE - Central element in white panel with gold border
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=22, border=2)
    qr.add_data(qr_data)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")

    qr_size = 1988
    # Use LANCZOS with compatibility for both old and new PIL versions
    try:
        resample_method = Image.Resampling.LANCZOS
    except AttributeError:
        resample_method = Image.LANCZOS
    qr_img = qr_img.resize((qr_size, qr_size), resample_method)
    qr_x = (W - qr_size) // 2
    qr_y = room_y + 214

    # White panel with polished gold border for QR code
    panel_padding = 78
    draw.rectangle(
        [(qr_x - panel_padding, qr_y - panel_padding),
         (qr_x + qr_size + panel_padding, qr_y + qr_size + panel_padding)],
        fill="white", outline=POLISHED_GOLD, width=8
    )
    bg.paste(qr_img, (qr_x, qr_y))

    # TOKEN KELAS section - Positioned directly below QR code
    # Display token for the room/class
    token_value_text = str(class_token) if class_token else "—"

    # Calculate token section position - directly below QR code with proper spacing
    token_section_y = qr_y + qr_size + 150  # Increased from 120 to move token section down

    # Token display without box - just text
    spacing_between = 30  # Spacing between label and value

    # Position label and value - centered below QR code
    label_y = token_section_y
    value_y = label_y + 120  # Space between "KODE KELAS" and the token value

    # Draw token label and value with improved contrast
    draw.text((W // 2, label_y), "KODE KELAS",
              fill=MEDIUM_GRAY, font=font_token_label, anchor="mm")
    draw.text((W // 2, value_y), token_value_text,
              fill=HUNTER_GREEN, font=font_token_value, anchor="mm")

    buf = io.BytesIO()
    # Save with explicit DPI metadata to ensure consistent print sizing
    # The dpi parameter in Pillow automatically sets the pHYs chunk for proper scaling
    bg.save(buf, "PNG", optimize=True, dpi=(300, 300))
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
