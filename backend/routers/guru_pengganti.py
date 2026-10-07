"""Guru Pengganti: penugasan guru lain untuk mengisi jurnal pada slot guru yang berhalangan.

Hanya admin, waka kurikulum, dan guru piket (GURU_PENGGANTI_ROLES) yang boleh menugaskan.
Penugasan disimpan di koleksi `substitute_assignments`, satu dokumen per (jadwal, tanggal).
"""

import calendar
import logging
import re
import uuid
from datetime import date as date_cls, timedelta
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from pymongo.errors import BulkWriteError, DuplicateKeyError

from core import (
    GURU_PENGGANTI_ROLES,
    db,
    get_active_context,
    get_current_user,
    get_settings,
    get_teaching_slots_for_day,
    log_audit,
    log_security,
    serialize_doc,
)
from journal_core import current_day_id, day_started_at_filter, now_wib
from models import SubstituteAssignmentModel

router = APIRouter()


# Indeks sesuai date.weekday() (0 = Senin).
WEEKDAY_KEYS = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu']
MAX_DATES_PER_REQUEST = 62


ASSIGNMENTS = 'substitute_assignments'


async def ensure_substitute_assignment_indexes(database) -> List[str]:
    """Index koleksi substitute_assignments (idempotent). Dipanggil saat server start dan oleh
    migrations/migrate_guru_pengganti.py. Mengembalikan daftar index yang gagal dibuat.
    Index unik parsial (schedule_id, date) untuk status 'active' mencegah satu slot
    mendapat dua guru pengganti pada tanggal yang sama, termasuk saat simpan bersamaan."""
    specs = [
        ('id', {'unique': True}),
        ([('schedule_id', 1), ('date', 1)], {
            'unique': True,
            'partialFilterExpression': {'status': 'active'},
            'name': 'uniq_active_schedule_date',
        }),
        ([('substitute_teacher_id', 1), ('date', 1)], {}),  # jadwal hari ini guru pengganti
        ([('original_teacher_id', 1), ('date', 1)], {}),    # riwayat guru yang digantikan
        ([('date', 1), ('status', 1)], {}),                 # daftar/kalender per rentang tanggal
    ]
    # Jurnal guru pengganti: satu jurnal per penugasan; dicari per guru pengganti.
    journal_specs = [
        ('substitute_assignment_id', {
            'unique': True,
            'partialFilterExpression': {'substitute_assignment_id': {'$type': 'string'}},
            'name': 'uniq_substitute_assignment_journal',
        }),
        ([('substitute_teacher_id', 1), ('journal_date', -1)], {
            'partialFilterExpression': {'substitute_teacher_id': {'$type': 'string'}},
            'name': 'substitute_teacher_journal_date',
        }),
    ]
    gagal = []
    for coll, keys, kwargs in [(ASSIGNMENTS, k, kw) for k, kw in specs] + [('journals', k, kw) for k, kw in journal_specs]:
        try:
            await database[coll].create_index(keys, **kwargs)
        except Exception as e:  # noqa: BLE001 - dilaporkan ke pemanggil & log
            gagal.append(f"{coll} {keys}: {e}")
            logging.getLogger('matsandatama').error(f"[guru_pengganti] Gagal membuat index {keys}: {e}")
    return gagal


def can_manage_guru_pengganti(user: Dict) -> bool:
    """Sama dengan aturan require_role: peran aktif berwenang, atau akun ber-peran admin."""
    return user.get('active_role') in GURU_PENGGANTI_ROLES or 'admin' in (user.get('roles') or [])


async def require_guru_pengganti_manager(request: Request, user: Dict = Depends(get_current_user)) -> Dict:
    """Dependency endpoint pengelolaan penugasan: tolak (403) & catat peran tak berwenang,
    termasuk guru mata pelajaran yang mencoba memanggil API langsung."""
    if can_manage_guru_pengganti(user):
        return user
    await log_security('guru_pengganti_forbidden', user.get('username'), {
        'active_role': user.get('active_role'),
        'path': request.url.path,
        'method': request.method,
    }, request)
    raise HTTPException(
        status_code=403,
        detail="Akses ditolak. Penugasan guru pengganti hanya untuk Admin, Waka Kurikulum, dan Guru Piket.",
    )


@router.get("/guru-pengganti/config")
async def guru_pengganti_config(user: Dict = Depends(get_current_user)):
    """Konfigurasi peran berwenang + apakah pengguna saat ini boleh membuka menu Guru Pengganti."""
    return {
        'allowed_roles': list(GURU_PENGGANTI_ROLES),
        'can_manage': can_manage_guru_pengganti(user),
    }


# Urutan hari untuk tampilan (Senin dulu).
DAY_ORDER = {k: i for i, k in enumerate(WEEKDAY_KEYS)}


def day_key(day: Optional[str]) -> str:
    """Data jadwal lama menyimpan hari campuran ("Senin"/"senin"); samakan ke huruf kecil."""
    return (day or '').strip().lower()


def day_query(day: Optional[str]) -> Dict:
    """Filter Mongo untuk hari tanpa membedakan huruf besar/kecil."""
    return {'$regex': f"^{re.escape(day_key(day))}$", '$options': 'i'}


async def _active_semester_id() -> Optional[str]:
    """Penugasan selalu memakai semester aktif global (bukan override tampilan pengguna)."""
    ctx = await get_active_context(None)
    return ctx.get('semester_id')


def _published_schedule_filter(semester_id: Optional[str]) -> Dict:
    q = {'is_published': {'$ne': False}}
    if semester_id:
        q['semester_id'] = semester_id
    return q


