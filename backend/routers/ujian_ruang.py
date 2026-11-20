"""API Ujian Madrasah — Ruang & Peserta: ruang ujian (1–2 jenjang), penempatan siswa, nomor peserta, dan jejak audit.

Skema & aturan ada di ujian_ruang.py. Membaca: admin, ketua & sekretaris panitia ujian itu (menu 'ruang'). Mengubah:
hanya admin, hanya untuk ujian semester konteks lihat, dan setiap perubahan tercatat di `ujian_jejak` + audit_logs.
"""
from collections import Counter, defaultdict
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pymongo.errors import DuplicateKeyError

from core import db, get_current_user, log_audit
from routers.ujian import akses_ujian, ujian_semester_konteks, wajib_pengelola
from ujian_peserta_xlsx import GalatBerkas, baca_template_peserta, buat_template_peserta, nama_berkas_template, rencana_impor
from ujian import KOLEKSI_PESERTA, KOLEKSI_RUANG, hari_ini_wib, jam_wib, ringkas_daftar_ujian, sekarang_wib
from ujian_ruang import (
    KOLEKSI_JEJAK, NomorIn, PesertaTambahIn, PindahIn, RuangIn, alasan_tolak_penempatan, alasan_tolak_pindah, catat_jejak,
    dokumen_peserta, dokumen_ruang_baru, galat_format_nomor, kunci_nomor, jenjang_terlepas, kunci_nama, kunci_urut_peserta, pindahkan_peserta, ringkas_jejak,
    kesiapan_plotting, peserta_ruang_ujian, rencana_nomor, ringkas_peserta, ringkas_ruang, terapkan_nomor, urut_nama_ruang,
)
router = APIRouter()


async def per_jenjang_ruang(ujian_id: str) -> Dict[str, Counter]:
    """{ruang_id: Counter({jenjang: jumlah})} peserta satu ujian."""
    hasil: Dict[str, Counter] = defaultdict(Counter)
    for p in await db[KOLEKSI_PESERTA].find({'ujian_id': ujian_id}, {'_id': 0, 'ruang_id': 1, 'jenjang': 1}).to_list(20000):
        hasil[p.get('ruang_id')][p.get('jenjang')] += 1
    return hasil


async def siswa_semester(semester_id: str) -> List[Dict[str, Any]]:
    """Siswa aktif pada rombel semester ujian: [{ id, full_name, nis, nisn, nomor_peserta_ujian, kelas, kelas_id, jenjang }]."""
    kelas = {c['id']: c for c in await db.classes.find({'semester_id': semester_id}, {'_id': 0, 'id': 1, 'name': 1, 'grade': 1}).to_list(1000)}
    if not kelas:
        return []
    siswa = await db.users.find(
        {'roles': 'siswa', 'student_class_id': {'$in': list(kelas)}, 'is_active': {'$ne': False}},
        {'_id': 0, 'id': 1, 'full_name': 1, 'nis': 1, 'nisn': 1, 'nomor_peserta_ujian': 1, 'student_class_id': 1},
    ).to_list(20000)
    return [{**s, 'kelas': kelas[s['student_class_id']].get('name'), 'kelas_id': s['student_class_id'],
             'jenjang': kelas[s['student_class_id']].get('grade')} for s in siswa]


async def _ruang_ujian(ujian_id: str, ruang_id: str) -> Dict[str, Any]:
    r = await db[KOLEKSI_RUANG].find_one({'id': ruang_id, 'ujian_id': ujian_id}, {'_id': 0})
    if not r:
        raise HTTPException(404, "Ruang tidak ditemukan pada ujian ini")
    return r


async def _nama_unik(ujian_id: str, nama: str, kecuali: str = None):
    q = {'ujian_id': ujian_id, 'nama_kunci': kunci_nama(nama)}
    if kecuali:
        q['id'] = {'$ne': kecuali}
    if await db[KOLEKSI_RUANG].find_one(q, {'_id': 0, 'id': 1}):
        raise HTTPException(409, f"Ruang {nama} sudah ada pada ujian ini")


