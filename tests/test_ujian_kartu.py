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
    assert [(r['nama_ruang'], r['peserta'], r['tanpa_nomor'], r['ada_foto']) for r in d['ruang']] == [('01', 9, 0, 0), ('02', 2, 2, 0)]
    assert d['foto_bawaan'] == 'pakai'
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
    assert r.headers['content-type'] == 'application/pdf' and 'kartu_peserta_UAS_uas_ruang_01_dengan_foto.pdf' in r.headers['content-disposition']
    assert r.content.startswith(b'%PDF') and _halaman(r.content) == 2  # 9 peserta -> 8 + 1
    jenis, data = tangkap[-1]
    assert jenis == 'peserta' and [x['nama_ruang'] for x in data['ruang']] == ['01']
    assert [p['nomor_peserta'] for p in data['ruang'][0]['peserta']][:3] == ['01-001', '01-002', '01-003']  # urut nomor
    assert data['ketua']['nip'] == '198001012005012001' and data['template']['singkatan_ujian'] and data['tahun_pelajaran']

    # Semua ruang: tiap ruang mulai halaman baru (01: 2 halaman, 02: 1 halaman).
    r = klien('admin', 'admin', 'GET', '/ujian/uas/kartu/meja')
    assert r.status_code == 200 and _halaman(r.content) == 3 and 'kartu_meja_UAS_uas_semua_ruang_tanpa_foto.pdf' in r.headers['content-disposition']
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


def _gambar(warna, ukuran=(300, 400), fmt='PNG'):
    import io

    from PIL import Image
    b = io.BytesIO()
    Image.new('RGB', ukuran, warna).save(b, fmt)
    return b.getvalue()


def test_kartu_pakai_foto_atau_tanpa_foto(klien, monkeypatch, tmp_path):
    """Pakai foto: pas foto dari dokumen siswa (berkas) atau foto profil (data URI) tercetak; tanpa foto: tidak ada foto."""
    import base64

    import routers.ujian_kartu as rk
    monkeypatch.setattr(rk, 'folder_unggahan', lambda nama: str(tmp_path))
    (tmp_path / 's1_pas_foto_ab.jpg').write_bytes(_gambar((200, 30, 30), fmt='JPEG'))
    users = {u['id']: u for u in klien.db.users.docs}
    users['s-k7a-1']['dokumen_pas_foto'] = '/api/students/s-k7a-1/dokumen/pas_foto/file/s1_pas_foto_ab.jpg'
    users['s-k7a-2']['photo_url'] = 'data:image/png;base64,' + base64.b64encode(_gambar((30, 30, 200), (500, 300))).decode()
    users['s-k7a-3']['dokumen_pas_foto'] = '/api/students/x/dokumen/pas_foto/file/../../rahasia.jpg'  # tidak keluar folder
    users['s-k7a-4']['dokumen_pas_foto'] = '/api/students/x/dokumen/pas_foto/file/akte.pdf'  # bukan gambar
    (tmp_path.parent / 'rahasia.jpg').write_bytes(_gambar((0, 0, 0), fmt='JPEG'))

    d = klien('admin', 'admin', 'GET', '/ujian/uas/kartu/pilihan', params={'jenis': 'meja'}).json()
    assert d['ruang'][0]['ada_foto'] == 3 and d['foto_bawaan'] == 'tanpa'

    tangkap = []
    asli = rk.pdf_kartu
    monkeypatch.setattr(rk, 'pdf_kartu', lambda jenis, data: tangkap.append(data) or asli(jenis, data))
    url = f"/ujian/uas/kartu/peserta?ruang_id={klien.r1['id']}"
    dengan = klien('admin', 'admin', 'GET', url)
    assert dengan.status_code == 200, dengan.text
    data = tangkap[-1]
    foto = {p['nama']: p['foto'] for p in data['ruang'][0]['peserta']}
    assert data['foto'] is True
    assert foto['Siswa 7A 1'][:2] == b'\xff\xd8' and foto['Siswa 7A 2'][:2] == b'\xff\xd8'  # JPEG siap cetak
    assert foto['Siswa 7A 3'] is None and foto['Siswa 7A 4'] is None and foto['Siswa 8A 1'] is None

    tanpa = klien('admin', 'admin', 'GET', url + '&foto=tanpa')
    assert tanpa.status_code == 200 and 'ruang_01_tanpa_foto.pdf' in tanpa.headers['content-disposition']
    assert tangkap[-1]['foto'] is False and all(p['foto'] is None for p in tangkap[-1]['ruang'][0]['peserta'])
    assert len(dengan.content) > len(tanpa.content)

    # Kartu meja bawaan tanpa foto; dapat diminta pakai foto.
    klien('admin', 'admin', 'GET', f"/ujian/uas/kartu/meja?ruang_id={klien.r1['id']}")
    assert tangkap[-1]['foto'] is False
    r = klien('admin', 'admin', 'GET', f"/ujian/uas/kartu/meja?ruang_id={klien.r1['id']}&foto=pakai")
    assert r.status_code == 200 and tangkap[-1]['foto'] is True and 'dengan_foto' in r.headers['content-disposition']
    assert klien('admin', 'admin', 'GET', url + '&foto=lain').status_code == 422


def test_siapkan_foto_potong_3x4_dan_tolak_rusak():
    import io

    from PIL import Image
    jpg = uk.siapkan_foto(_gambar((10, 200, 10), (800, 300)))
    with Image.open(io.BytesIO(jpg)) as im:
        assert im.size == uk.UKURAN_FOTO_PX and im.format == 'JPEG'
    rgba = io.BytesIO()
    Image.new('RGBA', (60, 80), (0, 0, 0, 0)).save(rgba, 'PNG')
    assert uk.siapkan_foto(rgba.getvalue())[:2] == b'\xff\xd8'
    assert uk.siapkan_foto(b'bukan gambar') is None and uk.siapkan_foto(None) is None
    assert uk.baca_foto_siswa({'photo_url': 'data:image/png;base64,!!!'}, '/tidak/ada') in (None, b'')
    assert not uk.ada_foto({'photo_url': 'https://contoh/foto.jpg'}) and uk.ada_foto({'dokumen_pas_foto': '/x/FOTO.JPG'})
    data = {'template': {}, 'tahun_pelajaran': '2026/2027', 'ketua': None, 'foto': True, 'ruang': [
        {'nama_ruang': '01', 'peserta': [{'nomor_peserta': '01-001', 'nama': 'A', 'kelas': '7A', 'foto': jpg},
                                         {'nomor_peserta': '01-002', 'nama': 'B', 'kelas': '7A', 'foto': None}]}]}
    for jenis in uk.JENIS_KARTU:
        assert uk.pdf_kartu(jenis, data).startswith(b'%PDF')
