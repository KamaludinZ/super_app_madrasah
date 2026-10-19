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


def _ubah(nama='Nama baru', bobot=2.5, alasan='penyesuaian juknis'):
    from pkg_skema import UbahSubInstrumenRequest
    return UbahSubInstrumenRequest(nama=nama, bobot=bobot, alasan=alasan,
                                   indikator=[{'level': i, 'teks': f'Indikator baru {i}'} for i in range(1, 6)])


def test_ubah_sub_instrumen(db):
    p = _api(api.pratinjau_impor_api, sumber='template', berkas=None)
    i1 = _api(api.terapkan_impor_api, TerapkanImporRequest(token=p['token']), Request())['instrumen']

    # Belum dipakai penilaian: diubah langsung, revisi tetap.
    hasil = _api(api.ubah_sub_api, _ubah(), Request(), kode='1.2')
    sub = hasil['kompetensi'][0]['sub'][1]
    assert (hasil['id'], hasil['revisi'], hasil['cocok_resmi']) == (i1['id'], 1, False)
    assert (sub['nama'], sub['bobot'], sub['indikator'][4]['teks']) == ('Nama baru', 2.5, 'Indikator baru 5')
    log = db['pkg_audit_log'].docs[-1]
    assert log['aksi'] == 'instrumen_ubah' and log['metadata']['sebelum']['nama'] != 'Nama baru'
    assert log['metadata']['sesudah']['bobot'] == 2.5 and log['metadata']['revisi_baru'] is False

    with pytest.raises(HTTPException) as e:  # tanpa perubahan
        _api(api.ubah_sub_api, _ubah(), Request(), kode='1.2')
    assert e.value.status_code == 400
    with pytest.raises(HTTPException) as e:
        _api(api.ubah_sub_api, _ubah(), Request(), kode='9.9')
    assert e.value.status_code == 404

    # Sudah dipakai lembar: revisi baru, instrumen lama utuh.
    db['pkg_penilaian'] = Koleksi([{'id': 'n1', 'instrumen_id': i1['id']}])
    baru = _api(api.ubah_sub_api, _ubah(nama='Nama revisi 2'), Request(), kode='1.2')
    assert baru['id'] != i1['id'] and baru['revisi'] == 2 and baru['revisi_dari'] == i1['id']
    lama = next(d for d in db['pkg_instrumen'].docs if d['id'] == i1['id'])
    assert lama['is_active'] is False and lama['kompetensi'][0]['sub'][1]['nama'] == 'Nama baru'
    assert db['pkg_audit_log'].docs[-1]['metadata']['revisi_baru'] is True

    with pytest.raises(HTTPException) as e:
        _api(api.ubah_sub_api, _ubah(), Request(), kode='1.1', user=GURU)
    assert e.value.detail['alasan'] == 'bukan_kepala'


def test_aktifkan_instrumen_acuan(db):
    from pkg_skema import AktifkanInstrumenRequest
    ids = []
    for _ in range(2):
        p = _api(api.pratinjau_impor_api, sumber='template', berkas=None)
        ids.append(_api(api.terapkan_impor_api, TerapkanImporRequest(token=p['token']), Request())['instrumen']['id'])
    hasil = _api(api.aktifkan_instrumen_api, AktifkanInstrumenRequest(alasan='kembali ke rev 1'), Request(), instrumen_id=ids[0])
    assert hasil['id'] == ids[0] and hasil['is_active'] is True
    assert [d['id'] for d in db['pkg_instrumen'].docs if d['is_active']] == [ids[0]]
    meta = db['pkg_audit_log'].docs[-1]['metadata']
    assert db['pkg_audit_log'].docs[-1]['aksi'] == 'instrumen_aktifkan' and meta['sebelumnya']['id'] == ids[1]

    for iid, kode in ((ids[0], 400), ('tidak-ada', 404)):
        with pytest.raises(HTTPException) as e:
            _api(api.aktifkan_instrumen_api, AktifkanInstrumenRequest(alasan='x'), Request(), instrumen_id=iid)
        assert e.value.status_code == kode
    with pytest.raises(Exception):
        AktifkanInstrumenRequest(alasan='  ')


def test_riwayat_perubahan_instrumen(db):
    import pkg_instrumen as svc
    p = _api(api.pratinjau_impor_api, sumber='template', berkas=None)
    _api(api.terapkan_impor_api, TerapkanImporRequest(token=p['token']), Request())
    _api(api.ubah_sub_api, _ubah(nama='Nama riwayat', bobot=3), Request(), kode='2.1')
    riwayat = _api(api.riwayat_instrumen_api)
    assert [r['aksi'] for r in riwayat] == ['instrumen_ubah', 'instrumen_impor']
    ubah = riwayat[0]
    assert ubah['label'] == 'Mengubah instrumen' and ubah['kode_sub'] == '2.1' and ubah['alasan'] == 'penyesuaian juknis'
    assert ubah['perubahan'][0].startswith('Nama: "Kematangan moral') and 'Bobot: 1.0 -> 3.0' in ubah['perubahan']
    assert ubah['perubahan'][-1] == 'Teks indikator diubah: Level 1, Level 2, Level 3, Level 4, Level 5'
    assert riwayat[1]['nama_berkas'] == 'pkg_template_v2026.xlsx'
    assert svc.ringkas_perubahan_sub({'nama': 'a', 'bobot': 1, 'indikator': []}, {'nama': 'a', 'bobot': 1, 'indikator': []}) == []
    with pytest.raises(HTTPException):
        _api(api.riwayat_instrumen_api, user=GURU)