@router.get("/ujian/{ujian_id}/ruang")
async def daftar_ruang(ujian_id: str, user: Dict = Depends(get_current_user)):
    """Ruang ujian satu ujian (urut nama alami) beserta keterisian per jenjang, ringkasan, dan info plotting."""
    a = await akses_ujian(user, ujian_id, 'ruang')
    ujian = a['ujian']
    docs = await db[KOLEKSI_RUANG].find({'ujian_id': ujian_id}, {'_id': 0}).to_list(500)
    per = await per_jenjang_ruang(ujian_id)
    items = sorted((ringkas_ruang(d, per.get(d['id'])) for d in docs), key=lambda r: urut_nama_ruang(r['nama_ruang']))
    per_jenjang: Counter = Counter()
    for c in per.values():
        per_jenjang.update(c)
    ditempatkan = sum(per_jenjang.values())
    jenjang_ujian = {j for d in docs for j in d.get('jenjang', [])}
    calon = [s for s in await siswa_semester(ujian.get('semester_id')) if not jenjang_ujian or s['jenjang'] in jenjang_ujian]
    peserta_semua = await db[KOLEKSI_PESERTA].find({'ujian_id': ujian_id}, {'_id': 0, 'siswa_id': 1, 'ruang_id': 1, 'nomor_peserta': 1}).to_list(20000)
    sudah = {p['siswa_id'] for p in peserta_semua}
    jejak = await db[KOLEKSI_JEJAK].find({'ujian_id': ujian_id}, {'_id': 0, 'waktu': 1, 'oleh_nama': 1}).sort('waktu', 1).to_list(5000)
    belum = sum(1 for s in calon if s['id'] not in sudah)
    hasil_ujian = (await ringkas_daftar_ujian(db, [ujian], {ujian_id: a['jabatan']} if a['jabatan'] else {}, hari_ini_wib(), jam_wib()))[0]
    return {
        'ujian': hasil_ujian,
        'boleh_ubah': a['pengelola'],
        'items': items,
        'ringkasan': {
            'jumlah_ruang': len(items),
            'jumlah_peserta': ditempatkan,
            'kapasitas': sum(r['kapasitas'] for r in items),
            'belum_ditempatkan': belum,
            'per_jenjang': {str(j): n for j, n in sorted(per_jenjang.items()) if j is not None},
        },
        'kesiapan': kesiapan_plotting(docs, peserta_semua, belum),
        'plotting': {
            'ditetapkan_pada': jejak[0]['waktu'] if jejak else None,
            'diubah_pada': jejak[-1]['waktu'] if jejak else None,
            'diubah_oleh_nama': jejak[-1].get('oleh_nama') if jejak else None,
            'jumlah_perubahan': len(jejak),
            'berlaku': 'seluruh_masa_ujian',
        },
    }


@router.get("/ujian/{ujian_id}/ruang/riwayat")
async def riwayat_ruang(ujian_id: str, user: Dict = Depends(get_current_user)):
    """Jejak audit ruang & peserta satu ujian, terbaru dulu."""
    await akses_ujian(user, ujian_id, 'ruang')
    docs = await db[KOLEKSI_JEJAK].find({'ujian_id': ujian_id}, {'_id': 0}).sort('waktu', -1).to_list(1000)
    return {'items': [ringkas_jejak(d) for d in docs]}


@router.post("/ujian/{ujian_id}/ruang")
async def tambah_ruang(ujian_id: str, body: RuangIn, request: Request, user: Dict = Depends(wajib_pengelola)):
    """Tambah ruang ujian (admin). Satu ruang boleh memuat dua jenjang berbeda; nama unik per ujian."""
    await ujian_semester_konteks(user, ujian_id)
    await _nama_unik(ujian_id, body.nama_ruang)
    doc = dokumen_ruang_baru(ujian_id, body, user)
    await db[KOLEKSI_RUANG].insert_one(dict(doc))
    await catat_jejak(db, ujian_id, 'ruang_tambah', user, f"Ruang {doc['nama_ruang']} (kelas {' + '.join(map(str, doc['jenjang']))}) ditambahkan",
                      detail={'ruang_id': doc['id']})
    await log_audit(user, 'ujian_ruang_tambah', KOLEKSI_RUANG, doc['id'], {'ujian_id': ujian_id, 'nama': doc['nama_ruang']}, request=request)
    return ringkas_ruang(doc)


