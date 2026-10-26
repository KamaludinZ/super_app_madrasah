"""Monitoring publik: status jurnal dicek pada tanggal yang dipantau, bukan sembarang jurnal jadwal itu (tanpa MongoDB)."""

import asyncio
import os
import sys
from datetime import date, datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from journal_core import WIB_TZ  # noqa: E402
from routers import public  # noqa: E402
from tests.pkg_palsu import Db, Koleksi  # noqa: E402

SENIN_10 = datetime(2026, 10, 26, 10, 0, tzinfo=WIB_TZ)  # Senin pukul 10.00


def test_tanggal_hari_pantau():
    assert public.tanggal_hari_pantau('senin', SENIN_10) == date(2026, 10, 26)
    assert public.tanggal_hari_pantau('Jumat', SENIN_10) == date(2026, 10, 23)  # Jumat lalu
    assert public.tanggal_hari_pantau('selasa', SENIN_10) == date(2026, 10, 20)  # Selasa lalu, bukan besok
    assert public.tanggal_hari_pantau('tidak-dikenal', SENIN_10) == date(2026, 10, 26)


def _jadwal(i, mulai, selesai):
    return {'id': f's{i}', 'academic_year_id': 'ay1', 'day': 'senin', 'start_time': mulai, 'end_time': selesai,
            'class_id': 'k1', 'subject_id': f'm{i}', 'room_id': 'r1', 'teacher_id': 'g1', 'slot_indexes': [i]}  # mapel beda: blok JTM terpisah


def test_monitoring_hanya_jurnal_hari_ini(monkeypatch):
    d = Db({
        'academic_years': Koleksi([{'id': 'ay1', 'is_active': True, 'name': '2026/2027'}]),
        'schedules': Koleksi([_jadwal(0, '07:00', '07:40'), _jadwal(1, '07:40', '08:20'), _jadwal(2, '13:00', '13:40')]),
        'classes': Koleksi([{'id': 'k1', 'name': '7A'}]), 'subjects': Koleksi([{'id': f'm{i}', 'name': f'Mapel {i}', 'code': f'M{i}'} for i in range(3)]),
        'rooms': Koleksi([{'id': 'r1', 'name': 'R1'}]), 'users': Koleksi([{'id': 'g1', 'full_name': 'Guru'}]),
        'journals': Koleksi([
            {'id': 'j-lalu', 'schedule_id': 's0', 'started_at': '2026-10-19T07:05:00+07:00', 'materi': 'minggu lalu'},
            {'id': 'j-ini', 'schedule_id': 's1', 'started_at': '2026-10-26T09:30:00+07:00', 'materi': 'Catat Jurnal',
             'asal_input': 'catat_jurnal'},
        ]),
    })

    async def settings():
        return {}

    monkeypatch.setattr(public, 'db', d)
    monkeypatch.setattr(public, 'get_settings', settings)
    monkeypatch.setattr(public, 'now_wib', lambda: SENIN_10)
    monkeypatch.setattr(public, 'current_day_id', lambda: 'senin')
    import routers.schedules as sch
    monkeypatch.setattr(sch, 'get_settings', settings)

    hasil = asyncio.run(public.public_monitoring())
    status = {}
    for item in hasil['classes']:
        for sid in item.get('schedule_ids') or [item.get('schedule_id') or item.get('id')]:
            status[sid] = item['jurnal_status']
    assert hasil['date'] == '2026-10-26'
    assert status.get('s0') == 'missing'  # jurnal minggu lalu tidak lagi dihitung terisi hari ini
    assert status.get('s1') == 'filled'   # jurnal hari ini (termasuk Catat Jurnal) tetap "Jurnal Terisi"
    assert status.get('s2') == 'not_started'
