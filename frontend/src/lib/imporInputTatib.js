import { api } from '@/lib/api';
import { ASAL_INPUT, poinJenis } from '@/lib/inputTatib';
import { hariIniWIB } from '@/lib/tanggal';

// Impor Input Tata Tertib dari berkas (.xlsx/.xls/.csv) dengan kolom Nama, Kode Aturan, Tanggal Kejadian,
// Asal Input, Keterangan. Berkas dibaca di browser; nama dikoreksi otomatis ke nama siswa di aplikasi;
// baris dikirim per batch agar progres terlihat. Kontrak server:
//   POST /tatib/input/impor { baris: [{ baris, data: { nama, siswa_id, kode_aturan, tanggal, asal_input, keterangan } }],
//                             semester_id, tahun_takwim_id }
//     -> { hasil: [{ baris, identitas, status: 'berhasil'|'tanpa_perubahan'|'gagal', kolom, pesan }] }

export const KOLOM_IMPOR_TATIB = [
  { key: 'nama', label: 'Nama', wajib: true, alias: ['nama siswa', 'nama lengkap', 'nama peserta didik'] },
  { key: 'kode_aturan', label: 'Kode Aturan', wajib: true, alias: ['kode', 'kode pelanggaran', 'kode jenis'] },
  { key: 'tanggal', label: 'Tanggal Kejadian', wajib: true, alias: ['tanggal', 'tgl', 'tgl kejadian'] },
  { key: 'asal_input', label: 'Asal Input', wajib: true, alias: ['asal', 'sumber', 'sumber input'] },
  { key: 'keterangan', label: 'Keterangan', wajib: false, alias: ['ket', 'catatan'] },
];

export const MAKS_UKURAN_BERKAS = 5 * 1024 * 1024; // 5 MB
export const MAKS_BARIS_IMPOR = 1000;
export const UKURAN_BATCH_IMPOR = 20;
const MAKS_KETERANGAN = 500;
const EKSTENSI = ['.xlsx', '.xls', '.csv'];

const kunci = (teks) => String(teks ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Validasi berkas sebelum dibaca. Mengembalikan pesan galat atau null. */
export function validasiBerkasTatib(file) {
  if (!file) return 'Pilih berkas terlebih dahulu';
  const nama = file.name.toLowerCase();
  if (!EKSTENSI.some((e) => nama.endsWith(e))) return 'Berkas harus berformat Excel (.xlsx/.xls) atau CSV';
  if (file.size === 0) return 'Berkas kosong';
  if (file.size > MAKS_UKURAN_BERKAS) return 'Ukuran berkas maksimal 5 MB';
  return null;
}

/** Posisi kolom dari satu baris judul ({key: indeks}); judul dicocokkan tanpa beda huruf, juga sinonimnya. */
export function petakanJudul(row) {
  const peta = {};
  (row || []).forEach((sel, i) => {
    const k = kunci(sel);
    const kolom = KOLOM_IMPOR_TATIB.find((c) => kunci(c.label) === k || c.alias.includes(k));
    if (kolom && peta[kolom.key] === undefined) peta[kolom.key] = i;
  });
  return peta;
}

// ---------- Tanggal ----------

const BULAN = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, agt: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };

const isoValid = (y, m, d) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return t.toISOString().slice(0, 10);
};

/**
 * Tanggal sel -> 'YYYY-MM-DD' atau null. Menerima tanggal Excel (nomor seri), YYYY-MM-DD,
 * DD/MM/YYYY (juga '-' atau '.', tahun 2 digit), dan '5 Oktober 2026' / 'Senin, 5 Okt 2026'.
 */
