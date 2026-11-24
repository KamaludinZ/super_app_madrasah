/**
 * Ujian Madrasah — menu Link Soal (ber-login; key `link_soal`): admin mengisi tautan soal eksternal (aplikasi CBT) dan
 * jendela waktu tombol "Mengerjakan" per jenjang per mapel baku untuk Portal Ujian siswa (/publik/portal-ujian/:token).
 * Jendela awalnya mengikuti sesi jadwal ujian mapel itu (menu Pengaturan Formulir); admin boleh mempersempitnya.
 * Kepala madrasah, waka kurikulum, serta ketua & sekretaris panitia melihat (boleh_ubah = false) tanpa alamat soal.
 *
 * Kontrak server (backend menyusul; koleksi `ujian_link_soal`, unik ujian_id + jenjang + mapel):
 *   GET /ujian/{ujian_id}/link-soal
 *     -> { ujian, boleh_ubah, tautan_portal: Tautan | null (lihat ujianTautanPublik.js),
 *          mapel: { '7': [{ kode, nama }], '8': [...], '9': [...] },   (mapel baku aktif per jenjang)
 *          link: [LinkSoal] }   (satu entri per jenjang × mapel baku aktif; yang belum diatur: id null, url '')
 *   PUT /ujian/{ujian_id}/link-soal/{jenjang}/{mapel} { url, mulai_at, selesai_at, aktif, versi } -> { link: LinkSoal }
 *        (admin; menimpa — satu baris per jenjang+mapel. `versi` = link.versi yang dimuat (null bila belum pernah
 *         disimpan); 409 bila admin lain sudah mengubah baris itu; 422 tautan bukan http(s) / selesai ≤ mulai -> pesan)
 *   POST /ujian/{ujian_id}/link-soal/bangun-ulang-klik
 *     -> { diperiksa, diperbaiki, waktu, selisih: [{ jenjang, mapel, sebelum, sesudah, klik_terakhir_at }], link: [LinkSoal] }
 *        (admin; jumlah_klik & klik_terakhir_at tiap link soal dihitung ulang dari ujian_akses_log aksi=klik_mengerjakan —
 *         log adalah sumber kebenaran, angka pada dokumen hanya cache. Log tidak diubah; aman diulang.)
 *   GET /ujian/{ujian_id}/link-soal/intensitas[?dari=YYYY-MM-DD&sampai=YYYY-MM-DD]   (admin & pemantau)
 *     -> { rentang: { dari, sampai }, hari: ['YYYY-MM-DD', …] (hari yang tercakup, urut),
 *          ringkasan: { total_klik, mapel_diklik, mapel_siap, klik_terakhir_at },
 *          intensitas: [{ link_soal_id, jenjang, mapel, url_host, mulai_at, selesai_at, siap,
 *                         jumlah_klik, klik_terakhir_at, harian: [{ tanggal, jumlah }] }] }
 *        (diagregasi dari ujian_akses_log aksi=klik_mengerjakan per link_soal_id dalam rentang tanggal WIB — BUKAN dari
 *         cache jumlah_klik — sehingga tetap dapat ditelusuri setelah ujian selesai; satu entri per jenjang × mapel baku)
 *   GET /ujian/{ujian_id}/link-soal/{link_soal_id}/klik[?batas=200]   (admin & pemantau)
 *     -> { total, klik: [{ id, waktu, ip, perangkat (user agent), sesi }] (terbaru dulu, maksimal `batas`),
 *          per_ip: [{ ip, jumlah }], per_perangkat: [{ perangkat, jumlah }] (terbanyak dulu, dari SELURUH klik) }
 *        (baris ujian_akses_log aksi=klik_mengerjakan link soal itu; untuk menelusuri sumber klik yang janggal)
 *   LinkSoal = { id, jenjang: 7|8|9, mapel: kode baku, url (admin saja; pemantau: '' dan url_host), url_host,
 *                mulai_at, selesai_at, aktif, siap (url terisi & aktif),
 *                jadwal: { tanggal, sesi_ke, mulai_at, selesai_at } | null,   (sesi jadwal ujian mapel ini = nilai awal)
 *                jumlah_klik, klik_terakhir_at, diperbarui_pada, diperbarui_oleh_nama, versi }
 */
