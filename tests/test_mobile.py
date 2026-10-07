"""Aplikasi mobile: izin offline, waktu isi jurnal offline, QR, dan Expo Push (tanpa MongoDB)."""

import os
import sys
import time
from datetime import date, datetime, timedelta

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from journal_core import WIB_TZ, decrypt_qr_payload, decrypt_qr_payload_raw, encrypt_qr_payload  # noqa: E402
from routers import mobile  # noqa: E402

CLAIMS = {'uid': 'u1', 'sid': 's1', 'date': '2026-10-07', 'rid': 'r1', 'st': '08:30', 'et': '09:40',
          'is_sub': False, 'aid': None}
NOW = datetime(2026, 10, 7, 16, 0, tzinfo=WIB_TZ)  # sinkron sore hari


def wib(h, m, d=7):
    return datetime(2026, 10, d, h, m, tzinfo=WIB_TZ)


# ---------- izin offline ----------
def test_permit_roundtrip_and_owner_check():
    token = mobile.sign_permit({**CLAIMS, 'exp': int(time.time()) + 3600})
    assert mobile.verify_permit(token, 'u1')['sid'] == 's1'
    with pytest.raises(HTTPException) as exc:
        mobile.verify_permit(token, 'u2')
    assert exc.value.detail['error_type'] == 'invalid_permit'


def test_expired_permit_is_deadline_passed():
    token = mobile.sign_permit({**CLAIMS, 'exp': int(time.time()) - 10})
    with pytest.raises(HTTPException) as exc:
        mobile.verify_permit(token, 'u1')
    assert exc.value.detail['error_type'] == 'deadline_passed'


def test_tampered_permit_rejected():
    token = mobile.sign_permit({**CLAIMS, 'exp': int(time.time()) + 3600})
    head, body, sig = token.split('.')
    with pytest.raises(HTTPException) as exc:
        mobile.verify_permit(f"{head}.{body}.{sig[:-2]}AA", 'u1')
    assert exc.value.detail['error_type'] == 'invalid_permit'


def test_permit_deadline_is_next_day_plus_grace():
    assert mobile.permit_deadline(date(2026, 10, 7), '09:40') == wib(10, 10, d=8)


# ---------- waktu isi jurnal ----------
def test_capture_inside_slot_accepted_even_when_synced_later():
    r = mobile.evaluate_capture_time(CLAIMS, wib(8, 50), NOW, 15)
    assert r['ok'] and r['trusted_time'] == wib(8, 50) and r['time_source'] == 'monotonic_estimate'
    assert not r['needs_verification']


def test_capture_within_grace_accepted_outside_rejected():
    assert mobile.evaluate_capture_time(CLAIMS, wib(8, 16), NOW, 15)['ok']
    r = mobile.evaluate_capture_time(CLAIMS, wib(12, 0), NOW, 15)
    assert not r['ok'] and r['error_type'] == 'outside_schedule'


def test_future_capture_rejected():
    r = mobile.evaluate_capture_time(CLAIMS, NOW + timedelta(minutes=30), NOW, 15)
    assert not r['ok'] and r['error_type'] == 'clock_mismatch'


def test_clock_unverified_flags_for_verification():
    r = mobile.evaluate_capture_time(CLAIMS, wib(8, 50), NOW, 15, clock_unverified=True)
    assert r['ok'] and r['needs_verification']


def test_dynamic_qr_issued_at_is_trusted_time():
    r = mobile.evaluate_capture_time(CLAIMS, wib(8, 51), NOW, 15, clock_unverified=True,
                                     qr_issued_at=wib(8, 50), qr_ttl_seconds=60)
    assert r['ok'] and r['trusted_time'] == wib(8, 50) and r['time_source'] == 'dynamic_qr'
    assert not r['needs_verification']


def test_dynamic_qr_far_from_estimate_rejected():
    # Jam perangkat dimajukan/mundurkan: estimasi jauh dari waktu terbit QR.
    r = mobile.evaluate_capture_time(CLAIMS, wib(9, 30), NOW, 15, qr_issued_at=wib(8, 50), qr_ttl_seconds=60)
    assert not r['ok'] and r['error_type'] == 'clock_mismatch'


# ---------- QR ----------
def test_raw_decrypt_ignores_ttl_but_normal_decrypt_expires(monkeypatch):
    token = encrypt_qr_payload('r1', ttl_seconds=60)
    import journal_core
    later = datetime.now(WIB_TZ) + timedelta(hours=3)
    monkeypatch.setattr(journal_core, 'now_wib', lambda: later)
    assert decrypt_qr_payload(token) is None
    assert decrypt_qr_payload_raw(token)['room_id'] == 'r1'
    assert decrypt_qr_payload_raw('bukan-qr') is None


# ---------- Expo Push ----------
class _Cursor:
    def __init__(self, docs):
        self.docs = docs

    async def to_list(self, _n):
        return self.docs


class _Devices:
    def __init__(self, docs):
        self.docs = docs
        self.last_query = None
        self.deleted = []

    def find(self, query, _proj=None):
        self.last_query = query
        return _Cursor([d for d in self.docs if d['user_id'] in query['user_id']['$in']])

    async def delete_many(self, query):
        self.deleted.extend(query['expo_push_token']['$in'])

        class R:
            deleted_count = len(query['expo_push_token']['$in'])
        return R()


class _Db(dict):
    pass


async def test_expo_push_batches_and_removes_dead_tokens(monkeypatch):
    devices = _Devices([{'user_id': 'u1', 'expo_push_token': f'ExponentPushToken[t{i}]'} for i in range(150)]
                       + [{'user_id': 'u1', 'expo_push_token': 'bukan-token'}])
    fake_db = _Db({mobile.DEVICES: devices})
    monkeypatch.setattr(mobile, 'db', fake_db)
    batches = []

    async def fake_post(messages):
        batches.append(len(messages))
        return [{'status': 'error', 'details': {'error': 'DeviceNotRegistered'}} if m['to'].endswith('[t0]')
                else {'status': 'ok'} for m in messages]

    monkeypatch.setattr(mobile, '_post_expo', fake_post)
    res = await mobile.send_expo_push_to_users(['u1'], 'Judul', 'Isi', {'type': 'x'}, 'pengumuman',
                                               skip_local_reminder_devices=True)
    assert batches == [100, 50]
    assert res == {'sent': 149, 'failed': 1, 'removed': 1}
    assert devices.deleted == ['ExponentPushToken[t0]']
    assert devices.last_query['local_reminders'] == {'$ne': True}


async def test_expo_push_disabled_by_env(monkeypatch):
    monkeypatch.setenv('EXPO_PUSH_ENABLED', '0')
    res = await mobile.send_expo_push_to_users(['u1'], 'a', 'b')
    assert res.get('skipped') is True


def test_expo_message_shape():
    [msg] = mobile.build_expo_messages(['ExponentPushToken[x]'], 'T', 'B', {'k': 1}, 'pengingat-mengajar')
    assert msg['channelId'] == 'pengingat-mengajar' and msg['priority'] == 'high' and msg['sound'] == 'default'
