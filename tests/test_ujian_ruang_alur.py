"""Alur HTTP Ruang & Peserta modul Ujian: CRUD ruang (1–2 jenjang), akses, dan jejak audit."""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(__file__))

from ujian_dasar import buat_klien, tambah_kelas_siswa, ujian_doc  # noqa: E402


@pytest.fixture
def klien(monkeypatch):
    k = buat_klien(monkeypatch)
    k.db.ujian.docs += [ujian_doc('uas', 'UAS', 'sem-kini', '2026-12-01', '2026-12-06'),
                        ujian_doc('lama', 'UAS', 'sem-lalu', '2026-06-01', '2026-06-06')]
    k.db.panitia_ujian.docs += [{'id': 'p1', 'ujian_id': 'uas', 'jabatan': 'sekretaris', 'user_id': 'guru1'},
                                {'id': 'p2', 'ujian_id': 'uas', 'jabatan': 'bendahara', 'user_id': 'tu1'}]
    tambah_kelas_siswa(k.db)
    return k


def test_crud_ruang_dua_jenjang(klien):
    db = klien.db
    r = klien('admin', 'admin', 'POST', '/ujian/uas/ruang', json={'nama_ruang': '02', 'jenjang': [8, 7], 'kapasitas': 32, 'keterangan': 'Gedung A'})
    assert r.status_code == 200, r.text
    r2 = r.json()
    assert r2['jenjang'] == [7, 8] and r2['per_jenjang'] == {'7': 0, '8': 0}
    r10 = klien('admin', 'admin', 'POST', '/ujian/uas/ruang', json={'nama_ruang': '10', 'jenjang': [9]}).json()
    klien('admin', 'admin', 'POST', '/ujian/uas/ruang', json={'nama_ruang': '1', 'jenjang': [9]})
    # Nama unik per ujian (tanpa beda huruf/spasi); jenjang & kapasitas divalidasi.
    assert klien('admin', 'admin', 'POST', '/ujian/uas/ruang', json={'nama_ruang': ' 02 ', 'jenjang': [9]}).status_code == 409
    assert klien('admin', 'admin', 'POST', '/ujian/uas/ruang', json={'nama_ruang': '03', 'jenjang': [7, 8, 9]}).status_code == 422
    assert klien('admin', 'admin', 'POST', '/ujian/uas/ruang', json={'nama_ruang': '03', 'jenjang': [7], 'kapasitas': 61}).status_code == 422

    d = klien('admin', 'admin', 'GET', '/ujian/uas/ruang').json()
    assert [x['nama_ruang'] for x in d['items']] == ['1', '02', '10']  # urut alami
    assert d['boleh_ubah'] and d['ringkasan']['jumlah_ruang'] == 3 and d['ringkasan']['kapasitas'] == 96
    assert d['ringkasan']['belum_ditempatkan'] == 12  # 4 siswa x kelas 7, 8, 9
    assert d['plotting']['jumlah_perubahan'] == 3 and d['plotting']['ditetapkan_pada']

    # Isi peserta kelas 8 lalu coba lepas jenjang 8 / kecilkan kapasitas / hapus ruang -> ditolak.
    db.peserta_ruang.docs += [{'id': f'ps{i}', 'ujian_id': 'uas', 'ruang_id': r2['id'], 'siswa_id': f's-k8a-{i}', 'jenjang': 8}
                              for i in (1, 2)]
    url = f"/ujian/uas/ruang/{r2['id']}"
    r = klien('admin', 'admin', 'PUT', url, json={'nama_ruang': '02', 'jenjang': [7], 'kapasitas': 32})
    assert r.status_code == 409 and 'Kelas 8' in r.json()['detail']
    r = klien('admin', 'admin', 'PUT', url, json={'nama_ruang': '02', 'jenjang': [7, 8], 'kapasitas': 1})
    assert r.status_code == 409 and 'Kapasitas' in r.json()['detail']
    assert klien('admin', 'admin', 'DELETE', url).status_code == 409
    r = klien('admin', 'admin', 'PUT', url, json={'nama_ruang': '02', 'jenjang': [8, 9], 'kapasitas': 30, 'keterangan': 'Gedung B'})
    assert r.status_code == 200 and r.json()['per_jenjang'] == {'8': 2, '9': 0}
    assert klien('admin', 'admin', 'PUT', url, json={'nama_ruang': '10', 'jenjang': [8]}).status_code == 409

    # Hapus ruang kosong.
    assert klien('admin', 'admin', 'DELETE', f"/ujian/uas/ruang/{r10['id']}").json() == {'ok': True}
    riwayat = klien('guru1', 'guru', 'GET', '/ujian/uas/ruang/riwayat').json()['items']
    assert [x['aksi'] for x in riwayat][:2] == ['ruang_hapus', 'ruang_ubah']
    assert 'jenjang' in riwayat[1]['ringkasan'] and riwayat[0]['oleh_nama'] == 'Administrator'
    assert {a['action'] for a in db.audit_logs.docs} >= {'ujian_ruang_tambah', 'ujian_ruang_ubah', 'ujian_ruang_hapus'}


