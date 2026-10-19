"""Pembacaan jejak audit PKG (pkg_audit_log) untuk halaman Jejak Audit kepala madrasah.

    daftar_audit       daftar berhalaman, tersaring kategori/aksi/pelaku/guru/periode/rentang tanggal WIB/teks,
                       terbaru (aktivitas terakhir, waktu_urut) dulu; setiap entri diberi `label` dan `ringkasan`.
    riwayat_aksi_guru  aksi lembar penilaian satu guru (mulai, buka, draf, kirim), bentuk sama dengan riwayat lembar.
Nama guru/penilai untuk ringkasan diambil dari koleksi users (sekali per halaman).
"""
import re
from typing import Any, Dict, List, Optional

from pkg_audit import (
    KATEGORI_AKSI, LABEL_AKSI, daftar_berhalaman, saring_waktu_wib,
)
from pkg_skema import KOLEKSI_AUDIT

MESIN = {'openpyxl': 'Excel', 'libreoffice': 'LibreOffice', 'reportlab': 'cadangan ReportLab'}
JENIS_DOKUMEN = {'rekap': 'Rekap hasil PKG', 'guru': 'Laporan PKG guru'}


def _angka(n: Any) -> str:
    return f'{float(n):.2f}'.replace('.', ',') if isinstance(n, (int, float)) else '-'


def ringkasan_entri(e: Dict[str, Any], nama: Dict[str, str]) -> str:
    """Satu baris ringkasan yang mudah dibaca untuk entri audit (tanpa data sensitif)."""
    m = e.get('metadata') or {}
    aksi = e.get('aksi') or ''
    guru = nama.get(e.get('guru_id') or m.get('guru_id') or '', '') or None
    bagian: List[str] = []
    if aksi == 'penilaian_kirim':
        bagian = [guru, f"nilai {m.get('nilai_akhir')}/{m.get('nilai_maks')} ({_angka(m.get('capaian_persen'))}%)",
                  m.get('predikat')]
    elif aksi == 'penilaian_draf':
        bagian = [guru, f"progres {m.get('progres')}%" if m.get('progres') is not None else None]
    elif aksi in ('penilaian_mulai', 'penilaian_buka', 'lihat_rekap_guru'):
        bagian = [guru, m.get('status') if aksi == 'penilaian_buka' else None]
    elif aksi.startswith('instrumen_'):
        bagian = [f"template v{m.get('versi_template')} revisi {m.get('revisi')}" if m.get('revisi') else None,
                  f"sub {m['kode_sub']}" if m.get('kode_sub') else None, m.get('nama_berkas'), m.get('alasan')]
    elif aksi.startswith('periode_'):
        bagian = [m.get('nama_periode')]
    elif aksi.startswith('sk_'):
        bagian = [m.get('nomor_sk'), f"+{len(m.get('ditambah') or [])} / -{len(m.get('dilepas') or [])}"
                  if 'ditambah' in m else None, m.get('alasan')]
    elif aksi == 'penugasan_simpan':
        bagian = [f"{len(m.get('perubahan') or [])} perubahan", m.get('alasan')]
    elif aksi.startswith('supervisi_'):
        bagian = [nama.get(m.get('penilai_id') or '', None), m.get('tanggal_supervisi')]
    elif aksi == 'cetak_template':
        bagian = [m.get('nama_berkas'), f"{(m.get('format') or '').upper()} ({MESIN.get(m.get('mesin'), m.get('mesin'))})",
                  f"template v{m.get('versi_template')}" if m.get('versi_template') else None]
    elif aksi == 'cetak_gagal':
        bagian = [JENIS_DOKUMEN.get(m.get('jenis_dokumen'), m.get('jenis_dokumen')), (m.get('format') or '').upper(),
                  guru, f"{m.get('status')}: {m.get('pesan')}" if m.get('status') else None]
    elif aksi == 'tolak_akses':
        bagian = [m.get('alasan'), m.get('endpoint')]
    elif aksi == 'rekap_hitung_ulang':
        bagian = [f"{m.get('ditulis')} baris rekap" if m.get('ditulis') is not None else None]
    elif aksi == 'periksa_template':
        bagian = ['berkas utuh' if m.get('utuh') else 'berkas bermasalah']
    elif aksi in ('lihat_template',):
        bagian = [f"template v{m.get('versi_template')}" if m.get('versi_template') else None]
    return ' · '.join(str(b) for b in bagian if b not in (None, '', []))


async def _nama_pengguna(db, ids: set) -> Dict[str, str]:
    ids = {i for i in ids if i}
    if not ids:
        return {}
    docs = await db.users.find({'id': {'$in': list(ids)}}, {'_id': 0, 'id': 1, 'full_name': 1}).to_list(len(ids))
    return {d['id']: d.get('full_name') or d['id'] for d in docs}


