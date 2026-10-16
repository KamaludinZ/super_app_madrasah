// Master Jenis Pelanggaran: kelola jenis aturan (kode, nama, jalur poin, besar poin, kategori, deskripsi, aktif).
// SEMENTARA memakai data tiruan di memori (frontend dibangun lebih dulu). Kontrak yang diasumsikan:
//   GET    /tatib/jenis-aturan                  -> [{ id, kode_aturan, nama, jalur_poin, besar_poin, poin, kategori_id,
//                                                     kategori_nama, deskripsi, aktif, jumlah_catatan }]
//   POST   /tatib/jenis-aturan                  -> jenis ; PUT /tatib/jenis-aturan/{id} -> jenis
//   PATCH  /tatib/jenis-aturan/{id}/aktif       -> { aktif } (nonaktif tanpa menghapus riwayat)
//   GET    /tatib/kategori                      -> [{ id, nama }]

const jeda = (data) => new Promise((resolve) => setTimeout(() => resolve(structuredClone(data)), 150));

const kategoriTiruan = [
  { id: 'kat-kedisiplinan', nama: 'Kedisiplinan' },
  { id: 'kat-kerapian', nama: 'Kerapian' },
  { id: 'kat-akhlak', nama: 'Akhlak & Ibadah' },
];

const jenisTiruan = [
  { id: 'jen-1', kode_aturan: 'DIS-01', nama: 'Terlambat masuk madrasah', jalur_poin: 'minus', besar_poin: 5, kategori_id: 'kat-kedisiplinan', deskripsi: 'Datang setelah bel masuk', aktif: true, jumlah_catatan: 12 },
  { id: 'jen-2', kode_aturan: 'DIS-02', nama: 'Membolos jam pelajaran', jalur_poin: 'minus', besar_poin: 15, kategori_id: 'kat-kedisiplinan', deskripsi: '', aktif: true, jumlah_catatan: 3 },
  { id: 'jen-3', kode_aturan: 'KER-01', nama: 'Seragam tidak sesuai jadwal', jalur_poin: 'minus', besar_poin: 5, kategori_id: 'kat-kerapian', deskripsi: '', aktif: true, jumlah_catatan: 0 },
  { id: 'jen-5', kode_aturan: 'AKH-01', nama: 'Menjadi imam/muadzin salat berjamaah', jalur_poin: 'plus', besar_poin: 5, kategori_id: 'kat-akhlak', deskripsi: '', aktif: true, jumlah_catatan: 7 },
  { id: 'jen-7', kode_aturan: 'AKH-03', nama: 'Berkata kasar kepada teman', jalur_poin: 'minus', besar_poin: 10, kategori_id: 'kat-akhlak', deskripsi: '', aktif: false, jumlah_catatan: 2 },
];

const namaKategori = (id) => kategoriTiruan.find((k) => k.id === id)?.nama || 'Lainnya';

const tampil = (j) => ({
  ...j,
  kategori_nama: namaKategori(j.kategori_id),
  poin: j.jalur_poin === 'minus' ? -Math.abs(j.besar_poin) : Math.abs(j.besar_poin),
});

export const ambilMasterJenis = () => jeda(jenisTiruan.map(tampil));

export const ambilKategoriMaster = () => jeda(kategoriTiruan);

// Tambah (tanpa id) atau ubah jenis aturan. Kode dirapikan huruf besar tanpa spasi tepi.
export async function simpanMasterJenis({ id, kode_aturan, nama, jalur_poin, besar_poin, kategori_id, deskripsi }) {
  const isian = {
    kode_aturan: (kode_aturan || '').trim().toUpperCase(),
    nama: (nama || '').trim(),
    jalur_poin,
    besar_poin: Math.abs(parseInt(besar_poin, 10) || 0),
    kategori_id,
    deskripsi: (deskripsi || '').trim(),
  };
  if (id) {
    const i = jenisTiruan.findIndex((j) => j.id === id);
    if (i < 0) throw new Error('Jenis aturan tidak ditemukan');
    jenisTiruan[i] = { ...jenisTiruan[i], ...isian };
    return jeda(tampil(jenisTiruan[i]));
  }
  const baru = { id: `jen-${Date.now()}`, ...isian, aktif: true, jumlah_catatan: 0 };
  jenisTiruan.push(baru);
  return jeda(tampil(baru));
}

// Tambah kategori dari form jenis (kontrak sama dengan Input Tata Tertib: POST /tatib/kategori).
export async function simpanKategoriMaster({ nama, deskripsi }) {
  const rapi = (nama || '').trim();
  if (!rapi) throw new Error('Nama kategori wajib diisi');
  if (kategoriTiruan.some((k) => k.nama.toLowerCase() === rapi.toLowerCase())) throw new Error(`Kategori "${rapi}" sudah ada`);
  const baru = { id: `kat-${Date.now()}`, nama: rapi, deskripsi: (deskripsi || '').trim() };
  kategoriTiruan.push(baru);
  return jeda(baru);
}
