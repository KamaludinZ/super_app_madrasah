"""Susunan kolom baku Data CKG dan pemetaan data CKG + identitas pasien ke kolom tersebut.

Urutan & judul kolom HARUS identik dengan frontend/src/lib/ckgKolom.js:
NO, Nama Lengkap, NIK, Nama Sekolah, Tgl Lahir, Jenis Kelamin, Alamat Lengkap, BB, TB, TD,
Jumlah Karies, Visus Mata, Kesehatan Kulit, Fungsi Pendengaran, Hemoglobin, GDS.
"""
from typing import Any, Dict, List, Optional

KOLOM_CKG: List[Dict[str, Any]] = [
    {'key': 'no', 'label': 'NO', 'field': None},
    {'key': 'nama_lengkap', 'label': 'Nama Lengkap', 'field': 'pasien_nama'},
    {'key': 'nik', 'label': 'NIK', 'field': 'pasien_nik'},
    {'key': 'nama_sekolah', 'label': 'Nama Sekolah', 'field': 'nama_sekolah'},
    {'key': 'tgl_lahir', 'label': 'Tgl Lahir', 'field': 'pasien_tgl_lahir'},
    {'key': 'jenis_kelamin', 'label': 'Jenis Kelamin', 'field': 'pasien_jenis_kelamin'},
    {'key': 'alamat', 'label': 'Alamat Lengkap', 'field': 'pasien_alamat'},
    {'key': 'bb', 'label': 'BB', 'field': 'berat_badan', 'satuan': 'kg', 'angka': True},
    {'key': 'tb', 'label': 'TB', 'field': 'tinggi_badan', 'satuan': 'cm', 'angka': True},
    {'key': 'td', 'label': 'TD', 'field': 'tekanan_darah', 'satuan': 'mmHg'},
    {'key': 'jumlah_karies', 'label': 'Jumlah Karies', 'field': 'jumlah_karies', 'angka': True},
    {'key': 'visus_mata', 'label': 'Visus Mata', 'field': 'visus_mata'},
    {'key': 'kesehatan_kulit', 'label': 'Kesehatan Kulit', 'field': 'kesehatan_kulit'},
    {'key': 'fungsi_pendengaran', 'label': 'Fungsi Pendengaran', 'field': 'fungsi_pendengaran'},
    {'key': 'hemoglobin', 'label': 'Hemoglobin', 'field': 'hemoglobin', 'satuan': 'g/dL', 'angka': True},
    {'key': 'gds', 'label': 'GDS', 'field': 'gds', 'satuan': 'mg/dL', 'angka': True},
]

# Field hasil pemeriksaan baku yang disimpan pada dokumen uks_ckg (selain TB/BB/TD yang sudah ada).
FIELD_PEMERIKSAAN_BAKU = ('jumlah_karies', 'visus_mata', 'kesehatan_kulit', 'fungsi_pendengaran', 'hemoglobin', 'gds')

LABEL_JK = {'L': 'Laki-laki', 'P': 'Perempuan'}


def _teks(v: Any) -> str:
    return str(v).strip() if v not in (None, '') else ''


def susun_alamat(bagian: List[Any], rt: Any = None, rw: Any = None) -> str:
    """Gabungkan alamat jalan, RT/RW, desa, kecamatan, kab/kota, provinsi tanpa bagian kosong."""
    jalan, *wilayah = [_teks(b) for b in bagian]
    rtrw = ''
    if _teks(rt) or _teks(rw):
        rtrw = f"RT {_teks(rt) or '-'}/RW {_teks(rw) or '-'}"
    potong = [jalan, rtrw, *wilayah]
    return ', '.join(p for p in potong if p)


def alamat_siswa(detail: Optional[Dict], user: Dict) -> str:
    """Alamat siswa: alamat_siswa (bila ada) -> alamat orang tua tempat tinggal -> users.address."""
    detail = detail or {}
    status = _teks((detail.get('alamat_siswa') or {}).get('status_tempat_tinggal')).lower()
    urutan = ['alamat_siswa']
    if 'ibu' in status:
        urutan += ['alamat_ibu', 'alamat_ayah']
    elif 'wali' in status:
        urutan += ['alamat_wali', 'alamat_ayah']
    else:
        urutan += ['alamat_ayah', 'alamat_ibu']
    for key in urutan:
        a = detail.get(key) or {}
        if key == 'alamat_ibu' and a.get('sama_dengan_ayah'):
            a = detail.get('alamat_ayah') or {}
        teks = susun_alamat([a.get('alamat'), a.get('kelurahan'), a.get('kecamatan'), a.get('kabupaten'), a.get('provinsi')],
                            a.get('rt'), a.get('rw'))
        if teks:
            return teks
    return _teks(user.get('address'))


