/**
 * Ujian Madrasah — Pengelolaan Tautan Publik: dua tautan ber-token acak per ujian, yaitu halaman INFO UJIAN untuk siswa
 * (/publik/info-ujian/:token) dan MONITORING PENGUMPULAN berkas (/publik/monitoring-ujian/:token). Admin membuka/menutup
 * tautan kapan saja tanpa menghapusnya, membatasi jendela waktu akses, dan dapat mengganti token (tautan lama mati).
 *
 * Kontrak server (backend menyusul; koleksi `ujian_tautan_publik`):
 *   GET  /ujian/{ujian_id}/tautan-publik
 *     -> { boleh_ubah, tautan: { info: Tautan, monitoring: Tautan } }   (admin mengubah; pimpinan & ketua/sekretaris melihat;
 *        tautan yang belum ada dibuat otomatis dalam keadaan DITUTUP)
 *   PUT  /ujian/{ujian_id}/tautan-publik/{jenis} { aktif? , mulai_at?, selesai_at? } -> { tautan: Tautan, peringatan }   (admin)
 *        PARSIAL: hanya field yang dikirim yang berubah — sakelar mengirim { aktif }, form jendela { mulai_at, selesai_at }
 *        (ISO WIB atau null = tanpa batas; selesai harus setelah mulai, dicek terhadap nilai gabungan -> 422 pesan)
 *   POST /ujian/{ujian_id}/tautan-publik/{jenis}/ganti-token -> { tautan: Tautan }   (admin; token lama langsung tidak dikenal)
 *   Tautan = { id, jenis: 'info'|'monitoring', token, jalur: '/publik/…/<token>', aktif, mulai_at, selesai_at,
 *              berlaku, alasan: 'ok'|'nonaktif'|'belum_mulai'|'sudah_selesai', pesan, diperbarui_pada }
 *
 *   GET  /ujian/{ujian_id}/tautan-publik/audit?jenis=info|monitoring&hasil=ok|ditolak&dari=&sampai=&cari=&batas=50
 *        (dari/sampai 'YYYY-MM-DD' WIB inklusif; cari = potongan IP atau user agent)
 *     -> { ringkasan: { total, ok, ditolak, kartu_soal_ditolak },
 *          akses: [{ id, jenis_tautan, waktu, ip, perangkat, hasil, sesi, terakhir_aktif, jumlah_segarkan }]  (terbaru dulu),
 *          perubahan: [{ id, waktu, jenis, aksi: 'buka'|'tutup'|'jendela'|'ganti_token', oleh_nama, detail }] }
 *        (admin & pemantau; sumber ujian_akses_log & audit perubahan tautan)
 */
import { api } from '@/lib/api';
import { denganTiruan } from '@/lib/ujian';
import { parseServerDate } from '@/lib/datetime';

export const HALAMAN_TAUTAN_PUBLIK = '/ujian/tautan-publik';

export const JENIS_TAUTAN_PUBLIK = [
  { jenis: 'info', judul: 'Info Ujian', untuk: 'Siswa', keterangan: 'Jadwal, tata tertib, panduan CBT, dan unduh kisi-kisi per jenjang.', pola: '/publik/info-ujian/' },
  { jenis: 'monitoring', judul: 'Monitoring Pengumpulan Soal', untuk: 'Panitia & guru', keterangan: 'Status kisi-kisi & kartu soal per mapel, nama PJ, dan waktu update — tanpa isi kartu soal.', pola: '/publik/monitoring-ujian/' },
];

/** URL lengkap tautan publik (server mengirim jalur relatif). */
export const urlTautan = (t) => (t?.jalur ? `${window.location.origin}${t.jalur}` : '');

// ---- Salin & bagikan ----
/**
 * Salin teks ke clipboard -> true bila berhasil. navigator.clipboard hanya ada di konteks aman (HTTPS/localhost);
 * di HTTP biasa (jaringan sekolah) memakai cadangan textarea + execCommand('copy').
 */
export async function salinTeks(teks) {
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext !== false) {
      await navigator.clipboard.writeText(teks);
      return true;
    }
  } catch { /* lanjut ke cadangan */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = teks;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return !!ok;
  } catch {
    return false;
  }
}