def test_akses_ruang(klien):
    klien('admin', 'admin', 'POST', '/ujian/uas/ruang', json={'nama_ruang': '01', 'jenjang': [7]})
    d = klien('guru1', 'guru', 'GET', '/ujian/uas/ruang').json()  # sekretaris: lihat saja
    assert d['boleh_ubah'] is False and len(d['items']) == 1
    assert klien('guru1', 'guru', 'POST', '/ujian/uas/ruang', json={'nama_ruang': '09', 'jenjang': [7]}).status_code == 403
    r = klien('tu1', 'tenaga_kependidikan', 'GET', '/ujian/uas/ruang')  # bendahara: tidak berhak menu ruang
    assert r.status_code == 403 and 'Ruang & Peserta' in r.json()['detail']
    assert klien('kamad', 'kepala_sekolah', 'GET', '/ujian/uas/ruang').status_code == 403
    assert klien('guru2', 'guru', 'GET', '/ujian/uas/ruang').status_code == 403
    assert klien('admin', 'admin', 'GET', '/ujian/tidak-ada/ruang').status_code == 404
    # Ujian semester lalu: dibaca boleh, diubah tidak (arsip).
    assert klien('admin', 'admin', 'GET', '/ujian/lama/ruang').status_code == 200
    assert klien('admin', 'admin', 'POST', '/ujian/lama/ruang', json={'nama_ruang': '01', 'jenjang': [7]}).status_code == 409


