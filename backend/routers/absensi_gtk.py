"""Laporan Absensi GTK: kehadiran guru/tenaga kependidikan dihitung otomatis
dari keterisian jurnal (jurnal mengajar untuk guru, Jurnal Harian E-Kinerja
untuk tenaga kependidikan) dibandingkan dengan jadwal/hari kerja, dikurangi
hari libur (mingguan + akademik) dan perizinan (sakit/cuti/dinas luar/lainnya).

Status per hari kerja, untuk satu GTK:
- Libur: hari itu adalah hari libur mingguan atau akademik -> tidak dihitung.
- Izin/Sakit/Cuti/Dinas Luar: ada GTKIzinModel yang mencakup tanggal itu.
- Hadir: guru mengisi >=1 jurnal untuk jadwalnya hari itu (atau tendik mengisi
  >=1 entri Jurnal Harian E-Kinerja hari itu).
- Alpha: bukan hari libur, tidak ada izin, dan tidak ada jurnal terisi.

Guru tanpa jadwal sama sekali pada hari itu (hari itu bukan salah satu hari
mengajarnya) tidak dihitung sebagai Alpha maupun Hadir -- hari itu dilewati
untuk GTK tersebut.
"""
from datetime import datetime, timedelta, date as date_cls
from typing import Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException

from pydantic import BaseModel

from core import db, get_current_user, get_settings, log_audit, require_role, serialize_doc
from journal_core import now_wib, DAY_MAP_EN_ID

router = APIRouter()

EKINERJA_AUTHOR_ROLES = ('admin', 'kepala_sekolah', 'kepala_tata_usaha', 'penjamin_mutu')
SUBJECT_TEACHER_ROLES = ('guru', 'guru_ipa', 'guru_ips', 'guru_bahasa', 'guru_seni', 'guru_agama', 'guru_tik')
GTK_ROLES = SUBJECT_TEACHER_ROLES + ('wali_kelas', 'guru_piket', 'guru_bk', 'guru_tata_tertib',
                                       'guru_ekstrakurikuler', 'tenaga_kependidikan')

IZIN_JENIS_LIST = ['sakit', 'cuti', 'dinas_luar', 'lainnya']
IZIN_JENIS_LABELS = {
    'sakit': 'Sakit', 'cuti': 'Cuti', 'dinas_luar': 'Dinas Luar', 'lainnya': 'Lainnya',
}


def _require_absensi_author():
    return require_role(*EKINERJA_AUTHOR_ROLES)


class GTKIzinRequest(BaseModel):
    jenis: str  # 'sakit' | 'cuti' | 'dinas_luar' | 'lainnya'
    tanggal_mulai: str  # YYYY-MM-DD
    tanggal_selesai: str  # YYYY-MM-DD
    keterangan: Optional[str] = None
    dokumen_url: Optional[str] = None  # opsional, bisa menyusul


def _day_id(d: date_cls) -> str:
    return DAY_MAP_EN_ID.get(d.strftime('%A').lower(), '')


def _parse_date(s: str) -> date_cls:
    return datetime.strptime(s, '%Y-%m-%d').date()


def _daterange(start: date_cls, end: date_cls):
    cur = start
    while cur <= end:
        yield cur
        cur += timedelta(days=1)


async def _build_holiday_checker(date_from: date_cls, date_to: date_cls):
    """Preloads weekly + academic holidays overlapping the range and returns a
    fast is_holiday(date) closure."""
    weekly = await db.weekly_holidays.find({'is_active': True}, {'_id': 0, 'day': 1}).to_list(20)
    weekly_days = {w['day'] for w in weekly}

    academic = await db.academic_holidays.find({}, {'_id': 0, 'date': 1, 'end_date': 1}).to_list(2000)
    academic_ranges = []
    for a in academic:
        try:
            start = _parse_date(a['date'])
            end = _parse_date(a['end_date']) if a.get('end_date') else start
        except (ValueError, KeyError):
            continue
        if end < date_from or start > date_to:
            continue  # tidak overlap dengan rentang yang diminta
        academic_ranges.append((start, end))

    def is_holiday(d: date_cls) -> bool:
        if _day_id(d) in weekly_days:
            return True
        return any(start <= d <= end for start, end in academic_ranges)

    return is_holiday


