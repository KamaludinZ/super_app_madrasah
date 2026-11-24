"""Pengelolaan Tautan Publik ujian (ber-login): tiga tautan ber-token acak per ujian — info ujian (siswa), monitoring
pengumpulan (panitia/guru), dan portal ujian (siswa saat jam ujian). Masing-masing punya sakelar buka/tutup, jendela
waktu, dan token sendiri; mengubah satu tautan tidak pernah menyentuh yang lain. Status tautan portal dihitung dengan
jendela efektifnya (batas kosong = masa ujian; ujian_portal.ringkas_tautan_portal), sama dengan yang diperiksa rute
publik portal. Kontrak sama dengan frontend/src/lib/ujianTautanPublik.js.

Akses menu `tautan_publik`: admin (pengelola) melihat & mengubah; kepala madrasah, waka kurikulum, serta ketua &
sekretaris panitia ujian itu melihat (boleh_ubah = false). Tautan yang belum ada dibuat otomatis dalam keadaan ditutup
(inisialisasi_tautan) saat daftar dibuka.
"""
from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response

from core import db, get_current_user, log_audit
from routers.ujian import akses_ujian
from ujian import PERAN_BUKAN_PANITIA, sekarang_wib
from ujian_info import (
    JENIS_TAUTAN, KOLEKSI_AKSES_LOG, KOLEKSI_TAUTAN, KOLEKSI_TAUTAN_RIWAYAT, galat_saringan_audit, kueri_saringan_audit, UbahTautanIn, baca_waktu, catat_riwayat_tautan, ganti_token, inisialisasi_tautan,
    peringatan_jendela, ringkas_tautan, terapkan_ubah_tautan,
)
from ujian_portal import ringkas_tautan_portal

router = APIRouter()

RIWAYAT_DETAIL_MAKS = 30


def _ringkas_ujian(u: Dict) -> Dict:
    return {k: u.get(k) for k in ('id', 'nama', 'jenis', 'mulai', 'selesai', 'tahun_pelajaran')}


def _jenis_sah(jenis: str) -> str:
    if jenis not in JENIS_TAUTAN:
        raise HTTPException(404, "Jenis tautan tidak dikenal (info, monitoring, atau portal).")
    return jenis


def _ringkas(t: Dict, ujian: Optional[Dict], kini) -> Optional[Dict]:
    """Ringkasan tautan untuk admin; tautan portal memakai jendela efektif (masa ujian) agar statusnya sama dengan rute publik."""
    return ringkas_tautan_portal(t, ujian, kini) if (t or {}).get('jenis') == 'portal' else ringkas_tautan(t, kini)


@router.get("/ujian/{ujian_id}/tautan-publik")
async def daftar_tautan_publik(ujian_id: str, user: Dict = Depends(get_current_user)):
    """Tiga tautan publik satu ujian beserta status berlaku saat ini:
    { ujian, boleh_ubah, tautan: { info, monitoring, portal } }."""
    a = await akses_ujian(user, ujian_id, 'tautan_publik')
    tautan = await inisialisasi_tautan(db, ujian_id, user)
    kini = sekarang_wib()
    return {'ujian': _ringkas_ujian(a['ujian']), 'boleh_ubah': a['pengelola'],
            'tautan': {j: _ringkas(tautan[j], a['ujian'], kini) for j in JENIS_TAUTAN}}


FIELD_AKSES_AUDIT = {'_id': 0, 'id': 1, 'jenis_tautan': 1, 'waktu': 1, 'ip': 1, 'ip_rantai': 1, 'perangkat': 1, 'hasil': 1, 'sesi': 1,
                     'terakhir_aktif': 1, 'jumlah_segarkan': 1}  # token (termasuk tebakan salah) tidak pernah dikirim
FIELD_PERUBAHAN_AUDIT = {'_id': 0, 'id': 1, 'waktu': 1, 'jenis': 1, 'aksi': 1, 'oleh_nama': 1, 'detail': 1}
PERUBAHAN_AUDIT_MAKS = 30


