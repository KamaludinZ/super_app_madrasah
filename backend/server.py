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
    events,
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
    rkam,
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
api_router.include_router(events.router)
api_router.include_router(rkam.router)

app.include_router(api_router)

# ============================================================
# MIDDLEWARE
# ============================================================

# Security Headers Middleware - Production Hardening
@app.middleware("http")
async def add_security_headers(request, call_next):
    """Add security headers to all responses for production hardening"""
    response = await call_next(request)

    # Prevent clickjacking attacks
    response.headers["X-Frame-Options"] = "DENY"

    # Prevent MIME type sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"

    # Enable XSS protection (legacy browsers)
    response.headers["X-XSS-Protection"] = "1; mode=block"

    # Referrer policy - don't leak URLs to external sites
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    # Permissions policy - restrict browser features
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

    # Content Security Policy - prevent XSS
    # Note: Adjust based on your CDN and external resources
    csp = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' data:; "
        "connect-src 'self'; "
        "frame-ancestors 'none';"
    )
    response.headers["Content-Security-Policy"] = csp

    # HSTS - Force HTTPS (only in production with HTTPS)
    if os.environ.get('ENVIRONMENT') == 'production':
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    return response

# CORS Middleware - MUST be after security headers
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
    """
    Startup event - seeds data only in development mode.
    For production, data should be seeded manually using seed_all_data.py
    """
    import os
    env = os.environ.get("ENVIRONMENT", "development").strip().lower()

    if env == "production":
        logger.info("Production mode - skipping automatic data seeding")
        logger.info("Use seed_all_data.py to manually seed data if needed")
        return

    # Development mode - run seeders
    try:
        from seed_data import is_production_env, refresh_demo_schedule, seed_all
        logger.info("Development mode - running data seeders")
        await seed_all(db)
        if not is_production_env():
            await refresh_demo_schedule(db)
        logger.info("Data seeding completed successfully")
    except Exception as e:
        logger.error(f"Seed error (development mode): {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


