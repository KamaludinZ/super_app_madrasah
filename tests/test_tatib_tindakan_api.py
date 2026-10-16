"""API Tindakan Tatib (routers/tatib_tindakan.py) di atas MongoDB sungguhan (fixture `mongo_db`)."""

import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from routers import tatib_poin as poin_api  # noqa: E402
from routers import tatib_tindakan as api  # noqa: E402

PIMPINAN = {'id': 'k1', 'full_name': 'Kepsek', 'roles': ['kepala_sekolah'], 'active_role': 'kepala_sekolah'}


@pytest.fixture
async def db(mongo_db, monkeypatch):
    monkeypatch.setattr(api, 'db', mongo_db)
    monkeypatch.setattr(poin_api, 'db', mongo_db)
    await mongo_db.classes.insert_many([{'id': 'c7a', 'name': 'VII A'}, {'id': 'c8b', 'name': 'VIII B'}])
    await mongo_db.users.insert_many([
        {'id': 's1', 'roles': ['siswa'], 'full_name': 'Ahmad', 'nisn': '001', 'nis': '2401', 'student_class_id': 'c7a'},
        {'id': 's2', 'roles': ['siswa'], 'full_name': 'Budi', 'nisn': '002', 'nis': '2402', 'student_class_id': 'c8b'},
        {'id': 's3', 'roles': ['siswa'], 'full_name': 'Citra', 'nisn': '003', 'nis': '2403', 'student_class_id': 'c7a'},
    ])

    def catat(i, sid, poin, kategori, semester='sem1', tanggal='2026-10-01'):
        return {'id': f'p{i}', 'siswa_id': sid, 'poin': poin, 'jenis_poin': 'pelanggaran' if poin < 0 else 'kebaikan',
                'kategori_nama': kategori, 'semester_id': semester, 'tanggal': tanggal, 'siswa_kelas': 'lama'}
    await mongo_db.tatib_penanganan.insert_many([
        catat(1, 's1', -20, 'Kedisiplinan'), catat(2, 's1', -10, 'Kerapian'), catat(3, 's1', -5, 'Kedisiplinan'), catat(4, 's1', 10, 'Akhlak'),
        catat(5, 's2', -60, 'Kedisiplinan'),
        catat(6, 's3', 15, 'Akhlak'),
        catat(7, 's2', -100, 'Kedisiplinan', semester='sem0'),  # semester lain
    ])
    return mongo_db


async def test_rekap_siswa_berpoin_per_semester(db):
    hasil = await api.daftar_tindakan(semester_id='sem1', user=PIMPINAN)
    assert hasil['ambang'] == {'sp1': 25, 'sp2': 50, 'sp3': 75} and hasil['semester_id'] == 'sem1'
    assert [s['siswa_id'] for s in hasil['items']] == ['s2', 's1', 's3']  # pelanggaran terbesar dulu
    s1 = hasil['items'][1]
    assert (s1['nisn'], s1['nama'], s1['kelas'], s1['poin_positif'], s1['poin_negatif'], s1['usulan_sp']) == ('001', 'Ahmad', 'VII A', 10, -35, 'SP1')
    assert s1['kategori_negatif'] == [{'nama': 'Kedisiplinan', 'poin': -25, 'jumlah': 2}, {'nama': 'Kerapian', 'poin': -10, 'jumlah': 1}]
    assert s1['kategori_positif'] == [{'nama': 'Akhlak', 'poin': 10, 'jumlah': 1}]
    assert (s1['keterangan_sp'], s1['status_panggilan_wali'], s1['status_sp'], s1['status_rtlpd']) == (None, 'Tidak diperlukan', 'Tidak perlu', 'Tidak diperlukan')
    assert hasil['items'][0]['usulan_sp'] == 'SP2' and hasil['items'][2]['usulan_sp'] is None
    # tanpa semester: semua catatan
    semua = await api.daftar_tindakan(user=PIMPINAN)
    assert semua['items'][0]['poin_negatif'] == -160 and semua['items'][0]['usulan_sp'] == 'SP3'


