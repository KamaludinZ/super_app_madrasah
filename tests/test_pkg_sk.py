"""SK PKG: CRUD oleh kepala madrasah, satu SK aktif per periode, nomor unik, aturan hapus, audit, penolakan non-kepala."""

import asyncio
import os
import sys

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pkg_penjaga  # noqa: E402
from pkg_skema import PenilaiSkRequest, SkRequest  # noqa: E402
from routers import pkg_kelola as api  # noqa: E402
from tests.pkg_palsu import Db, Koleksi, Request  # noqa: E402

KEPALA = {'id': 'kep', 'full_name': 'Kepala', 'roles': ['kepala_sekolah'], 'active_role': 'kepala_sekolah'}
GURU = {'id': 'g1', 'roles': ['guru'], 'active_role': 'guru'}


@pytest.fixture
def db(monkeypatch):
    d = Db({
        'pkg_periode': Koleksi([
            {'id': 'p1', 'nama_periode': 'Ganjil', 'status': 'berjalan'},
            {'id': 'p2', 'nama_periode': 'Draf', 'status': 'draf'},
            {'id': 'p0', 'nama_periode': 'Lama', 'status': 'ditutup'},
        ]),
        'users': Koleksi([
            {'id': 'kep', 'full_name': 'Kepala', 'nip_nuptk': '111'},
            {'id': 'g1', 'full_name': 'Guru Satu', 'nip_nuptk': '222'},
        ]),
    })
    monkeypatch.setattr(api, 'db', d)
    monkeypatch.setattr(pkg_penjaga, 'db', d)
    return d


def _api(fn, *args, user=KEPALA):
    async def jalan():
        akses = await pkg_penjaga.penjaga_pkg('kepala')(Request(), user)
        return await fn(*args, akses)
    return asyncio.run(jalan())


def _sk(nomor='B-1/2026', periode='p1', tanggal='2026-09-28'):
    return SkRequest(nomor_sk=nomor, tanggal_sk=tanggal, periode_id=periode, tentang='Tim penilai')


def test_buat_ubah_aktifkan_hapus(db):
    sk1 = _api(api.buat_sk_api, _sk(), Request())
    assert sk1['is_active'] is True and [a['id'] for a in sk1['penilai']] == ['kep'] and sk1['penilai'][0]['nip'] == '111'
    sk2 = _api(api.buat_sk_api, _sk('B-2/2026'), Request())
    assert sk2['is_active'] is False  # periode sudah punya SK aktif

    for nomor in ('b-1/2026', ' B-1/2026 '):  # nomor unik tanpa beda huruf besar/kecil
        with pytest.raises(HTTPException) as e:
            _api(api.buat_sk_api, _sk(nomor), Request())
        assert e.value.status_code == 409
    for periode, kode in (('p0', 409), ('tidak-ada', 404)):
        with pytest.raises(HTTPException) as e:
            _api(api.buat_sk_api, _sk('B-9', periode), Request())
        assert e.value.status_code == kode

    ubah = _api(api.ubah_sk_api, sk2['id'], _sk('B-2/2026 rev', 'p2'), Request())
    assert ubah['nomor_sk'] == 'B-2/2026 rev' and ubah['periode_id'] == 'p2'
    with pytest.raises(HTTPException) as e:  # SK aktif tidak dipindah periode
        _api(api.ubah_sk_api, sk1['id'], _sk('B-1/2026', 'p2'), Request())
    assert e.value.status_code == 409

    _api(api.ubah_sk_api, sk2['id'], _sk('B-2/2026 rev', 'p1'), Request())
    aktif = _api(api.aktifkan_sk_api, sk2['id'], Request())
    assert aktif['is_active'] is True
    status = {s['id']: s['is_active'] for s in _api(api.daftar_sk_api)}
    assert status == {sk1['id']: False, sk2['id']: True}

    with pytest.raises(HTTPException) as e:  # SK aktif tidak dapat dihapus
        _api(api.hapus_sk_api, sk2['id'], Request())
    assert e.value.status_code == 409
    db['pkg_penilaian'] = Koleksi([{'id': 'n1', 'sk_id': sk1['id']}])
    with pytest.raises(HTTPException) as e:  # sudah ada lembar penilaian
        _api(api.hapus_sk_api, sk1['id'], Request())
    assert e.value.status_code == 409
    db['pkg_penilaian'] = Koleksi()
    assert _api(api.hapus_sk_api, sk1['id'], Request())['dihapus'] is True
    with pytest.raises(HTTPException) as e:
        _api(api.rincian_sk_api, sk1['id'])
    assert e.value.status_code == 404

    aksi = [d['aksi'] for d in db['pkg_audit_log'].docs]
    assert aksi == ['sk_buat', 'sk_buat', 'sk_ubah', 'sk_ubah', 'sk_aktifkan', 'sk_hapus']


