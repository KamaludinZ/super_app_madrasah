"""Kartu Peserta & Kartu Meja ujian: PDF A4 8 kartu/halaman per ruang, akses menu, dan data kartu (urut nomor peserta,
Ketua Panitia sebagai penanda tangan)."""
import os
import re
import sys

import pytest

sys.path.insert(0, os.path.dirname(__file__))

from ujian_dasar import buat_klien, tambah_kelas_siswa, ujian_doc  # noqa: E402
import ujian as uj  # noqa: E402,I100
import ujian_kartu as uk  # noqa: E402


def _halaman(pdf: bytes) -> int:
    return len(re.findall(rb'/Type /Page[^s]', pdf))


@pytest.fixture
def klien(monkeypatch):
    k = buat_klien(monkeypatch)
    db = k.db
    db.ujian.docs.append(ujian_doc('uas', 'UAS', 'sem-kini', '2026-12-01', '2026-12-06'))
    db.panitia_ujian.docs += [
        {'id': 'p1', 'ujian_id': 'uas', 'jabatan': 'ketua', 'user_id': 'guru1', 'nama': 'Bu Siti', 'nip': None},
        {'id': 'p2', 'ujian_id': 'uas', 'jabatan': 'bendahara', 'user_id': 'tu1'},
    ]
    next(u for u in db.users.docs if u['id'] == 'guru1')['nip'] = '198001012005012001'
    tambah_kelas_siswa(db, per_kelas=6)
    a = lambda m, p, **kw: k('admin', 'admin', m, p, **kw).json()  # noqa: E731
    r1 = a('POST', '/ujian/uas/ruang', json={'nama_ruang': '01', 'jenjang': [7, 8]})
    r2 = a('POST', '/ujian/uas/ruang', json={'nama_ruang': '02', 'jenjang': [9]})
    a('POST', f"/ujian/uas/ruang/{r1['id']}/peserta", json={'siswa_ids': [f's-k7a-{i}' for i in range(1, 7)] + [f's-k8a-{i}' for i in range(1, 4)]})
    a('POST', f"/ujian/uas/ruang/{r2['id']}/peserta", json={'siswa_ids': ['s-k9a-1', 's-k9a-2']})
    pr = {p['siswa_id']: p['id'] for p in db.peserta_ruang.docs}
    nomor = [{'peserta_id': pr[s], 'nomor_peserta': f'01-{i:03d}'} for i, s in
             enumerate([f's-k7a-{i}' for i in range(1, 7)] + [f's-k8a-{i}' for i in range(1, 4)], start=1)]
    a('PUT', f"/ujian/uas/ruang/{r1['id']}/nomor-peserta", json={'items': nomor[::-1]})
    k.r1, k.r2 = r1, r2
    return k


def test_menu_kartu_sesuai_akses_cetak():
    keys = [m[0] for m in uj.MENU_UJIAN]
    assert keys.index('kartu_peserta') == keys.index('cetak') + 1 and keys.index('kartu_meja') == keys.index('cetak') + 2
    bendahara = {m['key']: m for m in uj.menu_panitia_ujian(False, False, ['bendahara'])}
    assert bendahara['kartu_peserta']['akses'] and bendahara['kartu_meja']['akses']
    kamad = {m['key']: m for m in uj.menu_panitia_ujian(False, True, [])}
    assert kamad['kartu_peserta']['akses'] and kamad['kartu_meja']['akses']


def test_pilihan_kartu_dan_akses(klien):
    d = klien('guru1', 'guru', 'GET', '/ujian/uas/kartu/pilihan').json()
    assert [(r['nama_ruang'], r['peserta'], r['tanpa_nomor']) for r in d['ruang']] == [('01', 9, 0), ('02', 2, 2)]
    assert d['ketua'] == {'nama': 'Bu Siti', 'nip': '198001012005012001'} and d['kartu_per_halaman'] == 8
    assert klien('tu1', 'tenaga_kependidikan', 'GET', '/ujian/uas/kartu/pilihan', params={'jenis': 'meja'}).status_code == 200
    r = klien('guru2', 'guru', 'GET', '/ujian/uas/kartu/pilihan')
    assert r.status_code == 403 and 'Kartu Peserta' in r.json()['detail']
    assert klien('guru2', 'guru', 'GET', f"/ujian/uas/kartu/meja?ruang_id={klien.r1['id']}").status_code == 403
    assert klien('admin', 'admin', 'GET', '/ujian/tidak-ada/kartu/pilihan').status_code == 404


