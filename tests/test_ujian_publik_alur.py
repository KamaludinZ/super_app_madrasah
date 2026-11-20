"""Alur HTTP tautan publik (tanpa login) modul Ujian: info & jendela formulir, peserta per ruang, kiriman daftar hadir."""
import base64
import io
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(__file__))

from ujian_dasar import HARI_INI, buat_klien, tambah_kelas_siswa, ujian_doc  # noqa: E402


def png_ttd():
    from PIL import Image, ImageDraw
    im = Image.new('RGBA', (300, 100), (0, 0, 0, 0))
    ImageDraw.Draw(im).line([(10, 80), (120, 20), (290, 70)], fill=(0, 0, 0, 255), width=6)
    b = io.BytesIO()
    im.save(b, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


@pytest.fixture
def klien(monkeypatch):
    k = buat_klien(monkeypatch)
    db = k.db
    db.ujian.docs.append(ujian_doc('uas', 'UAS', 'sem-kini', '2026-12-01', '2026-12-06', nama='ASAS Ganjil 2026/2027'))
    tambah_kelas_siswa(db)
    db.panitia_ujian.docs.append({'id': 'p1', 'ujian_id': 'uas', 'jabatan': 'ketua', 'user_id': 'guru1'})
    # Ruang 01 (kelas 7 & 8) berisi 3 siswa, ruang 02 (kelas 9) 1 siswa; formulir aktif 07.00–12.00; 2 sesi hari ini.
    a = lambda m, p, **kw: k('admin', 'admin', m, p, **kw).json()  # noqa: E731
    r1 = a('POST', '/ujian/uas/ruang', json={'nama_ruang': '01', 'jenjang': [7, 8]})
    r2 = a('POST', '/ujian/uas/ruang', json={'nama_ruang': '02', 'jenjang': [9]})
    a('POST', f"/ujian/uas/ruang/{r1['id']}/peserta", json={'siswa_ids': ['s-k7a-1', 's-k7a-2', 's-k8a-1']})
    a('POST', f"/ujian/uas/ruang/{r2['id']}/peserta", json={'siswa_ids': ['s-k9a-1']})
    a('PUT', '/ujian/uas/formulir/jadwal', json={'sesi': [
        {'tanggal': HARI_INI, 'sesi_ke': 1, 'jam_mulai': '07:30', 'jam_selesai': '09:30', 'mapel': {'7': 'Matematika', '8': 'IPA'}},
        {'tanggal': HARI_INI, 'sesi_ke': 2, 'jam_mulai': '10:00', 'jam_selesai': '11:30', 'mapel': {'7': 'IPS'}}]})
    a('PUT', '/ujian/uas/formulir/aktivasi', json={'aktif': True, 'jam_buka': '07:00', 'jam_tutup': '12:00'})
    k.token = next(f for f in db.formulir_ujian.docs if f['ujian_id'] == 'uas')['token']
    k.r1, k.r2 = r1, r2
    return k


def test_info_publik_tanpa_login(klien):
    r = klien(None, None, 'GET', f'/publik/ujian/{klien.token}')
    assert r.status_code == 200, r.text
    d = r.json()
    assert d['ujian']['nama'] == 'ASAS Ganjil 2026/2027' and d['formulir']['terbuka'] and d['formulir']['jam_buka'] == '07:00'
    assert d['tanggal'] == HARI_INI and d['jam'] == '08:00'
    assert d['sesi']['sesi_ke'] == 1 and len(d['sesi_hari_ini']) == 2
    assert [x['nama_ruang'] for x in d['ruang']] == ['01', '02'] and set(d['ruang'][0]) == {'id', 'nama_ruang', 'jenjang'}
    assert set(d['ujian']) == {'nama', 'jenis', 'tahun_pelajaran', 'mulai', 'selesai'}  # tanpa id internal/semester
    r = klien(None, None, 'GET', '/publik/ujian/token-salah')
    assert r.status_code == 404 and 'Tautan tidak ditemukan' in r.json()['detail']


def test_info_publik_formulir_tertutup(klien):
    klien('admin', 'admin', 'PUT', '/ujian/uas/formulir/aktivasi', json={'aktif': False})
    d = klien(None, None, 'GET', f'/publik/ujian/{klien.token}').json()
    assert d['formulir']['terbuka'] is False and d['formulir']['alasan'] == 'nonaktif'


def test_peserta_ruang_publik(klien):
    sesi = klien(None, None, 'GET', f'/publik/ujian/{klien.token}').json()['sesi']
    d = klien(None, None, 'GET', f"/publik/ujian/{klien.token}/ruang/{klien.r1['id']}/peserta", params={'sesi_id': sesi['id']}).json()
    assert [(k['kelas'], k['jumlah']) for k in d['kelas']] == [('7A', 2), ('8A', 1)]
    assert [p['nama'] for p in d['peserta']] == ['Siswa 7A 1', 'Siswa 7A 2', 'Siswa 8A 1']
    assert set(d['peserta'][0]) == {'id', 'nama', 'kelas', 'jenjang', 'nomor_peserta', 'status', 'sudah_hadir'}  # tanpa NIS/NISN
    assert all(p['status'] is None and not p['sudah_hadir'] for p in d['peserta'])
    # Tanda harian izin tampil di sesi itu.
    pid = d['peserta'][0]['id']
    klien.db.daftar_hadir_status.docs.append({'ujian_id': 'uas', 'peserta_id': pid, 'tanggal': HARI_INI, 'status': 'izin'})
    d = klien(None, None, 'GET', f"/publik/ujian/{klien.token}/ruang/{klien.r1['id']}/peserta", params={'sesi_id': sesi['id']}).json()
    assert d['peserta'][0]['status'] == 'izin'
    # Ruang/sesi/token salah.
    assert klien(None, None, 'GET', f"/publik/ujian/{klien.token}/ruang/tidak-ada/peserta").status_code == 404
    assert klien(None, None, 'GET', f"/publik/ujian/{klien.token}/ruang/{klien.r1['id']}/peserta", params={'sesi_id': 'x'}).status_code == 404
    assert klien(None, None, 'GET', f"/publik/ujian/salah/ruang/{klien.r1['id']}/peserta").status_code == 404


def _kirim(klien, peserta_id, sesi_id, ruang_id=None, ttd=None):
    return klien(None, None, 'POST', f'/publik/ujian/{klien.token}/daftar-hadir', json={
        'sesi_id': sesi_id, 'ruang_id': ruang_id or klien.r1['id'], 'peserta_id': peserta_id, 'ttd_png': ttd or png_ttd()})


def test_kirim_daftar_hadir_dengan_tanda_tangan(klien):
    db = klien.db
    info = klien(None, None, 'GET', f'/publik/ujian/{klien.token}').json()
    sesi1, sesi2 = info['sesi_hari_ini']
    peserta = klien(None, None, 'GET', f"/publik/ujian/{klien.token}/ruang/{klien.r1['id']}/peserta").json()['peserta']
    pid = peserta[0]['id']
    r = _kirim(klien, pid, sesi1['id'])
    assert r.status_code == 200, r.text
    h = r.json()
    assert h['nama'] == 'Siswa 7A 1' and h['ruang'] == '01' and h['sesi']['sesi_ke'] == 1 and h['waktu_kirim']
    k = db.daftar_hadir.docs[0]
    assert k['status'] == 'hadir' and k['sesi_id'] == sesi1['id'] and k['tanggal'] == HARI_INI and k['siswa_id'] == 's-k7a-1'
    assert db.daftar_hadir_ttd.docs[0]['png'].startswith(b'\x89PNG') and db.daftar_hadir_ttd.docs[0]['kehadiran_id'] == k['id']
    # Kiriman kedua nama yang sama pada sesi yang sama ditolak (409 terstruktur); sesi lain boleh.
    r = _kirim(klien, pid, sesi1['id'])
    assert r.status_code == 409 and r.json()['detail']['alasan'] == 'sudah_mengisi' and r.json()['detail']['waktu_kirim'] == k['waktu_kirim']
    assert _kirim(klien, pid, sesi2['id']).status_code == 200
    d = klien(None, None, 'GET', f"/publik/ujian/{klien.token}/ruang/{klien.r1['id']}/peserta", params={'sesi_id': sesi1['id']}).json()
    assert next(p for p in d['peserta'] if p['id'] == pid)['sudah_hadir']
    # Peserta ruang lain, TTD kosong, sesi bukan hari ini.
    p9 = next(p['id'] for p in db.peserta_ruang.docs if p['siswa_id'] == 's-k9a-1')
    assert _kirim(klien, p9, sesi1['id']).status_code == 404
    kosong = 'data:image/png;base64,' + base64.b64encode(_png_kosong()).decode()
    r = _kirim(klien, peserta[1]['id'], sesi1['id'], ttd=kosong)
    assert r.status_code == 422 and 'kosong' in r.json()['detail']
    db.jadwal_ujian.docs.append({'id': 'besok', 'ujian_id': 'uas', 'tanggal': '2026-12-03', 'sesi_ke': 1, 'jam_mulai': '07:30', 'jam_selesai': '09:30'})
    assert _kirim(klien, peserta[1]['id'], 'besok').status_code == 403


def test_kirim_ditolak_saat_formulir_tertutup(klien):
    info = klien(None, None, 'GET', f'/publik/ujian/{klien.token}').json()
    pid = klien(None, None, 'GET', f"/publik/ujian/{klien.token}/ruang/{klien.r1['id']}/peserta").json()['peserta'][0]['id']
    klien('admin', 'admin', 'PUT', '/ujian/uas/formulir/aktivasi', json={'aktif': False})
    r = _kirim(klien, pid, info['sesi']['id'])
    assert r.status_code == 403 and r.json()['detail'] == 'Formulir belum dibuka panitia.'
    assert klien.db.daftar_hadir.docs == []


def _png_kosong():
    from PIL import Image
    b = io.BytesIO()
    Image.new('RGBA', (200, 80), (0, 0, 0, 0)).save(b, 'PNG')
    return b.getvalue()


def test_satu_kiriman_per_nama_per_sesi_juga_saat_bersamaan(klien, monkeypatch):
    """Dua kiriman bersamaan untuk nama yang sama: cek awal sama-sama lolos, index unik (peserta_id, sesi_id) menolak
    yang kedua -> 409 terstruktur, dan tanda tangan kiriman kedua tidak tersimpan."""
    from pymongo.errors import DuplicateKeyError
    db = klien.db
    sesi = klien(None, None, 'GET', f'/publik/ujian/{klien.token}').json()['sesi']
    pid = klien(None, None, 'GET', f"/publik/ujian/{klien.token}/ruang/{klien.r1['id']}/peserta").json()['peserta'][0]['id']
    assert _kirim(klien, pid, sesi['id']).status_code == 200
    asli_find_one, asli_insert = db.daftar_hadir.find_one, db.daftar_hadir.insert_one
    panggilan = {'n': 0}

    async def find_one_lolos(q=None, proj=None):  # kiriman kedua "tidak melihat" kiriman pertama (balapan)
        panggilan['n'] += 1
        return None if panggilan['n'] == 1 else await asli_find_one(q, proj)

    async def insert_unik(doc):
        if any(d['peserta_id'] == doc['peserta_id'] and d['sesi_id'] == doc['sesi_id'] for d in db.daftar_hadir.docs):
            raise DuplicateKeyError('dh_unik_peserta_sesi')
        return await asli_insert(doc)
    monkeypatch.setattr(db.daftar_hadir, 'find_one', find_one_lolos)
    monkeypatch.setattr(db.daftar_hadir, 'insert_one', insert_unik)
    r = _kirim(klien, pid, sesi['id'])
    assert r.status_code == 409 and r.json()['detail']['alasan'] == 'sudah_mengisi'
    assert len(db.daftar_hadir.docs) == 1 and len(db.daftar_hadir_ttd.docs) == 1


async def test_index_unik_daftar_hadir_di_mongodb(mongo_db):
    from pymongo.errors import DuplicateKeyError

    from ujian_kehadiran import pastikan_index_kehadiran
    await pastikan_index_kehadiran(mongo_db)
    await mongo_db.daftar_hadir.insert_one({'id': 'a', 'peserta_id': 'p', 'sesi_id': 's1'})
    await mongo_db.daftar_hadir.insert_one({'id': 'b', 'peserta_id': 'p', 'sesi_id': 's2'})
    with pytest.raises(DuplicateKeyError):
        await mongo_db.daftar_hadir.insert_one({'id': 'c', 'peserta_id': 'p', 'sesi_id': 's1'})
    await mongo_db.daftar_hadir_status.insert_one({'id': 'x', 'ujian_id': 'u', 'peserta_id': 'p', 'tanggal': '2026-12-02'})
    with pytest.raises(DuplicateKeyError):
        await mongo_db.daftar_hadir_status.insert_one({'id': 'y', 'ujian_id': 'u', 'peserta_id': 'p', 'tanggal': '2026-12-02'})


def test_admin_daftar_hadir_dan_buka_kunci(klien):
    db = klien.db
    info = klien(None, None, 'GET', f'/publik/ujian/{klien.token}').json()
    sesi = info['sesi']
    peserta = klien(None, None, 'GET', f"/publik/ujian/{klien.token}/ruang/{klien.r1['id']}/peserta").json()['peserta']
    pid = peserta[0]['id']
    _kirim(klien, pid, sesi['id'])

    d = klien('guru1', 'guru', 'GET', '/ujian/uas/daftar-hadir').json()  # ketua: lihat
    assert d['sesi_id'] == sesi['id'] and d['ruang_id'] == klien.r1['id'] and d['boleh_ubah'] is False
    assert [(r['nama_ruang'], r['hadir'], r['belum'], r['lengkap']) for r in d['rekap']] == [('01', 1, 2, False), ('02', 0, 1, False)]
    baris = next(i for i in d['items'] if i['peserta_id'] == pid)
    assert baris['status'] == 'hadir' and baris['ada_ttd'] and baris['waktu_kirim']
    r = klien('kamad', 'kepala_sekolah', 'GET', f"/ujian/uas/daftar-hadir/{baris['id']}/ttd")
    assert r.status_code == 200 and r.headers['content-type'] == 'image/png' and r.content.startswith(b'\x89PNG')
    assert klien('guru2', 'guru', 'GET', '/ujian/uas/daftar-hadir').status_code == 403

    # Buka kunci: alasan wajib, hanya admin; kiriman diarsipkan lalu peserta bisa mengirim ulang.
    url = f"/ujian/uas/daftar-hadir/{baris['id']}/buka-kunci"
    assert klien('admin', 'admin', 'POST', url, json={'alasan': 'oke'}).status_code == 422
    assert klien('guru1', 'guru', 'POST', url, json={'alasan': 'Salah pilih nama'}).status_code == 403
    r = klien('admin', 'admin', 'POST', url, json={'alasan': 'Salah pilih nama teman sekelas'})
    assert r.status_code == 200, r.text
    assert r.json()['riwayat_buka'][0]['alasan'] == 'Salah pilih nama teman sekelas'
    assert db.daftar_hadir.docs == [] and db.daftar_hadir_arsip.docs[0]['png'].startswith(b'\x89PNG')
    assert klien('admin', 'admin', 'POST', url, json={'alasan': 'Salah pilih nama'}).status_code == 404
    audit = next(a for a in db.audit_logs.docs if a['action'] == 'ujian_daftar_hadir_buka_kunci')
    assert audit['details']['alasan'] == 'Salah pilih nama teman sekelas'
    assert _kirim(klien, pid, sesi['id']).status_code == 200  # kirim ulang setelah dibuka
    baris = next(i for i in klien('admin', 'admin', 'GET', '/ujian/uas/daftar-hadir').json()['items'] if i['peserta_id'] == pid)
    assert baris['status'] == 'hadir' and len(baris['riwayat_buka']) == 1
    # Sesi & ruang lain dipilih eksplisit.
    d = klien('admin', 'admin', 'GET', '/ujian/uas/daftar-hadir', params={'sesi_id': info['sesi_hari_ini'][1]['id'], 'ruang_id': klien.r2['id']}).json()
    assert d['ruang_id'] == klien.r2['id'] and d['items'][0]['status'] is None
    assert klien('admin', 'admin', 'GET', '/ujian/uas/daftar-hadir', params={'sesi_id': 'x'}).status_code == 404


def test_tandai_izin_sakit_sekali_per_hari(klien):
    db = klien.db
    info = klien(None, None, 'GET', f'/publik/ujian/{klien.token}').json()
    s1, s2 = info['sesi_hari_ini']
    peserta = klien(None, None, 'GET', f"/publik/ujian/{klien.token}/ruang/{klien.r1['id']}/peserta").json()['peserta']
    a, b, c = (p['id'] for p in peserta)
    _kirim(klien, a, s1['id'])  # a hadir sesi 1 (lalu sakit di sesi 2)

    url = '/ujian/uas/daftar-hadir/status'
    r = klien('admin', 'admin', 'PUT', url, json={'peserta_id': b, 'tanggal': HARI_INI, 'status': 'izin', 'catatan': ''})
    assert r.status_code == 400 and 'Catatan wajib' in r.json()['detail']
    r = klien('admin', 'admin', 'PUT', url, json={'peserta_id': b, 'tanggal': HARI_INI, 'status': 'izin', 'catatan': 'Lomba MTQ tingkat kota'})
    assert r.status_code == 200 and r.json()['sesi_diterapkan'] == 2
    r = klien('admin', 'admin', 'PUT', url, json={'peserta_id': a, 'tanggal': HARI_INI, 'status': 'sakit', 'catatan': 'Pusing setelah sesi 1'})
    assert r.json()['sesi_diterapkan'] == 1  # sesi 1 sudah hadir
    klien('admin', 'admin', 'PUT', url, json={'peserta_id': c, 'tanggal': HARI_INI, 'status': 'alpa', 'catatan': ''})
    assert len(db.daftar_hadir_status.docs) == 3  # satu tanda per peserta per hari

    d1 = klien('admin', 'admin', 'GET', '/ujian/uas/daftar-hadir', params={'sesi_id': s1['id']}).json()
    d2 = klien('admin', 'admin', 'GET', '/ujian/uas/daftar-hadir', params={'sesi_id': s2['id']}).json()
    st = lambda d: {i['peserta_id']: i['status'] for i in d['items']}  # noqa: E731
    assert st(d1) == {a: 'hadir', b: 'izin', c: 'alpa'} and st(d2) == {a: 'sakit', b: 'izin', c: 'alpa'}
    assert d1['rekap'][0]['lengkap'] and d2['rekap'][0] == {**d2['rekap'][0], 'hadir': 0, 'izin': 1, 'sakit': 1, 'alpa': 1, 'lengkap': True}
    assert next(i for i in d1['items'] if i['peserta_id'] == b)['catatan'] == 'Lomba MTQ tingkat kota'
    # Nama berizin tetap boleh hadir bila ternyata datang (kiriman hadir mengalahkan tanda).
    assert _kirim(klien, b, s1['id']).status_code == 200

    # Hapus tanda; tanggal tanpa sesi; bukan admin.
    klien('admin', 'admin', 'PUT', url, json={'peserta_id': c, 'tanggal': HARI_INI, 'status': None})
    assert len(db.daftar_hadir_status.docs) == 2
    assert klien('admin', 'admin', 'PUT', url, json={'peserta_id': c, 'tanggal': '2026-12-05', 'status': 'alpa'}).status_code == 400
    assert klien('admin', 'admin', 'PUT', url, json={'peserta_id': 'x', 'tanggal': HARI_INI, 'status': 'alpa'}).status_code == 404
    assert klien('guru1', 'guru', 'PUT', url, json={'peserta_id': c, 'tanggal': HARI_INI, 'status': 'alpa'}).status_code == 403
    assert {a['details']['ke'] for a in db.audit_logs.docs if a['action'] == 'ujian_daftar_hadir_tanda'} == {'izin', 'sakit', 'alpa', None}


def test_rekap_daftar_hadir_per_ruang_jenjang(klien):
    db = klien.db
    info = klien(None, None, 'GET', f'/publik/ujian/{klien.token}').json()
    s1 = info['sesi_hari_ini'][0]
    pr = {p['siswa_id']: p for p in db.peserta_ruang.docs}
    klien('admin', 'admin', 'PUT', f"/ujian/uas/ruang/{klien.r1['id']}/nomor-peserta", json={'items': [
        {'peserta_id': pr['s-k7a-1']['id'], 'nomor_peserta': '01-001'}, {'peserta_id': pr['s-k7a-2']['id'], 'nomor_peserta': '01-002'},
        {'peserta_id': pr['s-k8a-1']['id'], 'nomor_peserta': '01-003'}]})
    _kirim(klien, pr['s-k7a-1']['id'], s1['id'])
    klien('admin', 'admin', 'PUT', '/ujian/uas/daftar-hadir/status', json={'peserta_id': pr['s-k7a-2']['id'], 'tanggal': HARI_INI, 'status': 'sakit', 'catatan': 'Demam tinggi'})

    d = klien('guru1', 'guru', 'GET', '/ujian/uas/daftar-hadir/rekap').json()
    assert d['tanggal'] == HARI_INI and len(d['sesi']) == 2
    r01 = d['sesi'][0]['ruang'][0]
    assert (r01['nama_ruang'], r01['hadir'], r01['sakit'], r01['belum'], r01['lengkap']) == ('01', 1, 1, 1, False)
    j7, j8 = r01['jenjang']
    assert j7['jenjang'] == 7 and j7['nomor_hadir'] == ['01-001'] and j7['nomor_tidak_hadir'] == ['01-002'] and j7['lengkap']
    assert j8['jenjang'] == 8 and j8['belum'] == 1 and not j8['lengkap']
    assert [k['lengkap'] for k in d['kelengkapan']] == [False, False]
    # Lengkapi ruang 01 untuk kedua sesi.
    klien('admin', 'admin', 'PUT', '/ujian/uas/daftar-hadir/status', json={'peserta_id': pr['s-k8a-1']['id'], 'tanggal': HARI_INI, 'status': 'alpa'})
    _kirim(klien, pr['s-k7a-1']['id'], info['sesi_hari_ini'][1]['id'])
    d = klien('admin', 'admin', 'GET', '/ujian/uas/daftar-hadir/rekap', params={'tanggal': HARI_INI}).json()
    assert d['kelengkapan'][0] == {'ruang_id': klien.r1['id'], 'nama_ruang': '01', 'lengkap': True}
    assert klien('admin', 'admin', 'GET', '/ujian/uas/daftar-hadir/rekap', params={'tanggal': '2026-12-05'}).json()['kelengkapan'][0]['lengkap'] is False
    assert klien('guru2', 'guru', 'GET', '/ujian/uas/daftar-hadir/rekap').status_code == 403


def test_kelengkapan_dan_rekap_berita_acara_publik(klien):
    db = klien.db
    info = klien(None, None, 'GET', f'/publik/ujian/{klien.token}').json()
    s1 = info['sesi']
    pr = {p['siswa_id']: p['id'] for p in db.peserta_ruang.docs}
    d = klien(None, None, 'GET', f'/publik/ujian/{klien.token}/kelengkapan').json()
    assert d['sesi']['id'] == s1['id'] and [(i['nama_ruang'], i['lengkap'], i['belum']) for i in d['items']] == [('01', False, 3), ('02', False, 1)]
    _kirim(klien, pr['s-k7a-1'], s1['id'])
    _kirim(klien, pr['s-k7a-2'], s1['id'])
    klien('admin', 'admin', 'PUT', '/ujian/uas/daftar-hadir/status', json={'peserta_id': pr['s-k8a-1'], 'tanggal': HARI_INI, 'status': 'izin', 'catatan': 'Acara keluarga'})
    r = klien(None, None, 'GET', f"/publik/ujian/{klien.token}/berita-acara/ruang/{klien.r1['id']}", params={'sesi_id': s1['id']}).json()
    assert r['kelengkapan']['lengkap'] and r['sudah_diisi'] is None
    assert [(x['jenjang'], x['mapel'], x['hadir'], x['izin']) for x in r['rekap']] == [(7, 'Matematika', 2, 0), (8, 'IPA', 0, 1)]
    d = klien(None, None, 'GET', f'/publik/ujian/{klien.token}/kelengkapan', params={'sesi_id': s1['id']}).json()
    assert [i['lengkap'] for i in d['items']] == [True, False]
    assert klien(None, None, 'GET', f"/publik/ujian/{klien.token}/berita-acara/ruang/{klien.r1['id']}").status_code == 422  # sesi wajib
    # Pengawas: hanya yang aktif.
    klien('admin', 'admin', 'POST', '/ujian/pengawas', json={'user_ids': ['guru1', 'guru2']})
    hadi = next(p for p in db.guru_pengawas.docs if p['user_id'] == 'guru2')
    klien('admin', 'admin', 'PATCH', f"/ujian/pengawas/{hadi['id']}", json={'aktif': False})
    assert [p['nama'] for p in klien(None, None, 'GET', f'/publik/ujian/{klien.token}/pengawas').json()['items']] == ['Bu Siti']


def test_simpan_berita_acara_publik(klien):
    db = klien.db
    info = klien(None, None, 'GET', f'/publik/ujian/{klien.token}').json()
    s1 = info['sesi']
    pr = {p['siswa_id']: p['id'] for p in db.peserta_ruang.docs}
    klien('admin', 'admin', 'POST', '/ujian/pengawas', json={'user_ids': ['guru1']})
    pg = db.guru_pengawas.docs[0]['id']
    isi = {'sesi_id': s1['id'], 'ruang_id': klien.r1['id'], 'pengawas_id': pg, 'catatan': 'Tertib.', 'ttd_png': png_ttd()}
    url = f'/publik/ujian/{klien.token}/berita-acara'
    # Daftar hadir belum lengkap -> 403 dengan pesan.
    r = klien(None, None, 'POST', url, json=isi)
    assert r.status_code == 403 and 'belum lengkap' in r.json()['detail']
    _kirim(klien, pr['s-k7a-1'], s1['id'])
    _kirim(klien, pr['s-k7a-2'], s1['id'])
    klien('admin', 'admin', 'PUT', '/ujian/uas/daftar-hadir/status', json={'peserta_id': pr['s-k8a-1'], 'tanggal': HARI_INI, 'status': 'sakit', 'catatan': 'Demam tinggi'})
    assert klien(None, None, 'POST', url, json={**isi, 'pengawas_id': 'x'}).status_code == 404
    r = klien(None, None, 'POST', url, json=isi)
    assert r.status_code == 200, r.text
    h = r.json()
    assert h['ruang'] == '01' and h['pengawas_nama'] == 'Bu Siti' and [(x['jenjang'], x['hadir'], x['sakit']) for x in h['rekap']] == [(7, 2, 0), (8, 0, 1)]
    ba = db.berita_acara.docs[0]
    assert ba['jumlah_hadir'] == 2 and ba['jumlah_izin'] == 1 and ba['catatan'] == 'Tertib.' and ba['rekap']['8']['sakit'] == 1
    assert db.berita_acara_ttd.docs[0]['png'].startswith(b'\x89PNG')
    # Satu per ruang per sesi; riwayat publik; tanda tangan panitia.
    assert klien(None, None, 'POST', url, json=isi).status_code == 409
    rw = klien(None, None, 'GET', f'/publik/ujian/{klien.token}/berita-acara/riwayat').json()
    assert rw['items'][0]['nama_ruang'] == '01' and rw['items'][0]['sesi_ke'] == 1
    r = klien('guru1', 'guru', 'GET', f"/ujian/uas/berita-acara/{ba['id']}/ttd")
    assert r.status_code == 200 and r.content.startswith(b'\x89PNG')
    rk = klien(None, None, 'GET', f"/publik/ujian/{klien.token}/berita-acara/ruang/{klien.r1['id']}", params={'sesi_id': s1['id']}).json()
    assert rk['sudah_diisi']['pengawas_nama'] == 'Bu Siti'
    # Formulir ditutup -> 403.
    klien('admin', 'admin', 'PUT', '/ujian/uas/formulir/aktivasi', json={'aktif': False})
    assert klien(None, None, 'POST', url, json={**isi, 'ruang_id': klien.r2['id']}).status_code == 403


def test_daftar_berita_acara_per_ujian(klien):
    db = klien.db
    info = klien(None, None, 'GET', f'/publik/ujian/{klien.token}').json()
    s1 = info['sesi']
    pr = {p['siswa_id']: p['id'] for p in db.peserta_ruang.docs}
    klien('admin', 'admin', 'POST', '/ujian/pengawas', json={'user_ids': ['guru1']})
    _kirim(klien, pr['s-k9a-1'], s1['id'], ruang_id=klien.r2['id'])
    klien(None, None, 'POST', f'/publik/ujian/{klien.token}/berita-acara', json={
        'sesi_id': s1['id'], 'ruang_id': klien.r2['id'], 'pengawas_id': db.guru_pengawas.docs[0]['id'], 'catatan': '', 'ttd_png': png_ttd()})
    d = klien('tu1', 'tenaga_kependidikan', 'GET', '/ujian/uas/berita-acara')  # bukan panitia
    assert d.status_code == 403
    d = klien('kamad', 'kepala_sekolah', 'GET', '/ujian/uas/berita-acara', params={'tanggal': HARI_INI}).json()
    assert len(d['items']) == 2 and d['items'][0]['terisi'] == 1 and d['items'][0]['total'] == 2
    r01, r02 = d['items'][0]['ruang']
    assert r01['berita_acara'] is None and r01['dh_lengkap'] is False
    assert r02['berita_acara']['pengawas_nama'] == 'Bu Siti' and r02['berita_acara']['jumlah_hadir'] == 1
