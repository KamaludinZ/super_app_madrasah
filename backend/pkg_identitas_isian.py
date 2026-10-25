"""Isian identitas guru untuk lampiran laporan PKG (pangkat, golongan, TMT golongan, jabatan fungsional, pendidikan
terakhir, spesialisasi) yang dapat dilengkapi langsung oleh guru itu sendiri, kepala madrasah, atau penilai yang
berwenang — tanpa verval profil GTK.

Aturan:
    - Guru: identitas dirinya sendiri (anggota SK aktif).
    - Kepala madrasah: semua guru dinilai dan penilai pada SK aktif.
    - Penilai: guru yang dibagikan kepadanya (cakupan rekap) dan dirinya sendiri.
    - Disimpan ke dokumen `users` dan ke `snapshot_anggota` SK aktif pada periode berjalan (cetak periode berjalan
      memakai nilai baru). Periode yang sudah ditutup tidak pernah disentuh: SK-nya tidak lagi berstatus aktif pada
      periode berjalan, sehingga snapshot-nya tetap utuh.
    - Perubahan tercatat di jejak audit (`identitas_ubah`: field, nilai lama -> baru).
Data EMIS/Profil (nama, NIP, lahir, dst.) hanya-baca di sini; ubah lewat Profil Saya.
"""
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException

from pkg_akses import keanggotaan_sk, sk_aktif, tolak
from pkg_audit import catat_audit_pkg
from pkg_identitas import FIELD_CADANGAN, FIELD_GTK, FIELD_PKG, identitas_orang, lengkapi_akun
from pkg_skema import KOLEKSI_SK

# (kunci identitas_orang, label, sumber): sumber 'emis' = hanya-baca dari EMIS/Profil, 'pkg' = isian PKG.
BUTIR = (
    ('nama', 'Nama', 'emis'), ('nip', 'NIP / Peg ID', 'emis'), ('nuptk', 'NUPTK / NRG', 'emis'),
    ('tempat_tanggal_lahir', 'Tempat, tanggal lahir', 'emis'), ('jenis_kelamin', 'Jenis kelamin', 'emis'),
    ('status_kepegawaian', 'Status kepegawaian', 'emis'), ('masa_kerja', 'Masa kerja', 'emis'),
    ('mapel', 'Mata pelajaran', 'emis'), ('tugas_tambahan', 'Tugas tambahan', 'emis'),
    ('pangkat', 'Pangkat', 'pkg'), ('golongan', 'Golongan', 'pkg'), ('tmt_golongan', 'TMT golongan', 'pkg'),
    ('jabatan', 'Jabatan fungsional', 'pkg'), ('pendidikan', 'Pendidikan terakhir', 'pkg'),
    ('spesialisasi', 'Spesialisasi', 'pkg'),
)

_PROYEKSI = {'_id': 0, 'id': 1, 'full_name': 1, 'nip_nuptk': 1, 'roles': 1, **{f: 1 for f in (*FIELD_GTK, *FIELD_CADANGAN)}}
_PERAN_TENDIK = {'tenaga_kependidikan', 'kepala_tata_usaha'}