async def test_rekap_memakai_ambang_tersimpan_dan_status_tindakan(db):
    await db.pengaturan_ambang_sp.insert_one({'_id': 'ambang_sp', 'sp1': 30, 'sp2': 40, 'sp3': 60})
    await db.tatib_tindakan.insert_one({'id': 't1', 'siswa_id': 's1', 'semester_id': 'sem1', 'keterangan_sp': 'SP1',
                                        'status_panggilan_wali': 'Terlaksana', 'status_sp': 'Diserahkan', 'status_rtlpd': 'Tidak diperlukan',
                                        'diubah_oleh_nama': 'Guru Tatib', 'diubah_pada': '2026-10-02T00:00:00'})
    await db.tatib_tindakan.insert_one({'id': 't0', 'siswa_id': 's1', 'semester_id': 'sem0', 'keterangan_sp': 'SP3'})
    hasil = await api.daftar_tindakan(semester_id='sem1', user=PIMPINAN)
    s1 = next(s for s in hasil['items'] if s['siswa_id'] == 's1')
    assert hasil['ambang'] == {'sp1': 30, 'sp2': 40, 'sp3': 60}
    assert (s1['usulan_sp'], s1['keterangan_sp'], s1['status_panggilan_wali'], s1['diubah_oleh_nama']) == ('SP1', 'SP1', 'Terlaksana', 'Guru Tatib')
    s2 = next(s for s in hasil['items'] if s['siswa_id'] == 's2')
    assert s2['usulan_sp'] == 'SP3'


async def test_rekap_filter_kelas_cari_dan_usulan(db):
    q = lambda **kw: api.daftar_tindakan(semester_id='sem1', user=PIMPINAN, **kw)  # noqa: E731
    assert [s['siswa_id'] for s in (await q(cari='ahm'))['items']] == ['s1']
    assert [s['siswa_id'] for s in (await q(cari='002'))['items']] == ['s2']
    assert [s['siswa_id'] for s in (await q(usulan_sp='SP2'))['items']] == ['s2']
    assert [s['siswa_id'] for s in (await q(usulan_sp='tanpa'))['items']] == ['s3']
    assert (await q(kelas='VII A'))['items'] == []  # kelas = kelas saat dicatat ('lama' di data uji)
    assert [s['siswa_id'] for s in (await q(kelas='lama'))['items']] == ['s2', 's1', 's3']


async def test_rekap_hak_akses():
    from routers.tatib_poin import wajib_lihat_tatib
    route = next(r for r in api.router.routes if r.path == '/tatib/tindakan')
    assert wajib_lihat_tatib in [d.call for d in route.dependant.dependencies]
    for r in ('wali_kelas', 'siswa', 'guru_mapel'):
        with pytest.raises(HTTPException):
            await wajib_lihat_tatib({'id': 'x', 'roles': [r], 'active_role': r})


async def test_usulan_sp_satu_siswa(db):
    u = await api.usulan_sp_siswa('s1', semester_id='sem1', user=PIMPINAN)
    assert (u['poin_negatif'], u['usulan_sp'], u['ambang_berikutnya'], u['keterangan_sp'], u['perlu_ditinjau']) == \
        (-35, 'SP1', {'sp': 'SP2', 'ambang': 50, 'sisa': 15}, None, True)
    assert u['jumlah_catatan'] == 4 and u['nama'] == 'Ahmad'
    s2 = await api.usulan_sp_siswa('s2', user=PIMPINAN)  # tanpa semester: -160
    assert (s2['usulan_sp'], s2['ambang_berikutnya']) == ('SP3', None)
    await db.tatib_tindakan.insert_one({'id': 't', 'siswa_id': 's1', 'semester_id': 'sem1', 'keterangan_sp': 'SP2'})
    assert (await api.usulan_sp_siswa('s1', semester_id='sem1', user=PIMPINAN))['perlu_ditinjau'] is False
    s3 = await api.usulan_sp_siswa('s3', semester_id='sem1', user=PIMPINAN)
    assert (s3['poin_negatif'], s3['usulan_sp'], s3['ambang_berikutnya']['sisa']) == (0, None, 25)
    with pytest.raises(HTTPException) as e:
        await api.usulan_sp_siswa('tidak-ada', user=PIMPINAN)
    assert e.value.status_code == 404


