"""Alur HTTP Cetak & Arsip modul Ujian: otorisasi arsip per peran/jabatan, cetak per jenjang per ruang, arsip otomatis."""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(__file__))

from ujian_dasar import buat_klien, ujian_doc  # noqa: E402
import ujian_arsip as ua  # noqa: E402,I100


@pytest.fixture
def klien(monkeypatch):
    k = buat_klien(monkeypatch)
    db = k.db
    db.ujian.docs += [ujian_doc('uas', 'UAS', 'sem-kini', '2026-12-01', '2026-12-06'), ujian_doc('uts', 'UTS', 'sem-kini', '2026-09-21', '2026-09-26')]
    db.panitia_ujian.docs += [
        {'id': 'p1', 'ujian_id': 'uas', 'jabatan': 'ketua', 'user_id': 'guru1'},
        {'id': 'p2', 'ujian_id': 'uas', 'jabatan': 'bendahara', 'user_id': 'tu1'},
        {'id': 'p3', 'ujian_id': 'uts', 'jabatan': 'sekretaris', 'user_id': 'guru2'},
    ]
    return k


def _arsip(db, ujian_id, aid, waktu):
    meta = {'id': aid, 'ujian_id': ujian_id, 'ruang_id': 'r1', 'nama_ruang': '01', 'jenjang': 7, 'sesi_id': 's1', 'sesi_label': 'Sesi 1',
            'jenis_dokumen': 'berita_acara', 'format': 'pdf', 'nama_berkas': f'{aid}.pdf', 'ukuran': 4, 'mesin': 'libreoffice',
            'dibuat_oleh': 'admin', 'dibuat_oleh_nama': 'Administrator', 'waktu': waktu}
    db.arsip_ujian.docs.append(meta)
    db.arsip_ujian_berkas.docs.append({'arsip_id': aid, 'isi': b'%PDF', 'mime': 'application/pdf'})


def test_otorisasi_arsip_per_peran_dan_jabatan(klien):
    db = klien.db
    _arsip(db, 'uas', 'a1', '2026-12-02T10:00:00+07:00')
    _arsip(db, 'uas', 'a2', '2026-12-02T11:00:00+07:00')
    _arsip(db, 'uts', 'b1', '2026-09-21T10:00:00+07:00')
    # Berhak: admin, waka kurikulum, kepala madrasah, ketua ujian ini.
    for uid, peran in (('admin', 'admin'), ('wakakur', 'waka_kurikulum'), ('kamad', 'kepala_sekolah'), ('guru1', 'guru')):
        r = klien(uid, peran, 'GET', '/ujian/uas/arsip')
        assert r.status_code == 200, (uid, r.text)
        assert [a['id'] for a in r.json()['items']] == ['a2', 'a1']
    # Ditolak: bendahara ujian ini, sekretaris ujian LAIN, guru biasa, siswa — pesan menyebut pembuka arsip.
    for uid, peran in (('tu1', 'tenaga_kependidikan'), ('guru2', 'guru'), ('siswa1', 'siswa')):
        r = klien(uid, peran, 'GET', '/ujian/uas/arsip')
        assert r.status_code == 403, uid
    assert 'ketua panitia, sekretaris panitia' in klien('tu1', 'tenaga_kependidikan', 'GET', '/ujian/uas/arsip').json()['detail']
    # Sekretaris UTS boleh arsip UTS tetapi tidak berkas arsip UAS.
    assert klien('guru2', 'guru', 'GET', '/ujian/uts/arsip').json()['items'][0]['id'] == 'b1'
    assert klien('guru2', 'guru', 'GET', '/ujian/arsip/a1/berkas').status_code == 403
    r = klien('guru1', 'guru', 'GET', '/ujian/arsip/a1/berkas')
    assert r.status_code == 200 and r.content == b'%PDF' and 'a1.pdf' in r.headers['content-disposition']
    assert klien('admin', 'admin', 'GET', '/ujian/arsip/tidak-ada/berkas').status_code == 404
    # Saringan.
    assert klien('admin', 'admin', 'GET', '/ujian/uas/arsip', params={'jenis': 'daftar_hadir'}).json()['items'] == []
    assert len(klien('admin', 'admin', 'GET', '/ujian/uas/arsip', params={'jenjang': 7, 'ruang_id': 'r1'}).json()['items']) == 2
    assert ua.FIELD_ARSIP  # ringkasan arsip tanpa id pembuat
    assert 'dibuat_oleh' not in klien('admin', 'admin', 'GET', '/ujian/uas/arsip').json()['items'][0]


