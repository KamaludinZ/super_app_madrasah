"""Service rekap hasil penilaian PKG: materialisasi hasil akhir lembar terkunci ke koleksi pkg_rekap.

Satu baris per lembar terkunci (id = penilaian_id). Ditulis saat lembar dikirim & dikunci, dan dapat dibangun ulang
dari pkg_penilaian (migrasi). Nilai mengikuti rumus template resmi (pkg_nilai); subtotal per kompetensi dihitung
dari skor_per_indikator lembar terhadap instrumen versi lembar.
"""
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from pkg_nilai import hitung_nilai
from pkg_skema import KOLEKSI_INSTRUMEN, KOLEKSI_PENILAIAN, KOLEKSI_REKAP, KOLEKSI_SK


def per_kompetensi(instrumen: Dict[str, Any], skor: Dict[str, int]) -> Dict[str, int]:
    return {k['kode']: sum(int(skor.get(s['kode']) or 0) for s in k.get('sub') or []) for k in instrumen.get('kompetensi') or []}


async def _nama_penilai(db, penilai_id: Optional[str], sk: Optional[Dict[str, Any]]) -> Optional[str]:
    snap = ((sk or {}).get('snapshot_anggota') or {}).get(penilai_id) or {}
    if snap.get('nama'):
        return snap['nama']
    akun = await db.users.find_one({'id': penilai_id}, {'_id': 0, 'full_name': 1}) if penilai_id else None
    return (akun or {}).get('full_name')