async def test_ringkasan_usulan_dan_perlu_ditinjau(db):
    r = await api.ringkasan_usulan_sp(semester_id='sem1', user=PIMPINAN)
    assert r['jumlah'] == {'SP1': 1, 'SP2': 1, 'SP3': 0} and r['perlu_ditinjau'] == 2
    await db.pengaturan_ambang_sp.insert_one({'_id': 'ambang_sp', 'sp1': 10, 'sp2': 20, 'sp3': 30})
    await db.tatib_tindakan.insert_one({'id': 't', 'siswa_id': 's2', 'semester_id': 'sem1', 'keterangan_sp': 'SP3'})
    r = await api.ringkasan_usulan_sp(semester_id='sem1', user=PIMPINAN)
    assert r['jumlah'] == {'SP1': 0, 'SP2': 0, 'SP3': 2} and r['siswa_perlu_ditinjau'] == ['s1']


def test_ambang_berikutnya_dan_usulan_lebih_tinggi():
    from tatib_poin import ambang_berikutnya, usulan_lebih_tinggi
    assert ambang_berikutnya(-30) == {'sp': 'SP2', 'ambang': 50, 'sisa': 20}
    assert ambang_berikutnya(0) == {'sp': 'SP1', 'ambang': 25, 'sisa': 25}
    assert ambang_berikutnya(-75) is None
    assert usulan_lebih_tinggi('SP2', 'SP1') and usulan_lebih_tinggi('SP1', None)
    assert not usulan_lebih_tinggi('SP1', 'SP2') and not usulan_lebih_tinggi(None, None)


GURU = {'id': 'g1', 'full_name': 'Guru Tatib', 'roles': ['guru_tata_tertib'], 'active_role': 'guru_tata_tertib'}


@pytest.fixture
def tanpa_audit(monkeypatch):
    async def _noop(*_a, **_k):
        return None
    monkeypatch.setattr(api, 'log_audit', _noop)


def _status(**kw):
    dasar = {'semester_id': 'sem1', 'keterangan_sp': 'SP1', 'status_panggilan_wali': 'Diajukan', 'status_sp': 'Tidak perlu',
             'status_rtlpd': 'Tidak diperlukan'}
    return api.StatusTindakanRequest(**{**dasar, **kw})


