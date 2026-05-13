"""Admin: stats, audit-logs, security-logs, backup."""
import io
import json
import uuid
from datetime import datetime
from typing import Dict, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse

from core import (
    db,
    get_active_academic_year,
    get_settings,
    log_audit,
    logger,
    require_role,
    serialize_doc,
)
from journal_core import current_day_id, now_wib

router = APIRouter()


# ============================================================
# AUDIT / SECURITY LOGS
# ============================================================
@router.get("/admin/audit-logs")
async def get_audit_logs(limit: int = 200, target_id: Optional[str] = None,
                         target_type: Optional[str] = None,
                         user: Dict = Depends(require_role('admin'))):
    q = {}
    if target_id:
        q['entity_id'] = target_id
    if target_type:
        q['entity'] = target_type
    items = await db.audit_logs.find(q, {'_id': 0}).sort('timestamp', -1).to_list(limit)
    return [serialize_doc(i) for i in items]


@router.get("/admin/security-logs")
async def get_security_logs(limit: int = 200, user: Dict = Depends(require_role('admin'))):
    items = await db.security_logs.find({}, {'_id': 0}).sort('timestamp', -1).to_list(limit)
    return [serialize_doc(i) for i in items]


# ============================================================
# ADMIN STATS
# ============================================================
@router.get("/admin/stats")
async def admin_stats(user: Dict = Depends(require_role('admin'))):
    today = current_day_id()
    ay = await get_active_academic_year()
    total_users = await db.users.count_documents({})
    total_classes = await db.classes.count_documents({})
    total_rooms = await db.rooms.count_documents({})
    total_schedules_today = await db.schedules.count_documents({
        'day': today, 'academic_year_id': ay['id'] if ay else 'none',
    })
    now = now_wib()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    total_journals_today = await db.journals.count_documents({'started_at': {'$gte': today_start}})
    return {
        'total_users': total_users, 'total_classes': total_classes, 'total_rooms': total_rooms,
        'total_schedules_today': total_schedules_today, 'total_journals_today': total_journals_today,
        'active_academic_year': ay.get('name') if ay else None, 'current_day': today,
    }


@router.get("/admin/stats/students")
async def admin_stats_students(user: Dict = Depends(require_role('admin'))):
    """Statistik siswa: total, per tingkat (7/8/9), mutasi di TP aktif."""
    ay = await get_active_academic_year()
    total = await db.users.count_documents({'roles': 'siswa', 'is_active': True})
    classes = await db.classes.find({'academic_year_id': ay['id']} if ay else {}, {'_id': 0, 'id': 1, 'grade': 1}).to_list(500)
    grade_map = {c['id']: c.get('grade') for c in classes}
    per_grade = {7: 0, 8: 0, 9: 0}
    siswa_users = await db.users.find({'roles': 'siswa', 'is_active': True}, {'_id': 0, 'student_class_id': 1}).to_list(5000)
    for s in siswa_users:
        g = grade_map.get(s.get('student_class_id'))
        if g in per_grade:
            per_grade[g] += 1
    mutasi_q = {'roles': 'siswa'}
    if ay:
        mutasi_q['mutation_ay_id'] = ay['id']
    mutasi_q['mutation_type'] = {'$in': ['masuk', 'keluar']}
    total_mutasi = await db.users.count_documents(mutasi_q)
    mutasi_masuk = await db.users.count_documents({**mutasi_q, 'mutation_type': 'masuk'})
    mutasi_keluar = await db.users.count_documents({**mutasi_q, 'mutation_type': 'keluar'})
    return {
        'total': total,
        'kelas_7': per_grade[7],
        'kelas_8': per_grade[8],
        'kelas_9': per_grade[9],
        'mutasi_total': total_mutasi,
        'mutasi_masuk': mutasi_masuk,
        'mutasi_keluar': mutasi_keluar,
        'academic_year': ay.get('name') if ay else None,
    }


@router.get("/admin/stats/achievements")
async def admin_stats_achievements(user: Dict = Depends(require_role('admin'))):
    """Statistik prestasi: total, per tingkat lomba."""
    total = await db.achievements.count_documents({})
    verified = await db.achievements.count_documents({'is_verified': True})
    levels = ['sekolah', 'kecamatan', 'kab_kota', 'kota', 'kabupaten', 'provinsi', 'nasional', 'internasional']
    by_level = {}
    for lvl in levels:
        by_level[lvl] = await db.achievements.count_documents({'level': lvl})
    kab_kota = by_level.get('kab_kota', 0) + by_level.get('kota', 0) + by_level.get('kabupaten', 0)
    by_holder = {}
    for ht in ['siswa', 'guru', 'tendik', 'madrasah']:
        by_holder[ht] = await db.achievements.count_documents({'holder_type': ht})
    legacy_siswa = await db.achievements.count_documents({'holder_type': {'$exists': False}, 'student_id': {'$ne': None}})
    by_holder['siswa'] = by_holder.get('siswa', 0) + legacy_siswa
    return {
        'total': total,
        'verified': verified,
        'kab_kota': kab_kota,
        'provinsi': by_level.get('provinsi', 0),
        'nasional': by_level.get('nasional', 0),
        'internasional': by_level.get('internasional', 0),
        'by_holder': by_holder,
        'by_level': by_level,
    }