@router.get("/guru-pengganti/teachers")
async def list_replaceable_teachers(
    q: Optional[str] = Query(default=None, max_length=100),
    user: Dict = Depends(require_guru_pengganti_manager),
):
    """Daftar guru yang bisa digantikan: guru aktif yang punya jadwal mengajar di semester aktif."""
    semester_id = await _active_semester_id()
    rows = await db.schedules.aggregate([
        {'$match': _published_schedule_filter(semester_id)},
        {'$group': {
            '_id': '$teacher_id',
            'schedule_count': {'$sum': 1},
            'subject_ids': {'$addToSet': '$subject_id'},
            'days': {'$addToSet': '$day'},
        }},
    ]).to_list(2000)
    if not rows:
        return []

    teacher_ids = [r['_id'] for r in rows if r['_id']]
    subject_ids = list({sid for r in rows for sid in r['subject_ids'] if sid})
    users = {
        u['id']: u for u in await db.users.find(
            {'id': {'$in': teacher_ids}, 'is_active': {'$ne': False}},
            {'_id': 0, 'id': 1, 'full_name': 1, 'nip_nuptk': 1},
        ).to_list(len(teacher_ids))
    }
    subjects = {
        s['id']: s.get('name') for s in await db.subjects.find(
            {'id': {'$in': subject_ids}}, {'_id': 0, 'id': 1, 'name': 1},
        ).to_list(len(subject_ids))
    }

    needle = (q or '').strip().lower()
    result = []
    for r in rows:
        u = users.get(r['_id'])
        if not u:
            continue
        subject_names = sorted({subjects[sid] for sid in r['subject_ids'] if subjects.get(sid)})
        name = u.get('full_name') or '-'
        if needle and needle not in f"{name} {' '.join(subject_names)} {u.get('nip_nuptk') or ''}".lower():
            continue
        result.append({
            'id': u['id'],
            'name': name,
            'nip_nuptk': u.get('nip_nuptk'),
            'subject': ', '.join(subject_names),
            'subjects': subject_names,
            'schedule_count': r['schedule_count'],
            'days': sorted({day_key(d) for d in r['days']}, key=lambda d: DAY_ORDER.get(d, 99)),
        })
    result.sort(key=lambda t: t['name'].lower())
    return result


def jam_ke_label(day_slots: List[Dict], start: str, end: str) -> str:
    """Label "jam ke" untuk rentang waktu jadwal, mis. "2-4", dari slot mengajar hari itu
    (istirahat dilewati). Kosong bila tidak cocok dengan slot mana pun."""
    nums = []
    for slot in day_slots:
        if slot.get('is_break'):
            continue
        if (slot.get('start_time') or '') < end and start < (slot.get('end_time') or ''):
            m = re.search(r'(\d+)', slot.get('name') or '')
            if m:
                nums.append(int(m.group(1)))
    if not nums:
        return ''
    return str(nums[0]) if len(nums) == 1 else f"{min(nums)}-{max(nums)}"


async def _resolve_names(collection: str, ids) -> Dict[str, str]:
    ids = [i for i in set(ids) if i]
    if not ids:
        return {}
    docs = await db[collection].find({'id': {'$in': ids}}, {'_id': 0, 'id': 1, 'name': 1}).to_list(len(ids))
    return {d['id']: d.get('name') for d in docs}


@router.get("/guru-pengganti/teachers/{teacher_id}/slots")
async def list_teacher_slots(teacher_id: str, user: Dict = Depends(require_guru_pengganti_manager)):
    """Slot jadwal mengajar (jam & kelas) seorang guru pada semester aktif, urut hari & jam.
    Label jam ke- disusun dari slot mengajar per hari (get_teaching_slots_for_day)."""
    semester_id = await _active_semester_id()
    schedules = await db.schedules.find(
        {**_published_schedule_filter(semester_id), 'teacher_id': teacher_id},
        {'_id': 0, 'id': 1, 'day': 1, 'start_time': 1, 'end_time': 1, 'slot_indexes': 1,
         'class_id': 1, 'subject_id': 1, 'room_id': 1, 'semester_id': 1},
    ).to_list(500)

    classes = await _resolve_names('classes', [s.get('class_id') for s in schedules])
    subjects = await _resolve_names('subjects', [s.get('subject_id') for s in schedules])
    rooms = await _resolve_names('rooms', [s.get('room_id') for s in schedules])
    settings = await get_settings()
    day_slots = {}

    result = []
    for s in schedules:
        day = day_key(s.get('day'))
        if day not in day_slots:
            day_slots[day] = get_teaching_slots_for_day(settings, day)
        result.append({
            'id': s['id'],
            'teacher_id': teacher_id,
            'day': day,
            'start_time': s.get('start_time'),
            'end_time': s.get('end_time'),
            'slot_indexes': s.get('slot_indexes'),
            'jam_ke': jam_ke_label(day_slots[day], s.get('start_time') or '', s.get('end_time') or ''),
            'class_id': s.get('class_id'),
            'class_name': classes.get(s.get('class_id')) or '-',
            'subject_id': s.get('subject_id'),
            'subject_name': subjects.get(s.get('subject_id')) or '-',
            'room_id': s.get('room_id'),
            'room_name': rooms.get(s.get('room_id')) or '-',
            'semester_id': s.get('semester_id'),
        })
    result.sort(key=lambda x: (DAY_ORDER.get(x['day'], 99), x['start_time'] or ''))
    return result


# Peran GTK yang bisa menjadi guru pengganti (selain guru yang punya jadwal di semester aktif).
SUBSTITUTE_CANDIDATE_ROLES = [
    'guru', 'wali_kelas', 'guru_piket', 'guru_bk', 'guru_tata_tertib', 'guru_ekstrakurikuler',
    'guru_ipa', 'guru_ips', 'guru_bahasa', 'guru_seni', 'guru_agama', 'guru_tik', 'waka_kurikulum',
]


def _overlaps(a_start: str, a_end: str, b_start: str, b_end: str) -> bool:
    return (a_start or '') < (b_end or '') and (b_start or '') < (a_end or '')


async def compute_unavailability(sch: Dict, dates: List[str], candidate_ids: List[str],
                                 exclude_assignment_ids: Optional[List[str]] = None) -> Dict[str, str]:
    """Alasan tiap calon guru pengganti TIDAK tersedia untuk slot `sch` pada `dates`
    (id → alasan). Calon yang tidak ada di hasil berarti tersedia.
    Bentrok bila: (1) punya jadwal mengajar sendiri di hari & jam yang beririsan,
    (2) sudah menjadi guru pengganti di jam yang beririsan pada salah satu tanggal."""
    reasons: Dict[str, str] = {}
    if not candidate_ids:
        return reasons
    start, end = sch.get('start_time') or '', sch.get('end_time') or ''
    semester_id = sch.get('semester_id') or await _active_semester_id()

    own = await db.schedules.find(
        {**_published_schedule_filter(semester_id), 'teacher_id': {'$in': candidate_ids}, 'day': day_query(sch.get('day')),
         'id': {'$ne': sch.get('id')}},
        {'_id': 0, 'teacher_id': 1, 'start_time': 1, 'end_time': 1, 'class_id': 1},
    ).to_list(2000)
    clashes = [o for o in own if _overlaps(start, end, o.get('start_time'), o.get('end_time'))]
    class_names = await _resolve_names('classes', [o.get('class_id') for o in clashes])
    for o in clashes:
        reasons.setdefault(o['teacher_id'], (
            f"Mengajar {class_names.get(o.get('class_id')) or 'kelas lain'} "
            f"{o.get('start_time')}-{o.get('end_time')}"))

    if dates:
        q = {'substitute_teacher_id': {'$in': candidate_ids}, 'date': {'$in': dates}, 'status': 'active'}
        if exclude_assignment_ids:
            q['id'] = {'$nin': exclude_assignment_ids}
        assigned = await db.substitute_assignments.find(
            q, {'_id': 0, 'substitute_teacher_id': 1, 'schedule_id': 1, 'date': 1}).to_list(5000)
        if assigned:
            times = {
                x['id']: x for x in await db.schedules.find(
                    {'id': {'$in': list({a['schedule_id'] for a in assigned})}},
                    {'_id': 0, 'id': 1, 'start_time': 1, 'end_time': 1, 'class_id': 1},
                ).to_list(2000)
            }
            busy: Dict[str, set] = {}
            for a in assigned:
                t = times.get(a['schedule_id'])
                if t and _overlaps(start, end, t.get('start_time'), t.get('end_time')):
                    busy.setdefault(a['substitute_teacher_id'], set()).add(a['date'])
            for tid, busy_dates in busy.items():
                if tid in reasons:
                    continue
                reasons[tid] = (
                    "Sudah menggantikan di jam ini" if len(busy_dates) == len(set(dates))
                    else f"Sudah menggantikan pada {len(busy_dates)} dari {len(set(dates))} tanggal"
                ) + f" ({', '.join(sorted(busy_dates))})"
    return reasons


