"""Skema catatan poin tata tertib siswa (koleksi `tatib_penanganan`).

Satu dokumen = satu catatan poin. Field poin (selain field penanganan lama):
    jenis_poin     'kebaikan' (PLUS) | 'pelanggaran' (MINUS) — dipisah tegas,
                   tidak terhubung ke data prestasi siswa.
    poin           nilai bertanda (int) yang berlaku untuk catatan ini; disalin
                   saat dicatat sehingga perubahan aturan tidak mengubah riwayat.
                   Kebaikan selalu > 0, pelanggaran selalu < 0.
    kondisi        kondisi pelaksanaan saat dicatat (opsional, mis. "Tingkat kota").
    tindak_lanjut  daftar tindak lanjut penanganan pelanggaran:
                   [{id, tanggal, uraian, petugas_id, petugas_nama, created_at}]
    jenis_id       jenis aturan (Master Jenis Pelanggaran; = tatib_id)
    kategori_id    kategori jenis saat dicatat (kategori_nama disalin agar riwayat tetap)
    asal_input     sumber pencatatan, salah satu ASAL_INPUT (BIPH, Screening pagi, Ibadah,
                   Keputrian, Whatsapp, BAP, Razia, Laporan langsung); wajib untuk catatan
                   baru, None untuk catatan sebelum fitur ini (migrasi 2026-10-16_tatib_struktur_baru)
    keterangan     catatan singkat petugas (= catatan, field lama)

`tatib_poin` (nilai aturan saat dicatat) tetap dipertahankan untuk kompatibilitas
endpoint statistik lama.
"""
import uuid
from typing import Optional

KOLEKSI_POIN = 'tatib_penanganan'
JENIS_KEBAIKAN = 'kebaikan'
JENIS_PELANGGARAN = 'pelanggaran'
JENIS_POIN = (JENIS_KEBAIKAN, JENIS_PELANGGARAN)

# Index pendukung: riwayat per siswa, rekap per kelas/periode, dan pemisahan jenis.
INDEX_POIN = [
    ([('siswa_id', 1), ('tanggal', -1)], {}),
    ([('siswa_kelas', 1), ('tanggal', -1)], {}),
    ([('jenis_poin', 1), ('tanggal', -1)], {}),
    ([('tahun_takwim_id', 1), ('semester', 1)], {}),
]


def jenis_dari_poin(poin) -> str:
    """Jenis catatan menurut tanda nilai aturan (negatif = pelanggaran)."""
    return JENIS_PELANGGARAN if (poin or 0) < 0 else JENIS_KEBAIKAN


def poin_bertanda(nilai, jenis: Optional[str] = None) -> int:
    """Paksa tanda poin sesuai jenisnya: kebaikan PLUS, pelanggaran MINUS."""
    n = abs(int(nilai or 0))
    jenis = jenis or jenis_dari_poin(nilai)
    return -n if jenis == JENIS_PELANGGARAN else n


def field_poin(tatib_poin, kondisi: Optional[str] = None) -> dict:
    """Field poin baku untuk dokumen catatan baru, diturunkan dari nilai aturan."""
    jenis = jenis_dari_poin(tatib_poin)
    return {'jenis_poin': jenis, 'poin': poin_bertanda(tatib_poin, jenis), 'kondisi': kondisi}


async def pastikan_index_poin(db) -> None:
    koll = db[KOLEKSI_POIN]
    for keys, opsi in INDEX_POIN:
        await koll.create_index(keys, **opsi)


# ============================================================
# ATURAN: nilai poin mengikuti kategori & kondisi pelaksanaan
# ============================================================
# Koleksi `tatib_aturan` mendapat field:
#     jenis_poin  'kebaikan' | 'pelanggaran' (diturunkan dari tanda `poin` bila tidak diisi)
#     kondisi     [{id, label, poin}] — nilai per kondisi; `poin` aturan = nilai kondisi pertama.
# Catatan poin (`tatib_penanganan`) menyimpan `kondisi_id` + `kondisi` (label) yang dipakai.