def test_master_guru_pengawas(klien):
    db = klien.db
    db.users.docs.append({'id': 'satpam1', 'username': 'satpam1', 'full_name': 'Pak Satpam', 'roles': ['satpam'], 'is_active': True, 'token_version': 0})
    r = klien('admin', 'admin', 'POST', '/ujian/pengawas', json={'user_ids': ['guru1', 'guru2', 'satpam1', 'siswa1', 'guru1']})
    assert r.status_code == 200, r.text
    h = r.json()
    assert h['ditambahkan'] == 2 and {d['alasan'] for d in h['dilewati']} == {'Bukan akun GTK aktif'}
    assert klien('admin', 'admin', 'POST', '/ujian/pengawas', json={'user_ids': ['guru1']}).json()['dilewati'][0]['alasan'].startswith('Sudah')
    assert klien('admin', 'admin', 'POST', '/ujian/pengawas', json={'user_ids': []}).status_code == 422

    d = klien('admin', 'admin', 'GET', '/ujian/pengawas').json()
    assert d['boleh_ubah'] and [p['nama'] for p in d['items']] == ['Bu Siti', 'Pak Hadi']
    hadi = next(p for p in d['items'] if p['user_id'] == 'guru2')
    assert hadi['nip'] == 'NIP-guru2' and hadi['dipakai'] == 0

    # Nonaktifkan -> urut terakhir; nama terkini dari akun.
    assert klien('admin', 'admin', 'PATCH', f"/ujian/pengawas/{hadi['id']}", json={'aktif': False}).json()['aktif'] is False
    next(u for u in db.users.docs if u['id'] == 'guru1')['full_name'] = 'Hj. Siti Aminah'
    d = klien('guru1', 'guru', 'GET', '/ujian/pengawas').json()  # sekretaris: lihat saja
    assert d['boleh_ubah'] is False and [p['aktif'] for p in d['items']] == [True, False]
    assert d['items'][0]['nama'] == 'Hj. Siti Aminah'

    # Sudah mengisi berita acara -> tidak bisa dihapus.
    siti = d['items'][0]
    db.berita_acara.docs.append({'id': 'ba1', 'pengawas_id': siti['id']})
    r = klien('admin', 'admin', 'DELETE', f"/ujian/pengawas/{siti['id']}")
    assert r.status_code == 409 and 'nonaktifkan' in r.json()['detail']
    assert klien('admin', 'admin', 'DELETE', f"/ujian/pengawas/{hadi['id']}").json() == {'ok': True}
    assert klien('admin', 'admin', 'GET', '/ujian/pengawas').json()['items'][0]['dipakai'] == 1

    # Akses: bendahara, guru biasa, kamad -> 403; panitia tidak bisa mengubah.
    assert klien('tu1', 'tenaga_kependidikan', 'GET', '/ujian/pengawas').status_code == 403
    assert klien('guru2', 'guru', 'GET', '/ujian/pengawas').status_code == 403
    assert klien('guru1', 'guru', 'POST', '/ujian/pengawas', json={'user_ids': ['guru2']}).status_code == 403
    assert klien('admin', 'admin', 'PATCH', '/ujian/pengawas/tidak-ada', json={'aktif': True}).status_code == 404


def _ruang(klien, nama, jenjang, kapasitas=32):
    return klien('admin', 'admin', 'POST', '/ujian/uas/ruang', json={'nama_ruang': nama, 'jenjang': jenjang, 'kapasitas': kapasitas}).json()


