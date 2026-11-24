/**
 * Ujian Madrasah — halaman INFO UJIAN publik untuk siswa (tanpa login): jadwal, tata tertib, panduan CBT, dan kisi-kisi
 * per jenjang dengan penghitung unduhan. Akses lewat token tautan acak jenis `info` (ujian_tautan_publik) yang dapat
 * dibuka/tutup admin dan dibatasi jendela waktu; backend memvalidasi token + jendela pada setiap permintaan dan
 * mencatat akses ke ujian_akses_log.
 *
 * Kontrak server (backend menyusul):
 *   GET /publik/info-ujian/{token}
 *     -> { madrasah: { nama, logo_url },
 *          ujian: { nama, jenis, tahun_pelajaran, mulai, selesai } | null,
 *          tautan: { jenis: 'info', mulai_at, selesai_at },
 *          jadwal: [{ id, tanggal 'YYYY-MM-DD', sesi_ke, jam_mulai, jam_selesai, mapel: { '7': nama, '8': nama, '9': nama } }],
 *          tata_tertib: string (teks polos; baris "1. …" / "- …" menjadi butir daftar),
 *          panduan_cbt: { ada_pdf, nama_file, video_url, keterangan },
 *          kisi_kisi: [{ id, jenjang: 7|8|9, mapel: kode baku (lib/mapelUjian), nama_file, ukuran_byte, updated_at, jumlah_unduh }],
 *          mapel: { '7': [{ kode, nama }], '8': [...], '9': [...] } }   (mapel baku aktif per jenjang; lihat mapelUntuk)
 *        (kisi_kisi hanya memuat berkas yang sudah terkirim; mapel baku tanpa berkas = "belum tersedia")
 *     404 token tidak dikenal (detail: pesan)
 *     403 tautan tidak berlaku -> detail { alasan: 'nonaktif' | 'belum_mulai' | 'sudah_selesai', pesan, mulai_at, selesai_at,
 *                                          madrasah?: { nama, logo_url } (kop halaman) }
 *   GET /publik/info-ujian/{token}/panduan-cbt          -> berkas PDF panduan CBT (inline)
 *   GET /publik/info-ujian/{token}/kisi-kisi/{berkas_id} -> berkas PDF kisi-kisi (attachment);
 *        server menambah jumlah_unduh, mencatat ujian_unduh_log, dan mengirim header X-Jumlah-Unduh (jumlah terbaru,
 *        perlu diekspos lewat CORS Access-Control-Expose-Headers). 403/404 sama seperti di atas.
 */
import { denganTiruan, publik } from '@/lib/ujianPublik';
import { hariIniWIB } from '@/lib/tanggal';
import { formatWIB, parseServerDate } from '@/lib/datetime';
import { JENJANG_UJIAN, MAPEL_UJIAN_BAKU, namaMapelUjian } from '@/lib/mapelUjian';

const BASIS_API = `${process.env.REACT_APP_BACKEND_URL || ''}/api`;

export const urlPanduanCbt = (token) => `${BASIS_API}/publik/info-ujian/${encodeURIComponent(token)}/panduan-cbt`;

// ---- Token dari alamat ----
/**
 * Token bersih dari segmen URL: tanda baca yang sering ikut tersalin di ujung tautan dalam kalimat (titik, koma, kurung,
 * tanda kutip, …) dibuang. Token sah hanya memuat huruf, angka, '-' dan '_'.
 */
export const bersihkanToken = (token) => String(token || '').trim().replace(/[.,;:!?)\]}'"”’>…]+$/u, '');

// ---- Galat tautan ----

/** Alasan tautan tidak dapat dibuka -> { alasan, pesan, mulai_at, selesai_at, madrasah } atau null bila galat lain (mis. koneksi). */
export function galatTautanInfo(e) {
  const status = e?.response?.status;
  const d = e?.response?.data?.detail;
  if (status === 404) return { alasan: 'tidak_dikenal', pesan: typeof d === 'string' && d !== 'Not Found' ? d : null };
  if (status === 403) {
    if (d && typeof d === 'object') {
      return { alasan: d.alasan || 'nonaktif', pesan: d.pesan || null, mulai_at: d.mulai_at, selesai_at: d.selesai_at, madrasah: d.madrasah || null };
    }
    return { alasan: 'nonaktif', pesan: typeof d === 'string' ? d : null };
  }
  return null;
}

/** Milidetik sampai waktu server `iso` (negatif bila sudah lewat; null bila tidak terbaca). */
export function msSampai(iso, sekarang = Date.now()) {
  const d = parseServerDate(iso);
  return d ? d.getTime() - sekarang : null;
}

