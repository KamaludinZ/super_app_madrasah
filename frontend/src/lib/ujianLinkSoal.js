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
 *   LinkSoal = { id, jenjang: 7|8|9, mapel: kode baku, url (admin saja; pemantau: '' dan url_host), url_host,
 *                mulai_at, selesai_at, aktif, siap (url terisi & aktif),
 *                jadwal: { tanggal, sesi_ke, mulai_at, selesai_at } | null,   (sesi jadwal ujian mapel ini = nilai awal)
 *                jumlah_klik, klik_terakhir_at, diperbarui_pada, diperbarui_oleh_nama, versi }
 */
import { api } from '@/lib/api';
import { denganTiruan } from '@/lib/ujian';
import { hariIniWIB } from '@/lib/tanggal';
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
