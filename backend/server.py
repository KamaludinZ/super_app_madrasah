"""
Super Apps MATSANDATAMA - Main FastAPI Server
MTsN 2 Kota Malang - Sistem Jurnal Presisi Multi-Role

This file is intentionally THIN. All endpoint definitions live under
/app/backend/routers/<domain>.py. Shared dependencies & helpers live in
/app/backend/core.py.

Refactor goal: maintainability — server.py used to be ~3,200 lines.
"""
import os

from fastapi import APIRouter, FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware

from core import client, db, logger
from routers import (
    academic,
    achievement_upload,
    admin,
    admin_settings,
    alumni,
    app_info,
    auth,
    bk,
    classes,
    dokumen_siswa,
    events,
    health,
    holidays_tasks,
    indikator_materi,
    jabatan,
    journals,
    kelas_digital,
    notifications,
    perpus,
    phase4,
    promotions,
    public,
    push,
    reports,
    rkam,
    rooms,
    sarpras,
    schedules,
    school_apps,
    semesters,
    student_detail_upload,
    student_records,
    students,
    subjects,
    tahun_takwim,
    tatib,
    uks,
    users,
    verval,
    wali_parent,
    waka_kurikulum,
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
api_router.include_router(student_detail_upload.router)
api_router.include_router(schedules.router)
api_router.include_router(journals.router)
api_router.include_router(wali_parent.router)
api_router.include_router(admin.router)
api_router.include_router(public.router)
api_router.include_router(holidays_tasks.router)
api_router.include_router(phase4.router)
api_router.include_router(achievement_upload.router)
api_router.include_router(notifications.router)
api_router.include_router(push.router)
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
api_router.include_router(school_apps.router)
api_router.include_router(waka_kurikulum.router)
api_router.include_router(bk.router)
api_router.include_router(perpus.router)
api_router.include_router(uks.router)
api_router.include_router(sarpras.router)

# Debug kelas_digital router
logger.info(f"[DEBUG] About to include kelas_digital router")
logger.info(f"[DEBUG] kelas_digital.router has {len(kelas_digital.router.routes)} routes")
logger.info(f"[DEBUG] api_router has {len(api_router.routes)} routes before include")
try:
    api_router.include_router(kelas_digital.router)
    logger.info(f"[DEBUG] Successfully included kelas_digital router")
    logger.info(f"[DEBUG] api_router has {len(api_router.routes)} routes AFTER include")

    # Check what routes are in api_router
    kelas_in_api = [r.path for r in api_router.routes if hasattr(r, 'path') and '/kelas' in r.path]
    logger.info(f"[DEBUG] Kelas routes in api_router: {len(kelas_in_api)}")
    for kr in kelas_in_api[:5]:  # Show first 5
        logger.info(f"[DEBUG]   - {kr}")

    # Show the last added route
    last_route = api_router.routes[-1]
    logger.info(f"[DEBUG] Last added route type: {type(last_route)}")
    logger.info(f"[DEBUG] Last added route: {last_route}")
    if hasattr(last_route, 'path'):
        logger.info(f"[DEBUG] Last route path: {last_route.path}")
    if hasattr(last_route, 'prefix'):
        logger.info(f"[DEBUG] Last route prefix: {last_route.prefix}")
except Exception as e:
    logger.error(f"[DEBUG] Failed to include kelas_digital router: {e}", exc_info=True)

app.include_router(api_router)

# Debug: Check routes immediately after including api_router
logger.info("=" * 60)
logger.info("IMMEDIATE ROUTE CHECK (after app.include_router):")
kelas_check = []
for route in app.routes:
    if hasattr(route, 'path'):
        if '/kelas' in route.path:
            kelas_check.append(route.path)
            logger.info(f"  [KELAS] {route.path}")
logger.info(f"Kelas routes found: {len(kelas_check)}")
logger.info(f"Total app routes: {len(app.routes)}")
logger.info("=" * 60)

# ============================================================
# MIDDLEWARE
# ============================================================

# ============================================================
# EXCEPTION HANDLERS - Must be defined before middleware
# ============================================================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler that ensures CORS headers are always present"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)

    # Get CORS origins from environment
    origin = request.headers.get("origin", "")
    allowed_origins = os.environ.get('CORS_ORIGINS', '*').split(',')

    # Create error response
    response = JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"}
    )

    # Add CORS headers manually
    if origin in allowed_origins or '*' in allowed_origins:
        response.headers["Access-Control-Allow-Origin"] = origin or allowed_origins[0]
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Vary"] = "Origin"

    return response

# CORS Middleware - MUST be added FIRST before other middleware
# This ensures CORS headers are added before security headers
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security Headers Middleware - Production Hardening
@app.middleware("http")
async def add_security_headers(request, call_next):
    """Add security headers to all responses for production hardening"""
    try:
        response = await call_next(request)
    except Exception as exc:
        # If an error occurs, create error response with CORS headers
        logger.error(f"Request failed: {exc}", exc_info=True)

        # Get CORS origins from environment
        origin = request.headers.get("origin", "")
        allowed_origins = os.environ.get('CORS_ORIGINS', '*').split(',')

        # Create error response
        response = JSONResponse(
            status_code=500,
            content={"detail": "Internal Server Error"}
        )

        # Add CORS headers manually
        if origin and (origin in allowed_origins or '*' in allowed_origins):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "*"
            response.headers["Access-Control-Allow-Headers"] = "*"
            response.headers["Vary"] = "Origin"

        return response

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


# ============================================================
# LIFECYCLE
# ============================================================
@app.on_event("startup")
async def startup_event():
    """
    Startup event - seeds data only in development mode.
    For production, data should be seeded manually using seed_all_data.py
    Also starts background tasks (teaching reminder scheduler, cleanup)
    """
    import os
    import asyncio
    env = os.environ.get("ENVIRONMENT", "development").strip().lower()

    if env == "production":
        logger.info("Production mode - skipping automatic data seeding")
        logger.info("Use seed_all_data.py to manually seed data if needed")
    else:
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

    # Start background tasks (both dev and production)
    try:
        from teaching_reminder_scheduler import start_reminder_scheduler, start_cleanup_task

        # Start reminder scheduler (runs every minute)
        asyncio.create_task(start_reminder_scheduler())
        logger.info("✓ Teaching reminder scheduler started")

        # Start cleanup task (runs daily at 2 AM)
        asyncio.create_task(start_cleanup_task())
        logger.info("✓ Cleanup task started")

    except Exception as e:
        logger.error(f"Failed to start background tasks: {e}")

    # Log all registered routes for debugging
    logger.info("=" * 60)
    logger.info("REGISTERED ROUTES:")
    kelas_routes = []
    all_routes = []
    for route in app.routes:
        if hasattr(route, 'path') and hasattr(route, 'methods'):
            route_info = f"{list(route.methods)} {route.path}"
            all_routes.append(route_info)
            if '/kelas' in route.path:
                kelas_routes.append(route_info)
                logger.info(f"  [KELAS] {route_info}")
    logger.info(f"Total kelas routes: {len(kelas_routes)}")
    logger.info(f"Total all routes: {len(all_routes)}")

    # Check if wali-kelas route specifically exists
    wali_kelas_found = any('/kelas/wali-kelas' in r for r in all_routes)
    logger.info(f"/kelas/wali-kelas route found: {wali_kelas_found}")
    logger.info("=" * 60)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