@router.put("/ujian/{ujian_id}/ruang/{ruang_id}")
async def ubah_ruang(ujian_id: str, ruang_id: str, body: RuangIn, request: Request, user: Dict = Depends(wajib_pengelola)):
    """Ubah ruang (admin). Jenjang yang masih berisi peserta tidak boleh dilepas; kapasitas tidak boleh di bawah
    jumlah peserta yang sudah ditempatkan."""
    await ujian_semester_konteks(user, ujian_id)
    lama = await _ruang_ujian(ujian_id, ruang_id)
    await _nama_unik(ujian_id, body.nama_ruang, kecuali=ruang_id)
    per = (await per_jenjang_ruang(ujian_id)).get(ruang_id, Counter())
    lepas = jenjang_terlepas(lama.get('jenjang', []), body.jenjang, per)
    if lepas:
        raise HTTPException(409, f"Kelas {', '.join(map(str, lepas))} masih berisi peserta di ruang ini; pindahkan pesertanya dahulu")
    if body.kapasitas < sum(per.values()):
        raise HTTPException(409, f"Kapasitas tidak boleh kurang dari jumlah peserta ruang ini ({sum(per.values())})")
    ubah = {'nama_ruang': body.nama_ruang, 'nama_kunci': kunci_nama(body.nama_ruang), 'jenjang': body.jenjang,
            'kapasitas': body.kapasitas, 'keterangan': body.keterangan, 'diperbarui_pada': sekarang_wib().isoformat()}
    await db[KOLEKSI_RUANG].update_one({'id': ruang_id}, {'$set': ubah})
    berubah = {k: {'dari': lama.get(k), 'ke': ubah[k]} for k in ('nama_ruang', 'jenjang', 'kapasitas', 'keterangan') if lama.get(k) != ubah[k]}
    if berubah:
        await catat_jejak(db, ujian_id, 'ruang_ubah', user, f"Ruang {lama.get('nama_ruang')} diubah: {', '.join(berubah)}",
                          detail={'ruang_id': ruang_id, 'perubahan': berubah})
        await log_audit(user, 'ujian_ruang_ubah', KOLEKSI_RUANG, ruang_id, {'ujian_id': ujian_id, 'perubahan': berubah}, request=request)
    return ringkas_ruang({**lama, **ubah}, per)


@router.delete("/ujian/{ujian_id}/ruang/{ruang_id}")
async def hapus_ruang(ujian_id: str, ruang_id: str, request: Request, user: Dict = Depends(wajib_pengelola)):
    """Hapus ruang kosong (admin). Ruang yang masih berisi peserta ditolak (409)."""
    await ujian_semester_konteks(user, ujian_id)
    r = await _ruang_ujian(ujian_id, ruang_id)
    n = await db[KOLEKSI_PESERTA].count_documents({'ruang_id': ruang_id})
    if n:
        raise HTTPException(409, f"Ruang {r.get('nama_ruang')} masih berisi {n} peserta; kosongkan dahulu")
    await db[KOLEKSI_RUANG].delete_one({'id': ruang_id})
    await catat_jejak(db, ujian_id, 'ruang_hapus', user, f"Ruang {r.get('nama_ruang')} dihapus", detail={'ruang_id': ruang_id})
    await log_audit(user, 'ujian_ruang_hapus', KOLEKSI_RUANG, ruang_id, {'ujian_id': ujian_id, 'nama': r.get('nama_ruang')}, request=request)
    return {'ok': True}


