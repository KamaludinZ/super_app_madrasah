"""API cetak form isian kosong PKG (PDF) untuk diisi offline oleh tim penilai, lalu diinput ke aplikasi.

Otorisasi: personil PKG pada periode yang berperan pengelola (kepala madrasah atau penilai). Form tanpa guru (identitas
diisi tangan) boleh dicetak penilai yang belum punya penugasan; bila `guru_id` / `semua_guru` diminta, guru dibatasi
cakupan peran (kepala semua guru, penilai guru yang dibagikan kepadanya) seperti cetak angket 360°. Setiap unduhan
tercatat di riwayat unduhan & jejak audit (jenis dokumen 'form').
"""
from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from core import db, get_current_user
from pkg_identitas import PROYEKSI_NIP, nip_tampil
from pkg_akses import alasan_tolak, keanggotaan_sk, tolak
from pkg_audit import catat_cetak_gagal, catat_cetak_template
from pkg_form_kosong import form_kosong_pdf
from pkg_instrumen import instrumen_aktif
from pkg_kehadiran import bulan_kehadiran, label_bulan
from pkg_rekap import anggota_periode, periode_dan_sk
from pkg_skema import KOLEKSI_INSTRUMEN, KOLEKSI_PENILAIAN, KOLEKSI_PENUGASAN, FormKosongRequest
from pkg_template import nama_berkas_cetak
from routers.pkg_angket_api import konteks_pengelola
from routers.pkg_cetak_api import respon_berkas

router = APIRouter()

VERSI_FORM = 'form-isian-1'  # tidak bersumber dari template Excel; dicatat pada riwayat unduhan sebagai versi bentuk form


async def _orang(db_, sk: Optional[Dict[str, Any]], uid: Optional[str]) -> Optional[Dict[str, Any]]:
    """Identitas {id, nama, nip, mapel, tugas_tambahan} dari snapshot SK, cadangan akun; None bila tidak diketahui."""
    if not uid:
        return None
    snap = ((sk or {}).get('snapshot_anggota') or {}).get(uid) or {}
    akun = await db_.users.find_one({'id': uid}, {'_id': 0, 'full_name': 1, **PROYEKSI_NIP, 'tugas_tambahan': 1}) or {}
    if not snap and not akun:
        return None
    return {'id': uid, 'nama': snap.get('nama') or akun.get('full_name'), 'nip': nip_tampil(snap.get('nip'), akun),
            'mapel': snap.get('mapel'), 'tugas_tambahan': akun.get('tugas_tambahan')}


async def _penilai_id(db_, periode: Dict[str, Any], sk: Optional[Dict[str, Any]], user: Dict[str, Any], cakupan: Dict[str, Any],
                      guru_id: str, lembar: Optional[Dict[str, Any]]) -> Optional[str]:
    """Penilai guru: pemegang lembar, lalu penilai penugasan; bila pengguna sendiri penilai (bukan kepala) dialah penilainya."""
    if lembar and lembar.get('penilai_id'):
        return lembar['penilai_id']
    for tugas in await db_[KOLEKSI_PENUGASAN].find({'periode_id': periode['id']}, {'_id': 0}).to_list(1000):
        if guru_id in (tugas.get('guru_dinilai_ids') or []):
            return tugas.get('penilai_id')
    return user['id'] if cakupan['cakupan'] == 'penilai' else None


def _ids_semua_guru(sk: Optional[Dict[str, Any]], cakupan: Dict[str, Any]) -> List[str]:
    """Guru yang dinilai dalam cakupan: kepala semua guru pada SK, penilai guru yang dibagikan kepadanya (bukan dirinya)."""
    if cakupan['guru'] is not None:
        ids = [g for g in cakupan['guru'] if g != cakupan['diri']]
    else:
        ids = list((sk or {}).get('dinilai_ids') or [])
    if not ids:
        raise HTTPException(409, 'Belum ada guru yang dinilai dalam cakupan Anda pada periode ini.')
    return ids