@router.get("/ujian/{ujian_id}/tautan-publik/audit")
async def jejak_audit_tautan_publik(ujian_id: str, jenis: Optional[str] = Query(None), hasil: Optional[str] = Query(None),
                                    dari: Optional[str] = Query(None, max_length=10), sampai: Optional[str] = Query(None, max_length=10),
                                    cari: Optional[str] = Query(None, max_length=100), batas: int = Query(50, ge=1, le=200),
                                    response: Response = None, user: Dict = Depends(get_current_user)):
    """Jejak audit tautan publik satu ujian (admin & pemantau menu tautan_publik):
    { ringkasan: { total, ok, ditolak, kartu_soal_ditolak }  (seluruh akses ujian ini, tanpa saringan),
      akses: [...] terbaru dulu (saringan ?jenis=info|monitoring, ?hasil=ok|ditolak, ?dari=&sampai= YYYY-MM-DD WIB,
             ?cari= potongan IP/perangkat; maks `batas`),
      perubahan: [...] riwayat pengaturan tautan terbaru (saringan jenis) }.
    Percobaan dengan token tak dikenal tidak terkait ujian mana pun sehingga tidak tampil di sini."""
    if jenis and jenis not in JENIS_TAUTAN:
        raise HTTPException(422, "Saringan jenis harus info atau monitoring.")
    if hasil and hasil not in ('ok', 'ditolak'):
        raise HTTPException(422, "Saringan hasil harus ok atau ditolak.")
    pesan = galat_saringan_audit(dari, sampai, cari)
    if pesan:
        raise HTTPException(422, pesan)
    await akses_ujian(user, ujian_id, 'tautan_publik')
    log = db[KOLEKSI_AKSES_LOG]
    ringkasan = {
        'total': await log.count_documents({'ujian_id': ujian_id}),
        'ok': await log.count_documents({'ujian_id': ujian_id, 'hasil': 'ok'}),
        'ditolak': await log.count_documents({'ujian_id': ujian_id, 'hasil': {'$ne': 'ok'}}),
        'kartu_soal_ditolak': await log.count_documents({'ujian_id': ujian_id, 'hasil': 'kartu_soal_ditolak'}),
    }
    q = {**kueri_saringan_audit(ujian_id, dari, sampai, cari), **({'jenis_tautan': jenis} if jenis else {})}
    if hasil == 'ok':
        q['hasil'] = 'ok'
    elif hasil == 'ditolak':
        q['hasil'] = {'$ne': 'ok'}
    akses = [{k: d.get(k) for k in FIELD_AKSES_AUDIT if k != '_id'}  # whitelist eksplisit (bukan hanya proyeksi)
             for d in (await log.find(q, FIELD_AKSES_AUDIT).sort('waktu', -1).to_list(batas))[:batas]]
    qp = {'ujian_id': ujian_id, **({'jenis': jenis} if jenis else {})}
    perubahan = [{k: d.get(k) for k in FIELD_PERUBAHAN_AUDIT if k != '_id'}
                 for d in (await db[KOLEKSI_TAUTAN_RIWAYAT].find(qp, FIELD_PERUBAHAN_AUDIT).sort('waktu', -1)
                           .to_list(PERUBAHAN_AUDIT_MAKS))[:PERUBAHAN_AUDIT_MAKS]]
    if response is not None:
        response.headers['Cache-Control'] = 'no-store'  # jejak audit sensitif: jangan disimpan cache peramban/proxy
    return {'ringkasan': ringkasan, 'akses': akses, 'perubahan': perubahan}


@router.get("/ujian/{ujian_id}/tautan-publik/{jenis}")
async def detail_tautan_publik(ujian_id: str, jenis: str, user: Dict = Depends(get_current_user)):
    """Detail satu tautan: pengaturan, status berlaku, dan riwayat perubahan terbaru (tanpa token lama)."""
    _jenis_sah(jenis)
    a = await akses_ujian(user, ujian_id, 'tautan_publik')
    t = (await inisialisasi_tautan(db, ujian_id, user))[jenis]
    riwayat = (await db[KOLEKSI_TAUTAN_RIWAYAT].find({'tautan_id': t['id']}, {'_id': 0}).sort('waktu', -1)
               .to_list(RIWAYAT_DETAIL_MAKS))[:RIWAYAT_DETAIL_MAKS]
    return {'ujian': _ringkas_ujian(a['ujian']), 'boleh_ubah': a['pengelola'], 'tautan': _ringkas(t, a['ujian'], sekarang_wib()),
            'riwayat': riwayat}


PESAN_HANYA_ADMIN = "Tautan publik hanya dapat diubah admin."


def _teks_waktu(iso) -> str:
    d = baca_waktu(iso)
    return d.strftime('%d-%m-%Y %H:%M') if d else 'tanpa batas'


