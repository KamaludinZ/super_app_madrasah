"""Alur Ujian Madrasah lewat HTTP terhadap aplikasi FastAPI sungguhan (server.app, token JWT, dependensi asli)
dengan basis data tiruan dalam memori (tests/pkg_palsu.Db). Waktu server dipatok 2 Des 2026 08.00 WIB."""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(__file__))

from ujian_dasar import HARI_INI, buat_klien, ujian_doc as _ujian  # noqa: E402


@pytest.fixture
def klien(monkeypatch):
    return buat_klien(monkeypatch)


def test_beranda_hanya_semester_aktif_dan_akses(klien):
    db = klien.db
    db.ujian.docs += [
        _ujian('uas', 'UAS', 'sem-kini', '2026-12-01', '2026-12-06'),
        _ujian('uts', 'UTS', 'sem-kini', '2026-09-21', '2026-09-26'),
        _ujian('lama', 'UAS', 'sem-lalu', '2026-06-01', '2026-06-06'),
    ]
    db.formulir_ujian.docs.append({'ujian_id': 'uas', 'aktif': True, 'jam_buka': '07:00', 'jam_tutup': '12:00'})
    db.panitia_ujian.docs.append({'id': 'p1', 'ujian_id': 'uas', 'jabatan': 'sekretaris', 'user_id': 'guru1'})
    db.ruang_ujian.docs += [{'id': 'r1', 'ujian_id': 'uas'}, {'id': 'r2', 'ujian_id': 'uas'}]

    r = klien('admin', 'admin', 'GET', '/ujian/beranda')
    assert r.status_code == 200, r.text
    d = r.json()
    assert d['konteks'] == {'semester_id': 'sem-kini', 'semester_nama': 'Ganjil', 'tahun_pelajaran': '2026/2027', 'is_override': False}
    assert [u['id'] for u in d['items']] == ['uts', 'uas']  # urut tanggal mulai; semester lalu tidak tampil
    uas = d['items'][1]
    assert uas['formulir']['status'] == 'dibuka' and uas['jumlah_ruang'] == 2
    assert d['items'][0]['formulir']['status'] == 'selesai'
    assert d['akses']['pengelola'] and all(m['akses'] for m in d['menu'])

    # Panitia (sekretaris) melihat beranda dengan jabatannya; menu sesuai jabatan.
    d = klien('guru1', 'guru', 'GET', '/ujian/beranda').json()
    assert d['akses'] == {'pengelola': False, 'pimpinan': False, 'jabatan': ['sekretaris']}
    assert {u['id']: u['jabatan_saya'] for u in d['items']} == {'uts': None, 'uas': 'sekretaris'}
    menu = {m['key']: m['akses'] for m in d['menu']}
    assert menu['arsip'] and not menu['panitia']

    # Kepala madrasah memantau; waka kurikulum pengelola.
    assert klien('kamad', 'kepala_sekolah', 'GET', '/ujian/beranda').json()['akses']['pimpinan']
    wk = klien('wakakur', 'waka_kurikulum', 'GET', '/ujian/beranda').json()
    assert wk['akses']['pimpinan'] and not wk['akses']['pengelola']
    # pimpinan juga memantau Tautan Publik & Berkas Soal (hanya melihat; mengubah/unduh kartu soal tetap admin)
    assert {m['key'] for m in wk['menu'] if m['akses']} == {'daftar_hadir', 'berita_acara', 'cetak', 'kartu_peserta', 'kartu_meja', 'arsip',
                                                          'tautan_publik', 'berkas_soal', 'audit_publik'}

    # GTK bukan panitia & siswa ditolak dengan pesan spesifik.
    r = klien('guru2', 'guru', 'GET', '/ujian/beranda')
    assert r.status_code == 403 and 'panitia' in r.json()['detail']
    assert klien('siswa1', 'siswa', 'GET', '/ujian/beranda').status_code == 403
    # Panitia ujian semester lalu tidak otomatis panitia semester ini.
    db.panitia_ujian.docs.append({'id': 'p2', 'ujian_id': 'lama', 'jabatan': 'ketua', 'user_id': 'guru2'})
    assert klien('guru2', 'guru', 'GET', '/ujian/beranda').status_code == 403


