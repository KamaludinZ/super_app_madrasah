"""API publik TANPA login modul Ujian Madrasah: daftar hadir peserta (& berita acara pengawas pada fase berikutnya).

Akses hanya lewat token tautan acak per ujian (Pengaturan Formulir). Setiap permintaan tetap divalidasi terhadap
ujian, ruang, sesi, dan jendela waktu formulir yang dibuka panitia (cek_waktu_formulir); data yang dikirim ke publik
dibatasi seperlunya (nama, kelas, nomor peserta — tanpa NIS/NISN).
"""
from typing import Any, Dict, Tuple

from fastapi import APIRouter, HTTPException, Query, Request
from pymongo.errors import DuplicateKeyError

from core import db, get_settings, log_audit
from pkg_angket import olah_tanda_tangan
from routers.ujian_formulir import jadwal_ujian
from ujian import KOLEKSI_FORMULIR, KOLEKSI_RUANG, KOLEKSI_UJIAN, cek_waktu_formulir, hari_ini_wib, jam_wib
from ujian_formulir import sesi_aktif, sesi_pada
from ujian_berita_acara import (
    KOLEKSI_BA, BeritaAcaraIn, dokumen_berita_acara, rekap_ruang_sesi, rekap_untuk_publik, simpan_ttd_ba,
)
from ujian_kehadiran import KOLEKSI_DH, KOLEKSI_DH_TTD, DaftarHadirIn, ambil_status_sesi, dokumen_kehadiran
from ujian_ruang import peserta_ruang_ujian, urut_nama_ruang
from ujian_sesi_publik import UNTUK, kelengkapan_sesi, susun_pilihan

router = APIRouter()

PESAN_TOKEN = "Tautan tidak ditemukan atau sudah diganti panitia."


async def formulir_dari_token(token: str) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """(formulir, ujian) dari token tautan publik; 404 bila token tidak dikenal."""
    if not token or len(token) > 100:
        raise HTTPException(404, PESAN_TOKEN)
    f = await db[KOLEKSI_FORMULIR].find_one({'token': token}, {'_id': 0})
    ujian = await db[KOLEKSI_UJIAN].find_one({'id': f['ujian_id']}, {'_id': 0}) if f else None
    if not f or not ujian:
        raise HTTPException(404, PESAN_TOKEN)
    return f, ujian


def _ringkas_formulir_publik(cek: Dict[str, Any], f: Dict[str, Any]) -> Dict[str, Any]:
    return {'terbuka': cek['terbuka'], 'alasan': cek['alasan'], 'pesan': cek['pesan'], 'status': cek['status'],
            'jam_buka': f.get('jam_buka'), 'jam_tutup': f.get('jam_tutup')}


@router.get("/publik/ujian/{token}")
async def info_publik(token: str):
    """Info tautan publik: madrasah, ujian, status jendela formulir menurut jam server WIB, sesi aktif & sesi hari ini,
    serta daftar ruang (untuk langkah pertama: pilih ruangan)."""
    f, ujian = await formulir_dari_token(token)
    hari_ini, jam = hari_ini_wib(), jam_wib()
    cek = cek_waktu_formulir(ujian, f, hari_ini, jam)
    jadwal = await jadwal_ujian(ujian['id'])
    ruang = await db[KOLEKSI_RUANG].find({'ujian_id': ujian['id']}, {'_id': 0, 'id': 1, 'nama_ruang': 1, 'jenjang': 1}).to_list(500)
    s = await get_settings()
    return {
        'madrasah': {'nama': (f.get('template') or {}).get('nama_madrasah') or s.get('school_name'), 'logo_url': s.get('logo_url')},
        'ujian': {k: ujian.get(k) for k in ('nama', 'jenis', 'tahun_pelajaran', 'mulai', 'selesai')},
        'formulir': _ringkas_formulir_publik(cek, f),
        'tanggal': hari_ini, 'jam': jam,
        'sesi': sesi_aktif(jadwal, hari_ini, jam),
        'sesi_hari_ini': sesi_pada(jadwal, hari_ini),
        'ruang': sorted(({'id': r['id'], 'nama_ruang': r.get('nama_ruang'), 'jenjang': r.get('jenjang') or []} for r in ruang),
                        key=lambda r: urut_nama_ruang(r['nama_ruang'] or '')),
    }


