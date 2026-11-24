"""Alur HTTP Formulir Unggah Berkas Ujian (ber-login): GTK memilih guru PJ dari daftar, validasi, unggah ulang menimpa."""
import io
import os
import sys
import zipfile

import pytest

sys.path.insert(0, os.path.dirname(__file__))

from ujian_dasar import buat_klien, ujian_doc  # noqa: E402

PDF = b'%PDF-1.4\n%kisi\n'


def docx():
    b = io.BytesIO()
    with zipfile.ZipFile(b, 'w') as z:
        z.writestr('[Content_Types].xml', '<Types/>')
        z.writestr('word/document.xml', '<w:document/>')
    return b.getvalue()


@pytest.fixture
def klien(monkeypatch, tmp_path):
    import penyimpanan
    monkeypatch.setattr(penyimpanan, 'UPLOAD_ROOT', str(tmp_path))
    k = buat_klien(monkeypatch)
    k.folder = tmp_path / 'ujian_berkas'
    k.db.ujian.docs.append(ujian_doc('uas', 'UAS', 'sem-kini', '2026-12-01', '2026-12-06', nama='ASAS Ganjil 2026/2027'))
    k.db.ujian.docs.append(ujian_doc('lama', 'UAS', 'sem-lalu', '2026-05-01', '2026-05-06', nama='ASAS Genap lalu'))
    return k


def unggah(k, uid, peran, jenis='kisi_kisi', nama='Kisi IPA 8.pdf', isi=PDF, jenjang='8', mapel='ipa', ujian='uas', pj='guru1'):
    mime = 'application/pdf' if nama.lower().endswith('.pdf') else 'application/octet-stream'
    return k(uid, peran, 'POST', f'/ujian/{ujian}/berkas/{jenis}', data={'jenjang': jenjang, 'mapel': mapel, 'guru_pj_id': pj},
             files={'berkas': (nama, isi, mime)})


def test_guru_pj_unggah_kisi_kisi_pdf(klien):
    r = unggah(klien, 'guru1', 'guru')
    assert r.status_code == 200, r.text
    b = r.json()['berkas']
    assert (b['jenis'], b['jenjang'], b['mapel'], b['nama_file'], b['ukuran_byte'], b['guru_pj_nama']) == ('kisi_kisi', 8, 'ipa', 'Kisi IPA 8.pdf', len(PDF), 'Bu Siti')
    assert 'nama_berkas' not in b
    doc = klien.db.ujian_berkas.docs[0]
    assert doc['status'] == 'terkirim' and doc['guru_pj_id'] == 'guru1' and doc['mime_type'] == 'application/pdf'
    assert (klien.folder / doc['nama_berkas']).read_bytes() == PDF and len(os.listdir(klien.folder)) == 1
    log = klien.db.audit_logs.docs[-1]
    assert log['action'] == 'ujian_berkas_unggah' and log['details']['ukuran'] == len(PDF) and log['details']['ganti'] is False


def test_unggah_ulang_menimpa(klien):
    unggah(klien, 'guru1', 'guru')
    lama = dict(klien.db.ujian_berkas.docs[0])
    klien.db.ujian_berkas.docs[0]['jumlah_unduh'] = 5
    r = unggah(klien, 'guru1', 'guru', nama='Kisi IPA 8 revisi.pdf', isi=PDF + b'v2')
    assert r.status_code == 200
    assert len(klien.db.ujian_berkas.docs) == 1  # tanpa arsip ganda
    baru = klien.db.ujian_berkas.docs[0]
    assert baru['id'] == lama['id'] and baru['jumlah_unduh'] == 5 and baru['nama_file'] == 'Kisi IPA 8 revisi.pdf'
    assert os.listdir(klien.folder) == [baru['nama_berkas']] and baru['nama_berkas'] != lama['nama_berkas']


@pytest.mark.parametrize('jenis,nama,isi,kode,pesan', [
    ('kisi_kisi', 'Kisi.docx', docx(), 400, 'Kisi-kisi harus berformat PDF.'),
    ('kisi_kisi', 'foto.pdf', b'\xff\xd8\xff\xe0JFIF', 400, 'bukan PDF yang sah'),
    ('kisi_kisi', 'kosong.pdf', b'', 400, 'Berkas kosong'),
    ('kisi_kisi', 'besar.pdf', PDF + b'0' * (10 * 1024 * 1024), 413, 'melebihi batas 10 MB'),
    ('kartu_soal', 'Kartu.doc', b'\xd0\xcf\x11\xe0', 400, 'PDF atau DOCX'),
])
def test_validasi_berkas_ditolak(klien, jenis, nama, isi, kode, pesan):
    r = unggah(klien, 'guru1', 'guru', jenis=jenis, nama=nama, isi=isi)
    assert r.status_code == kode and pesan in r.json()['detail']
    assert not klien.db.ujian_berkas.docs and (not klien.folder.exists() or not os.listdir(klien.folder))