@pytest.fixture
def klien_cetak(klien, monkeypatch):
    """Ujian UAS lengkap: ruang 01 (kelas 7 & 8), jadwal sesi, daftar hadir, berita acara; LibreOffice dimatikan agar
    uji cepat & stabil (cadangan ReportLab)."""
    import routers.ujian_cetak as rc
    import ujian_cetak as uc
    from ujian_dasar import HARI_INI, tambah_kelas_siswa

    async def tanpa_lo(*_a, **_k):
        raise uc.LibreOfficeTidakTersedia('uji')
    monkeypatch.setattr(uc, 'berkas_office_ke_pdf', tanpa_lo)
    db = klien.db
    tambah_kelas_siswa(db)
    a = lambda m, p, **kw: klien('admin', 'admin', m, p, **kw).json()  # noqa: E731
    r1 = a('POST', '/ujian/uas/ruang', json={'nama_ruang': '01', 'jenjang': [7, 8]})
    a('POST', f"/ujian/uas/ruang/{r1['id']}/peserta", json={'siswa_ids': ['s-k7a-1', 's-k7a-2', 's-k8a-1']})
    jad = a('PUT', '/ujian/uas/formulir/jadwal', json={'sesi': [{'tanggal': HARI_INI, 'sesi_ke': 1, 'jam_mulai': '07:30', 'jam_selesai': '09:30',
                                                                'mapel': {'7': 'Matematika', '8': 'IPA'}}]})
    klien.r1, klien.sesi = r1, jad['jadwal'][0]
    klien.rc = rc
    return klien


def _cetak(k, jenis, jenjang=7, **kw):
    return k('guru1', 'guru', 'POST', '/ujian/uas/cetak', json={'jenis': jenis, 'ruang_id': k.r1['id'], 'jenjang': jenjang,
                                                               'sesi_id': k.sesi['id'], **kw})


def test_cetak_direkam_otomatis_ke_arsip(klien_cetak):
    k, db = klien_cetak, klien_cetak.db
    r = _cetak(k, 'daftar_hadir')
    assert r.status_code == 200, r.text
    assert r.content.startswith(b'%PDF') and r.headers['x-mesin-cetak'] == 'reportlab' and r.headers['x-arsip-id']
    assert 'daftar_hadir_UAS_uas_ruang_01_kelas_7_' in r.headers['content-disposition']
    meta = db.arsip_ujian.docs[0]
    assert (meta['jenis_dokumen'], meta['jenjang'], meta['format'], meta['dibuat_oleh_nama']) == ('daftar_hadir', 7, 'pdf', 'Bu Siti')
    assert db.arsip_ujian_berkas.docs[0]['isi'] == r.content
    # Docx berita acara juga diarsipkan; pratinjau tidak.
    r = _cetak(k, 'berita_acara', jenjang=8, format='docx')
    assert r.status_code == 200 and r.content[:2] == b'PK' and r.headers['x-mesin-cetak'] == 'docx'
    r = _cetak(k, 'berita_acara', pratinjau=True, format='docx')
    assert r.status_code == 200 and r.content.startswith(b'%PDF') and 'x-arsip-id' not in r.headers
    assert len(db.arsip_ujian.docs) == 2
    assert [a['action'] for a in db.audit_logs.docs if a['action'] == 'ujian_cetak'] == ['ujian_cetak', 'ujian_cetak']
    # Validasi: jenjang bukan milik ruang, sesi/ruang salah; bukan panitia ditolak.
    assert _cetak(k, 'daftar_hadir', jenjang=9).status_code == 400
    assert k('admin', 'admin', 'POST', '/ujian/uas/cetak', json={'jenis': 'daftar_hadir', 'ruang_id': 'x', 'jenjang': 7, 'sesi_id': k.sesi['id']}).status_code == 404
    assert k('guru2', 'guru', 'POST', '/ujian/uas/cetak', json={'jenis': 'daftar_hadir', 'ruang_id': k.r1['id'], 'jenjang': 7, 'sesi_id': k.sesi['id']}).status_code == 403
    # Bendahara boleh mencetak tetapi tidak membuka arsip.
    r = k('tu1', 'tenaga_kependidikan', 'POST', '/ujian/uas/cetak', json={'jenis': 'daftar_hadir', 'ruang_id': k.r1['id'], 'jenjang': 7, 'sesi_id': k.sesi['id']})
    assert r.status_code == 200 and k('tu1', 'tenaga_kependidikan', 'GET', '/ujian/uas/arsip').status_code == 403


