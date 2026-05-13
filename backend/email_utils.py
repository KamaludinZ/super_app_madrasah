"""
Email utilities for SMTP password reset and notifications.
Uses smtplib for sync (called from async via run_in_executor pattern if needed).
"""
import os
import smtplib
import ssl
from email.message import EmailMessage
from typing import Dict, Any, Optional
import secrets
import time

# In-memory token store: {token: {email, expires_at, used}}
_reset_tokens: Dict[str, Dict[str, Any]] = {}
RESET_TOKEN_TTL_SECONDS = 30 * 60  # 30 minutes


def _cleanup_tokens():
    now = time.time()
    expired = [k for k, v in _reset_tokens.items() if v.get('expires_at', 0) < now]
    for k in expired:
        _reset_tokens.pop(k, None)


def create_reset_token(user_id: str, email: str) -> str:
    _cleanup_tokens()
    token = secrets.token_urlsafe(32)
    _reset_tokens[token] = {
        'user_id': user_id,
        'email': email,
        'expires_at': time.time() + RESET_TOKEN_TTL_SECONDS,
        'used': False,
    }
    return token


def validate_reset_token(token: str) -> Optional[Dict[str, Any]]:
    item = _reset_tokens.get(token)
    if not item:
        return None
    if item.get('used'):
        return None
    if item.get('expires_at', 0) < time.time():
        _reset_tokens.pop(token, None)
        return None
    return item


def consume_reset_token(token: str) -> Optional[Dict[str, Any]]:
    item = validate_reset_token(token)
    if not item:
        return None
    item['used'] = True
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
