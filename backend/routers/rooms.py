"""Rooms CRUD + QR code + B5 card + QR templates + Excel import."""
import base64
import io
from typing import Dict, Optional

import pyotp
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse

from core import db, get_current_user, get_settings, log_audit, require_role, serialize_doc
from excel_io import parse_room_rows, room_template
from journal_core import (
    create_b5_card,
    encrypt_qr_payload,
    generate_dynamic_qr_payload,
    generate_qr_image_b64,
)
from models import QRTemplateModel, RoomModel

router = APIRouter()


# ============================================================
# ROOMS
# ============================================================
@router.get("/rooms")
async def list_rooms(user: Dict = Depends(get_current_user)):
    items = await db.rooms.find({}, {'_id': 0}).sort('name', 1).to_list(500)
    return [serialize_doc(i) for i in items]


@router.post("/rooms")
async def create_room(payload: Dict, request: Request, user: Dict = Depends(require_role('admin'))):
    if payload.get('qr_mode') == 'dynamic' and not payload.get('qr_secret'):
        payload['qr_secret'] = pyotp.random_base32()
    room = RoomModel(**payload)
    doc = room.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.rooms.insert_one(doc)
    await log_audit(user, 'create', 'room', room.id, details={'name': room.name}, request=request)
    return serialize_doc(doc)


@router.put("/rooms/{rid}")
async def update_room(rid: str, payload: Dict, request: Request, user: Dict = Depends(require_role('admin'))):
    if payload.get('qr_mode') == 'dynamic' and not payload.get('qr_secret'):
        existing = await db.rooms.find_one({'id': rid})
        if existing and not existing.get('qr_secret'):
            payload['qr_secret'] = pyotp.random_base32()
    res = await db.rooms.update_one({'id': rid}, {'$set': payload})
    if res.matched_count == 0:
        raise HTTPException(404, "Ruangan tidak ditemukan")
    await log_audit(user, 'update', 'room', rid, details=payload, request=request)
    doc = await db.rooms.find_one({'id': rid}, {'_id': 0})
    return serialize_doc(doc)


@router.delete("/rooms/{rid}")
async def delete_room(rid: str, request: Request, user: Dict = Depends(require_role('admin'))):
    await db.rooms.delete_one({'id': rid})
    await log_audit(user, 'delete', 'room', rid, request=request)
    return {'message': 'Dihapus'}


@router.get("/rooms/excel-template")
async def rooms_template_dl(user: Dict = Depends(require_role('admin'))):
    return StreamingResponse(
        io.BytesIO(room_template()),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': 'attachment; filename="template_ruangan_matsandatama.xlsx"'},
    )


@router.post("/rooms/import-excel")
async def rooms_import(file: UploadFile = File(...), request: Request = None,
                       user: Dict = Depends(require_role('admin'))):
    if not file.filename.lower().endswith(('.xlsx', '.xlsm')):
        raise HTTPException(400, "Hanya .xlsx")
    contents = await file.read()
    rows = parse_room_rows(contents)
    success = 0
    errors = []
    new_docs = []
    for r in rows:
        try:
            if not r['name']:
                errors.append(f"Baris {r['_row']}: kode ruang wajib"); continue
            existing = await db.rooms.find_one({'name': r['name']})
            if existing:
                errors.append(f"Baris {r['_row']}: kode '{r['name']}' sudah ada"); continue
            if r.get('qr_mode') == 'dynamic':
                r['qr_secret'] = pyotp.random_base32()
            rm = RoomModel(**{k: v for k, v in r.items() if not k.startswith('_')})
            doc = rm.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            new_docs.append(doc)
            success += 1
        except Exception as e:
            errors.append(f"Baris {r['_row']}: {e}")
    if new_docs:
        await db.rooms.insert_many(new_docs)
    await log_audit(user, 'import_excel', 'room', None, details={'success': success, 'errors': len(errors)}, request=request)
    return {'success': success, 'errors': errors, 'total_rows': len(rows)}


# ============================================================
# QR CODE per Room
# ============================================================
@router.get("/rooms/{rid}/qr")
async def get_room_qr(rid: str, mode: str = 'static', user: Dict = Depends(get_current_user)):
    room = await db.rooms.find_one({'id': rid}, {'_id': 0})
    if not room:
        raise HTTPException(404, "Ruangan tidak ditemukan")
    if mode == 'dynamic':
        if not room.get('qr_secret'):
            new_secret = pyotp.random_base32()
            await db.rooms.update_one({'id': rid}, {'$set': {'qr_secret': new_secret}})
            room['qr_secret'] = new_secret
        token = generate_dynamic_qr_payload(rid, room['qr_secret'])
    else:
        token = encrypt_qr_payload(rid)
    qr_b64 = generate_qr_image_b64(token, size=10)
    return {
        'token': token, 'qr_image_b64': qr_b64, 'mode': mode,
        'room_id': rid, 'room_name': room.get('name'),
        'refresh_seconds': 30 if mode == 'dynamic' else 0,
    }


@router.post("/rooms/{rid}/qr-card")
async def generate_qr_card(rid: str, template_id: Optional[str] = Form(None),
                           class_name: Optional[str] = Form(None),
                           user: Dict = Depends(require_role('admin'))):
    room = await db.rooms.find_one({'id': rid}, {'_id': 0})
    if not room:
        raise HTTPException(404, "Ruangan tidak ditemukan")
    settings = await get_settings()
    token = encrypt_qr_payload(rid)
    template_bytes = None
    if template_id:
        tpl = await db.qr_templates.find_one({'id': template_id}, {'_id': 0})
        if tpl and tpl.get('image_b64'):
            b64 = tpl['image_b64']
            if ',' in b64:
                b64 = b64.split(',', 1)[1]
            template_bytes = base64.b64decode(b64)
    if not class_name:
        cls = await db.classes.find_one({'room_id': rid}, {'_id': 0})
        class_name = cls.get('name') if cls else room.get('name', '')
    png_bytes = create_b5_card(
        qr_data=token, room_name=room.get('name', rid), class_name=class_name,
        template_bytes=template_bytes,
        school_name=settings.get('school_name', 'MTsN 2 Kota Malang'),
        app_name=settings.get('app_name', 'Super Apps MATSANDATAMA'),
    )
    return StreamingResponse(io.BytesIO(png_bytes), media_type="image/png",
                             headers={"Content-Disposition": f'inline; filename="qr-card-{rid}.png"'})


# ============================================================
# QR TEMPLATES
# ============================================================
@router.get("/qr-templates")
async def list_qr_templates(user: Dict = Depends(require_role('admin'))):
    items = await db.qr_templates.find({}, {'_id': 0}).to_list(100)
    return [serialize_doc(i) for i in items]


@router.post("/qr-templates")
async def upload_qr_template(file: UploadFile = File(...), name: str = Form(...),
                             request: Request = None, user: Dict = Depends(require_role('admin'))):
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File terlalu besar (max 10MB)")
    b64 = base64.b64encode(contents).decode('utf-8')
    mime = file.content_type or 'image/png'
    tpl = QRTemplateModel(name=name, image_b64=f"data:{mime};base64,{b64}")
    doc = tpl.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.qr_templates.insert_one(doc)
    await log_audit(user, 'upload', 'qr_template', tpl.id, details={'name': name}, request=request)
    return serialize_doc(doc)


@router.delete("/qr-templates/{tid}")
async def delete_qr_template(tid: str, request: Request, user: Dict = Depends(require_role('admin'))):
    await db.qr_templates.delete_one({'id': tid})
    await log_audit(user, 'delete', 'qr_template', tid, request=request)
    return {'message': 'Dihapus'}
