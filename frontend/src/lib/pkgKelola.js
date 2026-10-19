// Pengelolaan PKG oleh kepala madrasah: periode, SK, dan anggota (tim penilai & guru yang dinilai).
//
// TIRUAN SEMENTARA: fungsi di bawah meniru kontrak API yang direncanakan dan menyimpan data di memori
// (hilang saat halaman dimuat ulang). Saat endpoint backend tersedia, isi tiap fungsi diganti panggilan
// `api` dengan bentuk data yang sama:
//   GET  /pkg/periode                    -> [periode]
//   POST /pkg/periode | PUT /pkg/periode/{id} -> periode   body: { nama_periode, semester_id, tahun_pelajaran,
//                                                            semester, tanggal_buka, tanggal_tutup }
//   POST /pkg/periode/{id}/status        -> periode        body: { status: 'berjalan' | 'ditutup' }
//   GET  /pkg/sk                         -> [sk]           (urut periode terbaru)
//   POST /pkg/sk  | PUT /pkg/sk/{id}     -> sk             body: { nomor_sk, tanggal_sk, tentang, periode_id }
//   POST /pkg/sk/{id}/aktifkan           -> sk             (SK lain di periode yang sama dinonaktifkan)
//   GET  /users/teachers                 -> [{ id, full_name, username, roles }]
// periode = { id, nama_periode, semester_id, tahun_pelajaran, semester, tanggal_buka, tanggal_tutup,
//             status: 'draf' | 'berjalan' | 'ditutup' }   (hanya satu periode 'berjalan')
// sk = { id, nomor_sk, tanggal_sk, tentang, periode_id, is_active, penilai: [anggota], dinilai: [anggota] }
// anggota = { id, nama, nip, mapel }   (snapshot identitas periode)

const tunda = (hasil) => new Promise((r) => { setTimeout(() => r(JSON.parse(JSON.stringify(hasil))), 150); });

const GURU = [
  { id: 'u-kepala', nama: 'Drs. H. Mahmud, M.Pd.', nip: '196805121994031003', mapel: '-', kepala: true },
  { id: 'u-1', nama: 'Ahmad Fauzi, S.Pd.', nip: '198703122019031004', mapel: 'Matematika' },
  { id: 'u-2', nama: 'Siti Rahmawati, S.Ag.', nip: '199001252020122012', mapel: 'Akidah Akhlak' },
  { id: 'u-3', nama: 'Dedi Kurniawan, M.Pd.', nip: '198511082014031002', mapel: 'Bahasa Inggris' },
  { id: 'u-4', nama: 'Nur Aini, S.Si.', nip: null, mapel: 'IPA' },
  { id: 'u-5', nama: 'Rina Kartika, S.Pd.', nip: '199204172022212008', mapel: 'Bahasa Indonesia' },
  { id: 'u-6', nama: 'Hasan Basri, S.Pd.I.', nip: '198309202009011007', mapel: 'Fikih' },
  { id: 'u-7', nama: 'Lilis Suryani, S.Pd.', nip: null, mapel: 'IPS' },
];

const anggota = (id) => {
  const g = GURU.find((x) => x.id === id);
  return { id: g.id, nama: g.nama, nip: g.nip, mapel: g.mapel };
};

const store = {
  periode: [
    { id: 'p-2026-ganjil', nama_periode: 'PKG Semester Ganjil 2026/2027', tahun_pelajaran: '2026/2027', semester: 'Ganjil', tanggal_buka: '2026-10-01', tanggal_tutup: '2026-11-30', status: 'berjalan' },
    { id: 'p-2025-genap', nama_periode: 'PKG Semester Genap 2025/2026', tahun_pelajaran: '2025/2026', semester: 'Genap', tanggal_buka: '2026-03-01', tanggal_tutup: '2026-04-30', status: 'ditutup' },
  ],
  sk: [
    {
      id: 'sk-1', nomor_sk: 'B-123/Mts.10.05/KP.07.6/10/2026', tanggal_sk: '2026-09-28',
      tentang: 'Tim Penilai Kinerja Guru Semester Ganjil 2026/2027', periode_id: 'p-2026-ganjil', is_active: true,
      penilai: ['u-kepala', 'u-1', 'u-3'].map(anggota), dinilai: ['u-1', 'u-2', 'u-4', 'u-5', 'u-6'].map(anggota),
    },
    {
      id: 'sk-0', nomor_sk: 'B-045/Mts.10.05/KP.07.6/02/2026', tanggal_sk: '2026-02-20',
      tentang: 'Tim Penilai Kinerja Guru Semester Genap 2025/2026', periode_id: 'p-2025-genap', is_active: true,
      penilai: ['u-kepala', 'u-3'].map(anggota), dinilai: ['u-1', 'u-2', 'u-5'].map(anggota),
    },
  ],
};

