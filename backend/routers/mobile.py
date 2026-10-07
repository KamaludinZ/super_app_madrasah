"""Aplikasi mobile (Android/iOS, Expo): perangkat & Expo Push, izin offline, dan jurnal offline.

- POST/DELETE /mobile/devices          — daftarkan/hapus token Expo Push perangkat.
- GET  /mobile/offline-permits         — izin bertanda tangan server per slot jadwal (reguler & guru
                                         pengganti) agar jurnal yang diisi offline bisa diverifikasi.
- POST /mobile/journals/offline        — simpan jurnal yang diisi offline (idempoten per client_id).

Waktu isi jurnal offline tidak memakai jam dinding HP. Aplikasi mengirim `captured_server_estimate`
= waktu server terakhir + selisih jam monoton perangkat. Untuk QR dinamis, `issued_at` terenkripsi di
QR (dibuat server) menjadi bukti waktu pindai yang tidak bisa dipalsukan.
"""

import hashlib
import logging
import uuid
from datetime import date as date_cls, datetime, timedelta
from typing import Dict, List, Optional, Tuple

import httpx
import pyotp
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from jose import ExpiredSignatureError, JWTError, jwt
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from auth_utils import JWT_SECRET
from core import db, get_current_user, get_settings, log_audit, log_security, serialize_doc
from journal_core import (
    SCHOOL_ID,
    WIB_TZ,
    day_started_at_filter,
    decrypt_qr_payload_raw,
    now_wib,
    validate_gps,
)

router = APIRouter()
logger = logging.getLogger('matsandatama')

DEVICES = 'mobile_devices'
EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
EXPO_BATCH = 100
WEEKDAY_KEYS = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu']
ATTENDANCE_STATUSES = ('hadir', 'sakit', 'izin', 'alpha')

PERMIT_TYPE = 'offline_journal_permit'
# Kunci izin offline diturunkan dari JWT_SECRET agar izin tidak bisa dipakai sebagai token login.
_PERMIT_KEY = hashlib.sha256(f"{JWT_SECRET}:offline-permit".encode()).hexdigest()
PERMIT_GRACE_AFTER_DEADLINE = timedelta(minutes=30)  # sama dengan /journals/submit-offline
MAX_CLOCK_SKEW = timedelta(minutes=5)                # estimasi waktu tidak boleh di masa depan
DYNAMIC_QR_SLACK = timedelta(minutes=2)              # toleransi selisih estimasi vs issued_at QR


async def ensure_mobile_indexes(database) -> List[str]:
    """Index koleksi aplikasi mobile (idempotent). Mengembalikan daftar index yang gagal dibuat."""
    specs = [
        (DEVICES, 'device_id', {'unique': True}),
        (DEVICES, 'user_id', {}),
        (DEVICES, 'expo_push_token', {}),
        ('journals', 'offline_client_id', {
            'unique': True,
            'partialFilterExpression': {'offline_client_id': {'$type': 'string'}},
            'name': 'uniq_offline_client_id',
        }),
    ]
    gagal = []
    for coll, keys, kwargs in specs:
        try:
            await database[coll].create_index(keys, **kwargs)
        except Exception as e:  # noqa: BLE001 - dilaporkan ke pemanggil & log
            gagal.append(f"{coll} {keys}: {e}")
            logger.error(f"[mobile] Gagal membuat index {coll} {keys}: {e}")
    return gagal


# ======================================================================
# Perangkat & Expo Push
# ======================================================================
class DeviceIn(BaseModel):
    device_id: str = Field(min_length=8, max_length=100)
    expo_push_token: Optional[str] = Field(default=None, max_length=200)
    platform: str = Field(pattern='^(android|ios)$')
    app_version: Optional[str] = Field(default=None, max_length=40)
    # True: aplikasi menjadwalkan pengingat mengajar sendiri (notifikasi lokal, jalan saat offline),
    # sehingga server tidak mengirim push pengingat mengajar ke perangkat ini.
    local_reminders: bool = True


def _is_expo_token(token: Optional[str]) -> bool:
    return bool(token) and (token.startswith('ExponentPushToken[') or token.startswith('ExpoPushToken['))