# ---- Peserta per ruang ----
@router.get("/ujian/{ujian_id}/ruang/{ruang_id}/peserta")
async def peserta_ruang(ujian_id: str, ruang_id: str, user: Dict = Depends(get_current_user)):
    """Peserta satu ruang (urut nomor peserta, lalu kelas & nama). Admin juga menerima `nomor_lain` — nomor peserta
    ruang lain pada ujian ini — untuk validasi nomor ganda langsung di klien."""
    a = await akses_ujian(user, ujian_id, 'ruang')
    ruang = await _ruang_ujian(ujian_id, ruang_id)
    items = await peserta_ruang_ujian(db, ujian_id, ruang_id)
    per = Counter(p.get('jenjang') for p in items)
    hasil = {'ruang': ringkas_ruang(ruang, per), 'boleh_ubah': a['pengelola'], 'items': items}
    if a['pengelola']:
        lain = await db[KOLEKSI_PESERTA].find({'ujian_id': ujian_id, 'ruang_id': {'$ne': ruang_id}}, {'_id': 0, 'nomor_kunci': 1, 'nama': 1}).to_list(20000)
        hasil['nomor_lain'] = {p['nomor_kunci']: p.get('nama') for p in lain if p.get('nomor_kunci')}
    return hasil


@router.get("/ujian/{ujian_id}/kandidat")
async def kandidat_peserta(ujian_id: str, kelas_id: str = '', user: Dict = Depends(get_current_user)):
    """Rombel semester ujian (jumlah siswa) dan, bila kelas_id diisi, siswanya beserta ruang tempat ia sudah
    ditempatkan pada ujian ini (siswa yang sudah ditempatkan tidak dapat dipilih lagi)."""
    a = await akses_ujian(user, ujian_id, 'ruang')
    siswa = await siswa_semester(a['ujian'].get('semester_id'))
    kelas: Dict[str, Dict[str, Any]] = {}
    for s in siswa:
        k = kelas.setdefault(s['kelas_id'], {'id': s['kelas_id'], 'nama': s['kelas'], 'jenjang': s['jenjang'], 'jumlah_siswa': 0})
        k['jumlah_siswa'] += 1
    items = []
    if kelas_id:
        tempat = {p['siswa_id']: p['ruang_id'] for p in await db[KOLEKSI_PESERTA].find(
            {'ujian_id': ujian_id}, {'_id': 0, 'siswa_id': 1, 'ruang_id': 1}).to_list(20000)}
        nama_ruang = {r['id']: r['nama_ruang'] for r in await db[KOLEKSI_RUANG].find(
            {'ujian_id': ujian_id}, {'_id': 0, 'id': 1, 'nama_ruang': 1}).to_list(500)}
        items = sorted(({
            'siswa_id': s['id'], 'nama': s.get('full_name'), 'nis': s.get('nis') or '', 'nisn': s.get('nisn') or '',
            'kelas': s['kelas'], 'kelas_id': s['kelas_id'], 'jenjang': s['jenjang'],
            'nomor_peserta_um': s.get('nomor_peserta_ujian') or '',
            'ruang_id': tempat.get(s['id']), 'ruang_nama': nama_ruang.get(tempat.get(s['id'])),
        } for s in siswa if s['kelas_id'] == kelas_id), key=lambda x: (x['nama'] or '').lower())
    daftar_kelas = sorted(kelas.values(), key=lambda k: (k['jenjang'] or 0, urut_nama_ruang(k['nama'] or '')))
    return {'kelas': daftar_kelas, 'items': items}