def test_kartu_soal_docx_diterima(klien):
    r = unggah(klien, 'guru1', 'guru', jenis='kartu_soal', nama='Kartu IPA 8.docx', isi=docx())
    assert r.status_code == 200 and r.json()['berkas']['mime_type'].endswith('wordprocessingml.document')


@pytest.mark.parametrize('uid,peran,data,kode,pesan', [
    ('guru2', 'guru', {}, 200, None),                                 # GTK mana pun boleh mengunggah
    ('tu1', 'tenaga_kependidikan', {'pj': 'guru2'}, 200, None),
    ('guru1', 'guru', {'pj': 'tu1'}, 400, 'Pilih nama guru PJ'),      # PJ harus akun guru
    ('guru1', 'guru', {'pj': 'tidak-ada'}, 400, 'Pilih nama guru PJ'),
    ('guru1', 'guru', {'pj': ''}, 422, None),
    ('siswa1', 'siswa', {}, 403, 'hanya untuk guru/GTK'),
    ('guru1', 'guru', {'mapel': 'kimia'}, 404, None),
    ('guru1', 'guru', {'jenjang': '10'}, 404, None),
    ('guru1', 'guru', {'ujian': 'tidak-ada'}, 404, None),
])
def test_otorisasi_dan_validasi_formulir(klien, uid, peran, data, kode, pesan):
    r = unggah(klien, uid, peran, **data)
    assert r.status_code == kode, r.text
    if pesan:
        assert pesan in r.json()['detail']
    assert bool(klien.db.ujian_berkas.docs) is (kode == 200)
    if kode == 200:
        pj = data.get('pj', 'guru1')
        assert klien.db.ujian_berkas.docs[0]['guru_pj_id'] == pj
    assert unggah(klien, None, None).status_code == 401
    assert klien('guru1', 'guru', 'POST', '/ujian/uas/berkas/lain', data={'jenjang': '8', 'mapel': 'ipa', 'guru_pj_id': 'guru1'},
                 files={'berkas': ('a.pdf', PDF, 'application/pdf')}).status_code == 404


def test_pj_dipilih_dari_daftar(klien):
    r = unggah(klien, 'admin', 'admin', pj='guru2')
    assert r.status_code == 200 and r.json()['berkas']['guru_pj_nama'] == 'Pak Hadi' and r.json()['berkas']['guru_pj_id'] == 'guru2'
    r = unggah(klien, 'guru1', 'guru', nama='Kisi revisi.pdf', pj='guru1')  # unggah ulang boleh mengganti PJ
    assert r.json()['berkas']['guru_pj_nama'] == 'Bu Siti' and len(klien.db.ujian_berkas.docs) == 1


def test_gagal_simpan_db_berkas_lama_tetap(klien, monkeypatch):
    unggah(klien, 'guru1', 'guru')
    lama = dict(klien.db.ujian_berkas.docs[0])
    asli = klien.db.ujian_berkas.update_one

    async def rusak(*a, **k):
        raise RuntimeError('db mati')
    monkeypatch.setattr(klien.db.ujian_berkas, 'update_one', rusak)
    r = unggah(klien, 'guru1', 'guru', nama='Kisi baru.pdf', isi=PDF + b'baru')
    assert r.status_code == 500 and 'Berkas lama (bila ada) tetap berlaku' in r.json()['detail']
    monkeypatch.setattr(klien.db.ujian_berkas, 'update_one', asli)
    assert klien.db.ujian_berkas.docs[0]['nama_berkas'] == lama['nama_berkas']
    assert os.listdir(klien.folder) == [lama['nama_berkas']]  # berkas baru dibersihkan, lama utuh


