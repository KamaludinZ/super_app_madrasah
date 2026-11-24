"""API Ujian Madrasah (UTS/UAS): beranda, kepanitiaan, dan akses menu panitia.

Skema & aturan murni ada di ujian.py. Admin mengelola seluruh ujian, kepala madrasah & waka kurikulum memantau,
dan GTK yang ditetapkan sebagai panitia mendapat akses sesuai jabatannya. Penolakan dikirim sebagai
HTTP 403 dengan pesan spesifik.
"""
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Request

from core import db, get_active_context, get_current_user, log_audit, logger
from ujian import (
    JABATAN_PANITIA, JABATAN_PEMBUKA_ARSIP, KOLEKSI_FORMULIR, KOLEKSI_PANITIA, KOLEKSI_UJIAN, LABEL_JABATAN,
    PESAN_TOLAK_ARSIP, PROYEKSI_PEJABAT, STATUS_FORMULIR, PanitiaIn, UjianIn,
    MENU_UJIAN, adalah_pengelola, adalah_pimpinan, akun_gtk_sah, boleh_akses_ujian, dokumen_ujian_baru, pesan_tolak_menu, galat_susunan_panitia, galat_tanggal_semester,
    hari_ini_wib, identitas_pejabat, jabatan_pengguna, jam_wib, kelompokkan_per_semester, menu_panitia_ujian,
    mungkin_panitia, perubahan_terakhir, ringkas_daftar_ujian, ringkas_formulir, ringkas_ujian, susunan_dari_dokumen,
    terapkan_susunan_panitia,
)
from ujian_info import inisialisasi_tautan

router = APIRouter()

PESAN_BUKAN_PANITIA = "Anda belum tercatat sebagai panitia ujian pada semester ini"
PESAN_BUKAN_PENGELOLA = "Hanya admin yang dapat mengelola ujian dan kepanitiaan"


async def wajib_pengelola(user: Dict = Depends(get_current_user)) -> Dict[str, Any]:
    """Penjaga endpoint pengelolaan ujian (buat ujian, susun panitia, dan pengaturan lain): hanya admin."""
    if not adalah_pengelola(user):
        raise HTTPException(403, PESAN_BUKAN_PENGELOLA)
    return user


async def ujian_semester_konteks(user: Dict[str, Any], ujian_id: str) -> Dict[str, Any]:
    """Ujian pada semester konteks lihat pengguna; 404 bila tidak ada, 409 bila milik semester lain (arsip)."""
    doc = await db[KOLEKSI_UJIAN].find_one({'id': ujian_id}, {'_id': 0})
    if not doc:
        raise HTTPException(404, "Ujian tidak ditemukan")
    ctx = await get_active_context(user)
    if doc.get('semester_id') != ctx.get('semester_id'):
        raise HTTPException(409, "Ujian ini milik semester lain dan sudah menjadi arsip; ubah lewat Konteks Lihat semester tersebut")
    return doc


def _konteks_ringkas(ctx: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'semester_id': ctx.get('semester_id'),
        'semester_nama': ctx.get('semester_name'),
        'tahun_pelajaran': ctx.get('academic_year_name'),
        'is_override': bool(ctx.get('is_override')),
    }


async def _akses_semester(user: Dict[str, Any], semester_id: str) -> Dict[str, Any]:
    """Akses pengguna pada ujian satu semester: { pengelola, pimpinan, jabatan: [..], per_ujian: {ujian_id: jabatan} }."""
    per_ujian = {}
    if semester_id and mungkin_panitia(user):
        ids = await db[KOLEKSI_UJIAN].distinct('id', {'semester_id': semester_id})
        per_ujian = await jabatan_pengguna(db, user.get('id'), ids)
    return {
        'pengelola': adalah_pengelola(user),
        'pimpinan': adalah_pimpinan(user),
        'jabatan': sorted(set(per_ujian.values())),
        'per_ujian': per_ujian,
    }


