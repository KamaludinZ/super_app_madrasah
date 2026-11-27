"""Ujian Madrasah — pilihan sesi pada tautan publik daftar hadir & berita acara.

Sesi yang sedang aktif tetap dipilih otomatis menurut jam server (ujian_formulir.sesi_aktif — tidak diubah). Selain itu
peserta/pengawas boleh memilih sesi LAIN pada hari ini atau hari-hari sebelumnya selama sesi itu BELUM LENGKAP:
    - daftar hadir : lengkap bila setiap peserta ujian sudah hadir atau ditandai izin/sakit/alpa pada sesi itu;
    - berita acara : lengkap bila setiap ruang yang berisi peserta sudah memiliki berita acara sesi itu.
Sesi pada hari berikutnya tidak dapat dibuka sebelum harinya. Jendela formulir (aktif & jam buka–tutup) tetap berlaku.

Status pilihan satu sesi: 'aktif' (sesi berjalan, selalu boleh) | 'terbuka' (belum lengkap, boleh) |
'lengkap' (tidak boleh) | 'belum_waktunya' (hari berikutnya, tidak boleh).
"""
from typing import Any, Dict, List, Optional

from ujian_berita_acara import KOLEKSI_BA
from ujian_kehadiran import KOLEKSI_DH, KOLEKSI_DH_STATUS

UNTUK = ('daftar_hadir', 'berita_acara')
STATUS_BOLEH = ('aktif', 'terbuka')
KOLEKSI_PESERTA = 'peserta_ruang'


def status_pilihan(sesi: Dict[str, Any], aktif_id: Optional[str], hari_ini: str, lengkap: bool) -> str:
    if aktif_id and sesi['id'] == aktif_id:
        return 'aktif'
    if (sesi.get('tanggal') or '') > hari_ini:
        return 'belum_waktunya'
    return 'lengkap' if lengkap else 'terbuka'


async def kelengkapan_sesi(db, ujian_id: str, daftar_sesi: List[Dict[str, Any]], untuk: str) -> Dict[str, Dict[str, Any]]:
    """{sesi_id: { terisi, total, lengkap }} untuk banyak sesi sekaligus (beberapa kueri ringan, dihitung di memori).
    daftar_hadir: satuan peserta; berita_acara: satuan ruang yang berisi peserta."""
    if not daftar_sesi:
        return {}
    ids = [s['id'] for s in daftar_sesi]
    peserta = await db[KOLEKSI_PESERTA].find({'ujian_id': ujian_id}, {'_id': 0, 'id': 1, 'ruang_id': 1}).to_list(5000)
    hasil: Dict[str, Dict[str, Any]] = {}
    if untuk == 'berita_acara':
        ruang = {p.get('ruang_id') for p in peserta if p.get('ruang_id')}
        ba = await db[KOLEKSI_BA].find({'ujian_id': ujian_id, 'sesi_id': {'$in': ids}}, {'_id': 0, 'ruang_id': 1, 'sesi_id': 1}).to_list(20000)
        per_sesi: Dict[str, set] = {}
        for b in ba:
            per_sesi.setdefault(b['sesi_id'], set()).add(b.get('ruang_id'))
        for s in daftar_sesi:
            terisi = len(per_sesi.get(s['id'], set()) & ruang)
            hasil[s['id']] = {'terisi': terisi, 'total': len(ruang), 'lengkap': terisi >= len(ruang)}
        return hasil
    semua = {p['id'] for p in peserta}
    dh = await db[KOLEKSI_DH].find({'ujian_id': ujian_id, 'sesi_id': {'$in': ids}}, {'_id': 0, 'peserta_id': 1, 'sesi_id': 1}).to_list(50000)
    tanggal = sorted({s['tanggal'] for s in daftar_sesi})
    q_tanda = {'ujian_id': ujian_id, 'tanggal': {'$in': tanggal}}
    tanda = await db[KOLEKSI_DH_STATUS].find(q_tanda, {'_id': 0, 'peserta_id': 1, 'tanggal': 1, 'status': 1}).to_list(50000)
    hadir: Dict[str, set] = {}
    for d in dh:
        hadir.setdefault(d['sesi_id'], set()).add(d.get('peserta_id'))
    harian: Dict[str, set] = {}
    for t in tanda:
        if t.get('status'):
            harian.setdefault(t['tanggal'], set()).add(t.get('peserta_id'))
    for s in daftar_sesi:
        terisi = len((hadir.get(s['id'], set()) | harian.get(s['tanggal'], set())) & semua)
        hasil[s['id']] = {'terisi': terisi, 'total': len(semua), 'lengkap': terisi >= len(semua)}
    return hasil


def susun_pilihan(jadwal: List[Dict[str, Any]], aktif: Optional[Dict[str, Any]], hari_ini: str,
                  kelengkapan: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    """Respons GET /publik/ujian/{token}/sesi: sesi hari ini & sebelumnya (terbaru dulu) beserta statusnya; sesi hari
    berikutnya tidak dikirim, hanya tanggal hari ujian berikutnya sebagai keterangan."""
    aktif_id = (aktif or {}).get('id')
    lalu = [s for s in jadwal if (s.get('tanggal') or '') <= hari_ini]
    lalu.sort(key=lambda s: (s['tanggal'], s.get('sesi_ke') or 0))
    lalu.sort(key=lambda s: s['tanggal'], reverse=True)  # stabil: hari terbaru dulu, sesi dalam hari tetap urut
    items = []
    for s in lalu:
        k = kelengkapan.get(s['id']) or {'terisi': 0, 'total': 0, 'lengkap': False}
        st = status_pilihan(s, aktif_id, hari_ini, k['lengkap'])
        items.append({**{x: s.get(x) for x in ('id', 'tanggal', 'sesi_ke', 'jam_mulai', 'jam_selesai', 'mapel')},
                      'status': st, 'boleh_dipilih': st in STATUS_BOLEH, 'terisi': k['terisi'], 'total': k['total'],
                      'lengkap': k['lengkap']})
    nanti = sorted({s['tanggal'] for s in jadwal if (s.get('tanggal') or '') > hari_ini})
    return {'tanggal': hari_ini, 'aktif_id': aktif_id, 'items': items, 'berikutnya': nanti[0] if nanti else None}