def test_berkas_saya_dan_menu(klien):
    unggah(klien, 'guru1', 'guru')
    d = klien('guru2', 'guru', 'GET', '/ujian/berkas-saya').json()  # GTK mana pun melihat semua mapel
    assert [u['id'] for u in d['ujian']] == ['uas'] and d['saya'] == 'guru2'  # hanya semester aktif
    assert len(d['tugas']) == 45
    ipa8 = next(t for t in d['tugas'] if (t['jenjang'], t['mapel']) == (8, 'ipa'))
    assert ipa8['kisi_kisi']['nama_file'] == 'Kisi IPA 8.pdf' and ipa8['kisi_kisi']['guru_pj_id'] == 'guru1' and ipa8['kartu_soal'] is None
    nama_guru = [g['nama'] for g in d['guru']]
    assert 'Bu Siti' in nama_guru and 'Pak Hadi' in nama_guru and 'Ahmad' not in nama_guru and 'Bu Laili' not in nama_guru
    assert 'nama_berkas' not in str(d)
    assert klien('siswa1', 'siswa', 'GET', '/ujian/berkas-saya').status_code == 403
    assert klien('guru2', 'guru', 'GET', '/ujian/akses-saya').json()['pj_berkas'] is True
    assert klien('tu1', 'tenaga_kependidikan', 'GET', '/ujian/akses-saya').json()['pj_berkas'] is True
    assert klien('siswa1', 'siswa', 'GET', '/ujian/akses-saya').json()['pj_berkas'] is False


def test_kartu_soal_rahasia_dan_konten_aktif(klien):
    import stat
    r = unggah(klien, 'guru1', 'guru', jenis='kartu_soal', nama='Kartu IPA 8.pdf')
    assert r.status_code == 200
    doc = next(d for d in klien.db.ujian_berkas.docs if d['jenis'] == 'kartu_soal')
    assert stat.S_IMODE(os.stat(klien.folder / doc['nama_berkas']).st_mode) == 0o600
    r = unggah(klien, 'guru1', 'guru', jenis='kartu_soal', nama='Kartu v2.pdf', isi=PDF + b'/OpenAction << /S /JavaScript >>')
    assert r.status_code == 400 and 'skrip' in r.json()['detail']
    assert next(d for d in klien.db.ujian_berkas.docs if d['jenis'] == 'kartu_soal')['nama_file'] == 'Kartu IPA 8.pdf'  # lama tetap
    # kartu soal tidak pernah muncul di halaman publik info (kisi-kisi saja)
    klien.db.ujian_tautan_publik.docs.append({'id': 't', 'ujian_id': 'uas', 'jenis': 'info', 'token': 'TokenInfoBerkas_1234567890abcdef', 'aktif': True})
    info = klien(None, None, 'GET', '/publik/info-ujian/TokenInfoBerkas_1234567890abcdef').json()
    assert info['kisi_kisi'] == [] and doc['id'] not in str(info)


def test_tolak_dini_sebelum_body_diurai(klien, monkeypatch):
    """Content-Length di atas batas ditolak 413 sebelum multipart diurai (handler tidak pernah dipanggil)."""
    import routers.ujian_berkas as rb
    dipanggil = []
    asli = rb._wajib_gtk

    def penjaga(*a, **k):
        dipanggil.append(1)
        raise AssertionError('handler tidak boleh berjalan')
    monkeypatch.setattr(rb, '_wajib_gtk', penjaga)
    besar = PDF + b'0' * (rb.BATAS_PERMINTAAN + 10)
    r = unggah(klien, 'guru1', 'guru', isi=besar)
    assert r.status_code == 413 and r.json()['detail'] == rb.PESAN_TERLALU_BESAR and not dipanggil
    # di bawah batas permintaan tetapi berkas > 10 MB: ditolak oleh handler dengan pesan sama
    monkeypatch.setattr(rb, '_wajib_gtk', asli)  # (undo() juga membatalkan patch fixture)
    r = unggah(klien, 'guru1', 'guru', isi=PDF + b'0' * (10 * 1024 * 1024))
    assert r.status_code == 413 and r.json()['detail'] == rb.PESAN_TERLALU_BESAR


