"""
Robust Web Push implementation using httpx and py_vapid
Replaces pywebpush due to incompatibility issues with cryptography library

This implementation:
- Uses httpx for async HTTP requests
- Uses py_vapid for VAPID signing
- Uses http_ece for payload encryption
- More reliable and compatible with modern cryptography library
"""

import asyncio
import json
import os
from typing import Dict, Optional
from base64 import urlsafe_b64encode, urlsafe_b64decode
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.backends import default_backend
import httpx
from http_ece import encrypt

from core import logger


def _get_vapid_private_key() -> Optional[str]:
    """Return the VAPID private key PEM, restoring newlines from the .env single-line form."""
    raw = os.environ.get("VAPID_PRIVATE_KEY", "")
    if not raw:
        return None
    return raw.replace("\\n", "\n")


def _get_vapid_public_key() -> str:
    return os.environ.get("VAPID_PUBLIC_KEY", "")


def _vapid_subject() -> str:
    return os.environ.get("VAPID_SUBJECT", "mailto:admin@example.com")


def _create_vapid_headers(subscription_info: Dict) -> Dict[str, str]:
    """
    Create VAPID authorization headers for Web Push using manual JWT signing

    Args:
        subscription_info: Push subscription object with 'endpoint' key

    Returns:
        Dictionary with the RFC 8292 'Authorization' header
    """
    import jwt
    import time
    from urllib.parse import urlparse

    # Load private key
    private_key_pem = _get_vapid_private_key()
    if not private_key_pem:
        raise ValueError("VAPID_PRIVATE_KEY not configured")

    # Load public key
    public_key_b64 = _get_vapid_public_key()
    if not public_key_b64:
        raise ValueError("VAPID_PUBLIC_KEY not configured")

    # Get endpoint origin for audience
    endpoint = subscription_info.get('endpoint', '')
    if not endpoint:
        raise ValueError("Invalid subscription: no endpoint")

    # Parse audience from endpoint (e.g., https://fcm.googleapis.com)
    parsed = urlparse(endpoint)
    audience = f"{parsed.scheme}://{parsed.netloc}"

    # Create JWT claims
    claims = {
        "aud": audience,
        "exp": int(time.time()) + 43200,  # 12 hours from now
        "sub": _vapid_subject()
    }

    # Load EC private key from PEM
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.backends import default_backend

    private_key = serialization.load_pem_private_key(
        private_key_pem.encode('utf-8'),
        password=None,
        backend=default_backend()
    )

    # Sign JWT token
    token = jwt.encode(claims, private_key, algorithm="ES256")

    # Ensure token is a string (PyJWT >= 2.0 returns str by default)
    if isinstance(token, bytes):
        token = token.decode('utf-8')

    # Header VAPID standar (RFC 8292): "vapid t=<jwt>, k=<kunci publik>".
    # Skema lama "WebPush <jwt>" + Crypto-Key tidak diterima Apple Web Push (iPhone/iPad).
    return {
        "Authorization": f"vapid t={token}, k={public_key_b64.rstrip('=')}"
    }


def _encrypt_payload_with_headers(subscription_info: Dict, data: str) -> Dict:
    """
    Encrypt payload and return body + headers

    Args:
        subscription_info: Push subscription with keys.p256dh and keys.auth
        data: String data to encrypt

    Returns:
        Dictionary with 'body' (encrypted bytes) and 'headers' (dict)
    """
    keys = subscription_info.get('keys', {})
    p256dh = keys.get('p256dh')
    auth = keys.get('auth')

    if not p256dh or not auth:
        raise ValueError("Invalid subscription: missing encryption keys")

    # Generate ephemeral EC key pair for encryption
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives import serialization

    private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())

    # Decode base64url encoded keys
    from base64 import urlsafe_b64decode, urlsafe_b64encode

    # Add padding if needed
    def add_padding(data):
        missing_padding = len(data) % 4
        if missing_padding:
            data += '=' * (4 - missing_padding)
        return data

    p256dh_bytes = urlsafe_b64decode(add_padding(p256dh))
    auth_bytes = urlsafe_b64decode(add_padding(auth))

    # Enkripsi aes128gcm (RFC 8291): salt & kunci publik pengirim ikut di header badan pesan,
    # sehingga tidak perlu header Encryption/Crypto-Key. Wajib untuk Apple Web Push.
    encrypted = encrypt(
        data.encode('utf-8') if isinstance(data, str) else data,
        private_key=private_key,
        dh=p256dh_bytes,
        auth_secret=auth_bytes,
        version="aes128gcm"
    )

    headers = {
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
    }

    return {
        "body": encrypted,
        "headers": headers
    }


