"""Komponen kehadiran (INDEK-HDIR): rumus sesuai template dan API input rekap manual per guru."""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pkg_kehadiran as k  # noqa: E402
from routers import pkg_kehadiran_api as api  # noqa: E402
from routers import pkg_angket_api  # noqa: E402
from tests.pkg_palsu import Db, Koleksi  # noqa: E402

PERIODE = {'id': 'p1', 'status': 'berjalan', 'nama_periode': 'Ganjil', 'tanggal_buka': '2026-07-15', 'tanggal_tutup': '2026-12-20'}


def test_rumus_indek_hdir():
    assert k.bulan_periode(PERIODE) == ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12']
    assert len(k.bulan_periode({'tanggal_buka': '2026-01-01', 'tanggal_tutup': '2027-06-30'})) == 12  # 12 baris sheet
    b = k.hitung_bulan({'terlambat_menit': 300, 'pulang_cepat_menit': 180, 'tanpa_keterangan': 2})
    assert (b['jumlah_menit'], b['konversi_hari'], b['jumlah_tidak_hadir']) == (480, 1.0, 3.0)  # F, G = F/480, I = G+H
    assert abs(b['persen_hadir'] - (1 - 3 / 46)) < 1e-12  # K = 1 - I/46
    kosong = k.hitung_kehadiran(k.baris_lengkap(PERIODE, None))
    assert kosong['indeks'] == 1 and kosong['indeks_persen'] == 100.0  # template kosong -> 100%
    h = k.hitung_kehadiran(k.baris_lengkap(PERIODE, [{'bulan': '2026-08', 'tanpa_keterangan': 1, 'izin': 2},
                                                    {'bulan': '2026-09', 'terlambat_menit': 240}]))
    assert h['jumlah']['jumlah_tidak_hadir'] == 1.5 and h['jumlah']['izin'] == 2  # izin tidak masuk rumus
    assert h['indeks_persen'] == round((1 - 1.5 / 46) * 100, 2)


@pytest.fixture
def klien(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from core import get_current_user
    d = Db({
        'pkg_periode': Koleksi([dict(PERIODE)]),
        'pkg_sk': Koleksi([{'id': 's1', 'periode_id': 'p1', 'is_active': True, 'penilai_ids': ['pen'], 'dinilai_ids': ['g1', 'g2'],
                            'snapshot_anggota': {'g1': {'nama': 'Guru Satu'}, 'g2': {'nama': 'Guru Dua'}}}]),
        'pkg_penugasan': Koleksi([{'periode_id': 'p1', 'penilai_id': 'pen', 'guru_dinilai_ids': ['g1']}]),
        'pkg_penilaian': Koleksi([]),
        'users': Koleksi([]),
    })
    monkeypatch.setattr(api, 'db', d)
    monkeypatch.setattr(pkg_angket_api, 'db', d)
    app = FastAPI()
    app.include_router(api.router, prefix='/api')
    pengguna = {'user': {'id': 'kep', 'roles': ['kepala_sekolah'], 'full_name': 'Kepala'}}
    app.dependency_overrides[get_current_user] = lambda: pengguna['user']
    return TestClient(app), d, pengguna


def test_input_kehadiran(klien):
    c, d, pengguna = klien
    awal = c.get('/api/pkg/kehadiran/g1').json()
    assert awal['terisi'] is False and len(awal['bulan']) == 6 and awal['indeks_persen'] == 100.0
    assert awal['bulan'][0]['label'] == 'Juli 2026'
    r = c.put('/api/pkg/kehadiran/g1', json={'bulan': [{'bulan': '2026-08', 'tanpa_keterangan': 1, 'terlambat_menit': 240}]})
    assert r.status_code == 200 and r.json()['indeks_persen'] == round((1 - 1.5 / 46) * 100, 2)
    assert d['pkg_audit_log'].docs[-1]['aksi'] == 'kehadiran_simpan'
    assert c.put('/api/pkg/kehadiran/g1', json={'bulan': [{'bulan': '2027-01'}]}).status_code == 422  # di luar periode
    assert c.put('/api/pkg/kehadiran/g1', json={'bulan': [{'bulan': '2026-08'}, {'bulan': '2026-08'}]}).status_code == 422
    assert c.put('/api/pkg/kehadiran/g1', json={'bulan': [{'bulan': '2026-08', 'tanpa_keterangan': 40}]}).status_code == 422
    c.put('/api/pkg/kehadiran/g1', json={'bulan': [{'bulan': '2026-10', 'tanpa_keterangan': 2}]})  # mengganti data lama
    assert len(d['pkg_kehadiran'].docs) == 1 and c.get('/api/pkg/kehadiran/g1').json()['jumlah']['tanpa_keterangan'] == 2
    ringkas = {g['guru_id']: g for g in c.get('/api/pkg/kehadiran/ringkasan').json()['guru']}
    assert ringkas['g1']['terisi'] and not ringkas['g2']['terisi'] and ringkas['g2']['indeks_persen'] == 100.0
    pengguna['user'] = {'id': 'pen', 'roles': ['guru']}
    assert c.put('/api/pkg/kehadiran/g2', json={'bulan': []}).status_code == 403
    d['pkg_periode'].docs[0]['status'] = 'ditutup'
    assert c.put('/api/pkg/kehadiran/g1', json={'periode_id': 'p1', 'bulan': []}).status_code == 409
