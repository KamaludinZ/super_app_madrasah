"""API penilaian: daftar tugas penilai (syarat penilai tersupervisi), ringkasan, instrumen, masa penilaian."""

import asyncio
import os
import sys
from datetime import date, timedelta

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pkg_penjaga  # noqa: E402
from routers import pkg_penilaian_api as api  # noqa: E402
from tests.pkg_palsu import Db, Koleksi, Request  # noqa: E402

HARI_INI = date.today()


def GURU(uid):
    return {'id': uid, 'roles': ['guru'], 'active_role': 'guru'}


@pytest.fixture
def db(monkeypatch):
    d = Db({
        'pkg_periode': Koleksi([{'id': 'p1', 'status': 'berjalan', 'nama_periode': 'Ganjil',
                                 'tanggal_buka': str(HARI_INI - timedelta(days=5)), 'tanggal_tutup': str(HARI_INI + timedelta(days=30))}]),
        'pkg_sk': Koleksi([{'id': 's1', 'periode_id': 'p1', 'is_active': True, 'penilai_ids': ['pen', 'belum'],
                            'dinilai_ids': ['g1', 'g2', 'g3']}]),
        'pkg_penugasan': Koleksi([
            {'id': 't1', 'periode_id': 'p1', 'penilai_id': 'pen', 'guru_dinilai_ids': ['g1', 'g2', 'g3'], 'supervisi_selesai': True,
             'snapshot_guru': {'g1': {'nama': 'Ani'}, 'g2': {'nama': 'Budi'}, 'g3': {'nama': 'Cici'}}},
            {'id': 't2', 'periode_id': 'p1', 'penilai_id': 'belum', 'guru_dinilai_ids': [], 'supervisi_selesai': False},
        ]),
        'pkg_penilaian': Koleksi([
            {'id': 'n1', 'sk_id': 's1', 'penilai_id': 'pen', 'guru_dinilai_id': 'g1', 'status': 'terkunci'},
            {'id': 'n2', 'sk_id': 's1', 'penilai_id': 'pen', 'guru_dinilai_id': 'g2', 'status': 'draf', 'progres': 50},
        ]),
        'pkg_instrumen': Koleksi([{'id': 'i1', 'versi_template': '2026', 'revisi': 1, 'cocok_resmi': True, 'is_active': True}]),
    })
    for m in (api, pkg_penjaga):
        monkeypatch.setattr(m, 'db', d)
    return d


def _api(fn, *args, user):
    async def jalan():
        akses = await pkg_penjaga.penjaga_pkg('penilai')(Request(), user)
        return await fn(*args, akses=akses)
    return asyncio.run(jalan())


def test_daftar_tugas_penilai(db):
    hasil = _api(api.daftar_tugas_api, user=GURU('pen'))
    assert hasil['ringkasan'] == {'total': 3, 'belum': 1, 'draf': 1, 'terkunci': 1}
    assert [t['nama'] for t in hasil['tugas']] == ['Budi', 'Cici', 'Ani']  # draf, belum, terkunci
    assert hasil['instrumen'] == {'id': 'i1', 'versi_template': '2026', 'revisi': 1, 'cocok_resmi': True}
    assert hasil['dapat_diisi'] is True and hasil['alasan_tidak_dapat_diisi'] is None


def test_tidak_dapat_diisi(db):
    db['pkg_instrumen'] = Koleksi()
    assert _api(api.daftar_tugas_api, user=GURU('pen'))['alasan_tidak_dapat_diisi'] == 'instrumen_belum_ada'
    db['pkg_periode'].docs[0]['tanggal_tutup'] = str(HARI_INI - timedelta(days=1))
    assert _api(api.daftar_tugas_api, user=GURU('pen'))['alasan_tidak_dapat_diisi'] == 'di_luar_masa'


def test_penilai_belum_disupervisi_ditolak(db):
    with pytest.raises(HTTPException) as e:
        _api(api.daftar_tugas_api, user=GURU('belum'))
    assert e.value.detail['alasan'] == 'belum_disupervisi'
    with pytest.raises(HTTPException) as e:
        _api(api.daftar_tugas_api, user=GURU('g3'))
    assert e.value.detail['alasan'] == 'bukan_penilai'


INSTRUMEN_KOMP = [{'kode': '1', 'nama': 'Kompetensi Pedagogik', 'sub': [
    {'kode': '1.1', 'nama': 'Sub', 'bobot': 1, 'indikator': [{'level': i, 'teks': f't{i}'} for i in range(1, 6)]}]}]


def _lembar(guru, user='pen'):
    return _api(api.buka_lembar_api, guru, user=GURU(user))


