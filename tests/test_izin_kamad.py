"""Izin Kamad: koleksi izin_kamad terpisah dari gtk_izin, index migrasi, bentuk data untuk klien."""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import izin_kamad as ik  # noqa: E402
import migrasi_otomatis  # noqa: E402
from migrations.migrate_izin_kamad import migrate  # noqa: E402


class _Hasil:
    def __init__(self, n=0):
        self.modified_count = n


class _Koleksi:
    def __init__(self, docs=()):
        self.docs = [dict(d) for d in docs]
        self.indexes = []

    async def create_index(self, keys, **opsi):
        if (keys, opsi) not in self.indexes:
            self.indexes.append((keys, opsi))

    async def update_many(self, q, ubah):
        n = 0
        for d in self.docs:
            if all(('$exists' in v and (k in d) == v['$exists']) for k, v in q.items()):
                d.update(ubah['$set'])
                n += 1
        return _Hasil(n)

    async def count_documents(self, _q):
        return len(self.docs)


def _db(izin=()):
    return {ik.KOLEKSI_IZIN: _Koleksi(izin), ik.KOLEKSI_CATATAN: _Koleksi()}


def test_koleksi_terpisah_dari_gtk_izin():
    assert ik.KOLEKSI_IZIN == 'izin_kamad'
    assert 'gtk_izin' not in (ik.KOLEKSI_IZIN, ik.KOLEKSI_CATATAN)
    assert set(ik.STATUS_IZIN) == {'menunggu', 'disetujui', 'ditolak', 'dibatalkan'}


def test_migrasi_membuat_index_dan_idempoten():
    db = _db([{'id': 'a'}, {'id': 'b', 'status': 'disetujui'}])
    hasil = asyncio.run(migrate(db))
    assert hasil == {'izin': 2, 'catatan': 0, 'status_dilengkapi': 1}
    assert db[ik.KOLEKSI_IZIN].docs[0]['status'] == 'menunggu'
    assert db[ik.KOLEKSI_IZIN].docs[1]['status'] == 'disetujui'
    assert ([('id', 1)], {'unique': True}) in db[ik.KOLEKSI_IZIN].indexes
    assert ([('status', 1), ('tanggal', 1), ('jam_mulai', 1)], {}) in db[ik.KOLEKSI_IZIN].indexes
    assert ([('status', 1), ('diputuskan_pada', -1)], {}) in db[ik.KOLEKSI_IZIN].indexes
    assert ([('izin_id', 1), ('dibuat_pada', 1)], {}) in db[ik.KOLEKSI_CATATAN].indexes
    # Dijalankan ulang: tidak ada perubahan / index ganda.
    jumlah_index = len(db[ik.KOLEKSI_IZIN].indexes)
    assert asyncio.run(migrate(db))['status_dilengkapi'] == 0
    assert len(db[ik.KOLEKSI_IZIN].indexes) == jumlah_index


def test_migrasi_terdaftar_otomatis():
    assert '2026-11-12_izin_kamad' in [nama for nama, _ in migrasi_otomatis.MIGRASI]


def test_ringkas_izin_tanpa_id_mongo_dan_pemutus():
    doc = {'_id': 'oid', 'id': 'i1', 'pengaju_id': 'u1', 'pengaju_nama': 'A', 'pengaju_peran': 'guru', 'keperluan': 'x',
           'tanggal': '2026-11-12', 'jam_mulai': '08:00', 'jam_selesai': '09:00', 'status': 'disetujui',
           'diputuskan_oleh': 'k1', 'diputuskan_oleh_nama': 'Kamad', 'diputuskan_pada': 't', 'dibuat_pada': 't0'}
    r = ik.ringkas_izin(doc)
    assert '_id' not in r and 'diputuskan_oleh' not in r
    assert r['diputuskan_oleh_nama'] == 'Kamad' and r['alasan_penolakan'] is None


def test_hari_ini_wib_format():
    t = ik.hari_ini_wib()
    assert len(t) == 10 and t[4] == '-' and t[7] == '-'


# ---- API ringkasan dashboard satpam ----
import pytest  # noqa: E402
from fastapi import HTTPException  # noqa: E402

from core import require_role  # noqa: E402
from routers import izin_kamad as api  # noqa: E402


class _Cursor:
    def __init__(self, docs):
        self.docs = docs

    def sort(self, kunci, arah=1):
        urutan = kunci if isinstance(kunci, list) else [(kunci, arah)]
        for k, a in reversed(urutan):  # sort stabil: kunci terakhir dulu
            self.docs = sorted(self.docs, key=lambda d: d.get(k) or '', reverse=a == -1)
        return self

    async def to_list(self, n):
        return [dict(d) for d in self.docs[:n]]


