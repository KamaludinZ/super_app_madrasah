"""Master wilayah Indonesia: daftar bertingkat provinsi -> kabupaten/kota -> kecamatan -> desa/kelurahan.

Kontrak dipakai `frontend/src/lib/wilayah.js`. 404 berarti master tingkat itu belum dimuat sama sekali,
sehingga form alamat beralih ke data contoh.
"""
import re
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile
from pydantic import BaseModel, Field

from core import db, get_current_user, log_audit, require_role
from routers._shared import ADMIN_DATA_MASTER
from wilayah_impor import impor_paket_wilayah
from wilayah_master import KOLEKSI_WILAYAH, TINGKAT_WILAYAH, kunci_nama, tingkat_dari_kode

router = APIRouter()

_PROYEKSI = {'_id': 0, 'kode': 1, 'nama': 1, 'kode_pos': 1}


def _item(doc: Dict) -> Dict:
    out = {'kode': doc['kode'], 'nama': doc['nama']}
    if doc.get('kode_pos'):
        out['kode_pos'] = doc['kode_pos']
    return out


@router.get("/wilayah")
async def daftar_wilayah(
    response: Response,
    tingkat: str = Query('provinsi'),
    induk: Optional[str] = Query(None),
    user: Dict = Depends(get_current_user),
):
    """Wilayah satu tingkat; selain provinsi wajib menyebut `induk` (kode tingkat tepat di atasnya)."""
    if tingkat not in TINGKAT_WILAYAH:
        raise HTTPException(status_code=400, detail=f"Tingkat harus salah satu dari: {', '.join(TINGKAT_WILAYAH)}")
    posisi = TINGKAT_WILAYAH.index(tingkat)
    if posisi == 0:
        induk = None
    else:
        induk = (induk or '').strip()
        if tingkat_dari_kode(induk) != TINGKAT_WILAYAH[posisi - 1]:
            raise HTTPException(status_code=400, detail=f"Parameter induk harus kode {TINGKAT_WILAYAH[posisi - 1]} yang valid")

    items = await db[KOLEKSI_WILAYAH].find({'tingkat': tingkat, 'induk': induk}, _PROYEKSI).sort('nama', 1).to_list(5000)
    if not items and not await db[KOLEKSI_WILAYAH].find_one({'tingkat': tingkat}, {'_id': 1}):
        raise HTTPException(status_code=404, detail=f"Master wilayah tingkat {tingkat} belum dimuat")
    response.headers['Cache-Control'] = 'private, max-age=600'  # master wilayah jarang berubah
    return {'tingkat': tingkat, 'induk': induk, 'items': [_item(d) for d in items]}


def _kode_leluhur(kode: str) -> List[str]:
    p = kode.split('.')
    return ['.'.join(p[:i]) for i in range(1, len(p) + 1)]


async def rantai_wilayah(kode_list: List[str]) -> Dict[str, Dict]:
    """Rantai provinsi..desa untuk banyak kode sekaligus (satu query) -> {kode: {provinsi, kabupaten, kecamatan, desa}}."""
    semua = {k for kode in kode_list for k in _kode_leluhur(kode)}
    docs = {d['kode']: d async for d in db[KOLEKSI_WILAYAH].find({'kode': {'$in': list(semua)}}, _PROYEKSI)}
    hasil = {}
    for kode in kode_list:
        r = {t: None for t in TINGKAT_WILAYAH}
        for t, k in zip(TINGKAT_WILAYAH, _kode_leluhur(kode)):
            r[t] = _item(docs[k]) if k in docs else None
        hasil[kode] = r
    return hasil


@router.get("/wilayah/rantai")
async def rantai_dari_kode(kode: str = Query(...), user: Dict = Depends(get_current_user)):
    """Rantai provinsi..tingkat terdalam untuk satu kode tersimpan (memuat ulang pilihan dropdown)."""
    kode = (kode or '').strip()
    if not tingkat_dari_kode(kode):
        raise HTTPException(status_code=400, detail="Kode wilayah tidak valid")
    rantai = (await rantai_wilayah([kode]))[kode]
    if not rantai[tingkat_dari_kode(kode)]:
        raise HTTPException(status_code=404, detail="Kode wilayah tidak ditemukan di master")
    return {'kode': kode, 'tingkat': tingkat_dari_kode(kode), 'rantai': rantai}


