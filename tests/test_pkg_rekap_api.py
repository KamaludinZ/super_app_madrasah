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
        'pkg_periode': Koleksi([
            {'id': 'p1', 'status': 'berjalan', 'nama_periode': 'Ganjil', 'tahun_pelajaran': '2026/2027', 'semester': 'Ganjil', 'tanggal_buka': '2026-10-01'},
            {'id': 'p0', 'status': 'ditutup', 'nama_periode': 'Genap', 'tahun_pelajaran': '2025/2026', 'semester': 'Genap', 'tanggal_buka': '2026-03-01'},
            {'id': 'pd', 'status': 'draf', 'nama_periode': 'Draf', 'tahun_pelajaran': '2026/2027', 'semester': 'Genap', 'tanggal_buka': '2027-03-01'}]),
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


def _akses(user, periode=None, tahun=None, semester=None):
    return api.akses_rekap(Request('/pkg/rekap'), periode, tahun, semester, _guru(user))


def _rincian(user, guru, periode=None):
    async def jalan():
        return await api.rekap_guru_api(guru, akses=await _akses(user, periode))
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


def _api_get(fn, user, periode=None, tahun=None, semester=None):
    async def jalan():
        return await fn(akses=await _akses(user, periode, tahun, semester))
    return asyncio.run(jalan())


def test_rekap_periode_per_cakupan(db):
    kep = _api_get(api.rekap_api, 'kep')
    assert kep['cakupan'] == 'semua' and kep['sk']['id'] == 's1' and kep['periode']['id'] == 'p1'
    assert {b['guru_id']: b['status'] for b in kep['guru']} == {'g1': 'terkunci', 'g2': 'draf', 'rangkap': 'terkunci', 'g3': 'draf'}
    assert kep['ringkasan']['terkunci'] == 2 and kep['statistik']['jumlah'] == 2

    pen = _api_get(api.rekap_api, 'pen')
    assert pen['cakupan'] == 'penilai' and {b['guru_id'] for b in pen['guru']} == {'g1', 'rangkap'}
    rangkap = _api_get(api.rekap_api, 'rangkap')
    assert {b['guru_id'] for b in rangkap['guru']} == {'g2', 'rangkap'}  # hasil sendiri sudah terkunci -> tampil
    g1 = _api_get(api.rekap_api, 'g1')
    assert g1['cakupan'] == 'pribadi' and [b['guru_id'] for b in g1['guru']] == ['g1']
    g3 = _api_get(api.rekap_api, 'g3')
    assert g3['guru'] == [] and g3['ringkasan']['total'] == 0  # belum dikunci -> tersembunyi


def test_rekap_tim(db):
    tim = {t['penilai_id']: t for t in _api_get(api.rekap_tim_api, 'kep')['tim']}
    assert set(tim) == {'pen', 'rangkap', 'kep'}
    assert (tim['pen']['jumlah'], tim['pen']['terkunci'], tim['pen']['rata_capaian'], tim['pen']['supervisi_selesai']) == (2, 2, 80.0, True)
    assert [g['peringkat'] for g in tim['pen']['guru']] == [1, 2]
    assert (tim['rangkap']['draf'], tim['rangkap']['guru'][0]['peringkat']) == (1, None)
    assert [t['penilai_id'] for t in _api_get(api.rekap_tim_api, 'pen')['tim']] == ['pen']
    with pytest.raises(HTTPException) as e:
        _api_get(api.rekap_tim_api, 'g1')
    assert e.value.detail['alasan'] == 'bukan_penilai'


def test_statistik_api(db):
    st = _api_get(api.statistik_api, 'kep')
    assert st['cakupan'] == 'semua' and st['statistik']['jumlah'] == 2 and st['statistik']['rata'] == 80.0
    assert st['statistik']['rata_per_kompetensi'] == [{'kode': '1', 'rata': 4.0}]
    assert _api_get(api.statistik_api, 'g3')['statistik']['jumlah'] == 0