KONDISI_BAWAAN_ID = 'umum'
KONDISI_BAWAAN_LABEL = 'Setiap kejadian'


def _slug(teks: str) -> str:
    s = ''.join(c.lower() if c.isalnum() else '-' for c in (teks or '').strip())
    return '-'.join(p for p in s.split('-') if p)[:40] or KONDISI_BAWAAN_ID


def normalisasi_kondisi(kondisi, jenis: str, poin_bawaan=0) -> list:
    """Rapikan daftar kondisi: id unik, label wajib, tanda poin sesuai jenis.
    Daftar kosong -> satu kondisi bawaan bernilai `poin_bawaan`."""
    hasil, dipakai = [], set()
    for k in kondisi or []:
        k = dict(k or {})
        label = (k.get('label') or '').strip()
        if not label:
            continue
        kid = _slug(k.get('id') or label)
        dasar, n = kid, 2
        while kid in dipakai:
            kid, n = f'{dasar}-{n}', n + 1
        dipakai.add(kid)
        hasil.append({'id': kid, 'label': label, 'poin': poin_bertanda(k.get('poin'), jenis)})
    if not hasil:
        hasil = [{'id': KONDISI_BAWAAN_ID, 'label': KONDISI_BAWAAN_LABEL, 'poin': poin_bertanda(poin_bawaan, jenis)}]
    return hasil


def kondisi_aturan(aturan: dict) -> list:
    """Kondisi efektif sebuah aturan (aturan lama tanpa `kondisi` -> satu kondisi bawaan)."""
    jenis = aturan.get('jenis_poin') or jenis_dari_poin(aturan.get('poin'))
    return normalisasi_kondisi(aturan.get('kondisi'), jenis, aturan.get('poin'))


def hitung_poin_aturan(aturan: dict, kondisi_id: Optional[str] = None) -> dict:
    """Nilai poin satu pencatatan, SELALU dihitung dari aturan + kondisi (bukan input petugas).
    -> {jenis_poin, poin, kondisi_id, kondisi}. ValueError bila kondisi tidak dikenal."""
    jenis = aturan.get('jenis_poin') or jenis_dari_poin(aturan.get('poin'))
    daftar = kondisi_aturan(aturan)
    if kondisi_id:
        k = next((x for x in daftar if x['id'] == kondisi_id), None)
        if not k:
            raise ValueError('Kondisi tidak dikenal untuk aturan ini')
    elif len(daftar) == 1:
        k = daftar[0]
    else:
        raise ValueError('Kondisi wajib dipilih untuk aturan ini')
    return {'jenis_poin': jenis, 'poin': poin_bertanda(k['poin'], jenis), 'kondisi_id': k['id'], 'kondisi': k['label']}


INDEX_ATURAN = [
    ([('jenis_poin', 1), ('kategori_id', 1)], {}),
]


async def pastikan_index_aturan(db) -> None:
    for keys, opsi in INDEX_ATURAN:
        await db.tatib_aturan.create_index(keys, **opsi)


# ============================================================
# STRUKTUR BARU: kategori -> jenis aturan -> pencatatan (Input Tata Tertib terpadu)
# ============================================================
# `tatib_kategori`  + nama_key (huruf kecil, unik) agar nama kategori tidak ganda.
# `tatib_aturan`    = master JENIS aturan; field kanonis baru (field lama tetap diisi demi kompatibilitas):
#     kode_aturan (unik, = kode), nama (= nama_aturan), jalur_poin 'minus'|'plus' (= jenis_poin),
#     besar_poin (int >= 0; nilai bertanda = poin), kategori_id/kategori_nama, deskripsi, aktif (= is_active).
#     Jenis nonaktif tidak bisa dipakai mencatat, tetapi riwayatnya tetap ada.
# `tatib_penanganan` (KOLEKSI_POIN) mendapat: jenis_id (= tatib_id), kategori_id, keterangan (= catatan),
#     asal_input (daftar ASAL_INPUT; catatan lama = None).
JALUR_MINUS = 'minus'
JALUR_PLUS = 'plus'
JALUR_POIN = (JALUR_MINUS, JALUR_PLUS)
ASAL_INPUT = ('BIPH', 'Screening pagi', 'Ibadah', 'Keputrian', 'Whatsapp', 'BAP', 'Razia', 'Laporan langsung')


