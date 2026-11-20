"""Ujian Madrasah — Berita Acara pengawas (tautan publik) & Arsip Administrasi Ujian.

Dokumen `berita_acara` (satu per ruang per sesi; diisi pengawas lewat tautan publik tanpa login):
    id, ujian_id, ruang_id, sesi_id, tanggal, pengawas_id (guru_pengawas.id), pengawas_user_id, pengawas_nama,
    pengawas_nip, catatan, ada_ttd, waktu_kirim,
    rekap { 'jenjang': { total, hadir, izin, sakit, alpa, nomor_hadir, nomor_tidak_hadir } }   (salinan dari daftar
    hadir saat dikirim — jumlah hadir & izin TIDAK diisi manual), jumlah_hadir, jumlah_izin, ip, perangkat
    Unik: (ujian_id, ruang_id, sesi_id).

Dokumen `berita_acara_ttd`: berita_acara_id (unik), png, dibuat_pada.

Dokumen `arsip_ujian` (setiap hasil cetak; akses terbatas): id, ujian_id, ruang_id, nama_ruang, jenjang, sesi_id,
    sesi_label, jenis_dokumen ('daftar_hadir'|'berita_acara'), format ('pdf'|'docx'), nama_berkas, ukuran, mesin,
    dibuat_oleh, dibuat_oleh_nama, waktu
Dokumen `arsip_ujian_berkas`: arsip_id (unik), isi (bytes), mime.
"""
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field, field_validator

from ujian import sekarang_wib
from ujian_kehadiran import TTD_MAKS_DATA_URL

KOLEKSI_BA = 'berita_acara'
KOLEKSI_BA_TTD = 'berita_acara_ttd'
KOLEKSI_ARSIP = 'arsip_ujian'
KOLEKSI_ARSIP_BERKAS = 'arsip_ujian_berkas'
CATATAN_BA_MAKS = 1000  # sama dengan CATATAN_BA_MAKS frontend

INDEX_BERITA_ACARA = [
    (KOLEKSI_BA, [('id', 1)], {'unique': True}),
    (KOLEKSI_BA, [('ujian_id', 1), ('ruang_id', 1), ('sesi_id', 1)], {'unique': True, 'name': 'ba_unik_ruang_sesi'}),
    (KOLEKSI_BA, [('ujian_id', 1), ('tanggal', 1)], {}),
    (KOLEKSI_BA, [('pengawas_id', 1)], {}),
    (KOLEKSI_BA_TTD, [('berita_acara_id', 1)], {'unique': True}),
    (KOLEKSI_ARSIP, [('id', 1)], {'unique': True}),
    (KOLEKSI_ARSIP, [('ujian_id', 1), ('waktu', -1)], {}),
    (KOLEKSI_ARSIP, [('ujian_id', 1), ('ruang_id', 1), ('jenjang', 1), ('sesi_id', 1)], {}),
    (KOLEKSI_ARSIP_BERKAS, [('arsip_id', 1)], {'unique': True}),
]


async def pastikan_index_berita_acara(db) -> None:
    for koleksi, keys, opsi in INDEX_BERITA_ACARA:
        await db[koleksi].create_index(keys, **opsi)


class BeritaAcaraIn(BaseModel):
    """Kiriman berita acara publik (POST /publik/ujian/{token}/berita-acara); sama dengan skemaBeritaAcara frontend."""
    sesi_id: str = Field(..., min_length=1, max_length=64)
    ruang_id: str = Field(..., min_length=1, max_length=64)
    pengawas_id: str = Field(..., min_length=1, max_length=64)
    catatan: str = Field('', max_length=CATATAN_BA_MAKS)
    ttd_png: str = Field(..., max_length=TTD_MAKS_DATA_URL)

    @field_validator('catatan')
    @classmethod
    def _rapikan(cls, v):
        return '\n'.join(' '.join(b.split()) for b in (v or '').strip().splitlines()).strip()

    @field_validator('ttd_png')
    @classmethod
    def _png(cls, v):
        if not v.startswith('data:image/png;base64,'):
            raise ValueError('Tanda tangan pengawas wajib diisi')
        return v


