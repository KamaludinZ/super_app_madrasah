"""Shared helpers used across multiple routers (e.g. RBAC class check)."""
from typing import Dict

from core import db


async def user_can_view_class(user: Dict, class_id: str) -> bool:
    if 'admin' in user.get('roles', []):
        return True
    cls = await db.classes.find_one({'id': class_id}, {'_id': 0})
    if cls and cls.get('homeroom_teacher_id') == user['id']:
        return True
    # Allow guru_bk, guru_tata_tertib, guru_piket, tendik to view all
    overlap = set(user.get('roles', [])) & {'guru_bk', 'guru_tata_tertib', 'guru_piket', 'tenaga_kependidikan'}
    if overlap:
        return True
    # Allow subject teachers who teach this class to view its students
    if 'guru' in user.get('roles', []) or 'wali_kelas' in user.get('roles', []):
        sched = await db.schedules.find_one({'class_id': class_id, 'teacher_id': user['id']})
        if sched:
            return True
    return False