class GalatValidasi extends Error {}

export const daftarPeriode = () => tunda(store.periode);

export const daftarSk = () => tunda([...store.sk].sort((a, b) => (b.tanggal_sk || '').localeCompare(a.tanggal_sk || '')));

export const daftarGuruTiruan = () => tunda(GURU);

export async function simpanSk(data, id = null) {
  const nomor = (data.nomor_sk || '').trim();
  if (!nomor) throw new GalatValidasi('Nomor SK wajib diisi.');
  if (!data.periode_id) throw new GalatValidasi('Periode PKG wajib dipilih.');
  if (!data.tanggal_sk) throw new GalatValidasi('Tanggal SK wajib diisi.');
  if (store.sk.some((s) => s.id !== id && s.nomor_sk.toLowerCase() === nomor.toLowerCase())) {
    throw new GalatValidasi('Nomor SK sudah dipakai SK lain.');
  }
  const isi = { nomor_sk: nomor, tanggal_sk: data.tanggal_sk, tentang: (data.tentang || '').trim(), periode_id: data.periode_id };
  if (id) {
    const sk = store.sk.find((s) => s.id === id);
    if (!sk) throw new GalatValidasi('SK tidak ditemukan.');
    Object.assign(sk, isi);
    return tunda(sk);
  }
  const adaAktif = store.sk.some((s) => s.periode_id === data.periode_id && s.is_active);
  const baru = { id: `sk-${Date.now()}`, ...isi, is_active: !adaAktif, penilai: [anggota('u-kepala')], dinilai: [] };
  store.sk.push(baru);
  return tunda(baru);
}

export async function aktifkanSk(id) {
  const sk = store.sk.find((s) => s.id === id);
  if (!sk) throw new GalatValidasi('SK tidak ditemukan.');
  store.sk.forEach((s) => { if (s.periode_id === sk.periode_id) s.is_active = s.id === id; });
  return tunda(sk);
}

// Transisi status periode yang diizinkan: draf -> berjalan -> ditutup.
export const TRANSISI_PERIODE = { draf: 'berjalan', berjalan: 'ditutup' };

export async function simpanPeriode(data, id = null) {
  const nama = (data.nama_periode || '').trim();
  if (!nama) throw new GalatValidasi('Nama periode wajib diisi.');
  if (!data.tahun_pelajaran || !data.semester) throw new GalatValidasi('Tahun pelajaran dan semester wajib diisi.');
  if (!data.tanggal_buka || !data.tanggal_tutup) throw new GalatValidasi('Tanggal buka dan tutup wajib diisi.');
  if (data.tanggal_tutup < data.tanggal_buka) throw new GalatValidasi('Tanggal tutup tidak boleh sebelum tanggal buka.');
  const isi = {
    nama_periode: nama, semester_id: data.semester_id || null, tahun_pelajaran: data.tahun_pelajaran,
    semester: data.semester, tanggal_buka: data.tanggal_buka, tanggal_tutup: data.tanggal_tutup,
  };
  if (id) {
    const p = store.periode.find((x) => x.id === id);
    if (!p) throw new GalatValidasi('Periode tidak ditemukan.');
    if (p.status === 'ditutup') throw new GalatValidasi('Periode yang sudah ditutup tidak dapat diubah.');
    Object.assign(p, isi);
    return tunda(p);
  }
  const baru = { id: `p-${Date.now()}`, ...isi, status: 'draf' };
  store.periode.unshift(baru);
  return tunda(baru);
}

export async function ubahStatusPeriode(id, status) {
  const p = store.periode.find((x) => x.id === id);
  if (!p) throw new GalatValidasi('Periode tidak ditemukan.');
  if (TRANSISI_PERIODE[p.status] !== status) throw new GalatValidasi('Perubahan status periode tidak diizinkan.');
  if (status === 'berjalan' && store.periode.some((x) => x.id !== id && x.status === 'berjalan')) {
    throw new GalatValidasi('Masih ada periode lain yang berjalan. Tutup periode tersebut lebih dahulu.');
  }
  p.status = status;
  return tunda(p);
}