def test_penempatan_siswa_ke_ruang(klien):
    r1 = _ruang(klien, '01', [7, 8], kapasitas=5)
    r2 = _ruang(klien, '02', [9])
    d = klien('admin', 'admin', 'GET', '/ujian/uas/kandidat').json()
    assert [(k['nama'], k['jumlah_siswa']) for k in d['kelas']] == [('7A', 4), ('8A', 4), ('9A', 4)] and d['items'] == []

    # Tempatkan kelas 7 (4) + 2 kelas 8: ruang berkapasitas 5 -> 1 dilewati karena penuh.
    ids = [f's-k7a-{i}' for i in range(1, 5)] + ['s-k8a-1', 's-k8a-2']
    h = klien('admin', 'admin', 'POST', f"/ujian/uas/ruang/{r1['id']}/peserta", json={'siswa_ids': ids}).json()
    assert h['ditambahkan'] == 5 and h['dilewati'] == [{'siswa_id': 's-k8a-2', 'nama': 'Siswa 8A 2', 'alasan': 'Kapasitas ruang penuh'}]
    # Kelas 9 ke ruang 01 (bukan jenjangnya), siswa sudah di ruang lain, siswa asing, siswa sudah di ruang ini.
    h = klien('admin', 'admin', 'POST', f"/ujian/uas/ruang/{r2['id']}/peserta", json={'siswa_ids': ['s-k9a-1', 's-k7a-1', 'asing']}).json()
    assert h['ditambahkan'] == 1
    assert {x['siswa_id']: x['alasan'] for x in h['dilewati']} == {
        's-k7a-1': 'Sudah terdaftar di ruang lain pada ujian ini', 'asing': 'Siswa tidak ditemukan di data induk semester ujian ini'}
    h = klien('admin', 'admin', 'POST', f"/ujian/uas/ruang/{r2['id']}/peserta", json={'siswa_ids': ['s-k9a-1', 's-k8a-3']}).json()
    assert [x['alasan'] for x in h['dilewati']] == ['Sudah berada di ruang ini', 'Kelas 8 bukan jenjang ruang ini']

    # Daftar peserta: urut kelas & nama (belum bernomor), identitas tersalin, nomor_lain hanya admin.
    d = klien('admin', 'admin', 'GET', f"/ujian/uas/ruang/{r1['id']}/peserta").json()
    assert [p['kelas'] for p in d['items']] == ['7A', '7A', '7A', '7A', '8A']
    assert d['ruang']['per_jenjang'] == {'7': 4, '8': 1} and d['items'][0]['nis'] == '7001'
    assert 'nomor_lain' in d
    sek = klien('guru1', 'guru', 'GET', f"/ujian/uas/ruang/{r2['id']}/peserta").json()
    assert sek['boleh_ubah'] is False and 'nomor_lain' not in sek
    assert sek['items'][0]['nomor_peserta_um'] == 'UM-9A-1'

    # Kandidat kelas 7A menandai ruang tempatnya.
    d = klien('admin', 'admin', 'GET', '/ujian/uas/kandidat', params={'kelas_id': 'k7a'}).json()
    assert {x['ruang_nama'] for x in d['items']} == {'01'}

    ringkas = klien('admin', 'admin', 'GET', '/ujian/uas/ruang').json()['ringkasan']
    assert ringkas['jumlah_peserta'] == 6 and ringkas['belum_ditempatkan'] == 6 and ringkas['per_jenjang'] == {'7': 4, '8': 1, '9': 1}

    # Keluarkan peserta; panitia tidak boleh menempatkan.
    pid = d['items'][0]['siswa_id']
    peserta = next(p for p in klien.db.peserta_ruang.docs if p['siswa_id'] == pid)
    assert klien('admin', 'admin', 'DELETE', f"/ujian/uas/ruang/{r1['id']}/peserta/{peserta['id']}").json() == {'ok': True}
    assert klien('admin', 'admin', 'DELETE', f"/ujian/uas/ruang/{r1['id']}/peserta/{peserta['id']}").status_code == 404
    assert klien('guru1', 'guru', 'POST', f"/ujian/uas/ruang/{r1['id']}/peserta", json={'siswa_ids': ['s-k7a-1']}).status_code == 403
    aksi = [j['aksi'] for j in klien('admin', 'admin', 'GET', '/ujian/uas/ruang/riwayat').json()['items']]
    assert aksi[0] == 'peserta_hapus' and 'peserta_tambah' in aksi


def test_pindah_ruang_tanpa_duplikat(klien):
    db = klien.db
    r1, r2, r3 = _ruang(klien, '01', [7, 8]), _ruang(klien, '02', [7], kapasitas=1), _ruang(klien, '03', [9])
    klien('admin', 'admin', 'POST', f"/ujian/uas/ruang/{r1['id']}/peserta", json={'siswa_ids': ['s-k7a-1', 's-k7a-2', 's-k8a-1']})
    p = next(x for x in db.peserta_ruang.docs if x['siswa_id'] == 's-k7a-1')
    p['nomor_peserta'], p['nomor_kunci'] = '01-001', '01-001'
    url = f"/ujian/uas/peserta/{p['id']}/pindah"

    assert klien('admin', 'admin', 'PATCH', url, json={'ruang_id': r2['id'], 'alasan': 'ok'}).status_code == 422  # alasan pendek
    r = klien('admin', 'admin', 'PATCH', url, json={'ruang_id': r2['id'], 'alasan': 'Menyeimbangkan jumlah peserta'})
    assert r.status_code == 200, r.text
    assert r.json()['ruang_id'] == r2['id'] and r.json()['nomor_peserta'] == '01-001'
    # Tetap satu baris untuk siswa itu (dipindah, bukan digandakan).
    assert [x['ruang_id'] for x in db.peserta_ruang.docs if x['siswa_id'] == 's-k7a-1'] == [r2['id']]

    p2 = next(x for x in db.peserta_ruang.docs if x['siswa_id'] == 's-k7a-2')
    r = klien('admin', 'admin', 'PATCH', f"/ujian/uas/peserta/{p2['id']}/pindah", json={'ruang_id': r2['id'], 'alasan': 'Coba pindah'})
    assert r.status_code == 409 and 'penuh' in r.json()['detail']
    r = klien('admin', 'admin', 'PATCH', f"/ujian/uas/peserta/{p2['id']}/pindah", json={'ruang_id': r3['id'], 'alasan': 'Coba pindah'})
    assert r.status_code == 409 and 'kelas 7' in r.json()['detail']
    r = klien('admin', 'admin', 'PATCH', f"/ujian/uas/peserta/{p2['id']}/pindah", json={'ruang_id': r1['id'], 'alasan': 'Coba pindah'})
    assert r.status_code == 400
    assert klien('guru1', 'guru', 'PATCH', url, json={'ruang_id': r1['id'], 'alasan': 'Coba pindah'}).status_code == 403

    jejak = klien('admin', 'admin', 'GET', '/ujian/uas/ruang/riwayat').json()['items'][0]
    assert jejak['aksi'] == 'peserta_pindah' and jejak['alasan'] == 'Menyeimbangkan jumlah peserta' and '→ Ruang 02' in jejak['ringkasan']