@router.get("/guru-pengganti/substitute-candidates")
async def list_substitute_candidates(
    schedule_id: str,
    dates: Optional[str] = Query(default=None, description="Tanggal YYYY-MM-DD dipisah koma"),
    q: Optional[str] = Query(default=None, max_length=100),
    user: Dict = Depends(require_guru_pengganti_manager),
):
    """Calon guru pengganti untuk slot & tanggal terpilih. Guru yang digantikan tidak ikut;
    guru yang bentrok tetap ditampilkan dengan `available: false` + alasannya."""
    sch = await db.schedules.find_one({'id': schedule_id}, {'_id': 0})
    if not sch:
        raise HTTPException(404, "Jadwal tidak ditemukan")
    date_list = [d.isoformat() for d in _parse_dates([x for x in (dates or '').split(',') if x.strip()])]

    semester_id = await _active_semester_id()
    scheduled_ids = await db.schedules.distinct('teacher_id', _published_schedule_filter(semester_id))
    users = await db.users.find(
        {'is_active': {'$ne': False}, 'id': {'$ne': sch['teacher_id']},
         '$or': [{'roles': {'$in': SUBSTITUTE_CANDIDATE_ROLES}}, {'id': {'$in': scheduled_ids}}]},
        {'_id': 0, 'id': 1, 'full_name': 1, 'nip_nuptk': 1},
    ).to_list(2000)

    needle = (q or '').strip().lower()
    if needle:
        users = [u for u in users if needle in f"{u.get('full_name') or ''} {u.get('nip_nuptk') or ''}".lower()]

    # Mapel yang diajar tiap calon pada semester aktif (untuk keterangan).
    taught = await db.schedules.aggregate([
        {'$match': {**_published_schedule_filter(semester_id), 'teacher_id': {'$in': [u['id'] for u in users]}}},
        {'$group': {'_id': '$teacher_id', 'subject_ids': {'$addToSet': '$subject_id'}}},
    ]).to_list(2000)
    subject_names = await _resolve_names('subjects', [sid for t in taught for sid in t['subject_ids']])
    subjects_by_teacher = {
        t['_id']: sorted({subject_names[sid] for sid in t['subject_ids'] if subject_names.get(sid)}) for t in taught
    }

    reasons = await compute_unavailability(sch, date_list, [u['id'] for u in users])
    result = [{
        'id': u['id'],
        'name': u.get('full_name') or '-',
        'nip_nuptk': u.get('nip_nuptk'),
        'subject': ', '.join(subjects_by_teacher.get(u['id'], [])),
        'available': u['id'] not in reasons,
        'unavailable': reasons.get(u['id']),
    } for u in users]
    result.sort(key=lambda c: (not c['available'], c['name'].lower()))
    return result


# Kategori libur akademik yang meniadakan KBM ('kegiatan_akademik' tidak termasuk).
HOLIDAY_CATEGORIES = ('libur_nasional', 'libur_keagamaan', 'libur_semester')


async def _semester_range(semester_id: Optional[str]) -> Dict:
    if not semester_id:
        return {}
    sem = await db.semesters.find_one({'id': semester_id}, {'_id': 0, 'id': 1, 'name': 1, 'start_date': 1, 'end_date': 1})
    return sem or {}


async def _holidays_between(start: str, end: str) -> List[Dict]:
    """Libur akademik yang beririsan dengan rentang [start, end] (YYYY-MM-DD)."""
    items = await db.academic_holidays.find(
        {'category': {'$in': list(HOLIDAY_CATEGORIES)}, 'date': {'$lte': end}},
        {'_id': 0, 'date': 1, 'end_date': 1, 'name': 1},
    ).to_list(2000)
    return [h for h in items if (h.get('end_date') or h['date']) >= start]


async def date_block_reasons(sch: Dict, date_strs: List[str]) -> Dict[str, str]:
    """Alasan tiap tanggal tidak bisa ditugasi (tanggal → alasan): lewat, di luar periode
    semester jadwal, atau libur akademik. Tanggal yang tidak ada di hasil berarti boleh."""
    if not date_strs:
        return {}
    reasons: Dict[str, str] = {}
    today = now_wib().date().isoformat()
    sem = await _semester_range(sch.get('semester_id'))
    holidays = await _holidays_between(min(date_strs), max(date_strs))
    for d in date_strs:
        if d < today:
            reasons[d] = 'sudah lewat'
        elif (sem.get('start_date') and d < sem['start_date']) or (sem.get('end_date') and d > sem['end_date']):
            reasons[d] = f"di luar periode {sem.get('name') or 'semester'}"
        else:
            h = next((h for h in holidays if h['date'] <= d <= (h.get('end_date') or h['date'])), None)
            if h:
                reasons[d] = f"libur: {h.get('name')}"
    return reasons


@router.get("/guru-pengganti/period")
async def guru_pengganti_period(user: Dict = Depends(require_guru_pengganti_manager)):
    """Periode semester aktif + libur akademik di dalamnya, untuk membatasi kalender penugasan."""
    sem = await _semester_range(await _active_semester_id())
    holidays = []
    if sem.get('start_date') and sem.get('end_date'):
        holidays = await _holidays_between(sem['start_date'], sem['end_date'])
    return {
        'semester_id': sem.get('id'),
        'name': sem.get('name'),
        'start_date': sem.get('start_date'),
        'end_date': sem.get('end_date'),
        'today': now_wib().date().isoformat(),
        'holidays': sorted(holidays, key=lambda h: h['date']),
    }


