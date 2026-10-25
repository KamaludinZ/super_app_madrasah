import { api } from '@/lib/api';
import { GalatPkg } from '@/lib/pkg';

// Isian identitas guru untuk lampiran laporan PKG — backend/routers/pkg_identitas_api.py & backend/pkg_identitas_isian.py.
//   GET /pkg/identitas/saya | /pkg/identitas/{guru_id} -> {
//        guru_id, nama, periode: { id, nama_periode, status }, diubah_sebagai: 'diri' | 'kepala' | 'penilai',
//        butir: [{ kunci, label, sumber: 'emis' | 'pkg', nilai, kosong }], kosong: [label], kosong_pkg: [label],
//        isian_pkg: { pangkat, golongan, tmt_golongan (YYYY-MM-DD), jabatan_fungsional, pendidikan_terakhir, spesialisasi },
//        jenis_gtk: 'guru' | 'tendik' }
//   PUT idem { pangkat?, golongan?, tmt_golongan?, ... }  (field tidak dikirim = tidak diubah; '' = dikosongkan)
//        -> data yang sama + berubah: [kunci field]
// Penolakan 403 { alasan, pesan } menjadi GalatPkg (bukan_anggota_sk | bukan_penilai | bukan_penugasan).

export const FIELD_ISIAN_PKG = ['pangkat', 'golongan', 'tmt_golongan', 'jabatan_fungsional', 'pendidikan_terakhir', 'spesialisasi'];

// Pilihan golongan umum: PNS (I/a - IV/e) dan PPPK (I - XVII). Selain itu: "Lainnya" (teks bebas).
const RUANG = ['a', 'b', 'c', 'd', 'e'];
export const GOLONGAN_PNS = ['I', 'II', 'III', 'IV'].flatMap((g) => RUANG.slice(0, g === 'IV' ? 5 : 4).map((r) => `${g}/${r}`));
export const GOLONGAN_PPPK = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII'];

async function panggil(fn, cadangan) {
  try {
    return (await fn()).data;
  } catch (e) {
    const status = e?.response?.status;
    const d = e?.response?.data?.detail;
    if (status === 403 && d && typeof d === 'object' && d.alasan) throw new GalatPkg(d.pesan || cadangan, status, d);
    if (Array.isArray(d)) throw new GalatPkg(d.map((x) => x?.msg).filter(Boolean).join('; ') || cadangan, status, null);
    throw new GalatPkg(typeof d === 'string' ? d : cadangan, status, null);
  }
}

const jalur = (guruId) => `/pkg/identitas/${guruId || 'saya'}`;

export const ambilIdentitasPkg = (guruId) => panggil(() => api.get(jalur(guruId)), 'Gagal memuat identitas untuk laporan PKG.');
export const simpanIdentitasPkg = (guruId, isian) => panggil(
  () => api.put(jalur(guruId), Object.fromEntries(FIELD_ISIAN_PKG.filter((k) => k in isian).map((k) => [k, isian[k] ?? '']))),
  'Gagal menyimpan identitas.',
);
