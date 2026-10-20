import { api } from '@/lib/api';

// Ambang & bobot penilaian PKG — cermin backend/pkg_ambang.py (disalin dari rumus template resmi
// pkg_template_v2026.xlsx & rekap_hasil_pkg_v2026.xlsx; dijaga tests/test_pkg_ambang.py). Tidak dapat diubah dari
// aplikasi agar nilai di layar sama dengan hasil hitung ulang rumus pada berkas Excel cetak.
//   GET /pkg/ambang -> { level, predikat_jenjang, predikat_rekap, sebutan_360, jenjang, proporsi, kehadiran, sumber }
// Setiap ambang = [operator, batas, label] dicek berurutan; nilai 0/kosong -> null (template: "").

export const AMBANG_LEVEL = [
  ['<', 55, 'Level 1'], ['==', 55, 'Level 2'], ['<=', 75, 'Level 3'], ['<=', 90, 'Level 4'], ['<=', 100, 'Level 5'],
];
export const AMBANG_PREDIKAT_JENJANG = [
  ['<=', 55, 'Terpenuhi pada Jenjang Jabatan Guru Ahli Pertama'],
  ['<=', 75, 'Terpenuhi pada Jenjang Jabatan Guru Ahli Muda'],
  ['<=', 90, 'Terpenuhi pada Jenjang Jabatan Guru Ahli Madya'],
  ['<=', 100, 'Terpenuhi pada Jenjang Jabatan Guru Ahli Utama'],
];
export const AMBANG_PREDIKAT_REKAP = [
  ['>=', 91, 'Sangat Baik'], ['>=', 76, 'Baik'], ['>=', 61, 'Cukup'], ['>=', 60, 'Sedang'], ['>=', -Infinity, 'Kurang'],
];
export const AMBANG_SEBUTAN_360 = [
  ['<=', 50, 'Kurang'], ['<=', 60, 'Sedang'], ['<=', 75, 'Cukup'], ['<=', 90, 'Baik'], ['<=', 100, 'Amat Baik'],
];

const OPERATOR = {
  '<': (n, b) => n < b, '<=': (n, b) => n <= b, '==': (n, b) => n === b, '>=': (n, b) => n >= b,
};

export function terapkan(ambang, nilai, kosongBilaNol = true) {
  if (nilai == null || (kosongBilaNol && !nilai)) return null;
  const cocok = ambang.find(([op, batas]) => OPERATOR[op](nilai, batas));
  return cocok ? cocok[2] : null;
}

export const levelCapaian = (persen) => terapkan(AMBANG_LEVEL, persen);
export const predikatJenjang = (persen) => terapkan(AMBANG_PREDIKAT_JENJANG, persen);
export const sebutan360 = (nilai) => terapkan(AMBANG_SEBUTAN_360, nilai);

// Teks ambang untuk legenda, mis. "< 55" / "= 55" / "≤ 75".
const SIMBOL = { '<': '<', '<=': '≤', '==': '=', '>=': '≥' };
export const teksAmbang = ([op, batas]) => (batas === -Infinity || batas == null ? 'lainnya' : `${SIMBOL[op]} ${batas}`);

export async function ambilAmbang() {
  try {
    return (await api.get('/pkg/ambang')).data;
  } catch (e) {
    const d = e?.response?.data?.detail;
    throw new Error(typeof d === 'string' ? d : d?.pesan || 'Gagal memuat ambang penilaian.');
  }
}