async def _build_izin_checker(gtk_id: str, date_from: date_cls, date_to: date_cls):
    izin_docs = await db.gtk_izin.find({
        'gtk_id': gtk_id,
        'tanggal_mulai': {'$lte': date_to.isoformat()},
        'tanggal_selesai': {'$gte': date_from.isoformat()},
    }, {'_id': 0}).to_list(500)

    def get_izin(d: date_cls):
        d_str = d.isoformat()
        for iz in izin_docs:
            if iz['tanggal_mulai'] <= d_str <= iz['tanggal_selesai']:
                return iz
        return None

    return get_izin


async def _compute_guru_attendance(gtk_id: str, semester_id: Optional[str], date_from: date_cls, date_to: date_cls):
    """Kehadiran guru: dari jadwal mengajar (schedules) x jurnal (journals.schedule_id)."""
    schedule_query = {'teacher_id': gtk_id}
    if semester_id:
        schedule_query['semester_id'] = semester_id
    schedules = await db.schedules.find(schedule_query, {'_id': 0, 'id': 1, 'day': 1}).to_list(1000)
    schedule_ids_by_day: Dict[str, List[str]] = {}
    for s in schedules:
        day_key = (s.get('day') or '').strip().lower()  # data lama ada yang tersimpan kapital, mis. 'Senin'
        schedule_ids_by_day.setdefault(day_key, []).append(s['id'])

    journal_query = {
        'teacher_id': gtk_id,
        'started_at': {
            '$gte': date_from.isoformat(),
            '$lt': (date_to + timedelta(days=1)).isoformat(),
        },
    }
    journals = await db.journals.find(journal_query, {'_id': 0, 'schedule_id': 1, 'started_at': 1}).to_list(5000)
    filled_schedule_ids_by_date: Dict[str, set] = {}
    for j in journals:
        started = j.get('started_at')
        if not started:
            continue
        try:
            d_str = started[:10]
        except (TypeError, IndexError):
            continue
        filled_schedule_ids_by_date.setdefault(d_str, set()).add(j.get('schedule_id'))

    is_holiday = await _build_holiday_checker(date_from, date_to)
    get_izin = await _build_izin_checker(gtk_id, date_from, date_to)

    days = []
    for d in _daterange(date_from, date_to):
        day_id = _day_id(d)
        day_schedule_ids = schedule_ids_by_day.get(day_id, [])
        if not day_schedule_ids:
            continue  # bukan hari mengajar GTK ini, dilewati
        if is_holiday(d):
            days.append({'date': d.isoformat(), 'status': 'libur'})
            continue

        filled = filled_schedule_ids_by_date.get(d.isoformat(), set())
        has_journal = any(sid in filled for sid in day_schedule_ids)
        if has_journal:
            days.append({'date': d.isoformat(), 'status': 'hadir'})
            continue

        izin = get_izin(d)
        if izin:
            days.append({'date': d.isoformat(), 'status': izin['jenis'], 'izin_id': izin['id']})
        else:
            days.append({'date': d.isoformat(), 'status': 'alpha'})

    return days


async def _compute_tendik_attendance(gtk_id: str, date_from: date_cls, date_to: date_cls):
    """Kehadiran tenaga kependidikan: dari keterisian Jurnal Harian E-Kinerja
    (tanpa konsep jadwal), dibandingkan hari kerja umum madrasah."""
    settings = await get_settings()
    active_days = settings.get('active_days') or ['senin', 'selasa', 'rabu', 'kamis', 'jumat']

    entries = await db.ekinerja_jurnal_harian.find({
        'gtk_id': gtk_id,
        'tanggal': {'$gte': date_from.isoformat(), '$lte': date_to.isoformat()},
    }, {'_id': 0, 'tanggal': 1}).to_list(2000)
    filled_dates = {e['tanggal'] for e in entries}

    is_holiday = await _build_holiday_checker(date_from, date_to)
    get_izin = await _build_izin_checker(gtk_id, date_from, date_to)

    days = []
    for d in _daterange(date_from, date_to):
        if _day_id(d) not in active_days:
            continue  # bukan hari kerja
        if is_holiday(d):
            days.append({'date': d.isoformat(), 'status': 'libur'})
            continue

        if d.isoformat() in filled_dates:
            days.append({'date': d.isoformat(), 'status': 'hadir'})
            continue

        izin = get_izin(d)
        if izin:
            days.append({'date': d.isoformat(), 'status': izin['jenis'], 'izin_id': izin['id']})
        else:
            days.append({'date': d.isoformat(), 'status': 'alpha'})

    return days