STATUS_LAPORAN = ('perlu', 'tidak_cocok', 'sebagian', 'cocok', 'tanpa_alamat', 'semua')


@router.get("/wilayah/pencocokan")
async def laporan_pencocokan_wilayah(
    jenis: str = Query('semua'),
    status: str = Query('perlu'),
    q: str = Query('', max_length=100),
    user: Dict = Depends(ADMIN_DATA_MASTER),
):
    """Laporan pencocokan alamat siswa (ayah/ibu/wali/domisili) & GTK dengan master wilayah: ringkasan per status
    dan daftar baris (default: yang perlu diperbaiki = tidak cocok + cocok sebagian) beserta saran wilayah."""
    if jenis not in ('semua', 'siswa', 'gtk'):
        raise HTTPException(status_code=400, detail="jenis harus semua, siswa, atau gtk")
    if status not in STATUS_LAPORAN:
        raise HTTPException(status_code=400, detail=f"status harus salah satu dari: {', '.join(STATUS_LAPORAN)}")
    from wilayah_cocok import laporan_pencocokan
    hasil = await laporan_pencocokan(db, jenis, status, q)
    if hasil['master_kosong']:
        raise HTTPException(status_code=409, detail="Master wilayah belum dimuat — muat data wilayah di menu Master Wilayah terlebih dahulu")
    return hasil


class ItemPerbaikanWilayah(BaseModel):
    id: str
    jenis: str
    blok: str
    kode_wilayah: str
    kode_pos: Optional[str] = None


class PerbaikanWilayahRequest(BaseModel):
    items: List[ItemPerbaikanWilayah] = Field(..., min_length=1, max_length=500)


@router.post("/wilayah/pencocokan/terapkan")
async def terapkan_perbaikan_wilayah(req: PerbaikanWilayahRequest, request: Request, user: Dict = Depends(ADMIN_DATA_MASTER)):
    """Simpan perbaikan wilayah per baris laporan (manual atau saran): kode wilayah + nama resmi + kode pos.
    Tiap item berhasil/gagal sendiri; mengembalikan baris laporan terbaru untuk memperbarui status di tabel."""
    from wilayah_cocok import terapkan_perbaikan
    hasil = await terapkan_perbaikan(db, [i.model_dump() for i in req.items], oleh=user.get('id'))
    await log_audit(user, 'update', 'wilayah_pencocokan', None,
                    details={'berhasil': hasil['berhasil'], 'gagal': hasil['gagal'],
                             'items': [{k: i.get(k) for k in ('id', 'blok')} for i in hasil['hasil']][:50]}, request=request)
    return hasil


@router.get("/wilayah/cari")
async def cari_desa(q: str = Query('', max_length=100), user: Dict = Depends(get_current_user)):
    """Cari desa/kelurahan lewat kode pos (awalan digit) atau nama (minimal 3 karakter), maks. 20 hasil,
    lengkap dengan rantai provinsi..desa untuk mengisi dropdown bertingkat sekaligus."""
    kunci = (q or '').strip()
    if len(kunci) < 3:
        return {'items': []}
    if kunci.isdigit():
        filt = {'tingkat': 'desa', 'kode_pos': {'$regex': '^' + re.escape(kunci[:5])}}
    else:
        nama = kunci_nama(kunci)
        if len(nama) < 3:
            return {'items': []}
        filt = {'tingkat': 'desa', 'nama_key': {'$regex': re.escape(nama)}}
    docs = await db[KOLEKSI_WILAYAH].find(filt, _PROYEKSI).sort([('nama', 1), ('kode', 1)]).to_list(20)
    if not docs and not await db[KOLEKSI_WILAYAH].find_one({'tingkat': 'desa'}, {'_id': 1}):
        raise HTTPException(status_code=404, detail="Master wilayah desa/kelurahan belum dimuat")
    rantai = await rantai_wilayah([d['kode'] for d in docs])
    return {'items': [{**_item(d), 'rantai': rantai[d['kode']]} for d in docs]}