async def test_index_unik_peserta_di_mongodb(mongo_db):
    """Index unik sungguhan: satu siswa satu baris per ujian; nomor peserta unik per ujian (kosong boleh berulang)."""
    from pymongo.errors import DuplicateKeyError

    from ujian_ruang import pastikan_index_ruang
    await pastikan_index_ruang(mongo_db)
    await mongo_db.peserta_ruang.insert_one({'id': 'a', 'ujian_id': 'u', 'siswa_id': 's1', 'nomor_kunci': None})
    await mongo_db.peserta_ruang.insert_one({'id': 'b', 'ujian_id': 'u', 'siswa_id': 's2', 'nomor_kunci': None})
    await mongo_db.peserta_ruang.insert_one({'id': 'c', 'ujian_id': 'u', 'siswa_id': 's3', 'nomor_kunci': '01'})
    with pytest.raises(DuplicateKeyError):
        await mongo_db.peserta_ruang.insert_one({'id': 'd', 'ujian_id': 'u', 'siswa_id': 's1', 'nomor_kunci': None})
    with pytest.raises(DuplicateKeyError):
        await mongo_db.peserta_ruang.insert_one({'id': 'e', 'ujian_id': 'u', 'siswa_id': 's4', 'nomor_kunci': '01'})
    await mongo_db.peserta_ruang.insert_one({'id': 'f', 'ujian_id': 'u2', 'siswa_id': 's1', 'nomor_kunci': '01'})


def test_api_nomor_peserta(klien):
    db = klien.db
    r1, r2 = _ruang(klien, '01', [7]), _ruang(klien, '02', [8])
    klien('admin', 'admin', 'POST', f"/ujian/uas/ruang/{r1['id']}/peserta", json={'siswa_ids': ['s-k7a-1', 's-k7a-2']})
    klien('admin', 'admin', 'POST', f"/ujian/uas/ruang/{r2['id']}/peserta", json={'siswa_ids': ['s-k8a-1']})
    pid = {p['siswa_id']: p['id'] for p in db.peserta_ruang.docs}
    url1, url2 = f"/ujian/uas/ruang/{r1['id']}/nomor-peserta", f"/ujian/uas/ruang/{r2['id']}/nomor-peserta"
    h = klien('admin', 'admin', 'PUT', url1, json={'items': [{'peserta_id': pid['s-k7a-1'], 'nomor_peserta': '01-001'},
                                                            {'peserta_id': pid['s-k7a-2'], 'nomor_peserta': '01-002'}]}).json()
    assert h == {'disimpan': 2, 'galat': []}
    h = klien('admin', 'admin', 'PUT', url2, json={'items': [{'peserta_id': pid['s-k8a-1'], 'nomor_peserta': '01-001'}]}).json()
    assert h['disimpan'] == 0 and h['galat'][0]['pesan'] == 'No. Peserta 01-001 sudah dipakai Siswa 7A 1'
    # Tukar nomor dalam satu ruang.
    h = klien('admin', 'admin', 'PUT', url1, json={'items': [{'peserta_id': pid['s-k7a-1'], 'nomor_peserta': '01-002'},
                                                            {'peserta_id': pid['s-k7a-2'], 'nomor_peserta': '01-001'}]}).json()
    assert h['disimpan'] == 2
    d = klien('admin', 'admin', 'GET', f"/ujian/uas/ruang/{r1['id']}/peserta").json()
    assert [(p['siswa_id'], p['nomor_peserta']) for p in d['items']] == [('s-k7a-2', '01-001'), ('s-k7a-1', '01-002')]
    assert klien('admin', 'admin', 'GET', f"/ujian/uas/ruang/{r2['id']}/peserta").json()['nomor_lain'] == {'01-001': 'Siswa 7A 2', '01-002': 'Siswa 7A 1'}
    assert klien('guru1', 'guru', 'PUT', url1, json={'items': [{'peserta_id': pid['s-k7a-1'], 'nomor_peserta': 'X'}]}).status_code == 403
    assert klien('admin', 'admin', 'GET', '/ujian/uas/ruang/riwayat').json()['items'][0]['aksi'] == 'nomor_ubah'


