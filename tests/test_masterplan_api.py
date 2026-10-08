"""API Masterplan: validasi gambar denah, unggah/ganti/hapus (berkas ikut terhapus), penanda unik per ruang."""

import asyncio
import io
import os
import sys

import pytest
from fastapi import HTTPException
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from routers import masterplan as api  # noqa: E402


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
            if isinstance(v, dict) and '$in' in v:
                if d.get(k) not in v['$in']:
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
                return
        if upsert:
            self.docs.append({**q, **u.get('$set', {}), **u.get('$setOnInsert', {})})

    async def delete_one(self, q):
        sebelum = len(self.docs)
        self.docs = [d for d in self.docs if not self._cocok(d, q)]
        return type('H', (), {'deleted_count': sebelum - len(self.docs)})()

    async def delete_many(self, q):
        self.docs = [d for d in self.docs if not self._cocok(d, q)]


class _Db(dict):
    def __getattr__(self, nama):
        return self.setdefault(nama, _Koleksi())

    def __getitem__(self, nama):
        return self.setdefault(nama, _Koleksi())


class _Berkas:
    def __init__(self, isi):
        self.isi = isi

    async def read(self, _n=-1):
        return self.isi


def _gambar(fmt='PNG', ukuran=(400, 200)):
    buf = io.BytesIO()
    Image.new('RGB', ukuran, 'white').save(buf, format=fmt)
    return buf.getvalue()


ADMIN = {'id': 'adm', 'active_role': 'admin', 'roles': ['admin']}


@pytest.fixture
def db(monkeypatch, tmp_path):
    d = _Db(rooms=_Koleksi([{'id': 'r1', 'name': 'Kelas 7A'}, {'id': 'r2', 'name': 'Lab IPA'}]))

    async def _audit(*_a, **_k):
        return None
    monkeypatch.setattr(api, 'db', d)
    monkeypatch.setattr(api, 'log_audit', _audit)
    monkeypatch.setattr(api, 'folder_unggahan', lambda _n: str(tmp_path))
    return d


def test_validasi_gambar():
    assert api._periksa_gambar(_gambar('PNG'))['ext'] == 'png'
    assert api._periksa_gambar(_gambar('JPEG'))['media_type'] == 'image/jpeg'
    with pytest.raises(Exception):  # posisi di luar 0–100 ditolak validasi (422 di API)
        api.MarkerRequest(room_id='r1', posisi_x=120, posisi_y=10)
    for isi in (b'', b'bukan gambar', _gambar('GIF'), b'x' * (api.MAKS_UKURAN + 1)):
        with pytest.raises(HTTPException) as e:
            api._periksa_gambar(isi)
        assert e.value.status_code == 400


def test_unggah_ganti_hapus_denah_dan_penanda(db, tmp_path):
    assert asyncio.run(api.lihat_masterplan({'id': 'g'})) == {'denah': None, 'markers': []}
    with pytest.raises(HTTPException):
        asyncio.run(api.tambah_marker(api.MarkerRequest(room_id='r1', kode_ruang='R-01', posisi_x=10, posisi_y=10), None, ADMIN))

    denah = asyncio.run(api.unggah_denah(None, _Berkas(_gambar(ukuran=(400, 200))), ADMIN))
    assert (denah['lebar'], denah['tinggi']) == (400, 200) and denah['image_url'].startswith('/api/masterplan/denah/gambar')
    berkas_awal = os.listdir(tmp_path)
    assert len(berkas_awal) == 1

    m = asyncio.run(api.tambah_marker(api.MarkerRequest(room_id='r1', kode_ruang=' r-7a ', posisi_x=99.98, posisi_y=33.333), None, ADMIN))
    assert (m['nama_ruang'], m['posisi_x'], m['posisi_y']) == ('Kelas 7A', 100.0, 33.3)
    assert m['kode_ruang'] == 'R-7A'
    for req, kode in ((api.MarkerRequest(room_id='r1', kode_ruang='X1', posisi_x=1, posisi_y=1), 409),
                      (api.MarkerRequest(room_id='tidak-ada', kode_ruang='X2', posisi_x=1, posisi_y=1), 404),
                      (api.MarkerRequest(room_id='r2'), 400)):
        with pytest.raises(HTTPException) as e:
            asyncio.run(api.tambah_marker(req, None, ADMIN))
        assert e.value.status_code == kode
    for kode, status in (('R-7A', 409), ('', 400), ('ABCDEFGHIJKLM', 400), ('#1', 400)):
        with pytest.raises(HTTPException) as e:  # kode wajib, unik, dan berformat
            asyncio.run(api.tambah_marker(api.MarkerRequest(room_id='r2', kode_ruang=kode, posisi_x=5, posisi_y=5), None, ADMIN))
        assert e.value.status_code == status, kode
    m2 = asyncio.run(api.tambah_marker(api.MarkerRequest(room_id='r2', kode_ruang='LAB-1', posisi_x=50, posisi_y=50), None, ADMIN))
    with pytest.raises(HTTPException) as e:
        asyncio.run(api.ubah_marker(m2['id'], api.MarkerRequest(kode_ruang='r-7a'), None, ADMIN))
    assert e.value.status_code == 409
    assert asyncio.run(api.ubah_marker(m2['id'], api.MarkerRequest(kode_ruang='lab-ipa'), None, ADMIN))['kode_ruang'] == 'LAB-IPA'
    with pytest.raises(HTTPException) as e:  # ganti ke ruang yang sudah ditandai
        asyncio.run(api.ubah_marker(m2['id'], api.MarkerRequest(room_id='r1'), None, ADMIN))
    assert e.value.status_code == 409
    geser = asyncio.run(api.ubah_marker(m2['id'], api.MarkerRequest(posisi_x=60.04), None, ADMIN))
    assert geser['posisi_x'] == 60.0 and geser['posisi_y'] == 50

    db['rooms'].docs[0]['name'] = 'Kelas 7A Baru'  # nama mengikuti master ruangan terkini
    lihat = asyncio.run(api.lihat_masterplan({'id': 'g'}))
    assert [(x['kode_ruang'], x['nama_ruang']) for x in lihat['markers']] == [('LAB-IPA', 'Lab IPA'), ('R-7A', 'Kelas 7A Baru')]  # urut kode

    asyncio.run(api.unggah_denah(None, _Berkas(_gambar('WEBP', (800, 400))), ADMIN))  # ganti: berkas lama terhapus
    assert len(os.listdir(tmp_path)) == 1 and os.listdir(tmp_path) != berkas_awal
    assert len(asyncio.run(api.lihat_masterplan({'id': 'g'}))['markers']) == 2  # penanda dipertahankan

    asyncio.run(api.hapus_marker(m['id'], None, ADMIN))
    with pytest.raises(HTTPException):
        asyncio.run(api.hapus_marker(m['id'], None, ADMIN))
    asyncio.run(api.hapus_denah(None, ADMIN))
    assert os.listdir(tmp_path) == [] and db['masterplan_marker'].docs == []
