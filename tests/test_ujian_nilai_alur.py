"""Ujian Madrasah — Nilai UAS lewat HTTP: unggah berkas (satu mapel & jenjang, sheet per kelas) -> job impor latar
belakang -> nilai_ujian & log monitoring."""
import io
import os
import sys

import pytest
from openpyxl import Workbook

sys.path.insert(0, os.path.dirname(__file__))
from ujian_dasar import buat_klien, tambah_kelas_siswa, ujian_doc  # noqa: E402

XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'


def berkas_nilai(sheets, meta=None):
    """sheets = {nama_sheet: [(id_siswa, nis, nama, nilai), ...]} -> bytes xlsx berformat template."""
    wb = Workbook()
    wb.remove(wb.active)
    for nama, baris in sheets.items():
        ws = wb.create_sheet(nama)
        ws.append([f'NILAI UAS — KELAS {nama}'])
        ws.append(['petunjuk'])
        ws.append([])
        ws.append(['No', 'ID Siswa', 'NIS', 'Nama', 'Nilai UAS'])
        for i, b in enumerate(baris, start=1):
            ws.append([i, *b])
    if meta:
        ws = wb.create_sheet('_meta')
        for k, v in meta.items():
            ws.append([k, v])
        ws.sheet_state = 'hidden'
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


@pytest.fixture
def klien(monkeypatch):
    k = buat_klien(monkeypatch)
    db = k.db
    tambah_kelas_siswa(db, kelas=(('k7a', '7A', 7), ('k7b', '7B', 7), ('k8a', '8A', 8)), per_kelas=3)
    db.subjects.docs += [{'id': 'mtk', 'name': 'Matematika'}, {'id': 'ipa', 'name': 'IPA'}]
    db.ujian.docs += [ujian_doc('uas', 'UAS', 'sem-kini', '2026-12-01', '2026-12-06'), ujian_doc('uts', 'UTS', 'sem-kini', '2026-09-21', '2026-09-26'),
                      ujian_doc('uas-lalu', 'UAS', 'sem-lalu', '2026-06-01', '2026-06-06')]
    db.panitia_ujian.docs += [
        {'id': 'p1', 'ujian_id': 'uas', 'jabatan': 'ketua', 'user_id': 'guru1'},
        {'id': 'p2', 'ujian_id': 'uas', 'jabatan': 'bendahara', 'user_id': 'tu1'},
    ]
    return k


def unggah(klien, uid, peran, isi, ujian='uas', mapel='mtk', jenjang=7, nama='nilai.xlsx'):
    return klien(uid, peran, 'POST', f'/ujian/{ujian}/nilai/impor', data={'mapel_id': mapel, 'jenjang': str(jenjang)},
                 files={'berkas': (nama, isi, XLSX)})


def test_unggah_memulai_job_dan_menyimpan_nilai(klien):
    db = klien.db
    isi = berkas_nilai({
        '7A': [('s-k7a-1', '', 'Siswa 7A 1', 88), ('', '7002', 'x', '76,5'), ('', '', 'siswa 7a 3', 120)],
        '7B': [('s-k7b-1', '', '', 90), ('s-k7a-2', '', '', 70), ('s-k7b-2', '', '', None), ('s-k7b-1', '', '', 91)],
        'Catatan': [],
    }, meta={'jenis': 'template_nilai_uas', 'ujian_id': 'uas', 'mapel_id': 'mtk', 'jenjang': '7'})
    r = unggah(klien, 'guru1', 'guru', isi)
    assert r.status_code == 200, r.text
    log_id = r.json()['log_id']
    log = next(d for d in db.nilai_impor_log.docs if d['id'] == log_id)
    assert log['status'] == 'selesai' and log['diunggah_oleh_nama'] == 'Bu Siti' and log['mapel_nama'] == 'Matematika'
    assert (log['total_baris'], log['diproses'], log['berhasil'], log['gagal']) == (6, 6, 3, 3)
    ps = {p['sheet']: p for p in log['per_sheet']}
    assert ps['7A']['berhasil'] == 2 and ps['7A']['gagal'] == 1 and ps['7B']['kosong'] == 1 and ps['7B']['kelas'] == '7B'
    pesan = {(g['sheet'], g['baris']): g['pesan'] for g in log['galat']}
    assert 'luar rentang' in pesan[('7A', 7)] and 'tidak terdaftar di kelas ini' in pesan[('7B', 6)] and 'sudah diisi di baris 5' in pesan[('7B', 8)]
    nilai = {d['siswa_id']: d for d in db.nilai_ujian.docs}
    assert nilai['s-k7a-1']['nilai'] == 88 and nilai['s-k7a-2']['nilai'] == 76.5 and nilai['s-k7b-1']['nilai'] == 90
    assert nilai['s-k7a-1']['sumber'] == 'impor' and nilai['s-k7a-1']['kelas_id'] == 'k7a' and 's-k7b-2' not in nilai
    assert any(a.get('action') == 'ujian_nilai_impor' for a in db.audit_logs.docs)

    # unggah ulang: nilai ditimpa, bukan diduplikasi
    unggah(klien, 'guru1', 'guru', berkas_nilai({'7A': [('s-k7a-1', '', '', 95)]}))
    assert [d['nilai'] for d in db.nilai_ujian.docs if d['siswa_id'] == 's-k7a-1'] == [95]