def test_status_monitoring_berkas_internal(klien):
    klien.db.panitia_ujian.docs.append({'id': 'pk', 'ujian_id': 'uas', 'jabatan': 'ketua', 'user_id': 'guru2'})
    unggah(klien, 'guru1', 'guru')  # kisi-kisi IPA 8
    r = klien('admin', 'admin', 'GET', '/ujian/uas/berkas/status')
    assert r.status_code == 200, r.text
    d = r.json()
    assert d['boleh_unduh_kartu'] is True and d['ujian']['id'] == 'uas'
    assert d['jenjang']['8']['ringkasan'] == {'total': 15, 'kisi_kisi': 1, 'kartu_soal': 0, 'lengkap': 0}
    ipa = next(b for b in d['jenjang']['8']['baris'] if b['kode'] == 'ipa')
    assert ipa['kisi_kisi']['nama_file'] == 'Kisi IPA 8.pdf' and ipa['kisi_kisi']['jumlah_unduh'] == 0 and ipa['kisi_kisi']['id']
    assert ipa['kartu_soal'] is None and ipa['pj'] == ['Bu Siti'] and ipa['kisi_kisi']['guru_pj_id'] == 'guru1'
    mtk9 = next(b for b in d['jenjang']['9']['baris'] if b['kode'] == 'matematika')
    assert mtk9['pj'] == [] and mtk9['kisi_kisi'] is None
    belum = {(x['jenjang'], x['mapel']): x for x in d['belum_mengirim']}
    assert belum[(8, 'ipa')]['kurang'] == ['kartu_soal'] and belum[(9, 'matematika')]['kurang'] == ['kisi_kisi', 'kartu_soal']
    assert len(d['belum_mengirim']) == 45 and d['terakhir']
    assert 'nama_berkas' not in r.text
    for uid, peran, kode, boleh in (('kamad', 'kepala_sekolah', 200, False), ('guru2', 'guru', 200, False), ('guru1', 'guru', 403, None),  # guru1 bukan panitia
                                    ('siswa1', 'siswa', 403, None)):
        r = klien(uid, peran, 'GET', '/ujian/uas/berkas/status')
        assert r.status_code == kode, (uid, r.text)
        if boleh is not None:
            assert r.json()['boleh_unduh_kartu'] is boleh


def _unggah_banyak(klien):
    unggah(klien, 'guru1', 'guru', mapel='ipa', nama='Kisi IPA 8.pdf')
    unggah(klien, 'guru1', 'guru', mapel='bahasa_indonesia', nama='Kisi BIndo 8.pdf', isi=PDF + b'bindo')
    unggah(klien, 'guru1', 'guru', jenis='kartu_soal', mapel='ipa', nama='Kartu IPA 8.docx', isi=docx())


def test_zip_kisi_kisi_jenjang(klien):
    _unggah_banyak(klien)
    r = klien('admin', 'admin', 'GET', '/ujian/uas/berkas/zip', params={'jenis': 'kisi_kisi', 'jenjang': 8})
    assert r.status_code == 200, r.text
    from urllib.parse import unquote
    assert r.headers['content-type'] == 'application/zip'
    assert 'Kisi-kisi Kelas 8 - ASAS Ganjil 2026-2027.zip' in unquote(r.headers['content-disposition'])
    z = zipfile.ZipFile(io.BytesIO(r.content))
    assert z.namelist() == ['01 Bahasa Indonesia - Kisi BIndo 8.pdf', '07 IPA - Kisi IPA 8.pdf', 'KETERANGAN.txt']
    assert z.read('07 IPA - Kisi IPA 8.pdf') == PDF and z.read('01 Bahasa Indonesia - Kisi BIndo 8.pdf') == PDF + b'bindo'
    ket = z.read('KETERANGAN.txt').decode()
    assert 'Berisi 2 mapel' in ket and 'Belum mengirim (13 mapel)' in ket and 'Matematika' in ket
    log = [x for x in klien.db.ujian_unduh_log.docs if x['mode'] == 'zip_jenjang']
    assert len(log) == 1 and log[0]['jenis_berkas'] == 'kisi_kisi' and log[0]['jumlah_berkas'] == 2 and log[0]['pengunduh_nama'] == 'Administrator'
    assert all(int(b.get('jumlah_unduh') or 0) == 0 for b in klien.db.ujian_berkas.docs)  # penghitung publik tidak bertambah
    import tempfile
    assert not [n for n in os.listdir(tempfile.gettempdir()) if n.startswith('bundel-')]  # berkas sementara dibersihkan