def alamat_gtk(user: Dict) -> str:
    teks = susun_alamat([user.get('address'), user.get('kelurahan'), user.get('kecamatan'), user.get('kab_kota'), user.get('provinsi')],
                        user.get('rt'), user.get('rw'))
    return teks


def identitas_pasien(user: Optional[Dict], detail: Optional[Dict], kelas: Optional[str]) -> Dict[str, Any]:
    """Field identitas kolom baku CKG dari data pengguna (siswa: users + student_details; GTK: users)."""
    user = user or {}
    siswa = 'siswa' in (user.get('roles') or [])
    nik = (detail or {}).get('nik') if siswa else user.get('nik')
    return {
        'pasien_tipe': 'siswa' if siswa else 'gtk',
        'pasien_kelas': kelas if siswa else None,
        'pasien_nik': _teks(nik) or None,
        'pasien_tgl_lahir': _teks(user.get('birth_date'))[:10] or None,
        'pasien_jenis_kelamin': user.get('gender') if user.get('gender') in ('L', 'P') else None,
        'pasien_alamat': (alamat_siswa(detail, user) if siswa else alamat_gtk(user)) or None,
    }


async def lengkapi_identitas_ckg(db, items: List[Dict[str, Any]], nama_sekolah: Optional[str]) -> List[Dict[str, Any]]:
    """Tambahkan identitas pasien terkini & nama sekolah pada daftar data CKG (batch, tanpa N+1 query).
    Nilai tersimpan pada dokumen CKG (mis. hasil impor) diutamakan bila identitas pengguna kosong."""
    ids = list({i.get('pasien_id') for i in items if i.get('pasien_id')})
    users = {u['id']: u for u in await db.users.find(
        {'id': {'$in': ids}},
        {'_id': 0, 'id': 1, 'roles': 1, 'nik': 1, 'birth_date': 1, 'gender': 1, 'address': 1, 'kelurahan': 1, 'kecamatan': 1,
         'kab_kota': 1, 'provinsi': 1, 'rt': 1, 'rw': 1, 'student_class_id': 1}).to_list(len(ids) or 1)}
    sids = [u['id'] for u in users.values() if 'siswa' in (u.get('roles') or [])]
    details = {d['student_id']: d for d in await db.student_details.find(
        {'student_id': {'$in': sids}},
        {'_id': 0, 'student_id': 1, 'nik': 1, 'alamat_siswa': 1, 'alamat_ayah': 1, 'alamat_ibu': 1, 'alamat_wali': 1}).to_list(len(sids) or 1)}
    cids = list({u.get('student_class_id') for u in users.values() if u.get('student_class_id')})
    kelas = {c['id']: c.get('name') for c in await db.classes.find({'id': {'$in': cids}}, {'_id': 0, 'id': 1, 'name': 1}).to_list(len(cids) or 1)}
    hasil = []
    for item in items:
        u = users.get(item.get('pasien_id'))
        ident = identitas_pasien(u, details.get(item.get('pasien_id')), kelas.get((u or {}).get('student_class_id'))) if u else {}
        baru = dict(item)
        for k, v in ident.items():
            if v not in (None, '') or not baru.get(k):
                baru[k] = v if v not in (None, '') else baru.get(k)
        if not ident and not baru.get('pasien_tipe'):
            baru['pasien_tipe'] = 'siswa' if 'siswa' in (item.get('pasien_roles') or []) else 'gtk'
        baru['nama_sekolah'] = baru.get('nama_sekolah') or nama_sekolah
        hasil.append(baru)
    return hasil


def baris_kolom_baku(item: Dict[str, Any], index: int) -> List[Any]:
    """Satu baris nilai sesuai urutan KOLOM_CKG (dipakai template/ekspor)."""
    baris = []
    for k in KOLOM_CKG:
        if k['key'] == 'no':
            baris.append(index + 1)
            continue
        v = item.get(k['field'])
        if k['key'] == 'jenis_kelamin':
            v = LABEL_JK.get(v, v)
        baris.append('' if v is None else v)
    return baris


# ------------------------------------------------------------
# PERAPIAN DATA CKG LAMA KE KOLOM BAKU
# ------------------------------------------------------------
import re as _re  # noqa: E402

_POLA_VISUS = _re.compile(r'\b(\d{1,2})\s*/\s*(\d{1,3})\b')
_POLA_KARIES = _re.compile(r'(\d{1,2})\s*(?:gigi\s*)?(?:karies|berlubang|lubang)|(?:karies|berlubang|lubang)\D{0,12}(\d{1,2})', _re.I)
_TANPA_KARIES = _re.compile(r'\b(tidak ada|tanpa|bebas)\s+(karies|lubang|gigi berlubang)\b|^\s*(normal|baik|sehat)\s*$', _re.I)