import { api } from '@/lib/api';
import { denganTiruan } from '@/lib/ujian';
import { hariIniWIB } from '@/lib/tanggal';
import { parseServerDate, wibDateKey } from '@/lib/datetime';
import { JENJANG_UJIAN, MAPEL_UJIAN_BAKU, mapelUntuk } from '@/lib/mapelUjian';
import { tambahHari } from '@/lib/ujianInfoPublik';
import { dariInputWaktu, keInputWaktu, muatTautanPublik } from '@/lib/ujianTautanPublik';

export const HALAMAN_LINK_SOAL = '/ujian/link-soal';
export const URL_SOAL_MAKS = 2000; // sama dengan backend (URL_SOAL_MAKS)

// ---- Validasi ----

/**
 * Tautan soal yang boleh dipasang: hanya http:// atau https:// dengan nama host, tanpa spasi dan tanpa kredensial
 * (user@host), ≤ URL_SOAL_MAKS. javascript:, data:, file:, dan skema lain ditolak. -> URL bersih atau null.
 */
export function urlSoalAman(url) {
  const t = String(url || '').trim();
  // Pola literal lebih dulu: parser URL peramban memaafkan bentuk rusak seperti "http:///x" atau "https:\\host".
  if (!t || t.length > URL_SOAL_MAKS || /\s/.test(t) || !/^https?:\/\/[^/\\?#@\s]+/i.test(t)) return null;
  let u;
  try { u = new URL(t); } catch { return null; }
  if (!['http:', 'https:'].includes(u.protocol) || !u.hostname || u.username || u.password) return null; // tanpa user:sandi@
  return t;
}

/**
 * Saran perbaikan tautan yang ditempel tanpa skema ("cbt.madrasah.sch.id/ujian") -> versi https:// yang sah, atau null
 * bila tautan sudah sah / tidak dapat diperbaiki dengan menambah skema.
 */
export function saranUrlSoal(url) {
  const t = String(url || '').trim();
  if (!t || urlSoalAman(t) || /^[a-z][a-z0-9+.-]*:/i.test(t)) return null; // sudah sah, atau ber-skema lain (javascript:, ftp:, …)
  const calon = `https://${t.replace(/^\/+/, '')}`;
  return urlSoalAman(calon) && hostUrl(calon).includes('.') ? calon : null;
}

/** Tautan sah tetapi tanpa enkripsi (http://) — boleh, hanya diberi peringatan. */
export const urlTanpaEnkripsi = (url) => !!urlSoalAman(url) && /^http:/i.test(String(url).trim());

/**
 * Buka tautan soal di tab baru tanpa referrer dan tanpa akses balik ke halaman ini (noopener) — untuk menguji tautan
 * dari panel admin. Tautan tidak sah tidak dibuka. -> true bila dibuka.
 */
export function ujiTautanSoal(url) {
  const aman = urlSoalAman(url);
  if (!aman) return false;
  const a = document.createElement('a');
  a.href = aman;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.referrerPolicy = 'no-referrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

/** Nama host untuk ditampilkan ringkas ("quiz.madrasah.sch.id"); '' bila tidak terbaca. */
export function hostUrl(url) {
  try { return new URL(String(url || '').trim()).hostname.replace(/^www\./, ''); } catch { return ''; }
}

/** Isian form dari satu LinkSoal (waktu sebagai nilai input datetime-local WIB). */
export const isianDariLink = (l) => ({
  url: l?.url || '',
  mulai: keInputWaktu(l?.mulai_at || l?.jadwal?.mulai_at),
  selesai: keInputWaktu(l?.selesai_at || l?.jadwal?.selesai_at),
  aktif: l?.aktif !== false,
});

/** Galat isian per field -> { url?, mulai?, selesai? } (kosong = sah). Tautan boleh kosong (mapel ditandai belum siap). */
export function galatIsianLink(isi) {
  const g = {};
  const url = String(isi.url || '').trim();
  if (url && url.length > URL_SOAL_MAKS) g.url = `Tautan soal maksimal ${URL_SOAL_MAKS.toLocaleString('id-ID')} karakter.`;
  else if (url && !urlSoalAman(url)) g.url = 'Tautan soal harus diawali http:// atau https:// dan tanpa spasi.';
  if (!isi.mulai) g.mulai = 'Isi waktu mulai pengerjaan.';
  if (!isi.selesai) g.selesai = 'Isi waktu tutup pengerjaan.';
  else if (isi.mulai && isi.selesai <= isi.mulai) g.selesai = 'Waktu tutup harus setelah waktu mulai.';
  return g;
}

/**
 * Peringatan (tidak menghalangi simpan) bila jendela melebar dari sesi jadwal ujian -> pesan atau null. Jadwal adalah
 * acuan; admin dianjurkan hanya mempersempitnya.
 */
export function peringatanJendela(isi, jadwal) {
  if (!jadwal?.mulai_at || !jadwal?.selesai_at || !isi.mulai || !isi.selesai) return null;
  const awal = keInputWaktu(jadwal.mulai_at);
  const akhir = keInputWaktu(jadwal.selesai_at);
  if (isi.mulai < awal || isi.selesai > akhir) return 'Jendela melebar dari sesi jadwal ujian mapel ini. Pastikan memang disengaja (mis. ujian susulan).';
  return null;
}

/** Jendela sama persis dengan sesi jadwal? (untuk lencana "Mengikuti jadwal" / "Dipersempit") */
export function ikutJadwal(l) {
  if (!l?.jadwal) return false;
  return keInputWaktu(l.mulai_at) === keInputWaktu(l.jadwal.mulai_at) && keInputWaktu(l.selesai_at) === keInputWaktu(l.jadwal.selesai_at);
}

/** Sama dengan yang tersimpan? Dipakai untuk menandai perubahan belum disimpan. */
export const isianLinkSama = (a, b) => String(a.url || '').trim() === String(b.url || '').trim()
  && a.mulai === b.mulai && a.selesai === b.selesai && !!a.aktif === !!b.aktif;

/** Isian -> badan PUT. */
export const badanLink = (isi, versi) => ({
  url: String(isi.url || '').trim(), mulai_at: dariInputWaktu(isi.mulai), selesai_at: dariInputWaktu(isi.selesai), aktif: !!isi.aktif, versi: versi || null,
});

// ---- Susunan per jenjang ----

/**
 * Baris satu jenjang dalam urutan mapel baku: [{ nomor, kode, nama, link: LinkSoal | null }] dan ringkasan
 * { total, siap, terjadwal } untuk lencana tab.
 */
export function barisLinkJenjang(link, mapel, jenjang) {
  const daftar = mapelUntuk(mapel, jenjang);
  const peta = new Map((link || []).filter((l) => Number(l.jenjang) === Number(jenjang)).map((l) => [l.mapel, l]));
  const baris = daftar.map((m, i) => ({ nomor: i + 1, kode: m.kode, nama: m.nama, link: peta.get(m.kode) || null }));
  return {
    baris,
    ringkas: {
      total: baris.length,
      siap: baris.filter((b) => b.link?.siap).length,
      terjadwal: baris.filter((b) => b.link?.mulai_at && b.link?.selesai_at).length,
    },
  };
}

// ---- Data tiruan (selama endpoint belum ada; hanya tersimpan di memori tab ini) ----
const contoh = {};
const GURU_CONTOH = 'Administrator (contoh)';

// Hari ujian contoh: dua hari sudah lewat (sesi-sesinya punya klik), sisanya mulai besok. Minggu dilewati.
const geserHariUjian = (dari, n) => {
  let t = dari;
  const arah = n < 0 ? -1 : 1;
  for (let k = 0; k < Math.abs(n); k += 1) {
    do { t = tambahHari(t, arah); } while (new Date(`${t}T00:00:00Z`).getUTCDay() === 0);
  }
  return t;
};

function jadwalContoh(j, i) {
  // Slot ke-i: hari ujian ke-floor(i/2) — hari 0–1 = dua hari ujian lalu, hari 2 dst. = mulai besok; sesi 1 07.30–09.00 /
  // sesi 2 09.30–11.00.
  const hari = Math.floor(i / 2);
  const tanggal = hari < 2 ? geserHariUjian(hariIniWIB(), hari - 2) : geserHariUjian(hariIniWIB(), hari - 1);
  const sesi = (i % 2) + 1;
  const [m, s] = sesi === 1 ? ['07:30', '09:00'] : ['09:30', '11:00'];
  return { tanggal, sesi_ke: sesi, mulai_at: `${tanggal}T${m}:00+07:00`, selesai_at: `${tanggal}T${s}:00+07:00` };
}

function linkContoh(ujianId) {
  if (!contoh[ujianId]) {
    const daftar = [];
    JENJANG_UJIAN.forEach((j, ji) => {
      MAPEL_UJIAN_BAKU.forEach((m, i) => {
        const slot = (i + ji * 4) % MAPEL_UJIAN_BAKU.length; // urutan jadwal berbeda per jenjang
        const tanpaJadwal = j === 9 && slot === MAPEL_UJIAN_BAKU.length - 1;
        const jadwal = tanpaJadwal ? null : jadwalContoh(j, slot);
        const terisi = !tanpaJadwal && (i + j) % 4 !== 0;
        const dipersempit = terisi && i % 5 === 1;
        daftar.push({
          id: terisi ? `contoh-link-${j}-${m.kode}` : null, jenjang: j, mapel: m.kode,
          url: terisi ? `https://cbt.contoh-madrasah.sch.id/ujian/${j}/${m.kode}` : '', url_host: terisi ? 'cbt.contoh-madrasah.sch.id' : '',
          mulai_at: jadwal ? (dipersempit ? jadwal.mulai_at.replace(/T(07|09):30/, 'T$1:45') : jadwal.mulai_at) : null,
          selesai_at: jadwal?.selesai_at || null,
          aktif: !(terisi && i % 7 === 3), jadwal,
          // klik hanya ada pada sesi yang sudah lewat (sebelum hari ini)
          jumlah_klik: terisi && jadwal.tanggal < hariIniWIB() ? 12 + ((i * 7 + j * 3) % 23) : 0,
          klik_terakhir_at: terisi && jadwal.tanggal < hariIniWIB() ? `${jadwal.tanggal}T${jadwal.sesi_ke === 1 ? '08:4' : '10:4'}${i % 10}:00+07:00` : null,
          diperbarui_pada: terisi ? `${hariIniWIB()}T08:${String(10 + i).padStart(2, '0')}:00+07:00` : null,
          diperbarui_oleh_nama: terisi ? GURU_CONTOH : null, versi: terisi ? `contoh-v1-${j}-${m.kode}` : null,
        });
      });
    });
    daftar.forEach((l) => { l.siap = !!l.url && l.aktif; });
    // Satu mapel kelas 7 yang sesinya sudah lewat dan tautannya terpasang tetapi tidak pernah diklik (tidak tersentuh).
    const sepi = daftar.find((x) => x.jenjang === 7 && x.siap && x.jumlah_klik > 0);
    if (sepi) { sepi.jumlah_klik = 0; sepi.klik_terakhir_at = null; }
    // Dua mapel yang cache-nya sengaja tertinggal dari "jejak audit" (kelas 8 kurang 2, kelas 9 lebih 1) agar hasil
    // bangun ulang penghitung dapat dicoba.
    [[8, 2], [9, -1]].forEach(([j, beda]) => {
      const l = daftar.find((x) => x.jenjang === j && x.jumlah_klik > 1);
      if (l) l.selisih_log = beda;
    });
    contoh[ujianId] = daftar;
  }
  return contoh[ujianId];
}

const galat = (status, detail) => { const e = new Error(String(status)); e.response = { status, data: { detail } }; return e; };

// Jumlah klik menurut "jejak audit" contoh: sama dengan cache kecuali mapel bertanda selisih_log (lihat linkContoh).
const klikLogContoh = (l) => Math.max(0, (l.jumlah_klik || 0) + (l.selisih_log || 0));

/** Link soal satu ujian -> { ujian?, boleh_ubah, tautan_portal, mapel, link, tiruan }. */
export const muatLinkSoal = (ujianId) => denganTiruan(
  async () => (await api.get(`/ujian/${ujianId}/link-soal`)).data,
  async () => {
    // Status portal contoh diambil dari pengelolaan tautan (data contoh yang sama) agar sakelar di kedua menu sejalan.
    let portal = null;
    try { portal = (await muatTautanPublik(ujianId)).tautan?.portal || null; } catch { /* tanpa status portal */ }
    return { boleh_ubah: true, tautan_portal: portal, link: linkContoh(ujianId).map((l) => ({ ...l, jadwal: l.jadwal && { ...l.jadwal } })) };
  },
);

/**
 * Bangun ulang penghitung klik semua link soal satu ujian dari jejak audit -> { diperiksa, diperbaiki, selisih, link,
 * waktu, tiruan }.
 */
export const bangunUlangKlik = (ujianId) => denganTiruan(
  async () => (await api.post(`/ujian/${ujianId}/link-soal/bangun-ulang-klik`)).data,
  () => {
    const daftar = linkContoh(ujianId);
    const selisih = [];
    daftar.filter((l) => l.id).forEach((l) => {
      const sesudah = klikLogContoh(l);
      if (sesudah !== (l.jumlah_klik || 0)) selisih.push({ jenjang: l.jenjang, mapel: l.mapel, sebelum: l.jumlah_klik || 0, sesudah, klik_terakhir_at: l.klik_terakhir_at });
      l.jumlah_klik = sesudah;
      l.selisih_log = 0;
    });
    return {
      diperiksa: daftar.filter((l) => l.id).length, diperbaiki: selisih.length, selisih, waktu: new Date().toISOString(),
      link: daftar.map((l) => ({ ...l, jadwal: l.jadwal && { ...l.jadwal } })),
    };
  },
);

// ---- Intensitas klik (panel admin) ----

/** Ringkasan intensitas dari daftar entri -> { total_klik, mapel_diklik, mapel_siap, klik_terakhir_at }. */
export function ringkasIntensitas(intensitas) {
  const daftar = intensitas || [];
  const terakhir = daftar.map((x) => x.klik_terakhir_at).filter(Boolean).sort().pop() || null;
  return {
    total_klik: daftar.reduce((n, x) => n + (Number(x.jumlah_klik) || 0), 0),
    mapel_diklik: daftar.filter((x) => Number(x.jumlah_klik) > 0).length,
    mapel_siap: daftar.filter((x) => x.siap).length,
    klik_terakhir_at: terakhir,
  };
}

/** Entri intensitas satu jenjang dalam urutan mapel baku: [{ nomor, kode, nama, data: Entri | null }]. */
export function intensitasJenjang(intensitas, mapel, jenjang) {
  const peta = new Map((intensitas || []).filter((x) => Number(x.jenjang) === Number(jenjang)).map((x) => [x.mapel, x]));
  return mapelUntuk(mapel, jenjang).map((m, i) => ({ nomor: i + 1, kode: m.kode, nama: m.nama, data: peta.get(m.kode) || null }));
}

export const SARINGAN_INTENSITAS = [
  { kode: 'semua', label: 'Semua' },
  { kode: 'dikerjakan', label: 'Dikerjakan' },
  { kode: 'tidak_tersentuh', label: 'Tidak tersentuh' },
];

/**
 * Keadaan klik satu entri intensitas pada waktu `kiniMs`:
 *   'dikerjakan'      ada klik sah;
 *   'tidak_tersentuh' tautan terpasang, jendela sudah dibuka (berlangsung/lewat), tetapi belum pernah diklik;
 *   'menunggu'        tautan terpasang, jendela belum dibuka — nol klik masih wajar;
 *   'tanpa_tautan'    tautan soal belum diisi.
 */
export function keadaanKlik(d, kiniMs = Date.now()) {
  if ((Number(d?.jumlah_klik) || 0) > 0) return 'dikerjakan';
  if (!d?.url_host) return 'tanpa_tautan';
  const mulai = parseServerDate(d.mulai_at)?.getTime();
  return Number.isFinite(mulai) && mulai > kiniMs ? 'menunggu' : 'tidak_tersentuh';
}

/**
 * Saring baris intensitas (hasil intensitasJenjang): `mapel` = kode baku atau '' (semua); `status` = 'semua' |
 * 'dikerjakan' | 'tidak_tersentuh' (lihat keadaanKlik).
 */
export function saringIntensitas(baris, { mapel = '', status = 'semua' } = {}, kiniMs = Date.now()) {
  return (baris || []).filter((b) => {
    if (mapel && b.kode !== mapel) return false;
    if (status === 'semua') return true;
    return keadaanKlik(b.data, kiniMs) === status;
  });
}

// Sebaran harian contoh: klik jatuh pada hari sesi mapel itu; sebagian kecil pada hari ujian berikutnya (susulan).
function harianContoh(l) {
  const n = klikLogContoh(l);
  if (!n || !l.jadwal) return [];
  const hariSusulan = geserHariUjian(l.jadwal.tanggal, 1);
  const susulan = l.jumlah_klik % 3 === 0 && hariSusulan <= hariIniWIB() ? Math.min(3, Math.floor(n / 4)) : 0;
  const hasil = [{ tanggal: l.jadwal.tanggal, jumlah: n - susulan }];
  if (susulan) hasil.push({ tanggal: hariSusulan, jumlah: susulan });
  return hasil;
}

/** Intensitas klik "Mengerjakan" per jenjang per mapel (dari jejak audit) -> { rentang, hari, ringkasan, intensitas, tiruan }. */
export const muatIntensitasKlik = (ujianId, { dari = '', sampai = '' } = {}) => denganTiruan(
  async () => (await api.get(`/ujian/${ujianId}/link-soal/intensitas`, { params: { ...(dari ? { dari } : {}), ...(sampai ? { sampai } : {}) } })).data,
  () => {
    const dalam = (t) => (!dari || t >= dari) && (!sampai || t <= sampai);
    const intensitas = linkContoh(ujianId).map((l) => {
      const harian = harianContoh(l).filter((h) => dalam(h.tanggal));
      const jumlah = harian.reduce((n, h) => n + h.jumlah, 0);
      // klik terakhir = klik terbaru dalam rentang pada daftar klik contoh yang sama dengan panel rincian
      const terbaru = jumlah ? klikContohLink(l).find((k) => dalam(wibDateKey(k.waktu))) : null;
      return {
        link_soal_id: l.id, jenjang: l.jenjang, mapel: l.mapel, url_host: l.url_host, mulai_at: l.mulai_at, selesai_at: l.selesai_at, siap: l.siap,
        jumlah_klik: jumlah, klik_terakhir_at: terbaru?.waktu || null, harian,
      };
    });
    const hari = [...new Set(intensitas.flatMap((x) => x.harian.map((h) => h.tanggal)))].sort();
    return { rentang: { dari: dari || null, sampai: sampai || null }, hari, ringkasan: ringkasIntensitas(intensitas), intensitas };
  },
);

// ---- Rincian klik satu mapel ----
const AGEN_KLIK_CONTOH = [
  'Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 12; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
];

/** Kelompokkan & urutkan terbanyak dulu -> [{ [kunci]: nilai, jumlah }]. */
function hitungPer(klik, kunci) {
  const peta = new Map();
  klik.forEach((k) => peta.set(k[kunci], (peta.get(k[kunci]) || 0) + 1));
  return [...peta.entries()].map(([v, jumlah]) => ({ [kunci]: v, jumlah })).sort((a, b) => b.jumlah - a.jumlah || String(a[kunci]).localeCompare(String(b[kunci])));
}

// Klik contoh satu link soal: tersebar di jendela sesi tiap hari pada sebaran harian; sebagian besar dari IP jaringan
// lab sekolah (bersama), sisanya dari IP seluler berbeda-beda.
function klikContohLink(l) {
  const hasil = [];
  harianContoh(l).forEach((h, hi) => {
    const awal = parseServerDate(h.tanggal === l.jadwal?.tanggal ? l.mulai_at : `${h.tanggal}T08:00:00+07:00`).getTime();
    for (let i = 0; i < h.jumlah; i += 1) {
      const s = (i * 7919 + hi * 104729 + l.jenjang * 31) % 997;
      const lab = s % 3 !== 0;
      hasil.push({
        id: `contoh-klik-${l.id}-${hi}-${i}`,
        waktu: new Date(awal + ((i * 173 + s) % 4800) * 1000).toISOString(),
        ip: lab ? `103.47.12.${10 + (s % 2)}` : `114.10.${s % 40}.${(s * 7) % 250 + 3}`,
        perangkat: AGEN_KLIK_CONTOH[(lab ? s % 3 : 3 + (s % 2)) % AGEN_KLIK_CONTOH.length],
        sesi: (s * 2654435761 % 4294967296).toString(16).padStart(8, '0'),
      });
    }
  });
  return hasil.sort((a, b) => b.waktu.localeCompare(a.waktu));
}

/** Rincian klik "Mengerjakan" satu link soal -> { total, klik, per_ip, per_perangkat, tiruan }. */
export const muatRincianKlik = (ujianId, linkSoalId, { batas = 200 } = {}) => denganTiruan(
  async () => (await api.get(`/ujian/${ujianId}/link-soal/${encodeURIComponent(linkSoalId)}/klik`, { params: { batas } })).data,
  () => {
    const l = linkContoh(ujianId).find((x) => x.id === linkSoalId);
    if (!l) throw galat(404, 'Link soal tidak ditemukan.');
    const klik = klikContohLink(l);
    return { total: klik.length, klik: klik.slice(0, batas), per_ip: hitungPer(klik, 'ip'), per_perangkat: hitungPer(klik, 'perangkat') };
  },
);

/** Simpan satu baris link soal (menimpa) -> { link, tiruan }. 409 bila versi berbeda; 422 isian tidak sah. */
export const simpanLinkSoal = (ujianId, jenjang, mapel, isi, versi) => denganTiruan(
  async () => (await api.put(`/ujian/${ujianId}/link-soal/${jenjang}/${encodeURIComponent(mapel)}`, badanLink(isi, versi))).data,
  () => {
    const pesan = Object.values(galatIsianLink(isi))[0];
    if (pesan) throw galat(422, pesan);
    const l = linkContoh(ujianId).find((x) => x.jenjang === Number(jenjang) && x.mapel === mapel);
    if (!l) throw galat(404, 'Mapel tidak ditemukan pada jenjang ini.');
    if ((l.versi || null) !== (versi || null)) throw galat(409, 'Link soal ini baru saja diubah admin lain. Muat ulang untuk melihat isian terbaru.');
    const b = badanLink(isi, versi);
    const waktu = new Date().toISOString();
    Object.assign(l, {
      id: l.id || `contoh-link-${jenjang}-${mapel}`, url: b.url, url_host: hostUrl(b.url), mulai_at: b.mulai_at, selesai_at: b.selesai_at,
      aktif: b.aktif, siap: !!b.url && b.aktif, diperbarui_pada: waktu, diperbarui_oleh_nama: GURU_CONTOH, versi: waktu,
    });
    return { link: { ...l, jadwal: l.jadwal && { ...l.jadwal } } };
  },
);
