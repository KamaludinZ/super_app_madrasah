"""Input Nilai guru mapel: tab Ulangan/Sumatif (multi kolom), UTS (satu kolom), mode kolom nilai vs pengetahuan &
keterampilan per kelas–mapel–semester, ketercapaian dari KKTP, dan sinkron rerata ke grade_entries untuk siswa."""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(__file__))

from ujian_dasar import buat_klien, tambah_kelas_siswa  # noqa: E402
import penilaian as pn  # noqa: E402,I100

DASAR = '/penilaian/kelas/k7a/mapel/mtk'


@pytest.fixture
def klien(monkeypatch):
    k = buat_klien(monkeypatch)
    db = k.db
    tambah_kelas_siswa(db, per_kelas=3)
    db.subjects.docs += [{'id': 'mtk', 'name': 'Matematika', 'code': 'MTK'}, {'id': 'ipa', 'name': 'IPA'}]
    db.schedules.docs += [{'id': 'j1', 'class_id': 'k7a', 'subject_id': 'mtk', 'teacher_id': 'guru1'}]
    next(u for u in db.users.docs if u['id'] == 's-k7a-3')['is_active'] = False  # nonaktif: tidak ikut
    return k


def test_interval_dan_ketercapaian_kktp():
    assert pn.interval_ketercapaian(65) == {'belum': [0, 64], 'cukup': [65, 76], 'baik': [77, 88], 'sangat_baik': [89, 100]}
    assert pn.interval_ketercapaian(75) == {'belum': [0, 74], 'cukup': [75, 83], 'baik': [84, 91], 'sangat_baik': [92, 100]}
    assert [pn.ketercapaian(n, 65) for n in (64.9, 65, 76.5, 77, 88, 89, 100)] == \
        ['belum', 'cukup', 'cukup', 'baik', 'baik', 'sangat_baik', 'sangat_baik']
    assert pn.ketercapaian(None, 65) is None and pn.ketercapaian(80, None) is None
    assert pn.interval_ketercapaian(100)['cukup'] is None and pn.ketercapaian(100, 100) == 'sangat_baik'
    assert pn.nilai_akhir({'p': 80, 'k': 91}, 'pk') == 85.5 and pn.nilai_akhir({'p': 80}, 'pk') == 80
    assert pn.nilai_akhir({'nilai': 70, 'p': 10}, 'nilai') == 70 and pn.nilai_akhir({}, 'nilai') is None
    assert pn.rerata([70, None, 81]) == 75.5 and pn.rerata([None]) is None


def test_akses_hanya_pengampu_dan_admin(klien):
    assert klien('guru1', 'guru', 'GET', DASAR, params={'semester': 'ganjil'}).status_code == 200
    assert klien('admin', 'admin', 'GET', '/penilaian/kelas/k7a/mapel/ipa', params={'semester': 'ganjil'}).status_code == 200
    r = klien('guru2', 'guru', 'GET', DASAR, params={'semester': 'ganjil'})
    assert r.status_code == 403 and 'pengampu' in r.json()['detail']
    assert klien('guru1', 'guru', 'GET', '/penilaian/kelas/k7a/mapel/ipa', params={'semester': 'ganjil'}).status_code == 403
    assert klien('guru1', 'guru', 'GET', '/penilaian/kelas/x/mapel/mtk', params={'semester': 'ganjil'}).status_code == 404
    d = klien('guru1', 'guru', 'GET', DASAR, params={'semester': 'ganjil'}).json()
    assert [s['id'] for s in d['siswa']] == ['s-k7a-1', 's-k7a-2'] and d['mode'] == 'nilai' and d['mode_terkunci'] is False
    assert d['kolom'] == {'ulangan': [], 'sumatif': [], 'uts': None} and d['tahun_pelajaran'] == '2026/2027'


