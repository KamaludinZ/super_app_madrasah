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
 *                   siap: bool,                           (tautan soal terisi DAN tombol diaktifkan admin)
 *                   ditahan: bool,                        (tautan terisi tetapi tombol dimatikan admin; siap = false)
 *                   jumlah_klik, klik_terakhir_at }] }    (cache klik sah dari ujian_link_soal)
 *        TIDAK PERNAH memuat `url` tautan soal: tautan baru keluar lewat rute kerjakan di bawah, saat mapel berlangsung.
 *        Mapel baku yang tidak punya entri `soal` = belum dijadwalkan.
 *     404 token tidak dikenal; 403 portal tidak dapat dibuka -> detail { alasan: 'nonaktif' | 'belum_mulai' | 'sudah_selesai',
 *        pesan, mulai_at, selesai_at, madrasah,
 *        jadwal_berikutnya: { tanggal, soal: [{ jenjang, mapel: kode, mulai_at, selesai_at }] } | null }
 *        (jadwal_berikutnya = hari ujian terdekat yang belum lewat beserta mapel pertamanya tiap jenjang; tanpa tautan soal.
 *         null bila masa ujian sudah berakhir atau jadwal belum disusun)
 *   GET /publik/portal-ujian/{token}/kerjakan/{soal_id}
 *     -> 302 ke tautan soal eksternal (Referrer-Policy: no-referrer). Server memeriksa token, jendela portal, dan jendela
 *        mapel menurut waktu server; klik sah dicatat (ujian_akses_log aksi=klik_mengerjakan) dan jumlah_klik dinaikkan.
 *        Di luar jendela -> 403 seperti di atas.
 */
import { denganTiruan, publik } from '@/lib/ujianPublik';
import { hariIniWIB } from '@/lib/tanggal';
import { parseServerDate, wibDateKey } from '@/lib/datetime';
import { JENJANG_UJIAN, MAPEL_UJIAN_BAKU } from '@/lib/mapelUjian';
import { galatTautanInfo, galatTautanTiruan, tambahHari } from '@/lib/ujianInfoPublik';
import { buatSesi } from '@/lib/ujianMonitoringPublik';

export { buatSesi };

const BASIS_API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

/**
 * Alamat tombol "Mengerjakan" satu mapel: rute kerjakan server yang memeriksa jendela waktu, mencatat klik sah, lalu
 * mengalihkan (302) ke tautan soal eksternal. Tautan soal sendiri tidak pernah ada di halaman.
 */
export const urlKerjakan = (token, soalId) => `${BASIS_API}/publik/portal-ujian/${encodeURIComponent(token)}/kerjakan/${encodeURIComponent(soalId)}`;

/** Tombol "Mengerjakan" boleh ditekan: tautan soal sudah disiapkan dan mapel sedang berlangsung menurut jam server. */
export const bolehKerjakan = (soal) => !!soal?.siap && soal.status === 'berlangsung';

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

/** Durasi ringkas: "3 hari", "2 jam 15 menit", "45 menit", atau "4:05" (menit:detik) di bawah 10 menit; null bila ≤ 0. */
export function teksDurasi(ms) {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms <= 0) return null;
  const detik = Math.ceil(ms / 1000);
  if (detik < 10 * 60) return `${Math.floor(detik / 60)}:${String(detik % 60).padStart(2, '0')}`;
  const menit = Math.floor(detik / 60);
  const jam = Math.floor(menit / 60);
  if (jam >= 48) return `${Math.floor(jam / 24)} hari`;
  if (jam >= 1) return `${jam} jam${menit % 60 ? ` ${menit % 60} menit` : ''}`;
  return `${menit} menit`;
}

