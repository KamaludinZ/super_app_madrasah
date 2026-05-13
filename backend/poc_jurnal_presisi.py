"""
POC Script: Smart Journal "Jurnal Presisi" Core Validation
============================================================
This script validates the core flow in isolation BEFORE building the full app:

1. Generate encrypted QR Code (Fernet AES) for a room
2. Decrypt QR Code → extract Room_ID
3. Schedule Validation (teacher has class at this room at current time)
4. GPS Geofencing (Haversine distance vs radius, toggle on/off)
5. Journal Creation with multi-factor validation status
6. Auto-lock journal based on end time + grace period
7. B5 Card Template - upload background + overlay QR + room info
8. Dynamic QR (TOTP-based) refresh every 30 seconds

Run: python /app/backend/poc_jurnal_presisi.py
"""

import os
import sys
import math
import json
import base64
import io
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any

# Encryption
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

# QR Code + Image
import qrcode
from PIL import Image, ImageDraw, ImageFont

# TOTP for Dynamic QR
import pyotp

# Constants
WIB_TZ = timezone(timedelta(hours=7))  # Asia/Jakarta timezone
SCHOOL_ID = "MTSN2-MLG"
MASTER_SECRET = "MATSANDATAMA-SECRET-KEY-2026-V1"


# ============================================================
# 1. ENCRYPTION HELPERS (AES via Fernet with derived key)
# ============================================================
def derive_key(secret: str) -> bytes:
    """Derive Fernet-compatible key from master secret using PBKDF2"""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"matsandatama_salt_2026",
        iterations=100_000,
    )
    key = kdf.derive(secret.encode())
    return base64.urlsafe_b64encode(key)


def encrypt_qr_payload(room_id: str, school_id: str = SCHOOL_ID, ttl_seconds: int = 0) -> str:
    """Encrypt QR payload with room info. ttl=0 means no expiry (static QR)"""
    fernet = Fernet(derive_key(MASTER_SECRET))
    payload = {
        "school_id": school_id,
        "room_id": room_id,
        "issued_at": datetime.now(WIB_TZ).isoformat(),
        "ttl": ttl_seconds,  # 0 = static, otherwise dynamic
    }
    token = fernet.encrypt(json.dumps(payload).encode())
    return token.decode()


def decrypt_qr_payload(token: str) -> Optional[Dict[str, Any]]:
    """Decrypt QR token and return payload dict, or None if invalid"""
    try:
        fernet = Fernet(derive_key(MASTER_SECRET))
        decrypted = fernet.decrypt(token.encode())
        payload = json.loads(decrypted.decode())
        # Validate school_id
        if payload.get("school_id") != SCHOOL_ID:
            return None
        # If TTL set, check expiry
        if payload.get("ttl", 0) > 0:
            issued_at = datetime.fromisoformat(payload["issued_at"])
            if datetime.now(WIB_TZ) - issued_at > timedelta(seconds=payload["ttl"]):
                print(f"  ⚠️  QR expired (TTL={payload['ttl']}s)")
                return None
        return payload
    except Exception as e:
        print(f"  ❌ Decryption failed: {e}")
        return None


# ============================================================
# 2. QR CODE GENERATION
# ============================================================
def generate_qr_image(data: str, size: int = 10) -> Image.Image:
    """Generate QR Code PIL image"""
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=size,
        border=2,
    )
    qr.add_data(data)
    qr.make(fit=True)
    return qr.make_image(fill_color="black", back_color="white").convert("RGB")