def test_saringan_periode_tahun(db):
    async def daftar(tahun=None, semester=None, user='kep'):
        return await api.periode_rekap_api(tahun_pelajaran=tahun, semester=semester, user=_guru(user))
    assert [p['id'] for p in asyncio.run(daftar())] == ['p1', 'p0']  # draf tidak ikut, terbaru dulu
    assert [p['id'] for p in asyncio.run(daftar('2025/2026'))] == ['p0']
    assert asyncio.run(daftar('2026/2027', 'Genap')) == []
    assert [p['id'] for p in asyncio.run(daftar(user='g1'))] == ['p1']  # bukan personil periode p0

    assert _api_get(api.rekap_api, 'kep', tahun='2025/2026')['periode']['id'] == 'p0'
    assert _api_get(api.rekap_api, 'kep', tahun='2026/2027', semester='Ganjil')['periode']['id'] == 'p1'
    assert _api_get(api.statistik_api, 'kep', tahun='2025/2026')['statistik']['jumlah'] == 0
    for kw in ({'tahun': '2024/2025'}, {'periode': 'p1', 'tahun': '2025/2026'}):
        with pytest.raises(HTTPException) as e:
            _api_get(api.rekap_api, 'kep', **kw)
        assert e.value.status_code == 404


def test_saringan_lewat_http(db):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from core import get_current_user
    app = FastAPI()
    app.include_router(api.router, prefix='/api')
    app.dependency_overrides[get_current_user] = lambda: _guru('kep')
    k = TestClient(app)
    assert k.get('/api/pkg/rekap', params={'tahun_pelajaran': '2025/2026'}).json()['periode']['id'] == 'p0'
    assert k.get('/api/pkg/rekap').json()['periode']['id'] == 'p1'
    assert k.get('/api/pkg/rekap', params={'tahun_pelajaran': '2025-2026'}).status_code == 422
    assert [p['id'] for p in k.get('/api/pkg/rekap/periode').json()] == ['p1', 'p0']
    app.dependency_overrides[get_current_user] = lambda: _guru('asing')
    assert k.get('/api/pkg/rekap').status_code == 403
    assert k.get('/api/pkg/rekap/periode').json() == []
    app.dependency_overrides[get_current_user] = lambda: _guru('kep')
    assert k.get('/api/pkg/rekap/guru/g1', params={'semester': 'Ganjil'}).json()['status'] == 'terkunci'



def test_akses_periode_lama_tanpa_sk_aktif_sekarang(db):
    # Periode lama p0: guru "lama" dinilai & lembarnya terkunci; ia tidak tercantum di SK aktif periode berjalan.
    db['pkg_sk'].docs.append({'id': 's0', 'periode_id': 'p0', 'is_active': True, 'penilai_ids': ['kep'], 'dinilai_ids': ['lama']})
    db['pkg_penilaian'].docs.append({**_lembar('n9', 'lama', 'kep'), 'periode_id': 'p0', 'sk_id': 's0'})
    asyncio.run(pkg_rekap.bangun_ulang_rekap(db))
    r = _api_get(api.rekap_api, 'lama', periode='p0')
    assert r['cakupan'] == 'pribadi' and [b['guru_id'] for b in r['guru']] == ['lama']
    with pytest.raises(HTTPException) as e:  # bukan personil periode berjalan
        _api_get(api.rekap_api, 'lama')
    assert e.value.detail['alasan'] == 'bukan_anggota_sk'
    tolak = [d for d in db['pkg_audit_log'].docs if d['aksi'] == 'tolak_akses']
    assert tolak and tolak[0]['metadata']['periode_id'] == 'p1'