/** Hitung mundur satu mapel pada waktu server `sekarangMs` -> { menuju: 'mulai' | 'selesai', ms, teks } atau null bila sudah ditutup. */
export function hitungMundurSoal(soal, sekarangMs) {
  const status = statusSoal(soal, sekarangMs);
  if (status === 'ditutup') return null;
  const menuju = status === 'belum_dimulai' ? 'mulai' : 'selesai';
  const target = parseServerDate(menuju === 'mulai' ? soal.mulai_at : soal.selesai_at)?.getTime();
  if (!Number.isFinite(target)) return null;
  const ms = target - sekarangMs;
  return { menuju, ms, teks: teksDurasi(ms) };
}

/**
 * Batas waktu terdekat SESUDAH `sekarangMs` (mulai/selesai mapel mana pun) dalam ms waktu server, atau null. Dipakai
 * untuk memuat ulang dari server tepat saat status berganti dan mempercepat detak jam ketika batas sudah dekat.
 */
export function batasBerikutAt(soal, sekarangMs) {
  let hasil = null;
  (soal || []).forEach((s) => [s.mulai_at, s.selesai_at].forEach((w) => {
    const t = parseServerDate(w)?.getTime();
    if (Number.isFinite(t) && t > sekarangMs && (hasil === null || t < hasil)) hasil = t;
  }));
  return hasil;
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

// ---- Portal terkunci ----

/**
 * Jadwal berikutnya dari detail penolakan portal -> { tanggal, soal: [{ jenjang, mapel, mulai_at, selesai_at }] } (urut
 * jenjang, lalu jam mulai) atau null. Field lain (mis. tautan soal) dibuang.
 */
export function bersihkanJadwalBerikutnya(j) {
  if (!j || typeof j !== 'object') return null;
  const soal = (Array.isArray(j.soal) ? j.soal : [])
    .filter((s) => s && s.mapel && JENJANG_UJIAN.includes(Number(s.jenjang)) && parseServerDate(s.mulai_at))
    .map((s) => ({ jenjang: Number(s.jenjang), mapel: s.mapel, mulai_at: s.mulai_at, selesai_at: s.selesai_at || null }))
    .sort((a, b) => a.jenjang - b.jenjang || msWaktu(a.mulai_at) - msWaktu(b.mulai_at));
  const tanggal = j.tanggal || (soal[0] ? wibDateKey(soal[0].mulai_at) : null);
  return tanggal || soal.length ? { tanggal, soal } : null;
}

/**
 * Alasan portal tidak dapat dibuka -> galatTautanInfo ditambah `jadwal_berikutnya` (lihat bersihkanJadwalBerikutnya),
 * atau null bila galat lain (mis. koneksi).
 */
export function galatPortal(e) {
  const g = galatTautanInfo(e);
  if (!g) return null;
  const d = e?.response?.data?.detail;
  return { ...g, jadwal_berikutnya: d && typeof d === 'object' ? bersihkanJadwalBerikutnya(d.jadwal_berikutnya) : null };
}

// ---- Isolasi data: whitelist field ----
const FIELD_SOAL_PUBLIK = ['id', 'jenjang', 'mapel', 'tanggal', 'sesi_ke', 'mulai_at', 'selesai_at', 'status', 'siap', 'ditahan', 'jumlah_klik', 'klik_terakhir_at'];

/**
 * Saring daftar soal dari server: hanya FIELD_SOAL_PUBLIK. Lapisan pertahanan kedua — bila server keliru mengirim `url`
 * tautan soal (atau data lain), nilai itu tidak pernah tersimpan di state halaman sebelum waktunya.
 */
export function bersihkanSoalPublik(soal) {
  return (Array.isArray(soal) ? soal : [])
    .filter((s) => s && s.mapel && JENJANG_UJIAN.includes(Number(s.jenjang)))
    .map((s) => {
      const b = Object.fromEntries(FIELD_SOAL_PUBLIK.map((k) => [k, s[k] ?? null]));
      return { ...b, jenjang: Number(b.jenjang), siap: !!b.siap, ditahan: !b.siap && !!b.ditahan, jumlah_klik: Number(b.jumlah_klik) || 0 };
    });
}

// ---- Data tiruan (dipakai selama endpoint backend belum ada) ----
// Token contoh: contoh-ditutup, contoh-belum-mulai, contoh-berakhir, contoh-salah (portal tidak dapat dibuka),
// contoh-kosong (portal terbuka tetapi jendela pengerjaan belum disusun). Jendela hari ini disusun relatif terhadap
// jam saat halaman pertama dibuka (JANGKAR_CONTOH, tetap selama tab terbuka agar hitung mundur benar-benar habis):
// satu mapel sudah ditutup, satu berlangsung dan ditutup ±3 menit lagi, satu dibuka ±5 menit lagi, satu menyusul
// siang hari; sisanya pada hari-hari berikutnya.
const MENIT = 60 * 1000;
// Klik "Mengerjakan" contoh disimpan per tab browser agar penghitung tetap bertambah setelah muat ulang (meniru cache
// jumlah_klik server). { soal_id: { jumlah, terakhir } }
const KUNCI_KLIK_CONTOH = 'portalUjian:klikContoh';
const klikContoh = (() => {
  try { return JSON.parse(sessionStorage.getItem(KUNCI_KLIK_CONTOH)) || {}; } catch { return {}; }
})();
const simpanKlikContoh = () => {
  try { sessionStorage.setItem(KUNCI_KLIK_CONTOH, JSON.stringify(klikContoh)); } catch { /* abaikan */ }
};
const JANGKAR_CONTOH = Math.floor(Date.now() / MENIT) * MENIT;
const iso = (ms) => new Date(ms).toISOString();

function soalTiruan() {
  const kini = JANGKAR_CONTOH;
  const hariIni = [[-150, -90], [-60, 3], [5, 95], [120, 210]]; // menit relatif terhadap jangkar
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
      // Klik awal ditetapkan dari keadaan saat jangkar (stabil antar-muat), ditambah klik contoh yang dicatat di tab ini.
      const awal = statusSoal({ mulai_at: iso(mulai), selesai_at: iso(selesai) }, JANGKAR_CONTOH);
      const id = `contoh-soal-${j}-${m.kode}`;
      const dicatat = klikContoh[id];
      const klik = { ditutup: 28 + ((i * 7 + j) % 9), berlangsung: 9 + j, belum_dimulai: 0 }[awal] + (dicatat?.jumlah || 0);
      const klikAwalAt = klik ? Math.min(JANGKAR_CONTOH, selesai) - ((i + j) % 5) * MENIT : null;
      hasil.push({
        id, jenjang: j, mapel: m.kode, tanggal: wibDateKey(mulai), sesi_ke: i < hariIni.length ? i + 1 : sesi,
        mulai_at: iso(mulai), selesai_at: iso(selesai), status,
        // satu mapel per jenjang tautan soalnya belum diisi admin; kelas 8 termasuk mapel yang dibuka sebentar lagi hari ini.
        // Kelas 7: satu mapel tautannya sudah ada tetapi tombolnya dimatikan admin (ditahan).
        siap: i !== 4 + ji && !(j === 8 && i === 2) && !(j === 7 && i === 6),
        ditahan: j === 7 && i === 6,
        jumlah_klik: klik, klik_terakhir_at: dicatat?.terakhir || (klikAwalAt ? iso(klikAwalAt) : null),
      });
    });
  });
  return hasil;
}

