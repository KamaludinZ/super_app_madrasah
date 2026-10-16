"""API Input Tata Tertib terpadu (routers/tatib.py) di atas MongoDB sungguhan (fixture `mongo_db`)."""

import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from routers import tatib as api  # noqa: E402
from migrations.migrate_tatib_struktur_baru import migrate  # noqa: E402

PETUGAS = {'id': 'u1', 'full_name': 'Guru Tatib', 'roles': ['guru_tata_tertib'], 'active_role': 'guru_tata_tertib'}


@pytest.fixture
async def db(mongo_db, monkeypatch):
    async def _tanpa_audit(*_a, **_k):
        return None
    monkeypatch.setattr(api, 'db', mongo_db)
    monkeypatch.setattr(api, 'log_audit', _tanpa_audit)
    await migrate(mongo_db)  # index unik seperti di server
    return mongo_db


def _req(model, **isian):
    return model(**isian)


async def test_kategori_tambah_rapikan_nama_dan_tolak_ganda(db):
    k = await api.create_kategori(_req(api.KategoriTatibRequest, nama='  Kedisiplinan  ', deskripsi=' '), PETUGAS)
    assert k['nama'] == 'Kedisiplinan' and k['nama_key'] == 'kedisiplinan' and k['deskripsi'] is None
    with pytest.raises(HTTPException) as e:
        await api.create_kategori(_req(api.KategoriTatibRequest, nama='KEDISIPLINAN'), PETUGAS)
    assert e.value.status_code == 409
    with pytest.raises(HTTPException) as e:
        await api.create_kategori(_req(api.KategoriTatibRequest, nama='   '), PETUGAS)
    assert e.value.status_code == 400
    daftar = await api.list_kategori(PETUGAS)
    assert [x['nama'] for x in daftar] == ['Kedisiplinan']


async def test_kategori_ubah_nama_ikut_ke_jenis_tapi_tidak_ke_riwayat(db):
    k = await api.create_kategori(_req(api.KategoriTatibRequest, nama='Kerapian'), PETUGAS)
    lain = await api.create_kategori(_req(api.KategoriTatibRequest, nama='Akhlak'), PETUGAS)
    await db.tatib_aturan.insert_one({'id': 'a1', 'kategori_id': k['id'], 'kategori_nama': 'Kerapian', 'kode_aturan': 'KER-01'})
    await db.tatib_penanganan.insert_one({'id': 'p1', 'kategori_id': k['id'], 'kategori_nama': 'Kerapian'})

    with pytest.raises(HTTPException) as e:
        await api.update_kategori(k['id'], _req(api.KategoriTatibRequest, nama='akhlak'), PETUGAS)
    assert e.value.status_code == 409

    u = await api.update_kategori(k['id'], _req(api.KategoriTatibRequest, nama='Kerapian Seragam', deskripsi='Atribut'), PETUGAS)
    assert (u['nama'], u['nama_key'], u['deskripsi']) == ('Kerapian Seragam', 'kerapian seragam', 'Atribut')
    assert (await db.tatib_aturan.find_one({'id': 'a1'}))['kategori_nama'] == 'Kerapian Seragam'
    assert (await db.tatib_penanganan.find_one({'id': 'p1'}))['kategori_nama'] == 'Kerapian'  # riwayat tetap
    # nama sama milik sendiri boleh disimpan ulang
    await api.update_kategori(lain['id'], _req(api.KategoriTatibRequest, nama='Akhlak'), PETUGAS)


async def test_kategori_hapus_ditolak_bila_dipakai(db):
    k = await api.create_kategori(_req(api.KategoriTatibRequest, nama='Ibadah'), PETUGAS)
    await db.tatib_penanganan.insert_one({'id': 'p1', 'kategori_id': k['id']})
    with pytest.raises(HTTPException) as e:
        await api.delete_kategori(k['id'], PETUGAS)
    assert e.value.status_code == 400
    await db.tatib_penanganan.delete_many({})
    assert (await api.delete_kategori(k['id'], PETUGAS))['message']
    with pytest.raises(HTTPException) as e:
        await api.get_kategori(k['id'], PETUGAS)
    assert e.value.status_code == 404