def _encrypt_payload(subscription_info: Dict, data: str) -> bytes:
    """
    Encrypt payload using http_ece

    Args:
        subscription_info: Push subscription with keys.p256dh and keys.auth
        data: String data to encrypt

    Returns:
        Tuple of (encrypted_body, encryption_headers)
    """
    keys = subscription_info.get('keys', {})
    p256dh = keys.get('p256dh')
    auth = keys.get('auth')

    if not p256dh or not auth:
        raise ValueError("Invalid subscription: missing encryption keys")

    # Generate ephemeral EC key pair for encryption
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.backends import default_backend

    private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())

    # Decode base64url encoded keys
    from base64 import urlsafe_b64decode

    # Add padding if needed
    def add_padding(data):
        missing_padding = len(data) % 4
        if missing_padding:
            data += '=' * (4 - missing_padding)
        return data

    p256dh_bytes = urlsafe_b64decode(add_padding(p256dh))
    auth_bytes = urlsafe_b64decode(add_padding(auth))

    # Encrypt using http_ece (aes128gcm, RFC 8291)
    encrypted = encrypt(
        data.encode('utf-8') if isinstance(data, str) else data,
        private_key=private_key,
        dh=p256dh_bytes,
        auth_secret=auth_bytes,
        version="aes128gcm"
    )

    return encrypted


async def send_web_push(subscription_info: Dict, payload: Dict, ttl: int = 86400) -> Dict:
    """
    Send a Web Push notification

    Args:
        subscription_info: Push subscription object with endpoint and keys
        payload: Notification payload (will be JSON encoded)
        ttl: Time-to-live in seconds (default 24 hours)

    Returns:
        Dictionary with 'ok' (bool), 'gone' (bool), 'error' (str or None)
    """
    try:
        endpoint = subscription_info.get('endpoint')
        if not endpoint:
            return {"ok": False, "gone": False, "error": "No endpoint"}

        # Prepare data
        data = json.dumps(payload)

        # Encrypt payload and get encryption metadata
        try:
            encrypted_result = _encrypt_payload_with_headers(subscription_info, data)
        except Exception as e:
            return {"ok": False, "gone": False, "error": f"Encryption failed: {e}"}

        # Create VAPID headers
        try:
            vapid_headers = _create_vapid_headers(subscription_info)
        except Exception as e:
            return {"ok": False, "gone": False, "error": f"VAPID signing failed: {e}"}

        headers = {
            "TTL": str(ttl),
            "Urgency": "high",
            **encrypted_result['headers'],
            **vapid_headers
        }

        # Debug: log headers
        logger.debug(f"Sending push to: {endpoint[:60]}...")
        logger.debug(f"Headers: {headers}")

        # Send request
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                endpoint,
                headers=headers,
                content=encrypted_result['body']
            )

        # Check response
        if response.status_code == 201:
            return {"ok": True, "gone": False, "error": None}
        elif response.status_code in (404, 410):
            # Subscription is gone (expired or unsubscribed)
            return {"ok": False, "gone": True, "error": f"HTTP {response.status_code}"}
        else:
            return {"ok": False, "gone": False, "error": f"HTTP {response.status_code}: {response.text[:100]}"}

    except Exception as e:
        logger.error(f"Web Push send error: {e}", exc_info=True)
        return {"ok": False, "gone": False, "error": str(e)}


# Test function
async def test_send():
    """Test sending a push notification"""

    # Test subscription (replace with real subscription)
    test_subscription = {
        "endpoint": "https://fcm.googleapis.com/fcm/send/test",
        "keys": {
            "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM=",
            "auth": "tBHItJI5svbpez7KI4CCXg=="
        }
    }

    payload = {
        "title": "Test Notification",
        "body": "This is a test",
        "url": "/dashboard"
    }

    result = await send_web_push(test_subscription, payload)
    print(f"Test result: {result}")
    return result


if __name__ == "__main__":
    asyncio.run(test_send())
