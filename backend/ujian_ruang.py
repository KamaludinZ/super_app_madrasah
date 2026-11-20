"""Ujian Madrasah — Ruang & Peserta: skema, aturan murni, dan jejak audit plotting.

Dokumen `ruang_ujian` (satu ruang pada satu ujian):
    id, ujian_id, nama_ruang ('01'), nama_kunci (huruf kecil, untuk unik per ujian), jenjang [7, 8] (1–2 jenjang),
    kapasitas (1–60), keterangan, dibuat_oleh, dibuat_pada, diperbarui_pada
    Unik: (ujian_id, nama_kunci).

Dokumen `peserta_ruang` (satu siswa pada satu ujian — berlaku untuk SELURUH hari/sesi ujian):
    id, ujian_id, ruang_id, siswa_id, nama, nis, nisn, kelas, kelas_id, jenjang, nomor_peserta, nomor_kunci
    (nomor huruf besar; None bila kosong), sumber ('input' | 'impor_template'), ditetapkan_oleh(_nama), ditetapkan_pada,
    diperbarui_pada
    Unik: (ujian_id, siswa_id) dan (ujian_id, nomor_kunci) bila nomor terisi (partial index).

Dokumen `ujian_jejak` (jejak audit plotting ruang & peserta, hanya-tambah):
    id, ujian_id, aksi, oleh, oleh_nama, waktu, ringkasan, alasan, detail

Dokumen `guru_pengawas` (master pilihan pengawas, berlaku untuk semua ujian; TANPA plotting per ruang):
    id, user_id (unik), nama, nip, peran, aktif, ditambahkan_oleh, ditambahkan_pada, diperbarui_pada
"""
import re
import uuid
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

from pydantic import BaseModel, Field, field_validator

from ujian import KOLEKSI_PESERTA, KOLEKSI_RUANG, sekarang_wib

KOLEKSI_JEJAK = 'ujian_jejak'
KOLEKSI_PENGAWAS = 'guru_pengawas'
KOLEKSI_BERITA_ACARA = 'berita_acara'  # dipakai menghitung pengawas yang sudah mengisi berita acara
PENGAWAS_TAMBAH_MAKS = 200

JENJANG_SAH = (7, 8, 9)
KAPASITAS_MAKS = 60
KAPASITAS_BAWAAN = 32
NAMA_RUANG_MAKS = 40
KETERANGAN_RUANG_MAKS = 120
NOMOR_PESERTA_MAKS = 30
ALASAN_PINDAH_MIN = 5
POLA_NOMOR = re.compile(r'^[A-Za-z0-9][A-Za-z0-9./-]*$')

AKSI_JEJAK = ('ruang_tambah', 'ruang_ubah', 'ruang_hapus', 'peserta_tambah', 'peserta_hapus', 'peserta_pindah',
              'nomor_ubah', 'impor_template')

INDEX_RUANG = [
    (KOLEKSI_RUANG, [('id', 1)], {'unique': True}),
    (KOLEKSI_RUANG, [('ujian_id', 1), ('nama_kunci', 1)], {'unique': True, 'name': 'ruang_unik_nama'}),
    (KOLEKSI_PESERTA, [('id', 1)], {'unique': True}),
    (KOLEKSI_PESERTA, [('ujian_id', 1), ('siswa_id', 1)], {'unique': True, 'name': 'peserta_unik_siswa'}),
    (KOLEKSI_PESERTA, [('ujian_id', 1), ('nomor_kunci', 1)],
     {'unique': True, 'name': 'peserta_unik_nomor', 'partialFilterExpression': {'nomor_kunci': {'$type': 'string'}}}),
    (KOLEKSI_PESERTA, [('ruang_id', 1), ('nomor_kunci', 1)], {}),
    (KOLEKSI_JEJAK, [('id', 1)], {'unique': True}),
    (KOLEKSI_JEJAK, [('ujian_id', 1), ('waktu', -1)], {}),
    (KOLEKSI_PENGAWAS, [('id', 1)], {'unique': True}),
    (KOLEKSI_PENGAWAS, [('user_id', 1)], {'unique': True}),
]


async def pastikan_index_ruang(db) -> None:
    for koleksi, keys, opsi in INDEX_RUANG:
        await db[koleksi].create_index(keys, **opsi)