// Hari ujian contoh berikutnya: mapel pertama tiap jenjang pukul 07.30–09.00 WIB pada `tanggal`.
function jadwalBerikutnyaTiruan(tanggal) {
  return {
    tanggal,
    soal: JENJANG_UJIAN.map((j, ji) => ({
      jenjang: j, mapel: MAPEL_UJIAN_BAKU[(ji * 4) % MAPEL_UJIAN_BAKU.length].kode,
      mulai_at: `${tanggal}T07:30:00+07:00`, selesai_at: `${tanggal}T09:00:00+07:00`,
    })),
  };
}

export function portalTiruan(token) {
  const g = galatTautanTiruan(token, 'portal ujian');
  if (g) {
    const d = g.response.data.detail;
    if (token === 'contoh-belum-mulai') d.jadwal_berikutnya = jadwalBerikutnyaTiruan(tambahHari(hariIniWIB(), 3));
    if (token === 'contoh-ditutup') d.jadwal_berikutnya = jadwalBerikutnyaTiruan(tambahHari(hariIniWIB(), 1));
    if (token === 'contoh-berakhir') d.jadwal_berikutnya = null;
    throw g;
  }
  const mulai = hariIniWIB();
  return {
    madrasah: { nama: 'MTsN 2 Kota Malang (contoh)', logo_url: null },
    ujian: { nama: 'Asesmen Sumatif Akhir Semester Ganjil (contoh)', jenis: 'UAS', tahun_pelajaran: '2026/2027', mulai, selesai: tambahHari(mulai, 9) },
    tautan: { jenis: 'portal', mulai_at: `${mulai}T06:30:00+07:00`, selesai_at: `${tambahHari(mulai, 9)}T15:00:00+07:00` },
    waktu_server: new Date().toISOString(),
    soal: token === 'contoh-kosong' ? [] : soalTiruan(),
  };
}

