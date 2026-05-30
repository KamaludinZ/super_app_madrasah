"""
Super Apps MATSANDATAMA - Core shared dependencies.

This module centralizes:
- Database connection (Motor / MongoDB)
- Shared FastAPI dependencies (auth, RBAC, security scheme)
- Shared helpers (serialize_doc, get_active_academic_year, get_settings)
- Audit / security logger helpers

All routers under /app/backend/routers/ import from this module to avoid
circular dependencies and keep server.py thin.
"""
import os
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient

from models import AuditLogModel, SecurityLogModel, SettingsModel
from auth_utils import decode_token

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ============================================================
# DNS RESOLVER FIX FOR MONGODB ATLAS
# ============================================================
# Fix DNS resolution issues by using Google DNS
try:
    import dns.resolver
    dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
    dns.resolver.default_resolver.nameservers = ['8.8.8.8', '8.8.4.4']
except Exception as e:
    print(f"DNS resolver config warning: {e}")

# ============================================================
# DATABASE
# ============================================================
mongo_url = os.getenv('MONGO_URL')
if not mongo_url:
    raise ValueError(
        "MONGO_URL environment variable is required. "
        "Please set it in Coolify or your .env file. "
        "Example: mongodb://user:pass@host:27017 or mongodb+srv://..."
    )

db_name = os.getenv('DB_NAME', 'super_app_madrasah')
if not db_name:
    raise ValueError("DB_NAME environment variable is required")

try:
    client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=10000)
    db = client[db_name]
    logger.info(f"MongoDB client initialized for database: {db_name}")
except Exception as e:
    logger.error(f"Failed to initialize MongoDB client: {e}")
    raise

# ============================================================
# SECURITY
# ============================================================
security = HTTPBearer(auto_error=False)

# ============================================================
# LOGGING
# ============================================================
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("matsandatama")