async def test_jenis_aturan_per_kategori_bentuk_kanonis(db):
    k1 = await api.create_kategori(_req(api.KategoriTatibRequest, nama='Kedisiplinan', urutan=1), PETUGAS)
    k2 = await api.create_kategori(_req(api.KategoriTatibRequest, nama='Akhlak', urutan=2), PETUGAS)
    await db.tatib_aturan.insert_many([
        # format lama (belum dimigrasi) tetap diterjemahkan
        {'id': 'a2', 'kode': 'DIS-02', 'nama_aturan': 'Bolos', 'kategori_id': k1['id'], 'kategori_nama': 'lama', 'poin': -15, 'is_active': True},
        {'id': 'a1', 'kode_aturan': 'DIS-01', 'nama': 'Terlambat', 'jalur_poin': 'minus', 'besar_poin': 5, 'kategori_id': k1['id'], 'aktif': True},
        {'id': 'a3', 'kode_aturan': 'AKH-01', 'nama': 'Imam salat', 'jalur_poin': 'plus', 'besar_poin': 5, 'kategori_id': k2['id'], 'aktif': True, 'deskripsi': 'x'},
        {'id': 'a4', 'kode_aturan': 'AKH-02', 'nama': 'Kasar', 'jalur_poin': 'minus', 'besar_poin': 10, 'kategori_id': k2['id'], 'aktif': False},
    ])
    semua = await api.list_jenis_aturan(user=PETUGAS)
    assert [j['id'] for j in semua] == ['a1', 'a2', 'a3', 'a4']  # urut kategori lalu kode
    assert semua[1] == {'id': 'a2', 'kode_aturan': 'DIS-02', 'nama': 'Bolos', 'jalur_poin': 'minus', 'besar_poin': 15, 'aktif': True,
                        'poin': -15, 'kategori_id': k1['id'], 'kategori_nama': 'Kedisiplinan', 'deskripsi': ''}
    assert semua[2]['poin'] == 5 and semua[2]['deskripsi'] == 'x'

    per_kategori = await api.list_jenis_aturan(kategori_id=k2['id'], user=PETUGAS)
    assert [j['id'] for j in per_kategori] == ['a3', 'a4']
    aktif = await api.list_jenis_aturan(kategori_id=k2['id'], aktif=True, user=PETUGAS)
    assert [j['id'] for j in aktif] == ['a3']
    assert [j['id'] for j in await api.list_jenis_aturan(aktif=False, user=PETUGAS)] == ['a4']


@pytest.fixture
async def data_input(db, monkeypatch):
    """Kategori, jenis aturan (aktif/nonaktif), dan satu siswa ber-kelas."""
    def _tanpa_notifikasi(coro):
        coro.close()
    monkeypatch.setattr(api, 'spawn', _tanpa_notifikasi)
    k = await api.create_kategori(_req(api.KategoriTatibRequest, nama='Kedisiplinan'), PETUGAS)
    await db.classes.insert_one({'id': 'c7a', 'name': 'VII A'})
    await db.users.insert_one({'id': 's1', 'roles': ['siswa'], 'full_name': 'Ahmad', 'nis': '2401', 'nisn': '001', 'student_class_id': 'c7a'})
    await db.tatib_aturan.insert_many([
        {'id': 'j1', 'kode_aturan': 'DIS-01', 'nama': 'Terlambat', 'jalur_poin': 'minus', 'besar_poin': 5, 'kategori_id': k['id'], 'aktif': True},
        {'id': 'j2', 'kode_aturan': 'AKH-01', 'nama': 'Imam salat', 'jalur_poin': 'plus', 'besar_poin': 10, 'kategori_id': k['id'], 'aktif': True},
        {'id': 'j3', 'kode_aturan': 'DIS-09', 'nama': 'Lama', 'jalur_poin': 'minus', 'besar_poin': 3, 'kategori_id': k['id'], 'aktif': False},
    ])
    return {'kategori': k}


def _input(**isian):
    dasar = {'siswa_id': 's1', 'jenis_id': 'j1', 'tanggal': '2026-10-01', 'asal_input': 'Razia'}
    return api.InputTatibRequest(**{**dasar, **isian})


async def test_simpan_input_poin_dari_master_jenis(db, data_input):
    c = await api.simpan_input_tatib(_input(keterangan='  Telat 10 menit  ', semester_id='sem1'), PETUGAS)
    assert (c['poin'], c['jenis_poin'], c['kode_aturan'], c['jenis_nama']) == (-5, 'pelanggaran', 'DIS-01', 'Terlambat')
    assert (c['siswa_nama'], c['siswa_kelas'], c['kategori_nama']) == ('Ahmad', 'VII A', 'Kedisiplinan')
    assert (c['asal_input'], c['keterangan'], c['petugas_nama'], c['semester_id']) == ('Razia', 'Telat 10 menit', 'Guru Tatib', 'sem1')
    tersimpan = await db.tatib_penanganan.find_one({'id': c['id']}, {'_id': 0})
    # kompatibel dengan endpoint & rekap lama
    assert (tersimpan['tatib_id'], tersimpan['tatib_poin'], tersimpan['catatan'], tersimpan['tindak_lanjut']) == ('j1', -5, 'Telat 10 menit', [])

    plus = await api.simpan_input_tatib(_input(jenis_id='j2', asal_input='Ibadah'), PETUGAS)
    assert plus['poin'] == 10 and plus['jenis_poin'] == 'kebaikan' and plus['keterangan'] is None


