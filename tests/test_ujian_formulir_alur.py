"""Alur HTTP Pengaturan Formulir modul Ujian: aktivasi & jendela waktu, template, pola TTD, jadwal, tautan publik."""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(__file__))

from ujian_dasar import HARI_INI, buat_klien, ujian_doc  # noqa: E402


@pytest.fixture
def klien(monkeypatch):
    k = buat_klien(monkeypatch)
    k.db.ujian.docs += [ujian_doc('uas', 'UAS', 'sem-kini', '2026-12-01', '2026-12-06'),
                        ujian_doc('lama', 'UAS', 'sem-lalu', '2026-06-01', '2026-06-06')]
    k.db.panitia_ujian.docs += [{'id': 'p1', 'ujian_id': 'uas', 'jabatan': 'ketua', 'user_id': 'guru1'},
                                {'id': 'p2', 'ujian_id': 'uas', 'jabatan': 'bendahara', 'user_id': 'tu1'}]
    return k


def test_aktivasi_jendela_waktu_semua_ruang(klien):
    d = klien('admin', 'admin', 'GET', '/ujian/uas/formulir').json()
    f = d['formulir']
    assert d['boleh_ubah'] and f['aktif'] is False and f['status'] == 'tertutup' and f['token']
    assert f['tautan']['daftar_hadir'] == f"/publik/ujian/{f['token']}/daftar-hadir" and d['jadwal'] == []
    assert f['template']['singkatan_ujian'] == 'ASAS' and f['diubah']['aktivasi'] is None
    # Dibuat sekali (token tetap pada pemanggilan berikutnya).
    assert klien('admin', 'admin', 'GET', '/ujian/uas/formulir').json()['formulir']['token'] == f['token']

    r = klien('admin', 'admin', 'PUT', '/ujian/uas/formulir/aktivasi', json={'aktif': True, 'jam_buka': '07:00'})
    assert r.status_code == 422
    r = klien('admin', 'admin', 'PUT', '/ujian/uas/formulir/aktivasi', json={'aktif': True, 'jam_buka': '07:00', 'jam_tutup': '12:00'})
    assert r.status_code == 200, r.text
    f = r.json()
    assert f['aktif'] and f['status'] == 'dibuka' and f['diubah']['aktivasi']['oleh_nama'] == 'Administrator'
    # Status beranda ikut berubah (satu pengaturan untuk semua ruang).
    beranda = klien('admin', 'admin', 'GET', '/ujian/beranda').json()['items'][0]['formulir']
    assert beranda['status'] == 'dibuka' and beranda['pesan'] == 'Formulir dibuka.'
    status = klien('admin', 'admin', 'GET', '/ujian/status-formulir').json()['items'][0]['formulir']
    panitia = klien('admin', 'admin', 'GET', '/ujian/panitia').json()['items'][0]['ujian']['formulir']
    assert status == beranda == panitia
    audit = next(a for a in klien.db.audit_logs.docs if a['action'] == 'ujian_formulir_aktivasi')
    assert audit['details']['dari']['aktif'] is False and audit['details']['ke']['jam_tutup'] == '12:00'

    # Ketua melihat (tanpa ubah); bendahara & guru biasa ditolak; ujian arsip tidak bisa diubah.
    d = klien('guru1', 'guru', 'GET', '/ujian/uas/formulir').json()
    assert d['boleh_ubah'] is False and d['formulir']['aktif']
    assert klien('guru1', 'guru', 'PUT', '/ujian/uas/formulir/aktivasi', json={'aktif': False}).status_code == 403
    assert klien('tu1', 'tenaga_kependidikan', 'GET', '/ujian/uas/formulir').status_code == 403
    assert klien('admin', 'admin', 'PUT', '/ujian/lama/formulir/aktivasi', json={'aktif': False}).status_code == 409
    assert klien('admin', 'admin', 'PUT', '/ujian/uas/formulir/aktivasi', json={'aktif': False}).json()['status'] == 'tertutup'


def test_status_formulir_rinci(klien):
    klien.db.jadwal_ujian.docs += [
        {'id': 'j1', 'ujian_id': 'uas', 'tanggal': HARI_INI, 'sesi_ke': 1, 'jam_mulai': '07:30', 'jam_selesai': '09:30', 'mapel': {'7': 'Matematika'}},
        {'id': 'j2', 'ujian_id': 'uas', 'tanggal': HARI_INI, 'sesi_ke': 2, 'jam_mulai': '10:00', 'jam_selesai': '12:00', 'mapel': {}},
    ]
    d = klien('guru1', 'guru', 'GET', '/ujian/uas/formulir/status').json()
    assert d['terbuka'] is False and d['alasan'] == 'nonaktif' and d['sesi_aktif']['id'] == 'j1' and len(d['sesi_hari_ini']) == 2
    klien('admin', 'admin', 'PUT', '/ujian/uas/formulir/aktivasi', json={'aktif': True, 'jam_buka': '07:00', 'jam_tutup': '12:00'})
    d = klien('tu1', 'tenaga_kependidikan', 'GET', '/ujian/uas/formulir/status').json()  # bendahara boleh memantau
    assert d['terbuka'] and d['tanggal'] == HARI_INI and d['jam'] == '08:00'
    assert klien('guru2', 'guru', 'GET', '/ujian/uas/formulir/status').status_code == 403


