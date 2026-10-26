"""Catat Jurnal (isi jurnal di luar jam) & asal input jurnal: jendela waktu, endpoint POST /jurnal/catat, penanda
Asal Input, filter bulan WIB, dan rekap bulanan per guru untuk dashboard kepala madrasah (tanpa MongoDB)."""

import os
import re
import sys
from datetime import datetime

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import jurnal_asal as ja  # noqa: E402
from journal_core import WIB_TZ, month_started_at_filter  # noqa: E402
from routers import journals  # noqa: E402
from tests.pkg_palsu import Db, Koleksi  # noqa: E402

JADWAL = {'id': 'sch1', 'teacher_id': 'g1', 'day': 'Senin', 'start_time': '07:00', 'end_time': '08:20',
          'semester_id': 'sem1', 'class_id': 'k1', 'subject_id': 'm1', 'room_id': 'r1', 'slot_indexes': [0, 1],
          'is_published': True}
SENIN = datetime(2026, 10, 26, tzinfo=WIB_TZ)  # Senin


def jam(h, m=0):
    return SENIN.replace(hour=h, minute=m)


def test_jendela_catat_jurnal():
    sebelum = ja.jendela_catat_jurnal(JADWAL, jam(8, 35), 15)
    assert sebelum['tersedia'] is False and '08:35' in sebelum['alasan']  # 08:20 + 15 menit: QR masih berlaku
    sesudah = ja.jendela_catat_jurnal(JADWAL, jam(8, 36), 15)
    assert sesudah['tersedia'] and sesudah['berakhir_pada'] == '2026-10-27T00:00:00+07:00'
    assert ja.jendela_catat_jurnal(JADWAL, jam(23, 59), 15)['tersedia']
    assert ja.jendela_catat_jurnal({'end_time': 'xx'}, jam(9), 15)['tersedia'] is False


def test_asal_input_jurnal_bawaan_presisi():
    assert ja.asal_input_jurnal({}) == ja.ASAL_PRESISI  # data lama tanpa field
    assert ja.asal_input_jurnal({'asal_input': 'catat_jurnal'}) == ja.ASAL_CATAT
    assert ja.tandai_asal_input({'fill_mode': 'piket'})['asal_input_label'] == 'Jurnal Presisi'
    assert ja.tandai_asal_input({'asal_input': 'catat_jurnal'})['asal_input_label'] == 'Catat Jurnal'


def _cocok(f, nilai):
    for syarat in f['$or']:
        c = syarat['started_at']
        if '$regex' in c and re.search(c['$regex'], nilai):
            return True
        if '$gte' in c and c['$gte'] <= nilai < c['$lt'] and not c['$not'].search(nilai):
            return True
    return False


def test_filter_bulan_wib():
    f = month_started_at_filter(2026, 10)
    assert _cocok(f, '2026-10-31T23:00:00+07:00') and _cocok(f, '2026-09-30T17:30:00')  # 1 Okt 00:30 WIB (UTC naif)
    assert not _cocok(f, '2026-11-01T06:00:00+07:00') and not _cocok(f, '2026-10-31T17:30:00')  # 1 Nov 00:30 WIB
    des = month_started_at_filter(2026, 12)
    assert des['$or'][1]['started_at']['$lt'] == '2026-12-31T17:00:00'


def test_susun_rekap_asal_input():
    hasil = [{'_id': 'g1', 'total': 5, 'catat_jurnal': 2}, {'_id': 'g3', 'total': 1, 'catat_jurnal': 0}]
    r = ja.susun_rekap_asal_input(2026, 10, hasil, ['g1', 'g2'], {'g1': 'Budi', 'g2': 'Ani', 'g3': 'Citra'})
    assert (r['bulan'], r['label']) == ('2026-10', 'Oktober 2026')
    assert [(g['teacher_name'], g['jurnal_presisi'], g['catat_jurnal']) for g in r['guru']] == [
        ('Budi', 3, 2), ('Citra', 1, 0), ('Ani', 0, 0)]  # guru berjadwal tanpa jurnal tetap tampil
    assert r['total'] == {'jurnal_presisi': 4, 'catat_jurnal': 2, 'total': 6}
    cocok = ja.pipeline_asal_input(2026, 10)[0]['$match']['$and']
    assert cocok[1] == {'fill_mode': {'$nin': ['substitute', 'piket', 'admin']}}


