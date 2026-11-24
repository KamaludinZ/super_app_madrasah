/**
 * Ujian Madrasah — PORTAL UJIAN publik (tanpa login): halaman ringan tempat siswa membuka soal CBT eksternal tiap mapel
 * sesuai jadwal, dalam tiga tab jenjang (Kelas 7/8/9). Akses lewat token tautan acak jenis `portal`
 * (ujian_tautan_publik) yang TERPISAH dari tautan info & monitoring: halaman info tidak pernah memuat tautan soal, dan
 * portal tidak memuat kisi-kisi, tata tertib, berkas, maupun data monitoring.
 *
 * Dua lapis jendela waktu: (1) jendela tautan portal (masa ujian) menentukan apakah halaman boleh dibuka sama sekali —
 * di luar itu server menolak (403) dan halaman tidak dirender; (2) jendela per mapel (ujian_link_soal.mulai_at/selesai_at)
 * menentukan status tiap mapel. Status dihitung server dari waktu server; klien hanya melanjutkannya memakai selisih jam
 * terhadap `waktu_server` (jam perangkat siswa tidak dipercaya).
 *
 * Kontrak server (backend menyusul):
 *   GET /publik/portal-ujian/{token}?sesi=<acak>[&segarkan=1]
 *        (sesi: id acak per pembukaan halaman; segarkan: muat ulang — server tidak mencatatnya sebagai pembukaan baru)
 *     -> { madrasah: { nama, logo_url }, ujian: { nama, jenis, tahun_pelajaran, mulai, selesai },
 *          tautan: { jenis: 'portal', mulai_at, selesai_at }, waktu_server: ISO,
 *          mapel: { '7': [{ kode, nama }], '8': [...], '9': [...] },   (mapel baku aktif per jenjang; lihat mapelUntuk)
 *          soal: [{ id, jenjang: 7|8|9, mapel: kode baku, tanggal: 'YYYY-MM-DD' (WIB), sesi_ke,
 *                   mulai_at, selesai_at,                 (jendela tombol "Mengerjakan"; awalnya dari jadwal ujian)
 *                   status: 'belum_dimulai' | 'berlangsung' | 'ditutup',   (menurut waktu server)
 *                   siap: bool,                           (false = tautan soal belum diisi/dinonaktifkan admin)
 *                   jumlah_klik, klik_terakhir_at }] }    (cache klik sah dari ujian_link_soal)
 *        TIDAK PERNAH memuat `url` tautan soal: tautan baru keluar lewat rute kerjakan di bawah, saat mapel berlangsung.
 *        Mapel baku yang tidak punya entri `soal` = belum dijadwalkan.
 *     404 token tidak dikenal; 403 portal tidak dapat dibuka -> detail { alasan: 'nonaktif' | 'belum_mulai' | 'sudah_selesai',
 *        pesan, mulai_at, selesai_at, madrasah }
 *   GET /publik/portal-ujian/{token}/kerjakan/{soal_id}
 *     -> 302 ke tautan soal eksternal (Referrer-Policy: no-referrer). Server memeriksa token, jendela portal, dan jendela
 *        mapel menurut waktu server; klik sah dicatat (ujian_akses_log aksi=klik_mengerjakan) dan jumlah_klik dinaikkan.
 *        Di luar jendela -> 403 seperti di atas.
 */
import { denganTiruan, publik } from '@/lib/ujianPublik';
import { hariIniWIB } from '@/lib/tanggal';
import { parseServerDate, wibDateKey } from '@/lib/datetime';
import { JENJANG_UJIAN, MAPEL_UJIAN_BAKU } from '@/lib/mapelUjian';
import { galatTautanTiruan, tambahHari } from '@/lib/ujianInfoPublik';
import { buatSesi } from '@/lib/ujianMonitoringPublik';

export { buatSesi };

export const STATUS_SOAL = {
  belum_dimulai: { label: 'Belum dimulai' },
  berlangsung: { label: 'Berlangsung' },
  ditutup: { label: 'Sudah ditutup' },
};

// ---- Jam server ----

/** Selisih jam server terhadap jam perangkat (ms) saat respons diterima; 0 bila waktu_server tidak terbaca. */
export function selisihJamServer(waktuServer, sekarang = Date.now()) {
  const d = parseServerDate(waktuServer);
  return d ? d.getTime() - sekarang : 0;
}

/**
 * Status satu mapel pada waktu server `sekarangMs`. Jendela [mulai_at, selesai_at): tepat pada selesai_at sudah ditutup.
 * Jendela tak terbaca -> status dari server apa adanya.
 */