export function tanggalSel(nilai) {
  if (nilai instanceof Date) return Number.isNaN(nilai.getTime()) ? null : isoValid(nilai.getFullYear(), nilai.getMonth() + 1, nilai.getDate());
  const t = String(nilai ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t) && Number(t) > 20000 && Number(t) < 100000) {
    // Nomor seri Excel: hari sejak 1899-12-30.
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(t)) * 86400000).toISOString().slice(0, 10);
  }
  const s = t.replace(/^[a-z]+,\s*/, '');
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return isoValid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) return isoValid(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = s.match(/^(\d{1,2}) ([a-z]{3})[a-z]*\.? (\d{4})$/);
  if (m && BULAN[m[2]]) return isoValid(+m[3], BULAN[m[2]], +m[1]);
  return null;
}

// ---------- Pencocokan nama ----------

/** Nama untuk dibandingkan: huruf kecil, tanpa aksen/tanda baca, spasi dirapikan. */
export const normalNama = (teks) => String(teks ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Variasi penulisan nama yang lazim (mis. "M." / "Moh." / "Muhamad" = "Muhammad").
const VARIAN = [
  [/^(m|mh|mhd|muh|moh|mohd|moch|mochamad|mochammad|mohamad|mohammad|muhamad|muhammad|muchamad|muchammad|mukhammad)$/, 'muhammad'],
  [/^(ahmad|achmad|akhmad|ahmat|amad)$/, 'ahmad'],
  [/^(abd|abdul|abdoel)$/, 'abdul'],
  [/^(st|siti|sitti)$/, 'siti'],
  [/^(nur|nurul|noer)$/, 'nur'],
];
const kanon = (tok) => (VARIAN.find(([re]) => re.test(tok))?.[1]) || tok;

function jarak(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}
const rasio = (a, b) => (!a && !b ? 1 : 1 - jarak(a, b) / Math.max(a.length, b.length));

function skorToken(t, u) {
  if (t === u) return 1;
  if (kanon(t) === kanon(u)) return 0.95;
  if (t.length === 1 && u.startsWith(t)) return 0.85; // inisial: "R." ~ "Rizki"
  if (t.length >= 3 && u.startsWith(t)) return 0.85; // singkatan awal: "Fauz" ~ "Fauzi"
  return rasio(t, u);
}

/** Kemiripan dua nama (sudah dinormalkan) 0..1: urutan kata, ejaan, singkatan, dan kata yang hilang. */
export function skorNama(a, b) {
  if (a === b) return 1;
  const ta = a.split(' ');
  const tb = b.split(' ');
  const ka = ta.map(kanon).join(' ');
  const kb = tb.map(kanon).join(' ');
  if (ka === kb) return 0.97;
  const urut = (t) => t.map(kanon).sort().join(' ');
  // Tiap kata di berkas dipasangkan ke kata nama siswa yang paling mirip; nama siswa yang lebih panjang sedikit dikurangi.
  const bobot = (t) => Math.max(t.length, 3);
  const total = ta.reduce((s, t) => s + bobot(t), 0);
  const selaras = ta.reduce((s, t) => s + bobot(t) * Math.max(...tb.map((u) => skorToken(t, u))), 0) / total;
  const cakupan = tb.length > ta.length ? (ta.length / tb.length) ** 0.3 : 1;
  return Math.max(rasio(ka, kb), rasio(urut(ta), urut(tb)), rasio(ka.replace(/ /g, ''), kb.replace(/ /g, '')), selaras * cakupan * 0.98);
}

export const AMBANG_KOREKSI = 0.82; // skor minimal untuk koreksi otomatis
export const SELISIH_KOREKSI = 0.06; // calon terbaik harus unggul sejauh ini dari calon kedua
export const AMBANG_CALON = 0.55;

// Huruf awal tiap kata (bentuk baku): penyaring cepat sebelum menghitung kemiripan.
const hurufAwal = (normal) => new Set(normal.split(' ').filter(Boolean).map((t) => kanon(t)[0]));

/** Indeks siswa untuk pencocokan nama (dibuat sekali per berkas). */
export function indeksSiswa(siswaList) {
  const semua = siswaList.map((s) => {
    const normal = normalNama(s.full_name);
    return { siswa: s, normal, awal: hurufAwal(normal) };
  });
  const persis = new Map();
  semua.forEach((x) => persis.set(x.normal, [...(persis.get(x.normal) || []), x.siswa]));
  return { semua, persis };
}

/**
 * Cocokkan nama dari berkas ke siswa -> { status, siswa_id, calon: [{ siswa, skor }] }.
 * status: 'cocok' (sama persis) | 'dikoreksi' (penulisan dibetulkan otomatis) | 'ganda' (nama sama dimiliki
 * beberapa siswa) | 'perlu_pilih' (ada yang mirip tapi tidak meyakinkan) | 'tidak_ditemukan'.
 */
export function cocokkanNama(nama, indeks) {
  const n = normalNama(nama);
  if (!n) return { status: 'tidak_ditemukan', siswa_id: '', calon: [] };
  const sama = indeks.persis.get(n) || [];
  if (sama.length === 1) {
    const s = sama[0];
    return { status: s.full_name.trim() === String(nama).trim() ? 'cocok' : 'dikoreksi', siswa_id: s.id, calon: [{ siswa: s, skor: 1 }] };
  }
  if (sama.length > 1) return { status: 'ganda', siswa_id: '', calon: sama.map((siswa) => ({ siswa, skor: 1 })) };
  const awal = hurufAwal(n);
  const calon = indeks.semua
    .filter((x) => [...x.awal].some((h) => awal.has(h)))
    .map((x) => ({ siswa: x.siswa, skor: skorNama(n, x.normal) }))
    .filter((c) => c.skor >= AMBANG_CALON)
    .sort((a, b) => b.skor - a.skor || a.siswa.full_name.localeCompare(b.siswa.full_name, 'id'))
    .slice(0, 5);
  const [satu, dua] = calon;
  if (satu && satu.skor >= AMBANG_KOREKSI && (!dua || satu.skor - dua.skor >= SELISIH_KOREKSI)) {
    return { status: 'dikoreksi', siswa_id: satu.siswa.id, calon };
  }
  return { status: calon.length ? 'perlu_pilih' : 'tidak_ditemukan', siswa_id: '', calon };
}

/** Asal input dari berkas -> nilai baku (tanpa beda huruf/spasi; salah ketik ringan dibetulkan) atau null. */
export function cocokkanAsal(teks) {
  const k = kunci(teks);
  if (!k) return null;
  const persis = ASAL_INPUT.find((a) => kunci(a) === k);
  if (persis) return persis;
  const terbaik = ASAL_INPUT.map((a) => ({ a, s: rasio(k, kunci(a)) })).sort((x, y) => y.s - x.s)[0];
  return terbaik.s >= 0.8 ? terbaik.a : null;
}

// ---------- Baca & periksa berkas ----------

const teks = (v) => (v == null ? '' : String(v).trim());

/**
 * Baca berkas -> { sheet, masalahHeader: string[], baris: [{ baris, data }], dilewati: { kosong, berlebih } }.
 * Baris judul dicari di 10 baris pertama (boleh ada judul laporan di atasnya). `baris` = nomor baris di berkas.
 */
export async function bacaBerkasTatib(file) {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const csv = file.name.toLowerCase().endsWith('.csv');
  // CSV dibaca apa adanya agar 05/10/2026 tidak ditafsirkan sebagai format bulan/tanggal.
  const wb = XLSX.read(buf, { type: 'array', raw: csv, cellDates: false });
  const nama = wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[nama], { header: 1, raw: true, defval: '', blankrows: true });
  const hasil = { sheet: nama, masalahHeader: [], baris: [], dilewati: { kosong: 0, berlebih: 0 } };

  let posJudul = -1;
  let peta = {};
  for (let i = 0; i < Math.min(rows.length, 10); i += 1) {
    const p = petakanJudul(rows[i]);
    if (Object.keys(p).length > Object.keys(peta).length) { peta = p; posJudul = i; }
    if (KOLOM_IMPOR_TATIB.every((k) => !k.wajib || p[k.key] !== undefined)) break;
  }
  const hilang = KOLOM_IMPOR_TATIB.filter((k) => k.wajib && peta[k.key] === undefined).map((k) => k.label);
  if (hilang.length) {
    hasil.masalahHeader.push(`Kolom tidak ditemukan: ${hilang.join(', ')}`);
    return hasil;
  }

  rows.slice(posJudul + 1).forEach((row, i) => {
    const data = Object.fromEntries(KOLOM_IMPOR_TATIB.map((k) => [k.key, peta[k.key] === undefined ? '' : row[peta[k.key]]]));
    if (Object.values(data).every((v) => teks(v) === '')) { hasil.dilewati.kosong += 1; return; }
    if (hasil.baris.length >= MAKS_BARIS_IMPOR) { hasil.dilewati.berlebih += 1; return; }
    hasil.baris.push({ baris: posJudul + i + 2, data });
  });
  return hasil;
}