def test_unduh_template_peserta_per_ruang(klien):
    import io

    from openpyxl import load_workbook
    r1, r2 = _ruang(klien, '01', [7, 8]), _ruang(klien, '02', [9])
    klien('admin', 'admin', 'POST', f"/ujian/uas/ruang/{r1['id']}/peserta", json={'siswa_ids': ['s-k8a-1', 's-k7a-2']})
    klien('admin', 'admin', 'POST', f"/ujian/uas/ruang/{r2['id']}/peserta", json={'siswa_ids': ['s-k9a-1']})
    r = klien('admin', 'admin', 'GET', f"/ujian/uas/ruang/{r1['id']}/template-peserta")
    assert r.status_code == 200 and r.headers['content-type'].startswith('application/vnd.openxmlformats')
    assert 'template_nomor_peserta_UAS_uas_ruang_01.xlsx' in r.headers['content-disposition']
    wb = load_workbook(io.BytesIO(r.content))
    ws = wb['Peserta']
    assert [c.value for c in ws[4]] == ['No', 'ID Siswa', 'NIS', 'NISN', 'Nama', 'Kelas', 'Jenjang', 'No. Peserta', 'No. Peserta UM (data siswa)']
    baris = [[c.value for c in row] for row in ws.iter_rows(min_row=5)]
    # Hanya siswa ruang ini (bukan seluruh jenjang), urut kelas lalu nama.
    assert [(b[1], b[5]) for b in baris] == [('s-k7a-2', '7A'), ('s-k8a-1', '8A')]
    assert wb['_meta'].sheet_state == 'hidden' and wb['_meta']['B2'].value == r1['id']
    r = klien('admin', 'admin', 'GET', f"/ujian/uas/ruang/{r2['id']}/template-peserta")
    assert load_workbook(io.BytesIO(r.content))['Peserta']['I5'].value == 'UM-9A-1'
    assert klien('guru1', 'guru', 'GET', f"/ujian/uas/ruang/{r1['id']}/template-peserta").status_code == 403
    assert klien('admin', 'admin', 'GET', '/ujian/uas/ruang/tidak-ada/template-peserta').status_code == 404