@router.post("/mobile/devices")
async def register_device(payload: DeviceIn, user: Dict = Depends(get_current_user)):
    """Daftarkan/perbarui perangkat pengguna. Satu device_id hanya milik satu pengguna (pengguna terakhir login)."""
    if payload.expo_push_token and not _is_expo_token(payload.expo_push_token):
        raise HTTPException(400, "Format token Expo Push tidak valid")
    now = now_wib().isoformat()
    doc = {
        'device_id': payload.device_id,
        'user_id': user['id'],
        'expo_push_token': payload.expo_push_token,
        'platform': payload.platform,
        'app_version': payload.app_version,
        'local_reminders': payload.local_reminders,
        'active_role': user.get('active_role'),
        'updated_at': now,
    }
    await db[DEVICES].update_one(
        {'device_id': payload.device_id},
        {'$set': doc, '$setOnInsert': {'created_at': now}},
        upsert=True,
    )
    # Token yang sama di device_id lain (mis. data aplikasi dihapus lalu dipasang ulang) dibuang.
    if payload.expo_push_token:
        await db[DEVICES].delete_many({
            'expo_push_token': payload.expo_push_token, 'device_id': {'$ne': payload.device_id},
        })
    return {'ok': True, 'device_id': payload.device_id}


@router.delete("/mobile/devices/{device_id}")
async def unregister_device(device_id: str, user: Dict = Depends(get_current_user)):
    """Hapus perangkat (saat logout) agar tidak lagi menerima notifikasi untuk akun ini."""
    res = await db[DEVICES].delete_one({'device_id': device_id, 'user_id': user['id']})
    return {'ok': True, 'removed': res.deleted_count}


def build_expo_messages(tokens: List[str], title: str, body: str, data: Optional[Dict] = None,
                        channel_id: str = 'default') -> List[Dict]:
    """Pesan Expo Push per token (prioritas tinggi, suara default, channel Android)."""
    return [{
        'to': t,
        'title': title,
        'body': body,
        'data': data or {},
        'sound': 'default',
        'priority': 'high',
        'channelId': channel_id,
    } for t in tokens]


async def _post_expo(messages: List[Dict]) -> List[Dict]:
    """Kirim satu batch ke Expo Push API; mengembalikan daftar tiket (urutan sama dengan pesan)."""
    import os
    headers = {'Accept': 'application/json', 'Content-Type': 'application/json'}
    access_token = os.environ.get('EXPO_ACCESS_TOKEN')
    if access_token:
        headers['Authorization'] = f'Bearer {access_token}'
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.post(EXPO_PUSH_URL, json=messages, headers=headers)
        res.raise_for_status()
        return res.json().get('data') or []


def _expo_enabled() -> bool:
    import os
    return os.environ.get('EXPO_PUSH_ENABLED', '1').lower() not in ('0', 'false', 'no')


async def send_expo_push_to_users(user_ids: List[str], title: str, body: str, data: Optional[Dict] = None,
                                  channel_id: str = 'default',
                                  skip_local_reminder_devices: bool = False) -> Dict:
    """Kirim notifikasi Expo Push (Android lewat FCM, iPhone lewat APNs) ke semua perangkat pengguna.

    skip_local_reminder_devices=True dipakai untuk pengingat mengajar: perangkat yang menjadwalkan
    pengingat lokal sendiri tidak dikirimi agar tidak dobel. Token `DeviceNotRegistered` dihapus.
    Tidak pernah melempar error (best-effort)."""
    result = {'sent': 0, 'failed': 0, 'removed': 0}
    if not user_ids or not _expo_enabled():
        return {**result, 'skipped': True}
    query: Dict = {'user_id': {'$in': list(set(user_ids))}, 'expo_push_token': {'$type': 'string'}}
    if skip_local_reminder_devices:
        query['local_reminders'] = {'$ne': True}
    try:
        devices = await db[DEVICES].find(query, {'_id': 0, 'expo_push_token': 1}).to_list(5000)
        tokens = list(dict.fromkeys(d['expo_push_token'] for d in devices if _is_expo_token(d.get('expo_push_token'))))
        messages = build_expo_messages(tokens, title, body, data, channel_id)
        dead: List[str] = []
        for i in range(0, len(messages), EXPO_BATCH):
            batch = messages[i:i + EXPO_BATCH]
            try:
                tickets = await _post_expo(batch)
            except Exception as e:  # noqa: BLE001 - jaringan/Expo bermasalah: catat & lanjut
                logger.error(f"[mobile] Expo push gagal: {e}")
                result['failed'] += len(batch)
                continue
            for msg, ticket in zip(batch, tickets):
                if ticket.get('status') == 'ok':
                    result['sent'] += 1
                else:
                    result['failed'] += 1
                    if (ticket.get('details') or {}).get('error') == 'DeviceNotRegistered':
                        dead.append(msg['to'])
        if dead:
            res = await db[DEVICES].delete_many({'expo_push_token': {'$in': dead}})
            result['removed'] = res.deleted_count
    except Exception as e:  # noqa: BLE001
        logger.error(f"[mobile] send_expo_push_to_users error: {e}")
    return result