def test_berkas_salah_tercatat_gagal(klien):
    db = klien.db
    salah_mapel = {'jenis': 'template_nilai_uas', 'mapel_id': 'ipa', 'jenjang': '7'}
    r = unggah(klien, 'admin', 'admin', berkas_nilai({'7A': [('s-k7a-1', '', '', 80)]}, meta=salah_mapel))
    log = db.nilai_impor_log.docs[-1]
    assert r.status_code == 200 and log['status'] == 'gagal' and 'template IPA, bukan Matematika' in log['pesan']
    unggah(klien, 'admin', 'admin', berkas_nilai({'7A': [('s-k7a-1', '', '', 80)]}, meta={'jenis': 'template_nilai_uas', 'jenjang': '8'}))
    assert 'kelas 8, bukan kelas 7' in db.nilai_impor_log.docs[-1]['pesan']
    unggah(klien, 'admin', 'admin', b'bukan excel', nama='x.xlsx')
    assert 'bukan .xlsx' in db.nilai_impor_log.docs[-1]['pesan']
    unggah(klien, 'admin', 'admin', berkas_nilai({'7A': [('s-k7a-1', '', '', None)]}))
    assert db.nilai_impor_log.docs[-1]['status'] == 'gagal' and 'masih kosong' in db.nilai_impor_log.docs[-1]['pesan']
    unggah(klien, 'admin', 'admin', berkas_nilai({'8A': [('s-k8a-1', '', '', 80)]}))
    assert 'bukan nama kelas 7' in db.nilai_impor_log.docs[-1]['galat'][0]['pesan']
    assert not db.nilai_ujian.docs


def test_validasi_dan_otorisasi_unggah(klien):
    db = klien.db
    isi = berkas_nilai({'7A': [('s-k7a-1', '', '', 80)]})
    assert unggah(klien, 'tu1', 'tenaga_kependidikan', isi).status_code == 403  # bendahara: bukan menu nilai
    assert unggah(klien, 'kamad', 'kepala_sekolah', isi).status_code == 403
    assert unggah(klien, 'guru1', 'guru', isi, ujian='uts').status_code == 403  # bukan panitia UTS
    assert 'hanya dapat diimpor pada ujian UAS' in unggah(klien, 'admin', 'admin', isi, ujian='uts').json()['detail']
    assert unggah(klien, 'admin', 'admin', isi, ujian='uas-lalu').status_code == 409
    assert unggah(klien, 'admin', 'admin', isi, nama='nilai.csv').status_code == 400
    assert unggah(klien, 'admin', 'admin', isi, mapel='tidak-ada').status_code == 404
    assert 'Tidak ada kelas 9' in unggah(klien, 'admin', 'admin', isi, jenjang=9).json()['detail']
    db.nilai_impor_log.docs.append({'id': 'macet', 'ujian_id': 'uas', 'mapel_id': 'mtk', 'jenjang': 7, 'status': 'proses',
                                    'waktu': '2099-01-01T00:00:00+07:00', 'diunggah_oleh_nama': 'Pak Hadi'})
    r = unggah(klien, 'admin', 'admin', isi)
    assert r.status_code == 409 and 'masih diproses (oleh Pak Hadi)' in r.json()['detail']
    assert unggah(klien, 'admin', 'admin', isi, mapel='ipa').status_code == 200


def test_progres_tersimpan_per_sheet_selama_proses(klien, monkeypatch):
    """Snapshot log selama job: sheet_aktif berpindah sesuai urutan sheet, diproses naik bertahap, akhir bersih."""
    import ujian_nilai_impor
    db = klien.db
    monkeypatch.setattr(ujian_nilai_impor, 'SIMPAN_PROGRES_TIAP', 2)
    for i in range(4, 8):
        db.users.docs.append({'id': f's-k7b-{i}', 'full_name': f'Siswa 7B {i}', 'roles': ['siswa'], 'student_class_id': 'k7b', 'is_active': True})
    asli, snap = db.nilai_impor_log.update_one, []

    async def rekam(q, u, upsert=False):
        h = await asli(q, u, upsert)
        d = next(x for x in db.nilai_impor_log.docs if x['id'] == q['id'])
        snap.append((d.get('sheet_aktif'), d.get('diproses'), d['status']))
        return h
    monkeypatch.setattr(db.nilai_impor_log, 'update_one', rekam)
    isi = berkas_nilai({'7B': [(f's-k7b-{i}', '', '', 70 + i) for i in range(1, 8)], '7A': [('s-k7a-1', '', '', 80)]})
    log_id = unggah(klien, 'guru1', 'guru', isi).json()['log_id']
    log = next(x for x in db.nilai_impor_log.docs if x['id'] == log_id)
    proses = [(s, n) for s, n, st in snap if st == 'proses' and s]
    assert [s for s, _ in dict.fromkeys(proses)][0] == '7B' and proses[-1] == ('7A', 8)
    urut_7b = [n for s, n in proses if s == '7B']
    assert urut_7b == sorted(urut_7b) and {2, 4, 6} <= set(urut_7b)
    assert log['status'] == 'selesai' and log['sheet_aktif'] is None and log['diproses'] == log['total_baris'] == 8
    assert log['kelas_tanpa_sheet'] == [] and log['pesan'] == ''

    unggah(klien, 'guru1', 'guru', berkas_nilai({'7A': [('s-k7a-1', '', '', 81)]}))
    log = db.nilai_impor_log.docs[-1]
    assert log['kelas_tanpa_sheet'] == ['7B'] and 'Kelas tanpa sheet' in log['pesan'] and log['status'] == 'selesai'