async def sesi_ujian(ujian_id: str, sesi_id: str) -> Dict[str, Any]:
    s = await db['jadwal_ujian'].find_one({'id': sesi_id, 'ujian_id': ujian_id}, {'_id': 0}) if sesi_id else None
    if not s:
        raise HTTPException(404, "Sesi ujian tidak ditemukan.")
    return s


async def ruang_ujian_publik(ujian_id: str, ruang_id: str) -> Dict[str, Any]:
    r = await db[KOLEKSI_RUANG].find_one({'id': ruang_id, 'ujian_id': ujian_id}, {'_id': 0})
    if not r:
        raise HTTPException(404, "Ruang tidak ditemukan pada ujian ini.")
    return r


PESAN_SESI_LENGKAP = {
    'daftar_hadir': 'Daftar hadir sesi ini sudah lengkap sehingga tidak dapat dipilih lagi. Muat ulang halaman untuk melihat sesi yang berjalan.',
    'berita_acara': 'Berita acara semua ruang pada sesi ini sudah lengkap sehingga tidak dapat dipilih lagi.',
}


async def cek_sesi_boleh_diisi(ujian: Dict[str, Any], sesi: Dict[str, Any], untuk: str, hari_ini: str) -> None:
    """Sesi hari ini tetap seperti semula (sesi aktif otomatis maupun sesi lain hari ini). Sesi hari sebelumnya boleh
    diisi selama BELUM LENGKAP; sesi hari berikutnya tidak dapat dibuka sebelum harinya (403)."""
    if sesi['tanggal'] > hari_ini:
        raise HTTPException(403, 'Sesi ini belum dibuka — sesi hari berikutnya hanya dapat diisi pada harinya. '
                                 'Muat ulang halaman untuk melihat sesi yang berjalan.')
    if sesi['tanggal'] < hari_ini and (await kelengkapan_sesi(db, ujian['id'], [sesi], untuk))[sesi['id']]['lengkap']:
        raise HTTPException(403, PESAN_SESI_LENGKAP[untuk])


@router.get("/publik/ujian/{token}/sesi")
async def pilihan_sesi_publik(token: str, untuk: str = Query('daftar_hadir')):
    """Pilihan sesi: sesi aktif (otomatis menurut jam) + sesi lain hari ini & hari sebelumnya beserta kelengkapannya
    (daftar hadir: peserta; berita acara: ruang). Hanya sesi aktif & sesi yang belum lengkap yang boleh dipilih."""
    if untuk not in UNTUK:
        raise HTTPException(422, 'Parameter untuk hanya daftar_hadir atau berita_acara')
    _f, ujian = await formulir_dari_token(token)
    hari_ini, jam = hari_ini_wib(), jam_wib()
    jadwal = await jadwal_ujian(ujian['id'])
    lalu = [s for s in jadwal if s['tanggal'] <= hari_ini]
    return susun_pilihan(jadwal, sesi_aktif(jadwal, hari_ini, jam), hari_ini, await kelengkapan_sesi(db, ujian['id'], lalu, untuk))


@router.get("/publik/ujian/{token}/ruang/{ruang_id}/peserta")
async def peserta_ruang_publik(token: str, ruang_id: str, sesi_id: str = Query('', max_length=64)):
    """Langkah kelas & nama: kelas yang ada di ruang ini dan pesertanya (nama, kelas, nomor peserta — tanpa NIS/NISN)
    beserta status pada sesi (hadir/izin/sakit/alpa) agar nama yang sudah hadir/ditandai tidak dipilih lagi."""
    f, ujian = await formulir_dari_token(token)
    await ruang_ujian_publik(ujian['id'], ruang_id)
    peserta = await peserta_ruang_ujian(db, ujian['id'], ruang_id)
    status = {}
    if sesi_id:
        sesi = await sesi_ujian(ujian['id'], sesi_id)
        status = await ambil_status_sesi(db, ujian['id'], sesi, [p['id'] for p in peserta])
    kelas: Dict[str, Dict[str, Any]] = {}
    for p in peserta:
        k = kelas.setdefault(p['kelas'], {'kelas': p['kelas'], 'jenjang': p['jenjang'], 'jumlah': 0})
        k['jumlah'] += 1
    return {
        'kelas': sorted(kelas.values(), key=lambda k: (k['jenjang'] or 0, urut_nama_ruang(k['kelas'] or ''))),
        'peserta': [{
            'id': p['id'], 'nama': p['nama'], 'kelas': p['kelas'], 'jenjang': p['jenjang'], 'nomor_peserta': p['nomor_peserta'] or '',
            'status': (status.get(p['id']) or {}).get('status'), 'sudah_hadir': (status.get(p['id']) or {}).get('status') == 'hadir',
        } for p in sorted(peserta, key=lambda x: ((x['nama'] or '').lower()))],
    }


