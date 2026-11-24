"""Alur HTTP Pengelolaan Tautan Publik (ber-login): daftar & detail tautan, inisialisasi otomatis, hak akses."""
import os
import sys
from datetime import datetime

import pytest

sys.path.insert(0, os.path.dirname(__file__))

from ujian_dasar import HARI_INI, buat_klien, ujian_doc  # noqa: E402


@pytest.fixture
def klien(monkeypatch):
    import routers.ujian_tautan_publik as rtp
    import ujian_info
    k = buat_klien(monkeypatch)
    k.kini = datetime.fromisoformat(f'{HARI_INI}T08:00:00+07:00')
    monkeypatch.setattr(rtp, 'sekarang_wib', lambda: k.kini)
    monkeypatch.setattr(ujian_info, 'sekarang_wib', lambda: k.kini)
    k.db.ujian.docs.append(ujian_doc('uas', 'UAS', 'sem-kini', '2026-12-01', '2026-12-06', nama='ASAS Ganjil 2026/2027'))
    k.db.panitia_ujian.docs += [{'id': 'p1', 'ujian_id': 'uas', 'jabatan': 'ketua', 'user_id': 'guru1'},
                                {'id': 'p2', 'ujian_id': 'uas', 'jabatan': 'bendahara', 'user_id': 'guru2'}]
    return k


def test_daftar_tautan_admin_dan_inisialisasi(klien):
    r = klien('admin', 'admin', 'GET', '/ujian/uas/tautan-publik')
    assert r.status_code == 200, r.text
    d = r.json()
    assert d['boleh_ubah'] is True and d['ujian']['nama'] == 'ASAS Ganjil 2026/2027'
    info, mon = d['tautan']['info'], d['tautan']['monitoring']
    assert info['jalur'] == f"/publik/info-ujian/{info['token']}" and mon['jalur'].startswith('/publik/monitoring-ujian/')
    assert (info['aktif'], info['berlaku'], info['alasan']) == (False, False, 'nonaktif')
    assert len(klien.db.ujian_tautan_publik.docs) == 3
    assert klien('admin', 'admin', 'GET', '/ujian/uas/tautan-publik').json()['tautan']['info']['token'] == info['token']  # stabil
    assert len(klien.db.ujian_tautan_publik.docs) == 3


@pytest.mark.parametrize('uid,peran,boleh', [('kamad', 'kepala_sekolah', False), ('wakakur', 'waka_kurikulum', False), ('guru1', 'guru', False)])
def test_pemantau_melihat_tanpa_mengubah(klien, uid, peran, boleh):
    r = klien(uid, peran, 'GET', '/ujian/uas/tautan-publik')
    assert r.status_code == 200 and r.json()['boleh_ubah'] is boleh


@pytest.mark.parametrize('uid,peran', [('guru2', 'guru'), ('tu1', 'tenaga_kependidikan'), ('siswa1', 'siswa')])
def test_bukan_pemantau_ditolak(klien, uid, peran):
    r = klien(uid, peran, 'GET', '/ujian/uas/tautan-publik')
    assert r.status_code == 403 and 'Tautan Publik' in r.json()['detail']
    assert not klien.db.ujian_tautan_publik.docs  # tidak membuat tautan


def test_detail_tautan_dan_validasi(klien):
    assert klien(None, None, 'GET', '/ujian/uas/tautan-publik').status_code == 401
    assert klien('admin', 'admin', 'GET', '/ujian/tidak-ada/tautan-publik').status_code == 404
    assert klien('admin', 'admin', 'GET', '/ujian/uas/tautan-publik/rahasia').status_code == 404
    r = klien('admin', 'admin', 'GET', '/ujian/uas/tautan-publik/monitoring')
    assert r.status_code == 200
    d = r.json()
    assert d['tautan']['jenis'] == 'monitoring' and [x['aksi'] for x in d['riwayat']] == ['buat']
    assert d['tautan']['token'] not in str(d['riwayat'])


def test_menu_tautan_publik_terdaftar():
    import ujian as uj
    keys = [m[0] for m in uj.MENU_UJIAN]
    assert keys.index('tautan_publik') == keys.index('formulir') + 1
    kamad = {m['key']: m for m in uj.menu_panitia_ujian(False, True, [])}
    ketua = {m['key']: m for m in uj.menu_panitia_ujian(False, False, ['ketua'])}
    bendahara = {m['key']: m for m in uj.menu_panitia_ujian(False, False, ['bendahara'])}
    assert kamad['tautan_publik']['akses'] and ketua['tautan_publik']['akses'] and not bendahara['tautan_publik']['akses']


