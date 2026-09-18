"""Generic third-party WhatsApp gateway client (Fonnte/Wablas-style APIs).

Most Indonesian WhatsApp gateways for schools accept a simple POST with an
API-key header/field, a target phone number, and a message body, returning
JSON. This client covers that common shape; the exact field names are
configurable so it can be adapted per provider without code changes.
"""
from typing import Any, Dict
import httpx

TIMEOUT = httpx.Timeout(20.0, connect=10.0)


class WhatsAppError(Exception):
    pass


async def send_message(settings: Dict[str, Any], target_phone: str, message: str) -> Dict[str, Any]:
    """Send a WhatsApp message via the configured third-party gateway.

    Config expected under settings: whatsapp_enabled, whatsapp_base_url,
    whatsapp_api_key, whatsapp_sender_id (optional, gateway-dependent).
    """
    if not settings.get('whatsapp_enabled'):
        raise WhatsAppError("Integrasi WhatsApp belum diaktifkan.")

    base_url = (settings.get('whatsapp_base_url') or '').strip()
    api_key = settings.get('whatsapp_api_key')
    if not base_url:
        raise WhatsAppError("Base URL WhatsApp gateway belum diatur.")
    if not api_key:
        raise WhatsAppError("API key WhatsApp gateway belum diatur.")

    payload = {
        'target': target_phone,
        'message': message,
    }
    if settings.get('whatsapp_sender_id'):
        payload['sender'] = settings['whatsapp_sender_id']

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        try:
            r = await client.post(
                base_url,
                headers={'Authorization': api_key},
                data=payload,
            )
            r.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise WhatsAppError(f"Gateway WhatsApp error: {e.response.status_code} {e.response.text[:300]}")
        except httpx.HTTPError as e:
            raise WhatsAppError(f"Gagal menghubungi gateway WhatsApp: {e}")

    try:
        return r.json()
    except ValueError:
        return {'raw': r.text}