async def test_ubah_status_menyimpan_dan_mencatat_riwayat(db, tanpa_audit):
    b = await api.ubah_status_tindakan('s1', _status(catatan='  telepon wali  '), GURU)
    assert (b['keterangan_sp'], b['status_panggilan_wali'], b['usulan_sp'], b['poin_negatif'], b['diubah_oleh_nama']) == ('SP1', 'Diajukan', 'SP1', -35, 'Guru Tatib')
    r = await db.tatib_tindakan_riwayat.find({'siswa_id': 's1'}, {'_id': 0}).to_list(None)
    assert len(r) == 1 and r[0]['perubahan'] == [{'field': 'keterangan_sp', 'dari': None, 'ke': 'SP1'},
                                                {'field': 'status_panggilan_wali', 'dari': 'Tidak diperlukan', 'ke': 'Diajukan'}]
    assert (r[0]['catatan'], r[0]['usulan_sp'], r[0]['poin_negatif'], r[0]['oleh_nama'], r[0]['semester_id']) == ('telepon wali', 'SP1', -35, 'Guru Tatib', 'sem1')

    # simpan ulang tanpa perubahan & tanpa catatan: riwayat tidak bertambah
    await api.ubah_status_tindakan('s1', _status(), GURU)
    assert await db.tatib_tindakan_riwayat.count_documents({}) == 1
    # perubahan berikutnya hanya field yang berubah
    await api.ubah_status_tindakan('s1', _status(status_panggilan_wali='Terlaksana', status_sp='Diserahkan'), GURU)
    terbaru = await db.tatib_tindakan_riwayat.find({}, {'_id': 0}).sort('waktu', -1).to_list(1)
    assert [p['field'] for p in terbaru[0]['perubahan']] == ['status_panggilan_wali', 'status_sp']
    assert await db.tatib_tindakan.count_documents({'siswa_id': 's1'}) == 1  # satu dokumen per siswa+semester
    # semester lain terpisah
    await api.ubah_status_tindakan('s1', _status(semester_id='sem0', keterangan_sp='SP3'), GURU)
    assert await db.tatib_tindakan.count_documents({'siswa_id': 's1'}) == 2
    assert (await api.daftar_tindakan(semester_id='sem1', user=PIMPINAN))['items'][1]['keterangan_sp'] == 'SP1'


async def test_ubah_status_siswa_tanpa_catatan_poin_dan_validasi(db, tanpa_audit):
    await db.users.insert_one({'id': 's9', 'roles': ['siswa'], 'full_name': 'Dewi', 'student_class_id': 'c7a'})
    b = await api.ubah_status_tindakan('s9', _status(keterangan_sp=None, status_panggilan_wali='Tidak diperlukan'), GURU)
    assert (b['nama'], b['poin_negatif'], b['jumlah_catatan'], b['kelas']) == ('Dewi', 0, 0, 'VII A')
    with pytest.raises(HTTPException) as e:
        await api.ubah_status_tindakan('tidak-ada', _status(), GURU)
    assert e.value.status_code == 404
    from pydantic import ValidationError
    for salah in ({'keterangan_sp': 'SP4'}, {'status_panggilan_wali': 'Selesai'}, {'status_sp': 'Ya'}, {'status_rtlpd': 'x'}, {'catatan': 'x' * 301}):
        with pytest.raises(ValidationError):
            _status(**salah)
    assert _status(keterangan_sp='').keterangan_sp is None


def test_ubah_status_hanya_peran_input():
    from routers.tatib_poin import wajib_input_tatib
    route = next(r for r in api.router.routes if r.path == '/tatib/tindakan/{siswa_id}' and 'PUT' in r.methods)
    assert wajib_input_tatib in [d.call for d in route.dependant.dependencies]


async def test_riwayat_tindakan_per_siswa(db, tanpa_audit):
    await api.ubah_status_tindakan('s1', _status(catatan='awal'), GURU)
    await api.ubah_status_tindakan('s1', _status(status_sp='Diserahkan'), GURU)
    await api.ubah_status_tindakan('s1', _status(semester_id='sem0', keterangan_sp='SP2'), GURU)
    await api.ubah_status_tindakan('s2', _status(), GURU)

    r = await api.riwayat_tindakan_siswa('s1', semester_id='sem1', user=PIMPINAN)
    assert len(r) == 2 and r[0]['perubahan'] == [{'field': 'status_sp', 'dari': 'Tidak perlu', 'ke': 'Diserahkan'}]
    assert r[1]['catatan'] == 'awal' and r[0]['waktu'] >= r[1]['waktu']  # terbaru dulu
    assert all(x['siswa_id'] == 's1' for x in r)
    semua = await api.riwayat_tindakan_siswa('s1', semua_semester=True, user=PIMPINAN)
    assert len(semua) == 3
    assert await api.riwayat_tindakan_siswa('s3', semester_id='sem1', user=PIMPINAN) == []
    with pytest.raises(HTTPException) as e:
        await api.riwayat_tindakan_siswa('tidak-ada', user=PIMPINAN)
    assert e.value.status_code == 404


