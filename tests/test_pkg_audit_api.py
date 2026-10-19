"""API jejak audit PKG: daftar tersaring & berhalaman dengan ringkasan, riwayat aksi per guru, otorisasi kepala."""

import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pkg_audit  # noqa: E402
import pkg_penjaga  # noqa: E402
from routers import pkg_audit_api as api  # noqa: E402
from tests.pkg_palsu import Db, Koleksi  # noqa: E402

KEPALA = {'id': 'kep', 'roles': ['kepala_sekolah'], 'full_name': 'Drs. Kepala'}
PENILAI = {'id': 'pen', 'roles': ['guru'], 'full_name': 'Penilai Satu'}


def _entri(i, aksi, aktor, ts, metadata=None, **lain):
    doc = {'id': f'a{i}', 'aksi': aksi, 'kategori': pkg_audit.kategori_aksi(aksi), 'aktor_id': aktor['id'],
           'aktor_nama': aktor['full_name'], 'aktor_peran': 'guru', 'metadata': metadata or {}, 'ip_address': '10.0.0.1',
           'timestamp': ts, 'waktu_urut': lain.pop('terakhir', None) or ts, 'tanggal': ts[:10],
           'guru_id': (metadata or {}).get('guru_id'), 'periode_id': (metadata or {}).get('periode_id'),
           'penilaian_id': (metadata or {}).get('penilaian_id')}
    if 'jumlah' in lain:
        doc['terakhir'] = doc['waktu_urut']
    return {**doc, **lain}


