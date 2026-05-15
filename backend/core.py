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
# DATABASE
# ============================================================
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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