/**
 * Periksa tiap baris terhadap data aplikasi -> baris pratinjau:
 * { baris, asli, siswa: hasil cocokkanNama, siswa_id, jenis, kode, tanggal, asal, keterangan, masalah: [{kolom, pesan}], koreksi: [teks] }.
 */
export function periksaBaris(baris, { siswaList = [], jenisList = [] } = {}) {
  const indeks = indeksSiswa(siswaList);
  const jenisPerKode = new Map(jenisList.map((j) => [String(j.kode_aturan || '').toUpperCase(), j]));
  const cacheNama = new Map();
  const hariIni = hariIniWIB();

  return baris.map(({ baris: nomor, data }) => {
    const masalah = [];
    const koreksi = [];
    const nama = teks(data.nama).replace(/\s+/g, ' ');
    if (!cacheNama.has(nama)) cacheNama.set(nama, cocokkanNama(nama, indeks));
    const siswa = cacheNama.get(nama);
    if (!nama) masalah.push({ kolom: 'Nama', pesan: 'Nama siswa kosong' });

    const kode = teks(data.kode_aturan).replace(/\s+/g, '').toUpperCase();
    const jenis = jenisPerKode.get(kode);
    if (!kode) masalah.push({ kolom: 'Kode Aturan', pesan: 'Kode aturan kosong' });
    else if (!jenis) masalah.push({ kolom: 'Kode Aturan', pesan: `Kode aturan '${kode}' tidak terdaftar di Master Jenis Pelanggaran` });
    else if (jenis.aktif === false) masalah.push({ kolom: 'Kode Aturan', pesan: `Jenis aturan ${kode} sudah tidak aktif` });

    const tanggal = tanggalSel(data.tanggal);
    if (!teks(data.tanggal)) masalah.push({ kolom: 'Tanggal Kejadian', pesan: 'Tanggal kejadian kosong' });
    else if (!tanggal) masalah.push({ kolom: 'Tanggal Kejadian', pesan: `Tanggal '${teks(data.tanggal)}' tidak dikenali (gunakan DD/MM/YYYY)` });
    else if (tanggal > hariIni) masalah.push({ kolom: 'Tanggal Kejadian', pesan: 'Tanggal kejadian tidak boleh melewati hari ini' });

    const asalAsli = teks(data.asal_input);
    const asal = cocokkanAsal(asalAsli);
    if (!asalAsli) masalah.push({ kolom: 'Asal Input', pesan: 'Asal input kosong' });
    else if (!asal) masalah.push({ kolom: 'Asal Input', pesan: `Asal input '${asalAsli}' tidak ada di daftar (${ASAL_INPUT.join(', ')})` });
    else if (asal !== asalAsli) koreksi.push(`asal input '${asalAsli}' → '${asal}'`);

    const keterangan = teks(data.keterangan);
    if (keterangan.length > MAKS_KETERANGAN) masalah.push({ kolom: 'Keterangan', pesan: `Keterangan maksimal ${MAKS_KETERANGAN} karakter` });

    return { baris: nomor, asli: nama, siswa, siswa_id: siswa.siswa_id, jenis, kode, tanggal, asal, keterangan, masalah, koreksi };
  });
}