def test_pilihan_dan_kesiapan_cetak(klien_cetak):
    k, db = klien_cetak, klien_cetak.db
    d = k('guru1', 'guru', 'GET', '/ujian/uas/cetak/pilihan').json()
    assert d['ruang'] == [{'id': k.r1['id'], 'nama_ruang': '01', 'jenjang': [7, 8], 'per_jenjang': {'7': 2, '8': 1}}]
    assert d['sesi'][0]['mapel']['7'] == 'Matematika' and d['boleh_arsip'] is True and d['mesin']['mesin'] in ('libreoffice', 'reportlab')
    assert k('tu1', 'tenaga_kependidikan', 'GET', '/ujian/uas/cetak/pilihan').json()['boleh_arsip'] is False
    assert k('guru2', 'guru', 'GET', '/ujian/uas/cetak/pilihan').status_code == 403
    ks = k('admin', 'admin', 'GET', '/ujian/uas/cetak/kesiapan', params={'sesi_id': k.sesi['id']}).json()['items']
    assert [(x['jenjang'], x['peserta'], x['dh_lengkap'], x['belum'], x['ba_terisi']) for x in ks] == [(7, 2, False, 2, False), (8, 1, False, 1, False)]
    from ujian_dasar import HARI_INI
    for sid in ('s-k8a-1',):
        pid = next(p['id'] for p in db.peserta_ruang.docs if p['siswa_id'] == sid)
        k('admin', 'admin', 'PUT', '/ujian/uas/daftar-hadir/status', json={'peserta_id': pid, 'tanggal': HARI_INI, 'status': 'sakit', 'catatan': 'Demam tinggi'})
    ks = k('admin', 'admin', 'GET', '/ujian/uas/cetak/kesiapan', params={'sesi_id': k.sesi['id']}).json()['items']
    assert ks[1]['dh_lengkap'] is True and ks[0]['dh_lengkap'] is False
    assert k('admin', 'admin', 'GET', '/ujian/uas/cetak/kesiapan', params={'sesi_id': 'x'}).status_code == 404