def test_ringkasan_sheet_dan_baris_gagal_tersimpan(klien, monkeypatch):
    import ujian_nilai_impor
    db = klien.db
    isi = berkas_nilai({'7A': [('s-k7a-1', '', '', 80), ('s-k7a-2', '', '', 91), ('', '', 'Tidak Ada', 70), ('s-k7a-3', '', '', 'A+')],
                        '7B': [('s-k7b-1', '', '', None)], 'IX': [('x', '', 'Siapa', 60)]})
    unggah(klien, 'admin', 'admin', isi)
    log = db.nilai_impor_log.docs[-1]
    ps = {p['sheet']: p for p in log['per_sheet']}
    assert ps['7A'] == {'sheet': '7A', 'kelas': '7A', 'total': 4, 'diproses': 4, 'berhasil': 2, 'gagal': 2, 'kosong': 0, 'dilewati': 0, 'rata': 85.5}
    assert ps['7B']['total'] == 0 and ps['7B']['kosong'] == 1 and ps['7B']['rata'] is None and ps['IX']['kelas'] is None
    g = {(x['sheet'], x['baris']): x for x in log['galat']}
    assert g[('7A', 7)]['jenis'] == 'siswa' and g[('7A', 7)]['nama'] == 'Tidak Ada'
    assert g[('7A', 8)] == {'sheet': '7A', 'baris': 8, 'nama': None, 'siswa_id': 's-k7a-3', 'nilai': 'A+', 'jenis': 'nilai',
                            'pesan': 'Nilai bukan angka ("A+")'}
    assert g[('IX', 5)]['jenis'] == 'sheet' and log['galat_total'] == 3

    monkeypatch.setattr(ujian_nilai_impor, 'GALAT_MAKS_DISIMPAN', 2)
    unggah(klien, 'admin', 'admin', berkas_nilai({'7A': [('', '', f'Hantu {i}', 70) for i in range(5)]}))
    log = db.nilai_impor_log.docs[-1]
    assert len(log['galat']) == 2 and log['galat_total'] == 5 and log['gagal'] == 5


def test_endpoint_progres_dan_riwayat(klien):
    db = klien.db
    a = unggah(klien, 'guru1', 'guru', berkas_nilai({'7A': [('s-k7a-1', '', '', 80), ('', '', 'Hantu', 70)]})).json()['log_id']
    b = unggah(klien, 'admin', 'admin', berkas_nilai({'8A': [('s-k8a-1', '', '', 77)]}), mapel='ipa', jenjang=8).json()['log_id']
    db.nilai_impor_log.docs.append({'id': 'macet', 'ujian_id': 'uas', 'mapel_id': 'mtk', 'jenjang': 7, 'status': 'proses', 'diproses': 3,
                                    'total_baris': 9, 'waktu': '2026-01-01T07:00:00+07:00', 'per_sheet': [], 'galat': []})
    db.nilai_impor_log.docs.append({'id': 'jalan', 'ujian_id': 'uas', 'mapel_id': 'ipa', 'jenjang': 7, 'status': 'proses', 'diproses': 3,
                                    'total_baris': 12, 'waktu': '2099-01-01T00:00:00+07:00', 'per_sheet': [], 'galat': []})

    r = klien('guru1', 'guru', 'GET', f'/ujian/uas/nilai/impor/{a}')
    assert r.status_code == 200
    d = r.json()
    assert d['status'] == 'selesai' and d['persen'] == 100 and d['berhasil'] == 1 and d['galat'][0]['nama'] == 'Hantu'
    assert d['per_sheet'][0]['sheet'] == '7A' and d['diunggah_sebagai'] == 'Ketua Panitia'
    assert klien('admin', 'admin', 'GET', '/ujian/uas/nilai/impor/jalan').json()['persen'] == 25
    m = klien('admin', 'admin', 'GET', '/ujian/uas/nilai/impor/macet').json()
    assert m['status'] == 'gagal' and 'Impor terhenti' in m['pesan']
    assert next(x for x in db.nilai_impor_log.docs if x['id'] == 'macet')['status'] == 'gagal'
    assert klien('admin', 'admin', 'GET', '/ujian/uts/nilai/impor/' + a).status_code == 404
    assert klien('tu1', 'tenaga_kependidikan', 'GET', f'/ujian/uas/nilai/impor/{a}').status_code == 403

    h = klien('guru1', 'guru', 'GET', '/ujian/uas/nilai/impor').json()
    assert [x['id'] for x in h['items']] == ['jalan', b, a, 'macet'] and 'galat' not in h['items'][0]
    assert h['ringkasan'] == {'proses': 1, 'selesai': 2, 'gagal': 1}
    assert [x['id'] for x in klien('admin', 'admin', 'GET', '/ujian/uas/nilai/impor', params={'mapel_id': 'ipa', 'jenjang': 8}).json()['items']] == [b]
    assert [x['id'] for x in klien('admin', 'admin', 'GET', '/ujian/uas/nilai/impor', params={'status': 'gagal'}).json()['items']] == ['macet']
    assert klien('admin', 'admin', 'GET', '/ujian/uas/nilai/impor', params={'status': 'x'}).status_code == 422


def test_riwayat_dengan_metadata_pengunggah(klien):
    db = klien.db
    isi = berkas_nilai({'7A': [('s-k7a-1', '', '', 80)]})
    a = unggah(klien, 'guru1', 'guru', isi, nama='mtk7.xlsx').json()['log_id']
    b = unggah(klien, 'admin', 'admin', isi, mapel='ipa', nama='ipa7.xlsx').json()['log_id']
    log_a = next(x for x in db.nilai_impor_log.docs if x['id'] == a)
    assert log_a['diunggah_sebagai'] == 'Ketua Panitia' and log_a['ukuran'] == len(isi)
    log_a['selesai_pada'] = log_a['waktu'][:-6].rsplit(':', 1)[0] + ':59' + log_a['waktu'][-6:]  # pastikan durasi terbaca

    h = klien('admin', 'admin', 'GET', '/ujian/uas/nilai/impor').json()
    item = {x['id']: x for x in h['items']}
    assert item[b]['diunggah_sebagai'] == 'Admin' and item[b]['diunggah_oleh_nama'] == 'Administrator' and item[b]['berkas'] == 'ipa7.xlsx'
    assert item[a]['diunggah_oleh'] == 'guru1' and isinstance(item[a]['durasi_detik'], int) and item[a]['ukuran'] == len(isi)
    assert {(p['id'], p['nama'], p['sebagai'], p['jumlah']) for p in h['pengunggah']} == {
        ('guru1', 'Bu Siti', 'Ketua Panitia', 1), ('admin', 'Administrator', 'Admin', 1)}
    assert [x['id'] for x in klien('admin', 'admin', 'GET', '/ujian/uas/nilai/impor', params={'oleh': 'guru1'}).json()['items']] == [a]
    assert klien('admin', 'admin', 'GET', '/ujian/uas/nilai/impor', params={'batas': 1}).json()['items'][0]['id'] == b


