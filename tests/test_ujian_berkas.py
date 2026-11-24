"""Ujian Madrasah — berkas ujian: daftar guru PJ, deteksi isi berkas, validasi, penamaan, migrasi."""
import asyncio
import io
import os
import sys
import zipfile

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, os.path.dirname(__file__))

import migrasi_otomatis  # noqa: E402
import ujian_berkas as ub  # noqa: E402
from migrations.migrate_ujian_berkas import migrate  # noqa: E402
from pkg_palsu import Db  # noqa: E402

PDF = b'%PDF-1.4\n%contoh\n'


def docx(dengan_dokumen=True):
    b = io.BytesIO()
    with zipfile.ZipFile(b, 'w') as z:
        z.writestr('[Content_Types].xml', '<Types/>')
        if dengan_dokumen:
            z.writestr('word/document.xml', '<w:document/>')
    return b.getvalue()


def test_migrasi(tmp_path, monkeypatch):
    import penyimpanan
    monkeypatch.setattr(penyimpanan, 'UPLOAD_ROOT', str(tmp_path))
    assert ('2026-11-23_ujian_berkas', migrasi_otomatis._ujian_berkas) in migrasi_otomatis.MIGRASI
    db = Db()
    (tmp_path / 'ujian_berkas').mkdir()
    (tmp_path / 'ujian_berkas' / 'ada.pdf').write_bytes(PDF)
    db.ujian_berkas.docs += [{'id': 'b1', 'nama_berkas': 'ada.pdf'}, {'id': 'b2', 'nama_berkas': 'hilang.pdf'}]
    h = asyncio.run(migrate(db))
    assert h == {'berkas': 2, 'berkas_hilang_di_disk': 1, 'id_berkas_hilang': ['b2'], 'dry_run': False}
    assert ([('ujian_id', 1), ('jenis', 1), ('jenjang', 1), ('mapel', 1)], 'berkas_unik_mapel') in [
        (k, o.get('name')) for k, o in db.ujian_berkas.index if o.get('unique')]
    db2 = Db()
    assert asyncio.run(migrate(db2, dry_run=True))['dry_run'] and not getattr(db2.ujian_berkas, 'index', [])


def test_deteksi_format():
    assert ub.deteksi_format(PDF) == 'pdf'
    assert ub.deteksi_format(docx()) == 'docx'
    assert ub.deteksi_format(docx(dengan_dokumen=False)) is None  # zip biasa bukan DOCX
    assert ub.deteksi_format(b'\xff\xd8\xff\xe0JFIF') is None
    assert ub.deteksi_format(b'PK\x03\x04rusak') is None
    assert ub.deteksi_format(b'') is None


def test_validasi_berkas():
    assert ub.galat_berkas('kisi_kisi', 'Kisi.pdf', PDF) is None
    assert ub.galat_berkas('kartu_soal', 'Kartu.DOCX', docx()) is None
    assert ub.galat_berkas('kartu_soal', 'Kartu.pdf', PDF) is None
    assert ub.galat_berkas('kisi_kisi', 'Kisi.docx', docx()) == 'Kisi-kisi harus berformat PDF.'
    assert ub.galat_berkas('kartu_soal', 'Kartu.doc', b'\xd0\xcf\x11\xe0') == 'Kartu soal harus berformat PDF atau DOCX.'
    assert 'bukan PDF yang sah' in ub.galat_berkas('kisi_kisi', 'foto.pdf', b'\xff\xd8\xff\xe0JFIF')
    assert 'bukan DOCX yang sah' in ub.galat_berkas('kartu_soal', 'soal.docx', PDF)
    assert ub.galat_berkas('kisi_kisi', 'a.pdf', b'') == 'Berkas kosong. Pilih berkas yang benar.'
    besar = PDF + b'0' * (10 * 1024 * 1024)
    assert ub.galat_berkas('kisi_kisi', 'a.pdf', besar) == 'Ukuran berkas 10,0 MB melebihi batas 10 MB.'
    pas = PDF + b'0' * (10 * 1024 * 1024 - len(PDF))
    assert ub.galat_berkas('kisi_kisi', 'a.pdf', pas) is None  # tepat 10 MB boleh
    assert ub.galat_berkas('lain', 'a.pdf', PDF) == 'Jenis berkas tidak dikenal.'


