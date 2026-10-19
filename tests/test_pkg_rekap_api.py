"""API rekap: cakupan per peran (kepala/penilai/pribadi) dan rincian per guru."""

import asyncio
import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pkg_penjaga  # noqa: E402
import pkg_rekap  # noqa: E402
from routers import pkg_rekap_api as api  # noqa: E402
from tests.pkg_palsu import Db, Koleksi, Request  # noqa: E402

INSTRUMEN = {'id': 'i1', 'versi_template': '2026', 'revisi': 1, 'kompetensi': [
    {'kode': '1', 'sub': [{'kode': '1.1', 'indikator': [{'level': i} for i in range(1, 6)]}]}]}


def _lembar(lid, guru, penilai, status='terkunci'):
    return {'id': lid, 'status': status, 'periode_id': 'p1', 'sk_id': 's1', 'guru_dinilai_id': guru, 'penilai_id': penilai,
            'instrumen_id': 'i1', 'snapshot_guru': {'nama': guru.upper()}, 'isian': {'1.1': {'centang': [1, 2, 3, 4]}},
            'catatan_umum': f'catatan {guru}', 'terkunci_pada': '2026-10-18T00:00:00Z'}


@pytest.fixture
def db(monkeypatch):
    d = Db({
        'pkg_periode': Koleksi([{'id': 'p1', 'status': 'berjalan', 'nama_periode': 'Ganjil'},
                                {'id': 'p0', 'status': 'ditutup', 'nama_periode': 'Genap'}]),
        'pkg_sk': Koleksi([{'id': 's1', 'periode_id': 'p1', 'is_active': True, 'penilai_ids': ['pen', 'rangkap'],
                            'dinilai_ids': ['g1', 'g2', 'rangkap', 'g3']}]),
        'pkg_penugasan': Koleksi([{'periode_id': 'p1', 'penilai_id': 'pen', 'guru_dinilai_ids': ['g1', 'rangkap'], 'supervisi_selesai': True},
                                  {'periode_id': 'p1', 'penilai_id': 'rangkap', 'guru_dinilai_ids': ['g2'], 'supervisi_selesai': True}]),
        'pkg_penilaian': Koleksi([_lembar('n1', 'g1', 'pen'), _lembar('n2', 'g2', 'rangkap', 'draf'),
                                  _lembar('n3', 'rangkap', 'pen'), _lembar('n4', 'g3', 'kep', 'draf')]),
        'pkg_instrumen': Koleksi([INSTRUMEN]),
    })
    for m in (api, pkg_penjaga):
        monkeypatch.setattr(m, 'db', d)
    asyncio.run(pkg_rekap.bangun_ulang_rekap(d))
    return d


def _guru(uid):
    return {'id': uid, 'roles': ['kepala_sekolah'] if uid == 'kep' else ['guru'], 'active_role': 'guru'}


def _rincian(user, guru, periode=None):
    async def jalan():
        akses = await pkg_penjaga.penjaga_pkg('anggota')(Request(), _guru(user))
        return await api.rekap_guru_api(guru, periode, akses=akses)
    return asyncio.run(jalan())


def test_rincian_guru_kepala(db):
    r = _rincian('kep', 'g1')
    assert r['status'] == 'terkunci' and r['hasil']['nilai_akhir'] == 4 and r['hasil']['capaian_persen'] == 80.0
    assert r['isian'] == {'1.1': {'centang': [1, 2, 3, 4]}} and r['instrumen']['id'] == 'i1'
    assert r['catatan_umum'] == 'catatan g1' and r['guru']['nama'] == 'G1' and r['periode']['id'] == 'p1'
    draf = _rincian('kep', 'g3')
    assert draf['status'] == 'draf' and draf['hasil'] is None and draf['isian'] == {}


def test_cakupan_penilai_dan_pribadi(db):
    assert _rincian('pen', 'g1')['hasil']['nilai_akhir'] == 4  # guru yang dinilainya
    for user, guru in (('pen', 'g2'), ('g1', 'g2'), ('rangkap', 'g1')):
        with pytest.raises(HTTPException) as e:
            _rincian(user, guru)
        assert e.value.status_code == 403, (user, guru)
    assert _rincian('g1', 'g1')['status'] == 'terkunci'  # hasil sendiri setelah dikunci
    assert _rincian('rangkap', 'rangkap')['hasil'] is not None  # penilai yang juga dinilai
    assert _rincian('rangkap', 'g2')['status'] == 'draf'  # guru yang dinilainya (draf tetap terlihat penilai)


def test_hasil_sendiri_belum_dikunci_ditolak(db):
    with pytest.raises(HTTPException):
        _rincian('g3', 'g3')  # g3 bukan penilai, lembar masih draf -> tersembunyi
    with pytest.raises(HTTPException) as e:
        _rincian('kep', 'g1', periode='tidak-ada')
    assert e.value.status_code == 404
