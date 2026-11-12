"""Alur ujung-ke-ujung Izin Kamad & peran satpam lewat HTTP terhadap aplikasi FastAPI sungguhan.

Memakai server.app (semua router, middleware, token JWT, require_role asli) dengan basis data tiruan
dalam memori (tests/pkg_palsu.Db) sebagai pengganti MongoDB. Waktu server dipatok 12 Nov 2026 08.00 WIB.
"""
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
sys.path.insert(0, os.path.dirname(__file__))

import core  # noqa: E402
from auth_utils import create_access_token, hash_password  # noqa: E402
from pkg_palsu import Db  # noqa: E402
from routers import izin_kamad as api_izin  # noqa: E402

HARI_INI, BESOK = '2026-11-12', '2026-11-13'


@pytest.fixture
def klien(monkeypatch):
    from fastapi.testclient import TestClient

    import server

    db = Db()
    asli = core.db
    for modul in list(sys.modules.values()):  # semua modul yang memakai `from core import db`
        if getattr(modul, 'db', None) is asli:
            monkeypatch.setattr(modul, 'db', db)
    monkeypatch.setattr(api_izin, 'hari_ini_wib', lambda: HARI_INI)
    monkeypatch.setattr(api_izin, 'jam_wib', lambda: '08:00')

    pengguna = {
        'admin': ['admin'], 'kamad': ['kepala_sekolah', 'guru'], 'ktu': ['kepala_tata_usaha'],
        'guru': ['guru'], 'tendik': ['tenaga_kependidikan'],
    }
    for uid, roles in pengguna.items():
        db.users.docs.append({'id': uid, 'username': uid, 'full_name': f'Bapak {uid.title()}', 'roles': roles,
                              'is_active': True, 'password_hash': hash_password('rahasia-uji'), 'token_version': 0})

    c = TestClient(server.app)

    def minta(uid, peran, metode, path, **kw):
        token = create_access_token({'sub': uid, 'active_role': peran, 'tv': 0})
        return c.request(metode, '/api' + path, headers={'Authorization': f'Bearer {token}'}, **kw)
    minta.db = db
    return minta


def _izin(tanggal, mulai, selesai, keperluan='Mengurus berkas dinas'):
    return {'keperluan': keperluan, 'tanggal': tanggal, 'jam_mulai': mulai, 'jam_selesai': selesai}