def test_buka_lembar(db):
    db['pkg_instrumen'].docs[0]['kompetensi'] = INSTRUMEN_KOMP
    db['pkg_instrumen'].docs.append({'id': 'i0', 'versi_template': '2025', 'revisi': 3, 'is_active': False, 'kompetensi': INSTRUMEN_KOMP})
    db['pkg_penilaian'].docs[1].update({'instrumen_id': 'i0', 'isian': {'1.1': {'centang': [1, 2]}}, 'catatan_umum': 'ok',
                                        'updated_at': '2026-10-10T00:00:00Z'})
    db['users'] = Koleksi([{'id': 'g3', 'full_name': 'Cici Akun', 'nip_nuptk': '333', 'is_active': False}])
    db['pkg_sk'].docs[0]['penilai_ids'].append('g3')

    baru = _lembar('g3')  # belum ada lembar -> instrumen aktif, status belum
    assert (baru['id'], baru['status'], baru['instrumen']['id'], baru['dapat_diisi']) == (None, 'belum', 'i1', True)
    assert baru['guru'] == {'id': 'g3', 'nama': 'Cici', 'nip': '333', 'mapel': None, 'akun_aktif': False, 'juga_penilai': True}
    assert baru['periode']['id'] == 'p1' and baru['instrumen']['kompetensi'][0]['kode'] == '1'

    draf = _lembar('g2')  # lembar lama memakai instrumen versinya
    assert (draf['status'], draf['instrumen']['id'], draf['instrumen']['revisi']) == ('draf', 'i0', 3)
    assert draf['isian'] == {'1.1': {'centang': [1, 2]}} and draf['catatan_umum'] == 'ok' and draf['hasil'] is None

    db['pkg_penilaian'].docs[0].update({'nilai_akhir': 40, 'nilai_maks': 60, 'capaian_persen': 66.67, 'level_capaian': 'Level 3',
                                        'predikat': 'Terpenuhi pada Jenjang Jabatan Guru Ahli Muda', 'instrumen_id': 'i1'})
    kunci = _lembar('g1')
    assert kunci['status'] == 'terkunci' and kunci['dapat_diisi'] is False and kunci['alasan_tidak_dapat_diisi'] == 'terkunci'
    assert kunci['hasil']['nilai_akhir'] == 40


def test_buka_lembar_ditolak(db):
    db['pkg_sk'].docs[0]['dinilai_ids'].append('lain')
    for guru in ('lain', 'pen'):  # tidak dibagikan / diri sendiri
        with pytest.raises(HTTPException) as e:
            _lembar(guru)
        assert e.value.status_code == 403 and e.value.detail['alasan'] == 'bukan_penugasan'
    db['pkg_penilaian'].docs[1]['penilai_id'] = 'penilai-lain'
    with pytest.raises(HTTPException) as e:
        _lembar('g2')
    assert 'penilai lain' in e.value.detail['pesan']
    db['pkg_instrumen'] = Koleksi()
    with pytest.raises(HTTPException) as e:
        _lembar('g3')
    assert e.value.status_code == 409


def test_buka_lembar_di_luar_masa(db):
    db['pkg_periode'].docs[0]['tanggal_buka'] = str(HARI_INI + timedelta(days=1))
    lembar = _lembar('g3')
    assert lembar['dapat_diisi'] is False and lembar['alasan_tidak_dapat_diisi'] == 'di_luar_masa'


def _draf(guru, isian, user='pen', catatan=''):
    from pkg_skema import DrafPenilaianRequest
    async def jalan():
        akses = await pkg_penjaga.penjaga_pkg('penilai')(Request(), GURU(user))
        return await api.simpan_draf_api(DrafPenilaianRequest(guru_id=guru, isian=isian, catatan_umum=catatan), Request(), akses=akses)
    return asyncio.run(jalan())