async def substitute_slots_for(teacher_id: str, date_from: str, date_to: str) -> List[Dict]:
    """Slot jadwal hasil penugasan untuk seorang guru pengganti pada rentang tanggal,
    berbentuk seperti item /schedules/my-today ditambah penanda `is_substitute` dan info penugasan.
    Dipakai agar penugasan langsung tercermin di jadwal guru pengganti."""
    assignments = await db.substitute_assignments.find(
        {'substitute_teacher_id': teacher_id, 'status': 'active', 'date': {'$gte': date_from, '$lte': date_to}},
        {'_id': 0},
    ).to_list(1000)
    if not assignments:
        return []

    schedules = {
        x['id']: x for x in await db.schedules.find(
            {'id': {'$in': list({a['schedule_id'] for a in assignments})}}, {'_id': 0},
        ).to_list(1000)
    }
    classes = await _resolve_names('classes', [x.get('class_id') for x in schedules.values()])
    subjects = await _resolve_names('subjects', [x.get('subject_id') for x in schedules.values()])
    rooms = await _resolve_names('rooms', [x.get('room_id') for x in schedules.values()])
    originals = {
        u['id']: u.get('full_name') for u in await db.users.find(
            {'id': {'$in': list({a['original_teacher_id'] for a in assignments})}},
            {'_id': 0, 'id': 1, 'full_name': 1},
        ).to_list(1000)
    }
    # Jurnal yang sudah diisi guru pengganti untuk tiap penugasan.
    journals = {
        j['substitute_assignment_id']: j['id'] for j in await db.journals.find(
            {'substitute_assignment_id': {'$in': [a['id'] for a in assignments]}},
            {'_id': 0, 'id': 1, 'substitute_assignment_id': 1},
        ).to_list(1000)
    }
    settings = await get_settings()
    day_slots: Dict[str, List[Dict]] = {}

    result = []
    for a in assignments:
        sch = schedules.get(a['schedule_id'])
        if not sch:
            continue  # jadwal sudah dihapus
        day = day_key(sch.get('day'))
        if day not in day_slots:
            day_slots[day] = get_teaching_slots_for_day(settings, day)
        result.append(serialize_doc({
            **sch,
            'day': day,
            'jam_ke': jam_ke_label(day_slots[day], sch.get('start_time') or '', sch.get('end_time') or ''),
            'class_name': classes.get(sch.get('class_id')),
            'subject_name': subjects.get(sch.get('subject_id')),
            'room_name': rooms.get(sch.get('room_id')),
            'date': a['date'],
            'is_substitute': True,
            'assignment_id': a['id'],
            'original_teacher_id': a['original_teacher_id'],
            'original_teacher_name': originals.get(a['original_teacher_id']),
            'assigned_by_name': a.get('assigned_by_name'),
            'reason': a.get('reason'),
            'journal_filled': a['id'] in journals,
            'journal_id': journals.get(a['id']),
        }))
    result.sort(key=lambda x: (x['date'], x.get('start_time') or ''))
    return result


async def substitute_slots_for_date(teacher_id: str, date: Optional[str] = None) -> List[Dict]:
    """Slot guru pengganti pada satu tanggal (default hari ini, WIB) — untuk jadwal hari ini."""
    day = date or now_wib().date().isoformat()
    return await substitute_slots_for(teacher_id, day, day)


@router.get("/guru-pengganti/my-schedule")
async def my_substitute_schedule(
    date_from: Optional[str] = Query(default=None, alias='from'),
    date_to: Optional[str] = Query(default=None, alias='to'),
    user: Dict = Depends(get_current_user),
):
    """Jadwal hasil penugasan untuk pengguna saat ini sebagai guru pengganti (default: hari ini)."""
    today = now_wib().date().isoformat()
    start = _parse_dates([date_from or today])[0].isoformat()
    end = _parse_dates([date_to or date_from or today])[0].isoformat()
    if end < start:
        raise HTTPException(400, "Rentang tanggal tidak valid")
    if (date_cls.fromisoformat(end) - date_cls.fromisoformat(start)).days > 92:
        raise HTTPException(400, "Rentang maksimal 3 bulan")
    if start == end:
        return await substitute_slots_for_date(user['id'], start)
    return await substitute_slots_for(user['id'], start, end)


@router.get("/guru-pengganti/slots/{schedule_id}/dates")
async def slot_dates_in_month(
    schedule_id: str,
    month: Optional[str] = Query(default=None, pattern=r'^\d{4}-\d{2}$', description="YYYY-MM, default bulan ini"),
    user: Dict = Depends(require_guru_pengganti_manager),
):
    """Tanggal-tanggal dalam satu bulan yang jatuh pada hari jadwal slot (mis. setiap Senin),
    masing-masing dengan status bisa dipilih, alasan bila tidak, dan penugasan aktif yang sudah ada."""
    sch = await db.schedules.find_one({'id': schedule_id}, {'_id': 0})
    if not sch:
        raise HTTPException(404, "Jadwal tidak ditemukan")
    sch_day = day_key(sch.get('day'))
    if sch_day not in WEEKDAY_KEYS:
        raise HTTPException(400, f"Hari jadwal tidak dikenal: {sch.get('day')}")

    today = now_wib().date()
    year, mon = (int(x) for x in (month or today.strftime('%Y-%m')).split('-'))
    if not 1 <= mon <= 12:
        raise HTTPException(400, "Bulan tidak valid")
    weekday = WEEKDAY_KEYS.index(sch_day)
    dates = [
        date_cls(year, mon, d).isoformat()
        for d in range(1, calendar.monthrange(year, mon)[1] + 1)
        if date_cls(year, mon, d).weekday() == weekday
    ]

    blocked = await date_block_reasons(sch, dates)
    existing = await db.substitute_assignments.find(
        {'schedule_id': schedule_id, 'date': {'$in': dates}, 'status': 'active'},
        {'_id': 0, 'id': 1, 'date': 1, 'substitute_teacher_id': 1},
    ).to_list(len(dates))
    sub_names = {
        u['id']: u.get('full_name') for u in await db.users.find(
            {'id': {'$in': list({e['substitute_teacher_id'] for e in existing})}},
            {'_id': 0, 'id': 1, 'full_name': 1},
        ).to_list(len(existing) or 1)
    }
    by_date = {e['date']: e for e in existing}

    items = []
    for d in dates:
        a = by_date.get(d)
        reason = blocked.get(d) or (f"sudah ada guru pengganti: {sub_names.get(a['substitute_teacher_id']) or '-'}" if a else None)
        items.append({
            'date': d,
            'selectable': reason is None,
            'reason': reason,
            'assignment': {
                'id': a['id'],
                'substitute_teacher_id': a['substitute_teacher_id'],
                'substitute_teacher_name': sub_names.get(a['substitute_teacher_id']),
            } if a else None,
        })
    sem = await _semester_range(sch.get('semester_id'))
    return {
        'schedule_id': schedule_id,
        'day': sch_day,
        'month': f"{year:04d}-{mon:02d}",
        'period': {'name': sem.get('name'), 'start_date': sem.get('start_date'), 'end_date': sem.get('end_date')},
        'dates': items,
    }


