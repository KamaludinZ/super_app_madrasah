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
    aksi = set(re.findall(r"catat_audit_(?:pkg|pkg_harian|instrumen)\(db, '([a-z_]+)'", sumber))
    aksi |= {f'periode_{s}' for s in ('berjalan', 'ditutup')} if "f'periode_{data.status}'" in sumber else set()
    assert aksi, 'tidak ada aksi audit ditemukan'
    assert aksi <= set(pkg_audit.LABEL_AKSI), aksi - set(pkg_audit.LABEL_AKSI)


def test_setiap_aksi_audit_berkategori():
    import pkg_audit
    assert set(pkg_audit.KATEGORI_AKSI) == set(pkg_audit.LABEL_AKSI)
    assert set(pkg_audit.KATEGORI_AKSI.values()) == set(pkg_audit.KATEGORI_AUDIT)


def _rute_pkg():
    from routers import pkg, pkg_audit_api, pkg_cetak_api, pkg_instrumen_api, pkg_penilaian_api, pkg_rekap_api
    for modul in (pkg, pkg_kelola, pkg_instrumen_api, pkg_penilaian_api, pkg_rekap_api, pkg_cetak_api, pkg_audit_api):
        yield from modul.router.routes


def _batas(param):
    meta = getattr(param.field_info, 'metadata', None) or []
    return {k for m in meta for k in ('pattern', 'max_length', 'ge', 'le') if getattr(m, k, None) is not None}


def test_setiap_parameter_endpoint_pkg_dibatasi():
    """Path & query teks wajib berpola/berbatas panjang, angka berbatas, badan permintaan menolak field asing."""
    def semua(dep):
        yield dep
        for sub in dep.dependencies:
            yield from semua(sub)
    lolos, jumlah_rute = [], 0
    for rute in _rute_pkg():
        jumlah_rute += 1
        for dep in semua(rute.dependant):
            for p in dep.path_params + dep.query_params:
                tipe = p.field_info.annotation
                if tipe is bool:
                    continue
                syarat = {'pattern'} if p in dep.path_params else ({'ge', 'le'} if tipe is int else {'pattern', 'max_length'})
                if not (_batas(p) & syarat) or (tipe is int and _batas(p) & {'ge', 'le'} != {'ge', 'le'}):
                    lolos.append(f'{rute.path} {p.name}')
            for p in dep.body_params:
                tipe = p.field_info.annotation
                if isinstance(tipe, type) and issubclass(tipe, skema.IsianPkg):
                    continue
                if tipe is str and 'pattern' in _batas(p):  # isian Form
                    continue
                if 'UploadFile' in str(tipe):
                    continue
                lolos.append(f'{rute.path} body {p.name}')
    assert jumlah_rute > 40 and not lolos, lolos


def _klien_dengan_penangan(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from core import get_current_user
    from pkg_validasi import pasang_penangan_validasi
    from routers import pkg_cetak_api, pkg_instrumen_api
    d = Db({'pkg_periode': Koleksi(), 'users': Koleksi()})
    for modul in (pkg_kelola, pkg_penjaga, pkg_cetak_api, pkg_instrumen_api):
        monkeypatch.setattr(modul, 'db', d)
    app = FastAPI()
    for modul in (pkg_kelola, pkg_cetak_api, pkg_instrumen_api):
        app.include_router(modul.router, prefix='/api')

    @app.get('/api/lain')
    async def lain(n: int):
        return n
    pasang_penangan_validasi(app)
    app.dependency_overrides[get_current_user] = lambda: {'id': 'kep', 'roles': ['kepala_sekolah']}
    return TestClient(app)


def test_galat_validasi_pkg_berbahasa_indonesia(monkeypatch):
    k = _klien_dengan_penangan(monkeypatch)
    r = k.post('/api/pkg/cetak', json={'jenis': 'guru', 'format': 'docx', 'liar': 1, 'guru_id': 'a b'})
    assert r.status_code == 422
    detail = r.json()['detail']
    assert detail['pesan'].startswith('Masukan tidak valid:')
    galat = {g['lokasi']: g['pesan'] for g in detail['galat']}
    assert galat['format'] == "format harus 'xlsx' atau 'pdf'" and galat['liar'] == 'field tidak dikenal'
    assert galat['guru_id'] == 'format tidak valid'
    assert 'a b' not in r.text  # nilai masukan tidak dipantulkan
    r = k.get('/api/pkg/cetak/unduhan', params={'per_halaman': 1000})
    assert r.status_code == 422 and r.json()['detail']['galat'] == [{'lokasi': 'per_halaman', 'pesan': 'maksimal 100'}]
    r = k.post('/api/pkg/periode', json={'nama_periode': 'x' * 121})
    pesan = {g['lokasi']: g['pesan'] for g in r.json()['detail']['galat']}
    assert pesan['nama_periode'] == 'maksimal 120 karakter' and pesan['tanggal_buka'] == 'wajib diisi'
    assert k.post('/api/pkg/cetak', content=b'{rusak', headers={'content-type': 'application/json'}).json()['detail']['galat'][0]['pesan'] == 'JSON tidak valid'
    # Form sumber impor dibatasi; path di luar PKG tetap memakai format bawaan FastAPI.
    r = k.post('/api/pkg/instrumen/impor/pratinjau', data={'sumber': 'lain'})
    assert r.status_code == 422 and r.json()['detail']['galat'][0]['lokasi'] == 'sumber'
    assert isinstance(k.get('/api/lain', params={'n': 'x'}).json()['detail'], list)