# ---- Isian ----
class RuangIn(BaseModel):
    """Ruang ujian (POST/PUT /ujian/{id}/ruang). Sama dengan skema FormRuangDialog frontend."""
    nama_ruang: str = Field(..., min_length=1, max_length=NAMA_RUANG_MAKS)
    jenjang: List[int] = Field(..., min_length=1, max_length=2)
    kapasitas: int = Field(KAPASITAS_BAWAAN, ge=1, le=KAPASITAS_MAKS)
    keterangan: str = Field('', max_length=KETERANGAN_RUANG_MAKS)

    @field_validator('nama_ruang', 'keterangan')
    @classmethod
    def _rapikan(cls, v):
        return ' '.join((v or '').split())

    @field_validator('nama_ruang')
    @classmethod
    def _nama_wajib(cls, v):
        if not v:
            raise ValueError('Nama/nomor ruang wajib diisi')
        return v

    @field_validator('jenjang')
    @classmethod
    def _jenjang_sah(cls, v):
        if any(j not in JENJANG_SAH for j in v):
            raise ValueError('Jenjang hanya 7, 8, atau 9')
        if len(set(v)) != len(v):
            raise ValueError('Jenjang tidak boleh ganda')
        return sorted(v)


def kunci_nama(nama: str) -> str:
    return ' '.join((nama or '').split()).lower()


def kunci_nomor(nomor: Optional[str]) -> Optional[str]:
    n = (nomor or '').strip().upper()
    return n or None


def galat_format_nomor(nomor: Optional[str]) -> str:
    """'' bila sah atau kosong (sama dengan galatFormatNomor frontend)."""
    n = (nomor or '').strip()
    if not n:
        return ''
    if len(n) > NOMOR_PESERTA_MAKS:
        return f'Maksimal {NOMOR_PESERTA_MAKS} karakter'
    if not POLA_NOMOR.match(n):
        return 'Hanya huruf, angka, titik, garis miring, dan tanda minus'
    return ''


# ---- Dokumen ----
def dokumen_ruang_baru(ujian_id: str, isi: RuangIn, oleh: Dict[str, Any], waktu: datetime = None) -> Dict[str, Any]:
    t = (waktu or sekarang_wib()).isoformat()
    return {
        'id': str(uuid.uuid4()), 'ujian_id': ujian_id, 'nama_ruang': isi.nama_ruang, 'nama_kunci': kunci_nama(isi.nama_ruang),
        'jenjang': isi.jenjang, 'kapasitas': isi.kapasitas, 'keterangan': isi.keterangan,
        'dibuat_oleh': oleh.get('id'), 'dibuat_pada': t, 'diperbarui_pada': t,
    }


def ringkas_ruang(doc: Dict[str, Any], per_jenjang: Optional[Dict[int, int]] = None) -> Dict[str, Any]:
    """Ruang untuk antarmuka (kontrak `Ruang` di frontend/src/lib/ujianRuang.js)."""
    per = {str(j): int((per_jenjang or {}).get(j, 0)) for j in doc.get('jenjang', [])}
    return {
        'id': doc['id'], 'ujian_id': doc.get('ujian_id'), 'nama_ruang': doc.get('nama_ruang'),
        'jenjang': doc.get('jenjang', []), 'kapasitas': doc.get('kapasitas', KAPASITAS_BAWAAN),
        'keterangan': doc.get('keterangan') or '', 'per_jenjang': per, 'jumlah_peserta': sum(per.values()),
    }


def urut_nama_ruang(nama: str):
    """Kunci urut alami: '2' < '10', 'Lab A' setelah angka."""
    return [int(x) if x.isdigit() else x.lower() for x in re.split(r'(\d+)', nama or '')]


def jenjang_terlepas(lama: Iterable[int], baru: Iterable[int], per_jenjang: Dict[int, int]) -> List[int]:
    """Jenjang yang dilepas dari ruang padahal masih berisi peserta."""
    baru = set(baru)
    return sorted(j for j in lama if j not in baru and per_jenjang.get(j, 0) > 0)


def dokumen_jejak(ujian_id: str, aksi: str, oleh: Dict[str, Any], ringkasan: str, alasan: Optional[str] = None,
                  detail: Optional[Dict[str, Any]] = None, waktu: datetime = None) -> Dict[str, Any]:
    return {
        'id': str(uuid.uuid4()), 'ujian_id': ujian_id, 'aksi': aksi, 'oleh': oleh.get('id'),
        'oleh_nama': oleh.get('full_name') or oleh.get('username'), 'waktu': (waktu or sekarang_wib()).isoformat(),
        'ringkasan': ringkasan, 'alasan': alasan, 'detail': detail or {},
    }