def test_buka_tutup_tautan_admin(klien):
    a = lambda m, p, **kw: klien('admin', 'admin', m, p, **kw)  # noqa: E731
    token = a('GET', '/ujian/uas/tautan-publik').json()['tautan']['info']['token']
    r = a('PUT', '/ujian/uas/tautan-publik/info', json={'aktif': True, 'mulai_at': None, 'selesai_at': None})
    assert r.status_code == 200, r.text
    t = r.json()['tautan']
    assert (t['aktif'], t['berlaku'], t['alasan'], t['token']) == (True, True, 'ok', token)  # token tidak berubah
    # publik kini dapat membuka halaman info dengan token yang sama
    assert klien(None, None, 'GET', f'/publik/info-ujian/{token}').status_code == 200
    t = a('PUT', '/ujian/uas/tautan-publik/info', json={'aktif': False}).json()['tautan']
    assert (t['aktif'], t['alasan']) == (False, 'nonaktif')
    assert klien(None, None, 'GET', f'/publik/info-ujian/{token}').json()['detail']['alasan'] == 'nonaktif'
    assert len(klien.db.ujian_tautan_publik.docs) == 3  # tidak dihapus
    aksi = [x['aksi'] for x in klien.db.ujian_tautan_riwayat.docs if x['jenis'] == 'info']
    assert aksi == ['buat', 'buka', 'tutup']
    r = klien.db.ujian_tautan_riwayat.docs[-1]
    assert r['oleh_nama'] == 'Administrator' and r['sebelum']['aktif'] is True and r['sesudah']['aktif'] is False
    # menyimpan tanpa perubahan tidak menambah riwayat
    a('PUT', '/ujian/uas/tautan-publik/info', json={'aktif': False})
    assert len([x for x in klien.db.ujian_tautan_riwayat.docs if x['jenis'] == 'info']) == 3


@pytest.mark.parametrize('uid,peran', [('kamad', 'kepala_sekolah'), ('guru1', 'guru'), ('guru2', 'guru')])
def test_buka_tutup_hanya_admin(klien, uid, peran):
    r = klien(uid, peran, 'PUT', '/ujian/uas/tautan-publik/info', json={'aktif': True})
    assert r.status_code == 403
    assert not any(t.get('aktif') for t in klien.db.ujian_tautan_publik.docs)


def test_buka_tutup_validasi(klien):
    a = lambda m, p, **kw: klien('admin', 'admin', m, p, **kw)  # noqa: E731
    assert a('PUT', '/ujian/uas/tautan-publik/rahasia', json={'aktif': True}).status_code == 404
    assert a('PUT', '/ujian/tidak-ada/tautan-publik/info', json={'aktif': True}).status_code == 404
    assert a('PUT', '/ujian/uas/tautan-publik/info', json={'aktif': 'mungkin'}).status_code == 422


def test_jendela_waktu_parsial_dan_validasi(klien):
    a = lambda m, p, **kw: klien('admin', 'admin', m, p, **kw)  # noqa: E731
    url = '/ujian/uas/tautan-publik/info'
    a('PUT', url, json={'aktif': True})
    r = a('PUT', url, json={'mulai_at': '2026-11-24T07:00', 'selesai_at': '2026-12-06T09:00:00Z'})
    assert r.status_code == 200, r.text
    t = r.json()['tautan']
    assert (t['aktif'], t['mulai_at'], t['selesai_at']) == (True, '2026-11-24T07:00:00+07:00', '2026-12-06T16:00:00+07:00')  # aktif tidak berubah
    assert r.json()['peringatan'] == []
    # admin lain menutup tautan; menyimpan jendela dari tampilan basi tidak membukanya lagi
    a('PUT', url, json={'aktif': False})
    t = a('PUT', url, json={'selesai_at': '2026-12-07T16:00'}).json()['tautan']
    assert (t['aktif'], t['mulai_at'], t['selesai_at']) == (False, '2026-11-24T07:00:00+07:00', '2026-12-07T16:00:00+07:00')
    # validasi terhadap nilai gabungan + pesan jelas
    for isi, pesan in (({'selesai_at': '2026-11-20T07:00'}, 'Waktu selesai harus setelah waktu mulai.'),
                       ({'mulai_at': '01/12/2026'}, 'Waktu mulai tidak valid'), ({'selesai_at': '1999-01-01T00:00'}, 'Waktu selesai tidak valid')):
        r = a('PUT', url, json=isi)
        assert r.status_code == 422 and r.json()['detail'].startswith(pesan), r.text
    assert next(x for x in klien.db.ujian_tautan_publik.docs if x['jenis'] == 'info')['selesai_at'] == '2026-12-07T16:00:00+07:00'
    # null = hapus batas
    t = a('PUT', url, json={'mulai_at': None, 'selesai_at': None}).json()['tautan']
    assert t['mulai_at'] is None and t['selesai_at'] is None
    riwayat = [x for x in klien.db.ujian_tautan_riwayat.docs if x['jenis'] == 'info' and x['aksi'] == 'jendela']
    assert len(riwayat) == 3 and 'tanpa batas s.d. tanpa batas → 24-11-2026 07:00 s.d. 06-12-2026 16:00' == riwayat[0]['detail']