def test_alur_lengkap_satpam_pengajuan_persetujuan_papan_catatan(klien):
    # 1. Admin membuat akun satpam lewat API pengguna; peran satpam tersedia di opsi peran.
    peran = klien('admin', 'admin', 'GET', '/roles').json()
    assert {'value': 'satpam', 'label': 'Satpam'} in peran
    akun = {'username': 'pak.satpam', 'password': 'Rahasia#123', 'full_name': 'Pak Satpam', 'roles': ['satpam']}
    r = klien('admin', 'admin', 'POST', '/users', json=akun)
    assert r.status_code == 200, r.text
    satpam_id = r.json()['id']

    # 2. Satpam bukan GTK: Simpan Akun & Hasil CKG Saya tertutup.
    assert klien(satpam_id, 'satpam', 'GET', '/simpan-akun/pin/status').status_code == 403
    assert klien(satpam_id, 'satpam', 'GET', '/uks/ckg/saya').status_code == 403

    # 3. Pengajuan: guru (hari ini) & tendik (besok); satpam juga mengajukan.
    r = klien('guru', 'guru', 'POST', '/izin-kamad', json=_izin(HARI_INI, '09:00', '11:00', 'Mengantar anak ke puskesmas'))
    assert r.status_code == 200 and r.json()['status'] == 'menunggu', r.text
    izin_guru = r.json()['id']
    izin_tendik = klien('tendik', 'tenaga_kependidikan', 'POST', '/izin-kamad', json=_izin(BESOK, '08:00', '10:00')).json()['id']
    r = klien(satpam_id, 'satpam', 'POST', '/izin-kamad', json=_izin(BESOK, '13:00', '14:00', 'Perpanjang SIM'))
    izin_satpam = r.json()['id']

    # Validasi waktu server: tanggal lampau & jam terbalik ditolak dengan pesan Indonesia.
    r = klien('guru', 'guru', 'POST', '/izin-kamad', json=_izin('2026-11-11', '09:00', '10:00'))
    assert r.status_code == 400 and 'hari ini atau ke depan' in r.json()['detail']
    r = klien('guru', 'guru', 'POST', '/izin-kamad', json=_izin(BESOK, '10:00', '09:00'))
    assert r.status_code == 400 and 'setelah jam mulai' in r.json()['detail']
    # Peran yang bukan pengaju (siswa) ditolak.
    assert klien('guru', 'siswa', 'POST', '/izin-kamad', json=_izin(BESOK, '08:00', '09:00')).status_code == 403

    # 4. Pengajuan Saya hanya milik sendiri.
    saya = klien(satpam_id, 'satpam', 'GET', '/izin-kamad/saya').json()['items']
    assert [i['id'] for i in saya] == [izin_satpam]

    # 5. Kamad melihat daftar menunggu (terdekat dulu); KTU tidak boleh memutuskan.
    menunggu = klien('kamad', 'kepala_sekolah', 'GET', '/izin-kamad/menunggu').json()['items']
    assert [i['id'] for i in menunggu] == [izin_guru, izin_tendik, izin_satpam]
    assert klien('ktu', 'kepala_tata_usaha', 'GET', '/izin-kamad/menunggu').status_code == 403
    assert klien('ktu', 'kepala_tata_usaha', 'POST', f'/izin-kamad/{izin_guru}/setujui').status_code == 403
    # Kamad yang sedang memakai peran guru juga tidak bisa memutuskan (peran aktif menentukan).
    assert klien('kamad', 'guru', 'POST', f'/izin-kamad/{izin_guru}/setujui').status_code == 403

    # 6. Sebelum disetujui, papan kosong; satpam tidak bisa melihat detail izin orang lain yang menunggu.
    assert klien(satpam_id, 'satpam', 'GET', '/izin-kamad/papan-hari-ini').json()['items'] == []
    assert klien(satpam_id, 'satpam', 'GET', f'/izin-kamad/{izin_guru}').status_code == 403

    # 7. Kamad menyetujui izin guru (hari ini) -> langsung di papan satpam & KTU; tolak tendik berlasan.
    r = klien('kamad', 'kepala_sekolah', 'POST', f'/izin-kamad/{izin_guru}/setujui')
    assert r.status_code == 200 and r.json()['status'] == 'disetujui' and r.json()['diputuskan_oleh_nama'] == 'Bapak Kamad'
    assert klien('kamad', 'kepala_sekolah', 'POST', f'/izin-kamad/{izin_tendik}/tolak', json={'alasan': 'ok'}).status_code == 422
    r = klien('kamad', 'kepala_sekolah', 'POST', f'/izin-kamad/{izin_tendik}/tolak', json={'alasan': 'Bertepatan rapat dinas'})
    assert r.status_code == 200 and r.json()['status'] == 'ditolak'
    # Keputusan ganda ditolak.
    r = klien('kamad', 'kepala_sekolah', 'POST', f'/izin-kamad/{izin_guru}/tolak', json={'alasan': 'Berubah pikiran'})
    assert r.status_code == 409

    for uid, p in ((satpam_id, 'satpam'), ('ktu', 'kepala_tata_usaha'), ('kamad', 'kepala_sekolah')):
        papan = klien(uid, p, 'GET', '/izin-kamad/papan-hari-ini').json()
        assert [i['id'] for i in papan['items']] == [izin_guru] and papan['tanggal'] == HARI_INI, p
    assert klien('guru', 'guru', 'GET', '/izin-kamad/papan-hari-ini').status_code == 403

    ringkasan = klien(satpam_id, 'satpam', 'GET', '/izin-kamad/ringkasan-satpam').json()
    assert ringkasan == {'tanggal': HARI_INI, 'jam': '08:00', 'izin_hari_ini': 1, 'berlangsung': 0, 'akan_datang': 1,
                         'selesai': 0, 'saya_menunggu': 1}

    # 8. Pengaju melihat alasan penolakan; pembatalan hanya selama menunggu & milik sendiri.
    tendik = klien('tendik', 'tenaga_kependidikan', 'GET', '/izin-kamad/saya').json()['items'][0]
    assert tendik['status'] == 'ditolak' and tendik['alasan_penolakan'] == 'Bertepatan rapat dinas'
    assert klien('tendik', 'tenaga_kependidikan', 'POST', f'/izin-kamad/{izin_tendik}/batalkan').status_code == 400
    assert klien('guru', 'guru', 'POST', f'/izin-kamad/{izin_satpam}/batalkan').status_code == 403
    r = klien(satpam_id, 'satpam', 'POST', f'/izin-kamad/{izin_satpam}/batalkan')
    assert r.status_code == 200 and r.json()['status'] == 'dibatalkan'

    # 9. Catatan satpam: ditulis satpam, dibaca hanya kamad & KTU; tidak bocor ke papan/detail.
    catatan = {'isi': 'Keluar pukul 09.05 dijemput keluarga'}
    r = klien(satpam_id, 'satpam', 'POST', f'/izin-kamad/{izin_guru}/catatan', json=catatan)
    assert r.status_code == 200, r.text
    assert klien(satpam_id, 'satpam', 'GET', f'/izin-kamad/{izin_guru}/catatan').status_code == 403
    assert klien('guru', 'guru', 'GET', f'/izin-kamad/{izin_guru}/catatan').status_code == 403
    for uid, p in (('ktu', 'kepala_tata_usaha'), ('kamad', 'kepala_sekolah')):
        isi = [c['isi'] for c in klien(uid, p, 'GET', f'/izin-kamad/{izin_guru}/catatan').json()['items']]
        assert isi == ['Keluar pukul 09.05 dijemput keluarga'], p
    assert 'dijemput' not in klien(satpam_id, 'satpam', 'GET', '/izin-kamad/papan-hari-ini').text
    assert 'dijemput' not in klien(satpam_id, 'satpam', 'GET', f'/izin-kamad/{izin_guru}').text

    # 10. Riwayat keputusan kamad memuat izin yang disetujui & ditolak (bukan yang dibatalkan).
    riwayat = klien('kamad', 'kepala_sekolah', 'GET', '/izin-kamad/riwayat-keputusan').json()['items']
    assert {i['id'] for i in riwayat} == {izin_guru, izin_tendik}

    # 11. Jejak audit tercatat untuk aksi penting.
    aksi = {d.get('action') for d in klien.db.audit_logs.docs}
    assert {'izin_kamad_ajukan', 'izin_kamad_setujui', 'izin_kamad_tolak', 'izin_kamad_batalkan',
            'izin_kamad_catatan_tulis'} <= aksi


def test_tanpa_token_dan_token_palsu_ditolak(klien):
    from fastapi.testclient import TestClient

    import server
    c = TestClient(server.app)
    assert c.get('/api/izin-kamad/papan-hari-ini').status_code in (401, 403)
    r = c.get('/api/izin-kamad/papan-hari-ini', headers={'Authorization': 'Bearer token-palsu'})
    assert r.status_code == 401
