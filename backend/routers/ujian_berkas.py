"""Formulir Unggah Berkas Ujian (wajib login): GTK mengunggah kisi-kisi (PDF) & kartu soal (PDF/DOCX) maks. 10 MB per
mapel baku per jenjang, dan MEMILIH nama guru PJ dari daftar guru aktif pada formulir (tanpa penugasan PJ lebih dulu). Unggah ulang MENIMPA berkas lama secara
atomik (berkas lama baru dihapus setelah berkas baru tercatat). Kontrak sama dengan frontend/src/lib/ujianBerkas.js.

Status pengumpulan di halaman monitoring publik membaca ujian_berkas yang sama, jadi langsung berubah setelah unggah.
"""
import os
import tempfile
from datetime import timedelta
import zipfile
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from starlette.background import BackgroundTask
from fastapi.routing import APIRoute

from core import db, get_active_context, get_current_user, log_audit, logger
from routers.ujian import akses_ujian
from ujian import KOLEKSI_UJIAN, PERAN_BUKAN_PANITIA, sekarang_wib
from ujian_pengumpulan import status_internal
from ujian_berkas import (
    FORMAT_JENIS, LABEL_JENIS, daftar_guru_pj, dokumen_berkas, galat_berkas, guru_pj_sah, kumpulan_berkas_jenjang, nama_berkas_disk,
    rapikan_nama_file, ringkas_berkas_pj, teks_keterangan_zip,
)
from ujian_info import (
    BERKAS_MAKS_BITA, KOLEKSI_UNDUH_LOG, MODE_UNDUH, catat_unduh, catat_unduh_zip, galat_saringan_audit, ip_peminta,
    kueri_saringan_audit, JENIS_BERKAS, JENJANG_UJIAN, KOLEKSI_BERKAS, SUBFOLDER_BERKAS, jalur_unggahan, mapel_jenjang, nama_mapel,
)

router = APIRouter()

PESAN_TERLALU_BESAR = "Ukuran berkas melebihi batas 10 MB. Kecilkan ukurannya (mis. kompres PDF) lalu unggah lagi."
OVERHEAD_MULTIPART = 256 * 1024  # batas, nama field, & header multipart di luar isi berkas
BATAS_PERMINTAAN = BERKAS_MAKS_BITA + OVERHEAD_MULTIPART


class RuteBatasUnggah(APIRoute):
    """Rute unggah yang menolak permintaan terlalu besar dari header Content-Length SEBELUM body multipart diurai
    (FastAPI mengurai seluruh body sebelum handler/dependensi berjalan). Respons tetap melewati CORSMiddleware sehingga
    frontend lintas origin membaca 413, bukan "galat jaringan". Unggahan tanpa Content-Length tetap dibatasi di handler."""

    def get_route_handler(self):
        asli = super().get_route_handler()

        async def handler(request: Request):
            panjang = request.headers.get('content-length', '')
            if panjang.isdigit() and int(panjang) > BATAS_PERMINTAAN:
                return JSONResponse({'detail': PESAN_TERLALU_BESAR}, status_code=413)
            return await asli(request)
        return handler


router_unggah = APIRouter(route_class=RuteBatasUnggah)

PESAN_BUKAN_GTK = "Unggah berkas soal hanya untuk guru/GTK yang login (bukan akun siswa atau kelas)."
PESAN_PJ_TIDAK_SAH = "Pilih nama guru PJ dari daftar guru."


def _hapus_diam(jalur: Optional[str]) -> None:
    try:
        if jalur and os.path.isfile(jalur):
            os.remove(jalur)
    except OSError as e:
        logger.warning(f'[ujian_berkas] gagal menghapus berkas {os.path.basename(jalur)}: {e}')


async def _ujian(ujian_id: str) -> Dict[str, Any]:
    u = await db[KOLEKSI_UJIAN].find_one({'id': ujian_id}, {'_id': 0})
    if not u:
        raise HTTPException(404, "Ujian tidak ditemukan")
    return u


def _wajib_gtk(user: Dict[str, Any]) -> None:
    """Formulir unggah: semua GTK yang login; akun siswa/kelas/orang tua/alumni/satpam ditolak."""
    if not user.get('active_role') or user.get('active_role') in PERAN_BUKAN_PANITIA:
        raise HTTPException(403, PESAN_BUKAN_GTK)