export function statusSoal(soal, sekarangMs) {
  const mulai = parseServerDate(soal?.mulai_at)?.getTime();
  const selesai = parseServerDate(soal?.selesai_at)?.getTime();
  if (!Number.isFinite(mulai) || !Number.isFinite(selesai) || !Number.isFinite(sekarangMs)) {
    return STATUS_SOAL[soal?.status] ? soal.status : 'belum_dimulai';
  }
  if (sekarangMs < mulai) return 'belum_dimulai';
  if (sekarangMs < selesai) return 'berlangsung';
  return 'ditutup';
}

// ---- Susunan per jenjang ----

const msWaktu = (iso) => parseServerDate(iso)?.getTime() ?? Infinity;

/**
 * Soal satu jenjang menurut jadwal -> { hari: [{ tanggal, soal: [Soal & { nama, status }] }], tanpaJadwal: [{ kode, nama }] }.
 * Urut waktu mulai; hanya mapel baku jenjang itu (`mapel` dari server bila ada). `tanpaJadwal` = mapel baku yang belum
 * punya jendela pengerjaan. `sekarangMs` = waktu server saat ini (status dihitung ulang darinya).
 */
export function soalJenjang(soal, jenjang, mapel = MAPEL_UJIAN_BAKU, sekarangMs = Date.now()) {
  const nama = new Map(mapel.map((m) => [m.kode, m.nama]));
  const milik = (soal || [])
    .filter((s) => Number(s.jenjang) === Number(jenjang) && nama.has(s.mapel))
    .sort((a, b) => msWaktu(a.mulai_at) - msWaktu(b.mulai_at) || (a.sesi_ke || 0) - (b.sesi_ke || 0));
  const perTanggal = new Map();
  milik.forEach((s) => {
    const tanggal = s.tanggal || wibDateKey(s.mulai_at) || '';
    if (!perTanggal.has(tanggal)) perTanggal.set(tanggal, []);
    perTanggal.get(tanggal).push({ ...s, nama: nama.get(s.mapel), status: statusSoal(s, sekarangMs) });
  });
  const terjadwal = new Set(milik.map((s) => s.mapel));
  return {
    hari: [...perTanggal.entries()].map(([tanggal, isi]) => ({ tanggal, soal: isi })),
    tanpaJadwal: mapel.filter((m) => !terjadwal.has(m.kode)),
  };
}

/**
 * Mapel yang disorot di atas tab: yang sedang berlangsung (bisa lebih dari satu), atau bila tidak ada, mapel berikutnya
 * yang terdekat -> { status: 'berlangsung' | 'belum_dimulai', soal: [...] } atau null bila seluruhnya sudah ditutup.
 */
export function sorotanPortal(hari) {
  const semua = (hari || []).flatMap((h) => h.soal);
  const berlangsung = semua.filter((s) => s.status === 'berlangsung');
  if (berlangsung.length) return { status: 'berlangsung', soal: berlangsung };
  const berikut = semua.find((s) => s.status === 'belum_dimulai');
  return berikut ? { status: 'belum_dimulai', soal: [berikut] } : null;
}

/** Ringkasan satu jenjang untuk lencana tab -> { total, berlangsung, ditutup, belumSiap }. */
export function ringkasPortal(hari) {
  const semua = (hari || []).flatMap((h) => h.soal);
  return {
    total: semua.length,
    berlangsung: semua.filter((s) => s.status === 'berlangsung').length,
    ditutup: semua.filter((s) => s.status === 'ditutup').length,
    belumSiap: semua.filter((s) => !s.siap).length,
  };
}

// ---- Isolasi data: whitelist field ----
const FIELD_SOAL_PUBLIK = ['id', 'jenjang', 'mapel', 'tanggal', 'sesi_ke', 'mulai_at', 'selesai_at', 'status', 'siap', 'jumlah_klik', 'klik_terakhir_at'];

/**
 * Saring daftar soal dari server: hanya FIELD_SOAL_PUBLIK. Lapisan pertahanan kedua — bila server keliru mengirim `url`
 * tautan soal (atau data lain), nilai itu tidak pernah tersimpan di state halaman sebelum waktunya.
 */
export function bersihkanSoalPublik(soal) {
  return (Array.isArray(soal) ? soal : [])
    .filter((s) => s && s.mapel && JENJANG_UJIAN.includes(Number(s.jenjang)))
    .map((s) => {
      const b = Object.fromEntries(FIELD_SOAL_PUBLIK.map((k) => [k, s[k] ?? null]));
      return { ...b, jenjang: Number(b.jenjang), siap: !!b.siap, jumlah_klik: Number(b.jumlah_klik) || 0 };
    });
}