async def _wajib_akses_semester(user: Dict[str, Any]):
    """Konteks + akses semester pengguna; 403 bila bukan pengelola, kepala madrasah, atau panitia semester itu."""
    ctx = await get_active_context(user)
    akses = await _akses_semester(user, ctx.get('semester_id'))
    if not (akses['pengelola'] or akses['pimpinan'] or akses['jabatan']):
        raise HTTPException(403, PESAN_BUKAN_PANITIA)
    return ctx, akses


async def akses_ujian(user: Dict[str, Any], ujian_id: str, key: str) -> Dict[str, Any]:
    """Penjaga endpoint per ujian berdasarkan jabatan pada ujian itu (bukan gabungan jabatan semester).
    -> { ujian, jabatan, pengelola, pimpinan }; 404 bila ujian tidak ada, 403 dengan pesan spesifik bila tidak berhak."""
    ujian = await db[KOLEKSI_UJIAN].find_one({'id': ujian_id}, {'_id': 0})
    if not ujian:
        raise HTTPException(404, "Ujian tidak ditemukan")
    pengelola, pimpinan = adalah_pengelola(user), adalah_pimpinan(user)
    jabatan = (await jabatan_pengguna(db, user.get('id'), [ujian_id])).get(ujian_id) if mungkin_panitia(user) else None
    if not boleh_akses_ujian(pengelola, pimpinan, jabatan, key):
        raise HTTPException(403, pesan_tolak_menu(key))
    return {'ujian': ujian, 'jabatan': jabatan, 'pengelola': pengelola, 'pimpinan': pimpinan}


@router.get("/ujian/beranda")
async def beranda_ujian(user: Dict = Depends(get_current_user)):
    """Beranda Ujian: semua UTS/UAS pada semester konteks lihat pengguna (urut tanggal mulai) beserta status formulir,
    jumlah ruang & peserta, jabatan pengguna, dan menu kepanitiaan. Hanya pengelola, kepala madrasah, dan panitia
    ujian semester itu."""
    ctx, akses = await _wajib_akses_semester(user)
    docs = []
    if ctx.get('semester_id'):
        docs = await db[KOLEKSI_UJIAN].find({'semester_id': ctx['semester_id']}, {'_id': 0}).sort([('mulai', 1), ('nama', 1)]).to_list(200)
    return {
        'konteks': _konteks_ringkas(ctx),
        'items': await ringkas_daftar_ujian(db, docs, akses['per_ujian'], hari_ini_wib(), jam_wib()),
        'akses': {k: akses[k] for k in ('pengelola', 'pimpinan', 'jabatan')},
        'menu': menu_panitia_ujian(akses['pengelola'], akses['pimpinan'], akses['jabatan']),
    }


@router.get("/ujian/status-formulir")
async def status_formulir_ringkas(user: Dict = Depends(get_current_user)):
    """Status formulir daftar hadir & berita acara tiap ujian semester konteks lihat (ringan, untuk dipantau berkala):
    { tanggal, jam, ringkasan: {tertutup, dibuka, selesai}, items: [{ ujian_id, formulir }] } menurut jam server WIB."""
    ctx, _akses = await _wajib_akses_semester(user)
    hari_ini, jam = hari_ini_wib(), jam_wib()
    docs = []
    if ctx.get('semester_id'):
        docs = await db[KOLEKSI_UJIAN].find({'semester_id': ctx['semester_id']}, {'_id': 0, 'id': 1, 'mulai': 1, 'selesai': 1}).to_list(200)
    formulir = {}
    if docs:
        for f in await db[KOLEKSI_FORMULIR].find({'ujian_id': {'$in': [d['id'] for d in docs]}}, {'_id': 0}).to_list(200):
            formulir[f['ujian_id']] = f
    items = [{'ujian_id': d['id'], 'formulir': ringkas_formulir(d, formulir.get(d['id']), hari_ini, jam)} for d in docs]
    ringkasan = {s: sum(1 for i in items if i['formulir']['status'] == s) for s in STATUS_FORMULIR}
    return {'tanggal': hari_ini, 'jam': jam, 'ringkasan': ringkasan, 'items': items}


