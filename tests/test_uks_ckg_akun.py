"""Data CKG (input manual & impor) terhubung ke akun pasien: form edit mendapat tingkat/kelas siswa & kategori GTK,
data tanpa akun ditandai, dan siswa/GTK bisa melihat hasil CKG miliknya sendiri (GET /uks/ckg/saya)."""

import asyncio
import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import ckg_kolom  # noqa: E402
from routers import uks  # noqa: E402
from tests.pkg_palsu import Db, Koleksi  # noqa: E402

SISWA = {'id': 's1', 'full_name': 'Ani', 'roles': ['siswa'], 'student_class_id': 'k8b', 'active_role': 'siswa'}
GURU = {'id': 'g1', 'full_name': 'Budi', 'roles': ['guru', 'wali_kelas'], 'active_role': 'guru'}
TENDIK = {'id': 't1', 'full_name': 'Cici', 'roles': ['tenaga_kependidikan'], 'active_role': 'tenaga_kependidikan'}


def jalan(coro):
    return asyncio.run(coro)


@pytest.fixture
def db(monkeypatch):
    d = Db({
        'users': Koleksi([SISWA, GURU, TENDIK]),
        'classes': Koleksi([{'id': 'k8b', 'name': '8B', 'grade': 8}]),
        'student_details': Koleksi([]),
        'uks_ckg': Koleksi([
            # hasil impor (sumber impor) & input manual tersimpan dengan pasien_id = id akun
            {'id': 'c1', 'pasien_id': 's1', 'pasien_nama': 'Ani', 'pasien_roles': ['siswa'], 'tanggal': '2026-09-01',
             'tinggi_badan': 150, 'berat_badan': 45, 'sumber': 'impor:baku', 'created_at': '2026-09-01T01:00:00'},
            {'id': 'c2', 'pasien_id': 's1', 'pasien_nama': 'Ani', 'pasien_roles': ['siswa'], 'tanggal': '2025-08-01',
             'tinggi_badan': 145, 'berat_badan': 40, 'created_at': '2025-08-01T01:00:00'},
            {'id': 'c3', 'pasien_id': 't1', 'pasien_nama': 'Cici', 'pasien_roles': ['tenaga_kependidikan'],
             'tanggal': '2026-09-02', 'tinggi_badan': 160, 'berat_badan': 55, 'sumber': 'impor:baku', 'created_at': 'x'},
            {'id': 'c4', 'pasien_id': 'hilang', 'pasien_nama': 'Akun Terhapus', 'pasien_roles': ['siswa'],
             'tanggal': '2026-09-03', 'created_at': 'y'},
        ]),
        'uks_imunisasi': Koleksi([{'id': 'i1', 'pasien_id': 'g1', 'pasien_nama': 'Budi', 'tanggal': '2026-09-04', 'jenis_vaksin': 'HPV'}]),
    })
    monkeypatch.setattr(uks, 'db', d)
    return d


def test_daftar_ckg_berisi_data_form_edit_dan_penanda_akun(db):
    items = {i['id']: i for i in jalan(ckg_kolom.lengkapi_identitas_ckg(db, db['uks_ckg'].docs, 'MTsN 2'))}
    s = items['c1']
    assert (s['pasien_terhubung'], s['pasien_kelas_id'], s['pasien_tingkat'], s['pasien_kelas']) == (True, 'k8b', 8, '8B')
    t = items['c3']
    assert (t['pasien_terhubung'], t['pasien_jenis_gtk'], t['pasien_tipe']) == (True, 'tendik', 'gtk')
    assert items['c4']['pasien_terhubung'] is False  # pasien_id tidak cocok dengan akun mana pun


def test_daftar_imunisasi_berisi_data_form_edit(db):
    item = jalan(uks.list_imunisasi(user={'id': 'u', 'roles': ['admin'], 'active_role': 'admin'}))[0]
    assert (item['pasien_terhubung'], item['pasien_jenis_gtk'], item['pasien_roles']) == (True, 'guru', ['guru', 'wali_kelas'])


def test_ckg_saya_siswa_dan_gtk(db):
    hasil = jalan(uks.get_ckg_saya(None, SISWA))
    assert hasil['pasien'] == {'id': 's1', 'nama': 'Ani', 'kelas': '8B', 'jenis': 'siswa'}
    assert [i['id'] for i in hasil['items']] == ['c1', 'c2']  # termasuk hasil impor, terbaru dulu
    assert hasil['ringkasan']['total'] == 2 and hasil['ringkasan']['perubahan_tinggi_badan'] == 5.0
    assert hasil['tahun_tersedia'] == ['2026', '2025']
    assert [i['id'] for i in jalan(uks.get_ckg_saya('2025', SISWA))['items']] == ['c2']

    gtk = jalan(uks.get_ckg_saya(None, TENDIK))
    assert gtk['pasien']['jenis'] == 'gtk' and [i['id'] for i in gtk['items']] == ['c3']
    assert jalan(uks.get_ckg_saya(None, GURU))['items'] == []  # hanya data milik sendiri

    with pytest.raises(HTTPException) as e:
        jalan(uks.get_ckg_saya(None, {'id': 'k8b', 'roles': ['kelas'], 'active_role': 'kelas'}))
    assert e.value.status_code == 403