class _KoleksiApi:
    def __init__(self, docs=()):
        self.docs = [dict(d) for d in docs]

    def _cocok(self, q):
        def sama(d, k, v):
            if isinstance(v, dict) and '$in' in v:
                return d.get(k) in v['$in']
            return d.get(k) == v
        return [d for d in self.docs if all(sama(d, k, v) for k, v in q.items())]

    def find(self, q, _proyeksi=None):
        return _Cursor(self._cocok(q))

    async def count_documents(self, q):
        return len(self._cocok(q))

    async def find_one(self, q, _proyeksi=None):
        hasil = self._cocok(q)
        return dict(hasil[0]) if hasil else None

    async def insert_one(self, doc):
        self.docs.append(dict(doc))

    async def update_one(self, q, ubah):
        cocok = self._cocok(q)
        if cocok:
            cocok[0].update(ubah['$set'])
        return _Hasil(len(cocok[:1]))


def _izin(i, pengaju, status, tanggal, mulai, selesai):
    return {'id': i, 'pengaju_id': pengaju, 'status': status, 'tanggal': tanggal, 'jam_mulai': mulai, 'jam_selesai': selesai}


@pytest.fixture
def db_api(monkeypatch):
    t = '2026-11-12'
    d = {ik.KOLEKSI_IZIN: _KoleksiApi([
        _izin('a', 'g1', 'disetujui', t, '07:00', '08:00'),     # selesai pukul 10.00
        _izin('b', 'g2', 'disetujui', t, '09:30', '11:00'),     # sedang izin
        _izin('c', 'g3', 'disetujui', t, '13:00', '14:00'),     # belum mulai
        _izin('d', 'g4', 'menunggu', t, '10:00', '11:00'),      # belum disetujui: tidak di papan
        _izin('e', 'g5', 'disetujui', '2026-11-13', '10:00', '11:00'),  # besok
        _izin('f', 's1', 'menunggu', '2026-11-14', '08:00', '09:00'),   # pengajuan satpam sendiri
        _izin('g', 's1', 'ditolak', '2026-11-10', '08:00', '09:00'),
    ])}
    d[ik.KOLEKSI_CATATAN] = _KoleksiApi()
    monkeypatch.setattr(api, 'db', d)
    monkeypatch.setattr(api, 'hari_ini_wib', lambda: t)

    async def _tanpa_audit(*_a, **_k):
        return None
    monkeypatch.setattr(api, 'log_audit', _tanpa_audit)
    monkeypatch.setattr(api, 'jam_wib', lambda: '10:00')
    return d


def _satpam(uid='s1'):
    return {'id': uid, 'active_role': 'satpam', 'roles': ['satpam'], 'full_name': 'Pak Satpam'}


def test_ringkasan_satpam_menurut_jam_server(db_api):
    r = asyncio.run(api.ringkasan_satpam(_satpam()))
    assert r == {'tanggal': '2026-11-12', 'jam': '10:00', 'izin_hari_ini': 3, 'berlangsung': 1, 'akan_datang': 1,
                 'selesai': 1, 'saya_menunggu': 1}


def test_waktu_izin_batas_jam():
    izin = {'jam_mulai': '09:00', 'jam_selesai': '10:00'}
    assert ik.waktu_izin(izin, '08:59') == 'akan_datang'
    assert ik.waktu_izin(izin, '09:00') == 'berlangsung'
    assert ik.waktu_izin(izin, '10:00') == 'selesai'


def test_ringkasan_satpam_hanya_satpam_dan_admin():
    cek = require_role(*ik.PERAN_DASHBOARD_SATPAM)
    assert asyncio.run(cek(_satpam()))['id'] == 's1'
    assert asyncio.run(cek({'id': 'a', 'active_role': 'admin', 'roles': ['admin']}))
    for peran in ('guru', 'kepala_tata_usaha', 'siswa'):
        with pytest.raises(HTTPException) as e:
            asyncio.run(cek({'id': 'x', 'active_role': peran, 'roles': [peran]}))
        assert e.value.status_code == 403


def test_rute_ringkasan_terdaftar():
    assert '/izin-kamad/ringkasan-satpam' in [r.path for r in api.router.routes]


def test_papan_hari_ini_hanya_disetujui_hari_ini_urut_jam(db_api):
    db_api[ik.KOLEKSI_IZIN].docs[0].update({'pengaju_nama': 'Zaenal', '_id': 'oid'})
    db_api[ik.KOLEKSI_IZIN].docs[1].update({'pengaju_nama': 'Budi'})
    r = asyncio.run(api.papan_hari_ini(_satpam()))
    assert r['tanggal'] == '2026-11-12'
    assert [i['id'] for i in r['items']] == ['a', 'b', 'c']
    assert all(i['status'] == 'disetujui' and i['tanggal'] == '2026-11-12' for i in r['items'])
    assert '_id' not in r['items'][0] and 'diputuskan_oleh' not in r['items'][0]


def test_papan_hari_ini_peran_berhak():
    cek = require_role(*ik.PERAN_PAPAN_IZIN)
    for peran in ('satpam', 'kepala_tata_usaha', 'kepala_sekolah', 'admin'):
        assert asyncio.run(cek({'id': 'x', 'active_role': peran, 'roles': [peran]}))
    for peran in ('guru', 'tenaga_kependidikan', 'siswa', 'waka_kurikulum'):
        with pytest.raises(HTTPException) as e:
            asyncio.run(cek({'id': 'x', 'active_role': peran, 'roles': [peran]}))
        assert e.value.status_code == 403