/** "3 hari lagi" | "2 jam 15 menit lagi" | "15 menit lagi" | "kurang dari 1 menit lagi"; null bila sudah lewat/tidak terbaca. */
export function teksSisaWaktu(ms) {
  if (ms === null || ms === undefined || ms <= 0) return null;
  const menit = Math.floor(ms / 60000);
  if (menit < 1) return 'kurang dari 1 menit lagi';
  const jam = Math.floor(menit / 60);
  if (jam >= 48) return `${Math.floor(jam / 24)} hari lagi`;
  if (jam >= 1) return `${jam} jam${menit % 60 ? ` ${menit % 60} menit` : ''} lagi`;
  return `${menit} menit lagi`;
}

// Respons galat ber-responseType blob: isinya JSON FastAPI yang perlu dibaca dulu agar detail/pesan terbaca.
async function bacaGalatBlob(e) {
  const data = e?.response?.data;
  if (data instanceof Blob) {
    try { e.response.data = JSON.parse(await data.text()); } catch { e.response.data = {}; }
  }
  return e;
}

// ---- Tata tertib: teks polos -> blok paragraf / daftar bertingkat ----
// Penanda butir: angka "1." / "1)" (spasi sesudahnya boleh tidak ada: "1.Peserta"), huruf "a." / "a)" / "A.", atau butir
// "-", "•", "*", "–". Huruf wajib diikuti spasi agar singkatan seperti "S.Pd." di awal baris tidak dianggap butir.
const PENANDA = /^(?:(\d{1,3})([.)])(?:\s+|(?=\p{L}))|([a-z])([.)])\s+|([A-Z])([.)])\s+|([-•*–])\s+)(.*)$/u;
export const TINGKAT_TATA_TERTIB_MAKS = 4;

function bacaPenanda(t) {
  const m = PENANDA.exec(t);
  if (!m) return null;
  if (m[1]) return { jenis: `angka${m[2]}`, label: m[1], tanda: m[2], teks: m[8] };
  if (m[3]) return { jenis: `huruf${m[4]}`, label: m[3], tanda: m[4], teks: m[8] };
  if (m[5]) return { jenis: `HURUF${m[6]}`, label: m[5], tanda: m[6], teks: m[8] };
  return { jenis: 'butir', label: null, tanda: '', teks: m[8] };
}

/**
 * Pecah teks tata tertib menjadi blok [{ jenis: 'paragraf', teks } | { jenis: 'daftar', ...Daftar }], dengan
 * Daftar = { penanda: 'angka.'|'angka)'|'huruf.'|'huruf)'|'HURUF.'|'HURUF)'|'butir', butir: [{ label, tanda, teks, anak: Daftar|null }] }.
 * Tingkat ditentukan JENIS PENANDA, bukan jumlah spasi (teks tempelan dari Word sering menjorok tidak konsisten):
 * penanda yang sudah ada di tumpukan kembali ke tingkat itu; penanda jenis baru menjadi sub-daftar butir terakhir
 * (mis. "1." → "a." → "1)"), maksimal TINGKAT_TATA_TERTIB_MAKS tingkat. Label asli dari teks dipertahankan.
 * Baris tanpa penanda yang menjorok melanjutkan butir terakhir; yang tidak menjorok menjadi paragraf dan menutup
 * daftar. Baris kosong hanya memisah paragraf (daftar boleh diselingi baris kosong).
 */
export function pecahTataTertib(teks) {
  const blok = [];
  let tumpukan = []; // daftar aktif dari terluar ke terdalam
  let paragraf = null;
  String(teks || '').split(/\r?\n/).forEach((baris) => {
    const t = baris.trim();
    if (!t) { paragraf = null; return; }
    const p = bacaPenanda(t);
    if (p) {
      paragraf = null;
      const butir = { label: p.label, tanda: p.tanda, teks: p.teks.trim(), anak: null };
      const i = tumpukan.findIndex((d) => d.penanda === p.jenis);
      if (i >= 0) {
        tumpukan = tumpukan.slice(0, i + 1);
        tumpukan[i].butir.push(butir);
      } else if (tumpukan.length && tumpukan.length < TINGKAT_TATA_TERTIB_MAKS) {
        const atas = tumpukan[tumpukan.length - 1];
        const induk = atas.butir[atas.butir.length - 1];
        induk.anak = { penanda: p.jenis, butir: [butir] };
        tumpukan.push(induk.anak);
      } else if (tumpukan.length) {
        tumpukan[tumpukan.length - 1].butir.push(butir); // melebihi batas tingkat: tetap di tingkat terdalam
      } else {
        const d = { jenis: 'daftar', penanda: p.jenis, butir: [butir] };
        blok.push(d);
        tumpukan = [d];
      }
    } else if (tumpukan.length && /^\s/.test(baris)) {
      const atas = tumpukan[tumpukan.length - 1];
      const b = atas.butir[atas.butir.length - 1];
      b.teks = b.teks ? `${b.teks} ${t}` : t; // baris menjorok = lanjutan butir terakhir
    } else if (paragraf) {
      paragraf.teks += ` ${t}`;
    } else {
      tumpukan = [];
      paragraf = { jenis: 'paragraf', teks: t };
      blok.push(paragraf);
    }
  });
  return blok;
}

