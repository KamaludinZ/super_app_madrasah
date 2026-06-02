"""Application Info and Update endpoints."""
import asyncio
import os
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

import httpx
from fastapi import APIRouter, Depends

from core import get_current_user, require_role

router = APIRouter()

# Version information
CURRENT_VERSION = "1.0.0"
APP_NAME = "Super Apps MATSANDATAMA"
APP_DESCRIPTION = "Sistem Jurnal Presisi Multi-Role MTsN 2 Kota Malang"
RELEASE_DATE = "2025-01-15"

# GitHub repository for version checking
# Set via environment variable: GITHUB_REPO=owner/repo-name
# Default: KamaludinZ/super_app_madrasah
GITHUB_REPO = os.environ.get("GITHUB_REPO", "KamaludinZ/super_app_madrasah")
UPDATE_CHECK_URL = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest" if GITHUB_REPO else ""

# GitHub Personal Access Token (optional, for private repos or higher rate limits)
# Set via environment variable: GITHUB_TOKEN=your_token_here
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")

# Auto-update controls (must be explicitly enabled in production)
AUTO_UPDATE_ENABLED = os.environ.get("AUTO_UPDATE_ENABLED", "false").lower() == "true"
AUTO_UPDATE_BRANCH = os.environ.get("AUTO_UPDATE_BRANCH", "main")
AUTO_UPDATE_STATUS = {
    "state": "idle",  # idle | running | success | failed
    "message": "Belum ada proses update",
    "started_at": None,
    "finished_at": None,
    "target_version": None,
    "current_version": CURRENT_VERSION,
    "log": [],
}
AUTO_UPDATE_LOCK = asyncio.Lock()


@router.get("/app-info")
async def get_app_info(user: Dict = Depends(get_current_user)):
    """Get application information."""
    return {
        "app_name": APP_NAME,
        "description": APP_DESCRIPTION,
        "current_version": CURRENT_VERSION,
        "release_date": RELEASE_DATE,
        "environment": os.environ.get("ENV", "development"),
        "python_version": os.environ.get("PYTHON_VERSION", "3.11+"),
        "database": "MongoDB",
        "features": [
            "Jurnal Harian Guru",
            "Manajemen Jadwal",
            "Monitoring Kehadiran",
            "Monitoring Kebersihan",
            "Manajemen Prestasi",
            "Manajemen Nilai & Rapor",
            "Manajemen GTK",
            "Ekstrakurikuler",
            "Notifikasi Real-time",
            "Backup & Restore",
            "Audit Log",
            "Multi-role Access Control"
        ]
    }