def test_pengajuan_saya_hanya_milik_sendiri_terbaru_dulu(db_api):
    koll = db_api[ik.KOLEKSI_IZIN]
    koll.docs[5]['dibuat_pada'] = '2026-11-12T07:00:00+07:00'  # f (menunggu)
    koll.docs[6]['dibuat_pada'] = '2026-11-09T07:00:00+07:00'  # g (ditolak)
    koll.docs[6]['alasan_penolakan'] = 'Bentrok kegiatan'
    r = asyncio.run(api.pengajuan_saya(_satpam('s1')))
    assert [i['id'] for i in r['items']] == ['f', 'g']
    assert r['items'][1]['alasan_penolakan'] == 'Bentrok kegiatan'
    assert asyncio.run(api.pengajuan_saya(_satpam('orang-lain'))) == {'items': []}


def test_pengajuan_saya_peran_pengaju():
    cek = require_role(*ik.PERAN_PENGAJU_IZIN)
    for peran in ('satpam', 'kepala_tata_usaha', 'guru', 'guru_ipa', 'tenaga_kependidikan'):
        assert asyncio.run(cek({'id': 'x', 'active_role': peran, 'roles': [peran]}))
    for peran in ('siswa', 'kepala_sekolah', 'unit_kesehatan'):
        with pytest.raises(HTTPException):
            asyncio.run(cek({'id': 'x', 'active_role': peran, 'roles': [peran]}))


def _pengguna(uid, peran):
    return {'id': uid, 'active_role': peran, 'roles': [peran]}


def test_detail_izin_hak_baca(db_api):
    # 'b' disetujui milik g2; 'd' menunggu milik g4.
    assert asyncio.run(api.detail_izin('b', _satpam()))['id'] == 'b'
    assert asyncio.run(api.detail_izin('b', _pengguna('k', 'kepala_tata_usaha')))['status'] == 'disetujui'
    assert asyncio.run(api.detail_izin('d', _pengguna('g4', 'guru')))['id'] == 'd'          # milik sendiri
    assert asyncio.run(api.detail_izin('d', _pengguna('km', 'kepala_sekolah')))['id'] == 'd'  # pemutus
    assert asyncio.run(api.detail_izin('d', _pengguna('ad', 'admin')))['id'] == 'd'
    for user in (_satpam(), _pengguna('k', 'kepala_tata_usaha'), _pengguna('g9', 'guru')):
        with pytest.raises(HTTPException) as e:
            asyncio.run(api.detail_izin('d', user))  # belum disetujui & bukan miliknya
        assert e.value.status_code == 403
    with pytest.raises(HTTPException) as e:
        asyncio.run(api.detail_izin('b', _pengguna('g9', 'guru')))  # guru lain bukan pembaca papan
    assert e.value.status_code == 403
    with pytest.raises(HTTPException) as e:
        asyncio.run(api.detail_izin('tidak-ada', _satpam()))
    assert e.value.status_code == 404


def test_rute_statis_sebelum_rute_detail():
    paths = [r.path for r in api.router.routes]
    detail = paths.index('/izin-kamad/{izin_id}')
    assert all(paths.index(p) < detail for p in paths if p.startswith('/izin-kamad/') and '{' not in p)


def test_catatan_satpam_ditulis_pada_izin_disetujui(db_api):
    r = asyncio.run(api.tulis_catatan('b', ik.CatatanIn(isi='  Keluar 09.35 dijemput keluarga  '), None, _satpam()))
    assert r['izin_id'] == 'b' and r['isi'] == 'Keluar 09.35 dijemput keluarga' and r['penulis_nama'] == 'Pak Satpam'
    tersimpan = db_api[ik.KOLEKSI_CATATAN].docs
    assert len(tersimpan) == 1 and tersimpan[0]['penulis_id'] == 's1'


def test_catatan_ditolak_bila_tidak_sah(db_api):
    kasus = (('b', 'ok', 400), ('b', 'x' * 501, 400), ('d', 'Catatan valid', 400), ('zz', 'Catatan valid', 404))
    for izin_id, isi, kode in kasus:
        with pytest.raises(HTTPException) as e:
            asyncio.run(api.tulis_catatan(izin_id, ik.CatatanIn(isi=isi), None, _satpam()))
        assert e.value.status_code == kode, (izin_id, isi)
    assert db_api[ik.KOLEKSI_CATATAN].docs == []


def test_catatan_hanya_dibaca_kamad_dan_ktu(db_api):
    asyncio.run(api.tulis_catatan('b', ik.CatatanIn(isi='Catatan pertama'), None, _satpam()))
    r = asyncio.run(api.daftar_catatan('b', _pengguna('k', 'kepala_tata_usaha')))
    assert [c['isi'] for c in r['items']] == ['Catatan pertama'] and 'penulis_id' not in r['items'][0]
    baca = require_role(*ik.PERAN_PEMBACA_CATATAN)
    for peran in ('kepala_sekolah', 'kepala_tata_usaha', 'admin'):
        assert asyncio.run(baca(_pengguna('x', peran)))
    for peran in ('satpam', 'guru', 'tenaga_kependidikan', 'waka_kurikulum'):
        with pytest.raises(HTTPException) as e:
            asyncio.run(baca(_pengguna('x', peran)))
        assert e.value.status_code == 403
    tulis = require_role(*ik.PERAN_PENULIS_CATATAN)
    for peran in ('guru', 'kepala_tata_usaha'):
        with pytest.raises(HTTPException):
            asyncio.run(tulis(_pengguna('x', peran)))