async def send_expo_push_to_roles(target_roles: Optional[List[str]], title: str, body: str,
                                  data: Optional[Dict] = None, channel_id: str = 'default') -> Dict:
    """Sama dengan send_push_to_roles (Web Push): kosong / ['all'] = semua pengguna berperangkat."""
    roles = target_roles or ['all']
    if 'all' in roles:
        user_ids = await db[DEVICES].distinct('user_id')
    else:
        users = await db.users.find({'roles': {'$in': roles}}, {'_id': 0, 'id': 1}).to_list(10000)
        user_ids = [u['id'] for u in users if u.get('id')]
    return await send_expo_push_to_users(user_ids, title, body, data, channel_id)


# ======================================================================
# Izin offline
# ======================================================================
def _slot_bounds(day: date_cls, start: str, end: str) -> Tuple[datetime, datetime]:
    sh, sm = map(int, start.split(':'))
    eh, em = map(int, end.split(':'))
    base = datetime(day.year, day.month, day.day, tzinfo=WIB_TZ)
    return base.replace(hour=sh, minute=sm), base.replace(hour=eh, minute=em)


def permit_deadline(day: date_cls, end: str) -> datetime:
    """Batas kirim jurnal offline: H+1 setelah slot berakhir + 30 menit (aturan /journals/submit-offline)."""
    _, end_dt = _slot_bounds(day, '00:00', end)
    return end_dt + timedelta(days=1) + PERMIT_GRACE_AFTER_DEADLINE


def sign_permit(claims: Dict) -> str:
    return jwt.encode({**claims, 'typ': PERMIT_TYPE}, _PERMIT_KEY, algorithm='HS256')


def verify_permit(token: str, user_id: str) -> Dict:
    """Klaim izin bila sah untuk pengguna ini; HTTPException 400 {error_type, message} bila tidak."""
    try:
        claims = jwt.decode(token, _PERMIT_KEY, algorithms=['HS256'])
    except ExpiredSignatureError:
        raise _offline_error('deadline_passed', 'Batas waktu pengiriman jurnal offline untuk slot ini sudah lewat')
    except JWTError:
        raise _offline_error('invalid_permit', 'Izin offline tidak sah')
    if claims.get('typ') != PERMIT_TYPE or claims.get('uid') != user_id:
        raise _offline_error('invalid_permit', 'Izin offline bukan milik akun ini')
    return claims


def _offline_error(error_type: str, message: str, status: int = 400, **extra) -> HTTPException:
    return HTTPException(status, {'error_type': error_type, 'message': message, **extra})


async def _holiday_on(day: date_cls) -> Optional[str]:
    from routers.guru_pengganti import _holidays_between
    iso = day.isoformat()
    holidays = await _holidays_between(iso, iso)
    return holidays[0].get('name') if holidays else None