def jalur_dari_jenis_poin(jenis_poin: Optional[str]) -> str:
    return JALUR_MINUS if jenis_poin == JENIS_PELANGGARAN else JALUR_PLUS


def jenis_poin_dari_jalur(jalur: Optional[str]) -> str:
    return JENIS_PELANGGARAN if jalur == JALUR_MINUS else JENIS_KEBAIKAN


def kunci_nama(teks: Optional[str]) -> str:
    """Kunci pembanding nama (spasi dirapikan, huruf kecil) untuk mencegah nama kategori ganda."""
    return ' '.join((teks or '').split()).lower()


def field_jenis_aturan(aturan: dict) -> dict:
    """Field kanonis jenis aturan yang diturunkan dari field lama (untuk migrasi & dokumen lama)."""
    jenis = aturan.get('jenis_poin') or jenis_dari_poin(aturan.get('poin'))
    return {
        'kode_aturan': aturan.get('kode_aturan') or aturan.get('kode'),
        'nama': aturan.get('nama') or aturan.get('nama_aturan'),
        'jalur_poin': aturan.get('jalur_poin') or jalur_dari_jenis_poin(jenis),
        'besar_poin': abs(int(aturan.get('besar_poin') if aturan.get('besar_poin') is not None else (aturan.get('poin') or 0))),
        'aktif': aturan.get('aktif') if aturan.get('aktif') is not None else aturan.get('is_active', True) is not False,
    }


# Master Jenis Pelanggaran: kode aturan disimpan HURUF BESAR tanpa spasi tepi (unik tanpa beda huruf).
POLA_KODE_ATURAN = r'^[A-Z0-9][A-Z0-9._/-]{0,19}$'
MAKS_BESAR_POIN = 1000
MAKS_NAMA_JENIS = 150
MAKS_DESKRIPSI_JENIS = 500


def normalisasi_kode(kode: Optional[str]) -> str:
    """Kode aturan baku: spasi dibuang, huruf besar (mis. ' dis-01 ' -> 'DIS-01')."""
    return ''.join((kode or '').split()).upper()


def poin_jenis_aturan(aturan: dict) -> int:
    """Nilai bertanda satu pencatatan dari master jenis: jalur minus -> negatif."""
    f = field_jenis_aturan(aturan)
    return -f['besar_poin'] if f['jalur_poin'] == JALUR_MINUS else f['besar_poin']


INDEX_STRUKTUR = {
    'tatib_kategori': [([('nama_key', 1)], {'unique': True, 'name': 'nama_key_unik',
                                            'partialFilterExpression': {'nama_key': {'$type': 'string'}}})],
    'tatib_aturan': [
        ([('kode_aturan', 1)], {'unique': True, 'name': 'kode_aturan_unik',
                                'partialFilterExpression': {'kode_aturan': {'$type': 'string'}}}),
        ([('kategori_id', 1), ('aktif', 1)], {}),
    ],
    KOLEKSI_POIN: [
        ([('created_at', -1)], {}),
        ([('jenis_id', 1), ('tanggal', -1)], {}),
        ([('asal_input', 1), ('tanggal', -1)], {}),
    ],
}