// ---- Data tiruan (dipakai selama endpoint backend belum ada) ----
// Token contoh: contoh-ditutup, contoh-belum-mulai, contoh-berakhir, contoh-salah (portal tidak dapat dibuka),
// contoh-kosong (portal terbuka tetapi jendela pengerjaan belum disusun). Jendela hari ini disusun relatif terhadap
// jam sekarang: satu mapel sudah ditutup, satu berlangsung, satu menyusul hari ini; sisanya pada hari-hari berikutnya.
const MENIT = 60 * 1000;
const bulatkan5Menit = (ms) => Math.floor(ms / (5 * MENIT)) * 5 * MENIT;
const iso = (ms) => new Date(ms).toISOString();

function soalTiruan() {
  const kini = bulatkan5Menit(Date.now());
  const hariIni = [[-150, -60], [-30, 60], [90, 180]]; // menit relatif terhadap sekarang
  const jamBesok = [['07:30', '09:00'], ['09:30', '11:00']];
  const hasil = [];
  JENJANG_UJIAN.forEach((j, ji) => {
    // Urutan mapel digeser per jenjang agar jadwal kelas 7/8/9 berbeda; kelas 9 menyisakan satu mapel belum dijadwalkan.
    const urut = MAPEL_UJIAN_BAKU.map((_, i) => MAPEL_UJIAN_BAKU[(i + ji * 4) % MAPEL_UJIAN_BAKU.length]);
    const terjadwal = j === 9 ? urut.slice(0, -1) : urut;
    let tanggal = hariIniWIB();
    let sesi = 0;
    terjadwal.forEach((m, i) => {
      let mulai;
      let selesai;
      if (i < hariIni.length) {
        mulai = kini + hariIni[i][0] * MENIT;
        selesai = kini + hariIni[i][1] * MENIT;
      } else {
        if (i === hariIni.length || sesi >= jamBesok.length) {
          do { tanggal = tambahHari(tanggal, 1); } while (new Date(`${tanggal}T00:00:00Z`).getUTCDay() === 0); // Minggu libur
          sesi = 0;
        }
        mulai = new Date(`${tanggal}T${jamBesok[sesi][0]}:00+07:00`).getTime();
        selesai = new Date(`${tanggal}T${jamBesok[sesi][1]}:00+07:00`).getTime();
        sesi += 1;
      }
      const status = statusSoal({ mulai_at: iso(mulai), selesai_at: iso(selesai) }, Date.now());
      const klik = { ditutup: 28 + ((i * 7 + j) % 9), berlangsung: 9 + j, belum_dimulai: 0 }[status];
      hasil.push({
        id: `contoh-soal-${j}-${m.kode}`, jenjang: j, mapel: m.kode, tanggal: wibDateKey(mulai), sesi_ke: i < hariIni.length ? i + 1 : sesi,
        mulai_at: iso(mulai), selesai_at: iso(selesai), status,
        siap: i !== 4 + ji, // satu mapel per jenjang tautan soalnya belum diisi admin
        jumlah_klik: klik, klik_terakhir_at: klik ? iso(Math.min(Date.now(), selesai) - ((i + j) % 5) * MENIT) : null,
      });
    });
  });
  return hasil;
}

export function portalTiruan(token) {
  const g = galatTautanTiruan(token, 'portal ujian');
  if (g) throw g;
  const mulai = hariIniWIB();
  return {
    madrasah: { nama: 'MTsN 2 Kota Malang (contoh)', logo_url: null },
    ujian: { nama: 'Asesmen Sumatif Akhir Semester Ganjil (contoh)', jenis: 'UAS', tahun_pelajaran: '2026/2027', mulai, selesai: tambahHari(mulai, 9) },
    tautan: { jenis: 'portal', mulai_at: `${mulai}T06:30:00+07:00`, selesai_at: `${tambahHari(mulai, 9)}T15:00:00+07:00` },
    waktu_server: new Date().toISOString(),
    soal: token === 'contoh-kosong' ? [] : soalTiruan(),
  };
}

// ---- API ----

/**
 * Isi portal satu tautan -> { ...kontrak, soal (tersaring), tiruan }. Melempar galat 403/404 (baca dengan galatTautanInfo).
 * `sesi` = id pembukaan halaman (buatSesi); `segarkan` = true untuk muat ulang agar tidak tercatat sebagai pembukaan baru.
 */
export const muatPortalPublik = async (token, { segarkan = false, sesi = null } = {}) => {
  const params = { ...(sesi ? { sesi } : {}), ...(segarkan ? { segarkan: 1 } : {}) };
  const d = await denganTiruan(
    async () => (await publik.get(`/publik/portal-ujian/${encodeURIComponent(token)}`, { params })).data,
    () => portalTiruan(token),
  );
  return { ...d, soal: bersihkanSoalPublik(d.soal) };
};
