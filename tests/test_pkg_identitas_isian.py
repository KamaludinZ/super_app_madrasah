"""Isian identitas guru untuk lampiran PKG: akses (diri, kepala, penilai, bukan anggota), validasi, penyimpanan ke
users + snapshot SK periode berjalan (periode ditutup tidak berubah), jejak audit, dan cadangan otomatis."""

import asyncio
import os
import sys

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pkg_identitas as idn  # noqa: E402
import pkg_penjaga  # noqa: E402
import pkg_sk  # noqa: E402
from pkg_skema import IdentitasPkgRequest  # noqa: E402
from routers import pkg_identitas_api as api  # noqa: E402
from tests.pkg_palsu import Db, Koleksi, Request  # noqa: E402

KEPALA = {'id': 'kep', 'full_name': 'Kepala', 'roles': ['kepala_sekolah'], 'active_role': 'kepala_sekolah'}
PENILAI = {'id': 'pen', 'full_name': 'Penilai', 'roles': ['guru'], 'active_role': 'guru'}
G1 = {'id': 'g1', 'full_name': 'Guru Satu', 'roles': ['guru'], 'active_role': 'guru'}
G2 = {'id': 'g2', 'full_name': 'Guru Dua', 'roles': ['guru'], 'active_role': 'guru'}
LUAR = {'id': 'x', 'full_name': 'Luar SK', 'roles': ['guru'], 'active_role': 'guru'}


@pytest.fixture
def db(monkeypatch):
    d = Db({
        'pkg_periode': Koleksi([{'id': 'p1', 'nama_periode': 'Ganjil', 'status': 'berjalan', 'tanggal_tutup': '2026-12-31'},
                                {'id': 'p0', 'nama_periode': 'Lama', 'status': 'ditutup', 'tanggal_tutup': '2026-06-30'}]),
        'pkg_sk': Koleksi([
            {'id': 's1', 'periode_id': 'p1', 'is_active': True, 'penilai_ids': ['kep', 'pen'], 'dinilai_ids': ['g1', 'g2'],
             'snapshot_anggota': {'g1': {'nama': 'Guru Satu', 'nip': '222', 'pangkat': 'Lama'}, 'g2': {'nama': 'Guru Dua'},
                                  'pen': {'nama': 'Penilai'}, 'kep': {'nama': 'Kepala'}}},
            {'id': 's0', 'periode_id': 'p0', 'is_active': False, 'penilai_ids': ['kep'], 'dinilai_ids': ['g1'],
             'snapshot_anggota': {'g1': {'nama': 'Guru Satu', 'pangkat': 'Arsip'}}},
        ]),
        'pkg_penugasan': Koleksi([{'id': 't1', 'periode_id': 'p1', 'penilai_id': 'pen', 'guru_dinilai_ids': ['g1'],
                                   'supervisi_selesai': True}]),
        'users': Koleksi([
            {'id': 'kep', 'full_name': 'Kepala', 'roles': ['kepala_sekolah']}, {'id': 'pen', 'full_name': 'Penilai', 'roles': ['guru']},
            {'id': 'g1', 'full_name': 'Guru Satu', 'roles': ['guru'], 'nip_nuptk': '222', 'pangkat': 'Lama'},
            {'id': 'g2', 'full_name': 'Guru Dua', 'roles': ['guru'], 'pangkat_golongan': 'Penata Muda, III/a',
             'riwayat_pendidikan': [{'jenjang': 'SMA/MA/SMK', 'tahun_lulus': 2005}, {'jenjang': 'S1', 'jurusan': 'PAI', 'tahun_lulus': 2010}]},
            {'id': 'x', 'full_name': 'Luar SK', 'roles': ['guru']}]),
    })
    for m in (api, pkg_penjaga):
        monkeypatch.setattr(m, 'db', d)
    return d


def _panggil(fn, *args, user):
    async def jalan():
        akses = await pkg_penjaga.penjaga_pkg('anggota')(Request(), user)
        return await fn(*args, akses)
    return asyncio.run(jalan())


def _ubah(guru_id, user, **isian):
    data = IdentitasPkgRequest(**isian)
    if guru_id == 'saya':
        return _panggil(api.ubah_identitas_saya_api, data, Request(), user=user)
    return _panggil(api.ubah_identitas_guru_api, data, Request(), guru_id, user=user)


def _tolak(fn, kode):
    with pytest.raises(HTTPException) as e:
        fn()
    assert e.value.status_code == 403 and e.value.detail['alasan'] == kode


def test_baca_diri_dengan_penanda_kosong(db):
    hasil = _panggil(api.identitas_saya_api, user=G1)
    butir = {b['kunci']: b for b in hasil['butir']}
    assert butir['nama']['nilai'] == 'Guru Satu' and butir['nama']['sumber'] == 'emis'
    assert butir['pangkat']['nilai'] == 'Lama' and butir['pangkat']['sumber'] == 'pkg'
    assert butir['golongan']['kosong'] and 'Golongan' in hasil['kosong_pkg'] and hasil['diubah_sebagai'] == 'diri'
    assert hasil['isian_pkg']['pangkat'] == 'Lama'


