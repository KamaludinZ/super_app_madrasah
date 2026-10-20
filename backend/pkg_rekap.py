"""Service rekap hasil penilaian PKG: materialisasi hasil akhir lembar terkunci ke koleksi pkg_rekap.

Satu baris per lembar terkunci (id = penilaian_id). Ditulis saat lembar dikirim & dikunci, dan dapat dibangun ulang
dari pkg_penilaian (migrasi). Nilai mengikuti rumus template resmi (pkg_nilai); subtotal per kompetensi dihitung
dari skor_per_indikator lembar terhadap instrumen versi lembar.
"""
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from pkg_nilai import hitung_nilai, level_guru, rekap_model_kompetensi
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


# ---------------------------------------------------------------- periode, cakupan, rincian per guru

async def daftar_periode_rekap(db, tahun_pelajaran: Optional[str] = None, semester: Optional[str] = None) -> list:
    """Periode untuk saringan rekap (terbaru dulu), opsional per tahun pelajaran & semester. Periode draf tidak
    disertakan karena belum memiliki penilaian."""
    from pkg_skema import KOLEKSI_PERIODE
    saring: Dict[str, Any] = {'status': {'$in': ['berjalan', 'ditutup']}}
    if tahun_pelajaran:
        saring['tahun_pelajaran'] = tahun_pelajaran
    if semester:
        saring['semester'] = semester
    daftar = await db[KOLEKSI_PERIODE].find(saring, {'_id': 0}).to_list(500)
    daftar.sort(key=lambda p: (p.get('tanggal_buka') or '', p.get('created_at') or ''), reverse=True)
    return [{k: p.get(k) for k in ('id', 'nama_periode', 'tahun_pelajaran', 'semester', 'status', 'tanggal_buka', 'tanggal_tutup')}
            for p in daftar]


async def periode_dan_sk(db, periode_id: Optional[str], tahun_pelajaran: Optional[str] = None,
                         semester: Optional[str] = None) -> tuple:
    """(periode, sk) untuk rekap: periode_id terpilih; atau periode terbaru yang cocok dengan tahun pelajaran/semester;
    atau periode berjalan. SK aktif periode itu (bila ada). HTTP 404 bila tidak ada periode yang cocok."""
    from fastapi import HTTPException
    from pkg_skema import KOLEKSI_PERIODE
    if periode_id:
        periode = await db[KOLEKSI_PERIODE].find_one({'id': periode_id}, {'_id': 0})
        if periode and ((tahun_pelajaran and periode.get('tahun_pelajaran') != tahun_pelajaran)
                        or (semester and periode.get('semester') != semester)):
            periode = None
    elif tahun_pelajaran or semester:
        cocok = await daftar_periode_rekap(db, tahun_pelajaran, semester)
        periode = await db[KOLEKSI_PERIODE].find_one({'id': cocok[0]['id']}, {'_id': 0}) if cocok else None
    else:
        periode = await db[KOLEKSI_PERIODE].find_one({'status': 'berjalan'}, {'_id': 0})
    if not periode:
        raise HTTPException(404, 'Periode PKG tidak ditemukan.')
    sk = await db[KOLEKSI_SK].find_one({'periode_id': periode['id'], 'is_active': True}, {'_id': 0})
    return periode, sk


async def cakupan_rekap(db, user: Dict[str, Any], keanggotaan: Dict[str, Any], periode: Dict[str, Any]) -> Dict[str, Any]:
    """Cakupan data rekap pengguna pada periode:
       kepala  -> {'cakupan': 'semua', 'guru': None}
       penilai -> {'cakupan': 'penilai', 'guru': guru yang dibagikan/dinilainya + dirinya (bila juga dinilai)}
       lainnya -> {'cakupan': 'pribadi', 'guru': {dirinya}}  (hanya lembar terkunci)."""
    if keanggotaan.get('peran') == 'kepala':
        return {'cakupan': 'semua', 'guru': None, 'diri': user['id']}
    from pkg_skema import KOLEKSI_PENUGASAN
    tugas = await db[KOLEKSI_PENUGASAN].find_one({'periode_id': periode['id'], 'penilai_id': user['id']}, {'_id': 0}) or {}
    dinilai_olehnya = {d['guru_dinilai_id'] for d in await db[KOLEKSI_PENILAIAN].find(
        {'periode_id': periode['id'], 'penilai_id': user['id']}, {'_id': 0, 'guru_dinilai_id': 1}).to_list(1000)}
    guru = set(tugas.get('guru_dinilai_ids') or []) | dinilai_olehnya
    if guru:
        return {'cakupan': 'penilai', 'guru': guru | {user['id']}, 'diri': user['id']}
    return {'cakupan': 'pribadi', 'guru': {user['id']}, 'diri': user['id']}