// ---- Jadwal & kisi-kisi per jenjang ----

/** Jadwal satu jenjang dikelompokkan per tanggal -> [{ tanggal, sesi: [{ id, sesi_ke, jam_mulai, jam_selesai, mapel }] }]. */
export function jadwalJenjang(jadwal, jenjang) {
  const perTanggal = new Map();
  [...(jadwal || [])]
    .sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || '') || (a.sesi_ke || 0) - (b.sesi_ke || 0))
    .forEach((s) => {
      const mapel = (s.mapel || {})[String(jenjang)];
      if (!mapel) return;
      if (!perTanggal.has(s.tanggal)) perTanggal.set(s.tanggal, []);
      perTanggal.get(s.tanggal).push({ id: s.id, sesi_ke: s.sesi_ke, jam_mulai: s.jam_mulai, jam_selesai: s.jam_selesai, mapel });
    });
  return [...perTanggal.entries()].map(([tanggal, sesi]) => ({ tanggal, sesi }));
}

/** Jam sekarang 'HH:MM' menurut WIB (pasangan hariIniWIB). */
export const jamWIB = () => new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/**
 * Status tiap sesi terhadap waktu sekarang WIB: 'lewat' | 'berlangsung' | 'mendatang', serta sesi sorotan (yang sedang
 * berlangsung, atau bila tidak ada, sesi mendatang terdekat) -> { status: { [sesi_id]: status }, sorotan: { tanggal, sesi, status } | null }.
 * `kelompok` = hasil jadwalJenjang.
 */
export function statusJadwal(kelompok, hariIni, jam) {
  const status = {};
  let sorotan = null;
  (kelompok || []).forEach((h) => h.sesi.forEach((s) => {
    let st = 'mendatang';
    if (h.tanggal < hariIni || (h.tanggal === hariIni && (s.jam_selesai || '') <= jam)) st = 'lewat';
    else if (h.tanggal === hariIni && (s.jam_mulai || '') <= jam) st = 'berlangsung';
    status[s.id] = st;
    if (st === 'berlangsung' && sorotan?.status !== 'berlangsung') sorotan = { tanggal: h.tanggal, sesi: s, status: st };
    else if (st === 'mendatang' && !sorotan) sorotan = { tanggal: h.tanggal, sesi: s, status: st };
  }));
  return { status, sorotan };
}

/** Mapel baku satu jenjang (urutan baku; `mapel` dari server bila ada) beserta berkas kisi-kisinya (null bila belum terkirim). */
export function kisiKisiJenjang(kisiKisi, jenjang, mapel = MAPEL_UJIAN_BAKU) {
  const berkas = new Map((kisiKisi || []).filter((k) => Number(k.jenjang) === Number(jenjang)).map((k) => [k.mapel, k]));
  return mapel.map((m, i) => ({ nomor: i + 1, kode: m.kode, nama: m.nama, berkas: berkas.get(m.kode) || null }));
}

/**
 * Rentang tanggal 'YYYY-MM-DD' ringkas: "23–28 November 2026", "23 November – 1 Desember 2026",
 * "30 Desember 2026 – 2 Januari 2027", atau satu tanggal bila sama/tanpa akhir.
 */
export function rentangTanggal(mulai, selesai) {
  const lengkap = { day: 'numeric', month: 'long', year: 'numeric' };
  if (!mulai) return '';
  if (!selesai || selesai === mulai) return formatWIB(mulai, 'Date', lengkap);
  if (mulai.slice(0, 7) === selesai.slice(0, 7)) return `${Number(mulai.slice(8, 10))}–${formatWIB(selesai, 'Date', lengkap)}`;
  if (mulai.slice(0, 4) === selesai.slice(0, 4)) return `${formatWIB(mulai, 'Date', { day: 'numeric', month: 'long' })} – ${formatWIB(selesai, 'Date', lengkap)}`;
  return `${formatWIB(mulai, 'Date', lengkap)} – ${formatWIB(selesai, 'Date', lengkap)}`;
}

