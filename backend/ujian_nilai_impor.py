"""Job impor nilai UAS (berjalan di latar belakang setelah berkas diunggah).

Alur: baca berkas (thread terpisah agar server tetap responsif) -> cek `_meta` -> per sheet kelas cocokkan baris ke
siswa kelas itu (ID Siswa, lalu NIS, lalu nama persis) -> validasi nilai 0–100 -> simpan ke `nilai_ujian` -> perbarui
progres di `nilai_impor_log` saat berpindah sheet (`sheet_aktif`) dan tiap SIMPAN_PROGRES_TIAP baris, lalu tutup
dengan status 'selesai' (atau 'gagal' bila berkas tak terbaca).
Baris dengan nilai kosong dilewati (dihitung `kosong`, tidak menghapus nilai yang sudah ada).
Unggah ulang (`konteks.lewati_siswa`): baris milik siswa yang SUDAH berhasil di impor sebelumnya dilewati (`dilewati`),
jadi hanya baris yang dulu gagal (atau baru) yang diproses — berkas perbaikan boleh berupa berkas lengkap yang sama.

Hasil yang disimpan di log untuk monitoring:
- per_sheet: { sheet, kelas, total, diproses, berhasil, gagal, kosong, rata } (rata = rata-rata nilai yang tersimpan);
- berubah: jumlah nilai yang benar-benar berubah (masing-masing tercatat di nilai_ujian_riwayat);
- galat: { sheet, baris, nama, siswa_id, nilai, jenis, pesan } urut sheet & baris, jenis 'sheet' | 'siswa' | 'nilai' |
  'ganda' (dibatasi GALAT_MAKS_DISIMPAN; `galat_total` tetap jumlah sebenarnya).
"""
import asyncio
import logging
from typing import Any, Dict, List

from ujian import sekarang_wib
from ujian_nilai import (GALAT_MAKS_DISIMPAN, KOLEKSI_IMPOR_LOG, KOLEKSI_NILAI, KOLEKSI_RIWAYAT, dokumen_nilai, dokumen_riwayat,
                         galat_nilai, ke_angka)
from ujian_nilai_rapor import sinkron_rapor
from ujian_nilai_xlsx import GalatBerkas, baca_berkas_nilai, galat_meta, kunci_kelas

logger = logging.getLogger(__name__)
SIMPAN_PROGRES_TIAP = 20


async def _tutup_gagal(db, log_id: str, pesan: str) -> None:
    await db[KOLEKSI_IMPOR_LOG].update_one({'id': log_id}, {'$set': {
        'status': 'gagal', 'pesan': pesan, 'selesai_pada': sekarang_wib().isoformat()}})


def _indeks_siswa(siswa: List[Dict[str, Any]]):
    per_id = {s['id']: s for s in siswa}
    per_nis = {str(s['nis']).strip(): s for s in siswa if s.get('nis')}
    per_nama: Dict[str, List[Dict[str, Any]]] = {}
    for s in siswa:
        per_nama.setdefault(' '.join(str(s.get('full_name') or '').lower().split()), []).append(s)
    return per_id, per_nis, per_nama


def cocokkan_siswa(baris: Dict[str, Any], indeks) -> Any:
    """-> dokumen siswa, atau pesan galat (str)."""
    per_id, per_nis, per_nama = indeks
    if baris['siswa_id']:
        if baris['siswa_id'] in per_id:
            return per_id[baris['siswa_id']]
        return 'ID siswa tidak terdaftar di kelas ini (pindah kelas/salah sheet?)'
    if baris['nis'] and baris['nis'] in per_nis:
        return per_nis[baris['nis']]
    calon = per_nama.get(' '.join(baris['nama'].lower().split()), []) if baris['nama'] else []
    if len(calon) == 1:
        return calon[0]
    if len(calon) > 1:
        return 'Nama ganda di kelas ini; isi kolom ID Siswa dari template'
    return 'Siswa tidak ditemukan di kelas ini'