def test_simpan_draf(db):
    db['pkg_instrumen'].docs[0]['kompetensi'] = INSTRUMEN_KOMP + [{'kode': '2', 'nama': 'K2', 'sub': [
        {'kode': '2.1', 'nama': 'S', 'bobot': 1, 'indikator': [{'level': i, 'teks': f't{i}'} for i in range(1, 6)]}]}]
    db['users'] = Koleksi([{'id': 'g3', 'full_name': 'Cici Akun'}])
    hasil = _draf('g3', {'1.1': {'centang': [1, 2, 4], 'catatan_bukti': 'RPP'}}, catatan='awal')
    assert hasil['status'] == 'draf' and hasil['progres'] == 50
    dok = next(d for d in db['pkg_penilaian'].docs if d['guru_dinilai_id'] == 'g3')
    assert (dok['instrumen_id'], dok['penilai_id'], dok['sk_id'], dok['snapshot_guru']['nama']) == ('i1', 'pen', 's1', 'Cici')
    assert dok['skor_per_indikator'] == {'1.1': 3, '2.1': 0} and dok['isian']['1.1']['catatan_bukti'] == 'RPP'

    lagi = _draf('g3', {'1.1': {'centang': [1]}, '2.1': {'centang': [1, 2, 3, 4, 5]}})
    assert lagi['id'] == hasil['id'] and lagi['progres'] == 100
    assert len([d for d in db['pkg_penilaian'].docs if d['guru_dinilai_id'] == 'g3']) == 1
    audit = [(d['aksi'], d.get('jumlah')) for d in db['pkg_audit_log'].docs]
    assert ('penilaian_mulai', None) in audit and ('penilaian_draf', 2) in audit
    assert all(d['penilaian_id'] == hasil['id'] for d in db['pkg_audit_log'].docs if d['aksi'].startswith('penilaian_'))


def test_simpan_draf_ditolak(db):
    db['pkg_instrumen'].docs[0]['kompetensi'] = INSTRUMEN_KOMP
    with pytest.raises(HTTPException) as e:  # kode sub tidak ada di instrumen
        _draf('g3', {'9.9': {'centang': [1]}})
    assert e.value.status_code == 400
    with pytest.raises(HTTPException) as e:  # lembar terkunci
        _draf('g1', {'1.1': {'centang': [1]}})
    assert e.value.status_code == 409
    with pytest.raises(HTTPException) as e:  # bukan tugasnya
        _draf('g3', {'1.1': {'centang': [1]}}, user='kep-palsu')
    assert e.value.status_code == 403
    db['pkg_periode'].docs[0]['tanggal_tutup'] = str(HARI_INI - timedelta(days=1))
    with pytest.raises(HTTPException) as e:  # di luar masa
        _draf('g3', {'1.1': {'centang': [1]}})
    assert e.value.detail['alasan'] == 'di_luar_masa'


def _kirim(guru, isian, user='pen'):
    from pkg_skema import KirimPenilaianRequest
    async def jalan():
        akses = await pkg_penjaga.penjaga_pkg('penilai')(Request(), GURU(user))
        return await api.kirim_api(KirimPenilaianRequest(guru_id=guru, isian=isian), Request(), akses=akses)
    return asyncio.run(jalan())


def test_kirim_dan_kunci(db):
    db['pkg_instrumen'].docs[0]['kompetensi'] = INSTRUMEN_KOMP + [{'kode': '2', 'nama': 'K2', 'sub': [
        {'kode': '2.1', 'nama': 'S', 'bobot': 1, 'indikator': [{'level': i, 'teks': f't{i}'} for i in range(1, 6)]}]}]
    with pytest.raises(HTTPException) as e:  # belum lengkap: tidak ada yang tersimpan sebagai terkunci
        _kirim('g3', {'1.1': {'centang': [1, 2]}})
    assert e.value.status_code == 400 and e.value.detail['galat'] == {'2.1': 'Belum dinilai: centang minimal satu indikator.'}
    assert not any(d['guru_dinilai_id'] == 'g3' for d in db['pkg_penilaian'].docs)

    hasil = _kirim('g3', {'1.1': {'centang': [1, 2, 3, 4]}, '2.1': {'centang': [1, 2, 3]}})
    assert hasil['status'] == 'terkunci' and hasil['dapat_diisi'] is False
    assert hasil['hasil']['nilai_akhir'] == 7 and hasil['hasil']['nilai_maks'] == 10 and hasil['hasil']['capaian_persen'] == 70.0
    assert hasil['hasil']['level_capaian'] == 'Level 3' and hasil['hasil']['predikat'].endswith('Ahli Muda')
    dok = next(d for d in db['pkg_penilaian'].docs if d['guru_dinilai_id'] == 'g3')
    assert dok['terkunci_oleh'] == 'pen' and dok['skor_per_indikator'] == {'1.1': 4, '2.1': 3}
    kirim = [d for d in db['pkg_audit_log'].docs if d['aksi'] == 'penilaian_kirim']
    assert len(kirim) == 1 and kirim[0]['metadata']['nilai_akhir'] == 7 and kirim[0]['penilaian_id'] == dok['id']

    with pytest.raises(HTTPException) as e:  # sudah terkunci: tidak bisa dikirim/diubah lagi
        _kirim('g3', {'1.1': {'centang': [1]}, '2.1': {'centang': [1]}})
    assert e.value.status_code == 409
    with pytest.raises(HTTPException) as e:
        _draf('g3', {'1.1': {'centang': [1]}})
    assert e.value.status_code == 409