@router.post("/ujian/{ujian_id}/ruang/{ruang_id}/peserta")
async def tempatkan_peserta(ujian_id: str, ruang_id: str, body: PesertaTambahIn, request: Request,
                            user: Dict = Depends(wajib_pengelola)):
    """Tempatkan siswa dari data induk ke ruang (admin). Per siswa: harus siswa rombel semester ujian, jenjangnya
    jenjang ruang, belum di ruang lain pada ujian yang sama, dan masih ada kursi. Penempatan berlaku untuk seluruh
    hari/sesi ujian. -> { ditambahkan, dilewati: [{ siswa_id, nama, alasan }] }"""
    ujian = await ujian_semester_konteks(user, ujian_id)
    ruang = await _ruang_ujian(ujian_id, ruang_id)
    siswa = {s['id']: s for s in await siswa_semester(ujian.get('semester_id'))}
    tempat = {p['siswa_id']: p['ruang_id'] for p in await db[KOLEKSI_PESERTA].find(
        {'ujian_id': ujian_id}, {'_id': 0, 'siswa_id': 1, 'ruang_id': 1}).to_list(20000)}
    sisa = ruang.get('kapasitas', 0) - sum(1 for r in tempat.values() if r == ruang_id)
    ditambahkan, dilewati = [], []
    for sid in dict.fromkeys(body.siswa_ids):
        s = siswa.get(sid)
        alasan = alasan_tolak_penempatan(s, ruang, tempat.get(sid), sisa)
        if alasan:
            dilewati.append({'siswa_id': sid, 'nama': (s or {}).get('full_name') or sid, 'alasan': alasan})
            continue
        doc = dokumen_peserta(ujian_id, ruang_id, s, user)
        try:
            await db[KOLEKSI_PESERTA].insert_one(dict(doc))
        except DuplicateKeyError:  # ditempatkan admin lain bersamaan: index unik (ujian_id, siswa_id) menolak duplikat
            dilewati.append({'siswa_id': sid, 'nama': s.get('full_name') or sid, 'alasan': 'Sudah terdaftar di ruang lain pada ujian ini'})
            continue
        tempat[sid] = ruang_id
        sisa -= 1
        ditambahkan.append(doc)
    if ditambahkan:
        await catat_jejak(db, ujian_id, 'peserta_tambah', user, f"Ruang {ruang['nama_ruang']}: {len(ditambahkan)} siswa ditempatkan",
                          detail={'ruang_id': ruang_id, 'siswa_ids': [d['siswa_id'] for d in ditambahkan]})
        await log_audit(user, 'ujian_peserta_tambah', KOLEKSI_PESERTA, ruang_id,
                        {'ujian_id': ujian_id, 'jumlah': len(ditambahkan)}, request=request)
    return {'ditambahkan': len(ditambahkan), 'dilewati': dilewati}


@router.delete("/ujian/{ujian_id}/ruang/{ruang_id}/peserta/{peserta_id}")
async def keluarkan_peserta(ujian_id: str, ruang_id: str, peserta_id: str, request: Request, user: Dict = Depends(wajib_pengelola)):
    """Keluarkan peserta dari ruang (admin); nomor pesertanya ikut dilepas. Tercatat di jejak audit."""
    await ujian_semester_konteks(user, ujian_id)
    ruang = await _ruang_ujian(ujian_id, ruang_id)
    p = await db[KOLEKSI_PESERTA].find_one({'id': peserta_id, 'ruang_id': ruang_id}, {'_id': 0})
    if not p:
        raise HTTPException(404, "Peserta tidak ditemukan di ruang ini")
    await db[KOLEKSI_PESERTA].delete_one({'id': peserta_id})
    await catat_jejak(db, ujian_id, 'peserta_hapus', user, f"{p.get('nama')} ({p.get('kelas')}) dikeluarkan dari Ruang {ruang['nama_ruang']}",
                      detail={'ruang_id': ruang_id, 'siswa_id': p.get('siswa_id'), 'nomor_peserta': p.get('nomor_peserta')})
    await log_audit(user, 'ujian_peserta_hapus', KOLEKSI_PESERTA, peserta_id, {'ujian_id': ujian_id, 'siswa_id': p.get('siswa_id')}, request=request)
    return {'ok': True}


@router.patch("/ujian/{ujian_id}/peserta/{peserta_id}/pindah")
async def pindah_ruang_peserta(ujian_id: str, peserta_id: str, body: PindahIn, request: Request, user: Dict = Depends(wajib_pengelola)):
    """Pindahkan peserta ke ruang lain (admin; alasan wajib). Baris peserta yang sama diubah — tidak pernah digandakan —
    sehingga satu siswa tetap satu ruang per ujian; nomor peserta ikut pindah. Ruang tujuan harus memuat jenjang siswa
    dan masih ada kursi."""
    await ujian_semester_konteks(user, ujian_id)
    p = await db[KOLEKSI_PESERTA].find_one({'id': peserta_id, 'ujian_id': ujian_id}, {'_id': 0})
    if not p:
        raise HTTPException(404, "Peserta tidak ditemukan pada ujian ini")
    tujuan = await _ruang_ujian(ujian_id, body.ruang_id)
    asal = await _ruang_ujian(ujian_id, p['ruang_id'])
    alasan = alasan_tolak_pindah(p, tujuan, await db[KOLEKSI_PESERTA].count_documents({'ruang_id': tujuan['id']}))
    if alasan:
        raise HTTPException(400 if 'sama dengan' in alasan else 409, alasan)
    hasil = await pindahkan_peserta(db, p, asal, tujuan, user, body.alasan)
    if not hasil:
        raise HTTPException(409, "Peserta sudah dipindah pengguna lain. Muat ulang lalu periksa kembali.")
    await log_audit(user, 'ujian_peserta_pindah', KOLEKSI_PESERTA, peserta_id,
                    {'ujian_id': ujian_id, 'dari': asal['id'], 'ke': tujuan['id'], 'alasan': body.alasan}, request=request)
    return ringkas_peserta(hasil)


