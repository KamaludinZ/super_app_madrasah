"""Health, root, roles, public settings."""
from fastapi import APIRouter

from core import get_settings
from journal_core import now_wib
from models import ROLES, ROLE_LABELS

router = APIRouter()


@router.get("/")
async def root():
    return {"message": "Super Apps MATSANDATAMA API", "status": "ok"}


@router.get("/health")
async def health():
    return {"status": "healthy", "time_wib": now_wib().isoformat()}


@router.get("/roles")
async def get_roles():
    return [{'value': r, 'label': ROLE_LABELS[r]} for r in ROLES]


@router.get("/settings")
async def public_settings():
    s = await get_settings()
    return {
        'app_name': s.get('app_name'),
        'school_name': s.get('school_name'),
        'npsn': s.get('npsn'),
        'address': s.get('address'),
        'logo_url': s.get('logo_url'),
        'favicon_url': s.get('favicon_url'),
        'primary_color': s.get('primary_color'),
        'active_days': s.get('active_days', []),
        'teaching_slots': s.get('teaching_slots', []),
        'idle_timeout_minutes': s.get('idle_timeout_minutes', 30),
        'session_max_hours': s.get('session_max_hours', 12),
    }
