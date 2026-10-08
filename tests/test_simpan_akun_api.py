"""API Simpan Akun: hanya GTK, isi brankas wajib token PIN milik sendiri, daftar tanpa password."""

import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from jose import jwt

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import simpan_akun as sa  # noqa: E402
from routers import simpan_akun as api  # noqa: E402


class _Cursor:
    def __init__(self, docs):
        self.docs = docs

    async def to_list(self, _n):
        return [dict(d) for d in self.docs]


class _Koleksi:
    def __init__(self, docs=()):
        self.docs = [dict(d) for d in docs]

    @staticmethod
    def _cocok(d, q):
        for k, v in q.items():
            if isinstance(v, dict):
                if '$in' in v and d.get(k) not in v['$in']:
                    return False
                if '$nin' in v and d.get(k) in v['$nin']:
                    return False
            elif d.get(k) != v:
                return False
        return True

    def find(self, q=None, _proj=None):
        return _Cursor([d for d in self.docs if self._cocok(d, q or {})])

    async def find_one(self, q, _proj=None):
        return next((dict(d) for d in self.docs if self._cocok(d, q)), None)

    async def insert_one(self, doc):
        self.docs.append(dict(doc))

    async def update_one(self, q, u, upsert=False):
        for d in self.docs:
            if self._cocok(d, q):
                d.update(u.get('$set', {}))
                for k, v in u.get('$inc', {}).items():
                    d[k] = d.get(k, 0) + v
                for k in u.get('$unset', {}):
                    d.pop(k, None)
                return
        if upsert:
            self.docs.append({**q, **u.get('$set', {}), **u.get('$setOnInsert', {})})

    async def delete_one(self, q):
        sebelum = len(self.docs)
        self.docs = [d for d in self.docs if not self._cocok(d, q)]
        return type('H', (), {'deleted_count': sebelum - len(self.docs)})()


class _Db(dict):
    def __getattr__(self, nama):
        return self.setdefault(nama, _Koleksi())

    def __getitem__(self, nama):
        return self.setdefault(nama, _Koleksi())


def _user(uid='g1', peran='guru', roles=None):
    return {'id': uid, 'active_role': peran, 'roles': roles or [peran], 'full_name': f'Pengguna {uid}'}


@pytest.fixture
def db(monkeypatch):
    d = _Db()
    d['simpan_akun'] = _Koleksi([
        {'id': 'a1', 'user_id': 'g1', 'nama_akun': 'Email Madrasah', 'nama_aplikasi': 'Google', 'link_web': 'mail.google.com',
         'username': 'g1@x', 'password_enc': sa.enkripsi('rahasia-1')},
        {'id': 'a2', 'user_id': 'g1', 'nama_akun': 'EMIS GTK', 'nama_aplikasi': 'EMIS', 'link_web': '', 'username': 'nip',
         'password_enc': sa.enkripsi('rahasia-2')},
        {'id': 'a3', 'user_id': 'g2', 'nama_akun': 'Milik orang lain', 'nama_aplikasi': 'EMIS', 'username': 'x',
         'password_enc': sa.enkripsi('rahasia-3')},
    ])
    monkeypatch.setattr(api, 'db', d)
    return d


def test_hanya_gtk():
    assert api.adalah_gtk(_user()) and api.adalah_gtk(_user(peran='kepala_tata_usaha'))
    for peran in ('siswa', 'kelas', 'orang_tua', 'alumni'):
        assert not api.adalah_gtk(_user(peran=peran))
    assert not api.adalah_gtk(_user(peran='siswa', roles=['siswa', 'guru']))  # peran aktif siswa
    with pytest.raises(HTTPException) as e:
        asyncio.run(api.wajib_gtk(_user(peran='siswa')))
    assert e.value.status_code == 403


def test_token_brankas_wajib_sah_dan_milik_sendiri():
    guru = _user('g1')
    token = api.buat_token_brankas('g1')['token']
    assert asyncio.run(api.wajib_brankas(guru, token))['id'] == 'g1'
    kedaluwarsa = jwt.encode({'sub': 'g1', 'scope': 'simpan_akun', 'exp': datetime.now(timezone.utc) - timedelta(minutes=1)},
                             api.JWT_SECRET, algorithm=api.JWT_ALGORITHM)
    token_login = jwt.encode({'sub': 'g1', 'active_role': 'guru', 'exp': datetime.now(timezone.utc) + timedelta(minutes=5)},
                             api.JWT_SECRET, algorithm=api.JWT_ALGORITHM)
    for salah in (None, 'sampah', kedaluwarsa, token_login, api.buat_token_brankas('g2')['token']):
        with pytest.raises(HTTPException) as e:
            asyncio.run(api.wajib_brankas(guru, salah))
        assert e.value.status_code == 401


def test_daftar_akun_milik_sendiri_tanpa_password(db):
    hasil = asyncio.run(api.daftar_akun(user=_user('g1')))
    assert [a['id'] for a in hasil] == ['a2', 'a1']  # urut nama aplikasi: EMIS, Google
    assert all('password' not in a and 'password_enc' not in a for a in hasil)
    assert [a['id'] for a in asyncio.run(api.daftar_akun(q='email', user=_user('g1')))] == ['a1']
    assert [a['id'] for a in asyncio.run(api.daftar_akun(aplikasi='EMIS', user=_user('g1')))] == ['a2']
    assert [a['id'] for a in asyncio.run(api.daftar_akun(user=_user('g2')))] == ['a3']



