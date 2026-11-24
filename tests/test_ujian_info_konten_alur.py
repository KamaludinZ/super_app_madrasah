"""Alur HTTP menu Info Ujian (ber-login): admin mengisi tata tertib & panduan CBT halaman siswa; pemantau hanya melihat."""
import os
import sys
from datetime import datetime

import pytest

sys.path.insert(0, os.path.dirname(__file__))

from ujian_dasar import HARI_INI, buat_klien, ujian_doc  # noqa: E402

PDF = b'%PDF-1.4\n%panduan\n'
URL = '/ujian/uas/info-konten'


@pytest.fixture
def klien(monkeypatch, tmp_path):
    import penyimpanan
    import routers.ujian_info_konten as rik
    import ujian_info
    monkeypatch.setattr(penyimpanan, 'UPLOAD_ROOT', str(tmp_path))
    k = buat_klien(monkeypatch)
    kini = datetime.fromisoformat(f'{HARI_INI}T08:00:00+07:00')
    k.detik = 0

    def sekarang():
        k.detik += 1  # tiap penyimpanan mendapat waktu (= versi) berbeda
        return kini.replace(second=k.detik % 60, minute=k.detik // 60)
    monkeypatch.setattr(rik, 'sekarang_wib', sekarang)
    monkeypatch.setattr(ujian_info, 'sekarang_wib', sekarang)
    k.folder = tmp_path / 'ujian_info'
    k.db.ujian.docs.append(ujian_doc('uas', 'UAS', 'sem-kini', '2026-12-01', '2026-12-06', nama='ASAS Ganjil 2026/2027'))
    k.db.panitia_ujian.docs += [{'id': 'p1', 'ujian_id': 'uas', 'jabatan': 'ketua', 'user_id': 'guru1'},
                                {'id': 'p2', 'ujian_id': 'uas', 'jabatan': 'bendahara', 'user_id': 'guru2'}]
    return k


def simpan(k, isi, versi=None, uid='admin', peran='admin'):
    return k(uid, peran, 'PUT', URL, json={'versi': versi, **isi})


def buka_tautan_info(k):
    """Tautan info dibuat saat menu dibuka; dibuka (aktif) agar halaman publik dapat diakses."""
    token = k('admin', 'admin', 'GET', URL).json()['tautan_info']['token']
    t = next(t for t in k.db.ujian_tautan_publik.docs if t['token'] == token)
    t['aktif'] = True
    return t


def unggah(k, nama='Panduan CBT.pdf', isi=PDF, uid='admin', peran='admin'):
    return k(uid, peran, 'POST', f'{URL}/panduan-pdf', files={'berkas': (nama, isi, 'application/pdf')})


def test_menu_info_ujian_terdaftar_dan_sama_dengan_frontend():
    import re

    import ujian as uj
    keys = [m[0] for m in uj.MENU_UJIAN]
    assert keys.index('info_ujian') == keys.index('tautan_publik') + 1
    kamad = {m['key']: m for m in uj.menu_panitia_ujian(False, True, [])}
    ketua = {m['key']: m for m in uj.menu_panitia_ujian(False, False, ['ketua'])}
    bendahara = {m['key']: m for m in uj.menu_panitia_ujian(False, False, ['bendahara'])}
    assert kamad['info_ujian']['akses'] and ketua['info_ujian']['akses'] and not bendahara['info_ujian']['akses']
    assert kamad['info_ujian']['to'] == '/ujian/info-ujian'
    js = open(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'src', 'lib', 'ujian.js'), encoding='utf-8').read()
    assert re.findall(r"\{ key: '([a-z_]+)'", js) == keys  # urutan menu frontend = backend
    assert "'/ujian/info-ujian'" in js.split('RUTE_UJIAN_TERSEDIA')[1].split('\n')[0]


def test_admin_melihat_konten_kosong_dan_tautan_info(klien):
    r = klien('admin', 'admin', 'GET', URL)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d['boleh_ubah'] is True and d['ujian']['nama'] == 'ASAS Ganjil 2026/2027'
    assert d['konten'] == {'tata_tertib': '', 'panduan_video_url': '', 'panduan_keterangan': '', 'panduan_pdf': None,
                           'diperbarui_pada': None, 'diperbarui_oleh_nama': None, 'versi': None}
    assert d['tautan_info']['jalur'].startswith('/publik/info-ujian/') and d['tautan_info']['aktif'] is False
    assert r.headers['cache-control'] == 'no-store'
    assert len(klien.db.ujian_tautan_publik.docs) == 2  # tautan dibuat tertutup bila belum ada


