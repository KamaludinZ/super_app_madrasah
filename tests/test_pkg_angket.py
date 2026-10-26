"""Angket 360°: butir dari template resmi, berkas cetak FORM-360-GR, dan API cetak angket (otorisasi & riwayat)."""

import io
import os
import sys

import pytest
from openpyxl import load_workbook

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pkg_angket  # noqa: E402
from routers import pkg_angket_api as api  # noqa: E402
from routers import pkg_cetak_api  # noqa: E402
from tests.pkg_palsu import Db, Koleksi  # noqa: E402


def test_butir_sesuai_sheet_template():
    jumlah = {j['jenis']: (j['jumlah_butir'], j['skor_maks']) for j in pkg_angket.daftar_jenis()}
    assert jumlah == {'sejawat': (28, 56), 'siswa': (40, 80), 'ortu': (8, 16)}
    sejawat = pkg_angket.butir_angket('sejawat')
    assert sejawat[0]['komponen'] == 'Perilaku Guru sehari-hari' and sejawat[0]['pernyataan'].startswith('Guru mentaati')
    assert sejawat[10]['komponen'] == 'Hubungan Guru dengan Teman Sejawat' and sejawat[10]['nomor'] == 1
    assert [b['kode'] for b in sejawat[:2]] == ['sejawat.1', 'sejawat.2'] and sejawat[-1]['baris'] == 36


def test_berkas_angket_hanya_bagian_form():
    wb = load_workbook(io.BytesIO(pkg_angket.angket_excel('siswa', {'nama': 'Budi', 'nip': '123', 'tugas_tambahan': None})))
    ws = wb['FORM-360-GR']
    assert (ws['E56'].value, ws['E57'].value, ws['E58'].value) == (': Budi', ': 123', ': -')
    assert ws['E6'].value.startswith(': …')  # bagian lain tidak diubah
    assert ws.print_area == "'FORM-360-GR'!$B$52:$H$124" and wb.active.title == 'FORM-360-GR'
    lain = [w for w in wb.worksheets if w.title != 'FORM-360-GR']
    assert all(w.sheet_state == 'hidden' for w in lain)
    assert all(not w.print_area or w.print_area.endswith('!') for w in lain)  # area cetak sheet tersembunyi dihapus
    kosong = load_workbook(io.BytesIO(pkg_angket.angket_excel('ortu')))['FORM-360-GR']
    assert kosong['E159'].value.startswith(': …')


@pytest.mark.parametrize('jenis', ['sejawat', 'siswa', 'ortu'])
def test_berkas_angket_muat_satu_lembar_a4(jenis):
    ws = load_workbook(io.BytesIO(pkg_angket.angket_excel(jenis, {'nama': 'Budi', 'nip': '1', 'tugas_tambahan': None})))['FORM-360-GR']
    assert ws.sheet_properties.pageSetUpPr.fitToPage is True
    assert (ws.page_setup.fitToWidth, ws.page_setup.fitToHeight) == (1, 1)
    assert int(ws.page_setup.paperSize) == int(ws.PAPERSIZE_A4) and ws.page_setup.orientation == 'portrait'
    assert ws.print_options.horizontalCentered and not ws.row_breaks.brk and ws.page_margins.left <= 0.5
    a, b = pkg_angket.JENIS_ANGKET[jenis]['form']
    sembunyi = {r for x, y in pkg_angket.JENIS_ANGKET[jenis]['sembunyi'] for r in range(x, y + 1)}
    assert sembunyi and all(ws.row_dimensions[r].hidden for r in sembunyi) and a < min(sembunyi) and max(sembunyi) <= b


@pytest.mark.parametrize('jenis', ['sejawat', 'siswa', 'ortu'])
def test_pdf_cadangan_angket_satu_halaman(jenis):
    import re
    from pkg_pdf_cadangan import angket_pdf_cadangan
    for guru in (None, {'nama': 'Budi', 'nip': '1', 'tugas_tambahan': 'Wali Kelas'}):
        pdf = angket_pdf_cadangan(jenis, guru)
        assert pdf.startswith(b'%PDF') and len(re.findall(rb'/Type\s*/Page(?!s)', pdf)) == 1


