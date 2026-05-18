"""Reports: sarana prasarana, siswa bermasalah, catatan umum."""
import uuid
from datetime import datetime
from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from core import (
    db,
    get_current_user,
    log_audit,
    require_role,
    serialize_doc,
)
from models import ReportSubmit, ReportUpdate

router = APIRouter()


# ============================================================
# SUBMIT REPORT (Guru & Wali Kelas)
# ============================================================
@router.post("/reports")
async def submit_report(req: ReportSubmit, request: Request,
                        user: Dict = Depends(require_role('guru', 'wali_kelas'))):
    """Submit a new report (sarana_prasarana, siswa, catatan)."""
    doc = req.model_dump()
    doc['id'] = str(uuid.uuid4())
    doc['reported_by'] = user['id']
    doc['reported_at'] = datetime.utcnow().isoformat()
    doc['status'] = 'baru'

    await db.reports.insert_one(doc)
    await log_audit(user, 'create', 'report', doc['id'],
                    details={'type': req.type, 'title': req.title},
                    request=request)
    return serialize_doc(doc)


# ============================================================
# GET REPORTS
# ============================================================
@router.get("/reports")
async def get_reports(
    type: Optional[str] = None,
    class_id: Optional[str] = None,
    status: Optional[str] = None,
    user: Dict = Depends(get_current_user)
):
    """
    Get reports based on role:
    - Admin: sees all reports
    - Wali Kelas: sees reports for their class
    - Guru: sees their own reports
    """
    is_admin = 'admin' in user.get('roles', [])
    is_wali_kelas = 'wali_kelas' in user.get('roles', [])
    is_guru = 'guru' in user.get('roles', [])

    query = {}

    # Apply filters
    if type:
        query['type'] = type
    if status:
        query['status'] = status

    # Role-based filtering
    if is_admin:
        # Admin sees all reports, can filter by class_id
        if class_id:
            query['class_id'] = class_id
    elif is_wali_kelas:
        # Wali kelas sees only reports for their class
        wk_class = await db.classes.find_one({'homeroom_teacher_id': user['id']}, {'_id': 0, 'id': 1})
        if not wk_class:
            return []
        query['class_id'] = wk_class['id']
    elif is_guru:
        # Guru sees only their own reports
        query['reported_by'] = user['id']
    else:
        return []

    items = await db.reports.find(query, {'_id': 0}).sort('reported_at', -1).to_list(500)

    # Enrich with related data
    enriched = []
    for r in items:
        r = serialize_doc(r)

        # Get reporter info
        reporter = await db.users.find_one({'id': r.get('reported_by')}, {'_id': 0, 'full_name': 1, 'username': 1})
        r['reporter_name'] = reporter.get('full_name') if reporter else None

        # Get class info
        if r.get('class_id'):
            cls = await db.classes.find_one({'id': r['class_id']}, {'_id': 0, 'name': 1})
            r['class_name'] = cls.get('name') if cls else None

        # Get student info
        if r.get('student_id'):
            student = await db.users.find_one({'id': r['student_id']}, {'_id': 0, 'full_name': 1, 'username': 1})
            r['student_name'] = student.get('full_name') if student else None

        # Get reviewer info
        if r.get('reviewed_by'):
            reviewer = await db.users.find_one({'id': r['reviewed_by']}, {'_id': 0, 'full_name': 1})
            r['reviewer_name'] = reviewer.get('full_name') if reviewer else None

        enriched.append(r)

    return enriched