def test_snapshot_anggota_dan_tampilan(db):
    db['pkg_sk'] = Koleksi([{
        'id': 's1', 'nomor_sk': 'B-1', 'periode_id': 'p1', 'is_active': True, 'tanggal_sk': '2026-09-28',
        'penilai_ids': ['kep'], 'dinilai_ids': ['g1', 'hilang'],
        'snapshot_anggota': {'g1': {'nama': 'Guru Satu, S.Pd.', 'nip': '222', 'mapel': 'IPA'}},
    }])
    sk = _api(api.rincian_sk_api, 's1')
    assert sk['dinilai'][0] == {'id': 'g1', 'nama': 'Guru Satu, S.Pd.', 'nip': '222', 'mapel': 'IPA'}
    assert sk['dinilai'][1]['nama'] == '(akun tidak ditemukan)'
    assert sk['penilai'][0]['nama'] == 'Kepala'


def test_non_kepala_ditolak(db):
    db['pkg_sk'] = Koleksi([{'id': 's1', 'periode_id': 'p1', 'is_active': True, 'penilai_ids': ['g1'], 'dinilai_ids': []}])
    with pytest.raises(HTTPException) as e:
        _api(api.daftar_sk_api, user=GURU)
    assert e.value.status_code == 403 and e.value.detail['alasan'] == 'bukan_kepala'


def test_validasi_isian_sk():
    with pytest.raises(ValidationError):
        SkRequest(nomor_sk='B-1', tanggal_sk='28/09/2026', periode_id='p1')


def _users_guru(db):
    db['users'] = Koleksi([
        {'id': 'kep', 'full_name': 'Kepala', 'roles': ['kepala_sekolah'], 'nip_nuptk': '111'},
        {'id': 'g1', 'full_name': 'Budi', 'roles': ['guru'], 'nip_nuptk': '222'},
        {'id': 'g2', 'full_name': 'Ani', 'roles': ['wali_kelas', 'guru_ipa']},
        {'id': 'tu', 'full_name': 'Staf TU', 'roles': ['tenaga_kependidikan']},
        {'id': 'off', 'full_name': 'Pensiun', 'roles': ['guru'], 'is_active': False},
        {'id': 'sis', 'full_name': 'Siswa', 'roles': ['siswa']},
    ])


def test_guru_aktif_untuk_ceklist(db):
    _users_guru(db)
    guru = _api(api.guru_aktif_api)
    assert [g['id'] for g in guru] == ['g2', 'g1', 'kep']  # urut nama; TU, nonaktif, siswa tidak termasuk
    assert guru[1]['nip'] == '222'


def test_atur_tim_penilai(db):
    _users_guru(db)
    sk = _api(api.buat_sk_api, _sk(), Request())
    hasil = _api(api.atur_penilai_api, sk['id'], PenilaiSkRequest(penilai_ids=['g1', 'g2']), Request())
    assert [a['id'] for a in hasil['penilai']] == ['kep', 'g1', 'g2']

    # Kepala tetap disertakan walau tidak dicentang.
    hasil = _api(api.atur_penilai_api, sk['id'], PenilaiSkRequest(penilai_ids=['g1']), Request())
    assert [a['id'] for a in hasil['penilai']] == ['kep', 'g1']
    log = db['pkg_audit_log'].docs[-1]
    assert log['aksi'] == 'sk_penilai' and log['metadata']['dilepas'] == ['g2']

    for ids, kata in ((['tu'], 'bukan akun guru'), (['off'], 'nonaktif'), (['hantu'], 'tidak ditemukan')):
        with pytest.raises(HTTPException) as e:
            _api(api.atur_penilai_api, sk['id'], PenilaiSkRequest(penilai_ids=ids), Request())
        assert e.value.status_code == 400 and kata in e.value.detail

    db['pkg_penugasan'] = Koleksi([{'periode_id': 'p1', 'penilai_id': 'g1', 'guru_dinilai_ids': ['g2']}])
    with pytest.raises(HTTPException) as e:  # masih memegang guru dalam pembagian
        _api(api.atur_penilai_api, sk['id'], PenilaiSkRequest(penilai_ids=[]), Request())
    assert e.value.status_code == 409
    db['pkg_penugasan'] = Koleksi()
    db['pkg_penilaian'] = Koleksi([{'id': 'n1', 'sk_id': sk['id'], 'penilai_id': 'g1'}])
    with pytest.raises(HTTPException) as e:  # sudah mengisi lembar
        _api(api.atur_penilai_api, sk['id'], PenilaiSkRequest(penilai_ids=[]), Request())
    assert e.value.status_code == 409
