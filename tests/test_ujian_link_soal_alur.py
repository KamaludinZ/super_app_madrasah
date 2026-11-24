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
