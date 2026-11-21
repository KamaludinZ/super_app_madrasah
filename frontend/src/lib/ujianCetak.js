/**
 * Ujian Madrasah — Cetak & Arsip: cetak Daftar Hadir & Berita Acara per sesi (format template madrasah) dalam dua mode
 * dokumen — per jenjang per ruang (satu jenjang) atau per ruang (seluruh jenjang ruang dalam satu dokumen); setiap hasil
 * cetak tersimpan otomatis ke Arsip Administrasi Ujian yang dapat ditelusuri per ujian dan per mode.
 *
 * Kontrak server (backend menyusul; koleksi `arsip_ujian`):
 *   GET  /ujian/{ujian_id}/cetak/pilihan
 *     -> { mesin: { libreoffice, mesin: 'libreoffice'|'reportlab', identik }, sesi: [Sesi],
 *          ruang: [{ id, nama_ruang, jenjang: [7, 8], per_jenjang: { '7': n } }], boleh_arsip }
 *        (admin, panitia ujian itu, kepala madrasah & waka kurikulum — menu 'cetak')
 *   GET  /ujian/{ujian_id}/cetak/kesiapan?sesi_id=
 *     -> { items: [{ ruang_id, jenjang, peserta, dh_lengkap, belum, ba_terisi }] }   (kesiapan tiap ruang-jenjang pada sesi)
 *   POST /ujian/{ujian_id}/cetak { jenis: 'daftar_hadir'|'berita_acara', mode: 'jenjang'|'ruang', ruang_id,
 *                                  jenjang (wajib pada mode 'jenjang'; diabaikan pada mode 'ruang'), sesi_id,
 *                                  format: 'pdf'|'docx', pratinjau: bool }
 *     -> berkas (Content-Disposition), header X-Arsip-Id & X-Mesin-Cetak; salinannya masuk arsip_ujian
 *        (pratinjau: true -> selalu PDF dan TIDAK diarsipkan)
 *   GET  /ujian/{ujian_id}/arsip?jenis=&ruang_id=&jenjang=&mode=
 *     -> { items: [Arsip] }   (hanya admin, waka kurikulum, kepala madrasah, ketua & sekretaris panitia)
 *   GET  /ujian/arsip/{arsip_id}/berkas -> berkas tersimpan
 *
 *   Arsip = { id, ujian_id, ruang_id, nama_ruang, jenjang (null pada mode 'ruang'), jenjang_daftar: [7, 8],
 *             mode: 'jenjang'|'ruang', sesi_id, sesi_label, jenis_dokumen, format, nama_berkas, ukuran, mesin,
 *             dibuat_oleh_nama, waktu }
 */
import { api } from '@/lib/api';
import { denganTiruan } from '@/lib/ujian';
import { hariIniWIB } from '@/lib/tanggal';
import { blobEndpointBelumAda, galatDariBlob } from '@/lib/ujianPeserta';

export const HALAMAN_CETAK = '/ujian/cetak';
export const HALAMAN_ARSIP = '/ujian/arsip';

export const JENIS_DOKUMEN = {
  daftar_hadir: { label: 'Daftar Hadir Peserta', singkat: 'Daftar Hadir' },
  berita_acara: { label: 'Berita Acara', singkat: 'Berita Acara' },
};
export const FORMAT_CETAK = { pdf: 'PDF (siap cetak)', docx: 'Word .docx (dapat disunting)' };

/** Mode dokumen cetak & arsip. */
export const MODE_DOKUMEN = {
  jenjang: { label: 'Per Jenjang per Ruang', ket: 'Satu dokumen untuk satu jenjang pada satu ruang (ruang campuran dicetak per jenjang).' },
  ruang: { label: 'Per Ruang', ket: 'Satu dokumen untuk seluruh peserta satu ruang — semua jenjang di ruang itu digabung.' },
};
export const modeDariParam = (m) => (m === 'ruang' ? 'ruang' : 'jenjang');
/** Arsip lama tanpa `mode` = per jenjang. */
export const modeArsip = (a) => (a?.mode === 'ruang' ? 'ruang' : 'jenjang');

/** [7, 8] -> '7 dan 8'; [7, 8, 9] -> '7, 8 dan 9'. */
export const labelJenjang = (daftar = []) => {
  const j = daftar.map(String);
  return j.length > 1 ? `${j.slice(0, -1).join(', ')} dan ${j[j.length - 1]}` : (j[0] || '');
};
/** Kelas pada arsip: 'Kelas 7' atau 'Kelas 7 dan 8'. */
export const labelKelasArsip = (a) => `Kelas ${labelJenjang(a?.jenjang_daftar?.length ? a.jenjang_daftar : (a?.jenjang != null ? [a.jenjang] : []))}`;