@router.put("/ujian/{ujian_id}/ruang/{ruang_id}/nomor-peserta")
async def simpan_nomor_peserta(ujian_id: str, ruang_id: str, body: NomorIn, request: Request, user: Dict = Depends(wajib_pengelola)):
    """Simpan nomor peserta untuk peserta satu ruang (admin). Nomor unik per ujian (tanpa beda huruf besar/kecil),
    format huruf/angka/titik/garis miring/minus maks 30; '' mengosongkan. Baris bermasalah dilewati beserta pesannya,
    baris lain tetap tersimpan. -> { disimpan, galat: [{ peserta_id, nama, pesan }] }"""
    await ujian_semester_konteks(user, ujian_id)
    ruang = await _ruang_ujian(ujian_id, ruang_id)
    semua = await db[KOLEKSI_PESERTA].find({'ujian_id': ujian_id}, {'_id': 0}).to_list(20000)
    perubahan, galat = rencana_nomor(semua, ruang_id, [i.model_dump() for i in body.items])
    gagal = await terapkan_nomor(db, perubahan)
    per_id = {p['id']: p for p in semua}
    for pid in gagal:
        galat.append({'peserta_id': pid, 'nama': per_id[pid].get('nama'), 'pesan': 'Nomor baru saja dipakai peserta lain; muat ulang lalu coba lagi'})
        # pulihkan nomor lama yang sempat dikosongkan
        await db[KOLEKSI_PESERTA].update_one({'id': pid}, {'$set': {'nomor_kunci': per_id[pid].get('nomor_kunci')}})
    disimpan = len(perubahan) - len(gagal)
    if disimpan:
        await catat_jejak(db, ujian_id, 'nomor_ubah', user, f"Ruang {ruang['nama_ruang']}: {disimpan} nomor peserta diubah",
                          detail={'ruang_id': ruang_id, 'perubahan': {pid: n for pid, n in perubahan.items() if pid not in gagal}})
        await log_audit(user, 'ujian_nomor_peserta', KOLEKSI_PESERTA, ruang_id, {'ujian_id': ujian_id, 'jumlah': disimpan}, request=request)
    return {'disimpan': disimpan, 'galat': galat}


MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'


@router.get("/ujian/{ujian_id}/ruang/{ruang_id}/template-peserta")
async def unduh_template_peserta(ujian_id: str, ruang_id: str, user: Dict = Depends(wajib_pengelola)):
    """Template nomor peserta (.xlsx) SATU ruang (admin): hanya siswa yang sudah dibagi ke ruang ini, beserta nomor
    peserta yang ada dan Nomor Peserta UM dari data siswa sebagai acuan. Diimpor kembali lewat impor-peserta."""
    ujian = await db['ujian'].find_one({'id': ujian_id}, {'_id': 0})
    if not ujian:
        raise HTTPException(404, "Ujian tidak ditemukan")
    ruang = await _ruang_ujian(ujian_id, ruang_id)
    isi = buat_template_peserta(ujian, ruang, await peserta_ruang_ujian(db, ujian_id, ruang_id))
    return Response(isi, media_type=MIME_XLSX,
                    headers={'Content-Disposition': f'attachment; filename="{nama_berkas_template(ujian, ruang)}"'})


MAKS_BERKAS_IMPOR = 5 * 1024 * 1024