@pytest.mark.parametrize('isian,status,pesan', [
    ({'asal_input': 'Lainnya'}, 400, 'Asal input'),
    ({'asal_input': ''}, 400, 'Asal input'),
    ({'tanggal': '2999-01-01'}, 400, 'melewati hari ini'),
    ({'tanggal': '01-10-2026'}, 400, 'tidak valid'),
    ({'keterangan': 'x' * 501}, 400, 'maksimal'),
    ({'siswa_id': 'tidak-ada'}, 404, 'Siswa'),
    ({'jenis_id': 'tidak-ada'}, 404, 'Jenis'),
    ({'jenis_id': 'j3'}, 400, 'tidak aktif'),
])
async def test_simpan_input_validasi(db, data_input, isian, status, pesan):
    with pytest.raises(HTTPException) as e:
        await api.simpan_input_tatib(_input(**isian), PETUGAS)
    assert e.value.status_code == status and pesan in e.value.detail
    assert await db.tatib_penanganan.count_documents({}) == 0


async def test_daftar_terbaru_urut_waktu_input_dan_filter_siswa(db, data_input):
    await db.users.insert_one({'id': 's2', 'roles': ['siswa'], 'full_name': 'Budi', 'student_class_id': 'c7a'})
    await db.tatib_penanganan.insert_one({'id': 'lama', 'siswa_id': 's2', 'tatib_id': 'j1', 'tatib_kode': 'DIS-01', 'tatib_nama': 'Terlambat',
                                          'tatib_poin': -5, 'catatan': 'catatan lama', 'tanggal': '2026-09-01', 'created_at': '2026-09-01T00:00:00'})
    a = await api.simpan_input_tatib(_input(tanggal='2026-09-05'), PETUGAS)
    b = await api.simpan_input_tatib(_input(siswa_id='s2', jenis_id='j2', asal_input='BIPH'), PETUGAS)

    hasil = await api.daftar_input_terbaru(batas=2, user=PETUGAS)
    assert [i['id'] for i in hasil['items']] == [b['id'], a['id']] and hasil['ada_lagi'] is True
    semua = await api.daftar_input_terbaru(batas=10, user=PETUGAS)
    lama = semua['items'][-1]
    # catatan format lama diterjemahkan ke bentuk daftar
    assert (lama['jenis_id'], lama['kode_aturan'], lama['keterangan'], lama['asal_input'], lama['poin']) == ('j1', 'DIS-01', 'catatan lama', None, -5)
    milik_s2 = await api.daftar_input_terbaru(batas=10, siswa_id='s2', user=PETUGAS)
    assert {i['siswa_id'] for i in milik_s2['items']} == {'s2'} and len(milik_s2['items']) == 2


async def test_ubah_input_hitung_ulang_poin_dan_pertahankan_jejak(db, data_input):
    c = await api.simpan_input_tatib(_input(), PETUGAS)
    await db.tatib_penanganan.update_one({'id': c['id']}, {'$set': {'tindak_lanjut': [{'uraian': 'dipanggil'}]}})
    admin = {'id': 'u9', 'full_name': 'Admin', 'roles': ['admin'], 'active_role': 'admin'}
    u = await api.ubah_input_tatib(c['id'], _input(jenis_id='j2', asal_input='Ibadah', keterangan='salah pilih'), admin)
    assert (u['poin'], u['jenis_poin'], u['kode_aturan'], u['asal_input'], u['keterangan']) == (10, 'kebaikan', 'AKH-01', 'Ibadah', 'salah pilih')
    assert (u['petugas_nama'], u['diubah_oleh_nama'], u['created_at']) == ('Guru Tatib', 'Admin', c['created_at'])
    assert u['tindak_lanjut'] == [{'uraian': 'dipanggil'}]

    with pytest.raises(HTTPException) as e:
        await api.ubah_input_tatib('tidak-ada', _input(), PETUGAS)
    assert e.value.status_code == 404
    with pytest.raises(HTTPException) as e:
        await api.ubah_input_tatib(c['id'], _input(asal_input='Lainnya'), PETUGAS)
    assert e.value.status_code == 400