async def siapkan_form(db_, user: Dict[str, Any], data: FormKosongRequest) -> Dict[str, Any]:
    """Validasi hak & susun konteks form; hasil {periode, konteks: [...], guru_id}."""
    ktx = None
    if data.guru_id or data.semua_guru:
        ktx = await konteks_pengelola(db_, user, data.periode_id, data.guru_id)
        periode, sk = ktx['periode'], ktx['sk']
    else:
        periode, sk = await periode_dan_sk(db_, data.periode_id)
        if not await anggota_periode(db_, user, periode, sk):
            raise tolak('bukan_anggota_sk', 'Anda tidak termasuk personil PKG pada periode ini.')
        alasan = alasan_tolak(await keanggotaan_sk(db_, user), 'pengelola')
        if alasan:
            raise tolak(alasan, 'Form isian PKG hanya untuk kepala madrasah dan tim penilai.')
    pengaturan = await db_.settings.find_one({'id': 'global_config'}, {'_id': 0}) or {}
    bulan = [label_bulan(b) for b in await bulan_kehadiran(db_, periode)]
    perlu_instrumen = data.jenis in ('instrumen', 'paket')
    aktif = await instrumen_aktif(db_) if perlu_instrumen else None
    tembolok: Dict[str, Optional[Dict[str, Any]]] = {}

    async def susun(guru: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        lembar = await db_[KOLEKSI_PENILAIAN].find_one({'sk_id': sk['id'], 'guru_dinilai_id': guru['id']}, {'_id': 0}) if guru and sk else None
        instrumen = aktif
        if perlu_instrumen and lembar and lembar.get('instrumen_id'):  # lembar memakai instrumen versi saat dibuat
            iid = lembar['instrumen_id']
            if iid not in tembolok:
                tembolok[iid] = await db_[KOLEKSI_INSTRUMEN].find_one({'id': iid}, {'_id': 0})
            instrumen = tembolok[iid] or aktif
        if perlu_instrumen and not instrumen:
            raise HTTPException(409, 'Instrumen PKG belum dimuat. Hubungi kepala madrasah.')
        penilai = await _orang(db_, sk, await _penilai_id(db_, periode, sk, user, ktx['cakupan'], guru['id'], lembar)) if guru and ktx else None
        return {'madrasah': pengaturan.get('school_name'), 'periode': periode, 'guru': guru, 'penilai': penilai,
                'instrumen': instrumen, 'bulan': bulan}

    if data.semua_guru:
        gurus = [g for g in [await _orang(db_, sk, i) for i in _ids_semua_guru(sk, ktx['cakupan'])] if g]
        gurus.sort(key=lambda g: (g.get('nama') or '').lower())
        konteks = [await susun(g) for g in gurus]
    else:
        konteks = [await susun(ktx['guru'] if ktx else None)]
    return {'periode': periode, 'konteks': konteks, 'guru_id': data.guru_id}


@router.post("/pkg/cetak/form")
async def cetak_form_api(data: FormKosongRequest, request: Request, user: Dict = Depends(get_current_user)):
    """Unduh PDF form isian kosong untuk diisi offline: `instrumen` (penilaian kinerja), `kehadiran`, `pkb`, atau `paket`
    (ketiganya, halaman terpisah). Identitas guru terisi bila `guru_id` diberikan; `semua_guru` mencetak satu PDF berisi
    form setiap guru dalam cakupan. Instrumen mengikuti lembar guru (bila sudah ada), selain itu instrumen aktif.
    403 di luar hak/cakupan, 409 bila instrumen belum dimuat atau tidak ada guru dalam cakupan."""
    meta = {'jenis_dokumen': 'form', 'jenis_form': data.jenis, 'format': 'pdf', 'periode_id': data.periode_id,
            'guru_id': data.guru_id, 'endpoint': request.url.path}
    try:
        siap = await siapkan_form(db, user, data)
    except HTTPException as e:
        await catat_cetak_gagal(db, user, e.status_code, e.detail, meta, request=request)
        raise
    isi = form_kosong_pdf(data.jenis, siap['konteks'])
    guru = siap['konteks'][0]['guru'] if len(siap['konteks']) == 1 else None
    dasar = f"Form_PKG_{data.jenis}_{(guru or {}).get('nama') or ('Semua_Guru' if data.semua_guru else 'Kosong')}"
    nama = nama_berkas_cetak(dasar, 'pdf')
    await catat_cetak_template(db, user, 'form', 'pdf', nama, VERSI_FORM, None, periode_id=siap['periode']['id'], request=request,
                               jenis_dokumen='form', guru_id=siap['guru_id'], mesin='reportlab', isi=isi,
                               metadata={'jenis_form': data.jenis, 'semua_guru': data.semua_guru, 'jumlah_form': len(siap['konteks']),
                                         'tanggal_cetak': date.today().isoformat(), 'endpoint': meta['endpoint']})
    return respon_berkas(isi, nama, 'pdf', 'reportlab')