@router_unggah.post("/ujian/{ujian_id}/berkas/{jenis}")
async def unggah_berkas_ujian(ujian_id: str, jenis: str, request: Request, jenjang: int = Form(...), mapel: str = Form(..., max_length=40),
                              guru_pj_id: str = Form(..., max_length=64), berkas: UploadFile = File(...),
                              user: Dict = Depends(get_current_user)):
    """Unggah kisi-kisi (PDF) atau kartu soal (PDF/DOCX), maks. 10 MB. Isi berkas diperiksa (bukan hanya nama/MIME).
    Unggah ulang menimpa: id & jumlah unduhan tetap, berkas lama dihapus setelah berkas baru tercatat.
    `guru_pj_id` = guru PJ yang dipilih dari daftar guru (GET /ujian/berkas-saya -> guru); namanya tampil di monitoring.
    400 format/isi salah atau PJ bukan guru aktif, 413 terlalu besar, 403 bukan GTK, 404 ujian/jenis/mapel tidak dikenal.
    -> { berkas }"""
    if jenis not in JENIS_BERKAS:
        raise HTTPException(404, "Jenis berkas tidak dikenal (kisi_kisi atau kartu_soal).")
    if jenjang not in JENJANG_UJIAN or mapel not in {m['kode'] for m in await mapel_jenjang(db, jenjang)}:
        raise HTTPException(404, "Mata pelajaran tidak ada dalam daftar mapel baku jenjang ini.")
    _wajib_gtk(user)
    await _ujian(ujian_id)
    pj = await guru_pj_sah(db, guru_pj_id)
    if not pj:
        raise HTTPException(400, PESAN_PJ_TIDAK_SAH)

    isi = await berkas.read(BERKAS_MAKS_BITA + 1)
    if len(isi) > BERKAS_MAKS_BITA:
        raise HTTPException(413, PESAN_TERLALU_BESAR)
    pesan = galat_berkas(jenis, berkas.filename, isi)
    if pesan:
        raise HTTPException(400, pesan)
    ext = os.path.splitext(berkas.filename or '')[1].lower().lstrip('.')
    if ext not in FORMAT_JENIS[jenis]:  # sudah dicek galat_berkas; jaga-jaga
        raise HTTPException(400, "Format berkas tidak diterima.")

    kunci = {'ujian_id': ujian_id, 'jenis': jenis, 'jenjang': jenjang, 'mapel': mapel}
    lama = await db[KOLEKSI_BERKAS].find_one(kunci, {'_id': 0})
    doc = dokumen_berkas(lama, ujian_id, jenis, jenjang, mapel, rapikan_nama_file(berkas.filename, ext), ext, len(isi), pj, '', sekarang_wib())
    doc['nama_berkas'] = nama_berkas_disk(doc['id'], ext)  # nama baru tiap unggah: berkas lama tidak tertimpa sebelum DB tercatat
    jalur_baru = jalur_unggahan(SUBFOLDER_BERKAS, doc['nama_berkas'])
    sementara = f'{jalur_baru}.sedang'
    try:
        with open(sementara, 'wb') as f:
            f.write(isi)
        if jenis == 'kartu_soal':  # rahasia: hanya proses aplikasi yang boleh membaca berkasnya
            os.chmod(sementara, 0o600)
        os.replace(sementara, jalur_baru)
        await db[KOLEKSI_BERKAS].update_one(kunci, {'$set': doc}, upsert=True)
    except Exception as e:  # noqa: BLE001 — berkas lama tetap berlaku bila penyimpanan gagal
        _hapus_diam(sementara)
        _hapus_diam(jalur_baru)
        logger.error(f'[ujian_berkas] gagal menyimpan {jenis} {ujian_id}/{jenjang}/{mapel}: {e}')
        raise HTTPException(500, "Berkas belum tersimpan karena gangguan server. Berkas lama (bila ada) tetap berlaku.")
    if lama and lama.get('nama_berkas') and lama['nama_berkas'] != doc['nama_berkas']:
        _hapus_diam(jalur_unggahan(SUBFOLDER_BERKAS, lama['nama_berkas']))
    # Dua unggahan bersamaan untuk slot yang sama: yang tercatat terakhir menang; berkas yang kalah dibersihkan.
    terkini = await db[KOLEKSI_BERKAS].find_one(kunci, {'_id': 0})
    if terkini and terkini.get('nama_berkas') != doc['nama_berkas']:
        _hapus_diam(jalur_baru)
        doc = terkini
    await log_audit(user, 'ujian_berkas_unggah', KOLEKSI_BERKAS, doc['id'],
                    {'ujian_id': ujian_id, 'jenis': jenis, 'jenjang': jenjang, 'mapel': mapel, 'ukuran': len(isi), 'ganti': bool(lama),
                     'guru_pj_id': pj['id']},
                    request=request)
    return {'berkas': ringkas_berkas_pj(doc)}