def test_sumatif_multi_kolom_rerata_dan_sinkron_rapor(klien):
    db = klien.db
    g = lambda m, p, **kw: klien('guru1', 'guru', m, p, **kw)  # noqa: E731
    r = g('POST', f'{DASAR}/kolom', json={'semester': 'ganjil', 'jenis': 'sumatif', 'ke': 1, 'ringkasan': '  Menjelaskan   bilangan  bulat ',
                                          'kktp': 65, 'nilai': {'s-k7a-1': {'nilai': 80}, 's-k7a-2': {'nilai': 60}}})
    assert r.status_code == 200, r.text
    d = r.json()
    k1 = d['kolom']['sumatif'][0]
    assert (k1['ke'], k1['ringkasan'], k1['kktp']) == (1, 'Menjelaskan bilangan bulat', 65)
    assert k1['nilai']['s-k7a-1'] == {'nilai': 80, 'akhir': 80, 'ketercapaian': 'baik'}
    assert k1['nilai']['s-k7a-2']['ketercapaian'] == 'belum' and k1['rerata_kelas'] == 70
    assert k1['interval']['sangat_baik'] == [89, 100] and d['mode_terkunci'] is True
    # Kolom ke-2; nomor sama ditolak.
    assert g('POST', f'{DASAR}/kolom', json={'semester': 'ganjil', 'jenis': 'sumatif', 'ke': 1, 'kktp': 70}).status_code == 409
    d = g('POST', f'{DASAR}/kolom', json={'semester': 'ganjil', 'jenis': 'sumatif', 'ke': 2, 'kktp': 70,
                                          'nilai': {'s-k7a-1': {'nilai': 91}}}).json()
    assert d['rekap']['s-k7a-1']['sumatif'] == 85.5 and d['rekap']['s-k7a-2']['sumatif'] == 60
    baris = {b['student_id']: b for b in db.grade_entries.docs}
    assert baris['s-k7a-1']['nilai_sumatif'] == 85.5 and baris['s-k7a-1']['class_id'] == 'k7a' and baris['s-k7a-1']['semester'] == 'ganjil'
    assert baris['s-k7a-1']['nilai_akhir'] is None  # tidak ada nilai gabungan
    # Ubah kolom 2 (nilai lengkap menggantikan), lalu hapus kolom 1 -> rerata dihitung ulang.
    kolom2 = d['kolom']['sumatif'][1]['id']
    d = g('PUT', f'/penilaian/kolom/{kolom2}', json={'kktp': 75, 'nilai': {'s-k7a-1': {'nilai': 95}, 's-k7a-2': {'nilai': 74}}}).json()
    assert d['kolom']['sumatif'][1]['kktp'] == 75 and d['kolom']['sumatif'][1]['nilai']['s-k7a-2']['ketercapaian'] == 'belum'
    d = g('DELETE', f"/penilaian/kolom/{d['kolom']['sumatif'][0]['id']}").json()
    assert len(d['kolom']['sumatif']) == 1 and d['rekap']['s-k7a-1']['sumatif'] == 95
    assert {b['student_id']: b['nilai_sumatif'] for b in db.grade_entries.docs} == {'s-k7a-1': 95, 's-k7a-2': 74}
    # Siswa asing / nilai di luar 0–100 ditolak; guru lain tidak bisa mengubah kolom.
    assert g('PUT', f'/penilaian/kolom/{kolom2}', json={'nilai': {'s-k8a-1': {'nilai': 90}}}).status_code == 400
    assert g('PUT', f'/penilaian/kolom/{kolom2}', json={'nilai': {'s-k7a-1': {'nilai': 101}}}).status_code == 422
    assert klien('guru2', 'guru', 'DELETE', f'/penilaian/kolom/{kolom2}').status_code == 403
    assert klien('guru1', 'guru', 'PUT', '/penilaian/kolom/tidak-ada', json={'kktp': 70}).status_code == 404
    assert [a['action'] for a in db.audit_logs.docs if a['action'].startswith('penilaian_kolom')] == \
        ['penilaian_kolom_simpan', 'penilaian_kolom_simpan', 'penilaian_kolom_ubah', 'penilaian_kolom_hapus']


def test_ulangan_uts_dan_rekap_per_jenis(klien):
    db = klien.db
    g = lambda m, p, **kw: klien('guru1', 'guru', m, p, **kw)  # noqa: E731
    for ke, n in ((1, 70), (2, 90)):
        g('POST', f'{DASAR}/kolom', json={'semester': 'ganjil', 'jenis': 'ulangan', 'ke': ke, 'kktp': 70, 'nilai': {'s-k7a-1': {'nilai': n}}})
    d = g('POST', f'{DASAR}/kolom', json={'semester': 'ganjil', 'jenis': 'uts', 'kktp': 70, 'nilai': {'s-k7a-1': {'nilai': 77}}}).json()
    uts_id = d['kolom']['uts']['id']
    # UTS satu kolom: simpan lagi = memperbarui kolom yang sama.
    d = g('POST', f'{DASAR}/kolom', json={'semester': 'ganjil', 'jenis': 'uts', 'kktp': 75, 'nilai': {'s-k7a-1': {'nilai': 88}}}).json()
    assert d['kolom']['uts']['id'] == uts_id and d['kolom']['uts']['kktp'] == 75
    assert d['rekap']['s-k7a-1'] == {'ulangan': 80, 'sumatif': None, 'uts': 88, 'uas': None}
    b = next(x for x in db.grade_entries.docs if x['student_id'] == 's-k7a-1')
    assert (b['nilai_harian'], b['nilai_uts'], b['nilai_sumatif']) == (80, 88, None)
    assert not any(x['student_id'] == 's-k7a-2' for x in db.grade_entries.docs)  # tanpa nilai: tidak dibuat baris kosong
    # Semester lain terpisah; UAS dari modul ujian ikut tampil di rekap.
    assert g('GET', DASAR, params={'semester': 'genap'}).json()['kolom'] == {'ulangan': [], 'sumatif': [], 'uts': None}
    b['nilai_uas'] = 91
    assert g('GET', DASAR, params={'semester': 'ganjil'}).json()['rekap']['s-k7a-1']['uas'] == 91
    # Siswa melihat nilai per jenis lewat /grades/student (tanpa nilai gabungan).
    s = klien('s-k7a-1', 'siswa', 'GET', '/grades/student/s-k7a-1').json()[0]
    assert (s['nilai_harian'], s['nilai_sumatif'], s['nilai_uts'], s['nilai_uas']) == (80, None, 88, 91)


