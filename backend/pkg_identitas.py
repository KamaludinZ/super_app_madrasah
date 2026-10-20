"""Lampiran identitas guru yang dinilai & tim penilai untuk berkas hasil PKG (sheet 00-DATA -> 02-IDNTY, COVER,
01-LAPORN, 04/05-RKAP, INDEK-HDIR, SEJAWAT melalui rumus template).

Sumber data berlapis, yang pertama tersedia dipakai:
    1. snapshot identitas periode pada SK (pkg_sk.snapshot_anggota: nama, NIP/Peg ID, mapel, dan identitas GTK yang
       disalin saat SK disusun) — agar cetak periode lama tetap utuh walau akun berubah/nonaktif;
    2. data GTK akun saat ini (tempat/tanggal lahir, jenis kelamin, NUPTK/NRG, TMT, tugas tambahan);
    3. pengaturan madrasah (nama, telepon, alamat, kota) dan kepala madrasah.
Field yang tidak tersedia di data GTK (pangkat/golongan, jabatan fungsional, pendidikan, spesialisasi) dicetak '-'.
"""
import re
from datetime import date
from typing import Any, Dict, List, Optional

from pkg_ambang import JENJANG

BULAN = ('Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November',
         'Desember')
# Field identitas GTK yang ikut disalin ke snapshot periode (lihat pkg_sk.identitas_akun).
FIELD_GTK = ('birth_place', 'birth_date', 'gender', 'nuptk', 'nrg', 'nip', 'peg_id', 'status_kepegawaian', 'tmt_pns',
             'tmt_guru', 'tmt_pegawai', 'tugas_tambahan', 'tugas_utama', 'jenis_ptk', 'pangkat', 'golongan', 'tmt_golongan',
             'jabatan_fungsional', 'pendidikan_terakhir', 'spesialisasi')


def _tanggal(nilai: Any) -> Optional[date]:
    try:
        return date.fromisoformat(str(nilai)[:10]) if nilai else None
    except ValueError:
        return None


def tanggal_teks(nilai: Any) -> Optional[str]:
    t = _tanggal(nilai)
    return f'{t.day} {BULAN[t.month - 1]} {t.year}' if t else None


def masa_kerja(tmt: Any, per: Any) -> Optional[str]:
    """'26 Tahun 8 Bulan' dari TMT sampai tanggal acuan (akhir periode)."""
    awal, akhir = _tanggal(tmt), _tanggal(per) or date.today()
    if not awal or awal > akhir:
        return None
    bulan = (akhir.year - awal.year) * 12 + akhir.month - awal.month - (1 if akhir.day < awal.day else 0)
    return f'{bulan // 12} Tahun {bulan % 12} Bulan'


def jenis_kelamin(nilai: Any) -> Optional[str]:
    v = str(nilai or '').strip().upper()
    return {'L': 'Laki-laki', 'P': 'Perempuan'}.get(v[:1]) if v else None


def kota_dari(pengaturan: Dict[str, Any]) -> Optional[str]:
    if pengaturan.get('city'):
        return pengaturan['city']
    m = re.search(r'\b((?:Kota|Kabupaten|Kab\.)\s+[A-Z][\w ]+)$', pengaturan.get('school_name') or '')
    return m.group(1).strip() if m else None