@router.get("/mobile/offline-permits")
async def offline_permits(
    date: Optional[str] = Query(default=None, description="YYYY-MM-DD (default hari ini)"),
    user: Dict = Depends(get_current_user),
):
    """Izin jurnal offline untuk setiap slot pengguna pada satu tanggal: jadwal mengajar sendiri
    (semester aktif) dan slot yang ditugaskan sebagai guru pengganti. Bisa diminta untuk kemarin
    sampai 7 hari ke depan, agar aplikasi tetap bisa mengisi jurnal saat beberapa hari tanpa internet."""
    from routers.guru_pengganti import _active_semester_id, _resolve_names, day_query

    today = now_wib().date()
    try:
        day = date_cls.fromisoformat(date) if date else today
    except ValueError:
        raise HTTPException(400, "Format tanggal tidak valid (gunakan YYYY-MM-DD)")
    if not (today - timedelta(days=1) <= day <= today + timedelta(days=7)):
        raise HTTPException(400, "Izin offline hanya untuk kemarin sampai 7 hari ke depan")

    day_key = WEEKDAY_KEYS[day.weekday()]
    holiday = await _holiday_on(day)
    semester_id = await _active_semester_id()

    regular = []
    if not holiday and semester_id:
        regular = await db.schedules.find({
            'teacher_id': user['id'], 'semester_id': semester_id, 'is_published': {'$ne': False},
            'day': day_query(day_key),
        }, {'_id': 0}).to_list(50)
    assignments = await db.substitute_assignments.find(
        {'substitute_teacher_id': user['id'], 'date': day.isoformat(), 'status': 'active'}, {'_id': 0},
    ).to_list(50)
    sub_schedules = {
        s['id']: s for s in await db.schedules.find(
            {'id': {'$in': [a['schedule_id'] for a in assignments]}}, {'_id': 0},
        ).to_list(50)
    } if assignments else {}

    entries = [(s, None) for s in regular] + [
        (sub_schedules[a['schedule_id']], a) for a in assignments if a['schedule_id'] in sub_schedules
    ]
    all_scheds = [s for s, _ in entries]
    classes = await _resolve_names('classes', [s.get('class_id') for s in all_scheds])
    subjects = await _resolve_names('subjects', [s.get('subject_id') for s in all_scheds])
    rooms = await _resolve_names('rooms', [s.get('room_id') for s in all_scheds])
    originals = {
        u['id']: u.get('full_name') for u in await db.users.find(
            {'id': {'$in': [a['original_teacher_id'] for a in assignments]}}, {'_id': 0, 'id': 1, 'full_name': 1},
        ).to_list(50)
    } if assignments else {}

    now = now_wib()
    permits = []
    for sch, a in entries:
        start, end = sch.get('start_time') or '', sch.get('end_time') or ''
        if ':' not in start or ':' not in end:
            continue
        deadline = permit_deadline(day, end)
        if deadline <= now:
            continue
        claims = {
            'uid': user['id'], 'sid': sch['id'], 'date': day.isoformat(), 'rid': sch.get('room_id'),
            'st': start, 'et': end, 'is_sub': bool(a), 'aid': a['id'] if a else None,
            'iat': int(now.timestamp()), 'exp': int(deadline.timestamp()),
        }
        permits.append({
            'schedule_id': sch['id'],
            'date': day.isoformat(),
            'start_time': start,
            'end_time': end,
            'class_id': sch.get('class_id'),
            'class_name': classes.get(sch.get('class_id')),
            'subject_name': subjects.get(sch.get('subject_id')),
            'room_id': sch.get('room_id'),
            'room_name': rooms.get(sch.get('room_id')),
            'is_substitute': bool(a),
            'assignment_id': a['id'] if a else None,
            'original_teacher_name': originals.get(a['original_teacher_id']) if a else None,
            'valid_until': deadline.isoformat(),
            'permit': sign_permit(claims),
        })
    permits.sort(key=lambda p: p['start_time'])
    return {'server_time': now.isoformat(), 'date': day.isoformat(), 'holiday': holiday, 'permits': permits}


# ======================================================================
# Jurnal offline
# ======================================================================
class OfflineAttendance(BaseModel):
    student_id: str
    student_name: Optional[str] = None
    status: str = Field(pattern='^(hadir|sakit|izin|alpha)$')


