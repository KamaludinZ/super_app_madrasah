"""Authentication: captcha, login, role switch, me, logout, forgot/reset password."""
from datetime import datetime, timedelta, timezone
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from auth_utils import (
    create_access_token,
    generate_math_captcha,
    hash_password,
    is_locked,
    record_login_attempt,
    verify_captcha,
    verify_password,
)
from core import (
    db,
    get_current_user,
    get_settings,
    log_audit,
    log_security,
    serialize_doc,
)
from email_utils import (
    build_reset_email,
    consume_reset_token,
    create_reset_token,
    send_email,
    validate_reset_token,
)
from models import CaptchaResponse, LoginRequest, LoginResponse, RoleSwitchRequest


router = APIRouter()


# ============================================================
# PASSWORD POLICY HELPERS
# ============================================================
PASSWORD_REMINDER_MONTHS = 6


def _password_change_status(user: Dict) -> Dict:
    """Decide whether to prompt user to change password.

    Returns: { should_prompt: bool, reason: 'first_login'|'expired'|None, days_overdue: int }
    """
    now = datetime.now(timezone.utc)
    dismissed_until = user.get('password_change_dismissed_until')
    if dismissed_until:
        try:
            d = datetime.fromisoformat(dismissed_until.replace('Z', '+00:00'))
            if d.tzinfo is None:
                d = d.replace(tzinfo=timezone.utc)
            if now < d:
                return {'should_prompt': False, 'reason': None, 'days_overdue': 0}
        except Exception:
            pass

    changed_at = user.get('password_changed_at')
    if not changed_at:
        return {'should_prompt': True, 'reason': 'first_login', 'days_overdue': 0,
                'message': 'Selamat datang! Demi keamanan akun Anda, kami sangat menyarankan untuk mengubah password default. Anda boleh mengubahnya sekarang atau menundanya 30 hari.'}
    try:
        ts = datetime.fromisoformat(changed_at.replace('Z', '+00:00'))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
    except Exception:
        return {'should_prompt': True, 'reason': 'first_login', 'days_overdue': 0,
                'message': 'Demi keamanan akun, mohon ubah password Anda.'}
    cutoff = ts + timedelta(days=30 * PASSWORD_REMINDER_MONTHS)
    if now >= cutoff:
        overdue = (now - cutoff).days
        return {'should_prompt': True, 'reason': 'expired', 'days_overdue': overdue,
                'message': f'Sudah lebih dari {PASSWORD_REMINDER_MONTHS} bulan sejak Anda terakhir mengubah password. Demi keamanan akun, mohon perbarui password Anda. (Anda boleh menundanya 30 hari).'}
    return {'should_prompt': False, 'reason': None, 'days_overdue': 0}


@router.get("/auth/captcha", response_model=CaptchaResponse)
async def get_captcha():
    return generate_math_captcha()


@router.post("/auth/login", response_model=LoginResponse)
async def login(req: LoginRequest, request: Request):
    if is_locked(req.username):
        await log_security('locked_attempt', req.username, request=request)
        raise HTTPException(status_code=423, detail="Akun terkunci sementara. Coba lagi nanti.")

    if not verify_captcha(req.captcha_id, req.captcha_answer):
        await log_security('captcha_failed', req.username, request=request)
        raise HTTPException(status_code=400, detail="Captcha salah atau kedaluwarsa")

    user = await db.users.find_one({'username': req.username})
    if not user:
        record_login_attempt(req.username, success=False)
        await log_security('login_failed', req.username, {'reason': 'user_not_found'}, request)
        raise HTTPException(status_code=401, detail="Username atau password salah")

    if not user.get('is_active', True):
        await log_security('login_failed', req.username, {'reason': 'inactive'}, request)
        raise HTTPException(status_code=403, detail="Akun Anda dinonaktifkan")

    if not verify_password(req.password, user['password_hash']):
        attempt_info = record_login_attempt(req.username, success=False)
        await log_security('login_failed', req.username,
                           {'reason': 'wrong_password', 'attempts': attempt_info.get('attempts', 0)}, request)
        if attempt_info.get('locked'):
            raise HTTPException(status_code=423, detail="Terlalu banyak percobaan gagal. Akun terkunci 15 menit.")
        raise HTTPException(status_code=401,
                            detail=f"Username atau password salah. Sisa percobaan: {5 - attempt_info.get('attempts', 0)}")

    record_login_attempt(req.username, success=True)
    active_role = user['roles'][0] if user.get('roles') else 'guru'
    token = create_access_token({'sub': user['id'], 'username': user['username'], 'active_role': active_role})
    await db.users.update_one({'id': user['id']}, {'$set': {'last_login_at': datetime.utcnow().isoformat()}})
    await log_security('login_success', req.username, {'role': active_role}, request)
    user_clean = serialize_doc(user.copy())
    user_clean.pop('password_hash', None)
    settings = await get_settings()
    return LoginResponse(
        access_token=token, user=user_clean, active_role=active_role,
        expires_in_minutes=settings.get('session_max_hours', 12) * 60,
        idle_timeout_minutes=settings.get('idle_timeout_minutes', 30),
    )


