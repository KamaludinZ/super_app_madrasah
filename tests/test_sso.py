"""Login lewat tiket (SSO): hak akses per aplikasi, tiket sekali pakai & berumur pendek, penukaran oleh server
aplikasi tujuan dengan kunci rahasia, dan data pengguna untuk pencocokan akun."""

import asyncio
import os
import sys
from datetime import timedelta

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import core  # noqa: E402
import sso  # noqa: E402
from routers import sso as api  # noqa: E402
from tests.pkg_palsu import Db, Koleksi  # noqa: E402


class Req:
    def __init__(self, headers=None):
        self.headers = headers or {}
        self.client = type('C', (), {'host': '10.0.0.9'})()
        self.url = type('U', (), {'path': '/api/sso'})()


ADMIN = {'id': 'adm', 'username': 'admin', 'roles': ['admin'], 'active_role': 'admin'}
GURU = {'id': 'g1', 'username': 'budi', 'full_name': 'Budi, S.Pd.', 'roles': ['guru', 'wali_kelas'], 'active_role': 'guru',
        'email': 'budi@madrasah.sch.id', 'nip': '198207152009012003', 'peg_id': 'PEG-1', 'is_active': True}
SISWA = {'id': 's1', 'username': 'ani', 'full_name': 'Ani', 'roles': ['siswa'], 'active_role': 'siswa', 'nisn': '0012345678',
         'nis': '2401', 'student_class_id': 'k7a', 'is_active': True}
TENDIK = {'id': 't1', 'username': 'cici', 'full_name': 'Cici', 'roles': ['tenaga_kependidikan'], 'active_role': 'tenaga_kependidikan',
          'nip_nuptk': '1234567890123456', 'peg_id': 'PEG-9', 'is_active': True}


def jalan(coro):
    return asyncio.run(coro)


@pytest.fixture
def db(monkeypatch):
    d = Db({'users': Koleksi([GURU, SISWA, TENDIK, ADMIN]), 'classes': Koleksi([{'id': 'k7a', 'name': '7A'}])})
    for m in (api, core):
        monkeypatch.setattr(m, 'db', d)
    return d


def _app(**ubah):
    data = dict(id='koperasi', nama='Koperasi Sekolah', url_masuk='https://koperasi.madrasah.sch.id/sso/masuk',
                peran=['guru', 'tenaga_kependidikan'])
    data.update(ubah)
    return api.AplikasiBaru(**data)


def _daftar(db, **ubah):
    return jalan(api.admin_tambah(_app(**ubah), Req(), ADMIN))


def _tiket(url):
    return url.split('tiket=', 1)[1]


def _bearer(kunci):
    return f'Bearer {kunci}'


def test_admin_daftar_aplikasi_kunci_sekali_tampil(db):
    hasil = _daftar(db)
    kunci = hasil['kunci_rahasia']
    assert kunci.startswith('sso_') and len(kunci) > 40
    doc = db['sso_aplikasi'].docs[0]
    assert doc['kunci_hash'] == sso.hash_rahasia(kunci) and kunci not in str(doc)  # hanya hash yang disimpan
    daftar = jalan(api.admin_daftar(ADMIN))
    assert 'kunci_hash' not in daftar['aplikasi'][0] and daftar['aplikasi'][0]['kunci_awal'] == kunci[:12]
    assert 'kelas' not in daftar['peran'] and 'siswa' in daftar['peran']
    with pytest.raises(HTTPException) as e:
        _daftar(db)
    assert e.value.status_code == 409


def test_validasi_aplikasi():
    with pytest.raises(ValidationError):
        _app(url_masuk='http://koperasi.madrasah.sch.id/sso')  # wajib https
    with pytest.raises(ValidationError):
        _app(peran=['kelas'])
    with pytest.raises(ValidationError):
        _app(id='Koperasi Sekolah')
    assert _app(url_masuk='http://localhost:8000/sso/masuk').url_masuk.startswith('http://localhost')


def test_hanya_admin_yang_mengatur():
    with pytest.raises(HTTPException) as e:
        api._admin(GURU)
    assert e.value.status_code == 403