def test_penamaan_aman():
    assert ub.rapikan_nama_file('../../etc/passwd.pdf', 'pdf') == 'passwd.pdf'
    assert ub.rapikan_nama_file('C:\\Users\\Guru\\Kisi IPA 8.PDF', 'pdf') == 'Kisi IPA 8.pdf'
    assert ub.rapikan_nama_file('kartu<script>\x00.docx', 'docx') == 'kartuscript.docx'
    assert ub.rapikan_nama_file('tanpa-ekstensi', 'pdf') == 'tanpa-ekstensi.pdf'
    assert ub.rapikan_nama_file('', 'pdf') == 'berkas.pdf'
    assert len(ub.rapikan_nama_file('x' * 400 + '.pdf', 'pdf')) == ub.NAMA_FILE_MAKS
    a, b = ub.nama_berkas_disk('b1', 'pdf'), ub.nama_berkas_disk('b1', 'pdf')
    assert a != b and a.startswith('b1-') and a.endswith('.pdf')


def test_dokumen_berkas():
    pj = {'id': 'g1', 'full_name': 'Bu Siti'}
    baru = ub.dokumen_berkas(None, 'u1', 'kisi_kisi', 8, 'ipa', 'Kisi.pdf', 'pdf', 1234, pj, 'b-x.pdf')
    assert baru['status'] == 'terkirim' and baru['jumlah_unduh'] == 0 and baru['mime_type'] == 'application/pdf'
    assert (baru['guru_pj_id'], baru['guru_pj_nama']) == ('g1', 'Bu Siti')
    ulang = ub.dokumen_berkas({**baru, 'jumlah_unduh': 7}, 'u1', 'kisi_kisi', 8, 'ipa', 'Kisi v2.pdf', 'pdf', 99, {'id': 'g2', 'full_name': 'Pak Hadi'}, 'b-y.pdf')
    assert ulang['id'] == baru['id'] and ulang['jumlah_unduh'] == 7 and ulang['nama_berkas'] == 'b-y.pdf' and ulang['guru_pj_nama'] == 'Pak Hadi'
    r = ub.ringkas_berkas_pj(ulang)
    assert 'nama_berkas' not in r and r['nama_file'] == 'Kisi v2.pdf' and r['guru_pj_id'] == 'g2' and ub.ringkas_berkas_pj(None) is None
    assert ub.judul_tugas(8, 'quran_hadits') == 'Quran Hadits Kelas 8'


def test_daftar_guru_pj():
    db = Db()
    db.users.docs += [
        {'id': 'g1', 'full_name': 'Siti Aminah', 'roles': ['guru'], 'is_active': True},
        {'id': 'g2', 'full_name': 'ahmad Fauzi', 'roles': ['guru_ipa', 'wali_kelas'], 'is_active': True},
        {'id': 'w1', 'full_name': 'Bu Wali', 'roles': ['wali_kelas'], 'is_active': True},
        {'id': 'g3', 'full_name': 'Pensiun', 'roles': ['guru'], 'is_active': False},
        {'id': 't1', 'full_name': 'TU', 'roles': ['tenaga_kependidikan'], 'is_active': True},
        {'id': 's1', 'full_name': 'Siswa', 'roles': ['siswa'], 'is_active': True},
    ]
    assert asyncio.run(ub.daftar_guru_pj(db)) == [{'id': 'g2', 'nama': 'ahmad Fauzi'}, {'id': 'w1', 'nama': 'Bu Wali'}, {'id': 'g1', 'nama': 'Siti Aminah'}]
    assert asyncio.run(ub.guru_pj_sah(db, 'g1')) == {'id': 'g1', 'full_name': 'Siti Aminah'}
    for bukan in ('g3', 't1', 's1', 'tidak-ada', '', None, 'x' * 70):
        assert asyncio.run(ub.guru_pj_sah(db, bukan)) is None


def test_konten_aktif_ditolak():
    b = io.BytesIO()
    with zipfile.ZipFile(b, 'w') as z:
        z.writestr('[Content_Types].xml', '<Types/>')
        z.writestr('word/document.xml', '<w:document/>')
        z.writestr('word/vbaProject.bin', b'\x00makro')
    assert 'berisi makro' in ub.galat_berkas('kartu_soal', 'Kartu.docx', b.getvalue())
    for aktif in (b'/OpenAction << /S /JavaScript /JS (app.alert(1)) >>', b'/Launch /F (cmd.exe)', b'/EmbeddedFile'):
        assert 'skrip, aksi otomatis' in ub.galat_berkas('kisi_kisi', 'Kisi.pdf', PDF + aktif)
    assert ub.galat_berkas('kisi_kisi', 'Kisi.pdf', PDF + b'/Type /Page /Contents 4 0 R') is None
    assert ub.galat_berkas('kartu_soal', 'Kartu.docx', docx()) is None