/** Mapel sesi untuk satu atau beberapa jenjang (sama dengan backend ujian_cetak_data.mapel_cetak). */
export const mapelCetak = (sesi, daftar = []) => {
  const nilai = daftar.map((j) => [j, sesi?.mapel?.[j] || sesi?.mapel?.[String(j)] || '']);
  const unik = [...new Set(nilai.map(([, v]) => v).filter(Boolean))];
  if (unik.length <= 1) return unik[0] || '';
  return nilai.map(([j, v]) => `${v || '-'} (kelas ${j})`).join('; ');
};

/** Kesiapan per ruang dari kesiapan per ruang–jenjang: { peserta, dh_lengkap, belum, ba_terisi } atau undefined. */
export const kesiapanRuang = (kesiapan = {}, ruang) => {
  const it = (ruang?.jenjang || []).map((j) => kesiapan[`${ruang.id}:${j}`]).filter(Boolean);
  if (!it.length) return undefined;
  return {
    peserta: it.reduce((n, x) => n + (x.peserta || 0), 0),
    dh_lengkap: it.every((x) => x.dh_lengkap),
    belum: it.reduce((n, x) => n + (x.belum || 0), 0),
    ba_terisi: it.some((x) => x.ba_terisi),
  };
};

// ---- Data tiruan ----
let arsipContoh = null;

export function pilihanTiruan() {
  const t = hariIniWIB();
  return {
    mesin: { libreoffice: true, mesin: 'libreoffice', identik: true },
    sesi: [
      { id: 'contoh-sesi-1', tanggal: t, sesi_ke: 1, jam_mulai: '07:30', jam_selesai: '09:30', mapel: { 7: 'Matematika', 8: 'IPA', 9: 'Bahasa Indonesia' } },
      { id: 'contoh-sesi-2', tanggal: t, sesi_ke: 2, jam_mulai: '10:00', jam_selesai: '12:00', mapel: { 7: 'IPS', 8: 'Bahasa Arab', 9: 'Matematika' } },
    ],
    ruang: [
      { id: 'contoh-r01', nama_ruang: '01', jenjang: [7, 8], per_jenjang: { 7: 16, 8: 16 } },
      { id: 'contoh-r02', nama_ruang: '02', jenjang: [9], per_jenjang: { 9: 20 } },
    ],
    boleh_arsip: true,
  };
}

export function arsipTiruan() {
  if (!arsipContoh) {
    const t = hariIniWIB();
    arsipContoh = [
      { id: 'contoh-a1', ruang_id: 'contoh-r01', nama_ruang: '01', jenjang: 7, jenjang_daftar: [7], mode: 'jenjang', sesi_id: 'contoh-sesi-1', sesi_label: `${t} · Sesi 1`, jenis_dokumen: 'daftar_hadir', format: 'pdf',
        nama_berkas: 'daftar_hadir_ruang_01_kelas_7_sesi_1.pdf', ukuran: 84213, mesin: 'libreoffice', dibuat_oleh_nama: 'Siti Aminah (contoh)', waktu: `${t}T10:05:00+07:00` },
      { id: 'contoh-a2', ruang_id: 'contoh-r01', nama_ruang: '01', jenjang: 7, jenjang_daftar: [7], mode: 'jenjang', sesi_id: 'contoh-sesi-1', sesi_label: `${t} · Sesi 1`, jenis_dokumen: 'berita_acara', format: 'pdf',
        nama_berkas: 'berita_acara_ruang_01_kelas_7_sesi_1.pdf', ukuran: 42118, mesin: 'libreoffice', dibuat_oleh_nama: 'Siti Aminah (contoh)', waktu: `${t}T10:06:00+07:00` },
      { id: 'contoh-a3', ruang_id: 'contoh-r01', nama_ruang: '01', jenjang: null, jenjang_daftar: [7, 8], mode: 'ruang', sesi_id: 'contoh-sesi-1', sesi_label: `${t} · Sesi 1`,
        jenis_dokumen: 'berita_acara', format: 'pdf', nama_berkas: 'berita_acara_ruang_01_kelas_7-8_per_ruang_sesi_1.pdf', ukuran: 45210, mesin: 'libreoffice',
        dibuat_oleh_nama: 'Siti Aminah (contoh)', waktu: `${t}T10:07:00+07:00` },
    ];
  }
  return { items: arsipContoh.map((a) => ({ ...a })) };
}