def test_papan_dan_detail_tidak_memuat_catatan(db_api):
    asyncio.run(api.tulis_catatan('b', ik.CatatanIn(isi='Rahasia satpam'), None, _satpam()))
    papan = asyncio.run(api.papan_hari_ini(_satpam()))
    detail = asyncio.run(api.detail_izin('b', _satpam()))
    assert 'Rahasia' not in str(papan) and 'catatan' not in detail


# ---- Penjagaan akses semua rute izin-kamad ----
def _penjaga(route):
    """Dependency auth rute: checker require_role atau get_current_user."""
    return [d.call for d in route.dependant.dependencies if d.call.__name__ in ('checker', 'get_current_user')]


def test_semua_rute_izin_kamad_wajib_login():
    for route in api.router.routes:
        assert _penjaga(route), f'{route.path} tanpa penjagaan peran/login'


MATRIKS_AKSES = {
    ('GET', '/izin-kamad/ringkasan-satpam'): {'satpam'},
    ('GET', '/izin-kamad/papan-hari-ini'): {'satpam', 'kepala_tata_usaha', 'kepala_sekolah'},
    ('GET', '/izin-kamad/saya'): {'satpam', 'kepala_tata_usaha', 'guru', 'guru_ipa', 'tenaga_kependidikan'},
    ('POST', '/izin-kamad'): {'satpam', 'kepala_tata_usaha', 'guru', 'guru_ipa', 'tenaga_kependidikan'},
    ('POST', '/izin-kamad/{izin_id}/batalkan'): {'satpam', 'kepala_tata_usaha', 'guru', 'guru_ipa', 'tenaga_kependidikan'},
    ('POST', '/izin-kamad/{izin_id}/catatan'): {'satpam'},
    ('GET', '/izin-kamad/menunggu'): {'kepala_sekolah'},
    ('POST', '/izin-kamad/{izin_id}/setujui'): {'kepala_sekolah'},
    ('POST', '/izin-kamad/{izin_id}/tolak'): {'kepala_sekolah'},
    ('GET', '/izin-kamad/riwayat-keputusan'): {'kepala_sekolah'},
    ('GET', '/izin-kamad/{izin_id}/catatan'): {'kepala_sekolah', 'kepala_tata_usaha'},
}
PERAN_UJI = ('satpam', 'kepala_tata_usaha', 'kepala_sekolah', 'guru', 'guru_ipa', 'tenaga_kependidikan', 'siswa',
             'wali_kelas', 'waka_kurikulum', 'unit_kesehatan', 'orang_tua')


def test_matriks_akses_peran_per_rute():
    rute = {(m, r.path): r for r in api.router.routes for m in r.methods}
    for kunci, boleh in MATRIKS_AKSES.items():
        (cek,) = _penjaga(rute[kunci])
        assert cek.__name__ == 'checker', kunci
        for peran in PERAN_UJI:
            user = {'id': 'x', 'active_role': peran, 'roles': [peran]}
            if peran in boleh:
                assert asyncio.run(cek(user)), (kunci, peran)
            else:
                with pytest.raises(HTTPException) as e:
                    asyncio.run(cek(user))
                assert e.value.status_code == 403, (kunci, peran)
        # Admin selalu boleh (pola require_role); peran aktif lain milik admin tetap lolos.
        assert asyncio.run(cek({'id': 'a', 'active_role': 'guru', 'roles': ['admin', 'guru']}))
    # Detail memakai get_current_user + aturan baca per izin (diuji di test_detail_izin_hak_baca).
    assert [c.__name__ for c in _penjaga(rute[('GET', '/izin-kamad/{izin_id}')])] == ['get_current_user']


def test_peran_aktif_menentukan_bukan_peran_lain():
    """Satpam yang sedang memakai peran lain (mis. tendik) tidak membuka endpoint khusus satpam."""
    cek = require_role(*ik.PERAN_DASHBOARD_SATPAM)
    with pytest.raises(HTTPException):
        asyncio.run(cek({'id': 's', 'active_role': 'tenaga_kependidikan', 'roles': ['satpam', 'tenaga_kependidikan']}))


# ---- Skema pengajuan izin ----
def test_skema_pengajuan_sah_dan_dokumen_baru():
    isi = ik.IzinPengajuanIn(keperluan='  Mengurus berkas  ', tanggal='2026-11-13', jam_mulai='08:00', jam_selesai='10:00')
    assert isi.keperluan == 'Mengurus berkas'
    user = {'id': 'g1', 'full_name': 'Bu Guru', 'active_role': 'guru'}
    doc = ik.dokumen_izin_baru(user, isi)
    assert doc['status'] == 'menunggu' and doc['pengaju_id'] == 'g1' and doc['pengaju_peran'] == 'guru'
    assert doc['diputuskan_oleh'] is None and doc['dibuat_pada'] == doc['diperbarui_pada']
    assert set(ik.FIELD_IZIN) <= set(doc)