def entri_tampil(e: Dict[str, Any], nama: Dict[str, str]) -> Dict[str, Any]:
    kunci = ('id', 'aksi', 'kategori', 'aktor_id', 'aktor_nama', 'aktor_peran', 'timestamp', 'terakhir', 'jumlah',
             'penilaian_id', 'guru_id', 'periode_id', 'ip_address', 'metadata')
    return {**{k: e.get(k) for k in kunci}, 'kategori': e.get('kategori') or KATEGORI_AKSI.get(e.get('aksi'), 'akses'),
            'label': LABEL_AKSI.get(e.get('aksi'), e.get('aksi')),
            'guru_nama': nama.get(e.get('guru_id') or '') if e.get('guru_id') else None,
            'ringkasan': ringkasan_entri(e, nama)}


async def _syarat_cari(db, cari: str) -> Dict[str, Any]:
    pola = re.escape(cari.strip())
    rx = {'$regex': pola, '$options': 'i'}
    atau: List[Dict[str, Any]] = [{'aktor_nama': rx}]
    aksi = [kode for kode, label in LABEL_AKSI.items() if cari.strip().lower() in label.lower()]
    if aksi:
        atau.append({'aksi': {'$in': aksi}})
    guru = await db.users.find({'full_name': rx}, {'_id': 0, 'id': 1}).to_list(200)
    if guru:
        atau.append({'guru_id': {'$in': [g['id'] for g in guru]}})
    atau += [{f'metadata.{f}': rx} for f in ('nama_berkas', 'nomor_sk', 'nama_periode', 'kode_sub', 'alasan', 'predikat')]
    return {'$or': atau}


async def daftar_audit(db, *, kategori: Optional[str] = None, aksi: Optional[str] = None, aktor_id: Optional[str] = None,
                       guru_id: Optional[str] = None, periode_id: Optional[str] = None, dari: Optional[str] = None,
                       sampai: Optional[str] = None, cari: Optional[str] = None, halaman: int = 1,
                       per_halaman: int = 20) -> Dict[str, Any]:
    """{item, total, halaman, per_halaman, urut, arah}. Rentang tanggal (WIB, inklusif) memilih entri yang aktif di
    dalamnya: dimulai sebelum akhir rentang dan aktivitas terakhirnya tidak sebelum awal rentang."""
    q: Dict[str, Any] = {k: v for k, v in {'kategori': kategori, 'aksi': aksi, 'aktor_id': aktor_id, 'guru_id': guru_id,
                                           'periode_id': periode_id}.items() if v}
    waktu = saring_waktu_wib(dari, sampai)
    if '$gte' in waktu:
        q['waktu_urut'] = {'$gte': waktu['$gte']}
    if '$lt' in waktu:
        q['timestamp'] = {'$lt': waktu['$lt']}
    if cari and cari.strip():
        q.update(await _syarat_cari(db, cari))
    hasil = await daftar_berhalaman(db, KOLEKSI_AUDIT, q, 'waktu_urut', 'desc', halaman, per_halaman)
    ids = {e.get('guru_id') for e in hasil['item']} | {(e.get('metadata') or {}).get('penilai_id') for e in hasil['item']}
    nama = await _nama_pengguna(db, ids)
    hasil['item'] = [entri_tampil(e, nama) for e in hasil['item']]
    return hasil


AKSI_LEMBAR = ('penilaian_mulai', 'penilaian_buka', 'penilaian_draf', 'penilaian_kirim')


async def riwayat_aksi_guru(db, guru_id: str, periode_id: Optional[str] = None, batas: int = 200) -> List[Dict[str, Any]]:
    """Aksi lembar penilaian satu guru oleh penilainya (terbaru dulu); opsional satu periode."""
    q: Dict[str, Any] = {'guru_id': guru_id, 'aksi': {'$in': list(AKSI_LEMBAR)}}
    if periode_id:
        q['periode_id'] = periode_id
    docs = await db[KOLEKSI_AUDIT].find(q, {'_id': 0}).sort([('waktu_urut', -1), ('id', 1)]).limit(batas).to_list(batas)
    return [{
        'id': d.get('id'), 'aksi': d.get('aksi'), 'label': LABEL_AKSI.get(d.get('aksi'), d.get('aksi')),
        'aktor_nama': d.get('aktor_nama'), 'timestamp': d.get('timestamp'), 'terakhir': d.get('terakhir'),
        'jumlah': d.get('jumlah'), 'penilaian_id': d.get('penilaian_id'), 'periode_id': d.get('periode_id'),
        'progres': (d.get('metadata') or {}).get('progres'), 'nilai_akhir': (d.get('metadata') or {}).get('nilai_akhir'),
    } for d in docs]
