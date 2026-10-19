"""Akses PKG: keanggotaan SK aktif, kepala otomatis penilai, perangkapan peran, gerbang supervisi, 403 terstruktur."""

import asyncio
import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pkg_akses  # noqa: E402
from routers import pkg as api  # noqa: E402


class _Koleksi:
    def __init__(self, docs=()):
        self.docs = [dict(d) for d in docs]

    async def find_one(self, q, _proj=None):
        return next((dict(d) for d in self.docs if all(d.get(k) == v for k, v in q.items())), None)


class _Db(dict):
    def __getitem__(self, nama):
        return self.setdefault(nama, _Koleksi())


GURU = lambda uid: {'id': uid, 'roles': ['guru'], 'active_role': 'guru'}  # noqa: E731
KEPALA = {'id': 'kep', 'roles': ['kepala_sekolah'], 'active_role': 'kepala_sekolah'}


@pytest.fixture
def db(monkeypatch):
    d = _Db({
        'pkg_periode': _Koleksi([
            {'id': 'p-lama', 'nama_periode': 'Lama', 'status': 'ditutup'},
            {'id': 'p1', 'nama_periode': 'Ganjil 2026', 'status': 'berjalan', 'tanggal_buka': '2026-10-01', 'tanggal_tutup': '2026-11-30'},
        ]),
        'pkg_sk': _Koleksi([
            {'id': 'sk-lama', 'periode_id': 'p-lama', 'is_active': True, 'penilai_ids': ['lama'], 'dinilai_ids': []},
            {'id': 'sk1', 'nomor_sk': 'B-1/2026', 'periode_id': 'p1', 'is_active': True,
             'penilai_ids': ['pen', 'rangkap', 'kep'], 'dinilai_ids': ['gur', 'rangkap', 'kep']},
        ]),
        'pkg_penugasan': _Koleksi([
            {'periode_id': 'p1', 'penilai_id': 'pen', 'supervisi_selesai': True},
            {'periode_id': 'p1', 'penilai_id': 'rangkap', 'supervisi_selesai': False},
        ]),
    })
    monkeypatch.setattr(api, 'db', d)
    return d


def _k(db, user):
    return asyncio.run(pkg_akses.keanggotaan_sk(db, user))


def test_peran_anggota_sk(db):
    pen = _k(db, GURU('pen'))
    assert (pen['anggota'], pen['peran'], pen['supervisi_selesai'], pen['nomor_sk']) == (True, 'penilai', True, 'B-1/2026')
    assert pen['periode']['id'] == 'p1' and pen['penolakan'] is None

    gur = _k(db, GURU('gur'))
    assert (gur['anggota'], gur['peran'], gur['sebagai_penilai'], gur['sebagai_dinilai']) == (True, 'dinilai', False, True)

    # Merangkap penilai & dinilai diizinkan; belum disupervisi tercatat.
    rangkap = _k(db, GURU('rangkap'))
    assert (rangkap['sebagai_penilai'], rangkap['sebagai_dinilai'], rangkap['supervisi_selesai']) == (True, True, False)


def test_kepala_otomatis_penilai_dan_tidak_dinilai(db):
    k = _k(db, KEPALA)
    assert (k['anggota'], k['peran'], k['sebagai_penilai'], k['sebagai_dinilai'], k['supervisi_selesai']) == \
        (True, 'kepala', True, False, True)


def test_bukan_anggota_dan_sk_periode_lain(db):
    for uid in ('asing', 'lama'):  # 'lama' hanya di SK periode yang sudah ditutup
        k = _k(db, GURU(uid))
        assert k['anggota'] is False and k['penolakan']['alasan'] == 'bukan_anggota_sk'


def test_tanpa_periode_berjalan(db):
    db['pkg_periode'].docs = [d for d in db['pkg_periode'].docs if d['status'] != 'berjalan']
    assert _k(db, GURU('pen'))['anggota'] is False
    k = _k(db, KEPALA)  # kepala tetap boleh masuk untuk menetapkan periode
    assert k['anggota'] is True and k['periode'] is None and k['sk_id'] is None


def test_endpoint_beranda_403_terstruktur(db):
    with pytest.raises(HTTPException) as e:
        asyncio.run(api.beranda_pkg(GURU('asing')))
    assert e.value.status_code == 403
    assert e.value.detail['alasan'] == 'bukan_anggota_sk' and e.value.detail['pesan']

    hasil = asyncio.run(api.beranda_pkg(GURU('pen')))
    assert hasil['periode']['id'] == 'p1' and hasil['keanggotaan']['peran'] == 'penilai'
    assert 'penolakan' not in hasil['keanggotaan']

    saya = asyncio.run(api.keanggotaan_saya(GURU('asing')))  # my-membership tidak melempar 403
    assert saya['anggota'] is False
