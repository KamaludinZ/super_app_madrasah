"""Form isian kosong PKG (cetak offline): isi PDF per jenis dan API POST /pkg/cetak/form (otorisasi, cakupan, riwayat)."""

import os
import sys

import pytest
from reportlab import rl_config

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pkg_form_kosong  # noqa: E402
from routers import pkg_form_api as api  # noqa: E402
from tests.pkg_palsu import Db, Koleksi  # noqa: E402


def _instrumen(iid='i-aktif', teks='Indikator'):
    return {'id': iid, 'is_active': iid == 'i-aktif', 'versi_template': 'v2026', 'revisi': 1, 'kompetensi': [
        {'kode': 'PED', 'nama': 'Pedagogik', 'sub': [
            {'kode': 'PED-1', 'nama': 'Merencanakan Pembelajaran', 'bobot': 1,
             'indikator': [{'level': n, 'teks': f'{teks} ped satu level {n}'} for n in range(1, 6)]}]},
        {'kode': 'PRO', 'nama': 'Profesional', 'sub': [
            {'kode': 'PRO-1', 'nama': 'Pengembangan Keprofesian', 'bobot': 1,
             'indikator': [{'level': n, 'teks': f'{teks} pro satu level {n}'} for n in range(1, 6)]}]}]}


@pytest.fixture
def teks_polos(monkeypatch):
    """Matikan kompresi halaman agar teks PDF dapat dicari langsung pada byte hasil."""
    monkeypatch.setattr(rl_config, 'pageCompression', 0)


def _ctx(**ubah):
    ctx = {'madrasah': 'MTsN Uji', 'periode': {'nama_periode': 'Ganjil 2026', 'tahun_pelajaran': '2026/2027', 'semester': 'Ganjil'},
           'guru': None, 'penilai': None, 'instrumen': _instrumen(), 'bulan': ['Juli 2026', 'Agustus 2026']}
    return {**ctx, **ubah}


def test_pdf_instrumen_berisi_indikator_dan_judul_form(teks_polos):
    pdf = pkg_form_kosong.form_kosong_pdf('instrumen', [_ctx(guru={'nama': 'Budi Santoso', 'nip': '1980'}, penilai={'nama': 'Ani Penilai'})])
    assert pdf.startswith(b'%PDF')
    for kunci in (b'FORM PENILAIAN KINERJA GURU', b'diisi tim penilai, lalu diinput ke aplikasi', b'Budi Santoso', b'Ani Penilai',
                  b'Indikator ped satu level 3', b'PRO-1', b'Catatan bukti', b'Tanggapan guru', b'Catatan umum', b'Ringkasan skor'):
        assert kunci in pdf, kunci
    assert b'CADANGAN' not in pdf  # form isian bukan salinan dokumen resmi


def test_pdf_form_kosong_tanpa_guru_memakai_titik(teks_polos):
    pdf = pkg_form_kosong.form_kosong_pdf('instrumen', [_ctx()])
    assert b'.' * 20 in pdf and b'Nama guru dinilai' in pdf


def test_pdf_kehadiran_dan_pkb(teks_polos):
    hadir = pkg_form_kosong.form_kosong_pdf('kehadiran', [_ctx()])
    for kunci in (b'FORM REKAP KEHADIRAN GURU', b'Juli 2026', b'Agustus 2026', b'Terlambat', b'Tanpa ket.', b'Jumlah', b'INDEK-HDIR', b'/ 46'):
        assert kunci in hadir, kunci
    pkb = pkg_form_kosong.form_kosong_pdf('pkb', [_ctx()])
    assert b'REKOMENDASI PENGEMBANGAN KEPROFESIAN' in pkb
    for label in list(pkg_form_kosong.OPSI_PKB.values()) + list(pkg_form_kosong.FOKUS_KOMPETENSI.values()):
        assert label.encode('latin-1').replace(b'(', b'\\(').replace(b')', b'\\)') in pkb, label


