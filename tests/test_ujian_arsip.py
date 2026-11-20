"""Ujian Madrasah — Arsip Administrasi: metadata, nama berkas, simpan & ambil isi."""
import asyncio
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, os.path.dirname(__file__))

import ujian_arsip as ua  # noqa: E402
from pkg_palsu import Db  # noqa: E402


def test_nama_berkas_dan_simpan_ambil():
    sesi = {'id': 's1', 'tanggal': '2026-12-02', 'sesi_ke': 1}
    nama = ua.nama_berkas_cetak('berita_acara', {'nama': 'ASAS Ganjil 2026/2027'}, {'nama_ruang': '01'}, 7, sesi, 'pdf')
    assert nama == 'berita_acara_ASAS_Ganjil_2026_2027_ruang_01_kelas_7_2026-12-02_sesi_1.pdf'
    db = Db()
    meta = ua.dokumen_arsip('u', 'berita_acara', 'pdf', {'id': 'r1', 'nama_ruang': '01'}, 7, sesi, 'Rabu · Sesi 1', nama, 3, 'libreoffice',
                            {'id': 'a', 'full_name': 'Admin'})
    asyncio.run(ua.simpan_arsip(db, meta, b'%PD'))
    m, isi = asyncio.run(ua.ambil_berkas_arsip(db, meta['id']))
    assert isi == b'%PD' and m['dibuat_oleh_nama'] == 'Admin' and db.arsip_ujian_berkas.docs[0]['mime'] == 'application/pdf'
    assert set(ua.ringkas_arsip(m)) == set(ua.FIELD_ARSIP) and 'dibuat_oleh' not in ua.ringkas_arsip(m)
    assert asyncio.run(ua.ambil_berkas_arsip(db, 'x')) is None
    with pytest.raises(ValueError):
        asyncio.run(ua.simpan_arsip(db, {**meta, 'id': 'besar'}, b'0' * (ua.ARSIP_MAKS_BYTE + 1)))
