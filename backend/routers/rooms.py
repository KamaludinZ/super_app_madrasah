"""Rooms CRUD + QR code + B5 card + QR templates + Excel import."""
import base64
import io
from typing import Dict, List, Optional

import pyotp
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse

from core import db, get_current_user, get_settings, log_audit, require_role, serialize_doc, logger, get_active_context
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

    # Debug logging for template
    logger.info(f"[QR-CARD] Generating card for room {rid}, template_id: {template_id}")

    if template_id:
        tpl = await db.qr_templates.find_one({'id': template_id}, {'_id': 0})
        logger.info(f"[QR-CARD] Template found: {tpl is not None}")
        if tpl and tpl.get('image_b64'):
            b64 = tpl['image_b64']
            if ',' in b64:
                b64 = b64.split(',', 1)[1]
            template_bytes = base64.b64decode(b64)
            logger.info(f"[QR-CARD] Template bytes loaded: {len(template_bytes)} bytes")

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

    logger.info(f"[QR-CARD] Creating card: class={class_name}, token={class_token_val}, has_template={template_bytes is not None}")

    png_bytes = create_b5_card(
        qr_data=token, room_name=room.get('name', rid), class_name=class_name,
        template_bytes=template_bytes,
        school_name=settings.get('school_name', 'MTsN 2 Kota Malang'),
        app_name=settings.get('app_name', 'Super Apps MATSANDATAMA'),
        class_token=class_token_val,
    )
    return StreamingResponse(io.BytesIO(png_bytes), media_type="image/png",
                             headers={"Content-Disposition": f'inline; filename="qr-card-{rid}.png"'})


def _resolve_paper_size(paper_size: str):
    p = (paper_size or "A4").upper()
    if p == "F4":
        return 1654, 2606, "F4"
    return 1654, 2339, "A4"


def _get_resample_method(PILImage):
    try:
        return PILImage.Resampling.LANCZOS
    except AttributeError:
        return PILImage.LANCZOS


async def _load_template_bytes(template_id: Optional[str]) -> Optional[bytes]:
    if not template_id:
        return None
    tpl = await db.qr_templates.find_one({'id': template_id}, {'_id': 0})
    logger.info(f"[QR-CARD] Template found: {tpl is not None}")
    if not tpl or not tpl.get('image_b64'):
        return None
    b64 = tpl['image_b64']
    if ',' in b64:
        b64 = b64.split(',', 1)[1]
    return base64.b64decode(b64)


async def _build_card_images_from_class_docs(classes_list: List[Dict], template_bytes: Optional[bytes]):
    from PIL import Image as PILImage

    settings = await get_settings()
    card_images = []

    # Deduplicate by room_id so each class/room appears once in bulk output
    # (prevents old-semester duplicate classes from being printed together)
    dedup_map = {}
    for cls in classes_list:
        room_id = cls.get('room_id')
        if not room_id:
            continue
        current = dedup_map.get(room_id)

        # Prefer newer record by updated_at/created_at if duplicate room_id exists
        if current is None:
            dedup_map[room_id] = cls
            continue

        current_ts = current.get('updated_at') or current.get('created_at') or ''
        candidate_ts = cls.get('updated_at') or cls.get('created_at') or ''
        if str(candidate_ts) > str(current_ts):
            dedup_map[room_id] = cls

    for cls in sorted(dedup_map.values(), key=lambda x: x.get('name', '')):
        room_id = cls.get('room_id')
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
    return card_images


