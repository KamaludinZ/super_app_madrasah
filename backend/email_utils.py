"""
Email utilities for SMTP password reset and notifications.
Uses smtplib for sync (called from async via run_in_executor pattern if needed).
"""
import hashlib
import smtplib
import ssl
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Dict, Any, Optional
import secrets

from core import db, logger

# Token reset disimpan di MongoDB (bukan dict di memori) agar tetap valid walau
# server berjalan dengan beberapa worker atau di-restart. Yang disimpan hanya
# hash SHA-256 token; token aslinya cuma ada di link email.
RESET_TOKEN_TTL_SECONDS = 30 * 60  # 30 minutes
_indexes_ready = False


async def _ensure_indexes():
    global _indexes_ready
    if _indexes_ready:
        return
    try:
        await db.password_reset_tokens.create_index('token_hash', unique=True)
        await db.password_reset_tokens.create_index('expires_at', expireAfterSeconds=0)
        _indexes_ready = True
    except Exception as e:
        logger.warning(f"[reset-token] Gagal membuat index: {e}")


def _hash_token(token: str) -> str:
    return hashlib.sha256((token or '').encode('utf-8')).hexdigest()


def _is_expired(item: Dict[str, Any]) -> bool:
    expires_at = item.get('expires_at')
    if not isinstance(expires_at, datetime):
        return True
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at < datetime.now(timezone.utc)


async def create_reset_token(user_id: str, email: str) -> str:
    await _ensure_indexes()
    token = secrets.token_urlsafe(32)
    # Satu user hanya punya satu link reset aktif
    await db.password_reset_tokens.delete_many({'user_id': user_id})
    await db.password_reset_tokens.insert_one({
        'token_hash': _hash_token(token),
        'user_id': user_id,
        'email': email,
        'expires_at': datetime.now(timezone.utc) + timedelta(seconds=RESET_TOKEN_TTL_SECONDS),
    })
    return token


async def validate_reset_token(token: str) -> Optional[Dict[str, Any]]:
    item = await db.password_reset_tokens.find_one({'token_hash': _hash_token(token)}, {'_id': 0})
    if not item or _is_expired(item):
        return None
    return item


async def consume_reset_token(token: str) -> Optional[Dict[str, Any]]:
    """Sekali pakai: dokumen langsung dihapus secara atomik."""
    item = await db.password_reset_tokens.find_one_and_delete({'token_hash': _hash_token(token)})
    if not item or _is_expired(item):
        return None
    return item


def send_email(smtp_config: Dict[str, Any], to_email: str, subject: str, body_text: str,
               body_html: Optional[str] = None) -> Dict[str, Any]:
    """Send email via SMTP. Returns {success, error}."""
    if not smtp_config or not smtp_config.get('smtp_host'):
        return {'success': False, 'error': 'SMTP belum dikonfigurasi. Atur di Admin > Pengaturan > SMTP.'}

    host = smtp_config['smtp_host']
    port = int(smtp_config.get('smtp_port', 587))
    username = smtp_config.get('smtp_user', '')
    password = smtp_config.get('smtp_password', '')
    use_tls = bool(smtp_config.get('smtp_use_tls', True))
    use_ssl = bool(smtp_config.get('smtp_use_ssl', False))
    from_email = smtp_config.get('smtp_from_email', username)
    from_name = smtp_config.get('smtp_from_name', 'Super Apps MATSANDATAMA')

    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = f"{from_name} <{from_email}>" if from_name else from_email
    msg['To'] = to_email
    msg.set_content(body_text)
    if body_html:
        msg.add_alternative(body_html, subtype='html')

    try:
        if use_ssl:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(host, port, context=context, timeout=15) as server:
                if username:
                    server.login(username, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=15) as server:
                if use_tls:
                    server.starttls(context=ssl.create_default_context())
                if username:
                    server.login(username, password)
                server.send_message(msg)
        return {'success': True}
    except smtplib.SMTPAuthenticationError as e:
        return {'success': False, 'error': f'Otentikasi SMTP gagal: {e}'}
    except smtplib.SMTPException as e:
        return {'success': False, 'error': f'SMTP error: {e}'}
    except Exception as e:
        return {'success': False, 'error': f'Gagal mengirim email: {e}'}


def build_reset_email(reset_link: str, username: str, app_name: str, school_name: str) -> Dict[str, str]:
    text = f"""Assalamu'alaikum {username},

Kami menerima permintaan untuk mengatur ulang password akun Anda di {app_name}.

Klik tautan berikut untuk mereset password (berlaku 30 menit):
{reset_link}

Jika Anda tidak meminta perubahan ini, abaikan email ini.

Wassalamu'alaikum,
{school_name}
"""
    html = f"""<!DOCTYPE html>
<html><body style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #FBF7EE; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <div style="background: linear-gradient(135deg, #006837 0%, #0B7A3B 100%); padding: 24px; color: white;">
      <h1 style="margin: 0; font-size: 20px;">{app_name}</h1>
      <p style="margin: 4px 0 0 0; opacity: 0.85; font-size: 13px;">{school_name}</p>
    </div>
    <div style="padding: 24px; color: #0E1A14;">
      <p>Assalamu'alaikum <strong>{username}</strong>,</p>
      <p>Kami menerima permintaan untuk mengatur ulang password akun Anda.</p>
      <p>Klik tombol di bawah untuk mereset password Anda:</p>
      <div style="text-align: center; margin: 24px 0;">
        <a href="{reset_link}" style="display: inline-block; background: #006837; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">Reset Password</a>
      </div>
      <p style="font-size: 12px; color: #666;">Atau salin URL berikut ke browser:<br><a href="{reset_link}" style="color: #006837; word-break: break-all;">{reset_link}</a></p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="font-size: 12px; color: #888;">Tautan ini berlaku <strong>30 menit</strong>. Jika Anda tidak meminta reset password, abaikan email ini.</p>
    </div>
    <div style="background: #FBF7EE; padding: 16px; text-align: center; font-size: 11px; color: #888;">
      ✦ Sistem Anti-Manipulasi ✦ {school_name}
    </div>
  </div>
</body></html>"""
    return {'text': text, 'html': html}
