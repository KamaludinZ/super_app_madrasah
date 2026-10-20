import { api } from '@/lib/api';

// Jejak audit modul PKG (koleksi pkg_audit_log), khusus kepala madrasah.
//   GET /pkg/audit?halaman=&per_halaman=&kategori=&aksi=&dari=&sampai=&cari=
//       -> { item: [entri], total, halaman, per_halaman }   (aktivitas terbaru dulu)
// entri = { id, aksi, label, kategori, aktor_nama, aktor_peran, timestamp, terakhir, jumlah, penilaian_id, guru_id,
//           guru_nama, periode_id, ip_address, metadata, ringkasan }
//   GET /pkg/audit/guru/{guru_id}?periode_id= -> [aksiLembar]  (riwayat aksi lembar penilaian satu guru)
// aksiLembar = { aksi, label, aktor_nama, timestamp, terakhir, jumlah, progres, nilai_akhir }
//   (bentuk sama dengan GET /pkg/penilaian/lembar/{guru_id}/riwayat milik penilai)
// Aksi berulang (buka beranda, draf, lihat rekap, penolakan) dicatat harian dengan `jumlah` & `terakhir`.

// Kategori aksi (sama dengan backend pkg_audit.KATEGORI_AUDIT) untuk saringan & warna penanda.
export const KATEGORI_AUDIT = {
  penilaian: { label: 'Penilaian', kelas: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  komponen: { label: '360° & kehadiran', kelas: 'bg-teal-100 text-teal-800 border-teal-200' },
  instrumen: { label: 'Instrumen', kelas: 'bg-violet-100 text-violet-800 border-violet-200' },
  susunan: { label: 'Periode & SK', kelas: 'bg-sky-100 text-sky-800 border-sky-200' },
  unduhan: { label: 'Cetak & unduh', kelas: 'bg-amber-100 text-amber-800 border-amber-200' },
  akses: { label: 'Akses', kelas: 'bg-slate-100 text-slate-700 border-slate-200' },
};

// Jenis aksi per kategori untuk saringan (kode & label sama dengan backend pkg_audit.LABEL_AKSI/KATEGORI_AKSI;
// kesamaannya diuji di tests/test_pkg_validasi.py).
export const AKSI_PER_KATEGORI = {
  penilaian: { penilaian_mulai: 'Memulai lembar penilaian', penilaian_buka: 'Membuka lembar penilaian', penilaian_draf: 'Menyimpan draf penilaian', penilaian_kirim: 'Mengirim & mengunci penilaian', rekap_hitung_ulang: 'Menghitung ulang rekap' },
  komponen: { angket_simpan: 'Menginput jawaban angket 360°', angket_ubah: 'Mengubah jawaban angket 360°', angket_hapus: 'Menghapus jawaban angket 360°', kehadiran_simpan: 'Menyimpan rekap kehadiran guru' },
  instrumen: { instrumen_impor: 'Mengimpor instrumen', instrumen_ubah: 'Mengubah instrumen', instrumen_aktifkan: 'Menetapkan instrumen acuan' },
  susunan: { periode_buat: 'Menetapkan periode', periode_ubah: 'Mengubah periode', periode_berjalan: 'Memulai periode', periode_ditutup: 'Menutup periode', sk_buat: 'Menambah SK', sk_ubah: 'Mengubah SK', sk_aktifkan: 'Mengaktifkan SK', sk_hapus: 'Menghapus SK', sk_penilai: 'Mengubah tim penilai', sk_dinilai: 'Mengubah guru yang dinilai', penugasan_simpan: 'Menyimpan pembagian penilaian', supervisi_tandai: 'Menandai supervisi penilai', supervisi_batal: 'Membatalkan supervisi penilai' },
  unduhan: { cetak_template: 'Mencetak dokumen dari template', cetak_gagal: 'Gagal mencetak dokumen', lihat_unduhan: 'Melihat riwayat unduhan', lihat_template: 'Melihat info template', periksa_template: 'Memeriksa ulang berkas template' },
  akses: { buka_beranda: 'Membuka Beranda PKG', tolak_akses: 'Akses ditolak', lihat_audit: 'Melihat jejak audit', lihat_rekap: 'Melihat rekap', lihat_rekap_guru: 'Melihat rekap per guru' },
};

async function panggil(fn, cadangan) {
  try {
    return (await fn()).data;
  } catch (e) {
    const d = e?.response?.data?.detail;
    throw new Error(typeof d === 'string' ? d : d?.pesan || cadangan);
  }
}

const tanpaKosong = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));

// Saringan: kategori, aksi, dari/sampai ('YYYY-MM-DD', inklusif, WIB), cari (pelaku/guru/aksi/berkas/nomor SK).
export const daftarAudit = ({ halaman = 1, perHalaman = 10, kategori, aksi, dari, sampai, cari } = {}) => panggil(
  () => api.get('/pkg/audit', {
    params: tanpaKosong({ halaman, per_halaman: perHalaman, kategori, aksi, dari, sampai, cari: (cari || '').trim() }),
  }),
  'Gagal memuat jejak audit.',
);

export async function riwayatAksiGuru(guruId, periodeId) {
  if (!guruId) return [];
  return panggil(
    () => api.get(`/pkg/audit/guru/${encodeURIComponent(guruId)}`, { params: tanpaKosong({ periode_id: periodeId }) }),
    'Gagal memuat riwayat aksi guru.',
  );
}