async def tentukan_hak(db, user: Dict[str, Any], guru_id: str) -> Tuple[str, Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """(peran pengubah 'diri'|'kepala'|'penilai', periode, sk) atau HTTP 403 terstruktur."""
    k = await keanggotaan_sk(db, user)
    if not k['anggota']:
        raise tolak('bukan_anggota_sk')
    periode, sk = await sk_aktif(db)
    dinilai, penilai = set((sk or {}).get('dinilai_ids') or []), set((sk or {}).get('penilai_ids') or [])
    if guru_id == user['id']:
        return 'diri', periode, sk
    if k['peran'] == 'kepala':
        if sk and guru_id in dinilai | penilai:
            return 'kepala', periode, sk
        raise tolak('bukan_penugasan', 'Guru ini tidak terdaftar pada SK penilaian kinerja yang aktif.')
    if k['sebagai_penilai']:
        from pkg_rekap import cakupan_rekap
        cakupan = await cakupan_rekap(db, user, k, periode)
        if sk and guru_id in dinilai and cakupan['guru'] is not None and guru_id in cakupan['guru']:
            return 'penilai', periode, sk
        raise tolak('bukan_penugasan', 'Guru ini tidak dibagikan kepada Anda pada periode berjalan.')
    raise tolak('bukan_penilai', 'Anda hanya dapat melengkapi identitas diri sendiri.')


def _nilai_efektif(snap: Dict[str, Any], akun: Dict[str, Any]) -> Dict[str, str]:
    """Nilai isian PKG yang berlaku (snapshot periode dahulu, lalu akun + cadangan), untuk mengisi formulir."""
    a = lengkapi_akun(akun)
    return {f: str((snap or {}).get(f) or a.get(f) or '') for f in FIELD_PKG}


async def baca_identitas(db, guru_id: str, periode: Optional[Dict[str, Any]], sk: Optional[Dict[str, Any]],
                         peran_pengubah: str) -> Dict[str, Any]:
    akun = await db.users.find_one({'id': guru_id}, _PROYEKSI)
    snap = ((sk or {}).get('snapshot_anggota') or {}).get(guru_id) or {}
    if not akun and not snap:
        raise HTTPException(404, 'Guru tidak ditemukan.')
    ident = identitas_orang(snap, akun, (periode or {}).get('tanggal_tutup'))
    butir = [{'kunci': k, 'label': label, 'sumber': sumber, 'nilai': ident.get(k) or None, 'kosong': not ident.get(k)}
             for k, label, sumber in BUTIR]
    roles = set((akun or {}).get('roles') or [])
    return {
        'guru_id': guru_id, 'nama': ident.get('nama'),
        'periode': {k: (periode or {}).get(k) for k in ('id', 'nama_periode', 'status')},
        'butir': butir, 'isian_pkg': _nilai_efektif(snap, akun or {}),
        'kosong': [b['label'] for b in butir if b['kosong']],
        'kosong_pkg': [b['label'] for b in butir if b['kosong'] and b['sumber'] == 'pkg'],
        'diubah_sebagai': peran_pengubah,
        'jenis_gtk': 'tendik' if roles & _PERAN_TENDIK and not roles - _PERAN_TENDIK else 'guru',
    }


async def simpan_identitas(db, guru_id: str, data, user: Dict[str, Any], peran_pengubah: str,
                           periode: Optional[Dict[str, Any]], sk: Optional[Dict[str, Any]], request=None) -> List[str]:
    """Simpan isian PKG ke `users` dan snapshot SK aktif periode berjalan; kembalikan daftar field yang berubah."""
    akun = await db.users.find_one({'id': guru_id}, _PROYEKSI)
    if not akun:
        raise HTTPException(404, 'Akun guru tidak ditemukan.')
    snap = ((sk or {}).get('snapshot_anggota') or {}).get(guru_id) or {}
    lama = _nilai_efektif(snap, akun)
    kirim = {f: (getattr(data, f) or '') for f in data.model_fields_set if f in FIELD_PKG}
    berubah = {f: v for f, v in kirim.items() if v != lama.get(f, '')}
    if not berubah:
        return []
    atur = {f: v for f, v in berubah.items() if v}
    hapus = {f: '' for f, v in berubah.items() if not v}
    perintah: Dict[str, Any] = {}
    if atur:
        perintah['$set'] = atur
    if hapus:
        perintah['$unset'] = hapus
    await db.users.update_one({'id': guru_id}, perintah)
    # Snapshot SK aktif pada periode berjalan (sk_aktif hanya mengembalikan periode berstatus 'berjalan').
    if sk and periode and periode.get('status') == 'berjalan' and guru_id in (sk.get('snapshot_anggota') or {}):
        pre = f'snapshot_anggota.{guru_id}.'
        perintah_sk: Dict[str, Any] = {}
        if atur:
            perintah_sk['$set'] = {pre + f: v for f, v in atur.items()}
        if hapus:
            perintah_sk['$unset'] = {pre + f: '' for f in hapus}
        await db[KOLEKSI_SK].update_one({'id': sk['id']}, perintah_sk)
    await catat_audit_pkg(db, 'identitas_ubah', user, {
        'periode_id': (periode or {}).get('id'), 'guru_id': guru_id, 'sebagai': peran_pengubah,
        'field': list(berubah), 'perubahan': {f: [lama.get(f) or None, v or None] for f, v in berubah.items()}},
        request=request)
    return list(berubah)
