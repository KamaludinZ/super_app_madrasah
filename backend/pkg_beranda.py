"""Data Beranda PKG: ringkasan kinerja, daftar tugas penilaian, pintasan menu sesuai akses, dan pengingat tenggat
(juga disajikan sebagai notifikasi sintetis source 'pkg' di GET /notifications)."""
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from pkg_akses import KOLEKSI_PENILAIAN, KOLEKSI_PENUGASAN, PERAN_KEPALA, alasan_tolak

# Urutan kemajuan status penilaian; bila satu guru punya beberapa lembar, yang paling maju dipakai.
URUTAN_STATUS = {'draf': 1, 'terkunci': 2}


async def ringkasan_kinerja(db, sk: Optional[Dict[str, Any]]) -> Dict[str, int]:
    """Jumlah guru dinilai pada SK aktif: sudah dinilai (terkunci), sedang (draf), belum dimulai.
    Kepala madrasah tidak dihitung sebagai objek penilaian."""
    if not sk:
        return {'total': 0, 'selesai': 0, 'sedang': 0, 'belum': 0}
    dinilai = list(dict.fromkeys(sk.get('dinilai_ids') or []))
    kepala = {u['id'] for u in await db.users.find(
        {'id': {'$in': dinilai}, 'roles': PERAN_KEPALA}, {'_id': 0, 'id': 1}).to_list(len(dinilai) or 1)}
    dinilai = [g for g in dinilai if g not in kepala]
    lembar = await db[KOLEKSI_PENILAIAN].find(
        {'sk_id': sk['id'], 'guru_dinilai_id': {'$in': dinilai}},
        {'_id': 0, 'guru_dinilai_id': 1, 'status': 1},
    ).to_list(len(dinilai) * 5 or 1)
    status_guru: Dict[str, int] = {}
    for p in lembar:
        tingkat = URUTAN_STATUS.get(p.get('status'), 0)
        status_guru[p['guru_dinilai_id']] = max(tingkat, status_guru.get(p['guru_dinilai_id'], 0))
    selesai = sum(1 for t in status_guru.values() if t == URUTAN_STATUS['terkunci'])
    sedang = sum(1 for t in status_guru.values() if t == URUTAN_STATUS['draf'])
    return {'total': len(dinilai), 'selesai': selesai, 'sedang': sedang, 'belum': len(dinilai) - selesai - sedang}


# Urutan tampil tugas: yang sedang dikerjakan dulu, lalu belum dimulai, terakhir yang sudah terkunci.
URUTAN_TAMPIL_TUGAS = {'draf': 0, 'belum': 1, 'terkunci': 2}


def _progres(lembar: Optional[Dict[str, Any]]) -> int:
    if not lembar:
        return 0
    if lembar.get('status') == 'terkunci':
        return 100
    try:
        return max(0, min(100, int(lembar.get('progres') or 0)))
    except (TypeError, ValueError):
        return 0