@pytest.mark.parametrize('uid,peran', [('kamad', 'kepala_sekolah'), ('wakakur', 'waka_kurikulum'), ('guru1', 'guru')])
def test_pemantau_melihat_tanpa_mengubah(klien, uid, peran):
    r = klien(uid, peran, 'GET', URL)
    assert r.status_code == 200 and r.json()['boleh_ubah'] is False
    assert simpan(klien, {'tata_tertib': 'x'}, uid=uid, peran=peran).status_code == 403
    assert unggah(klien, uid=uid, peran=peran).status_code == 403
    assert klien(uid, peran, 'DELETE', f'{URL}/panduan-pdf').status_code == 403
    assert klien.db.ujian_info_konten.docs == []
    assert not klien.folder.exists() or os.listdir(klien.folder) == []


@pytest.mark.parametrize('uid,peran', [('guru2', 'guru'), ('siswa1', 'siswa'), ('tu1', 'tenaga_kependidikan')])
def test_bukan_pemantau_ditolak(klien, uid, peran):
    assert klien(uid, peran, 'GET', URL).status_code == 403


def test_simpan_teks_dirapikan_dan_tampil_di_halaman_publik(klien):
    r = simpan(klien, {'tata_tertib': '1. Datang 15 menit sebelum ujian.  \r\n\r\n\r\n2. Bawa kartu peserta.\r\n',
                       'panduan_video_url': ' https://www.youtube.com/watch?v=abc123 ', 'panduan_keterangan': '  Tonton   sebelum ujian. '})
    assert r.status_code == 200, r.text
    k = r.json()['konten']
    assert k['tata_tertib'] == '1. Datang 15 menit sebelum ujian.\n\n2. Bawa kartu peserta.'
    assert (k['panduan_video_url'], k['panduan_keterangan']) == ('https://www.youtube.com/watch?v=abc123', 'Tonton sebelum ujian.')
    assert k['diperbarui_oleh_nama'] == 'Administrator' and k['versi'] == k['diperbarui_pada']
    assert klien.db.audit_logs.docs[-1]['action'] == 'ujian_info_konten_ubah'

    tautan = buka_tautan_info(klien)
    p = klien(None, None, 'GET', f"/publik/info-ujian/{tautan['token']}").json()
    assert p['tata_tertib'] == k['tata_tertib']
    assert p['panduan_cbt'] == {'ada_pdf': False, 'nama_file': None, 'video_url': 'https://www.youtube.com/watch?v=abc123',
                                'keterangan': 'Tonton sebelum ujian.'}


def test_validasi_isian(klien):
    assert simpan(klien, {'panduan_video_url': 'javascript:alert(1)'}).status_code == 422
    assert simpan(klien, {'tata_tertib': 'a' * 10001}).status_code == 422
    assert simpan(klien, {'panduan_keterangan': 'a' * 301}).status_code == 422
    assert klien.db.ujian_info_konten.docs == []
    assert klien('admin', 'admin', 'PUT', '/ujian/tidak-ada/info-konten', json={}).status_code == 404


def test_versi_mencegah_menimpa_isian_admin_lain(klien):
    v1 = simpan(klien, {'tata_tertib': 'Versi pertama'}).json()['konten']['versi']
    assert simpan(klien, {'tata_tertib': 'Tanpa versi'}).status_code == 409  # pemuat lama (versi None) ditolak
    v2 = simpan(klien, {'tata_tertib': 'Versi kedua'}, versi=v1).json()['konten']['versi']
    assert v2 != v1
    r = simpan(klien, {'tata_tertib': 'Dari tab lama'}, versi=v1)
    assert r.status_code == 409 and 'admin lain' in r.json()['detail']
    assert klien.db.ujian_info_konten.docs[0]['tata_tertib'] == 'Versi kedua'