def test_beranda_mengikuti_konteks_lihat(klien):
    db = klien.db
    db.ujian.docs += [_ujian('kini', 'UTS', 'sem-kini', '2026-09-21', '2026-09-26'),
                      _ujian('lama', 'UAS', 'sem-lalu', '2026-06-01', '2026-06-06')]
    next(u for u in db.users.docs if u['id'] == 'admin')['view_semester_id'] = 'sem-lalu'
    d = klien('admin', 'admin', 'GET', '/ujian/beranda').json()
    assert d['konteks']['is_override'] and d['konteks']['tahun_pelajaran'] == '2025/2026'
    assert [u['id'] for u in d['items']] == ['lama']


def test_beranda_semester_kosong(klien):
    d = klien('admin', 'admin', 'GET', '/ujian/beranda').json()
    assert d['items'] == [] and d['konteks']['semester_id'] == 'sem-kini'


def test_status_formulir_ringkas(klien):
    db = klien.db
    db.ujian.docs += [
        _ujian('uas', 'UAS', 'sem-kini', '2026-12-01', '2026-12-06'),
        _ujian('uts', 'UTS', 'sem-kini', '2026-09-21', '2026-09-26'),
        _ujian('susulan', 'UTS', 'sem-kini', '2026-12-10', '2026-12-10'),
    ]
    db.formulir_ujian.docs += [{'ujian_id': 'uas', 'aktif': True, 'jam_buka': '07:00', 'jam_tutup': '12:00'},
                               {'ujian_id': 'susulan', 'aktif': True}]
    r = klien('kamad', 'kepala_sekolah', 'GET', '/ujian/status-formulir')
    assert r.status_code == 200, r.text
    d = r.json()
    assert d['tanggal'] == HARI_INI and d['jam'] == '08:00'
    assert d['ringkasan'] == {'tertutup': 1, 'dibuka': 1, 'selesai': 1}
    assert {i['ujian_id']: i['formulir']['status'] for i in d['items']} == {'uas': 'dibuka', 'uts': 'selesai', 'susulan': 'tertutup'}
    assert klien('guru2', 'guru', 'GET', '/ujian/status-formulir').status_code == 403


def test_akses_saya_menu_panitia_otomatis(klien):
    db = klien.db
    db.ujian.docs += [_ujian('uas', 'UAS', 'sem-kini', '2026-12-01', '2026-12-06'),
                      _ujian('uts', 'UTS', 'sem-kini', '2026-09-21', '2026-09-26')]
    # Bukan panitia: 200 tanpa akses (grup menu disembunyikan klien).
    d = klien('guru1', 'guru', 'GET', '/ujian/akses-saya').json()
    assert d['jabatan'] == [] and not any(m['akses'] for m in d['menu'])
    # Begitu ditetapkan (dua jabatan berbeda di dua ujian), menunya gabungan kedua jabatan.
    db.panitia_ujian.docs += [{'id': 'p1', 'ujian_id': 'uas', 'jabatan': 'bendahara', 'user_id': 'guru1'},
                              {'id': 'p2', 'ujian_id': 'uts', 'jabatan': 'ketua', 'user_id': 'guru1'}]
    d = klien('guru1', 'guru', 'GET', '/ujian/akses-saya').json()
    assert d['jabatan'] == ['bendahara', 'ketua']
    menu = {m['key']: m['akses'] for m in d['menu']}
    assert menu['arsip'] and menu['cetak'] and menu['ruang'] and not menu['panitia']
    # Admin pengelola; siswa tanpa akses.
    assert klien('admin', 'admin', 'GET', '/ujian/akses-saya').json()['pengelola'] is True
    d = klien('siswa1', 'siswa', 'GET', '/ujian/akses-saya').json()
    assert d == {**d, 'pengelola': False, 'pimpinan': False, 'jabatan': []}