/**
 * Pencatat klik tiruan (meniru rute kerjakan server): klik hanya dihitung bila portal terbuka dan mapel itu sedang
 * berlangsung menurut jam "server" (jam perangkat pada mode contoh) serta tautan soalnya siap. -> { jumlah_klik,
 * klik_terakhir_at }. Di luar jendela melempar galat 403 { alasan: 'di_luar_jendela' | 'belum_siap' | 'ditahan', pesan } dan
 * penghitung tidak bertambah.
 */
export function catatKlikTiruan(token, soalId) {
  const isi = portalTiruan(token); // token contoh yang ditutup/berakhir melempar galat yang sama dengan memuat portal
  const s = isi.soal.find((x) => x.id === soalId);
  const tolak = (alasan, pesan) => { const e = new Error('klik'); e.response = { status: 403, data: { detail: { alasan, pesan } } }; return e; };
  if (!s) throw tolak('tidak_dikenal', 'Mapel tidak ditemukan pada portal ini.');
  if (!s.siap) throw s.ditahan ? tolak('ditahan', 'Tombol mapel ini sedang ditahan panitia.') : tolak('belum_siap', 'Tautan soal mapel ini belum disiapkan panitia.');
  if (statusSoal(s, Date.now()) !== 'berlangsung') throw tolak('di_luar_jendela', 'Di luar jam pengerjaan mapel ini.');
  const c = klikContoh[soalId] || { jumlah: 0, terakhir: null };
  c.jumlah += 1;
  c.terakhir = new Date().toISOString();
  klikContoh[soalId] = c;
  simpanKlikContoh();
  return { jumlah_klik: s.jumlah_klik + 1, klik_terakhir_at: c.terakhir };
}

/** Halaman soal contoh di tab baru (pengganti tautan soal eksternal pada mode contoh), tanpa opener & referrer. */
export function bukaSoalContoh(soal, jenjang) {
  const aman = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const html = `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Soal contoh · ${aman(soal.nama)}</title><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;color:#0f172a">
<p style="color:#006837;font-weight:600;font-size:.8rem;letter-spacing:.05em;text-transform:uppercase">Mode contoh</p>
<h1 style="font-size:1.4rem">${aman(soal.nama)} · Kelas ${aman(jenjang)}</h1>
<p>Di sini nanti terbuka aplikasi ujian (CBT) dari tautan soal yang dipasang panitia. Klikmu sudah tercatat di portal.</p>
<p style="color:#64748b;font-size:.85rem">Halaman ini dibuka di tab baru tanpa referrer, sehingga alamat portal tidak terkirim ke aplikasi soal.</p></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ---- API ----

/**
 * Isi portal satu tautan -> { ...kontrak, soal (tersaring), tiruan }. Melempar galat 403/404 (baca dengan galatPortal).
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