def identitas_orang(snap: Optional[Dict[str, Any]], akun: Optional[Dict[str, Any]], per: Any = None) -> Dict[str, Any]:
    """Identitas cetak satu orang dari snapshot periode (utama) dan akun GTK saat ini (pelengkap)."""
    s, a = snap or {}, akun or {}

    def ambil(*kunci):
        for k in kunci:
            for sumber in (s, a):
                if sumber.get(k):
                    return sumber[k]
        return None

    lahir = ', '.join(x for x in (ambil('birth_place'), tanggal_teks(ambil('birth_date'))) if x) or None
    return {
        'nama': ambil('nama', 'full_name'), 'nip': ambil('nip', 'nip_nuptk', 'peg_id'),
        'nuptk': ' / '.join(x for x in (ambil('nuptk'), ambil('nrg')) if x) or None, 'tempat_tanggal_lahir': lahir,
        'pangkat': ambil('pangkat'), 'golongan': ambil('golongan'), 'tmt_golongan': tanggal_teks(ambil('tmt_golongan')),
        'jabatan': ambil('jabatan_fungsional'), 'masa_kerja': masa_kerja(ambil('tmt_guru', 'tmt_pegawai', 'tmt_pns'), per),
        'jenis_kelamin': jenis_kelamin(ambil('gender')), 'pendidikan': ambil('pendidikan_terakhir'),
        'spesialisasi': ambil('spesialisasi'), 'mapel': ambil('mapel'), 'tugas_tambahan': ambil('tugas_tambahan'),
        'status_kepegawaian': ambil('status_kepegawaian'),
    }


async def _akun(db, ids: List[str]) -> Dict[str, Dict[str, Any]]:
    ids = [i for i in dict.fromkeys(ids) if i]
    if not ids:
        return {}
    proyeksi = {'_id': 0, 'id': 1, 'full_name': 1, 'nip_nuptk': 1, **{f: 1 for f in FIELD_GTK}}
    return {u['id']: u for u in await db.users.find({'id': {'$in': ids}}, proyeksi).to_list(len(ids))}


async def akun_kepala(db) -> Optional[Dict[str, Any]]:
    from pkg_akses import PERAN_KEPALA
    return await db.users.find_one({'roles': PERAN_KEPALA, 'is_active': {'$ne': False}},
                                   {'_id': 0, 'id': 1, 'full_name': 1, 'nip_nuptk': 1, **{f: 1 for f in FIELD_GTK}})