def test_mode_pengetahuan_keterampilan_dan_kunci(klien):
    g = lambda m, p, **kw: klien('guru1', 'guru', m, p, **kw)  # noqa: E731
    d = g('PUT', f'{DASAR}/mode', json={'semester': 'ganjil', 'mode': 'pk'}).json()
    assert d['mode'] == 'pk' and d['mode_terkunci'] is False
    assert g('GET', DASAR, params={'semester': 'genap'}).json()['mode'] == 'nilai'  # per semester
    assert g('GET', '/penilaian/kelas/k7a/mapel/mtk', params={'semester': 'ganjil'}).json()['mode'] == 'pk'
    d = g('POST', f'{DASAR}/kolom', json={'semester': 'ganjil', 'jenis': 'sumatif', 'ke': 1, 'kktp': 65,
                                          'nilai': {'s-k7a-1': {'p': 80, 'k': 90, 'nilai': 10}, 's-k7a-2': {'p': 60}}}).json()
    n = d['kolom']['sumatif'][0]['nilai']
    assert n['s-k7a-1'] == {'p': 80, 'k': 90, 'akhir': 85, 'ketercapaian': 'baik'}  # bidang 'nilai' dibuang di mode pk
    assert n['s-k7a-2']['akhir'] == 60 and d['rekap']['s-k7a-1']['sumatif'] == 85
    # Sudah ada nilai: mode terkunci (ganti ditolak, tetap sama diterima).
    r = g('PUT', f'{DASAR}/mode', json={'semester': 'ganjil', 'mode': 'nilai'})
    assert r.status_code == 409 and 'sudah ada nilai' in r.json()['detail']
    assert g('PUT', f'{DASAR}/mode', json={'semester': 'ganjil', 'mode': 'pk'}).status_code == 200
    assert g('PUT', f'{DASAR}/mode', json={'semester': 'ganjil', 'mode': 'lain'}).status_code == 422
    # Kosongkan nilai -> mode boleh diganti lagi.
    g('PUT', f"/penilaian/kolom/{d['kolom']['sumatif'][0]['id']}", json={'nilai': {}})
    assert g('PUT', f'{DASAR}/mode', json={'semester': 'ganjil', 'mode': 'nilai'}).json()['mode'] == 'nilai'
    assert klien('guru2', 'guru', 'PUT', f'{DASAR}/mode', json={'semester': 'ganjil', 'mode': 'pk'}).status_code == 403


def _baca_xlsx(isi):
    import io

    from openpyxl import load_workbook
    wb = load_workbook(io.BytesIO(isi))
    return wb