def test_bersihkan_berkas_yatim(tmp_path, monkeypatch):
    import time

    import penyimpanan
    monkeypatch.setattr(penyimpanan, 'UPLOAD_ROOT', str(tmp_path))
    folder = tmp_path / 'ujian_berkas'
    folder.mkdir()
    for nama in ('dipakai.pdf', 'yatim-lama.pdf', 'yatim-baru.pdf', 'b1-x.pdf.sedang'):
        (folder / nama).write_bytes(PDF)
    lama = time.time() - 2 * 3600
    for nama in ('dipakai.pdf', 'yatim-lama.pdf', 'b1-x.pdf.sedang'):
        os.utime(folder / nama, (lama, lama))
    db = Db()
    db.ujian_berkas.docs.append({'id': 'b1', 'nama_berkas': 'dipakai.pdf'})
    assert asyncio.run(ub.bersihkan_berkas_yatim(db, dry_run=True)) == {'dihapus': 2, 'dibiarkan': 1, 'dry_run': True}
    assert len(os.listdir(folder)) == 4
    assert asyncio.run(ub.bersihkan_berkas_yatim(db)) == {'dihapus': 2, 'dibiarkan': 1, 'dry_run': False}
    assert sorted(os.listdir(folder)) == ['dipakai.pdf', 'yatim-baru.pdf']  # yang baru mungkin sedang diunggah


def test_kumpulan_berkas_jenjang(tmp_path, monkeypatch):
    import penyimpanan
    monkeypatch.setattr(penyimpanan, 'UPLOAD_ROOT', str(tmp_path))
    (tmp_path / 'ujian_berkas').mkdir()
    for n in ('mtk.pdf', 'bind.docx'):
        (tmp_path / 'ujian_berkas' / n).write_bytes(PDF)
    db = Db()
    b = lambda mapel, nb, nf, **kw: {'id': f'b-{mapel}', 'ujian_id': 'u1', 'jenis': 'kartu_soal', 'jenjang': 8, 'mapel': mapel,  # noqa: E731
                                     'status': 'terkirim', 'nama_berkas': nb, 'nama_file': nf, **kw}
    db.ujian_berkas.docs += [b('matematika', 'mtk.pdf', 'Kartu MTK.pdf'), b('bahasa_indonesia', 'bind.docx', '../C:\\x\\Kartu <B.Indo>.docx'),
                             b('ipa', 'hilang.pdf', 'Kartu IPA.pdf'), b('ips', 'x.pdf', 'x.pdf', status='belum'),
                             {**b('pkn', 'mtk.pdf', 'lain.pdf'), 'jenjang': 7}, {**b('fiqh', 'mtk.pdf', 'kisi.pdf'), 'jenis': 'kisi_kisi'}]
    k = asyncio.run(ub.kumpulan_berkas_jenjang(db, 'u1', 'kartu_soal', 8))
    assert [x['nama_zip'] for x in k['ada']] == ['01 Bahasa Indonesia - Kartu B.Indo.docx', '03 Matematika - Kartu MTK.pdf']
    assert [m['kode'] for m in k['hilang']] == ['ipa']
    assert len(k['kosong']) == 12 and 'ips' in [m['kode'] for m in k['kosong']]
    teks = ub.teks_keterangan_zip('kartu_soal', 8, 'ASAS Ganjil', k)
    assert 'Kartu soal Kelas 8 — ASAS Ganjil' in teks and 'Berisi 2 mapel' in teks and 'Belum mengirim (12 mapel)' in teks
    assert 'IPA' in teks.split('tidak ditemukan')[1] and '\r\n' in teks
    with pytest.raises(ValueError):
        asyncio.run(ub.kumpulan_berkas_jenjang(db, 'u1', 'lain', 8))
    assert ub.nama_entri_zip(15, 'Informatika', '', 'pdf') == '15 Informatika.pdf'