def test_akses_per_peran_izin_dan_blokir(db):
    _daftar(db)
    assert [a['id'] for a in jalan(api.aplikasi_saya(GURU))] == ['koperasi']
    assert jalan(api.aplikasi_saya(SISWA)) == []  # siswa belum diberi akses
    app = db['sso_aplikasi'].docs[0]
    app['izin_pengguna'] = ['s1']  # siswa tertentu diizinkan khusus
    app['blokir_pengguna'] = ['g1']  # guru tertentu diblokir
    assert [a['id'] for a in jalan(api.aplikasi_saya(SISWA))] == ['koperasi']
    assert jalan(api.aplikasi_saya(GURU)) == []
    app['aktif'] = False
    assert jalan(api.aplikasi_saya(SISWA)) == []
    assert not sso.boleh_akses({'aktif': True, 'peran': ['kelas']}, {'id': 'k', 'roles': ['kelas']})


def test_tiket_ditukar_sekali_lalu_hangus(db):
    kunci = _daftar(db)['kunci_rahasia']
    hasil = jalan(api.masuk_aplikasi('koperasi', Req(), GURU))
    assert hasil['url'].startswith('https://koperasi.madrasah.sch.id/sso/masuk?tiket=') and hasil['berlaku_detik'] == 60
    tiket = _tiket(hasil['url'])
    assert db['sso_tiket'].docs[0]['hash'] == sso.hash_rahasia(tiket) and tiket not in str(db['sso_tiket'].docs[0])

    data = jalan(api.tukar(api.TukarRequest(tiket=tiket), Req(), _bearer(kunci)))
    p = data['pengguna']
    assert data['aplikasi'] == 'koperasi'
    assert (p['username'], p['nip'], p['peg_id'], p['email'], p['jenis'], p['peran_aktif']) == (
        'budi', '198207152009012003', 'PEG-1', 'budi@madrasah.sch.id', 'guru', 'guru')
    assert p['peran'] == ['guru', 'wali_kelas'] and 'password' not in str(p) and 'token_version' not in p

    with pytest.raises(HTTPException) as e:  # sekali pakai
        jalan(api.tukar(api.TukarRequest(tiket=tiket), Req(), _bearer(kunci)))
    assert e.value.detail['kode'] == 'tiket_sudah_dipakai'
    assert any(x['action'] == 'sso_tukar' for x in db['audit_logs'].docs)


def test_tiket_kedaluwarsa_salah_aplikasi_dan_kunci_salah(db):
    kunci = _daftar(db)['kunci_rahasia']
    kunci2 = _daftar(db, id='absensi', nama='Absensi', url_masuk='https://absensi.madrasah.sch.id/sso/masuk?x=1')['kunci_rahasia']
    url = jalan(api.masuk_aplikasi('koperasi', Req(), GURU))['url']
    tiket = _tiket(url)

    with pytest.raises(HTTPException) as e:  # kunci aplikasi lain
        jalan(api.tukar(api.TukarRequest(tiket=tiket), Req(), _bearer(kunci2)))
    assert e.value.detail['kode'] == 'tiket_tidak_valid'
    for header in (None, 'Bearer sso_salah-kunci', 'Basic abc', _bearer('bukan-sso')):
        with pytest.raises(HTTPException) as e:
            jalan(api.tukar(api.TukarRequest(tiket=tiket), Req(), header))
        assert e.value.status_code == 401
    assert any(x['event_type'] == 'sso_tukar_gagal' for x in db['security_logs'].docs)

    db['sso_tiket'].docs[0]['kedaluwarsa'] = sso.sekarang() - timedelta(seconds=1)
    with pytest.raises(HTTPException) as e:
        jalan(api.tukar(api.TukarRequest(tiket=tiket), Req(), _bearer(kunci)))
    assert e.value.detail['kode'] == 'tiket_kedaluwarsa'

    # URL penerima yang sudah berisi query: tiket disambung dengan '&'.
    db['sso_aplikasi'].docs[1]['peran'] = ['guru']
    assert '?x=1&tiket=' in jalan(api.masuk_aplikasi('absensi', Req(), GURU))['url']


