"""API cetak Excel: otorisasi & cakupan, rekap & laporan per guru dari template resmi, riwayat unduhan."""

import asyncio
import io
import os
import sys

import pytest
from openpyxl import load_workbook

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pkg_instrumen_impor  # noqa: E402
import pkg_rekap  # noqa: E402
from routers import pkg_cetak_api as api  # noqa: E402
from tests.pkg_palsu import Db, Koleksi  # noqa: E402

INSTRUMEN = {'id': 'i1', 'versi_template': '2026', 'revisi': 1, 'is_active': True,
             'kompetensi': pkg_instrumen_impor.pratinjau_dari_template()['kompetensi']}
SUB = [s['kode'] for k in INSTRUMEN['kompetensi'] for s in k['sub']]


def _lembar(lid, guru, penilai, status='terkunci', skor=4):
    return {'id': lid, 'status': status, 'periode_id': 'p1', 'sk_id': 's1', 'guru_dinilai_id': guru, 'penilai_id': penilai,
            'instrumen_id': 'i1', 'snapshot_guru': {'nama': f'Guru {guru}', 'nip': f'NIP-{guru}'},
            'isian': {k: {'centang': list(range(1, skor + 1))} for k in SUB}, 'terkunci_pada': '2026-10-18T03:00:00+00:00'}


