import { api } from '@/lib/api';

// Hasil CKG milik akun yang login (siswa & GTK): GET /uks/ckg/saya?tahun=
//   -> { pasien: { id, nama, kelas, jenis }, items: [ckg + imt], ringkasan, tahun_tersedia, filter }
export async function ambilCkgSaya(tahun) {
  const { data } = await api.get('/uks/ckg/saya', { params: tahun ? { tahun } : {} });
  return data;
}
