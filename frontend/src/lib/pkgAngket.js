import axios from 'axios';
import { api } from '@/lib/api';
import { galatDariRespons, namaDariHeader } from '@/lib/pkgCetak';

// Angket penilaian 360° (sejawat, peserta didik, orang tua/wali) — backend/routers/pkg_angket_api.py.
// Angket dicetak di kertas (format FORM-360-GR template resmi), diisi responden tanpa akun, lalu rekap jawabannya
// diinput kembali oleh kepala madrasah / tim penilai. DUDI tidak dipakai (khusus SMK).
//   GET  /pkg/angket/jenis -> [{ jenis, label, sheet, jumlah_butir, skor_maks, maks_responden }]
//   POST /pkg/angket/cetak { jenis_angket, format: 'pdf' | 'xlsx', periode_id?, guru_id? } -> berkas (blob)
//        tanpa guru_id = angket kosong; header X-PKG-Mesin / X-PKG-Cadangan seperti cetak dokumen resmi.

export const JENIS_ANGKET = {
  sejawat: { label: 'Teman Sejawat', keterangan: 'Diisi rekan guru' },
  siswa: { label: 'Peserta Didik', keterangan: 'Diisi siswa yang diajar' },
  ortu: { label: 'Orang Tua/Wali', keterangan: 'Diisi orang tua/wali siswa' },
};

async function panggil(fn, cadangan) {
  try {
    return (await fn()).data;
  } catch (e) {
    const d = e?.response?.data?.detail;
    throw new Error(typeof d === 'string' ? d : d?.pesan || cadangan);
  }
}

export const daftarJenisAngket = () => panggil(() => api.get('/pkg/angket/jenis'), 'Gagal memuat jenis angket.');

export async function cetakAngket({ jenis, format = 'pdf', periodeId, guruId }) {
  try {
    const res = await api.post('/pkg/angket/cetak', {
      jenis_angket: jenis, format, periode_id: periodeId || undefined, guru_id: guruId || undefined,
    }, { responseType: 'blob' });
    return {
      blob: res.data,
      namaBerkas: namaDariHeader(res.headers?.['content-disposition'], `Angket_360_${jenis}.${format}`),
      mesin: res.headers?.['x-pkg-mesin'] || null,
      alasanCadangan: res.headers?.['x-pkg-cadangan'] || null,
    };
  } catch (e) {
    throw await galatDariRespons(e);
  }
}

//   GET    /pkg/angket/ringkasan?periode_id= -> { periode, guru: [{ guru_id, nama, mapel, penilai_nama, status,
//          per_jenis: { sejawat|siswa|ortu: { jumlah_responden, maks_responden, nilai, sebutan } }, lengkap }] }
//   GET    /pkg/angket/guru/{guru_id}?periode_id= -> { periode, guru, lengkap, jenis: [{ jenis, label, jumlah_responden,
//          maks_responden, nilai, sebutan, butir: [{ no, komponen, nomor, pernyataan }], responden: [{ id, urutan,
//          nama_responden, jawaban, skor, skor_maks, nilai, diinput_oleh_nama, diubah_pada }] }] }
//   POST   /pkg/angket/guru/{guru_id}/jawaban { jenis_angket, periode_id?, nama_responden?, jawaban: [0|1|2] } -> responden
//   PUT    /pkg/angket/jawaban/{id} { jenis_angket, nama_responden?, jawaban } -> responden
//   DELETE /pkg/angket/jawaban/{id}
// Nilai responden = jumlah skor / (jumlah butir x 2) x 100; nilai jenis = rata-rata responden (sel Hasil Nilai sheet
// SEJAWAT/SISWA/ORTU). Maks. 10 responden per jenis (kolom penilai template). Hanya periode berjalan yang dapat diubah.

const params = (periodeId) => ({ params: periodeId ? { periode_id: periodeId } : {} });