@router.get("/ujian/berkas-saya")
async def berkas_saya(user: Dict = Depends(get_current_user)):
    """Formulir unggah (semua GTK): ujian semester aktif, semua mapel baku × jenjang beserta berkasnya, dan daftar guru
    untuk memilih PJ. -> { ujian: [{ id, nama, jenis, mulai, selesai }], saya, guru: [{ id, nama }],
    tugas: [{ ujian_id, jenjang, mapel, nama_mapel, kisi_kisi, kartu_soal }] }"""
    _wajib_gtk(user)
    ctx = await get_active_context(user)
    ujian = await db[KOLEKSI_UJIAN].find({'semester_id': ctx.get('semester_id')}, {'_id': 0}).sort([('mulai', 1), ('nama', 1)]).to_list(100) \
        if ctx.get('semester_id') else []
    ids = [u['id'] for u in ujian]
    mapel = {j: [x['kode'] for x in await mapel_jenjang(db, j)] for j in JENJANG_UJIAN}
    berkas = await db[KOLEKSI_BERKAS].find({'ujian_id': {'$in': ids}, 'status': 'terkirim'}, {'_id': 0}).to_list(2000) if ids else []
    peta = {(b['ujian_id'], b['jenis'], b['jenjang'], b['mapel']): b for b in berkas}
    tugas: List[Dict[str, Any]] = [{
        'ujian_id': u, 'jenjang': j, 'mapel': m, 'nama_mapel': nama_mapel(m),
        **{jenis: ringkas_berkas_pj(peta.get((u, jenis, j, m))) for jenis in JENIS_BERKAS},
    } for u in ids for j in JENJANG_UJIAN for m in mapel[j]]
    return {'ujian': [{k: u.get(k) for k in ('id', 'nama', 'jenis', 'mulai', 'selesai')} for u in ujian], 'saya': user.get('id'),
            'guru': await daftar_guru_pj(db), 'tugas': tugas}


@router.get("/ujian/{ujian_id}/berkas/status")
async def status_berkas_ujian(ujian_id: str, user: Dict = Depends(get_current_user)):
    """Status monitoring berkas ujian (menu Berkas Soal: admin, pimpinan, ketua & sekretaris): per jenjang × mapel baku,
    status kisi-kisi & kartu soal + metadata (tanpa lokasi disk), PJ yang ditugaskan, ringkasan, dan daftar yang belum
    lengkap. Isi kartu soal tetap hanya dapat diunduh admin (bundel unduh admin)."""
    a = await akses_ujian(user, ujian_id, 'berkas_soal')
    s = await status_internal(db, ujian_id)
    return {'ujian': {k: a['ujian'].get(k) for k in ('id', 'nama', 'jenis', 'mulai', 'selesai')}, 'boleh_unduh_kartu': a['pengelola'], **s}


PESAN_HANYA_ADMIN_UNDUH = "Mengunduh berkas soal hanya dapat dilakukan admin."


async def _admin_berkas(user: Dict[str, Any], ujian_id: str) -> Dict[str, Any]:
    """Penjaga unduh isi berkas: menu berkas_soal + admin dengan peran aktif bukan akun kelas/siswa -> ujian."""
    a = await akses_ujian(user, ujian_id, 'berkas_soal')
    if not a['pengelola'] or user.get('active_role') in PERAN_BUKAN_PANITIA:
        raise HTTPException(403, PESAN_HANYA_ADMIN_UNDUH)
    return a['ujian']


async def _catat_tolak_kartu(user: Dict[str, Any], request: Request, ujian_id: str, alasan: str, **rincian) -> None:
    """Percobaan mengunduh kartu soal yang DITOLAK (bukan admin, tanpa konfirmasi, batas laju) dicatat ke audit umum."""
    try:
        await log_audit(user, 'ujian_kartu_soal_ditolak', KOLEKSI_BERKAS, ujian_id,
                        {'alasan': alasan, 'ip': ip_peminta(request)[0], **rincian}, request=request)
    except Exception as e:  # noqa: BLE001 — audit tidak boleh menggagalkan permintaan
        logger.error(f'[ujian_berkas] gagal mencatat penolakan kartu soal: {e}')