/** Pesan siap kirim (WhatsApp/grup kelas) untuk satu tautan. */
export function pesanBagikan(meta, url, namaUjian) {
  const untuk = meta.jenis === 'info' ? 'Info ujian (jadwal, tata tertib, panduan CBT, kisi-kisi)' : 'Monitoring pengumpulan kisi-kisi & kartu soal';
  return `${untuk}${namaUjian ? ` — ${namaUjian}` : ''}:\n${url}`;
}

// ---- Waktu: <input type="datetime-local"> selalu dibaca/ditulis dalam WIB ----
/** ISO server -> nilai input datetime-local WIB 'YYYY-MM-DDTHH:MM' ('' bila kosong). */
export function keInputWaktu(iso) {
  const d = parseServerDate(iso);
  if (!d) return '';
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta', hour12: false }).replace(' ', 'T').slice(0, 16);
}

/** Nilai input datetime-local (WIB) -> ISO WIB 'YYYY-MM-DDTHH:MM:00+07:00', atau null bila kosong. */
export const dariInputWaktu = (v) => (v ? `${v}:00+07:00` : null);

/**
 * Status berlaku tautan (cermin ujian_info.cek_tautan di backend) -> { berlaku, alasan, pesan }.
 * Batas yang terisi tetapi tidak terbaca membuat tautan ditolak (fail-closed).
 */
export function statusTautan(t, sekarang = new Date()) {
  if (!t) return { berlaku: false, alasan: 'tidak_dikenal', pesan: 'Tautan belum dibuat.' };
  if (!t.aktif) return { berlaku: false, alasan: 'nonaktif', pesan: 'Ditutup — pengunjung melihat "tautan sedang ditutup".' };
  const mulai = parseServerDate(t.mulai_at);
  const selesai = parseServerDate(t.selesai_at);
  if ((t.mulai_at && !mulai) || (t.selesai_at && !selesai)) return { berlaku: false, alasan: 'nonaktif', pesan: 'Pengaturan waktu tidak valid.' };
  if (mulai && sekarang < mulai) return { berlaku: false, alasan: 'belum_mulai', pesan: 'Belum masuk jendela waktu akses.' };
  if (selesai && sekarang >= selesai) return { berlaku: false, alasan: 'sudah_selesai', pesan: 'Jendela waktu akses sudah lewat.' };
  return { berlaku: true, alasan: 'ok', pesan: 'Dapat dibuka siapa saja yang memegang tautan.' };
}