async def test_ubah_input_jenis_lama_nonaktif_boleh_dipertahankan(db, data_input):
    await db.tatib_penanganan.insert_one({'id': 'x', 'siswa_id': 's1', 'tatib_id': 'j3', 'tanggal': '2026-10-01', 'created_at': '2026-10-01T00:00:00'})
    u = await api.ubah_input_tatib('x', _input(jenis_id='j3', asal_input='BAP'), PETUGAS)
    assert u['poin'] == -3 and u['asal_input'] == 'BAP'
    c = await api.simpan_input_tatib(_input(), PETUGAS)
    with pytest.raises(HTTPException) as e:  # pindah KE jenis nonaktif tetap ditolak
        await api.ubah_input_tatib(c['id'], _input(jenis_id='j3'), PETUGAS)
    assert e.value.status_code == 400


async def test_hapus_input(db, data_input):
    c = await api.simpan_input_tatib(_input(), PETUGAS)
    admin = {'id': 'u9', 'roles': ['admin'], 'active_role': 'admin'}
    assert (await api.hapus_input_tatib(c['id'], admin))['message']
    assert await db.tatib_penanganan.count_documents({}) == 0
    with pytest.raises(HTTPException) as e:
        await api.hapus_input_tatib(c['id'], admin)
    assert e.value.status_code == 404


async def test_hak_akses_endpoint_input():
    """Dependency: input (admin/guru tatib/waka kesiswaan), daftar (input + lihat), hapus hanya admin."""
    from routers.tatib_poin import wajib_input_tatib, wajib_lihat_tatib
    peran = lambda r: {'id': 'x', 'roles': [r], 'active_role': r}  # noqa: E731
    for r in ('admin', 'guru_tata_tertib', 'waka_kesiswaan'):
        assert await wajib_input_tatib(peran(r))
    for r in ('guru_bk', 'kepala_sekolah', 'wali_kelas', 'siswa'):
        with pytest.raises(HTTPException):
            await wajib_input_tatib(peran(r))
    assert await wajib_lihat_tatib(peran('kepala_sekolah'))
    for r in ('wali_kelas', 'siswa', 'guru_mapel'):
        with pytest.raises(HTTPException):
            await wajib_lihat_tatib(peran(r))
    hanya_admin = api.require_role('admin')
    assert await hanya_admin(peran('admin'))
    with pytest.raises(HTTPException):
        await hanya_admin(peran('guru_tata_tertib'))


def test_semua_endpoint_tatib_berpenjaga_peran():
    """Tiap endpoint routers/tatib.py memakai penjaga peran yang sesuai (bukan sekadar login)."""
    import inspect
    from routers.tatib_poin import wajib_akses_tatib, wajib_input_tatib, wajib_lihat_tatib

    def penjaga(route):
        return [d.call for d in route.dependant.dependencies]

    def hanya_admin(fn):
        return 'require_role' in fn.__qualname__ and fn.__closure__ and \
            any(c.cell_contents == ('admin',) for c in fn.__closure__)

    for route in api.router.routes:
        method = next(iter(route.methods))
        calls = penjaga(route)
        kunci = f'{method} {route.path}'
        if method == 'GET' and route.path in ('/tatib/kategori', '/tatib/kategori/{kategori_id}', '/tatib/jenis',
                                              '/tatib/jenis-aturan', '/tatib/aturan', '/tatib/aturan/{aturan_id}'):
            assert wajib_akses_tatib in calls, kunci
        elif method == 'GET' and route.path in ('/tatib/input/terbaru', '/tatib/stats/summary'):
            assert wajib_lihat_tatib in calls, kunci
        elif method == 'GET':
            # data per siswa: dibatasi di dalam endpoint (siswa: miliknya, wali kelas: kelasnya, lainnya 403)
            assert 'batasi_query_tatib' in inspect.getsource(route.endpoint), kunci
        elif method == 'DELETE' and route.path in ('/tatib/input/{catatan_id}', '/tatib/penanganan/{penanganan_id}'):
            assert any(hanya_admin(c) for c in calls), kunci
        else:
            assert wajib_input_tatib in calls, kunci


async def test_master_tatib_ditolak_untuk_peran_tanpa_akses_tatib():
    from routers.tatib_poin import wajib_akses_tatib
    for r in ('admin', 'guru_tata_tertib', 'guru_bk', 'kepala_sekolah', 'wali_kelas', 'siswa'):
        assert await wajib_akses_tatib({'id': 'x', 'roles': [r], 'active_role': r})
    for r in ('guru_mapel', 'guru_piket', 'staf_gtk'):
        with pytest.raises(HTTPException) as e:
            await wajib_akses_tatib({'id': 'x', 'roles': [r], 'active_role': r})
        assert e.value.status_code == 403