class AssignmentCreate(BaseModel):
    schedule_id: str
    dates: List[str] = Field(min_length=1)
    substitute_teacher_id: str
    reason: Optional[str] = Field(default=None, max_length=200)
    # True: simpan tanggal yang valid saja, tanggal bermasalah dikembalikan di `skipped`.
    # False (default): satu tanggal bermasalah menggagalkan seluruh penyimpanan.
    skip_invalid: bool = False


def _parse_dates(raw: List[str]) -> List[date_cls]:
    if len(raw) > MAX_DATES_PER_REQUEST:
        raise HTTPException(400, f"Maksimal {MAX_DATES_PER_REQUEST} tanggal per penugasan")
    parsed = set()
    for s in raw:
        try:
            parsed.add(date_cls.fromisoformat(s))
        except (TypeError, ValueError):
            raise HTTPException(400, f"Format tanggal tidak valid: {s} (gunakan YYYY-MM-DD)")
    return sorted(parsed)


# Kategori masalah per tanggal → (status HTTP, awalan pesan) saat tidak memakai skip_invalid.
_PROBLEM_ORDER = [
    ('wrong_day', 400, None),
    ('blocked', 400, "Tanggal tidak bisa ditugasi"),
    ('taken', 409, "Slot ini sudah punya guru pengganti pada"),
    ('busy', 409, "Guru pengganti tidak tersedia"),
]


async def _invalid_dates(sch: Dict, sch_day: str, date_strs: List[str], substitute_id: str) -> Dict[str, tuple]:
    """Tanggal yang tidak bisa disimpan → (kategori, alasan)."""
    problems: Dict[str, tuple] = {}
    for d in date_strs:
        if WEEKDAY_KEYS[date_cls.fromisoformat(d).weekday()] != sch_day:
            problems[d] = ('wrong_day', f"bukan hari {sch_day}")
    remaining = [d for d in date_strs if d not in problems]

    for d, r in (await date_block_reasons(sch, remaining)).items():
        problems[d] = ('blocked', r)
    remaining = [d for d in remaining if d not in problems]

    existing = await db.substitute_assignments.find(
        {'schedule_id': sch['id'], 'date': {'$in': remaining}, 'status': 'active'}, {'_id': 0, 'date': 1},
    ).to_list(len(remaining) or 1)
    for e in existing:
        problems[e['date']] = ('taken', 'slot sudah punya guru pengganti')
    remaining = [d for d in remaining if d not in problems]

    # Bentrok guru pengganti dicek per tanggal agar tanggal lain tetap bisa disimpan.
    for d in remaining:
        busy = (await compute_unavailability(sch, [d], [substitute_id])).get(substitute_id)
        if busy:
            # Alasan per tanggal: buang daftar tanggal di akhir (tanggal sudah jadi kunci).
            problems[d] = ('busy', re.sub(r'\s*\([\d\-, ]+\)$', '', busy))
    return problems


def _raise_first_problem(problems: Dict[str, tuple], sch_day: str):
    for cat, status, prefix in _PROBLEM_ORDER:
        hits = sorted((d, r) for d, (c, r) in problems.items() if c == cat)
        if not hits:
            continue
        if cat == 'wrong_day':
            raise HTTPException(status, f"Tanggal tidak sesuai hari jadwal ({sch_day}): {', '.join(d for d, _ in hits)}")
        if cat == 'taken':
            raise HTTPException(status, f"{prefix}: {', '.join(d for d, _ in hits)}")
        raise HTTPException(status, f"{prefix}: " + '; '.join(f"{d} ({r})" for d, r in hits))


@router.post("/guru-pengganti/assignments")
async def create_assignments(payload: AssignmentCreate, request: Request,
                             user: Dict = Depends(require_guru_pengganti_manager)):
    """Tugaskan guru pengganti untuk satu slot jadwal pada satu atau beberapa tanggal."""
    dates = _parse_dates(payload.dates)

    sch = await db.schedules.find_one({'id': payload.schedule_id}, {'_id': 0})
    if not sch:
        raise HTTPException(404, "Jadwal tidak ditemukan")
    original_id = sch['teacher_id']
    if payload.substitute_teacher_id == original_id:
        raise HTTPException(400, "Guru pengganti tidak boleh sama dengan guru yang digantikan")

    substitute = await db.users.find_one(
        {'id': payload.substitute_teacher_id}, {'_id': 0, 'id': 1, 'full_name': 1, 'is_active': 1})
    if not substitute or substitute.get('is_active') is False:
        raise HTTPException(404, "Guru pengganti tidak ditemukan atau tidak aktif")

    sch_day = day_key(sch.get('day'))
    date_strs = [d.isoformat() for d in dates]
    skipped = await _invalid_dates(sch, sch_day, date_strs, payload.substitute_teacher_id)
    if skipped and not payload.skip_invalid:
        _raise_first_problem(skipped, sch_day)
    date_strs = [d for d in date_strs if d not in skipped]
    if not date_strs:
        raise HTTPException(400, "Tidak ada tanggal yang bisa ditugasi: " + '; '.join(
            f"{d} ({r})" for d, (_, r) in sorted(skipped.items())))

    assigned_role = user.get('active_role') if user.get('active_role') in GURU_PENGGANTI_ROLES else 'admin'
    reason = (payload.reason or '').strip() or None
    assigned_at = now_wib().isoformat()
    docs = []
    for d in date_strs:
        doc = SubstituteAssignmentModel(
            schedule_id=sch['id'],
            semester_id=sch.get('semester_id'),
            date=d,
            day=sch_day,
            original_teacher_id=original_id,
            substitute_teacher_id=payload.substitute_teacher_id,
            reason=reason,
            assigned_by_user_id=user['id'],
            assigned_by_role=assigned_role,
            assigned_by_name=user.get('full_name') or user.get('username'),
            assigned_at=assigned_at,
        ).model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        docs.append(doc)
    try:
        await db.substitute_assignments.insert_many([dict(d) for d in docs], ordered=True)
    except (BulkWriteError, DuplicateKeyError):
        # Kalah balapan dengan penyimpanan lain: batalkan sebagian yang sempat masuk.
        await db.substitute_assignments.delete_many({'id': {'$in': [d['id'] for d in docs]}})
        raise HTTPException(409, "Slot ini baru saja ditugasi guru pengganti lain. Muat ulang lalu coba lagi.")

    await log_audit(user, 'create', 'substitute_assignment', sch['id'], {
        'dates': date_strs,
        'original_teacher_id': original_id,
        'substitute_teacher_id': payload.substitute_teacher_id,
        'assigned_by_role': assigned_role,
    }, request)

    return {
        'created': [serialize_doc(d) for d in docs],
        'count': len(docs),
        'skipped': [{'date': d, 'reason': r} for d, (_, r) in sorted(skipped.items())],
    }