def _tolak_ganda(nama: str, kehadiran: Dict[str, Any]) -> HTTPException:
    return HTTPException(409, {
        'alasan': 'sudah_mengisi',
        'pesan': 'Nama ini sudah mengisi daftar hadir pada sesi ini. Hubungi pengawas/panitia bila perlu dibuka kuncinya.',
        'nama': nama, 'waktu_kirim': (kehadiran or {}).get('waktu_kirim'),
    })


@router.post("/publik/ujian/{token}/daftar-hadir")
async def kirim_daftar_hadir(token: str, body: DaftarHadirIn, request: Request):
    """Kirim daftar hadir satu peserta (tanpa login). Ditolak bila formulir tertutup/di luar jam (403), sesi hari
    berikutnya / sesi hari sebelumnya yang sudah lengkap (403), peserta bukan peserta ruang itu (404), tanda tangan kosong/rusak (422), atau nama itu sudah
    mengirim pada sesi ini (409 — satu kiriman per nama per sesi; index unik peserta+sesi menjaga kiriman bersamaan)."""
    f, ujian = await formulir_dari_token(token)
    hari_ini, jam = hari_ini_wib(), jam_wib()
    cek = cek_waktu_formulir(ujian, f, hari_ini, jam)
    if not cek['terbuka']:
        raise HTTPException(403, cek['pesan'])
    sesi = await sesi_ujian(ujian['id'], body.sesi_id)
    await cek_sesi_boleh_diisi(ujian, sesi, 'daftar_hadir', hari_ini)
    ruang = await ruang_ujian_publik(ujian['id'], body.ruang_id)
    peserta = await db['peserta_ruang'].find_one({'id': body.peserta_id, 'ujian_id': ujian['id']}, {'_id': 0})
    if not peserta or peserta.get('ruang_id') != ruang['id']:
        raise HTTPException(404, 'Nama tidak terdaftar di ruang ini. Pilih ruang dan nama Anda dari daftar.')
    lama = await db[KOLEKSI_DH].find_one({'peserta_id': peserta['id'], 'sesi_id': sesi['id']}, {'_id': 0})
    if lama:
        raise _tolak_ganda(peserta.get('nama'), lama)
    try:
        png = olah_tanda_tangan(body.ttd_png)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
    doc = dokumen_kehadiran(ujian['id'], peserta, sesi, ip=request.client.host if request.client else None,
                            perangkat=request.headers.get('user-agent'))
    try:
        await db[KOLEKSI_DH].insert_one(dict(doc))
    except DuplicateKeyError as e:  # dua kiriman bersamaan untuk nama yang sama
        raise _tolak_ganda(peserta.get('nama'), await db[KOLEKSI_DH].find_one({'peserta_id': peserta['id'], 'sesi_id': sesi['id']}, {'_id': 0})) from e
    await db[KOLEKSI_DH_TTD].insert_one({'kehadiran_id': doc['id'], 'png': png, 'dibuat_pada': doc['waktu_kirim']})
    await log_audit({'full_name': f"{peserta.get('nama')} (peserta, tautan publik)"}, 'ujian_daftar_hadir_kirim', KOLEKSI_DH, doc['id'],
                    {'ujian_id': ujian['id'], 'sesi_id': sesi['id'], 'ruang_id': ruang['id'], 'peserta_id': peserta['id']}, request=request)
    return {'nama': peserta.get('nama'), 'kelas': peserta.get('kelas'), 'nomor_peserta': peserta.get('nomor_peserta') or '',
            'ruang': ruang.get('nama_ruang'), 'sesi': {k: sesi.get(k) for k in ('id', 'tanggal', 'sesi_ke', 'jam_mulai', 'jam_selesai')},
            'waktu_kirim': doc['waktu_kirim']}


# ---- Berita acara: status kelengkapan daftar hadir & pilihan pengawas ----
def _sudah_diisi(ba):
    return {'pengawas_nama': ba.get('pengawas_nama'), 'waktu_kirim': ba.get('waktu_kirim')} if ba else None