def test_unggah_ganti_hapus_pdf_panduan(klien):
    r = unggah(klien)
    assert r.status_code == 200, r.text
    pdf = r.json()['konten']['panduan_pdf']
    assert (pdf['nama_file'], pdf['ukuran_byte'], pdf['ada_di_disk'], pdf['diunggah_oleh_nama']) == ('Panduan CBT.pdf', len(PDF), True, 'Administrator')
    assert 'nama_berkas' not in pdf
    doc = klien.db.ujian_info_konten.docs[0]
    lama = doc['panduan_pdf']['nama_berkas']
    assert (klien.folder / lama).read_bytes() == PDF and doc['diperbarui_pada'] is None  # versi teks tidak berubah

    # menyimpan teks tidak menyentuh PDF; mengganti PDF tidak mengubah versi teks
    v = simpan(klien, {'tata_tertib': 'Tertib'}).json()['konten']['versi']
    assert unggah(klien, nama='Panduan baru.pdf', isi=PDF + b'v2').status_code == 200
    doc = klien.db.ujian_info_konten.docs[0]
    assert doc['tata_tertib'] == 'Tertib' and doc['diperbarui_pada'] == v and doc['panduan_pdf']['nama_file'] == 'Panduan baru.pdf'
    assert os.listdir(klien.folder) == [doc['panduan_pdf']['nama_berkas']] and lama not in os.listdir(klien.folder)

    lihat = klien('kamad', 'kepala_sekolah', 'GET', f'{URL}/panduan-pdf')
    assert lihat.status_code == 200 and lihat.content == PDF + b'v2' and lihat.headers['content-disposition'].startswith('inline')
    assert klien.db.ujian_unduh_log.docs == []  # pratinjau panitia bukan unduhan siswa

    tautan = buka_tautan_info(klien)
    assert klien(None, None, 'GET', f"/publik/info-ujian/{tautan['token']}/panduan-cbt").content == PDF + b'v2'

    r = klien('admin', 'admin', 'DELETE', f'{URL}/panduan-pdf')
    assert r.status_code == 200 and r.json()['konten']['panduan_pdf'] is None
    assert os.listdir(klien.folder) == [] and klien.db.ujian_info_konten.docs[0]['tata_tertib'] == 'Tertib'
    assert klien('admin', 'admin', 'DELETE', f'{URL}/panduan-pdf').status_code == 404
    assert klien('admin', 'admin', 'GET', f'{URL}/panduan-pdf').status_code == 404
    assert [d['action'] for d in klien.db.audit_logs.docs][-3:] == ['ujian_info_konten_ubah', 'ujian_panduan_cbt_unggah', 'ujian_panduan_cbt_hapus']


def test_pdf_panduan_divalidasi(klien):
    r = unggah(klien, nama='panduan.docx', isi=b'PK\x03\x04isi')
    assert r.status_code == 400 and r.json()['detail'] == 'Panduan CBT harus berformat PDF.'
    r = unggah(klien, nama='palsu.pdf', isi=b'bukan pdf')
    assert r.status_code == 400 and 'bukan PDF' in r.json()['detail']
    assert unggah(klien, isi=PDF + b'/JavaScript (app.alert(1))').status_code == 400
    r = unggah(klien, isi=PDF + b'0' * (10 * 1024 * 1024 + 300 * 1024))  # ditolak dini dari Content-Length
    assert r.status_code == 413 and '10 MB' in r.json()['detail']
    r = unggah(klien, isi=PDF + b'0' * (10 * 1024 * 1024))  # di bawah batas permintaan, berkas > 10 MB: ditolak handler
    assert r.status_code == 413
    assert klien.db.ujian_info_konten.docs == [] and (not klien.folder.exists() or os.listdir(klien.folder) == [])


def test_pdf_hilang_di_disk_ditandai(klien):
    unggah(klien)
    for nama in os.listdir(klien.folder):
        os.remove(klien.folder / nama)
    assert klien('admin', 'admin', 'GET', URL).json()['konten']['panduan_pdf']['ada_di_disk'] is False


def test_admin_dalam_mode_kelas_tidak_boleh_mengubah(klien):
    """Lapis kedua: sesi mode kelas/siswa ditolak penjaga ubah walau akunnya ber-peran admin."""
    import asyncio

    from fastapi import HTTPException

    import routers.ujian_info_konten as rik
    for peran in ('kelas', 'siswa'):
        with pytest.raises(HTTPException) as e:
            asyncio.run(rik._wajib_admin({'id': 'adm', 'roles': ['admin', peran], 'active_role': peran}, 'uas'))
        assert e.value.status_code == 403 and e.value.detail == rik.PESAN_HANYA_ADMIN
    assert asyncio.run(rik._wajib_admin({'id': 'adm', 'roles': ['admin'], 'active_role': 'admin'}, 'uas'))['pengelola']