def test_semua_endpoint_tindakan_berpenjaga_peran():
    """Baca (GET): peran input + lihat tatib. Ubah (selain GET): hanya peran input (admin, guru tatib, waka kesiswaan);
    ubah ambang SP & riwayatnya lebih ketat: hanya admin."""
    from routers.tatib_poin import wajib_input_tatib, wajib_lihat_tatib
    assert api.router.routes, 'router tindakan kosong'
    for route in api.router.routes:
        calls = [d.call for d in route.dependant.dependencies]
        for method in route.methods:
            if (method != 'GET' and route.path == '/tatib/ambang-sp') or route.path == '/tatib/ambang-sp/riwayat':
                assert any('require_role' in c.__qualname__ for c in calls), f'{method} {route.path}'
                continue
            harus = wajib_lihat_tatib if method == 'GET' else wajib_input_tatib
            assert harus in calls, f'{method} {route.path}'


async def test_penjaga_peran_tindakan():
    from routers.tatib_poin import wajib_input_tatib, wajib_lihat_tatib
    peran = lambda r: {'id': 'x', 'roles': [r], 'active_role': r}  # noqa: E731
    for r in ('admin', 'guru_tata_tertib', 'waka_kesiswaan'):
        assert await wajib_input_tatib(peran(r)) and await wajib_lihat_tatib(peran(r))
    for r in ('guru_bk', 'kepala_sekolah', 'penjamin_mutu', 'kepala_tata_usaha', 'waka_kurikulum'):
        assert await wajib_lihat_tatib(peran(r))
        with pytest.raises(HTTPException) as e:
            await wajib_input_tatib(peran(r))
        assert e.value.status_code == 403
    for r in ('wali_kelas', 'siswa', 'guru_mapel', 'guru_piket'):
        with pytest.raises(HTTPException):
            await wajib_lihat_tatib(peran(r))
    # admin tetap boleh mengubah walau peran aktifnya lain
    assert await wajib_input_tatib({'id': 'x', 'roles': ['admin', 'guru_mapel'], 'active_role': 'guru_mapel'})


async def test_lihat_ambang_sp_aktif(db):
    a = await api.lihat_ambang_sp(PIMPINAN)
    assert (a['sp1'], a['sp2'], a['sp3'], a['bawaan']) == (25, 50, 75, True)
    await db.pengaturan_ambang_sp.insert_one({'_id': 'ambang_sp', 'sp1': 10, 'sp2': 20, 'sp3': 30, 'alasan': 'rapat',
                                              'diubah_oleh_nama': 'Admin', 'diubah_pada': '2026-10-16T01:00:00'})
    a = await api.lihat_ambang_sp(PIMPINAN)
    assert (a['sp1'], a['sp2'], a['sp3'], a['alasan'], a['diubah_oleh_nama'], a['bawaan']) == (10, 20, 30, 'rapat', 'Admin', False)


ADMIN = {'id': 'a1', 'full_name': 'Admin', 'roles': ['admin'], 'active_role': 'admin'}