def _summarize(days: List[Dict]) -> Dict:
    summary = {'hadir': 0, 'sakit': 0, 'cuti': 0, 'dinas_luar': 0, 'lainnya': 0, 'alpha': 0, 'libur': 0}
    for d in days:
        status = d['status']
        if status in summary:
            summary[status] += 1
    total_wajib = sum(v for k, v in summary.items() if k != 'libur')
    total_izin = summary['sakit'] + summary['cuti'] + summary['dinas_luar'] + summary['lainnya']
    pct = round((summary['hadir'] / total_wajib) * 100, 1) if total_wajib else None
    return {**summary, 'total_hari_wajib': total_wajib, 'total_izin': total_izin, 'persentase_hadir': pct}


async def _resolve_gtk_and_compute(gtk_user: Dict, semester_id: Optional[str], date_from: date_cls, date_to: date_cls):
    roles = gtk_user.get('roles', [])
    is_subject_teacher_family = any(r in roles for r in GTK_ROLES if r != 'tenaga_kependidikan')
    if is_subject_teacher_family:
        days = await _compute_guru_attendance(gtk_user['id'], semester_id, date_from, date_to)
    else:
        days = await _compute_tendik_attendance(gtk_user['id'], date_from, date_to)
    return days


@router.get("/gtk/absensi/my")
async def my_gtk_attendance(date_from: str, date_to: str, user: Dict = Depends(get_current_user)):
    """Laporan absensi diri sendiri (guru mata pelajaran & tenaga kependidikan)."""
    try:
        d_from, d_to = _parse_date(date_from), _parse_date(date_to)
    except ValueError:
        raise HTTPException(400, "Format tanggal tidak valid (gunakan YYYY-MM-DD)")
    if d_from > d_to:
        raise HTTPException(400, "Tanggal mulai harus sebelum tanggal selesai")

    from core import get_active_context
    ctx = await get_active_context(user)
    days = await _resolve_gtk_and_compute(user, ctx.get('semester_id'), d_from, d_to)
    return {'days': days, 'summary': _summarize(days)}


@router.get("/gtk/absensi/rekap")
async def rekap_gtk_attendance(
    date_from: str,
    date_to: str,
    gtk_id: Optional[str] = None,
    user: Dict = Depends(_require_absensi_author()),
):
    """Rekap absensi semua GTK (admin/kepsek/KTU), atau drill-down satu GTK."""
    try:
        d_from, d_to = _parse_date(date_from), _parse_date(date_to)
    except ValueError:
        raise HTTPException(400, "Format tanggal tidak valid (gunakan YYYY-MM-DD)")
    if d_from > d_to:
        raise HTTPException(400, "Tanggal mulai harus sebelum tanggal selesai")

    from core import get_active_context
    ctx = await get_active_context(user)
    semester_id = ctx.get('semester_id')

    if gtk_id:
        gtk_user = await db.users.find_one({'id': gtk_id}, {'_id': 0})
        if not gtk_user:
            raise HTTPException(404, "GTK tidak ditemukan")
        days = await _resolve_gtk_and_compute(gtk_user, semester_id, d_from, d_to)
        return {'gtk_id': gtk_id, 'gtk_name': gtk_user.get('full_name'), 'days': days, 'summary': _summarize(days)}

    gtk_users = await db.users.find(
        {'roles': {'$in': list(GTK_ROLES)}, 'is_active': True},
        {'_id': 0, 'id': 1, 'full_name': 1, 'username': 1, 'roles': 1},
    ).to_list(2000)

    results = []
    for g in gtk_users:
        days = await _resolve_gtk_and_compute(g, semester_id, d_from, d_to)
        summary = _summarize(days)
        results.append({
            'gtk_id': g['id'],
            'gtk_name': g.get('full_name') or g.get('username'),
            **summary,
        })
    results.sort(key=lambda x: x['gtk_name'] or '')
    return results


