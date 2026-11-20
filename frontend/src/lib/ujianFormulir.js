/**
 * Ujian Madrasah — Pengaturan Formulir: aktivasi & jendela waktu formulir daftar hadir dan berita acara (berlaku untuk
 * SEMUA ruang dalam satu ujian), jadwal sesi (tanggal, jam, mapel per jenjang — mengisi "Hari, tanggal", "Pukul", dan
 * "Mata Pelajaran" pada lembar cetak), template cetak, dan pola tanda tangan.
 *
 * Kontrak server (backend menyusul; koleksi `formulir_ujian`, `jadwal_ujian`):
 *   GET /ujian/{ujian_id}/formulir
 *     -> { ujian: Ujian, boleh_ubah, formulir: Formulir, jadwal: [Sesi] }   (admin; ketua & sekretaris melihat)
 *
 *   PUT /ujian/{ujian_id}/formulir/aktivasi { aktif, jam_buka, jam_tutup }
 *     -> Formulir   (admin; jam wajib & jam_tutup > jam_buka bila aktif; berlaku untuk semua ruang; tercatat di audit)
 *
 *   Formulir = { aktif, jam_buka: 'HH:MM'|null, jam_tutup: 'HH:MM'|null, status: 'tertutup'|'dibuka'|'selesai',
 *                token, tautan: { daftar_hadir, berita_acara },
 *                template: Template,
 *                pola_ttd: { tampil_di_cetak, tinggi_mm }, diubah_pada, diubah_oleh_nama,
 *                diubah: { aktivasi, template, pola_ttd, jadwal } }   (tiap bagian: { oleh_nama, pada } | null)
 *   Template = { nama_madrasah, kop_madrasah, alamat, kota_ttd, singkatan_ujian, nama_kegiatan, catatan_kaki }
 *              (mengikuti docs/2a. Daftar Hadir Peserta.docx & docs/3. Berita Acara.docx)
 *   PUT /ujian/{ujian_id}/formulir/template Template -> Formulir   (admin)
 *   GET /ujian/{ujian_id}/formulir/template-bawaan -> Template   (bawaan jenis ujian; nama/alamat dari Pengaturan)
 *   PUT /ujian/{ujian_id}/formulir/pola-ttd { tampil_di_cetak, tinggi_mm } -> Formulir   (admin; tinggi 8–20 mm)
 *   PUT /ujian/{ujian_id}/formulir/jadwal { sesi: [SesiIn] } -> { jadwal: [Sesi], formulir }   (admin; seluruh jadwal
 *       diganti; tanggal dalam masa ujian, (tanggal, sesi_ke) unik, jam sesi sehari tidak bertumpuk; sesi yang sudah
 *       dipakai daftar hadir tidak boleh dihapus -> 409)
 *   Sesi     = { id, tanggal: 'YYYY-MM-DD', sesi_ke, jam_mulai, jam_selesai, mapel: { '7': nama, '8': nama, '9': nama } }
 */
import { api } from '@/lib/api';
import { berandaTiruan, denganTiruan } from '@/lib/ujian';

export const HALAMAN_FORMULIR = '/ujian/formulir';

// Tautan publik (tanpa login): halaman frontend yang dibuka peserta & pengawas.
export const tautanPublik = (token) => ({
  daftar_hadir: `${window.location.origin}/publik/ujian/${token}/daftar-hadir`,
  berita_acara: `${window.location.origin}/publik/ujian/${token}/berita-acara`,
});

// Isian bawaan sesuai template docx madrasah. Singkatan & nama kegiatan mengikuti jenis ujian.
export const KEGIATAN_JENIS = {
  UTS: { singkatan_ujian: 'ASTS', nama_kegiatan: 'Asesmen Sumatif Tengah Semester' },
  UAS: { singkatan_ujian: 'ASAS', nama_kegiatan: 'Asesmen Sumatif Akhir Semester' },
};
/** Tautan publik lengkap: server mengirim jalur relatif ('/publik/ujian/<token>/...'), klien menambah origin. */
export const tautanLengkap = (jalur) => (jalur && jalur.startsWith('/') ? `${window.location.origin}${jalur}` : jalur || '');

export const TEMPLATE_BAWAAN = {
  nama_madrasah: 'MTsN 2 Kota Malang',
  kop_madrasah: 'MTs NEGERI 2 KOTA MALANG',
  alamat: 'Jalan Raya Cemorokandang No. 77, Kota Malang',
  kota_ttd: 'Malang',
  ...KEGIATAN_JENIS.UAS,
  catatan_kaki: 'Diisi dengan Mata Pelajaran pada waktu itu',
};
export const templateBawaan = (jenis) => ({ ...TEMPLATE_BAWAAN, ...(KEGIATAN_JENIS[jenis] || {}) });