def _nama_unduhan_zip(jenis: str, jenjang: int, nama_ujian: str) -> str:
    ujian = ''.join('-' if c in '\\/:*?"<>|' else c for c in str(nama_ujian or '')).strip()
    return f"{LABEL_JENIS[jenis]} Kelas {jenjang}{f' - {ujian}' if ujian else ''}.zip"


BATAS_ZIP_KARTU = 10          # ZIP kartu soal per admin ...
JENDELA_BATAS_ZIP_MENIT = 10  # ... per 10 menit (menahan pengurasan massal bila sesi admin dicuri)


def penanda_rahasia(user: Dict[str, Any], ip: Optional[str], waktu) -> str:
    """Penanda unduhan kartu soal (di KETERANGAN.txt & komentar ZIP) untuk penelusuran bila berkas tersebar."""
    return (f"RAHASIA — kartu soal diunduh oleh {user.get('full_name') or user.get('username') or user.get('id')} "
            f"({user.get('id')}) pada {waktu.strftime('%d-%m-%Y %H:%M')} WIB dari {ip or '-'}. Jangan disebarluaskan.")


@router.get("/ujian/{ujian_id}/berkas/zip")
async def unduh_zip_jenjang(ujian_id: str, request: Request, jenis: str = Query(...), jenjang: int = Query(...),
                            konfirmasi: bool = Query(False), user: Dict = Depends(get_current_user)):
    """Bundel ZIP satu jenis berkas (kisi-kisi / kartu soal) untuk satu jenjang, semua mapel baku aktif yang sudah terkirim
    (admin). Berisi berkas bernama "NN Mapel - nama asli.ext" dan KETERANGAN.txt (mapel yang belum mengirim). ZIP dibangun
    ke berkas sementara di disk lalu dihapus setelah terkirim. Dicatat satu entri log zip_jenjang (penghitung unduhan publik
    tidak bertambah). 404 bila belum ada berkas sama sekali.
    KARTU SOAL (terproteksi): wajib ?konfirmasi=1 (setelah dialog konfirmasi), dibatasi BATAS_ZIP_KARTU per admin per
    JENDELA_BATAS_ZIP_MENIT (429), dan diberi penanda pengunduh (nama, waktu, IP) di KETERANGAN.txt & komentar ZIP."""
    if jenis not in JENIS_BERKAS:
        raise HTTPException(422, "Jenis harus kisi_kisi atau kartu_soal.")
    if jenjang not in JENJANG_UJIAN:
        raise HTTPException(422, "Jenjang harus 7, 8, atau 9.")
    rahasia = jenis == 'kartu_soal'
    try:
        ujian = await _admin_berkas(user, ujian_id)
    except HTTPException as e:
        if rahasia and e.status_code == 403:
            await _catat_tolak_kartu(user, request, ujian_id, 'bukan_admin', mode='zip_jenjang', jenjang=jenjang)
        raise
    kini = sekarang_wib()
    if rahasia:
        if not konfirmasi:
            await _catat_tolak_kartu(user, request, ujian_id, 'tanpa_konfirmasi', mode='zip_jenjang', jenjang=jenjang)
            raise HTTPException(400, "Unduhan kartu soal perlu dikonfirmasi terlebih dahulu.")
        batas_waktu = (kini - timedelta(minutes=JENDELA_BATAS_ZIP_MENIT)).isoformat()
        terbaru = await db[KOLEKSI_UNDUH_LOG].count_documents({'pengunduh_id': user.get('id'), 'mode': 'zip_jenjang', 'jenis_berkas': 'kartu_soal',
                                                                'waktu': {'$gte': batas_waktu}})
        if terbaru >= BATAS_ZIP_KARTU:
            await _catat_tolak_kartu(user, request, ujian_id, 'batas_laju', mode='zip_jenjang', jenjang=jenjang)
            raise HTTPException(429, f"Terlalu banyak unduhan ZIP kartu soal. Coba lagi dalam {JENDELA_BATAS_ZIP_MENIT} menit.")
    kumpulan = await kumpulan_berkas_jenjang(db, ujian_id, jenis, jenjang)
    if not kumpulan['ada']:
        if kumpulan['hilang']:
            raise HTTPException(404, f"{LABEL_JENIS[jenis]} Kelas {jenjang} tercatat terkirim tetapi berkasnya tidak ditemukan di server "
                                     f"({', '.join(m['nama'] for m in kumpulan['hilang'])}). Minta guru PJ mengunggah ulang.")
        raise HTTPException(404, f"Belum ada {LABEL_JENIS[jenis].lower()} Kelas {jenjang} yang terkirim, jadi belum ada yang dapat dibundel.")
    fd, jalur_zip = tempfile.mkstemp(prefix='bundel-', suffix='.zip')  # mkstemp: izin 0600 (hanya proses aplikasi)
    os.close(fd)
    try:
        keterangan = teks_keterangan_zip(jenis, jenjang, ujian.get('nama'), kumpulan, kini)
        penanda = penanda_rahasia(user, ip_peminta(request)[0], kini) if rahasia else None
        with zipfile.ZipFile(jalur_zip, 'w') as z:
            for x in kumpulan['ada']:  # PDF/DOCX sudah terkompresi: disimpan apa adanya (lebih cepat)
                z.write(x['jalur'], x['nama_zip'], compress_type=zipfile.ZIP_STORED)
            z.writestr('KETERANGAN.txt', f'{penanda}\r\n\r\n{keterangan}' if penanda else keterangan, compress_type=zipfile.ZIP_DEFLATED)
            if penanda:
                z.comment = penanda.encode('utf-8')[:65000]
    except Exception as e:  # noqa: BLE001
        _hapus_diam(jalur_zip)
        logger.error(f'[ujian_berkas] gagal membuat ZIP {jenis} {ujian_id}/{jenjang}: {e}')
        raise HTTPException(500, "ZIP belum dapat dibuat karena gangguan server. Coba lagi.")
    await catat_unduh_zip(db, ujian_id, jenis, jenjang, [x['berkas'] for x in kumpulan['ada']],
                          [m['kode'] for m in kumpulan['kosong'] + kumpulan['hilang']], user, request)
    await log_audit(user, 'ujian_berkas_zip', KOLEKSI_BERKAS, ujian_id,
                    {'jenis': jenis, 'jenjang': jenjang, 'jumlah': len(kumpulan['ada'])}, request=request)
    return FileResponse(jalur_zip, media_type='application/zip', filename=_nama_unduhan_zip(jenis, jenjang, ujian.get('nama')),
                        headers={'Cache-Control': 'no-store'}, background=BackgroundTask(_hapus_diam, jalur_zip))