@pytest.fixture
def klien(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from core import get_current_user
    d = Db({
        'pkg_periode': Koleksi([{'id': 'p1', 'status': 'berjalan', 'nama_periode': 'Ganjil', 'tanggal_buka': '2026-10-01'}]),
        'pkg_sk': Koleksi([{'id': 's1', 'periode_id': 'p1', 'is_active': True, 'penilai_ids': ['pen'], 'dinilai_ids': ['g1', 'g2'],
                            'snapshot_anggota': {'g1': {'nama': 'Guru Satu', 'nip': 'NIP-g1'}}}]),
        'pkg_penugasan': Koleksi([{'periode_id': 'p1', 'penilai_id': 'pen', 'guru_dinilai_ids': ['g1']}]),
        'pkg_penilaian': Koleksi([]),
        'users': Koleksi([{'id': 'g1', 'full_name': 'Guru Satu', 'tugas_tambahan': 'Wali Kelas 7A'}]),
    })
    monkeypatch.setattr(api, 'db', d)
    monkeypatch.setattr(pkg_cetak_api, 'kemampuan_pdf', lambda: {'libreoffice': False, 'mesin': 'reportlab', 'identik': False})
    app = FastAPI()
    app.include_router(api.router, prefix='/api')
    pengguna = {'user': {'id': 'kep', 'roles': ['kepala_sekolah'], 'full_name': 'Kepala'}}
    app.dependency_overrides[get_current_user] = lambda: pengguna['user']
    return TestClient(app), d, pengguna


def test_cetak_angket_excel_dan_pdf(klien):
    k, d, _ = klien
    r = k.post('/api/pkg/angket/cetak', json={'jenis_angket': 'sejawat', 'format': 'xlsx', 'guru_id': 'g1'})
    assert r.status_code == 200 and 'Angket_360_Teman_Sejawat_Guru_Satu' in r.headers['content-disposition']
    ws = load_workbook(io.BytesIO(r.content))['FORM-360-GR']
    assert (ws['E6'].value, ws['E8'].value) == (': Guru Satu', ': Wali Kelas 7A')
    u = d['pkg_unduhan'].docs[0]
    assert (u['jenis'], u['guru_id'], u['format']) == ('angket', 'g1', 'xlsx')
    assert d['pkg_audit_log'].docs[-1]['metadata']['jenis_angket'] == 'sejawat'
    pdf = k.post('/api/pkg/angket/cetak', json={'jenis_angket': 'ortu'})  # bawaan PDF, angket kosong
    assert pdf.status_code == 200 and pdf.content.startswith(b'%PDF')
    assert pdf.headers['x-pkg-mesin'] == 'reportlab' and pdf.headers['x-pkg-cadangan'] == 'libreoffice_tidak_tersedia'


def test_cetak_angket_otorisasi(klien):
    k, d, pengguna = klien
    pengguna['user'] = {'id': 'pen', 'roles': ['guru']}
    assert k.post('/api/pkg/angket/cetak', json={'jenis_angket': 'siswa', 'format': 'xlsx', 'guru_id': 'g1'}).status_code == 200
    assert k.post('/api/pkg/angket/cetak', json={'jenis_angket': 'siswa', 'guru_id': 'g2'}).status_code == 403  # bukan guru yang dinilainya
    pengguna['user'] = {'id': 'g2', 'roles': ['guru']}
    r = k.post('/api/pkg/angket/cetak', json={'jenis_angket': 'siswa'})
    assert r.status_code == 403 and r.json()['detail']['alasan'] == 'bukan_penilai'
    assert k.post('/api/pkg/angket/cetak', json={'jenis_angket': 'dudi'}).status_code == 422  # DUDI tidak dipakai
    assert any(a['aksi'] == 'cetak_gagal' for a in d['pkg_audit_log'].docs)


def test_nilai_responden_dan_hasil_rata_rata():
    n = pkg_angket.nilai_responden([2] * 27 + [1])  # sejawat: 55 / 56 x 100
    assert (n['skor'], n['skor_maks'], n['nilai'], n['sebutan']) == (55, 56, 98.21, 'Amat Baik')
    assert pkg_angket.nilai_responden([1] * 8)['sebutan'] == 'Kurang'  # 50 -> <= 50 Kurang
    r = pkg_angket.ringkas_jenis('ortu', [{'nilai': 93.75}, {'nilai': 100.0}])
    assert (r['jumlah_responden'], r['nilai'], r['sebutan']) == (2, 96.88, 'Amat Baik')
    assert pkg_angket.ringkas_jenis('siswa', [])['nilai'] is None


def test_input_jawaban_angket(klien):
    k, d, pengguna = klien
    d['pkg_periode'].docs[0]['status'] = 'berjalan'
    url = '/api/pkg/angket/guru/g1/jawaban'
    r = k.post(url, json={'jenis_angket': 'ortu', 'nama_responden': ' Ibu Ani ', 'jawaban': [2, 2, 2, 2, 2, 2, 1, 1]})
    assert r.status_code == 200 and (r.json()['urutan'], r.json()['nilai'], r.json()['nama_responden']) == (1, 87.5, 'Ibu Ani')
    assert k.post(url, json={'jenis_angket': 'ortu', 'jawaban': [2] * 7}).status_code == 422  # jumlah butir salah
    assert k.post(url, json={'jenis_angket': 'ortu', 'jawaban': [3] * 8}).status_code == 422  # skor di luar 0/1/2
    kedua = k.post(url, json={'jenis_angket': 'ortu', 'jawaban': [2] * 8}).json()
    data = k.get('/api/pkg/angket/guru/g1').json()
    ortu = next(j for j in data['jenis'] if j['jenis'] == 'ortu')
    assert (ortu['jumlah_responden'], ortu['nilai'], len(ortu['butir'])) == (2, 93.75, 8) and data['lengkap'] is False
    assert k.put(f"/api/pkg/angket/jawaban/{kedua['id']}", json={'jenis_angket': 'ortu', 'jawaban': [0] * 8}).json()['nilai'] == 0
    assert k.put(f"/api/pkg/angket/jawaban/{kedua['id']}", json={'jenis_angket': 'siswa', 'jawaban': [0] * 40}).status_code == 422
    assert k.delete(f"/api/pkg/angket/jawaban/{kedua['id']}").status_code == 200
    ketiga = k.post(url, json={'jenis_angket': 'ortu', 'jawaban': [1] * 8}).json()
    assert ketiga['urutan'] == 2  # kolom penilai kosong dipakai lagi
    for _ in range(8):
        k.post(url, json={'jenis_angket': 'ortu', 'jawaban': [1] * 8})
    assert k.post(url, json={'jenis_angket': 'ortu', 'jawaban': [1] * 8}).status_code == 409  # maks 10 responden
    ringkas = k.get('/api/pkg/angket/ringkasan').json()['guru']
    g1 = next(g for g in ringkas if g['guru_id'] == 'g1')
    assert g1['per_jenis']['ortu']['jumlah_responden'] == 10 and g1['per_jenis']['sejawat']['nilai'] is None
    assert [a['aksi'] for a in d['pkg_audit_log'].docs].count('angket_simpan') == 11
    pengguna['user'] = {'id': 'pen', 'roles': ['guru']}
    assert k.get('/api/pkg/angket/guru/g2').status_code == 403
    d['pkg_periode'].docs[0]['status'] = 'ditutup'
    pengguna['user'] = {'id': 'kep', 'roles': ['kepala_sekolah']}
    assert k.post(url, json={'jenis_angket': 'ortu', 'periode_id': 'p1', 'jawaban': [1] * 8}).status_code == 409


def test_isi_lembar_360_dan_form():
    import pkg_cetak
    import pkg_template
    jw = [2] * 27 + [0]
    responden = {'sejawat': [{'urutan': 1, 'jawaban': jw}, {'urutan': 3, 'jawaban': [1] * 28}], 'siswa': [], 'ortu': []}
    wb = load_workbook(io.BytesIO(pkg_template.isi_template_ke_bytes('instrumen', lambda w: (
        pkg_angket.isi_lembar_360(w, responden), pkg_angket.isi_identitas_form_360(w, {'nama': 'Guru A', 'nip': '1'})))))
    ws = wb['SEJAWAT']
    assert (ws['H7'].value, ws['K7'].value, ws['N7'].value) == (1, None, 3)  # nomor penilai per blok kolom
    assert (ws['H9'].value, ws['F36'].value, ws['H36'].value) == ('v', 'v', None)  # responden 1: butir terakhir skor 0
    assert ws['M9'].value == 'v' and ws['G9'].value is None  # responden 3 skor 1 di blok L/M/N
    assert ws['AL40'].value.startswith('=SUM(') and ws['AB6'].value == '=AL40'  # rumus template utuh
    assert wb['ORTU']['H9'].value is None and wb['ORTU']['AL20'].value.startswith('=IFERROR(')  # tanpa responden
    assert wb['DUDI']['AL22'].value.startswith('=SUM(')  # DUDI tidak disentuh
    form = wb['FORM-360-GR']
    assert (form['E6'].value, form['E56'].value, form['E159'].value) == (': Guru A', ': Guru A', ': Guru A')
    assert form['E204'].value is None or str(form['E204'].value).startswith(':')  # bagian DUDI dibiarkan
    instr = load_workbook(io.BytesIO(pkg_template.isi_template_ke_bytes('instrumen', lambda w: pkg_cetak.isi_form_instr(
        w, {'guru': {'nama': 'Guru A', 'nip': '1'}, 'penilai': {'nama': 'P'}, 'sekolah': {'kota': 'Kota Malang'},
            'periode': {'tanggal_penilaian': '2 November 2026'}}))))['FORM-INSTR']
    assert (instr['E4'].value, instr['E7'].value, instr['E9'].value) == (': Guru A', ': P', ': Kota Malang, 2 November 2026')


def _png(goresan=True, latar=(0, 0, 0, 0)):
    import base64
    from PIL import Image, ImageDraw
    img = Image.new('RGBA', (300, 120), latar)
    if goresan:
        ImageDraw.Draw(img).line([(20, 60), (150, 30), (280, 90)], fill=(15, 23, 42, 255), width=4)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


def test_olah_tanda_tangan():
    assert pkg_angket.olah_tanda_tangan(_png()).startswith(b'\x89PNG')
    assert pkg_angket.olah_tanda_tangan(_png(latar=(255, 255, 255, 255))).startswith(b'\x89PNG')  # latar putih
    for salah in (_png(goresan=False), _png(goresan=False, latar=(255, 255, 255, 255)),
                  'data:image/png;base64,' + 'QUJD' * 10, 'data:image/png;base64,!!'):
        with pytest.raises(ValueError):
            pkg_angket.olah_tanda_tangan(salah)


def test_slot_responden_serentak():
    import asyncio
    from pymongo.errors import DuplicateKeyError

    class KoleksiUnik(Koleksi):
        async def insert_one(self, doc):
            if doc.get('slot') and any(d.get('slot') == doc['slot'] for d in self.docs):
                raise DuplicateKeyError('slot')
            await super().insert_one(doc)

    d = Db({'pkg_angket': KoleksiUnik([{'id': 'x', 'periode_id': 'p1', 'guru_dinilai_id': 'g1', 'jenis': 'ortu', 'urutan': 2}])})
    asli, baca = pkg_angket.responden_guru, []

    async def basi(db, *a, **kw):  # bacaan pertama belum melihat pengisian lain yang baru menempati kolom 1
        baca.append(1)
        return [r for r in await asli(db, *a, **kw) if len(baca) > 1 or r['urutan'] != 1]
    d['pkg_angket'].docs.append({'id': 'y', 'periode_id': 'p1', 'guru_dinilai_id': 'g1', 'jenis': 'ortu', 'urutan': 1, 'slot': 'p1:g1:ortu:1'})
    pkg_angket.responden_guru = basi
    try:
        doc = asyncio.run(pkg_angket.tambah_responden(d, 'p1', 'g1', 'ortu', [2] * 8, 'A', None, sumber='publik'))
    finally:
        pkg_angket.responden_guru = asli
    assert (doc['urutan'], doc['slot'], doc['sumber'], doc['diinput_oleh']) == (3, 'p1:g1:ortu:3', 'publik', None)
    assert len(baca) == 2  # kolom 1 bentrok -> dibaca ulang -> kolom 3


@pytest.fixture
def klien_publik(klien, monkeypatch):
    from fastapi.testclient import TestClient
    from routers import pkg_angket_publik_api as publik
    k, d, pengguna = klien
    monkeypatch.setattr(publik, 'db', d)
    k.app.include_router(publik.router, prefix='/api')
    d['users'].docs.append({'id': 'kep', 'full_name': 'Kepala', 'roles': ['kepala_sekolah']})
    d['pkg_sk'].docs[0]['dinilai_ids'] = ['g2', 'g1', 'kep']
    d['pkg_sk'].docs[0]['snapshot_anggota']['g2'] = {'nama': 'Ahmad Guru', 'mapel': 'IPA'}
    return TestClient(k.app), d, pengguna


def test_tautan_angket_online(klien_publik):
    k, d, pengguna = klien_publik
    t = k.get('/api/pkg/angket/tautan').json()
    assert len(t['token']) >= 16 and t['aktif'] and t['terbuka'] and t['boleh_kelola'] and t['periode']['id'] == 'p1'
    assert k.get('/api/pkg/angket/tautan').json()['token'] == t['token'] and len(d['pkg_angket_tautan'].docs) == 1
    pengguna['user'] = {'id': 'pen', 'roles': ['guru'], 'full_name': 'Penilai'}
    t2 = k.get('/api/pkg/angket/tautan').json()
    assert t2['token'] == t['token'] and t2['boleh_kelola'] is False  # penilai boleh menyalin, tidak boleh mengelola
    assert k.post('/api/pkg/angket/tautan/ganti', json={}).status_code == 403
    assert k.post('/api/pkg/angket/tautan/status', json={'aktif': False}).status_code == 403
    pengguna['user'] = {'id': 'g2', 'roles': ['guru']}
    assert k.get('/api/pkg/angket/tautan').status_code == 403  # guru dinilai bukan pengelola
    pengguna['user'] = {'id': 'kep', 'roles': ['kepala_sekolah'], 'full_name': 'Kepala'}
    baru = k.post('/api/pkg/angket/tautan/ganti', json={}).json()
    assert baru['token'] != t['token'] and d['pkg_audit_log'].docs[-1]['aksi'] == 'angket_tautan_ganti'
    assert k.get(f"/api/public/pkg/angket/{t['token']}").status_code == 404  # tautan lama mati
    assert k.get(f"/api/public/pkg/angket/{baru['token']}").status_code == 200

    tutup = k.post('/api/pkg/angket/tautan/status', json={'aktif': False}).json()
    assert (tutup['aktif'], tutup['terbuka'], tutup['token'], tutup['status_oleh_nama']) == (False, False, baru['token'], 'Kepala')
    assert d['pkg_audit_log'].docs[-1]['aksi'] == 'angket_tautan_status'
    assert k.post('/api/pkg/angket/tautan/ganti', json={}).json()['aktif'] is False  # ganti token tidak membuka tautan
    token = k.get('/api/pkg/angket/tautan').json()['token']
    publik = k.get(f'/api/public/pkg/angket/{token}').json()
    assert publik['terbuka'] is False and publik['guru'] == [] and 'ditutup oleh madrasah' in publik['pesan']
    isi = {'jenis_angket': 'ortu', 'guru_id': 'g1', 'nama_responden': 'Ibu Ani', 'jawaban': [2] * 8, 'tanda_tangan': _png()}
    assert k.post(f'/api/public/pkg/angket/{token}/jawaban', json=isi).status_code == 409
    assert k.post('/api/pkg/angket/tautan/status', json={'aktif': True}).json()['terbuka'] is True
    assert k.post(f'/api/public/pkg/angket/{token}/jawaban', json=isi).status_code == 200


def test_isi_angket_online(klien_publik):
    k, d, pengguna = klien_publik
    token = k.get('/api/pkg/angket/tautan').json()['token']
    url = f'/api/public/pkg/angket/{token}'
    pengguna['user'] = None  # endpoint publik tidak memakai login
    data = k.get(url).json()
    assert data['terbuka'] and data['periode']['nama_periode'] == 'Ganjil' and data['maks_responden'] == 10
    assert [g['nama'] for g in data['guru']] == ['Ahmad Guru', 'Guru Satu']  # urut nama, kepala tidak dinilai
    assert 'nip' not in data['guru'][1] and data['guru'][1]['jumlah'] == {'sejawat': 0, 'siswa': 0, 'ortu': 0}
    assert [(j['jenis'], j['jumlah_butir'], len(j['butir'])) for j in data['jenis']] == [('sejawat', 28, 28), ('siswa', 40, 40), ('ortu', 8, 8)]

    isi = {'jenis_angket': 'ortu', 'guru_id': 'g1', 'nama_responden': '  Ibu   Ani ', 'jawaban': [2] * 7 + [1], 'tanda_tangan': _png()}
    r = k.post(f'{url}/jawaban', json=isi)
    assert r.status_code == 200, r.text
    assert (r.json()['urutan'], r.json()['jumlah_responden'], r.json()['guru_nama']) == (1, 1, 'Guru Satu')
    doc = d['pkg_angket'].docs[0]
    assert (doc['nama_responden'], doc['sumber'], doc['ada_ttd'], doc['nilai'], doc['diinput_oleh']) == ('Ibu Ani', 'publik', True, 93.75, None)
    assert d['pkg_angket_ttd'].docs[0]['responden_id'] == doc['id']
    assert d['pkg_audit_log'].docs[-1]['aksi'] == 'angket_isi_publik'
    assert k.get(url).json()['guru'][1]['jumlah']['ortu'] == 1

    assert k.post(f'{url}/jawaban', json={**isi, 'nama_responden': 'ibu ani'}).status_code == 409  # nama sama
    assert k.post(f'{url}/jawaban', json={**isi, 'nama_responden': 'Pak Budi', 'tanda_tangan': _png(goresan=False)}).status_code == 422
    assert k.post(f'{url}/jawaban', json={**isi, 'nama_responden': ' '}).status_code == 422
    assert k.post(f'{url}/jawaban', json={**isi, 'nama_responden': 'Pak Budi', 'jawaban': [2] * 7}).status_code == 422
    assert k.post(f'{url}/jawaban', json={**isi, 'nama_responden': 'Pak Budi', 'guru_id': 'kep'}).status_code == 422
    assert k.post(f'{url}/jawaban', json={**isi, 'nama_responden': 'Pak Budi', 'tanda_tangan': 'data:image/jpeg;base64,AAAA'}).status_code == 422
    assert k.post('/api/public/pkg/angket/tokentidakadasama/jawaban', json=isi).status_code == 404
    for i in range(9):
        assert k.post(f'{url}/jawaban', json={**isi, 'nama_responden': f'Wali {i}'}).status_code == 200
    penuh = k.post(f'{url}/jawaban', json={**isi, 'nama_responden': 'Wali 10'})
    assert penuh.status_code == 409 and 'kuota penuh' in penuh.json()['detail']

    pengguna['user'] = {'id': 'kep', 'roles': ['kepala_sekolah'], 'full_name': 'Kepala'}
    ortu = next(j for j in k.get('/api/pkg/angket/guru/g1').json()['jenis'] if j['jenis'] == 'ortu')
    assert ortu['jumlah_responden'] == 10 and ortu['responden'][0]['sumber'] == 'publik' and ortu['responden'][0]['ada_ttd']
    ttd = k.get(f"/api/pkg/angket/jawaban/{doc['id']}/ttd")
    assert ttd.status_code == 200 and ttd.headers['content-type'] == 'image/png' and ttd.content.startswith(b'\x89PNG')
    assert k.delete(f"/api/pkg/angket/jawaban/{doc['id']}").status_code == 200
    assert not [t for t in d['pkg_angket_ttd'].docs if t['responden_id'] == doc['id']]
    assert k.get(f"/api/pkg/angket/jawaban/{doc['id']}/ttd").status_code == 404

    d['pkg_periode'].docs[0]['status'] = 'ditutup'
    tutup = k.get(url).json()
    assert tutup['terbuka'] is False and tutup['guru'] == [] and 'tidak sedang berjalan' in tutup['pesan']
    assert k.post(f'{url}/jawaban', json={**isi, 'nama_responden': 'Pak Budi'}).status_code == 409