@router.get("/wilayah/ringkasan")
async def ringkasan_wilayah(user: Dict = Depends(get_current_user)):
    """Jumlah wilayah per tingkat di master + jumlah desa/kelurahan yang punya kode pos."""
    hasil = {t: 0 for t in TINGKAT_WILAYAH}
    async for g in db[KOLEKSI_WILAYAH].aggregate([{'$group': {'_id': '$tingkat', 'n': {'$sum': 1}}}]):
        if g['_id'] in hasil:
            hasil[g['_id']] = g['n']
    hasil['dengan_kode_pos'] = await db[KOLEKSI_WILAYAH].count_documents({'tingkat': 'desa', 'kode_pos': {'$nin': [None, '']}})
    return hasil


MAKS_UKURAN_PAKET = 30 * 1024 * 1024


@router.post("/wilayah/impor")
async def impor_wilayah(request: Request, file: UploadFile = File(...), user: Dict = Depends(require_role('admin'))):
    """Muat paket data wilayah resmi (.csv/.xlsx: kode, nama, kode_pos). Upsert per kode, tidak menghapus data lama."""
    nama = file.filename or ''
    if not nama.lower().endswith(('.csv', '.xlsx')):
        raise HTTPException(status_code=400, detail="Paket wilayah harus berformat .csv atau .xlsx")
    content = await file.read(MAKS_UKURAN_PAKET + 1)
    if len(content) > MAKS_UKURAN_PAKET:
        raise HTTPException(status_code=413, detail="Ukuran paket maksimal 30 MB")
    if not content:
        raise HTTPException(status_code=400, detail="Berkas kosong")
    try:
        hasil = await impor_paket_wilayah(db, content, nama)
    except Exception as e:  # noqa: BLE001 — berkas rusak/tidak terbaca
        raise HTTPException(status_code=422, detail=f"Berkas tidak bisa dibaca: {e}")
    if hasil['total'] and not (hasil['baru'] + hasil['diperbarui']):
        raise HTTPException(status_code=422, detail={'pesan': 'Tidak ada baris wilayah yang valid', **hasil})
    await log_audit(user, 'import', 'wilayah', None, details={k: hasil[k] for k in ('total', 'baru', 'diperbarui', 'gagal', 'yatim')}, request=request)
    return hasil


@router.post("/wilayah/muat-resmi")
async def muat_wilayah_resmi(request: Request, user: Dict = Depends(require_role('admin'))):
    """Unduh & muat data wilayah lengkap (38 provinsi s.d. ~83 ribu desa/kelurahan + kode pos) dari sumber
    terbuka cahyadsn (MIT, kode Kepmendagri 300.2.2-2138/2025). Upsert per kode, tidak menghapus data lama."""
    import asyncio
    from wilayah_sumber import URL_KODEPOS, URL_WILAYAH, baris_paket_dari_sql, paket_csv, unduh
    try:
        sql_w, sql_k = await asyncio.gather(asyncio.to_thread(unduh, URL_WILAYAH), asyncio.to_thread(unduh, URL_KODEPOS))
    except Exception as e:  # noqa: BLE001 — jaringan server
        raise HTTPException(status_code=502, detail=f"Gagal mengunduh data wilayah resmi: {e}. Unggah paket secara manual.")
    baris = await asyncio.to_thread(baris_paket_dari_sql, sql_w, sql_k)
    if len(baris) < 1000:
        raise HTTPException(status_code=502, detail="Data wilayah yang diunduh tidak lengkap; coba lagi atau unggah paket manual")
    hasil = await impor_paket_wilayah(db, paket_csv(baris), 'wilayah_resmi.csv')
    hasil['sumber'] = 'cahyadsn/wilayah (Kepmendagri 300.2.2-2138/2025)'
    await log_audit(user, 'import', 'wilayah', None, details={'sumber': 'resmi', **{k: hasil[k] for k in ('total', 'baru', 'diperbarui', 'gagal')}}, request=request)
    return hasil
