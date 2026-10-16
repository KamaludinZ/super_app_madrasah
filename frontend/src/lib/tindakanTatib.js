// Tindakan Tatib: rekap siswa berpoin + usulan SP otomatis + status pembinaan yang ditetapkan manual.
// SEMENTARA memakai data tiruan di memori (frontend dibangun lebih dulu). Kontrak yang diasumsikan:
//   GET /tatib/tindakan -> { ambang: { sp1, sp2, sp3 }, items: [{ siswa_id, nisn, nama, kelas,
//        poin_positif, kategori_positif: [{ nama, poin, jumlah }], poin_negatif, kategori_negatif: [{ nama, poin, jumlah }], usulan_sp,
//        status_panggilan_wali, status_sp, status_rtlpd, keterangan_sp, diubah_pada, diubah_oleh_nama }] }
// poin_negatif bernilai minus (akumulasi pelanggaran); kategori diurut poin terbesar (mutlak) dulu.
// Usulan SP dihitung server dari ambang.

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

const jeda = (data) => new Promise((resolve) => setTimeout(() => resolve(structuredClone(data)), 150));

const statusAwal = { status_panggilan_wali: 'Tidak diperlukan', status_sp: 'Tidak perlu', status_rtlpd: 'Tidak diperlukan', keterangan_sp: null };

const k = (nama, poin, jumlah) => ({ nama, poin, jumlah });

const siswaTiruan = [
  { siswa_id: 'sis-3', nisn: '0098765315', nama: 'Muhammad Rizki Pratama', kelas: 'VIII B', poin_positif: 5, kategori_positif: [k('Akhlak & Ibadah', 5, 1)],
    poin_negatif: -80, kategori_negatif: [k('Kedisiplinan', -60, 6), k('Kerapian', -20, 4)], ...statusAwal,
    status_panggilan_wali: 'Terlaksana', status_sp: 'Diserahkan', keterangan_sp: 'SP2', status_rtlpd: 'Disusun', diubah_pada: '2026-10-12T09:00:00', diubah_oleh_nama: 'Guru Tatib' },
  { siswa_id: 'sis-5', nisn: '0098765207', nama: 'Fikri Hidayatullah', kelas: 'IX C', poin_positif: 0, kategori_positif: [],
    poin_negatif: -55, kategori_negatif: [k('Kedisiplinan', -55, 5)], ...statusAwal, status_panggilan_wali: 'Diajukan' },
  { siswa_id: 'sis-1', nisn: '0098765401', nama: 'Ahmad Fauzan', kelas: 'VII A', poin_positif: 10, kategori_positif: [k('Akhlak & Ibadah', 10, 2)],
    poin_negatif: -30, kategori_negatif: [k('Kerapian', -30, 6)], ...statusAwal },
  { siswa_id: 'sis-4', nisn: '0098765316', nama: 'Nur Halimah', kelas: 'VIII B', poin_positif: 15, kategori_positif: [k('Akhlak & Ibadah', 10, 2), k('Kedisiplinan', 5, 1)],
    poin_negatif: -5, kategori_negatif: [k('Kedisiplinan', -5, 1)], ...statusAwal },
  { siswa_id: 'sis-2', nisn: '0098765402', nama: 'Aisyah Putri Ramadhani', kelas: 'VII A', poin_positif: 20, kategori_positif: [k('Akhlak & Ibadah', 20, 3)],
    poin_negatif: 0, kategori_negatif: [], ...statusAwal },
];

const ambangTiruan = { ...AMBANG_SP_BAWAAN };

export async function ambilTindakan() {
  return jeda({
    ambang: ambangTiruan,
    items: siswaTiruan.map((s) => ({ ...s, usulan_sp: usulkanSP(s.poin_negatif, ambangTiruan) })),
  });
}