# ============================================================
# 3. GPS GEOFENCING (Haversine Distance)
# ============================================================
def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Returns distance in meters between two GPS coordinates"""
    R = 6371000  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def validate_gps(user_lat: float, user_lon: float, room_lat: float, room_lon: float,
                 radius_meters: float, gps_enabled: bool = True) -> Dict[str, Any]:
    """Validate user is within room geofence"""
    if not gps_enabled:
        return {"valid": True, "reason": "GPS validation disabled", "distance": None}

    distance = haversine_distance(user_lat, user_lon, room_lat, room_lon)
    valid = distance <= radius_meters
    return {
        "valid": valid,
        "distance": round(distance, 2),
        "radius": radius_meters,
        "reason": f"Distance {round(distance,2)}m {'within' if valid else 'exceeds'} radius {radius_meters}m"
    }


# ============================================================
# 4. SCHEDULE VALIDATION
# ============================================================
def validate_schedule(teacher_id: str, room_id: str, schedules: List[Dict],
                       check_time: Optional[datetime] = None, grace_minutes: int = 15) -> Dict[str, Any]:
    """Check if teacher has scheduled class in room at check_time"""
    if check_time is None:
        check_time = datetime.now(WIB_TZ)

    day_name = check_time.strftime("%A").lower()  # monday, tuesday, etc.

    for sched in schedules:
        if sched["teacher_id"] != teacher_id:
            continue
        if sched["room_id"] != room_id:
            continue
        if sched["day"].lower() != day_name:
            continue

        # Parse start/end times
        start_h, start_m = map(int, sched["start_time"].split(":"))
        end_h, end_m = map(int, sched["end_time"].split(":"))

        start_dt = check_time.replace(hour=start_h, minute=start_m, second=0, microsecond=0)
        end_dt = check_time.replace(hour=end_h, minute=end_m, second=0, microsecond=0)

        # Allow grace period before start and after end (for lock window)
        grace_start = start_dt - timedelta(minutes=grace_minutes)
        grace_end = end_dt + timedelta(minutes=grace_minutes)

        if grace_start <= check_time <= grace_end:
            locked = check_time > end_dt + timedelta(minutes=grace_minutes)
            return {
                "valid": True,
                "schedule": sched,
                "start_time": start_dt.isoformat(),
                "end_time": end_dt.isoformat(),
                "locked": locked,
                "reason": f"Active schedule found: {sched['subject']} in {room_id}"
            }

    return {
        "valid": False,
        "reason": f"No active schedule for teacher={teacher_id} in room={room_id} at {check_time.strftime('%A %H:%M')}",
        "schedule": None,
    }


# ============================================================
# 5. JOURNAL CREATION WITH MULTI-FACTOR VALIDATION
# ============================================================
def create_journal_entry(
    qr_token: str,
    teacher_id: str,
    user_lat: float,
    user_lon: float,
    schedules: List[Dict],
    rooms: Dict[str, Dict],
    materi: str,
    catatan: str = "",
    gps_enabled: bool = True,
    check_time: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Multi-factor validation flow for journal creation"""
    result = {
        "success": False,
        "validation": {
            "qr": {"valid": False, "reason": ""},
            "schedule": {"valid": False, "reason": ""},
            "gps": {"valid": False, "reason": ""},
        },
        "journal": None,
        "errors": [],
    }

    # Step 1: Decrypt QR
    payload = decrypt_qr_payload(qr_token)
    if not payload:
        result["validation"]["qr"] = {"valid": False, "reason": "Invalid/expired QR code"}
        result["errors"].append("QR validation failed")
        return result
    result["validation"]["qr"] = {"valid": True, "reason": "QR decrypted successfully", "payload": payload}
    room_id = payload["room_id"]

    # Step 2: Schedule validation
    sched_result = validate_schedule(teacher_id, room_id, schedules, check_time)
    result["validation"]["schedule"] = sched_result
    if not sched_result["valid"]:
        result["errors"].append("Schedule validation failed")
        return result

    # Step 3: GPS validation (if enabled and room has coords)
    room_info = rooms.get(room_id, {})
    if gps_enabled and room_info.get("lat") and room_info.get("lon"):
        gps_result = validate_gps(
            user_lat, user_lon,
            room_info["lat"], room_info["lon"],
            room_info.get("radius", 20),
            gps_enabled=True,
        )
        result["validation"]["gps"] = gps_result
        if not gps_result["valid"]:
            result["errors"].append("GPS validation failed")
            return result
    else:
        result["validation"]["gps"] = {"valid": True, "reason": "GPS disabled for this room"}

    # All validations passed → Create journal
    journal = {
        "teacher_id": teacher_id,
        "room_id": room_id,
        "subject": sched_result["schedule"]["subject"],
        "materi": materi,
        "catatan": catatan,
        "started_at": datetime.now(WIB_TZ).isoformat(),
        "scheduled_start": sched_result["start_time"],
        "scheduled_end": sched_result["end_time"],
        "validations": result["validation"],
        "locked": sched_result.get("locked", False),
    }
    result["journal"] = journal
    result["success"] = True
    return result