class OfflineJournalIn(BaseModel):
    client_id: str = Field(min_length=8, max_length=64)  # id antrean di perangkat (idempotensi)
    permit: str
    qr_token: Optional[str] = None
    user_lat: Optional[float] = None
    user_lon: Optional[float] = None
    location_accuracy: Optional[float] = None
    location_time: Optional[str] = None
    captured_server_estimate: str  # ISO; waktu server terakhir + selisih jam monoton perangkat
    device_wall_clock: Optional[str] = None
    monotonic_elapsed_ms: Optional[int] = None
    clock_unverified: bool = False  # perangkat reboot sejak sinkron terakhir
    materi: str = Field(min_length=1, max_length=5000)
    catatan: Optional[str] = Field(default=None, max_length=5000)
    indikator_id: Optional[str] = None
    materi_id: Optional[str] = None
    attendance_details: List[OfflineAttendance] = Field(default_factory=list)


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        return None
    return (dt if dt.tzinfo else dt.replace(tzinfo=WIB_TZ)).astimezone(WIB_TZ)


def evaluate_capture_time(claims: Dict, captured: Optional[datetime], now: datetime, grace_minutes: int,
                          clock_unverified: bool = False, qr_issued_at: Optional[datetime] = None,
                          qr_ttl_seconds: int = 0) -> Dict:
    """Tentukan waktu isi jurnal tepercaya dan apakah valid untuk slot pada izin (fungsi murni).

    Mengembalikan {ok, error_type?, message?, trusted_time?, needs_verification, time_source}."""
    if captured is None:
        return {'ok': False, 'error_type': 'clock_mismatch', 'message': 'Waktu pengisian tidak terbaca',
                'needs_verification': False}
    time_source = 'monotonic_estimate'
    needs_verification = bool(clock_unverified)
    if qr_issued_at is not None and qr_ttl_seconds > 0:
        # QR dinamis: issued_at dibuat & dienkripsi server → bukti kuat waktu pindai.
        if abs(captured - qr_issued_at) > timedelta(seconds=qr_ttl_seconds) + DYNAMIC_QR_SLACK:
            return {'ok': False, 'error_type': 'clock_mismatch',
                    'message': 'Waktu pengisian tidak sesuai dengan waktu QR yang dipindai',
                    'needs_verification': False}
        captured, time_source, needs_verification = qr_issued_at, 'dynamic_qr', False
    if captured > now + MAX_CLOCK_SKEW:
        return {'ok': False, 'error_type': 'clock_mismatch',
                'message': 'Waktu pengisian berada di masa depan; periksa jam perangkat', 'needs_verification': False}
    start_dt, end_dt = _slot_bounds(date_cls.fromisoformat(claims['date']), claims['st'], claims['et'])
    grace = timedelta(minutes=grace_minutes)
    if not (start_dt - grace <= captured <= end_dt + grace):
        return {'ok': False, 'error_type': 'outside_schedule',
                'message': (f"Jurnal diisi pada {captured.strftime('%d-%m-%Y %H:%M')} WIB, di luar jam slot "
                            f"{claims['st']}-{claims['et']} (toleransi {grace_minutes} menit)"),
                'needs_verification': False}
    return {'ok': True, 'trusted_time': captured, 'needs_verification': needs_verification,
            'time_source': time_source}


def _verify_dynamic_code(payload: Dict, room: Dict, issued_at: datetime) -> bool:
    """Kode TOTP di QR dinamis harus cocok dengan waktu terbitnya (bukan waktu sinkron)."""
    secret, code = room.get('qr_secret'), payload.get('totp_code')
    if not secret or not code:
        return False
    return pyotp.TOTP(secret, interval=30).verify(code, for_time=issued_at, valid_window=1)