async def _journal_status(assignments: List[Dict]) -> Dict[str, str]:
    """Status jurnal tiap penugasan: 'filled' bila guru pengganti sudah mengisi jurnal penugasan itu,
    'missing' bila tanggal sudah lewat tanpa jurnal, selain itu 'pending'."""
    if not assignments:
        return {}
    filled = {
        j['substitute_assignment_id'] for j in await db.journals.find(
            {'substitute_assignment_id': {'$in': [a['id'] for a in assignments]}},
            {'_id': 0, 'substitute_assignment_id': 1},
        ).to_list(len(assignments))
    }
    today = now_wib().date().isoformat()
    return {
        a['id']: 'filled' if a['id'] in filled else ('missing' if a['date'] < today else 'pending')
        for a in assignments
    }


@router.get("/guru-pengganti/assignments")
async def list_assignments(
    date_from: Optional[str] = Query(default=None, alias='from'),
    date_to: Optional[str] = Query(default=None, alias='to'),
    teacher_id: Optional[str] = Query(default=None, description="Guru digantikan ATAU guru pengganti"),
    status: str = Query(default='active', pattern='^(active|cancelled|all)$'),
    q: Optional[str] = Query(default=None, max_length=100),
    limit: int = Query(default=500, ge=1, le=2000),
    user: Dict = Depends(require_guru_pengganti_manager),
):
    """Riwayat & daftar penugasan guru pengganti (untuk halaman daftar dan kalender bulanan)."""
    query: Dict = {}
    if status != 'all':
        query['status'] = status
    if date_from or date_to:
        rng = {}
        if date_from:
            rng['$gte'] = _parse_dates([date_from])[0].isoformat()
        if date_to:
            rng['$lte'] = _parse_dates([date_to])[0].isoformat()
        query['date'] = rng
    if teacher_id:
        query['$or'] = [{'original_teacher_id': teacher_id}, {'substitute_teacher_id': teacher_id}]

    assignments = await db.substitute_assignments.find(query, {'_id': 0}).sort('date', -1).to_list(limit)
    if not assignments:
        return []

    schedules = {
        x['id']: x for x in await db.schedules.find(
            {'id': {'$in': list({a['schedule_id'] for a in assignments})}},
            {'_id': 0, 'id': 1, 'day': 1, 'start_time': 1, 'end_time': 1, 'class_id': 1, 'subject_id': 1},
        ).to_list(2000)
    }
    classes = await _resolve_names('classes', [s.get('class_id') for s in schedules.values()])
    subjects = await _resolve_names('subjects', [s.get('subject_id') for s in schedules.values()])
    people = {
        u['id']: u.get('full_name') for u in await db.users.find(
            {'id': {'$in': list({a['original_teacher_id'] for a in assignments}
                                | {a['substitute_teacher_id'] for a in assignments})}},
            {'_id': 0, 'id': 1, 'full_name': 1},
        ).to_list(2000)
    }
    journal_status = await _journal_status(assignments)
    settings = await get_settings()
    day_slots: Dict[str, List[Dict]] = {}

    needle = (q or '').strip().lower()
    result = []
    for a in assignments:
        sch = schedules.get(a['schedule_id']) or {}
        day = a.get('day') or day_key(sch.get('day'))
        if day not in day_slots:
            day_slots[day] = get_teaching_slots_for_day(settings, day)
        item = {
            'id': a['id'],
            'schedule_id': a['schedule_id'],
            'date': a['date'],
            'day': day,
            'start_time': sch.get('start_time'),
            'end_time': sch.get('end_time'),
            'jam_ke': jam_ke_label(day_slots[day], sch.get('start_time') or '', sch.get('end_time') or ''),
            'class_name': classes.get(sch.get('class_id')) or '-',
            'subject_name': subjects.get(sch.get('subject_id')) or '-',
            'original_teacher_id': a['original_teacher_id'],
            'original_teacher_name': people.get(a['original_teacher_id']) or '-',
            'substitute_teacher_id': a['substitute_teacher_id'],
            'substitute_teacher_name': people.get(a['substitute_teacher_id']) or '-',
            'reason': a.get('reason'),
            'status': a.get('status'),
            'journal_status': journal_status.get(a['id'], 'pending'),
            'assigned_by_name': a.get('assigned_by_name'),
            'assigned_by_role': a.get('assigned_by_role'),
            'assigned_at': a.get('assigned_at'),
            'cancelled_at': a.get('cancelled_at'),
        }
        if needle and needle not in ' '.join(str(item[k] or '') for k in (
                'original_teacher_name', 'substitute_teacher_name', 'class_name', 'subject_name')).lower():
            continue
        result.append(item)
    result.sort(key=lambda x: (x['date'], x['start_time'] or ''))
    return result


@router.delete("/guru-pengganti/assignments/{assignment_id}")
async def cancel_assignment(assignment_id: str, request: Request,
                            user: Dict = Depends(require_guru_pengganti_manager)):
    """Batalkan penugasan (status → cancelled; data tetap tersimpan sebagai riwayat)."""
    a = await db.substitute_assignments.find_one({'id': assignment_id}, {'_id': 0})
    if not a:
        raise HTTPException(404, "Penugasan tidak ditemukan")
    if a.get('status') == 'cancelled':
        raise HTTPException(400, "Penugasan sudah dibatalkan")
    await db.substitute_assignments.update_one({'id': assignment_id}, {'$set': {
        'status': 'cancelled',
        'cancelled_at': now_wib().isoformat(),
        'cancelled_by_user_id': user['id'],
    }})
    await log_audit(user, 'cancel', 'substitute_assignment', assignment_id, {
        'schedule_id': a['schedule_id'], 'date': a['date'],
        'substitute_teacher_id': a['substitute_teacher_id'],
    }, request)
    return {'ok': True}


ATTENDANCE_STATUSES = ('hadir', 'sakit', 'izin', 'alpha')
JOURNAL_GRACE_MINUTES = 15  # sama dengan default validate_schedule


