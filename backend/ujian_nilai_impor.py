"""Job impor nilai UAS (berjalan di latar belakang setelah berkas diunggah).

Alur & `tahap` yang tercatat di log (lihat ujian_nilai.TAHAP_IMPOR): 'diterima' -> 'membaca' (baca berkas di thread terpisah
agar server tetap responsif) -> 'memeriksa' (cek `_meta`, cocokkan sheet ke kelas) -> 'menyimpan' (per sheet kelas cocokkan
baris ke siswa kelas itu — ID Siswa, lalu NIS, lalu nama persis — validasi nilai 0–100, simpan ke `nilai_ujian`) ->
status 'selesai' (atau 'gagal'). Progres disimpan saat berpindah sheet (`sheet_aktif`) dan tiap SIMPAN_PROGRES_TIAP baris,
masing-masing memperbarui `diperbarui` (detak aktivitas; job tanpa detak lama dianggap macet oleh router).

Nilai KOSONG diisi 0 (keputusan panitia: keterisian nilai mengikuti adanya nilai) dan dihitung di `diisi_nol`.
Unggah ulang (`konteks.lewati_siswa`): baris milik siswa yang SUDAH berhasil di impor sebelumnya dilewati (`dilewati`),
jadi hanya baris yang dulu gagal (atau baru) yang diproses — berkas perbaikan boleh berupa berkas lengkap yang sama.

Kegagalan:
- per baris (`galat`): jenis 'sheet' | 'siswa' | 'nilai' | 'ganda' | 'simpan' (database menolak menyimpan baris itu atau
  sinkron ke rapor gagal), dengan pesan penyebab; job berlanjut ke baris berikutnya;
- seluruh job (status 'gagal'): `pesan` (penjelasan + posisi), `galat_teknis` (jenis & pesan exception tersaring), dan
  `gagal_di` { tahap, sheet, baris, nama }. GAGAL_SIMPAN_BERUNTUN baris berturut-turut gagal disimpan = masalah database
  menyeluruh, job dihentikan agar tidak menulis ribuan galat yang sama.

Hasil yang disimpan di log untuk monitoring:
- per_sheet: { sheet, kelas, total, diproses, berhasil, gagal, diisi_nol, dilewati, rata } (rata = rata-rata nilai tersimpan);
- berubah: jumlah nilai yang benar-benar berubah (masing-masing tercatat di nilai_ujian_riwayat);
- galat urut sheet & baris (dibatasi GALAT_MAKS_DISIMPAN; `galat_total` tetap jumlah sebenarnya).
"""
import asyncio
import logging
from typing import Any, Dict, List, Optional

from ujian import sekarang_wib
from ujian_nilai import (GALAT_MAKS_DISIMPAN, KOLEKSI_IMPOR_LOG, KOLEKSI_RIWAYAT, KOLEKSI_NILAI, LABEL_TAHAP, dokumen_nilai,
                         dokumen_riwayat, galat_nilai, galat_teknis, ke_angka, penjelasan_galat, simpan_dokumen_nilai)
from ujian_nilai_rapor import sinkron_rapor
from ujian_nilai_xlsx import GalatBerkas, baca_berkas_nilai, galat_meta, kunci_kelas

logger = logging.getLogger(__name__)
SIMPAN_PROGRES_TIAP = 20
GAGAL_SIMPAN_BERUNTUN = 5


class _GagalSimpanBeruntun(Exception):
    def __init__(self, asal: BaseException):
        super().__init__(str(asal))
        self.asal = asal


def lokasi_teks(posisi: Optional[Dict[str, Any]]) -> str:
    """' (sheet 7B, baris 12 — Ahmad)' dari gagal_di, atau '' bila belum sampai ke baris."""
    p = posisi or {}
    bagian = [f"sheet {p['sheet']}" if p.get('sheet') else None, f"baris {p['baris']}" if p.get('baris') else None]
    teks = ', '.join(b for b in bagian if b)
    if teks and p.get('nama'):
        teks += f" — {p['nama']}"
    return f' ({teks})' if teks else ''