def test_arsip_semester_lalu_dengan_otorisasi(klien):
    db = klien.db
    db.semesters.docs.append({'id': 'sem-lalu2', 'name': 'Ganjil', 'code': 'ganjil', 'academic_year_id': 'tp-lalu'})
    db.ujian.docs += [
        _ujian('kini', 'UAS', 'sem-kini', '2026-12-01', '2026-12-06'),
        {**_ujian('genap-uts', 'UTS', 'sem-lalu', '2026-03-09', '2026-03-14'), 'semester_nama': 'Genap', 'tahun_pelajaran': '2025/2026'},
        {**_ujian('genap-uas', 'UAS', 'sem-lalu', '2026-06-01', '2026-06-06'), 'semester_nama': 'Genap', 'tahun_pelajaran': '2025/2026'},
        {**_ujian('ganjil-uas', 'UAS', 'sem-lalu2', '2025-12-01', '2025-12-06'), 'tahun_pelajaran': '2025/2026'},
    ]
    d = klien('kamad', 'kepala_sekolah', 'GET', '/ujian/arsip-semester').json()
    assert [g['semester_id'] for g in d['semester']] == ['sem-lalu', 'sem-lalu2']  # terbaru dulu, semester aktif tidak ikut
    assert [u['id'] for u in d['semester'][0]['items']] == ['genap-uts', 'genap-uas']
    assert d['semester'][0]['items'][0]['formulir']['status'] == 'selesai'

    # Ketua/sekretaris hanya ujian tempat ia menjabat; bendahara & guru lain ditolak.
    db.panitia_ujian.docs += [{'id': 'p1', 'ujian_id': 'genap-uas', 'jabatan': 'ketua', 'user_id': 'guru1'},
                              {'id': 'p2', 'ujian_id': 'ganjil-uas', 'jabatan': 'bendahara', 'user_id': 'guru1'},
                              {'id': 'p3', 'ujian_id': 'genap-uts', 'jabatan': 'bendahara', 'user_id': 'tu1'}]
    d = klien('guru1', 'guru', 'GET', '/ujian/arsip-semester').json()
    assert [u['id'] for g in d['semester'] for u in g['items']] == ['genap-uas']
    assert d['semester'][0]['items'][0]['jabatan_saya'] == 'ketua'
    r = klien('tu1', 'tenaga_kependidikan', 'GET', '/ujian/arsip-semester')
    assert r.status_code == 403 and 'ketua dan sekretaris' in r.json()['detail']
    assert klien('guru2', 'guru', 'GET', '/ujian/arsip-semester').status_code == 403
    assert klien('siswa1', 'siswa', 'GET', '/ujian/arsip-semester').status_code == 403
    assert len(klien('wakakur', 'waka_kurikulum', 'GET', '/ujian/arsip-semester').json()['semester']) == 2
    assert klien('wakakur', 'waka_kurikulum', 'GET', '/ujian/panitia').status_code == 403


def test_semester_baru_grup_menu_kosong_data_lama_jadi_arsip(klien):
    """Pergantian semester aktif: beranda & menu panitia mulai kosong, ujian lama tetap dapat dibuka dari arsip."""
    db = klien.db
    db.ujian.docs.append(_ujian('uas', 'UAS', 'sem-kini', '2026-12-01', '2026-12-06'))
    db.panitia_ujian.docs.append({'id': 'p1', 'ujian_id': 'uas', 'jabatan': 'ketua', 'user_id': 'guru1'})
    assert klien('guru1', 'guru', 'GET', '/ujian/akses-saya').json()['jabatan'] == ['ketua']

    # Semester genap 2026/2027 diaktifkan.
    for s in db.semesters.docs:
        s['is_active'] = False
    db.semesters.docs.append({'id': 'sem-baru', 'name': 'Genap', 'code': 'genap', 'academic_year_id': 'tp-kini', 'is_active': True})

    d = klien('admin', 'admin', 'GET', '/ujian/beranda').json()
    assert d['items'] == [] and d['konteks']['semester_id'] == 'sem-baru'
    akses = klien('guru1', 'guru', 'GET', '/ujian/akses-saya').json()
    assert akses['jabatan'] == [] and not any(m['akses'] for m in akses['menu'])
    assert klien('guru1', 'guru', 'GET', '/ujian/beranda').status_code == 403
    # Ketua ujian semester lalu tetap dapat membuka arsipnya.
    arsip = klien('guru1', 'guru', 'GET', '/ujian/arsip-semester').json()
    assert [u['id'] for g in arsip['semester'] for u in g['items']] == ['uas']