def galat_baris(b: Dict[str, Any], kelas: Any, indeks, dipakai: Dict[str, int], jenjang: int, sheet: str):
    """-> (jenis, pesan, siswa): jenis & pesan None bila baris sah."""
    if not kelas:
        return 'sheet', f'Sheet "{sheet}" bukan nama kelas {jenjang} semester ini', None
    siswa = cocokkan_siswa(b, indeks)
    if isinstance(siswa, str):
        return 'siswa', siswa, None
    pesan = galat_nilai(b['nilai'])
    if pesan:
        return 'nilai', pesan, siswa
    if siswa['id'] in dipakai:
        return 'ganda', f"Siswa yang sama sudah diisi di baris {dipakai[siswa['id']]}", siswa
    return None, None, siswa


async def jalankan_impor(db, log_id: str, isi: bytes, konteks: Dict[str, Any]) -> None:
    """konteks = { ujian_id, mapel_id, jenjang, nama_mapel: {id: nama}, kelas: [{id, name}], siswa: [dok siswa_semester],
    oleh: user, lewati_siswa?: [id siswa], rapor?: ujian_nilai_rapor.konteks_rapor() }. Tidak pernah melempar galat: kegagalan tercatat di log."""
    try:
        await _proses(db, log_id, isi, konteks)
    except Exception:  # pragma: no cover - jaring pengaman job latar belakang
        logger.exception('Impor nilai UAS %s gagal', log_id)
        await _tutup_gagal(db, log_id, 'Terjadi kesalahan saat memproses berkas. Coba unggah ulang atau hubungi admin.')