def test_akses_diperiksa_ulang_saat_tukar(db):
    kunci = _daftar(db)['kunci_rahasia']
    tiket = _tiket(jalan(api.masuk_aplikasi('koperasi', Req(), GURU))['url'])
    db['sso_aplikasi'].docs[0]['peran'] = ['tenaga_kependidikan']  # akses guru dicabut setelah tiket terbit
    with pytest.raises(HTTPException) as e:
        jalan(api.tukar(api.TukarRequest(tiket=tiket), Req(), _bearer(kunci)))
    assert e.value.status_code == 403 and e.value.detail['kode'] == 'tidak_berhak'

    tiket = _tiket(jalan(api.masuk_aplikasi('koperasi', Req(), TENDIK))['url'])
    db['users'].docs[2]['is_active'] = False  # akun dinonaktifkan
    with pytest.raises(HTTPException) as e:
        jalan(api.tukar(api.TukarRequest(tiket=tiket), Req(), _bearer(kunci)))
    assert e.value.detail['kode'] == 'pengguna_nonaktif'


def test_tidak_berhak_menyamar_dan_nonaktif(db):
    _daftar(db)
    with pytest.raises(HTTPException) as e:
        jalan(api.masuk_aplikasi('koperasi', Req(), SISWA))
    assert e.value.status_code == 403 and e.value.detail['kode'] == 'tidak_berhak'
    with pytest.raises(HTTPException) as e:
        jalan(api.masuk_aplikasi('koperasi', Req(), {**GURU, 'is_impersonating': True}))
    assert e.value.detail['kode'] == 'sedang_menyamar'
    with pytest.raises(HTTPException) as e:
        jalan(api.masuk_aplikasi('tidak-ada', Req(), GURU))
    assert e.value.status_code == 404
    assert db['sso_tiket'].docs == []


def test_profil_siswa_dan_pegawai(db):
    kunci = _daftar(db, peran=['siswa', 'tenaga_kependidikan'])['kunci_rahasia']
    p = jalan(api.tukar(api.TukarRequest(tiket=_tiket(jalan(api.masuk_aplikasi('koperasi', Req(), SISWA))['url'])),
                        Req(), _bearer(kunci)))['pengguna']
    assert (p['jenis'], p['nisn'], p['nis'], p['kelas'], p['nip']) == ('siswa', '0012345678', '2401', '7A', None)
    p = jalan(api.tukar(api.TukarRequest(tiket=_tiket(jalan(api.masuk_aplikasi('koperasi', Req(), TENDIK))['url'])),
                        Req(), _bearer(kunci)))['pengguna']
    assert (p['jenis'], p['nuptk'], p['nip'], p['peg_id']) == ('pegawai', '1234567890123456', None, 'PEG-9')


def test_cek_kunci_ubah_kunci_baru_dan_hapus(db):
    kunci = _daftar(db)['kunci_rahasia']
    assert jalan(api.cek_kunci(Req(), _bearer(kunci)))['aplikasi'] == 'koperasi'
    baru = jalan(api.admin_kunci_baru('koperasi', Req(), ADMIN))['kunci_rahasia']
    assert baru != kunci
    with pytest.raises(HTTPException):
        jalan(api.cek_kunci(Req(), _bearer(kunci)))  # kunci lama langsung tidak berlaku
    assert jalan(api.cek_kunci(Req(), _bearer(baru)))['nama'] == 'Koperasi Sekolah'

    ubah = api.AplikasiBase(nama='Koperasi', url_masuk='https://kop.madrasah.sch.id/sso/masuk', peran=['siswa'],
                            izin_pengguna=['g1', 'g1'], aktif=False)
    hasil = jalan(api.admin_ubah('koperasi', ubah, Req(), ADMIN))
    assert hasil['peran'] == ['siswa'] and hasil['izin_pengguna'] == ['g1'] and not hasil['aktif']
    with pytest.raises(HTTPException) as e:  # aplikasi nonaktif menolak penukaran
        jalan(api.cek_kunci(Req(), _bearer(baru)))
    assert e.value.status_code == 403

    jalan(api.admin_hapus('koperasi', Req(), ADMIN))
    assert db['sso_aplikasi'].docs == []
    with pytest.raises(HTTPException):
        jalan(api.admin_hapus('koperasi', Req(), ADMIN))


def test_cari_pengguna(db):
    assert {u['id'] for u in jalan(api.admin_cari_pengguna('bud', '', ADMIN))} == {'g1'}
    assert [u['nomor'] for u in jalan(api.admin_cari_pengguna('', 's1,t1', ADMIN))] == ['0012345678', 'PEG-9']
    assert jalan(api.admin_cari_pengguna('a', '', ADMIN)) == []
