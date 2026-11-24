/**
 * Ujian Madrasah (UTS/UAS): kepanitiaan, ruang & peserta, formulir daftar hadir/berita acara, cetak & arsip,
 * serta nilai UAS. Semua data ujian terikat pada tahun pelajaran + semester; beranda hanya menampilkan ujian
 * semester aktif (konteks lihat pengguna), ujian semester lalu menjadi arsip.
 *
 * Kontrak server (backend menyusul; koleksi `ujian`, `panitia_ujian`, `formulir_ujian`, ...):
 *   GET /ujian/beranda
 *     -> { konteks: { semester_id, semester_nama, tahun_pelajaran, is_override }, items: [Ujian],
 *          akses: { pengelola, pimpinan, jabatan: [jabatan] }, menu: [MenuUjian] }
 *        (hanya ujian pada semester konteks lihat pengguna, urut tanggal mulai; `jabatan` = jabatan pengguna
 *         pada ujian-ujian itu; `menu` = katalog MENU_UJIAN dengan akses sesuai peran & jabatan)
 *
 *   GET /ujian/status-formulir
 *     -> { tanggal, jam, ringkasan: { tertutup, dibuka, selesai }, items: [{ ujian_id, formulir }] }
 *        (ringan, dipantau berkala oleh beranda; jam server WIB)
 *
 *   GET /ujian/arsip-semester
 *     -> { semester: [{ semester_id, semester_nama, tahun_pelajaran, items: [Ujian] }] }
 *        (ujian semester-semester sebelum semester konteks lihat, terbaru dulu; pengelola & kepala madrasah
 *         melihat semua, ketua/sekretaris hanya ujian tempat ia menjabat; peran lain 403)
 *
 *   GET /ujian/panitia                      (pengelola: admin)
 *     -> { konteks, items: [{ ujian: Ujian, panitia: Panitia, diubah: { oleh_nama, pada }|null }] }
 *        (ujian semester konteks lihat; `diubah` = perubahan susunan terakhir)
 *   POST /ujian { jenis, nama, mulai, selesai }
 *     -> Ujian   (pengelola; terikat semester konteks lihat; formulir awal tertutup)
 *
 *   GET /ujian/gtk-pilihan                  (pengelola)
 *     -> { items: [Pejabat] }   (akun GTK & pimpinan yang aktif, urut nama; sumber pilihan pejabat panitia)
 *   PUT /ujian/{ujian_id}/panitia { penanggung_jawab, ketua, sekretaris, bendahara, versi }   (nilai = user_id | null;
 *       versi = diubah.pada yang dilihat klien, '' bila belum pernah diubah -> 409 bila sudah diubah orang lain)
 *     -> { ujian_id, panitia: Panitia, diubah }   (pengelola; satu orang hanya satu jabatan per ujian; tercatat di audit)
 *
 *   Panitia = { penanggung_jawab: Pejabat|null, ketua: Pejabat|null, sekretaris: Pejabat|null, bendahara: Pejabat|null }
 *   Pejabat = { user_id, nama, nip, peran }
 *
 *   GET /ujian/akses-saya
 *     -> { pengelola, pimpinan, jabatan: [jabatan], menu: [MenuUjian] }
 *        (dasar grup menu "Ujian Madrasah" di sidebar: jabatan = gabungan jabatan pengguna pada ujian semester aktif)
 *
 *   GET /ujian/{ujian_id}/detail
 *     -> { ujian: Ujian, akses: { pengelola, pimpinan, jabatan }, menu: [{ key, label, to, akses }] }
 *        (menu menurut jabatan pengguna PADA ujian itu; 403 bila tidak berhak atas menu mana pun)
 *
 *   MenuUjian = { key, label, keterangan, to, akses: bool, alasan: null|'bukan_panitia'|'khusus_pengelola'|... }
 *
 *   Ujian = { id, jenis: 'UTS'|'UAS', nama, tahun_pelajaran, semester, semester_id,
 *             mulai: 'YYYY-MM-DD', selesai: 'YYYY-MM-DD',
 *             formulir: { aktif, jam_buka: 'HH:MM'|null, jam_tutup: 'HH:MM'|null,
 *                         status: 'tertutup'|'dibuka'|'selesai',
 *                         alasan: null|'nonaktif'|'belum_mulai'|'sudah_selesai'|'di_luar_jam', pesan },
 *             jumlah_ruang, jumlah_peserta, jabatan_saya: null|'penanggung_jawab'|'ketua'|'sekretaris'|'bendahara' }
 *
 * Bila server belum menyediakan endpoint (404 "Not Found") dipakai data contoh berlabel (`tiruan: true`)
 * agar tampilan bisa dicoba.
 */
