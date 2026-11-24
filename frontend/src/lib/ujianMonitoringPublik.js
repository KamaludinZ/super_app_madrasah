/**
 * Ujian Madrasah — halaman MONITORING PENGUMPULAN berkas ujian publik (tanpa login): status kisi-kisi & kartu soal per
 * jenjang per mapel baku, nama guru PJ, dan waktu update terakhir. Akses lewat token tautan acak jenis `monitoring`
 * (ujian_tautan_publik); validator token + jendela waktu sama dengan halaman info (galatTautanInfo).
 * KERAHASIAAN: isi kartu soal tidak pernah dikirim ke publik — hanya status, nama PJ, dan waktu update.
 *
 * Kontrak server (backend menyusul):
 *   GET /publik/monitoring-ujian/{token}?sesi=<acak>[&segarkan=1]
 *        (sesi: id acak per pembukaan halaman; segarkan: muat ulang — server hanya memperbarui entri log pembukaan sesi itu)
 *     -> { madrasah: { nama, logo_url }, ujian: { nama, jenis, tahun_pelajaran, mulai, selesai },
 *          tautan: { jenis: 'monitoring', mulai_at, selesai_at }, waktu_server: ISO,
 *          berkas: [{ jenis: 'kisi_kisi' | 'kartu_soal', jenjang: 7|8|9, mapel: kode baku, guru_pj_nama, updated_at }],
 *          mapel: { '7': [{ kode, nama }], '8': [...], '9': [...] } }   (mapel baku aktif per jenjang; lihat mapelUntuk)
 *        juga: ringkasan { '7': { total, kisi_kisi, kartu_soal, lengkap }, … }, saringan { jenjang, mapel }, terakhir.
 *        Saringan opsional &jenjang=7|8|9&mapel=<kode> (halaman ini tidak memakainya: lencana tab butuh ketiga jenjang).
 *        (hanya berkas berstatus terkirim; tanpa id/nama berkas/ukuran — publik tidak dapat mengunduh dari halaman ini)
 *     404 token tidak dikenal; 403 tautan tidak berlaku -> detail { alasan, pesan, mulai_at, selesai_at, madrasah }
 */
import { denganTiruan, publik } from '@/lib/ujianPublik';
import { hariIniWIB } from '@/lib/tanggal';
import { formatWIB, parseServerDate, wibDateKey } from '@/lib/datetime';
import { JENJANG_UJIAN, MAPEL_UJIAN_BAKU } from '@/lib/mapelUjian';
import { galatTautanTiruan, tambahHari } from '@/lib/ujianInfoPublik';

// Waktu server (zona apa pun) -> milidetik untuk diurutkan; tak terbaca = paling awal.
const msWaktu = (iso) => parseServerDate(iso)?.getTime() ?? -Infinity;

export const JENIS_BERKAS = [
  { kode: 'kisi_kisi', label: 'Kisi-kisi' },
  { kode: 'kartu_soal', label: 'Kartu soal' },
];

/**
 * 15 baris mapel baku satu jenjang (urutan baku) beserta status pengumpulan:
 * [{ nomor, kode, nama, kisi_kisi: { guru_pj_nama, updated_at } | null, kartu_soal: … | null, lengkap, terakhir }]
 * `terakhir` = waktu update paling akhir dari kedua berkas (ISO) atau null.
 */
export function pengumpulanJenjang(berkas, jenjang, mapel = MAPEL_UJIAN_BAKU) {
  const peta = {};
  (berkas || []).filter((b) => Number(b.jenjang) === Number(jenjang)).forEach((b) => { peta[`${b.jenis}:${b.mapel}`] = b; });
  return mapel.map((m, i) => {
    const kisi = peta[`kisi_kisi:${m.kode}`] || null;
    const kartu = peta[`kartu_soal:${m.kode}`] || null;
    const waktu = [kisi?.updated_at, kartu?.updated_at].filter(Boolean).sort((a, b) => msWaktu(a) - msWaktu(b));
    return {
      nomor: i + 1, kode: m.kode, nama: m.nama,
      kisi_kisi: kisi && { guru_pj_nama: kisi.guru_pj_nama || null, updated_at: kisi.updated_at || null },
      kartu_soal: kartu && { guru_pj_nama: kartu.guru_pj_nama || null, updated_at: kartu.updated_at || null },
      lengkap: !!(kisi && kartu), terakhir: waktu[waktu.length - 1] || null,
    };
  });
}