@pytest.fixture
def db_pin(db, monkeypatch):
    async def _audit(*_a, **_k):
        return None
    monkeypatch.setattr(api, 'log_audit', _audit)
    db['users'] = _Koleksi([{'id': 'g1', 'full_name': 'Guru Satu', 'roles': ['guru', 'wali_kelas']}])
    return db


def _jalan(coro):
    return asyncio.run(coro)


def test_alur_pin_buat_verifikasi_kunci_lupa_reset(db_pin):
    guru = _user('g1')
    assert _jalan(api.status_pin(guru))['sudah_dibuat'] is False
    with pytest.raises(HTTPException) as e:
        _jalan(api.buat_pin(api.PinRequest(pin='123456'), None, guru))
    assert e.value.status_code == 400  # PIN lemah
    token = _jalan(api.buat_pin(api.PinRequest(pin='582913'), None, guru))['token']
    assert _jalan(api.wajib_brankas(guru, token))['id'] == 'g1'
    doc = db_pin['simpan_akun_pin'].docs[0]
    assert doc['pin_hash'] != '582913' and sa.cocok_pin('582913', doc['pin_hash'])
    with pytest.raises(HTTPException) as e:
        _jalan(api.buat_pin(api.PinRequest(pin='908172'), None, guru))
    assert e.value.status_code == 409

    assert _jalan(api.verifikasi_pin(api.PinRequest(pin='582913'), None, guru))['token']
    for i in range(api.BATAS_GAGAL_PIN):
        with pytest.raises(HTTPException) as e:
            _jalan(api.verifikasi_pin(api.PinRequest(pin='000001'), None, guru))
        assert e.value.status_code == 401 and e.value.detail['sisa_percobaan'] == api.BATAS_GAGAL_PIN - i - 1
    with pytest.raises(HTTPException) as e:  # terkunci: PIN benar pun ditolak
        _jalan(api.verifikasi_pin(api.PinRequest(pin='582913'), None, guru))
    assert e.value.status_code == 423
    assert _jalan(api.status_pin(guru))['terkunci'] is True

    diminta = _jalan(api.lupa_pin(api.LupaPinRequest(keterangan='ganti HP'), None, guru))['reset_diminta_pada']
    admin = _user('adm', 'admin')
    daftar = _jalan(api.daftar_permintaan_reset(admin))
    assert daftar == [{'user_id': 'g1', 'nama': 'Guru Satu', 'peran': 'guru', 'reset_diminta_pada': diminta,
                       'keterangan': 'ganti HP', 'terkunci': True}]
    assert 'password' not in str(daftar)
    _jalan(api.reset_pin_oleh_admin('g1', None, admin))
    st = _jalan(api.status_pin(guru))
    assert st['sudah_dibuat'] is False and st['terkunci'] is False and st['direset_pada'] and not st['reset_diminta_pada']
    assert _jalan(api.daftar_permintaan_reset(admin)) == []
    assert len(db_pin['simpan_akun'].docs) == 3  # isi brankas tidak tersentuh
    assert _jalan(api.buat_pin(api.PinRequest(pin='908172'), None, guru))['token']


def test_kelola_akun_milik_sendiri(db_pin):
    guru = _user('g1')
    baru = _jalan(api.tambah_akun(api.AkunRequest(nama_akun='RDM', link_web='rdm.sch.id', nama_aplikasi='RDM',
                                                  username='guru1', password='p@ss'), None, guru))
    assert 'password' not in baru and baru['link_web'] == 'https://rdm.sch.id'
    tersimpan = next(d for d in db_pin['simpan_akun'].docs if d['id'] == baru['id'])
    assert 'p@ss' not in str(tersimpan) and sa.dekripsi(tersimpan['password_enc']) == 'p@ss'
    assert _jalan(api.detail_akun_tersimpan(baru['id'], guru))['password'] == 'p@ss'

    for req, kode in (
        (api.AkunRequest(nama_akun='X', nama_aplikasi='rdm', username='GURU1', password='a'), 409),  # duplikat
        (api.AkunRequest(nama_akun='X', nama_aplikasi='Y', username='z'), 400),                      # tanpa password
        (api.AkunRequest(nama_akun='X', link_web='bukan link', nama_aplikasi='Y', username='z', password='a'), 400),
    ):
        with pytest.raises(HTTPException) as e:
            _jalan(api.tambah_akun(req, None, guru))
        assert e.value.status_code == kode

    _jalan(api.ubah_akun(baru['id'], api.AkunRequest(nama_akun='RDM Baru', nama_aplikasi='RDM', username='guru1'), None, guru))
    assert _jalan(api.detail_akun_tersimpan(baru['id'], guru))['password'] == 'p@ss'  # password kosong = tetap
    _jalan(api.ubah_akun(baru['id'], api.AkunRequest(nama_akun='RDM Baru', nama_aplikasi='RDM', username='guru1', password='baru'), None, guru))
    assert _jalan(api.detail_akun_tersimpan(baru['id'], guru))['password'] == 'baru'

    orang_lain = _user('g2')
    for fn in (lambda: api.detail_akun_tersimpan(baru['id'], orang_lain),
               lambda: api.hapus_akun(baru['id'], None, orang_lain),
               lambda: api.detail_akun_tersimpan('a3', guru)):
        with pytest.raises(HTTPException) as e:
            _jalan(fn())
        assert e.value.status_code == 404
    _jalan(api.hapus_akun(baru['id'], None, guru))
    assert all(d['id'] != baru['id'] for d in db_pin['simpan_akun'].docs)
