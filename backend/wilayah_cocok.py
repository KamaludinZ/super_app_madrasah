"""Pencocokan alamat ketikan bebas (hasil impor Excel) ke master wilayah.

`PencocokWilayah.cocokkan({provinsi, kabupaten, kecamatan, desa}, kode_pos)` ->
  { status: 'cocok'|'sebagian'|'tidak_cocok'|'tanpa_alamat', kode_wilayah, kode_pos,
    tingkat_cocok: {provinsi, kabupaten, kecamatan, desa} (True/False/None), alasan,
    nama: {provinsi, kabupaten, kecamatan, desa} (nama resmi tingkat yang cocok),
    saran: [{kode, nama, kode_pos, rantai, skor}] }

Aturan:
- Nama dinormalkan: huruf kecil, tanpa tanda baca, tanpa awalan (Prov./Kab./Kec./Kel./Desa/Ds./Administrasi);
  "Kota X" dan "Kabupaten X" dibedakan bila awalannya ditulis, bila tidak keduanya dicoba lalu
  dipilih yang tingkat bawahnya cocok. Singkatan provinsi umum (Jatim, DIY, DKI, NTB, ...) dikenali.
- Tiap tingkat dicari di bawah induk yang sudah cocok; salah ketik ringan (kemiripan >= 0,88 dan unik)
  diterima. Tingkat kosong boleh dilompati (mis. kecamatan kosong: desa dicari di seluruh kabupaten).
- 'cocok' = semua tingkat yang terisi cocok sampai desa/kelurahan; 'sebagian' = sebagian tingkat cocok
  (kode_wilayah = tingkat terdalam yang cocok); 'tidak_cocok' = tidak satu pun cocok.
- Saran: kandidat terdekat untuk tingkat yang gagal (di bawah induk yang cocok, atau desa senama di
  seluruh Indonesia bila tidak ada induk), diurutkan menurut skor kemiripan.
"""
import re
from difflib import SequenceMatcher
from typing import Dict, List, Optional, Tuple

from wilayah_master import KOLEKSI_WILAYAH, TINGKAT_WILAYAH

AMBANG_EJAAN = 0.88   # salah ketik ringan yang diterima sebagai cocok
AMBANG_SARAN = 0.55   # kemiripan minimal untuk disarankan
MAKS_SARAN = 3

_AWALAN = re.compile(r'^(provinsi|propinsi|prov|kabupaten|kab|kota|kotamadya|kodya|kecamatan|kec|kelurahan|kel|desa|ds|'
                     r'administrasi|adm|daerah khusus ibukota|daerah istimewa)\s+')

ALIAS_PROVINSI = {
    'aceh': '11', 'nad': '11', 'nanggroe aceh darussalam': '11', 'sumut': '12', 'sumbar': '13', 'sumsel': '16',
    'babel': '19', 'bangka belitung': '19', 'kepri': '21', 'dki': '31', 'jakarta': '31', 'dki jakarta': '31',
    'jabar': '32', 'jateng': '33', 'diy': '34', 'yogyakarta': '34', 'jogja': '34', 'jogjakarta': '34', 'di yogyakarta': '34',
    'jatim': '35', 'ntb': '52', 'ntt': '53', 'kalbar': '61', 'kalteng': '62', 'kalsel': '63', 'kaltim': '64',
    'kaltara': '65', 'sulut': '71', 'sulteng': '72', 'sulsel': '73', 'sultra': '74', 'sulbar': '76', 'malut': '82',
}


def _bersih(teks: Optional[str]) -> str:
    t = re.sub(r'[^a-z0-9 ]', ' ', str(teks or '').lower())
    return re.sub(r'\s+', ' ', t).strip()


def kunci(teks: Optional[str]) -> str:
    """Kunci pencocokan: tanpa tanda baca & awalan tingkat."""
    t = _bersih(teks)
    while True:
        baru = _AWALAN.sub('', t)
        if baru == t:
            return t
        t = baru


def jenis_kab(teks: Optional[str]) -> Optional[str]:
    """'kota' / 'kab' bila awalan ditulis, None bila tidak."""
    t = _bersih(teks)
    if re.match(r'^(kota|kotamadya|kodya)\b', t) or re.match(r'^kota administrasi\b', t):
        return 'kota'
    if re.match(r'^(kabupaten|kab)\b', t):
        return 'kab'
    return None


