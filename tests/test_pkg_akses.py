"""Akses PKG: keanggotaan SK aktif, kepala otomatis penilai, perangkapan peran, gerbang supervisi, 403 terstruktur."""

import asyncio
import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pkg_akses  # noqa: E402
import pkg_audit  # noqa: E402
import pkg_beranda  # noqa: E402
import pkg_penjaga  # noqa: E402
from routers import pkg as api  # noqa: E402


class _Cursor:
    def __init__(self, docs):
        self.docs = docs

    async def to_list(self, _n):
        return [dict(d) for d in self.docs]


def _cocok_nilai(nilai, syarat):
    if isinstance(syarat, dict) and '$in' in syarat:
        return nilai in syarat['$in']
    if isinstance(nilai, list):  # field array cocok bila memuat nilai (seperti MongoDB)
        return syarat in nilai
    return nilai == syarat


class _Koleksi:
    def __init__(self, docs=()):
        self.docs = [dict(d) for d in docs]

    def _cocok(self, d, q):
        return all(_cocok_nilai(d.get(k), v) for k, v in q.items())

    def find(self, q=None, _proj=None):
        return _Cursor([d for d in self.docs if self._cocok(d, q or {})])

    async def find_one(self, q, _proj=None):
        return next((dict(d) for d in self.docs if self._cocok(d, q)), None)

    async def insert_one(self, doc):
        self.docs.append(dict(doc))

    async def update_one(self, q, u, upsert=False):
        d = next((d for d in self.docs if self._cocok(d, q)), None)
        if d is None:
            if not upsert:
                return
            d = {**q, **u.get('$setOnInsert', {})}
            self.docs.append(d)
        d.update(u.get('$set', {}))
        for k, v in u.get('$inc', {}).items():
            d[k] = d.get(k, 0) + v


class _Db(dict):
    def __getattr__(self, nama):
        return self[nama]

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
    monkeypatch.setattr(pkg_penjaga, 'db', d)
    return d


class _Request:
    def __init__(self, jalur):
        self.url = type('U', (), {'path': jalur})()
        self.client = type('C', (), {'host': '10.0.0.1'})()


def _panggil(fn, user, *awal, syarat='anggota', jalur='/pkg/uji'):
    """Jalankan endpoint seperti FastAPI: penjaga_pkg(syarat) lebih dahulu, lalu endpoint dengan hasilnya."""
    async def jalan():
        akses = await pkg_penjaga.penjaga_pkg(syarat)(_Request(jalur), user)
        return await fn(*awal, akses)
    return asyncio.run(jalan())


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
        _panggil(api.beranda_pkg, GURU('asing'), None)
    assert e.value.status_code == 403
    assert e.value.detail['alasan'] == 'bukan_anggota_sk' and e.value.detail['pesan']

    hasil = _panggil(api.beranda_pkg, GURU('pen'), None)
    assert hasil['periode']['id'] == 'p1' and hasil['keanggotaan']['peran'] == 'penilai'
    assert 'penolakan' not in hasil['keanggotaan']

    saya = asyncio.run(api.keanggotaan_saya(GURU('asing')))  # my-membership tidak melempar 403
    assert saya['anggota'] is False


