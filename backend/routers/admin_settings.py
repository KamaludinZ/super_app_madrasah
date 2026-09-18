"""Admin Settings, Logo upload, SMTP test."""
import base64
from datetime import datetime
from typing import Any, Dict

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile

from core import db, get_settings, log_audit, require_role
from email_utils import send_email
from ai_client import generate_text, AIError
from whatsapp_client import send_message as wa_send_message, WhatsAppError

router = APIRouter()


@router.get("/settings/public-pages")
async def get_public_pages_visibility():
    """Get public pages visibility settings - accessible without auth for routing decisions"""
    settings = await get_settings()
    return {
        'rkam_visibility': settings.get('rkam_visibility', 'public'),
        'agenda_visibility': settings.get('agenda_visibility', 'public'),
        'prestasi_visibility': settings.get('prestasi_visibility', 'public'),
        'monitoring_visibility': settings.get('monitoring_visibility', 'public'),
    }


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


@router.post("/admin/settings/test-ai")
async def test_ai_provider(payload: Dict[str, Any], request: Request = None,
                           user: Dict = Depends(require_role('admin'))):
    """Send a small test prompt to the given (or active) AI provider to verify connectivity."""
    settings = await get_settings()
    provider = payload.get('provider')
    # Allow testing an unsaved draft config by overlaying it onto settings first
    if provider and payload.get('config'):
        providers = dict(settings.get('ai_providers') or {})
        providers[provider] = {**providers.get(provider, {}), **payload['config'], 'enabled': True}
        settings = {**settings, 'ai_providers': providers}

    try:
        text = await generate_text(
            settings,
            prompt="Balas singkat dalam satu kalimat: koneksi berhasil.",
            system="Kamu adalah asisten uji koneksi. Jawab singkat dan ramah dalam Bahasa Indonesia.",
            provider_override=provider,
        )
        await log_audit(user, 'test_ai', 'settings', provider, details={'success': True}, request=request)
        return {'success': True, 'reply': text}
    except AIError as e:
        await log_audit(user, 'test_ai', 'settings', provider, details={'success': False, 'error': str(e)}, request=request)
        return {'success': False, 'error': str(e)}


@router.post("/admin/settings/test-whatsapp")
async def test_whatsapp(payload: Dict[str, Any], request: Request = None,
                        user: Dict = Depends(require_role('admin'))):
    """Send a test WhatsApp message to verify gateway configuration."""
    settings = await get_settings()
    cfg = {**settings, **{k: v for k, v in payload.items() if k != 'target_phone'}, 'whatsapp_enabled': True}
    target_phone = payload.get('target_phone')
    if not target_phone:
        raise HTTPException(400, "Nomor tujuan wajib diisi (target_phone)")

    try:
        result = await wa_send_message(cfg, target_phone, "Test integrasi WhatsApp dari Super Apps MATSANDATAMA berhasil.")
        await log_audit(user, 'test_whatsapp', 'settings', None, details={'success': True}, request=request)
        return {'success': True, 'result': result}
    except WhatsAppError as e:
        await log_audit(user, 'test_whatsapp', 'settings', None, details={'success': False, 'error': str(e)}, request=request)
        return {'success': False, 'error': str(e)}
