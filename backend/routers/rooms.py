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
    cls = None
    class_token_val = None
    if not class_name:
        cls = await db.classes.find_one({'room_id': rid}, {'_id': 0})
        class_name = cls.get('name') if cls else room.get('name', '')
    if cls:
        class_token_val = cls.get('token')
    elif class_name:
        # Try to find class by name if room_id didn't match
        cls = await db.classes.find_one({'name': class_name}, {'_id': 0})
        if cls:
            class_token_val = cls.get('token')

    png_bytes = create_b5_card(
        qr_data=token, room_name=room.get('name', rid), class_name=class_name,
        template_bytes=template_bytes,
        school_name=settings.get('school_name', 'MTsN 2 Kota Malang'),
        app_name=settings.get('app_name', 'Super Apps MATSANDATAMA'),
        class_token=class_token_val,
    )
    return StreamingResponse(io.BytesIO(png_bytes), media_type="image/png",
                             headers={"Content-Disposition": f'inline; filename="qr-card-{rid}.png"'})


@router.post("/qr-cards/bulk-by-grade")
async def generate_bulk_qr_cards_by_grade(grade: int = Form(...),
                                           template_id: Optional[str] = Form(None),
                                           user: Dict = Depends(require_role('admin'))):
    """Generate QR cards for all classes in a specific grade level"""
    from PIL import Image as PILImage

    # Get all classes for this grade
    classes_list = await db.classes.find({'grade': grade}, {'_id': 0}).to_list(100)
    if not classes_list:
        raise HTTPException(404, f"Tidak ada kelas untuk jenjang {grade}")

    settings = await get_settings()
    template_bytes = None
    if template_id:
        tpl = await db.qr_templates.find_one({'id': template_id}, {'_id': 0})
        if tpl and tpl.get('image_b64'):
            b64 = tpl['image_b64']
            if ',' in b64:
                b64 = b64.split(',', 1)[1]
            template_bytes = base64.b64decode(b64)

    # Generate cards for each class
    card_images = []
    for cls in sorted(classes_list, key=lambda x: x.get('name', '')):
        room_id = cls.get('room_id')
        if not room_id:
            continue

        room = await db.rooms.find_one({'id': room_id}, {'_id': 0})
        if not room:
            continue

        token = encrypt_qr_payload(room_id)
        png_bytes = create_b5_card(
            qr_data=token,
            room_name=room.get('name', room_id),
            class_name=cls.get('name', ''),
            template_bytes=template_bytes,
            school_name=settings.get('school_name', 'MTsN 2 Kota Malang'),
            app_name=settings.get('app_name', 'Super Apps MATSANDATAMA'),
            class_token=cls.get('token'),
        )
        card_images.append(PILImage.open(io.BytesIO(png_bytes)))

    if not card_images:
        raise HTTPException(404, f"Tidak ada kartu yang bisa dibuat untuk jenjang {grade}")

    # Create A4 layout (2 cards per page in portrait)
    # A4 @ 200 DPI = 1654 x 2339 px
    # B5 card = 1386 x 1969 px
    # We'll fit 2 B5 cards vertically on A4 with margins
    A4_W, A4_H = 1654, 2339
    CARD_W, CARD_H = 1386, 1969

    # Calculate scaling to fit 2 cards on A4
    scale = min((A4_W - 100) / CARD_W, (A4_H - 100) / (CARD_H * 2))
    scaled_w = int(CARD_W * scale)
    scaled_h = int(CARD_H * scale)

    pages = []
    for i in range(0, len(card_images), 2):
        page = PILImage.new('RGB', (A4_W, A4_H), color=(255, 255, 255))

        # First card (top)
        card1 = card_images[i].resize((scaled_w, scaled_h), PILImage.Resampling.LANCZOS)
        x1 = (A4_W - scaled_w) // 2
        y1 = 50
        page.paste(card1, (x1, y1))

        # Second card (bottom) if exists
        if i + 1 < len(card_images):
            card2 = card_images[i + 1].resize((scaled_w, scaled_h), PILImage.Resampling.LANCZOS)
            x2 = (A4_W - scaled_w) // 2
            y2 = y1 + scaled_h + 50
            page.paste(card2, (x2, y2))

        pages.append(page)

    # Save all pages as multi-page PDF or combine to single large image
    output = io.BytesIO()
    if len(pages) == 1:
        pages[0].save(output, format='PNG', optimize=True)
        media_type = 'image/png'
        filename = f'qr-cards-grade-{grade}.png'
    else:
        # Save as PDF for multiple pages
        pages[0].save(output, format='PDF', save_all=True, append_images=pages[1:], optimize=True)
        media_type = 'application/pdf'
        filename = f'qr-cards-grade-{grade}.pdf'

    output.seek(0)
    return StreamingResponse(output, media_type=media_type,
                             headers={"Content-Disposition": f'inline; filename="{filename}"'})


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