def test_unggah_ulang_hanya_baris_gagal(klien):
    db = klien.db
    awal = berkas_nilai({'7A': [('s-k7a-1', '', '', 80), ('s-k7a-2', '', '', 'x'), ('s-k7a-3', '', '', 150)],
                         '7B': [('s-k7b-1', '', '', 90), ('s-k7b-2', '', '', 101)]})
    a = unggah(klien, 'guru1', 'guru', awal).json()['log_id']
    log_a = next(x for x in db.nilai_impor_log.docs if x['id'] == a)
    assert log_a['gagal'] == 3 and sorted(log_a['siswa_berhasil']) == ['s-k7a-1', 's-k7b-1']

    # berkas perbaikan = berkas lengkap yang sama; nilai siswa yang sudah berhasil diubah tapi harus DILEWATI
    perbaikan = berkas_nilai({'7A': [('s-k7a-1', '', '', 10), ('s-k7a-2', '', '', 75), ('s-k7a-3', '', '', 'y')],
                              '7B': [('s-k7b-1', '', '', 11), ('s-k7b-2', '', '', 99)]})
    r = klien('guru1', 'guru', 'POST', '/ujian/uas/nilai/impor', data={'mapel_id': 'mtk', 'jenjang': '7', 'ulang_dari': a},
              files={'berkas': ('perbaikan.xlsx', perbaikan, XLSX)})
    assert r.status_code == 200, r.text
    b = klien('guru1', 'guru', 'GET', f"/ujian/uas/nilai/impor/{r.json()['log_id']}").json()
    assert (b['ulang_dari'], b['dilewati'], b['total_baris'], b['berhasil'], b['gagal']) == (a, 2, 3, 2, 1)
    assert {p['sheet']: p['dilewati'] for p in b['per_sheet']} == {'7A': 1, '7B': 1} and 'siswa_berhasil' not in b
    nilai = {d['siswa_id']: d['nilai'] for d in db.nilai_ujian.docs}
    assert nilai == {'s-k7a-1': 80, 's-k7b-1': 90, 's-k7a-2': 75, 's-k7b-2': 99}

    # rantai: unggah ulang kedua dari log b hanya memproses s-k7a-3
    c = klien('guru1', 'guru', 'POST', '/ujian/uas/nilai/impor', data={'mapel_id': 'mtk', 'jenjang': '7', 'ulang_dari': b['id']},
              files={'berkas': ('p2.xlsx', berkas_nilai({'7A': [('s-k7a-1', '', '', 1), ('s-k7a-2', '', '', 2), ('s-k7a-3', '', '', 66)]}), XLSX)})
    c = next(x for x in db.nilai_impor_log.docs if x['id'] == c.json()['log_id'])
    assert (c['dilewati'], c['berhasil'], c['gagal']) == (2, 1, 0) and {d['siswa_id']: d['nilai'] for d in db.nilai_ujian.docs}['s-k7a-3'] == 66

    # berkas hanya berisi siswa yang sudah berhasil -> semua dilewati
    d = klien('guru1', 'guru', 'POST', '/ujian/uas/nilai/impor', data={'mapel_id': 'mtk', 'jenjang': '7', 'ulang_dari': b['id']},
              files={'berkas': ('p3.xlsx', berkas_nilai({'7A': [('s-k7a-1', '', '', 1), ('s-k7a-2', '', '', 2)]}), XLSX)})
    d = next(x for x in db.nilai_impor_log.docs if x['id'] == d.json()['log_id'])
    assert d['status'] == 'gagal' and 'Tidak ada baris gagal' in d['pesan']

    def ulang(dari, mapel='mtk', jenjang='7'):
        return klien('admin', 'admin', 'POST', '/ujian/uas/nilai/impor', data={'mapel_id': mapel, 'jenjang': jenjang, 'ulang_dari': dari},
                     files={'berkas': ('p.xlsx', perbaikan, XLSX)})
    assert ulang('tidak-ada').status_code == 404
    assert 'mapel & jenjang yang sama' in ulang(a, mapel='ipa').json()['detail']
    assert ulang(c['id']).status_code == 409  # c tanpa baris gagal


