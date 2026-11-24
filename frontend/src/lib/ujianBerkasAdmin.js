/**
 * Ujian Madrasah — Berkas Soal (ber-login; menu `berkas_soal`): status pengumpulan kisi-kisi & kartu soal per jenjang ×
 * mapel baku, nama PJ (dipilih pengunggah), dan BUNDEL UNDUH ADMIN: ZIP kisi-kisi / ZIP kartu soal per jenjang (semua
 * mapel) serta unduh tunggal per jenjang per mapel. Pemantau (pimpinan, ketua & sekretaris) hanya melihat status;
 * mengunduh — termasuk isi kartu soal yang rahasia — hanya admin. Setiap unduhan tercatat di ujian_unduh_log.
 *
 * Kontrak server:
 *   GET /ujian/{ujian_id}/berkas/status
 *     -> { ujian, boleh_unduh_kartu (admin), terakhir, belum_mengirim: [{ jenjang, mapel, nama, pj: [nama], kurang: [jenis] }],
 *          jenjang: { '7': { ringkasan: { total, kisi_kisi, kartu_soal, lengkap },
 *                            baris: [{ nomor, kode, nama, lengkap, terakhir, pj: [nama],
 *                                      kisi_kisi: BerkasMeta|null, kartu_soal: BerkasMeta|null }] }, … } }
 *     BerkasMeta = { id, nama_file, ukuran_byte, mime_type, guru_pj_id, guru_pj_nama, updated_at, jumlah_unduh,
 *                    ada_di_disk (false = tercatat tetapi berkasnya hilang di server) }
 *   GET /ujian/{ujian_id}/berkas/{berkas_id}/unduh[?konfirmasi=1]  -> berkas (admin; unduh tunggal; kartu soal wajib konfirmasi)
 *   GET /ujian/{ujian_id}/berkas/zip?jenis=kisi_kisi|kartu_soal&jenjang=7|8|9 -> .zip (admin; semua mapel jenjang itu yang
 *        terkirim; berkas KETERANGAN.txt di dalam ZIP mencantumkan mapel yang belum mengirim; 404 bila belum ada satu pun).
 *        Kartu soal: wajib &konfirmasi=1, maks. 10 ZIP per admin per 10 menit (429), ZIP diberi penanda pengunduh.
 *   GET /ujian/{ujian_id}/berkas/unduhan?mode=publik|tunggal|zip_jenjang&jenis=kisi_kisi|kartu_soal&dari=&sampai=&cari=&batas=50
 *     -> { ringkasan: { total, publik, tunggal, zip_jenjang, kartu_soal },
 *          items: [{ id, waktu, mode, jenis_berkas, jenjang, mapel, pengunduh_nama|null, ip, perangkat }] }   (terbaru dulu;
 *        admin & pemantau menu Berkas Soal; sumber ujian_unduh_log)
 */
import { api } from '@/lib/api';
import { denganTiruan } from '@/lib/ujian';
import { blobEndpointBelumAda, galatDariBlob, simpanBerkas } from '@/lib/ujianPeserta';
import { JENJANG_UJIAN, MAPEL_UJIAN_BAKU } from '@/lib/mapelUjian';
import { berkasMonitoringTiruan } from '@/lib/ujianMonitoringPublik';
import { paramSaringanAudit, saringLogTiruan } from '@/lib/ujianTautanPublik';

export const HALAMAN_BERKAS_SOAL = '/ujian/berkas-soal';
export const LABEL_JENIS = { kisi_kisi: 'Kisi-kisi', kartu_soal: 'Kartu soal' };

/** Nama berkas ZIP bawaan: "Kisi-kisi Kelas 8 - ASAS Ganjil 2026-2027.zip". */
export function namaZip(jenis, jenjang, namaUjian) {
  const ujian = String(namaUjian || '').replace(/[\\/:*?"<>|]+/g, '-').trim();
  return `${LABEL_JENIS[jenis] || jenis} Kelas ${jenjang}${ujian ? ` - ${ujian}` : ''}.zip`;
}

// ---- Data tiruan ----
export function statusTiruan(ujianId) {
  const berkas = berkasMonitoringTiruan();
  const peta = Object.fromEntries(berkas.map((b) => [`${b.jenis}:${b.jenjang}:${b.mapel}`, b]));
  const jenjang = {};
  const belum = [];
  JENJANG_UJIAN.forEach((j) => {
    const baris = MAPEL_UJIAN_BAKU.map((m, i) => {
      const meta = (jenis) => {
        const b = peta[`${jenis}:${j}:${m.kode}`];
        return b ? { id: `contoh-${jenis}-${j}-${m.kode}`, nama_file: `${jenis === 'kisi_kisi' ? 'Kisi-kisi' : 'Kartu soal'} ${m.nama} ${j}.pdf`,
          ukuran_byte: 200000 + i * 13000, mime_type: 'application/pdf', guru_pj_id: null, guru_pj_nama: b.guru_pj_nama, updated_at: b.updated_at,
          jumlah_unduh: jenis === 'kisi_kisi' ? (i * 7 + j) % 30 : 0 } : null;
      };
      const kisi = meta('kisi_kisi');
      const kartu = meta('kartu_soal');
      const pj = [...new Set([kisi?.guru_pj_nama, kartu?.guru_pj_nama].filter(Boolean))];
      const r = { nomor: i + 1, kode: m.kode, nama: m.nama, kisi_kisi: kisi, kartu_soal: kartu, lengkap: !!(kisi && kartu),
        terakhir: [kisi?.updated_at, kartu?.updated_at].filter(Boolean).sort().pop() || null, pj };
      if (!r.lengkap) belum.push({ jenjang: j, mapel: m.kode, nama: m.nama, pj, kurang: ['kisi_kisi', 'kartu_soal'].filter((x) => !r[x]) });
      return r;
    });
    jenjang[String(j)] = { baris, ringkasan: { total: 15, kisi_kisi: baris.filter((b) => b.kisi_kisi).length,
      kartu_soal: baris.filter((b) => b.kartu_soal).length, lengkap: baris.filter((b) => b.lengkap).length } };
  });
  return { ujian: { id: ujianId }, boleh_unduh_kartu: true, terakhir: null, belum_mengirim: belum, jenjang };
}

export const muatStatusBerkas = (ujianId) => denganTiruan(
  async () => (await api.get(`/ujian/${ujianId}/berkas/status`)).data,
  () => statusTiruan(ujianId),
);

async function unduhBlob(path, params, cadanganNama, isiContoh) {
  try {
    const res = await api.get(path, { params, responseType: 'blob' });
    const cd = res.headers?.['content-disposition'] || '';
    const nama = decodeURIComponent(/filename\*=UTF-8''([^;]+)/i.exec(cd)?.[1] || '') || /filename="?([^";]+)"?/i.exec(cd)?.[1] || cadanganNama;
    simpanBerkas(res.data, nama);
    return { nama, tiruan: false };
  } catch (e) {
    if (await blobEndpointBelumAda(e)) {
      const nama = `${cadanganNama.replace(/\.[a-z0-9]+$/i, '')} (contoh).txt`;
      simpanBerkas(new Blob([isiContoh], { type: 'text/plain' }), nama);
      return { nama, tiruan: true };
    }
    throw await galatDariBlob(e);
  }
}