def ringkas_perubahan_jendela(lama: Dict, baru: Dict) -> str:
    return f"{_teks_waktu(lama.get('mulai_at'))} s.d. {_teks_waktu(lama.get('selesai_at'))} → " \
           f"{_teks_waktu(baru.get('mulai_at'))} s.d. {_teks_waktu(baru.get('selesai_at'))}"


async def _tautan_admin(user: Dict, ujian_id: str, jenis: str):
    """Penjaga ubah (buka/tutup, jendela, ganti token): menu tautan_publik + pengelola (admin) dengan peran aktif
    bukan akun kelas/siswa (sesi kelas bersama tidak boleh mengubah tautan walau akunnya ber-peran admin)
    -> (tautan, ujian); tautan dibuat bila belum ada."""
    _jenis_sah(jenis)
    a = await akses_ujian(user, ujian_id, 'tautan_publik')
    if not a['pengelola'] or user.get('active_role') in PERAN_BUKAN_PANITIA:
        raise HTTPException(403, PESAN_HANYA_ADMIN)
    return (await inisialisasi_tautan(db, ujian_id, user))[jenis], a['ujian']


@router.put("/ujian/{ujian_id}/tautan-publik/{jenis}")
async def simpan_tautan_publik(ujian_id: str, jenis: str, body: UbahTautanIn, request: Request,
                               user: Dict = Depends(get_current_user)):
    """Buka/tutup tautan dan/atau atur jendela waktu aksesnya (admin). PARSIAL: hanya field yang dikirim yang berubah
    ({aktif} dari sakelar, {mulai_at, selesai_at} dari form; null = tanpa batas). Waktu dinormalkan ke ISO WIB; selesai
    harus setelah mulai (dicek terhadap nilai gabungan) -> 422 dengan pesan jelas. Menutup tidak menghapus tautan; token
    tidak berubah. Perubahan dicatat di riwayat tautan (buka/tutup/jendela) & audit umum.
    -> { tautan, peringatan: [{kode, pesan}] }"""
    lama, ujian = await _tautan_admin(user, ujian_id, jenis)
    try:
        baru = terapkan_ubah_tautan(lama, body)
    except ValueError as e:
        raise HTTPException(422, str(e))
    waktu = sekarang_wib().isoformat()
    await db[KOLEKSI_TAUTAN].update_one({'id': lama['id']}, {'$set': {**baru, 'diperbarui_pada': waktu}})
    t = {**lama, **baru, 'diperbarui_pada': waktu}
    if bool(lama.get('aktif')) != baru['aktif']:
        await catat_riwayat_tautan(db, t, 'buka' if baru['aktif'] else 'tutup', user, sebelum=lama, sesudah=t)
    if (lama.get('mulai_at'), lama.get('selesai_at')) != (baru['mulai_at'], baru['selesai_at']):
        await catat_riwayat_tautan(db, t, 'jendela', user, detail=ringkas_perubahan_jendela(lama, baru), sebelum=lama, sesudah=t)
    await log_audit(user, 'ujian_tautan_ubah', KOLEKSI_TAUTAN, lama['id'],
                    {'ujian_id': ujian_id, 'jenis': jenis, **baru}, request=request)
    kini = sekarang_wib()
    return {'tautan': _ringkas(t, ujian, kini), 'peringatan': peringatan_jendela(t, ujian, kini)}


@router.post("/ujian/{ujian_id}/tautan-publik/{jenis}/ganti-token")
async def ganti_token_tautan_publik(ujian_id: str, jenis: str, request: Request, user: Dict = Depends(get_current_user)):
    """Ganti token tautan (admin): tautan lama langsung tidak dikenal (404 bagi pemegangnya); buka/tutup & jendela waktu
    tetap. Dicatat di riwayat tautan & audit umum tanpa menyimpan token. -> { tautan }"""
    lama, ujian = await _tautan_admin(user, ujian_id, jenis)
    t = await ganti_token(db, lama['id'], sekarang_wib())
    await catat_riwayat_tautan(db, t, 'ganti_token', user, detail='Token lama tidak berlaku lagi', sebelum=lama, sesudah=t)
    await log_audit(user, 'ujian_tautan_ganti_token', KOLEKSI_TAUTAN, lama['id'], {'ujian_id': ujian_id, 'jenis': jenis}, request=request)
    return {'tautan': _ringkas(t, ujian, sekarang_wib())}
