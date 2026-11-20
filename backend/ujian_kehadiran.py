"""Ujian Madrasah — Daftar Hadir Peserta: kiriman publik per sesi, tanda izin/sakit per hari, dan buka kunci.

Dokumen `daftar_hadir` (kiriman HADIR peserta lewat tautan publik; satu per peserta per sesi):
    id, ujian_id, ruang_id, peserta_id, siswa_id, sesi_id, tanggal, status 'hadir', ada_ttd, waktu_kirim, sumber 'publik',
    ip, perangkat
    Unik: (peserta_id, sesi_id) — satu nama hanya sekali per sesi.

Dokumen `daftar_hadir_ttd` (PNG tanda tangan, dipisah agar daftar ringan; pola sama dengan angket 360°):
    kehadiran_id (unik), png (bytes), dibuat_pada

Dokumen `daftar_hadir_status` (izin/sakit/tanpa keterangan dari panitia; CUKUP SEKALI PER HARI per peserta):
    id, ujian_id, peserta_id, tanggal, status 'izin'|'sakit'|'alpa', catatan, ditandai_oleh, ditandai_oleh_nama,
    ditandai_pada
    Unik: (ujian_id, peserta_id, tanggal). Berlaku untuk setiap sesi tanggal itu yang tidak diisi hadir oleh peserta.

Dokumen `daftar_hadir_arsip` (kiriman yang kuncinya dibuka admin; tidak pernah dihapus permanen):
    salinan kiriman + png, dibuka_oleh, dibuka_oleh_nama, alasan_buka, dibuka_pada

Status peserta pada satu sesi: 'hadir' (ada kiriman) > tanda harian (izin/sakit/alpa) > None (belum).
"""
import uuid
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

from pydantic import BaseModel, Field, field_validator

from ujian import sekarang_wib

KOLEKSI_DH = 'daftar_hadir'
KOLEKSI_DH_TTD = 'daftar_hadir_ttd'
KOLEKSI_DH_STATUS = 'daftar_hadir_status'
KOLEKSI_DH_ARSIP = 'daftar_hadir_arsip'

STATUS_TANDA = ('izin', 'sakit', 'alpa')
STATUS_SEMUA = ('hadir',) + STATUS_TANDA
CATATAN_MIN, CATATAN_MAKS = 3, 200
ALASAN_BUKA_MIN, ALASAN_BUKA_MAKS = 5, 300
TTD_MAKS_DATA_URL = 400 * 1024

INDEX_KEHADIRAN = [
    (KOLEKSI_DH, [('id', 1)], {'unique': True}),
    (KOLEKSI_DH, [('peserta_id', 1), ('sesi_id', 1)], {'unique': True, 'name': 'dh_unik_peserta_sesi'}),
    (KOLEKSI_DH, [('ujian_id', 1), ('sesi_id', 1), ('ruang_id', 1)], {}),
    (KOLEKSI_DH_TTD, [('kehadiran_id', 1)], {'unique': True}),
    (KOLEKSI_DH_STATUS, [('id', 1)], {'unique': True}),
    (KOLEKSI_DH_STATUS, [('ujian_id', 1), ('peserta_id', 1), ('tanggal', 1)], {'unique': True, 'name': 'dh_status_unik_hari'}),
    (KOLEKSI_DH_STATUS, [('ujian_id', 1), ('tanggal', 1)], {}),
    (KOLEKSI_DH_ARSIP, [('ujian_id', 1), ('peserta_id', 1), ('sesi_id', 1)], {}),
]


async def pastikan_index_kehadiran(db) -> None:
    for koleksi, keys, opsi in INDEX_KEHADIRAN:
        await db[koleksi].create_index(keys, **opsi)


# ---- Isian ----
class DaftarHadirIn(BaseModel):
    """Kiriman publik daftar hadir (POST /publik/ujian/{token}/daftar-hadir); sama dengan skemaDaftarHadir frontend."""
    sesi_id: str = Field(..., min_length=1, max_length=64)
    ruang_id: str = Field(..., min_length=1, max_length=64)
    peserta_id: str = Field(..., min_length=1, max_length=64)
    ttd_png: str = Field(..., max_length=TTD_MAKS_DATA_URL)

    @field_validator('ttd_png')
    @classmethod
    def _png(cls, v):
        if not v.startswith('data:image/png;base64,'):
            raise ValueError('Tanda tangan wajib diisi')
        return v


