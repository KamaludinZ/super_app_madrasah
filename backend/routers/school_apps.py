from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from bson import ObjectId
from datetime import datetime
from ..database import get_db
from ..auth_utils import get_current_user

router = APIRouter(prefix="/api", tags=["school_apps"])

class SchoolAppCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    url: str
    icon_url: Optional[str] = ""
    is_active: bool = True
    order: int = 0

class SchoolAppUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    url: Optional[str] = None
    icon_url: Optional[str] = None
    is_active: Optional[bool] = None
    order: Optional[int] = None

class SchoolAppResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""
    url: str
    icon_url: Optional[str] = ""
    is_active: bool = True
    order: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True

def serialize_app(app) -> dict:
    """Convert MongoDB document to dict"""
    return {
        "id": str(app["_id"]),
        "name": app.get("name", ""),
        "description": app.get("description", ""),
        "url": app.get("url", ""),
        "icon_url": app.get("icon_url", ""),
        "is_active": app.get("is_active", True),
        "order": app.get("order", 0),
        "created_at": app.get("created_at", ""),
        "updated_at": app.get("updated_at", ""),
    }

# Public endpoint - get active apps for students/users
@router.get("/school-apps", response_model=List[SchoolAppResponse])
async def get_active_school_apps(db=Depends(get_db)):
    """Get all active school applications"""
    apps = list(db.school_apps.find({"is_active": True}).sort("order", 1))
    return [serialize_app(app) for app in apps]

# Admin endpoints
@router.get("/admin/school-apps", response_model=List[SchoolAppResponse])
async def get_all_school_apps(
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Get all school applications (admin only)"""
    if "admin" not in current_user.get("roles", []) and "waka_humas" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Tidak memiliki akses")

    apps = list(db.school_apps.find().sort("order", 1))
    return [serialize_app(app) for app in apps]

@router.post("/admin/school-apps", response_model=SchoolAppResponse)
async def create_school_app(
    app_data: SchoolAppCreate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Create new school application (admin only)"""
    if "admin" not in current_user.get("roles", []) and "waka_humas" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Tidak memiliki akses")

    now = datetime.utcnow().isoformat()
    app_doc = {
        "name": app_data.name,
        "description": app_data.description or "",
        "url": app_data.url,
        "icon_url": app_data.icon_url or "",
        "is_active": app_data.is_active,
        "order": app_data.order,
        "created_at": now,
        "updated_at": now,
        "created_by": str(current_user["_id"]),
    }

    result = db.school_apps.insert_one(app_doc)
    app_doc["_id"] = result.inserted_id

    return serialize_app(app_doc)

@router.put("/admin/school-apps/{app_id}", response_model=SchoolAppResponse)
async def update_school_app(
    app_id: str,
    app_data: SchoolAppUpdate,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Update school application (admin only)"""
    if "admin" not in current_user.get("roles", []) and "waka_humas" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Tidak memiliki akses")

    try:
        app = db.school_apps.find_one({"_id": ObjectId(app_id)})
        if not app:
            raise HTTPException(status_code=404, detail="Aplikasi tidak ditemukan")

        update_data = {k: v for k, v in app_data.dict(exclude_unset=True).items() if v is not None}
        if update_data:
            update_data["updated_at"] = datetime.utcnow().isoformat()
            db.school_apps.update_one({"_id": ObjectId(app_id)}, {"$set": update_data})

        updated_app = db.school_apps.find_one({"_id": ObjectId(app_id)})
        return serialize_app(updated_app)

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/admin/school-apps/{app_id}")
async def delete_school_app(
    app_id: str,
    current_user: dict = Depends(get_current_user),
    db=Depends(get_db)
):
    """Delete school application (admin only)"""
    if "admin" not in current_user.get("roles", []) and "waka_humas" not in current_user.get("roles", []):
        raise HTTPException(status_code=403, detail="Tidak memiliki akses")

    try:
        result = db.school_apps.delete_one({"_id": ObjectId(app_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Aplikasi tidak ditemukan")

        return {"message": "Aplikasi berhasil dihapus"}

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=400, detail=str(e))