async def tugas_penilaian_saya(db, user: Dict[str, Any], periode: Optional[Dict[str, Any]],
                               sk: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Guru yang dibagikan kepala madrasah kepada pengguna (penilai) pada periode berjalan.
    Item: {id (guru), penilaian_id, nama, nip, mapel, status ('belum'|'draf'|'terkunci'), progres, updated_at}."""
    if not periode or not sk:
        return []
    uid = user.get('id')
    penugasan = await db[KOLEKSI_PENUGASAN].find_one({'periode_id': periode['id'], 'penilai_id': uid}, {'_id': 0})
    if not penugasan:
        return []
    # Penilai tidak menilai dirinya sendiri walau merangkap sebagai guru yang dinilai.
    ids = [g for g in dict.fromkeys(penugasan.get('guru_dinilai_ids') or []) if g and g != uid]
    if not ids:
        return []

    lembar_list = await db[KOLEKSI_PENILAIAN].find(
        {'sk_id': sk['id'], 'penilai_id': uid, 'guru_dinilai_id': {'$in': ids}},
        {'_id': 0, 'id': 1, 'guru_dinilai_id': 1, 'status': 1, 'progres': 1, 'updated_at': 1},
    ).to_list(len(ids) * 5)
    lembar_guru: Dict[str, Dict[str, Any]] = {}
    for p in lembar_list:
        lama = lembar_guru.get(p['guru_dinilai_id'])
        if not lama or URUTAN_STATUS.get(p.get('status'), 0) > URUTAN_STATUS.get(lama.get('status'), 0):
            lembar_guru[p['guru_dinilai_id']] = p

    snapshot = penugasan.get('snapshot_guru') or {}
    akun = {u['id']: u for u in await db.users.find(
        {'id': {'$in': ids}}, {'_id': 0, 'id': 1, 'full_name': 1, 'nip_nuptk': 1}).to_list(len(ids))}

    hasil = []
    for gid in ids:
        snap = snapshot.get(gid) or {}
        u = akun.get(gid) or {}
        lembar = lembar_guru.get(gid)
        status = lembar.get('status') if lembar and lembar.get('status') in URUTAN_STATUS else 'belum'
        hasil.append({
            'id': gid,
            'penilaian_id': (lembar or {}).get('id'),
            'nama': snap.get('nama') or u.get('full_name') or '(akun tidak ditemukan)',
            'nip': snap.get('nip') or u.get('nip_nuptk'),
            'mapel': snap.get('mapel'),
            'status': status,
            'progres': _progres(lembar),
            'updated_at': (lembar or {}).get('updated_at'),
        })
    hasil.sort(key=lambda t: (URUTAN_TAMPIL_TUGAS[t['status']], (t['nama'] or '').lower()))
    return hasil


# Sembilan sub-menu PKG beserta syarat aksesnya (lihat pkg_akses.SYARAT_AKSES). Instrumen dibaca semua anggota;
# rekap dibatasi per peran di halamannya.
MENU_PKG = [
    ('periode', 'Periode PKG', 'Tetapkan periode penilaian', '/pkg/periode', 'kepala'),
    ('sk', 'SK & Tim Penilai', 'Data SK dan anggota', '/pkg/sk', 'kepala'),
    ('penugasan', 'Pembagian Jatah', 'Penilai → guru dinilai', '/pkg/penugasan', 'kepala'),
    ('supervisi', 'Supervisi Penilai', 'Tandai penilai tersupervisi', '/pkg/supervisi', 'kepala'),
    ('instrumen', 'Master Instrumen', 'Kompetensi & indikator', '/pkg/instrumen', 'anggota'),
    ('penilaian', 'Penilaian Kinerja', 'Isi lembar penilaian', '/pkg/penilaian', 'penilai'),
    ('komponen', 'Komponen 360° & Kehadiran', 'Angket 360°, kehadiran & rekomendasi PKB', '/pkg/komponen', 'pengelola'),
    ('rekap', 'Rekap Hasil', 'Nilai akhir & predikat', '/pkg/rekap', 'anggota'),
    ('cetak', 'Cetak Excel & PDF', 'Unduh dokumen resmi', '/pkg/cetak', 'pengelola'),
    ('audit', 'Jejak Audit', 'Riwayat aksi PKG', '/pkg/audit', 'kepala'),
]


def menu_pkg(keanggotaan: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Pintasan sepuluh menu PKG untuk pengguna: {key, label, keterangan, to, khusus, akses, alasan}."""
    hasil = []
    for key, label, keterangan, to, syarat in MENU_PKG:
        alasan = alasan_tolak(keanggotaan, syarat)
        hasil.append({
            'key': key, 'label': label, 'keterangan': keterangan, 'to': to,
            'khusus': 'kepala' if syarat == 'kepala' else None,
            'akses': alasan is None, 'alasan': alasan,
        })
    return hasil


WIB = timezone(timedelta(hours=7))
# Pengingat bertanggal masuk lonceng notifikasi bila tenggatnya 0–14 hari lagi.
JENDELA_LONCENG_HARI = 14


def _sisa_hari(tanggal: Optional[str], hari_ini: date) -> Optional[int]:
    try:
        return (date.fromisoformat(str(tanggal)[:10]) - hari_ini).days
    except (TypeError, ValueError):
        return None


async def pengingat_pkg(db, user: Dict[str, Any], keanggotaan: Dict[str, Any], periode: Optional[Dict[str, Any]],
                        sk: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Pengingat Beranda PKG: [{id, jenis ('tenggat'|'supervisi'), judul, tanggal|None, keterangan}].
    - tenggat: tanggal tutup periode bila masih ada lembar belum terkunci (milik penilai; seluruh SK untuk kepala)
    - supervisi: penilai yang belum disupervisi kepala madrasah"""
    if not keanggotaan.get('anggota') or not periode or not sk:
        return []
    hasil = []
    if keanggotaan.get('sebagai_penilai') and not keanggotaan.get('supervisi_selesai'):
        hasil.append({
            'id': f"supervisi_{periode['id']}", 'jenis': 'supervisi', 'judul': 'Menunggu supervisi penilai',
            'tanggal': None,
            'keterangan': 'Lembar penilaian dapat dibuka setelah kepala madrasah mencatat supervisi Anda.',
        })
    if keanggotaan.get('sebagai_penilai') and periode.get('tanggal_tutup'):
        if keanggotaan.get('peran') == 'kepala':
            r = await ringkasan_kinerja(db, sk)
            sisa_lembar, kepada = r['belum'] + r['sedang'], 'guru pada SK ini'
        else:
            tugas = await tugas_penilaian_saya(db, user, periode, sk)
            sisa_lembar, kepada = sum(1 for t in tugas if t['status'] != 'terkunci'), 'guru yang dibagikan kepada Anda'
        if sisa_lembar:
            hasil.append({
                'id': f"tenggat_{periode['id']}", 'jenis': 'tenggat', 'judul': 'Penilaian ditutup',
                'tanggal': periode['tanggal_tutup'],
                'keterangan': f'{sisa_lembar} {kepada} belum dikirim & dikunci.',
            })
    return hasil


def pengingat_ke_notifikasi(pengingat: List[Dict[str, Any]], hari_ini: Optional[date] = None) -> List[Dict[str, Any]]:
    """Ubah pengingat menjadi item GET /notifications (source 'pkg', sintetis: selalu belum dibaca)."""
    hari_ini = hari_ini or datetime.now(WIB).date()
    sekarang = datetime.now(timezone.utc).isoformat()
    hasil = []
    for p in pengingat:
        sisa = _sisa_hari(p.get('tanggal'), hari_ini)
        if p.get('tanggal'):
            if sisa is None or sisa < 0 or sisa > JENDELA_LONCENG_HARI:
                continue
            keparahan = 'critical' if sisa <= 3 else 'warning' if sisa <= 7 else 'info'
            judul = f"PKG: {p['judul']} — {'hari ini' if sisa == 0 else f'{sisa} hari lagi'}"
            isi = f"Tenggat {date.fromisoformat(p['tanggal'][:10]).strftime('%d-%m-%Y')}. {p['keterangan']}"
        else:
            keparahan, judul, isi = 'warning', f"PKG: {p['judul']}", p['keterangan']
        hasil.append({
            'id': f"pkg_{p['id']}", 'source': 'pkg', 'source_id': p['id'],
            'title': judul, 'body': isi, 'severity': keparahan,
            'is_pinned': False, 'is_read': False, 'created_at': sekarang,
            'link': '/pkg', 'icon': 'calendar-clock',
        })
    return hasil


async def notifikasi_pkg(db, user: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Notifikasi pengingat PKG untuk lonceng; kosong bagi non-anggota SK aktif."""
    from pkg_akses import keanggotaan_sk, sk_aktif
    k = await keanggotaan_sk(db, user)
    if not k['anggota']:
        return []
    periode, sk = await sk_aktif(db)
    return pengingat_ke_notifikasi(await pengingat_pkg(db, user, k, periode, sk))