async def _tutup_gagal(db, log_id: str, pesan: str, posisi: Optional[Dict[str, Any]] = None, teknis: Optional[str] = None,
                       tambahan: Optional[Dict[str, Any]] = None) -> None:
    waktu = sekarang_wib().isoformat()
    await db[KOLEKSI_IMPOR_LOG].update_one({'id': log_id}, {'$set': {
        **(tambahan or {}), 'status': 'gagal', 'pesan': pesan, 'selesai_pada': waktu, 'diperbarui': waktu, 'sheet_aktif': None,
        'galat_teknis': teknis, 'gagal_di': dict(posisi) if posisi else None}})


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
    oleh: user, lewati_siswa?: [id siswa], rapor?: ujian_nilai_rapor.konteks_rapor() }. Tidak pernah melempar galat: kegagalan
    tercatat di log beserta penyebab, posisi, dan hasil sementara (baris yang sudah tersimpan tetap tersimpan)."""
    keadaan: Dict[str, Any] = {'posisi': {'tahap': 'diterima', 'sheet': None, 'baris': None, 'nama': None}, 'hasil': {}}
    try:
        await _proses(db, log_id, isi, konteks, keadaan)
    except Exception as e:  # jaring pengaman job latar belakang: penyebab dicatat agar terlihat di Monitoring Impor
        asal = e.asal if isinstance(e, _GagalSimpanBeruntun) else e
        logger.exception('Impor nilai UAS %s gagal pada %s', log_id, keadaan['posisi'])
        posisi = keadaan['posisi']
        label = LABEL_TAHAP.get(posisi.get('tahap'), posisi.get('tahap') or '-').lower()
        if isinstance(e, _GagalSimpanBeruntun):
            pesan = (f'{penjelasan_galat(asal)}: {GAGAL_SIMPAN_BERUNTUN} baris berturut-turut gagal disimpan{lokasi_teks(posisi)}, '
                     'impor dihentikan. Baris yang sudah berhasil tetap tersimpan. Hubungi admin dengan detail teknis di bawah.')
        else:
            pesan = (f'{penjelasan_galat(asal)} saat {label}{lokasi_teks(posisi)}. Baris yang sudah berhasil tetap tersimpan; '
                     'coba unggah ulang, dan bila berulang hubungi admin dengan detail teknis di bawah.')
        hasil = keadaan['hasil']  # hasil sementara sampai titik gagal (rujukan hidup ke penghitung job)
        tambahan = {**hasil['hitung'], **{x: hasil[x] for x in ('per_sheet', 'galat', 'siswa_berhasil')}} if hasil else {}
        try:
            await _tutup_gagal(db, log_id, pesan, posisi, galat_teknis(asal), tambahan)
        except Exception:  # pragma: no cover - database tidak terjangkau sama sekali; router menandainya macet nanti
            logger.exception('Log impor nilai UAS %s tidak dapat ditutup', log_id)


async def _proses(db, log_id: str, isi: bytes, k: Dict[str, Any], keadaan: Dict[str, Any]) -> None:
    log = db[KOLEKSI_IMPOR_LOG]
    posisi = keadaan['posisi']

    async def ke_tahap(tahap: str, **ubah) -> None:
        posisi.update(tahap=tahap, sheet=None, baris=None, nama=None)
        await log.update_one({'id': log_id}, {'$set': {**ubah, 'tahap': tahap, 'diperbarui': sekarang_wib().isoformat()}})

    await ke_tahap('membaca')
    try:
        meta, sheets = await asyncio.to_thread(baca_berkas_nilai, isi)
    except GalatBerkas as e:
        await _tutup_gagal(db, log_id, str(e), posisi)
        return
    await ke_tahap('memeriksa')
    galat = galat_meta(meta, k['ujian_id'], k['mapel_id'], k['jenjang'], k['nama_mapel'])
    if galat:
        await _tutup_gagal(db, log_id, galat, posisi)
        return

    kelas = {kunci_kelas(c['name']): c for c in k['kelas']}
    per_sheet = [{'sheet': s['sheet'], 'kelas': (kelas.get(kunci_kelas(s['sheet'])) or {}).get('name'), 'total': 0,
                  'diproses': 0, 'berhasil': 0, 'gagal': 0, 'diisi_nol': 0, 'dilewati': 0, 'rata': None} for s in sheets]
    indeks_kelas = {c['id']: _indeks_siswa([x for x in k['siswa'] if x.get('kelas_id') == c['id']]) for c in k['kelas']}
    lewati = set(k.get('lewati_siswa') or ())  # unggah ulang: siswa yang sudah berhasil di impor sebelumnya
    for ps, s in zip(per_sheet, sheets):
        c = kelas.get(kunci_kelas(s['sheet']))
        for b in s['baris']:
            b['kosong'] = ke_kosong(b['nilai'])
            if b['kosong']:
                b['nilai'] = 0  # nilai kosong = 0
            cocok = cocokkan_siswa(b, indeks_kelas[c['id']]) if lewati and c else None
            b['lewati'] = cocok is not None and not isinstance(cocok, str) and cocok['id'] in lewati
        ps['dilewati'] = sum(1 for b in s['baris'] if b['lewati'])
        ps['total'] = len(s['baris']) - ps['dilewati']
    total = sum(ps['total'] for ps in per_sheet)
    ada = {kunci_kelas(s['sheet']) for s in sheets}
    tanpa_sheet = [c['name'] for c in k['kelas'] if kunci_kelas(c['name']) not in ada]
    await log.update_one({'id': log_id}, {'$set': {'total_baris': total, 'per_sheet': per_sheet, 'kelas_tanpa_sheet': tanpa_sheet}})

    lama = {d['siswa_id']: d.get('nilai') for d in await db[KOLEKSI_NILAI].find(
        {'ujian_id': k['ujian_id'], 'mapel_id': k['mapel_id'], 'kelas_id': {'$in': [c['id'] for c in k['kelas']]}},
        {'_id': 0, 'siswa_id': 1, 'nilai': 1}).to_list(20000)}
    daftar_galat: List[Dict[str, Any]] = []
    jumlah: Dict[str, float] = {}
    siswa_berhasil: List[str] = []
    hitung = {'diproses': 0, 'berhasil': 0, 'gagal': 0, 'diisi_nol': 0, 'berubah': 0, 'galat_total': 0}
    keadaan['hasil'] = {'per_sheet': per_sheet, 'galat': daftar_galat, 'siswa_berhasil': siswa_berhasil, 'hitung': hitung}
    beruntun = 0

    def catat_galat(s, b, jenis, pesan, ps):
        ps['gagal'] += 1
        hitung['gagal'] += 1
        hitung['galat_total'] += 1
        if len(daftar_galat) < GALAT_MAKS_DISIMPAN:
            daftar_galat.append({'sheet': s['sheet'], 'baris': b['baris'], 'nama': b['nama'] or None, 'siswa_id': b['siswa_id'] or None,
                                 'nilai': '' if b['kosong'] else (str(b['nilai'])[:40] if b['nilai'] is not None else None),
                                 'jenis': jenis, 'pesan': pesan})

    async def simpan_progres(sheet_aktif=None):
        await log.update_one({'id': log_id}, {'$set': {**hitung, 'per_sheet': per_sheet, 'sheet_aktif': sheet_aktif, 'galat': daftar_galat,
                                                       'tahap': 'menyimpan', 'diperbarui': sekarang_wib().isoformat()}})

    for ps, s in zip(per_sheet, sheets):
        posisi.update(tahap='menyimpan', sheet=s['sheet'], baris=None, nama=None)
        await simpan_progres(s['sheet'])  # tandai sheet yang sedang diproses
        c = kelas.get(kunci_kelas(s['sheet']))
        indeks, dipakai = (indeks_kelas[c['id']] if c else _indeks_siswa([])), {}
        for b in s['baris']:
            if b['lewati']:
                continue
            posisi.update(baris=b['baris'], nama=b['nama'] or b['siswa_id'] or None)
            jenis, pesan, siswa = galat_baris(b, c, indeks, dipakai, k['jenjang'], s['sheet'])
            if pesan:
                catat_galat(s, b, jenis, pesan, ps)
            else:
                dipakai[siswa['id']] = b['baris']
                posisi['nama'] = siswa.get('full_name') or posisi['nama']
                angka = ke_angka(b['nilai'])
                dok = dokumen_nilai(k['ujian_id'], k['mapel_id'], siswa, angka, 'impor', k['oleh'], s['sheet'], log_id)
                tahap_simpan = 'nilai'
                try:
                    await simpan_dokumen_nilai(db, dok)
                    if siswa['id'] not in lama or lama[siswa['id']] != angka:  # jejak hanya untuk nilai yang benar-benar berubah
                        await db[KOLEKSI_RIWAYAT].insert_one(dokumen_riwayat(dok, lama.get(siswa['id'])))
                        lama[siswa['id']] = angka
                        hitung['berubah'] += 1
                    tahap_simpan = 'rapor'
                    await sinkron_rapor(db, k.get('rapor'), dok)  # kolom UAS rapor & Input Nilai guru mapel
                except Exception as e:  # noqa: BLE001 — dicatat per baris; masalah menyeluruh menghentikan job
                    beruntun += 1
                    logger.warning('Impor nilai UAS %s: gagal menyimpan %s baris %s: %s', log_id, s['sheet'], b['baris'], galat_teknis(e))
                    if beruntun >= GAGAL_SIMPAN_BERUNTUN:
                        raise _GagalSimpanBeruntun(e) from e
                    sebab = (f'Gagal menyimpan nilai ke database — {penjelasan_galat(e)} ({galat_teknis(e, 160)})' if tahap_simpan == 'nilai'
                             else f'Nilai tersimpan, tetapi gagal disalin ke kolom UAS rapor — {penjelasan_galat(e)} ({galat_teknis(e, 160)})')
                    catat_galat(s, b, 'simpan', sebab, ps)
                else:
                    beruntun = 0
                    siswa_berhasil.append(siswa['id'])
                    jumlah[s['sheet']] = jumlah.get(s['sheet'], 0) + angka
                    ps['berhasil'] += 1
                    hitung['berhasil'] += 1
                    ps['rata'] = round(jumlah[s['sheet']] / ps['berhasil'], 1)
                    if b['kosong']:
                        ps['diisi_nol'] += 1
                        hitung['diisi_nol'] += 1
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
        pesan = 'Tidak ada baris siswa di berkas ini (sheet kelas hanya berisi header).'
    elif tanpa_sheet:
        pesan = f"Kelas tanpa sheet di berkas ini (nilainya tidak berubah): {', '.join(tanpa_sheet)}."
    else:
        pesan = ''
    waktu = sekarang_wib().isoformat()
    await log.update_one({'id': log_id}, {'$set': {
        **hitung, 'per_sheet': per_sheet, 'galat': daftar_galat, 'sheet_aktif': None, 'siswa_berhasil': siswa_berhasil,
        'dilewati': dilewati, 'status': 'selesai' if total else 'gagal', 'pesan': pesan, 'tahap': 'selesai' if total else 'memeriksa',
        'gagal_di': None if total else {'tahap': 'memeriksa', 'sheet': None, 'baris': None, 'nama': None},
        'selesai_pada': waktu, 'diperbarui': waktu}})


def ke_kosong(nilai: Any) -> bool:
    return nilai is None or (isinstance(nilai, str) and not nilai.strip())
