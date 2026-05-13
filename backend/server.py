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
    auth,
    classes,
    health,
    holidays_tasks,
    journals,
    phase4,
    public,
    rooms,
    schedules,
    students,
    subjects,
    users,
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
api_router.include_router(academic.router)
api_router.include_router(classes.router)
api_router.include_router(subjects.router)
api_router.include_router(rooms.router)
api_router.include_router(users.router)
api_router.include_router(students.router)
api_router.include_router(schedules.router)
api_router.include_router(journals.router)
api_router.include_router(wali_parent.router)
api_router.include_router(admin.router)
api_router.include_router(public.router)
api_router.include_router(holidays_tasks.router)
api_router.include_router(phase4.router)

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