def tebak_visus(teks: Any) -> Optional[str]:
    """Ambil nilai visus (mis. '6/6', '6/12') dari catatan pemeriksaan mata lama bila ada."""
    m = _POLA_VISUS.search(_teks(teks))
    return f'{m.group(1)}/{m.group(2)}' if m else None


def tebak_karies(teks: Any) -> Optional[int]:
    """Jumlah karies dari catatan pemeriksaan gigi lama: angka di dekat kata karies/lubang,
    0 bila tertulis tidak ada karies / normal; None bila tidak dapat dipastikan."""
    t = _teks(teks)
    if not t:
        return None
    m = _POLA_KARIES.search(t)
    if m:
        n = int(m.group(1) or m.group(2))
        return n if 0 <= n <= 32 else None
    if _TANPA_KARIES.search(t):
        return 0
    return None


def rencana_perapian_ckg(doc: Dict[str, Any], user: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Field yang perlu ditambahkan pada satu dokumen CKG lama agar masuk susunan kolom baku.
    Tidak pernah menghapus atau mengubah isi lama: hanya mengisi field baku yang belum ada.
    - Field pemeriksaan baku yang belum ada diisi None (atau hasil tebakan dari catatan lama).
    - Salinan tipe pasien (siswa/gtk) ditambahkan bila belum ada."""
    set_: Dict[str, Any] = {}
    for f in FIELD_PEMERIKSAAN_BAKU:
        if f not in doc:
            set_[f] = None
    if 'visus_mata' not in doc:
        v = tebak_visus(doc.get('pemeriksaan_mata'))
        if v:
            set_['visus_mata'] = v
    if 'jumlah_karies' not in doc:
        k = tebak_karies(doc.get('pemeriksaan_gigi'))
        if k is not None:
            set_['jumlah_karies'] = k
    if not doc.get('pasien_tipe'):
        roles = (user or {}).get('roles') or doc.get('pasien_roles') or []
        set_['pasien_tipe'] = 'siswa' if 'siswa' in roles else 'gtk'
    if set_:
        set_['kolom_baku_dirapikan'] = True
    return set_


# Field CKG lama yang tidak punya padanan di kolom baku: tetap disimpan & ditampilkan sebagai
# "pemeriksaan lain" (tidak dihapus oleh perapian maupun penyimpanan ulang).
FIELD_LAMA_TANPA_KOLOM = [
    ('nadi', 'Nadi', 'bpm'), ('suhu', 'Suhu', '°C'), ('spo2', 'SpO2', '%'),
    ('pemeriksaan_mata', 'Pemeriksaan Mata', None), ('pemeriksaan_gigi', 'Pemeriksaan Gigi', None),
    ('kesimpulan', 'Kesimpulan', None), ('rekomendasi', 'Rekomendasi', None), ('keterangan', 'Keterangan', None),
]


def pemeriksaan_lain(item: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Daftar field lama yang terisi pada satu data CKG: [{field, label, nilai, satuan}]."""
    return [{'field': f, 'label': lab, 'nilai': item.get(f), 'satuan': sat}
            for f, lab, sat in FIELD_LAMA_TANPA_KOLOM if item.get(f) not in (None, '')]


# ------------------------------------------------------------
# SUSUNAN KOLOM TEMPLATE / IMPOR CKG (sama dengan frontend kolomTemplateCkg)
# ------------------------------------------------------------
KOLOM_BANTU_TEMPLATE_CKG: List[Dict[str, Any]] = [
    {'key': 'tanggal', 'label': 'Tanggal Periksa (YYYY-MM-DD)', 'field': 'tanggal'},
    {'key': 'pasien_id', 'label': 'ID Pasien (jangan diubah)', 'field': 'pasien_id', 'kunci': True},
]
KOLOM_IDENTITAS_CKG = ('nama_lengkap', 'nik', 'nama_sekolah', 'tgl_lahir', 'jenis_kelamin', 'alamat')


def kolom_template_ckg() -> List[Dict[str, Any]]:
    """16 kolom baku (judul + satuan dalam kurung) lalu kolom bantu tanggal & ID pasien."""
    hasil = []
    for k in KOLOM_CKG:
        grup = 'Identitas (terisi otomatis)' if k['key'] == 'no' or k['key'] in KOLOM_IDENTITAS_CKG else 'Hasil Pemeriksaan (diisi petugas)'
        hasil.append({**k, 'label': f"{k['label']} ({k['satuan']})" if k.get('satuan') else k['label'], 'grup': grup})
    hasil += [{**k, 'grup': 'Kolom bantu impor'} for k in KOLOM_BANTU_TEMPLATE_CKG]
    return hasil