def _isi_template(klien, ruang_id, nomor, tambah=()):
    """Unduh template ruang, isi kolom No. Peserta (dict siswa_id -> nomor), tambah baris (siswa_id, nomor)."""
    import io

    from openpyxl import load_workbook
    r = klien('admin', 'admin', 'GET', f"/ujian/uas/ruang/{ruang_id}/template-peserta")
    wb = load_workbook(io.BytesIO(r.content))
    ws = wb['Peserta']
    for row in ws.iter_rows(min_row=5):
        if row[1].value in nomor:
            row[7].value = nomor[row[1].value]
    for sid, n in tambah:
        ws.append([None, sid, None, None, None, None, None, n, None])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _impor(klien, ruang_id, isi, nama='template.xlsx', uid='admin', peran='admin'):
    return klien(uid, peran, 'POST', f"/ujian/uas/ruang/{ruang_id}/impor-peserta",
                 files={'berkas': (nama, isi, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')})


def test_impor_nomor_peserta_per_ruang(klien):
    db = klien.db
    r1, r2 = _ruang(klien, '01', [7, 8], kapasitas=4), _ruang(klien, '02', [9])
    klien('admin', 'admin', 'POST', f"/ujian/uas/ruang/{r1['id']}/peserta", json={'siswa_ids': ['s-k7a-1', 's-k7a-2', 's-k8a-1']})
    klien('admin', 'admin', 'POST', f"/ujian/uas/ruang/{r2['id']}/peserta", json={'siswa_ids': ['s-k9a-1']})
    klien('admin', 'admin', 'PUT', f"/ujian/uas/ruang/{r2['id']}/nomor-peserta",
          json={'items': [{'peserta_id': next(p['id'] for p in db.peserta_ruang.docs if p['siswa_id'] == 's-k9a-1'), 'nomor_peserta': '02-001'}]})

    isi = _isi_template(klien, r1['id'], {'s-k7a-1': '01-001', 's-k7a-2': '01-001', 's-k8a-1': ''}, tambah=[
        ('s-k8a-2', '01-004'),    # siswa baru di ruang ini -> ikut ditempatkan
        ('s-k9a-1', '01-005'),    # sudah di ruang lain
        ('s-k9a-2', '01-006'),    # jenjang bukan ruang ini
        ('asing', '01-007'),      # tidak ada di data induk
        ('s-k8a-3', '02-001'),    # nomor dipakai ruang lain
        ('s-k8a-4', '01 008'),    # format salah
    ])
    r = _impor(klien, r1['id'], isi)
    assert r.status_code == 200, r.text
    h = r.json()
    assert h['total'] == 9 and h['tersimpan'] == 2
    alasan = {d['siswa_id']: d['alasan'] for d in h['dilewati']}
    assert alasan == {
        's-k7a-2': 'No. Peserta 01-001 ganda dengan baris 5', 's-k8a-1': 'No. Peserta kosong',
        's-k9a-1': 'Sudah terdaftar di ruang lain pada ujian ini', 's-k9a-2': 'Kelas 9 bukan jenjang ruang ini',
        'asing': 'Siswa tidak ditemukan di data induk', 's-k8a-3': 'No. Peserta 02-001 sudah dipakai Siswa 9A 1',
        's-k8a-4': 'Hanya huruf, angka, titik, garis miring, dan tanda minus'}
    assert [d['baris'] for d in h['dilewati']] == sorted(d['baris'] for d in h['dilewati'])
    baru = next(p for p in db.peserta_ruang.docs if p['siswa_id'] == 's-k8a-2')
    assert baru['ruang_id'] == r1['id'] and baru['sumber'] == 'impor_template' and baru['nomor_peserta'] == '01-004'
    jejak = klien('admin', 'admin', 'GET', '/ujian/uas/ruang/riwayat').json()['items'][0]
    assert jejak['aksi'] == 'impor_template' and '2 tersimpan (1 siswa baru), 7 dilewati' in jejak['ringkasan']

    # Kapasitas: ruang kini 4/4 -> siswa baru berikutnya dilewati.
    h = _impor(klien, r1['id'], _isi_template(klien, r1['id'], {}, tambah=[('s-k7a-3', '01-009')])).json()
    assert h['dilewati'][-1]['alasan'] == 'Kapasitas ruang penuh'

    # Berkas ruang lain, bukan xlsx, kolom rusak -> ditolak utuh.
    r = _impor(klien, r1['id'], _isi_template(klien, r2['id'], {}))
    assert r.status_code == 400 and 'ruang lain' in r.json()['detail']
    assert _impor(klien, r1['id'], b'bukan excel', nama='data.csv').status_code == 400
    r = _impor(klien, r1['id'], b'bukan excel')
    assert r.status_code == 400 and 'tidak dapat dibaca' in r.json()['detail']
    assert _impor(klien, r1['id'], isi, uid='guru1', peran='guru').status_code == 403


def test_semua_perubahan_penetapan_khusus_admin_dan_tercatat(klien):
    """Guard: setiap endpoint pengubah ruang/peserta/nomor/pengawas memakai wajib_pengelola (admin saja); setiap
    perubahan penetapan meninggalkan jejak audit (ujian_jejak) dan audit_logs."""
    from routers import ujian_pengawas, ujian_ruang
    from routers.ujian import wajib_pengelola
    for modul in (ujian_ruang, ujian_pengawas):
        for rute in modul.router.routes:
            if rute.methods & {'POST', 'PUT', 'PATCH', 'DELETE'}:
                assert any(d.call is wajib_pengelola for d in rute.dependant.dependencies), f'{rute.path} tanpa guard admin'

    db = klien.db
    r1 = _ruang(klien, '01', [7])
    r2 = _ruang(klien, '02', [7])
    klien('admin', 'admin', 'PUT', f"/ujian/uas/ruang/{r1['id']}", json={'nama_ruang': '01', 'jenjang': [7], 'kapasitas': 30})
    klien('admin', 'admin', 'POST', f"/ujian/uas/ruang/{r1['id']}/peserta", json={'siswa_ids': ['s-k7a-1', 's-k7a-2']})
    pid = next(p['id'] for p in db.peserta_ruang.docs if p['siswa_id'] == 's-k7a-1')
    klien('admin', 'admin', 'PUT', f"/ujian/uas/ruang/{r1['id']}/nomor-peserta", json={'items': [{'peserta_id': pid, 'nomor_peserta': '1'}]})
    klien('admin', 'admin', 'PATCH', f"/ujian/uas/peserta/{pid}/pindah", json={'ruang_id': r2['id'], 'alasan': 'Pindah karena kursi rusak'})
    klien('admin', 'admin', 'DELETE', f"/ujian/uas/ruang/{r2['id']}/peserta/{pid}")
    klien('admin', 'admin', 'DELETE', f"/ujian/uas/ruang/{r2['id']}")
    aksi = [j['aksi'] for j in sorted(db.ujian_jejak.docs, key=lambda j: j['waktu'])]
    assert aksi == ['ruang_tambah', 'ruang_tambah', 'ruang_ubah', 'peserta_tambah', 'nomor_ubah', 'peserta_pindah', 'peserta_hapus', 'ruang_hapus']
    assert all(j['oleh'] == 'admin' and j['oleh_nama'] == 'Administrator' and j['ujian_id'] == 'uas' for j in db.ujian_jejak.docs)
    assert next(j for j in db.ujian_jejak.docs if j['aksi'] == 'peserta_pindah')['alasan'] == 'Pindah karena kursi rusak'
    assert {'ujian_ruang_tambah', 'ujian_ruang_ubah', 'ujian_peserta_tambah', 'ujian_nomor_peserta', 'ujian_peserta_pindah',
            'ujian_peserta_hapus', 'ujian_ruang_hapus'} <= {a['action'] for a in db.audit_logs.docs}

    # Panitia (ketua/sekretaris) & pimpinan ditolak di semua pengubah; jejak tidak bertambah.
    n = len(db.ujian_jejak.docs)
    for uid, peran in (('guru1', 'guru'), ('kamad', 'kepala_sekolah'), ('wakakur', 'waka_kurikulum')):
        for metode, path, isi in (
            ('POST', '/ujian/uas/ruang', {'nama_ruang': '09', 'jenjang': [7]}),
            ('PUT', f"/ujian/uas/ruang/{r1['id']}", {'nama_ruang': '01', 'jenjang': [7]}),
            ('DELETE', f"/ujian/uas/ruang/{r1['id']}", None),
            ('POST', f"/ujian/uas/ruang/{r1['id']}/peserta", {'siswa_ids': ['s-k7a-3']}),
        ):
            r = klien(uid, peran, metode, path, **({'json': isi} if isi else {}))
            assert r.status_code == 403 and r.json()['detail'] == 'Hanya admin yang dapat mengelola ujian dan kepanitiaan'
    assert len(db.ujian_jejak.docs) == n