# ============================================================
# TINDAKAN TATIB: usulan SP otomatis + status pembinaan manual (koleksi `tatib_tindakan`)
# ============================================================
# Satu dokumen per siswa per semester (semester_id; None = tanpa semester):
#     id, siswa_id, semester_id,
#     keterangan_sp            'SP1'|'SP2'|'SP3'|None   — keputusan sekolah (manual)
#     status_panggilan_wali    STATUS_PANGGILAN_WALI
#     status_sp                STATUS_SP
#     status_rtlpd             STATUS_RTLPD
#     catatan, diubah_pada, diubah_oleh_id, diubah_oleh_nama, created_at
# Riwayat perubahan disimpan terpisah di `tatib_tindakan_riwayat` (satu dokumen per perubahan):
#     id, tindakan_id, siswa_id, semester_id, waktu, oleh_id, oleh_nama,
#     perubahan [{field, dari, ke}], catatan, usulan_sp (usulan otomatis saat perubahan dibuat), poin_negatif
# Usulan SP TIDAK disimpan sebagai keputusan: dihitung dari akumulasi poin pelanggaran & ambang (usulkan_sp).
# Catatan: `tatib_penanganan` di codebase ini adalah koleksi catatan poin, bukan status pembinaan.
KOLEKSI_TINDAKAN = 'tatib_tindakan'
KOLEKSI_RIWAYAT_TINDAKAN = 'tatib_tindakan_riwayat'
TINGKAT_SP = ('SP1', 'SP2', 'SP3')
STATUS_PANGGILAN_WALI = ('Tidak diperlukan', 'Diajukan', 'Terlaksana')
STATUS_SP = ('Tidak perlu', 'Diserahkan')
STATUS_RTLPD = ('Tidak diperlukan', 'Disusun')
FIELD_STATUS_TINDAKAN = ('keterangan_sp', 'status_panggilan_wali', 'status_sp', 'status_rtlpd')
STATUS_TINDAKAN_AWAL = {
    'keterangan_sp': None,
    'status_panggilan_wali': STATUS_PANGGILAN_WALI[0],
    'status_sp': STATUS_SP[0],
    'status_rtlpd': STATUS_RTLPD[0],
}
# Ambang bawaan (akumulasi poin pelanggaran, nilai mutlak); sama dengan AMBANG_SP_BAWAAN di frontend/src/lib/tindakanTatib.js.
AMBANG_SP_BAWAAN = {'sp1': 25, 'sp2': 50, 'sp3': 75}

INDEX_TINDAKAN = [
    ([('siswa_id', 1), ('semester_id', 1)], {'unique': True, 'name': 'siswa_semester_unik'}),
    ([('keterangan_sp', 1)], {}),
]
INDEX_RIWAYAT_TINDAKAN = [
    ([('siswa_id', 1), ('semester_id', 1), ('waktu', -1)], {}),
    ([('tindakan_id', 1), ('waktu', -1)], {}),
    ([('id', 1)], {'unique': True, 'name': 'id_unik'}),
]


def usulkan_sp(poin_negatif, ambang: Optional[dict] = None) -> Optional[str]:
    """SP tertinggi yang ambangnya terlampaui oleh akumulasi pelanggaran (nilai mutlak), atau None."""
    ambang = ambang or AMBANG_SP_BAWAAN
    n = abs(int(poin_negatif or 0))
    for sp in reversed(TINGKAT_SP):
        if n >= int(ambang[sp.lower()]):
            return sp
    return None


def ambang_berikutnya(poin_negatif, ambang: Optional[dict] = None) -> Optional[dict]:
    """Tingkat SP berikutnya yang belum terlampaui: {sp, ambang, sisa}, atau None bila sudah SP3."""
    ambang = ambang or AMBANG_SP_BAWAAN
    n = abs(int(poin_negatif or 0))
    for sp in TINGKAT_SP:
        batas = int(ambang[sp.lower()])
        if n < batas:
            return {'sp': sp, 'ambang': batas, 'sisa': batas - n}
    return None


def usulan_lebih_tinggi(usulan: Optional[str], ditetapkan: Optional[str]) -> bool:
    """True bila usulan otomatis lebih berat dari SP yang sudah ditetapkan (perlu ditinjau)."""
    tingkat = {sp: i for i, sp in enumerate(TINGKAT_SP, start=1)}
    return tingkat.get(usulan, 0) > tingkat.get(ditetapkan, 0)