export const FIELD_TEMPLATE = [
  { key: 'nama_madrasah', label: 'Nama madrasah', petunjuk: 'Berita acara: "Pada Madrasah" & kop (huruf besar)', maks: 80 },
  { key: 'kop_madrasah', label: 'Kop daftar hadir', petunjuk: 'Baris nama madrasah pada kop daftar hadir', maks: 80 },
  { key: 'alamat', label: 'Alamat', petunjuk: 'Kop daftar hadir & isian "Alamat" berita acara', maks: 160 },
  { key: 'kota_ttd', label: 'Kota tanda tangan', petunjuk: 'Mis. "Malang, 2 Desember 2026"', maks: 40 },
  { key: 'singkatan_ujian', label: 'Singkatan ujian', petunjuk: 'Judul daftar hadir, mis. ASAS / ASTS / ASAT', maks: 20 },
  { key: 'nama_kegiatan', label: 'Nama kegiatan', petunjuk: 'Berita acara: "Penyelenggaraan …" dan isi butir a & b', maks: 100 },
  { key: 'catatan_kaki', label: 'Catatan kaki berita acara', petunjuk: 'Tanda * di bawah berita acara', maks: 120 },
];

let formulirContoh = {};

function geserHari(dasar, n) {
  const d = new Date(`${dasar}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function formulirTiruan(ujianId) {
  const ujian = berandaTiruan('admin').items.find((u) => u.id === ujianId) || berandaTiruan('admin').items[0];
  if (!formulirContoh[ujian.id]) {
    const token = `contoh-${ujian.id}`;
    const mapel = [
      { '7': 'Matematika', '8': 'Ilmu Pengetahuan Alam', '9': 'Bahasa Indonesia' },
      { '7': 'Bahasa Indonesia', '8': 'Matematika', '9': 'Ilmu Pengetahuan Alam' },
      { '7': 'Akidah Akhlak', '8': 'Bahasa Arab', '9': 'Matematika' },
    ];
    formulirContoh[ujian.id] = {
      formulir: {
        aktif: ujian.formulir.aktif, jam_buka: ujian.formulir.jam_buka || '07:00', jam_tutup: ujian.formulir.jam_tutup || '12:00',
        status: ujian.formulir.status, token, tautan: tautanPublik(token),
        template: templateBawaan(ujian.jenis),
        pola_ttd: { tampil_di_cetak: true, tinggi_mm: 12 },
        diubah_pada: '2026-11-18T10:00:00+07:00', diubah_oleh_nama: 'Administrator (contoh)',
        diubah: {
          aktivasi: { oleh_nama: 'Administrator (contoh)', pada: '2026-11-18T10:00:00+07:00' },
          template: { oleh_nama: 'Administrator (contoh)', pada: '2026-11-17T14:20:00+07:00' },
          pola_ttd: null,
          jadwal: { oleh_nama: 'Administrator (contoh)', pada: '2026-11-16T09:05:00+07:00' },
        },
      },
      jadwal: mapel.map((m, i) => ({
        id: `contoh-sesi-${i + 1}`, tanggal: geserHari(ujian.mulai, i), sesi_ke: 1, jam_mulai: '07:30', jam_selesai: '09:30', mapel: m,
      })),
    };
  }
  const c = formulirContoh[ujian.id];
  return { ujian, boleh_ubah: true, formulir: { ...c.formulir }, jadwal: c.jadwal.map((s) => ({ ...s, mapel: { ...s.mapel } })) };
}

/** Pengaturan formulir satu ujian -> { ujian, boleh_ubah, formulir, jadwal, tiruan }. */
export const muatFormulir = (ujianId) => denganTiruan(
  async () => (await api.get(`/ujian/${ujianId}/formulir`)).data,
  () => formulirTiruan(ujianId),
);

const stempelContoh = () => ({ oleh_nama: 'Anda (contoh)', pada: new Date().toISOString() });

export function simpanContoh(ujianId, ubah) {
  const { ujian } = formulirTiruan(ujianId);
  ubah(formulirContoh[ujian.id]);
  return formulirTiruan(ujian.id);
}

const POLA_JAM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Galat isian aktivasi -> { field: pesan } (aturan sama dengan server). */
export function galatAktivasi({ aktif, jam_buka: buka, jam_tutup: tutup }) {
  const galat = {};
  if (buka && !POLA_JAM.test(buka)) galat.jam_buka = 'Jam tidak valid (JJ:MM)';
  if (tutup && !POLA_JAM.test(tutup)) galat.jam_tutup = 'Jam tidak valid (JJ:MM)';
  if (aktif && !buka) galat.jam_buka = 'Jam buka wajib diisi saat formulir aktif';
  if (aktif && !tutup) galat.jam_tutup = 'Jam tutup wajib diisi saat formulir aktif';
  if (!galat.jam_buka && !galat.jam_tutup && buka && tutup && tutup <= buka) galat.jam_tutup = 'Jam tutup harus setelah jam buka';
  return galat;
}

/** Simpan aktivasi & jendela waktu -> { formulir, tiruan }. */
export const simpanAktivasi = (ujianId, isi) => denganTiruan(
  async () => ({ formulir: (await api.put(`/ujian/${ujianId}/formulir/aktivasi`, isi)).data }),
  () => {
    const h = simpanContoh(ujianId, (c) => {
      Object.assign(c.formulir, isi, { diubah_pada: new Date().toISOString(), diubah_oleh_nama: 'Anda (contoh)' });
      c.formulir.diubah = { ...c.formulir.diubah, aktivasi: stempelContoh() };
      c.formulir.status = isi.aktif ? 'dibuka' : 'tertutup';
    });
    return { formulir: h.formulir };
  },
);

/** Simpan template cetak -> { formulir, tiruan }. */
export const simpanTemplate = (ujianId, template) => denganTiruan(
  async () => ({ formulir: (await api.put(`/ujian/${ujianId}/formulir/template`, template)).data }),
  () => ({ formulir: simpanContoh(ujianId, (c) => { c.formulir.template = { ...template }; c.formulir.diubah = { ...c.formulir.diubah, template: stempelContoh() }; }).formulir }),
);

export const TINGGI_TTD = { min: 8, maks: 20, bawaan: 12 };

/** Simpan pola tanda tangan -> { formulir, tiruan }. */
export const simpanPolaTtd = (ujianId, pola) => denganTiruan(
  async () => ({ formulir: (await api.put(`/ujian/${ujianId}/formulir/pola-ttd`, pola)).data }),
  () => ({ formulir: simpanContoh(ujianId, (c) => { c.formulir.pola_ttd = { ...pola }; c.formulir.diubah = { ...c.formulir.diubah, pola_ttd: stempelContoh() }; }).formulir }),
);

/** Template bawaan dari server (nama & alamat madrasah dari Pengaturan) -> Template; cadangan bawaan lokal. */
export async function muatTemplateBawaan(ujianId, jenis) {
  try {
    return (await api.get(`/ujian/${ujianId}/formulir/template-bawaan`)).data;
  } catch {
    return templateBawaan(jenis);
  }
}

/** Galat jadwal di klien (aturan sama dengan galat_jadwal server) -> [pesan]. */
export function galatJadwal(sesi, mulai, selesai) {
  const galat = [];
  const kunci = {};
  sesi.forEach((s, i) => {
    const no = i + 1;
    if (!s.tanggal || !s.jam_mulai || !s.jam_selesai) galat.push(`Sesi ${no}: tanggal & jam wajib diisi`);
    else {
      if (s.tanggal < mulai || s.tanggal > selesai) galat.push(`Sesi ${no}: tanggal di luar masa ujian`);
      if (s.jam_selesai <= s.jam_mulai) galat.push(`Sesi ${no}: jam selesai harus setelah jam mulai`);
    }
    const k = `${s.tanggal}#${s.sesi_ke}`;
    if (kunci[k]) galat.push(`Sesi ${no}: sesi ke-${s.sesi_ke} pada ${s.tanggal} ganda dengan sesi ${kunci[k]}`);
    else kunci[k] = no;
  });
  const perHari = {};
  sesi.filter((s) => s.tanggal && s.jam_mulai && s.jam_selesai).forEach((s) => { (perHari[s.tanggal] ||= []).push(s); });
  Object.entries(perHari).forEach(([tgl, daftar]) => {
    const urut = [...daftar].sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai));
    urut.slice(1).forEach((b, i) => { if (b.jam_mulai < urut[i].jam_selesai) galat.push(`${tgl}: jam sesi ke-${urut[i].sesi_ke} dan ke-${b.sesi_ke} bertumpuk`); });
  });
  return galat;
}

/** Simpan seluruh jadwal sesi -> { jadwal, formulir, tiruan }. */
export const simpanJadwal = (ujianId, sesi) => denganTiruan(
  async () => (await api.put(`/ujian/${ujianId}/formulir/jadwal`, { sesi })).data,
  () => {
    const h = simpanContoh(ujianId, (c) => {
      c.jadwal = sesi.map((s, i) => ({ ...s, id: s.id || `contoh-sesi-baru-${i}` }));
      c.formulir.diubah = { ...c.formulir.diubah, jadwal: stempelContoh() };
    });
    return { jadwal: h.jadwal, formulir: h.formulir };
  },
);
