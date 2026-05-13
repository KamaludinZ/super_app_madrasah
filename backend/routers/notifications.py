"""Announcements (Pengumuman) + Notifications feed + Mark-read."""
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from core import (
    db,
    get_current_user,
    log_audit,
    require_role,
    serialize_doc,
)
from models import AnnouncementModel

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _is_active(ann: Dict) -> bool:
    if not ann.get('is_active', True):
        return False
    now = datetime.now(timezone.utc)
    starts = ann.get('starts_at')
    ends = ann.get('ends_at')
    if starts:
        try:
            s = datetime.fromisoformat(starts.replace('Z', '+00:00'))
            if s.tzinfo is None: s = s.replace(tzinfo=timezone.utc)
            if now < s: return False
        except Exception:
            pass
    if ends:
        try:
            e = datetime.fromisoformat(ends.replace('Z', '+00:00'))
            if e.tzinfo is None: e = e.replace(tzinfo=timezone.utc)
            if now > e: return False
        except Exception:
            pass
    return True


def _user_matches_roles(user: Dict, target_roles: List[str]) -> bool:
    if not target_roles or 'all' in target_roles:
        return True
    user_roles = set(user.get('roles', []))
    return bool(user_roles & set(target_roles))


# ============================================================
# ADMIN: ANNOUNCEMENTS CRUD
# ============================================================
@router.get("/admin/announcements")
async def admin_list_announcements(user: Dict = Depends(require_role('admin'))):
    """List ALL announcements (active + inactive) for admin management."""
    items = await db.announcements.find({}, {'_id': 0}).sort('created_at', -1).to_list(500)
    return [serialize_doc(i) for i in items]


@router.post("/admin/announcements")
async def admin_create_announcement(payload: Dict, request: Request,
                                    user: Dict = Depends(require_role('admin'))):
    if not payload.get('title') or not payload.get('body'):
        raise HTTPException(400, "Judul dan isi pengumuman wajib")
    ann = AnnouncementModel(
        title=payload['title'],
        body=payload['body'],
        target_roles=payload.get('target_roles') or ['all'],
        severity=payload.get('severity', 'info'),
        is_active=payload.get('is_active', True),
        is_pinned=payload.get('is_pinned', False),
        starts_at=payload.get('starts_at'),
        ends_at=payload.get('ends_at'),
        created_by=user['id'],
        created_by_name=user.get('full_name'),
    )
    doc = ann.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.announcements.insert_one(doc)
    await log_audit(user, 'create', 'announcement', ann.id,
                    details={'title': ann.title, 'target_roles': ann.target_roles}, request=request)
    return serialize_doc(doc)


@router.put("/admin/announcements/{aid}")
async def admin_update_announcement(aid: str, payload: Dict, request: Request,
                                    user: Dict = Depends(require_role('admin'))):
    payload.pop('id', None); payload.pop('_id', None); payload.pop('created_at', None)
    payload['updated_at'] = _now_iso()
    res = await db.announcements.update_one({'id': aid}, {'$set': payload})
    if res.matched_count == 0:
        raise HTTPException(404, "Pengumuman tidak ditemukan")
    await log_audit(user, 'update', 'announcement', aid, request=request)
    doc = await db.announcements.find_one({'id': aid}, {'_id': 0})
    return serialize_doc(doc)