def test_jendela_peringatan(klien):
    a = lambda m, p, **kw: klien('admin', 'admin', m, p, **kw)  # noqa: E731
    r = a('PUT', '/ujian/uas/tautan-publik/info', json={'aktif': True, 'mulai_at': None, 'selesai_at': '2026-12-02T07:00'})
    kode = [p['kode'] for p in r.json()['peringatan']]
    assert kode == ['aktif_berakhir', 'berakhir_sebelum_ujian'] and r.json()['tautan']['alasan'] == 'sudah_selesai'


def test_ganti_token(klien):
    a = lambda m, p, **kw: klien('admin', 'admin', m, p, **kw)  # noqa: E731
    lama = a('GET', '/ujian/uas/tautan-publik').json()['tautan']['monitoring']
    a('PUT', '/ujian/uas/tautan-publik/monitoring', json={'aktif': True, 'selesai_at': '2026-12-06T16:00'})
    assert klien(None, None, 'GET', f"/publik/monitoring-ujian/{lama['token']}").status_code == 200
    r = a('POST', '/ujian/uas/tautan-publik/monitoring/ganti-token')
    assert r.status_code == 200, r.text
    baru = r.json()['tautan']
    assert baru['token'] != lama['token'] and baru['id'] == lama['id'] and baru['jalur'].endswith(baru['token'])
    assert (baru['aktif'], baru['selesai_at']) == (True, '2026-12-06T16:00:00+07:00')
    assert klien(None, None, 'GET', f"/publik/monitoring-ujian/{lama['token']}").status_code == 404
    assert klien(None, None, 'GET', f"/publik/monitoring-ujian/{baru['token']}").status_code == 200
    r = [x for x in klien.db.ujian_tautan_riwayat.docs if x['aksi'] == 'ganti_token']
    assert len(r) == 1 and lama['token'] not in str(r) and baru['token'] not in str(r)


# Matriks otorisasi semua endpoint tautan (ber-login). Pemantau = kepala madrasah, waka kurikulum, ketua panitia.
ENDPOINT = [('GET', '/ujian/uas/tautan-publik', None), ('GET', '/ujian/uas/tautan-publik/info', None),
            ('PUT', '/ujian/uas/tautan-publik/info', {'aktif': True}), ('POST', '/ujian/uas/tautan-publik/info/ganti-token', None)]


@pytest.mark.parametrize('uid,peran,harapan', [
    ('admin', 'admin', [200, 200, 200, 200]),
    ('kamad', 'kepala_sekolah', [200, 200, 403, 403]),
    ('wakakur', 'waka_kurikulum', [200, 200, 403, 403]),
    ('guru1', 'guru', [200, 200, 403, 403]),          # ketua panitia
    ('guru2', 'guru', [403, 403, 403, 403]),          # bendahara
    ('tu1', 'tenaga_kependidikan', [403, 403, 403, 403]),
    ('siswa1', 'siswa', [403, 403, 403, 403]),
    (None, None, [401, 401, 401, 401]),
])
def test_matriks_otorisasi(klien, uid, peran, harapan):
    hasil = [klien(uid, peran, m, p, **({'json': j} if j is not None else {})).status_code for m, p, j in ENDPOINT]
    assert hasil == harapan
    if uid != 'admin':
        assert not any(t.get('aktif') for t in klien.db.ujian_tautan_publik.docs)
        assert not [x for x in klien.db.ujian_tautan_riwayat.docs if x['aksi'] != 'buat']


