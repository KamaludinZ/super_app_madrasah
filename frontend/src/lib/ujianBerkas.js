/**
 * Ujian Madrasah — Formulir Unggah Berkas Ujian (wajib login, semua GTK): kisi-kisi (PDF) & kartu soal (PDF/DOCX) per
 * mapel baku per jenjang, maksimal 10 MB. Tidak ada penugasan PJ: saat mengunggah, pengisi MEMILIH nama guru PJ dari
 * daftar guru. Unggah ulang MENIMPA berkas lama (tanpa arsip ganda). Kartu soal rahasia: isinya hanya dapat diunduh admin;
 * publik hanya melihat statusnya di monitoring.
 *
 * Kontrak server (koleksi `ujian_berkas`):
 *   GET  /ujian/berkas-saya
 *     -> { ujian: [{ id, nama, jenis, mulai, selesai }], saya: id pengguna, guru: [{ id, nama }],
 *          tugas: [{ ujian_id, jenjang, mapel, nama_mapel, kisi_kisi: Berkas|null, kartu_soal: Berkas|null }] }
 *        (semester aktif; semua mapel baku × jenjang)
 *   POST /ujian/{ujian_id}/berkas/{jenis}   multipart: jenjang, mapel, guru_pj_id, berkas (file)
 *     -> { berkas: Berkas }   (kisi_kisi wajib PDF; kartu_soal PDF/DOCX; ≤ 10 MB; isi diperiksa server; 400 format/isi
 *        salah atau PJ bukan guru aktif, 413 terlalu besar, 403 bukan GTK)
 *   Berkas = { id, jenis, jenjang, mapel, nama_file, ukuran_byte, mime_type, guru_pj_id, guru_pj_nama, updated_at }
 *
 *   GET /ujian/akses-saya memuat `pj_berkas: true` untuk GTK bila ada ujian semester aktif (menu "Unggah Berkas Soal").
 */
import { api } from '@/lib/api';
import { denganTiruan } from '@/lib/ujian';
import { hariIniWIB } from '@/lib/tanggal';
import { JENJANG_UJIAN, MAPEL_UJIAN_BAKU } from '@/lib/mapelUjian';

export const HALAMAN_UNGGAH_BERKAS = '/ujian/unggah-berkas';
export const BERKAS_MAKS_BITA = 10 * 1024 * 1024; // sama dengan BERKAS_MAKS_BITA di backend/ujian_info.py

const MIME_PDF = 'application/pdf';
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Aturan tiap jenis berkas: ekstensi & MIME yang diterima, label untuk pesan, dan atribut accept input file. */
export const ATURAN_BERKAS = {
  kisi_kisi: { label: 'Kisi-kisi', format: 'PDF', ekstensi: ['pdf'], mime: [MIME_PDF], accept: '.pdf,application/pdf' },
  kartu_soal: { label: 'Kartu soal', format: 'PDF atau DOCX', ekstensi: ['pdf', 'docx'], mime: [MIME_PDF, MIME_DOCX],
    accept: `.pdf,.docx,${MIME_PDF},${MIME_DOCX}` },
};
export const JENIS_BERKAS_UNGGAH = ['kisi_kisi', 'kartu_soal'];