@router.delete("/admin/announcements/{aid}")
async def admin_delete_announcement(aid: str, request: Request,
                                    user: Dict = Depends(require_role('admin'))):
    res = await db.announcements.delete_one({'id': aid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Tidak ditemukan")
    # Clean up read receipts
    await db.announcement_reads.delete_many({'announcement_id': aid})
    await log_audit(user, 'delete', 'announcement', aid, request=request)
    return {'message': 'Dihapus'}


# ============================================================
# USER: ANNOUNCEMENTS FEED
# ============================================================
@router.get("/announcements")
async def list_my_announcements(user: Dict = Depends(get_current_user)):
    """List active announcements relevant to the current user (based on roles).
    Pinned first, then newest. Includes is_read flag.
    """
    items = await db.announcements.find({'is_active': True}, {'_id': 0}).sort([
        ('is_pinned', -1), ('created_at', -1)
    ]).to_list(200)
    reads = await db.announcement_reads.find({'user_id': user['id']}, {'_id': 0}).to_list(500)
    read_set = {r['announcement_id'] for r in reads}
    filtered = []
    for ann in items:
        if not _is_active(ann):
            continue
        if not _user_matches_roles(user, ann.get('target_roles') or ['all']):
            continue
        ann['is_read'] = ann['id'] in read_set
        filtered.append(serialize_doc(ann))
    return filtered


# ============================================================
# NOTIFICATIONS FEED (aggregation of announcements + system messages)
# ============================================================
@router.get("/notifications")
async def list_notifications(user: Dict = Depends(get_current_user)):
    """Aggregated notifications for the topbar bell.

    Sources combined:
    1. Active announcements relevant to user's roles (unread first).
    2. System notifications: password reminder, etc.

    Returns a list sorted: unread first, then by created_at desc, max 20.
    """
    out = []

    # 1) Announcements
    anns = await db.announcements.find({'is_active': True}, {'_id': 0}).sort([
        ('is_pinned', -1), ('created_at', -1)
    ]).to_list(50)
    reads = await db.announcement_reads.find({'user_id': user['id']}, {'_id': 0}).to_list(500)
    read_set = {r['announcement_id'] for r in reads}
    for ann in anns:
        if not _is_active(ann):
            continue
        if not _user_matches_roles(user, ann.get('target_roles') or ['all']):
            continue
        out.append({
            'id': f"ann_{ann['id']}",
            'source': 'announcement',
            'source_id': ann['id'],
            'title': ann['title'],
            'body': ann['body'][:200] + ('...' if len(ann.get('body', '')) > 200 else ''),
            'severity': ann.get('severity', 'info'),
            'is_pinned': ann.get('is_pinned', False),
            'is_read': ann['id'] in read_set,
            'created_at': ann.get('created_at'),
            'link': '/pengumuman',
            'icon': 'megaphone',
        })

    # 2) Password reminder (synthetic - not stored, derived each call)
    from routers.auth import _password_change_status  # local import to avoid cycle at module load
    pwd_status = _password_change_status(user)
    if pwd_status.get('should_prompt'):
        out.append({
            'id': 'system_password_change',
            'source': 'system',
            'source_id': 'password_change',
            'title': 'Saran: Ubah Password' if pwd_status['reason'] == 'first_login' else 'Password Sudah > 6 Bulan',
            'body': pwd_status.get('message', 'Demi keamanan, mohon ubah password Anda.'),
            'severity': 'warning' if pwd_status['reason'] == 'expired' else 'info',
            'is_pinned': False,
            'is_read': False,
            'created_at': _now_iso(),
            'link': '/profil/keamanan',
            'icon': 'lock',
        })

    # Sort: unread first, pinned first, then newest
    out.sort(key=lambda x: (x['is_read'], not x.get('is_pinned', False), -1 * len(str(x.get('created_at', '')))),
             reverse=False)
    return out[:30]


@router.get("/notifications/unread-count")
async def unread_count(user: Dict = Depends(get_current_user)):
    """Count of unread notifications for the topbar bell badge."""
    anns = await db.announcements.find({'is_active': True}, {'_id': 0}).to_list(100)
    reads = await db.announcement_reads.find({'user_id': user['id']}, {'_id': 0}).to_list(500)
    read_set = {r['announcement_id'] for r in reads}
    count = 0
    for ann in anns:
        if not _is_active(ann):
            continue
        if not _user_matches_roles(user, ann.get('target_roles') or ['all']):
            continue
        if ann['id'] not in read_set:
            count += 1
    from routers.auth import _password_change_status
    if _password_change_status(user).get('should_prompt'):
        count += 1
    return {'unread': count}


@router.post("/notifications/{source}/{source_id}/read")
async def mark_notification_read(source: str, source_id: str, user: Dict = Depends(get_current_user)):
    """Mark a notification as read. Currently supports announcements."""
    if source == 'announcement':
        existing = await db.announcement_reads.find_one({'user_id': user['id'], 'announcement_id': source_id})
        if not existing:
            await db.announcement_reads.insert_one({
                'user_id': user['id'],
                'announcement_id': source_id,
                'read_at': _now_iso(),
            })
        return {'message': 'Marked as read', 'source': source, 'source_id': source_id}
    return {'message': 'No-op (synthetic notification)'}


@router.post("/notifications/mark-all-read")
async def mark_all_read(user: Dict = Depends(get_current_user)):
    """Mark all announcements as read for this user."""
    anns = await db.announcements.find({'is_active': True}, {'_id': 0, 'id': 1, 'target_roles': 1}).to_list(200)
    relevant_ids = []
    for ann in anns:
        if _user_matches_roles(user, ann.get('target_roles') or ['all']):
            relevant_ids.append(ann['id'])
    existing = await db.announcement_reads.find({'user_id': user['id']}, {'_id': 0, 'announcement_id': 1}).to_list(500)
    existing_ids = {e['announcement_id'] for e in existing}
    new_entries = [{
        'user_id': user['id'],
        'announcement_id': aid,
        'read_at': _now_iso(),
    } for aid in relevant_ids if aid not in existing_ids]
    if new_entries:
        await db.announcement_reads.insert_many(new_entries)
    return {'marked_read': len(new_entries)}