@router.post("/mobile/journals/offline")
async def submit_offline_journal_mobile(payload: OfflineJournalIn, request: Request,
                                        user: Dict = Depends(get_current_user)):
    """Simpan jurnal yang diisi offline dari aplikasi mobile.

    Validasi: izin offline sah & belum lewat batas (H+1 + 30 menit), slot masih milik pengguna
    (atau penugasan guru pengganti masih aktif), QR ruangan cocok dengan izin (wajib untuk jadwal
    sendiri), GPS sesuai radius ruangan, waktu isi jatuh di jam slot (estimasi jam monoton atau
    issued_at QR dinamis), dan belum ada jurnal untuk slot itu pada tanggalnya. Idempoten per client_id.
    """
    existing = await db.journals.find_one({'offline_client_id': payload.client_id}, {'_id': 0, 'id': 1})
    if existing:
        raise _offline_error('duplicate', 'Jurnal ini sudah tersimpan', status=409, journal_id=existing['id'])

    claims = verify_permit(payload.permit, user['id'])
    now = now_wib()
    day = date_cls.fromisoformat(claims['date'])
    settings = await get_settings()
    grace = int(settings.get('grace_minutes', 15) or 15)

    sch = await db.schedules.find_one({'id': claims['sid']}, {'_id': 0})
    if not sch:
        raise _offline_error('schedule_changed', 'Jadwal slot ini sudah tidak ada')
    assignment = None
    if claims.get('is_sub'):
        assignment = await db.substitute_assignments.find_one({'id': claims.get('aid')}, {'_id': 0})
        if (not assignment or assignment.get('status') != 'active'
                or assignment.get('substitute_teacher_id') != user['id']
                or assignment.get('schedule_id') != sch['id'] or assignment.get('date') != claims['date']):
            raise _offline_error('schedule_changed', 'Penugasan guru pengganti untuk slot ini sudah dibatalkan/berubah')
    elif sch.get('teacher_id') != user['id']:
        raise _offline_error('schedule_changed', 'Jadwal slot ini sudah tidak diampu oleh Anda')

    # QR ruangan: wajib untuk jadwal sendiri (seperti scan online), opsional untuk guru pengganti.
    room = await db.rooms.find_one({'id': claims.get('rid')}, {'_id': 0}) if claims.get('rid') else None
    qr_payload, qr_issued_at, qr_ttl = None, None, 0
    if payload.qr_token:
        qr_payload = decrypt_qr_payload_raw(payload.qr_token)
        if not qr_payload or qr_payload.get('school_id') != SCHOOL_ID:
            raise _offline_error('qr_invalid', 'QR Code tidak valid')
        if qr_payload.get('room_id') != claims.get('rid'):
            raise _offline_error('qr_invalid', 'QR yang dipindai bukan QR ruangan untuk slot ini')
        qr_ttl = int(qr_payload.get('ttl') or 0)
        if qr_payload.get('mode') == 'dynamic' or qr_ttl > 0:
            qr_issued_at = _parse_dt(qr_payload.get('issued_at'))
            if not qr_issued_at or not room or not _verify_dynamic_code(qr_payload, room, qr_issued_at):
                raise _offline_error('qr_invalid', 'Kode QR dinamis tidak valid untuk waktu pemindaian')
    elif not claims.get('is_sub'):
        raise _offline_error('qr_required', 'Pindai QR ruangan untuk mengisi jurnal jadwal Anda')

    timing = evaluate_capture_time(
        claims, _parse_dt(payload.captured_server_estimate), now, grace,
        clock_unverified=payload.clock_unverified, qr_issued_at=qr_issued_at, qr_ttl_seconds=qr_ttl,
    )
    if not timing['ok']:
        await log_security('offline_journal_blocked', user.get('username'), {
            'error_type': timing['error_type'], 'schedule_id': sch['id'], 'date': claims['date'],
            'captured': payload.captured_server_estimate, 'device_wall_clock': payload.device_wall_clock,
        }, request)
        raise _offline_error(timing['error_type'], timing['message'])

    gps_result = {'valid': True, 'reason': 'Tanpa QR (guru pengganti)'}
    if payload.qr_token and room:
        gps_enabled = room.get('gps_enabled', settings.get('gps_default_enabled', True))
        radius = room.get('gps_radius_meters', settings.get('gps_default_radius', 20))
        gps_result = validate_gps(payload.user_lat, payload.user_lon, room.get('gps_lat'), room.get('gps_lon'),
                                  radius, gps_enabled=gps_enabled)
        if not gps_result['valid']:
            raise _offline_error('gps_invalid', gps_result['reason'])

    if assignment:
        if await db.journals.find_one({'substitute_assignment_id': assignment['id']}, {'_id': 1}):
            raise _offline_error('duplicate', 'Jurnal untuk penugasan ini sudah diisi', status=409)
    elif await db.journals.find_one({
        'schedule_id': sch['id'], 'teacher_id': user['id'], 'fill_mode': {'$ne': 'substitute'},
        **day_started_at_filter(day),
    }, {'_id': 1}):
        raise _offline_error('duplicate', 'Jurnal untuk jadwal ini pada tanggal tersebut sudah diisi', status=409)

    records = [r.model_dump() for r in payload.attendance_details]
    counts = {s: sum(1 for r in records if r['status'] == s) for s in ATTENDANCE_STATUSES}
    j_id = str(uuid.uuid4())
    trusted = timing['trusted_time']
    name = user.get('full_name') or user.get('username')
    doc = {
        'id': j_id,
        'schedule_id': sch['id'],
        'teacher_id': sch['teacher_id'],
        'class_id': sch.get('class_id'),
        'subject_id': sch.get('subject_id'),
        'room_id': sch.get('room_id'),
        'semester_id': sch.get('semester_id'),
        'materi': payload.materi.strip(),
        'indikator_id': payload.indikator_id,
        'materi_id': payload.materi_id,
        'catatan': (payload.catatan or '').strip() or None,
        'siswa_hadir': counts['hadir'],
        'siswa_tidak_hadir': counts['alpha'],
        'siswa_izin': counts['izin'],
        'siswa_sakit': counts['sakit'],
        'started_at': trusted.isoformat(),
        'scheduled_start': claims['st'],
        'scheduled_end': claims['et'],
        'slot_indexes': sch.get('slot_indexes'),
        'validations': {'offline_permit': True, 'gps': gps_result, 'time_source': timing['time_source']},
        'qr_mode': (qr_payload or {}).get('mode', 'static') if qr_payload else 'substitute',
        'is_locked': True,
        'filled_by_user_id': user['id'],
        'filled_by_name': name,
        'journal_date': claims['date'],
        'offline_client_id': payload.client_id,
        'offline_submission': {
            'source': 'mobile',
            'was_offline': True,
            'captured_server_estimate': payload.captured_server_estimate,
            'device_wall_clock': payload.device_wall_clock,
            'monotonic_elapsed_ms': payload.monotonic_elapsed_ms,
            'clock_unverified': payload.clock_unverified,
            'needs_verification': timing['needs_verification'],
            'location_accuracy': payload.location_accuracy,
            'location_time': payload.location_time,
            'submitted_at_server': now.isoformat(),
        },
        'created_at': now.isoformat(),
    }
    if assignment:
        doc.update({
            'fill_mode': 'substitute',
            'filled_by_role': 'guru_pengganti',
            'substitute_assignment_id': assignment['id'],
            'substitute_teacher_id': user['id'],
            'piket_note': f"Guru pengganti{': ' + assignment['reason'] if assignment.get('reason') else ''}",
        })
    else:
        doc.update({'fill_mode': 'self', 'filled_by_role': 'guru'})

    try:
        await db.journals.insert_one(dict(doc))
    except DuplicateKeyError:
        raise _offline_error('duplicate', 'Jurnal ini sudah tersimpan', status=409)

    if records:
        await db.attendances.insert_many([{
            'id': str(uuid.uuid4()), 'journal_id': j_id, 'student_id': r['student_id'],
            'student_name': r.get('student_name'), 'status': r['status'], 'created_at': now.isoformat(),
        } for r in records])

    await log_audit(user, 'mobile_offline_journal', 'journal', j_id, details={
        'schedule_id': sch['id'], 'date': claims['date'], 'substitute': bool(assignment),
        'time_source': timing['time_source'], 'needs_verification': timing['needs_verification'],
    }, request=request)
    return serialize_doc(doc)