@router.get("/publik/ujian/{token}/kelengkapan")
async def kelengkapan_publik(token: str, sesi_id: str = Query('', max_length=64)):
    """Status kelengkapan daftar hadir tiap ruang pada sesi (bawaan: sesi aktif) — syarat pengisian berita acara —
    beserta apakah berita acara ruang itu sudah diisi."""
    _f, ujian = await formulir_dari_token(token)
    if sesi_id:
        sesi = await sesi_ujian(ujian['id'], sesi_id)
    else:
        sesi = sesi_aktif(await jadwal_ujian(ujian['id']), hari_ini_wib(), jam_wib())
        if not sesi:
            return {'sesi': None, 'items': []}
    ruang = sorted(await db[KOLEKSI_RUANG].find({'ujian_id': ujian['id']}, {'_id': 0}).to_list(500),
                   key=lambda r: urut_nama_ruang(r.get('nama_ruang') or ''))
    ba = {b['ruang_id']: b for b in await db[KOLEKSI_BA].find({'ujian_id': ujian['id'], 'sesi_id': sesi['id']}, {'_id': 0}).to_list(500)}
    items = []
    for r in ruang:
        k = (await rekap_ruang_sesi(db, ujian['id'], r, sesi))['kelengkapan']
        items.append({'ruang_id': r['id'], 'nama_ruang': r['nama_ruang'], **k, 'sudah_diisi': _sudah_diisi(ba.get(r['id']))})
    return {'sesi': {k: sesi.get(k) for k in ('id', 'tanggal', 'sesi_ke', 'jam_mulai', 'jam_selesai')}, 'items': items}


@router.get("/publik/ujian/{token}/berita-acara/ruang/{ruang_id}")
async def rekap_ba_publik(token: str, ruang_id: str, sesi_id: str = Query(..., min_length=1, max_length=64)):
    """Data berita acara satu ruang pada sesi: kelengkapan daftar hadir (syarat), rekap hadir & tidak hadir per jenjang
    yang terisi otomatis dari daftar hadir, dan status bila berita acara sudah diisi."""
    _f, ujian = await formulir_dari_token(token)
    sesi = await sesi_ujian(ujian['id'], sesi_id)
    ruang = await ruang_ujian_publik(ujian['id'], ruang_id)
    h = await rekap_ruang_sesi(db, ujian['id'], ruang, sesi)
    ba = await db[KOLEKSI_BA].find_one({'ujian_id': ujian['id'], 'ruang_id': ruang_id, 'sesi_id': sesi['id']}, {'_id': 0})
    return {'ruang': {'id': ruang['id'], 'nama_ruang': ruang['nama_ruang'], 'jenjang': ruang.get('jenjang', [])},
            'kelengkapan': h['kelengkapan'], 'rekap': rekap_untuk_publik(h['rekap'], sesi), 'sudah_diisi': _sudah_diisi(ba)}


@router.get("/publik/ujian/{token}/pengawas")
async def pengawas_publik(token: str):
    """Pilihan nama pengawas: master guru pengawas yang aktif (tanpa plotting per ruang), urut nama."""
    await formulir_dari_token(token)
    docs = await db['guru_pengawas'].find({'aktif': {'$ne': False}}, {'_id': 0, 'id': 1, 'nama': 1, 'aktif': 1}).to_list(1000)
    return {'items': sorted(({'id': d['id'], 'nama': d.get('nama')} for d in docs if d.get('aktif', True)), key=lambda p: (p['nama'] or '').lower())}