class StatusIn(BaseModel):
    """Tanda izin/sakit/tanpa keterangan per hari (PUT /ujian/{id}/daftar-hadir/status); status None menghapus tanda."""
    peserta_id: str = Field(..., min_length=1)
    tanggal: str = Field(..., pattern=r'^\d{4}-\d{2}-\d{2}$')
    status: Optional[str] = None
    catatan: str = Field('', max_length=CATATAN_MAKS)

    @field_validator('catatan')
    @classmethod
    def _rapikan(cls, v):
        return ' '.join((v or '').split())

    @field_validator('status')
    @classmethod
    def _status(cls, v):
        if v is not None and v not in STATUS_TANDA:
            raise ValueError('Status hanya izin, sakit, atau alpa')
        return v

    def galat(self) -> Optional[str]:
        if self.status in ('izin', 'sakit') and len(self.catatan) < CATATAN_MIN:
            return f'Catatan wajib untuk {self.status} (minimal {CATATAN_MIN} karakter)'
        return None


class BukaKunciIn(BaseModel):
    alasan: str = Field(..., max_length=ALASAN_BUKA_MAKS)

    @field_validator('alasan')
    @classmethod
    def _alasan(cls, v):
        v = ' '.join((v or '').split())
        if len(v) < ALASAN_BUKA_MIN:
            raise ValueError(f'Alasan buka kunci minimal {ALASAN_BUKA_MIN} karakter')
        return v


# ---- Dokumen ----
def dokumen_kehadiran(ujian_id: str, peserta: Dict[str, Any], sesi: Dict[str, Any], ip: Optional[str] = None,
                      perangkat: Optional[str] = None, waktu: datetime = None) -> Dict[str, Any]:
    return {
        'id': str(uuid.uuid4()), 'ujian_id': ujian_id, 'ruang_id': peserta['ruang_id'], 'peserta_id': peserta['id'],
        'siswa_id': peserta.get('siswa_id'), 'sesi_id': sesi['id'], 'tanggal': sesi['tanggal'], 'status': 'hadir',
        'ada_ttd': True, 'waktu_kirim': (waktu or sekarang_wib()).isoformat(), 'sumber': 'publik',
        'ip': ip, 'perangkat': (perangkat or '')[:200],
    }


def dokumen_status(ujian_id: str, isi: StatusIn, oleh: Dict[str, Any], waktu: datetime = None) -> Dict[str, Any]:
    return {
        'ujian_id': ujian_id, 'peserta_id': isi.peserta_id, 'tanggal': isi.tanggal, 'status': isi.status,
        'catatan': isi.catatan, 'ditandai_oleh': oleh.get('id'), 'ditandai_oleh_nama': oleh.get('full_name') or oleh.get('username'),
        'ditandai_pada': (waktu or sekarang_wib()).isoformat(),
    }


