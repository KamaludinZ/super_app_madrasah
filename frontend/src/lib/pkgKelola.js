import { api } from '@/lib/api';

// Pengelolaan PKG oleh kepala madrasah (backend/routers/pkg_kelola.py): periode, SK & anggota (tim penilai &
// guru yang dinilai), pembagian jatah penilaian, dan supervisi penilai. Semua endpoint khusus kepala madrasah.
//   periode   = { id, nama_periode, semester_id, tahun_pelajaran, semester, tanggal_buka, tanggal_tutup,
//                 status: 'draf' | 'berjalan' | 'ditutup' }   (hanya satu periode 'berjalan')
//   sk        = { id, nomor_sk, tanggal_sk, tentang, periode_id, is_active, penilaian_berjalan,
//                 penilai: [anggota], dinilai: [anggota] }
//   anggota   = { id, nama, nip, mapel }   (snapshot identitas periode)
//   pembagian = { periode, sk, penilai, dinilai, penugasan: {guru_id: penilai_id}, jatah: {penilai_id: n},
//                 penilaian_dimulai, peringatan: [teks] }
//   supervisi = { penilai: anggota, supervisi_selesai, tanggal_supervisi, catatan, disupervisi_oleh, jumlah_guru }
// Setelah penilaian berjalan, perubahan susunan (penilai, guru dinilai, pembagian) wajib menyertakan alasan.

// Pesan galat dari detail backend: teks (400/404/409) atau daftar validasi (422).
function pesanGalat(e, cadangan) {
  const d = e?.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (d && typeof d === 'object' && d.pesan) return d.pesan;
  if (Array.isArray(d) && d[0]?.msg) return `Isian tidak valid: ${d[0].msg}`;
  return cadangan;
}

async function panggil(fn, cadangan) {
  try {
    return (await fn()).data;
  } catch (e) {
    throw new Error(pesanGalat(e, cadangan));
  }
}

// Transisi status periode yang diizinkan: draf -> berjalan -> ditutup (sama dengan backend).
export const TRANSISI_PERIODE = { draf: 'berjalan', berjalan: 'ditutup' };

export const daftarPeriode = () => panggil(() => api.get('/pkg/periode'), 'Gagal memuat periode PKG.');

export function simpanPeriode(data, id = null) {
  const isi = { ...data, semester_id: data.semester_id || null };
  return panggil(
    () => (id ? api.put(`/pkg/periode/${id}`, isi) : api.post('/pkg/periode', isi)),
    'Gagal menyimpan periode.',
  );
}

export const ubahStatusPeriode = (id, status) => panggil(
  () => api.post(`/pkg/periode/${id}/status`, { status }), 'Gagal mengubah status periode.',
);

export const daftarSk = () => panggil(() => api.get('/pkg/sk'), 'Gagal memuat SK.');

export const simpanSk = (data, id = null) => panggil(
  () => (id ? api.put(`/pkg/sk/${id}`, data) : api.post('/pkg/sk', data)), 'Gagal menyimpan SK.',
);

export const aktifkanSk = (id) => panggil(() => api.post(`/pkg/sk/${id}/aktifkan`), 'Gagal mengaktifkan SK.');

// Akun guru aktif untuk ceklist anggota SK: [{ id, full_name, nip, roles }].
export const daftarGuru = () => panggil(() => api.get('/pkg/guru'), 'Gagal memuat daftar guru.');

export const adalahKepala = (guru) => (guru?.roles || []).includes('kepala_sekolah');

export const simpanPenilaiSk = (skId, penilaiIds = [], alasan = '') => panggil(
  () => api.put(`/pkg/sk/${skId}/penilai`, { penilai_ids: penilaiIds, alasan_perubahan: alasan }),
  'Gagal menyimpan tim penilai.',
);

export const simpanDinilaiSk = (skId, dinilaiIds = [], alasan = '') => panggil(
  () => api.put(`/pkg/sk/${skId}/dinilai`, { dinilai_ids: dinilaiIds, alasan_perubahan: alasan }),
  'Gagal menyimpan guru yang dinilai.',
);

export const ambilPenugasan = () => panggil(() => api.get('/pkg/penugasan'), 'Gagal memuat pembagian penilaian.');

// Pemeriksaan di sisi tampilan (aturan sama dengan backend): tiap guru dinilai punya tepat satu penilai
// anggota SK, bukan dirinya sendiri.
export function cekPenugasan(dinilai, penilai, penugasan) {
  const idPenilai = new Set(penilai.map((p) => p.id));
  const tanpaPenilai = dinilai.filter((g) => !penugasan[g.id]).map((g) => g.id);
  const diriSendiri = dinilai.filter((g) => penugasan[g.id] === g.id).map((g) => g.id);
  const bukanPenilai = dinilai.filter((g) => penugasan[g.id] && !idPenilai.has(penugasan[g.id])).map((g) => g.id);
  return { tanpaPenilai, diriSendiri, bukanPenilai, sah: !tanpaPenilai.length && !diriSendiri.length && !bukanPenilai.length };
}

export const simpanPenugasan = ({ penugasan, jatah, alasan = '' }) => panggil(
  () => api.put('/pkg/penugasan', {
    penugasan,
    jatah: Object.fromEntries(Object.entries(jatah || {}).map(([k, v]) => [k, Number(v) || 0])),
    alasan_perubahan: alasan,
  }),
  'Gagal menyimpan pembagian.',
);

export const daftarSupervisi = () => panggil(() => api.get('/pkg/supervisi'), 'Gagal memuat data supervisi.');

export const tandaiSupervisi = (penilaiId, { tanggal_supervisi: tanggal, catatan }) => panggil(
  () => api.post(`/pkg/supervisi/${penilaiId}`, { tanggal_supervisi: tanggal, catatan: catatan || '' }),
  'Gagal menandai supervisi.',
);

export const batalkanSupervisi = (penilaiId) => panggil(
  () => api.delete(`/pkg/supervisi/${penilaiId}`), 'Gagal membatalkan supervisi.',
);