/** URL video panduan yang aman ditautkan (hanya http/https) atau null. */
export const urlVideoAman = (url) => (/^https?:\/\/[^\s]+$/i.test(String(url || '').trim()) ? String(url).trim() : null);

/** ID video YouTube (11 karakter) dari tautan watch/youtu.be/shorts/embed/live, atau null bila bukan YouTube. */
export function idVideoYoutube(url) {
  const aman = urlVideoAman(url);
  if (!aman) return null;
  let u;
  try { u = new URL(aman); } catch { return null; }
  const host = u.hostname.replace(/^(www\.|m\.)/, '');
  let id = null;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = u.pathname === '/watch' ? u.searchParams.get('v') : (u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/) || [])[1];
  }
  return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : null;
}

export function formatUkuran(bita) {
  if (!bita && bita !== 0) return '';
  if (bita < 1024) return `${bita} B`;
  if (bita < 1000 * 1024) return `${Math.round(bita / 1024)} KB`; // ≥ 1000 KB ditulis sebagai MB
  return `${(bita / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

function simpanBlob(blob, namaFile) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = namaFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ---- Data tiruan (dipakai selama endpoint backend belum ada) ----
// Token contoh untuk mencoba tampilan tautan tidak berlaku: contoh-ditutup, contoh-belum-mulai, contoh-berakhir, contoh-salah;
// contoh-kosong = tautan sah tetapi panitia belum mengisi apa pun (jadwal, tata tertib, panduan, kisi-kisi).
// Unduhan tiruan disimpan per tab browser agar penghitung tetap bertambah setelah muat ulang (meniru penghitung server).
const KUNCI_UNDUH_CONTOH = 'infoUjian:unduhContoh';
const unduhContoh = (() => {
  try { return JSON.parse(sessionStorage.getItem(KUNCI_UNDUH_CONTOH)) || {}; } catch { return {}; }
})(); // { berkas_id: jumlah unduhan tambahan }
const simpanUnduhContoh = () => {
  try { sessionStorage.setItem(KUNCI_UNDUH_CONTOH, JSON.stringify(unduhContoh)); } catch { /* abaikan */ }
};

export const tambahHari = (tanggal, n) => {
  const d = new Date(`${tanggal}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Mapel tiap jenjang pada slot ke-n: urutan digeser per jenjang agar jadwal kelas 7/8/9 berbeda tetapi lengkap 15 mapel.
const mapelSlot = (slot) => Object.fromEntries(JENJANG_UJIAN.map((j, ji) => [String(j), MAPEL_UJIAN_BAKU[(slot + ji * 4) % MAPEL_UJIAN_BAKU.length].nama]));

function jadwalTiruan(mulai) {
  const jam = [['07:30', '09:00'], ['09:30', '11:00']];
  const jadwal = [];
  let tanggal = mulai;
  let slot = 0;
  while (slot < MAPEL_UJIAN_BAKU.length) {
    if (new Date(`${tanggal}T00:00:00Z`).getUTCDay() !== 0) { // Minggu libur
      for (let s = 0; s < jam.length && slot < MAPEL_UJIAN_BAKU.length; s += 1, slot += 1) {
        jadwal.push({ id: `contoh-sesi-${slot + 1}`, tanggal, sesi_ke: s + 1, jam_mulai: jam[s][0], jam_selesai: jam[s][1], mapel: mapelSlot(slot) });
      }
    }
    tanggal = tambahHari(tanggal, 1);
  }
  return jadwal;
}

function kisiKisiTiruan() {
  const hasil = [];
  JENJANG_UJIAN.forEach((j) => {
    MAPEL_UJIAN_BAKU.forEach((m, i) => {
      if ((i + j) % 5 === 0) return; // sebagian mapel belum mengirim kisi-kisi
      const id = `contoh-kisi-${j}-${m.kode}`;
      hasil.push({
        id, jenjang: j, mapel: m.kode, nama_file: `Kisi-kisi ${m.nama} Kelas ${j}.pdf`, ukuran_byte: 180000 + ((i * 7919 + j * 104729) % 900000),
        updated_at: `${tambahHari(hariIniWIB(), -((i + j) % 6) - 1)}T${String(8 + (i % 8)).padStart(2, '0')}:15:00+07:00`,
        jumlah_unduh: ((i * 13 + j * 7) % 40) + (unduhContoh[id] || 0),
      });
    });
  });
  return hasil;
}

/** Contoh tata tertib (data tiruan & tombol "Isi dengan contoh" di menu Info Ujian). */
export const TATA_TERTIB_CONTOH = `Peserta wajib mematuhi tata tertib berikut selama ujian berlangsung:
1. Hadir di ruang ujian paling lambat 15 menit sebelum ujian dimulai.
2. Memakai seragam sesuai ketentuan madrasah dan membawa kartu peserta ujian.
3. Duduk sesuai nomor peserta yang tertera di meja.
4. Tas, buku, dan catatan diletakkan di depan ruang; ponsel dimatikan dan dikumpulkan kepada pengawas kecuali dipakai untuk CBT.
5. Dilarang bekerja sama, menyontek, atau memberi jawaban kepada peserta lain.
6. Peserta yang terlambat lebih dari 15 menit wajib melapor ke panitia sebelum masuk ruang.
7. Tidak meninggalkan ruang sebelum waktu ujian selesai tanpa izin pengawas.

Pelanggaran tata tertib dicatat pengawas dalam berita acara dan diteruskan kepada panitia.`;

/**
 * Galat tiruan untuk token contoh (contoh-ditutup, contoh-belum-mulai, contoh-berakhir, contoh-salah) -> Error ala axios
 * atau null. `label` = nama tautan dalam pesan ("informasi ujian" / "monitoring pengumpulan berkas"). Dipakai juga oleh
 * halaman monitoring publik.
 */
export function galatTautanTiruan(token, label = 'informasi ujian') {
  const mulai = `${tambahHari(hariIniWIB(), 3)}T07:00:00+07:00`;
  const peta = {
    'contoh-ditutup': { status: 403, detail: { alasan: 'nonaktif', pesan: `Tautan ${label} sedang ditutup panitia.` } },
    'contoh-belum-mulai': { status: 403, detail: { alasan: 'belum_mulai', pesan: `Tautan ${label} belum dibuka.`, mulai_at: mulai, selesai_at: `${tambahHari(hariIniWIB(), 20)}T16:00:00+07:00` } },
    'contoh-berakhir': { status: 403, detail: { alasan: 'sudah_selesai', pesan: `Masa akses tautan ${label} sudah berakhir.`, selesai_at: `${tambahHari(hariIniWIB(), -2)}T16:00:00+07:00` } },
    'contoh-salah': { status: 404, detail: 'Tautan tidak ditemukan atau sudah diganti panitia.' },
  };
  const g = peta[token];
  if (!g) return null;
  if (g.status === 403) g.detail.madrasah = { nama: 'MTsN 2 Kota Malang (contoh)', logo_url: null };
  const e = new Error('tautan');
  e.response = { status: g.status, data: { detail: g.detail } };
  return e;
}
const galatTiruan = (token) => galatTautanTiruan(token);

export function infoUjianTiruan(token) {
  const g = galatTiruan(token);
  if (g) throw g;
  const mulai = tambahHari(hariIniWIB(), 0);
  const jadwal = jadwalTiruan(mulai);
  if (token === 'contoh-kosong') {
    return {
      madrasah: { nama: 'MTsN 2 Kota Malang (contoh)', logo_url: null },
      ujian: { nama: 'Asesmen Sumatif Akhir Semester Ganjil (contoh)', jenis: 'UAS', tahun_pelajaran: '2026/2027', mulai: null, selesai: null },
      tautan: { jenis: 'info', mulai_at: null, selesai_at: null },
      jadwal: [], tata_tertib: '', panduan_cbt: { ada_pdf: false, nama_file: null, video_url: null, keterangan: null }, kisi_kisi: [],
    };
  }
  return {
    madrasah: { nama: 'MTsN 2 Kota Malang (contoh)', logo_url: null },
    ujian: { nama: 'Asesmen Sumatif Akhir Semester Ganjil (contoh)', jenis: 'UAS', tahun_pelajaran: '2026/2027', mulai, selesai: jadwal[jadwal.length - 1].tanggal },
    tautan: { jenis: 'info', mulai_at: `${tambahHari(mulai, -7)}T07:00:00+07:00`, selesai_at: `${tambahHari(mulai, 14)}T16:00:00+07:00` },
    jadwal,
    tata_tertib: TATA_TERTIB_CONTOH,
    panduan_cbt: {
      ada_pdf: true, nama_file: 'Panduan CBT Siswa.pdf', video_url: 'https://www.youtube.com/watch?v=contoh-panduan-cbt',
      keterangan: 'Pelajari cara masuk aplikasi ujian, menjawab soal, dan mengakhiri ujian sebelum hari pertama.',
    },
    kisi_kisi: kisiKisiTiruan(),
  };
}

// PDF satu halaman (teks ASCII) untuk unduhan contoh — agar alur unduh bisa dicoba sebelum backend tersedia.
function pdfContoh(judul, baris) {
  const ascii = (s) => String(s).replace(/[^\x20-\x7E]/g, '?').replace(/[\\()]/g, (c) => `\\${c}`);
  const teks = [judul, ...baris].map((t, i) => `BT /F1 ${i ? 11 : 16} Tf 56 ${780 - i * 22} Td (${ascii(t)}) Tj ET`).join('\n');
  const objek = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${teks.length} >>\nstream\n${teks}\nendstream`,
  ];
  let isi = '%PDF-1.4\n';
  const posisi = [];
  objek.forEach((o, i) => { posisi.push(isi.length); isi += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = isi.length;
  isi += `xref\n0 ${objek.length + 1}\n0000000000 65535 f \n${posisi.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}`;
  isi += `trailer\n<< /Size ${objek.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([isi], { type: 'application/pdf' });
}

// ---- API ----

/** Info ujian publik satu tautan -> { ...kontrak, tiruan }. Melempar galat 403/404 (baca dengan galatTautanInfo). */
export const muatInfoUjianPublik = (token) => denganTiruan(
  async () => (await publik.get(`/publik/info-ujian/${encodeURIComponent(token)}`)).data,
  () => infoUjianTiruan(token),
);

/** Unduh satu kisi-kisi (dihitung server per klik) -> { jumlah_unduh } terbaru. */
export const unduhKisiKisiPublik = (token, berkas) => denganTiruan(
  async () => {
    try {
      const r = await publik.get(`/publik/info-ujian/${encodeURIComponent(token)}/kisi-kisi/${encodeURIComponent(berkas.id)}`, { responseType: 'blob' });
      simpanBlob(r.data, berkas.nama_file || 'kisi-kisi.pdf');
      const jumlah = Number(r.headers?.['x-jumlah-unduh']);
      return { jumlah_unduh: Number.isFinite(jumlah) && jumlah > 0 ? jumlah : (berkas.jumlah_unduh || 0) + 1 };
    } catch (e) {
      throw await bacaGalatBlob(e);
    }
  },
  () => {
    const g = galatTiruan(token);
    if (g) throw g;
    unduhContoh[berkas.id] = (unduhContoh[berkas.id] || 0) + 1;
    simpanUnduhContoh();
    simpanBlob(pdfContoh(`Kisi-kisi ${namaMapelUjian(berkas.mapel)} Kelas ${berkas.jenjang} (contoh)`, [
      'Berkas contoh: kisi-kisi asli tersedia setelah guru PJ mengunggahnya.',
      `Diunduh dari halaman informasi ujian publik pada ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB.`,
    ]), berkas.nama_file || 'kisi-kisi.pdf');
    return { jumlah_unduh: (berkas.jumlah_unduh || 0) + 1 };
  },
);

/** Buka panduan CBT PDF contoh di tab baru (mode tiruan; mode server memakai tautan urlPanduanCbt). */
export function bukaPanduanContoh() {
  const url = URL.createObjectURL(pdfContoh('Panduan CBT Siswa (contoh)', [
    '1. Masuk ke aplikasi ujian memakai nomor peserta dan kata sandi dari panitia.',
    '2. Pilih mata pelajaran sesuai jadwal, lalu masukkan token ujian dari pengawas.',
    '3. Jawab soal; tandai soal ragu-ragu untuk diperiksa kembali.',
    '4. Tekan Selesai setelah semua soal terjawab dan waktu memungkinkan.',
  ]));
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ---- Tautan pendek /publik/t/:token ----
//   GET /publik/tautan/{token} -> { jenis, jalur, berlaku, alasan, pesan, mulai_at, selesai_at, madrasah }   (404 token tak dikenal)
/** Validasi token tautan publik jenis apa pun (tanpa memuat isi) -> data di atas. Melempar galat (baca dengan galatTautanInfo). */
export const cekTautanPublik = async (token) => (await publik.get(`/publik/tautan/${encodeURIComponent(token)}`)).data;