async def test_simpan_ambang_sp_admin_dan_riwayat(db, tanpa_audit):
    a = await api.simpan_ambang_sp(api.AmbangSpRequest(sp1=30, sp2=60, sp3=90, alasan='  rapat dewan guru '), ADMIN)
    assert (a['sp1'], a['sp2'], a['sp3'], a['alasan'], a['diubah_oleh_nama'], a['bawaan']) == (30, 60, 90, 'rapat dewan guru', 'Admin', False)
    r = await db.pengaturan_ambang_sp_riwayat.find({}, {'_id': 0}).to_list(None)
    # perubahan pertama: "dari" = nilai bawaan yang sebelumnya berlaku
    assert len(r) == 1 and r[0]['dari'] == {'sp1': 25, 'sp2': 50, 'sp3': 75} and r[0]['ke'] == {'sp1': 30, 'sp2': 60, 'sp3': 90}
    assert (r[0]['oleh_id'], r[0]['oleh_nama'], r[0]['alasan']) == ('a1', 'Admin', 'rapat dewan guru')
    # langsung dipakai untuk usulan SP
    usulan = {s['siswa_id']: s['usulan_sp'] for s in (await api.daftar_tindakan(semester_id='sem1', user=PIMPINAN))['items']}
    assert usulan == {'s2': 'SP2', 's1': 'SP1', 's3': None}  # s2 -60 >= 60, s1 -35 >= 30
    # simpan nilai sama: tidak dicatat
    await api.simpan_ambang_sp(api.AmbangSpRequest(sp1=30, sp2=60, sp3=90), ADMIN)
    assert await db.pengaturan_ambang_sp_riwayat.count_documents({}) == 1
    await api.simpan_ambang_sp(api.AmbangSpRequest(sp1=30, sp2=55, sp3=90), ADMIN)
    terbaru = await db.pengaturan_ambang_sp_riwayat.find({}, {'_id': 0}).sort('waktu', -1).to_list(1)
    assert terbaru[0]['dari'] == {'sp1': 30, 'sp2': 60, 'sp3': 90} and terbaru[0]['ke']['sp2'] == 55


@pytest.mark.parametrize('nilai', [(0, 10, 20), (20, 10, 30), (10, 20, 20), (10, 20, 10001)])
async def test_simpan_ambang_sp_validasi(db, tanpa_audit, nilai):
    with pytest.raises(HTTPException) as e:
        await api.simpan_ambang_sp(api.AmbangSpRequest(sp1=nilai[0], sp2=nilai[1], sp3=nilai[2]), ADMIN)
    assert e.value.status_code == 400
    assert await db.pengaturan_ambang_sp.count_documents({}) == 0


async def test_simpan_ambang_sp_hanya_admin():
    route = next(r for r in api.router.routes if r.path == '/tatib/ambang-sp' and 'PUT' in r.methods)
    penjaga = [d.call for d in route.dependant.dependencies]
    assert len(penjaga) == 1 and 'require_role' in penjaga[0].__qualname__
    for peran in ('guru_tata_tertib', 'waka_kesiswaan', 'kepala_sekolah'):
        with pytest.raises(HTTPException) as e:
            await penjaga[0]({'id': 'x', 'roles': [peran], 'active_role': peran})
        assert e.value.status_code == 403
    assert await penjaga[0](ADMIN)


async def test_riwayat_ambang_berantai_dan_dari_selalu_nilai_sebelumnya(db, tanpa_audit):
    urutan = [(30, 60, 90), (30, 55, 90), (20, 55, 80), (25, 50, 75)]
    for sp1, sp2, sp3 in urutan:
        await api.simpan_ambang_sp(api.AmbangSpRequest(sp1=sp1, sp2=sp2, sp3=sp3, alasan=f'ubah {sp1}'), ADMIN)
    r = await db.pengaturan_ambang_sp_riwayat.find({}, {'_id': 0}).sort('waktu', 1).to_list(None)
    assert len(r) == 4
    for sebelum, sesudah in zip(r, r[1:]):
        assert sesudah['dari'] == sebelum['ke']  # rantai riwayat utuh
    assert r[-1]['ke'] == {'sp1': 25, 'sp2': 50, 'sp3': 75} and r[-1]['alasan'] == 'ubah 25'
    # dokumen rusak dianggap bawaan saat menjadi "dari"
    await db.pengaturan_ambang_sp.update_one({'_id': 'ambang_sp'}, {'$set': {'sp1': 99}})
    await api.simpan_ambang_sp(api.AmbangSpRequest(sp1=10, sp2=20, sp3=30), ADMIN)
    terbaru = await db.pengaturan_ambang_sp_riwayat.find({}, {'_id': 0}).sort('waktu', -1).to_list(1)
    assert terbaru[0]['dari'] == {'sp1': 25, 'sp2': 50, 'sp3': 75}