def test_cetak_kartu_per_ruang_dan_semua_ruang(klien, monkeypatch):
    import routers.ujian_kartu as rk
    tangkap = []
    asli = rk.pdf_kartu
    monkeypatch.setattr(rk, 'pdf_kartu', lambda jenis, data: tangkap.append((jenis, data)) or asli(jenis, data))

    r = klien('guru1', 'guru', 'GET', f"/ujian/uas/kartu/peserta?ruang_id={klien.r1['id']}")
    assert r.status_code == 200, r.text
    assert r.headers['content-type'] == 'application/pdf' and 'kartu_peserta_UAS_uas_ruang_01.pdf' in r.headers['content-disposition']
    assert r.content.startswith(b'%PDF') and _halaman(r.content) == 2  # 9 peserta -> 8 + 1
    jenis, data = tangkap[-1]
    assert jenis == 'peserta' and [x['nama_ruang'] for x in data['ruang']] == ['01']
    assert [p['nomor_peserta'] for p in data['ruang'][0]['peserta']][:3] == ['01-001', '01-002', '01-003']  # urut nomor
    assert data['ketua']['nip'] == '198001012005012001' and data['template']['singkatan_ujian'] and data['tahun_pelajaran']

    # Semua ruang: tiap ruang mulai halaman baru (01: 2 halaman, 02: 1 halaman).
    r = klien('admin', 'admin', 'GET', '/ujian/uas/kartu/meja')
    assert r.status_code == 200 and _halaman(r.content) == 3 and 'kartu_meja_UAS_uas_semua_ruang.pdf' in r.headers['content-disposition']
    assert [x['nama_ruang'] for x in tangkap[-1][1]['ruang']] == ['01', '02']
    assert [a['action'] for a in klien.db.audit_logs.docs if a['action'] == 'ujian_cetak_kartu'] == ['ujian_cetak_kartu'] * 2

    assert klien('admin', 'admin', 'GET', '/ujian/uas/kartu/meja?ruang_id=x').status_code == 404
    assert klien('admin', 'admin', 'GET', '/ujian/uas/kartu/lain').status_code == 422


def test_ruang_kosong_ditolak(klien):
    r3 = klien('admin', 'admin', 'POST', '/ujian/uas/ruang', json={'nama_ruang': '03', 'jenjang': [7]}).json()
    r = klien('admin', 'admin', 'GET', f"/ujian/uas/kartu/peserta?ruang_id={r3['id']}")
    assert r.status_code == 400 and 'Belum ada peserta' in r.json()['detail']


def test_pdf_kartu_isi_panjang_tetap_jalan():
    """Nama sangat panjang, tanpa nomor, tanpa ketua panitia & tanpa template: tetap menghasilkan PDF."""
    data = {'template': {}, 'tahun_pelajaran': '2026/2027', 'ketua': None, 'ruang': [
        {'nama_ruang': 'Laboratorium Komputer Lantai Dua', 'peserta': [
            {'nomor_peserta': None, 'nama': 'Muhammad ' * 12, 'kelas': '7A', 'nisn': None, 'nis': '123'}] * 17}]}
    for jenis in uk.JENIS_KARTU:
        pdf = uk.pdf_kartu(jenis, data)
        assert pdf.startswith(b'%PDF') and _halaman(pdf) == 3
    assert _halaman(uk.pdf_kartu('meja', {'ruang': []})) == 1
    with pytest.raises(ValueError):
        uk.pdf_kartu('lain', data)
    assert uk.ringkas_ketua({'full_name': 'Pak A', 'nipm': 'NIPM-7'}, {}) == {'nama': 'Pak A', 'nip': 'NIPM-7'}
    assert uk.ringkas_ketua({'nip': '1980'}, {'nama': 'Bu B', 'nip': 'PEG-1'})['nip'] == '1980'