def test_zip_validasi_dan_otorisasi(klien):
    _unggah_banyak(klien)
    url = '/ujian/uas/berkas/zip'
    assert klien('admin', 'admin', 'GET', url, params={'jenis': 'kisi_kisi', 'jenjang': 9}).status_code == 404  # kosong
    assert 'Belum ada kisi-kisi Kelas 9' in klien('admin', 'admin', 'GET', url, params={'jenis': 'kisi_kisi', 'jenjang': 9}).json()['detail']
    assert klien('admin', 'admin', 'GET', url, params={'jenis': 'lain', 'jenjang': 8}).status_code == 422
    assert klien('admin', 'admin', 'GET', url, params={'jenis': 'kisi_kisi', 'jenjang': 10}).status_code == 422
    klien.db.panitia_ujian.docs.append({'id': 'pk', 'ujian_id': 'uas', 'jabatan': 'ketua', 'user_id': 'guru2'})
    for uid, peran in (('kamad', 'kepala_sekolah'), ('guru2', 'guru'), ('guru1', 'guru'), ('siswa1', 'siswa')):
        r = klien(uid, peran, 'GET', url, params={'jenis': 'kisi_kisi', 'jenjang': 8})
        assert r.status_code == 403, uid
    assert klien(None, None, 'GET', url, params={'jenis': 'kisi_kisi', 'jenjang': 8}).status_code == 401
    assert not [x for x in klien.db.ujian_unduh_log.docs if x['mode'] == 'zip_jenjang']


def test_zip_kartu_soal_terproteksi(klien):
    _unggah_banyak(klien)
    url = '/ujian/uas/berkas/zip'
    p = {'jenis': 'kartu_soal', 'jenjang': 8}
    r = klien('admin', 'admin', 'GET', url, params=p)
    assert r.status_code == 400 and 'dikonfirmasi' in r.json()['detail']
    r = klien('admin', 'admin', 'GET', url, params={**p, 'konfirmasi': 1}, headers={'x-real-ip': '36.71.9.9'})
    assert r.status_code == 200, r.text
    z = zipfile.ZipFile(io.BytesIO(r.content))
    assert z.namelist() == ['07 IPA - Kartu IPA 8.docx', 'KETERANGAN.txt']
    ket = z.read('KETERANGAN.txt').decode()
    assert ket.startswith('RAHASIA — kartu soal diunduh oleh Administrator (admin)') and '36.71.9.9' in ket
    assert z.comment.decode().startswith('RAHASIA') and 'Administrator' in z.comment.decode()
    # kisi-kisi tidak perlu konfirmasi & tanpa penanda
    zk = zipfile.ZipFile(io.BytesIO(klien('admin', 'admin', 'GET', url, params={'jenis': 'kisi_kisi', 'jenjang': 8}).content))
    assert not zk.comment and not zk.read('KETERANGAN.txt').decode().startswith('RAHASIA')


def test_zip_kartu_soal_dibatasi_laju(klien, monkeypatch):
    import routers.ujian_berkas as rb
    _unggah_banyak(klien)
    monkeypatch.setattr(rb, 'BATAS_ZIP_KARTU', 2)
    p = {'jenis': 'kartu_soal', 'jenjang': 8, 'konfirmasi': 1}
    assert [klien('admin', 'admin', 'GET', '/ujian/uas/berkas/zip', params=p).status_code for _ in range(3)] == [200, 200, 429]
    # kisi-kisi tidak terkena batas kartu soal
    assert klien('admin', 'admin', 'GET', '/ujian/uas/berkas/zip', params={'jenis': 'kisi_kisi', 'jenjang': 8}).status_code == 200