def test_unduh_template_lalu_impor_kembali(klien):
    from openpyxl import load_workbook
    db = klien.db
    db.classes.docs.append({'id': 'k7c', 'name': '7C/Unggulan', 'grade': 7, 'semester_id': 'sem-kini'})
    db.users.docs.append({'id': 's-pindah', 'full_name': 'Pindahan', 'roles': ['siswa'], 'student_class_id': 'k7a', 'is_active': False})
    db.nilai_ujian.docs.append({'ujian_id': 'uas', 'mapel_id': 'mtk', 'siswa_id': 's-k7a-2', 'nilai': 81.5})
    r = klien('guru1', 'guru', 'GET', '/ujian/uas/nilai/template', params={'mapel_id': 'mtk', 'jenjang': 7})
    assert r.status_code == 200 and r.headers['content-type'].startswith(XLSX)
    assert 'template_nilai_uas_Matematika_kelas_7.xlsx' in r.headers['content-disposition']
    wb = load_workbook(io.BytesIO(r.content))
    assert wb.sheetnames == ['7A', '7B', '7C-Unggulan', '_meta'] and wb['_meta'].sheet_state == 'hidden'
    ws = wb['7A']
    assert [c.value for c in ws[4]] == ['No', 'ID Siswa', 'NIS', 'Nama', 'Nilai UAS']
    baris = [[c.value for c in row] for row in ws.iter_rows(min_row=5)]
    assert [b[1] for b in baris] == ['s-k7a-1', 's-k7a-2', 's-k7a-3'] and baris[1][4] == 81.5 and baris[0][4] is None
    assert wb['7C-Unggulan'].max_row == 4  # kelas tanpa siswa: hanya header
    assert {r[0].value: r[1].value for r in wb['_meta'].iter_rows()} == {'jenis': 'template_nilai_uas', 'ujian_id': 'uas', 'mapel_id': 'mtk', 'jenjang': '7'}

    # isi lalu unggah kembali: nama sheet hasil sanitasi tetap cocok dengan kelasnya
    ws['E5'] = 90
    wb['7B']['E5'] = 70
    out = io.BytesIO()
    wb.save(out)
    log_id = unggah(klien, 'guru1', 'guru', out.getvalue()).json()['log_id']
    log = next(x for x in db.nilai_impor_log.docs if x['id'] == log_id)
    assert log['status'] == 'selesai' and log['berhasil'] == 3 and log['gagal'] == 0 and log['kelas_tanpa_sheet'] == []
    # template mapel lain tertolak saat diimpor ke mapel berbeda
    ipa = klien('admin', 'admin', 'GET', '/ujian/uas/nilai/template', params={'mapel_id': 'ipa', 'jenjang': 7}).content
    unggah(klien, 'admin', 'admin', ipa)
    assert 'template IPA, bukan Matematika' in db.nilai_impor_log.docs[-1]['pesan']

    assert klien('admin', 'admin', 'GET', '/ujian/uas/nilai/template', params={'mapel_id': 'x', 'jenjang': 7}).status_code == 404
    assert klien('admin', 'admin', 'GET', '/ujian/uas/nilai/template', params={'mapel_id': 'mtk', 'jenjang': 9}).status_code == 404
    assert klien('tu1', 'tenaga_kependidikan', 'GET', '/ujian/uas/nilai/template', params={'mapel_id': 'mtk', 'jenjang': 7}).status_code == 403


def test_pilihan_impor_dan_riwayat_perubahan(klien):
    db = klien.db
    db.semesters.docs[1]['curriculum_id'] = 'kur-merdeka'
    db.subjects.docs[0]['curriculum_ids'] = ['kur-merdeka']
    db.subjects.docs.append({'id': 'arab', 'name': 'Bahasa Arab', 'curriculum_ids': ['kur-merdeka']})
    p = klien('guru1', 'guru', 'GET', '/ujian/uas/nilai/pilihan').json()
    assert [m['nama'] for m in p['mapel']] == ['Bahasa Arab', 'Matematika'] and p['boleh_impor'] is True and p['pesan'] is None
    assert p['jenjang'] == [{'jenjang': 7, 'kelas': [{'id': 'k7a', 'nama': '7A', 'jumlah_siswa': 3}, {'id': 'k7b', 'nama': '7B', 'jumlah_siswa': 3}]},
                            {'jenjang': 8, 'kelas': [{'id': 'k8a', 'nama': '8A', 'jumlah_siswa': 3}]}]
    assert 'ujian UAS' in klien('admin', 'admin', 'GET', '/ujian/uts/nilai/pilihan').json()['pesan']
    lalu = klien('admin', 'admin', 'GET', '/ujian/uas-lalu/nilai/pilihan').json()
    assert lalu['boleh_impor'] is False and 'arsip' in lalu['pesan']
    assert klien('tu1', 'tenaga_kependidikan', 'GET', '/ujian/uas/nilai/pilihan').status_code == 403

    unggah(klien, 'guru1', 'guru', berkas_nilai({'7A': [('s-k7a-1', '', '', 80), ('s-k7a-2', '', '', 70)]}))
    assert db.nilai_impor_log.docs[-1]['berubah'] == 2
    unggah(klien, 'guru1', 'guru', berkas_nilai({'7A': [('s-k7a-1', '', '', 80), ('s-k7a-2', '', '', 75)]}))
    log = db.nilai_impor_log.docs[-1]
    assert log['berubah'] == 1 and log['berhasil'] == 2
    jejak = [(r['siswa_id'], r['nilai_lama'], r['nilai_baru'], r['impor_log_id'] == log['id']) for r in db.nilai_ujian_riwayat.docs]
    assert jejak == [('s-k7a-1', None, 80, False), ('s-k7a-2', None, 70, False), ('s-k7a-2', 70, 75, True)]
    assert db.nilai_ujian_riwayat.docs[-1]['oleh_nama'] == 'Bu Siti' and db.nilai_ujian_riwayat.docs[-1]['sumber'] == 'impor'