/**
 * Waktu update yang mudah dibaca relatif terhadap `sekarang`: "baru saja", "12 menit lalu", "3 jam lalu",
 * "kemarin 09.14", atau "20 Nov 09.14" (WIB). Waktu di masa depan (jam perangkat terlambat) dianggap "baru saja".
 */
export function waktuRelatif(iso, sekarang = new Date()) {
  const d = parseServerDate(iso);
  if (!d) return '-';
  const menit = Math.floor((sekarang.getTime() - d.getTime()) / 60000);
  if (menit < 1) return 'baru saja';
  if (menit < 60) return `${menit} menit lalu`;
  if (menit < 6 * 60) return `${Math.floor(menit / 60)} jam lalu`;
  const jam = formatWIB(d, 'Time', { hour: '2-digit', minute: '2-digit' });
  const kemarin = new Date(sekarang.getTime() - 24 * 60 * 60 * 1000);
  if (wibDateKey(d) === wibDateKey(sekarang)) return `hari ini ${jam}`;
  if (wibDateKey(d) === wibDateKey(kemarin)) return `kemarin ${jam}`;
  return `${formatWIB(d, 'Date', { day: 'numeric', month: 'short' })} ${jam}`;
}

/** Teks PJ satu baris: satu nama bila sama/hanya satu berkas, atau per jenis bila PJ kisi-kisi & kartu soal berbeda. */
export function teksPj(baris) {
  const kisi = baris.kisi_kisi?.guru_pj_nama;
  const kartu = baris.kartu_soal?.guru_pj_nama;
  if (kisi && kartu && kisi !== kartu) return [{ label: 'Kisi-kisi', nama: kisi }, { label: 'Kartu soal', nama: kartu }];
  const nama = kisi || kartu;
  return nama ? [{ label: null, nama }] : [];
}

/** Berkas yang paling akhir diperbarui pada satu jenjang -> { mapel, nama, jenis, guru_pj_nama, updated_at } atau null. */
export function updateTerakhir(baris) {
  let hasil = null;
  baris.forEach((b) => JENIS_BERKAS.forEach(({ kode, label }) => {
    const x = b[kode];
    if (x?.updated_at && (!hasil || msWaktu(x.updated_at) > msWaktu(hasil.updated_at))) {
      hasil = { mapel: b.kode, nama: b.nama, jenis: label, guru_pj_nama: x.guru_pj_nama, updated_at: x.updated_at };
    }
  }));
  return hasil;
}

export const SARINGAN_STATUS = [
  { kode: 'semua', label: 'Semua' },
  { kode: 'belum', label: 'Belum lengkap' },
  { kode: 'lengkap', label: 'Lengkap' },
];

/** Saring baris pengumpulan: `mapel` = kode baku atau '' (semua); `status` = 'semua' | 'belum' | 'lengkap'. */
export function saringPengumpulan(baris, { mapel = '', status = 'semua' } = {}) {
  return baris.filter((b) => (!mapel || b.kode === mapel)
    && (status === 'semua' || (status === 'lengkap' ? b.lengkap : !b.lengkap)));
}

/** Ringkasan satu jenjang dari pengumpulanJenjang -> { total, kisi_kisi, kartu_soal, lengkap } (jumlah mapel terkirim). */
export function ringkasPengumpulan(baris) {
  return {
    total: baris.length,
    kisi_kisi: baris.filter((b) => b.kisi_kisi).length,
    kartu_soal: baris.filter((b) => b.kartu_soal).length,
    lengkap: baris.filter((b) => b.lengkap).length,
  };
}

// ---- Data tiruan (dipakai selama endpoint backend belum ada) ----
// Token contoh: contoh-ditutup, contoh-belum-mulai, contoh-berakhir, contoh-salah (tautan tidak berlaku),
// contoh-kosong (belum ada berkas terkirim).
const GURU_CONTOH = ['Siti Aminah, S.Pd.', 'Muhammad Rizal, S.Kom.', 'Drs. Hadi Purnomo', 'Laili Nur Azizah, S.Pd.I.', 'Ahmad Fauzi, M.Pd.',
  'Dewi Kartika, S.Si.', 'Rina Wulandari, S.Pd.'];

