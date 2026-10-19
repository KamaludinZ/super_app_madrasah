"""Validasi input PKG (field asing, format id, id di path) dan kelengkapan katalog aksi audit PKG."""

import os
import re
import sys

import pytest
from pydantic import ValidationError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pkg_audit  # noqa: E402
import pkg_penjaga  # noqa: E402
import pkg_skema as skema  # noqa: E402
from routers import pkg_kelola  # noqa: E402
from tests.pkg_palsu import Db, Koleksi  # noqa: E402

BACKEND = os.path.join(os.path.dirname(__file__), '..', 'backend')


def test_field_asing_dan_format_id_ditolak():
    with pytest.raises(ValidationError):  # salah ketik nama field
        skema.SkRequest(nomor_sk='B-1', tanggal_sk='2026-09-28', periode_id='p1', periode='p1')
    with pytest.raises(ValidationError):
        skema.SupervisiRequest(tanggal_supervisi='2026-10-08', catatan='x', status='selesai')
    with pytest.raises(ValidationError):
        skema.SkRequest(nomor_sk='B-1', tanggal_sk='2026-09-28', periode_id='p1; drop')
    with pytest.raises(ValidationError):
        skema.PenilaiSkRequest(penilai_ids=['ok', {'$ne': 1}])
    with pytest.raises(ValidationError):
        skema.PenilaiSkRequest(penilai_ids=['../x'])
    with pytest.raises(ValidationError):
        skema.PenugasanRequest(penugasan={'g1': 'p 1'})
    with pytest.raises(ValidationError):
        skema.PenugasanRequest(jatah={'x' * 65: 1})
    assert skema.PenilaiSkRequest(penilai_ids=['3f2b8c1e-0d4a-4c1b-9b7e-1a2b3c4d5e6f']).penilai_ids


def test_id_di_path_divalidasi(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from core import get_current_user

    d = Db({'pkg_periode': Koleksi(), 'users': Koleksi()})
    monkeypatch.setattr(pkg_kelola, 'db', d)
    monkeypatch.setattr(pkg_penjaga, 'db', d)
    app = FastAPI()
    app.include_router(pkg_kelola.router, prefix='/api')
    app.dependency_overrides[get_current_user] = lambda: {'id': 'kep', 'roles': ['kepala_sekolah']}
    klien = TestClient(app)
    assert klien.get('/api/pkg/sk/' + 'a' * 65).status_code == 422
    assert klien.get('/api/pkg/periode/ada$titik').status_code == 422
    assert klien.get('/api/pkg/periode/tidak-ada').status_code == 404
    r = klien.post('/api/pkg/periode', json={'nama_periode': 'X', 'tahun_pelajaran': '2026/2027', 'semester': 'Ganjil',
                                             'tanggal_buka': '2026-10-01', 'tanggal_tutup': '2026-11-30', 'liar': 1})
    assert r.status_code == 422


def test_semua_aksi_audit_terdaftar():
    sumber = ''
    for akar, _, berkas in os.walk(BACKEND):
        for nama in berkas:
            if nama.endswith('.py') and ('pkg' in nama or akar.endswith('routers')):
                with open(os.path.join(akar, nama), encoding='utf-8') as f:
                    sumber += f.read()
    aksi = set(re.findall(r"catat_audit_pkg(?:_harian)?\(db, '([a-z_]+)'", sumber))
    aksi |= {f'periode_{s}' for s in ('berjalan', 'ditutup')} if "f'periode_{data.status}'" in sumber else set()
    assert aksi, 'tidak ada aksi audit ditemukan'
    assert aksi <= set(pkg_audit.LABEL_AKSI), aksi - set(pkg_audit.LABEL_AKSI)