@pytest.mark.parametrize('ubah', [
    {'keperluan': '   '}, {'keperluan': 'x' * 301}, {'tanggal': '13-11-2026'}, {'tanggal': '2026-02-30'},
    {'jam_mulai': '8:00'}, {'jam_selesai': '24:00'}, {'jam_mulai': '08:60'},
])
def test_skema_pengajuan_menolak_format_salah(ubah):
    from pydantic import ValidationError
    data = {'keperluan': 'Keperluan', 'tanggal': '2026-11-13', 'jam_mulai': '08:00', 'jam_selesai': '10:00', **ubah}
    with pytest.raises(ValidationError):
        ik.IzinPengajuanIn(**data)


# ---- POST /izin-kamad (pengajuan) ----
def _isi(**ubah):
    return ik.IzinPengajuanIn(**{'keperluan': 'Mengurus SIM', 'tanggal': '2026-11-14', 'jam_mulai': '08:00',
                                 'jam_selesai': '10:00', **ubah})


def test_ajukan_izin_tersimpan_menunggu_dan_muncul_di_saya(db_api):
    r = asyncio.run(api.ajukan_izin(_isi(), None, _satpam('s9')))
    assert r['status'] == 'menunggu' and r['pengaju_id'] == 's9' and r['pengaju_nama'] == 'Pak Satpam'
    assert r['pengaju_peran'] == 'satpam' and '_id' not in r
    saya = asyncio.run(api.pengajuan_saya(_satpam('s9')))
    assert [i['id'] for i in saya['items']] == [r['id']]


@pytest.mark.parametrize('ubah, pesan', [
    ({'tanggal': '2026-11-11'}, 'hari ini atau ke depan'),
    ({'jam_mulai': '10:00', 'jam_selesai': '09:00'}, 'setelah jam mulai'),
    ({'jam_mulai': '10:00', 'jam_selesai': '10:10'}, 'minimal 15 menit'),
    ({'tanggal': '2026-11-12', 'jam_mulai': '08:00', 'jam_selesai': '09:30'}, 'sudah lewat'),
])
def test_ajukan_izin_waktu_tidak_sah(db_api, ubah, pesan):
    with pytest.raises(HTTPException) as e:
        asyncio.run(api.ajukan_izin(_isi(**ubah), None, _satpam('s9')))
    assert e.value.status_code == 400 and pesan in e.value.detail


def test_ajukan_izin_hari_ini_yang_belum_berakhir_boleh(db_api):
    r = asyncio.run(api.ajukan_izin(_isi(tanggal='2026-11-12', jam_mulai='09:00', jam_selesai='11:00'), None, _satpam('s9')))
    assert r['tanggal'] == '2026-11-12'


def test_ajukan_izin_menolak_jam_bertumpuk_dengan_izin_aktif_sendiri(db_api):
    asyncio.run(api.ajukan_izin(_isi(), None, _satpam('s9')))
    with pytest.raises(HTTPException) as e:
        asyncio.run(api.ajukan_izin(_isi(jam_mulai='09:30', jam_selesai='11:00'), None, _satpam('s9')))
    assert e.value.status_code == 409
    # Bersambung (tidak beririsan) dan milik orang lain tetap boleh.
    assert asyncio.run(api.ajukan_izin(_isi(jam_mulai='10:00', jam_selesai='11:00'), None, _satpam('s9')))
    assert asyncio.run(api.ajukan_izin(_isi(), None, _satpam('s8')))
    # Izin yang dibatalkan tidak menghalangi.
    db_api[ik.KOLEKSI_IZIN].docs[-1]['status'] = 'dibatalkan'
    assert asyncio.run(api.ajukan_izin(_isi(), None, _satpam('s8')))


def test_jam_bertumpuk():
    a = {'tanggal': 't', 'jam_mulai': '08:00', 'jam_selesai': '10:00'}
    assert ik.jam_bertumpuk(a, {'tanggal': 't', 'jam_mulai': '09:59', 'jam_selesai': '11:00'})
    assert not ik.jam_bertumpuk(a, {'tanggal': 't', 'jam_mulai': '10:00', 'jam_selesai': '11:00'})
    assert not ik.jam_bertumpuk(a, {'tanggal': 'u', 'jam_mulai': '08:00', 'jam_selesai': '10:00'})


# ---- POST /izin-kamad/{id}/batalkan ----
def test_batalkan_izin_milik_sendiri_yang_menunggu(db_api):
    r = asyncio.run(api.batalkan_izin('f', None, _satpam('s1')))  # 'f' menunggu milik s1
    assert r['status'] == 'dibatalkan'
    tersimpan = next(d for d in db_api[ik.KOLEKSI_IZIN].docs if d['id'] == 'f')
    assert tersimpan['status'] == 'dibatalkan' and tersimpan['dibatalkan_pada']