@router.get("/ujian/{ujian_id}/berkas/{berkas_id}/unduh")
async def unduh_berkas_tunggal(ujian_id: str, berkas_id: str, request: Request, konfirmasi: bool = Query(False),
                               user: Dict = Depends(get_current_user)):
    """Unduh tunggal satu berkas (per jenjang per mapel) — admin. Berkas harus milik ujian ini dan berstatus terkirim.
    Kartu soal (rahasia) wajib ?konfirmasi=1. Dicatat ke ujian_unduh_log (mode tunggal, atas nama admin); penghitung
    unduhan publik tidak bertambah. 404 bila berkas tidak ada / tidak ditemukan di disk."""
    b = await db[KOLEKSI_BERKAS].find_one({'id': berkas_id, 'ujian_id': ujian_id, 'status': 'terkirim'}, {'_id': 0}) \
        if berkas_id and len(berkas_id) <= 64 else None
    try:
        await _admin_berkas(user, ujian_id)
    except HTTPException as e:
        if e.status_code == 403 and b and b.get('jenis') == 'kartu_soal':
            await _catat_tolak_kartu(user, request, ujian_id, 'bukan_admin', mode='tunggal', berkas_id=b['id'],
                                     jenjang=b.get('jenjang'), mapel=b.get('mapel'))
        raise
    if not b:
        raise HTTPException(404, "Berkas tidak ditemukan (mungkin sudah diganti). Muat ulang halaman untuk status terbaru.")
    jalur = jalur_unggahan(SUBFOLDER_BERKAS, b['nama_berkas']) if b.get('nama_berkas') else None
    if not jalur or not os.path.isfile(jalur):
        raise HTTPException(404, f"{LABEL_JENIS.get(b.get('jenis'), 'Berkas')} {nama_mapel(b.get('mapel'))} Kelas {b.get('jenjang')} tercatat "
                                 f"terkirim tetapi berkasnya tidak ditemukan di server. Minta guru PJ mengunggah ulang.")
    if b.get('jenis') == 'kartu_soal' and not konfirmasi:
        await _catat_tolak_kartu(user, request, ujian_id, 'tanpa_konfirmasi', mode='tunggal', berkas_id=b['id'],
                                 jenjang=b.get('jenjang'), mapel=b.get('mapel'))
        raise HTTPException(400, "Unduhan kartu soal perlu dikonfirmasi terlebih dahulu.")
    await catat_unduh(db, b, 'tunggal', request, pengunduh=user)
    await log_audit(user, 'ujian_berkas_unduh', KOLEKSI_BERKAS, b['id'],
                    {'ujian_id': ujian_id, 'jenis': b.get('jenis'), 'jenjang': b.get('jenjang'), 'mapel': b.get('mapel')}, request=request)
    ext = os.path.splitext(b['nama_berkas'])[1].lstrip('.').lower()
    return FileResponse(jalur, media_type=b.get('mime_type') or 'application/octet-stream',
                        filename=b.get('nama_file') or f"{LABEL_JENIS.get(b.get('jenis'), 'Berkas')} {nama_mapel(b.get('mapel'))} Kelas {b.get('jenjang')}.{ext}",
                        headers={'Cache-Control': 'no-store'})