async def _proses(db, log_id: str, isi: bytes, k: Dict[str, Any]) -> None:
    try:
        meta, sheets = await asyncio.to_thread(baca_berkas_nilai, isi)
    except GalatBerkas as e:
        await _tutup_gagal(db, log_id, str(e))
        return
    galat = galat_meta(meta, k['ujian_id'], k['mapel_id'], k['jenjang'], k['nama_mapel'])
    if galat:
        await _tutup_gagal(db, log_id, galat)
        return

    kelas = {kunci_kelas(c['name']): c for c in k['kelas']}
    per_sheet = [{'sheet': s['sheet'], 'kelas': (kelas.get(kunci_kelas(s['sheet'])) or {}).get('name'), 'total': 0,
                  'diproses': 0, 'berhasil': 0, 'gagal': 0, 'kosong': 0, 'dilewati': 0, 'rata': None} for s in sheets]
    indeks_kelas = {c['id']: _indeks_siswa([x for x in k['siswa'] if x.get('kelas_id') == c['id']]) for c in k['kelas']}
    lewati = set(k.get('lewati_siswa') or ())  # unggah ulang: siswa yang sudah berhasil di impor sebelumnya
    for ps, s in zip(per_sheet, sheets):
        c = kelas.get(kunci_kelas(s['sheet']))
        for b in s['baris']:
            if ke_kosong(b['nilai']):
                b['lewati'] = 'kosong'
            elif lewati and c:
                cocok = cocokkan_siswa(b, indeks_kelas[c['id']])
                b['lewati'] = 'dilewati' if not isinstance(cocok, str) and cocok['id'] in lewati else None
            else:
                b['lewati'] = None
        ps['kosong'] = sum(1 for b in s['baris'] if b['lewati'] == 'kosong')
        ps['dilewati'] = sum(1 for b in s['baris'] if b['lewati'] == 'dilewati')
        ps['total'] = len(s['baris']) - ps['kosong'] - ps['dilewati']
    total = sum(ps['total'] for ps in per_sheet)
    ada = {kunci_kelas(s['sheet']) for s in sheets}
    tanpa_sheet = [c['name'] for c in k['kelas'] if kunci_kelas(c['name']) not in ada]
    log = db[KOLEKSI_IMPOR_LOG]
    await log.update_one({'id': log_id}, {'$set': {'total_baris': total, 'per_sheet': per_sheet, 'kelas_tanpa_sheet': tanpa_sheet}})

    lama = {d['siswa_id']: d.get('nilai') for d in await db[KOLEKSI_NILAI].find(
        {'ujian_id': k['ujian_id'], 'mapel_id': k['mapel_id'], 'kelas_id': {'$in': [c['id'] for c in k['kelas']]}},
        {'_id': 0, 'siswa_id': 1, 'nilai': 1}).to_list(20000)}
    daftar_galat: List[Dict[str, Any]] = []
    galat_total = 0
    berubah = 0
    jumlah: Dict[str, float] = {}
    siswa_berhasil: List[str] = []
    hitung = {'diproses': 0, 'berhasil': 0, 'gagal': 0}

    async def simpan_progres(sheet_aktif=None):
        await log.update_one({'id': log_id}, {'$set': {**hitung, 'per_sheet': per_sheet, 'sheet_aktif': sheet_aktif,
                                                       'galat': daftar_galat, 'galat_total': galat_total}})

    for ps, s in zip(per_sheet, sheets):
        await simpan_progres(s['sheet'])  # tandai sheet yang sedang diproses
        c = kelas.get(kunci_kelas(s['sheet']))
        indeks, dipakai = (indeks_kelas[c['id']] if c else _indeks_siswa([])), {}
        for b in s['baris']:
            if b['lewati']:
                continue
            jenis, pesan, siswa = galat_baris(b, c, indeks, dipakai, k['jenjang'], s['sheet'])
            if pesan:
                ps['gagal'] += 1
                hitung['gagal'] += 1
                galat_total += 1
                if len(daftar_galat) < GALAT_MAKS_DISIMPAN:
                    daftar_galat.append({'sheet': s['sheet'], 'baris': b['baris'], 'nama': b['nama'] or None, 'siswa_id': b['siswa_id'] or None,
                                         'nilai': str(b['nilai'])[:40] if b['nilai'] is not None else None, 'jenis': jenis, 'pesan': pesan})
            else:
                dipakai[siswa['id']] = b['baris']
                siswa_berhasil.append(siswa['id'])
                angka = ke_angka(b['nilai'])
                jumlah[s['sheet']] = jumlah.get(s['sheet'], 0) + angka
                ps['rata'] = round(jumlah[s['sheet']] / (ps['berhasil'] + 1), 1)
                dok = dokumen_nilai(k['ujian_id'], k['mapel_id'], siswa, angka, 'impor', k['oleh'], s['sheet'], log_id)
                await db[KOLEKSI_NILAI].update_one(
                    {'ujian_id': k['ujian_id'], 'mapel_id': k['mapel_id'], 'siswa_id': siswa['id']}, {'$set': dok}, upsert=True)
                await sinkron_rapor(db, k.get('rapor'), dok)  # kolom UAS rapor & Input Nilai guru mapel
                if siswa['id'] not in lama or lama[siswa['id']] != angka:  # jejak hanya untuk nilai yang benar-benar berubah
                    await db[KOLEKSI_RIWAYAT].insert_one(dokumen_riwayat(dok, lama.get(siswa['id'])))
                    berubah += 1
                ps['berhasil'] += 1
                hitung['berhasil'] += 1
            ps['diproses'] += 1
            hitung['diproses'] += 1
            if hitung['diproses'] % SIMPAN_PROGRES_TIAP == 0:
                await simpan_progres(s['sheet'])
                await asyncio.sleep(0)  # beri giliran permintaan lain (mis. polling progres) di event loop yang sama
        await simpan_progres(s['sheet'])

    dilewati = sum(ps['dilewati'] for ps in per_sheet)
    if not total and dilewati:
        pesan = (f'Tidak ada baris gagal yang perlu diproses ulang ({dilewati} baris sudah berhasil sebelumnya '
                 'dan dilewati).')
    elif not total:
        pesan = 'Tidak ada baris bernilai di berkas ini (kolom "Nilai UAS" masih kosong).'
    elif tanpa_sheet:
        pesan = f"Kelas tanpa sheet di berkas ini (nilainya tidak berubah): {', '.join(tanpa_sheet)}."
    else:
        pesan = ''
    await log.update_one({'id': log_id}, {'$set': {
        **hitung, 'per_sheet': per_sheet, 'galat': daftar_galat, 'galat_total': galat_total, 'sheet_aktif': None,
        'siswa_berhasil': siswa_berhasil, 'dilewati': dilewati, 'berubah': berubah, 'status': 'selesai' if total else 'gagal', 'pesan': pesan,
        'selesai_pada': sekarang_wib().isoformat()}})


def ke_kosong(nilai: Any) -> bool:
    return nilai is None or (isinstance(nilai, str) and not nilai.strip())
