"""Alur HTTP menu Link Soal (ber-login): admin mengatur tautan soal & jendela tombol "Mengerjakan" per jenjang per mapel;
pemantau melihat tanpa alamat soal; simpan menimpa dengan cek versi; penghitung klik tidak pernah tertimpa."""
import os
import sys
from datetime import datetime

import pytest

sys.path.insert(0, os.path.dirname(__file__))

from ujian_dasar import HARI_INI, buat_klien, ujian_doc  # noqa: E402

URL = '/ujian/uas/link-soal'
JENDELA = {'mulai_at': f'{HARI_INI}T07:30:00+07:00', 'selesai_at': f'{HARI_INI}T09:00:00+07:00'}


@pytest.fixture
def klien(monkeypatch):
    import routers.ujian_link_soal as rls
    import ujian_info
    k = buat_klien(monkeypatch)
    kini = datetime.fromisoformat(f'{HARI_INI}T06:00:00+07:00')
    k.detik = 0

    def sekarang():
        k.detik += 1  # tiap penyimpanan mendapat waktu (= versi) berbeda
        return kini.replace(second=k.detik % 60, minute=k.detik // 60)
    monkeypatch.setattr(rls, 'sekarang_wib', sekarang)
    monkeypatch.setattr(ujian_info, 'sekarang_wib', sekarang)
    k.db.ujian.docs.append(ujian_doc('uas', 'UAS', 'sem-kini', '2026-12-01', '2026-12-06', nama='ASAS Ganjil 2026/2027'))
    k.db.panitia_ujian.docs += [{'id': 'p1', 'ujian_id': 'uas', 'jabatan': 'ketua', 'user_id': 'guru1'},
                                {'id': 'p2', 'ujian_id': 'uas', 'jabatan': 'bendahara', 'user_id': 'guru2'}]
    k.db.jadwal_ujian.docs.append({'id': 'j1', 'ujian_id': 'uas', 'tanggal': HARI_INI, 'sesi_ke': 1, 'jam_mulai': '07:30',
                                   'jam_selesai': '09:00', 'mapel': {'7': 'Matematika', '8': 'IPA', '9': "Al-Qur'an Hadits"}})
    return k


def simpan(k, jenjang, mapel, isi, versi=None, uid='admin', peran='admin'):
    return k(uid, peran, 'PUT', f'{URL}/{jenjang}/{mapel}', json={**JENDELA, 'versi': versi, **isi})


def entri(d, jenjang, mapel):
    return next(x for x in d['link'] if (x['jenjang'], x['mapel']) == (jenjang, mapel))


def test_admin_melihat_45_entri_dengan_jendela_dari_jadwal(klien):
    r = klien('admin', 'admin', 'GET', URL)
    assert r.status_code == 200, r.text
    assert r.headers['cache-control'] == 'no-store'
    d = r.json()
    assert d['boleh_ubah'] is True and d['ujian']['nama'] == 'ASAS Ganjil 2026/2027' and len(d['mapel']['7']) == 15
    assert len(d['link']) == 45 and [x['mapel'] for x in d['link'][:2]] == ['bahasa_indonesia', 'akidah_akhlak']
    m7 = entri(d, 7, 'matematika')
    assert (m7['id'], m7['url'], m7['siap'], m7['versi']) == (None, '', False, None)
    assert (m7['mulai_at'], m7['selesai_at'], m7['jadwal']['sesi_ke']) == (JENDELA['mulai_at'], JENDELA['selesai_at'], 1)
    assert entri(d, 9, 'quran_hadits')['jadwal']['tanggal'] == HARI_INI  # nama jadwal "Al-Qur'an Hadits" dikenali
    assert entri(d, 7, 'ipa')['mulai_at'] is None  # tidak ada di jadwal
    # tautan portal dibuat tertutup bila belum ada (sekaligus info & monitoring)
    assert d['tautan_portal']['jenis'] == 'portal' and d['tautan_portal']['aktif'] is False
    assert d['tautan_portal']['jalur'].startswith('/publik/portal-ujian/') and d['tautan_portal']['alasan'] == 'nonaktif'
    assert sorted(t['jenis'] for t in klien.db.ujian_tautan_publik.docs) == ['info', 'monitoring', 'portal']


def test_simpan_menimpa_dengan_cek_versi(klien):
    r = simpan(klien, 7, 'matematika', {'url': ' https://cbt.madrasah.sch.id/ujian/mtk-7 '})
    assert r.status_code == 200, r.text
    l1 = r.json()['link']
    assert l1['url'] == 'https://cbt.madrasah.sch.id/ujian/mtk-7' and l1['url_host'] == 'cbt.madrasah.sch.id' and l1['siap']
    assert l1['versi'] and l1['diperbarui_oleh_nama'] == 'Administrator' and r.json()['peringatan'] == []
    assert simpan(klien, 7, 'matematika', {'url': 'https://x.id'}).status_code == 409  # versi lama (None) ditolak
    r = simpan(klien, 7, 'matematika', {'url': 'https://cbt.madrasah.sch.id/ujian/mtk-7b', 'aktif': False}, versi=l1['versi'])
    assert r.status_code == 200, r.text
    l2 = r.json()['link']
    assert l2['id'] == l1['id'] and l2['versi'] != l1['versi'] and not l2['siap'] and l2['aktif'] is False
    assert any('ditahan panitia' in p for p in r.json()['peringatan'])
    assert simpan(klien, 7, 'matematika', {'url': 'https://y.id'}, versi=l1['versi']).status_code == 409
    assert len(klien.db.ujian_link_soal.docs) == 1  # satu dokumen per ujian+jenjang+mapel
    assert [a['action'] for a in klien.db.audit_logs.docs if a['action'].startswith('ujian_link')] == ['ujian_link_soal_ubah'] * 2


def test_simpan_tidak_menimpa_penghitung_klik(klien):
    l1 = simpan(klien, 8, 'ipa', {'url': 'https://cbt.id/ipa-8'}).json()['link']
    doc = klien.db.ujian_link_soal.docs[0]
    doc['jumlah_klik'], doc['klik_terakhir_at'] = 37, f'{HARI_INI}T07:59:00+07:00'  # klik siswa di sela-sela
    r = simpan(klien, 8, 'ipa', {'url': 'https://cbt.id/ipa-8-baru', 'mulai_at': f'{HARI_INI}T07:45:00+07:00'}, versi=l1['versi'])
    assert r.status_code == 200, r.text
    assert (r.json()['link']['jumlah_klik'], r.json()['link']['klik_terakhir_at']) == (37, f'{HARI_INI}T07:59:00+07:00')
    assert doc['url'] == 'https://cbt.id/ipa-8-baru' and doc['mulai_at'] == f'{HARI_INI}T07:45:00+07:00'


@pytest.mark.parametrize('jenjang,mapel,isi,pesan', [
    (7, 'matematika', {'url': 'javascript:alert(1)'}, 'http'),
    (7, 'matematika', {'url': 'data:text/html,x'}, 'http'),
    (7, 'matematika', {'selesai_at': f'{HARI_INI}T07:00:00+07:00'}, 'setelah waktu mulai'),
    (6, 'matematika', {}, 'Jenjang'),
    (7, 'mapel_lain', {}, 'tidak dikenal'),
])
def test_isian_tidak_sah_ditolak(klien, jenjang, mapel, isi, pesan):
    r = simpan(klien, jenjang, mapel, {'url': 'https://cbt.id', **isi})
    assert r.status_code == 422 and pesan in r.text, r.text
    assert not klien.db.ujian_link_soal.docs


def test_peringatan_jendela(klien):
    r = simpan(klien, 7, 'matematika', {'url': 'https://cbt.id', 'mulai_at': f'{HARI_INI}T07:00:00+07:00'})
    assert r.status_code == 200 and any('melebar dari sesi jadwal' in p for p in r.json()['peringatan'])
    r = simpan(klien, 7, 'ipa', {'url': 'https://cbt.id', 'mulai_at': '2026-12-08T07:30:00+07:00', 'selesai_at': '2026-12-08T09:00:00+07:00'})
    assert r.status_code == 200 and any('di luar masa ujian' in p for p in r.json()['peringatan'])


@pytest.mark.parametrize('uid,peran', [('kamad', 'kepala_sekolah'), ('wakakur', 'waka_kurikulum'), ('guru1', 'guru')])
def test_pemantau_melihat_tanpa_alamat_soal(klien, uid, peran):
    simpan(klien, 7, 'matematika', {'url': 'https://cbt.madrasah.sch.id/ujian/rahasia-mtk'})
    r = klien(uid, peran, 'GET', URL)
    assert r.status_code == 200, r.text
    d = r.json()
    m7 = entri(d, 7, 'matematika')
    assert d['boleh_ubah'] is False and m7['url'] == '' and m7['url_host'] == 'cbt.madrasah.sch.id' and m7['siap']
    assert 'rahasia-mtk' not in r.text
    assert simpan(klien, 7, 'matematika', {'url': 'https://x.id'}, uid=uid, peran=peran).status_code == 403


@pytest.mark.parametrize('uid,peran', [('guru2', 'guru'), ('tu1', 'tenaga_kependidikan'), ('siswa1', 'siswa')])
def test_bukan_pemantau_ditolak(klien, uid, peran):
    assert klien(uid, peran, 'GET', URL).status_code == 403
    assert simpan(klien, 7, 'matematika', {'url': 'https://x.id'}, uid=uid, peran=peran).status_code == 403


def test_balapan_dua_admin_baris_baru_ditolak_indeks_unik(klien, monkeypatch):
    """Dua admin menyimpan mapel yang belum pernah diatur pada saat bersamaan: keduanya lolos cek versi (None), tetapi
    indeks unik (ujian_id, jenjang, mapel) menolak sisipan kedua -> 409, bukan dokumen ganda atau timpaan diam-diam."""
    from pymongo.errors import DuplicateKeyError
    koleksi = klien.db.ujian_link_soal

    async def tolak(_doc):
        raise DuplicateKeyError('E11000 duplicate key error: link_soal_unik_mapel')
    monkeypatch.setattr(koleksi, 'insert_one', tolak)
    r = simpan(klien, 7, 'matematika', {'url': 'https://cbt.id/b'})
    assert r.status_code == 409 and 'diubah admin lain' in r.json()['detail']
    assert not koleksi.docs


def test_balapan_dua_admin_ubah_bersyarat_versi(klien, monkeypatch):
    """Admin B menyimpan di antara pembacaan & penulisan admin A: update bersyarat versi tidak cocok -> 409 untuk A,
    isian B tetap utuh."""
    l1 = simpan(klien, 7, 'matematika', {'url': 'https://cbt.id/a'}).json()['link']
    koleksi = klien.db.ujian_link_soal
    asli = koleksi.update_one

    async def sela(q, u, upsert=False):
        koleksi.docs[0].update({'url': 'https://cbt.id/dari-admin-b', 'diperbarui_pada': 'versi-admin-b'})  # B lebih dulu
        return await asli(q, u, upsert=upsert)
    monkeypatch.setattr(koleksi, 'update_one', sela)
    r = simpan(klien, 7, 'matematika', {'url': 'https://cbt.id/dari-admin-a'}, versi=l1['versi'])
    assert r.status_code == 409
    assert (koleksi.docs[0]['url'], koleksi.docs[0]['diperbarui_pada']) == ('https://cbt.id/dari-admin-b', 'versi-admin-b')


def test_versi_berganti_tiap_simpan(klien):
    versi = [None]
    for i in range(3):
        r = simpan(klien, 9, 'ipa', {'url': f'https://cbt.id/{i}'}, versi=versi[-1])
        assert r.status_code == 200, r.text
        versi.append(r.json()['link']['versi'])
    assert len(set(versi)) == 4


# ---- Bangun ulang penghitung klik dari jejak audit ----
def log_klik(link_id, hasil='ok', waktu='07:40', ujian='uas', aksi='klik_mengerjakan'):
    return {'id': f'log-{link_id}-{hasil}-{waktu}', 'ujian_id': ujian, 'tautan_id': 't-portal', 'jenis_tautan': 'portal', 'aksi': aksi,
            'hasil': hasil, 'link_soal_id': link_id, 'waktu': f'{HARI_INI}T{waktu}:00+07:00'}


def siapkan_klik(k):
    k.db.ujian_link_soal.docs += [
        {'id': 'l-mtk', 'ujian_id': 'uas', 'jenjang': 7, 'mapel': 'matematika', 'url': 'https://cbt.id/m', 'aktif': True, **JENDELA,
         'jumlah_klik': 1, 'klik_terakhir_at': f'{HARI_INI}T07:35:00+07:00', 'diperbarui_pada': 'v1'},   # cache tertinggal
        {'id': 'l-ipa', 'ujian_id': 'uas', 'jenjang': 8, 'mapel': 'ipa', 'url': 'https://cbt.id/i', 'aktif': True, **JENDELA,
         'jumlah_klik': 5, 'klik_terakhir_at': f'{HARI_INI}T08:10:00+07:00', 'diperbarui_pada': 'v1'},   # cache berlebih
        {'id': 'l-ips', 'ujian_id': 'uas', 'jenjang': 9, 'mapel': 'ips', 'url': 'https://cbt.id/s', 'aktif': True, **JENDELA,
         'jumlah_klik': 1, 'klik_terakhir_at': f'{HARI_INI}T07:31:00+07:00', 'diperbarui_pada': 'v1'},   # sudah sesuai
    ]
    k.db.ujian_akses_log.docs += [
        log_klik('l-mtk', waktu='07:35'), log_klik('l-mtk', waktu='07:50'), log_klik('l-mtk', waktu='07:41'),
        log_klik('l-mtk', hasil='sudah_selesai', waktu='09:05'),                 # ditolak: tidak dihitung
        log_klik('l-ipa', waktu='07:45'), log_klik('l-ipa', waktu='07:44', ujian='ujian-lain'),
        log_klik('l-ipa', hasil='ok', waktu='07:46', aksi='buka_tautan'),         # pembukaan, bukan klik
        log_klik('l-ips', waktu='07:31'),
    ]


def test_bangun_ulang_klik_dari_jejak_audit(klien):
    siapkan_klik(klien)
    log_sebelum = [dict(x) for x in klien.db.ujian_akses_log.docs]
    r = klien('admin', 'admin', 'POST', f'{URL}/bangun-ulang-klik')
    assert r.status_code == 200, r.text
    d = r.json()
    assert (d['diperiksa'], d['diperbaiki'], d['berubah']) == (3, 2, [])
    assert d['selisih'] == [
        {'jenjang': 7, 'mapel': 'matematika', 'sebelum': 1, 'sesudah': 3, 'klik_terakhir_at': f'{HARI_INI}T07:50:00+07:00'},
        {'jenjang': 8, 'mapel': 'ipa', 'sebelum': 5, 'sesudah': 1, 'klik_terakhir_at': f'{HARI_INI}T07:45:00+07:00'},
    ]
    assert entri(d, 7, 'matematika')['jumlah_klik'] == 3 and len(d['link']) == 45
    assert klien.db.ujian_akses_log.docs == log_sebelum  # jejak audit tidak diubah
    assert any(a['action'] == 'ujian_link_soal_bangun_ulang_klik' for a in klien.db.audit_logs.docs)
    ulang = klien('admin', 'admin', 'POST', f'{URL}/bangun-ulang-klik').json()
    assert (ulang['diperbaiki'], ulang['selisih']) == (0, [])  # idempoten
    # portal membaca cache yang sudah sama dengan log
    assert klien.db.ujian_link_soal.docs[0]['jumlah_klik'] == 3


def test_bangun_ulang_tidak_menimpa_klik_yang_masuk_saat_dihitung(klien, monkeypatch):
    siapkan_klik(klien)
    koleksi = klien.db.ujian_link_soal
    asli = koleksi.update_one

    async def sela(q, u, upsert=False):
        if q.get('id') == 'l-mtk':  # klik siswa masuk di antara penghitungan & penulisan
            koleksi.docs[0]['jumlah_klik'] += 1
        return await asli(q, u, upsert=upsert)
    monkeypatch.setattr(koleksi, 'update_one', sela)
    d = klien('admin', 'admin', 'POST', f'{URL}/bangun-ulang-klik').json()
    assert d['berubah'] == [{'jenjang': 7, 'mapel': 'matematika'}] and [s['mapel'] for s in d['selisih']] == ['ipa']
    assert koleksi.docs[0]['jumlah_klik'] == 2  # klik baru tetap ada; dijalankan ulang untuk disamakan


@pytest.mark.parametrize('uid,peran', [('kamad', 'kepala_sekolah'), ('guru1', 'guru'), ('guru2', 'guru')])
def test_bangun_ulang_hanya_admin(klien, uid, peran):
    siapkan_klik(klien)
    assert klien(uid, peran, 'POST', f'{URL}/bangun-ulang-klik').status_code == 403
    assert klien.db.ujian_link_soal.docs[0]['jumlah_klik'] == 1


def test_skrip_bangun_ulang_semua_ujian(klien):
    import asyncio

    from migrations.bangun_ulang_klik_portal import jalankan
    siapkan_klik(klien)
    kering = asyncio.run(jalankan(klien.db, dry_run=True))
    assert (kering['ujian'], kering['diperbaiki'], kering['dry_run']) == (1, 2, True) and klien.db.ujian_link_soal.docs[0]['jumlah_klik'] == 1
    hasil = asyncio.run(jalankan(klien.db, 'uas'))
    assert hasil['diperbaiki'] == 2 and klien.db.ujian_link_soal.docs[0]['jumlah_klik'] == 3
    assert asyncio.run(jalankan(klien.db))['diperbaiki'] == 0


def test_mapel_nonaktif_di_master_ikut_hilang(klien):
    """Master ujian_mapel_baku satu-satunya sumber: mapel yang dinonaktifkan admin tidak tampil di Link Soal, tidak dapat
    disimpan, dan sama dengan GET /ujian/mapel-baku."""
    import asyncio

    import ujian_info as ui
    asyncio.run(ui.seed_mapel_baku(klien.db))
    next(d for d in klien.db.ujian_mapel_baku.docs if d['jenjang'] == 8 and d['kode'] == 'ipa')['aktif'] = False
    d = klien('admin', 'admin', 'GET', URL).json()
    assert len(d['link']) == 44 and (8, 'ipa') not in {(x['jenjang'], x['mapel']) for x in d['link']}
    assert d['mapel'] == klien('admin', 'admin', 'GET', '/ujian/mapel-baku').json()['jenjang']
    assert simpan(klien, 8, 'ipa', {'url': 'https://cbt.id'}).status_code == 422
    assert simpan(klien, 7, 'ipa', {'url': 'https://cbt.id'}).status_code == 200  # jenjang lain tetap aktif


# ---- Intensitas klik (dari jejak audit) ----
def test_intensitas_klik_dari_jejak_audit(klien):
    siapkan_klik(klien)
    klien.db.ujian_akses_log.docs.append(log_klik('l-mtk', waktu='08:00'))
    klien.db.ujian_akses_log.docs[-1]['waktu'] = '2026-12-03T08:15:00+07:00'  # hari berikutnya (susulan)
    r = klien('admin', 'admin', 'GET', f'{URL}/intensitas')
    assert r.status_code == 200, r.text
    assert r.headers['cache-control'] == 'no-store'
    d = r.json()
    assert d['rentang'] == {'dari': None, 'sampai': None} and d['hari'] == [HARI_INI, '2026-12-03']
    assert len(d['intensitas']) == 45
    x = {(i['jenjang'], i['mapel']): i for i in d['intensitas']}
    mtk = x[(7, 'matematika')]
    assert (mtk['link_soal_id'], mtk['jumlah_klik'], mtk['klik_terakhir_at'], mtk['url_host'], mtk['siap']) == (
        'l-mtk', 4, '2026-12-03T08:15:00+07:00', 'cbt.id', True)  # dari log (bukan cache 1); klik ditolak tidak dihitung
    assert mtk['harian'] == [{'tanggal': HARI_INI, 'jumlah': 3}, {'tanggal': '2026-12-03', 'jumlah': 1}]
    assert x[(8, 'ipa')]['jumlah_klik'] == 1  # bukan cache 5; log ujian lain & pembukaan tautan diabaikan
    assert (x[(9, 'ips')]['jumlah_klik'], x[(7, 'ipa')]['jumlah_klik'], x[(7, 'ipa')]['link_soal_id']) == (1, 0, None)
    assert x[(9, 'quran_hadits')]['mulai_at'] == JENDELA['mulai_at']  # mapel belum diatur: jendela dari jadwal
    assert d['ringkasan'] == {'total_klik': 6, 'mapel_diklik': 3, 'mapel_siap': 3, 'klik_terakhir_at': '2026-12-03T08:15:00+07:00'}
    assert 'https://cbt.id/m' not in r.text  # tautan soal lengkap tidak dikirim


def test_intensitas_rentang_tanggal_dan_validasi(klien):
    siapkan_klik(klien)
    klien.db.ujian_akses_log.docs.append({**log_klik('l-mtk', waktu='08:00'), 'id': 'besok', 'waktu': '2026-12-03T08:15:00+07:00'})
    d = klien('admin', 'admin', 'GET', f'{URL}/intensitas', params={'dari': '2026-12-03', 'sampai': '2026-12-03'}).json()
    assert d['rentang'] == {'dari': '2026-12-03', 'sampai': '2026-12-03'} and d['hari'] == ['2026-12-03']
    assert d['ringkasan']['total_klik'] == 1
    for salah in ({'dari': '03-12-2026'}, {'dari': '2026-12-04', 'sampai': '2026-12-03'}, {'sampai': '2026-02-30'}):
        assert klien('admin', 'admin', 'GET', f'{URL}/intensitas', params=salah).status_code == 422, salah


@pytest.mark.parametrize('uid,peran,status', [('kamad', 'kepala_sekolah', 200), ('guru1', 'guru', 200), ('guru2', 'guru', 403),
                                              ('siswa1', 'siswa', 403)])
def test_intensitas_akses(klien, uid, peran, status):
    assert klien(uid, peran, 'GET', f'{URL}/intensitas').status_code == status


def test_rincian_klik_mapel_dengan_ip(klien):
    siapkan_klik(klien)
    for i, (ip, ua) in enumerate([('103.47.12.10', 'Chrome Android'), ('103.47.12.10', 'Chrome Android'), ('114.10.2.3', 'Safari iOS')]):
        klien.db.ujian_akses_log.docs[i].update({'ip': ip, 'perangkat': ua, 'sesi': f's{i}', 'token': 'RahasiaTokenPortal'})
    r = klien('admin', 'admin', 'GET', f'{URL}/l-mtk/klik')
    assert r.status_code == 200, r.text
    assert r.headers['cache-control'] == 'no-store' and 'RahasiaTokenPortal' not in r.text and 'cbt.id/m' not in r.text
    d = r.json()
    assert d['total'] == 3  # klik ditolak (09.05) tidak ikut
    assert [k['waktu'][11:16] for k in d['klik']] == ['07:50', '07:41', '07:35'] and set(d['klik'][0]) == {'id', 'waktu', 'ip', 'perangkat', 'sesi'}
    assert d['per_ip'] == [{'ip': '103.47.12.10', 'jumlah': 2}, {'ip': '114.10.2.3', 'jumlah': 1}]
    assert d['per_perangkat'] == [{'perangkat': 'Chrome Android', 'jumlah': 2}, {'perangkat': 'Safari iOS', 'jumlah': 1}]
    batas = klien('admin', 'admin', 'GET', f'{URL}/l-mtk/klik', params={'batas': 1}).json()
    assert batas['total'] == 3 and len(batas['klik']) == 1 and batas['per_ip'][0]['jumlah'] == 2  # ringkasan tetap dari semua klik
    assert klien('kamad', 'kepala_sekolah', 'GET', f'{URL}/l-mtk/klik').status_code == 200
    assert klien('guru2', 'guru', 'GET', f'{URL}/l-mtk/klik').status_code == 403
    assert klien('admin', 'admin', 'GET', f'{URL}/tidak-ada/klik').status_code == 404
    klien.db.ujian_link_soal.docs[1]['ujian_id'] = 'ujian-lain'
    assert klien('admin', 'admin', 'GET', f'{URL}/l-ipa/klik').status_code == 404  # link soal ujian lain
