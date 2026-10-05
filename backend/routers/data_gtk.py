"""Data GTK untuk kelengkapan data: unduh Excel (ekspor -> lengkapi -> impor), khusus Admin."""
import io
from typing import Dict, Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from fastapi import HTTPException

from core import db, get_current_user, log_audit, require_role
from data_master_excel import KOLOM_DATA_GTK, buat_berkas, nilai_kolom_gtk, tambah_keterangan_kosong, workbook_bytes
from data_master_service import JENIS_GTK, gtk_per_jenis, jenis_gtk, jumlah_gtk_per_jenis, normalisasi_jenis_gtk
from data_master_template import template_bytes
from journal_core import now_wib
from routers._shared import ADMIN_DATA_MASTER, BAGIAN_KELENGKAPAN_GTK, compute_completeness_gtk

router = APIRouter()


LABEL_BERKAS = {None: 'Semua', 'guru': 'Guru', 'tendik': 'Tendik'}


@router.get("/gtk/import-template")
async def gtk_import_template(request: Request, user: Dict = Depends(ADMIN_DATA_MASTER)):
    """Template impor kelengkapan Data GTK: kolom identik dengan Unduh Excel (6 sub-tab Data Guru),
    tanpa data, plus sheet Petunjuk & dropdown kode pilihan."""
    content = template_bytes('gtk')
    await log_audit(user, 'export', 'gtk_import_template', None, request=request)
    return StreamingResponse(
        io.BytesIO(content),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': 'attachment; filename="Template_Data_GTK.xlsx"'},
    )


@router.get("/gtk/export-excel/ringkasan")
async def export_gtk_ringkasan(user: Dict = Depends(ADMIN_DATA_MASTER)):
    """Jumlah GTK per jenis ({all, guru, tendik}) untuk pratinjau dialog unduhan."""
    return await jumlah_gtk_per_jenis(db)


@router.get("/gtk/export-excel")
async def export_gtk_excel(
    request: Request,
    jenis: Optional[str] = None,
    user: Dict = Depends(ADMIN_DATA_MASTER),
):
    """Unduh Excel data GTK (data diri, kepegawaian, informasi lain, tempat tinggal,
    status perkawinan, penugasan) dengan susunan kolom baku KOLOM_DATA_GTK.
    jenis: guru, tendik, atau kosong = keseluruhan."""
    jenis = normalisasi_jenis_gtk(jenis)
    data = await gtk_per_jenis(db, jenis)
    rows = [[nilai_kolom_gtk(k, d['user'], d['jenis']) for k in KOLOM_DATA_GTK] for d in data]
    wb = buat_berkas('gtk', rows)
    if not rows:
        label = JENIS_GTK.get(jenis, 'GTK') if jenis else 'GTK'
        tambah_keterangan_kosong(wb, [
            f'Belum ada data {label.lower()} (pengguna dengan peran {label.lower()} yang bukan mutasi keluar).',
            'Tambahkan akun GTK di menu Pengguna, lalu unduh kembali.',
            'Sheet Data GTK tetap berisi baris judul kolom sehingga bisa dipakai sebagai acuan pengisian.',
        ])
    content = workbook_bytes(wb)
    await log_audit(user, 'export', 'gtk_excel', None,
                    details={'jenis': jenis or 'semua', 'jumlah': len(rows)}, request=request)
    filename = f"Data_GTK_{LABEL_BERKAS[jenis]}_{now_wib().strftime('%Y-%m-%d')}.xlsx"
    return StreamingResponse(
        io.BytesIO(content),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        # Berisi data pribadi (NIK, rekening, NPWP): jangan disimpan cache peramban/proxy.
        headers={'Content-Disposition': f'attachment; filename="{filename}"', 'X-Jumlah-Data': str(len(rows)),
                 'Cache-Control': 'no-store'},
    )


# ------------------------------------------------------------
# % KELENGKAPAN DATA GTK
# ------------------------------------------------------------
# Hanya persentase & nama field yang kurang (bukan isi data pribadi), sehingga boleh dilihat
# peran yang sudah bisa membuka menu Data GTK (admin & kepala madrasah).
LIHAT_KELENGKAPAN = require_role('admin', 'kepala_sekolah')


@router.get("/gtk/kelengkapan")
async def kelengkapan_gtk(jenis: Optional[str] = None, user: Dict = Depends(LIHAT_KELENGKAPAN)):
    """% kelengkapan data wajib tiap GTK (guru/tendik, bukan mutasi keluar) beserta rincian per bagian
    (Data Guru, Status & Riwayat, Pendidikan, Data Anak, Riwayat Pesantren, Arsip Berkas), plus
    ringkasan rata-rata dan jumlah GTK yang bagiannya masih kosong."""
    jenis = normalisasi_jenis_gtk(jenis)
    data = await gtk_per_jenis(db, jenis)
    items = []
    for d in data:
        u = d['user']
        items.append({'id': u['id'], 'full_name': u.get('full_name'), 'jenis': d['jenis'], 'kelengkapan': compute_completeness_gtk(u)})
    n = len(items)
    per_bagian = []
    for i, b in enumerate(BAGIAN_KELENGKAPAN_GTK):
        nilai = [it['kelengkapan']['bagian'][i] for it in items]
        per_bagian.append({
            'key': b['key'], 'label': b['label'],
            'rata_rata': round(sum(x['persen'] for x in nilai) / n) if n else 0,
            'gtk_kosong': sum(1 for x in nilai if x['terisi'] == 0),
            'gtk_lengkap': sum(1 for x in nilai if x['terisi'] == x['total']),
        })
    ringkasan = {
        'jumlah_gtk': n,
        'rata_rata': round(sum(it['kelengkapan']['persen'] for it in items) / n) if n else 0,
        'lengkap': sum(1 for it in items if it['kelengkapan']['persen'] == 100),
        'per_bagian': per_bagian,
    }
    return {'ringkasan': ringkasan, 'items': items}


@router.get("/gtk/{gtk_id}/kelengkapan")
async def rincian_kelengkapan_gtk(gtk_id: str, user: Dict = Depends(get_current_user)):
    """Rincian kelengkapan satu GTK per bagian (persen, terisi/total, daftar data yang belum diisi,
    status lengkap/sebagian/kosong). Boleh diakses admin, kepala madrasah, dan GTK itu sendiri."""
    roles = user.get('roles') or []
    boleh = 'admin' in roles or user.get('active_role') == 'kepala_sekolah' or user.get('id') == gtk_id
    if not boleh:
        raise HTTPException(403, 'Tidak diizinkan melihat kelengkapan data GTK ini')
    target = await db.users.find_one({'id': gtk_id}, {'_id': 0, 'password_hash': 0})
    if not target or not jenis_gtk(target):
        raise HTTPException(404, 'GTK tidak ditemukan')
    k = compute_completeness_gtk(target)
    for b in k['bagian']:
        b['status'] = 'lengkap' if b['terisi'] >= b['total'] else ('kosong' if b['terisi'] == 0 else 'sebagian')
    k['bagian_kosong'] = [b['label'] for b in k['bagian'] if b['status'] == 'kosong']
    return {'id': target['id'], 'full_name': target.get('full_name'), 'jenis': jenis_gtk(target), 'kelengkapan': k}