async def catat_jejak(db, ujian_id: str, aksi: str, oleh: Dict[str, Any], ringkasan: str, alasan: Optional[str] = None,
                      detail: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    doc = dokumen_jejak(ujian_id, aksi, oleh, ringkasan, alasan, detail)
    await db[KOLEKSI_JEJAK].insert_one(dict(doc))
    return doc


def ringkas_jejak(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {k: doc.get(k) for k in ('id', 'aksi', 'oleh_nama', 'waktu', 'ringkasan', 'alasan')}


# ---- Master guru pengawas ----
class PengawasTambahIn(BaseModel):
    user_ids: List[str] = Field(..., min_length=1, max_length=PENGAWAS_TAMBAH_MAKS)


class PengawasAktifIn(BaseModel):
    aktif: bool


def dokumen_pengawas(pejabat: Dict[str, Any], oleh: Dict[str, Any], waktu: datetime = None) -> Dict[str, Any]:
    """Satu baris guru_pengawas dari identitas GTK (ujian.identitas_pejabat)."""
    t = (waktu or sekarang_wib()).isoformat()
    return {
        'id': str(uuid.uuid4()), 'user_id': pejabat['user_id'], 'nama': pejabat.get('nama'), 'nip': pejabat.get('nip'),
        'peran': pejabat.get('peran'), 'aktif': True, 'ditambahkan_oleh': oleh.get('id'), 'ditambahkan_pada': t,
        'diperbarui_pada': t,
    }


def ringkas_pengawas(doc: Dict[str, Any], dipakai: int = 0, akun: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Pengawas untuk antarmuka; nama/NIP terkini dari akun bila ada (salinan dokumen sebagai cadangan)."""
    a = akun or {}
    return {
        'id': doc['id'], 'user_id': doc.get('user_id'), 'nama': a.get('nama') or doc.get('nama'),
        'nip': a.get('nip') or doc.get('nip') or '-', 'peran': a.get('peran') or doc.get('peran'),
        'aktif': bool(doc.get('aktif', True)), 'dipakai': dipakai, 'ditambahkan_pada': doc.get('ditambahkan_pada'),
    }


# ---- Peserta ruang ----
PESERTA_TAMBAH_MAKS = 60
FIELD_PESERTA = ('id', 'ruang_id', 'siswa_id', 'nama', 'nis', 'nisn', 'kelas', 'kelas_id', 'jenjang', 'nomor_peserta', 'sumber',
                 'ditetapkan_pada', 'ditetapkan_oleh_nama', 'nomor_peserta_um')


class PesertaTambahIn(BaseModel):
    siswa_ids: List[str] = Field(..., min_length=1, max_length=PESERTA_TAMBAH_MAKS)


def dokumen_peserta(ujian_id: str, ruang_id: str, siswa: Dict[str, Any], oleh: Dict[str, Any], sumber: str = 'input',
                    nomor: Optional[str] = None, waktu: datetime = None) -> Dict[str, Any]:
    """Satu baris peserta_ruang. `siswa` = hasil siswa_semester (identitas & rombel saat ditempatkan)."""
    t = (waktu or sekarang_wib()).isoformat()
    nomor = (nomor or '').strip()
    return {
        'id': str(uuid.uuid4()), 'ujian_id': ujian_id, 'ruang_id': ruang_id, 'siswa_id': siswa['id'],
        'nama': siswa.get('full_name'), 'nis': siswa.get('nis') or '', 'nisn': siswa.get('nisn') or '',
        'kelas': siswa.get('kelas'), 'kelas_id': siswa.get('kelas_id'), 'jenjang': siswa.get('jenjang'),
        'nomor_peserta_um': siswa.get('nomor_peserta_ujian') or '',
        'nomor_peserta': nomor, 'nomor_kunci': kunci_nomor(nomor), 'sumber': sumber,
        'ditetapkan_oleh': oleh.get('id'), 'ditetapkan_oleh_nama': oleh.get('full_name') or oleh.get('username'),
        'ditetapkan_pada': t, 'diperbarui_pada': t,
    }


def ringkas_peserta(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {k: doc.get(k) for k in FIELD_PESERTA}


def kunci_urut_peserta(p: Dict[str, Any]):
    """Urut nomor peserta (yang kosong di akhir), lalu kelas & nama — sama dengan urutPeserta frontend."""
    n = p.get('nomor_peserta') or ''
    return (n == '', urut_nama_ruang(n), p.get('kelas') or '', (p.get('nama') or '').lower())


def alasan_tolak_penempatan(siswa: Optional[Dict[str, Any]], ruang: Dict[str, Any], ruang_sekarang: Optional[str],
                            sisa_kursi: int) -> Optional[str]:
    """Alasan siswa tidak dapat ditempatkan di ruang ini, atau None."""
    if not siswa:
        return 'Siswa tidak ditemukan di data induk semester ujian ini'
    if ruang_sekarang == ruang['id']:
        return 'Sudah berada di ruang ini'
    if ruang_sekarang:
        return 'Sudah terdaftar di ruang lain pada ujian ini'
    if siswa.get('jenjang') not in ruang.get('jenjang', []):
        return f"Kelas {siswa.get('jenjang')} bukan jenjang ruang ini"
    if sisa_kursi <= 0:
        return 'Kapasitas ruang penuh'
    return None


# ---- Pemindahan antar ruang (anti-duplikat: satu siswa tetap SATU baris peserta per ujian) ----
class PindahIn(BaseModel):
    ruang_id: str = Field(..., min_length=1)
    alasan: str = Field(..., max_length=200)

    @field_validator('alasan')
    @classmethod
    def _alasan_wajib(cls, v):
        v = ' '.join((v or '').split())
        if len(v) < ALASAN_PINDAH_MIN:
            raise ValueError(f'Alasan pemindahan minimal {ALASAN_PINDAH_MIN} karakter')
        return v


def alasan_tolak_pindah(peserta: Dict[str, Any], tujuan: Dict[str, Any], terisi_tujuan: int) -> Optional[str]:
    if peserta.get('ruang_id') == tujuan['id']:
        return 'Ruang tujuan sama dengan ruang sekarang'
    if peserta.get('jenjang') not in tujuan.get('jenjang', []):
        return f"Ruang {tujuan.get('nama_ruang')} tidak memuat kelas {peserta.get('jenjang')}"
    if terisi_tujuan >= tujuan.get('kapasitas', 0):
        return f"Ruang {tujuan.get('nama_ruang')} sudah penuh"
    return None


async def pindahkan_peserta(db, peserta: Dict[str, Any], asal: Dict[str, Any], tujuan: Dict[str, Any], oleh: Dict[str, Any],
                            alasan: str) -> Dict[str, Any]:
    """Pindahkan satu peserta ke ruang lain dengan MENGUBAH baris yang sama (bukan menambah baris baru), sehingga
    siswa tidak mungkin tercatat di dua ruang. Nomor peserta ikut pindah. Pembaruan bersyarat ruang asal (atomik):
    bila peserta sudah dipindah pengguna lain bersamaan, None dikembalikan."""
    t = sekarang_wib().isoformat()
    hasil = await db[KOLEKSI_PESERTA].update_one(
        {'id': peserta['id'], 'ruang_id': asal['id']},
        {'$set': {'ruang_id': tujuan['id'], 'diperbarui_pada': t}},
    )
    if not hasil.matched_count:
        return None
    await catat_jejak(db, peserta['ujian_id'], 'peserta_pindah', oleh,
                      f"{peserta.get('nama')} ({peserta.get('kelas')}): Ruang {asal.get('nama_ruang')} → Ruang {tujuan.get('nama_ruang')}",
                      alasan=alasan, detail={'peserta_id': peserta['id'], 'dari': asal['id'], 'ke': tujuan['id']})
    return {**peserta, 'ruang_id': tujuan['id'], 'diperbarui_pada': t}


# ---- Nomor peserta (unik per ujian) ----
class NomorItemIn(BaseModel):
    peserta_id: str = Field(..., min_length=1)
    nomor_peserta: str = Field('', max_length=100)


class NomorIn(BaseModel):
    items: List[NomorItemIn] = Field(..., min_length=1, max_length=KAPASITAS_MAKS)


def rencana_nomor(semua: List[Dict[str, Any]], ruang_id: str, items: List[Dict[str, str]]):
    """Validasi perubahan nomor satu ruang terhadap SELURUH peserta ujian (keadaan akhir, sehingga tukar nomor antar
    peserta dalam satu kiriman sah). -> (perubahan {peserta_id: nomor}, galat [{ peserta_id, nama, pesan }]).
    Baris bermasalah dilewati; baris lain tetap disimpan."""
    per_id = {p['id']: p for p in semua}
    galat, kandidat = [], {}
    for it in items:
        pid, nomor = it['peserta_id'], ' '.join((it.get('nomor_peserta') or '').split())
        p = per_id.get(pid)
        if not p or p.get('ruang_id') != ruang_id:
            galat.append({'peserta_id': pid, 'nama': (p or {}).get('nama') or pid, 'pesan': 'Peserta tidak ada di ruang ini'})
            continue
        pesan = galat_format_nomor(nomor)
        if pesan:
            galat.append({'peserta_id': pid, 'nama': p.get('nama'), 'pesan': pesan})
            continue
        if nomor != (p.get('nomor_peserta') or ''):
            kandidat[pid] = nomor
    # Keadaan akhir: nomor lama peserta lain + nomor baru kandidat.
    pemilik: Dict[str, List[str]] = {}
    for p in semua:
        n = kunci_nomor(kandidat.get(p['id'], p.get('nomor_peserta')))
        if n:
            pemilik.setdefault(n, []).append(p['id'])
    for pid, nomor in list(kandidat.items()):
        n = kunci_nomor(nomor)
        lain = [x for x in pemilik.get(n, []) if x != pid] if n else []
        if lain:
            nama_lain = per_id[lain[0]].get('nama')
            galat.append({'peserta_id': pid, 'nama': per_id[pid].get('nama'), 'pesan': f'No. Peserta {nomor} sudah dipakai {nama_lain}'})
            del kandidat[pid]
    return kandidat, galat


async def terapkan_nomor(db, perubahan: Dict[str, str]) -> List[str]:
    """Tulis nomor baru: kosongkan dulu nomor_kunci semua baris yang berubah, lalu isi, agar tukar nomor tidak bentrok
    dengan index unik. Mengembalikan peserta_id yang gagal karena bentrok bersamaan (DuplicateKeyError)."""
    from pymongo.errors import DuplicateKeyError
    if not perubahan:
        return []
    t = sekarang_wib().isoformat()
    for pid in perubahan:
        await db[KOLEKSI_PESERTA].update_one({'id': pid}, {'$set': {'nomor_kunci': None}})
    gagal = []
    for pid, nomor in perubahan.items():
        try:
            await db[KOLEKSI_PESERTA].update_one({'id': pid}, {'$set': {
                'nomor_peserta': nomor, 'nomor_kunci': kunci_nomor(nomor), 'sumber': 'input', 'diperbarui_pada': t}})
        except DuplicateKeyError:
            gagal.append(pid)
    return gagal


# ---- Penetapan sekali untuk seluruh ujian ----
# Penempatan ruang & nomor peserta disimpan SATU kali per (ujian, siswa) — tidak ada data penempatan per sesi/hari.
# Semua modul berikutnya (daftar hadir publik, berita acara, cetak) membaca peserta lewat fungsi di bawah ini, sehingga
# setiap sesi selama masa ujian otomatis memakai ruang & nomor yang sama.
async def peserta_ruang_ujian(db, ujian_id: str, ruang_id: str, jenjang: Optional[int] = None) -> List[Dict[str, Any]]:
    """Peserta satu ruang (opsional satu jenjang), urut nomor peserta lalu kelas & nama — sama untuk setiap sesi."""
    q: Dict[str, Any] = {'ujian_id': ujian_id, 'ruang_id': ruang_id}
    if jenjang is not None:
        q['jenjang'] = jenjang
    docs = await db[KOLEKSI_PESERTA].find(q, {'_id': 0}).to_list(500)
    return sorted((ringkas_peserta(d) for d in docs), key=kunci_urut_peserta)


async def penempatan_siswa(db, ujian_id: str, siswa_id: str) -> Optional[Dict[str, Any]]:
    """Ruang & nomor peserta seorang siswa pada satu ujian (berlaku untuk semua sesi), atau None."""
    p = await db[KOLEKSI_PESERTA].find_one({'ujian_id': ujian_id, 'siswa_id': siswa_id}, {'_id': 0})
    if not p:
        return None
    r = await db[KOLEKSI_RUANG].find_one({'id': p['ruang_id']}, {'_id': 0, 'id': 1, 'nama_ruang': 1, 'jenjang': 1})
    return {'peserta': ringkas_peserta(p), 'ruang': r}


def kesiapan_plotting(ruang: List[Dict[str, Any]], peserta: List[Dict[str, Any]], belum_ditempatkan: int) -> Dict[str, Any]:
    """Kesiapan penetapan sekali-untuk-seluruh-ujian: ruang kosong, peserta tanpa nomor, siswa belum ditempatkan."""
    isi = {p.get('ruang_id') for p in peserta}
    tanpa_nomor = sum(1 for p in peserta if not p.get('nomor_peserta'))
    kosong = [r.get('nama_ruang') for r in ruang if r['id'] not in isi]
    return {
        'ruang_kosong': kosong,
        'tanpa_nomor': tanpa_nomor,
        'belum_ditempatkan': belum_ditempatkan,
        'siap': bool(ruang) and bool(peserta) and not kosong and not tanpa_nomor and not belum_ditempatkan,
    }