FIELD_UNDUHAN_AUDIT = ('id', 'waktu', 'mode', 'jenis_berkas', 'jenjang', 'mapel', 'pengunduh_nama', 'ip', 'ip_rantai', 'perangkat',
                       'jumlah_berkas', 'mapel_kosong')


@router.get("/ujian/{ujian_id}/berkas/unduhan")
async def riwayat_unduhan(ujian_id: str, mode: Optional[str] = Query(None), jenis: Optional[str] = Query(None),
                          dari: Optional[str] = Query(None, max_length=10), sampai: Optional[str] = Query(None, max_length=10),
                          cari: Optional[str] = Query(None, max_length=100), batas: int = Query(50, ge=1, le=200),
                          response: Response = None, user: Dict = Depends(get_current_user)):
    """Riwayat audit unduhan berkas satu ujian (menu Berkas Soal: admin & pemantau; hanya baca) dari ujian_unduh_log:
    { ringkasan: { total, publik, tunggal, zip_jenjang, kartu_soal } (seluruh unduhan ujian ini),
      items: [{ id, waktu, mode, jenis_berkas, jenjang, mapel, pengunduh_nama, ip, ip_rantai, perangkat, jumlah_berkas,
                mapel_kosong }] terbaru dulu }. Saringan: ?mode=publik|tunggal|zip_jenjang, ?jenis=kisi_kisi|kartu_soal|panduan_cbt,
    ?dari=&sampai= (YYYY-MM-DD WIB), ?cari= potongan IP/perangkat; nilai tidak dikenal -> 422."""
    if mode and mode not in MODE_UNDUH:
        raise HTTPException(422, "Saringan mode harus publik, tunggal, atau zip_jenjang.")
    if jenis and jenis not in (*JENIS_BERKAS, 'panduan_cbt'):
        raise HTTPException(422, "Saringan jenis harus kisi_kisi, kartu_soal, atau panduan_cbt.")
    pesan = galat_saringan_audit(dari, sampai, cari)
    if pesan:
        raise HTTPException(422, pesan)
    await akses_ujian(user, ujian_id, 'berkas_soal')
    log = db[KOLEKSI_UNDUH_LOG]
    ringkasan = {'total': await log.count_documents({'ujian_id': ujian_id}),
                 **{m: await log.count_documents({'ujian_id': ujian_id, 'mode': m}) for m in MODE_UNDUH},
                 'kartu_soal': await log.count_documents({'ujian_id': ujian_id, 'jenis_berkas': 'kartu_soal'})}
    q = {**kueri_saringan_audit(ujian_id, dari, sampai, cari), **({'mode': mode} if mode else {}), **({'jenis_berkas': jenis} if jenis else {})}
    docs = (await log.find(q, {'_id': 0}).sort('waktu', -1).to_list(batas))[:batas]
    if response is not None:
        response.headers['Cache-Control'] = 'no-store'  # jejak audit sensitif: jangan disimpan cache peramban/proxy
    return {'ringkasan': ringkasan, 'items': [{k: d.get(k) for k in FIELD_UNDUHAN_AUDIT} for d in docs]}