def _compose_pages(card_images, paper_size: str = "A4"):
    from PIL import Image as PILImage

    page_w, page_h, paper = _resolve_paper_size(paper_size)
    # Source card canvas standardized to B3
    card_w, card_h = 2772, 3920
    margin_top = margin_bottom = margin_left = margin_right = 20
    gap_x = 20
    gap_y = 20

    # Target layout: 4 cards per A4/F4 page (2 columns x 2 rows)
    available_w = page_w - margin_left - margin_right - gap_x
    available_h = page_h - margin_top - margin_bottom - gap_y
    scale = min(available_w / (card_w * 2), available_h / (card_h * 2))
    scaled_w = int(card_w * scale)
    scaled_h = int(card_h * scale)

    logger.info(f"[BULK] Paper {paper}: {page_w}x{page_h}, scaled B3 card: {scaled_w}x{scaled_h}, layout: 2x2")

    resample_method = _get_resample_method(PILImage)
    pages = []

    cards_per_page = 4
    for i in range(0, len(card_images), cards_per_page):
        page = PILImage.new('RGB', (page_w, page_h), color=(255, 255, 255))
        batch = card_images[i:i + cards_per_page]

        # Compute centered grid origin
        total_grid_w = (scaled_w * 2) + gap_x
        total_grid_h = (scaled_h * 2) + gap_y
        grid_x0 = (page_w - total_grid_w) // 2
        grid_y0 = (page_h - total_grid_h) // 2

        for idx, img in enumerate(batch):
            row = idx // 2
            col = idx % 2
            x = grid_x0 + col * (scaled_w + gap_x)
            y = grid_y0 + row * (scaled_h + gap_y)
            card = img.resize((scaled_w, scaled_h), resample_method)
            page.paste(card, (x, y))

        pages.append(page)

    return pages


def _stream_pages(pages, filename_prefix: str, output_format: str = "pdf"):
    fmt = (output_format or "pdf").lower()
    output = io.BytesIO()

    if fmt == "png":
        pages[0].save(output, format='PNG', optimize=True)
        media_type = 'image/png'
        filename = f'{filename_prefix}.png'
    else:
        if len(pages) == 1:
            pages[0].save(output, format='PDF', optimize=True)
        else:
            pages[0].save(output, format='PDF', save_all=True, append_images=pages[1:], optimize=True)
        media_type = 'application/pdf'
        filename = f'{filename_prefix}.pdf'

    output.seek(0)
    return StreamingResponse(
        output,
        media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'}
    )


@router.post("/qr-cards/bulk-by-grade")
async def generate_bulk_qr_cards_by_grade(
    grade: int = Form(...),
    template_id: Optional[str] = Form(None),
    paper_size: str = Form("A4"),
    output_format: str = Form("pdf"),
    user: Dict = Depends(require_role('admin'))
):
    context = await get_active_context(user)
    semester_id = context.get('semester_id')
    academic_year_id = context.get('academic_year_id')

    query = {'grade': grade}
    if semester_id:
        query['semester_id'] = semester_id
    if academic_year_id:
        query['academic_year_id'] = academic_year_id

    classes_list = await db.classes.find(query, {'_id': 0}).to_list(100)
    if not classes_list:
        raise HTTPException(404, f"Tidak ada kelas untuk jenjang {grade}")

    template_bytes = await _load_template_bytes(template_id)
    card_images = await _build_card_images_from_class_docs(classes_list, template_bytes)
    if not card_images:
        raise HTTPException(404, f"Tidak ada kartu yang bisa dibuat untuk jenjang {grade}")

    pages = _compose_pages(card_images, paper_size=paper_size)
    return _stream_pages(pages, filename_prefix=f"qr-cards-grade-{grade}", output_format=output_format)


@router.post("/qr-cards/bulk-by-rooms")
async def generate_bulk_qr_cards_by_rooms(
    room_ids: str = Form(...),
    template_id: Optional[str] = Form(None),
    paper_size: str = Form("A4"),
    output_format: str = Form("pdf"),
    user: Dict = Depends(require_role('admin'))
):
    selected_ids = [s.strip() for s in room_ids.split(',') if s.strip()]
    if not selected_ids:
        raise HTTPException(400, "room_ids wajib diisi")

    context = await get_active_context(user)
    semester_id = context.get('semester_id')
    academic_year_id = context.get('academic_year_id')

    query = {'room_id': {'$in': selected_ids}}
    if semester_id:
        query['semester_id'] = semester_id
    if academic_year_id:
        query['academic_year_id'] = academic_year_id

    classes_list = await db.classes.find(query, {'_id': 0}).to_list(500)
    if not classes_list:
        raise HTTPException(404, "Tidak ada kelas untuk ruangan terpilih")

    template_bytes = await _load_template_bytes(template_id)
    card_images = await _build_card_images_from_class_docs(classes_list, template_bytes)
    if not card_images:
        raise HTTPException(404, "Tidak ada kartu yang bisa dibuat untuk ruangan terpilih")

    pages = _compose_pages(card_images, paper_size=paper_size)
    return _stream_pages(pages, filename_prefix="qr-cards-selected-rooms", output_format=output_format)


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