/** Unduh tunggal satu berkas (admin); kartu soal mengirim konfirmasi=1 (setelah dialog konfirmasi). */
export const unduhBerkasTunggal = (ujianId, berkas, jenis) => unduhBlob(
  `/ujian/${ujianId}/berkas/${encodeURIComponent(berkas.id)}/unduh`, jenis === 'kartu_soal' ? { konfirmasi: 1 } : undefined, berkas.nama_file || 'berkas',
  `Contoh unduhan: ${berkas.nama_file}. Berkas asli tersedia setelah server siap.`,
);

/** Unduh bundel ZIP satu jenis untuk satu jenjang (semua mapel; admin). */
export const unduhZipJenjang = (ujianId, jenis, jenjang, namaUjian, daftar = []) => unduhBlob(
  // kartu soal: konfirmasi=1 dikirim setelah dialog konfirmasi (server menolak tanpa itu)
  `/ujian/${ujianId}/berkas/zip`, { jenis, jenjang, ...(jenis === 'kartu_soal' ? { konfirmasi: 1 } : {}) }, namaZip(jenis, jenjang, namaUjian),
  `Contoh isi ZIP ${LABEL_JENIS[jenis]} Kelas ${jenjang}:\n${daftar.map((d) => `- ${d}`).join('\n') || '(kosong)'}`,
);

// ---- Riwayat audit unduhan ----
export const LABEL_MODE_UNDUH = { publik: 'Publik (tautan info)', tunggal: 'Admin · satu berkas', zip_jenjang: 'Admin · ZIP jenjang' };

export function unduhanTiruan({ mode, jenis, ...saringanUmum } = {}) {
  const kini = Date.now();
  const contohMapel = MAPEL_UJIAN_BAKU.slice(0, 8);
  let items = Array.from({ length: 18 }, (_, i) => {
    const m = i % 6 === 0 ? 'zip_jenjang' : i % 4 === 0 ? 'tunggal' : 'publik';
    const jb = m === 'publik' ? 'kisi_kisi' : i % 3 === 0 ? 'kartu_soal' : 'kisi_kisi';
    return { id: `contoh-unduh-${i}`, waktu: new Date(kini - (i * 53 + 4) * 60000).toISOString(), mode: m, jenis_berkas: jb,
      jenjang: JENJANG_UJIAN[i % 3], mapel: m === 'zip_jenjang' ? null : contohMapel[i % contohMapel.length].kode,
      pengunduh_nama: m === 'publik' ? null : 'Administrator (contoh)', ip: `10.20.${i % 5}.${(i * 31) % 240 + 3}`,
      perangkat: i % 2 ? 'Mozilla/5.0 (Linux; Android 13) Chrome/120.0 Mobile' : 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0' };
  });
  const ringkasan = { total: items.length, publik: items.filter((x) => x.mode === 'publik').length, tunggal: items.filter((x) => x.mode === 'tunggal').length,
    zip_jenjang: items.filter((x) => x.mode === 'zip_jenjang').length, kartu_soal: items.filter((x) => x.jenis_berkas === 'kartu_soal').length };
  items = saringLogTiruan(items, saringanUmum);
  if (mode) items = items.filter((x) => x.mode === mode);
  if (jenis) items = items.filter((x) => x.jenis_berkas === jenis);
  return { ringkasan, items };
}

export const muatRiwayatUnduhan = (ujianId, saringan = {}) => denganTiruan(
  async () => (await api.get(`/ujian/${ujianId}/berkas/unduhan`, {
    params: { ...(saringan.mode ? { mode: saringan.mode } : {}), ...(saringan.jenis ? { jenis: saringan.jenis } : {}), ...paramSaringanAudit(saringan), batas: 50 },
  })).data,
  () => unduhanTiruan(saringan),
);