def _png_data_url():
    import base64
    import io

    from PIL import Image, ImageDraw
    im = Image.new('RGBA', (240, 90), (0, 0, 0, 0))
    ImageDraw.Draw(im).line([(10, 70), (120, 15), (230, 60)], fill=(0, 0, 0, 255), width=5)
    b = io.BytesIO()
    im.save(b, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def test_cetak_daftar_hadir_per_jenjang_isi_dokumen(klien_cetak):
    import io
    import zipfile

    import ujian_cetak_docx as cd
    k, db = klien_cetak, klien_cetak.db
    pr = {p['siswa_id']: p['id'] for p in db.peserta_ruang.docs}
    k('admin', 'admin', 'PUT', f"/ujian/uas/ruang/{k.r1['id']}/nomor-peserta", json={'items': [
        {'peserta_id': pr['s-k7a-1'], 'nomor_peserta': '01-001'}, {'peserta_id': pr['s-k7a-2'], 'nomor_peserta': '01-002'},
        {'peserta_id': pr['s-k8a-1'], 'nomor_peserta': '01-003'}]})
    k('admin', 'admin', 'PUT', '/ujian/uas/formulir/aktivasi', json={'aktif': True, 'jam_buka': '07:00', 'jam_tutup': '12:00'})
    token = next(f for f in db.formulir_ujian.docs if f['ujian_id'] == 'uas')['token']
    k(None, None, 'POST', f'/publik/ujian/{token}/daftar-hadir', json={'sesi_id': k.sesi['id'], 'ruang_id': k.r1['id'], 'peserta_id': pr['s-k7a-1'], 'ttd_png': _png_data_url()})
    k('admin', 'admin', 'PUT', '/ujian/uas/formulir/template', json={'nama_madrasah': 'MTsN 2 Kota Malang', 'kop_madrasah': 'MTs NEGERI 2 KOTA MALANG',
      'alamat': 'Jl. Raya Cemorokandang No 77, Kota Malang', 'kota_ttd': 'Malang', 'singkatan_ujian': 'ASAS',
      'nama_kegiatan': 'Asesmen Sumatif Akhir Semester', 'catatan_kaki': 'Diisi dengan Mata Pelajaran pada waktu itu'})
    r = k('guru1', 'guru', 'POST', '/ujian/uas/cetak/daftar-hadir', json={'ruang_id': k.r1['id'], 'jenjang': 7, 'sesi_id': k.sesi['id'], 'format': 'docx'})
    assert r.status_code == 200, r.text
    teks = cd.teks_dokumen(r.content)
    assert 'ASAS TAHUN AJARAN 2026/2027' in teks and 'Matematika' in teks and 'Siswa 7A 1' in teks and 'Siswa 7A 2' in teks and '01-002' in teks
    assert 'Siswa 8A 1' not in teks  # jenjang lain di ruang campuran tidak ikut
    assert 'Malang, 2 Desember 2026' in teks and '07.30 – 09.30 WIB' in teks
    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        assert len([n for n in z.namelist() if n.startswith('word/media/ttd_')]) == 1  # TTD peserta yang sudah hadir
    assert db.arsip_ujian.docs[-1]['jenis_dokumen'] == 'daftar_hadir'


def test_cetak_berita_acara_per_jenjang_isi_dokumen(klien_cetak):
    import io
    import zipfile

    import ujian_cetak_docx as cd
    from ujian_dasar import HARI_INI
    k, db = klien_cetak, klien_cetak.db
    pr = {p['siswa_id']: p['id'] for p in db.peserta_ruang.docs}
    k('admin', 'admin', 'PUT', f"/ujian/uas/ruang/{k.r1['id']}/nomor-peserta", json={'items': [
        {'peserta_id': pr['s-k7a-1'], 'nomor_peserta': '01-001'}, {'peserta_id': pr['s-k7a-2'], 'nomor_peserta': '01-002'},
        {'peserta_id': pr['s-k8a-1'], 'nomor_peserta': '01-003'}]})
    k('admin', 'admin', 'PUT', '/ujian/uas/formulir/aktivasi', json={'aktif': True, 'jam_buka': '07:00', 'jam_tutup': '12:00'})
    token = next(f for f in db.formulir_ujian.docs if f['ujian_id'] == 'uas')['token']
    k(None, None, 'POST', f'/publik/ujian/{token}/daftar-hadir', json={'sesi_id': k.sesi['id'], 'ruang_id': k.r1['id'], 'peserta_id': pr['s-k7a-1'], 'ttd_png': _png_data_url()})
    for sid, st in (('s-k7a-2', 'izin'), ('s-k8a-1', 'sakit')):
        k('admin', 'admin', 'PUT', '/ujian/uas/daftar-hadir/status', json={'peserta_id': pr[sid], 'tanggal': HARI_INI, 'status': st, 'catatan': 'Keterangan ortu'})
    k('admin', 'admin', 'POST', '/ujian/pengawas', json={'user_ids': ['guru2']})
    r = k(None, None, 'POST', f'/publik/ujian/{token}/berita-acara', json={'sesi_id': k.sesi['id'], 'ruang_id': k.r1['id'],
          'pengawas_id': db.guru_pengawas.docs[0]['id'], 'catatan': 'Berjalan tertib.', 'ttd_png': _png_data_url()})
    assert r.status_code == 200, r.text
    r = k('admin', 'admin', 'POST', '/ujian/uas/cetak/berita-acara', json={'ruang_id': k.r1['id'], 'jenjang': 7, 'sesi_id': k.sesi['id'], 'format': 'docx'})
    assert r.status_code == 200, r.text
    teks = cd.teks_dokumen(r.content)
    for s in ('PENYELENGGARAAN ASESMEN SUMATIF AKHIR SEMESTER', 'kelas 7 Tahun Ajaran 2026/2027 dari Pukul 07.30 WIB sampai dengan Pukul 09.30 WIB',
              'Ruang : 01', '2 (dua)', ': 1 orang', '01-001', ': 1 orang, yakni nomor', '01-002', '*Matematika', 'Berjalan tertib.', 'Pak Hadi', 'NIP-guru2',
              'Pada hari ini Rabu tanggal dua'):
        assert s in teks, s
    assert '01-003' not in teks  # peserta jenjang 8 tidak masuk berita acara kelas 7
    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        assert any(n.startswith('word/media/ttd_') for n in z.namelist())
    # Berita acara kelas 8 di ruang yang sama: 1 peserta sakit, mapel IPA.
    teks8 = cd.teks_dokumen(k('admin', 'admin', 'POST', '/ujian/uas/cetak/berita-acara', json={'ruang_id': k.r1['id'], 'jenjang': 8, 'sesi_id': k.sesi['id'], 'format': 'docx'}).content)
    assert '*IPA' in teks8 and '1 (satu)' in teks8 and '01-003' in teks8
    assert [a['jenis_dokumen'] for a in db.arsip_ujian.docs] == ['berita_acara', 'berita_acara']


def test_cari_dan_buka_arsip(klien):
    db = klien.db
    _arsip(db, 'uas', 'a1', '2026-12-02T10:00:00+07:00')
    _arsip(db, 'uas', 'a2', '2026-12-02T11:00:00+07:00')
    _arsip(db, 'uts', 'b1', '2026-09-21T10:00:00+07:00')
    db.arsip_ujian.docs[1]['jenis_dokumen'] = 'daftar_hadir'
    d = klien('kamad', 'kepala_sekolah', 'GET', '/ujian/arsip/cari').json()
    assert d['total'] == 3 and d['items'][0]['id'] == 'a2' and d['items'][0]['ujian_nama'] == 'UAS uas'
    assert [x['id'] for x in klien('admin', 'admin', 'GET', '/ujian/arsip/cari', params={'q': 'uts ruang 01'}).json()['items']] == ['b1']
    assert [x['id'] for x in klien('admin', 'admin', 'GET', '/ujian/arsip/cari', params={'q': 'daftar hadir'}).json()['items']] == ['a2']
    assert klien('admin', 'admin', 'GET', '/ujian/arsip/cari', params={'jenis': 'berita_acara'}).json()['total'] == 2
    # Ketua UAS hanya melihat arsip UAS; bendahara ditolak.
    assert {x['ujian_id'] for x in klien('guru1', 'guru', 'GET', '/ujian/arsip/cari').json()['items']} == {'uas'}
    assert klien('tu1', 'tenaga_kependidikan', 'GET', '/ujian/arsip/cari').status_code == 403
    # Buka arsip + dokumen terkait (ruang, jenjang, sesi sama).
    d = klien('guru1', 'guru', 'GET', '/ujian/arsip/a1').json()
    assert d['arsip']['id'] == 'a1' and [t['id'] for t in d['terkait']] == ['a2']
    assert klien('guru1', 'guru', 'GET', '/ujian/arsip/b1').status_code == 403
    assert klien('admin', 'admin', 'GET', '/ujian/arsip/tidak-ada').status_code == 404


def test_cetak_per_ruang_semua_jenjang_satu_dokumen(klien_cetak):
    """Mode per ruang: satu daftar hadir & satu berita acara untuk seluruh jenjang ruang campuran; arsip bermode 'ruang'."""
    import ujian_cetak_docx as cd
    from ujian_dasar import HARI_INI
    k, db = klien_cetak, klien_cetak.db
    pr = {p['siswa_id']: p['id'] for p in db.peserta_ruang.docs}
    k('admin', 'admin', 'PUT', f"/ujian/uas/ruang/{k.r1['id']}/nomor-peserta", json={'items': [
        {'peserta_id': pr['s-k7a-1'], 'nomor_peserta': '01-001'}, {'peserta_id': pr['s-k7a-2'], 'nomor_peserta': '01-002'},
        {'peserta_id': pr['s-k8a-1'], 'nomor_peserta': '01-003'}]})
    k('admin', 'admin', 'PUT', '/ujian/uas/daftar-hadir/status', json={'peserta_id': pr['s-k8a-1'], 'tanggal': HARI_INI, 'status': 'sakit', 'catatan': 'Demam'})
    isi = {'mode': 'ruang', 'ruang_id': k.r1['id'], 'sesi_id': k.sesi['id'], 'format': 'docx'}
    r = k('guru1', 'guru', 'POST', '/ujian/uas/cetak', json={'jenis': 'daftar_hadir', **isi})
    assert r.status_code == 200, r.text
    assert 'ruang_01_kelas_7-8_per_ruang_' in r.headers['content-disposition']
    teks = cd.teks_dokumen(r.content)
    for s in ('Siswa 7A 1', 'Siswa 7A 2', 'Siswa 8A 1', 'Matematika (kelas 7); IPA (kelas 8)'):
        assert s in teks, s
    r = k('guru1', 'guru', 'POST', '/ujian/uas/cetak', json={'jenis': 'berita_acara', **isi})
    teks = cd.teks_dokumen(r.content)
    for s in ('kelas 7 dan 8 Tahun Ajaran', '3 (tiga)', '01-003', 'Matematika (kelas 7); IPA (kelas 8)'):
        assert s in teks, s
    # Arsip: mode ruang, jenjang kosong, daftar jenjang ruang; saringan mode & dokumen terkait.
    a = db.arsip_ujian.docs[-1]
    assert (a['mode'], a['jenjang'], a['jenjang_daftar']) == ('ruang', None, [7, 8])
    _cetak(k, 'daftar_hadir')  # per jenjang (kelas 7)
    semua = k('admin', 'admin', 'GET', '/ujian/uas/arsip').json()['items']
    assert sorted(x['mode'] for x in semua) == ['jenjang', 'ruang', 'ruang']
    assert len(k('admin', 'admin', 'GET', '/ujian/uas/arsip', params={'mode': 'ruang'}).json()['items']) == 2
    per_jenjang = k('admin', 'admin', 'GET', '/ujian/uas/arsip', params={'mode': 'jenjang'}).json()['items']
    assert [(x['jenjang'], x['jenjang_daftar']) for x in per_jenjang] == [(7, [7])]
    d = k('admin', 'admin', 'GET', f"/ujian/arsip/{a['id']}").json()
    assert [t['mode'] for t in d['terkait']] == ['ruang']  # pasangan DH per ruang, bukan cetakan per jenjang
    assert [x['id'] for x in k('admin', 'admin', 'GET', '/ujian/arsip/cari', params={'q': 'per ruang kelas 7 dan 8'}).json()['items']] \
        == [x['id'] for x in semua if x['mode'] == 'ruang']
    # PDF cadangan (ReportLab) & pratinjau juga jalan; mode per jenjang tetap wajib jenjang.
    r = k('guru1', 'guru', 'POST', '/ujian/uas/cetak', json={'jenis': 'daftar_hadir', **isi, 'format': 'pdf', 'pratinjau': True})
    assert r.status_code == 200 and r.content.startswith(b'%PDF') and 'x-arsip-id' not in r.headers
    r = k('guru1', 'guru', 'POST', '/ujian/uas/cetak', json={'jenis': 'berita_acara', **isi, 'format': 'pdf'})
    assert r.status_code == 200 and r.content.startswith(b'%PDF')
    assert k('guru1', 'guru', 'POST', '/ujian/uas/cetak', json={'jenis': 'daftar_hadir', 'ruang_id': k.r1['id'], 'sesi_id': k.sesi['id']}).status_code == 400


def test_arsip_lama_tanpa_mode_dianggap_per_jenjang(klien):
    db = klien.db
    _arsip(db, 'uas', 'a1', '2026-12-02T10:00:00+07:00')
    it = klien('admin', 'admin', 'GET', '/ujian/uas/arsip').json()['items'][0]
    assert (it['mode'], it['jenjang_daftar']) == ('jenjang', [7])
    assert klien('admin', 'admin', 'GET', '/ujian/uas/arsip', params={'mode': 'ruang'}).json()['items'] == []
