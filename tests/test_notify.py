"""Notifikasi pribadi per peran (notify.py) & penerima peristiwa — tanpa MongoDB (DB tiruan)."""

import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import notify  # noqa: E402
from routers import kelas_digital, mobile, push, tatib  # noqa: E402


# ---------------------------------------------------------------------------
# DB tiruan minimal (find/find_one/insert_many/count_documents dengan $in & $ne)
# ---------------------------------------------------------------------------
def _match(doc, query):
    for k, v in query.items():
        val = doc.get(k)
        if isinstance(v, dict):
            if '$in' in v:
                if isinstance(val, list):
                    if not set(val) & set(v['$in']):
                        return False
                elif val not in v['$in']:
                    return False
            if '$ne' in v and val == v['$ne']:
                return False
        elif isinstance(val, list):
            if v not in val:
                return False
        elif val != v:
            return False
    return True


class Cursor:
    def __init__(self, docs):
        self.docs = docs

    def sort(self, *a, **k):
        return self

    async def to_list(self, n=None):
        return list(self.docs if n is None else self.docs[:n])


class Coll:
    def __init__(self, docs=None):
        self.docs = list(docs or [])

    def find(self, query=None, proj=None):
        return Cursor([d for d in self.docs if _match(d, query or {})])

    async def find_one(self, query=None, proj=None):
        return next((d for d in self.docs if _match(d, query or {})), None)

    async def insert_many(self, docs, ordered=True):
        self.docs.extend(docs)

    async def count_documents(self, query):
        return len([d for d in self.docs if _match(d, query)])


class FakeDB:
    def __init__(self, **colls):
        self._c = {k: Coll(v) for k, v in colls.items()}

    def __getitem__(self, name):
        return self._c.setdefault(name, Coll())

    def __getattr__(self, name):
        if name.startswith('_'):
            raise AttributeError(name)
        return self[name]


@pytest.fixture
def fake(monkeypatch):
    sent = {'expo': [], 'web': []}

    async def expo(ids, title, body, data=None, channel_id='pengumuman'):
        sent['expo'].append((list(ids), title, data, channel_id))

    async def web(ids, payload):
        sent['web'].append((list(ids), payload))

    monkeypatch.setattr(mobile, 'send_expo_push_to_users', expo)
    monkeypatch.setattr(push, 'send_push_to_users', web)

    def install(**colls):
        db = FakeDB(**colls)
        for mod in (notify, kelas_digital, tatib):
            monkeypatch.setattr(mod, 'db', db)
        return db
    return install, sent


def run(coro):
    return asyncio.run(coro)


# ---------------------------------------------------------------------------
def test_notify_users_dedup_exclude_store_and_push(fake):
    install, sent = fake
    db = install()
    n = run(notify.notify_users(['a', 'b', 'a', None, 'c'], 'Judul', 'Isi', type='x', route='/siswa/tugas',
                                data={'k': 1}, exclude=['c']))
    assert n == 2
    stored = db.user_notifications.docs
    assert [d['user_id'] for d in stored] == ['a', 'b']
    assert all(d['is_read'] is False and d['route'] == '/siswa/tugas' and d['expire_at'] for d in stored)
    ids, title, data, channel = sent['expo'][0]
    assert ids == ['a', 'b'] and data['route'] == '/siswa/tugas' and data['type'] == 'x' and channel == 'umum'
    # Service worker web membuka data.url saat notifikasi diketuk.
    assert sent['web'][0][1]['data']['url'] == '/siswa/tugas'


def test_notify_users_no_recipients_does_nothing(fake):
    install, sent = fake
    db = install()
    assert run(notify.notify_users([None], 'x', 'y', type='t')) == 0
    assert db.user_notifications.docs == [] and sent['expo'] == []


def test_notify_roles_only_active_users(fake):
    install, sent = fake
    install(users=[
        {'id': 'p1', 'roles': ['guru_piket']},
        {'id': 'p2', 'roles': ['guru', 'guru_piket'], 'is_active': False},
        {'id': 'g1', 'roles': ['guru']},
    ])
    run(notify.notify_roles(['guru_piket'], 'Tugas titipan baru', 'isi', type='teacher_task_new'))
    assert sent['expo'][0][0] == ['p1']


def test_homeroom_by_class_and_fallback(fake):
    install, _ = fake
    install(
        classes=[{'id': 'c1', 'name': '7A', 'homeroom_teacher_id': 'w1'}, {'id': 'c2', 'name': '7B'}],
        users=[{'id': 'w2', 'roles': ['wali_kelas'], 'homeroom_class_id': 'c2'}],
    )
    assert run(notify.homeroom_teacher_of('c1')) == 'w1'
    assert run(notify.homeroom_teacher_of(None, '7A')) == 'w1'
    assert run(notify.homeroom_teacher_of('c2')) == 'w2'
    assert run(notify.homeroom_teacher_of(None, None)) is None


def test_class_content_recipients_kelas_and_siswa_targets(fake):
    install, _ = fake
    install(users=[
        {'id': 's1', 'roles': ['siswa'], 'student_class_id': 'c1'},
        {'id': 's2', 'roles': ['siswa'], 'student_class_id': 'c1'},
        {'id': 's3', 'roles': ['siswa'], 'student_class_id': 'c2'},
        {'id': 'k1', 'roles': ['kelas'], 'class_id': 'c1'},
    ])
    assert sorted(run(kelas_digital._content_recipients('kelas', ['c1'], []))) == ['k1', 's1', 's2']
    siswa = run(kelas_digital._content_recipients('siswa', [], [
        {'class_id': 'c2', 'student_ids': 'all'}, {'class_id': 'c1', 'student_ids': ['s2']},
    ]))
    assert sorted(siswa) == ['s2', 's3']
    assert run(kelas_digital._content_recipients(['kelas', 'siswa'], [], [])) == []


def test_tatib_pelanggaran_to_wali_and_bk_prestasi_only_wali(fake):
    install, sent = fake
    install(
        classes=[{'id': 'c1', 'name': '7A', 'homeroom_teacher_id': 'w1'}],
        users=[{'id': 'bk1', 'roles': ['guru_bk']}, {'id': 'w1', 'roles': ['wali_kelas', 'guru_bk']}],
    )
    doc = {'id': 'p1', 'siswa_id': 's1', 'siswa_nama': 'Ali', 'siswa_kelas': '7A', 'tatib_nama': 'Terlambat',
           'petugas_id': 'tt1', 'petugas_nama': 'Bu Tatib'}
    run(tatib._notify_tatib(doc, {'class_id': 'c1'}, -5))
    assert sent['expo'][0][0] == ['w1']
    assert sent['expo'][1][0] == ['bk1']  # wali (juga guru BK) tidak dikirimi dua kali
    assert sent['expo'][0][1].startswith('Pelanggaran tata tertib: Ali')

    sent['expo'].clear()
    run(tatib._notify_tatib(doc, {'class_id': 'c1'}, 10))
    assert len(sent['expo']) == 1 and sent['expo'][0][0] == ['w1']
    assert sent['expo'][0][1].startswith('Prestasi tata tertib')