def perubahan_status(lama: dict, baru: dict) -> list:
    """Daftar perubahan field status [{field, dari, ke}] antara dua keadaan tindakan."""
    lama = {**STATUS_TINDAKAN_AWAL, **{k: v for k, v in (lama or {}).items() if k in FIELD_STATUS_TINDAKAN}}
    return [{'field': f, 'dari': lama.get(f), 'ke': baru.get(f)} for f in FIELD_STATUS_TINDAKAN if lama.get(f) != baru.get(f)]


def entri_riwayat_tindakan(tindakan: dict, perubahan: list, oleh: dict, waktu: str, catatan: Optional[str] = None,
                           usulan_sp: Optional[str] = None, poin_negatif: int = 0) -> dict:
    """Satu dokumen riwayat perubahan tindakan (koleksi KOLEKSI_RIWAYAT_TINDAKAN)."""
    return {
        'id': str(uuid.uuid4()),
        'tindakan_id': tindakan.get('id'),
        'siswa_id': tindakan.get('siswa_id'),
        'semester_id': tindakan.get('semester_id'),
        'waktu': waktu,
        'oleh_id': oleh.get('id'),
        'oleh_nama': oleh.get('full_name') or oleh.get('username'),
        'perubahan': perubahan,
        'catatan': catatan or None,
        'usulan_sp': usulan_sp,
        'poin_negatif': poin_negatif,
    }


async def pastikan_index_tindakan(db) -> None:
    for keys, opsi in INDEX_TINDAKAN:
        await db[KOLEKSI_TINDAKAN].create_index(keys, **opsi)
    await db[KOLEKSI_POIN].create_index([('semester_id', 1), ('siswa_id', 1)])


async def pastikan_index_riwayat_tindakan(db) -> None:
    for keys, opsi in INDEX_RIWAYAT_TINDAKAN:
        await db[KOLEKSI_RIWAYAT_TINDAKAN].create_index(keys, **opsi)


# ============================================================
# PENGATURAN AMBANG SP (koleksi `pengaturan_ambang_sp` + riwayat audit)
# ============================================================
# Satu dokumen berlaku: {_id: 'ambang_sp', sp1, sp2, sp3, alasan, diubah_oleh_id, diubah_oleh_nama, diubah_pada}.
# Nilai = akumulasi poin pelanggaran (nilai mutlak) minimal untuk tiap tingkat; wajib 1 <= sp1 < sp2 < sp3.
# Setiap perubahan dicatat di `pengaturan_ambang_sp_riwayat` (audit, tidak pernah diubah/dihapus):
#     {id, waktu, oleh_id, oleh_nama, dari: {sp1,sp2,sp3}|None, ke: {sp1,sp2,sp3}, alasan}
KOLEKSI_AMBANG_SP = 'pengaturan_ambang_sp'
KOLEKSI_RIWAYAT_AMBANG_SP = 'pengaturan_ambang_sp_riwayat'
ID_AMBANG_SP = 'ambang_sp'
MAKS_AMBANG_SP = 10000
INDEX_RIWAYAT_AMBANG_SP = [
    ([('waktu', -1)], {}),
    ([('oleh_id', 1), ('waktu', -1)], {}),
    ([('id', 1)], {'unique': True, 'name': 'id_unik'}),
]


def validasi_ambang_sp(sp1, sp2, sp3) -> dict:
    """{sp1, sp2, sp3} bilangan bulat dengan 1 <= sp1 < sp2 < sp3 <= MAKS_AMBANG_SP; ValueError bila tidak."""
    try:
        nilai = {'sp1': int(sp1), 'sp2': int(sp2), 'sp3': int(sp3)}
    except (TypeError, ValueError):
        raise ValueError('Ambang SP harus berupa bilangan bulat')
    if any(isinstance(v, bool) for v in (sp1, sp2, sp3)):
        raise ValueError('Ambang SP harus berupa bilangan bulat')
    if not 1 <= nilai['sp1'] < nilai['sp2'] < nilai['sp3'] <= MAKS_AMBANG_SP:
        raise ValueError(f'Ambang SP harus naik: 1 <= SP1 < SP2 < SP3 <= {MAKS_AMBANG_SP}')
    return nilai