@pytest.fixture
def klien(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from core import get_current_user
    d = Db({
        'pkg_periode': Koleksi([{'id': 'p1', 'status': 'berjalan', 'tanggal_buka': '2026-10-01', 'tanggal_tutup': '2026-11-30'}]),
        'pkg_sk': Koleksi([{'id': 's1', 'periode_id': 'p1', 'is_active': True, 'penilai_ids': ['pen'], 'dinilai_ids': ['g1', 'g2']}]),
        'pkg_penugasan': Koleksi([{'periode_id': 'p1', 'penilai_id': 'pen', 'guru_dinilai_ids': ['g1'], 'supervisi_selesai': True}]),
        'users': Koleksi([{'id': 'g1', 'full_name': 'Siti Rahmawati'}, {'id': 'g2', 'full_name': 'Budi Santoso'},
                          {'id': 'pen', 'full_name': 'Penilai Satu'}]),
        'pkg_audit_log': Koleksi([
            _entri(1, 'sk_buat', KEPALA, '2026-10-01T02:00:00+00:00', {'nomor_sk': 'B-123/2026', 'periode_id': 'p1'}),
            _entri(2, 'supervisi_tandai', KEPALA, '2026-10-02T02:00:00+00:00', {'penilai_id': 'pen', 'tanggal_supervisi': '2026-10-02'}),
            _entri(3, 'penilaian_draf', PENILAI, '2026-10-17T01:00:00+00:00',
                   {'guru_id': 'g1', 'periode_id': 'p1', 'penilaian_id': 'n1', 'progres': 75}, jumlah=6,
                   terakhir='2026-10-18T03:00:00+00:00'),
            _entri(4, 'penilaian_kirim', PENILAI, '2026-10-18T04:00:00+00:00',
                   {'guru_id': 'g1', 'periode_id': 'p1', 'penilaian_id': 'n1', 'nilai_akhir': 36, 'nilai_maks': 60,
                    'capaian_persen': 60.0, 'predikat': 'Ahli Muda'}),
            _entri(5, 'cetak_template', KEPALA, '2026-10-19T01:40:00+00:00',
                   {'nama_berkas': 'Rekap_Hasil_PKG.pdf', 'format': 'pdf', 'mesin': 'libreoffice', 'versi_template': '2026',
                    'periode_id': 'p1'}),
            _entri(6, 'penilaian_buka', PENILAI, '2026-10-16T01:00:00+00:00', {'guru_id': 'g2', 'periode_id': 'p0', 'status': 'belum'}),
        ]),
    })
    for modul in (api, pkg_penjaga):
        monkeypatch.setattr(modul, 'db', d)
    app = FastAPI()
    app.include_router(api.router, prefix='/api')
    pengguna = {'user': KEPALA}
    app.dependency_overrides[get_current_user] = lambda: pengguna['user']
    return TestClient(app), d, pengguna


def test_daftar_audit_terbaru_dulu_dengan_ringkasan(klien):
    k, d, _ = klien
    r = k.get('/api/pkg/audit', params={'per_halaman': 3})
    assert r.status_code == 200
    data = r.json()
    assert data['total'] == 6 and data['halaman'] == 1 and [e['id'] for e in data['item']] == ['a5', 'a4', 'a3']
    cetak, kirim, draf = data['item']
    assert cetak['label'] == 'Mencetak dokumen dari template' and cetak['kategori'] == 'unduhan'
    assert cetak['ringkasan'] == 'Rekap_Hasil_PKG.pdf · PDF (LibreOffice) · template v2026'
    assert kirim['ringkasan'] == 'Siti Rahmawati · nilai 36/60 (60,00%) · Ahli Muda' and kirim['guru_nama'] == 'Siti Rahmawati'
    assert draf['jumlah'] == 6 and draf['terakhir'] == '2026-10-18T03:00:00+00:00' and draf['ringkasan'] == 'Siti Rahmawati · progres 75%'
    # Pembukaan pertama kini tercatat (lihat_audit, terbaru) sehingga halaman berikutnya bergeser satu entri.
    sisa = k.get('/api/pkg/audit', params={'per_halaman': 3, 'halaman': 2}).json()['item']
    assert [e['id'] for e in sisa] == ['a3', 'a6', 'a2'] and sisa[2]['ringkasan'] == 'Penilai Satu · 2026-10-02'
    akhir = k.get('/api/pkg/audit', params={'per_halaman': 3, 'halaman': 3}).json()
    assert [e['id'] for e in akhir['item']] == ['a1'] and akhir['item'][0]['ringkasan'] == 'B-123/2026' and akhir['total'] == 7
    # Membuka daftar tercatat harian.
    lihat = [e for e in d['pkg_audit_log'].docs if e['aksi'] == 'lihat_audit']
    assert len(lihat) == 1 and lihat[0]['jumlah'] == 3 and lihat[0]['kategori'] == 'akses'


def test_saringan_audit(klien):
    k, _, _ = klien
    ids = lambda **p: [e['id'] for e in k.get('/api/pkg/audit', params=p).json()['item'] if e['aksi'] != 'lihat_audit']  # noqa: E731
    assert ids(kategori='penilaian') == ['a4', 'a3', 'a6'] and ids(aksi='penilaian_kirim') == ['a4']
    assert ids(aktor_id='kep') == ['a5', 'a2', 'a1'] and ids(guru_id='g1') == ['a4', 'a3'] and ids(periode_id='p0') == ['a6']
    # Rentang WIB: entri draf (17–18 Okt) termasuk saat rentang menyentuh aktivitas terakhirnya.
    assert ids(dari='2026-10-18', sampai='2026-10-18') == ['a4', 'a3'] and ids(sampai='2026-10-02') == ['a2', 'a1']
    assert ids(dari='2026-10-19') == ['a5']
    # Cari: pelaku, nama guru, label aksi, nama berkas, nomor SK; karakter regex aman.
    assert ids(cari='budi') == ['a6'] and ids(cari='rekap_hasil') == ['a5'] and ids(cari='b-123') == ['a1']
    assert ids(cari='mengirim') == ['a4'] and set(ids(cari='penilai satu')) == {'a4', 'a3', 'a6'} and ids(cari='.*') == []
    for salah in ({'kategori': 'lain'}, {'aksi': 'hapus_semua'}, {'aksi': 'A;B'}, {'per_halaman': 101},
                  {'dari': '2026-02-30'}, {'dari': '2026-10-19', 'sampai': '2026-10-01'}, {'guru_id': '$ne'}):
        assert k.get('/api/pkg/audit', params=salah).status_code == 422, salah


def test_riwayat_aksi_guru(klien):
    k, _, _ = klien
    r = k.get('/api/pkg/audit/guru/g1')
    assert r.status_code == 200
    assert [(x['aksi'], x['nilai_akhir'], x['progres'], x['jumlah']) for x in r.json()] == [
        ('penilaian_kirim', 36, None, None), ('penilaian_draf', None, 75, 6)]
    assert r.json()[0]['label'] == 'Mengirim & mengunci penilaian'
    assert k.get('/api/pkg/audit/guru/g2', params={'periode_id': 'p1'}).json() == []
    assert [x['aksi'] for x in k.get('/api/pkg/audit/guru/g2').json()] == ['penilaian_buka']
    assert k.get('/api/pkg/audit/guru/a b').status_code == 422


def test_hanya_kepala(klien):
    k, d, pengguna = klien
    pengguna['user'] = PENILAI
    for url in ('/api/pkg/audit', '/api/pkg/audit/guru/g1'):
        r = k.get(url)
        assert r.status_code == 403 and r.json()['detail']['alasan'] == 'bukan_kepala'
    assert any(e['aksi'] == 'tolak_akses' for e in d['pkg_audit_log'].docs)
    pengguna['user'] = {'id': 'luar', 'roles': ['guru'], 'full_name': 'Orang Luar'}
    assert k.get('/api/pkg/audit').json()['detail']['alasan'] == 'bukan_anggota_sk'


def test_ringkasan_aman_untuk_metadata_kosong():
    from pkg_jejak_audit import ringkasan_entri
    for aksi in pkg_audit.LABEL_AKSI:
        assert isinstance(ringkasan_entri({'aksi': aksi, 'metadata': {}}, {}), str)
    assert asyncio.run(api.riwayat_aksi_guru(Db(), 'g9')) == []