def test_unduh_tunggal_admin(klien):
    _unggah_banyak(klien)
    kisi = next(b for b in klien.db.ujian_berkas.docs if b['jenis'] == 'kisi_kisi' and b['mapel'] == 'ipa')
    kartu = next(b for b in klien.db.ujian_berkas.docs if b['jenis'] == 'kartu_soal')
    r = klien('admin', 'admin', 'GET', f"/ujian/uas/berkas/{kisi['id']}/unduh")
    assert r.status_code == 200 and r.content == PDF and r.headers['content-type'] == 'application/pdf'
    from urllib.parse import unquote
    assert 'Kisi IPA 8.pdf' in unquote(r.headers['content-disposition'])
    r = klien('admin', 'admin', 'GET', f"/ujian/uas/berkas/{kartu['id']}/unduh")
    assert r.status_code == 400 and 'dikonfirmasi' in r.json()['detail']
    r = klien('admin', 'admin', 'GET', f"/ujian/uas/berkas/{kartu['id']}/unduh", params={'konfirmasi': 1})
    assert r.status_code == 200 and r.headers['content-type'].endswith('wordprocessingml.document')
    assert 'word/document.xml' in zipfile.ZipFile(io.BytesIO(r.content)).namelist()
    log = [x for x in klien.db.ujian_unduh_log.docs if x['mode'] == 'tunggal']
    assert [(x['jenis_berkas'], x['pengunduh_nama']) for x in log] == [('kisi_kisi', 'Administrator'), ('kartu_soal', 'Administrator')]
    assert all(int(b.get('jumlah_unduh') or 0) == 0 for b in klien.db.ujian_berkas.docs)
    # berkas ujian lain / tidak ada / bukan admin
    assert klien('admin', 'admin', 'GET', f"/ujian/lama/berkas/{kisi['id']}/unduh").status_code == 404
    assert klien('admin', 'admin', 'GET', '/ujian/uas/berkas/tidak-ada/unduh').status_code == 404
    klien.db.panitia_ujian.docs.append({'id': 'pk', 'ujian_id': 'uas', 'jabatan': 'ketua', 'user_id': 'guru2'})
    for uid, peran in (('kamad', 'kepala_sekolah'), ('guru2', 'guru'), ('guru1', 'guru')):
        assert klien(uid, peran, 'GET', f"/ujian/uas/berkas/{kisi['id']}/unduh").status_code == 403


def test_cakupan_audit_semua_unduhan(klien):
    """Setiap endpoint yang mengirim isi berkas wajib menambah satu entri ujian_unduh_log (siapa, kapan, apa, sumber)."""
    _unggah_banyak(klien)
    kisi = next(b for b in klien.db.ujian_berkas.docs if b['jenis'] == 'kisi_kisi' and b['mapel'] == 'ipa')
    kartu = next(b for b in klien.db.ujian_berkas.docs if b['jenis'] == 'kartu_soal')
    token = 'TokenInfoAudit_1234567890abcdefgh'
    klien.db.ujian_tautan_publik.docs.append({'id': 't-info', 'ujian_id': 'uas', 'jenis': 'info', 'token': token, 'aktif': True})
    (klien.folder.parent / 'ujian_info').mkdir(exist_ok=True)
    (klien.folder.parent / 'ujian_info' / 'panduan.pdf').write_bytes(PDF)
    klien.db.ujian_info_konten.docs.append({'ujian_id': 'uas', 'panduan_pdf': {'nama_file': 'Panduan.pdf', 'nama_berkas': 'panduan.pdf'}})
    h = {'user-agent': 'UjiAudit', 'x-real-ip': '36.71.5.5'}
    unduhan = [
        (None, None, f'/publik/info-ujian/{token}/kisi-kisi/{kisi["id"]}', {}, ('publik', 'kisi_kisi', None)),
        (None, None, f'/publik/info-ujian/{token}/panduan-cbt', {}, ('publik', 'panduan_cbt', None)),
        ('admin', 'admin', f'/ujian/uas/berkas/{kisi["id"]}/unduh', {}, ('tunggal', 'kisi_kisi', 'Administrator')),
        ('admin', 'admin', f'/ujian/uas/berkas/{kartu["id"]}/unduh', {'konfirmasi': 1}, ('tunggal', 'kartu_soal', 'Administrator')),
        ('admin', 'admin', '/ujian/uas/berkas/zip', {'jenis': 'kisi_kisi', 'jenjang': 8}, ('zip_jenjang', 'kisi_kisi', 'Administrator')),
        ('admin', 'admin', '/ujian/uas/berkas/zip', {'jenis': 'kartu_soal', 'jenjang': 8, 'konfirmasi': 1}, ('zip_jenjang', 'kartu_soal', 'Administrator')),
    ]
    for uid, peran, path, params, harapan in unduhan:
        n = len(klien.db.ujian_unduh_log.docs)
        r = klien(uid, peran, 'GET', path, params=params, headers=dict(h))
        assert r.status_code == 200, (path, r.text)
        log = klien.db.ujian_unduh_log.docs[n:]
        assert len(log) == 1, path
        x = log[0]
        assert (x['mode'], x['jenis_berkas'], x['pengunduh_nama']) == harapan and x['ujian_id'] == 'uas', path
        assert x['ip'] == '36.71.5.5' and x['perangkat'] == 'UjiAudit' and x['waktu'], path