@router.get("/ujian/akses-saya")
async def akses_saya(user: Dict = Depends(get_current_user)):
    """Akses modul ujian pengguna login untuk pintasan & grup menu sidebar: { pengelola, pimpinan, jabatan, menu }.
    Tidak pernah 403: pengguna tanpa jabatan mendapat menu tanpa akses (grup menu disembunyikan klien). Jabatan
    dihitung dari ujian semester konteks lihat, sehingga panitia baru langsung mendapat menunya tanpa pengaturan."""
    ctx = await get_active_context(user)
    akses = await _akses_semester(user, ctx.get('semester_id'))
    return {
        'pengelola': akses['pengelola'],
        'pimpinan': akses['pimpinan'],
        'jabatan': akses['jabatan'],
        'menu': menu_panitia_ujian(akses['pengelola'], akses['pimpinan'], akses['jabatan']),
        'pj_berkas': await _pj_berkas_semester(user, ctx.get('semester_id')),
    }


async def _pj_berkas_semester(user: Dict[str, Any], semester_id) -> bool:
    """Menu "Unggah Berkas Soal": semua GTK (bukan akun siswa/kelas/orang tua/alumni/satpam) bila ada ujian pada semester
    itu. Tidak ada penugasan PJ — nama guru PJ dipilih dari daftar guru saat mengisi formulir unggah."""
    if not semester_id or not mungkin_panitia(user):
        return False
    return bool(await db[KOLEKSI_UJIAN].find_one({'semester_id': semester_id}, {'_id': 0, 'id': 1}))


@router.get("/ujian/arsip-semester")
async def arsip_semester(user: Dict = Depends(get_current_user)):
    """Arsip Semester Lalu: ujian semester-semester selain semester konteks lihat, dikelompokkan per semester (terbaru
    dulu). Pengelola & kepala madrasah melihat semua; ketua/sekretaris panitia hanya ujian tempat ia menjabat;
    selain itu 403."""
    ctx = await get_active_context(user)
    q = {'semester_id': {'$ne': ctx.get('semester_id')}} if ctx.get('semester_id') else {}
    jabatan = {}
    if not (adalah_pengelola(user) or adalah_pimpinan(user)):
        if mungkin_panitia(user):
            for p in await db[KOLEKSI_PANITIA].find(
                    {'user_id': user.get('id'), 'jabatan': {'$in': list(JABATAN_PEMBUKA_ARSIP)}}, {'_id': 0, 'ujian_id': 1, 'jabatan': 1}).to_list(1000):
                jabatan[p['ujian_id']] = p['jabatan']
        if not jabatan:
            raise HTTPException(403, PESAN_TOLAK_ARSIP)
        q['id'] = {'$in': list(jabatan)}
    docs = await db[KOLEKSI_UJIAN].find(q, {'_id': 0}).to_list(2000)
    if not jabatan:
        jabatan = await jabatan_pengguna(db, user.get('id'), [d['id'] for d in docs])
    items = await ringkas_daftar_ujian(db, docs, jabatan, hari_ini_wib(), jam_wib())
    return {'semester': kelompokkan_per_semester(items)}


@router.get("/ujian/gtk-pilihan")
async def gtk_pilihan(q: str = '', user: Dict = Depends(wajib_pengelola)):
    """Pilihan pejabat panitia: akun GTK & pimpinan yang aktif (bukan siswa, kelas, orang tua, alumni, satpam),
    urut nama. `q` menyaring nama/NIP (opsional). -> { items: [Pejabat] }"""
    docs = await db.users.find({'is_active': {'$ne': False}}, PROYEKSI_PEJABAT).to_list(5000)
    items = [identitas_pejabat(u) for u in docs if akun_gtk_sah(u)]
    cari = ' '.join(q.lower().split())
    if cari:
        items = [i for i in items if cari in f"{i['nama']} {i['nip']}".lower()]
    items.sort(key=lambda i: (i['nama'] or '').lower())
    return {'items': items}