def test_tanpa_semester_aktif(klien):
    for s in klien.db.semesters.docs:
        s['is_active'] = False
    d = klien('admin', 'admin', 'GET', '/ujian/beranda').json()
    assert d['items'] == [] and d['konteks']['semester_id'] is None
    assert klien('guru1', 'guru', 'GET', '/ujian/akses-saya').json()['jabatan'] == []


def test_kepanitiaan_buat_ujian_dan_susun_panitia(klien):
    db = klien.db
    sem = next(s for s in db.semesters.docs if s['id'] == 'sem-kini')
    sem.update({'start_date': '2026-07-13', 'end_date': '2026-12-31'})

    # Hanya admin (waka kurikulum & kepala madrasah memantau; panitia pun tidak mengubah susunan).
    assert klien('kamad', 'kepala_sekolah', 'GET', '/ujian/panitia').status_code == 403
    for uid, peran in (('wakakur', 'waka_kurikulum'), ('guru1', 'guru')):
        r = klien(uid, peran, 'POST', '/ujian', json={'jenis': 'UAS', 'nama': 'ASAS', 'mulai': '2026-12-01', 'selesai': '2026-12-06'})
        assert r.status_code == 403 and r.json()['detail'] == 'Hanya admin yang dapat mengelola ujian dan kepanitiaan'
    # Pengguna yang memiliki peran admin tetap lolos walau peran aktifnya lain (sama dengan require_role).
    next(u for u in db.users.docs if u['id'] == 'wakakur')['roles'].append('admin')
    assert klien('wakakur', 'waka_kurikulum', 'GET', '/ujian/panitia').status_code == 200
    next(u for u in db.users.docs if u['id'] == 'wakakur')['roles'].remove('admin')

    # Buat ujian: validasi tanggal semester & nama ganda.
    r = klien('admin', 'admin', 'POST', '/ujian', json={'jenis': 'UAS', 'nama': 'ASAS Ganjil 2026/2027', 'mulai': '2026-12-01', 'selesai': '2026-12-06'})
    assert r.status_code == 200, r.text
    u = r.json()
    assert u['semester_id'] == 'sem-kini' and u['tahun_pelajaran'] == '2026/2027' and u['formulir']['status'] == 'tertutup'
    r = klien('admin', 'admin', 'POST', '/ujian', json={'jenis': 'UAS', 'nama': 'ASAS Ganjil 2026/2027', 'mulai': '2026-12-01', 'selesai': '2026-12-06'})
    assert r.status_code == 409
    r = klien('admin', 'admin', 'POST', '/ujian', json={'jenis': 'UTS', 'nama': 'ASTS', 'mulai': '2027-01-04', 'selesai': '2027-01-09'})
    assert r.status_code == 400 and 'rentang semester' in r.json()['detail']
    r = klien('admin', 'admin', 'POST', '/ujian', json={'jenis': 'UTS', 'nama': 'ASTS', 'mulai': '2026-10-09', 'selesai': '2026-10-01'})
    assert r.status_code == 422

    # Susun panitia dari akun GTK; satu orang satu jabatan; siswa/satpam tidak sah.
    url = f"/ujian/{u['id']}/panitia"
    r = klien('admin', 'admin', 'PUT', url, json={'ketua': 'guru1', 'sekretaris': 'guru1'})
    assert r.status_code == 400 and 'Sekretaris Panitia' in r.json()['detail']
    r = klien('admin', 'admin', 'PUT', url, json={'ketua': 'siswa1'})
    assert r.status_code == 400 and 'GTK aktif' in r.json()['detail']
    r = klien('admin', 'admin', 'PUT', url, json={'penanggung_jawab': 'kamad', 'ketua': 'guru1', 'sekretaris': 'guru2', 'bendahara': 'tu1'})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d['panitia']['ketua'] == {'user_id': 'guru1', 'nama': 'Bu Siti', 'nip': 'NIP-guru1', 'peran': 'guru'}
    assert d['diubah']['oleh_nama'] == 'Administrator'
    audit = [a for a in db.audit_logs.docs if a['action'] == 'ujian_panitia_ubah']
    assert len(audit) == 1 and audit[0]['details']['perubahan']['ketua'] == {'dari': None, 'ke': 'guru1'}

    # Panitia langsung mendapat menu sesuai jabatan.
    assert klien('guru2', 'guru', 'GET', '/ujian/akses-saya').json()['jabatan'] == ['sekretaris']

    # Panitia (ketua) tidak dapat mengubah susunan.
    assert klien('guru1', 'guru', 'PUT', url, json={'ketua': 'guru2'}).status_code == 403
    assert klien('wakakur', 'waka_kurikulum', 'PUT', url, json={'ketua': 'guru2'}).status_code == 403

    # Daftar kepanitiaan memuat susunan tersimpan.
    d = klien('admin', 'admin', 'GET', '/ujian/panitia').json()
    assert d['konteks']['semester_id'] == 'sem-kini' and len(d['items']) == 1
    assert d['items'][0]['panitia']['bendahara']['nama'] == 'Bu Laili' and d['items'][0]['diubah']

    # Tukar ketua & sekretaris; kosongkan bendahara. Tanpa perubahan: tidak menambah audit.
    r = klien('admin', 'admin', 'PUT', url, json={'penanggung_jawab': 'kamad', 'ketua': 'guru2', 'sekretaris': 'guru1'})
    assert r.status_code == 200 and r.json()['panitia']['bendahara'] is None
    klien('admin', 'admin', 'PUT', url, json={'penanggung_jawab': 'kamad', 'ketua': 'guru2', 'sekretaris': 'guru1'})
    assert len([a for a in db.audit_logs.docs if a['action'] == 'ujian_panitia_ubah']) == 2
    assert klien('tu1', 'tenaga_kependidikan', 'GET', '/ujian/akses-saya').json()['jabatan'] == []

    # Ujian semester lain (arsip) tidak diubah dari konteks semester ini; ujian tak dikenal 404.
    db.ujian.docs.append(_ujian('lama', 'UAS', 'sem-lalu', '2026-06-01', '2026-06-06'))
    assert klien('admin', 'admin', 'PUT', '/ujian/lama/panitia', json={'ketua': 'guru1'}).status_code == 409
    assert klien('admin', 'admin', 'PUT', '/ujian/tidak-ada/panitia', json={}).status_code == 404