def test_berkas_kosong_dan_hilang_respons_jelas(klien):
    url = '/ujian/uas/berkas/zip'
    r = klien('admin', 'admin', 'GET', url, params={'jenis': 'kisi_kisi', 'jenjang': 8})
    assert r.status_code == 404 and 'belum ada yang dapat dibundel' in r.json()['detail']
    unggah(klien, 'guru1', 'guru')  # kisi IPA 8
    b = klien.db.ujian_berkas.docs[0]
    os.remove(klien.folder / b['nama_berkas'])  # tercatat tetapi hilang di disk
    r = klien('admin', 'admin', 'GET', url, params={'jenis': 'kisi_kisi', 'jenjang': 8})
    assert r.status_code == 404 and 'tidak ditemukan di server (IPA)' in r.json()['detail'] and 'unggah ulang' in r.json()['detail'].lower()
    r = klien('admin', 'admin', 'GET', f"/ujian/uas/berkas/{b['id']}/unduh")
    assert r.status_code == 404 and r.json()['detail'].startswith('Kisi-kisi IPA Kelas 8 tercatat terkirim tetapi berkasnya tidak ditemukan')
    r = klien('admin', 'admin', 'GET', '/ujian/uas/berkas/tidak-ada/unduh')
    assert r.status_code == 404 and 'mungkin sudah diganti' in r.json()['detail']
    st = klien('admin', 'admin', 'GET', '/ujian/uas/berkas/status').json()
    ipa = next(x for x in st['jenjang']['8']['baris'] if x['kode'] == 'ipa')
    assert ipa['kisi_kisi']['ada_di_disk'] is False
    unggah(klien, 'guru1', 'guru', nama='Kisi IPA 8 ulang.pdf')  # unggah ulang memulihkan
    st = klien('admin', 'admin', 'GET', '/ujian/uas/berkas/status').json()
    assert next(x for x in st['jenjang']['8']['baris'] if x['kode'] == 'ipa')['kisi_kisi']['ada_di_disk'] is True


def test_audit_unduhan_kartu_soal_oleh_admin(klien, monkeypatch):
    import routers.ujian_berkas as rb
    _unggah_banyak(klien)
    kartu = next(b for b in klien.db.ujian_berkas.docs if b['jenis'] == 'kartu_soal')
    klien.db.panitia_ujian.docs.append({'id': 'pk', 'ujian_id': 'uas', 'jabatan': 'ketua', 'user_id': 'guru2'})
    tolak = lambda: [x for x in klien.db.audit_logs.docs if x['action'] == 'ujian_kartu_soal_ditolak']  # noqa: E731
    # bukan admin (ketua panitia / kepala madrasah)
    assert klien('guru2', 'guru', 'GET', f"/ujian/uas/berkas/{kartu['id']}/unduh", params={'konfirmasi': 1}).status_code == 403
    assert klien('kamad', 'kepala_sekolah', 'GET', '/ujian/uas/berkas/zip', params={'jenis': 'kartu_soal', 'jenjang': 8, 'konfirmasi': 1}).status_code == 403
    # admin tanpa konfirmasi
    assert klien('admin', 'admin', 'GET', f"/ujian/uas/berkas/{kartu['id']}/unduh").status_code == 400
    monkeypatch.setattr(rb, 'BATAS_ZIP_KARTU', 0)
    assert klien('admin', 'admin', 'GET', '/ujian/uas/berkas/zip', params={'jenis': 'kartu_soal', 'jenjang': 8, 'konfirmasi': 1}).status_code == 429
    t = tolak()
    assert [(x['user_id'], x['details']['alasan'], x['details']['mode']) for x in t] == [
        ('guru2', 'bukan_admin', 'tunggal'), ('kamad', 'bukan_admin', 'zip_jenjang'), ('admin', 'tanpa_konfirmasi', 'tunggal'),
        ('admin', 'batas_laju', 'zip_jenjang')]
    assert t[0]['details']['berkas_id'] == kartu['id'] and t[0]['details']['mapel'] == 'ipa'
    # kisi-kisi yang ditolak bukan kartu soal: tidak dicatat sebagai penolakan kartu soal
    kisi = next(b for b in klien.db.ujian_berkas.docs if b['jenis'] == 'kisi_kisi')
    klien('guru2', 'guru', 'GET', f"/ujian/uas/berkas/{kisi['id']}/unduh")
    assert len(tolak()) == 4
    # unduhan berhasil: tercatat atas nama admin di ujian_unduh_log
    monkeypatch.setattr(rb, 'BATAS_ZIP_KARTU', 10)
    assert klien('admin', 'admin', 'GET', f"/ujian/uas/berkas/{kartu['id']}/unduh", params={'konfirmasi': 1}).status_code == 200
    ok = [x for x in klien.db.ujian_unduh_log.docs if x['jenis_berkas'] == 'kartu_soal']
    assert len(ok) == 1 and (ok[0]['pengunduh_id'], ok[0]['mode']) == ('admin', 'tunggal')