@router.get("/ujian/panitia")
async def daftar_kepanitiaan(user: Dict = Depends(wajib_pengelola)):
    """Kepanitiaan: ujian semester konteks lihat (urut tanggal mulai) beserta susunan panitianya & perubahan terakhir."""
    ctx = await get_active_context(user)
    docs = []
    if ctx.get('semester_id'):
        docs = await db[KOLEKSI_UJIAN].find({'semester_id': ctx['semester_id']}, {'_id': 0}).sort([('mulai', 1), ('nama', 1)]).to_list(200)
    ids = [d['id'] for d in docs]
    panitia: Dict[str, list] = {i: [] for i in ids}
    if ids:
        for p in await db[KOLEKSI_PANITIA].find({'ujian_id': {'$in': ids}}, {'_id': 0}).to_list(2000):
            panitia.setdefault(p['ujian_id'], []).append(p)
    ringkas = await ringkas_daftar_ujian(db, docs, await jabatan_pengguna(db, user.get('id'), ids), hari_ini_wib(), jam_wib())
    return {
        'konteks': _konteks_ringkas(ctx),
        'items': [{'ujian': u, 'panitia': susunan_dari_dokumen(panitia[u['id']]), 'diubah': perubahan_terakhir(panitia[u['id']])}
                  for u in ringkas],
    }


@router.post("/ujian")
async def buat_ujian(body: UjianIn, request: Request, user: Dict = Depends(wajib_pengelola)):
    """Buat ujian UTS/UAS pada semester konteks lihat pengelola. Formulir awal tertutup."""
    ctx = await get_active_context(user)
    if not ctx.get('semester_id'):
        raise HTTPException(400, "Belum ada semester aktif. Aktifkan semester terlebih dahulu.")
    semester = await db.semesters.find_one({'id': ctx['semester_id']}, {'_id': 0}) or {'id': ctx['semester_id']}
    galat = galat_tanggal_semester(body, semester)
    if galat:
        raise HTTPException(400, galat)
    if await db[KOLEKSI_UJIAN].find_one({'semester_id': semester['id'], 'nama': body.nama}, {'_id': 0, 'id': 1}):
        raise HTTPException(409, f'Ujian "{body.nama}" sudah ada pada semester ini')
    tahun = await db.academic_years.find_one({'id': semester.get('academic_year_id')}, {'_id': 0, 'name': 1})
    doc = dokumen_ujian_baru(user, body, semester, tahun)
    await db[KOLEKSI_UJIAN].insert_one(dict(doc))
    await log_audit(user, 'ujian_buat', KOLEKSI_UJIAN, doc['id'], {'jenis': doc['jenis'], 'nama': doc['nama']}, request=request)
    try:  # dua tautan publik (info & monitoring) langsung tersedia dalam keadaan ditutup; gagal di sini tidak membatalkan ujian
        await inisialisasi_tautan(db, doc['id'], user)
    except Exception as e:  # noqa: BLE001 — tautan tetap dibuat otomatis saat halaman Tautan Publik dibuka
        logger.error(f'[ujian] gagal menyiapkan tautan publik ujian {doc["id"]}: {e}')
    return ringkas_ujian(doc, None, hari_ini_wib(), jam_wib())