import { api } from '@/lib/api';
import { hariIniWIB } from '@/lib/tanggal';

export const HALAMAN_BERANDA_UJIAN = '/ujian';

// Sama dengan PERAN_PENGELOLA_UJIAN / PERAN_PIMPINAN_UJIAN di backend/ujian.py. Pengelola (admin) mengatur seluruh
// ujian; pimpinan (kepala madrasah, waka kurikulum) memantau. GTK lain mendapat akses dari jabatan panitia.
export const PERAN_PENGELOLA_UJIAN = ['admin'];
export const PERAN_PIMPINAN_UJIAN = ['kepala_sekolah', 'waka_kurikulum'];
// Peran non-GTK tidak pernah menjadi panitia (sama dengan PERAN_NON_GTK di lib/menuUmum.js).
const PERAN_BUKAN_PANITIA = ['siswa', 'kelas', 'orang_tua', 'alumni', 'satpam'];
export const mungkinPanitia = (role) => !!role && !PERAN_BUKAN_PANITIA.includes(role);

export const JENIS_UJIAN = {
  UTS: { label: 'UTS', nama: 'Asesmen Sumatif Tengah Semester', kelas: 'bg-sky-100 text-sky-800 border-sky-200' },
  UAS: { label: 'UAS', nama: 'Asesmen Sumatif Akhir Semester', kelas: 'bg-violet-100 text-violet-800 border-violet-200' },
};