def test_audit_hitung_ulang_dan_unduhan(db):
    import pkg_audit
    _api_get(api.rekap_api, 'kep')
    _api_get(api.rekap_api, 'kep')
    _rincian('kep', 'g1')
    lihat = {d['aksi']: d for d in db['pkg_audit_log'].docs}
    assert lihat['lihat_rekap']['jumlah'] >= 2 and lihat['lihat_rekap_guru']['metadata']['guru_id'] == 'g1'

    async def kepala(fn, *a, **kw):
        akses = await pkg_penjaga.penjaga_pkg('kepala')(Request(), _guru('kep'))
        return await fn(*a, akses=akses, **kw)
    db['pkg_rekap'].docs = []
    hasil = asyncio.run(kepala(api.hitung_ulang_api, Request(), periode_id='p1'))
    assert hasil['ditulis'] == 2 and len(db['pkg_rekap'].docs) == 2
    assert db['pkg_audit_log'].docs[-1]['aksi'] == 'rekap_hitung_ulang'

    asyncio.run(pkg_audit.catat_cetak_template(db, _guru('kep'), 'rekap', 'xlsx', 'Rekap.xlsx', '2026', 'abc', periode_id='p1'))
    asyncio.run(pkg_audit.catat_cetak_template(db, _guru('kep'), 'rekap', 'pdf', 'Rekap.pdf', '2026', 'abc', periode_id='p0'))
    assert [u['format'] for u in asyncio.run(kepala(api.riwayat_unduhan_api, periode_id='p1'))] == ['xlsx']
    assert len(asyncio.run(kepala(api.riwayat_unduhan_api, periode_id=None))) == 2
    with pytest.raises(HTTPException):
        asyncio.run(api.riwayat_unduhan_api(None, akses=asyncio.run(pkg_penjaga.penjaga_pkg('kepala')(Request(), _guru('pen')))))


def test_validasi_input_rekap_lewat_http(db):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from core import get_current_user
    app = FastAPI()
    app.include_router(api.router, prefix='/api')
    app.dependency_overrides[get_current_user] = lambda: _guru('kep')
    k = TestClient(app)
    for url, params in (('/api/pkg/rekap', {'periode_id': 'p1;x'}), ('/api/pkg/rekap', {'semester': 'x' * 41}),
                        ('/api/pkg/rekap/guru/g%241', {}), ('/api/pkg/rekap/statistik', {'tahun_pelajaran': '2026'})):
        assert k.get(url, params=params).status_code == 422, (url, params)
    assert k.post('/api/pkg/rekap/hitung-ulang').status_code == 422  # periode_id wajib


def _kompetensi(user, guru):
    async def jalan():
        return await api.rekap_kompetensi_guru_api(guru, akses=await _akses(user))
    return asyncio.run(jalan())


def test_rekap_per_kompetensi(db):
    r = _kompetensi('kep', 'g1')
    m = r['model']
    assert r['status'] == 'terkunci' and (m['total_skor'], m['skor_maks'], m['nkg']) == (4, 5, 80.0)
    k = m['kompetensi'][0]
    assert (k['label'], k['jumlah_skor'], k['skor_maks']) == ('KOMPETENSI 1', 4, 5)
    assert k['sub'] == [{'no': 1, 'kode': '1.1', 'nama': None, 'nilai_rating': 4, 'tingkat': 'Level 4', 'skor_maks': 5}]
    # Tanpa angket 360° & kehadiran: nilai kompetensi = 80 x 70% = 56 (Level 3), indeks kehadiran 100%.
    akhir = r['nilai_akhir_360']
    assert (akhir['nilai_kompetensi'], akhir['nilai_akhir'], akhir['level_teks']) == (56.0, 56.0, 'pada Level 3')
    assert akhir['lengkap'] is False and akhir['angket_kurang'] == ['sejawat', 'siswa', 'ortu']
    lv = r['level_guru']
    assert (lv['normal'], lv['plus_360'], lv['rata'], lv['simpulan']) == ('Level 4', 'Level 3', 3.5, None)
    assert _kompetensi('kep', 'g3')['model'] is None  # draf
    with pytest.raises(HTTPException) as e:
        _kompetensi('pen', 'g2')
    assert e.value.status_code == 403