@router.post("/auth/switch-role")
async def switch_role(req: RoleSwitchRequest, request: Request, user: Dict = Depends(get_current_user)):
    if req.new_role not in user.get('roles', []):
        raise HTTPException(status_code=403, detail=f"Anda tidak memiliki peran '{req.new_role}'")
    token = create_access_token({'sub': user['id'], 'username': user['username'], 'active_role': req.new_role})
    await log_audit(user, 'role_switch', 'session', details={'new_role': req.new_role}, request=request)
    user.pop('password_hash', None)
    user['active_role'] = req.new_role
    return {'access_token': token, 'token_type': 'bearer', 'active_role': req.new_role, 'user': user}


@router.get("/auth/me")
async def me(user: Dict = Depends(get_current_user)):
    user.pop('password_hash', None)
    user['password_status'] = _password_change_status(user)
    return user


@router.post("/auth/logout")
async def logout(request: Request, user: Dict = Depends(get_current_user)):
    await log_audit(user, 'logout', 'session', request=request)
    return {'message': 'Logged out'}


# ============================================================
# CHANGE / DISMISS PASSWORD
# ============================================================
class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/auth/change-password")
async def change_password(req: ChangePasswordRequest, request: Request,
                          user: Dict = Depends(get_current_user)):
    """User mengubah password sendiri. Wajib verifikasi password lama dulu."""
    if len(req.new_password) < 6:
        raise HTTPException(400, "Password baru minimal 6 karakter")
    if req.current_password == req.new_password:
        raise HTTPException(400, "Password baru tidak boleh sama dengan password lama")
    db_user = await db.users.find_one({'id': user['id']})
    if not db_user or not verify_password(req.current_password, db_user['password_hash']):
        await log_security('password_change_failed', user.get('username'),
                           {'reason': 'wrong_current_password'}, request)
        raise HTTPException(401, "Password lama salah")
    await db.users.update_one({'id': user['id']}, {'$set': {
        'password_hash': hash_password(req.new_password),
        'password_changed_at': datetime.now(timezone.utc).isoformat(),
        'password_change_dismissed_until': None,
    }})
    await log_security('password_change_success', user.get('username'),
                       {'method': 'self_service'}, request)
    await log_audit(user, 'change_password', 'user', user['id'], request=request)
    return {'message': 'Password berhasil diubah. Silakan gunakan password baru pada login berikutnya.'}


@router.post("/auth/dismiss-password-reminder")
async def dismiss_password_reminder(request: Request, days: int = 30,
                                    user: Dict = Depends(get_current_user)):
    """Tunda pengingat ganti password selama N hari (default 30)."""
    days = max(1, min(days, 90))  # clamp 1-90 hari
    snooze_until = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()
    await db.users.update_one({'id': user['id']},
                              {'$set': {'password_change_dismissed_until': snooze_until}})
    await log_audit(user, 'dismiss_password_reminder', 'user', user['id'],
                    details={'snooze_days': days}, request=request)
    return {'message': f'Pengingat ditunda {days} hari.', 'dismissed_until': snooze_until}


class ForgotPasswordRequest(BaseModel):
    identifier: str  # username OR email


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/auth/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, request: Request):
    """Send password reset email. Always returns OK to prevent enumeration."""
    user = await db.users.find_one({'$or': [
        {'username': req.identifier},
        {'email': req.identifier},
    ]})
    if not user or not user.get('email') or not user.get('is_active', True):
        return {'message': 'Jika akun terdaftar dengan email, instruksi reset telah dikirim.'}
    settings = await get_settings()
    if not settings.get('smtp_host'):
        return {'message': 'Fitur reset email belum tersedia. Hubungi admin.'}
    token = create_reset_token(user['id'], user['email'])
    base = settings.get('app_public_url') or str(request.base_url).rstrip('/')
    reset_link = f"{base}/reset-password?token={token}"
    body = build_reset_email(reset_link, user['username'],
                             settings.get('app_name', 'Super Apps MATSANDATAMA'),
                             settings.get('school_name', 'MTsN 2 Kota Malang'))
    send_result = send_email(
        settings, user['email'],
        subject=f"Reset Password - {settings.get('app_name', 'Super Apps MATSANDATAMA')}",
        body_text=body['text'], body_html=body['html'],
    )
    await log_security('forgot_password',
                       user.get('username'),
                       {'sent': send_result.get('success'), 'email': user['email']},
                       request)
    return {'message': 'Jika akun terdaftar dengan email, instruksi reset telah dikirim.'}


@router.get("/auth/reset-password/validate/{token}")
async def reset_password_validate(token: str):
    item = validate_reset_token(token)
    if not item:
        raise HTTPException(400, "Token tidak valid atau kedaluwarsa")
    user = await db.users.find_one({'id': item['user_id']}, {'_id': 0, 'username': 1, 'email': 1})
    return {'valid': True, 'username': user.get('username') if user else None}


@router.post("/auth/reset-password")
async def reset_password(req: ResetPasswordRequest, request: Request):
    item = consume_reset_token(req.token)
    if not item:
        raise HTTPException(400, "Token tidak valid atau kedaluwarsa")
    if len(req.new_password) < 6:
        raise HTTPException(400, "Password minimal 6 karakter")
    user = await db.users.find_one({'id': item['user_id']})
    if not user:
        raise HTTPException(404, "User tidak ditemukan")
    await db.users.update_one({'id': user['id']},
                              {'$set': {
                                  'password_hash': hash_password(req.new_password),
                                  'password_changed_at': datetime.now(timezone.utc).isoformat(),
                                  'password_change_dismissed_until': None,
                              }})
    await log_security('password_reset', user.get('username'), {'method': 'email_token'}, request)
    return {'message': 'Password berhasil direset. Silakan login.'}