def test_sinkron_rapor_dan_ubah_nilai_guru(klien):
    db = klien.db
    db.schedules.docs.append({'id': 'j1', 'class_id': 'k7a', 'subject_id': 'mtk', 'teacher_id': 'guru2'})
    db.grade_entries.docs.append({'id': 'g-lama', 'student_id': 's-k7a-1', 'class_id': 'k7a', 'subject_id': 'mtk', 'academic_year_id': 'tp-kini',
                                  'semester': 'ganjil', 'nilai_pengetahuan': 85, 'nilai_akhir': 85, 'predicate': 'B'})
    unggah(klien, 'guru1', 'guru', berkas_nilai({'7A': [('s-k7a-1', '', '', 80), ('s-k7a-2', '', '', 70)]}))
    rapor = {g['student_id']: g for g in db.grade_entries.docs}
    assert rapor['s-k7a-1']['nilai_uas'] == 80 and rapor['s-k7a-1']['nilai_pengetahuan'] == 85 and rapor['s-k7a-1']['predicate'] == 'B'
    assert rapor['s-k7a-1']['nilai_uas_ujian_id'] == 'uas' and rapor['s-k7a-1']['nilai_uas_sumber'] == 'impor'
    assert rapor['s-k7a-2']['nilai_uas'] == 70 and rapor['s-k7a-2']['nilai_pengetahuan'] is None and rapor['s-k7a-2']['semester'] == 'ganjil'
    # GET /grades (Input Nilai guru) ikut membawa nilai_uas
    g = klien('guru2', 'guru', 'GET', '/grades', params={'class_id': 'k7a', 'subject_id': 'mtk', 'semester': 'ganjil'}).json()
    assert sorted(x['nilai_uas'] for x in g) == [70, 80]

    # masa ditutup: guru pengampu terkunci, admin tetap boleh
    m = klien('guru2', 'guru', 'GET', '/ujian/nilai/masa-guru', params={'class_id': 'k7a', 'subject_id': 'mtk'}).json()
    assert m['boleh_ubah'] is False and 'ditutup' in m['pesan'] and m['ujian_nama'] == 'UAS uas'
    isi = {'class_id': 'k7a', 'subject_id': 'mtk', 'entries': [{'student_id': 's-k7a-1', 'nilai_uas': 88}]}
    assert klien('guru2', 'guru', 'PUT', '/ujian/nilai/guru', json=isi).status_code == 403
    assert klien('admin', 'admin', 'GET', '/ujian/nilai/masa-guru', params={'class_id': 'k7a', 'subject_id': 'mtk'}).json()['boleh_ubah'] is True

    # masa remidi dibuka (HARI_INI 2026-12-02)
    db.nilai_masa.docs.append({'ujian_id': 'uas', 'ujian': {'aktif': False}, 'remidi': {'aktif': True, 'mulai': '2026-12-01', 'selesai': '2026-12-03'}})
    m = klien('guru2', 'guru', 'GET', '/ujian/nilai/masa-guru', params={'class_id': 'k7a', 'subject_id': 'mtk'}).json()
    assert m['boleh_ubah'] is True and m['masa'] == {'jenis': 'remidi', 'mulai': '2026-12-01', 'selesai': '2026-12-03'}
    bukan = klien('guru1', 'guru', 'GET', '/ujian/nilai/masa-guru', params={'class_id': 'k7a', 'subject_id': 'mtk'}).json()
    assert bukan['boleh_ubah'] is False and 'bukan pengampu' in bukan['pesan']
    assert klien('guru1', 'guru', 'PUT', '/ujian/nilai/guru', json=isi).status_code == 403

    isi['entries'] += [{'student_id': 's-k7a-2', 'nilai_uas': 70}, {'student_id': 's-k7a-3', 'nilai_uas': 60}]
    r = klien('guru2', 'guru', 'PUT', '/ujian/nilai/guru', json=isi)
    assert r.status_code == 200 and r.json()['disimpan'] == 2  # s-k7a-2 tidak berubah
    nilai = {d['siswa_id']: d for d in db.nilai_ujian.docs}
    assert nilai['s-k7a-1']['nilai'] == 88 and nilai['s-k7a-1']['sumber'] == 'input_guru' and nilai['s-k7a-3']['nilai'] == 60
    rapor = {g['student_id']: g for g in db.grade_entries.docs}
    assert rapor['s-k7a-1']['nilai_uas'] == 88 and rapor['s-k7a-1']['nilai_uas_sumber'] == 'input_guru' and rapor['s-k7a-3']['teacher_id'] == 'guru2'
    assert db.nilai_ujian_riwayat.docs[-2]['nilai_lama'] == 80 and db.nilai_ujian_riwayat.docs[-2]['oleh_nama'] == 'Pak Hadi'
    assert any(a.get('action') == 'ujian_nilai_guru' for a in db.audit_logs.docs)

    # hapus nilai (null) dan validasi
    klien('guru2', 'guru', 'PUT', '/ujian/nilai/guru', json={'class_id': 'k7a', 'subject_id': 'mtk', 'entries': [{'student_id': 's-k7a-3', 'nilai_uas': None}]})
    assert {g['student_id']: g for g in db.grade_entries.docs}['s-k7a-3']['nilai_uas'] is None
    salah = {'class_id': 'k7a', 'subject_id': 'mtk', 'entries': [{'student_id': 's-k7a-1', 'nilai_uas': 101}]}
    assert klien('guru2', 'guru', 'PUT', '/ujian/nilai/guru', json=salah).status_code == 422
    assert 'bukan anggota aktif' in klien('guru2', 'guru', 'PUT', '/ujian/nilai/guru', json={'class_id': 'k7a', 'subject_id': 'mtk', 'entries': [
        {'student_id': 's-k7b-1', 'nilai_uas': 50}]}).json()['detail']


def test_nilai_rapor_siswa_lintas_tahun(klien):
    db = klien.db
    db.classes.docs.append({'id': 'k7-lalu', 'name': '7A', 'grade': 7, 'semester_id': 'sem-lalu', 'homeroom_teacher_id': 'guru2'})
    db.classes.docs[0]['homeroom_teacher_id'] = 'guru1'  # k7a: wali kelas guru1
    db.grade_entries.docs += [
        {'id': 'a', 'student_id': 's-k7a-1', 'class_id': 'k7a', 'subject_id': 'mtk', 'academic_year_id': 'tp-kini', 'semester': 'ganjil', 'nilai_uas': 88},
        {'id': 'b', 'student_id': 's-k7a-1', 'class_id': 'k7-lalu', 'subject_id': 'ipa', 'academic_year_id': 'tp-lalu', 'semester': 'genap', 'nilai_uas': 75},
        {'id': 'c', 'student_id': 's-k7a-2', 'class_id': 'k7a', 'subject_id': 'mtk', 'academic_year_id': 'tp-kini', 'semester': 'ganjil', 'nilai_uas': 60},
    ]
    r = klien('guru1', 'guru', 'GET', '/grades/student/s-k7a-1')
    assert r.status_code == 200
    assert [(x['subject_name'], x['class_name'], x['nilai_uas']) for x in r.json()] == [('IPA', '7A', 75), ('Matematika', '7A', 88)]
    assert klien('s-k7a-1', 'siswa', 'GET', '/grades/student/s-k7a-1').status_code == 200
    assert klien('s-k7a-1', 'siswa', 'GET', '/grades/student/s-k7a-2').status_code == 403
    assert klien('guru2', 'guru', 'GET', '/grades/student/s-k7a-1').status_code == 403
    assert klien('admin', 'admin', 'GET', '/grades/student/tidak-ada').status_code == 404