@router.post("/ujian/{ujian_id}/ruang/{ruang_id}/impor-peserta")
async def impor_template_peserta(ujian_id: str, ruang_id: str, request: Request, berkas: UploadFile = File(...),
                                 user: Dict = Depends(wajib_pengelola)):
    """Impor template nomor peserta SATU ruang (.xlsx, maks 5 MB; admin). Validasi per baris: siswa ada di data induk,
    jenjang sesuai ruang, belum terdaftar di ruang lain pada ujian yang sama, No. Peserta sah & tidak ganda. Siswa yang
    belum di ruang ini ikut ditempatkan (sumber impor_template). -> { total, tersimpan, dilewati: [{ baris, siswa_id,
    nama, alasan }] }"""
    ujian = await ujian_semester_konteks(user, ujian_id)
    ruang = await _ruang_ujian(ujian_id, ruang_id)
    if not (berkas.filename or '').lower().endswith('.xlsx'):
        raise HTTPException(400, "Berkas harus berformat Excel .xlsx (template dari aplikasi)")
    isi = await berkas.read(MAKS_BERKAS_IMPOR + 1)
    if not isi:
        raise HTTPException(400, "Berkas kosong")
    if len(isi) > MAKS_BERKAS_IMPOR:
        raise HTTPException(413, "Ukuran berkas maksimal 5 MB")
    try:
        baris = baca_template_peserta(isi, ujian_id, ruang_id)
    except GalatBerkas as e:
        raise HTTPException(400, str(e)) from e
    siswa = {s['id']: s for s in await siswa_semester(ujian.get('semester_id'))}
    semua = await db[KOLEKSI_PESERTA].find({'ujian_id': ujian_id}, {'_id': 0}).to_list(20000)
    diterima, dilewati = rencana_impor(baris, ruang, siswa, semua, galat_format_nomor)
    # Nomor lama baris yang diganti dikosongkan dulu agar tukar nomor dalam satu berkas tidak bentrok index unik.
    for d in diterima:
        if d['peserta'] and kunci_nomor(d['peserta'].get('nomor_peserta')) != kunci_nomor(d['nomor']):
            await db[KOLEKSI_PESERTA].update_one({'id': d['peserta']['id']}, {'$set': {'nomor_kunci': None}})
    t = sekarang_wib().isoformat()
    tersimpan, baru = 0, 0
    for d in diterima:
        try:
            if d['peserta']:
                await db[KOLEKSI_PESERTA].update_one({'id': d['peserta']['id']}, {'$set': {
                    'nomor_peserta': d['nomor'], 'nomor_kunci': kunci_nomor(d['nomor']), 'sumber': 'impor_template', 'diperbarui_pada': t}})
            else:
                await db[KOLEKSI_PESERTA].insert_one(dokumen_peserta(ujian_id, ruang_id, d['siswa'], user, 'impor_template', d['nomor']))
                baru += 1
            tersimpan += 1
        except DuplicateKeyError:
            dilewati.append({'baris': d['baris'], 'siswa_id': d['siswa']['id'], 'nama': d['siswa'].get('full_name'),
                             'alasan': 'Bentrok dengan perubahan bersamaan (nomor/siswa sudah dipakai); impor ulang baris ini'})
            if d['peserta']:
                await db[KOLEKSI_PESERTA].update_one({'id': d['peserta']['id']}, {'$set': {'nomor_kunci': d['peserta'].get('nomor_kunci')}})
    dilewati.sort(key=lambda x: x['baris'])
    if tersimpan:
        await catat_jejak(db, ujian_id, 'impor_template', user,
                          f"Ruang {ruang['nama_ruang']}: {tersimpan} tersimpan ({baru} siswa baru), {len(dilewati)} dilewati",
                          detail={'ruang_id': ruang_id, 'berkas': berkas.filename, 'dilewati': len(dilewati)})
        await log_audit(user, 'ujian_impor_peserta', KOLEKSI_PESERTA, ruang_id,
                        {'ujian_id': ujian_id, 'tersimpan': tersimpan, 'dilewati': len(dilewati), 'berkas': berkas.filename}, request=request)
    return {'total': len(baris), 'tersimpan': tersimpan, 'dilewati': dilewati}