export function berkasMonitoringTiruan() {
  const hasil = [];
  const hari = hariIniWIB();
  JENJANG_UJIAN.forEach((j) => {
    MAPEL_UJIAN_BAKU.forEach((m, i) => {
      const guru = `${GURU_CONTOH[(i + j) % GURU_CONTOH.length]} (contoh)`;
      const waktu = (n, jam) => `${tambahHari(hari, -n)}T${String(jam).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00+07:00`;
      // kepadatan berbeda per jenjang agar ringkasan tiap tab tidak sama, dan tiap tab tetap punya contoh "Belum"
      if ((i + j) % (j - 3) !== 0) hasil.push({ jenis: 'kisi_kisi', jenjang: j, mapel: m.kode, guru_pj_nama: guru, updated_at: waktu((i + j) % 6 + 1, 8 + (i % 8)) });
      if ((i + j * 3) % (j - 4) !== 0) hasil.push({ jenis: 'kartu_soal', jenjang: j, mapel: m.kode, guru_pj_nama: guru, updated_at: waktu((i + j) % 4, 9 + (i % 7)) });
    });
  });
  return hasil;
}

export function monitoringTiruan(token) {
  const g = galatTautanTiruan(token, 'monitoring pengumpulan berkas');
  if (g) throw g;
  const mulai = hariIniWIB();
  return {
    madrasah: { nama: 'MTsN 2 Kota Malang (contoh)', logo_url: null },
    ujian: { nama: 'Asesmen Sumatif Akhir Semester Ganjil (contoh)', jenis: 'UAS', tahun_pelajaran: '2026/2027', mulai: tambahHari(mulai, 7), selesai: tambahHari(mulai, 15) },
    tautan: { jenis: 'monitoring', mulai_at: null, selesai_at: `${tambahHari(mulai, 15)}T16:00:00+07:00` },
    waktu_server: new Date().toISOString(),
    berkas: token === 'contoh-kosong' ? [] : berkasMonitoringTiruan(),
  };
}

// ---- Kerahasiaan kartu soal: whitelist field ----
const FIELD_BERKAS_PUBLIK = ['jenis', 'jenjang', 'mapel', 'guru_pj_nama', 'updated_at'];
const JENIS_SAH = JENIS_BERKAS.map((j) => j.kode);

/**
 * Saring daftar berkas dari server menjadi status saja: hanya FIELD_BERKAS_PUBLIK dan jenis yang dikenal. Lapisan
 * pertahanan kedua — bila server keliru mengirim id/nama berkas/URL/isi, data itu tidak pernah sampai ke tampilan.
 */
export function bersihkanBerkasPublik(berkas) {
  return (Array.isArray(berkas) ? berkas : [])
    .filter((b) => b && JENIS_SAH.includes(b.jenis))
    .map((b) => Object.fromEntries(FIELD_BERKAS_PUBLIK.map((k) => [k, b[k] ?? null])));
}

/** Id sesi acak (32 heksadesimal) untuk satu pembukaan halaman; getRandomValues tersedia juga di konteks non-HTTPS. */
export function buatSesi() {
  try {
    const b = new Uint8Array(16);
    window.crypto.getRandomValues(b);
    return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = ''; // cadangan (bukan kriptografis; hanya penanda sesi log)
    while (h.length < 32) h += Math.floor(Math.random() * 16).toString(16);
    return h;
  }
}

/**
 * Status pengumpulan satu tautan monitoring -> { ...kontrak, tiruan }. Melempar galat 403/404 (baca dengan galatTautanInfo).
 * `sesi` = id pembukaan halaman (buatSesi); `segarkan` = true untuk muat ulang (otomatis/tombol) agar server tidak
 * mencatatnya sebagai pembukaan tautan baru.
 */
export const muatMonitoringPublik = async (token, { segarkan = false, sesi = null } = {}) => {
  const params = { ...(sesi ? { sesi } : {}), ...(segarkan ? { segarkan: 1 } : {}) };
  const d = await denganTiruan(
    async () => (await publik.get(`/publik/monitoring-ujian/${encodeURIComponent(token)}`, { params })).data,
    () => monitoringTiruan(token),
  );
  return { ...d, berkas: bersihkanBerkasPublik(d.berkas) };
};