def test_atur_masa_ujian_dan_remidi(klien):
    db = klien.db
    kosong = klien('guru1', 'guru', 'GET', '/ujian/uas/nilai/masa').json()
    assert kosong == {'boleh_ubah': True, 'ujian': {'aktif': False, 'mulai': None, 'selesai': None},
                      'remidi': {'aktif': False, 'mulai': None, 'selesai': None}, 'terbuka_sekarang': None, 'diubah': None}
    isi = {'ujian': {'aktif': True, 'mulai': '2026-12-01', 'selesai': '2026-12-06'}, 'remidi': {'aktif': False, 'mulai': '2026-12-10', 'selesai': None}}
    r = klien('guru1', 'guru', 'PUT', '/ujian/uas/nilai/masa', json=isi)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d['terbuka_sekarang'] == 'ujian' and d['diubah']['oleh_nama'] == 'Bu Siti' and d['remidi']['mulai'] == '2026-12-10'
    assert db.nilai_masa.docs[0]['ujian']['selesai'] == '2026-12-06' and any(a.get('action') == 'ujian_nilai_masa' for a in db.audit_logs.docs)
    assert klien('admin', 'admin', 'GET', '/ujian/uas/nilai/masa').json()['terbuka_sekarang'] == 'ujian'

    # dipakai langsung oleh status guru
    db.schedules.docs.append({'id': 'j1', 'class_id': 'k7a', 'subject_id': 'mtk', 'teacher_id': 'guru2'})
    assert klien('guru2', 'guru', 'GET', '/ujian/nilai/masa-guru', params={'class_id': 'k7a', 'subject_id': 'mtk'}).json()['masa']['jenis'] == 'ujian'
    isi['ujian']['aktif'] = False
    klien('admin', 'admin', 'PUT', '/ujian/uas/nilai/masa', json=isi)
    assert len(db.nilai_masa.docs) == 1
    assert klien('guru2', 'guru', 'GET', '/ujian/nilai/masa-guru', params={'class_id': 'k7a', 'subject_id': 'mtk'}).json()['boleh_ubah'] is False

    salah = {'ujian': {'aktif': True, 'mulai': '2026-12-06', 'selesai': '2026-12-01'}, 'remidi': {'aktif': False}}
    assert klien('admin', 'admin', 'PUT', '/ujian/uas/nilai/masa', json=salah).status_code == 422
    assert klien('admin', 'admin', 'PUT', '/ujian/uas/nilai/masa', json={'ujian': {'aktif': True}, 'remidi': {}}).status_code == 422
    assert klien('tu1', 'tenaga_kependidikan', 'PUT', '/ujian/uas/nilai/masa', json=isi).status_code == 403
    assert klien('admin', 'admin', 'PUT', '/ujian/uts/nilai/masa', json=isi).status_code == 400
    assert klien('admin', 'admin', 'PUT', '/ujian/uas-lalu/nilai/masa', json=isi).status_code == 409
    assert klien('admin', 'admin', 'GET', '/ujian/uas-lalu/nilai/masa').json()['boleh_ubah'] is False