def test_gtk_pilihan_untuk_pejabat(klien):
    db = klien.db
    db.users.docs += [
        {'id': 'satpam1', 'username': 'satpam1', 'full_name': 'Pak Satpam', 'roles': ['satpam'], 'is_active': True, 'token_version': 0},
        {'id': 'nonaktif', 'username': 'x', 'full_name': 'Guru Pensiun', 'roles': ['guru'], 'is_active': False, 'token_version': 0},
        {'id': 'ortu', 'username': 'o', 'full_name': 'Wali Murid', 'roles': ['orang_tua'], 'is_active': True, 'token_version': 0},
    ]
    r = klien('admin', 'admin', 'GET', '/ujian/gtk-pilihan')
    assert r.status_code == 200, r.text
    nama = [i['nama'] for i in r.json()['items']]
    assert nama == sorted(nama, key=str.lower)
    ids = {i['user_id'] for i in r.json()['items']}
    assert {'kamad', 'wakakur', 'guru1', 'guru2', 'tu1'} <= ids
    assert not ids & {'siswa1', 'satpam1', 'nonaktif', 'ortu'}
    hadi = klien('admin', 'admin', 'GET', '/ujian/gtk-pilihan', params={'q': 'hadi'}).json()['items']
    assert [i['user_id'] for i in hadi] == ['guru2'] and hadi[0]['nip'] == 'NIP-guru2'
    assert klien('admin', 'admin', 'GET', '/ujian/gtk-pilihan', params={'q': 'nip-guru1'}).json()['items'][0]['user_id'] == 'guru1'
    assert klien('kamad', 'kepala_sekolah', 'GET', '/ujian/gtk-pilihan').status_code == 403


