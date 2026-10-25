"""Template master instrumen PKG buatan aplikasi: dibuat dari struktur instrumen, dapat diimpor kembali utuh
(dikenali dari penandanya, sumber 'master'), galat jelas bila isian tidak lengkap."""

import io
import os
import sys

import pytest
from openpyxl import load_workbook

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pkg_instrumen_impor as impor  # noqa: E402
import pkg_template_master as master  # noqa: E402

MADRASAH = {'nama': 'MTsN 2 Kota Malang', 'nsm': '121135730002', 'npsn': '20533012', 'alamat': 'Jl. Bandung No. 7',
            'kepala': 'Kepala Uji'}


def _struktur(jumlah_k=4, jumlah_s=3):
    return [{'kode': str(k), 'nama': f'Kompetensi {k}', 'sub': [
        {'kode': f'{k}.{s}', 'nama': f'Sub {k}.{s}', 'bobot': 1.0,
         'indikator': [{'level': n, 'teks': f'Indikator {k}.{s} level {n}'} for n in range(1, 6)]}
        for s in range(1, jumlah_s + 1)]} for k in range(1, jumlah_k + 1)]


def _wb(isi):
    return load_workbook(io.BytesIO(isi))


def test_buat_lalu_impor_kembali_utuh_dan_bersumber_master():
    isi = master.buat_template_master(_struktur(), MADRASAH, 'uji')
    wb = _wb(isi)
    assert wb.sheetnames == ['Petunjuk', 'Instrumen', '_info']
    assert wb['_info'].sheet_state == 'hidden' and wb['_info']['A1'].value == master.PENANDA
    assert 'MTSN 2 KOTA MALANG' in str(wb['Instrumen']['A2'].value)
    p = impor.pratinjau_dari_bytes(isi, 'unggah', 'master.xlsx')
    assert p['sumber'] == 'master'
    assert p['kompetensi'] == _struktur()
    assert not any('bukan salinan identik' in x for x in p['peringatan'])


def test_kode_sub_tetap_teks_dan_sub_ke_sepuluh_terbaca():
    struktur = _struktur(jumlah_k=1, jumlah_s=10)
    isi = master.buat_template_master(struktur, MADRASAH, 'uji')
    sel = _wb(isi)['Instrumen'].cell(master.BARIS_JUDUL_TABEL + 10, 4)
    assert sel.value == '1.10' and sel.number_format == '@'
    hasil, _ = impor.baca_instrumen_excel(isi)
    assert [s.kode for s in hasil.kompetensi[0].sub][-1] == '1.10'


def test_susunan_berbeda_dari_cetak_resmi_diberi_peringatan():
    isi = master.buat_template_master(_struktur(jumlah_k=2, jumlah_s=2), MADRASAH, 'uji')
    p = impor.pratinjau_dari_bytes(isi, 'unggah', 'master.xlsx')
    assert any('cetak laporan resmi' in x for x in p['peringatan'])


def test_indikator_kosong_dan_kode_hilang_ditolak_dengan_lokasi():
    wb = _wb(master.buat_template_master(_struktur(), MADRASAH, 'uji'))
    ws = wb['Instrumen']
    awal = master.BARIS_JUDUL_TABEL + 1
    ws.cell(awal, 9).value = None          # Indikator Level 3 baris pertama
    ws.cell(awal + 1, 4).value = None      # Kode Sub baris kedua
    buf = io.BytesIO()
    wb.save(buf)
    with pytest.raises(impor.GalatImporInstrumen) as e:
        impor.baca_instrumen_excel(buf.getvalue())
    pesan = ' | '.join(f"{g['lokasi']}: {g['pesan']}" for g in e.value.galat)
    assert f'baris {awal}: Indikator Level 3' in pesan
    assert f'baris {awal + 1}: Kode Kompetensi dan Kode Sub wajib diisi' in pesan


def test_penanda_terhapus_tetap_dikenali_dari_judul_kolom():
    wb = _wb(master.buat_template_master(_struktur(), MADRASAH, 'uji'))
    del wb['_info']
    buf = io.BytesIO()
    wb.save(buf)
    p = impor.pratinjau_dari_bytes(buf.getvalue(), 'unggah', 'master.xlsx')
    assert p['sumber'] == 'master' and len(p['kompetensi']) == 4


def test_template_kosong_tetap_dapat_dibuat():
    wb = _wb(master.buat_template_master([], MADRASAH, 'kosong'))
    assert wb['Instrumen'].cell(master.BARIS_JUDUL_TABEL, 2).value == 'Kode Kompetensi'


async def test_endpoint_unduh_berisi_instrumen_aktif_dan_identitas_madrasah(mongo_db, monkeypatch):
    import httpx
    import server
    from pkg_instrumen import KOLEKSI_INSTRUMEN
    from routers import pkg_instrumen_api as api

    monkeypatch.setattr(api, 'db', mongo_db)
    await mongo_db[KOLEKSI_INSTRUMEN].insert_one({'id': 'i-1', 'is_active': True, 'revisi': 3, 'kompetensi': _struktur()})
    await mongo_db.settings.insert_one({'id': 'global_config', 'school_name': 'MTsN 2 Kota Malang', 'nsm': '121135730002'})
    server.app.dependency_overrides[api.anggota_sk] = lambda: {'user': {'id': 'u-1'}}
    try:
        transport = httpx.ASGITransport(app=server.app)
        async with httpx.AsyncClient(transport=transport, base_url='http://test') as c:
            res = await c.get('/api/pkg/instrumen/template-master')
    finally:
        server.app.dependency_overrides.pop(api.anggota_sk, None)
    assert res.status_code == 200
    assert 'Template_Master_Instrumen_PKG_MTsN_2_Kota_Malang.xlsx' in res.headers['content-disposition']
    wb = _wb(res.content)
    assert wb['Petunjuk']['C6'].value == ': 121135730002'
    assert 'revisi 3' in str(wb['_info']['B5'].value)
    p = impor.pratinjau_dari_bytes(res.content, 'unggah', 'x.xlsx')
    assert p['sumber'] == 'master' and p['kompetensi'] == _struktur()