def boleh_lihat_guru(cakupan: Dict[str, Any], guru_id: str, terkunci: bool) -> bool:
    """Hasil diri sendiri hanya tampil setelah dikunci; guru lain hanya dalam cakupan."""
    if guru_id == cakupan['diri'] and cakupan['cakupan'] != 'semua':
        return terkunci
    return cakupan['guru'] is None or guru_id in cakupan['guru']


async def rincian_guru(db, periode: Dict[str, Any], sk: Optional[Dict[str, Any]], guru_id: str) -> Optional[Dict[str, Any]]:
    """Rincian rekap satu guru (kontrak frontend lib/pkgRekap.ambilRekapGuru); None bila guru tidak ada di periode."""
    agregat = await agregasi_rekap(db, periode, sk, saring_guru={guru_id})
    if not agregat['guru']:
        return None
    b = agregat['guru'][0]
    lembar = await db[KOLEKSI_PENILAIAN].find_one({'periode_id': periode['id'], 'guru_dinilai_id': guru_id, 'status': 'terkunci'}, {'_id': 0}) \
        if b['status'] == 'terkunci' else None
    instrumen = await db[KOLEKSI_INSTRUMEN].find_one({'id': (lembar or {}).get('instrumen_id')}, {'_id': 0}) if lembar else None
    return {
        'periode': {k: periode.get(k) for k in ('id', 'nama_periode', 'tahun_pelajaran', 'semester', 'status')},
        'guru': {'id': guru_id, 'nama': b['nama'], 'nip': b['nip'], 'mapel': b['mapel']},
        'penilai_nama': b['penilai_nama'],
        'status': b['status'],
        'hasil': {k: b.get(k) for k in KUNCI_NILAI} if b['status'] == 'terkunci' else None,
        'catatan_umum': (lembar or {}).get('catatan_umum') or '',
        'instrumen': {k: instrumen.get(k) for k in ('id', 'versi_template', 'revisi', 'kompetensi')} if instrumen else None,
        'isian': (lembar or {}).get('isian') or {},
    }


async def nilai_akhir_guru(db, periode: Dict[str, Any], guru_id: str, nkg: Optional[float]) -> Dict[str, Any]:
    """Nilai akhir PK Guru dengan 360° & kehadiran (05-RKAP-PKGR) dari NKG lembar terkunci, angket, dan kehadiran."""
    from pkg_angket import skor_360
    from pkg_kehadiran import kehadiran_guru
    from pkg_nilai_akhir import hitung_nilai_akhir
    return hitung_nilai_akhir(nkg, await skor_360(db, periode['id'], guru_id), await kehadiran_guru(db, periode, guru_id))


async def identitas_guru(db, periode: Dict[str, Any], sk: Optional[Dict[str, Any]], guru_id: str) -> Optional[Dict[str, Any]]:
    """Lampiran identitas guru & tim penilai pada periode (pkg_identitas); None bila guru tidak ada di periode."""
    from pkg_identitas import lampiran_identitas
    rincian = await agregasi_rekap(db, periode, sk, saring_guru={guru_id})
    if not rincian['guru']:
        return None
    b = rincian['guru'][0]
    pengaturan = await db.settings.find_one({'id': 'global_config'}, {'_id': 0}) or {}
    lembar = await db[KOLEKSI_PENILAIAN].find_one({'periode_id': periode['id'], 'guru_dinilai_id': guru_id}, {'_id': 0, 'snapshot_guru': 1}) or {}
    return {'status': b['status'], **await lampiran_identitas(db, periode, sk, guru_id, b.get('penilai_id'), pengaturan,
                                                              b.get('terkunci_pada'), lembar.get('snapshot_guru'))}