// Status formulir daftar hadir & berita acara (satu pengaturan per ujian, berlaku untuk semua ruang).
export const STATUS_FORMULIR = {
  tertutup: { label: 'Tertutup', keterangan: 'Formulir belum dibuka panitia', kelas: 'bg-slate-100 text-slate-700 border-slate-200' },
  dibuka: { label: 'Sedang dibuka', keterangan: 'Peserta & pengawas dapat mengisi', kelas: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  selesai: { label: 'Selesai', keterangan: 'Masa ujian sudah berakhir', kelas: 'bg-amber-100 text-amber-800 border-amber-200' },
};

// Urutan jabatan panitia pada susunan & cetak.
export const JABATAN_PANITIA = ['penanggung_jawab', 'ketua', 'sekretaris', 'bendahara'];

export const LABEL_JABATAN = {
  penanggung_jawab: 'Penanggung Jawab',
  ketua: 'Ketua Panitia',
  sekretaris: 'Sekretaris Panitia',
  bendahara: 'Bendahara Panitia',
};

// ---- Menu kepanitiaan ----
// Katalog sub-menu modul Ujian. Akses: pengelola (admin) semua menu; kepala madrasah & waka kurikulum memantau;
// panitia sesuai jabatannya. Sama dengan AKSES_MENU_UJIAN di backend/ujian.py.
export const MENU_UJIAN = [
  { key: 'panitia', label: 'Kepanitiaan', to: '/ujian/panitia', keterangan: 'Susun panitia UTS/UAS dari akun GTK' },
  { key: 'ruang', label: 'Ruang & Peserta', to: '/ujian/ruang', keterangan: 'Ruang ujian, peserta, dan nomor peserta' },
  { key: 'pengawas', label: 'Guru Pengawas', to: '/ujian/pengawas', keterangan: 'Master pilihan guru pengawas' },
  { key: 'formulir', label: 'Pengaturan Formulir', to: '/ujian/formulir', keterangan: 'Jendela waktu & template cetak' },
  { key: 'tautan_publik', label: 'Tautan Publik', to: '/ujian/tautan-publik', keterangan: 'Info ujian siswa & monitoring pengumpulan soal' },
  { key: 'info_ujian', label: 'Info Ujian', to: '/ujian/info-ujian', keterangan: 'Tata tertib & panduan CBT untuk siswa' },
  { key: 'berkas_soal', label: 'Berkas Soal', to: '/ujian/berkas-soal', keterangan: 'Status kisi-kisi & kartu soal, PJ, unduh ZIP' },
  { key: 'audit_publik', label: 'Jejak Audit Publik', to: '/ujian/audit-publik', keterangan: 'Riwayat akses tautan & unduhan berkas' },
  { key: 'daftar_hadir', label: 'Daftar Hadir', to: '/ujian/daftar-hadir', keterangan: 'Pantau kehadiran, izin & sakit' },
  { key: 'berita_acara', label: 'Berita Acara', to: '/ujian/berita-acara', keterangan: 'Berita acara pengawas per ruang' },
  { key: 'cetak', label: 'Cetak Dokumen', to: '/ujian/cetak', keterangan: 'Daftar hadir & berita acara per jenjang' },
  { key: 'kartu_peserta', label: 'Kartu Peserta', to: '/ujian/kartu-peserta', keterangan: 'Cetak kartu peserta per ruang · A4' },
  { key: 'kartu_meja', label: 'Kartu Meja', to: '/ujian/kartu-meja', keterangan: 'Cetak kartu meja peserta per ruang · A4' },
  { key: 'arsip', label: 'Arsip Administrasi', to: '/ujian/arsip', keterangan: 'Dokumen ujian tercetak · akses terbatas' },
  { key: 'nilai', label: 'Nilai UAS', to: '/ujian/nilai', keterangan: 'Template & impor nilai UAS' },
];

const SEMUA_JABATAN = ['penanggung_jawab', 'ketua', 'sekretaris', 'bendahara'];
// key menu -> { pimpinan: kepala madrasah boleh, jabatan: jabatan panitia yang boleh }. Pengelola selalu boleh.
export const AKSES_MENU_UJIAN = {
  panitia: { pimpinan: false, jabatan: [] },
  ruang: { pimpinan: false, jabatan: ['ketua', 'sekretaris'] },
  pengawas: { pimpinan: false, jabatan: ['ketua', 'sekretaris'] },
  formulir: { pimpinan: false, jabatan: ['ketua', 'sekretaris'] },
  tautan_publik: { pimpinan: true, jabatan: ['ketua', 'sekretaris'] }, // mengubah: admin saja (boleh_ubah)
  info_ujian: { pimpinan: true, jabatan: ['ketua', 'sekretaris'] }, // mengisi tata tertib & panduan: admin saja (boleh_ubah)
  berkas_soal: { pimpinan: true, jabatan: ['ketua', 'sekretaris'] }, // isi kartu soal: admin saja
  audit_publik: { pimpinan: true, jabatan: ['ketua', 'sekretaris'] },
  daftar_hadir: { pimpinan: true, jabatan: SEMUA_JABATAN },
  berita_acara: { pimpinan: true, jabatan: SEMUA_JABATAN },
  cetak: { pimpinan: true, jabatan: SEMUA_JABATAN },
  kartu_peserta: { pimpinan: true, jabatan: SEMUA_JABATAN },
  kartu_meja: { pimpinan: true, jabatan: SEMUA_JABATAN },
  arsip: { pimpinan: true, jabatan: ['ketua', 'sekretaris'] },
  nilai: { pimpinan: false, jabatan: ['ketua', 'sekretaris'] },
};

// Rute sub-menu yang halamannya sudah dibangun; menu lain tampil "Segera".
export const RUTE_UJIAN_TERSEDIA = new Set(['/ujian', '/ujian/arsip-semester', '/ujian/panitia', '/ujian/ruang', '/ujian/pengawas', '/ujian/formulir', '/ujian/tautan-publik', '/ujian/info-ujian', '/ujian/unggah-berkas', '/ujian/berkas-soal', '/ujian/audit-publik', '/ujian/daftar-hadir', '/ujian/berita-acara', '/ujian/cetak', '/ujian/arsip', '/ujian/nilai', '/ujian/kartu-peserta', '/ujian/kartu-meja']);
export const HALAMAN_ARSIP_SEMESTER = '/ujian/arsip-semester';

/** Menu kepanitiaan untuk pengguna: akses dari peran pengelola/pimpinan atau jabatan panitia (gabungan). */
export function menuPanitiaUjian({ pengelola = false, pimpinan = false, jabatan = [] } = {}) {
  return MENU_UJIAN.map((m) => {
    const aturan = AKSES_MENU_UJIAN[m.key];
    const akses = pengelola || (pimpinan && aturan.pimpinan) || jabatan.some((j) => aturan.jabatan.includes(j));
    let alasan = null;
    if (!akses) alasan = !jabatan.length && !pimpinan ? 'bukan_panitia' : aturan.jabatan.length ? 'jabatan_lain' : 'khusus_pengelola';
    return { ...m, akses, alasan };
  });
}

// ---- Data tiruan (tanggal relatif terhadap hari ini agar status selalu bervariasi) ----
function geserHari(n) {
  const d = new Date(`${hariIniWIB()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function berandaTiruan(peran) {
  const konteks = { semester_id: 'contoh-semester', semester_nama: 'Ganjil', tahun_pelajaran: '2026/2027', is_override: false };
  const dasar = { tahun_pelajaran: konteks.tahun_pelajaran, semester: konteks.semester_nama, semester_id: konteks.semester_id };
  const hasil = {
    konteks,
    items: [
      {
        ...dasar, id: 'contoh-uts', jenis: 'UTS', nama: 'ASTS Ganjil 2026/2027 (contoh)',
        mulai: geserHari(-40), selesai: geserHari(-35),
        formulir: { aktif: false, jam_buka: '07:00', jam_tutup: '12:00', status: 'selesai' },
        jumlah_ruang: 12, jumlah_peserta: 384, jabatan_saya: null,
      },
      {
        ...dasar, id: 'contoh-uas-susulan', jenis: 'UTS', nama: 'ASTS Susulan (contoh)',
        mulai: geserHari(0), selesai: geserHari(1),
        formulir: { aktif: true, jam_buka: '07:00', jam_tutup: '12:00', status: 'dibuka' },
        jumlah_ruang: 1, jumlah_peserta: 18, jabatan_saya: 'sekretaris',
      },
      {
        ...dasar, id: 'contoh-uas', jenis: 'UAS', nama: 'ASAS Ganjil 2026/2027 (contoh)',
        mulai: geserHari(14), selesai: geserHari(20),
        formulir: { aktif: false, jam_buka: null, jam_tutup: null, status: 'tertutup' },
        jumlah_ruang: 12, jumlah_peserta: 0, jabatan_saya: 'ketua',
      },
    ],
  };
  const akses = {
    pengelola: PERAN_PENGELOLA_UJIAN.includes(peran),
    pimpinan: PERAN_PIMPINAN_UJIAN.includes(peran),
    jabatan: [...new Set(hasil.items.map((u) => u.jabatan_saya).filter(Boolean))],
  };
  return { ...hasil, akses, menu: menuPanitiaUjian(akses) };
}

export function arsipSemesterTiruan() {
  const ujian = (sem, tp, id, jenis, nama, mulai, selesai, ruang, peserta) => ({
    id, jenis, nama, tahun_pelajaran: tp, semester: sem, semester_id: `contoh-${tp}-${sem}`, mulai, selesai,
    formulir: { aktif: false, jam_buka: '07:00', jam_tutup: '12:00', status: 'selesai' },
    jumlah_ruang: ruang, jumlah_peserta: peserta, jabatan_saya: null,
  });
  return {
    semester: [
      {
        semester_id: 'contoh-2025/2026-Genap', semester_nama: 'Genap', tahun_pelajaran: '2025/2026',
        items: [
          ujian('Genap', '2025/2026', 'contoh-arsip-1', 'UTS', 'ASTS Genap 2025/2026 (contoh)', '2026-03-09', '2026-03-14', 12, 380),
          ujian('Genap', '2025/2026', 'contoh-arsip-2', 'UAS', 'ASAT 2025/2026 (contoh)', '2026-06-01', '2026-06-08', 12, 378),
        ],
      },
      {
        semester_id: 'contoh-2025/2026-Ganjil', semester_nama: 'Ganjil', tahun_pelajaran: '2025/2026',
        items: [
          ujian('Ganjil', '2025/2026', 'contoh-arsip-3', 'UTS', 'ASTS Ganjil 2025/2026 (contoh)', '2025-09-22', '2025-09-27', 12, 382),
          ujian('Ganjil', '2025/2026', 'contoh-arsip-4', 'UAS', 'ASAS Ganjil 2025/2026 (contoh)', '2025-12-01', '2025-12-06', 12, 382),
        ],
      },
    ],
  };
}

// Penyimpanan data contoh kepanitiaan selama sesi (agar tambah ujian / ubah panitia terasa saat dicoba).
let kepanitiaanContoh = null;
const pejabatContoh = (user_id, nama, nip, peran = 'guru') => ({ user_id, nama, nip, peran });

export function kepanitiaanTiruan() {
  if (!kepanitiaanContoh) {
    const { konteks, items } = berandaTiruan('admin');
    const susunan = {
      'contoh-uts': {
        penanggung_jawab: pejabatContoh('contoh-kamad', 'Dr. H. Ahmad Basuni, M.Pd. (contoh)', '197003121998031002', 'kepala_sekolah'),
        ketua: pejabatContoh('contoh-guru-1', 'Siti Aminah, S.Pd. (contoh)', '198104052006042011'),
        sekretaris: pejabatContoh('contoh-guru-2', 'Muhammad Rizal, S.Kom. (contoh)', '199001102019031008', 'guru_tik'),
        bendahara: pejabatContoh('contoh-tu-1', 'Nur Laili, S.E. (contoh)', '-', 'tenaga_kependidikan'),
      },
      'contoh-uas': {
        penanggung_jawab: pejabatContoh('contoh-kamad', 'Dr. H. Ahmad Basuni, M.Pd. (contoh)', '197003121998031002', 'kepala_sekolah'),
        ketua: pejabatContoh('contoh-guru-3', 'Drs. Hadi Purnomo (contoh)', '196805171994031003'),
        sekretaris: null,
        bendahara: null,
      },
    };
    kepanitiaanContoh = {
      konteks,
      items: items.map((ujian) => ({
        ujian,
        panitia: susunan[ujian.id] || { penanggung_jawab: null, ketua: null, sekretaris: null, bendahara: null },
        diubah: susunan[ujian.id] ? { oleh_nama: 'Administrator (contoh)', pada: `${geserHari(-3)}T09:15:00+07:00` } : null,
      })),
    };
  }
  return { konteks: kepanitiaanContoh.konteks, items: kepanitiaanContoh.items.map((i) => ({ ...i })) };
}

export function gtkPilihanTiruan() {
  return [
    pejabatContoh('contoh-kamad', 'Dr. H. Ahmad Basuni, M.Pd. (contoh)', '197003121998031002', 'kepala_sekolah'),
    pejabatContoh('contoh-wakakur', 'Hj. Umi Kulsum, S.Ag. (contoh)', '197511232003122001', 'waka_kurikulum'),
    pejabatContoh('contoh-guru-1', 'Siti Aminah, S.Pd. (contoh)', '198104052006042011'),
    pejabatContoh('contoh-guru-2', 'Muhammad Rizal, S.Kom. (contoh)', '199001102019031008', 'guru_tik'),
    pejabatContoh('contoh-guru-3', 'Drs. Hadi Purnomo (contoh)', '196805171994031003'),
    pejabatContoh('contoh-guru-4', 'Lailatul Fitriyah, S.Pd.I. (contoh)', '-', 'guru_agama'),
    pejabatContoh('contoh-guru-5', 'Bambang Setiawan, S.Pd. (contoh)', '198612122014031002', 'guru_ipa'),
    pejabatContoh('contoh-tu-1', 'Nur Laili, S.E. (contoh)', '-', 'tenaga_kependidikan'),
    pejabatContoh('contoh-ktu', 'Hendra Saputra, S.Sos. (contoh)', '197808082005011004', 'kepala_tata_usaha'),
  ];
}

// Simulasi akses: pengelola/pimpinan dari peran; GTK lain dianggap menjabat seperti pada data contoh beranda
// (ketua & sekretaris) agar grup menu panitia otomatis dapat dicoba sebelum server siap.
export function aksesSayaTiruan(peran) {
  if (!mungkinPanitia(peran)) return { pengelola: false, pimpinan: false, jabatan: [], menu: menuPanitiaUjian({}), pj_berkas: false };
  const { akses } = berandaTiruan(peran);
  // contoh: guru mapel menjadi PJ berkas soal
  return { ...akses, menu: menuPanitiaUjian(akses), pj_berkas: String(peran || '').startsWith('guru') };
}

// ---- Pemanggil API (jatuh ke data tiruan bila endpoint belum ada) ----
// Rute yang belum terdaftar dijawab FastAPI 404 "Not Found"; 404 dengan pesan lain adalah galat sungguhan.
export const endpointBelumAda = (e) => e?.response?.status === 404 && e.response.data?.detail === 'Not Found';

/** Galat 403 dari server: peran/jabatan aktif tidak berhak. */
export const aksesDitolak = (e) => e?.response?.status === 403;

export const pesanGalat = (e, cadangan) => {
  const d = e?.response?.data?.detail;
  return typeof d === 'string' && d !== 'Not Found' ? d : cadangan;
};

export async function denganTiruan(fn, tiruan) {
  try {
    return { ...(await fn()), tiruan: false };
  } catch (e) {
    if (endpointBelumAda(e)) return { ...(await tiruan()), tiruan: true };
    throw e;
  }
}

/** Beranda: ujian semester aktif + menu kepanitiaan -> { konteks, items, akses, menu, tiruan }.
 * `peran` (peran aktif) hanya dipakai menyusun menu data contoh; server memakai token. */
export const muatBerandaUjian = (peran) => denganTiruan(
  async () => {
    const { data } = await api.get('/ujian/beranda');
    return { konteks: data.konteks || null, items: data.items || [], akses: data.akses || {}, menu: data.menu || [] };
  },
  () => berandaTiruan(peran),
);

/** Arsip semester lalu: ujian semester sebelumnya per semester -> { semester, tiruan }. */
export const muatArsipSemester = () => denganTiruan(
  async () => ({ semester: (await api.get('/ujian/arsip-semester')).data.semester || [] }),
  arsipSemesterTiruan,
);

/** Kepanitiaan: ujian semester aktif beserta susunan panitianya -> { konteks, items, tiruan }. */
export const muatKepanitiaan = () => denganTiruan(
  async () => {
    const { data } = await api.get('/ujian/panitia');
    return { konteks: data.konteks || null, items: data.items || [] };
  },
  kepanitiaanTiruan,
);

/** Buat ujian baru pada semester aktif -> { ujian, tiruan }. isi = { jenis, nama, mulai, selesai }. */
export const buatUjian = (isi) => denganTiruan(
  async () => ({ ujian: (await api.post('/ujian', isi)).data }),
  () => {
    const { konteks } = kepanitiaanTiruan();
    const ujian = {
      ...isi, id: `contoh-baru-${Date.now()}`, tahun_pelajaran: konteks.tahun_pelajaran, semester: konteks.semester_nama,
      semester_id: konteks.semester_id, formulir: { aktif: false, jam_buka: null, jam_tutup: null, status: 'tertutup' },
      jumlah_ruang: 0, jumlah_peserta: 0, jabatan_saya: null,
    };
    kepanitiaanContoh.items.push({ ujian, panitia: { penanggung_jawab: null, ketua: null, sekretaris: null, bendahara: null }, diubah: null });
    return { ujian };
  },
);

/** Pilihan pejabat panitia dari akun GTK -> { items, tiruan }. */
export const muatGtkPilihan = () => denganTiruan(
  async () => ({ items: (await api.get('/ujian/gtk-pilihan')).data.items || [] }),
  () => ({ items: gtkPilihanTiruan() }),
);

/** Duplikat pejabat dalam satu susunan -> { jabatan: pesan } (aturan sama dengan server). */
export function galatSusunanPanitia(isian) {
  const galat = {};
  const dipakai = {};
  JABATAN_PANITIA.forEach((j) => {
    const id = isian[j];
    if (!id) return;
    if (dipakai[id]) galat[j] = `Orang yang sama sudah menjabat ${LABEL_JABATAN[dipakai[id]]}`;
    else dipakai[id] = j;
  });
  return galat;
}

/** Simpan susunan panitia satu ujian -> { panitia, diubah, tiruan }. isian = { jabatan: user_id | '' }.
 * `versi` = diubah.pada saat penyunting dibuka ('' bila belum pernah diubah); server menolak 409 bila sudah berubah. */
export const simpanPanitia = (ujianId, isian, versi) => {
  const kirim = { ...Object.fromEntries(JABATAN_PANITIA.map((j) => [j, isian[j] || null])), ...(versi !== undefined ? { versi } : {}) };
  return denganTiruan(
    async () => {
      const { data } = await api.put(`/ujian/${ujianId}/panitia`, kirim);
      return { panitia: data.panitia, diubah: data.diubah || null };
    },
    () => {
      const gtk = gtkPilihanTiruan();
      const panitia = Object.fromEntries(JABATAN_PANITIA.map((j) => [j, gtk.find((g) => g.user_id === kirim[j]) || null]));
      kepanitiaanTiruan();
      const diubah = { oleh_nama: 'Anda (contoh)', pada: new Date().toISOString() };
      const item = kepanitiaanContoh.items.find((i) => i.ujian.id === ujianId);
      if (item) Object.assign(item, { panitia, diubah });
      return { panitia, diubah };
    },
  );
};

/** Akses modul ujian pengguna aktif (grup menu sidebar) -> { pengelola, pimpinan, jabatan, menu, tiruan }. */
export const muatAksesSaya = (peran) => denganTiruan(
  async () => {
    const { data } = await api.get('/ujian/akses-saya');
    return { pengelola: !!data.pengelola, pimpinan: !!data.pimpinan, jabatan: data.jabatan || [], menu: data.menu || [], pj_berkas: !!data.pj_berkas };
  },
  () => aksesSayaTiruan(peran),
);

/** Status formulir ringkas semester aktif -> { items: [{ ujian_id, formulir }], tiruan }. */
export const muatStatusFormulir = () => denganTiruan(
  async () => {
    const { data } = await api.get('/ujian/status-formulir');
    return { tanggal: data.tanggal, jam: data.jam, ringkasan: data.ringkasan || {}, items: data.items || [] };
  },
  () => ({ items: berandaTiruan('admin').items.map((u) => ({ ujian_id: u.id, formulir: u.formulir })) }),
);

/** Rincian satu ujian + menu yang boleh dibuka pada ujian itu -> { ujian, akses, menu } (tanpa data contoh). */
export const muatDetailUjian = async (ujianId) => (await api.get(`/ujian/${ujianId}/detail`)).data;