def skor(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    s = SequenceMatcher(None, a, b).ratio()
    if a.replace(' ', '') == b.replace(' ', ''):
        s = max(s, 0.97)  # "tlogo mas" vs "tlogomas"
    return s


class PencocokWilayah:
    """Memuat master wilayah ke memori sekali, lalu mencocokkan banyak alamat dengan cepat."""

    def __init__(self, docs: List[Dict]):
        self.doc: Dict[str, Dict] = {}
        self.anak: Dict[Optional[str], List[Dict]] = {}
        for d in docs:
            d = {**d, '_k': kunci(d['nama'])}
            if d['tingkat'] == 'kabupaten':
                d['_jenis'] = 'kota' if _bersih(d['nama']).startswith('kota') else 'kab'
            self.doc[d['kode']] = d
            self.anak.setdefault(d.get('induk'), []).append(d)
        self._desa_per_kunci: Optional[Dict[str, List[Dict]]] = None

    @classmethod
    async def muat(cls, database) -> 'PencocokWilayah':
        docs = await database[KOLEKSI_WILAYAH].find({}, {'_id': 0, 'kode': 1, 'nama': 1, 'tingkat': 1, 'induk': 1, 'kode_pos': 1}).to_list(None)
        return cls(docs)

    @property
    def kosong(self) -> bool:
        return not self.doc

    def _desa_kunci(self) -> Dict[str, List[Dict]]:
        if self._desa_per_kunci is None:
            self._desa_per_kunci = {}
            for d in self.doc.values():
                if d['tingkat'] == 'desa':
                    self._desa_per_kunci.setdefault(d['_k'], []).append(d)
        return self._desa_per_kunci

    def turunan(self, kode: Optional[str], tingkat: str) -> List[Dict]:
        """Semua wilayah tingkat `tingkat` di bawah `kode` (boleh melompati tingkat)."""
        if kode is None:
            return [d for d in self.doc.values() if d['tingkat'] == tingkat] if tingkat != 'desa' else \
                [d for v in self._desa_kunci().values() for d in v]
        hasil, antre = [], [kode]
        while antre:
            for a in self.anak.get(antre.pop(), []):
                if a['tingkat'] == tingkat:
                    hasil.append(a)
                elif TINGKAT_WILAYAH.index(a['tingkat']) < TINGKAT_WILAYAH.index(tingkat):
                    antre.append(a['kode'])
        return hasil

    def rantai(self, kode: str) -> Dict[str, Optional[Dict]]:
        p = kode.split('.')
        r = {}
        for i, t in enumerate(TINGKAT_WILAYAH):
            d = self.doc.get('.'.join(p[:i + 1])) if i < len(p) else None
            r[t] = ({'kode': d['kode'], 'nama': d['nama'], **({'kode_pos': d['kode_pos']} if d.get('kode_pos') else {})} if d else None)
        return r

    # ---- pencarian satu tingkat ----
    def _kandidat(self, tingkat: str, teks: str, induk: Optional[str]) -> Tuple[List[Dict], List[Tuple[float, Dict]]]:
        """-> (cocok_pasti, [(skor, doc)] urut menurun) untuk satu tingkat di bawah induk."""
        k = kunci(teks)
        if not k:
            return [], []
        if tingkat == 'provinsi':
            kode = ALIAS_PROVINSI.get(_bersih(teks)) or ALIAS_PROVINSI.get(k)
            if kode in self.doc:
                return [self.doc[kode]], [(1.0, self.doc[kode])]
        if tingkat == 'desa' and induk is None:
            pool = self._desa_kunci().get(k, [])
            if not pool:  # tanpa induk: hanya kemiripan pada desa senama/hampir senama (dibatasi awalan)
                pool = [d for kk, v in self._desa_kunci().items() if kk[:3] == k[:3] for d in v]
        else:
            pool = self.turunan(induk, tingkat)
        jenis = jenis_kab(teks) if tingkat == 'kabupaten' else None
        if jenis:
            pool = [d for d in pool if d.get('_jenis') == jenis]
        pasti = [d for d in pool if d['_k'] == k]
        if pasti:
            return pasti, [(1.0, d) for d in pasti]
        nilai = sorted(((skor(k, d['_k']), d) for d in pool), key=lambda x: (-x[0], x[1]['kode']))
        return [], [x for x in nilai if x[0] >= AMBANG_SARAN][:20]

    def cocokkan(self, teks: Dict[str, Optional[str]], kode_pos: Optional[str] = None) -> Dict:
        isian = {t: str(teks.get(t) or '').strip() for t in TINGKAT_WILAYAH}
        kp = re.sub(r'\D', '', str(kode_pos or ''))
        dasar = {'tingkat_cocok': {t: None for t in TINGKAT_WILAYAH}, 'nama': {t: None for t in TINGKAT_WILAYAH},
                 'kode_wilayah': '', 'kode_pos': '', 'saran': []}
        if not any(isian.values()):
            return {**dasar, 'status': 'tanpa_alamat', 'alasan': 'Alamat belum diisi'}
        hasil = self._telusuri(isian, kp, 0, None, {})
        cocok = hasil['cocok']
        dasar['tingkat_cocok'] = {t: (t in cocok) if isian[t] else None for t in TINGKAT_WILAYAH}
        terdalam = next((cocok[t] for t in reversed(TINGKAT_WILAYAH) if t in cocok), None)
        if terdalam:
            dasar['nama'] = {t: (r['nama'] if r else None) for t, r in self.rantai(terdalam['kode']).items()}
            dasar['kode_wilayah'] = terdalam['kode']
            dasar['kode_pos'] = terdalam.get('kode_pos') or ''
        gagal = [t for t in TINGKAT_WILAYAH if isian[t] and t not in cocok]
        if not gagal and 'desa' in cocok:
            status, alasan = 'cocok', ('Ejaan disesuaikan dengan master: ' + ', '.join(hasil['ejaan'])) if hasil['ejaan'] else 'Semua tingkat cocok'
        elif not cocok:
            status, alasan = 'tidak_cocok', self._alasan(gagal[0], isian[gagal[0]], None)
        else:
            t = gagal[0] if gagal else TINGKAT_WILAYAH[TINGKAT_WILAYAH.index(max(cocok, key=TINGKAT_WILAYAH.index)) + 1]
            status = 'sebagian'
            alasan = self._alasan(t, isian.get(t), terdalam) if gagal else f'{_LABEL[t]} belum diisi'
        saran = [] if status == 'cocok' else self._saran(isian, kp, hasil, terdalam)
        return {**dasar, 'status': status, 'alasan': alasan, 'saran': saran}

    def _telusuri(self, isian, kp, i, induk, cocok, ejaan=None) -> Dict:
        """Cocokkan tingkat ke-i dst. di bawah `induk`; mencoba semua kandidat ambigu dan memilih yang
        menghasilkan paling banyak tingkat cocok."""
        ejaan = list(ejaan or [])
        if i >= len(TINGKAT_WILAYAH):
            return {'cocok': cocok, 'ejaan': ejaan}
        t = TINGKAT_WILAYAH[i]
        if not isian[t]:
            return self._telusuri(isian, kp, i + 1, induk, cocok, ejaan)
        pasti, nilai = self._kandidat(t, isian[t], induk)
        calon = pasti or [d for s, d in nilai[:2] if s >= AMBANG_EJAAN and (len(nilai) == 1 or nilai[0][0] - nilai[1][0] >= 0.04 or d is nilai[0][1])][:1]
        if t == 'desa' and len(calon) > 1 and kp:
            calon = [d for d in calon if d.get('kode_pos') == kp] or calon
        if not calon:
            # Tingkat ini gagal: tetap coba tingkat di bawahnya langsung dari induk (melompati tingkat ini),
            # mis. kecamatan salah ketik tetapi desanya unik di kabupaten itu.
            if any(isian[x] for x in TINGKAT_WILAYAH[i + 1:]):
                lanjut = self._telusuri({**isian, t: ''}, kp, i + 1, induk, cocok, ejaan)
                if len(lanjut['cocok']) > len(cocok):
                    return lanjut
            return {'cocok': cocok, 'ejaan': ejaan}
        terbaik = None
        for d in calon[:5]:
            e = ejaan + ([f"{isian[t]} → {d['nama']}"] if not pasti else [])
            r = self._telusuri(isian, kp, i + 1, d['kode'], {**cocok, t: d}, e)
            if terbaik is None or len(r['cocok']) > len(terbaik['cocok']):
                terbaik = r
        return terbaik

    def _alasan(self, tingkat: str, teks: Optional[str], induk: Optional[Dict]) -> str:
        di = f" di {induk['nama']}" if induk else ''
        return f'{_LABEL[tingkat]} "{teks}" tidak ditemukan{di}'

    def _saran(self, isian, kp, hasil, terdalam) -> List[Dict]:
        """Kandidat desa terdekat untuk melengkapi/memperbaiki alamat."""
        induk = terdalam['kode'] if terdalam else None
        teks_desa = isian['desa']
        nilai: List[Tuple[float, Dict]] = []
        if teks_desa:
            _, nilai = self._kandidat('desa', teks_desa, induk)
            if not nilai and induk:
                _, nilai = self._kandidat('desa', teks_desa, None)
        elif kp and induk:
            nilai = [(0.7, d) for d in self.turunan(induk, 'desa') if d.get('kode_pos') == kp]
        if not nilai and isian['kecamatan'] and induk and TINGKAT_WILAYAH.index(terdalam['tingkat']) < 2:
            _, kec = self._kandidat('kecamatan', isian['kecamatan'], induk)
            return [self._item_saran(d, s) for s, d in kec[:MAKS_SARAN]]
        # bobot tambahan untuk kecocokan tingkat atas yang ditulis & kode pos
        hasil_saran = []
        for s, d in nilai:
            r = self.rantai(d['kode'])
            tambah = 0.0
            for t in ('kecamatan', 'kabupaten', 'provinsi'):
                if isian[t] and r[t] and skor(kunci(isian[t]), kunci(r[t]['nama'])) >= AMBANG_EJAAN:
                    tambah += 0.03
            if kp and d.get('kode_pos') == kp:
                tambah += 0.05
            hasil_saran.append((min(1.0, s * 0.85 + tambah), d))
        hasil_saran.sort(key=lambda x: (-x[0], x[1]['kode']))
        return [self._item_saran(d, s) for s, d in hasil_saran[:MAKS_SARAN]]

    def _item_saran(self, d: Dict, s: float) -> Dict:
        return {'kode': d['kode'], 'nama': d['nama'], 'kode_pos': d.get('kode_pos') or '', 'rantai': self.rantai(d['kode']), 'skor': round(s, 2)}


_LABEL = {'provinsi': 'Provinsi', 'kabupaten': 'Kabupaten/Kota', 'kecamatan': 'Kecamatan', 'desa': 'Desa/Kelurahan'}

_cache: Dict[str, Tuple[int, PencocokWilayah]] = {}


async def pencocok(database) -> PencocokWilayah:
    """Pencocok dengan cache per database; dimuat ulang bila jumlah/versi master berubah."""
    versi_doc = await database[KOLEKSI_WILAYAH].find_one({}, {'_id': 0, 'diperbarui_pada': 1}, sort=[('diperbarui_pada', -1)])
    versi = (await database[KOLEKSI_WILAYAH].estimated_document_count(), (versi_doc or {}).get('diperbarui_pada'))
    kunci_db = database.name
    if kunci_db not in _cache or _cache[kunci_db][0] != versi:
        _cache[kunci_db] = (versi, await PencocokWilayah.muat(database))
    return _cache[kunci_db][1]


# ---- dipakai saat impor kelengkapan Data Siswa / GTK ----
_FIELD_NAMA = ('provinsi', 'kabupaten', 'kecamatan', 'desa')
_PERINGKAT = {'cocok': 0, 'tanpa_alamat': 0, 'sebagian': 1, 'tidak_cocok': 2}


def _terapkan_cocok(alamat: Dict, kolom: Dict[str, str], hasil: Dict) -> Dict:
    """Perubahan field alamat dari hasil pencocokan: kode wilayah (terdalam yang cocok), nama resmi
    tingkat yang cocok, dan kode pos bila kosong. Nama yang tidak cocok dibiarkan apa adanya."""
    ubah = {'kode_wilayah': hasil['kode_wilayah']}
    for t in _FIELD_NAMA:
        if hasil['tingkat_cocok'].get(t) and hasil['nama'].get(t):
            ubah[kolom[t]] = hasil['nama'][t]
    if hasil['status'] == 'cocok' and hasil.get('kode_pos') and not str(alamat.get('kode_pos') or '').strip():
        ubah['kode_pos'] = hasil['kode_pos']
    return ubah


async def cocokkan_alamat_impor(database, jenis: str, target: Dict, detail: Optional[Dict],
                                set_user: Dict, set_detail: Dict) -> Optional[str]:
    """Cocokkan alamat yang diubah oleh satu baris impor ke master wilayah dan tambahkan hasilnya ke
    `set_user` / `set_detail` (diubah di tempat). Mengembalikan status terburuk ('cocok'|'sebagian'|
    'tidak_cocok') atau None bila baris tidak mengubah nama wilayah / master belum dimuat."""
    from wilayah_master import BLOK_ALAMAT_SISWA, KOLOM_ALAMAT_GTK, KOLOM_ALAMAT_SISWA
    blok_diubah = []
    if jenis == 'gtk':
        kolom = KOLOM_ALAMAT_GTK
        if any(kolom[t] in set_user for t in _FIELD_NAMA):
            blok_diubah.append((None, {**target, **set_user}))
    else:
        kolom = KOLOM_ALAMAT_SISWA
        for blok in BLOK_ALAMAT_SISWA:
            lama = (detail or {}).get(blok) if isinstance((detail or {}).get(blok), dict) else {}
            baru = dict(lama)
            ada = False
            if isinstance(set_detail.get(blok), dict):
                baru.update(set_detail[blok]); ada = any(kolom[t] in set_detail[blok] for t in _FIELD_NAMA)
            for k, v in set_detail.items():
                if k.startswith(blok + '.'):
                    baru[k[len(blok) + 1:]] = v
                    ada = ada or k[len(blok) + 1:] in {kolom[t] for t in _FIELD_NAMA}
            if ada:
                blok_diubah.append((blok, baru))
    if not blok_diubah:
        return None
    p = await pencocok(database)
    if p.kosong:
        return None
    terburuk = None
    for blok, alamat in blok_diubah:
        if alamat.get('tinggal_luar_negeri') in (True, 'Ya', 'ya'):
            continue
        h = p.cocokkan({t: alamat.get(kolom[t]) for t in _FIELD_NAMA}, alamat.get('kode_pos'))
        if h['status'] == 'tanpa_alamat':
            continue
        ubah = _terapkan_cocok(alamat, kolom, h)
        if blok is None:
            set_user.update(ubah)
        elif isinstance(set_detail.get(blok), dict) or not isinstance((detail or {}).get(blok), dict):
            set_detail.setdefault(blok, {})
            if isinstance(set_detail[blok], dict):
                set_detail[blok].update(ubah)
        else:
            for k, v in ubah.items():
                set_detail[f'{blok}.{k}'] = v
        if terburuk is None or _PERINGKAT[h['status']] > _PERINGKAT[terburuk]:
            terburuk = h['status']
    return terburuk


async def cocokkan_alamat_tersimpan(database, terapkan: bool = True, hanya_tanpa_kode: bool = True) -> Dict[str, int]:
    """Cocokkan ulang alamat siswa (4 blok) & GTK yang sudah tersimpan ke master wilayah.
    terapkan=False hanya menghitung (dry-run). hanya_tanpa_kode=True melewati alamat yang sudah ber-kode.
    -> {cocok, sebagian, tidak_cocok, tanpa_alamat, dilewati, diperbarui}"""
    from wilayah_master import BLOK_ALAMAT_SISWA, KOLOM_ALAMAT_GTK, KOLOM_ALAMAT_SISWA
    p = await pencocok(database)
    hitung = {'cocok': 0, 'sebagian': 0, 'tidak_cocok': 0, 'tanpa_alamat': 0, 'dilewati': 0, 'diperbarui': 0}
    if p.kosong:
        return hitung

    def nilai(alamat, kolom):
        if not isinstance(alamat, dict) or alamat.get('tinggal_luar_negeri') in (True, 'Ya', 'ya'):
            return None
        if hanya_tanpa_kode and str(alamat.get('kode_wilayah') or '').strip():
            hitung['dilewati'] += 1
            return None
        h = p.cocokkan({t: alamat.get(kolom[t]) for t in _FIELD_NAMA}, alamat.get('kode_pos'))
        hitung[h['status']] += 1
        if h['status'] == 'tanpa_alamat':
            return None
        ubah = _terapkan_cocok(alamat, kolom, h)
        return {k: v for k, v in ubah.items() if alamat.get(k) != v} or None

    from routers._shared import _GTK_ROLES
    gtk_q = {'roles': {'$in': list(_GTK_ROLES), '$nin': ['siswa']}}
    proj = {'_id': 0, 'id': 1, 'kode_wilayah': 1, 'kode_pos': 1, 'tinggal_luar_negeri': 1, **{f: 1 for f in KOLOM_ALAMAT_GTK.values()}}
    async for u in database.users.find(gtk_q, proj):
        ubah = nilai(u, KOLOM_ALAMAT_GTK)
        if ubah:
            hitung['diperbarui'] += 1
            if terapkan:
                await database.users.update_one({'id': u['id']}, {'$set': ubah})
    async for d in database.student_details.find({}, {'_id': 0, 'student_id': 1, **{b: 1 for b in BLOK_ALAMAT_SISWA}}):
        set_ = {}
        for blok in BLOK_ALAMAT_SISWA:
            ubah = nilai(d.get(blok), KOLOM_ALAMAT_SISWA)
            for k, v in (ubah or {}).items():
                set_[f'{blok}.{k}'] = v
        if set_:
            hitung['diperbarui'] += 1
            if terapkan:
                await database.student_details.update_one({'student_id': d['student_id']}, {'$set': set_})
    return hitung


# ---- laporan pencocokan (halaman Pencocokan Wilayah Impor) ----
LABEL_BLOK = {'alamat_ayah': 'Alamat Ayah', 'alamat_ibu': 'Alamat Ibu', 'alamat_wali': 'Alamat Wali',
              'alamat_siswa': 'Domisili Siswa', 'tempat_tinggal': 'Tempat Tinggal'}


def baris_laporan(p: PencocokWilayah, alamat: Dict, kolom: Dict[str, str]) -> Optional[Dict]:
    """Hasil pencocokan satu alamat tersimpan untuk laporan. Alamat yang sudah ber-kode dan kodenya ada di
    master dinilai dari kodenya (tidak dicocokkan ulang); None bila alamat di luar negeri."""
    if not isinstance(alamat, dict) or alamat.get('tinggal_luar_negeri') in (True, 'Ya', 'ya'):
        return None
    teks = {t: str(alamat.get(kolom[t]) or '').strip() for t in _FIELD_NAMA}
    kode = str(alamat.get('kode_wilayah') or '').strip()
    if kode and kode in p.doc:
        n = len(kode.split('.'))
        terisi_lebih_dalam = any(teks[t] for t in TINGKAT_WILAYAH[n:])
        status = 'cocok' if n == 4 else 'sebagian'
        h = {'status': status, 'kode_wilayah': kode,
             'tingkat_cocok': {t: (True if i < n else (False if teks[t] else None)) for i, t in enumerate(TINGKAT_WILAYAH)},
             'alasan': 'Tersimpan dari master wilayah' if n == 4 else
             (f'{_LABEL[TINGKAT_WILAYAH[n]]} "{teks[TINGKAT_WILAYAH[n]]}" belum cocok' if terisi_lebih_dalam else f'{_LABEL[TINGKAT_WILAYAH[n]]} belum dipilih'),
             'saran': []}
        if status == 'sebagian':
            h['saran'] = p.cocokkan(teks, alamat.get('kode_pos'))['saran']
        return {'teks': teks, **h}
    h = p.cocokkan(teks, alamat.get('kode_pos'))
    return {'teks': teks, 'status': h['status'], 'kode_wilayah': h['kode_wilayah'], 'tingkat_cocok': h['tingkat_cocok'],
            'alasan': h['alasan'], 'saran': h['saran']}


async def laporan_pencocokan(database, jenis: str = 'semua', status: str = 'perlu', q: str = '') -> Dict:
    """-> {ringkasan: {total, cocok, sebagian, tidak_cocok, tanpa_alamat}, items: [...]} untuk siswa aktif & GTK.
    Ringkasan dihitung atas `jenis` (semua status); items disaring `status` ('perlu' = tidak_cocok+sebagian) & `q`."""
    from data_master_service import jenis_gtk
    from wilayah_master import BLOK_ALAMAT_SISWA, KOLOM_ALAMAT_GTK, KOLOM_ALAMAT_SISWA
    p = await pencocok(database)
    semua: List[Dict] = []
    aktif = {'mutation_type': {'$ne': 'keluar'}, 'is_active': {'$ne': False}}
    if jenis in ('semua', 'siswa'):
        siswa = await database.users.find({'roles': 'siswa', **aktif}, {'_id': 0, 'id': 1, 'full_name': 1, 'student_class_id': 1}).to_list(None)
        cids = list({s.get('student_class_id') for s in siswa if s.get('student_class_id')})
        kelas = {c['id']: c.get('name') for c in await database.classes.find({'id': {'$in': cids}}, {'_id': 0, 'id': 1, 'name': 1}).to_list(None)}
        detail = {d['student_id']: d async for d in database.student_details.find(
            {'student_id': {'$in': [s['id'] for s in siswa]}}, {'_id': 0, 'student_id': 1, **{b: 1 for b in BLOK_ALAMAT_SISWA}})}
        for s in siswa:
            d = detail.get(s['id']) or {}
            for blok in ('alamat_ayah', 'alamat_ibu', 'alamat_wali', 'alamat_siswa'):
                a = d.get(blok)
                if blok == 'alamat_ibu' and isinstance(a, dict) and a.get('sama_dengan_ayah'):
                    continue
                kosong = not isinstance(a, dict) or not any(str(a.get(KOLOM_ALAMAT_SISWA[t]) or '').strip() for t in _FIELD_NAMA)
                if kosong and blok != 'alamat_ayah':
                    continue  # blok tambahan tanpa isian tidak dilaporkan; alamat ayah = alamat utama
                h = baris_laporan(p, a or {}, KOLOM_ALAMAT_SISWA)
                if h:
                    semua.append({'id': s['id'], 'jenis': 'siswa', 'nama': s.get('full_name') or '-',
                                  'keterangan': f"Kelas {kelas[s['student_class_id']]}" if kelas.get(s.get('student_class_id')) else '',
                                  'blok': blok, 'label_blok': LABEL_BLOK[blok], **h})
    if jenis in ('semua', 'gtk'):
        from routers._shared import _GTK_ROLES
        proj = {'_id': 0, 'id': 1, 'full_name': 1, 'roles': 1, 'kode_wilayah': 1, 'kode_pos': 1, **{f: 1 for f in KOLOM_ALAMAT_GTK.values()}}
        async for u in database.users.find({'roles': {'$in': list(_GTK_ROLES), '$nin': ['siswa']}, **aktif}, proj):
            h = baris_laporan(p, u, KOLOM_ALAMAT_GTK)
            if h:
                semua.append({'id': u['id'], 'jenis': 'gtk', 'nama': u.get('full_name') or '-',
                              'keterangan': {'guru': 'Guru', 'tendik': 'Tendik'}.get(jenis_gtk(u), ''),
                              'blok': 'tempat_tinggal', 'label_blok': LABEL_BLOK['tempat_tinggal'], **h})
    ringkasan = {'total': len(semua), 'cocok': 0, 'sebagian': 0, 'tidak_cocok': 0, 'tanpa_alamat': 0}
    for it in semua:
        ringkasan[it['status']] += 1
    kunci_q = str(q or '').strip().lower()
    items = [it for it in semua
             if (status == 'semua' or (it['status'] in ('tidak_cocok', 'sebagian') if status == 'perlu' else it['status'] == status))
             and (not kunci_q or kunci_q in ' '.join([it['nama'], it['keterangan'], *it['teks'].values()]).lower())]
    urut = {'tidak_cocok': 0, 'sebagian': 1, 'tanpa_alamat': 2, 'cocok': 3}
    items.sort(key=lambda it: (urut[it['status']], it['jenis'], it['nama'].lower(), it['blok']))
    return {'ringkasan': ringkasan, 'items': items, 'master_kosong': p.kosong}


async def terapkan_perbaikan(database, items: List[Dict], oleh: Optional[str] = None) -> Dict:
    """Simpan perbaikan wilayah per baris laporan: [{id, jenis, blok, kode_wilayah, kode_pos?}].
    Nama semua tingkat diambil dari master sesuai kode (tingkat di bawah kode dikosongkan), kode pos dari
    kiriman atau dari desa. -> {berhasil, gagal, hasil: [{id, blok, status, pesan?, baris?}]}"""
    from data_master_service import jenis_gtk
    from wilayah_master import BLOK_ALAMAT_SISWA, KOLOM_ALAMAT_GTK, KOLOM_ALAMAT_SISWA
    from journal_core import now_wib
    p = await pencocok(database)
    hasil = []
    for it in items:
        uid, jenis, blok = it.get('id'), it.get('jenis'), it.get('blok')
        kode = str(it.get('kode_wilayah') or '').strip()
        out = {'id': uid, 'blok': blok}

        def gagal(pesan):
            hasil.append({**out, 'status': 'gagal', 'pesan': pesan})

        if jenis == 'gtk' and blok != 'tempat_tinggal' or jenis == 'siswa' and blok not in BLOK_ALAMAT_SISWA or jenis not in ('siswa', 'gtk'):
            gagal('Jenis/blok alamat tidak dikenal'); continue
        if kode not in p.doc:
            gagal(f'Kode wilayah {kode or "(kosong)"} tidak ada di master'); continue
        user = await database.users.find_one({'id': uid}, {'_id': 0, 'id': 1, 'full_name': 1, 'roles': 1, 'student_class_id': 1,
                                                           'kode_pos': 1, **{f: 1 for f in KOLOM_ALAMAT_GTK.values()}})
        roles = (user or {}).get('roles') or []
        if not user or (jenis == 'siswa') != ('siswa' in roles):
            gagal('Data siswa/GTK tidak ditemukan'); continue
        kolom = KOLOM_ALAMAT_GTK if jenis == 'gtk' else KOLOM_ALAMAT_SISWA
        rantai = p.rantai(kode)
        ubah = {kolom[t]: (rantai[t]['nama'] if rantai[t] else '') for t in _FIELD_NAMA}
        ubah['kode_wilayah'] = kode
        kp = re.sub(r'\D', '', str(it.get('kode_pos') or ''))
        if kp and len(kp) == 5:
            ubah['kode_pos'] = kp
        elif rantai['desa'] and rantai['desa'].get('kode_pos'):
            ubah['kode_pos'] = rantai['desa']['kode_pos']
        if jenis == 'gtk':
            await database.users.update_one({'id': uid}, {'$set': {**ubah, 'updated_at': now_wib().isoformat()}})
            alamat = {**user, **ubah}
            ket = {'guru': 'Guru', 'tendik': 'Tendik'}.get(jenis_gtk(user), '')
        else:
            detail = await database.student_details.find_one({'student_id': uid}, {'_id': 0, blok: 1}) or {}
            lama = detail.get(blok) if isinstance(detail.get(blok), dict) else None
            set_ = {f'{blok}.{k}': v for k, v in ubah.items()} if lama is not None else {blok: ubah}
            await database.student_details.update_one(
                {'student_id': uid},
                {'$set': {**set_, 'updated_at': now_wib().isoformat(), 'updated_by': oleh},
                 '$setOnInsert': {'student_id': uid}}, upsert=True)
            alamat = {**(lama or {}), **ubah}
            kelas = await database.classes.find_one({'id': user.get('student_class_id')}, {'_id': 0, 'name': 1}) if user.get('student_class_id') else None
            ket = f"Kelas {kelas['name']}" if kelas and kelas.get('name') else ''
        baris = baris_laporan(p, alamat, kolom)
        hasil.append({**out, 'status': 'berhasil', 'baris': {'id': uid, 'jenis': jenis, 'nama': user.get('full_name') or '-', 'keterangan': ket,
                                                              'blok': blok, 'label_blok': LABEL_BLOK[blok], **baris}})
    berhasil = sum(1 for h in hasil if h['status'] == 'berhasil')
    return {'berhasil': berhasil, 'gagal': len(hasil) - berhasil, 'hasil': hasil}