class _KoleksiJurnal(Koleksi):
    async def insert_many(self, docs):
        self.docs.extend(dict(d) for d in docs)


@pytest.fixture
def klien(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from core import get_current_user
    from routers import guru_pengganti
    d = Db({'schedules': Koleksi([dict(JADWAL)]), 'journals': _KoleksiJurnal(), 'attendances': _KoleksiJurnal(),
            'substitute_assignments': Koleksi(), 'indikator': Koleksi(), 'materi': Koleksi()})
    waktu = {'now': jam(10)}

    async def settings():
        return {'grace_minutes': 15}

    async def konteks(_user):
        return {'semester_id': 'sem1'}

    async def audit(*_a, **_k):
        return None

    monkeypatch.setattr(journals, 'db', d)
    monkeypatch.setattr(journals, 'get_settings', settings)
    monkeypatch.setattr(journals, 'get_active_context', konteks)
    monkeypatch.setattr(journals, 'log_audit', audit)
    monkeypatch.setattr(journals, 'now_wib', lambda: waktu['now'])
    monkeypatch.setattr(journals, 'current_day_id', lambda: 'senin')
    monkeypatch.setattr(guru_pengganti, 'db', d)
    app = FastAPI()
    app.include_router(journals.router, prefix='/api')
    pengguna = {'user': {'id': 'g1', 'username': 'g1', 'full_name': 'Guru Satu', 'roles': ['guru'], 'active_role': 'guru'}}
    app.dependency_overrides[get_current_user] = lambda: pengguna['user']
    return TestClient(app), d, waktu, pengguna


ISIAN = {'schedule_id': 'sch1', 'materi': 'Persamaan linear',
         'attendance_details': [{'student_id': 's1', 'student_name': 'Ali', 'status': 'hadir'},
                                {'student_id': 's2', 'student_name': 'Bela', 'status': 'alpha'}]}


def test_catat_jurnal_tersimpan_sebagai_catat(klien):
    k, d, waktu, _ = klien
    r = k.post('/api/jurnal/catat', json=ISIAN)
    assert r.status_code == 200, r.text
    j = d['journals'].docs[0]
    assert (j['asal_input'], j['qr_mode'], j['fill_mode'], j['journal_date']) == ('catat_jurnal', 'none', 'self', '2026-10-26')
    assert (j['siswa_hadir'], j['siswa_tidak_hadir'], j['filled_by_name']) == (1, 1, 'Guru Satu')
    assert j['scheduled_end'] == '2026-10-26T08:20:00+07:00' and r.json()['asal_input_label'] == 'Catat Jurnal'
    assert len(d['attendances'].docs) == 2
    ulang = k.post('/api/jurnal/catat', json=ISIAN)
    assert ulang.status_code == 409 and 'sudah diisi' in ulang.json()['detail']


def test_catat_jurnal_ditolak_di_luar_syarat(klien):
    k, d, waktu, pengguna = klien
    waktu['now'] = jam(8, 30)  # masih dalam toleransi QR
    assert k.post('/api/jurnal/catat', json=ISIAN).status_code == 400
    waktu['now'] = jam(10)
    assert k.post('/api/jurnal/catat', json={**ISIAN, 'schedule_id': 'tidak-ada'}).status_code == 404
    assert k.post('/api/jurnal/catat', json={**ISIAN, 'materi': '   '}).status_code == 400
    assert k.post('/api/jurnal/catat', json={**ISIAN, 'liar': 1}).status_code == 422
    d['substitute_assignments'].docs.append({'schedule_id': 'sch1', 'date': '2026-10-26', 'status': 'active'})
    assert k.post('/api/jurnal/catat', json=ISIAN).status_code == 409  # slot digantikan: pakai alur Isi slot
    d['substitute_assignments'].docs.clear()
    pengguna['user'] = {**pengguna['user'], 'id': 'g2'}
    assert k.post('/api/jurnal/catat', json=ISIAN).status_code == 403  # bukan jadwal miliknya
    pengguna['user'] = {**pengguna['user'], 'id': 'g1'}
    d['schedules'].docs[0]['day'] = 'Selasa'
    assert k.post('/api/jurnal/catat', json=ISIAN).status_code == 400  # bukan jadwal hari ini (kemarin = expired)
    assert not d['journals'].docs


def test_admin_jurnal_filter_asal_input(klien):
    k, d, _, pengguna = klien
    d['journals'].docs.extend([
        {'id': 'jp', 'schedule_id': 'sch1', 'teacher_id': 'g1', 'semester_id': 'sem1', 'started_at': '2026-10-26T07:05:00+07:00', 'materi': 'a'},
        {'id': 'jc', 'schedule_id': 'sch1', 'teacher_id': 'g1', 'semester_id': 'sem1', 'started_at': '2026-10-26T10:00:00+07:00', 'materi': 'b',
         'asal_input': 'catat_jurnal'},
    ])
    pengguna['user'] = {'id': 'adm', 'username': 'adm', 'roles': ['admin'], 'active_role': 'admin'}
    semua = k.get('/api/admin/jurnal').json()['items']
    assert {j['id']: j['asal_input_label'] for j in semua} == {'jp': 'Jurnal Presisi', 'jc': 'Catat Jurnal'}
    assert [j['id'] for j in k.get('/api/admin/jurnal', params={'asal_input': 'catat_jurnal'}).json()['items']] == ['jc']
    assert [j['id'] for j in k.get('/api/admin/jurnal', params={'asal_input': 'jurnal_presisi'}).json()['items']] == ['jp']
    assert k.get('/api/admin/jurnal', params={'asal_input': 'lain'}).status_code == 422


def test_ketepatan_waktu_menurut_asal_input():
    jurnal = [
        {'started_at': '2026-10-26T07:05:00+07:00'},                                   # presisi (data lama, tanpa penanda)
        {'started_at': '2026-10-26T01:30:00', 'asal_input': 'jurnal_presisi'},        # 08:30 WIB (UTC naif), akhir jam: tetap tepat
        {'started_at': '2026-10-26T15:00:00+07:00', 'asal_input': 'catat_jurnal'},    # catat jurnal = terlambat
        {'started_at': '2026-10-27T09:00:00+07:00', 'asal_input': 'catat_jurnal'},
        {'started_at': '2026-10-27T08:00:00+07:00', 'fill_mode': 'piket'},            # isian piket tidak dihitung
        {'started_at': '2026-10-27T08:00:00+07:00', 'fill_mode': 'substitute'},       # isian guru pengganti tidak dihitung
        {'started_at': None},
    ]
    r = ja.rekap_ketepatan_waktu(jurnal)
    assert (r['total_jurnal'], r['total_on_time'], r['total_late'], r['on_time_percentage']) == (4, 2, 2, 50.0)
    assert r['daily'] == [{'date': '2026-10-26', 'on_time': 2, 'late': 1}, {'date': '2026-10-27', 'on_time': 0, 'late': 1}]
    assert len(ja.rekap_ketepatan_waktu([{'started_at': f'2026-10-{d:02d}T07:00:00+07:00'} for d in range(1, 21)])['daily']) == 14


def test_endpoint_ketepatan_waktu(klien):
    k, d, _, _ = klien
    d['journals'].docs.extend([
        {'teacher_id': 'g1', 'semester_id': 'sem1', 'started_at': '2026-10-26T07:05:00+07:00', 'scheduled_start': '2026-10-26T07:00:00+07:00'},
        {'teacher_id': 'g1', 'semester_id': 'sem1', 'started_at': '2026-10-26T10:00:00+07:00', 'asal_input': 'catat_jurnal'},
        {'teacher_id': 'g1', 'semester_id': 'lama', 'started_at': '2026-04-01T07:00:00+07:00'},
    ])
    r = k.get('/api/jurnal/my-timeliness').json()
    assert (r['total_jurnal'], r['total_on_time'], r['total_late'], r['grace_minutes']) == (2, 1, 1, 15)