/** Pesan untuk baris yang namanya belum terhubung ke siswa. */
export function pesanNamaBelumCocok(row) {
  const calon = row.siswa.calon.slice(0, 3).map((c) => `${c.siswa.full_name}${c.siswa.class_name ? ` (${c.siswa.class_name})` : ''}`);
  if (row.siswa.status === 'ganda') return `Nama '${row.asli}' dimiliki ${row.siswa.calon.length} siswa (${calon.join(', ')}); pilih siswanya di pratinjau`;
  if (calon.length) return `Nama '${row.asli}' tidak meyakinkan; mirip: ${calon.join(', ')}. Pilih siswanya di pratinjau`;
  return `Siswa bernama '${row.asli}' tidak ditemukan`;
}

/** Status pratinjau satu baris: 'siap' | 'pilih_siswa' | 'masalah'. */
export function statusBaris(row) {
  if (row.masalah.length) return 'masalah';
  return row.siswa_id ? 'siap' : 'pilih_siswa';
}

/** Catatan koreksi yang dilaporkan bersama hasil (nama & asal input). */
export function teksKoreksi(row, siswaList) {
  const s = siswaList.find((x) => x.id === row.siswa_id);
  const hasil = [...row.koreksi];
  if (s && s.full_name.trim() !== row.asli) hasil.unshift(`nama '${row.asli}' → '${s.full_name}'`);
  return hasil;
}