@router.post("/publik/ujian/{token}/berita-acara")
async def kirim_berita_acara(token: str, body: BeritaAcaraIn, request: Request):
    """Simpan berita acara pengawas (tanpa login): satu per ruang per sesi. Syarat: formulir terbuka & sesi boleh diisi —
    hari ini, atau hari sebelumnya yang belum lengkap (403),
    pengawas aktif di master (404), daftar hadir ruang itu pada sesi ini LENGKAP (403 dengan pesan), tanda tangan sah
    (422), belum pernah diisi (409). Jumlah hadir & tidak hadir diambil dari daftar hadir, bukan dari isian pengawas."""
    f, ujian = await formulir_dari_token(token)
    hari_ini, jam = hari_ini_wib(), jam_wib()
    cek = cek_waktu_formulir(ujian, f, hari_ini, jam)
    if not cek['terbuka']:
        raise HTTPException(403, cek['pesan'])
    sesi = await sesi_ujian(ujian['id'], body.sesi_id)
    await cek_sesi_boleh_diisi(ujian, sesi, 'berita_acara', hari_ini)
    ruang = await ruang_ujian_publik(ujian['id'], body.ruang_id)
    pengawas = await db['guru_pengawas'].find_one({'id': body.pengawas_id}, {'_id': 0})
    if not pengawas or not pengawas.get('aktif', True):
        raise HTTPException(404, 'Nama pengawas tidak terdaftar. Pilih nama Anda dari daftar guru pengawas.')
    kunci = {'ujian_id': ujian['id'], 'ruang_id': ruang['id'], 'sesi_id': sesi['id']}
    if await db[KOLEKSI_BA].find_one(kunci, {'_id': 0, 'id': 1}):
        raise HTTPException(409, f"Berita acara Ruang {ruang['nama_ruang']} untuk sesi ini sudah diisi.")
    h = await rekap_ruang_sesi(db, ujian['id'], ruang, sesi)
    if not h['kelengkapan']['lengkap']:
        raise HTTPException(403, h['kelengkapan']['pesan'] + ' Berita acara baru dapat diisi setelah daftar hadir lengkap.')
    doc = dokumen_berita_acara(ujian['id'], ruang, sesi, pengawas, h['rekap'], body.catatan,
                               ip=request.client.host if request.client else None, perangkat=request.headers.get('user-agent'))
    try:
        from pkg_angket import olah_tanda_tangan
        olah_tanda_tangan(body.ttd_png)  # validasi dulu agar dokumen tidak tersimpan tanpa tanda tangan sah
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
    try:
        await db[KOLEKSI_BA].insert_one(dict(doc))
    except DuplicateKeyError as e:
        raise HTTPException(409, f"Berita acara Ruang {ruang['nama_ruang']} untuk sesi ini sudah diisi.") from e
    await simpan_ttd_ba(db, doc['id'], body.ttd_png, doc['waktu_kirim'])
    await log_audit({'full_name': f"{pengawas.get('nama')} (pengawas, tautan publik)"}, 'ujian_berita_acara_kirim', KOLEKSI_BA, doc['id'],
                    {'ujian_id': ujian['id'], 'ruang_id': ruang['id'], 'sesi_id': sesi['id'], 'pengawas_id': pengawas['id']}, request=request)
    return {'ruang': ruang['nama_ruang'], 'sesi': {k: sesi.get(k) for k in ('id', 'tanggal', 'sesi_ke', 'jam_mulai', 'jam_selesai')},
            'pengawas_nama': pengawas.get('nama'), 'waktu_kirim': doc['waktu_kirim'], 'rekap': rekap_untuk_publik(h['rekap'], sesi)}


@router.get("/publik/ujian/{token}/berita-acara/riwayat")
async def riwayat_ba_publik(token: str, sesi_id: str = Query('', max_length=64)):
    """Berita acara hari ini — atau satu sesi bila `sesi_id` diisi (mis. sesi hari sebelumnya yang dipilih) — (ruang,
    sesi, nama pengawas, jam kirim) agar pengawas tahu ruang yang sudah dilaporkan."""
    _f, ujian = await formulir_dari_token(token)
    if sesi_id:
        pilih = await sesi_ujian(ujian['id'], sesi_id)
        tanggal, sesi, q = pilih['tanggal'], {pilih['id']: pilih}, {'ujian_id': ujian['id'], 'sesi_id': pilih['id']}
    else:
        tanggal = hari_ini_wib()
        sesi = {s['id']: s for s in await jadwal_ujian(ujian['id']) if s['tanggal'] == tanggal}
        q = {'ujian_id': ujian['id'], 'tanggal': tanggal}
    nama = {r['id']: r['nama_ruang'] for r in await db[KOLEKSI_RUANG].find({'ujian_id': ujian['id']}, {'_id': 0, 'id': 1, 'nama_ruang': 1}).to_list(500)}
    docs = await db[KOLEKSI_BA].find(q, {'_id': 0}).to_list(500)
    return {'tanggal': tanggal, 'items': [{
        'ruang_id': d['ruang_id'], 'nama_ruang': nama.get(d['ruang_id']), 'sesi_id': d['sesi_id'],
        'sesi_ke': (sesi.get(d['sesi_id']) or {}).get('sesi_ke'), 'pengawas_nama': d.get('pengawas_nama'), 'waktu_kirim': d.get('waktu_kirim'),
    } for d in sorted(docs, key=lambda x: x.get('waktu_kirim') or '')]}
