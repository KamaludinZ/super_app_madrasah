"""Sinkron nilai UAS modul Ujian ke rapor (`grade_entries`) dan aturan ubah nilai oleh guru mata pelajaran.

Setiap kali nilai_ujian berubah (impor panitia, input panitia, input guru) baris rapor siswa-mapel-semester ikut
diperbarui pada kolom nilai_uas* saja (lihat ujian_nilai.FIELD_RAPOR_UAS) — nilai pengetahuan/keterampilan/akhir milik
guru tidak disentuh. Bila baris rapor belum ada, dibuat baris baru berisi nilai UAS saja (kolom lain kosong) sehingga
langsung tampil di Input Nilai guru mapel & rapor siswa.
"""
import uuid
from typing import Any, Dict, Optional

from ujian import sekarang_wib
from ujian_nilai import KOLEKSI_MASA, KOLEKSI_RAPOR, kode_semester_rapor, masa_terbuka


async def konteks_rapor(db, ujian: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """{ academic_year_id, semester } baris rapor untuk ujian ini, atau None bila semester tak dikenali."""
    semester = await db.semesters.find_one({'id': ujian.get('semester_id')}, {'_id': 0}) or {}
    kode = kode_semester_rapor(semester) or kode_semester_rapor({'name': ujian.get('semester_nama')})
    tahun = ujian.get('academic_year_id') or semester.get('academic_year_id')
    if not kode:
        return None
    return {'academic_year_id': tahun, 'semester': kode, 'ujian_id': ujian['id']}


async def sinkron_rapor(db, rapor: Optional[Dict[str, Any]], nilai: Dict[str, Any], guru_id: Optional[str] = None) -> None:
    """Tulis nilai UAS satu siswa-mapel (dokumen nilai_ujian) ke grade_entries."""
    if not rapor or not nilai.get('kelas_id'):
        return
    kunci = {'student_id': nilai['siswa_id'], 'class_id': nilai['kelas_id'], 'subject_id': nilai['mapel_id'],
             'academic_year_id': rapor['academic_year_id'], 'semester': rapor['semester']}
    ubah = {'nilai_uas': nilai.get('nilai'), 'nilai_uas_ujian_id': rapor['ujian_id'], 'nilai_uas_sumber': nilai.get('sumber'),
            'nilai_uas_diperbarui': nilai.get('waktu') or sekarang_wib().isoformat()}
    ada = await db[KOLEKSI_RAPOR].find_one(kunci, {'_id': 0, 'id': 1})
    if ada:
        await db[KOLEKSI_RAPOR].update_one({'id': ada['id']}, {'$set': ubah})
        return
    if nilai.get('nilai') is None:
        return  # tidak membuat baris rapor kosong hanya untuk menghapus nilai
    await db[KOLEKSI_RAPOR].insert_one({
        'id': str(uuid.uuid4()), **kunci, 'teacher_id': guru_id, 'nilai_pengetahuan': None, 'nilai_keterampilan': None,
        'nilai_akhir': None, 'predicate': None, 'description': None, **ubah,
        'submitted_by': nilai.get('diedit_oleh'), 'submitted_at': ubah['nilai_uas_diperbarui'],
    })


async def ujian_uas_semester(db, semester_id: Optional[str]) -> Optional[Dict[str, Any]]:
    """UAS semester ini (yang terakhir dimulai bila lebih dari satu)."""
    if not semester_id:
        return None
    daftar = await db['ujian'].find({'semester_id': semester_id, 'jenis': 'UAS'}, {'_id': 0}).sort('mulai', -1).to_list(10)
    return daftar[0] if daftar else None


async def status_ubah_guru(db, ujian: Optional[Dict[str, Any]], hari_ini: str, admin: bool = False) -> Dict[str, Any]:
    """Boleh tidaknya guru mapel mengubah nilai UAS saat ini -> { boleh_ubah, pesan, masa, ujian_id, ujian_nama }.
    Guru hanya boleh di dalam masa ujian/remidi yang dibuka panitia; admin selalu boleh."""
    if not ujian:
        return {'boleh_ubah': False, 'pesan': 'Belum ada UAS pada semester ini.', 'masa': None, 'ujian_id': None, 'ujian_nama': None}
    doc = await db[KOLEKSI_MASA].find_one({'ujian_id': ujian['id']}, {'_id': 0}) or {}
    jenis = masa_terbuka(doc, hari_ini)
    masa = {'jenis': jenis, **{k: doc[jenis].get(k) for k in ('mulai', 'selesai')}} if jenis else None
    if jenis:
        pesan = f"Masa {jenis} dibuka sampai {masa['selesai']}."
    elif admin:
        pesan = 'Masa ujian/remidi sedang ditutup; sebagai admin Anda tetap dapat mengubah nilai UAS.'
    else:
        pesan = 'Nilai UAS diisi panitia ujian; masa ujian/remidi sedang ditutup sehingga belum dapat diubah.'
    return {'boleh_ubah': bool(jenis) or admin, 'pesan': pesan, 'masa': masa, 'ujian_id': ujian['id'], 'ujian_nama': ujian.get('nama')}
