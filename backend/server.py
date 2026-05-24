"""
Super Apps MATSANDATAMA - Main FastAPI Server
MTsN 2 Kota Malang - Sistem Jurnal Presisi Multi-Role

This file is intentionally THIN. All endpoint definitions live under
/app/backend/routers/<domain>.py. Shared dependencies & helpers live in
/app/backend/core.py.

Refactor goal: maintainability — server.py used to be ~3,200 lines.
"""
import os

from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

from core import client, db, logger
from routers import (
    academic,
    admin,
    admin_settings,
    alumni,
    app_info,
    auth,
    classes,
    dokumen_siswa,
    health,
    holidays_tasks,
    indikator_materi,
    jabatan,
    journals,
    notifications,
    phase4,
    promotions,
    public,
    reports,
    rooms,
    schedules,
    semesters,
    student_records,
    students,
    subjects,
    tahun_takwim,
    tatib,
    users,
    verval,
    wali_parent,
)

# ============================================================
# APP FACTORY
# ============================================================
app = FastAPI(title="Super Apps MATSANDATAMA API")

# All API routes go under /api prefix (handled by Kubernetes ingress).
api_router = APIRouter(prefix="/api")

# Register all domain routers.
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(admin_settings.router)
api_router.include_router(app_info.router)
api_router.include_router(academic.router)
api_router.include_router(tahun_takwim.router)
api_router.include_router(classes.router)
api_router.include_router(subjects.router)
api_router.include_router(rooms.router)
api_router.include_router(jabatan.router)
api_router.include_router(users.router)
api_router.include_router(students.router)
api_router.include_router(schedules.router)
api_router.include_router(journals.router)
api_router.include_router(wali_parent.router)
api_router.include_router(admin.router)
api_router.include_router(public.router)
api_router.include_router(holidays_tasks.router)
api_router.include_router(phase4.router)
api_router.include_router(notifications.router)
api_router.include_router(reports.router)
api_router.include_router(alumni.router)
api_router.include_router(promotions.router)
api_router.include_router(student_records.router)
api_router.include_router(semesters.router)
api_router.include_router(verval.router)
api_router.include_router(dokumen_siswa.router)
api_router.include_router(indikator_materi.router)
api_router.include_router(tatib.router)

app.include_router(api_router)

# ============================================================
# MIDDLEWARE
# ============================================================
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"], allow_headers=["*"],
)

# Error logging middleware - log all unhandled exceptions
from fastapi import Request as FastAPIRequest
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


class ErrorLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: FastAPIRequest, call_next):
        try:
            response = await call_next(request)
            return response
        except Exception as exc:
            # Log the error
            from core import log_error
            try:
                # Try to get current user from request state
                user = getattr(request.state, 'user', None)
                await log_error(
                    error_type=type(exc).__name__,
                    message=str(exc),
                    details={
                        'path': request.url.path,
                        'method': request.method,
                        'include_traceback': True
                    },
                    user=user,
                    request=request
                )
            except Exception as log_err:
                # If logging fails, at least log to console
                logger.error(f"Failed to log error: {log_err}")
                logger.error(f"Original error: {exc}")

            # Re-raise the exception to let FastAPI handle it
            raise exc


app.add_middleware(ErrorLoggingMiddleware)


# ============================================================
# LIFECYCLE
# ============================================================
@app.on_event("startup")
async def startup_event():
    try:
        from seed_data import refresh_demo_schedule, seed_all
        await seed_all(db)
        await refresh_demo_schedule(db)
    except Exception as e:
        logger.error(f"Seed error: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