def test_admin_dalam_mode_kelas_tidak_boleh_mengubah(klien):
    """Lapis kedua: sesi mode kelas/siswa sudah ditolak autentikasi biasa (401); penjaga ubah tetap menolaknya bila lolos."""
    import asyncio

    from fastapi import HTTPException

    import routers.ujian_tautan_publik as rtp
    for peran in ('kelas', 'siswa'):
        with pytest.raises(HTTPException) as e:
            asyncio.run(rtp._tautan_admin({'id': 'adm', 'roles': ['admin', peran], 'active_role': peran}, 'uas', 'info'))
        assert e.value.status_code == 403 and e.value.detail == 'Tautan publik hanya dapat diubah admin.'
    t, ujian = asyncio.run(rtp._tautan_admin({'id': 'adm', 'roles': ['admin'], 'active_role': 'admin'}, 'uas', 'info'))
    assert t['jenis'] == 'info' and ujian['id'] == 'uas'


def test_jejak_audit_tautan(klien):
    a = lambda m, p, **kw: klien('admin', 'admin', m, p, **kw)  # noqa: E731
    d = a('GET', '/ujian/uas/tautan-publik').json()['tautan']
    a('PUT', '/ujian/uas/tautan-publik/info', json={'aktif': True})
    a('PUT', '/ujian/uas/tautan-publik/monitoring', json={'aktif': True})
    from datetime import timedelta

    def pub(path, **kw):  # jam maju 1 menit per kejadian agar urutan "terbaru dulu" terbedakan
        klien.kini += timedelta(minutes=1)
        return klien(None, None, 'GET', path, headers={'user-agent': 'HP Siswa', 'x-real-ip': '36.71.1.2'}, **kw)
    pub(f"/publik/info-ujian/{d['info']['token']}")
    pub(f"/publik/info-ujian/{d['info']['token']}")
    pub(f"/publik/monitoring-ujian/{d['monitoring']['token']}", params={'sesi': 'sesiA'})
    pub(f"/publik/monitoring-ujian/{d['monitoring']['token']}", params={'sesi': 'sesiA', 'segarkan': 1})
    pub('/publik/info-ujian/TokenSalahSekali_xxxxxxxxxxxxxxx')  # tak terkait ujian: tidak tampil
    klien.kini += timedelta(minutes=1)
    a('PUT', '/ujian/uas/tautan-publik/info', json={'aktif': False})
    pub(f"/publik/info-ujian/{d['info']['token']}")  # ditolak (nonaktif)

    r = a('GET', '/ujian/uas/tautan-publik/audit')
    assert r.status_code == 200, r.text
    j = r.json()
    assert j['ringkasan'] == {'total': 4, 'ok': 3, 'ditolak': 1, 'kartu_soal_ditolak': 0}
    assert [x['hasil'] for x in j['akses']] == ['nonaktif', 'ok', 'ok', 'ok']  # terbaru dulu
    mon = next(x for x in j['akses'] if x['jenis_tautan'] == 'monitoring')
    assert (mon['sesi'], mon['jumlah_segarkan'], mon['ip'], mon['perangkat']) == ('sesiA', 1, '36.71.1.2', 'HP Siswa')
    teks = r.text
    assert d['info']['token'] not in teks and d['monitoring']['token'] not in teks and 'TokenSalahSekali' not in teks
    aksi = [p['aksi'] for p in j['perubahan']]
    assert aksi[0] == 'tutup' and sorted(aksi) == ['buat', 'buat', 'buat', 'buka', 'buka', 'tutup']  # sisanya terjadi pada jam yang sama
    assert set(j['perubahan'][0]) == {'id', 'waktu', 'jenis', 'aksi', 'oleh_nama', 'detail'}

    j = a('GET', '/ujian/uas/tautan-publik/audit', params={'jenis': 'info', 'hasil': 'ditolak'}).json()
    assert [x['hasil'] for x in j['akses']] == ['nonaktif'] and j['ringkasan']['total'] == 4
    assert {p['jenis'] for p in j['perubahan']} == {'info'}
    assert len(a('GET', '/ujian/uas/tautan-publik/audit', params={'hasil': 'ok', 'batas': 2}).json()['akses']) == 2
    for salah in ({'jenis': 'x'}, {'hasil': 'x'}, {'batas': 0}, {'batas': 500}):
        assert a('GET', '/ujian/uas/tautan-publik/audit', params=salah).status_code == 422
    # pemantau boleh melihat, bukan panitia ditolak
    assert klien('kamad', 'kepala_sekolah', 'GET', '/ujian/uas/tautan-publik/audit').status_code == 200
    assert klien('guru2', 'guru', 'GET', '/ujian/uas/tautan-publik/audit').status_code == 403