TPL = {'nama_madrasah': 'MTsN 2 Kota Malang', 'kop_madrasah': 'MTs NEGERI 2 KOTA MALANG', 'alamat': 'Jalan Raya Cemorokandang No. 77, Kota Malang',
       'kota_ttd': 'Malang', 'singkatan_ujian': 'ASAS', 'nama_kegiatan': 'Asesmen Sumatif Akhir Semester',
       'catatan_kaki': 'Diisi dengan Mata Pelajaran pada waktu itu'}


def test_template_cetak_per_ujian(klien):
    klien.db.settings.docs.append({'id': 'global_config', 'school_name': 'MTsN Uji', 'city': 'Kota Batu'})
    bawaan = klien('guru1', 'guru', 'GET', '/ujian/uas/formulir/template-bawaan').json()
    assert bawaan['nama_madrasah'] == 'MTsN Uji' and bawaan['kota_ttd'] == 'Batu' and bawaan['singkatan_ujian'] == 'ASAS'
    r = klien('admin', 'admin', 'PUT', '/ujian/uas/formulir/template', json={**TPL, 'singkatan_ujian': ' ASAT ', 'kota_ttd': 'Kota  Malang'})
    assert r.status_code == 200, r.text
    f = r.json()
    assert f['template']['singkatan_ujian'] == 'ASAT' and f['template']['kota_ttd'] == 'Kota Malang'
    assert f['diubah']['template']['oleh_nama'] == 'Administrator' and f['diubah']['aktivasi'] is None
    audit = next(a for a in klien.db.audit_logs.docs if a['action'] == 'ujian_formulir_template')
    assert audit['details']['perubahan']['singkatan_ujian']['ke'] == 'ASAT'
    assert klien('admin', 'admin', 'PUT', '/ujian/uas/formulir/template', json={**TPL, 'alamat': ' '}).status_code == 422
    assert klien('admin', 'admin', 'PUT', '/ujian/uas/formulir/template', json={**TPL, 'kota_ttd': 'x' * 41}).status_code == 422
    assert klien('guru1', 'guru', 'PUT', '/ujian/uas/formulir/template', json=TPL).status_code == 403
    assert klien('admin', 'admin', 'GET', '/ujian/uas/formulir').json()['formulir']['template']['singkatan_ujian'] == 'ASAT'


def test_pola_tanda_tangan_per_ujian(klien):
    r = klien('admin', 'admin', 'PUT', '/ujian/uas/formulir/pola-ttd', json={'tampil_di_cetak': False, 'tinggi_mm': 15})
    assert r.status_code == 200, r.text
    f = r.json()
    assert f['pola_ttd'] == {'tampil_di_cetak': False, 'tinggi_mm': 15} and f['diubah']['pola_ttd']['oleh_nama'] == 'Administrator'
    for salah in ({'tinggi_mm': 7}, {'tinggi_mm': 21}, {'tinggi_mm': 'besar'}):
        assert klien('admin', 'admin', 'PUT', '/ujian/uas/formulir/pola-ttd', json=salah).status_code == 422
    assert klien('guru1', 'guru', 'PUT', '/ujian/uas/formulir/pola-ttd', json={'tinggi_mm': 10}).status_code == 403
    assert klien('guru1', 'guru', 'GET', '/ujian/uas/formulir').json()['formulir']['pola_ttd']['tinggi_mm'] == 15
    audit = next(a for a in klien.db.audit_logs.docs if a['action'] == 'ujian_formulir_pola_ttd')
    assert audit['details']['ke'] == {'tampil_di_cetak': False, 'tinggi_mm': 15}


def _sesi(tanggal, ke, mulai, selesai, mapel=None):
    return {'tanggal': tanggal, 'sesi_ke': ke, 'jam_mulai': mulai, 'jam_selesai': selesai, 'mapel': mapel or {}}


