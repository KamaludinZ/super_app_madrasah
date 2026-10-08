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

`tatib_poin` (nilai aturan saat dicatat) tetap dipertahankan untuk kompatibilitas
endpoint statistik lama.
"""
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