# ============================================================
# BACKUP & RESTORE
# ============================================================
BACKUP_COLLECTIONS = [
    'users', 'classes', 'rooms', 'subjects', 'schedules', 'academic_years',
    'settings', 'journals', 'attendances', 'class_attendances', 'class_cleanliness',
    'audit_logs', 'security_logs', 'piket_schedules', 'achievements',
    'extracurriculars', 'extra_members', 'extra_attendance', 'extra_grades',
    'student_grades', 'weekly_holidays', 'academic_holidays', 'teacher_tasks',
    'password_reset_tokens',
]


@router.get("/admin/backup/info")
async def backup_info(user: Dict = Depends(require_role('admin'))):
    """Statistik untuk halaman backup: total dokumen per koleksi."""
    info = {}
    for coll in BACKUP_COLLECTIONS:
        try:
            info[coll] = await db[coll].count_documents({})
        except Exception:
            info[coll] = 0
    last_backup = await db.backup_logs.find_one({}, {'_id': 0}, sort=[('created_at', -1)])
    return {
        'collections': info,
        'total_documents': sum(info.values()),
        'last_backup': serialize_doc(last_backup) if last_backup else None,
    }


@router.get("/admin/backup/export")
async def backup_export(user: Dict = Depends(require_role('admin')), request: Request = None):
    """Download backup .json semua koleksi."""
    dump = {
        'version': 1,
        'exported_at': now_wib().isoformat(),
        'school_name': (await get_settings()).get('school_name', ''),
        'collections': {},
    }
    for coll in BACKUP_COLLECTIONS:
        try:
            items = await db[coll].find({}, {'_id': 0}).to_list(100000)
            for it in items:
                for k, v in list(it.items()):
                    if isinstance(v, datetime):
                        it[k] = v.isoformat()
            dump['collections'][coll] = items
        except Exception as e:
            logger.error(f"Backup export error for {coll}: {e}")
            dump['collections'][coll] = []
    await db.backup_logs.insert_one({
        'id': str(uuid.uuid4()),
        'type': 'export',
        'user_id': user['id'],
        'user_name': user.get('full_name', user['username']),
        'total_documents': sum(len(v) for v in dump['collections'].values()),
        'created_at': now_wib().isoformat(),
    })
    if request:
        await log_audit(user, 'backup_export', 'system', '-', details={
            'total': sum(len(v) for v in dump['collections'].values())
        }, request=request)
    payload = json.dumps(dump, ensure_ascii=False, default=str).encode('utf-8')
    filename = f"backup_matsandatama_{now_wib().strftime('%Y%m%d_%H%M%S')}.json"
    return StreamingResponse(
        io.BytesIO(payload),
        media_type='application/json',
        headers={'Content-Disposition': f'attachment; filename={filename}'}
    )


@router.post("/admin/backup/import")
async def backup_import(file: UploadFile = File(...), mode: str = Form('merge'),
                       user: Dict = Depends(require_role('admin')), request: Request = None):
    """Restore dari backup .json. Mode: merge (default) atau replace."""
    if not file.filename.lower().endswith('.json'):
        raise HTTPException(400, "Hanya file .json yang didukung")
    if mode not in ('merge', 'replace'):
        raise HTTPException(400, "Mode harus 'merge' atau 'replace'")
    content = await file.read()
    try:
        dump = json.loads(content.decode('utf-8'))
    except Exception:
        raise HTTPException(400, "File backup tidak valid (bukan JSON)")
    if 'collections' not in dump:
        raise HTTPException(400, "Format backup tidak valid")
    summary = {'restored': {}, 'errors': []}
    for coll, items in dump['collections'].items():
        if coll not in BACKUP_COLLECTIONS:
            continue
        try:
            if mode == 'replace':
                await db[coll].delete_many({})
            count = 0
            for it in items:
                it.pop('_id', None)
                if mode == 'merge' and it.get('id'):
                    await db[coll].update_one({'id': it['id']}, {'$set': it}, upsert=True)
                else:
                    await db[coll].insert_one(it)
                count += 1
            summary['restored'][coll] = count
        except Exception as e:
            summary['errors'].append(f"{coll}: {str(e)[:100]}")
    await db.backup_logs.insert_one({
        'id': str(uuid.uuid4()),
        'type': f'import_{mode}',
        'user_id': user['id'],
        'user_name': user.get('full_name', user['username']),
        'total_documents': sum(summary['restored'].values()),
        'created_at': now_wib().isoformat(),
    })
    if request:
        await log_audit(user, f'backup_import_{mode}', 'system', '-', details=summary, request=request)
    return summary


@router.get("/admin/backup/logs")
async def backup_logs(user: Dict = Depends(require_role('admin'))):
    items = await db.backup_logs.find({}, {'_id': 0}).sort('created_at', -1).to_list(50)
    return [serialize_doc(i) for i in items]