async def validate_slot_for_journal(a: Dict) -> Dict:
    """Validasi slot jadwal penugasan sebelum jurnal (pengganti/guru asli) disimpan.
    Mengembalikan dokumen jadwal bila valid; melempar HTTPException bila tidak."""
    sch = await db.schedules.find_one({'id': a['schedule_id']}, {'_id': 0})
    if not sch or sch.get('is_published') is False:
        raise HTTPException(404, "Jadwal slot ini tidak ditemukan atau tidak aktif")
    if sch.get('teacher_id') != a['original_teacher_id']:
        raise HTTPException(409, "Jadwal slot ini sudah berubah pengampunya; hubungi petugas untuk memperbarui penugasan")
    if day_key(sch.get('day')) != current_day_id():
        raise HTTPException(400, f"Slot ini terjadwal hari {day_key(sch.get('day'))}, bukan hari ini")
    active_sem = await _active_semester_id()
    if active_sem and sch.get('semester_id') and sch['semester_id'] != active_sem:
        raise HTTPException(400, "Jadwal slot ini bukan bagian dari semester aktif")
    try:
        start_h, start_m = map(int, (sch.get('start_time') or '').split(':'))
    except ValueError:
        raise HTTPException(400, "Jam mulai jadwal tidak valid")
    now = now_wib()
    opens_at = now.replace(hour=start_h, minute=start_m, second=0, microsecond=0) - timedelta(minutes=JOURNAL_GRACE_MINUTES)
    if now < opens_at:
        raise HTTPException(400, f"Jurnal slot ini baru bisa diisi mulai pukul {opens_at.strftime('%H:%M')} WIB")
    return sch


class AttendanceRecordIn(BaseModel):
    student_id: str
    student_name: Optional[str] = None
    status: str = Field(pattern='^(hadir|sakit|izin|alpha)$')


class SubstituteJournalIn(BaseModel):
    assignment_id: str
    materi: str = Field(min_length=1, max_length=5000)
    catatan: Optional[str] = Field(default=None, max_length=5000)
    attendance_records: List[AttendanceRecordIn] = Field(default_factory=list)


@router.post("/guru-pengganti/journals")
async def fill_substitute_journal(payload: SubstituteJournalIn, request: Request,
                                  user: Dict = Depends(get_current_user)):
    """Guru pengganti mengisi jurnal slot yang ditugaskan kepadanya (pola piket_fill_journal).

    Jurnal disimpan sebagai entri TERPISAH di `journals` (fill_mode 'substitute'): `teacher_id`
    tetap guru yang digantikan, `filled_by_user_id` = guru pengganti. Jurnal guru asli pada slot
    yang sama tidak tertimpa. Hanya bisa diisi pada tanggal penugasan, satu kali per penugasan.
    """
    a = await db.substitute_assignments.find_one({'id': payload.assignment_id}, {'_id': 0})
    if not a or a.get('status') != 'active':
        raise HTTPException(404, "Penugasan guru pengganti tidak ditemukan atau sudah dibatalkan")
    if a['substitute_teacher_id'] != user['id']:
        raise HTTPException(403, "Penugasan ini bukan untuk Anda")
    today = now_wib().date().isoformat()
    if a['date'] != today:
        raise HTTPException(400, f"Jurnal guru pengganti hanya bisa diisi pada tanggal penugasan ({a['date']})")
    materi = payload.materi.strip()
    if not materi:
        raise HTTPException(400, "Materi wajib diisi")

    sch = await validate_slot_for_journal(a)
    if await db.journals.find_one({'substitute_assignment_id': a['id']}, {'_id': 1}):
        raise HTTPException(409, "Jurnal untuk penugasan ini sudah diisi")

    records = [r.model_dump() for r in payload.attendance_records]
    counts = {s: sum(1 for r in records if r['status'] == s) for s in ATTENDANCE_STATUSES}
    now = now_wib().isoformat()
    j_id = str(uuid.uuid4())
    journal_doc = {
        'id': j_id,
        'schedule_id': sch['id'],
        'teacher_id': sch['teacher_id'],  # guru terjadwal (yang digantikan)
        'class_id': sch.get('class_id'),
        'subject_id': sch.get('subject_id'),
        'room_id': sch.get('room_id'),
        'semester_id': sch.get('semester_id') or a.get('semester_id'),
        'materi': materi,
        'catatan': (payload.catatan or '').strip() or None,
        'siswa_hadir': counts['hadir'],
        'siswa_tidak_hadir': counts['alpha'],
        'siswa_izin': counts['izin'],
        'siswa_sakit': counts['sakit'],
        'started_at': now,
        'scheduled_start': sch.get('start_time'),
        'scheduled_end': sch.get('end_time'),
        'slot_indexes': sch.get('slot_indexes'),
        'validations': {'substitute_fill': True},
        'qr_mode': 'substitute',
        'is_locked': True,
        'fill_mode': 'substitute',
        'filled_by_user_id': user['id'],
        'filled_by_role': 'guru_pengganti',
        'filled_by_name': user.get('full_name') or user.get('username'),
        'substitute_assignment_id': a['id'],
        'substitute_teacher_id': user['id'],
        'journal_date': a['date'],
        'piket_note': f"Guru pengganti{': ' + a['reason'] if a.get('reason') else ''}",
        'created_at': now,
    }
    try:
        await db.journals.insert_one(dict(journal_doc))
    except DuplicateKeyError:
        raise HTTPException(409, "Jurnal untuk penugasan ini sudah diisi")

    if records:
        await db.attendances.insert_many([{
            'id': str(uuid.uuid4()),
            'journal_id': j_id,
            'student_id': r['student_id'],
            'student_name': r.get('student_name'),
            'status': r['status'],
            'created_at': now,
        } for r in records])

    await log_audit(user, 'substitute_fill_journal', 'journal', j_id, details={
        'schedule_id': sch['id'], 'for_teacher_id': sch['teacher_id'], 'assignment_id': a['id'],
    }, request=request)
    return serialize_doc(journal_doc)


class OriginalJournalIn(BaseModel):
    assignment_id: str
    materi: str = Field(min_length=1, max_length=5000)
    catatan: Optional[str] = Field(default=None, max_length=5000)


