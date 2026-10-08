"""Simpan Akun: enkripsi password, hash PIN, ringkasan tanpa password, migrasi index."""

import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import simpan_akun as sa  # noqa: E402
from migrations.migrate_simpan_akun import migrate  # noqa: E402


def test_enkripsi_password_bolak_balik_dan_tidak_polos():
    token = sa.enkripsi('Rahasia#123')
    assert 'Rahasia' not in token
    assert sa.dekripsi(token) == 'Rahasia#123'
    assert sa.dekripsi(None) == ''


def test_dekripsi_kunci_lain_gagal(monkeypatch):
    token = sa.enkripsi('x')
    monkeypatch.setattr(sa, '_fernet', None)
    monkeypatch.setenv('SIMPAN_AKUN_KEY', sa.Fernet.generate_key().decode())
    try:
        sa.dekripsi(token)
        assert False, 'harus gagal'
    except ValueError:
        pass
    finally:
        sa._fernet = None


def test_pin_hash_dan_validasi():
    assert sa.pin_valid('012345') and not sa.pin_valid('12345') and not sa.pin_valid('12a456')
    h = sa.hash_pin('012345')
    assert h != '012345' and sa.cocok_pin('012345', h) and not sa.cocok_pin('012346', h)
    assert not sa.cocok_pin('012345', None)


def test_ringkas_tanpa_password_detail_terdekripsi():
    doc = {'id': 'a', 'user_id': 'u', 'nama_akun': 'EMIS', 'nama_aplikasi': 'EMIS', 'link_web': '', 'username': 'x',
           'password_enc': sa.enkripsi('p4ss')}
    ringkas = sa.ringkas_akun(doc)
    assert 'password' not in ringkas and 'password_enc' not in ringkas and 'user_id' not in ringkas
    assert sa.detail_akun(doc)['password'] == 'p4ss'


class _Hasil:
    modified_count = 0


class _Koleksi:
    def __init__(self):
        self.indexes = []

    async def create_index(self, keys, **opsi):
        self.indexes.append((keys, opsi))

    async def update_many(self, *_a):
        return _Hasil()

    async def count_documents(self, _q):
        return 0


def test_migrasi_membuat_index_unik():
    db = {'simpan_akun': _Koleksi(), 'simpan_akun_pin': _Koleksi()}
    hasil = asyncio.run(migrate(db))
    assert hasil == {'akun': 0, 'pin': 0, 'pin_dilengkapi': 0}
    assert ([('user_id', 1)], {'unique': True}) in db['simpan_akun_pin'].indexes
    assert ([('id', 1)], {'unique': True}) in db['simpan_akun'].indexes


def test_pin_lemah_ditolak():
    for pin, kata in (('111111', 'sama'), ('123456', 'berurutan'), ('654321', 'berurutan'), ('121212', 'berulang'),
                      ('123123', 'berulang'), ('12345', '6 angka')):
        assert kata in sa.alasan_pin_lemah(pin), pin
    for pin in ('582913', '908172', '901234'):
        assert sa.alasan_pin_lemah(pin) == ''