def test_simpan_diri_ke_users_snapshot_dan_audit(db):
    hasil = _ubah('saya', G1, pangkat='Penata', golongan='III/c', tmt_golongan='2020-04-01', jabatan_fungsional='Guru Ahli Muda',
                  pendidikan_terakhir='S1 Fisika', spesialisasi='IPA')
    assert sorted(hasil['berubah']) == ['golongan', 'jabatan_fungsional', 'pangkat', 'pendidikan_terakhir', 'spesialisasi', 'tmt_golongan']
    u = next(d for d in db['users'].docs if d['id'] == 'g1')
    assert (u['pangkat'], u['golongan'], u['tmt_golongan']) == ('Penata', 'III/c', '2020-04-01')
    sk = next(d for d in db['pkg_sk'].docs if d['id'] == 's1')
    snap = sk['snapshot_anggota']['g1']
    assert (snap['pangkat'], snap['golongan'], snap['pendidikan_terakhir']) == ('Penata', 'III/c', 'S1 Fisika') and snap['nama'] == 'Guru Satu'
    # lampiran cetak periode berjalan memakai nilai baru
    ident = idn.identitas_orang(snap, u, '2026-12-31')
    assert (ident['pangkat'], ident['golongan'], ident['tmt_golongan']) == ('Penata', 'III/c', '1 April 2020')
    # snapshot SK periode ditutup tidak berubah
    assert next(d for d in db['pkg_sk'].docs if d['id'] == 's0')['snapshot_anggota']['g1']['pangkat'] == 'Arsip'
    log = [d for d in db['pkg_audit_log'].docs if d['aksi'] == 'identitas_ubah']
    assert len(log) == 1 and log[0]['aktor_id'] == 'g1' and log[0]['guru_id'] == 'g1' and log[0]['metadata']['sebagai'] == 'diri'
    assert log[0]['metadata']['perubahan']['pangkat'] == ['Lama', 'Penata'] and log[0]['kategori'] == 'komponen'


def test_tanpa_perubahan_tidak_menulis_audit_dan_kosongkan(db):
    assert _ubah('saya', G1, pangkat='Lama')['berubah'] == []
    assert not db['pkg_audit_log'].docs
    assert _ubah('saya', G1, pangkat='')['berubah'] == ['pangkat']
    u = next(d for d in db['users'].docs if d['id'] == 'g1')
    assert 'pangkat' not in u
    assert 'pangkat' not in next(d for d in db['pkg_sk'].docs if d['id'] == 's1')['snapshot_anggota']['g1']


def test_kepala_boleh_semua_guru_sk_tetapi_bukan_di_luar(db):
    hasil = _ubah('g2', KEPALA, golongan='III/a', jabatan_fungsional='Guru Pertama')
    assert hasil['diubah_sebagai'] == 'kepala' and hasil['isian_pkg']['jabatan_fungsional'] == 'Guru Pertama'
    assert next(d for d in db['pkg_sk'].docs if d['id'] == 's1')['snapshot_anggota']['g2']['jabatan_fungsional'] == 'Guru Pertama'
    assert _panggil(api.identitas_guru_api, 'g1', user=KEPALA)['nama'] == 'Guru Satu'
    _tolak(lambda: _ubah('x', KEPALA, pangkat='A'), 'bukan_penugasan')


def test_penilai_hanya_cakupan_sendiri(db):
    hasil = _ubah('g1', PENILAI, pangkat='Pembina')
    assert hasil['diubah_sebagai'] == 'penilai' and next(d for d in db['users'].docs if d['id'] == 'g1')['pangkat'] == 'Pembina'
    _tolak(lambda: _ubah('g2', PENILAI, pangkat='A'), 'bukan_penugasan')
    _tolak(lambda: _panggil(api.identitas_guru_api, 'g2', user=PENILAI), 'bukan_penugasan')
    assert _ubah('saya', PENILAI, pangkat='Penata')['diubah_sebagai'] == 'diri'  # penilai boleh melengkapi dirinya


def test_guru_biasa_dan_bukan_anggota_ditolak(db):
    _tolak(lambda: _ubah('g1', G2, pangkat='A'), 'bukan_penilai')
    _tolak(lambda: _panggil(api.identitas_guru_api, 'g1', user=G2), 'bukan_penilai')
    _tolak(lambda: _ubah('saya', LUAR, pangkat='A'), 'bukan_anggota_sk')
    _tolak(lambda: _ubah('g1', LUAR, pangkat='A'), 'bukan_anggota_sk')
    assert next(d for d in db['users'].docs if d['id'] == 'g1')['pangkat'] == 'Lama'


def test_validasi_isian():
    assert IdentitasPkgRequest(golongan='  IV/a ', tmt_golongan='2021-10-01').golongan == 'IV/a'
    assert IdentitasPkgRequest(tmt_golongan='').tmt_golongan == ''
    for salah in ({'golongan': 'III/a<script>'}, {'golongan': 'x' * 21}, {'tmt_golongan': '01-10-2021'}, {'tmt_golongan': '2021-02-30'},
                  {'tmt_golongan': '2999-01-01'}, {'tmt_golongan': '1900-01-01'}, {'pangkat': 'p' * 81}, {'pendidikan_terakhir': 'S1 <b>'},
                  {'spesialisasi': 's' * 151}, {'jabatan_fungsional': 'j' * 101}, {'nip': '123'}):
        with pytest.raises(ValidationError):
            IdentitasPkgRequest(**salah)