// ---- Pemanggil API ----
/** Pilihan cetak satu ujian (sesi, ruang & jenjangnya, mesin cetak) -> { ..., tiruan }. */
export const muatPilihanCetak = (ujianId) => denganTiruan(
  async () => (await api.get(`/ujian/${ujianId}/cetak/pilihan`)).data,
  pilihanTiruan,
);

/** Arsip administrasi ujian -> { items, tiruan }. */
export const muatArsip = (ujianId, saringan = {}) => denganTiruan(
  async () => (await api.get(`/ujian/${ujianId}/arsip`, { params: saringan })).data,
  arsipTiruan,
);

export const ukuranBerkas = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round((b || 0) / 1024))} KB`);

async function blobDariRespons(res, cadanganNama) {
  const cd = res.headers?.['content-disposition'] || '';
  return { blob: res.data, nama: /filename="?([^";]+)"?/i.exec(cd)?.[1] || cadanganNama,
    arsipId: res.headers?.['x-arsip-id'] || null, mesin: res.headers?.['x-mesin-cetak'] || null };
}

/** Cetak satu dokumen -> { blob, nama, arsipId, mesin, tiruan }. Server menyimpannya ke arsip. */
export async function cetakDokumen(ujianId, isi) {
  const perRuang = isi.mode === 'ruang';
  const daftar = perRuang ? (isi.jenjang_daftar || []) : [isi.jenjang];
  const nama = `${isi.jenis}_ruang_${isi.nama_ruang || ''}_kelas_${daftar.join('-')}${perRuang ? '_per_ruang' : ''}.${isi.format}`;
  try {
    const res = await api.post(`/ujian/${ujianId}/cetak`, isi, { responseType: 'blob' });
    return { ...(await blobDariRespons(res, nama)), tiruan: false };
  } catch (e) {
    if (await blobEndpointBelumAda(e)) {
      const teks = `Contoh ${JENIS_DOKUMEN[isi.jenis].label} — server cetak belum tersedia.\nRuang ${isi.nama_ruang}, kelas ${labelJenjang(daftar)}.`;
      arsipTiruan();
      arsipContoh.unshift({ id: `contoh-a-${Date.now()}`, ruang_id: isi.ruang_id, nama_ruang: isi.nama_ruang, jenjang: perRuang ? null : isi.jenjang,
        jenjang_daftar: daftar, mode: perRuang ? 'ruang' : 'jenjang', sesi_id: isi.sesi_id,
        sesi_label: isi.sesi_label, jenis_dokumen: isi.jenis, format: isi.format, nama_berkas: nama, ukuran: teks.length, mesin: 'contoh',
        dibuat_oleh_nama: 'Anda (contoh)', waktu: new Date().toISOString() });
      return { blob: new Blob([teks], { type: 'text/plain' }), nama: nama.replace(/\.\w+$/, '.txt'), arsipId: null, mesin: 'contoh', tiruan: true };
    }
    throw await galatDariBlob(e);
  }
}

/** Unduh berkas arsip -> { blob, nama }. */
export async function unduhArsip(arsip) {
  try {
    const res = await api.get(`/ujian/arsip/${arsip.id}/berkas`, { responseType: 'blob' });
    return blobDariRespons(res, arsip.nama_berkas);
  } catch (e) {
    if (await blobEndpointBelumAda(e)) return { blob: new Blob([`Contoh arsip ${arsip.nama_berkas}`], { type: 'text/plain' }), nama: `${arsip.nama_berkas}.txt` };
    throw await galatDariBlob(e);
  }
}

/** Kesiapan cetak tiap ruang-jenjang pada satu sesi -> { items, tiruan }. */
export const muatKesiapanCetak = (ujianId, sesiId) => denganTiruan(
  async () => (await api.get(`/ujian/${ujianId}/cetak/kesiapan`, { params: { sesi_id: sesiId } })).data,
  () => ({
    items: pilihanTiruan().ruang.flatMap((r) => r.jenjang.map((j) => ({
      ruang_id: r.id, jenjang: j, peserta: r.per_jenjang[j], dh_lengkap: r.id === 'contoh-r01', belum: r.id === 'contoh-r01' ? 0 : 3, ba_terisi: r.id === 'contoh-r01' && j === 7,
    }))),
  }),
);

/** Pratinjau PDF tanpa menyimpan ke arsip -> { blob, nama, mesin, tiruan }. */
export async function pratinjauDokumen(ujianId, isi) {
  return cetakDokumen(ujianId, { ...isi, format: 'pdf', pratinjau: true });
}