def test_ambang_dari_dokumen():
    assert api.ambang_dari_dokumen(None) == {'sp1': 25, 'sp2': 50, 'sp3': 75}
    assert api.ambang_dari_dokumen({'sp1': 5, 'sp2': 6, 'sp3': 7}) == {'sp1': 5, 'sp2': 6, 'sp3': 7}
    assert api.ambang_dari_dokumen({'sp1': 9, 'sp2': 6, 'sp3': 7}) == {'sp1': 25, 'sp2': 50, 'sp3': 75}


async def test_daftar_riwayat_ambang_terbaru_dulu(db, tanpa_audit):
    assert await api.riwayat_ambang_sp(user=ADMIN) == []
    for sp1 in (30, 31, 32):
        await api.simpan_ambang_sp(api.AmbangSpRequest(sp1=sp1, sp2=60, sp3=90, alasan=f'a{sp1}'), ADMIN)
    r = await api.riwayat_ambang_sp(user=ADMIN)
    assert [x['ke']['sp1'] for x in r] == [32, 31, 30] and r[0]['alasan'] == 'a32' and r[0]['oleh_nama'] == 'Admin'
    assert [x['ke']['sp1'] for x in await api.riwayat_ambang_sp(batas=2, user=ADMIN)] == [32, 31]
    assert len(await api.riwayat_ambang_sp(batas=0, user=ADMIN)) == 1  # batas minimal 1


async def test_ambang_baru_langsung_dipakai_semua_perhitungan_usulan(db, tanpa_audit):
    """Ubah ambang -> rekap, usulan per siswa, ringkasan, dan riwayat tindakan memakai ambang baru;
    keterangan SP yang sudah ditetapkan manual tidak berubah."""
    await api.ubah_status_tindakan('s1', _status(keterangan_sp='SP1'), GURU)  # s1 -35, s2 -60 (sem1)
    awal = {s['siswa_id']: s['usulan_sp'] for s in (await api.daftar_tindakan(semester_id='sem1', user=PIMPINAN))['items']}
    assert awal == {'s2': 'SP2', 's1': 'SP1', 's3': None}

    await api.simpan_ambang_sp(api.AmbangSpRequest(sp1=10, sp2=30, sp3=60), ADMIN)
    rekap = await api.daftar_tindakan(semester_id='sem1', user=PIMPINAN)
    assert rekap['ambang'] == {'sp1': 10, 'sp2': 30, 'sp3': 60}
    baru = {s['siswa_id']: (s['usulan_sp'], s['keterangan_sp']) for s in rekap['items']}
    assert baru == {'s2': ('SP3', None), 's1': ('SP2', 'SP1'), 's3': (None, None)}  # keputusan manual tetap SP1
    u = await api.usulan_sp_siswa('s1', semester_id='sem1', user=PIMPINAN)
    assert (u['usulan_sp'], u['ambang_berikutnya'], u['perlu_ditinjau']) == ('SP2', {'sp': 'SP3', 'ambang': 60, 'sisa': 25}, True)
    ring = await api.ringkasan_usulan_sp(semester_id='sem1', user=PIMPINAN)
    assert ring['jumlah'] == {'SP1': 0, 'SP2': 1, 'SP3': 1} and ring['perlu_ditinjau'] == 2
    # riwayat tindakan berikutnya mencatat usulan menurut ambang baru
    await api.ubah_status_tindakan('s1', _status(keterangan_sp='SP2'), GURU)
    terbaru = await api.riwayat_tindakan_siswa('s1', semester_id='sem1', user=PIMPINAN)
    assert terbaru[0]['usulan_sp'] == 'SP2'

    # pencarian per usulan juga mengikuti ambang baru
    assert [s['siswa_id'] for s in (await api.daftar_tindakan(semester_id='sem1', usulan_sp='SP3', user=PIMPINAN))['items']] == ['s2']
