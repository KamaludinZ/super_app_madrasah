"""Otorisasi endpoint penugasan Guru Pengganti (tanpa MongoDB: db & log di-patch)."""

import os
import sys

import httpx
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import server  # noqa: E402
from core import get_current_user  # noqa: E402
from routers import guru_pengganti  # noqa: E402

BODY = {'schedule_id': 'sch-x', 'dates': ['2099-01-05'], 'substitute_teacher_id': 'u-sub'}


class _FakeCollection:
    async def find_one(self, *args, **kwargs):
        return None


class _FakeDb:
    schedules = _FakeCollection()


@pytest.fixture
def security_events(monkeypatch):
    events = []

    async def fake_log_security(event_type, username=None, details=None, request=None):
        events.append((event_type, username, details))

    monkeypatch.setattr(guru_pengganti, 'log_security', fake_log_security)
    monkeypatch.setattr(guru_pengganti, 'db', _FakeDb())
    yield events
    server.app.dependency_overrides.pop(get_current_user, None)


async def _post_as(active_role, roles=None):
    server.app.dependency_overrides[get_current_user] = lambda: {
        'id': 'u-1', 'username': 'tester', 'active_role': active_role, 'roles': roles or [active_role],
    }
    transport = httpx.ASGITransport(app=server.app)
    async with httpx.AsyncClient(transport=transport, base_url='http://test') as client:
        return await client.post('/api/guru-pengganti/assignments', json=BODY)


@pytest.mark.parametrize('role', ['guru', 'guru_ipa', 'guru_agama', 'wali_kelas', 'guru_bk', 'kepala_sekolah', 'siswa'])
async def test_unauthorized_roles_are_rejected_and_logged(security_events, role):
    res = await _post_as(role)
    assert res.status_code == 403
    assert 'Guru Piket' in res.json()['detail']
    assert security_events and security_events[-1][0] == 'guru_pengganti_forbidden'
    assert security_events[-1][2]['active_role'] == role


@pytest.mark.parametrize('role', ['admin', 'waka_kurikulum', 'guru_piket'])
async def test_authorized_roles_pass_authorization(security_events, role):
    # Lolos otorisasi → sampai ke pencarian jadwal (fake db: tidak ditemukan).
    res = await _post_as(role)
    assert res.status_code == 404
    assert security_events == []


async def test_admin_account_with_other_active_role_is_allowed(security_events):
    res = await _post_as('guru', roles=['guru', 'admin'])
    assert res.status_code == 404


async def _config_as(active_role, roles=None):
    server.app.dependency_overrides[get_current_user] = lambda: {
        'id': 'u-1', 'username': 'tester', 'active_role': active_role, 'roles': roles or [active_role],
    }
    transport = httpx.ASGITransport(app=server.app)
    async with httpx.AsyncClient(transport=transport, base_url='http://test') as client:
        return (await client.get('/api/guru-pengganti/config')).json()


@pytest.mark.parametrize('role,expected', [
    ('admin', True), ('waka_kurikulum', True), ('guru_piket', True),
    ('guru', False), ('guru_ipa', False), ('wali_kelas', False), ('siswa', False),
])
async def test_config_can_manage_drives_menu_visibility(security_events, role, expected):
    data = await _config_as(role)
    assert data['can_manage'] is expected
    assert data['allowed_roles'] == ['admin', 'waka_kurikulum', 'guru_piket']
