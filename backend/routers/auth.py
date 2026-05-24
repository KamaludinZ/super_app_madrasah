"""Authentication: captcha, login, role switch, me, logout, forgot/reset password."""
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

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
# IMPERSONATION - Admin can login as another user
# ============================================================
class ImpersonateRequest(BaseModel):
    target_user_id: str


@router.post("/auth/impersonate")
async def impersonate_user(req: ImpersonateRequest, request: Request, user: Dict = Depends(get_current_user)):
    """Admin can impersonate (login as) another user without password.
    Stores original admin ID to allow reverting back."""

    # Only admin can impersonate
    if 'admin' not in user.get('roles', []):
        raise HTTPException(status_code=403, detail="Hanya admin yang dapat menggunakan fitur ini")

    # Get target user
    target_user = await db.users.find_one({'id': req.target_user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")

    if not target_user.get('is_active', True):
        raise HTTPException(status_code=403, detail="Akun target dinonaktifkan")

    # Create token with impersonation info
    active_role = target_user['roles'][0] if target_user.get('roles') else 'guru'
    token = create_access_token({
        'sub': target_user['id'],
        'username': target_user['username'],
        'active_role': active_role,
        'impersonator_id': user['id'],  # Store admin's ID for reverting
        'impersonator_username': user['username'],
    })

    # Log impersonation for audit trail
    await log_security('impersonate_start', user.get('username'), {
        'target_user_id': req.target_user_id,
        'target_username': target_user.get('username'),
    }, request)
    await log_audit(user, 'impersonate', 'user', req.target_user_id,
                    details={'target_username': target_user.get('username')}, request=request)

    target_user_clean = serialize_doc(target_user.copy())
    target_user_clean.pop('password_hash', None)
    target_user_clean['is_impersonating'] = True
    target_user_clean['impersonator_username'] = user['username']

    settings = await get_settings()
    return LoginResponse(
        access_token=token,
        user=target_user_clean,
        active_role=active_role,
        expires_in_minutes=settings.get('session_max_hours', 12) * 60,
        idle_timeout_minutes=settings.get('idle_timeout_minutes', 30),
    )


@router.post("/auth/stop-impersonate")
async def stop_impersonating(request: Request, user: Dict = Depends(get_current_user)):
    """Stop impersonation and return to original admin account."""

    # Check if currently impersonating - this info comes from JWT token
    # We'll need to modify get_current_user to pass this through
    # For now, get from request state which will be set by middleware
    from fastapi import Request as FastAPIRequest
    impersonator_id = getattr(request.state, 'impersonator_id', None)

    if not impersonator_id:
        raise HTTPException(status_code=400, detail="Tidak sedang dalam mode impersonation")

    # Get original admin user
    admin_user = await db.users.find_one({'id': impersonator_id})
    if not admin_user:
        raise HTTPException(status_code=404, detail="Admin user tidak ditemukan")

    # Create new token for admin
    active_role = admin_user['roles'][0] if admin_user.get('roles') else 'admin'
    token = create_access_token({
        'sub': admin_user['id'],
        'username': admin_user['username'],
        'active_role': active_role,
    })

    # Log stop impersonation
    await log_security('impersonate_stop', admin_user.get('username'), {
        'from_user_id': user['id'],
        'from_username': user.get('username'),
    }, request)

    admin_user_clean = serialize_doc(admin_user.copy())
    admin_user_clean.pop('password_hash', None)

    settings = await get_settings()
    return LoginResponse(
        access_token=token,
        user=admin_user_clean,
        active_role=active_role,
        expires_in_minutes=settings.get('session_max_hours', 12) * 60,
        idle_timeout_minutes=settings.get('idle_timeout_minutes', 30),
    )


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


# ============================================================
# VIEW CONTEXT (Per-user TP/Semester override)
# ============================================================
class ViewContextRequest(BaseModel):
    semester_id: Optional[str] = None  # None = clear (ikut semester aktif global)


async def _resolve_view_context(user: Dict) -> Dict:
    """Return effective view context based on semester (which contains academic year and tahun takwim).

    Priority:
    1. User override (view_semester_id) if set
    2. Active semester globally

    Returns: {
        semester_id, semester_name, semester_code,
        academic_year_id, year_name,
        tahun_takwim_ids, tahun_takwim_info,
        is_override, is_active_global,
        curriculum_id, curriculum_name
    }
    """
    override_sem_id = user.get('view_semester_id')

    # Get semester (either override or active)
    if override_sem_id:
        sem = await db.semesters.find_one({'id': override_sem_id}, {'_id': 0})
        if not sem:
            # Fallback to active if override not found
            sem = await db.semesters.find_one({'is_active': True}, {'_id': 0})
            override_sem_id = None
    else:
        sem = await db.semesters.find_one({'is_active': True}, {'_id': 0})

    if not sem:
        return {
            'semester_id': None, 'semester_name': None, 'semester_code': None,
            'academic_year_id': None, 'year_name': None,
            'tahun_takwim_ids': [],
            'tahun_takwim_info': [],
            'is_override': False, 'is_active_global': True,
            'curriculum_id': None, 'curriculum_name': None,
        }

    # Get academic year
    ay = await db.academic_years.find_one({'id': sem.get('academic_year_id')}, {'_id': 0})

    # Get Tahun Takwim info from SEMESTER (not from Academic Year)
    tahun_takwim_id = sem.get('tahun_takwim_id')
    tahun_takwim_info = []
    if tahun_takwim_id:
        tt = await db.tahun_takwim.find_one({'id': tahun_takwim_id}, {'_id': 0})
        if tt:
            tahun_takwim_info.append({
                'id': tt.get('id'),
                'year': tt.get('year'),
                'name': tt.get('name'),
                'is_active': tt.get('is_active', False),
            })

    # Keep tahun_takwim_ids for backward compatibility
    tahun_takwim_ids = [tahun_takwim_id] if tahun_takwim_id else []

    # Get curriculum if set
    curriculum_name = None
    curriculum_code = None
    if sem.get('curriculum_id'):
        c = await db.curriculums.find_one({'id': sem['curriculum_id']}, {'_id': 0, 'name': 1, 'code': 1})
        if c:
            curriculum_name = c.get('name')
            curriculum_code = c.get('code')

    return {
        'semester_id': sem['id'],
        'semester_name': sem.get('name'),
        'semester_code': sem.get('code'),
        'academic_year_id': ay['id'] if ay else None,
        'year_name': ay.get('name') if ay else None,
        'tahun_takwim_ids': tahun_takwim_ids,
        'tahun_takwim_info': tahun_takwim_info,
        'is_override': bool(override_sem_id),
        'is_active_global': not bool(override_sem_id),
        'curriculum_id': sem.get('curriculum_id'),
        'curriculum_name': curriculum_name,
        'curriculum_code': curriculum_code,
    }


@router.get("/auth/view-context")
async def get_view_context(user: Dict = Depends(get_current_user)):
    """Get current effective view context (semester-based) for the logged-in user."""
    ctx = await _resolve_view_context(user)

    # Include list of all Tahun Takwim (NEW)
    all_tts = await db.tahun_takwim.find({}, {'_id': 0}).sort('year', -1).to_list(50)
    ctx['available_tahun_takwim'] = [
        {'id': tt['id'], 'year': tt.get('year'), 'name': tt.get('name'),
         'is_active': tt.get('is_active', False)}
        for tt in all_tts
    ]

    # Include list of all academic years
    all_ays = await db.academic_years.find({}, {'_id': 0}).sort('name', -1).to_list(50)
    ctx['available_academic_years'] = [
        {'id': a['id'], 'name': a.get('name'), 'is_active': a.get('is_active', False),
         'tahun_takwim_ids': a.get('tahun_takwim_ids', [])}
        for a in all_ays
    ]

    # Include all semesters grouped by academic year
    all_sems = await db.semesters.find({}, {'_id': 0}).sort([('academic_year_id', -1), ('code', 1)]).to_list(200)
    ctx['available_semesters'] = [
        {'id': s['id'], 'name': s.get('name'), 'code': s.get('code'),
         'academic_year_id': s.get('academic_year_id'),
         'tahun_takwim_id': s.get('tahun_takwim_id'),  # Include Tahun Takwim for filtering
         'is_active': s.get('is_active', False)}
        for s in all_sems
    ]

    return ctx


@router.put("/auth/view-context")
async def set_view_context(req: ViewContextRequest, request: Request,
                           user: Dict = Depends(get_current_user)):
    """Set per-user view override (semester). Pass null/empty to clear (back to active)."""
    update = {
        'view_semester_id': req.semester_id or None,
        # Clean up old fields
        'view_academic_year_id': None,
        'view_semester': None,
    }
    await db.users.update_one({'id': user['id']}, {'$set': update})
    await log_audit(user, 'set_view_context', 'user', user['id'],
                    details={'semester_id': req.semester_id}, request=request)
    fresh = await db.users.find_one({'id': user['id']}, {'_id': 0, 'password_hash': 0})
    ctx = await _resolve_view_context(fresh)
    return ctx


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