# ============================================================
# GET SINGLE REPORT
# ============================================================
@router.get("/reports/{report_id}")
async def get_report(report_id: str, user: Dict = Depends(get_current_user)):
    """Get single report details."""
    report = await db.reports.find_one({'id': report_id}, {'_id': 0})
    if not report:
        raise HTTPException(404, "Laporan tidak ditemukan")

    # Check permissions
    is_admin = 'admin' in user.get('roles', [])
    is_owner = report.get('reported_by') == user['id']
    is_wali_kelas = False

    if 'wali_kelas' in user.get('roles', []) and report.get('class_id'):
        wk_class = await db.classes.find_one({'homeroom_teacher_id': user['id']}, {'_id': 0, 'id': 1})
        is_wali_kelas = wk_class and wk_class['id'] == report.get('class_id')

    if not (is_admin or is_owner or is_wali_kelas):
        raise HTTPException(403, "Tidak diizinkan")

    report = serialize_doc(report)

    # Enrich
    reporter = await db.users.find_one({'id': report.get('reported_by')}, {'_id': 0, 'full_name': 1, 'username': 1})
    report['reporter_name'] = reporter.get('full_name') if reporter else None

    if report.get('class_id'):
        cls = await db.classes.find_one({'id': report['class_id']}, {'_id': 0, 'name': 1})
        report['class_name'] = cls.get('name') if cls else None

    if report.get('student_id'):
        student = await db.users.find_one({'id': report['student_id']}, {'_id': 0, 'full_name': 1, 'username': 1})
        report['student_name'] = student.get('full_name') if student else None

    if report.get('reviewed_by'):
        reviewer = await db.users.find_one({'id': report['reviewed_by']}, {'_id': 0, 'full_name': 1})
        report['reviewer_name'] = reviewer.get('full_name') if reviewer else None

    return report


# ============================================================
# UPDATE REPORT (Admin)
# ============================================================
@router.put("/reports/{report_id}")
async def update_report(report_id: str, req: ReportUpdate, request: Request,
                        user: Dict = Depends(require_role('admin', 'guru_bk'))):
    """Admin & Guru BK updates report status and response."""
    existing = await db.reports.find_one({'id': report_id})
    if not existing:
        raise HTTPException(404, "Laporan tidak ditemukan")

    update_data = {}
    if req.status is not None:
        update_data['status'] = req.status
        if req.status == 'ditinjau' and not existing.get('reviewed_by'):
            update_data['reviewed_by'] = user['id']
            update_data['reviewed_at'] = datetime.utcnow().isoformat()
        elif req.status == 'selesai' and not existing.get('resolved_at'):
            update_data['resolved_at'] = datetime.utcnow().isoformat()

    if req.response is not None:
        update_data['response'] = req.response
        if not existing.get('reviewed_by'):
            update_data['reviewed_by'] = user['id']
            update_data['reviewed_at'] = datetime.utcnow().isoformat()

    await db.reports.update_one({'id': report_id}, {'$set': update_data})
    await log_audit(user, 'update', 'report', report_id,
                    details={'status': req.status, 'has_response': bool(req.response)},
                    request=request)

    updated = await db.reports.find_one({'id': report_id}, {'_id': 0})
    return serialize_doc(updated)


# ============================================================
# DELETE REPORT
# ============================================================
@router.delete("/reports/{report_id}")
async def delete_report(report_id: str, request: Request,
                        user: Dict = Depends(get_current_user)):
    """Delete report. Only owner or admin can delete."""
    existing = await db.reports.find_one({'id': report_id})
    if not existing:
        raise HTTPException(404, "Laporan tidak ditemukan")

    is_admin = 'admin' in user.get('roles', [])
    is_owner = existing.get('reported_by') == user['id']

    if not (is_admin or is_owner):
        raise HTTPException(403, "Tidak diizinkan")

    # Only allow deletion if status is still 'baru'
    if existing.get('status') != 'baru' and not is_admin:
        raise HTTPException(400, "Hanya laporan baru yang bisa dihapus")

    await db.reports.delete_one({'id': report_id})
    await log_audit(user, 'delete', 'report', report_id, request=request)
    return {'message': 'Laporan dihapus'}


# ============================================================
# STATS (Admin)
# ============================================================
@router.get("/reports/stats/summary")
async def get_reports_stats(user: Dict = Depends(require_role('admin', 'guru_bk'))):
    """Get report statistics for admin & Guru BK dashboard."""
    total = await db.reports.count_documents({})
    by_type = {}
    by_status = {}
    by_priority = {}

    for t in ['sarana_prasarana', 'siswa', 'catatan']:
        by_type[t] = await db.reports.count_documents({'type': t})

    for s in ['baru', 'ditinjau', 'dalam_proses', 'selesai', 'ditolak']:
        by_status[s] = await db.reports.count_documents({'status': s})

    for p in ['rendah', 'sedang', 'tinggi', 'mendesak']:
        by_priority[p] = await db.reports.count_documents({'priority': p})

    return {
        'total': total,
        'by_type': by_type,
        'by_status': by_status,
        'by_priority': by_priority,
    }
