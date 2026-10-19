// Data tiruan Modul PKG (Penilaian Kinerja Guru) untuk membangun UI sebelum backend /pkg/* tersedia.
// Bentuk datanya mengikuti kontrak API yang direncanakan, jadi nanti cukup diganti pemanggil API.

export const PERIODE_TIRUAN = {
  id: 'periode-2026-ganjil',
  nama_periode: 'PKG Semester Ganjil 2026/2027',
  tahun_pelajaran: '2026/2027',
  semester: 'Ganjil',
  tanggal_buka: '2026-10-01',
  tanggal_tutup: '2026-11-30',
  status: 'berjalan',
};

export const RINGKASAN_TIRUAN = {
  total: 24,
  selesai: 9,
  sedang: 6,
  belum: 9,
};

// Keanggotaan pengguna pada SK aktif (kontrak rencana GET /pkg/sk/my-membership).
export const KEANGGOTAAN_SK_TIRUAN = {
  nomor_sk: 'B-123/Mts.10.05/KP.07.6/10/2026',
  peran: 'penilai',
  supervisi_selesai: true,
};

// status: 'belum' | 'draf' | 'terkunci'
export const TUGAS_SAYA_TIRUAN = [
  { id: 'g1', nama: 'Ahmad Fauzi, S.Pd.', nip: '198703122019031004', mapel: 'Matematika', status: 'draf', progres: 60 },
  { id: 'g2', nama: 'Siti Rahmawati, S.Ag.', nip: '199001252020122012', mapel: 'Akidah Akhlak', status: 'belum', progres: 0 },
  { id: 'g3', nama: 'Dedi Kurniawan, M.Pd.', nip: '198511082014031002', mapel: 'Bahasa Inggris', status: 'terkunci', progres: 100 },
  { id: 'g4', nama: 'Nur Aini, S.Si.', nip: '-', mapel: 'IPA', status: 'belum', progres: 0 },
];

// jenis: 'tenggat' | 'supervisi' | 'info'
export const PENGINGAT_TIRUAN = [
  { id: 'p1', jenis: 'tenggat', judul: 'Penilaian ditutup', tanggal: '2026-11-30', keterangan: 'Kirim & kunci semua lembar penilaian sebelum tanggal ini.' },
  { id: 'p2', jenis: 'supervisi', judul: 'Supervisi penilai', tanggal: '2026-10-25', keterangan: 'Supervisi oleh kepala madrasah wajib selesai sebelum membuka lembar penilaian.' },
  { id: 'p3', jenis: 'info', judul: 'Rekap hasil dibuka', tanggal: '2026-12-05', keterangan: 'Rekap dan cetak Excel/PDF tersedia setelah semua penilaian terkunci.' },
];

// Sembilan sub-menu modul PKG. `to` = rute yang direncanakan; `tersedia` dinyalakan saat halamannya sudah dibangun.
// `khusus: 'kepala'` = hanya dapat dikelola akun kepala madrasah (divalidasi juga di backend).
export const MENU_PKG = [
  { key: 'periode', label: 'Periode PKG', keterangan: 'Tetapkan periode penilaian', to: '/pkg/periode', khusus: 'kepala', tersedia: false },
  { key: 'sk', label: 'SK & Tim Penilai', keterangan: 'Data SK dan anggota', to: '/pkg/sk', khusus: 'kepala', tersedia: false },
  { key: 'penugasan', label: 'Pembagian Jatah', keterangan: 'Penilai → guru dinilai', to: '/pkg/penugasan', khusus: 'kepala', tersedia: false },
  { key: 'supervisi', label: 'Supervisi Penilai', keterangan: 'Tandai penilai tersupervisi', to: '/pkg/supervisi', khusus: 'kepala', tersedia: false },
  { key: 'instrumen', label: 'Master Instrumen', keterangan: 'Kompetensi & indikator', to: '/pkg/instrumen', tersedia: false },
  { key: 'penilaian', label: 'Penilaian Kinerja', keterangan: 'Isi lembar penilaian', to: '/pkg/penilaian', tersedia: false },
  { key: 'rekap', label: 'Rekap Hasil', keterangan: 'Nilai akhir & predikat', to: '/pkg/rekap', tersedia: false },
  { key: 'cetak', label: 'Cetak Excel & PDF', keterangan: 'Unduh dokumen resmi', to: '/pkg/cetak', tersedia: false },
  { key: 'audit', label: 'Jejak Audit', keterangan: 'Riwayat aksi PKG', to: '/pkg/audit', tersedia: false },
];

// Skenario data tiruan untuk mencoba tiap keadaan Beranda PKG lewat ?skenario=<key>.
// `penolakan` meniru detail HTTP 403 terstruktur dari backend: { alasan, pesan }.
export const SKENARIO_BERANDA = {
  normal: 'Anggota SK, sudah disupervisi',
  'belum-supervisi': 'Penilai belum disupervisi',
  dinilai: 'Hanya sebagai guru yang dinilai',
  'tanpa-periode': 'Belum ada periode berjalan',
  'bukan-anggota': 'Bukan anggota SK (403)',
};

export function berandaTiruan(skenario = 'normal') {
  const dasar = {
    periode: PERIODE_TIRUAN,
    ringkasan: RINGKASAN_TIRUAN,
    keanggotaan: KEANGGOTAAN_SK_TIRUAN,
    tugas: TUGAS_SAYA_TIRUAN,
    pengingat: PENGINGAT_TIRUAN,
    penolakan: null,
  };
  switch (skenario) {
    case 'belum-supervisi':
      return { ...dasar, keanggotaan: { ...KEANGGOTAAN_SK_TIRUAN, supervisi_selesai: false } };
    case 'dinilai':
      return { ...dasar, keanggotaan: { ...KEANGGOTAAN_SK_TIRUAN, peran: 'dinilai', supervisi_selesai: false }, tugas: [] };
    case 'tanpa-periode':
      return { ...dasar, periode: null, ringkasan: { total: 0, selesai: 0, sedang: 0, belum: 0 }, keanggotaan: null, tugas: [], pengingat: [] };
    case 'bukan-anggota':
      return {
        ...dasar,
        penolakan: { alasan: 'bukan_anggota_sk', pesan: 'Akun Anda tidak terdaftar pada SK penilaian kinerja yang aktif.' },
      };
    default:
      return dasar;
  }
}