@pytest.fixture
def klien(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from core import get_current_user
    d = Db({
        'pkg_periode': Koleksi([{'id': 'p1', 'status': 'berjalan', 'nama_periode': 'PKG Ganjil 2026/2027', 'semester': 'Ganjil',
                                 'tahun_pelajaran': '2026/2027', 'tanggal_buka': '2026-10-01', 'tanggal_tutup': '2026-11-30'}]),
        'pkg_sk': Koleksi([{'id': 's1', 'nomor_sk': 'B-1/2026', 'tanggal_sk': '2026-09-28', 'periode_id': 'p1', 'is_active': True,
                            'penilai_ids': ['pen'], 'dinilai_ids': ['g1', 'g2', 'g3'],
                            'snapshot_anggota': {'pen': {'nama': 'Penilai Satu', 'nip': 'NIP-pen'}}}]),
        'pkg_penugasan': Koleksi([{'periode_id': 'p1', 'penilai_id': 'pen', 'guru_dinilai_ids': ['g1', 'g2'], 'supervisi_selesai': True}]),
        'pkg_penilaian': Koleksi([_lembar('n1', 'g1', 'pen', skor=4), _lembar('n2', 'g2', 'pen', 'draf'), _lembar('n3', 'g3', 'kep', skor=5)]),
        'pkg_instrumen': Koleksi([INSTRUMEN]),
        'settings': Koleksi([{'id': 'global_config', 'headmaster_name': 'Drs. H. Mahmud, M.Pd.', 'school_name': 'MTsN 2 Kota Malang'}]),
    })
    monkeypatch.setattr(api, 'db', d)
    asyncio.run(pkg_rekap.bangun_ulang_rekap(d))
    app = FastAPI()
    app.include_router(api.router, prefix='/api')
    pengguna = {'user': {'id': 'kep', 'roles': ['kepala_sekolah'], 'full_name': 'Kepala'}}
    app.dependency_overrides[get_current_user] = lambda: pengguna['user']
    return TestClient(app), d, pengguna


def test_cetak_rekap_excel_kepala(klien):
    k, d, _ = klien
    r = k.post('/api/pkg/cetak', json={'jenis': 'rekap', 'format': 'xlsx'})
    assert r.status_code == 200 and r.headers['x-pkg-mesin'] == 'openpyxl'
    assert 'Rekap_Hasil_PKG_PKG_Ganjil_2026_2027.xlsx' in r.headers['content-disposition']
    ws = load_workbook(io.BytesIO(r.content))['Rekap hasil PKG']
    assert [ws[f'B{i}'].value for i in (6, 7, 8)] == ['Guru g1', 'Guru g3', None]  # hanya lembar terkunci
    assert ws['F6'].value == 80.0 and ws['F7'].value == 100.0 and ws['G24'].value == 'Drs. H. Mahmud, M.Pd.'
    u = d['pkg_unduhan'].docs[0]
    assert (u['jenis'], u['format'], u['mesin'], u['periode_id'], u['aktor_id']) == ('rekap', 'xlsx', 'openpyxl', 'p1', 'kep')
    assert u['ukuran'] == len(r.content) and d['pkg_audit_log'].docs[-1]['aksi'] == 'cetak_template'


def test_cetak_laporan_guru_excel(klien):
    k, d, pengguna = klien
    pengguna['user'] = {'id': 'pen', 'roles': ['guru'], 'full_name': 'Penilai Satu'}
    r = k.post('/api/pkg/cetak', json={'jenis': 'guru', 'format': 'xlsx', 'guru_id': 'g1'})
    assert r.status_code == 200
    wb = load_workbook(io.BytesIO(r.content))
    data = wb['00-DATA']
    assert (data['E5'].value, data['E6'].value, data['E33'].value, data['E36'].value) == ('Guru g1', 'NIP-g1', 'Penilai Satu', 'B-1/2026')
    assert data['E15'].value == '2026' and data['E26'].value == 'MTsN 2 Kota Malang' and data['C41'].value == '1 Oktober 2026'
    komp = wb['KOMP (3)']
    assert [komp[f'B{r}'].value for r in range(20, 25)] == ['v', 'v', 'v', 'v', None]  # skor 4: Level 1–4
    assert wb['04-RKAP-PKG']['H44'].value == '=SUM(H29:H43)'  # rumus resmi tetap
    assert d['pkg_unduhan'].docs[-1]['guru_id'] == 'g1' and d['pkg_unduhan'].docs[-1]['jenis'] == 'guru'


def test_cetak_ditolak_dan_divalidasi(klien):
    k, d, pengguna = klien
    pengguna['user'] = {'id': 'pen', 'roles': ['guru']}
    assert k.post('/api/pkg/cetak', json={'jenis': 'guru', 'format': 'xlsx', 'guru_id': 'g3'}).status_code == 403  # di luar cakupan
    assert k.post('/api/pkg/cetak', json={'jenis': 'guru', 'format': 'xlsx', 'guru_id': 'g2'}).status_code == 409  # draf
    pengguna['user'] = {'id': 'g1', 'roles': ['guru']}  # hanya dinilai
    r = k.post('/api/pkg/cetak', json={'jenis': 'rekap', 'format': 'xlsx'})
    assert r.status_code == 403 and r.json()['detail']['alasan'] == 'bukan_penilai'
    pengguna['user'] = {'id': 'asing', 'roles': ['guru']}
    assert k.post('/api/pkg/cetak', json={'jenis': 'rekap', 'format': 'xlsx'}).json()['detail']['alasan'] == 'bukan_anggota_sk'
    for isian in ({'jenis': 'guru', 'format': 'xlsx'}, {'jenis': 'rekap', 'format': 'doc'}, {'jenis': 'rekap', 'format': 'xlsx', 'periode_id': 'p$1'}):
        assert k.post('/api/pkg/cetak', json=isian).status_code == 422, isian
    assert d['pkg_unduhan'].docs == []  # gagal tidak tercatat sebagai unduhan


@pytest.mark.skipif(not __import__('pkg_pdf').libreoffice_tersedia(), reason='LibreOffice tidak tersedia')
def test_cetak_pdf_libreoffice(klien):
    k, d, _ = klien
    r = k.post('/api/pkg/cetak', json={'jenis': 'guru', 'format': 'pdf', 'guru_id': 'g3'})
    assert r.status_code == 200 and r.content.startswith(b'%PDF') and r.headers['content-type'] == 'application/pdf'
    assert r.headers['x-pkg-mesin'] == 'libreoffice' and '.pdf' in r.headers['content-disposition']
    assert d['pkg_unduhan'].docs[-1]['mesin'] == 'libreoffice' and d['pkg_unduhan'].docs[-1]['format'] == 'pdf'


def test_cetak_pdf_cadangan_reportlab(klien, monkeypatch, tmp_path):
    import shutil
    import subprocess
    import pkg_pdf
    k, d, _ = klien
    monkeypatch.setattr(pkg_pdf, 'cari_soffice', lambda: None)
    for isian, cari in (({'jenis': 'rekap', 'format': 'pdf'}, ['Guru g1', 'Rata-rata', '90.00', 'Sangat Baik']),
                        ({'jenis': 'guru', 'format': 'pdf', 'guru_id': 'g3'}, ['Guru g3', 'Level 5', '100.00%', 'Ahli Utama'])):
        r = k.post('/api/pkg/cetak', json=isian)
        assert r.status_code == 200 and r.content.startswith(b'%PDF') and r.headers['x-pkg-mesin'] == 'reportlab'
        if shutil.which('pdftotext'):
            f = tmp_path / 'c.pdf'
            f.write_bytes(r.content)
            teks = subprocess.run(['pdftotext', str(f), '-'], capture_output=True, text=True).stdout
            assert 'VERSI CADANGAN' in teks and 'bukan salinan identik' in teks
            assert all(x in teks for x in cari), (cari, teks[:500])
    assert [u['mesin'] for u in d['pkg_unduhan'].docs] == ['reportlab', 'reportlab']


def test_kemampuan_cetak_dan_endpoint_pdf(klien, monkeypatch):
    import pkg_pdf
    k, d, _ = klien
    r = k.get('/api/pkg/cetak/kemampuan')
    assert r.status_code == 200
    assert r.json()['pdf'] == {'libreoffice': True, 'mesin': 'libreoffice', 'identik': True, 'tersedia': True, 'catatan': None}
    assert r.json()['excel']['tersedia'] and set(r.json()['excel']['template']) == {'instrumen', 'rekap'}

    monkeypatch.setattr(pkg_pdf, 'cari_soffice', lambda: None)
    pdf = k.get('/api/pkg/cetak/kemampuan').json()['pdf']
    assert pdf['mesin'] == 'reportlab' and not pdf['identik'] and 'cadangan' in pdf['catatan']
    # Endpoint khusus PDF mengabaikan format di badan permintaan; alasan cadangan ikut di header & audit.
    r = k.post('/api/pkg/cetak/pdf', json={'jenis': 'rekap', 'format': 'xlsx'})
    assert r.status_code == 200 and r.content.startswith(b'%PDF') and '.pdf' in r.headers['content-disposition']
    assert r.headers['x-pkg-mesin'] == 'reportlab' and r.headers['x-pkg-cadangan'] == 'libreoffice_tidak_tersedia'
    assert 'X-PKG-Cadangan' in r.headers['access-control-expose-headers']
    assert k.post('/api/pkg/cetak/pdf', json={'jenis': 'guru', 'format': 'pdf', 'guru_id': 'zz'}).status_code == 409


def test_cetak_pdf_konversi_gagal_pakai_cadangan(klien, monkeypatch):
    from pkg_pdf import KonversiPdfGagal
    k, d, _ = klien

    async def gagal(*a, **kw):
        raise KonversiPdfGagal('rusak')
    monkeypatch.setattr(api, 'xlsx_ke_pdf', gagal)
    r = k.post('/api/pkg/cetak', json={'jenis': 'guru', 'format': 'pdf', 'guru_id': 'g1'})
    assert r.status_code == 200 and r.headers['x-pkg-mesin'] == 'reportlab' and r.headers['x-pkg-cadangan'] == 'konversi_gagal'
    r = k.post('/api/pkg/cetak', json={'jenis': 'rekap', 'format': 'xlsx'})
    assert 'x-pkg-cadangan' not in r.headers and r.headers['x-pkg-mesin'] == 'openpyxl'


def test_daftar_unduhan_saring_urut_halaman(klien, monkeypatch):
    import pkg_penjaga
    k, d, pengguna = klien
    monkeypatch.setattr(pkg_penjaga, 'db', d)
    contoh = [
        ('u1', 'rekap', 'xlsx', 'openpyxl', None, 'kep', 'Kepala', 'Rekap_A.xlsx', 900, '2026-10-17T16:59:00+00:00'),  # 17 Okt WIB
        ('u2', 'rekap', 'pdf', 'reportlab', None, 'kep', 'Kepala', 'Rekap_B.pdf', 300, '2026-10-17T17:00:00+00:00'),  # 18 Okt WIB
        ('u3', 'guru', 'pdf', 'libreoffice', 'g1', 'pen', 'Penilai Satu', 'Laporan_g1.pdf', 500, '2026-10-18T05:00:00+00:00'),
        ('u4', 'guru', 'xlsx', 'openpyxl', 'g2', 'pen', 'Penilai Satu', 'Laporan_g2.xlsx', 700, '2026-10-19T01:00:00+00:00'),
    ]
    d['pkg_unduhan'].docs = [dict(zip(('id', 'jenis', 'format', 'mesin', 'guru_id', 'aktor_id', 'aktor_nama', 'nama_berkas',
                                       'ukuran', 'timestamp'), c), periode_id='p1') for c in contoh]
    ambil = lambda **p: k.get('/api/pkg/cetak/unduhan', params=p)  # noqa: E731
    ids = lambda r: [u['id'] for u in r.json()['item']]  # noqa: E731

    r = ambil()
    assert r.status_code == 200 and ids(r) == ['u4', 'u3', 'u2', 'u1'] and r.json()['total'] == 4
    assert ids(ambil(urut='ukuran', arah='asc')) == ['u2', 'u3', 'u4', 'u1']
    assert ids(ambil(urut='nama_berkas', arah='asc')) == ['u3', 'u4', 'u1', 'u2']
    halaman2 = ambil(per_halaman=3, halaman=2).json()
    assert [u['id'] for u in halaman2['item']] == ['u1'] and halaman2['total'] == 4 and halaman2['halaman'] == 2
    assert ids(ambil(format='pdf')) == ['u3', 'u2'] and ids(ambil(jenis='guru', mesin='openpyxl')) == ['u4']
    assert ids(ambil(guru_id='g1')) == ['u3'] and ids(ambil(aktor_id='kep')) == ['u2', 'u1']
    # Rentang tanggal memakai tanggal WIB (inklusif).
    assert ids(ambil(dari='2026-10-18', sampai='2026-10-18')) == ['u3', 'u2']
    assert ids(ambil(sampai='2026-10-17')) == ['u1'] and ids(ambil(dari='2026-10-19')) == ['u4']
    # Pencarian tanpa beda huruf, karakter regex aman.
    assert ids(ambil(cari='penilai')) == ['u4', 'u3'] and ids(ambil(cari='rekap_b')) == ['u2'] and ids(ambil(cari='.*')) == []

    for salah in ({'urut': 'ip_address'}, {'arah': 'naik'}, {'format': 'docx'}, {'per_halaman': 500}, {'halaman': 0},
                  {'dari': '2026-13-01'}, {'dari': '2026-10-19', 'sampai': '2026-10-18'}, {'periode_id': 'x y'}):
        assert ambil(**salah).status_code == 422, salah

    # Penilai hanya melihat unduhannya sendiri walau meminta aktor lain; guru biasa ditolak.
    pengguna['user'] = {'id': 'pen', 'roles': ['guru'], 'full_name': 'Penilai Satu'}
    assert ids(ambil()) == ['u4', 'u3'] and ids(ambil(aktor_id='kep')) == ['u4', 'u3']
    pengguna['user'] = {'id': 'g1', 'roles': ['guru'], 'full_name': 'Guru g1'}
    r = ambil()
    assert r.status_code == 403 and r.json()['detail']['alasan'] == 'bukan_penilai'


def test_audit_unduhan_berhasil_gagal_dan_lihat_riwayat(klien, monkeypatch):
    import pkg_penjaga
    import pkg_template
    k, d, pengguna = klien
    monkeypatch.setattr(pkg_penjaga, 'db', d)
    audit = lambda aksi: [a for a in d['pkg_audit_log'].docs if a['aksi'] == aksi]  # noqa: E731

    assert k.post('/api/pkg/cetak/pdf', json={'jenis': 'rekap', 'format': 'pdf'}).status_code == 200
    berhasil = audit('cetak_template')[-1]['metadata']
    assert berhasil['endpoint'] == '/api/pkg/cetak/pdf' and berhasil['checksum_berkas'] and berhasil['mesin'] == 'libreoffice'

    # 409 (lembar belum terkunci) dua kali -> satu entri harian berjumlah 2.
    for _ in range(2):
        assert k.post('/api/pkg/cetak', json={'jenis': 'guru', 'format': 'xlsx', 'guru_id': 'g2'}).status_code == 409
    gagal = audit('cetak_gagal')
    assert len(gagal) == 1 and gagal[0]['jumlah'] == 2 and gagal[0]['metadata']['status'] == 409
    assert gagal[0]['metadata']['guru_id'] == 'g2' and 'belum' in gagal[0]['metadata']['pesan']

    # 503 template tidak tersedia & 403 di luar cakupan juga tercatat; riwayat unduhan tidak bertambah.
    def tidak_ada(*a, **kw):
        raise pkg_template.TemplateTidakTersedia('Berkas template tidak ditemukan.')
    monkeypatch.setattr(api, 'rekap_excel', tidak_ada)
    assert k.post('/api/pkg/cetak', json={'jenis': 'rekap', 'format': 'xlsx'}).status_code == 503
    pengguna['user'] = {'id': 'pen', 'roles': ['guru'], 'full_name': 'Penilai Satu'}
    assert k.post('/api/pkg/cetak', json={'jenis': 'guru', 'format': 'xlsx', 'guru_id': 'g3'}).status_code == 403
    status = sorted(g['metadata']['status'] for g in audit('cetak_gagal'))
    assert status == [403, 409, 503] and audit('cetak_gagal')[-1]['metadata']['alasan'] == 'bukan_penugasan'
    assert len(d['pkg_unduhan'].docs) == 1

    # Membuka riwayat unduhan dicatat harian.
    k.get('/api/pkg/cetak/unduhan')
    k.get('/api/pkg/cetak/unduhan', params={'format': 'pdf'})
    lihat = audit('lihat_unduhan')
    assert len(lihat) == 1 and lihat[0]['jumlah'] == 2 and lihat[0]['aktor_id'] == 'pen'