def test_ringkasan_kinerja(db):
    db['users'] = _Koleksi([{'id': 'kep', 'roles': ['guru', 'kepala_sekolah']}, {'id': 'gur', 'roles': ['guru']}])
    db['pkg_sk'].docs[1]['dinilai_ids'] = ['gur', 'rangkap', 'kep', 'g3', 'g4', 'gur']
    db['pkg_penilaian'] = _Koleksi([
        {'sk_id': 'sk1', 'guru_dinilai_id': 'gur', 'status': 'terkunci'},
        {'sk_id': 'sk1', 'guru_dinilai_id': 'rangkap', 'status': 'draf'},
        {'sk_id': 'sk1', 'guru_dinilai_id': 'g3', 'status': 'draf'},
        {'sk_id': 'sk1', 'guru_dinilai_id': 'g3', 'status': 'terkunci'},  # status paling maju dipakai
        {'sk_id': 'sk1', 'guru_dinilai_id': 'kep', 'status': 'terkunci'},  # kepala tidak dihitung
        {'sk_id': 'sk-lama', 'guru_dinilai_id': 'g4', 'status': 'terkunci'},  # SK lain diabaikan
    ])
    hasil = {'total': 4, 'selesai': 2, 'sedang': 1, 'belum': 1}
    assert _panggil(api.ringkasan_beranda, GURU('pen')) == hasil
    assert _panggil(api.beranda_pkg, GURU('gur'), None)['ringkasan'] == hasil
    assert asyncio.run(pkg_beranda.ringkasan_kinerja(db, None)) == {'total': 0, 'selesai': 0, 'sedang': 0, 'belum': 0}
    with pytest.raises(HTTPException) as e:
        _panggil(api.ringkasan_beranda, GURU('asing'))
    assert e.value.status_code == 403


def test_tugas_penilaian_saya(db):
    db['users'] = _Koleksi([
        {'id': 'g1', 'full_name': 'Budi', 'nip_nuptk': '111'},
        {'id': 'g2', 'full_name': 'Ani', 'nip_nuptk': '222'},
        {'id': 'g3', 'full_name': 'Citra', 'nip_nuptk': '333'},
    ])
    db['pkg_penugasan'].docs[0].update({
        'guru_dinilai_ids': ['g1', 'g2', 'g3', 'pen', 'g1'],  # diri sendiri & ganda diabaikan
        'snapshot_guru': {'g2': {'nama': 'Ani, S.Pd.', 'nip': '222-snap', 'mapel': 'IPA'}},
    })
    db['pkg_penilaian'] = _Koleksi([
        {'id': 'n1', 'sk_id': 'sk1', 'penilai_id': 'pen', 'guru_dinilai_id': 'g1', 'status': 'terkunci', 'progres': 40},
        {'id': 'n2', 'sk_id': 'sk1', 'penilai_id': 'pen', 'guru_dinilai_id': 'g2', 'status': 'draf', 'progres': 250},
        {'id': 'n3', 'sk_id': 'sk1', 'penilai_id': 'lain', 'guru_dinilai_id': 'g3', 'status': 'draf', 'progres': 50},
    ])
    tugas = _panggil(api.tugas_saya, GURU('pen'))
    assert [(t['id'], t['status'], t['progres']) for t in tugas] == [('g2', 'draf', 100), ('g3', 'belum', 0), ('g1', 'terkunci', 100)]
    ani = tugas[0]
    assert (ani['nama'], ani['nip'], ani['mapel'], ani['penilaian_id']) == ('Ani, S.Pd.', '222-snap', 'IPA', 'n2')
    assert (tugas[1]['nama'], tugas[1]['nip'], tugas[1]['penilaian_id']) == ('Citra', '333', None)

    assert _panggil(api.tugas_saya, GURU('gur')) == []  # hanya dinilai → tanpa tugas
    assert _panggil(api.beranda_pkg, GURU('pen'), None)['tugas'] == tugas
    with pytest.raises(HTTPException):
        _panggil(api.tugas_saya, GURU('asing'))


def test_menu_sesuai_akses(db):
    def akses(user):
        return {m['key']: m['alasan'] for m in _panggil(api.menu_beranda, user)}

    kepala = akses(KEPALA)
    assert len(kepala) == 9 and all(a is None for a in kepala.values())

    pen = akses(GURU('pen'))  # penilai tersupervisi
    assert pen['penilaian'] is None and pen['cetak'] is None and pen['rekap'] is None
    assert {pen[k] for k in ('periode', 'sk', 'penugasan', 'supervisi', 'audit')} == {'bukan_kepala'}

    rangkap = akses(GURU('rangkap'))  # penilai belum disupervisi
    assert rangkap['penilaian'] == 'belum_disupervisi' and rangkap['cetak'] is None

    gur = akses(GURU('gur'))  # hanya dinilai
    assert gur['penilaian'] == 'bukan_penilai' and gur['cetak'] == 'bukan_penilai'
    assert gur['instrumen'] is None and gur['rekap'] is None

    menu = _panggil(api.beranda_pkg, GURU('pen'), None)['menu']
    assert [m['key'] for m in menu][:2] == ['periode', 'sk'] and menu[0]['khusus'] == 'kepala' and menu[0]['akses'] is False
    with pytest.raises(HTTPException):
        _panggil(api.menu_beranda, GURU('asing'))