def test_edit_nilai_kelas_dengan_audit_dan_kunci(klien):
    db = klien.db
    db.users.docs.append({'id': 'sek', 'username': 'sek', 'full_name': 'Bu Sekretaris', 'roles': ['guru'], 'is_active': True, 'token_version': 0})
    db.panitia_ujian.docs.append({'id': 'p9', 'ujian_id': 'uas', 'jabatan': 'sekretaris', 'user_id': 'sek'})
    unggah(klien, 'guru1', 'guru', berkas_nilai({'7A': [('s-k7a-1', '', '', 80)]}))

    d = klien('sek', 'guru', 'GET', '/ujian/uas/nilai/kelas/k7a', params={'mapel_id': 'mtk'}).json()
    assert d['kelas'] == {'id': 'k7a', 'nama': '7A', 'jenjang': 7} and d['mapel'] == {'id': 'mtk', 'nama': 'Matematika'}
    assert d['boleh_ubah'] is True and d['alasan_kunci'] is None
    assert [(x['siswa_id'], x['nilai'], x['sumber']) for x in d['items']] == [('s-k7a-1', 80, 'impor'), ('s-k7a-2', None, None), ('s-k7a-3', None, None)]

    isi = {'mapel_id': 'mtk', 'entries': [{'siswa_id': 's-k7a-1', 'nilai': 85}, {'siswa_id': 's-k7a-2', 'nilai': 72.5}, {'siswa_id': 's-k7a-3', 'nilai': None}]}
    r = klien('sek', 'guru', 'PUT', '/ujian/uas/nilai/kelas/k7a', json=isi)
    assert r.status_code == 200 and r.json() == {'disimpan': 2}
    audit = next(a for a in db.audit_logs.docs if a.get('action') == 'ujian_nilai_edit')
    assert audit['details']['perubahan'] == [{'siswa_id': 's-k7a-1', 'lama': 80, 'baru': 85}, {'siswa_id': 's-k7a-2', 'lama': None, 'baru': 72.5}]
    rapor = {g['student_id']: g['nilai_uas'] for g in db.grade_entries.docs}
    assert rapor == {'s-k7a-1': 85, 's-k7a-2': 72.5}
    jejak = klien('guru1', 'guru', 'GET', '/ujian/uas/nilai/riwayat', params={'mapel_id': 'mtk', 'siswa_id': 's-k7a-1'}).json()['items']
    assert [(j['nilai_lama'], j['nilai_baru'], j['sumber'], j['oleh_nama']) for j in jejak] == [
        (80, 85, 'input_panitia', 'Bu Sekretaris'), (None, 80, 'impor', 'Bu Siti')]
    assert len(klien('admin', 'admin', 'GET', '/ujian/uas/nilai/riwayat', params={'mapel_id': 'mtk', 'kelas_id': 'k7a'}).json()['items']) == 3

    # masa diatur lalu ditutup -> panitia terkunci (edit, impor, pilihan), admin tetap boleh
    db.nilai_masa.docs.append({'ujian_id': 'uas', 'ujian': {'aktif': True, 'mulai': '2026-11-01', 'selesai': '2026-11-30'}, 'remidi': {'aktif': False}})
    d = klien('sek', 'guru', 'GET', '/ujian/uas/nilai/kelas/k7a', params={'mapel_id': 'mtk'}).json()
    assert d['boleh_ubah'] is False and 'Nilai terkunci' in d['alasan_kunci']
    r = klien('sek', 'guru', 'PUT', '/ujian/uas/nilai/kelas/k7a', json=isi)
    assert r.status_code == 423 and 'masa ujian/remidi sedang ditutup' in r.json()['detail']
    assert unggah(klien, 'guru1', 'guru', berkas_nilai({'7A': [('s-k7a-1', '', '', 1)]})).status_code == 423
    p = klien('guru1', 'guru', 'GET', '/ujian/uas/nilai/pilihan').json()
    assert p['boleh_impor'] is False and 'terkunci' in p['pesan']
    assert klien('admin', 'admin', 'GET', '/ujian/uas/nilai/kelas/k7a', params={'mapel_id': 'mtk'}).json()['boleh_ubah'] is True
    isi['entries'] = [{'siswa_id': 's-k7a-1', 'nilai': 90}]
    assert klien('admin', 'admin', 'PUT', '/ujian/uas/nilai/kelas/k7a', json=isi).json() == {'disimpan': 1}
    # panitia membuka masa remidi -> terbuka lagi
    buka = {'ujian': {'aktif': True, 'mulai': '2026-11-01', 'selesai': '2026-11-30'}, 'remidi': {'aktif': True, 'mulai': '2026-12-02', 'selesai': '2026-12-04'}}
    assert klien('sek', 'guru', 'PUT', '/ujian/uas/nilai/masa', json=buka).status_code == 200
    assert klien('sek', 'guru', 'PUT', '/ujian/uas/nilai/kelas/k7a', json=isi).json() == {'disimpan': 0}

    # validasi
    def kirim(sid, n):
        return klien('sek', 'guru', 'PUT', '/ujian/uas/nilai/kelas/k7a', json={'mapel_id': 'mtk', 'entries': [{'siswa_id': sid, 'nilai': n}]})
    assert kirim('s-k7b-1', 1).status_code == 400 and kirim('s-k7a-1', -1).status_code == 422
    assert klien('sek', 'guru', 'GET', '/ujian/uas/nilai/kelas/k9x', params={'mapel_id': 'mtk'}).status_code == 404
    assert klien('sek', 'guru', 'GET', '/ujian/uas/nilai/kelas/k7a', params={'mapel_id': 'x'}).status_code == 404
    assert klien('tu1', 'tenaga_kependidikan', 'GET', '/ujian/uas/nilai/kelas/k7a', params={'mapel_id': 'mtk'}).status_code == 403


def test_rekap_kelas_dan_sinkron_ulang_rapor(klien):
    db = klien.db
    db.schedules.docs += [{'id': 'j1', 'class_id': 'k7a', 'subject_id': 'mtk', 'teacher_id': 'guru2'}]
    unggah(klien, 'guru1', 'guru', berkas_nilai({'7A': [('s-k7a-1', '', '', 80), ('s-k7a-2', '', '', 91)], '7B': [('s-k7b-1', '', '', 70)]}))
    r = klien('guru1', 'guru', 'GET', '/ujian/uas/nilai/rekap', params={'mapel_id': 'mtk', 'jenjang': 7}).json()
    assert r['kelas'] == [
        {'kelas_id': 'k7a', 'nama': '7A', 'total': 3, 'terisi': 2, 'rata': 85.5, 'guru_nama': 'Pak Hadi', 'tersinkron': 2},
        {'kelas_id': 'k7b', 'nama': '7B', 'total': 3, 'terisi': 1, 'rata': 70.0, 'guru_nama': None, 'tersinkron': 1}]
    assert klien('guru1', 'guru', 'GET', '/ujian/uas/nilai/rekap', params={'mapel_id': 'ipa', 'jenjang': 7}).json()['kelas'][0]['terisi'] == 0
    assert klien('guru1', 'guru', 'GET', '/ujian/uas/nilai/rekap', params={'mapel_id': 'x', 'jenjang': 7}).status_code == 404

    # baris rapor terhapus oleh modul E-Rapor -> sinkron ulang memulihkan kolom UAS
    db.grade_entries.docs.clear()
    assert klien('guru1', 'guru', 'POST', '/ujian/uas/nilai/sinkron-rapor', json={}).status_code == 403
    h = klien('admin', 'admin', 'POST', '/ujian/uas/nilai/sinkron-rapor', json={'mapel_id': 'mtk'})
    assert h.status_code == 200 and h.json() == {'disinkron': 3}
    assert sorted((g['student_id'], g['nilai_uas'], g['semester'], g['academic_year_id']) for g in db.grade_entries.docs) == [
        ('s-k7a-1', 80, 'ganjil', 'tp-kini'), ('s-k7a-2', 91, 'ganjil', 'tp-kini'), ('s-k7b-1', 70, 'ganjil', 'tp-kini')]
    assert klien('admin', 'admin', 'POST', '/ujian/uas/nilai/sinkron-rapor', json={}).json() == {'disinkron': 3}
    assert len(db.grade_entries.docs) == 3  # idempoten: tidak menggandakan baris rapor
    assert klien('guru1', 'guru', 'GET', '/ujian/uas/nilai/rekap', params={'mapel_id': 'mtk', 'jenjang': 7}).json()['kelas'][0]['tersinkron'] == 2