def test_perubahan_panitia_hanya_ujian_terpilih_dan_versi(klien):
    db = klien.db
    db.ujian.docs += [_ujian('uts', 'UTS', 'sem-kini', '2026-09-21', '2026-09-26'),
                      _ujian('uas', 'UAS', 'sem-kini', '2026-12-01', '2026-12-06')]
    r = klien('admin', 'admin', 'PUT', '/ujian/uts/panitia', json={'ketua': 'guru1', 'sekretaris': 'guru2'})
    assert r.status_code == 200
    # Orang yang sama boleh menjabat di ujian lain; susunan UTS tidak tersentuh oleh perubahan UAS.
    r = klien('admin', 'admin', 'PUT', '/ujian/uas/panitia', json={'ketua': 'guru2', 'sekretaris': 'guru1'})
    assert r.status_code == 200
    klien('admin', 'admin', 'PUT', '/ujian/uas/panitia', json={})
    uts = {d['jabatan']: d['user_id'] for d in db.panitia_ujian.docs if d['ujian_id'] == 'uts'}
    assert uts == {'ketua': 'guru1', 'sekretaris': 'guru2'}
    assert not [d for d in db.panitia_ujian.docs if d['ujian_id'] == 'uas']

    # Versi: penyunting yang dibuka sebelum perubahan orang lain ditolak; versi terkini diterima.
    versi = klien('admin', 'admin', 'GET', '/ujian/panitia').json()['items'][0]['diubah']['pada']
    for d in db.panitia_ujian.docs:  # pengguna lain mengubah setelah penyunting dibuka
        d['ditetapkan_pada'] = '2099-01-01T00:00:00+07:00'
    r = klien('admin', 'admin', 'PUT', '/ujian/uts/panitia', json={'ketua': 'guru2', 'versi': versi})
    assert r.status_code == 409 and 'Muat ulang' in r.json()['detail']
    r = klien('admin', 'admin', 'PUT', '/ujian/uts/panitia', json={'ketua': 'guru2', 'versi': '2099-01-01T00:00:00+07:00'})
    assert r.status_code == 200 and r.json()['panitia']['ketua']['user_id'] == 'guru2'
    # Ujian baru tanpa panitia: versi kosong ('') cocok dengan "belum pernah diubah".
    assert klien('admin', 'admin', 'PUT', '/ujian/uas/panitia', json={'bendahara': 'tu1', 'versi': ''}).status_code == 200


def test_detail_ujian_menu_menurut_jabatan_di_ujian_itu(klien):
    db = klien.db
    db.ujian.docs += [_ujian('uts', 'UTS', 'sem-kini', '2026-09-21', '2026-09-26'),
                      _ujian('uas', 'UAS', 'sem-kini', '2026-12-01', '2026-12-06')]
    db.panitia_ujian.docs += [{'id': 'p1', 'ujian_id': 'uts', 'jabatan': 'ketua', 'user_id': 'guru1'},
                              {'id': 'p2', 'ujian_id': 'uas', 'jabatan': 'bendahara', 'user_id': 'guru1'}]
    uts = klien('guru1', 'guru', 'GET', '/ujian/uts/detail').json()
    uas = klien('guru1', 'guru', 'GET', '/ujian/uas/detail').json()
    m_uts = {m['key']: m['akses'] for m in uts['menu']}
    m_uas = {m['key']: m['akses'] for m in uas['menu']}
    assert uts['akses']['jabatan'] == 'ketua' and m_uts['arsip'] and m_uts['ruang']
    assert uas['akses']['jabatan'] == 'bendahara' and m_uas['cetak'] and not m_uas['arsip'] and not m_uas['ruang']
    assert uas['ujian']['jabatan_saya'] == 'bendahara'
    assert klien('guru2', 'guru', 'GET', '/ujian/uas/detail').status_code == 403
    assert klien('admin', 'admin', 'GET', '/ujian/tidak-ada/detail').status_code == 404
    assert klien('kamad', 'kepala_sekolah', 'GET', '/ujian/uas/detail').status_code == 200
    # Rute statis tidak tertangkap rute berparameter.
    assert klien('admin', 'admin', 'GET', '/ujian/panitia').json()['items']