// ---------- Proses impor ----------

/**
 * Kirim baris pratinjau per batch. Baris bermasalah / tanpa siswa langsung dilaporkan gagal tanpa dikirim.
 * `onProgress({ selesai, total, barisSaatIni, hasil })` setelah tiap batch; `batal()` menghentikan sebelum batch berikutnya.
 * -> { tiruan: false, dibatalkan, ringkasan: { total, diproses, berhasil, tanpa_perubahan, gagal }, hasil }
 */
export async function prosesImporTatib({ rows, siswaList = [], periode = {}, onProgress, batal, ukuranBatch = UKURAN_BATCH_IMPOR }) {
  const semua = [];
  let dibatalkan = false;
  for (let i = 0; i < rows.length; i += ukuranBatch) {
    if (batal?.()) { dibatalkan = true; break; }
    const batch = rows.slice(i, i + ukuranBatch);
    const lokal = [];
    const kirim = [];
    batch.forEach((r) => {
      if (r.masalah.length) {
        lokal.push({ baris: r.baris, identitas: r.asli || '-', status: 'gagal', kolom: r.masalah.map((m) => m.kolom).join(', '), pesan: r.masalah.map((m) => m.pesan).join('; ') });
      } else if (!r.siswa_id) {
        lokal.push({ baris: r.baris, identitas: r.asli || '-', status: 'gagal', kolom: 'Nama', pesan: pesanNamaBelumCocok(r) });
      } else {
        kirim.push(r);
      }
    });
    let dariServer = [];
    if (kirim.length) {
      try {
        const { data } = await api.post('/tatib/input/impor', {
          ...periode,
          baris: kirim.map((r) => ({
            baris: r.baris,
            data: { nama: r.asli, siswa_id: r.siswa_id, kode_aturan: r.kode, tanggal: r.tanggal, asal_input: r.asal, keterangan: r.keterangan || null },
          })),
        });
        const perBaris = new Map(kirim.map((r) => [r.baris, r]));
        dariServer = (data?.hasil || []).map((h) => {
          const koreksi = h.status === 'gagal' ? [] : teksKoreksi(perBaris.get(h.baris) || { koreksi: [] }, siswaList);
          return koreksi.length ? { ...h, pesan: `${h.pesan} · dikoreksi: ${koreksi.join('; ')}` } : h;
        });
      } catch (e) {
        const st = e?.response?.status;
        if (st === 401 || st === 403) throw e; // sesi/izin: hentikan seluruh impor
        const d = e?.response?.data?.detail;
        dariServer = kirim.map((r) => ({ baris: r.baris, identitas: r.asli, status: 'gagal', kolom: '-', pesan: typeof d === 'string' ? d : 'Gagal menghubungi server' }));
      }
    }
    semua.push(...[...lokal, ...dariServer].sort((a, b) => a.baris - b.baris));
    onProgress?.({ selesai: Math.min(i + batch.length, rows.length), total: rows.length, barisSaatIni: batch[batch.length - 1].baris, hasil: [...semua] });
  }
  const hitung = (st) => semua.filter((h) => h.status === st).length;
  return {
    tiruan: false,
    dibatalkan,
    ringkasan: { total: rows.length, diproses: semua.length, berhasil: hitung('berhasil'), tanpa_perubahan: hitung('tanpa_perubahan'), gagal: hitung('gagal') },
    hasil: semua,
  };
}

