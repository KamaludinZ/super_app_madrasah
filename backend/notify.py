"""Notifikasi pribadi per pengguna (kotak masuk + push ke HP & web).

Setiap peristiwa penting (tugas titipan, tugas/materi kelas, tata tertib, verval, prestasi,
sarpras/lab, tanggapan BK, guru pengganti, …) memanggil `notify_users` / `notify_roles`:
  1. disimpan di koleksi `user_notifications` → tampil di lonceng web & tab Notifikasi aplikasi
     (GET /notifications, sumber 'user'), kedaluwarsa otomatis setelah 90 hari;
  2. dikirim sebagai push ke aplikasi Android (Expo) dan browser/PWA (Web Push).

Semua fungsi best-effort: galat dicatat di log dan TIDAK pernah menggagalkan aksi utama.
Gunakan `spawn(...)` agar pengiriman berjalan di latar belakang tanpa menahan respons API.
"""
import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, List, Optional

from core import db

logger = logging.getLogger('matsandatama')

COLLECTION = 'user_notifications'
RETENTION_DAYS = 90
MAX_RECIPIENTS = 2000

_background: set = set()


def spawn(coro) -> None:
    """Jalankan coroutine notifikasi di latar belakang (referensi disimpan agar tidak di-GC)."""
    try:
        task = asyncio.get_running_loop().create_task(coro)
    except RuntimeError:
        return
    _background.add(task)
    task.add_done_callback(_background.discard)


async def ensure_notification_indexes(database) -> List[str]:
    gagal = []
    for keys, kwargs in [
        ([('user_id', 1), ('created_at', -1)], {'name': 'user_created'}),
        ([('user_id', 1), ('is_read', 1)], {'name': 'user_unread'}),
        ('expire_at', {'expireAfterSeconds': 0, 'name': 'ttl_expire_at'}),
    ]:
        try:
            await database[COLLECTION].create_index(keys, **kwargs)
        except Exception as e:  # noqa: BLE001
            gagal.append(f"{COLLECTION} {keys}: {e}")
            logger.error(f"[notify] Gagal membuat index {keys}: {e}")
    return gagal


def _unique(ids: Iterable[Optional[str]], exclude: Optional[Iterable[str]] = None) -> List[str]:
    skip = set(exclude or [])
    seen: List[str] = []
    for i in ids:
        if i and i not in skip and i not in seen:
            seen.append(i)
    return seen[:MAX_RECIPIENTS]


async def notify_users(user_ids: Iterable[Optional[str]], title: str, body: str, *, type: str,
                       route: Optional[str] = None, data: Optional[Dict] = None,
                       channel: str = 'umum', exclude: Optional[Iterable[str]] = None,
                       push: bool = True) -> int:
    """Simpan notifikasi untuk tiap pengguna lalu kirim push. Mengembalikan jumlah penerima."""
    ids = _unique(user_ids, exclude)
    if not ids:
        return 0
    now = datetime.now(timezone.utc)
    docs = [{
        'id': str(uuid.uuid4()),
        'user_id': uid,
        'type': type,
        'title': title[:200],
        'body': (body or '')[:1000],
        'route': route,
        'data': data or {},
        'is_read': False,
        'created_at': now.isoformat(),
        'expire_at': now + timedelta(days=RETENTION_DAYS),
    } for uid in ids]
    try:
        await db[COLLECTION].insert_many(docs, ordered=False)
    except Exception as e:  # noqa: BLE001
        logger.error(f"[notify] simpan notifikasi '{type}' gagal: {e}")
    if not push:
        return len(ids)

    payload_data = {**(data or {}), 'type': type, **({'route': route} if route else {})}
    try:
        from routers.mobile import send_expo_push_to_users
        await send_expo_push_to_users(ids, title, body, payload_data, channel_id=channel)
    except Exception as e:  # noqa: BLE001
        logger.error(f"[notify] push aplikasi '{type}' gagal: {e}")
    try:
        from routers.push import send_push_to_users
        # Service worker web membuka data.url saat notifikasi diketuk.
        await send_push_to_users(ids, {
            'title': title, 'body': body, 'url': route or '/dashboard', 'tag': type,
            'icon': '/icon-192.png', 'badge': '/icon-192.png',
            'data': {**payload_data, 'url': route or '/dashboard'},
        })
    except Exception as e:  # noqa: BLE001
        logger.error(f"[notify] web push '{type}' gagal: {e}")
    return len(ids)


async def users_with_roles(roles: Iterable[str]) -> List[str]:
    docs = await db.users.find(
        {'roles': {'$in': list(roles)}, 'is_active': {'$ne': False}}, {'_id': 0, 'id': 1},
    ).to_list(MAX_RECIPIENTS)
    return [d['id'] for d in docs]


async def notify_roles(roles: Iterable[str], title: str, body: str, **kwargs) -> int:
    return await notify_users(await users_with_roles(roles), title, body, **kwargs)


async def students_of_classes(class_ids: Iterable[Optional[str]]) -> List[str]:
    """Akun siswa (users ber-peran siswa) di kelas-kelas tersebut."""
    cids = [c for c in set(class_ids or []) if c]
    if not cids:
        return []
    docs = await db.users.find(
        {'roles': 'siswa', 'student_class_id': {'$in': cids}, 'is_active': {'$ne': False}}, {'_id': 0, 'id': 1},
    ).to_list(MAX_RECIPIENTS)
    return [d['id'] for d in docs]


async def homeroom_teacher_of(class_id: Optional[str] = None, class_name: Optional[str] = None) -> Optional[str]:
    """Wali kelas dari kelas (berdasarkan id, atau nama kelas bila id tidak ada)."""
    q = {'id': class_id} if class_id else ({'name': class_name} if class_name else None)
    if not q:
        return None
    cls = await db.classes.find_one(q, {'_id': 0, 'homeroom_teacher_id': 1})
    if cls and cls.get('homeroom_teacher_id'):
        return cls['homeroom_teacher_id']
    # Cadangan: akun wali kelas yang menyimpan homeroom_class_id.
    if class_id:
        u = await db.users.find_one({'homeroom_class_id': class_id, 'roles': 'wali_kelas'}, {'_id': 0, 'id': 1})
        return u['id'] if u else None
    return None


async def class_name_of(class_id: Optional[str]) -> str:
    if not class_id:
        return 'kelas'
    cls = await db.classes.find_one({'id': class_id}, {'_id': 0, 'name': 1})
    return (cls or {}).get('name') or 'kelas'