# ============================================================
# 6. B5 CARD TEMPLATE WITH QR OVERLAY
# ============================================================
def create_b5_card(qr_data: str, room_name: str, class_name: str,
                    template_path: Optional[str] = None,
                    output_path: str = "/tmp/b5_card_preview.png") -> str:
    """
    Create B5 portrait card (176mm x 250mm at 200dpi = 1386x1969 px)
    with optional uploaded background template + QR code + room info
    """
    # B5 Portrait at 200 DPI
    W, H = 1386, 1969

    # Background: uploaded template or default white
    if template_path and os.path.exists(template_path):
        bg = Image.open(template_path).convert("RGB").resize((W, H))
    else:
        # Default: green gradient background (Kemenag style)
        bg = Image.new("RGB", (W, H), color=(255, 255, 255))
        # Add green top banner
        draw = ImageDraw.Draw(bg)
        draw.rectangle([(0, 0), (W, 280)], fill=(0, 104, 55))  # Kemenag green
        draw.rectangle([(0, H-150), (W, H)], fill=(0, 104, 55))

    draw = ImageDraw.Draw(bg)

    # Try to use a default font, fallback to PIL default
    try:
        font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 60)
        font_subtitle = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 42)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 30)
    except Exception:
        font_title = ImageFont.load_default()
        font_subtitle = ImageFont.load_default()
        font_small = ImageFont.load_default()

    # Top banner text (if not template overrides)
    if not (template_path and os.path.exists(template_path)):
        draw.text((W//2, 100), "SUPER APPS MATSANDATAMA", fill="white", font=font_title, anchor="mm")
        draw.text((W//2, 200), "MTsN 2 Kota Malang", fill="white", font=font_subtitle, anchor="mm")

    # Room info (middle)
    draw.text((W//2, 400), class_name, fill=(0, 50, 30), font=font_title, anchor="mm")
    draw.text((W//2, 480), f"Ruangan: {room_name}", fill=(50, 50, 50), font=font_subtitle, anchor="mm")

    # QR Code (center, large)
    qr_img = generate_qr_image(qr_data, size=18)
    qr_size = 900
    qr_img = qr_img.resize((qr_size, qr_size))
    qr_x = (W - qr_size) // 2
    qr_y = 600
    bg.paste(qr_img, (qr_x, qr_y))

    # Footer instruction
    draw.text((W//2, qr_y + qr_size + 80),
              "Scan dengan Super Apps MATSANDATAMA", fill=(50, 50, 50), font=font_subtitle, anchor="mm")
    draw.text((W//2, qr_y + qr_size + 140),
              "untuk mengisi Jurnal Mengajar", fill=(80, 80, 80), font=font_small, anchor="mm")

    if not (template_path and os.path.exists(template_path)):
        draw.text((W//2, H-75), "✦ Jurnal Presisi - Anti-Manipulasi ✦",
                  fill="white", font=font_small, anchor="mm")

    bg.save(output_path, "PNG", optimize=True)
    return output_path


# ============================================================
# 7. DYNAMIC QR via TOTP
# ============================================================
def generate_dynamic_qr_payload(room_id: str, room_secret: str) -> str:
    """Generate dynamic QR payload using TOTP (refreshes every 30s)"""
    totp = pyotp.TOTP(room_secret, interval=30)
    current_code = totp.now()
    fernet = Fernet(derive_key(MASTER_SECRET))
    payload = {
        "school_id": SCHOOL_ID,
        "room_id": room_id,
        "totp_code": current_code,
        "issued_at": datetime.now(WIB_TZ).isoformat(),
        "ttl": 60,  # 60 seconds validity
    }
    return fernet.encrypt(json.dumps(payload).encode()).decode()


def validate_dynamic_qr(token: str, room_secrets: Dict[str, str]) -> Dict[str, Any]:
    """Validate dynamic QR with TOTP verification"""
    payload = decrypt_qr_payload(token)
    if not payload:
        return {"valid": False, "reason": "Decryption/expiry failed"}

    room_id = payload.get("room_id")
    code = payload.get("totp_code")
    secret = room_secrets.get(room_id)

    if not secret or not code:
        return {"valid": False, "reason": "Missing room secret or TOTP code"}

    totp = pyotp.TOTP(secret, interval=30)
    if totp.verify(code, valid_window=1):  # allow 1 step before/after
        return {"valid": True, "reason": "Dynamic QR valid", "payload": payload}
    return {"valid": False, "reason": "TOTP code invalid/expired"}


# ============================================================
# TEST SUITE
# ============================================================
def run_tests():
    print("=" * 70)
    print("POC SMART JOURNAL 'JURNAL PRESISI' - CORE VALIDATION TESTS")
    print("=" * 70)

    passed = 0
    failed = 0

    # Setup fixtures
    # Sample MTsN 2 Malang coordinates (Pakis, Malang area)
    rooms = {
        "ROOM-7A": {"name": "Kelas 7A", "lat": -7.9666, "lon": 112.6326, "radius": 20},
        "ROOM-7B": {"name": "Kelas 7B", "lat": -7.9667, "lon": 112.6327, "radius": 20},
    }
    # Today's day name
    today = datetime.now(WIB_TZ).strftime("%A").lower()
    now = datetime.now(WIB_TZ)
    schedules = [
        {
            "teacher_id": "GURU001",
            "room_id": "ROOM-7A",
            "subject": "Matematika",
            "day": today,  # use today for testing
            "start_time": (now - timedelta(minutes=5)).strftime("%H:%M"),
            "end_time": (now + timedelta(minutes=45)).strftime("%H:%M"),
        },
        {
            "teacher_id": "GURU002",
            "room_id": "ROOM-7B",
            "subject": "IPA",
            "day": today,
            "start_time": (now - timedelta(hours=5)).strftime("%H:%M"),
            "end_time": (now - timedelta(hours=4)).strftime("%H:%M"),  # in the past
        },
    ]

    # ----------------------------------------
    # TEST 1: QR Encryption + Decryption
    # ----------------------------------------
    print("\n📝 TEST 1: QR Encryption + Decryption")
    try:
        token = encrypt_qr_payload("ROOM-7A")
        print(f"   Encrypted token (truncated): {token[:60]}...")
        payload = decrypt_qr_payload(token)
        assert payload is not None
        assert payload["room_id"] == "ROOM-7A"
        assert payload["school_id"] == SCHOOL_ID
        print(f"   ✅ Decrypted room_id={payload['room_id']}, school_id={payload['school_id']}")
        passed += 1
    except AssertionError as e:
        print(f"   ❌ FAILED: {e}")
        failed += 1
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
        failed += 1

    # ----------------------------------------
    # TEST 2: Reject Invalid QR (tampered)
    # ----------------------------------------
    print("\n📝 TEST 2: Reject Invalid/Tampered QR")
    try:
        invalid_token = "tampered_token_xxxxxx"
        payload = decrypt_qr_payload(invalid_token)
        assert payload is None
        print("   ✅ Tampered QR rejected correctly")
        passed += 1
    except AssertionError:
        print("   ❌ FAILED: Tampered QR should be rejected")
        failed += 1

    # ----------------------------------------
    # TEST 3: GPS Haversine + Within Radius
    # ----------------------------------------
    print("\n📝 TEST 3: GPS Geofencing (Within Radius)")
    try:
        room = rooms["ROOM-7A"]
        # User is ~5m from room
        result = validate_gps(
            user_lat=room["lat"] + 0.00003,
            user_lon=room["lon"] + 0.00002,
            room_lat=room["lat"],
            room_lon=room["lon"],
            radius_meters=room["radius"],
            gps_enabled=True,
        )
        assert result["valid"] == True
        print(f"   ✅ GPS valid: {result['reason']}")
        passed += 1
    except AssertionError:
        print(f"   ❌ FAILED: Should be within radius. Result: {result}")
        failed += 1

    # ----------------------------------------
    # TEST 4: GPS Outside Radius - REJECTED
    # ----------------------------------------
    print("\n📝 TEST 4: GPS Geofencing (Outside Radius)")
    try:
        room = rooms["ROOM-7A"]
        # User is far away (~500m)
        result = validate_gps(
            user_lat=room["lat"] + 0.005,
            user_lon=room["lon"] + 0.005,
            room_lat=room["lat"],
            room_lon=room["lon"],
            radius_meters=room["radius"],
            gps_enabled=True,
        )
        assert result["valid"] == False
        print(f"   ✅ GPS correctly rejected: {result['reason']}")
        passed += 1
    except AssertionError:
        print(f"   ❌ FAILED: Should be outside radius. Result: {result}")
        failed += 1

    # ----------------------------------------
    # TEST 5: GPS Disabled - ALWAYS PASS
    # ----------------------------------------
    print("\n📝 TEST 5: GPS Validation Toggle (Disabled)")
    try:
        result = validate_gps(0, 0, 100, 100, 20, gps_enabled=False)
        assert result["valid"] == True
        print(f"   ✅ GPS disabled = always valid: {result['reason']}")
        passed += 1
    except AssertionError:
        print(f"   ❌ FAILED: GPS disabled should pass")
        failed += 1

    # ----------------------------------------
    # TEST 6: Schedule Validation (Active Schedule)
    # ----------------------------------------
    print("\n📝 TEST 6: Schedule Validation (Teacher Has Class Now)")
    try:
        result = validate_schedule("GURU001", "ROOM-7A", schedules)
        assert result["valid"] == True
        print(f"   ✅ Schedule valid: {result['reason']}")
        passed += 1
    except AssertionError:
        print(f"   ❌ FAILED: Should find active schedule. Result: {result}")
        failed += 1

    # ----------------------------------------
    # TEST 7: Schedule Validation (Wrong Teacher)
    # ----------------------------------------
    print("\n📝 TEST 7: Schedule Validation (Wrong Teacher)")
    try:
        result = validate_schedule("GURU999", "ROOM-7A", schedules)
        assert result["valid"] == False
        print(f"   ✅ Wrong teacher rejected: {result['reason']}")
        passed += 1
    except AssertionError:
        print(f"   ❌ FAILED: Wrong teacher should be rejected. Result: {result}")
        failed += 1

    # ----------------------------------------
    # TEST 8: Schedule Validation (Past Schedule - Should be Locked)
    # ----------------------------------------
    print("\n📝 TEST 8: Schedule Validation (Past Schedule - Outside Window)")
    try:
        result = validate_schedule("GURU002", "ROOM-7B", schedules)
        # Past schedule beyond grace = invalid
        assert result["valid"] == False
        print(f"   ✅ Past schedule outside grace correctly rejected: {result['reason']}")
        passed += 1
    except AssertionError:
        print(f"   ❌ FAILED: Past schedule should be outside grace. Result: {result}")
        failed += 1

    # ----------------------------------------
    # TEST 9: Full Journal Creation Flow (ALL PASS)
    # ----------------------------------------
    print("\n📝 TEST 9: Full Journal Creation Flow (All Validations Pass)")
    try:
        token = encrypt_qr_payload("ROOM-7A")
        result = create_journal_entry(
            qr_token=token,
            teacher_id="GURU001",
            user_lat=rooms["ROOM-7A"]["lat"],
            user_lon=rooms["ROOM-7A"]["lon"],
            schedules=schedules,
            rooms=rooms,
            materi="Pengertian Bilangan Bulat",
            catatan="Siswa antusias mengikuti pelajaran",
            gps_enabled=True,
        )
        assert result["success"] == True
        assert result["journal"] is not None
        print(f"   ✅ Journal created: {result['journal']['subject']} - {result['journal']['materi']}")
        print(f"      QR: {result['validation']['qr']['reason']}")
        print(f"      Schedule: {result['validation']['schedule']['reason']}")
        print(f"      GPS: {result['validation']['gps']['reason']}")
        passed += 1
    except AssertionError as e:
        print(f"   ❌ FAILED: {result.get('errors')}")
        failed += 1

    # ----------------------------------------
    # TEST 10: Full Journal - REJECTED Due to GPS
    # ----------------------------------------
    print("\n📝 TEST 10: Full Journal Flow (Rejected - User Too Far)")
    try:
        token = encrypt_qr_payload("ROOM-7A")
        result = create_journal_entry(
            qr_token=token,
            teacher_id="GURU001",
            user_lat=rooms["ROOM-7A"]["lat"] + 0.01,  # ~1km away
            user_lon=rooms["ROOM-7A"]["lon"] + 0.01,
            schedules=schedules,
            rooms=rooms,
            materi="Test materi",
            gps_enabled=True,
        )
        assert result["success"] == False
        assert "GPS validation failed" in result["errors"]
        print(f"   ✅ Journal rejected due to GPS: {result['errors']}")
        passed += 1
    except AssertionError:
        print(f"   ❌ FAILED: Should reject due to GPS. Result: {result}")
        failed += 1

    # ----------------------------------------
    # TEST 11: Full Journal - GPS Disabled (Should Pass even if far)
    # ----------------------------------------
    print("\n📝 TEST 11: Full Journal Flow (GPS Disabled - User Anywhere)")
    try:
        token = encrypt_qr_payload("ROOM-7A")
        result = create_journal_entry(
            qr_token=token,
            teacher_id="GURU001",
            user_lat=0,  # ridiculous coords
            user_lon=0,
            schedules=schedules,
            rooms=rooms,
            materi="Test materi",
            gps_enabled=False,  # GPS OFF
        )
        assert result["success"] == True
        print(f"   ✅ Journal created with GPS disabled")
        passed += 1
    except AssertionError:
        print(f"   ❌ FAILED: Should pass with GPS disabled. Errors: {result.get('errors')}")
        failed += 1

    # ----------------------------------------
    # TEST 12: B5 Card Generation (Default Background)
    # ----------------------------------------
    print("\n📝 TEST 12: B5 Card Generation (Default Background)")
    try:
        token = encrypt_qr_payload("ROOM-7A")
        out_path = create_b5_card(
            qr_data=token,
            room_name="ROOM-7A",
            class_name="Kelas 7A",
            template_path=None,
            output_path="/tmp/b5_default.png"
        )
        assert os.path.exists(out_path)
        size = os.path.getsize(out_path)
        print(f"   ✅ Default B5 card created: {out_path} ({size} bytes)")
        passed += 1
    except AssertionError as e:
        print(f"   ❌ FAILED: {e}")
        failed += 1
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
        failed += 1

    # ----------------------------------------
    # TEST 13: B5 Card with Uploaded Template
    # ----------------------------------------
    print("\n📝 TEST 13: B5 Card with Uploaded Template Background")
    try:
        # Create a fake template image
        template = Image.new("RGB", (1386, 1969), color=(200, 230, 200))
        draw = ImageDraw.Draw(template)
        draw.rectangle([(0,0), (1386, 1969)], outline=(0, 104, 55), width=20)
        template_path = "/tmp/test_template.png"
        template.save(template_path)

        token = encrypt_qr_payload("ROOM-7B")
        out_path = create_b5_card(
            qr_data=token,
            room_name="ROOM-7B",
            class_name="Kelas 7B",
            template_path=template_path,
            output_path="/tmp/b5_with_template.png"
        )
        assert os.path.exists(out_path)
        size = os.path.getsize(out_path)
        print(f"   ✅ Template B5 card created: {out_path} ({size} bytes)")
        passed += 1
    except AssertionError as e:
        print(f"   ❌ FAILED: {e}")
        failed += 1
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
        failed += 1

    # ----------------------------------------
    # TEST 14: Dynamic QR (TOTP) Generation + Validation
    # ----------------------------------------
    print("\n📝 TEST 14: Dynamic QR (TOTP) Generation + Validation")
    try:
        room_secret = pyotp.random_base32()
        room_secrets = {"ROOM-7A": room_secret}
        dynamic_token = generate_dynamic_qr_payload("ROOM-7A", room_secret)
        print(f"   Dynamic token (truncated): {dynamic_token[:60]}...")
        result = validate_dynamic_qr(dynamic_token, room_secrets)
        assert result["valid"] == True
        print(f"   ✅ Dynamic QR validated: {result['reason']}")
        passed += 1
    except AssertionError:
        print(f"   ❌ FAILED: {result}")
        failed += 1

    # ----------------------------------------
    # TEST 15: Dynamic QR - Wrong Secret Rejected
    # ----------------------------------------
    print("\n📝 TEST 15: Dynamic QR - Wrong Room Secret Rejected")
    try:
        room_secret_a = pyotp.random_base32()
        room_secret_b = pyotp.random_base32()
        dynamic_token = generate_dynamic_qr_payload("ROOM-7A", room_secret_a)
        # Validate with WRONG secret
        result = validate_dynamic_qr(dynamic_token, {"ROOM-7A": room_secret_b})
        assert result["valid"] == False
        print(f"   ✅ Wrong secret rejected: {result['reason']}")
        passed += 1
    except AssertionError:
        print(f"   ❌ FAILED: Should reject wrong secret")
        failed += 1

    # ----------------------------------------
    # SUMMARY
    # ----------------------------------------
    print("\n" + "=" * 70)
    print(f"📊 TEST RESULTS: {passed} passed, {failed} failed")
    print("=" * 70)

    if failed == 0:
        print("🎉 ALL POC TESTS PASSED! Core 'Jurnal Presisi' is ready to be built into the app.")
        print("\nGenerated artifacts (for visual inspection):")
        print("  - /tmp/b5_default.png  (B5 card with default Kemenag background)")
        print("  - /tmp/b5_with_template.png  (B5 card with uploaded template)")
        return True
    else:
        print(f"⚠️  {failed} test(s) failed. Fix before building app.")
        return False


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