def test_batalkan_izin_ditolak_bila_bukan_milik_atau_sudah_diputuskan(db_api):
    kasus = (('f', _satpam('orang-lain'), 403), ('g', _satpam('s1'), 400), ('zz', _satpam('s1'), 404),
             ('d', _pengguna('km', 'kepala_sekolah'), 403))
    for izin_id, user, kode in kasus:
        with pytest.raises(HTTPException) as e:
            asyncio.run(api.batalkan_izin(izin_id, None, user))
        assert e.value.status_code == kode, (izin_id, kode)
    assert next(d for d in db_api[ik.KOLEKSI_IZIN].docs if d['id'] == 'g')['status'] == 'ditolak'


def test_batalkan_izin_kalah_balapan_dengan_keputusan_kamad(db_api, monkeypatch):
    """Status berubah antara dibaca dan diperbarui -> 409, tidak menimpa keputusan."""
    koll = db_api[ik.KOLEKSI_IZIN]
    asli = koll.find_one

    async def baca_lalu_diputuskan(q, p=None):
        doc = await asli(q, p)
        next(d for d in koll.docs if d['id'] == 'f')['status'] = 'disetujui'
        return doc
    monkeypatch.setattr(koll, 'find_one', baca_lalu_diputuskan)
    with pytest.raises(HTTPException) as e:
        asyncio.run(api.batalkan_izin('f', None, _satpam('s1')))
    assert e.value.status_code == 409
    assert next(d for d in koll.docs if d['id'] == 'f')['status'] == 'disetujui'


def test_setiap_rute_izin_kamad_punya_aturan_akses_teruji():
    """Rute baru wajib ditambahkan ke MATRIKS_AKSES (atau berupa detail ber-aturan baca sendiri)."""
    terdaftar = {(m, r.path) for r in api.router.routes for m in r.methods}
    dikecualikan = {('GET', '/izin-kamad/{izin_id}')}  # get_current_user + boleh_lihat_izin
    assert terdaftar - dikecualikan == set(MATRIKS_AKSES), terdaftar ^ (set(MATRIKS_AKSES) | dikecualikan)


def test_penjaga_pemutus_izin_hanya_kepala_madrasah():
    assert ik.PERAN_PEMUTUS_IZIN == ('kepala_sekolah',)
    for peran in ('kepala_sekolah', 'admin'):
        assert asyncio.run(api.wajib_pemutus_izin(_pengguna('x', peran)))
    for peran in ('kepala_tata_usaha', 'satpam', 'guru', 'tenaga_kependidikan', 'waka_kurikulum', 'penjamin_mutu'):
        with pytest.raises(HTTPException) as e:
            asyncio.run(api.wajib_pemutus_izin(_pengguna('x', peran)))
        assert e.value.status_code == 403


def test_daftar_menunggu_semua_pengaju_urut_terdekat(db_api):
    koll = db_api[ik.KOLEKSI_IZIN]
    koll.docs.append(_izin('h', 'g7', 'menunggu', '2026-11-12', '13:00', '14:00'))
    koll.docs.append(_izin('i', 'g8', 'menunggu', '2026-11-12', '07:30', '08:00'))  # waktunya sudah lewat
    r = asyncio.run(api.daftar_menunggu(_pengguna('km', 'kepala_sekolah')))
    assert [i['id'] for i in r['items']] == ['i', 'd', 'h', 'f']
    assert all(i['status'] == 'menunggu' for i in r['items'])


# ---- POST /izin-kamad/{id}/setujui ----
def _kamad():
    return {'id': 'km', 'active_role': 'kepala_sekolah', 'roles': ['kepala_sekolah'], 'full_name': 'H. Kamad'}


def test_setujui_izin_menunggu_masuk_papan_hari_ini(db_api):
    r = asyncio.run(api.setujui_izin('d', None, _kamad()))  # 'd' menunggu, tanggal hari ini 10:00-11:00
    assert r['status'] == 'disetujui' and r['diputuskan_oleh_nama'] == 'H. Kamad' and r['diputuskan_pada']
    assert 'diputuskan_oleh' not in r
    tersimpan = next(x for x in db_api[ik.KOLEKSI_IZIN].docs if x['id'] == 'd')
    assert tersimpan['diputuskan_oleh'] == 'km'
    papan = asyncio.run(api.papan_hari_ini(_satpam()))
    assert 'd' in [i['id'] for i in papan['items']]
    assert 'd' not in [i['id'] for i in asyncio.run(api.daftar_menunggu(_kamad()))['items']]


def test_setujui_izin_yang_sudah_diputuskan_atau_tidak_ada(db_api):
    for izin_id, kode in (('a', 409), ('g', 409), ('zz', 404)):
        with pytest.raises(HTTPException) as e:
            asyncio.run(api.setujui_izin(izin_id, None, _kamad()))
        assert e.value.status_code == kode, izin_id