# ============================================================
# HELPERS
# ============================================================
def serialize_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Convert MongoDB doc into JSON-serializable dict (recursive)."""
    if not doc:
        return doc
    doc.pop('_id', None)
    for k, v in list(doc.items()):
        if isinstance(v, datetime):
            doc[k] = v.isoformat()
        elif isinstance(v, dict):
            doc[k] = serialize_doc(v)
        elif isinstance(v, list):
            doc[k] = [
                serialize_doc(i) if isinstance(i, dict)
                else (i.isoformat() if isinstance(i, datetime) else i)
                for i in v
            ]
    return doc


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Dict[str, Any]:
    if not credentials:
        raise HTTPException(status_code=401, detail="Tidak terautentikasi. Silakan login.")
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Token tidak valid atau kedaluwarsa")
    user_id = payload.get('sub')
    user = await db.users.find_one({'id': user_id})
    if not user or not user.get('is_active', True):
        raise HTTPException(status_code=401, detail="User tidak ditemukan atau dinonaktifkan")
    user['active_role'] = payload.get('active_role',
                                      user['roles'][0] if user.get('roles') else 'guru')

    # Store impersonation info if present in JWT
    impersonator_id = payload.get('impersonator_id')
    impersonator_username = payload.get('impersonator_username')
    if impersonator_id:
        request.state.impersonator_id = impersonator_id
        request.state.impersonator_username = impersonator_username
        user['is_impersonating'] = True
        user['impersonator_id'] = impersonator_id
        user['impersonator_username'] = impersonator_username

    return serialize_doc(user)


def require_role(*allowed_roles: str):
    async def checker(user: Dict[str, Any] = Depends(get_current_user)):
        active = user.get('active_role')
        if active not in allowed_roles and 'admin' not in user.get('roles', []):
            raise HTTPException(status_code=403, detail=f"Akses ditolak. Peran aktif: {active}")
        return user
    return checker


async def log_audit(user, action, entity, entity_id=None, details=None, request: Request = None):
    log = AuditLogModel(
        user_id=user.get('id') if user else None,
        username=user.get('username') if user else None,
        action=action, entity=entity, entity_id=entity_id,
        details=details or {},
        ip_address=request.client.host if request else None,
        user_agent=request.headers.get('user-agent') if request else None,
    )
    doc = log.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.audit_logs.insert_one(doc)


async def log_security(event_type, username=None, details=None, request: Request = None):
    log = SecurityLogModel(
        event_type=event_type, username=username,
        ip_address=request.client.host if request else None,
        user_agent=request.headers.get('user-agent') if request else None,
        details=details or {},
    )
    doc = log.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.security_logs.insert_one(doc)


async def log_error(error_type, message, details=None, user=None, request: Request = None):
    """Log application errors for monitoring and debugging"""
    import traceback

    # Use audit logs with action='error' for error tracking
    error_details = {
        'error_type': error_type,
        'message': str(message),
        'traceback': traceback.format_exc() if details and details.get('include_traceback') else None,
        **(details or {})
    }

    await log_audit(
        user=user,
        action='error',
        entity='system',
        entity_id=None,
        details=error_details,
        request=request
    )


async def get_active_academic_year():
    ay = await db.academic_years.find_one({'is_active': True})
    return serialize_doc(ay) if ay else None


async def get_settings():
    s = await db.settings.find_one({'id': 'global_config'})
    if not s:
        default = SettingsModel().model_dump()
        default['updated_at'] = default['updated_at'].isoformat()
        await db.settings.insert_one(default)
        return default
    return serialize_doc(s)


async def get_active_context(user: Optional[Dict[str, Any]] = None):
    """
    Get active semester context (HIERARCHICAL TIME SYSTEM).

    Priority:
    1. User override (view_semester_id) if set
    2. Active semester globally

    Returns: {
        'semester_id': str,
        'semester_name': str,
        'semester_code': str,
        'academic_year_id': str,
        'academic_year_name': str,
        'tahun_takwim_ids': List[str],  # NEW: Tahun Takwim yang dilintasi
        'tahun_takwim_info': List[Dict],  # NEW: Detail Tahun Takwim
        'is_override': bool,
        'curriculum_id': str,
        'curriculum_name': str,
        'curriculum_code': str
    }
    """
    override_sem_id = user.get('view_semester_id') if user else None

    # Get semester (either override or active)
    if override_sem_id:
        sem = await db.semesters.find_one({'id': override_sem_id}, {'_id': 0})
        if not sem:
            # Fallback to active if override not found
            sem = await db.semesters.find_one({'is_active': True}, {'_id': 0})
            override_sem_id = None
    else:
        sem = await db.semesters.find_one({'is_active': True}, {'_id': 0})

    if not sem:
        return {
            'semester_id': None,
            'semester_name': None,
            'semester_code': None,
            'academic_year_id': None,
            'academic_year_name': None,
            'tahun_takwim_ids': [],
            'tahun_takwim_info': [],
            'is_override': False,
            'curriculum_id': None,
            'curriculum_name': None,
            'curriculum_code': None,
        }

    # Get academic year
    ay = await db.academic_years.find_one({'id': sem.get('academic_year_id')}, {'_id': 0})

    # Get Tahun Takwim info (NEW)
    tahun_takwim_ids = ay.get('tahun_takwim_ids', []) if ay else []
    tahun_takwim_info = []
    if tahun_takwim_ids:
        for tt_id in tahun_takwim_ids:
            tt = await db.tahun_takwim.find_one({'id': tt_id}, {'_id': 0})
            if tt:
                tahun_takwim_info.append({
                    'id': tt.get('id'),
                    'year': tt.get('year'),
                    'name': tt.get('name'),
                    'is_active': tt.get('is_active', False),
                })

    # Get curriculum if set
    curriculum_name = None
    curriculum_code = None
    if sem.get('curriculum_id'):
        c = await db.curriculums.find_one({'id': sem['curriculum_id']}, {'_id': 0, 'name': 1, 'code': 1})
        if c:
            curriculum_name = c.get('name')
            curriculum_code = c.get('code')

    return {
        'semester_id': sem['id'],
        'semester_name': sem.get('name'),
        'semester_code': sem.get('code'),
        'academic_year_id': ay['id'] if ay else None,
        'academic_year_name': ay.get('name') if ay else None,
        'tahun_takwim_ids': tahun_takwim_ids,
        'tahun_takwim_info': tahun_takwim_info,
        'is_override': bool(override_sem_id),
        'curriculum_id': sem.get('curriculum_id'),
        'curriculum_name': curriculum_name,
        'curriculum_code': curriculum_code,
    }