def test_jadwal_sesi(klien):
    db = klien.db
    isi = {'sesi': [_sesi('2026-12-01', 1, '07:30', '09:30', {'7': 'Matematika', '8': 'IPA'}),
                    _sesi('2026-12-01', 2, '10:00', '12:00', {'7': 'IPS'}), _sesi('2026-12-02', 1, '07:30', '09:30')]}
    r = klien('admin', 'admin', 'PUT', '/ujian/uas/formulir/jadwal', json=isi)
    assert r.status_code == 200, r.text
    d = r.json()
    assert [(s['tanggal'], s['sesi_ke']) for s in d['jadwal']] == [('2026-12-01', 1), ('2026-12-01', 2), ('2026-12-02', 1)]
    assert d['jadwal'][0]['mapel'] == {'7': 'Matematika', '8': 'IPA'} and d['formulir']['diubah']['jadwal']['oleh_nama'] == 'Administrator'
    id_sesi1 = d['jadwal'][0]['id']
    # Luar masa ujian / bertumpuk ditolak dengan pesan rinci.
    r = klien('admin', 'admin', 'PUT', '/ujian/uas/formulir/jadwal', json={'sesi': [_sesi('2026-12-09', 1, '07:00', '08:00'),
                                                                                    _sesi('2026-12-01', 1, '07:00', '09:00'), _sesi('2026-12-01', 2, '08:30', '10:00')]})
    assert r.status_code == 400 and 'di luar masa ujian' in r.json()['detail'] and 'bertumpuk' in r.json()['detail']
    # Sesi yang sudah dipakai daftar hadir tidak boleh hilang; id sesi lama dipertahankan saat diubah.
    db.daftar_hadir.docs.append({'id': 'dh1', 'ujian_id': 'uas', 'sesi_id': id_sesi1})
    r = klien('admin', 'admin', 'PUT', '/ujian/uas/formulir/jadwal', json={'sesi': isi['sesi'][1:]})
    assert r.status_code == 409 and '2026-12-01 sesi 1' in r.json()['detail']
    isi['sesi'][0]['mapel'] = {'7': 'Matematika Wajib'}
    d = klien('admin', 'admin', 'PUT', '/ujian/uas/formulir/jadwal', json=isi).json()
    assert d['jadwal'][0]['id'] == id_sesi1 and d['jadwal'][0]['mapel'] == {'7': 'Matematika Wajib'}
    assert klien('guru1', 'guru', 'GET', '/ujian/uas/formulir').json()['jadwal'][0]['mapel']['7'] == 'Matematika Wajib'


def test_otorisasi_dan_audit_semua_pengaturan(klien):
    """Guard: semua pengubah pengaturan formulir hanya admin; tiap perubahan tercatat (stempel bagian + audit_logs)."""
    from routers import ujian_formulir
    from routers.ujian import wajib_pengelola
    for rute in ujian_formulir.router.routes:
        if rute.methods & {'POST', 'PUT', 'PATCH', 'DELETE'}:
            assert any(d.call is wajib_pengelola for d in rute.dependant.dependencies), rute.path
    ubah = (('/ujian/uas/formulir/aktivasi', {'aktif': True, 'jam_buka': '07:00', 'jam_tutup': '12:00'}, 'aktivasi', 'ujian_formulir_aktivasi'),
            ('/ujian/uas/formulir/template', TPL, 'template', 'ujian_formulir_template'),
            ('/ujian/uas/formulir/pola-ttd', {'tampil_di_cetak': True, 'tinggi_mm': 10}, 'pola_ttd', 'ujian_formulir_pola_ttd'),
            ('/ujian/uas/formulir/jadwal', {'sesi': [_sesi('2026-12-01', 1, '07:30', '09:30')]}, 'jadwal', 'ujian_formulir_jadwal'))
    for path, isi, _bagian, _aksi in ubah:
        for uid, peran in (('guru1', 'guru'), ('kamad', 'kepala_sekolah'), ('wakakur', 'waka_kurikulum'), ('siswa1', 'siswa')):
            assert klien(uid, peran, 'PUT', path, json=isi).status_code == 403, (path, peran)
        assert klien('admin', 'admin', 'PUT', path.replace('/uas/', '/lama/'), json=isi).status_code == 409
        assert klien('admin', 'admin', 'PUT', path, json=isi).status_code == 200
    f = klien('admin', 'admin', 'GET', '/ujian/uas/formulir').json()['formulir']
    assert all(f['diubah'][b]['oleh_nama'] == 'Administrator' for _p, _i, b, _a in ubah)
    aksi = [a['action'] for a in klien.db.audit_logs.docs]
    assert all(x in aksi for _p, _i, _b, x in ubah)
    assert all(a['user_id'] == 'admin' for a in klien.db.audit_logs.docs if a['action'].startswith('ujian_formulir'))