export const ringkasanAngket = (periodeId) => panggil(() => api.get('/pkg/angket/ringkasan', params(periodeId)), 'Gagal memuat ringkasan angket.');
export const ambilAngketGuru = (guruId, periodeId) => panggil(() => api.get(`/pkg/angket/guru/${guruId}`, params(periodeId)), 'Gagal memuat angket guru.');
export const tambahJawaban = (guruId, { jenis, periodeId, nama, jawaban }) => panggil(
  () => api.post(`/pkg/angket/guru/${guruId}/jawaban`, { jenis_angket: jenis, periode_id: periodeId || undefined, nama_responden: nama || null, jawaban }),
  'Gagal menyimpan jawaban angket.',
);
export const ubahJawaban = (id, { jenis, nama, jawaban }) => panggil(
  () => api.put(`/pkg/angket/jawaban/${id}`, { jenis_angket: jenis, nama_responden: nama || null, jawaban }), 'Gagal mengubah jawaban angket.',
);
export const hapusJawaban = (id) => panggil(() => api.delete(`/pkg/angket/jawaban/${id}`), 'Gagal menghapus jawaban angket.');
// Tanda tangan responden angket online (PNG, butuh login) -> blob.
export const ambilTtdJawaban = (id) => panggil(() => api.get(`/pkg/angket/jawaban/${id}/ttd`, { responseType: 'blob' }), 'Gagal memuat tanda tangan.');

// Tautan angket online (satu per periode; halaman publik /public/angket-360/<token>):
//   GET  /pkg/angket/tautan?periode_id= -> { token, aktif, terbuka, periode, dibuat_pada, dibuat_oleh_nama, status_pada,
//        status_oleh_nama, boleh_kelola }   (pengelola; dibuat otomatis saat pertama diminta)
//   POST /pkg/angket/tautan/status { periode_id?, aktif } -> sama  (kepala: buka/tutup pengisian)
//   POST /pkg/angket/tautan/ganti { periode_id? } -> sama  (kepala: token baru, tautan lama mati)
// `terbuka` = tautan aktif dan periode berjalan.
export const ambilTautanAngket = (periodeId) => panggil(() => api.get('/pkg/angket/tautan', params(periodeId)), 'Gagal memuat tautan angket online.');
export const aturStatusTautanAngket = (periodeId, aktif) => panggil(
  () => api.post('/pkg/angket/tautan/status', { periode_id: periodeId || undefined, aktif }), 'Gagal mengubah status tautan angket.',
);
export const gantiTautanAngket = (periodeId) => panggil(
  () => api.post('/pkg/angket/tautan/ganti', { periode_id: periodeId || undefined }), 'Gagal mengganti tautan angket.',
);
export const urlAngketPublik = (token) => `${window.location.origin}/public/angket-360/${token}`;

// Halaman publik angket online (tanpa login; backend/routers/pkg_angket_publik_api.py):
//   GET  /public/pkg/angket/{token} -> { periode: { nama_periode, tahun_pelajaran, semester }, terbuka, pesan,
//        maks_responden, jenis: [{ jenis, label, jumlah_butir, butir }], guru: [{ id, nama, mapel, jumlah: { sejawat, siswa, ortu } }] }
//   POST /public/pkg/angket/{token}/jawaban { jenis_angket, guru_id, nama_responden, jawaban: [0|1|2], tanda_tangan: PNG data URL }
//        -> { jenis, label, guru_nama, urutan, jumlah_responden, maks_responden }
const publik = axios.create({ baseURL: `${process.env.REACT_APP_BACKEND_URL || ''}/api` });
export const ambilAngketPublik = (token) => panggil(() => publik.get(`/public/pkg/angket/${token}`), 'Gagal memuat angket.');
export const kirimAngketPublik = (token, { jenis, guruId, nama, jawaban, tandaTangan }) => panggil(
  () => publik.post(`/public/pkg/angket/${token}/jawaban`, { jenis_angket: jenis, guru_id: guruId, nama_responden: nama, jawaban, tanda_tangan: tandaTangan }),
  'Gagal mengirim angket.',
);

// Label skor sesuai kepala kolom FORM-360-GR.
export const SKOR_ANGKET = [
  { nilai: 0, label: 'Tidak ada bukti', keterangan: 'Tidak terpenuhi' },
  { nilai: 1, label: 'Sebagian', keterangan: 'Terpenuhi sebagian' },
  { nilai: 2, label: 'Seluruhnya', keterangan: 'Seluruhnya terpenuhi' },
];

// Nilai responden di layar (sama dengan backend pkg_angket.nilai_responden); jawaban kosong (null) belum dihitung.
export function hitungNilaiResponden(jawaban = []) {
  const maks = jawaban.length * 2;
  const skor = jawaban.reduce((a, b) => a + (b || 0), 0);
  return { skor, maks, nilai: maks ? Math.round((skor / maks) * 10000) / 100 : 0, terisi: jawaban.filter((n) => n != null).length };
}