def test_paket_gabungan_dan_banyak_guru(teks_polos):
    satu = pkg_form_kosong.form_kosong_pdf('paket', [_ctx(guru={'nama': 'Guru A'})])
    assert all(k in satu for k in (b'FORM PENILAIAN KINERJA GURU', b'FORM REKAP KEHADIRAN GURU', b'REKOMENDASI PENGEMBANGAN'))
    dua = pkg_form_kosong.form_kosong_pdf('paket', [_ctx(guru={'nama': 'Guru A'}), _ctx(guru={'nama': 'Guru B'})])
    assert dua.count(b'/Type /Page\n') > satu.count(b'/Type /Page\n') and b'Guru B' in dua
    with pytest.raises(ValueError):
        pkg_form_kosong.form_kosong_pdf('lain', [_ctx()])


@pytest.fixture
def klien(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from core import get_current_user
    d = Db({
        'pkg_periode': Koleksi([{'id': 'p1', 'status': 'berjalan', 'nama_periode': 'Ganjil', 'tahun_pelajaran': '2026/2027',
                                 'semester': 'Ganjil', 'tanggal_buka': '2026-10-01', 'tanggal_tutup': '2026-12-31'}]),
        'pkg_sk': Koleksi([{'id': 's1', 'periode_id': 'p1', 'is_active': True, 'penilai_ids': ['pen', 'pen2'], 'dinilai_ids': ['g1', 'g2'],
                            'snapshot_anggota': {'g1': {'nama': 'Guru Satu', 'nip': 'NIP-g1'}, 'g2': {'nama': 'Guru Dua'},
                                                 'pen': {'nama': 'Penilai Satu', 'nip': 'NIP-pen'}}}]),
        'pkg_penugasan': Koleksi([{'periode_id': 'p1', 'penilai_id': 'pen', 'guru_dinilai_ids': ['g1']}]),
        'pkg_penilaian': Koleksi([{'id': 'l1', 'sk_id': 's1', 'periode_id': 'p1', 'guru_dinilai_id': 'g1', 'penilai_id': 'pen',
                                   'instrumen_id': 'i-lama', 'status': 'draf'}]),
        'pkg_instrumen': Koleksi([_instrumen('i-aktif', 'Teks baru'), _instrumen('i-lama', 'Teks lama')]),
        'users': Koleksi([{'id': 'g1', 'full_name': 'Guru Satu', 'tugas_tambahan': 'Wali Kelas 7A'}]),
        'settings': Koleksi([{'id': 'global_config', 'school_name': 'MTsN Uji'}]),
    })
    monkeypatch.setattr(api, 'db', d)
    monkeypatch.setattr(rl_config, 'pageCompression', 0)
    app = FastAPI()
    app.include_router(api.router, prefix='/api')
    pengguna = {'user': {'id': 'kep', 'roles': ['kepala_sekolah'], 'full_name': 'Kepala'}}
    app.dependency_overrides[get_current_user] = lambda: pengguna['user']
    return TestClient(app), d, pengguna


def test_cetak_form_kosong_semua_jenis_tercatat(klien):
    k, d, _ = klien
    for jenis in ('instrumen', 'kehadiran', 'pkb', 'paket'):
        r = k.post('/api/pkg/cetak/form', json={'jenis': jenis})
        assert r.status_code == 200 and r.content.startswith(b'%PDF'), jenis
        assert r.headers['content-type'] == 'application/pdf' and f'Form_PKG_{jenis}_Kosong' in r.headers['content-disposition']
    u = d['pkg_unduhan'].docs[-1]
    assert (u['jenis'], u['format'], u['guru_id'], u['periode_id']) == ('form', 'pdf', None, 'p1')
    assert d['pkg_audit_log'].docs[-1]['metadata']['jenis_form'] == 'paket'
    hadir = k.post('/api/pkg/cetak/form', json={'jenis': 'kehadiran'}).content
    assert b'Juli 2026' in hadir and b'Desember 2026' in hadir  # bulan semester Ganjil 2026/2027


def test_cetak_form_guru_memakai_instrumen_lembar_dan_identitas(klien):
    k, d, _ = klien
    r = k.post('/api/pkg/cetak/form', json={'jenis': 'paket', 'guru_id': 'g1'})
    assert r.status_code == 200 and 'Guru_Satu' in r.headers['content-disposition']
    assert b'Teks lama ped satu level 1' in r.content and b'Teks baru' not in r.content  # versi instrumen saat lembar dibuat
    assert b'Guru Satu' in r.content and b'Penilai Satu' in r.content and b'Wali Kelas 7A' in r.content
    assert d['pkg_unduhan'].docs[-1]['guru_id'] == 'g1'
    tanpa_lembar = k.post('/api/pkg/cetak/form', json={'jenis': 'instrumen', 'guru_id': 'g2'})
    assert b'Teks baru ped satu level 1' in tanpa_lembar.content  # tanpa lembar: instrumen aktif


def test_cetak_form_semua_guru_kepala_dan_penilai(klien):
    k, d, pengguna = klien
    r = k.post('/api/pkg/cetak/form', json={'jenis': 'instrumen', 'semua_guru': True})
    assert r.status_code == 200 and 'Semua_Guru' in r.headers['content-disposition']
    assert b'Guru Satu' in r.content and b'Guru Dua' in r.content
    assert d['pkg_audit_log'].docs[-1]['metadata']['jumlah_form'] == 2
    pengguna['user'] = {'id': 'pen', 'roles': ['guru']}
    r = k.post('/api/pkg/cetak/form', json={'jenis': 'instrumen', 'semua_guru': True})
    assert r.status_code == 200 and b'Guru Satu' in r.content and b'Guru Dua' not in r.content  # hanya guru yang dibagikan
    assert k.post('/api/pkg/cetak/form', json={'jenis': 'pkb', 'guru_id': 'g1', 'semua_guru': True}).status_code == 422


def test_cetak_form_otorisasi(klien):
    k, d, pengguna = klien
    pengguna['user'] = {'id': 'pen', 'roles': ['guru']}
    assert k.post('/api/pkg/cetak/form', json={'jenis': 'paket', 'guru_id': 'g1'}).status_code == 200
    assert k.post('/api/pkg/cetak/form', json={'jenis': 'paket', 'guru_id': 'g2'}).status_code == 403  # di luar cakupan penilai
    pengguna['user'] = {'id': 'pen2', 'roles': ['guru']}  # penilai di SK, belum punya penugasan
    assert k.post('/api/pkg/cetak/form', json={'jenis': 'paket'}).status_code == 200  # form kosong boleh
    assert k.post('/api/pkg/cetak/form', json={'jenis': 'paket', 'guru_id': 'g1'}).status_code == 403
    assert k.post('/api/pkg/cetak/form', json={'jenis': 'paket', 'semua_guru': True}).status_code == 403
    pengguna['user'] = {'id': 'g2', 'roles': ['guru']}  # anggota (dinilai) bukan pengelola
    r = k.post('/api/pkg/cetak/form', json={'jenis': 'instrumen'})
    assert r.status_code == 403 and r.json()['detail']['alasan'] == 'bukan_penilai'
    pengguna['user'] = {'id': 'asing', 'roles': ['guru']}
    assert k.post('/api/pkg/cetak/form', json={'jenis': 'instrumen'}).status_code == 403
    assert k.post('/api/pkg/cetak/form', json={'jenis': 'sertifikat'}).status_code == 422
    assert any(a['aksi'] == 'cetak_gagal' for a in d['pkg_audit_log'].docs)


def test_cetak_form_tanpa_instrumen_409_tetapi_kehadiran_tetap_bisa(klien):
    k, d, _ = klien
    d['pkg_instrumen'].docs.clear()
    assert k.post('/api/pkg/cetak/form', json={'jenis': 'instrumen'}).status_code == 409
    assert k.post('/api/pkg/cetak/form', json={'jenis': 'kehadiran'}).status_code == 200
    assert k.post('/api/pkg/cetak/form', json={'jenis': 'pkb'}).status_code == 200