async def model_kompetensi_guru(db, periode: Dict[str, Any], sk: Optional[Dict[str, Any]], guru_id: str) -> Optional[Dict[str, Any]]:
    """Rekap nilai per kompetensi (KOMP-1..KOMP (4)) satu guru pada periode dari lembar terkunci, mengikuti
    04-RKAP-PKG & format penghitungan 05-RKAP-PKGR. None bila guru tidak ada di periode; `model` None bila belum
    terkunci."""
    rincian = await rincian_guru(db, periode, sk, guru_id)
    if not rincian:
        return None
    model = rekap_model_kompetensi(rincian['instrumen'], rincian['isian']) if rincian['status'] == 'terkunci' and rincian['instrumen'] else None
    akhir = await nilai_akhir_guru(db, periode, guru_id, model['nkg_tepat']) if model else None
    return {
        'periode': rincian['periode'], 'guru': rincian['guru'], 'penilai_nama': rincian['penilai_nama'],
        'status': rincian['status'],
        'instrumen': {k: rincian['instrumen'].get(k) for k in ('id', 'versi_template', 'revisi')} if rincian['instrumen'] else None,
        'model': model,
        'nilai_akhir_360': akhir,
        'level_guru': level_guru(model['level_capaian'], akhir['level_teks']) if model else None,
    }