def test_cadangan_pangkat_golongan():
    assert idn.pecah_pangkat_golongan('Penata Muda, III/a') == ('Penata Muda', 'III/a')
    assert idn.pecah_pangkat_golongan('Pengatur Muda (V)') == ('Pengatur Muda', 'V')
    assert idn.pecah_pangkat_golongan('Pembina Tk. I, IV/b') == ('Pembina Tk. I', 'IV/b')
    assert idn.pecah_pangkat_golongan('III/d') == (None, 'III/d')
    assert idn.pecah_pangkat_golongan('Penata Muda') == ('Penata Muda', None)
    assert idn.pecah_pangkat_golongan('Golongan XXX') == ('Golongan XXX', None)
    assert idn.pecah_pangkat_golongan('') == (None, None)
    a = idn.lengkapi_akun({'pangkat_golongan': 'Penata, III/c', 'golongan': 'IV/a'})
    assert (a['pangkat'], a['golongan']) == ('Penata', 'IV/a')  # isian yang ada tidak ditimpa


def test_cadangan_pendidikan_dari_riwayat():
    r = [{'jenjang': 'S1', 'jurusan': 'PAI', 'tahun_lulus': 2010}, {'jenjang': 'S2', 'jurusan': 'Manajemen Pendidikan', 'tahun_lulus': '2015'},
         {'jenjang': 'SMA/MA/SMK', 'tahun_lulus': 2005}, 'bukan dict', {'jurusan': 'tanpa jenjang'}]
    assert idn.pendidikan_dari_riwayat(r) == 'S2 Manajemen Pendidikan'
    assert idn.pendidikan_dari_riwayat([{'jenjang': 'S1', 'jurusan': 'A', 'tahun_lulus': 2000}, {'jenjang': 'S1', 'jurusan': 'B', 'tahun_lulus': 2012}]) == 'S1 B'
    assert idn.pendidikan_dari_riwayat([{'jenjang': 'D3'}]) == 'D3' and idn.pendidikan_dari_riwayat([]) is None and idn.pendidikan_dari_riwayat(None) is None
    assert idn.lengkapi_akun({'riwayat_pendidikan': r, 'pendidikan_terakhir': 'S3 Manual'})['pendidikan_terakhir'] == 'S3 Manual'


def test_cadangan_di_lampiran_dan_snapshot(db):
    g2 = next(d for d in db['users'].docs if d['id'] == 'g2')
    ident = idn.identitas_orang(None, g2, '2026-12-31')
    assert (ident['pangkat'], ident['golongan'], ident['pendidikan']) == ('Penata Muda', 'III/a', 'S1 PAI')
    snap = asyncio.run(pkg_sk.identitas_akun(db, ['g2']))['g2']
    assert (snap['pangkat'], snap['golongan'], snap['pendidikan_terakhir']) == ('Penata Muda', 'III/a', 'S1 PAI')
    # formulir terisi dengan nilai cadangan
    assert _panggil(api.identitas_guru_api, 'g2', user=KEPALA)['isian_pkg']['golongan'] == 'III/a'


async def test_snapshot_dengan_mongodb_sungguhan(mongo_db):
    """Jalur bertitik $set/$unset pada snapshot_anggota berjalan di MongoDB asli."""
    import pkg_identitas_isian as isian
    await mongo_db.users.insert_one({'id': 'g1', 'full_name': 'Guru Satu', 'roles': ['guru'], 'pangkat': 'Lama', 'jabatan_fungsional': 'Hapus'})
    sk = {'id': 's1', 'periode_id': 'p1', 'is_active': True, 'penilai_ids': [], 'dinilai_ids': ['g1'],
          'snapshot_anggota': {'g1': {'nama': 'Guru Satu', 'pangkat': 'Lama', 'jabatan_fungsional': 'Hapus'}}}
    await mongo_db.pkg_sk.insert_one(dict(sk))
    data = IdentitasPkgRequest(pangkat='Baru', golongan='III/a', jabatan_fungsional='')
    berubah = await isian.simpan_identitas(mongo_db, 'g1', data, G1, 'diri', {'id': 'p1', 'status': 'berjalan'}, sk)
    assert sorted(berubah) == ['golongan', 'jabatan_fungsional', 'pangkat']
    snap = (await mongo_db.pkg_sk.find_one({'id': 's1'}))['snapshot_anggota']['g1']
    assert snap == {'nama': 'Guru Satu', 'pangkat': 'Baru', 'golongan': 'III/a'}
    u = await mongo_db.users.find_one({'id': 'g1'})
    assert u['pangkat'] == 'Baru' and 'jabatan_fungsional' not in u
    assert await mongo_db.pkg_audit_log.count_documents({'aksi': 'identitas_ubah'}) == 1