async def lampiran_identitas(db, periode: Dict[str, Any], sk: Optional[Dict[str, Any]], guru_id: str,
                             penilai_id: Optional[str], pengaturan: Dict[str, Any],
                             terkunci_pada: Optional[str] = None, snapshot_guru: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Lampiran identitas: guru yang dinilai, penilai lembar, kepala madrasah, madrasah, SK penugasan, periode, dan
    seluruh tim penilai SK beserta perannya. `snapshot_guru` = snapshot pada lembar penilaian (diutamakan)."""
    snap = (sk or {}).get('snapshot_anggota') or {}
    penilai_ids = list((sk or {}).get('penilai_ids') or [])
    kepala_akun = await akun_kepala(db)
    akun = await _akun(db, [guru_id, penilai_id, *penilai_ids, (kepala_akun or {}).get('id')])
    per = periode.get('tanggal_tutup')
    kepala_id = (kepala_akun or {}).get('id')
    kepala = identitas_orang(snap.get(kepala_id), akun.get(kepala_id) or kepala_akun, per)
    kepala['nama'] = pengaturan.get('headmaster_name') or kepala['nama']
    kepala['nip'] = next((x.get('nip') for x in pengaturan.get('leadership') or []
                          if 'kepala' in (x.get('position') or '').lower() and x.get('nip')), None) or kepala['nip']
    tim = [{'id': pid, **identitas_orang(snap.get(pid), akun.get(pid), per),
            'peran': 'Kepala madrasah (penilai)' if pid == kepala_id else 'Penilai',
            'penilai_lembar': pid == penilai_id} for pid in penilai_ids]
    tim.sort(key=lambda t: (not t['penilai_lembar'], t['peran'] != 'Penilai', (t['nama'] or '').lower()))
    return {
        'guru': {'id': guru_id, **identitas_orang({**(snap.get(guru_id) or {}), **{k: v for k, v in (snapshot_guru or {}).items() if v}},
                                                  akun.get(guru_id), per)},
        'penilai': {'id': penilai_id, **identitas_orang(snap.get(penilai_id), akun.get(penilai_id), per)} if penilai_id else None,
        'kepala': {'id': kepala_id, **kepala, 'jabatan_struktural': 'Kepala Madrasah'},
        'sekolah': {'nama': pengaturan.get('school_name'), 'npsn': pengaturan.get('npsn'), 'telepon': pengaturan.get('phone'),
                    'alamat': pengaturan.get('address'), 'kelurahan': pengaturan.get('village'), 'kecamatan': pengaturan.get('district'),
                    'kota': kota_dari(pengaturan), 'provinsi': pengaturan.get('province'), 'jenjang': JENJANG},
        'sk': {'tentang': (sk or {}).get('tentang') or 'SK Tim PKG', 'nomor': (sk or {}).get('nomor_sk'),
               'tanggal': tanggal_teks((sk or {}).get('tanggal_sk')), 'berlaku_sampai': tanggal_teks(per)},
        'periode': {'nama': periode.get('nama_periode'), 'mulai': tanggal_teks(periode.get('tanggal_buka')),
                    'selesai': tanggal_teks(per), 'tahun': str((per or periode.get('tanggal_buka') or '')[:4]) or None,
                    'tanggal_penilaian': tanggal_teks(terkunci_pada)},
        'tim_penilai': tim,
    }


# Sel 00-DATA template (kolom E kecuali disebut lain); rumus sheet lain membaca dari sini.
SEL_DATA = {
    ('guru', 'nama'): 'E5', ('guru', 'nip'): 'E6', ('guru', 'nuptk'): 'E7', ('guru', 'tempat_tanggal_lahir'): 'E8',
    ('guru', 'pangkat'): 'E9', ('guru', 'golongan'): 'F9', ('guru', 'tmt_golongan'): 'G9', ('guru', 'jabatan'): 'E10',
    ('guru', 'masa_kerja'): 'E11', ('guru', 'jenis_kelamin'): 'E12', ('guru', 'pendidikan'): 'E13',
    ('guru', 'spesialisasi'): 'E14', ('periode', 'tahun'): 'E15',
    ('kepala', 'nama'): 'E17', ('kepala', 'nip'): 'E18', ('kepala', 'jabatan_struktural'): 'E19',
    ('kepala', 'pangkat_golongan'): 'E20', ('kepala', 'masa_kerja'): 'E21', ('kepala', 'jenis_kelamin'): 'E22',
    ('kepala', 'pendidikan'): 'E23', ('kepala', 'spesialisasi'): 'E24',
    ('sekolah', 'nama'): 'E26', ('sekolah', 'telepon'): 'E27', ('sekolah', 'kelurahan'): 'E28',
    ('sekolah', 'kecamatan'): 'E29', ('sekolah', 'kota'): 'E30', ('sekolah', 'provinsi'): 'E31',
    ('penilai', 'nama'): 'E33', ('penilai', 'nip'): 'E34', ('sk', 'tentang'): 'E35', ('sk', 'nomor'): 'E36',
    ('sk', 'tanggal'): 'E37', ('sk', 'berlaku_sampai'): 'E38',
    ('periode', 'mulai'): 'C41', ('periode', 'selesai'): 'E41', ('periode', 'tanggal_penilaian'): 'H41',
    ('sekolah', 'jenjang'): 'M2',
}


def isi_data_identitas(wb, lampiran: Dict[str, Any]) -> None:
    """Isi sheet 00-DATA dari lampiran identitas; field kosong ditulis '-' (contoh isian template selalu ditimpa).
    Kelurahan memakai alamat madrasah bila kelurahan tidak diatur."""
    ws = wb['00-DATA']
    kepala = dict(lampiran.get('kepala') or {})
    kepala['pangkat_golongan'] = ' / '.join(x for x in (kepala.get('pangkat'), kepala.get('golongan')) if x) or None
    sekolah = dict(lampiran.get('sekolah') or {})
    sekolah['kelurahan'] = sekolah.get('kelurahan') or sekolah.get('alamat')
    sumber = {**lampiran, 'kepala': kepala, 'sekolah': sekolah}
    for (bagian, kunci), sel in SEL_DATA.items():
        ws[sel] = ((sumber.get(bagian) or {}).get(kunci)) or '-'
