"""Agenda Saya (/my-agenda, layar Agenda Saya aplikasi): hanya agenda milik pengguna login, termasuk untuk
kepala sekolah / admin / unit pelayanan yang di halaman pantau boleh melihat agenda semua pegawai."""
import asyncio
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
sys.path.insert(0, os.path.dirname(__file__))

from pkg_palsu import Db  # noqa: E402
from routers import events  # noqa: E402


def _agenda(i, user_id, tanggal='2026-11-12'):
    return {'id': i, 'user_id': user_id, 'event_name': f'Agenda {i}', 'date': tanggal, 'end_date': tanggal,
            'start_time': '08:00', 'end_time': '10:00', 'is_active': True}


@pytest.fixture
def db(monkeypatch):
    d = Db()
    d.users.docs.extend([
        {'id': 'ks', 'full_name': 'Kepala Sekolah', 'roles': ['kepala_sekolah', 'guru']},
        {'id': 'g1', 'full_name': 'Guru Satu', 'roles': ['guru']},
        {'id': 't1', 'full_name': 'Tendik Satu', 'roles': ['tenaga_kependidikan']},
        {'id': 'ad', 'full_name': 'Admin', 'roles': ['admin']},
    ])
    d.staff_events.docs.extend([_agenda('a-ks', 'ks'), _agenda('a-g1', 'g1'), _agenda('a-t1', 't1', '2026-11-13')])
    monkeypatch.setattr(events, 'db', d)
    return d


def _user(uid, peran):
    roles = {'ks': ['kepala_sekolah', 'guru'], 'g1': ['guru'], 't1': ['tenaga_kependidikan'], 'ad': ['admin']}[uid]
    return {'id': uid, 'active_role': peran, 'roles': roles}


def _daftar(user, **kw):
    isi = {'year': None, 'month': None, 'date': None, 'user_id': None, 'is_active': None, 'is_public': None}
    return [i['id'] for i in asyncio.run(events.list_staff_events(**{**isi, **kw}, user=user))]


def test_agenda_saya_kepala_sekolah_hanya_milik_sendiri(db):
    assert _daftar(_user('ks', 'kepala_sekolah'), milik_saya=True) == ['a-ks']
    # Halaman pantau Agenda Guru/Tendik (tanpa milik_saya) tetap melihat semua agenda.
    assert set(_daftar(_user('ks', 'kepala_sekolah'))) == {'a-ks', 'a-g1', 'a-t1'}


@pytest.mark.parametrize('uid, peran, milik', [('ad', 'admin', 'a-ad-tidak-ada'), ('g1', 'guru', 'a-g1'),
                                               ('t1', 'tenaga_kependidikan', 'a-t1')])
def test_agenda_saya_semua_peran_hanya_milik_sendiri(db, uid, peran, milik):
    hasil = _daftar(_user(uid, peran), milik_saya=True)
    assert hasil == ([] if uid == 'ad' else [milik])


def test_milik_saya_mengalahkan_user_id_dan_saringan_bulan_tetap_berlaku(db):
    ks = _user('ks', 'kepala_sekolah')
    assert _daftar(ks, milik_saya=True, user_id='g1') == ['a-ks']  # user_id orang lain diabaikan
    assert _daftar(ks, milik_saya=True, date='2026-11-13') == []
    assert _daftar(ks, user_id='g1') == ['a-g1']  # pantau per pegawai tetap bisa


def test_guru_tanpa_milik_saya_tetap_hanya_miliknya(db):
    assert _daftar(_user('g1', 'guru')) == ['a-g1']
    assert _daftar(_user('g1', 'guru'), user_id='t1') == ['a-g1']


def test_statistik_agenda_saya_milik_sendiri(db):
    def total(user, milik_saya=False):
        hasil = asyncio.run(events.get_staff_events_duration_stats(user_id=None, milik_saya=milik_saya, user=user))
        return hasil['total_events']
    assert total(_user('ks', 'kepala_sekolah'), milik_saya=True) == 1
    assert total(_user('ad', 'admin')) == 3  # admin tanpa milik_saya: semua (perilaku lama)
    assert total(_user('ad', 'admin'), milik_saya=True) == 0