def dokumen_berita_acara(ujian_id: str, ruang: Dict[str, Any], sesi: Dict[str, Any], pengawas: Dict[str, Any],
                         rekap: Dict[int, Dict[str, Any]], catatan: str, ip: Optional[str] = None,
                         perangkat: Optional[str] = None, waktu: datetime = None) -> Dict[str, Any]:
    """Berita acara satu ruang & sesi. `rekap` = ujian_kehadiran.rekap_jenjang (disalin agar dokumen tetap utuh walau
    daftar hadir berubah setelahnya)."""
    salin = {str(j): {k: r.get(k) for k in ('total', 'hadir', 'izin', 'sakit', 'alpa', 'nomor_hadir', 'nomor_tidak_hadir')}
             for j, r in rekap.items()}
    return {
        'id': str(uuid.uuid4()), 'ujian_id': ujian_id, 'ruang_id': ruang['id'], 'sesi_id': sesi['id'], 'tanggal': sesi['tanggal'],
        'pengawas_id': pengawas['id'], 'pengawas_user_id': pengawas.get('user_id'), 'pengawas_nama': pengawas.get('nama'),
        'pengawas_nip': pengawas.get('nip'), 'catatan': catatan, 'ada_ttd': True, 'waktu_kirim': (waktu or sekarang_wib()).isoformat(),
        'rekap': salin, 'jumlah_hadir': sum(r.get('hadir', 0) for r in rekap.values()),
        'jumlah_izin': sum(r.get('izin', 0) + r.get('sakit', 0) + r.get('alpa', 0) for r in rekap.values()),
        'ip': ip, 'perangkat': (perangkat or '')[:200],
    }


# ---- Tanda tangan PNG pengawas ----
async def simpan_ttd_ba(db, berita_acara_id: str, data_url: str, waktu: Optional[str] = None) -> int:
    """Olah PNG tanda tangan (pola & batas yang sama dengan angket 360°: dibaca ulang tanpa metadata, harus ada goresan)
    lalu simpan terpisah dari dokumen berita acara. ValueError bila kosong/rusak. Mengembalikan ukuran byte."""
    from pkg_angket import olah_tanda_tangan
    png = olah_tanda_tangan(data_url)
    await db[KOLEKSI_BA_TTD].update_one({'berita_acara_id': berita_acara_id},
                                        {'$set': {'png': png, 'dibuat_pada': waktu or sekarang_wib().isoformat()}}, upsert=True)
    return len(png)


async def ambil_ttd_ba(db, berita_acara_id: str) -> Optional[bytes]:
    d = await db[KOLEKSI_BA_TTD].find_one({'berita_acara_id': berita_acara_id}, {'_id': 0, 'png': 1})
    return bytes(d['png']) if d and d.get('png') else None


# ---- Rekap hadir & izin otomatis dari daftar hadir ----
async def rekap_ruang_sesi(db, ujian_id: str, ruang: Dict[str, Any], sesi: Dict[str, Any]) -> Dict[str, Any]:
    """Rekap satu ruang pada satu sesi untuk berita acara — DIHITUNG dari daftar hadir (kiriman hadir + tanda
    izin/sakit/tanpa keterangan), tidak pernah diisi manual:
    { rekap: {jenjang: {total, hadir, izin, sakit, alpa, belum, lengkap, nomor_hadir, nomor_tidak_hadir}},
      kelengkapan: { lengkap, belum, pesan } }."""
    from ujian_kehadiran import ambil_status_sesi, rekap_jenjang
    from ujian_ruang import peserta_ruang_ujian
    peserta = await peserta_ruang_ujian(db, ujian_id, ruang['id'])
    status = await ambil_status_sesi(db, ujian_id, sesi, [p['id'] for p in peserta])
    rekap = rekap_jenjang(peserta, status)
    belum = sum(r['belum'] for r in rekap.values())
    if not peserta:
        kelengkapan = {'lengkap': False, 'belum': 0, 'pesan': f"Ruang {ruang.get('nama_ruang')} belum berisi peserta."}
    elif belum:
        kelengkapan = {'lengkap': False, 'belum': belum,
                       'pesan': f"Daftar hadir Ruang {ruang.get('nama_ruang')} belum lengkap: {belum} peserta belum mengisi atau ditandai panitia."}
    else:
        kelengkapan = {'lengkap': True, 'belum': 0, 'pesan': 'Daftar hadir lengkap.'}
    return {'rekap': rekap, 'kelengkapan': kelengkapan}


def rekap_untuk_publik(rekap: Dict[int, Dict[str, Any]], sesi: Dict[str, Any]) -> list:
    """Rekap per jenjang untuk antarmuka (urut jenjang) dengan mapel sesi."""
    mapel = sesi.get('mapel') or {}
    return [{'jenjang': j, 'mapel': mapel.get(str(j)), **{k: r.get(k) for k in (
        'total', 'hadir', 'izin', 'sakit', 'alpa', 'belum', 'nomor_hadir', 'nomor_tidak_hadir')}} for j, r in sorted(rekap.items())]