@router.post("/guru-pengganti/journals/original")
async def fill_original_journal(payload: OriginalJournalIn, request: Request,
                                user: Dict = Depends(get_current_user)):
    """Guru yang digantikan tetap mengisi jurnal slot-nya sendiri (tanpa scan QR karena tidak di kelas).

    Disimpan sebagai jurnal milik guru asli (fill_mode 'self', ditautkan lewat `replaced_assignment_id`),
    berdampingan dengan jurnal guru pengganti — tidak saling menimpa. Absensi dicatat guru pengganti.
    """
    a = await db.substitute_assignments.find_one({'id': payload.assignment_id}, {'_id': 0})
    if not a or a.get('status') != 'active':
        raise HTTPException(404, "Penugasan guru pengganti tidak ditemukan atau sudah dibatalkan")
    if a['original_teacher_id'] != user['id']:
        raise HTTPException(403, "Slot ini bukan milik Anda")
    if a['date'] != now_wib().date().isoformat():
        raise HTTPException(400, f"Jurnal hanya bisa diisi pada tanggal penugasan ({a['date']})")
    materi = payload.materi.strip()
    if not materi:
        raise HTTPException(400, "Materi wajib diisi")

    sch = await validate_slot_for_journal(a)
    if await db.journals.find_one({
        'schedule_id': sch['id'], 'teacher_id': user['id'], 'fill_mode': {'$ne': 'substitute'},
        **day_started_at_filter(),
    }, {'_id': 1}):
        raise HTTPException(409, "Jurnal Anda untuk slot ini hari ini sudah diisi")

    now = now_wib().isoformat()
    j_id = str(uuid.uuid4())
    journal_doc = {
        'id': j_id,
        'schedule_id': sch['id'],
        'teacher_id': user['id'],
        'class_id': sch.get('class_id'),
        'subject_id': sch.get('subject_id'),
        'room_id': sch.get('room_id'),
        'semester_id': sch.get('semester_id') or a.get('semester_id'),
        'materi': materi,
        'catatan': (payload.catatan or '').strip() or None,
        'siswa_hadir': 0, 'siswa_tidak_hadir': 0, 'siswa_izin': 0, 'siswa_sakit': 0,
        'started_at': now,
        'scheduled_start': sch.get('start_time'),
        'scheduled_end': sch.get('end_time'),
        'slot_indexes': sch.get('slot_indexes'),
        'validations': {'original_while_substituted': True},
        'qr_mode': 'none',
        'is_locked': True,
        'fill_mode': 'self',
        'filled_by_user_id': user['id'],
        'filled_by_role': 'guru',
        'filled_by_name': user.get('full_name') or user.get('username'),
        'replaced_assignment_id': a['id'],
        'journal_date': a['date'],
        'created_at': now,
    }
    await db.journals.insert_one(dict(journal_doc))
    await log_audit(user, 'original_fill_journal', 'journal', j_id, details={
        'schedule_id': sch['id'], 'assignment_id': a['id'],
    }, request=request)
    return serialize_doc(journal_doc)


JOURNAL_VIEW_FIELDS = {
    '_id': 0, 'id': 1, 'materi': 1, 'catatan': 1, 'kd_indikator': 1, 'materi_nama': 1, 'started_at': 1,
    'fill_mode': 1, 'filled_by_user_id': 1, 'filled_by_name': 1, 'teacher_id': 1, 'qr_mode': 1,
    'siswa_hadir': 1, 'siswa_sakit': 1, 'siswa_izin': 1, 'siswa_tidak_hadir': 1,
}


@router.get("/guru-pengganti/assignments/{assignment_id}/journals")
async def side_by_side_journals(assignment_id: str, user: Dict = Depends(get_current_user)):
    """Jurnal berdampingan untuk satu penugasan: jurnal guru yang digantikan & jurnal guru pengganti
    pada slot dan tanggal yang sama. Bisa dibuka petugas (admin/waka/piket), guru asli, dan guru pengganti."""
    a = await db.substitute_assignments.find_one({'id': assignment_id}, {'_id': 0})
    if not a:
        raise HTTPException(404, "Penugasan tidak ditemukan")
    if not (can_manage_guru_pengganti(user) or user['id'] in (a['original_teacher_id'], a['substitute_teacher_id'])):
        raise HTTPException(403, "Anda tidak terlibat dalam penugasan ini")

    sch = await db.schedules.find_one({'id': a['schedule_id']}, {'_id': 0}) or {}
    substitute_journal = await db.journals.find_one({'substitute_assignment_id': a['id']}, JOURNAL_VIEW_FIELDS)
    # Jurnal guru asli: yang ditautkan ke penugasan, atau jurnal sendiri (scan/piket) pada slot & tanggal itu.
    original_journal = await db.journals.find_one(
        {'replaced_assignment_id': a['id']}, JOURNAL_VIEW_FIELDS,
    ) or await db.journals.find_one({
        'schedule_id': a['schedule_id'], 'teacher_id': a['original_teacher_id'],
        'fill_mode': {'$ne': 'substitute'}, **day_started_at_filter(date_cls.fromisoformat(a['date'])),
    }, JOURNAL_VIEW_FIELDS)

    names = {
        u['id']: u.get('full_name') for u in await db.users.find(
            {'id': {'$in': [a['original_teacher_id'], a['substitute_teacher_id']]}},
            {'_id': 0, 'id': 1, 'full_name': 1},
        ).to_list(2)
    }
    classes = await _resolve_names('classes', [sch.get('class_id')])
    subjects = await _resolve_names('subjects', [sch.get('subject_id')])
    rooms = await _resolve_names('rooms', [sch.get('room_id')])
    day = a.get('day') or day_key(sch.get('day'))
    settings = await get_settings()
    assignment = {
        'id': a['id'],
        'schedule_id': a['schedule_id'],
        'date': a['date'],
        'day': day,
        'status': a.get('status'),
        'start_time': sch.get('start_time'),
        'end_time': sch.get('end_time'),
        'jam_ke': jam_ke_label(get_teaching_slots_for_day(settings, day),
                               sch.get('start_time') or '', sch.get('end_time') or ''),
        'class_name': classes.get(sch.get('class_id')) or '-',
        'subject_name': subjects.get(sch.get('subject_id')) or '-',
        'room_name': rooms.get(sch.get('room_id')) or '-',
        'original_teacher_id': a['original_teacher_id'],
        'original_teacher_name': names.get(a['original_teacher_id']) or '-',
        'substitute_teacher_id': a['substitute_teacher_id'],
        'substitute_teacher_name': names.get(a['substitute_teacher_id']) or '-',
        'reason': a.get('reason'),
        'assigned_by_name': a.get('assigned_by_name'),
    }
    for j in (original_journal, substitute_journal):
        if j and not j.get('filled_by_name'):
            j['filled_by_name'] = names.get(j.get('filled_by_user_id') or j.get('teacher_id'))
    return {
        'assignment': assignment,
        'original_journal': serialize_doc(original_journal) if original_journal else None,
        'substitute_journal': serialize_doc(substitute_journal) if substitute_journal else None,
    }