def test_pengingat_dan_notifikasi(db):
    from datetime import date
    db['users'] = _Koleksi([{'id': 'kep', 'roles': ['kepala_sekolah']}])
    db['pkg_penugasan'].docs[0]['guru_dinilai_ids'] = ['g1', 'g2']
    db['pkg_penugasan'].docs[1]['guru_dinilai_ids'] = ['g3']
    db['pkg_penilaian'] = _Koleksi([{'sk_id': 'sk1', 'penilai_id': 'pen', 'guru_dinilai_id': 'g1', 'status': 'terkunci'}])

    pen = _panggil(api.pengingat_beranda, GURU('pen'))
    assert [(p['jenis'], p['tanggal']) for p in pen] == [('tenggat', '2026-11-30')] and pen[0]['keterangan'].startswith('1 guru')
    rangkap = _panggil(api.pengingat_beranda, GURU('rangkap'))
    assert [p['jenis'] for p in rangkap] == ['supervisi', 'tenggat']
    assert _panggil(api.pengingat_beranda, GURU('gur')) == []  # hanya dinilai
    kep = _panggil(api.pengingat_beranda, KEPALA)
    assert [p['jenis'] for p in kep] == ['tenggat']

    ubah = pkg_beranda.pengingat_ke_notifikasi
    assert ubah(pen, date(2026, 11, 1)) == []  # di luar jendela 14 hari
    for hari_ini, keparahan in ((date(2026, 11, 20), 'info'), (date(2026, 11, 25), 'warning'), (date(2026, 11, 30), 'critical')):
        n = ubah(pen, hari_ini)
        assert len(n) == 1 and n[0]['severity'] == keparahan and n[0]['source'] == 'pkg' and n[0]['link'] == '/pkg'
    assert ubah(pen, date(2026, 12, 1)) == []  # sudah lewat
    supervisi = ubah(rangkap, date(2026, 10, 1))  # tanpa tanggal: selalu tampil
    assert [(n['source_id'], n['severity']) for n in supervisi] == [('supervisi_p1', 'warning')]

    assert asyncio.run(pkg_beranda.notifikasi_pkg(db, GURU('asing'))) == []
    assert 'pengingat' in _panggil(api.beranda_pkg, GURU('pen'), None)


def test_audit_beranda_harian(db):
    for _ in range(3):
        _panggil(api.beranda_pkg, GURU('pen'), None)
    for _ in range(2):
        with pytest.raises(HTTPException):
            _panggil(api.menu_beranda, GURU('asing'), jalur='/pkg/beranda/menu')
    log = db['pkg_audit_log'].docs
    buka = [d for d in log if d['aksi'] == 'buka_beranda']
    assert len(buka) == 1 and buka[0]['jumlah'] == 3 and buka[0]['aktor_id'] == 'pen'
    assert buka[0]['metadata'] == {'periode_id': 'p1'} and buka[0]['tanggal'] and buka[0]['terakhir']
    tolak = [d for d in log if d['aksi'] == 'tolak_akses']
    assert len(tolak) == 1 and tolak[0]['jumlah'] == 2
    assert tolak[0]['metadata'] == {'endpoint': '/pkg/beranda/menu', 'alasan': 'bukan_anggota_sk', 'syarat': 'anggota'}
    assert tolak[0]['ip_address'] == '10.0.0.1'