def test_setujui_kalah_balapan_dengan_pembatalan(db_api, monkeypatch):
    koll = db_api[ik.KOLEKSI_IZIN]
    asli = koll.find_one

    async def baca_lalu_dibatalkan(q, p=None):
        doc = await asli(q, p)
        next(x for x in koll.docs if x['id'] == 'f')['status'] = 'dibatalkan'
        return doc
    monkeypatch.setattr(koll, 'find_one', baca_lalu_dibatalkan)
    with pytest.raises(HTTPException) as e:
        asyncio.run(api.setujui_izin('f', None, _kamad()))
    assert e.value.status_code == 409
    assert next(x for x in koll.docs if x['id'] == 'f')['status'] == 'dibatalkan'


# ---- POST /izin-kamad/{id}/tolak ----
def test_tolak_izin_dengan_alasan_terlihat_pengaju(db_api):
    r = asyncio.run(api.tolak_izin('f', ik.TolakIn(alasan='  Bertepatan rapat dinas  '), None, _kamad()))
    assert r['status'] == 'ditolak' and r['alasan_penolakan'] == 'Bertepatan rapat dinas'
    saya = asyncio.run(api.pengajuan_saya(_satpam('s1')))
    f = next(i for i in saya['items'] if i['id'] == 'f')
    assert f['status'] == 'ditolak' and f['alasan_penolakan'] == 'Bertepatan rapat dinas'


@pytest.mark.parametrize('alasan', ['', '    ', 'abc', 'x' * 301])
def test_tolak_izin_alasan_wajib_dan_dibatasi(alasan):
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        ik.TolakIn(alasan=alasan)


def test_tolak_izin_yang_sudah_diputuskan(db_api):
    with pytest.raises(HTTPException) as e:
        asyncio.run(api.tolak_izin('a', ik.TolakIn(alasan='Alasan cukup'), None, _kamad()))
    assert e.value.status_code == 409
    assert next(x for x in db_api[ik.KOLEKSI_IZIN].docs if x['id'] == 'a')['status'] == 'disetujui'


# ---- GET /izin-kamad/riwayat-keputusan ----
def test_riwayat_keputusan_hanya_diputuskan_terbaru_dulu(db_api):
    asyncio.run(api.setujui_izin('d', None, _kamad()))
    asyncio.run(api.tolak_izin('f', ik.TolakIn(alasan='Bentrok kegiatan'), None, _kamad()))
    koll = db_api[ik.KOLEKSI_IZIN]
    next(x for x in koll.docs if x['id'] == 'd')['diputuskan_pada'] = '2026-11-12T10:00:00+07:00'
    next(x for x in koll.docs if x['id'] == 'f')['diputuskan_pada'] = '2026-11-12T10:00:01+07:00'
    for x in koll.docs:  # keputusan lama tanpa waktu di data uji: beri waktu lampau
        if x['status'] in ('disetujui', 'ditolak') and not x.get('diputuskan_pada'):
            x['diputuskan_pada'] = '2026-11-01T08:00:00+07:00'
    r = asyncio.run(api.riwayat_keputusan(_kamad()))
    ids = [i['id'] for i in r['items']]
    assert set(ids) == {x['id'] for x in koll.docs if x['status'] in ('disetujui', 'ditolak')}
    assert ids[:2] == ['f', 'd']  # tolak 'f' diputuskan paling akhir
    assert next(i for i in r['items'] if i['id'] == 'f')['alasan_penolakan'] == 'Bentrok kegiatan'
    assert all(i['status'] in ('disetujui', 'ditolak') for i in r['items'])


def test_query_disetujui_pada_satu_sumber_papan_dan_ringkasan(db_api):
    assert ik.query_disetujui_pada('2026-11-12') == {'status': 'disetujui', 'tanggal': '2026-11-12'}
    items = asyncio.run(ik.izin_disetujui_pada(db_api, '2026-11-12'))
    assert [i['id'] for i in items] == ['a', 'b', 'c']
    papan = asyncio.run(api.papan_hari_ini(_satpam()))
    ringkasan = asyncio.run(api.ringkasan_satpam(_satpam()))
    assert papan['items'] == items and ringkasan['izin_hari_ini'] == len(items)
    assert asyncio.run(ik.izin_disetujui_pada(db_api, '2026-11-13'))[0]['id'] == 'e'


# ---- Filter tanggal WIB & otorisasi tingkat HTTP ----
@pytest.mark.parametrize('utc, tanggal, jam', [
    ('2026-11-11T23:30:00', '2026-11-12', '06:30'),  # pagi WIB masih "kemarin" menurut UTC
    ('2026-11-12T16:59:00', '2026-11-12', '23:59'),
    ('2026-11-12T17:00:00', '2026-11-13', '00:00'),  # tengah malam WIB
])
def test_tanggal_dan_jam_menurut_wib_bukan_utc(utc, tanggal, jam):
    from datetime import datetime, timezone
    t = datetime.fromisoformat(utc).replace(tzinfo=timezone.utc)
    assert ik.hari_ini_wib(t) == tanggal and ik.jam_wib(t) == jam