export function formatUkuranBerkas(bita) {
  if (!bita && bita !== 0) return '';
  if (bita < 1024) return `${bita} B`;
  if (bita < 1000 * 1024) return `${Math.round(bita / 1024)} KB`;
  return `${(bita / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/**
 * Validasi berkas sebelum diunggah (server memeriksa ulang, termasuk isi berkas) -> pesan galat yang jelas, atau null.
 * Ekstensi menentukan; MIME kosong (sebagian HP Android) tetap diterima bila ekstensinya benar.
 */
export function galatBerkas(jenis, file) {
  const aturan = ATURAN_BERKAS[jenis];
  if (!aturan) return 'Jenis berkas tidak dikenal.';
  if (!file) return 'Pilih berkas terlebih dahulu.';
  const ext = (String(file.name || '').split('.').pop() || '').toLowerCase();
  const mimeCocok = !file.type || aturan.mime.includes(file.type);
  if (!aturan.ekstensi.includes(ext) || !mimeCocok) {
    return `${aturan.label} harus berformat ${aturan.format}. Berkas "${file.name}" tidak dapat diterima.`;
  }
  if (!file.size) return `Berkas "${file.name}" kosong. Pilih berkas yang benar.`;
  if (file.size > BERKAS_MAKS_BITA) {
    return `Ukuran berkas ${formatUkuranBerkas(file.size)} melebihi batas 10 MB. Kecilkan ukurannya (mis. kompres PDF) lalu unggah lagi.`;
  }
  return null;
}

/**
 * Pesan galat unggah dari respons server/jaringan, dalam kalimat yang jelas:
 * tanpa respons -> koneksi; 413 (sering dari proxy, balasan HTML) -> batas 10 MB; 401 -> sesi berakhir; 403 -> bukan PJ;
 * 400/415/422 -> pesan server (detail teks, atau galat validasi pertama); 5xx -> server bermasalah.
 */
export function pesanGalatUnggah(e, jenis) {
  const label = ATURAN_BERKAS[jenis]?.label || 'Berkas';
  const r = e?.response;
  if (!r) return e?.code === 'ECONNABORTED' ? 'Unggahan terlalu lama dan dihentikan. Periksa sinyal lalu coba lagi.'
    : 'Koneksi terputus saat mengunggah. Periksa sinyal lalu coba lagi.';
  const d = r.data?.detail;
  const teks = typeof d === 'string' && d !== 'Not Found' ? d : (Array.isArray(d) && typeof d[0]?.msg === 'string' ? d[0].msg : null);
  if (r.status === 413) return 'Ukuran berkas melebihi batas 10 MB. Kecilkan ukurannya (mis. kompres PDF) lalu unggah lagi.';
  if (r.status === 401) return 'Sesi login Anda berakhir. Masuk lagi lalu ulangi unggahan.';
  if (r.status === 403) return teks || 'Anda tidak ditetapkan sebagai PJ mata pelajaran ini.';
  if ([400, 415, 422].includes(r.status)) return teks || `${label} ditolak server. Periksa format (${ATURAN_BERKAS[jenis]?.format || '-'}) dan ukuran berkas.`;
  if (r.status >= 500) return 'Server sedang bermasalah sehingga berkas belum tersimpan. Coba beberapa saat lagi.';
  return teks || `Gagal mengunggah ${label.toLowerCase()}.`;
}

// Tanda tangan awal berkas: PDF diawali "%PDF-", DOCX adalah arsip ZIP ("PK\x03\x04").
const TANDA = { pdf: [0x25, 0x50, 0x44, 0x46, 0x2d], docx: [0x50, 0x4b, 0x03, 0x04] };

function bacaAwal(file, n) {
  return new Promise((resolve) => {
    try {
      const r = new FileReader();
      r.onload = () => resolve(new Uint8Array(r.result));
      r.onerror = () => resolve(null);
      r.readAsArrayBuffer(file.slice(0, n));
    } catch {
      resolve(null);
    }
  });
}

/**
 * Periksa isi berkas (bukan hanya nama): berkas .pdf harus benar-benar PDF, .docx benar-benar DOCX. Menangkap berkas
 * yang sekadar diganti namanya (mis. foto .jpg menjadi .pdf) sebelum diunggah. -> pesan galat atau null.
 * Bila isi tidak dapat dibaca browser, diloloskan (server tetap memeriksa).
 */
export async function galatIsiBerkas(jenis, file) {
  const ext = (String(file?.name || '').split('.').pop() || '').toLowerCase();
  const tanda = TANDA[ext];
  if (!tanda) return null;
  const awal = await bacaAwal(file, tanda.length);
  if (!awal || awal.length < tanda.length) return awal ? `Berkas "${file.name}" rusak atau kosong.` : null;
  if (tanda.some((b, i) => awal[i] !== b)) {
    return `Isi berkas "${file.name}" bukan ${ext.toUpperCase()} yang sah (mungkin hanya diganti namanya). Simpan ulang sebagai ${ext.toUpperCase()} dari aplikasinya lalu unggah lagi.`;
  }
  return null;
}

// ---- Data tiruan (selama endpoint belum ada; unggahan hanya tersimpan di memori tab ini) ----
export const GURU_CONTOH = [
  { id: 'contoh-g1', nama: 'Ahmad Fauzi, M.Pd. (contoh)' }, { id: 'contoh-g2', nama: 'Dewi Kartika, S.Si. (contoh)' },
  { id: 'contoh-g3', nama: 'Muhammad Rizal, S.Kom. (contoh)' }, { id: 'contoh-g4', nama: 'Siti Aminah, S.Pd. (contoh)' },
];
const contoh = { tugas: null };

function tugasTiruan() {
  if (!contoh.tugas) {
    const kemarin = `${hariIniWIB()}T09:15:00+07:00`;
    contoh.tugas = JENJANG_UJIAN.flatMap((jenjang) => MAPEL_UJIAN_BAKU.map((m) => ({
      ujian_id: 'contoh-uas', jenjang, mapel: m.kode, nama_mapel: m.nama, kisi_kisi: null, kartu_soal: null,
    })));
    const ipa7 = contoh.tugas.find((t) => t.jenjang === 7 && t.mapel === 'ipa');
    ipa7.kisi_kisi = { id: 'contoh-b1', jenis: 'kisi_kisi', jenjang: 7, mapel: 'ipa', nama_file: 'Kisi-kisi IPA 7.pdf', ukuran_byte: 412000,
      mime_type: MIME_PDF, guru_pj_id: 'contoh-g2', guru_pj_nama: GURU_CONTOH[1].nama, updated_at: kemarin };
  }
  return contoh.tugas;
}

export const muatBerkasSaya = () => denganTiruan(
  async () => (await api.get('/ujian/berkas-saya')).data,
  () => ({
    ujian: [{ id: 'contoh-uas', nama: 'ASAS Ganjil 2026/2027 (contoh)', jenis: 'UAS', mulai: hariIniWIB(), selesai: hariIniWIB() }],
    saya: 'contoh-g4', guru: GURU_CONTOH, tugas: tugasTiruan(),
  }),
);

/** Galat pilihan guru PJ -> pesan atau null (wajib dipilih dari daftar guru). */
export const galatPj = (guruPjId, guru = []) => (!guruPjId || (guru.length && !guru.some((g) => g.id === guruPjId))
  ? 'Pilih nama guru PJ dari daftar terlebih dahulu.' : null);

/** Unggah satu berkas atas nama guru PJ terpilih; `onProgres(persen)` dipanggil selama pengiriman. -> { berkas, tiruan } */
export const unggahBerkas = (ujianId, jenis, { jenjang, mapel, guruPjId }, file, onProgres = () => {}) => denganTiruan(
  async () => {
    const form = new FormData();
    form.append('jenjang', String(jenjang));
    form.append('mapel', mapel);
    form.append('guru_pj_id', guruPjId || '');
    form.append('berkas', file);
    const { data } = await api.post(`/ujian/${ujianId}/berkas/${jenis}`, form, {
      onUploadProgress: (e) => { if (e.total) onProgres(Math.round((e.loaded / e.total) * 100)); },
    });
    return data;
  },
  () => {
    const pesan = galatBerkas(jenis, file) || galatPj(guruPjId, GURU_CONTOH);
    if (pesan) { const e = new Error('400'); e.response = { status: 400, data: { detail: pesan } }; throw e; }
    onProgres(100);
    const t = tugasTiruan().find((x) => x.jenjang === Number(jenjang) && x.mapel === mapel);
    const berkas = { id: `contoh-${jenis}-${jenjang}-${mapel}`, jenis, jenjang: Number(jenjang), mapel, nama_file: file.name, ukuran_byte: file.size,
      mime_type: file.type || null, guru_pj_id: guruPjId, guru_pj_nama: GURU_CONTOH.find((g) => g.id === guruPjId)?.nama,
      updated_at: new Date().toISOString() };
    if (t) t[jenis] = berkas; // unggah ulang menimpa
    return { berkas };
  },
);