def entri_riwayat_ambang(dari: Optional[dict], ke: dict, oleh: Optional[dict], waktu: str, alasan: Optional[str] = None) -> dict:
    """Satu dokumen riwayat perubahan ambang SP. `oleh` None = perubahan oleh sistem."""
    ambil = lambda d: {k: d.get(k) for k in ('sp1', 'sp2', 'sp3')} if d else None  # noqa: E731
    return {
        'id': str(uuid.uuid4()),
        'waktu': waktu,
        'oleh_id': (oleh or {}).get('id'),
        'oleh_nama': ((oleh or {}).get('full_name') or (oleh or {}).get('username')) if oleh else 'Sistem',
        'dari': ambil(dari),
        'ke': ambil(ke),
        'alasan': (alasan or '').strip() or None,
    }


async def pastikan_index_riwayat_ambang(db) -> None:
    for keys, opsi in INDEX_RIWAYAT_AMBANG_SP:
        await db[KOLEKSI_RIWAYAT_AMBANG_SP].create_index(keys, **opsi)


async def ambil_ambang_sp(db) -> dict:
    """Ambang SP yang berlaku ({sp1, sp2, sp3, diubah_oleh_nama, diubah_pada}); bawaan bila belum diatur."""
    doc = await db[KOLEKSI_AMBANG_SP].find_one({'_id': ID_AMBANG_SP}, {'_id': 0}) or {}
    try:
        nilai = validasi_ambang_sp(doc.get('sp1'), doc.get('sp2'), doc.get('sp3'))
    except ValueError:
        return {**AMBANG_SP_BAWAAN, 'alasan': None, 'diubah_oleh_nama': None, 'diubah_pada': None, 'bawaan': True}
    return {**nilai, 'alasan': doc.get('alasan'), 'diubah_oleh_nama': doc.get('diubah_oleh_nama'),
            'diubah_pada': doc.get('diubah_pada'), 'bawaan': False}


# ============================================================
# AKSES & RANGKUMAN (dipakai routers/tatib_poin.py)
# ============================================================
# Sama dengan frontend/src/lib/aksesTatib.js.
AKSES_TATIB_PER_PERAN = {
    'admin': 'input',
    'guru_tata_tertib': 'input',
    'waka_kesiswaan': 'input',
    'guru_bk': 'lihat',
    'kepala_sekolah': 'lihat',
    'penjamin_mutu': 'lihat',
    'kepala_tata_usaha': 'lihat',
    'waka_kurikulum': 'lihat',
    'wali_kelas': 'kelas',
    'siswa': 'pribadi',
}
PERAN_INPUT_TATIB = tuple(r for r, a in AKSES_TATIB_PER_PERAN.items() if a == 'input')
PERAN_LIHAT_TATIB = tuple(r for r, a in AKSES_TATIB_PER_PERAN.items() if a in ('input', 'lihat'))

# Siswa "perlu perhatian" bila akumulasi poin pelanggaran <= batas ini. Nilai bawaan; sekolah dapat
# mengubahnya (settings.global_config.tatib_batas_minus_perhatian lewat PUT /tatib/ambang).
# Bawaan sama dengan BATAS_MINUS_PERHATIAN di frontend/src/components/tatib/RingkasanPoin.js.
BATAS_MINUS_PERHATIAN = -20
FIELD_BATAS_PERHATIAN = 'tatib_batas_minus_perhatian'


def akses_tatib(user: dict) -> Optional[str]:
    """Akses tatib menurut peran AKTIF; admin (di roles) selalu 'input'."""
    if 'admin' in (user.get('roles') or []):
        return 'input'
    return AKSES_TATIB_PER_PERAN.get(user.get('active_role'))