def test_papan_pagi_hari_memakai_tanggal_wib(db_api, monkeypatch):
    """Pukul 06.30 WIB (23.30 UTC kemarin) papan menampilkan izin tanggal WIB hari ini, bukan kemarin."""
    from datetime import datetime, timezone
    pagi = datetime(2026, 11, 11, 23, 30, tzinfo=timezone.utc)
    monkeypatch.setattr(api, 'hari_ini_wib', lambda: ik.hari_ini_wib(pagi))
    db_api[ik.KOLEKSI_IZIN].docs.append(_izin('kmrn', 'g9', 'disetujui', '2026-11-11', '08:00', '09:00'))
    r = asyncio.run(api.papan_hari_ini(_satpam()))
    assert r['tanggal'] == '2026-11-12'
    assert 'kmrn' not in [i['id'] for i in r['items']] and [i['id'] for i in r['items']] == ['a', 'b', 'c']


def test_semua_rute_izin_menolak_tanpa_token_http():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    app = FastAPI()
    app.include_router(api.router, prefix='/api')
    klien = TestClient(app)
    for r in api.router.routes:
        for metode in r.methods:
            path = '/api' + r.path.replace('{izin_id}', 'x')
            res = klien.request(metode, path, json={})
            assert res.status_code in (401, 403), (metode, path, res.status_code)


def test_skema_catatan_dan_dokumen_baru():
    doc = ik.dokumen_catatan_baru('i1', {'id': 's1', 'full_name': 'Pak Satpam'}, '  Keluar 09.05  ')
    assert doc['izin_id'] == 'i1' and doc['penulis_id'] == 's1' and doc['isi'] == 'Keluar 09.05' and doc['id']
    assert set(ik.ringkas_catatan(doc)) == {'id', 'izin_id', 'penulis_nama', 'isi', 'dibuat_pada'}  # tanpa penulis_id
    assert ik.KOLEKSI_CATATAN == 'izin_kamad_catatan'
    assert ([('izin_id', 1), ('dibuat_pada', 1)], {}) in [(k, o) for c, k, o in ik.INDEX_IZIN_KAMAD if c == ik.KOLEKSI_CATATAN]


# ---- Catatan: otorisasi & validasi tingkat HTTP ----
@pytest.fixture
def klien_catatan(db_api):
    """TestClient router izin dengan pengguna yang bisa diganti per permintaan (override get_current_user)."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from core import get_current_user

    app = FastAPI()
    app.include_router(api.router, prefix='/api')
    sebagai = {'user': None}
    app.dependency_overrides[get_current_user] = lambda: sebagai['user']

    def minta(user, metode, path, **kw):
        sebagai['user'] = user
        return TestClient(app).request(metode, '/api' + path, **kw)
    return minta


def test_http_catatan_satpam_tulis_tapi_tidak_baca(klien_catatan):
    r = klien_catatan(_satpam(), 'POST', '/izin-kamad/b/catatan', json={'isi': 'Keluar pukul 09.40'})
    assert r.status_code == 200 and r.json()['isi'] == 'Keluar pukul 09.40' and 'penulis_id' not in r.json()
    assert klien_catatan(_satpam(), 'GET', '/izin-kamad/b/catatan').status_code == 403
    for peran in ('kepala_tata_usaha', 'kepala_sekolah', 'admin'):
        baca = klien_catatan(_pengguna('x', peran), 'GET', '/izin-kamad/b/catatan')
        assert baca.status_code == 200 and [c['isi'] for c in baca.json()['items']] == ['Keluar pukul 09.40'], peran
    for peran in ('guru', 'tenaga_kependidikan', 'siswa'):
        assert klien_catatan(_pengguna('x', peran), 'GET', '/izin-kamad/b/catatan').status_code == 403
        assert klien_catatan(_pengguna('x', peran), 'POST', '/izin-kamad/b/catatan', json={'isi': 'Coba tulis'}).status_code == 403
    # Satpam juga tidak bisa membaca catatan lewat papan/detail.
    assert 'Keluar pukul' not in klien_catatan(_satpam(), 'GET', '/izin-kamad/papan-hari-ini').text
    assert 'Keluar pukul' not in klien_catatan(_satpam(), 'GET', '/izin-kamad/b').text


@pytest.mark.parametrize('izin_id, isi, kode, pesan', [
    ('b', 'ok', 400, 'minimal 3'),
    ('b', '   x  ', 400, 'minimal 3'),
    ('b', 'y' * 501, 400, 'maksimal 500'),
    ('d', 'Catatan valid', 400, 'sudah disetujui'),   # izin masih menunggu
    ('tidak-ada', 'Catatan valid', 404, 'tidak ditemukan'),
])
def test_http_validasi_catatan(klien_catatan, db_api, izin_id, isi, kode, pesan):
    r = klien_catatan(_satpam(), 'POST', f'/izin-kamad/{izin_id}/catatan', json={'isi': isi})
    assert r.status_code == kode and pesan in r.json()['detail']
    assert db_api[ik.KOLEKSI_CATATAN].docs == []


def test_http_catatan_tanpa_isi_ditolak_skema(klien_catatan):
    assert klien_catatan(_satpam(), 'POST', '/izin-kamad/b/catatan', json={}).status_code == 422
