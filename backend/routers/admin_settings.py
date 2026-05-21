"""Admin Settings, Logo upload, SMTP test."""
import base64
from datetime import datetime
from typing import Any, Dict

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile

from core import db, get_settings, log_audit, require_role
from email_utils import send_email

router = APIRouter()


@router.get("/admin/settings")
async def get_full_settings(user: Dict = Depends(require_role('admin'))):
    return await get_settings()


@router.put("/admin/settings")
async def update_settings(payload: Dict[str, Any], request: Request, user: Dict = Depends(require_role('admin'))):
    payload['updated_at'] = datetime.utcnow().isoformat()
    payload['updated_by'] = user['username']
    await db.settings.update_one({'id': 'global_config'}, {'$set': payload}, upsert=True)
    await log_audit(user, 'update', 'settings', 'global_config', details={'keys': list(payload.keys())}, request=request)
    return await get_settings()


@router.post("/admin/settings/upload-logo")
async def upload_logo(file: UploadFile = File(...), kind: str = Form('logo'),
                      request: Request = None, user: Dict = Depends(require_role('admin'))):
    # DEBUG: Log the received kind parameter
    print(f"[UPLOAD DEBUG] Received kind parameter: '{kind}'")
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File terlalu besar (max 5MB)")
    mime = file.content_type or 'image/png'
    b64 = base64.b64encode(contents).decode('utf-8')
    data_url = f"data:{mime};base64,{b64}"
    field_map = {
        'logo': 'logo_url',
        'favicon': 'favicon_url',
        'report_logo': 'report_logo_url',
        'letterhead': 'letterhead_url'  # NEW: kop surat
    }
    field = field_map.get(kind, 'logo_url')
    print(f"[UPLOAD DEBUG] Mapped to field: '{field}'")
    await db.settings.update_one({'id': 'global_config'},
                                 {'$set': {field: data_url, 'updated_at': datetime.utcnow().isoformat(),
                                           'updated_by': user['username']}}, upsert=True)
    await log_audit(user, 'upload', 'settings', field, request=request)
    print(f"[UPLOAD DEBUG] Saved successfully to field: '{field}'")
    return {field: data_url}


@router.post("/admin/settings/test-smtp")
async def test_smtp(payload: Dict[str, Any], request: Request = None,
                    user: Dict = Depends(require_role('admin'))):
    """Send test email to verify SMTP configuration"""
    settings = await get_settings()
    cfg = {**settings, **payload}
    to_email = payload.get('to_email') or user.get('email')
    if not to_email:
        raise HTTPException(400, "Email tujuan wajib (set via payload to_email)")
    result = send_email(
        cfg, to_email,
        subject="Test SMTP - Super Apps MATSANDATAMA",
        body_text="Selamat! Konfigurasi SMTP Anda berhasil. Email ini dikirim sebagai uji coba.",
        body_html="<p>Selamat! Konfigurasi SMTP Anda <strong>berhasil</strong>. Email ini dikirim sebagai uji coba dari Super Apps MATSANDATAMA.</p>",
    )
    await log_audit(user, 'test_smtp', 'settings', None, details={'success': result['success']}, request=request)
    return result