// ---------- Template ----------

/** Unduh template .xlsx: lembar isian + petunjuk + daftar kode aturan aktif & asal input. */
export async function unduhTemplateImporTatib(jenisList = []) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const isian = XLSX.utils.aoa_to_sheet([KOLOM_IMPOR_TATIB.map((k) => k.label)]);
  isian['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, isian, 'Input Tatib');

  const petunjuk = XLSX.utils.aoa_to_sheet([
    ['Kolom', 'Wajib', 'Cara mengisi', 'Contoh'],
    ['Nama', 'Ya', 'Nama siswa. Penulisan yang sedikit berbeda dikoreksi otomatis ke nama siswa di aplikasi.', 'Ahmad Fauzi'],
    ['Kode Aturan', 'Ya', 'Kode dari lembar "Kode Aturan" (jenis aktif). Huruf besar/kecil sama saja.', jenisList.find((j) => j.aktif !== false)?.kode_aturan || 'DIS-01'],
    ['Tanggal Kejadian', 'Ya', 'Format DD/MM/YYYY atau tanggal Excel; tidak boleh melewati hari ini.', '05/10/2026'],
    ['Asal Input', 'Ya', `Salah satu: ${ASAL_INPUT.join(', ')}.`, 'Razia'],
    ['Keterangan', 'Tidak', `Kronologi singkat, maksimal ${MAKS_KETERANGAN} karakter.`, 'Tidak memakai sabuk'],
    [],
    ['Poin dihitung otomatis dari master jenis aturan. Baris yang sama persis dengan catatan yang sudah ada dilewati saat diimpor ulang.'],
  ]);
  petunjuk['!cols'] = [{ wch: 18 }, { wch: 7 }, { wch: 80 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, petunjuk, 'Petunjuk');

  const kode = XLSX.utils.aoa_to_sheet([
    ['Kode Aturan', 'Jenis Aturan', 'Kategori', 'Jalur', 'Poin'],
    ...jenisList.filter((j) => j.aktif !== false).map((j) => [j.kode_aturan, j.nama, j.kategori_nama || '', j.jalur_poin === 'minus' ? 'Pelanggaran' : 'Kebaikan', poinJenis(j)]),
  ]);
  kode['!cols'] = [{ wch: 14 }, { wch: 45 }, { wch: 22 }, { wch: 12 }, { wch: 6 }];
  XLSX.utils.book_append_sheet(wb, kode, 'Kode Aturan');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Asal Input'], ...ASAL_INPUT.map((a) => [a])]), 'Asal Input');
  XLSX.writeFile(wb, 'Template_Impor_Input_Tatib.xlsx');
}