async def rekap_periode(db, user: Dict[str, Any], keanggotaan: Dict[str, Any], periode: Dict[str, Any],
                        sk: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Rekap utama (kontrak frontend GET /pkg/rekap): periode, SK, cakupan, ringkasan, statistik, dan guru dalam
    cakupan pengguna (hasil pribadi hanya bila terkunci)."""
    cakupan = await cakupan_rekap(db, user, keanggotaan, periode)
    agregat = await agregasi_rekap(db, periode, sk, saring_guru=cakupan['guru'], hanya_terkunci=cakupan['cakupan'] == 'pribadi')
    if cakupan['cakupan'] == 'penilai':
        # Hasil penilai sendiri (bila juga dinilai) hanya tampil setelah dikunci.
        diri = [b for b in agregat['guru'] if b['guru_id'] == cakupan['diri'] and b['status'] != 'terkunci']
        if diri:
            agregat = await agregasi_rekap(db, periode, sk, saring_guru=cakupan['guru'] - {cakupan['diri']})
    return {
        'periode': {k: periode.get(k) for k in ('id', 'nama_periode', 'tahun_pelajaran', 'semester', 'status')},
        'sk': {'id': sk['id'], 'nomor_sk': sk.get('nomor_sk')} if sk else None,
        'cakupan': cakupan['cakupan'],
        **agregat,
    }


URUT_STATUS = {'terkunci': 0, 'draf': 1, 'belum': 2}


async def rekap_tim(db, periode: Dict[str, Any], sk: Optional[Dict[str, Any]], penilai_id: Optional[str] = None) -> list:
    """Rekap per tim penilai dalam SK periode: identitas & status supervisi penilai, jatah, jumlah guru per status,
    rata-rata capaian, dan anggota terurut (terkunci berperingkat capaian, lalu draf, belum)."""
    from pkg_skema import KOLEKSI_PENUGASAN
    agregat = await agregasi_rekap(db, periode, sk)
    tugas = {t['penilai_id']: t for t in await db[KOLEKSI_PENUGASAN].find({'periode_id': periode['id']}, {'_id': 0}).to_list(1000)}
    snap = (sk or {}).get('snapshot_anggota') or {}
    per_penilai: Dict[str, list] = {}
    for b in agregat['guru']:
        per_penilai.setdefault(b.get('penilai_id') or '', []).append(b)
    for pid in (sk or {}).get('penilai_ids') or []:
        per_penilai.setdefault(pid, [])
    hasil = []
    for pid, guru in per_penilai.items():
        if penilai_id and pid != penilai_id:
            continue
        guru = sorted(guru, key=lambda b: (URUT_STATUS.get(b['status'], 3), -(b.get('capaian_persen') or 0), (b['nama'] or '').lower()))
        peringkat = 0
        for b in guru:
            b['peringkat'] = (peringkat := peringkat + 1) if b['status'] == 'terkunci' else None
        nilai = [b['capaian_persen'] for b in guru if b['status'] == 'terkunci' and b.get('capaian_persen') is not None]
        t = tugas.get(pid) or {}
        hasil.append({
            'penilai_id': pid or None,
            'penilai_nama': (snap.get(pid) or {}).get('nama') or next((b['penilai_nama'] for b in guru if b.get('penilai_nama')), None)
            or ('Belum dibagikan' if not pid else None),
            'supervisi_selesai': bool(t.get('supervisi_selesai')), 'jumlah_jatah': int(t.get('jumlah_jatah') or 0),
            'jumlah': len(guru), 'terkunci': sum(1 for b in guru if b['status'] == 'terkunci'),
            'draf': sum(1 for b in guru if b['status'] == 'draf'), 'belum': sum(1 for b in guru if b['status'] == 'belum'),
            'rata_capaian': _bulat2(sum(nilai) / len(nilai)) if nilai else None,
            'guru': guru,
        })
    hasil.sort(key=lambda t: (t['penilai_id'] is None, (t['penilai_nama'] or '').lower()))
    return hasil


RENTANG_CAPAIAN = ((0, 50), (50, 60), (60, 70), (70, 80), (80, 90), (90, 100.01))


def statistik_lengkap(baris: list) -> Dict[str, Any]:
    """hitung_statistik + sebaran capaian per rentang 10% dan rata-rata subtotal per kompetensi (lembar terkunci)."""
    st = hitung_statistik(baris)
    nilai = [b for b in baris if b.get('status') == 'terkunci' and b.get('capaian_persen') is not None]
    sebaran = []
    for bawah, atas in RENTANG_CAPAIAN:
        label = f"{bawah}–{min(atas, 100):g}%" if atas <= 100 else f"{bawah}–100%"
        sebaran.append({'rentang': label, 'bawah': bawah, 'atas': min(atas, 100),
                        'jumlah': sum(1 for b in nilai if bawah <= b['capaian_persen'] < atas)})
    kode = sorted({k for b in nilai for k in (b.get('per_kompetensi') or {})})
    per_kompetensi = [{'kode': k, 'rata': _bulat2(sum((b.get('per_kompetensi') or {}).get(k, 0) for b in nilai) / len(nilai))}
                      for k in kode] if nilai else []
    return {**st, 'sebaran_capaian': sebaran, 'rata_per_kompetensi': per_kompetensi}


async def anggota_periode(db, user: Dict[str, Any], periode: Dict[str, Any], sk: Optional[Dict[str, Any]]) -> bool:
    """Apakah pengguna termasuk personil PKG pada periode itu: kepala madrasah, tercantum di SK periode (penilai/
    dinilai), atau tercatat di penugasan/lembar periode tersebut (data historis setelah SK berubah)."""
    from pkg_akses import adalah_kepala
    from pkg_skema import KOLEKSI_PENUGASAN
    uid = user.get('id')
    if adalah_kepala(user):
        return True
    if sk and (uid in (sk.get('penilai_ids') or []) or uid in (sk.get('dinilai_ids') or [])):
        return True
    if await db[KOLEKSI_PENUGASAN].find_one({'periode_id': periode['id'], '$or': [{'penilai_id': uid}, {'guru_dinilai_ids': uid}]}, {'_id': 0, 'id': 1}):
        return True
    return bool(await db[KOLEKSI_PENILAIAN].find_one(
        {'periode_id': periode['id'], '$or': [{'penilai_id': uid}, {'guru_dinilai_id': uid}]}, {'_id': 0, 'id': 1}))



async def riwayat_unduhan(db, periode_id: Optional[str] = None, batas: int = 200) -> list:
    """Riwayat unduhan/cetak dokumen PKG (pkg_unduhan), terbaru dulu; opsional satu periode."""
    from pkg_skema import KOLEKSI_UNDUHAN
    docs = await db[KOLEKSI_UNDUHAN].find({'periode_id': periode_id} if periode_id else {}, {'_id': 0}).to_list(5000)
    docs.sort(key=lambda d: d.get('timestamp') or '', reverse=True)
    return docs[:batas]