def test_penjaga_syarat_kepala(db):
    with pytest.raises(HTTPException) as e:
        _panggil(api.menu_beranda, GURU('pen'), syarat='kepala', jalur='/pkg/periode')
    assert e.value.detail['alasan'] == 'bukan_kepala'
    log = [d for d in db['pkg_audit_log'].docs if d['aksi'] == 'tolak_akses']
    assert log[0]['metadata']['endpoint'] == '/pkg/periode' and log[0]['kunci'] == '/pkg/periode:bukan_kepala'
    assert len(_panggil(api.menu_beranda, KEPALA, syarat='kepala')) == 9
    with pytest.raises(ValueError):
        pkg_penjaga.penjaga_pkg('salah')


async def test_audit_harian_mongodb(mongo_db):
    assert await pkg_audit.ensure_pkg_audit_indexes(mongo_db) == []
    for _ in range(2):
        await pkg_audit.catat_audit_pkg_harian(mongo_db, 'buka_beranda', GURU('pen'), metadata={'periode_id': 'p1'})
    await pkg_audit.catat_audit_pkg(mongo_db, 'simpan_draf', GURU('pen'), {'skor': 3}, penilaian_id='n1')
    docs = await mongo_db['pkg_audit_log'].find({}, {'_id': 0}).to_list(10)
    harian = [d for d in docs if d['aksi'] == 'buka_beranda']
    assert len(docs) == 2 and harian[0]['jumlah'] == 2 and harian[0]['id']
    assert next(d for d in docs if d['aksi'] == 'simpan_draf')['penilaian_id'] == 'n1'


def test_wajib_akses_per_syarat(db):
    def alasan(user, syarat):
        try:
            asyncio.run(pkg_akses.wajib_akses(db, user, syarat))
            return None
        except HTTPException as e:
            assert e.status_code == 403
            return e.detail['alasan']

    tabel = {  # pengguna: (anggota, kepala, pengelola, penilai)
        'kep': (None, None, None, None),
        'pen': (None, 'bukan_kepala', None, None),
        'rangkap': (None, 'bukan_kepala', None, 'belum_disupervisi'),
        'gur': (None, 'bukan_kepala', 'bukan_penilai', 'bukan_penilai'),
        'asing': ('bukan_anggota_sk',) * 4,
    }
    for uid, harapan in tabel.items():
        user = KEPALA if uid == 'kep' else GURU(uid)
        assert tuple(alasan(user, s) for s in pkg_akses.SYARAT_AKSES) == harapan, uid
    with pytest.raises(ValueError):
        pkg_akses.alasan_tolak({'anggota': True}, 'tidak-ada')


def test_dalam_masa_penilaian():
    p = {'tanggal_buka': '2026-10-01', 'tanggal_tutup': '2026-11-30'}
    assert pkg_akses.dalam_masa_penilaian(p, '2026-10-01') and pkg_akses.dalam_masa_penilaian(p, '2026-11-30')
    assert not pkg_akses.dalam_masa_penilaian(p, '2026-09-30') and not pkg_akses.dalam_masa_penilaian(p, '2026-12-01')
    assert not pkg_akses.dalam_masa_penilaian(None) and not pkg_akses.dalam_masa_penilaian({'tanggal_buka': '2026-10-01'})


def test_dependency_lewat_fastapi(db):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from core import get_current_user

    app = FastAPI()
    app.include_router(api.router, prefix='/api')
    pengguna = {'user': GURU('asing')}
    app.dependency_overrides[get_current_user] = lambda: pengguna['user']
    klien = TestClient(app)

    r = klien.get('/api/pkg/beranda/menu')
    assert r.status_code == 403
    assert r.json()['detail'] == {'alasan': 'bukan_anggota_sk', 'pesan': pkg_akses.PESAN_TOLAK['bukan_anggota_sk']}
    log = [d for d in db['pkg_audit_log'].docs if d['aksi'] == 'tolak_akses']
    assert log[0]['metadata']['endpoint'] == '/api/pkg/beranda/menu'

    pengguna['user'] = GURU('pen')
    r = klien.get('/api/pkg/beranda/menu')
    assert r.status_code == 200 and len(r.json()) == 9
    assert klien.get('/api/pkg/sk/my-membership').json()['peran'] == 'penilai'
