"""API instrumen: pratinjau impor (template/unggah/galat 422), terapkan sebagai revisi baru, baca aktif & versi."""

import asyncio
import io
import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pkg_instrumen  # noqa: E402
import pkg_penjaga  # noqa: E402
from pkg_skema import TerapkanImporRequest  # noqa: E402
from routers import pkg_instrumen_api as api  # noqa: E402
from tests.pkg_palsu import Db, Koleksi, Request  # noqa: E402

KEPALA = {'id': 'kep', 'roles': ['kepala_sekolah'], 'active_role': 'kepala_sekolah'}
GURU = {'id': 'g1', 'roles': ['guru'], 'active_role': 'guru'}


class _Unggah:
    def __init__(self, nama, isi):
        self.filename = nama
        self._isi = isi

    async def read(self, n=-1):
        return self._isi if n < 0 else self._isi[:n]


@pytest.fixture
def db(monkeypatch):
    d = Db({
        'pkg_periode': Koleksi([{'id': 'p1', 'status': 'berjalan'}]),
        'pkg_sk': Koleksi([{'id': 's1', 'periode_id': 'p1', 'is_active': True, 'penilai_ids': ['g1'], 'dinilai_ids': []}]),
    })
    for modul in (api, pkg_penjaga):
        monkeypatch.setattr(modul, 'db', d)
    return d


def _api(fn, *args, user=KEPALA, syarat='kepala', **kw):
    async def jalan():
        akses = await pkg_penjaga.penjaga_pkg(syarat)(Request(), user)
        return await fn(*args, akses=akses, **kw)
    return asyncio.run(jalan())


def test_impor_template_resmi_lalu_revisi(db):
    assert _api(api.instrumen_aktif_api, user=GURU, syarat='anggota') is None
    p = _api(api.pratinjau_impor_api, sumber='template', berkas=None)
    assert p['token'] and p['cocok_resmi'] is True and len(p['kompetensi']) == 4
    assert db['pkg_instrumen'].docs == []  # pratinjau tidak menyimpan instrumen

    hasil = _api(api.terapkan_impor_api, TerapkanImporRequest(token=p['token']), Request())
    i1 = hasil['instrumen']
    assert (i1['revisi'], i1['is_active'], i1['sumber'], i1['cocok_resmi']) == (1, True, 'template', True)
    assert hasil['hasil'] == {'sumber': 'template', 'nama_berkas': 'pkg_template_v2026.xlsx', 'cocok_resmi': True,
                              'kompetensi': 4, 'sub': 12, 'indikator': 60, 'instrumen_sebelumnya': None}
    with pytest.raises(HTTPException) as e:  # token sekali pakai
        _api(api.terapkan_impor_api, TerapkanImporRequest(token=p['token']), Request())
    assert e.value.status_code == 404

    p2 = _api(api.pratinjau_impor_api, sumber='template', berkas=None)
    i2 = _api(api.terapkan_impor_api, TerapkanImporRequest(token=p2['token']), Request())
    assert i2['instrumen']['revisi'] == 2 and i2['instrumen']['revisi_dari'] == i1['id']
    assert i2['hasil']['instrumen_sebelumnya'] == {'id': i1['id'], 'versi_template': '2026', 'revisi': 1}
    aktif = [d['id'] for d in db['pkg_instrumen'].docs if d['is_active']]
    assert aktif == [i2['instrumen']['id']]
    assert _api(api.instrumen_aktif_api, user=GURU, syarat='anggota')['revisi'] == 2
    assert [v['revisi'] for v in _api(api.daftar_versi_api, user=GURU, syarat='anggota')] == [2, 1]
    assert [d['aksi'] for d in db['pkg_audit_log'].docs] == ['instrumen_impor', 'instrumen_impor']


def test_pratinjau_unggah_dan_galat(db):
    from pkg_template import baca_bytes_template
    p = _api(api.pratinjau_impor_api, sumber='unggah', berkas=_Unggah('instrumen.xlsx', baca_bytes_template('instrumen')))
    assert p['sumber'] == 'unggah' and p['cocok_resmi'] is True  # salinan identik template resmi

    with pytest.raises(HTTPException) as e:
        _api(api.pratinjau_impor_api, sumber='unggah', berkas=_Unggah('rusak.xlsx', b'bukan excel'))
    assert e.value.status_code == 422 and e.value.detail['pesan'] and 'galat' in e.value.detail
    for sumber, berkas in (('unggah', None), ('unggah', _Unggah('a.csv', b'x')), ('lain', None)):
        with pytest.raises(HTTPException) as e:
            _api(api.pratinjau_impor_api, sumber=sumber, berkas=berkas)
        assert e.value.status_code == 400


def test_token_milik_pengimpor(db):
    p = _api(api.pratinjau_impor_api, sumber='template', berkas=None)
    kepala_lain = {'id': 'kep2', 'roles': ['kepala_sekolah']}
    with pytest.raises(HTTPException) as e:
        _api(api.terapkan_impor_api, TerapkanImporRequest(token=p['token']), Request(), user=kepala_lain)
    assert e.value.status_code == 404


def test_hanya_kepala_mengimpor(db):
    with pytest.raises(HTTPException) as e:
        _api(api.pratinjau_impor_api, sumber='template', berkas=None, user=GURU)
    assert e.value.detail['alasan'] == 'bukan_kepala'


def test_daftar_kompetensi_dan_versi_tertentu(db):
    p = _api(api.pratinjau_impor_api, sumber='template', berkas=None)
    i1 = _api(api.terapkan_impor_api, TerapkanImporRequest(token=p['token']), Request())['instrumen']

    semua = _api(api.daftar_kompetensi_api, 'aktif', None, None, user=GURU, syarat='anggota')
    assert semua['ringkasan'] == {'kompetensi': 4, 'sub': 12, 'indikator': 60, 'skor_maks': 60}
    assert semua['total_bobot'] == 12 and semua['kompetensi'][0]['porsi_persen'] == 25.0
    assert semua['kompetensi'][0]['sub'][0]['porsi_persen'] == 8.33

    satu = _api(api.daftar_kompetensi_api, i1['id'], '2', None, user=GURU, syarat='anggota')
    assert [k['kode'] for k in satu['kompetensi']] == ['2']
    cari = _api(api.daftar_kompetensi_api, 'aktif', None, 'membimbing rekan', user=GURU, syarat='anggota')
    assert all(len(s['indikator']) == 1 and s['indikator'][0]['level'] == 5 for k in cari['kompetensi'] for s in k['sub'])
    assert _api(api.daftar_kompetensi_api, 'aktif', None, 'tidak-ada-kata-ini', user=GURU, syarat='anggota')['kompetensi'] == []

    assert _api(api.rincian_instrumen_api, i1['id'], user=GURU, syarat='anggota')['id'] == i1['id']
    with pytest.raises(HTTPException) as e:
        _api(api.rincian_instrumen_api, 'tidak-ada', user=GURU, syarat='anggota')
    assert e.value.status_code == 404