@router.get("/gtk/izin/meta")
async def get_izin_meta(user: Dict = Depends(get_current_user)):
    return {'jenis': [{'value': j, 'label': IZIN_JENIS_LABELS[j]} for j in IZIN_JENIS_LIST]}


@router.get("/gtk/izin/my")
async def my_izin_list(user: Dict = Depends(get_current_user)):
    items = await db.gtk_izin.find({'gtk_id': user['id']}, {'_id': 0}).sort('tanggal_mulai', -1).to_list(500)
    return [serialize_doc(i) for i in items]


@router.post("/gtk/izin")
async def create_izin(req: GTKIzinRequest, user: Dict = Depends(get_current_user)):
    if req.jenis not in IZIN_JENIS_LIST:
        raise HTTPException(400, "Jenis izin tidak valid")
    try:
        d_from, d_to = _parse_date(req.tanggal_mulai), _parse_date(req.tanggal_selesai)
    except ValueError:
        raise HTTPException(400, "Format tanggal tidak valid")
    if d_from > d_to:
        raise HTTPException(400, "Tanggal mulai harus sebelum atau sama dengan tanggal selesai")

    now = now_wib().isoformat()
    doc = {
        'id': str(uuid.uuid4()),
        'gtk_id': user['id'],
        'gtk_name': user.get('full_name', user.get('username')),
        'jenis': req.jenis,
        'tanggal_mulai': req.tanggal_mulai,
        'tanggal_selesai': req.tanggal_selesai,
        'keterangan': req.keterangan,
        'dokumen_url': req.dokumen_url,
        'created_at': now,
        'updated_at': now,
    }
    await db.gtk_izin.insert_one(doc)
    await log_audit(user, 'gtk_izin_create', f"Izin {req.jenis}: {req.tanggal_mulai} s/d {req.tanggal_selesai}")
    return serialize_doc(doc)


@router.put("/gtk/izin/{izin_id}")
async def update_izin(izin_id: str, req: GTKIzinRequest, user: Dict = Depends(get_current_user)):
    existing = await db.gtk_izin.find_one({'id': izin_id})
    if not existing:
        raise HTTPException(404, "Data izin tidak ditemukan")
    if existing.get('gtk_id') != user['id']:
        raise HTTPException(403, "Anda hanya dapat mengubah data izin milik Anda sendiri")
    if req.jenis not in IZIN_JENIS_LIST:
        raise HTTPException(400, "Jenis izin tidak valid")
    try:
        d_from, d_to = _parse_date(req.tanggal_mulai), _parse_date(req.tanggal_selesai)
    except ValueError:
        raise HTTPException(400, "Format tanggal tidak valid")
    if d_from > d_to:
        raise HTTPException(400, "Tanggal mulai harus sebelum atau sama dengan tanggal selesai")

    await db.gtk_izin.update_one({'id': izin_id}, {'$set': {
        'jenis': req.jenis, 'tanggal_mulai': req.tanggal_mulai, 'tanggal_selesai': req.tanggal_selesai,
        'keterangan': req.keterangan, 'dokumen_url': req.dokumen_url, 'updated_at': now_wib().isoformat(),
    }})
    updated = await db.gtk_izin.find_one({'id': izin_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/gtk/izin/{izin_id}")
async def delete_izin(izin_id: str, user: Dict = Depends(get_current_user)):
    existing = await db.gtk_izin.find_one({'id': izin_id})
    if not existing:
        raise HTTPException(404, "Data izin tidak ditemukan")
    if existing.get('gtk_id') != user['id']:
        raise HTTPException(403, "Anda hanya dapat menghapus data izin milik Anda sendiri")

    await db.gtk_izin.delete_one({'id': izin_id})
    return {'message': 'Data izin berhasil dihapus'}


@router.get("/gtk/izin")
async def list_izin_all(
    gtk_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: Dict = Depends(_require_absensi_author()),
):
    """Admin/kepsek/KTU melihat semua data izin GTK (atau satu GTK tertentu)."""
    query = {}
    if gtk_id:
        query['gtk_id'] = gtk_id
    if date_from:
        query['tanggal_selesai'] = {'$gte': date_from}
    if date_to:
        query['tanggal_mulai'] = {'$lte': date_to}

    items = await db.gtk_izin.find(query, {'_id': 0}).sort('tanggal_mulai', -1).to_list(2000)
    return [serialize_doc(i) for i in items]