const geserHari = (tanggal, n) => {
  const d = new Date(`${tanggal}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Preset jendela waktu dari masa ujian ({ mulai, selesai } 'YYYY-MM-DD') -> [{ kode, label, mulai, selesai }] dalam
 * nilai input datetime-local WIB. Tanpa masa ujian hanya tersedia "Tanpa batas".
 */
export function presetJendela(ujian) {
  const hasil = [];
  if (ujian?.mulai && ujian?.selesai) {
    hasil.push({ kode: 'sepekan', label: 'Sepekan sebelum ujian – hari terakhir', mulai: `${geserHari(ujian.mulai, -7)}T07:00`, selesai: `${ujian.selesai}T16:00` });
    hasil.push({ kode: 'masa_ujian', label: 'Masa ujian saja', mulai: `${ujian.mulai}T06:00`, selesai: `${ujian.selesai}T16:00` });
  }
  hasil.push({ kode: 'tanpa_batas', label: 'Tanpa batas', mulai: '', selesai: '' });
  return hasil;
}

const teksWaktu = (v) => new Date(`${v}:00+07:00`).toLocaleString('id-ID', {
  timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** Kalimat ringkas jendela waktu dari nilai input (WIB). */
export function ringkasJendela({ mulai, selesai }) {
  if (!mulai && !selesai) return 'Tanpa batas waktu — dapat dibuka kapan saja selama tautan terbuka.';
  if (mulai && !selesai) return `Dapat dibuka mulai ${teksWaktu(mulai)} WIB, tanpa batas akhir.`;
  if (!mulai && selesai) return `Dapat dibuka sampai ${teksWaktu(selesai)} WIB.`;
  return `Dapat dibuka ${teksWaktu(mulai)} – ${teksWaktu(selesai)} WIB.`;
}

/** Waktu selesai (input WIB) sudah lewat terhadap `sekarang`? */
export const selesaiSudahLewat = (selesai, sekarang = new Date()) => !!selesai && new Date(`${selesai}:00+07:00`) <= sekarang;

function teksDurasi(ms) {
  const menit = Math.max(1, Math.round(ms / 60000));
  if (menit < 60) return `${menit} menit`;
  const jam = Math.round(menit / 60);
  if (jam < 48) return `${jam} jam`;
  return `${Math.round(jam / 24)} hari`;
}

/** Keterangan waktu relatif status tautan, mis. "Dibuka otomatis dalam 2 hari", "Berakhir dalam 5 jam", atau null. */
export function keteranganWaktu(t, sekarang = new Date()) {
  const mulai = parseServerDate(t?.mulai_at);
  const selesai = parseServerDate(t?.selesai_at);
  const st = statusTautan(t, sekarang);
  if (st.alasan === 'belum_mulai') return `Dibuka otomatis dalam ${teksDurasi(mulai - sekarang)}`;
  if (st.alasan === 'sudah_selesai') return `Berakhir ${teksDurasi(sekarang - selesai)} lalu`;
  if (st.alasan === 'ok' && selesai) return `Berakhir dalam ${teksDurasi(selesai - sekarang)}`;
  if (st.alasan === 'ok') return 'Tanpa batas akhir';
  if (st.alasan === 'nonaktif' && mulai && sekarang < mulai) return `Jendela mulai dalam ${teksDurasi(mulai - sekarang)} (tautan masih ditutup)`;
  return null;
}

/**
 * Peringatan pengaturan tautan -> [{ kode, pesan }]: hal yang kemungkinan tidak disengaja admin.
 * `masaUjian` = { mulai, selesai } 'YYYY-MM-DD'.
 */
export function peringatanTautan(t, masaUjian, sekarang = new Date()) {
  if (!t) return [];
  const hasil = [];
  const st = statusTautan(t, sekarang);
  const selesai = parseServerDate(t.selesai_at);
  const hari = sekarang.toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
  const selamaUjian = masaUjian?.mulai && masaUjian?.selesai && masaUjian.mulai <= hari && hari <= masaUjian.selesai;
  if (t.aktif && st.alasan === 'sudah_selesai') {
    hasil.push({ kode: 'aktif_berakhir', pesan: 'Tautan masih dibuka tetapi jendela waktunya sudah lewat — perpanjang waktu selesai atau tutup tautan.' });
  }
  if (t.jenis === 'info' && !t.aktif && selamaUjian) {
    hasil.push({ kode: 'info_tutup_saat_ujian', pesan: 'Masa ujian sedang berlangsung tetapi tautan info ditutup — siswa tidak dapat melihat jadwal & kisi-kisi.' });
  }
  if (t.jenis === 'info' && selesai && masaUjian?.selesai && selesai < new Date(`${masaUjian.selesai}T00:00:00+07:00`)) {
    hasil.push({ kode: 'berakhir_sebelum_ujian', pesan: 'Jendela waktu berakhir sebelum hari terakhir ujian.' });
  }
  if (t.jenis === 'monitoring' && t.aktif && !t.selesai_at) {
    hasil.push({ kode: 'monitoring_tanpa_batas', pesan: 'Tautan monitoring terbuka tanpa batas akhir — pertimbangkan menutupnya setelah pengumpulan selesai.' });
  }
  return hasil;
}

/** Galat isian jendela waktu (sama dengan JendelaTautanIn di backend) -> pesan atau null. */
export function galatJendela({ mulai, selesai }) {
  if (mulai && selesai && selesai <= mulai) return 'Waktu selesai harus setelah waktu mulai.';
  return null;
}

// ---- Data tiruan (selama endpoint belum ada; perubahan hanya di memori) ----
const contoh = {}; // { ujian_id: { info, monitoring } }

function tokenAcak() {
  const huruf = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let t = '';
  for (let i = 0; i < 32; i += 1) t += huruf[Math.floor(Math.random() * huruf.length)];
  return t;
}

function lengkapi(t) {
  return { ...t, jalur: `${JENIS_TAUTAN_PUBLIK.find((j) => j.jenis === t.jenis).pola}${t.token}`, ...statusTautan(t) };
}

function tautanContoh(ujianId) {
  if (!contoh[ujianId]) {
    const kini = new Date().toISOString();
    contoh[ujianId] = {
      info: { id: `contoh-info-${ujianId}`, jenis: 'info', token: tokenAcak(), aktif: true, mulai_at: null, selesai_at: null, diperbarui_pada: kini },
      monitoring: { id: `contoh-mon-${ujianId}`, jenis: 'monitoring', token: tokenAcak(), aktif: false, mulai_at: null, selesai_at: null, diperbarui_pada: kini },
    };
  }
  return contoh[ujianId];
}

export const muatTautanPublik = (ujianId) => denganTiruan(
  async () => (await api.get(`/ujian/${ujianId}/tautan-publik`)).data,
  () => {
    const t = tautanContoh(ujianId);
    return { boleh_ubah: true, tautan: { info: lengkapi(t.info), monitoring: lengkapi(t.monitoring) } };
  },
);

export const simpanTautanPublik = (ujianId, jenis, isi) => denganTiruan(
  async () => (await api.put(`/ujian/${ujianId}/tautan-publik/${jenis}`, isi)).data,
  () => {
    const t = tautanContoh(ujianId);
    const baru = { ...t[jenis] }; // parsial, seperti server
    if ('aktif' in isi) baru.aktif = !!isi.aktif;
    if ('mulai_at' in isi) baru.mulai_at = isi.mulai_at || null;
    if ('selesai_at' in isi) baru.selesai_at = isi.selesai_at || null;
    const pesan = galatJendela({ mulai: baru.mulai_at, selesai: baru.selesai_at });
    if (pesan) { const e = new Error('422'); e.response = { status: 422, data: { detail: pesan } }; throw e; }
    t[jenis] = { ...baru, diperbarui_pada: new Date().toISOString() };
    return { tautan: lengkapi(t[jenis]), peringatan: [] };
  },
);

export const gantiTokenTautan = (ujianId, jenis) => denganTiruan(
  async () => (await api.post(`/ujian/${ujianId}/tautan-publik/${jenis}/ganti-token`)).data,
  () => {
    const t = tautanContoh(ujianId);
    t[jenis] = { ...t[jenis], token: tokenAcak(), diperbarui_pada: new Date().toISOString() };
    return { tautan: lengkapi(t[jenis]) };
  },
);


// ---- Saringan waktu & teks (sama untuk jejak akses & unduhan) ----
const tanggalWIB = (iso) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
/** Saring baris log tiruan menurut { dari, sampai } ('YYYY-MM-DD' WIB, inklusif) dan cari (IP/perangkat, tanpa beda huruf). */
export function saringLogTiruan(items, { dari, sampai, cari } = {}) {
  const c = String(cari || '').trim().toLowerCase();
  return items.filter((x) => {
    const t = tanggalWIB(x.waktu);
    return (!dari || t >= dari) && (!sampai || t <= sampai)
      && (!c || String(x.ip || '').toLowerCase().includes(c) || String(x.perangkat || '').toLowerCase().includes(c));
  });
}
/** Parameter API saringan umum (hanya yang terisi). */
export const paramSaringanAudit = ({ dari, sampai, cari } = {}) => ({ ...(dari ? { dari } : {}), ...(sampai ? { sampai } : {}), ...(cari ? { cari } : {}) });

// ---- Jejak audit akses & perubahan tautan ----
export const LABEL_HASIL_AKSES = {
  ok: 'Berhasil', tidak_dikenal: 'Token salah', nonaktif: 'Ditutup', belum_mulai: 'Belum dibuka', sudah_selesai: 'Berakhir',
  kartu_soal_ditolak: 'Coba unduh kartu soal',
};
export const LABEL_AKSI_TAUTAN = { buka: 'Membuka tautan', tutup: 'Menutup tautan', jendela: 'Mengubah jendela waktu', ganti_token: 'Mengganti token' };

/** "Chrome · Android" dari user agent (perkiraan ringkas untuk dibaca admin). */
export function ringkasPerangkat(ua) {
  const s = String(ua || '');
  if (!s) return 'Perangkat tidak diketahui';
  const os = /Android/i.test(s) ? 'Android' : /iPhone|iPad|iOS/i.test(s) ? 'iOS' : /Windows/i.test(s) ? 'Windows'
    : /Mac OS X|Macintosh/i.test(s) ? 'macOS' : /CrOS/i.test(s) ? 'ChromeOS' : /Linux/i.test(s) ? 'Linux' : null;
  const browser = /WhatsApp/i.test(s) ? 'WhatsApp' : /Edg\//.test(s) ? 'Edge' : /OPR\/|Opera/.test(s) ? 'Opera'
    : /SamsungBrowser/i.test(s) ? 'Samsung Internet' : /Firefox\//.test(s) ? 'Firefox' : /Chrome\//.test(s) ? 'Chrome'
      : /Safari\//.test(s) ? 'Safari' : null;
  return [browser, os].filter(Boolean).join(' · ') || s.slice(0, 40);
}

/** Lama pemantauan satu sesi akses (monitoring): "45 menit · 12× muat ulang", atau null bila tidak dimuat ulang. */
export function lamaPantau(a) {
  if (!a?.jumlah_segarkan) return null;
  const awal = parseServerDate(a.waktu);
  const akhir = parseServerDate(a.terakhir_aktif);
  const menit = awal && akhir ? Math.max(1, Math.round((akhir - awal) / 60000)) : null;
  const durasi = menit === null ? null : menit < 60 ? `${menit} menit` : `${Math.floor(menit / 60)} jam ${menit % 60} menit`;
  return [durasi && `dipantau ${durasi}`, `${a.jumlah_segarkan}× muat ulang`].filter(Boolean).join(' · ');
}

const AGEN_CONTOH = [
  'Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Mozilla/5.0 (Linux; Android 12; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) WhatsApp/2.23 Chrome/119.0 Mobile Safari/537.36',
];

export function auditTiruan(ujianId, { jenis, hasil, ...saringanUmum } = {}) {
  const kini = Date.now();
  const hasilUrut = ['ok', 'ok', 'ok', 'ok', 'tidak_dikenal', 'ok', 'nonaktif', 'ok', 'kartu_soal_ditolak', 'ok', 'ok', 'belum_mulai'];
  let akses = Array.from({ length: 24 }, (_, i) => {
    const j = i % 3 === 0 ? 'monitoring' : 'info';
    const h = hasilUrut[i % hasilUrut.length];
    const waktu = new Date(kini - (i * 47 + 3) * 60000).toISOString();
    const pantau = j === 'monitoring' && h === 'ok' ? (i % 5) * 9 + 4 : 0;
    return { id: `contoh-akses-${i}`, jenis_tautan: j, waktu, ip: `10.20.${i % 7}.${(i * 37) % 250 + 2}`, perangkat: AGEN_CONTOH[i % AGEN_CONTOH.length],
      hasil: j === 'monitoring' && h === 'kartu_soal_ditolak' ? 'ok' : h, sesi: j === 'monitoring' ? `sesi${i}` : null,
      terakhir_aktif: new Date(Date.parse(waktu) + pantau * 60000).toISOString(), jumlah_segarkan: pantau };
  });
  const ringkasan = {
    total: akses.length, ok: akses.filter((a) => a.hasil === 'ok').length, ditolak: akses.filter((a) => a.hasil !== 'ok').length,
    kartu_soal_ditolak: akses.filter((a) => a.hasil === 'kartu_soal_ditolak').length,
  };
  akses = saringLogTiruan(akses, saringanUmum);
  if (jenis) akses = akses.filter((a) => a.jenis_tautan === jenis);
  if (hasil === 'ok') akses = akses.filter((a) => a.hasil === 'ok');
  if (hasil === 'ditolak') akses = akses.filter((a) => a.hasil !== 'ok');
  const perubahan = [
    { id: 'contoh-ubah-1', waktu: new Date(kini - 26 * 3600000).toISOString(), jenis: 'info', aksi: 'jendela', oleh_nama: 'Administrator (contoh)', detail: 'Sepekan sebelum ujian – hari terakhir' },
    { id: 'contoh-ubah-2', waktu: new Date(kini - 25 * 3600000).toISOString(), jenis: 'info', aksi: 'buka', oleh_nama: 'Administrator (contoh)', detail: null },
    { id: 'contoh-ubah-3', waktu: new Date(kini - 5 * 3600000).toISOString(), jenis: 'monitoring', aksi: 'ganti_token', oleh_nama: 'Administrator (contoh)', detail: 'Token lama tidak berlaku' },
  ].filter((p) => !jenis || p.jenis === jenis).reverse();
  return { ringkasan, akses, perubahan };
}

export const muatAuditTautan = (ujianId, saringan = {}) => denganTiruan(
  async () => (await api.get(`/ujian/${ujianId}/tautan-publik/audit`, {
    params: { ...(saringan.jenis ? { jenis: saringan.jenis } : {}), ...(saringan.hasil ? { hasil: saringan.hasil } : {}), ...paramSaringanAudit(saringan), batas: 50 },
  })).data,
  () => auditTiruan(ujianId, saringan),
);
