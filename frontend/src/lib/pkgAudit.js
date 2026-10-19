// Jejak audit modul PKG (koleksi pkg_audit_log), khusus kepala madrasah.
//
// TIRUAN SEMENTARA: meniru kontrak yang direncanakan; saat endpoint backend tersedia ganti dengan `api`:
//   GET /pkg/audit?halaman=&per_halaman=&kategori=&aksi=&dari=&sampai=&cari=
//       -> { item: [entri], total, halaman, per_halaman }   (terbaru dulu)
// entri = { id, aksi, label, kategori, aktor_nama, aktor_peran, timestamp, terakhir, jumlah, penilaian_id,
//           ip_address, metadata, ringkasan }
//   GET /pkg/audit/guru/{guru_id}?periode_id= -> [aksiLembar]  (riwayat aksi lembar penilaian satu guru)
// aksiLembar = { aksi, label, aktor_nama, timestamp, terakhir, jumlah, progres, nilai_akhir }
//   (bentuk sama dengan GET /pkg/penilaian/lembar/{guru_id}/riwayat milik penilai)
// Aksi berulang (buka beranda, draf, lihat rekap, penolakan) dicatat harian dengan `jumlah` & `terakhir`.

// Kategori aksi (sama dengan backend pkg_audit.LABEL_AKSI, dikelompokkan untuk saringan & warna penanda).
export const KATEGORI_AUDIT = {
  penilaian: { label: 'Penilaian', kelas: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  instrumen: { label: 'Instrumen', kelas: 'bg-violet-100 text-violet-800 border-violet-200' },
  susunan: { label: 'Periode & SK', kelas: 'bg-sky-100 text-sky-800 border-sky-200' },
  unduhan: { label: 'Cetak & unduh', kelas: 'bg-amber-100 text-amber-800 border-amber-200' },
  akses: { label: 'Akses', kelas: 'bg-slate-100 text-slate-700 border-slate-200' },
};

const tunda = (hasil, ms = 200) => new Promise((r) => { setTimeout(() => r(JSON.parse(JSON.stringify(hasil))), ms); });

let n = 0;
const entri = (aksi, label, kategori, aktor, waktu, ringkasan, tambahan = {}) => ({
  id: `a${(n += 1)}`, aksi, label, kategori, aktor_nama: aktor, aktor_peran: aktor.startsWith('Drs') ? 'kepala_sekolah' : 'guru',
  timestamp: waktu, terakhir: null, jumlah: null, penilaian_id: null, ip_address: '10.0.0.12', metadata: {}, ringkasan, ...tambahan,
});

const KEPALA = 'Drs. H. Mahmud, M.Pd.';
const TIRUAN = [
  entri('penilaian_kirim', 'Mengirim & mengunci penilaian', 'penilaian', 'Ahmad Fauzi, S.Pd.', '2026-10-19T09:12:00+07:00', 'Siti Rahmawati · nilai 36/60 (60,00%)', { penilaian_id: 'n2', metadata: { nilai_akhir: 36, nilai_maks: 60, capaian_persen: 60, predikat: 'Terpenuhi pada Jenjang Jabatan Guru Ahli Muda' } }),
  entri('cetak_template', 'Mencetak dokumen dari template', 'unduhan', KEPALA, '2026-10-19T08:40:00+07:00', 'Rekap_Hasil_PKG.pdf · PDF (LibreOffice) · template v2026', { metadata: { format: 'pdf', mesin: 'libreoffice', nama_berkas: 'Rekap_Hasil_PKG.pdf' } }),
  entri('penilaian_draf', 'Menyimpan draf penilaian', 'penilaian', 'Ahmad Fauzi, S.Pd.', '2026-10-19T08:05:00+07:00', 'Siti Rahmawati · progres 75%', { penilaian_id: 'n2', jumlah: 14, terakhir: '2026-10-19T09:10:00+07:00' }),
  entri('tolak_akses', 'Akses ditolak', 'akses', 'Lilis Suryani, S.Pd.', '2026-10-19T07:55:00+07:00', '/api/pkg/beranda · bukan anggota SK', { jumlah: 3, terakhir: '2026-10-19T08:30:00+07:00', metadata: { endpoint: '/api/pkg/beranda', alasan: 'bukan_anggota_sk' } }),
  entri('instrumen_ubah', 'Mengubah instrumen', 'instrumen', KEPALA, '2026-10-18T14:20:00+07:00', 'Sub 2.1 · Bobot: 1 -> 1.5 · alasan: penyesuaian juknis', { metadata: { kode_sub: '2.1', alasan: 'penyesuaian juknis', perubahan: ['Bobot: 1 -> 1.5'] } }),
  entri('supervisi_tandai', 'Menandai supervisi penilai', 'susunan', KEPALA, '2026-10-08T10:00:00+07:00', 'Ahmad Fauzi · 8 Oktober 2026'),
  entri('penugasan_simpan', 'Menyimpan pembagian penilaian', 'susunan', KEPALA, '2026-10-05T13:15:00+07:00', '3 penilai diperbarui'),
  entri('instrumen_impor', 'Mengimpor instrumen', 'instrumen', KEPALA, '2026-10-01T08:00:00+07:00', 'pkg_template_v2026.xlsx · Rev 1 · checksum cocok'),
  entri('sk_buat', 'Menambah SK', 'susunan', KEPALA, '2026-09-28T09:30:00+07:00', 'B-123/Mts.10.05/KP.07.6/10/2026'),
  entri('periode_berjalan', 'Memulai periode', 'susunan', KEPALA, '2026-09-28T09:00:00+07:00', 'PKG Semester Ganjil 2026/2027'),
  entri('buka_beranda', 'Membuka Beranda PKG', 'akses', 'Dedi Kurniawan, M.Pd.', '2026-10-19T06:45:00+07:00', 'Periode berjalan', { jumlah: 2, terakhir: '2026-10-19T09:00:00+07:00' }),
];

// Jenis aksi per kategori untuk saringan (kode sama dengan backend pkg_audit.LABEL_AKSI).
export const AKSI_PER_KATEGORI = {
  penilaian: { penilaian_mulai: 'Memulai lembar penilaian', penilaian_buka: 'Membuka lembar penilaian', penilaian_draf: 'Menyimpan draf penilaian', penilaian_kirim: 'Mengirim & mengunci penilaian' },
  instrumen: { instrumen_impor: 'Mengimpor instrumen', instrumen_ubah: 'Mengubah instrumen', instrumen_aktifkan: 'Menetapkan instrumen acuan' },
  susunan: { periode_buat: 'Menetapkan periode', periode_berjalan: 'Memulai periode', periode_ditutup: 'Menutup periode', sk_buat: 'Menambah SK', sk_penilai: 'Mengubah tim penilai', sk_dinilai: 'Mengubah guru yang dinilai', penugasan_simpan: 'Menyimpan pembagian penilaian', supervisi_tandai: 'Menandai supervisi penilai', supervisi_batal: 'Membatalkan supervisi penilai' },
  unduhan: { cetak_template: 'Mencetak dokumen dari template', lihat_template: 'Melihat info template' },
  akses: { buka_beranda: 'Membuka Beranda PKG', tolak_akses: 'Akses ditolak', lihat_rekap: 'Melihat rekap' },
};

// Saringan: kategori, aksi, dari/sampai ('YYYY-MM-DD', inklusif, WIB), cari (pelaku/ringkasan/label).
export async function daftarAudit({ halaman = 1, perHalaman = 10, kategori, aksi, dari, sampai, cari } = {}) {
  const kata = (cari || '').trim().toLowerCase();
  const tanggal = (e) => (e.terakhir || e.timestamp).slice(0, 10);
  const urut = TIRUAN
    .filter((e) => !kategori || e.kategori === kategori)
    .filter((e) => !aksi || e.aksi === aksi)
    .filter((e) => (!dari || tanggal(e) >= dari) && (!sampai || e.timestamp.slice(0, 10) <= sampai))
    .filter((e) => !kata || [e.aktor_nama, e.ringkasan, e.label].some((v) => (v || '').toLowerCase().includes(kata)))
    .sort((a, b) => (b.terakhir || b.timestamp).localeCompare(a.terakhir || a.timestamp));
  const mulai = (halaman - 1) * perHalaman;
  return tunda({ item: urut.slice(mulai, mulai + perHalaman), total: urut.length, halaman, per_halaman: perHalaman });
}

export async function riwayatAksiGuru(guruId) {
  if (!guruId) return [];
  return tunda([
    { aksi: 'penilaian_kirim', label: 'Mengirim & mengunci penilaian', aktor_nama: 'Ahmad Fauzi, S.Pd.', timestamp: '2026-10-19T09:12:00+07:00', nilai_akhir: 36 },
    { aksi: 'penilaian_draf', label: 'Menyimpan draf penilaian', aktor_nama: 'Ahmad Fauzi, S.Pd.', timestamp: '2026-10-19T08:05:00+07:00', terakhir: '2026-10-19T09:10:00+07:00', jumlah: 14, progres: 100 },
    { aksi: 'penilaian_buka', label: 'Membuka lembar penilaian', aktor_nama: 'Ahmad Fauzi, S.Pd.', timestamp: '2026-10-19T08:00:00+07:00', jumlah: 3 },
    { aksi: 'penilaian_draf', label: 'Menyimpan draf penilaian', aktor_nama: 'Ahmad Fauzi, S.Pd.', timestamp: '2026-10-17T13:00:00+07:00', terakhir: '2026-10-17T13:40:00+07:00', jumlah: 6, progres: 58 },
    { aksi: 'penilaian_mulai', label: 'Memulai lembar penilaian', aktor_nama: 'Ahmad Fauzi, S.Pd.', timestamp: '2026-10-17T13:00:00+07:00' },
  ]);
}