def test_api_riwayat_unduhan_dengan_filter(klien):
    from datetime import datetime, timedelta

    import ujian_info
    _unggah_banyak(klien)
    kisi = next(b for b in klien.db.ujian_berkas.docs if b['jenis'] == 'kisi_kisi' and b['mapel'] == 'ipa')
    kartu = next(b for b in klien.db.ujian_berkas.docs if b['jenis'] == 'kartu_soal')
    jam = [datetime.fromisoformat('2026-12-01T08:00:00+07:00')]
    klien.db.ujian_tautan_publik.docs.append({'id': 't-info', 'ujian_id': 'uas', 'jenis': 'info', 'token': 'TokenInfoRiwayat_1234567890abcdef', 'aktif': True})

    def pada(hari, fn):
        jam[0] = datetime.fromisoformat(f'2026-12-0{hari}T08:00:00+07:00')
        ujian_info.sekarang_wib = lambda: jam[0]
        return fn()
    asli = ujian_info.sekarang_wib
    try:
        h = {'x-real-ip': '36.71.1.1', 'user-agent': 'HP Siswa Android'}
        pada(1, lambda: klien(None, None, 'GET', f"/publik/info-ujian/TokenInfoRiwayat_1234567890abcdef/kisi-kisi/{kisi['id']}", headers=h))
        pada(2, lambda: klien('admin', 'admin', 'GET', f"/ujian/uas/berkas/{kartu['id']}/unduh", params={'konfirmasi': 1},
                              headers={'x-real-ip': '10.0.0.9', 'user-agent': 'Laptop Windows'}))
        pada(3, lambda: klien('admin', 'admin', 'GET', '/ujian/uas/berkas/zip', params={'jenis': 'kisi_kisi', 'jenjang': 8},
                              headers={'x-real-ip': '10.0.0.9', 'user-agent': 'Laptop Windows'}))
    finally:
        ujian_info.sekarang_wib = asli
    url = '/ujian/uas/berkas/unduhan'
    d = klien('admin', 'admin', 'GET', url).json()
    assert d['ringkasan'] == {'total': 3, 'publik': 1, 'tunggal': 1, 'zip_jenjang': 1, 'kartu_soal': 1}
    assert [x['mode'] for x in d['items']] == ['zip_jenjang', 'tunggal', 'publik']
    assert d['items'][0]['jumlah_berkas'] == 2 and len(d['items'][0]['mapel_kosong']) == 13 and 'berkas_ids' not in d['items'][0]
    f = lambda **p: [x['mode'] for x in klien('admin', 'admin', 'GET', url, params=p).json()['items']]  # noqa: E731
    assert f(mode='publik') == ['publik'] and f(jenis='kartu_soal') == ['tunggal']
    assert f(dari='2026-12-02') == ['zip_jenjang', 'tunggal'] and f(sampai='2026-12-01') == ['publik'] and f(dari='2026-12-02', sampai='2026-12-02') == ['tunggal']
    assert f(cari='android') == ['publik'] and f(cari='10.0.0') == ['zip_jenjang', 'tunggal'] and f(cari='.*') == []
    assert len(klien('admin', 'admin', 'GET', url, params={'batas': 1}).json()['items']) == 1
    for salah in ({'mode': 'x'}, {'jenis': 'x'}, {'dari': '1-12-2026'}, {'dari': '2026-12-03', 'sampai': '2026-12-01'}, {'batas': 0}):
        assert klien('admin', 'admin', 'GET', url, params=salah).status_code == 422, salah
    assert klien('kamad', 'kepala_sekolah', 'GET', url).status_code == 200
    assert klien('guru1', 'guru', 'GET', url).status_code == 403
    del timedelta