@router.put("/ujian/{ujian_id}/panitia")
async def simpan_susunan_panitia(ujian_id: str, body: PanitiaIn, request: Request, user: Dict = Depends(wajib_pengelola)):
    """Tetapkan susunan panitia SATU ujian (penanggung jawab, ketua, sekretaris, bendahara) dari akun GTK aktif.
    Perubahan hanya menyentuh baris panitia ujian ini (UTS & UAS terpisah; orang yang sama boleh menjabat di ujian
    lain), hanya untuk ujian semester konteks lihat, dan ditolak (409) bila `versi` tidak lagi sama dengan perubahan
    terakhir. Satu orang hanya satu jabatan per ujian. Panitia yang ditetapkan langsung mendapat menu kepanitiaan."""
    ujian = await ujian_semester_konteks(user, ujian_id)
    isian = body.susunan()
    if body.versi is not None:
        terkini = perubahan_terakhir(await db[KOLEKSI_PANITIA].find({'ujian_id': ujian_id}, {'_id': 0}).to_list(20))
        if (terkini or {}).get('pada', '') != body.versi:
            raise HTTPException(409, "Susunan panitia ujian ini sudah diubah pengguna lain. Muat ulang lalu periksa kembali sebelum menyimpan.")
    galat = galat_susunan_panitia(isian)
    if galat:
        raise HTTPException(400, '; '.join(f'{LABEL_JABATAN[j]}: {p}' for j, p in galat.items()))
    ids = [v for v in isian.values() if v]
    akun = {u['id']: u for u in await db.users.find({'id': {'$in': ids}}, PROYEKSI_PEJABAT).to_list(10)} if ids else {}
    tidak_sah = [LABEL_JABATAN[j] for j in JABATAN_PANITIA if isian.get(j) and not akun_gtk_sah(akun.get(isian[j]))]
    if tidak_sah:
        raise HTTPException(400, f"Pejabat harus akun GTK aktif: periksa {', '.join(tidak_sah)}")
    hasil = await terapkan_susunan_panitia(db, ujian_id, isian, {i: identitas_pejabat(u) for i, u in akun.items()}, user)
    if hasil['berubah']:
        await log_audit(user, 'ujian_panitia_ubah', KOLEKSI_PANITIA, ujian_id, {
            'ujian': ujian.get('nama'),
            'perubahan': {j: {'dari': hasil['sebelum'][j], 'ke': isian.get(j)} for j in hasil['berubah']},
        }, request=request)
    docs = await db[KOLEKSI_PANITIA].find({'ujian_id': ujian_id}, {'_id': 0}).to_list(20)
    return {'ujian_id': ujian_id, 'panitia': susunan_dari_dokumen(docs), 'diubah': perubahan_terakhir(docs)}


# Sengaja tiga segmen (/ujian/{id}/detail), bukan /ujian/{id}: rute GET statis dua segmen modul ujian di router lain
# (mis. /ujian/pengawas) tidak akan tertangkap sebagai ujian_id apa pun urutan pendaftaran routernya.
@router.get("/ujian/{ujian_id}/detail")
async def detail_ujian(ujian_id: str, user: Dict = Depends(get_current_user)):
    """Rincian satu ujian beserta menu yang boleh dibuka pengguna PADA ujian ini (menurut jabatannya di ujian itu).
    403 bila pengguna tidak berhak atas menu mana pun pada ujian ini."""
    ujian = await db[KOLEKSI_UJIAN].find_one({'id': ujian_id}, {'_id': 0})
    if not ujian:
        raise HTTPException(404, "Ujian tidak ditemukan")
    pengelola, pimpinan = adalah_pengelola(user), adalah_pimpinan(user)
    jabatan = (await jabatan_pengguna(db, user.get('id'), [ujian_id])).get(ujian_id) if mungkin_panitia(user) else None
    menu = [{'key': k, 'label': label, 'to': to, 'akses': boleh_akses_ujian(pengelola, pimpinan, jabatan, k)}
            for k, label, to, _ket in MENU_UJIAN]
    if not any(m['akses'] for m in menu):
        raise HTTPException(403, PESAN_BUKAN_PANITIA)
    hasil = await ringkas_daftar_ujian(db, [ujian], {ujian_id: jabatan} if jabatan else {}, hari_ini_wib(), jam_wib())
    return {'ujian': hasil[0], 'akses': {'pengelola': pengelola, 'pimpinan': pimpinan, 'jabatan': jabatan}, 'menu': menu}
