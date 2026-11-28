"""Menu Import Excel admin (/admin/import): berkas berisi satu baris tetap berhasil untuk kelima jenis impor, berkas
dengan tag dimensi keliru tetap terbaca, berkas rusak dijawab 400 (bukan 500), dan admin dapat mengubah username siswa."""
import io
import os
import re
import sys
import zipfile

import pytest
from openpyxl import load_workbook

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import excel_io  # noqa: E402
from ujian_dasar import buat_klien, tambah_kelas_siswa  # noqa: E402

XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
KASUS = [
    ('/users/gtk-combined-template', '/users/import-gtk-combined', 'users'),
    ('/students/combined-template', '/students/import-combined', 'users'),
    ('/rooms/excel-template', '/rooms/import-excel', 'rooms'),
    ('/classes/excel-template', '/classes/import-excel', 'classes'),
    ('/subjects/excel-template', '/subjects/import-excel', 'subjects'),
]


@pytest.fixture
def klien(monkeypatch):
    k = buat_klien(monkeypatch)
    tambah_kelas_siswa(k.db)
    return k


def satu_baris(isi_template: bytes) -> bytes:
    """Template resmi yang hanya menyisakan header + satu baris contoh."""
    wb = load_workbook(io.BytesIO(isi_template))
    ws = wb.worksheets[0]
    ws.delete_rows(3, ws.max_row)
    b = io.BytesIO()
    wb.save(b)
    return b.getvalue()


def dimensi_keliru(isi: bytes, ref: bytes = b'A1') -> bytes:
    """Tiru berkas dari aplikasi yang menulis tag <dimension> keliru (mode read_only openpyxl mempercayainya)."""
    zin, out = zipfile.ZipFile(io.BytesIO(isi)), io.BytesIO()
    with zipfile.ZipFile(out, 'w') as zout:
        for it in zin.infolist():
            data = zin.read(it.filename)
            if it.filename == 'xl/worksheets/sheet1.xml':
                data = re.sub(rb'<dimension ref="[^"]*"\s*/>', b'<dimension ref="' + ref + b'"/>', data)
            zout.writestr(it, data)
    return out.getvalue()


def _impor(klien, url, isi):
    if url == '/classes/import-excel':  # contoh template = kelas 7A, yang sudah ada di data dasar uji
        klien.db.classes.docs = [c for c in klien.db.classes.docs if c['name'] != '7A']
    return klien('admin', 'admin', 'POST', url, files={'file': ('data.xlsx', isi, XLSX)})


@pytest.mark.parametrize('tpl,imp,koleksi', KASUS)
def test_impor_satu_baris_berhasil(klien, tpl, imp, koleksi):
    r = klien('admin', 'admin', 'GET', tpl)
    assert r.status_code == 200
    isi = satu_baris(r.content)
    if imp == '/classes/import-excel':
        klien.db.classes.docs = [c for c in klien.db.classes.docs if c['name'] != '7A']
    awal = len(getattr(klien.db, koleksi).docs)
    r = _impor(klien, imp, isi)
    assert r.status_code == 200, r.text
    assert r.json()['success'] == 1 and r.json()['total_rows'] == 1 and r.json()['errors'] == []
    assert len(getattr(klien.db, koleksi).docs) == awal + 1


@pytest.mark.parametrize('tpl,imp,koleksi', KASUS)
@pytest.mark.parametrize('ref', [b'A1', b'A1:A2'])
def test_impor_berkas_dengan_dimensi_keliru(klien, tpl, imp, koleksi, ref):
    isi = dimensi_keliru(satu_baris(klien('admin', 'admin', 'GET', tpl).content), ref)
    r = _impor(klien, imp, isi)
    assert r.status_code == 200, r.text
    assert r.json()['success'] == 1, r.json()


def test_parser_memanjangkan_baris_pendek():
    wb = load_workbook(io.BytesIO(excel_io.subject_template()))
    ws = wb.worksheets[0]
    ws.delete_rows(2, ws.max_row)
    ws.append(['MTK'])  # hanya kolom kode; kolom nama kosong
    b = io.BytesIO()
    wb.save(b)
    rows = excel_io.parse_subject_rows(dimensi_keliru(b.getvalue(), b'A1:A2'))
    assert [(r['code'], r['name']) for r in rows] == [('MTK', '')]


@pytest.mark.parametrize('imp', [k[1] for k in KASUS])
def test_impor_berkas_rusak_400(klien, imp):
    r = _impor(klien, imp, b'bukan excel')
    assert r.status_code == 400 and 'Excel' in r.json()['detail']


def test_admin_ubah_username_siswa(klien):
    db = klien.db
    sid = 's-k7a-1'
    r = klien('admin', 'admin', 'PUT', f'/users/{sid}', json={'username': '  siswa.baru  ', 'full_name': 'Siswa 7A 1', 'roles': ['siswa']})
    assert r.status_code == 200, r.text
    assert r.json()['username'] == 'siswa.baru' and next(u for u in db.users.docs if u['id'] == sid)['username'] == 'siswa.baru'
    r = klien('admin', 'admin', 'PUT', f'/users/{sid}', json={'username': 's-k7a-2'})
    assert r.status_code == 400 and 'sudah digunakan' in r.json()['detail']
    r = klien('admin', 'admin', 'PUT', f'/users/{sid}', json={'username': 'siswa baru'})
    assert r.status_code == 400 and 'spasi' in r.json()['detail']
    assert klien('guru1', 'guru', 'PUT', f'/users/{sid}', json={'username': 'x'}).status_code == 403