def status_sesi(peserta_ids: Iterable[str], kehadiran: List[Dict[str, Any]], tanda: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """{peserta_id: { status, kehadiran|None, tanda|None }} untuk SATU sesi. Kiriman hadir mengalahkan tanda harian."""
    hadir = {k['peserta_id']: k for k in kehadiran}
    harian = {t['peserta_id']: t for t in tanda}
    hasil = {}
    for pid in peserta_ids:
        if pid in hadir:
            hasil[pid] = {'status': 'hadir', 'kehadiran': hadir[pid], 'tanda': harian.get(pid)}
        elif pid in harian:
            hasil[pid] = {'status': harian[pid]['status'], 'kehadiran': None, 'tanda': harian[pid]}
        else:
            hasil[pid] = {'status': None, 'kehadiran': None, 'tanda': None}
    return hasil


def rekap_status(status: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    """Rekap satu ruang/sesi: total, hadir, izin, sakit, alpa, belum, lengkap (semua peserta berstatus)."""
    nilai = [s['status'] for s in status.values()]
    r = {'total': len(nilai), **{s: nilai.count(s) for s in STATUS_SEMUA}, 'belum': nilai.count(None)}
    r['lengkap'] = r['total'] > 0 and r['belum'] == 0
    return r


async def ambil_status_sesi(db, ujian_id: str, sesi: Dict[str, Any], peserta_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """Status setiap peserta (daftar id) pada satu sesi dari kiriman hadir & tanda harian tanggal sesi."""
    if not peserta_ids:
        return {}
    kehadiran = await db[KOLEKSI_DH].find({'sesi_id': sesi['id'], 'peserta_id': {'$in': peserta_ids}}, {'_id': 0}).to_list(2000)
    tanda = await db[KOLEKSI_DH_STATUS].find({'ujian_id': ujian_id, 'tanggal': sesi['tanggal'], 'peserta_id': {'$in': peserta_ids}},
                                            {'_id': 0}).to_list(2000)
    return status_sesi(peserta_ids, kehadiran, tanda)


# ---- Tanda izin/sakit per hari & log buka kunci ----
async def simpan_tanda(db, ujian_id: str, isi: StatusIn, oleh: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Simpan/ganti tanda harian satu peserta (satu dokumen per ujian-peserta-tanggal); status None menghapusnya.
    Mengembalikan tanda lama (untuk audit) atau None."""
    kunci = {'ujian_id': ujian_id, 'peserta_id': isi.peserta_id, 'tanggal': isi.tanggal}
    lama = await db[KOLEKSI_DH_STATUS].find_one(kunci, {'_id': 0})
    if isi.status is None:
        if lama:
            await db[KOLEKSI_DH_STATUS].delete_one(kunci)
        return lama
    doc = dokumen_status(ujian_id, isi, oleh)
    await db[KOLEKSI_DH_STATUS].update_one(kunci, {'$set': doc, '$setOnInsert': {'id': str(uuid.uuid4())}}, upsert=True)
    return lama


async def buka_kunci(db, kehadiran: Dict[str, Any], oleh: Dict[str, Any], alasan: str) -> Dict[str, Any]:
    """Buka kunci kiriman: salinan kiriman + PNG dipindah ke `daftar_hadir_arsip` (log buka kunci, tidak dihapus
    permanen) lalu kiriman aktif dihapus sehingga peserta dapat mengirim ulang pada sesi itu."""
    ttd = await db[KOLEKSI_DH_TTD].find_one({'kehadiran_id': kehadiran['id']}, {'_id': 0})
    arsip = {
        **{k: v for k, v in kehadiran.items() if k != '_id'},
        'png': (ttd or {}).get('png'), 'dibuka_oleh': oleh.get('id'), 'dibuka_oleh_nama': oleh.get('full_name') or oleh.get('username'),
        'alasan_buka': alasan, 'dibuka_pada': sekarang_wib().isoformat(),
    }
    await db[KOLEKSI_DH_ARSIP].insert_one(dict(arsip))
    await db[KOLEKSI_DH].delete_one({'id': kehadiran['id']})
    await db[KOLEKSI_DH_TTD].delete_one({'kehadiran_id': kehadiran['id']})
    return arsip


async def riwayat_buka(db, ujian_id: str, sesi_id: str, peserta_ids: List[str]) -> Dict[str, List[Dict[str, Any]]]:
    """{peserta_id: [{ oleh_nama, alasan, pada }]} log buka kunci pada satu sesi, terlama dulu."""
    if not peserta_ids:
        return {}
    hasil: Dict[str, List[Dict[str, Any]]] = {}
    docs = await db[KOLEKSI_DH_ARSIP].find({'ujian_id': ujian_id, 'sesi_id': sesi_id, 'peserta_id': {'$in': peserta_ids}},
                                          {'_id': 0, 'png': 0}).to_list(5000)
    for d in sorted(docs, key=lambda x: x.get('dibuka_pada') or ''):
        hasil.setdefault(d['peserta_id'], []).append({'oleh_nama': d.get('dibuka_oleh_nama'), 'alasan': d.get('alasan_buka'),
                                                      'pada': d.get('dibuka_pada')})
    return hasil


# ---- Rekap per ruang & jenjang (dipakai berita acara & cetak) ----
def rekap_jenjang(peserta: List[Dict[str, Any]], status: Dict[str, Dict[str, Any]]) -> Dict[int, Dict[str, Any]]:
    """{jenjang: { total, hadir, izin, sakit, alpa, belum, lengkap, nomor_hadir: [..], nomor_tidak_hadir: [..] }} untuk
    satu ruang pada satu sesi. Nomor berurutan seperti daftar peserta (nomor peserta, lalu nama bila tanpa nomor)."""
    hasil: Dict[int, Dict[str, Any]] = {}
    for j in sorted({p.get('jenjang') for p in peserta if p.get('jenjang') is not None}):
        anggota = [p for p in peserta if p.get('jenjang') == j]
        st = {p['id']: status.get(p['id']) or {'status': None} for p in anggota}
        r = rekap_status(st)
        label = lambda p: p.get('nomor_peserta') or p.get('nama')  # noqa: E731
        r['nomor_hadir'] = [label(p) for p in anggota if st[p['id']]['status'] == 'hadir']
        r['nomor_tidak_hadir'] = [label(p) for p in anggota if st[p['id']]['status'] in STATUS_TANDA]
        hasil[j] = r
    return hasil
