"""Asal input jurnal mengajar: "Jurnal Presisi" (isi jurnal tepat waktu lewat scan QR / token kelas, termasuk alur
lama lain) atau "Catat Jurnal" (tombol isi jurnal di luar jam untuk guru yang terlambat mengisi).

Catat Jurnal hanya untuk jadwal guru itu sendiri pada HARI INI, terbuka setelah jam pelajaran selesai ditambah
toleransi (grace_minutes pengaturan sekolah — saat itu scan QR sudah tidak diterima) dan berakhir pukul 24.00 WIB.
Jurnal tersimpan seperti jurnal biasa (koleksi journals) dengan `asal_input: 'catat_jurnal'`; dokumen tanpa field
ini dianggap Jurnal Presisi. Monitoring publik tidak membedakan asal input (tetap "Jurnal Terisi").
"""
from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional

from journal_core import month_started_at_filter

ASAL_PRESISI = 'jurnal_presisi'
ASAL_CATAT = 'catat_jurnal'
LABEL_ASAL_INPUT = {ASAL_PRESISI: 'Jurnal Presisi', ASAL_CATAT: 'Catat Jurnal'}


def asal_input_jurnal(jurnal: Dict[str, Any]) -> str:
    """Kode asal input sebuah jurnal; selain Catat Jurnal (termasuk data lama) dihitung Jurnal Presisi."""
    return ASAL_CATAT if (jurnal or {}).get('asal_input') == ASAL_CATAT else ASAL_PRESISI


def tandai_asal_input(jurnal: Dict[str, Any]) -> Dict[str, Any]:
    """Tambahkan `asal_input` & `asal_input_label` ke jurnal untuk ditampilkan (kolom Asal Input riwayat)."""
    kode = asal_input_jurnal(jurnal)
    jurnal['asal_input'] = kode
    jurnal['asal_input_label'] = LABEL_ASAL_INPUT[kode]
    return jurnal


def jendela_catat_jurnal(jadwal: Dict[str, Any], sekarang: datetime, grace_minutes: int) -> Dict[str, Any]:
    """Jendela Catat Jurnal satu jadwal pada tanggal `sekarang` (WIB):
    {tersedia, dibuka_pada, berakhir_pada, alasan}. Dibuka setelah jam selesai + toleransi, berakhir 24.00 WIB."""
    try:
        jam, menit = map(int, str(jadwal.get('end_time') or '').split(':'))
        selesai = sekarang.replace(hour=jam, minute=menit, second=0, microsecond=0)
    except ValueError:
        return {'tersedia': False, 'dibuka_pada': None, 'berakhir_pada': None, 'alasan': 'Jam selesai jadwal tidak valid'}
    dibuka = selesai + timedelta(minutes=max(int(grace_minutes or 0), 0))
    berakhir = sekarang.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    alasan: Optional[str] = None
    if sekarang <= dibuka:
        alasan = f"Catat Jurnal tersedia setelah jam pelajaran selesai ({dibuka.strftime('%H:%M')} WIB); sebelum itu isi jurnal lewat scan QR"
    elif sekarang >= berakhir:
        alasan = 'Batas Catat Jurnal sudah lewat (pukul 24.00 WIB)'
    return {'tersedia': alasan is None, 'dibuka_pada': dibuka.isoformat(), 'berakhir_pada': berakhir.isoformat(), 'alasan': alasan}


# ---------------------------------------------------------------- rekap bulanan per guru (dashboard kepala madrasah)

NAMA_BULAN = ('Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober',
              'November', 'Desember')
# Jurnal yang diisi pihak lain atas slot guru tidak dihitung sebagai pengisian guru itu sendiri.
FILL_MODE_BUKAN_GURU = ('substitute', 'piket', 'admin')


def pipeline_asal_input(tahun: int, bulan: int) -> List[Dict[str, Any]]:
    """Agregasi koleksi journals: jumlah jurnal per teacher_id pada bulan WIB itu, total & Catat Jurnal."""
    return [
        {'$match': {'$and': [month_started_at_filter(tahun, bulan), {'fill_mode': {'$nin': list(FILL_MODE_BUKAN_GURU)}}]}},
        {'$group': {'_id': '$teacher_id', 'total': {'$sum': 1},
                    ASAL_CATAT: {'$sum': {'$cond': [{'$eq': ['$asal_input', ASAL_CATAT]}, 1, 0]}}}},
    ]


def susun_rekap_asal_input(tahun: int, bulan: int, hasil: Iterable[Dict[str, Any]], berjadwal: Iterable[str],
                           nama: Dict[str, str]) -> Dict[str, Any]:
    """Bentuk respons rekap: setiap guru berjadwal (nilai 0 bila belum mengisi) dan guru lain yang punya jurnal,
    urut total terbanyak lalu nama; {bulan, label, label_asal_input, guru: [...], total}."""
    per_guru = {r['_id']: r for r in hasil if r.get('_id')}
    guru = []
    for tid in set(berjadwal) | set(per_guru):
        r = per_guru.get(tid) or {}
        total, catat = int(r.get('total', 0)), int(r.get(ASAL_CATAT, 0))
        guru.append({'teacher_id': tid, 'teacher_name': nama.get(tid) or '(akun tidak ditemukan)',
                     ASAL_PRESISI: total - catat, ASAL_CATAT: catat, 'total': total})
    guru.sort(key=lambda g: (-g['total'], g['teacher_name'].lower()))
    return {
        'bulan': f'{tahun:04d}-{bulan:02d}', 'label': f'{NAMA_BULAN[bulan - 1]} {tahun}',
        'label_asal_input': LABEL_ASAL_INPUT, 'guru': guru,
        'total': {k: sum(g[k] for g in guru) for k in (ASAL_PRESISI, ASAL_CATAT, 'total')},
    }
