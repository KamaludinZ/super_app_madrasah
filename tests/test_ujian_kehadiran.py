"""Ujian Madrasah — Daftar Hadir: skema, index (satu kiriman per peserta per sesi; tanda sekali per hari), status sesi."""
import asyncio
import os
import sys

import pytest
from pydantic import ValidationError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, os.path.dirname(__file__))

import migrasi_otomatis  # noqa: E402
import ujian_kehadiran as uk  # noqa: E402
from migrations.migrate_ujian_kehadiran import migrate  # noqa: E402
from pkg_palsu import Db  # noqa: E402


def test_migrasi_dan_index_unik():
    assert ('2026-11-20_ujian_kehadiran', migrasi_otomatis._ujian_kehadiran) in migrasi_otomatis.MIGRASI
    db = Db()
    h = asyncio.run(migrate(db))
    assert h['kehadiran'] == 0 and not h['dry_run']
    unik = {o.get('name') for _, o in db.daftar_hadir.index if o.get('unique')}
    assert 'dh_unik_peserta_sesi' in unik
    assert any(o.get('name') == 'dh_status_unik_hari' for _, o in db.daftar_hadir_status.index)
    assert any(o.get('unique') for k, o in db.daftar_hadir_ttd.index if k == [('kehadiran_id', 1)])
    db2 = Db()
    asyncio.run(migrate(db2, dry_run=True))
    assert not getattr(db2.daftar_hadir, 'index', [])


def test_isian():
    assert uk.DaftarHadirIn(sesi_id='s', ruang_id='r', peserta_id='p', ttd_png='data:image/png;base64,AAAA').peserta_id == 'p'
    with pytest.raises(ValidationError):
        uk.DaftarHadirIn(sesi_id='s', ruang_id='r', peserta_id='p', ttd_png='data:image/jpeg;base64,AAAA')
    with pytest.raises(ValidationError):
        uk.DaftarHadirIn(sesi_id='s', ruang_id='r', peserta_id='p', ttd_png='data:image/png;base64,' + 'A' * uk.TTD_MAKS_DATA_URL)
    s = uk.StatusIn(peserta_id='p', tanggal='2026-12-02', status='izin', catatan='  ok  ')
    assert s.galat() and uk.StatusIn(peserta_id='p', tanggal='2026-12-02', status='alpa').galat() is None
    with pytest.raises(ValidationError):
        uk.StatusIn(peserta_id='p', tanggal='2026-12-02', status='hadir')
    with pytest.raises(ValidationError):
        uk.BukaKunciIn(alasan='  a  ')


def test_status_sesi_hadir_mengalahkan_tanda_harian():
    st = uk.status_sesi(['a', 'b', 'c', 'd'],
                        [{'peserta_id': 'a', 'id': 'k1'}, {'peserta_id': 'b', 'id': 'k2'}],
                        [{'peserta_id': 'b', 'status': 'izin'}, {'peserta_id': 'c', 'status': 'sakit'}])
    assert {p: s['status'] for p, s in st.items()} == {'a': 'hadir', 'b': 'hadir', 'c': 'sakit', 'd': None}
    r = uk.rekap_status(st)
    assert r == {'total': 4, 'hadir': 2, 'izin': 0, 'sakit': 1, 'alpa': 0, 'belum': 1, 'lengkap': False}
    assert uk.rekap_status({'x': {'status': 'alpa'}})['lengkap'] and not uk.rekap_status({})['lengkap']


ADMIN = {'id': 'admin', 'full_name': 'Administrator'}


def test_tanda_harian_sekali_per_hari():
    db = Db()
    isi = uk.StatusIn(peserta_id='p1', tanggal='2026-12-02', status='izin', catatan='Lomba tingkat kota')
    assert asyncio.run(uk.simpan_tanda(db, 'u', isi, ADMIN)) is None
    lama = asyncio.run(uk.simpan_tanda(db, 'u', uk.StatusIn(peserta_id='p1', tanggal='2026-12-02', status='sakit', catatan='Demam'), ADMIN))
    assert lama['status'] == 'izin'
    assert len(db.daftar_hadir_status.docs) == 1 and db.daftar_hadir_status.docs[0]['status'] == 'sakit'
    assert db.daftar_hadir_status.docs[0]['ditandai_oleh_nama'] == 'Administrator' and db.daftar_hadir_status.docs[0]['id']
    asyncio.run(uk.simpan_tanda(db, 'u', uk.StatusIn(peserta_id='p1', tanggal='2026-12-03', status='alpa'), ADMIN))
    assert len(db.daftar_hadir_status.docs) == 2  # hari lain = dokumen lain
    asyncio.run(uk.simpan_tanda(db, 'u', uk.StatusIn(peserta_id='p1', tanggal='2026-12-02', status=None), ADMIN))
    assert [d['tanggal'] for d in db.daftar_hadir_status.docs] == ['2026-12-03']


def test_buka_kunci_mengarsipkan_kiriman():
    db = Db()
    k = {'id': 'k1', 'ujian_id': 'u', 'sesi_id': 's1', 'peserta_id': 'p1', 'status': 'hadir', 'waktu_kirim': '2026-12-02T07:40:00+07:00'}
    db.daftar_hadir.docs.append(dict(k))
    db.daftar_hadir_ttd.docs.append({'kehadiran_id': 'k1', 'png': b'PNG'})
    arsip = asyncio.run(uk.buka_kunci(db, k, ADMIN, 'Salah pilih nama'))
    assert arsip['png'] == b'PNG' and arsip['alasan_buka'] == 'Salah pilih nama'
    assert db.daftar_hadir.docs == [] and db.daftar_hadir_ttd.docs == [] and len(db.daftar_hadir_arsip.docs) == 1
    r = asyncio.run(uk.riwayat_buka(db, 'u', 's1', ['p1', 'p2']))
    assert list(r) == ['p1'] and r['p1'][0]['oleh_nama'] == 'Administrator' and 'png' not in r['p1'][0]
