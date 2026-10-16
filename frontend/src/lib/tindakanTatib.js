// Tindakan Tatib: rekap siswa berpoin + usulan SP otomatis + status pembinaan yang ditetapkan manual.
// Semua data lewat API. Kontrak:
//   GET /tatib/tindakan?semester_id=&kelas=&cari=&usulan_sp= -> { ambang: { sp1, sp2, sp3 }, semester_id, items: [{ siswa_id, nisn, nama, kelas,
//        poin_positif, kategori_positif: [{ nama, poin, jumlah }], poin_negatif, kategori_negatif: [{ nama, poin, jumlah }], usulan_sp,
//        status_panggilan_wali, status_sp, status_rtlpd, keterangan_sp, diubah_pada, diubah_oleh_nama }] }
// poin_negatif bernilai minus (akumulasi pelanggaran); kategori diurut poin terbesar (mutlak) dulu.
// Usulan SP dihitung server dari ambang.

import { api } from '@/lib/api';
import { konteksPeriode } from '@/lib/poinTatib';

// Pilihan status baku (nilai disimpan apa adanya).
export const STATUS_PANGGILAN_WALI = ['Tidak diperlukan', 'Diajukan', 'Terlaksana'];
export const STATUS_SP = ['Tidak perlu', 'Diserahkan'];
export const STATUS_RTLPD = ['Tidak diperlukan', 'Disusun'];
export const TINGKAT_SP = ['SP1', 'SP2', 'SP3'];

// Ambang bawaan (akumulasi poin pelanggaran, nilai mutlak) — dapat diatur admin di Pengaturan Ambang SP.
export const AMBANG_SP_BAWAAN = { sp1: 25, sp2: 50, sp3: 75 };

// Usulan SP tertinggi yang ambangnya terlampaui oleh akumulasi pelanggaran, atau null.
export function usulkanSP(poinNegatif, ambang = AMBANG_SP_BAWAAN) {
  const n = Math.abs(Number(poinNegatif) || 0);
  if (n >= ambang.sp3) return 'SP3';
  if (n >= ambang.sp2) return 'SP2';
  if (n >= ambang.sp1) return 'SP1';
  return null;
}

// Tingkat SP berikutnya yang belum terlampaui beserta sisa poinnya, atau null bila sudah SP3.
export function ambangBerikutnya(poinNegatif, ambang = AMBANG_SP_BAWAAN) {
  const n = Math.abs(Number(poinNegatif) || 0);
  const tingkat = TINGKAT_SP.find((sp) => n < ambang[sp.toLowerCase()]);
  return tingkat ? { sp: tingkat, ambang: ambang[tingkat.toLowerCase()], sisa: ambang[tingkat.toLowerCase()] - n } : null;
}

// true bila usulan otomatis lebih berat daripada SP yang sudah ditetapkan (perlu ditinjau).
export const usulanLebihTinggi = (usulan, ditetapkan) => TINGKAT_SP.indexOf(usulan) > TINGKAT_SP.indexOf(ditetapkan || '');

// Label field status untuk riwayat perubahan.
export const LABEL_FIELD_TINDAKAN = {
  keterangan_sp: 'Keterangan SP',
  status_panggilan_wali: 'Panggilan wali',
  status_sp: 'Status SP',
  status_rtlpd: 'RTLPD',
};

// Riwayat perubahan per siswa, terbaru dulu: [{ id, waktu, oleh_nama, perubahan: [{ field, dari, ke }], catatan, usulan_sp, poin_negatif }].
// Kontrak: GET /tatib/tindakan/{siswa_id}/riwayat?semester_id= (atau semua_semester=true).
export async function ambilRiwayatTindakan(siswaId, { semester_id, semuaSemester = false } = {}) {
  const params = semuaSemester ? { semua_semester: true } : (semester_id ? { semester_id } : {});
  const { data } = await api.get(`/tatib/tindakan/${siswaId}/riwayat`, { params });
  return data || [];
}

// Rekap tindakan untuk semester yang sedang dilihat pengguna (/auth/view-context), atau `semester_id` yang diberikan.
export async function ambilTindakan({ semester_id, ...filter } = {}) {
  const semester = semester_id ?? (await konteksPeriode()).semester_id;
  const params = Object.fromEntries(Object.entries({ ...filter, semester_id: semester }).filter(([, v]) => v !== '' && v != null));
  const { data } = await api.get('/tatib/tindakan', { params });
  return { ambang: data?.ambang || AMBANG_SP_BAWAAN, semester_id: data?.semester_id ?? null, items: data?.items || [] };
}

// Simpan status pembinaan satu siswa untuk semester tertentu (keputusan manual; server mencatat riwayat).
// Kontrak: PUT /tatib/tindakan/{siswa_id} { semester_id, keterangan_sp, status_panggilan_wali, status_sp, status_rtlpd, catatan }
// -> baris rekap siswa terbaru (bentuk sama dengan item GET /tatib/tindakan).
export async function simpanStatusTindakan(siswaId, { semester_id, keterangan_sp, status_panggilan_wali, status_sp, status_rtlpd, catatan }) {
  if (keterangan_sp && !TINGKAT_SP.includes(keterangan_sp)) throw new Error('Keterangan SP tidak dikenal');
  if (!STATUS_PANGGILAN_WALI.includes(status_panggilan_wali) || !STATUS_SP.includes(status_sp) || !STATUS_RTLPD.includes(status_rtlpd)) {
    throw new Error('Status pembinaan tidak dikenal');
  }
  const { data } = await api.put(`/tatib/tindakan/${siswaId}`, {
    semester_id: semester_id ?? null, keterangan_sp: keterangan_sp || null, status_panggilan_wali, status_sp, status_rtlpd,
    catatan: (catatan || '').trim() || null,
  });
  return data;
}
