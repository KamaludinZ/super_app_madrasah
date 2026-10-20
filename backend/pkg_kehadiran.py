"""Komponen kehadiran PKG (sheet INDEK-HDIR template resmi) — rekap manual per guru per periode oleh kepala madrasah
atau tim penilai.

Per bulan (baris 16–27 sheet, maks. 12 bulan):
    jumlah menit       = terlambat + pulang cepat                      (F = D + E)
    konversi (hari)    = jumlah menit / (8 x 60)                        (G)
    jumlah tidak hadir = konversi + tanpa keterangan (hari)             (I = G + H)
    persen tidak hadir = jumlah tidak hadir / 46 ; hadir = 1 - persen   (J, K)
Indeks persentase kehadiran (K29) = 1 - (jumlah tidak hadir seluruh bulan / 46); dipakai sebagai pengali nilai akhir
PK Guru (05-RKAP-PKGR!E42:E43). Hadir, izin, dan sakit (hari) disimpan sebagai informasi pendukung — template tidak
memasukkannya ke rumus. Tanpa data, seluruh nilai 0 sehingga indeks = 100% (sama dengan template kosong).
"""
import uuid
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from pkg_ambang import MENIT_PER_HARI, PEMBAGI_HARI_KEHADIRAN
from pkg_skema import KOLEKSI_KEHADIRAN

BULAN = ('Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November',
         'Desember')
KOLOM_BULAN = ('terlambat_menit', 'pulang_cepat_menit', 'tanpa_keterangan', 'hadir', 'izin', 'sakit')
MAKS_BULAN = 12  # baris bulan pada sheet INDEK-HDIR


def bulan_periode(periode: Dict[str, Any]) -> List[str]:
    """Bulan (YYYY-MM) dari tanggal buka s.d. tanggal tutup periode, maks. 12 bulan pertama."""
    try:
        awal = date.fromisoformat(str(periode.get('tanggal_buka'))[:10])
        akhir = date.fromisoformat(str(periode.get('tanggal_tutup'))[:10])
    except ValueError:
        return []
    hasil, th, bl = [], awal.year, awal.month
    while (th, bl) <= (akhir.year, akhir.month) and len(hasil) < MAKS_BULAN:
        hasil.append(f'{th:04d}-{bl:02d}')
        th, bl = (th + 1, 1) if bl == 12 else (th, bl + 1)
    return hasil


def label_bulan(kode: str) -> str:
    th, bl = kode.split('-')
    return f'{BULAN[int(bl) - 1]} {th}'


def hitung_bulan(baris: Dict[str, Any]) -> Dict[str, Any]:
    menit = int(baris.get('terlambat_menit') or 0) + int(baris.get('pulang_cepat_menit') or 0)
    konversi = menit / MENIT_PER_HARI
    tidak_hadir = konversi + float(baris.get('tanpa_keterangan') or 0)
    persen = tidak_hadir / PEMBAGI_HARI_KEHADIRAN
    return {'jumlah_menit': menit, 'konversi_hari': konversi, 'jumlah_tidak_hadir': tidak_hadir,
            'persen_tidak_hadir': persen, 'persen_hadir': 1 - persen}


