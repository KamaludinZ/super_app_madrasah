"""Web Push (PWA, termasuk iPhone): enkripsi aes128gcm (RFC 8291) & header VAPID (RFC 8292)."""

import json
import os
import sys
from base64 import urlsafe_b64encode

import http_ece
import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import web_push_robust  # noqa: E402


def _b64(data: bytes) -> str:
    return urlsafe_b64encode(data).decode().rstrip('=')


def _point(key) -> bytes:
    return key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)


class _Resp:
    status_code = 201
    text = ''


class _Client:
    captured = {}

    def __init__(self, *a, **k):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def post(self, url, headers=None, content=None):
        _Client.captured = {'url': url, 'headers': headers, 'body': content}
        return _Resp()


async def test_web_push_aes128gcm_decryptable_by_browser_and_vapid_valid(monkeypatch):
    vapid = ec.generate_private_key(ec.SECP256R1())
    vapid_pem = vapid.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                    serialization.NoEncryption()).decode()
    monkeypatch.setenv('VAPID_PRIVATE_KEY', vapid_pem.replace('\n', '\\n'))
    monkeypatch.setenv('VAPID_PUBLIC_KEY', _b64(_point(vapid)))
    monkeypatch.setenv('VAPID_SUBJECT', 'mailto:admin@mtsn2kotamalang.sch.id')
    monkeypatch.setattr(web_push_robust.httpx, 'AsyncClient', _Client)

    # "Browser" penerima (mis. Safari iPhone) membuat kunci langganan.
    receiver = ec.generate_private_key(ec.SECP256R1())
    auth_secret = os.urandom(16)
    endpoint = 'https://web.push.apple.com/QGhpZGRlbi10b2tlbg'
    sub = {'endpoint': endpoint, 'keys': {'p256dh': _b64(_point(receiver)), 'auth': _b64(auth_secret)}}

    payload = {'title': '📢 Pengumuman', 'body': 'Rapat guru pukul 13.00'}
    res = await web_push_robust.send_web_push(sub, payload)
    assert res == {'ok': True, 'gone': False, 'error': None}

    sent = _Client.captured
    h = sent['headers']
    assert h['Content-Encoding'] == 'aes128gcm'
    assert 'Crypto-Key' not in h and 'Encryption' not in h
    assert h['TTL'] and h['Urgency'] == 'high'

    # Browser bisa mendekripsi isi pesan.
    plain = http_ece.decrypt(sent['body'], private_key=receiver, auth_secret=auth_secret, version='aes128gcm')
    assert json.loads(plain) == payload

    # Header VAPID: "vapid t=<jwt>, k=<kunci publik>" dan JWT sah untuk origin endpoint.
    scheme, params = h['Authorization'].split(' ', 1)
    assert scheme == 'vapid'
    parts = dict(p.strip().split('=', 1) for p in params.split(','))
    assert parts['k'] == _b64(_point(vapid))
    claims = jwt.decode(parts['t'], vapid.public_key(), algorithms=['ES256'], audience='https://web.push.apple.com')
    assert claims['sub'] == 'mailto:admin@mtsn2kotamalang.sch.id'