@router.get("/app-info/check-update")
async def check_for_updates(user: Dict = Depends(require_role("admin"))):
    """Check for available updates (admin only)."""

    # Check if GitHub repository is configured
    if not GITHUB_REPO or not UPDATE_CHECK_URL:
        return {
            "has_update": False,
            "current_version": CURRENT_VERSION,
            "latest_version": None,
            "message": "GitHub repository belum dikonfigurasi. Untuk mengaktifkan fitur auto-update, "
                      "silakan set environment variable GITHUB_REPO (contoh: GITHUB_REPO=owner/repo-name)",
            "github_configured": False,
            "checked_at": datetime.utcnow().isoformat()
        }

    try:
        # Prepare headers with optional GitHub token
        headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "Super-Apps-MATSANDATAMA"
        }
        if GITHUB_TOKEN:
            headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(UPDATE_CHECK_URL, headers=headers)

            if response.status_code == 200:
                data = response.json()
                latest_version = data.get("tag_name", "").lstrip("v")
                release_date = data.get("published_at", "")
                release_notes = data.get("body", "")
                download_url = data.get("html_url", "")

                # Compare versions
                has_update = compare_versions(latest_version, CURRENT_VERSION)

                return {
                    "has_update": has_update,
                    "current_version": CURRENT_VERSION,
                    "latest_version": latest_version,
                    "release_date": release_date,
                    "release_notes": release_notes,
                    "download_url": download_url,
                    "github_configured": True,
                    "checked_at": datetime.utcnow().isoformat()
                }
            elif response.status_code == 404:
                return {
                    "has_update": False,
                    "current_version": CURRENT_VERSION,
                    "latest_version": None,
                    "message": f"Repository '{GITHUB_REPO}' tidak ditemukan atau tidak memiliki releases. "
                              "Pastikan repository public atau gunakan GITHUB_TOKEN untuk private repo.",
                    "github_configured": True,
                    "error": "Repository not found or no releases available",
                    "checked_at": datetime.utcnow().isoformat()
                }
            elif response.status_code == 403:
                return {
                    "has_update": False,
                    "current_version": CURRENT_VERSION,
                    "latest_version": None,
                    "message": "Rate limit GitHub API tercapai. Gunakan GITHUB_TOKEN untuk meningkatkan limit.",
                    "github_configured": True,
                    "error": "GitHub API rate limit exceeded",
                    "checked_at": datetime.utcnow().isoformat()
                }
            else:
                return {
                    "has_update": False,
                    "current_version": CURRENT_VERSION,
                    "latest_version": None,
                    "message": f"Gagal mengecek update (Status: {response.status_code})",
                    "github_configured": True,
                    "error": f"HTTP {response.status_code}",
                    "checked_at": datetime.utcnow().isoformat()
                }

    except httpx.TimeoutException:
        return {
            "has_update": False,
            "current_version": CURRENT_VERSION,
            "latest_version": None,
            "message": "Timeout saat mengecek update. Periksa koneksi internet Anda.",
            "github_configured": True,
            "error": "Connection timeout",
            "checked_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "has_update": False,
            "current_version": CURRENT_VERSION,
            "latest_version": None,
            "message": f"Gagal mengecek update: {str(e)}",
            "github_configured": True,
            "error": str(e),
            "checked_at": datetime.utcnow().isoformat()
        }


def compare_versions(version1: str, version2: str) -> bool:
    """
    Compare two version strings.
    Returns True if version1 > version2
    """
    try:
        # Remove 'v' prefix if present
        v1 = version1.lstrip("v").split(".")
        v2 = version2.lstrip("v").split(".")

        # Pad with zeros if lengths differ
        max_len = max(len(v1), len(v2))
        v1 += ["0"] * (max_len - len(v1))
        v2 += ["0"] * (max_len - len(v2))

        # Compare each segment
        for i in range(max_len):
            try:
                num1 = int(v1[i])
                num2 = int(v2[i])
                if num1 > num2:
                    return True
                elif num1 < num2:
                    return False
            except ValueError:
                # Handle non-numeric version segments
                if v1[i] > v2[i]:
                    return True
                elif v1[i] < v2[i]:
                    return False

        return False  # Versions are equal
    except Exception:
        return False


@router.get("/app-info/update-status")
async def get_update_status(user: Dict = Depends(require_role("admin"))):
    """Get current auto-update status (admin only)."""
    return {
        "enabled": AUTO_UPDATE_ENABLED,
        **AUTO_UPDATE_STATUS,
        "checked_at": datetime.utcnow().isoformat()
    }