def test_api_jejak_akses_filter_tanggal_cari(klien):
    from datetime import timedelta
    a = lambda m, p, **kw: klien('admin', 'admin', m, p, **kw)  # noqa: E731
    d = a('GET', '/ujian/uas/tautan-publik').json()['tautan']
    a('PUT', '/ujian/uas/tautan-publik/info', json={'aktif': True})
    for hari, ip, ua in ((0, '36.71.1.1', 'Android'), (1, '36.71.2.2', 'iPhone'), (2, '10.9.9.9', 'Windows')):
        klien.kini = klien.kini + timedelta(days=1 if hari else 0)
        klien(None, None, 'GET', f"/publik/info-ujian/{d['info']['token']}", headers={'x-real-ip': ip, 'user-agent': ua, 'x-forwarded-for': f'1.2.3.4, {ip}'})
    url = '/ujian/uas/tautan-publik/audit'
    semua = a('GET', url).json()['akses']
    assert len(semua) == 3 and semua[0]['ip_rantai'] == '1.2.3.4, 10.9.9.9'
    hari_kedua = semua[1]['waktu'][:10]
    assert [x['ip'] for x in a('GET', url, params={'dari': hari_kedua, 'sampai': hari_kedua}).json()['akses']] == ['36.71.2.2']
    assert [x['ip'] for x in a('GET', url, params={'cari': 'windows'}).json()['akses']] == ['10.9.9.9']
    assert [x['ip'] for x in a('GET', url, params={'cari': '36.71'}).json()['akses']] == ['36.71.2.2', '36.71.1.1']
    for salah in ({'dari': 'kemarin'}, {'dari': '2026-12-09', 'sampai': '2026-12-01'}, {'cari': 'x' * 61}):
        r = a('GET', url, params=salah)
        assert r.status_code == 422 and isinstance(r.json()['detail'], str)


# ---- Sakelar portal ujian (terpisah dari info & monitoring) ----
def test_sakelar_portal_terpisah_dan_status_ikut_masa_ujian(klien):
    d = klien('admin', 'admin', 'GET', '/ujian/uas/tautan-publik').json()['tautan']
    portal = d['portal']
    assert portal['jalur'] == f"/publik/portal-ujian/{portal['token']}" and (portal['aktif'], portal['alasan']) == (False, 'nonaktif')
    assert len({d[j]['token'] for j in ('info', 'monitoring', 'portal')}) == 3
    sebelum = {t['jenis']: dict(t) for t in klien.db.ujian_tautan_publik.docs}

    r = klien('admin', 'admin', 'PUT', '/ujian/uas/tautan-publik/portal', json={'aktif': True})
    assert r.status_code == 200, r.text
    j = r.json()
    assert (j['tautan']['aktif'], j['tautan']['berlaku'], j['tautan']['alasan']) == (True, True, 'ok')
    # tanpa jendela: batas efektif = masa ujian, diberitahukan ke admin
    assert [p['kode'] for p in j['peringatan']] == ['portal_ikut_masa_ujian']
    sesudah = {t['jenis']: t for t in klien.db.ujian_tautan_publik.docs}
    assert sesudah['info'] == sebelum['info'] and sesudah['monitoring'] == sebelum['monitoring']  # tautan lain tak tersentuh
    riwayat = [(x['jenis'], x['aksi']) for x in klien.db.ujian_tautan_riwayat.docs if x['aksi'] in ('buka', 'tutup')]
    assert riwayat == [('portal', 'buka')]

    klien.kini = datetime.fromisoformat('2026-12-07T08:00:00+07:00')  # sehari setelah masa ujian
    p = klien('admin', 'admin', 'GET', '/ujian/uas/tautan-publik').json()['tautan']['portal']
    assert (p['aktif'], p['berlaku'], p['alasan']) == (True, False, 'sudah_selesai')  # sama dengan yang dilihat siswa

    r = klien('admin', 'admin', 'PUT', '/ujian/uas/tautan-publik/portal', json={'aktif': False})
    assert r.status_code == 200 and r.json()['tautan']['alasan'] == 'nonaktif'
    assert klien('admin', 'admin', 'POST', '/ujian/uas/tautan-publik/portal/ganti-token').json()['tautan']['token'] != portal['token']


@pytest.mark.parametrize('uid,peran', [('kamad', 'kepala_sekolah'), ('guru1', 'guru')])
def test_sakelar_portal_hanya_admin(klien, uid, peran):
    assert klien(uid, peran, 'GET', '/ujian/uas/tautan-publik').status_code == 200
    assert klien(uid, peran, 'PUT', '/ujian/uas/tautan-publik/portal', json={'aktif': True}).status_code == 403


def test_jenis_tautan_tidak_dikenal(klien):
    r = klien('admin', 'admin', 'PUT', '/ujian/uas/tautan-publik/lain', json={'aktif': True})
    assert r.status_code == 404 and 'portal' in r.json()['detail']