async def baris_rekap(db, lembar: Dict[str, Any], instrumen: Optional[Dict[str, Any]] = None,
                      sk: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    """Baris rekap dari lembar terkunci; None bila lembar belum terkunci atau instrumennya tidak ditemukan."""
    if lembar.get('status') != 'terkunci':
        return None
    instrumen = instrumen or await db[KOLEKSI_INSTRUMEN].find_one({'id': lembar.get('instrumen_id')}, {'_id': 0})
    if not instrumen:
        return None
    sk = sk or await db[KOLEKSI_SK].find_one({'id': lembar.get('sk_id')}, {'_id': 0})
    nilai = hitung_nilai(instrumen, lembar.get('isian') or {})
    snap = lembar.get('snapshot_guru') or {}
    return {
        'id': lembar['id'], 'periode_id': lembar.get('periode_id'), 'sk_id': lembar.get('sk_id'),
        'guru_id': lembar.get('guru_dinilai_id'), 'penilai_id': lembar.get('penilai_id'),
        'nama': snap.get('nama'), 'nip': snap.get('nip'), 'mapel': snap.get('mapel'),
        'penilai_nama': await _nama_penilai(db, lembar.get('penilai_id'), sk),
        'instrumen_id': instrumen.get('id'), 'versi_template': instrumen.get('versi_template'), 'revisi': instrumen.get('revisi'),
        'nilai_akhir': nilai['nilai_akhir'], 'nilai_maks': nilai['nilai_maks'], 'capaian_persen': nilai['capaian_persen'],
        'level_capaian': nilai['level_capaian'], 'predikat': nilai['predikat'],
        'per_kompetensi': per_kompetensi(instrumen, nilai['skor_per_indikator']),
        'catatan_umum': lembar.get('catatan_umum') or '',
        'terkunci_pada': lembar.get('terkunci_pada'), 'dihitung_pada': datetime.now(timezone.utc).isoformat(),
    }


async def simpan_rekap_lembar(db, lembar: Dict[str, Any], instrumen: Optional[Dict[str, Any]] = None,
                              sk: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    """Tulis/perbarui baris rekap untuk satu lembar terkunci (idempoten)."""
    baris = await baris_rekap(db, lembar, instrumen, sk)
    if baris:
        await db[KOLEKSI_REKAP].update_one({'id': baris['id']}, {'$set': baris}, upsert=True)
    return baris


async def bangun_ulang_rekap(db, periode_id: Optional[str] = None) -> Dict[str, int]:
    """Bangun ulang baris rekap dari seluruh lembar terkunci (opsional satu periode). Baris tanpa lembar terkunci
    yang sah dihapus. Hasil: jumlah diproses, ditulis, dilewati (instrumen hilang), dan dihapus."""
    saring = {'status': 'terkunci', **({'periode_id': periode_id} if periode_id else {})}
    lembar = await db[KOLEKSI_PENILAIAN].find(saring, {'_id': 0}).to_list(100000)
    instrumen = {d['id']: d for d in await db[KOLEKSI_INSTRUMEN].find({}, {'_id': 0}).to_list(1000)}
    sk = {d['id']: d for d in await db[KOLEKSI_SK].find({}, {'_id': 0}).to_list(1000)}
    ditulis, dilewati, sah = 0, 0, set()
    for lb in lembar:
        baris = await simpan_rekap_lembar(db, lb, instrumen.get(lb.get('instrumen_id')), sk.get(lb.get('sk_id')))
        if baris:
            ditulis += 1
            sah.add(baris['id'])
        else:
            dilewati += 1
    lama = await db[KOLEKSI_REKAP].find({**({'periode_id': periode_id} if periode_id else {})}, {'_id': 0, 'id': 1}).to_list(100000)
    yatim = [d['id'] for d in lama if d['id'] not in sah]
    for i in yatim:
        await db[KOLEKSI_REKAP].delete_one({'id': i})
    return {'diproses': len(lembar), 'ditulis': ditulis, 'dilewati': dilewati, 'dihapus': len(yatim)}


# ---------------------------------------------------------------- agregasi rekap per periode

URUTAN_PREDIKAT = [
    ('Terpenuhi pada Jenjang Jabatan Guru Ahli Pertama', 'Ahli Pertama'),
    ('Terpenuhi pada Jenjang Jabatan Guru Ahli Muda', 'Ahli Muda'),
    ('Terpenuhi pada Jenjang Jabatan Guru Ahli Madya', 'Ahli Madya'),
    ('Terpenuhi pada Jenjang Jabatan Guru Ahli Utama', 'Ahli Utama'),
]
URUTAN_LEVEL = ('Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5')
KUNCI_NILAI = ('nilai_akhir', 'nilai_maks', 'capaian_persen', 'level_capaian', 'predikat', 'terkunci_pada')


def _bulat2(n: float) -> float:
    return round(n, 2)


def hitung_statistik(baris: list) -> Dict[str, Any]:
    """Statistik capaian dari baris terkunci: rata-rata, median, tertinggi, terendah, sebaran predikat & level
    (semua kelas selalu ada, berurutan)."""
    nilai = [b for b in baris if b.get('status') == 'terkunci' and b.get('capaian_persen') is not None]
    capaian = sorted(b['capaian_persen'] for b in nilai)
    n = len(capaian)
    median = (capaian[(n - 1) // 2] if n % 2 else (capaian[n // 2 - 1] + capaian[n // 2]) / 2) if n else None
    tinggi = max(nilai, key=lambda b: b['capaian_persen']) if n else None
    rendah = min(nilai, key=lambda b: b['capaian_persen']) if n else None
    return {
        'jumlah': n,
        'rata': _bulat2(sum(capaian) / n) if n else None,
        'median': _bulat2(median) if median is not None else None,
        'tertinggi': {'nilai': tinggi['capaian_persen'], 'nama': tinggi.get('nama'), 'guru_id': tinggi.get('guru_id')} if tinggi else None,
        'terendah': {'nilai': rendah['capaian_persen'], 'nama': rendah.get('nama'), 'guru_id': rendah.get('guru_id')} if rendah else None,
        'sebaran_predikat': [{'predikat': p, 'label': label, 'jumlah': (j := sum(1 for b in nilai if b.get('predikat') == p)),
                              'persen': _bulat2(j / n * 100) if n else 0.0} for p, label in URUTAN_PREDIKAT],
        'sebaran_level': [{'level': lv, 'jumlah': sum(1 for b in nilai if b.get('level_capaian') == lv)} for lv in URUTAN_LEVEL],
    }


async def agregasi_rekap(db, periode: Dict[str, Any], sk: Optional[Dict[str, Any]],
                         saring_guru: Optional[set] = None, hanya_terkunci: bool = False) -> Dict[str, Any]:
    """Rekap satu periode: seluruh guru yang dinilai pada SK periode (status belum/draf/terkunci) digabung dengan
    hasil akhir dari pkg_rekap (termasuk data historis guru yang sudah tidak tercantum di SK).
    `saring_guru` membatasi cakupan; `hanya_terkunci` hanya menyertakan lembar terkunci (cakupan pribadi).
    Hasil: {ringkasan, statistik, guru: [baris]} — baris sesuai kontrak frontend lib/pkgRekap."""
    hasil_akhir = {d['guru_id']: d for d in await db[KOLEKSI_REKAP].find({'periode_id': periode['id']}, {'_id': 0}).to_list(100000)}
    status_lembar, penilai_lembar = {}, {}
    if sk:
        for d in await db[KOLEKSI_PENILAIAN].find({'sk_id': sk['id']}, {'_id': 0, 'guru_dinilai_id': 1, 'status': 1, 'penilai_id': 1}).to_list(100000):
            status_lembar[d['guru_dinilai_id']] = d.get('status')
            penilai_lembar[d['guru_dinilai_id']] = d.get('penilai_id')
    from pkg_skema import KOLEKSI_PENUGASAN
    penilai_guru = {}
    for t in await db[KOLEKSI_PENUGASAN].find({'periode_id': periode['id']}, {'_id': 0}).to_list(1000):
        for g in t.get('guru_dinilai_ids') or []:
            penilai_guru[g] = t['penilai_id']
    snap = (sk or {}).get('snapshot_anggota') or {}
    akun = {}
    ids = list(dict.fromkeys([*((sk or {}).get('dinilai_ids') or []), *hasil_akhir]))
    if ids:
        akun = {u['id']: u for u in await db.users.find({'id': {'$in': ids}}, {'_id': 0, 'id': 1, 'full_name': 1, 'nip_nuptk': 1}).to_list(len(ids))}

    def nama_dari(uid):
        return (snap.get(uid) or {}).get('nama') or (akun.get(uid) or {}).get('full_name')

    baris = []
    for gid in ids:
        if saring_guru is not None and gid not in saring_guru:
            continue
        r = hasil_akhir.get(gid)
        status = 'terkunci' if r else (status_lembar.get(gid) or 'belum')
        if hanya_terkunci and status != 'terkunci':
            continue
        s = snap.get(gid) or {}
        pid = (r or {}).get('penilai_id') or penilai_lembar.get(gid) or penilai_guru.get(gid)
        baris.append({
            'guru_id': gid,
            'nama': (r or {}).get('nama') or s.get('nama') or (akun.get(gid) or {}).get('full_name') or '(akun tidak ditemukan)',
            'nip': (r or {}).get('nip') or s.get('nip') or (akun.get(gid) or {}).get('nip_nuptk'),
            'mapel': (r or {}).get('mapel') or s.get('mapel'),
            'penilai_id': pid,
            'penilai_nama': (r or {}).get('penilai_nama') or (nama_dari(pid) if pid else None),
            'status': status,
            **{k: (r or {}).get(k) for k in KUNCI_NILAI},
            'per_kompetensi': (r or {}).get('per_kompetensi') or {},
        })
    baris.sort(key=lambda b: (b['nama'] or '').lower())
    terkunci = [b for b in baris if b['status'] == 'terkunci']
    statistik = hitung_statistik(baris)
    return {
        'ringkasan': {
            'total': len(baris), 'terkunci': len(terkunci),
            'draf': sum(1 for b in baris if b['status'] == 'draf'),
            'belum': sum(1 for b in baris if b['status'] == 'belum'),
            'rata_capaian': statistik['rata'],
        },
        'statistik': statistik,
        'guru': baris,
    }