def hitung_kehadiran(baris: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Rekap INDEK-HDIR: hasil per bulan, jumlah (baris 28), ketidakhadiran tanpa keterangan (05-RKAP-PKGR!E41 =
    I28, jumlah tidak hadir termasuk konversi menit), dan indeks persentase kehadiran (K29)."""
    per_bulan = [{**b, **hitung_bulan(b)} for b in baris]
    jumlah = {k: sum(int(b.get(k) or 0) for b in baris) for k in KOLOM_BULAN}
    tidak_hadir = sum(b['jumlah_tidak_hadir'] for b in per_bulan)
    indeks = 1 - tidak_hadir / PEMBAGI_HARI_KEHADIRAN
    return {
        'bulan': per_bulan, 'jumlah': {**jumlah, 'jumlah_menit': sum(b['jumlah_menit'] for b in per_bulan),
                                       'konversi_hari': sum(b['konversi_hari'] for b in per_bulan),
                                       'jumlah_tidak_hadir': tidak_hadir},
        'indeks': indeks, 'indeks_persen': round(indeks * 100, 2),
    }


def baris_lengkap(periode: Dict[str, Any], tersimpan: Optional[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    """Semua bulan periode (urut) digabung data tersimpan; bulan tanpa data bernilai 0."""
    ada = {b['bulan']: b for b in tersimpan or []}
    return [{'bulan': k, 'label': label_bulan(k), **{c: int((ada.get(k) or {}).get(c) or 0) for c in KOLOM_BULAN}}
            for k in bulan_periode(periode)]


async def kehadiran_guru(db, periode: Dict[str, Any], guru_id: str) -> Dict[str, Any]:
    doc = await db[KOLEKSI_KEHADIRAN].find_one({'periode_id': periode['id'], 'guru_dinilai_id': guru_id}, {'_id': 0})
    baris = baris_lengkap(periode, (doc or {}).get('bulan'))
    return {'terisi': bool(doc), 'diinput_oleh_nama': (doc or {}).get('diinput_oleh_nama'),
            'diubah_pada': (doc or {}).get('diubah_pada'), **hitung_kehadiran(baris)}


async def kehadiran_periode(db, periode: Dict[str, Any], guru_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """Ringkasan kehadiran banyak guru: {guru_id: {terisi, indeks, indeks_persen, jumlah}}."""
    docs = {d['guru_dinilai_id']: d for d in await db[KOLEKSI_KEHADIRAN].find(
        {'periode_id': periode['id'], 'guru_dinilai_id': {'$in': list(guru_ids)}}, {'_id': 0}).to_list(10000)}
    hasil = {}
    for gid in guru_ids:
        h = hitung_kehadiran(baris_lengkap(periode, (docs.get(gid) or {}).get('bulan')))
        hasil[gid] = {'terisi': gid in docs, 'indeks': h['indeks'], 'indeks_persen': h['indeks_persen'], 'jumlah': h['jumlah']}
    return hasil


async def simpan_kehadiran(db, periode: Dict[str, Any], guru_id: str, bulan: List[Dict[str, Any]],
                           aktor: Dict[str, Any]) -> Dict[str, Any]:
    """Simpan (ganti) rekap kehadiran satu guru. Bulan harus termasuk periode & tidak berulang (ValueError)."""
    sah = set(bulan_periode(periode))
    kode = [b['bulan'] for b in bulan]
    if len(set(kode)) != len(kode):
        raise ValueError('Bulan kehadiran tidak boleh berulang.')
    luar = [k for k in kode if k not in sah]
    if luar:
        raise ValueError(f"Bulan {', '.join(luar)} di luar rentang periode.")
    sekarang = datetime.now(timezone.utc).isoformat()
    lama = await db[KOLEKSI_KEHADIRAN].find_one({'periode_id': periode['id'], 'guru_dinilai_id': guru_id}, {'_id': 0})
    isi = {'bulan': [{'bulan': b['bulan'], **{c: int(b.get(c) or 0) for c in KOLOM_BULAN}} for b in sorted(bulan, key=lambda x: x['bulan'])],
           'diinput_oleh': aktor.get('id'), 'diinput_oleh_nama': aktor.get('full_name'), 'diubah_pada': sekarang}
    if lama:
        await db[KOLEKSI_KEHADIRAN].update_one({'id': lama['id']}, {'$set': isi})
    else:
        await db[KOLEKSI_KEHADIRAN].insert_one({'id': str(uuid.uuid4()), 'periode_id': periode['id'], 'guru_dinilai_id': guru_id,
                                                'tanggal_input': sekarang, **isi})
    return {'sebelum': hitung_kehadiran(baris_lengkap(periode, (lama or {}).get('bulan')))['indeks_persen'] if lama else None,
            **await kehadiran_guru(db, periode, guru_id)}