async def _run_auto_update(target_version: str):
    """Run safe auto-update routine in background."""
    repo_root = Path(__file__).resolve().parents[2]  # project root
    backend_dir = repo_root / "backend"
    frontend_dir = repo_root / "frontend"

    AUTO_UPDATE_STATUS.update({
        "state": "running",
        "message": "Memulai proses update...",
        "started_at": datetime.utcnow().isoformat(),
        "finished_at": None,
        "target_version": target_version,
        "current_version": CURRENT_VERSION,
        "log": [],
    })

    commands = [
        {"cmd": ["git", "fetch", "--all"], "cwd": str(repo_root), "label": "git fetch"},
        {"cmd": ["git", "checkout", AUTO_UPDATE_BRANCH], "cwd": str(repo_root), "label": "git checkout"},
        {"cmd": ["git", "pull", "origin", AUTO_UPDATE_BRANCH], "cwd": str(repo_root), "label": "git pull"},
        {"cmd": ["python", "-m", "pip", "install", "-r", "requirements.txt"], "cwd": str(backend_dir), "label": "install backend deps"},
        {"cmd": ["npm", "install"], "cwd": str(frontend_dir), "label": "install frontend deps"},
        {"cmd": ["npm", "run", "build"], "cwd": str(frontend_dir), "label": "build frontend"},
    ]

    try:
        for item in commands:
            process = subprocess.run(
                item["cmd"],
                cwd=item["cwd"],
                capture_output=True,
                text=True,
                shell=False,
                check=False,
            )
            AUTO_UPDATE_STATUS["log"].append({
                "step": item["label"],
                "returncode": process.returncode,
                "stdout": (process.stdout or "")[-2000:],
                "stderr": (process.stderr or "")[-2000:],
            })
            if process.returncode != 0:
                AUTO_UPDATE_STATUS.update({
                    "state": "failed",
                    "message": f"Gagal pada langkah: {item['label']}",
                    "finished_at": datetime.utcnow().isoformat(),
                })
                return

        AUTO_UPDATE_STATUS.update({
            "state": "success",
            "message": (
                "Update kode & dependency selesai. "
                "Silakan restart service backend/frontend (atau redeploy container) "
                "agar versi baru aktif."
            ),
            "finished_at": datetime.utcnow().isoformat(),
            "current_version": target_version or CURRENT_VERSION,
        })
    except Exception as e:
        AUTO_UPDATE_STATUS.update({
            "state": "failed",
            "message": f"Update gagal: {str(e)}",
            "finished_at": datetime.utcnow().isoformat(),
        })


@router.post("/app-info/apply-update")
async def apply_update(user: Dict = Depends(require_role("admin"))):
    """Apply update from GitHub release (admin only, guarded)."""
    if not AUTO_UPDATE_ENABLED:
        return {
            "ok": False,
            "message": "AUTO_UPDATE_ENABLED=false. Aktifkan env AUTO_UPDATE_ENABLED=true untuk menjalankan update otomatis.",
            "enabled": False,
            "status": AUTO_UPDATE_STATUS
        }

    if AUTO_UPDATE_STATUS.get("state") == "running":
        return {
            "ok": False,
            "message": "Proses update sedang berjalan",
            "enabled": True,
            "status": AUTO_UPDATE_STATUS
        }

    # Check latest release first
    update_check = await check_for_updates(user)
    if update_check.get("error"):
        return {
            "ok": False,
            "message": f"Tidak bisa memulai update: {update_check.get('message')}",
            "enabled": True,
            "status": AUTO_UPDATE_STATUS
        }

    if not update_check.get("has_update"):
        return {
            "ok": False,
            "message": "Tidak ada update baru untuk diterapkan.",
            "enabled": True,
            "status": AUTO_UPDATE_STATUS
        }

    target_version = update_check.get("latest_version")
    async with AUTO_UPDATE_LOCK:
        if AUTO_UPDATE_STATUS.get("state") == "running":
            return {
                "ok": False,
                "message": "Proses update sedang berjalan",
                "enabled": True,
                "status": AUTO_UPDATE_STATUS
            }
        asyncio.create_task(_run_auto_update(target_version=target_version))

    return {
        "ok": True,
        "message": f"Proses update ke v{target_version} dimulai",
        "enabled": True,
        "target_version": target_version,
        "status": AUTO_UPDATE_STATUS
    }


@router.get("/app-info/system-health")
async def get_system_health(user: Dict = Depends(require_role("admin"))):
    """Get system health information (admin only)."""
    from core import client, db

    try:
        # Check database connection
        await db.command("ping")
        db_status = "healthy"
        db_message = "Database connection is healthy"
    except Exception as e:
        db_status = "unhealthy"
        db_message = f"Database error: {str(e)}"

    try:
        # Get database stats
        stats = await db.command("dbStats")
        db_size = stats.get("dataSize", 0)
        db_collections = stats.get("collections", 0)
    except Exception:
        db_size = None
        db_collections = None

    return {
        "status": db_status,
        "database": {
            "status": db_status,
            "message": db_message,
            "size_bytes": db_size,
            "collections": db_collections
        },
        "server": {
            "uptime": "running",
            "environment": os.environ.get("ENV", "development")
        },
        "checked_at": datetime.utcnow().isoformat()
    }