def test_template_excel_dan_impor_ke_layar(klien):
    import io
    g = lambda m, p, **kw: klien('guru1', 'guru', m, p, **kw)  # noqa: E731
    d = g('POST', f'{DASAR}/kolom', json={'semester': 'ganjil', 'jenis': 'sumatif', 'ke': 3, 'ringkasan': 'Pecahan', 'kktp': 70,
                                          'nilai': {'s-k7a-1': {'nilai': 81}}}).json()
    kolom_id = d['kolom']['sumatif'][0]['id']
    r = g('GET', f'{DASAR}/template', params={'semester': 'ganjil', 'jenis': 'sumatif', 'kolom_id': kolom_id})
    assert r.status_code == 200, r.text
    assert 'nilai_sumatif_3_Matematika_7A_ganjil.xlsx' in r.headers['content-disposition']
    wb = _baca_xlsx(r.content)
    ws = wb['Nilai']
    assert ws['A1'].value == 'NILAI SUMATIF KE-3 Matematika — KELAS 7A' and 'KKTP 70' in ws['A2'].value and 'Pecahan' in ws['A2'].value
    assert [c.value for c in ws[5]] == ['No', 'ID Siswa', 'NISN', 'Nama', 'L/P', 'Nilai']
    assert [(ws.cell(6, 2).value, ws.cell(6, 6).value), (ws.cell(7, 2).value, ws.cell(7, 6).value)] == [('s-k7a-1', 81), ('s-k7a-2', None)]
    assert wb['_meta'].sheet_state == 'hidden'

    # Isi berkas lalu impor: hanya dibaca (tidak disimpan), galat per baris dilaporkan.
    ws.cell(6, 6).value = '88,5'
    ws.cell(7, 6).value = 120
    ws.cell(8, 2).value, ws.cell(8, 4).value, ws.cell(8, 6).value = 'asing', 'Orang Lain', 90
    ws.cell(9, 3).value, ws.cell(9, 6).value = '00700002', 75  # cocok lewat NISN siswa 2 (baris 7 bernilai salah)
    b = io.BytesIO()
    wb.save(b)
    r = g('POST', f'{DASAR}/impor', data={'semester': 'ganjil', 'jenis': 'sumatif'}, files={'berkas': ('n.xlsx', b.getvalue())})
    assert r.status_code == 200, r.text
    h = r.json()
    assert h['nilai'] == {'s-k7a-1': {'nilai': 88.5}, 's-k7a-2': {'nilai': 75}}
    assert [(x['baris'], x['pesan']) for x in h['galat']] == [(7, 'nilai 120 di luar 0–100'), (8, 'siswa tidak ditemukan di kelas ini')]
    assert g('GET', DASAR, params={'semester': 'ganjil'}).json()['kolom']['sumatif'][0]['nilai']['s-k7a-1']['nilai'] == 81  # belum disimpan

    # Berkas jenis/kelas/mode lain ditolak; berkas bukan xlsx ditolak.
    r = g('POST', f'{DASAR}/impor', data={'semester': 'ganjil', 'jenis': 'ulangan'}, files={'berkas': ('n.xlsx', b.getvalue())})
    assert r.status_code == 400 and 'SUMATIF' in r.json()['detail']
    assert g('POST', f'{DASAR}/impor', data={'semester': 'ganjil', 'jenis': 'uts'}, files={'berkas': ('n.xlsx', b'bukan')}).status_code == 400
    assert g('POST', f'{DASAR}/impor', data={'semester': 'ganjil', 'jenis': 'lain'}, files={'berkas': ('n.xlsx', b.getvalue())}).status_code == 422


def test_template_pk_uts_uas(klien):
    import io
    db = klien.db
    g = lambda m, p, **kw: klien('guru1', 'guru', m, p, **kw)  # noqa: E731
    g('PUT', f'{DASAR}/mode', json={'semester': 'ganjil', 'mode': 'pk'})
    r = g('GET', f'{DASAR}/template', params={'semester': 'ganjil', 'jenis': 'uts'})
    ws = _baca_xlsx(r.content)['Nilai']
    assert [c.value for c in ws[5]] == ['No', 'ID Siswa', 'NISN', 'Nama', 'L/P', 'Pengetahuan', 'Keterampilan']
    ws.cell(6, 6).value, ws.cell(6, 7).value = 80, 90
    b = io.BytesIO()
    ws.parent.save(b)
    h = g('POST', f'{DASAR}/impor', data={'semester': 'ganjil', 'jenis': 'uts'}, files={'berkas': ('u.xlsx', b.getvalue())}).json()
    assert h['nilai'] == {'s-k7a-1': {'p': 80, 'k': 90}} and h['kosong'] == 1
    # Mode berubah setelah template diunduh -> berkas lama ditolak.
    g('PUT', f'{DASAR}/mode', json={'semester': 'ganjil', 'mode': 'nilai'})
    r = g('POST', f'{DASAR}/impor', data={'semester': 'ganjil', 'jenis': 'uts'}, files={'berkas': ('u.xlsx', b.getvalue())})
    assert r.status_code == 400 and 'Mode kolom' in r.json()['detail']
    # UAS: selalu kolom Nilai, berisi nilai UAS rapor.
    db.grade_entries.docs.append({'id': 'g1', 'student_id': 's-k7a-2', 'class_id': 'k7a', 'subject_id': 'mtk', 'academic_year_id': 'tp-kini',
                                  'semester': 'ganjil', 'nilai_uas': 77})
    ws = _baca_xlsx(g('GET', f'{DASAR}/template', params={'semester': 'ganjil', 'jenis': 'uas'}).content)['Nilai']
    assert ws.cell(5, 6).value == 'Nilai' and ws.cell(7, 6).value == 77 and ws['A1'].value.startswith('NILAI UAS')
    assert g('GET', f'{DASAR}/template', params={'semester': 'ganjil', 'jenis': 'sumatif', 'kolom_id': 'x'}).status_code == 404
    assert klien('guru2', 'guru', 'GET', f'{DASAR}/template', params={'semester': 'ganjil', 'jenis': 'uas'}).status_code == 403
