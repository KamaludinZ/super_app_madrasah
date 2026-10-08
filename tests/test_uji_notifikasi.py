"""Uji Notifikasi admin: semua jenis terdaftar, penerima hanya admin pemanggil, kanal & rute sesuai."""

import asyncio
import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from routers import uji_notifikasi as api  # noqa: E402


class _Koleksi:
    def __init__(self):
        self.docs = []

    async def insert_one(self, d):
        self.docs.append(d)

    def find(self, *_a, **_k):
        class _C:
            async def to_list(self, _n):
                return [{'expo_push_token': 'ExponentPushToken[abc]'}]
        return _C()

    async def count_documents(self, _q):
        return 1


class _Db(dict):
    def __getattr__(self, n):
        return self.setdefault(n, _Koleksi())

    def __getitem__(self, n):
        return self.setdefault(n, _Koleksi())


@pytest.fixture
def kirim(monkeypatch):
    d = _Db()
    tercatat = {'expo': [], 'web': []}

    async def expo(ids, title, body, data=None, channel_id='default', **_k):
        tercatat['expo'].append((ids, title, data, channel_id))
        return {'sent': 1, 'failed': 0, 'removed': 0}

    async def web(ids, payload):
        tercatat['web'].append((ids, payload))
        return {'sent': 1, 'failed': 0, 'removed': 0}

    async def audit(*_a, **_k):
        return None
    monkeypatch.setattr(api, 'db', d)
    monkeypatch.setattr(api, 'send_expo_push_to_users', expo)
    monkeypatch.setattr(api, 'send_push_to_users', web)
    monkeypatch.setattr(api, 'log_audit', audit)
    return d, tercatat


ADMIN = {'id': 'adm1', 'active_role': 'admin', 'roles': ['admin']}


def test_semua_jenis_ke_admin_sendiri(kirim):
    d, tercatat = kirim
    hasil = asyncio.run(api.kirim_uji(api.UjiRequest(), None, ADMIN))
    assert len(hasil['hasil']) == len(api.JENIS_UJI) == len({j['type'] for j in api.JENIS_UJI})
    assert all(ids == ['adm1'] for ids, *_ in tercatat['expo']) and all(ids == ['adm1'] for ids, _ in tercatat['web'])
    kanal = {data['type']: ch for _ids, _t, data, ch in tercatat['expo']}
    assert kanal['announcement'] == 'pengumuman' and kanal['teaching_reminder'] == 'pengingat-mengajar'
    assert kanal['substitute_assignment'] == 'guru-pengganti' and kanal['tatib_record'] == 'umum'
    assert all(t.startswith('[UJI] ') for _ids, t, _d, _c in tercatat['expo'])
    # pengumuman & pengingat tidak disimpan di lonceng (tidak berasal dari notify_users)
    tersimpan = {doc['type'] for doc in d[api.COLLECTION].docs}
    assert 'announcement' not in tersimpan and 'tatib_record' in tersimpan
    assert all(doc['user_id'] == 'adm1' for doc in d[api.COLLECTION].docs)


def test_jenis_tertentu_dan_tidak_dikenal(kirim):
    _d, tercatat = kirim
    hasil = asyncio.run(api.kirim_uji(api.UjiRequest(jenis=['bk_response']), None, ADMIN))
    assert [h['type'] for h in hasil['hasil']] == ['bk_response'] and len(tercatat['expo']) == 1
    with pytest.raises(HTTPException):
        asyncio.run(api.kirim_uji(api.UjiRequest(jenis=['ngawur']), None, ADMIN))
