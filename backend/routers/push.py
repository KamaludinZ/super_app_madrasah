"""Web Push (VAPID) notifications for the PWA.

Endpoints:
  GET  /api/push/vapid-public-key   -> public key for the browser to subscribe
  POST /api/push/subscribe          -> save a PushSubscription for the current user
  POST /api/push/unsubscribe        -> remove a subscription by endpoint
  POST /api/push/test               -> send a test push to the current user

Helpers (imported by other routers):
  send_push_to_users(user_ids, payload)
  send_push_to_roles(target_roles, payload)
"""
import asyncio
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from core import db, get_current_user, logger, serialize_doc

# Using custom robust web push implementation (web_push_robust.py)
# instead of pywebpush library due to incompatibility with cryptography >= 47
_PUSH_AVAILABLE = True

router = APIRouter()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_vapid_private_key() -> Optional[str]:
    """Return the VAPID private key PEM, restoring newlines from the .env single-line form."""
    raw = os.environ.get("VAPID_PRIVATE_KEY", "")
    if not raw:
        return None
    return raw.replace("\\n", "\n")


def _get_vapid_public_key() -> str:
    return os.environ.get("VAPID_PUBLIC_KEY", "")


def _vapid_claims() -> Dict:
    return {"sub": os.environ.get("VAPID_SUBJECT", "mailto:admin@example.com")}


def _push_configured() -> bool:
    return bool(_PUSH_AVAILABLE and _get_vapid_private_key() and _get_vapid_public_key())


# ------------------------------------------------------------------
# Low-level send (uses custom robust implementation)
# ------------------------------------------------------------------
async def _send_one_async(subscription_info: Dict, payload: Dict) -> Dict:
    """Send a single web push using robust implementation. Returns {'ok': bool, 'gone': bool, 'error': str}."""
    try:
        from web_push_robust import send_web_push
        result = await send_web_push(subscription_info, payload, ttl=86400)
        return result
    except Exception as ex:  # pragma: no cover
        return {"ok": False, "gone": False, "error": str(ex)}


async def _dispatch(subscriptions: List[Dict], payload: Dict) -> Dict:
    """Send payload to a list of subscription docs. Cleans up dead subscriptions."""
    sent = 0
    failed = 0
    stale_ids: List[str] = []
    for sub in subscriptions:
        info = {
            "endpoint": sub.get("endpoint"),
            "keys": sub.get("keys", {}),
        }
        # Use async implementation directly (no need for to_thread)
        result = await _send_one_async(info, payload)
        if result["ok"]:
            sent += 1
        else:
            failed += 1
            if result["gone"]:
                stale_ids.append(sub["id"])
            else:
                logger.warning(f"[push] send failed: {result['error']}")
    if stale_ids:
        await db.push_subscriptions.delete_many({"id": {"$in": stale_ids}})
    return {"sent": sent, "failed": failed, "removed": len(stale_ids)}


# ------------------------------------------------------------------
# Public helpers used by other routers
# ------------------------------------------------------------------
async def send_push_to_users(user_ids: List[str], payload: Dict) -> Dict:
    if not _push_configured() or not user_ids:
        return {"sent": 0, "failed": 0, "removed": 0, "skipped": True}
    subs = await db.push_subscriptions.find(
        {"user_id": {"$in": list(user_ids)}}, {"_id": 0}
    ).to_list(5000)
    if not subs:
        return {"sent": 0, "failed": 0, "removed": 0}
    return await _dispatch(subs, payload)


async def send_push_to_roles(target_roles: Optional[List[str]], payload: Dict) -> Dict:
    """Resolve users by role then push. Empty / ['all'] => everyone with a subscription."""
    if not _push_configured():
        return {"sent": 0, "failed": 0, "removed": 0, "skipped": True}

    roles = target_roles or ["all"]
    if "all" in roles:
        subs = await db.push_subscriptions.find({}, {"_id": 0}).to_list(10000)
        if not subs:
            return {"sent": 0, "failed": 0, "removed": 0}
        return await _dispatch(subs, payload)

    users = await db.users.find(
        {"roles": {"$in": roles}}, {"_id": 0, "id": 1}
    ).to_list(10000)
    user_ids = [u["id"] for u in users if u.get("id")]
    return await send_push_to_users(user_ids, payload)


# ------------------------------------------------------------------
# Routes
# ------------------------------------------------------------------
@router.get("/push/vapid-public-key")
async def get_vapid_public_key():
    key = _get_vapid_public_key()
    return {"public_key": key, "enabled": _push_configured()}


@router.post("/push/subscribe")
async def subscribe(payload: Dict, request: Request,
                    user: Dict = Depends(get_current_user)):
    sub = payload.get("subscription") or payload
    endpoint = sub.get("endpoint")
    keys = sub.get("keys") or {}
    if not endpoint or not keys.get("p256dh") or not keys.get("auth"):
        raise HTTPException(400, "Subscription tidak valid")

    existing = await db.push_subscriptions.find_one({"endpoint": endpoint}, {"_id": 0})
    doc = {
        "id": existing["id"] if existing else str(uuid.uuid4()),
        "user_id": user["id"],
        "endpoint": endpoint,
        "keys": {"p256dh": keys["p256dh"], "auth": keys["auth"]},
        "user_agent": request.headers.get("user-agent", ""),
        "created_at": existing["created_at"] if existing else _now_iso(),
        "updated_at": _now_iso(),
    }
    await db.push_subscriptions.update_one(
        {"endpoint": endpoint}, {"$set": doc}, upsert=True
    )
    return {"message": "Notifikasi diaktifkan", "id": doc["id"]}


@router.post("/push/unsubscribe")
async def unsubscribe(payload: Dict, user: Dict = Depends(get_current_user)):
    endpoint = payload.get("endpoint")
    if not endpoint:
        raise HTTPException(400, "endpoint wajib")
    await db.push_subscriptions.delete_one({"endpoint": endpoint, "user_id": user["id"]})
    return {"message": "Notifikasi dinonaktifkan"}


@router.get("/push/status")
async def push_status(user: Dict = Depends(get_current_user)):
    count = await db.push_subscriptions.count_documents({"user_id": user["id"]})
    return {"enabled": _push_configured(), "subscribed": count > 0, "devices": count}


@router.post("/push/test")
async def send_test(user: Dict = Depends(get_current_user)):
    if not _push_configured():
        raise HTTPException(400, "Web Push belum dikonfigurasi di server")
    result = await send_push_to_users(
        [user["id"]],
        {
            "title": "Tes Notifikasi",
            "body": "Notifikasi berhasil diaktifkan di perangkat ini.",
            "url": "/dashboard",
            "tag": "matsa-test",
        },
    )
    return {"message": "Notifikasi tes dikirim", "result": result}