def nilai_poin(r: dict) -> int:
    """Nilai bertanda satu catatan; catatan lama memakai tatib_poin."""
    v = r.get('poin')
    if v is None:
        v = r.get('tatib_poin')
    return int(v or 0)


def rangkum_poin(records, batas: int = BATAS_MINUS_PERHATIAN) -> dict:
    plus = [nilai_poin(r) for r in records if nilai_poin(r) > 0]
    minus = [nilai_poin(r) for r in records if nilai_poin(r) < 0]
    total_minus = sum(minus)
    return {
        'total_plus': sum(plus),
        'total_minus': total_minus,
        'saldo': sum(plus) + total_minus,
        'jumlah_kebaikan': len(plus),
        'jumlah_pelanggaran': len(minus),
        'perlu_perhatian': total_minus <= batas,
    }


def susun_rekap(records, kelas_siswa: dict, batas: int = BATAS_MINUS_PERHATIAN, teratas: int = 5) -> dict:
    """Rekap lintas kelas dari catatan poin.
    kelas_siswa: {nama_kelas: [siswa_id, ...]} — kelas yang ditampilkan (termasuk yang belum punya catatan).
    Kelas catatan = kelas siswa saat ini bila dikenal, selain itu salinan `siswa_kelas` saat dicatat.
    -> {ringkasan, per_kelas, teratas_pelanggaran, teratas_kebaikan} (bentuk sama dengan ambilRekapTiruan)."""
    kelas_dari_siswa = {sid: k for k, ids in kelas_siswa.items() for sid in ids}
    per_kelas_rec = {k: [] for k in kelas_siswa}
    per_siswa = {}
    for r in records:
        kelas = kelas_dari_siswa.get(r.get('siswa_id')) or r.get('siswa_kelas') or 'Tanpa kelas'
        per_kelas_rec.setdefault(kelas, []).append(r)
        per_siswa.setdefault(r.get('siswa_id'), []).append(r)

    perhatian = {sid for sid, rs in per_siswa.items() if rangkum_poin(rs, batas)['perlu_perhatian']}
    per_kelas = []
    for kelas in sorted(per_kelas_rec, key=lambda k: (len(k), k)):
        rs = per_kelas_rec[kelas]
        ring = rangkum_poin(rs, batas)
        ids = set(kelas_siswa.get(kelas) or {r.get('siswa_id') for r in rs})
        per_kelas.append({
            'kelas': kelas,
            'jumlah_siswa': len(ids),
            'jumlah_kebaikan': ring['jumlah_kebaikan'],
            'jumlah_pelanggaran': ring['jumlah_pelanggaran'],
            'total_plus': ring['total_plus'],
            'total_minus': ring['total_minus'],
            'saldo': ring['saldo'],
            'siswa_perlu_perhatian': len(ids & perhatian),
        })

    def _teratas(positif: bool):
        hit = {}
        for r in records:
            n = nilai_poin(r)
            if n == 0 or (n > 0) != positif:
                continue
            kunci = r.get('tatib_kode') or r.get('tatib_nama') or '-'
            h = hit.setdefault(kunci, {'kode': r.get('tatib_kode'), 'nama': r.get('tatib_nama') or '-',
                                       'kategori_nama': r.get('kategori_nama'), 'jumlah': 0})
            h['jumlah'] += 1
        return sorted(hit.values(), key=lambda x: (-x['jumlah'], x['nama']))[:teratas]

    total = rangkum_poin(records, batas)
    return {
        'ringkasan': {
            'total_plus': total['total_plus'],
            'total_minus': total['total_minus'],
            'jumlah_kebaikan': total['jumlah_kebaikan'],
            'jumlah_pelanggaran': total['jumlah_pelanggaran'],
            'siswa_perlu_perhatian': sum(k['siswa_perlu_perhatian'] for k in per_kelas),
        },
        'per_kelas': per_kelas,
        'teratas_pelanggaran': _teratas(False),
        'teratas_kebaikan': _teratas(True),
    }
