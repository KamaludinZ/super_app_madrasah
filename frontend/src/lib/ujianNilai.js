/**
 * Ujian Madrasah — Nilai UAS: template Excel per mapel per jenjang (satu sheet per kelas, nama siswa sudah terisi),
 * impor massal dengan monitoring progres & hasil per baris/sheet, sinkron ke kolom UAS rapor & akun guru mapel, serta
 * masa ujian/remidi tempat guru boleh mengubah nilai. Nilai ulangan & UTS tetap diisi guru seperti biasa.
 *
 * Kontrak server (backend menyusul; koleksi `nilai_ujian`, `nilai_impor_log`):
 *   GET  /ujian/{ujian_id}/nilai/pilihan
 *     -> { mapel: [{ id, nama }], jenjang: [{ jenjang, kelas: [{ id, nama, jumlah_siswa }] }], boleh_impor }
 *   GET  /ujian/{ujian_id}/nilai/rekap?mapel_id=&jenjang=
 *     -> { kelas: [{ kelas_id, nama, total, terisi, rata, guru_nama, tersinkron }] }   (keterisian nilai UAS per kelas;
 *        tersinkron = baris rapor yang sudah memuat nilai UAS ini)
 *   POST /ujian/{ujian_id}/nilai/sinkron-rapor { mapel_id? } -> { disinkron }   (admin: pulihkan kolom UAS rapor)
 *   GET  /ujian/{ujian_id}/nilai/template?mapel_id=&jenjang= -> .xlsx (sheet per kelas: No, ID Siswa, NIS, Nama, Nilai UAS)
 *   POST /ujian/{ujian_id}/nilai/impor (multipart: berkas, mapel_id, jenjang, ulang_dari?) -> { log_id }
 *     (ulang_dari = id log asal: siswa yang sudah berhasil dilewati, hanya baris gagal yang diproses)
 *   GET  /ujian/{ujian_id}/nilai/impor/{log_id}
 *     -> ImporLog (dipantau berkala selama status 'proses')
 *   GET  /ujian/{ujian_id}/nilai/impor?status=&mapel_id=&jenjang=&oleh=
 *     -> { items: [ImporLog tanpa galat], ringkasan: {status: n}, pengunggah: [{ id, nama, sebagai, jumlah, terakhir }] }
 *
 *   ImporLog = { id, mapel_id, mapel_nama, jenjang, berkas, status: 'proses'|'selesai'|'gagal', pesan,
 *                diproses, total_baris, berhasil, gagal, per_sheet: [{ sheet, kelas, total, diproses, berhasil, gagal, kosong, rata }],
 *                sheet_aktif, kelas_tanpa_sheet, galat: [{ sheet, baris, nama, siswa_id, nilai, jenis, pesan }], galat_total,
 *                ukuran, diunggah_oleh, diunggah_oleh_nama, diunggah_sebagai, waktu, selesai_pada, durasi_detik }
 */
import { api } from '@/lib/api';
import { denganTiruan } from '@/lib/ujian';
import { hariIniWIB } from '@/lib/tanggal';
import { blobEndpointBelumAda, galatDariBlob } from '@/lib/ujianPeserta';

export const HALAMAN_NILAI = '/ujian/nilai';

export const STATUS_IMPOR = {
  proses: { label: 'Diproses', kelas: 'bg-sky-100 text-sky-800 border-sky-200' },
  selesai: { label: 'Selesai', kelas: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  gagal: { label: 'Gagal', kelas: 'bg-rose-100 text-rose-800 border-rose-200' },
};

// ---- Data tiruan ----
let logContoh = null;
export function riwayatImporTiruan() {
  if (!logContoh) {
    const t = hariIniWIB();
    logContoh = [
      { id: 'contoh-log-2', mapel_id: 'contoh-mtk', mapel_nama: 'Matematika (contoh)', jenjang: 7, berkas: 'nilai_uas_matematika_kelas_7.xlsx',
        status: 'selesai', pesan: '', diproses: 96, total_baris: 96, berhasil: 93, gagal: 3,
        per_sheet: [{ sheet: '7A', kelas: '7A', total: 32, berhasil: 32, gagal: 0 }, { sheet: '7B', kelas: '7B', total: 32, berhasil: 30, gagal: 2 },
          { sheet: '7C', kelas: '7C', total: 32, berhasil: 31, gagal: 1 }],
        galat: [{ sheet: '7B', baris: 9, nama: 'Bagus Saputra', pesan: 'Nilai di luar rentang 0–100 (105)' },
          { sheet: '7B', baris: 21, nama: 'Dimas Hidayat', pesan: 'Nilai bukan angka ("delapan puluh")' },
          { sheet: '7C', baris: 14, nama: 'Siswa Tidak Dikenal', pesan: 'Siswa tidak ditemukan di kelas 7C' }],
        diunggah_oleh_nama: 'Siti Aminah (contoh)', waktu: `${t}T10:12:00+07:00`, selesai_pada: `${t}T10:12:20+07:00` },
      { id: 'contoh-log-1', mapel_id: 'contoh-ipa', mapel_nama: 'IPA (contoh)', jenjang: 8, berkas: 'nilai_uas_ipa_kelas_8.xlsx',
        status: 'gagal', pesan: 'Berkas bukan template nilai UAS (sheet kelas tidak dikenali)', diproses: 0, total_baris: 0, berhasil: 0, gagal: 0,
        per_sheet: [], galat: [], diunggah_oleh_nama: 'Siti Aminah (contoh)', waktu: `${t}T09:40:00+07:00`, selesai_pada: `${t}T09:40:01+07:00` },
    ];
  }
  return { items: logContoh.map((l) => ({ ...l })) };
}

// Impor contoh yang "sedang diproses": progres bertambah menurut waktu sejak dimulai (±12 detik).
const MULAI_CONTOH = Date.now();
const imporContohBaru = {}; // { log_id: { mulai, mapel_nama, jenjang, berkas } }
export function imporBerjalanTiruan(logId = 'contoh-log-3') {
  const baru = imporContohBaru[logId];
  if (baru) {
    const per = Math.min(1, (Date.now() - baru.mulai) / 8000);
    const total = 32;
    const diproses = Math.round(per * total);
    return { id: logId, mapel_id: baru.mapel_id, mapel_nama: baru.mapel_nama, jenjang: baru.jenjang, berkas: baru.berkas,
      status: per >= 1 ? 'selesai' : 'proses', pesan: '', diproses, total_baris: total, berhasil: diproses, gagal: 0,
      per_sheet: [{ sheet: `${baru.jenjang}B`, kelas: `${baru.jenjang}B`, total, diproses, berhasil: diproses, gagal: 0 }], galat: [],
      diunggah_oleh_nama: 'Anda (contoh)', waktu: new Date(baru.mulai).toISOString(), selesai_pada: per >= 1 ? new Date().toISOString() : null };
  }
  const total = [32, 31, 30];
  const per = Math.min(1, (Date.now() - MULAI_CONTOH) / 12000);
  let sisa = Math.round(per * 93);
  const per_sheet = ['9A', '9B', '9C'].map((k, i) => {
    const diproses = Math.min(total[i], sisa);
    sisa -= diproses;
    const gagal = k === '9B' && diproses > 20 ? 1 : 0;
    return { sheet: k, kelas: k, total: total[i], diproses, berhasil: diproses - gagal, gagal };
  });
  const diproses = per_sheet.reduce((a, x) => a + x.diproses, 0);
  return {
    id: 'contoh-log-3', mapel_id: 'contoh-bin', mapel_nama: 'Bahasa Indonesia (contoh)', jenjang: 9, berkas: 'nilai_uas_bahasa_indonesia_kelas_9.xlsx',
    status: per >= 1 ? 'selesai' : 'proses', pesan: '', diproses, total_baris: 93,
    berhasil: per_sheet.reduce((a, x) => a + x.berhasil, 0), gagal: per_sheet.reduce((a, x) => a + x.gagal, 0), per_sheet,
    galat: per_sheet[1].gagal ? [{ sheet: '9B', baris: 25, nama: 'Hana Khoirunnisa', pesan: 'Nilai kosong' }] : [],
    diunggah_oleh_nama: 'Anda (contoh)', waktu: new Date(MULAI_CONTOH).toISOString(), selesai_pada: per >= 1 ? new Date().toISOString() : null,
  };
}

/** Persentase progres (0–100) dari diproses/total. */
export const persenProgres = (diproses, total) => (total ? Math.min(100, Math.round((diproses / total) * 100)) : 0);

/** Riwayat impor nilai satu ujian -> { items, tiruan }. */
export const muatRiwayatImpor = (ujianId) => denganTiruan(
  async () => (await api.get(`/ujian/${ujianId}/nilai/impor`)).data,
  () => ({ items: [...Object.keys(imporContohBaru).reverse().map(imporBerjalanTiruan), imporBerjalanTiruan(), ...riwayatImporTiruan().items] }),
);

/** Rincian satu impor (termasuk galat per baris) -> ImporLog & { tiruan }. */
export const muatImpor = (ujianId, logId) => denganTiruan(
  async () => (await api.get(`/ujian/${ujianId}/nilai/impor/${logId}`)).data,
  () => (logId === 'contoh-log-3' || imporContohBaru[logId] ? imporBerjalanTiruan(logId)
    : riwayatImporTiruan().items.find((l) => l.id === logId) || riwayatImporTiruan().items[0]),
);

export const MAKS_BERKAS_NILAI = 5 * 1024 * 1024;
export function validasiBerkasNilai(file) {
  if (!file) return 'Pilih berkas terlebih dahulu';
  if (!file.name.toLowerCase().endsWith('.xlsx')) return 'Berkas harus .xlsx (template nilai UAS dari aplikasi)';
  if (file.size === 0) return 'Berkas kosong';
  if (file.size > MAKS_BERKAS_NILAI) return 'Ukuran berkas maksimal 5 MB';
  return null;
}

/** Unggah berkas nilai UAS (satu jenjang, beberapa sheet kelas) -> { log_id, tiruan }; pantau lewat muatImpor. */
export const imporNilai = (ujianId, { berkas, mapelId, mapelNama, jenjang, ulangDari }) => denganTiruan(
  async () => {
    const fd = new FormData();
    fd.append('berkas', berkas);
    fd.append('mapel_id', mapelId);
    fd.append('jenjang', String(jenjang));
    if (ulangDari) fd.append('ulang_dari', ulangDari); // unggah ulang: hanya baris yang dulu gagal yang diproses
    return (await api.post(`/ujian/${ujianId}/nilai/impor`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
  },
  () => {
    const id = `contoh-log-${Date.now()}`;
    imporContohBaru[id] = { mulai: Date.now(), mapel_id: mapelId, mapel_nama: mapelNama, jenjang, berkas: berkas.name };
    return { log_id: id };
  },
);

/** Baris gagal -> berkas .xlsx daftar perbaikan (sheet, baris, nama, penyebab). */
export async function berkasBarisGagal(log) {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([['Sheet', 'Baris', 'Nama', 'Penyebab'], ...(log.galat || []).map((g) => [g.sheet, g.baris, g.nama || '', g.pesan])]);
  ws['!cols'] = [{ wch: 8 }, { wch: 7 }, { wch: 32 }, { wch: 60 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Baris gagal');
  return new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ---- Pilihan & rekap nilai ----
export function pilihanNilaiTiruan() {
  const kelas = (j) => ['A', 'B', 'C'].map((p) => ({ id: `contoh-${j}${p.toLowerCase()}`, nama: `${j}${p}`, jumlah_siswa: 32 }));
  return {
    mapel: [{ id: 'contoh-mtk', nama: 'Matematika (contoh)' }, { id: 'contoh-ipa', nama: 'IPA (contoh)' }, { id: 'contoh-bin', nama: 'Bahasa Indonesia (contoh)' }],
    jenjang: [7, 8, 9].map((j) => ({ jenjang: j, kelas: kelas(j) })),
    boleh_impor: true,
    pesan: null,
  };
}

export function rekapNilaiTiruan(mapelId, jenjang) {
  return {
    kelas: pilihanNilaiTiruan().jenjang.find((x) => x.jenjang === Number(jenjang))?.kelas.map((k, i) => ({
      kelas_id: k.id, nama: k.nama, total: k.jumlah_siswa, terisi: mapelId === 'contoh-mtk' ? [32, 30, 31][i] : 0,
      rata: mapelId === 'contoh-mtk' ? [81.4, 78.9, 80.2][i] : null, guru_nama: ['Siti Aminah', 'Bambang Setiawan', 'Siti Aminah'][i] + ' (contoh)',
    })) || [],
  };
}

/** Pilihan mapel & jenjang (dengan kelasnya) untuk nilai UAS -> { mapel, jenjang, boleh_impor, tiruan }. */
export const muatPilihanNilai = (ujianId) => denganTiruan(
  async () => (await api.get(`/ujian/${ujianId}/nilai/pilihan`)).data,
  pilihanNilaiTiruan,
);

/** Keterisian nilai UAS per kelas untuk satu mapel & jenjang -> { kelas, tiruan }. */
export const muatRekapNilai = (ujianId, mapelId, jenjang) => denganTiruan(
  async () => (await api.get(`/ujian/${ujianId}/nilai/rekap`, { params: { mapel_id: mapelId, jenjang } })).data,
  () => rekapNilaiTiruan(mapelId, jenjang),
);

// ---- Template nilai UAS (.xlsx): SATU berkas per mapel per jenjang, SATU sheet per kelas, nama siswa terisi ----
// Kolom sama dengan KOLOM_TEMPLATE_NILAI di backend/ujian_nilai_xlsx.py.
export const KOLOM_TEMPLATE_NILAI = ['No', 'ID Siswa', 'NIS', 'Nama', 'Nilai UAS'];
export const namaBerkasTemplateNilai = (mapel, jenjang) => `template_nilai_uas_${(mapel?.nama || 'mapel').replace(/[^\w]+/g, '_')}_kelas_${jenjang}.xlsx`.replace(/_+/g, '_');

async function templateNilaiTiruan(mapel, jenjang, kelas) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  kelas.forEach((k) => {
    const baris = Array.from({ length: Math.min(k.jumlah_siswa || 5, 5) }, (_, i) => [i + 1, `contoh-${k.nama}-${i + 1}`, `${jenjang}0${i + 1}`, `Siswa ${k.nama} ${i + 1} (contoh)`, '']);
    const ws = XLSX.utils.aoa_to_sheet([[`NILAI UAS ${mapel.nama} — KELAS ${k.nama}`], ['Isi kolom "Nilai UAS" (0–100). Jangan ubah ID Siswa & nama sheet.'], [], KOLOM_TEMPLATE_NILAI, ...baris]);
    ws['!cols'] = [6, 38, 10, 34, 12].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, k.nama);
  });
  return new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** Unduh template nilai UAS satu mapel & jenjang -> { blob, nama, tiruan }. */
export async function unduhTemplateNilai(ujianId, mapel, jenjang, kelas) {
  const nama = namaBerkasTemplateNilai(mapel, jenjang);
  try {
    const res = await api.get(`/ujian/${ujianId}/nilai/template`, { params: { mapel_id: mapel.id, jenjang }, responseType: 'blob' });
    const cd = res.headers?.['content-disposition'] || '';
    return { blob: res.data, nama: /filename="?([^";]+)"?/i.exec(cd)?.[1] || nama, tiruan: false };
  } catch (e) {
    if (await blobEndpointBelumAda(e)) return { blob: await templateNilaiTiruan(mapel, jenjang, kelas), nama, tiruan: true };
    throw await galatDariBlob(e);
  }
}

// ---- Nilai UAS di akun guru mapel (halaman Input Nilai) ----
//   GET /ujian/nilai/masa-guru?class_id=&subject_id=
//     -> { boleh_ubah, pesan, masa: null | { jenis: 'ujian'|'remidi', mulai, selesai }, ujian_nama }
//        (guru pengampu hanya boleh mengubah nilai UAS selama masa ujian/remidi yang dibuka panitia)
//   PUT /ujian/nilai/guru { class_id, subject_id, entries: [{ student_id, nilai_uas }] } -> { disimpan }
export const muatMasaGuru = (classId, subjectId) => denganTiruan(
  async () => (await api.get('/ujian/nilai/masa-guru', { params: { class_id: classId, subject_id: subjectId } })).data,
  () => ({ boleh_ubah: false, pesan: 'Nilai UAS diisi panitia ujian; masa ujian/remidi belum dibuka.', masa: null, ujian_nama: null }),
);

export const simpanUasGuru = (classId, subjectId, entries) => denganTiruan(
  async () => (await api.put('/ujian/nilai/guru', { class_id: classId, subject_id: subjectId, entries })).data,
  () => ({ disimpan: entries.length }),
);

// ---- Masa ujian & remidi (guru boleh mengubah nilai UAS hanya di dalam masa yang dibuka panitia) ----
//   GET /ujian/{ujian_id}/nilai/masa
//     -> { boleh_ubah, ujian: Masa, remidi: Masa, terbuka_sekarang: null|'ujian'|'remidi', diubah: { oleh_nama, pada }|null }
//   PUT /ujian/{ujian_id}/nilai/masa { ujian: Masa, remidi: Masa } -> sama   (admin, ketua & sekretaris panitia)
//   Masa = { aktif, mulai: 'YYYY-MM-DD'|null, selesai: 'YYYY-MM-DD'|null }
let masaContoh = null;
export function masaTiruan() {
  if (!masaContoh) {
    const t = hariIniWIB();
    masaContoh = { boleh_ubah: true, ujian: { aktif: true, mulai: t, selesai: t }, remidi: { aktif: false, mulai: null, selesai: null }, diubah: null };
  }
  const t = hariIniWIB();
  const dalam = (m) => m.aktif && m.mulai && m.selesai && m.mulai <= t && t <= m.selesai;
  return { ...masaContoh, terbuka_sekarang: dalam(masaContoh.ujian) ? 'ujian' : dalam(masaContoh.remidi) ? 'remidi' : null };
}

/** Galat isian satu masa -> pesan atau ''. */
export function galatMasa(m) {
  if (!m.aktif) return '';
  if (!m.mulai || !m.selesai) return 'Tanggal mulai & selesai wajib diisi saat masa dibuka';
  if (m.selesai < m.mulai) return 'Tanggal selesai tidak boleh sebelum tanggal mulai';
  return '';
}

export const muatMasaNilai = (ujianId) => denganTiruan(
  async () => (await api.get(`/ujian/${ujianId}/nilai/masa`)).data,
  masaTiruan,
);

export const simpanMasaNilai = (ujianId, isi) => denganTiruan(
  async () => (await api.put(`/ujian/${ujianId}/nilai/masa`, isi)).data,
  () => { masaContoh = { ...masaTiruan(), ...isi, diubah: { oleh_nama: 'Anda (contoh)', pada: new Date().toISOString() } }; return masaTiruan(); },
);

// ---- Form edit nilai UAS satu kelas ----
//   GET /ujian/{ujian_id}/nilai/kelas/{kelas_id}?mapel_id=
//     -> { kelas, mapel, boleh_ubah, alasan_kunci, items: [{ siswa_id, nis, nama, nilai, sumber, diedit_oleh_nama, waktu }] }
//   PUT /ujian/{ujian_id}/nilai/kelas/{kelas_id} { mapel_id, entries: [{ siswa_id, nilai }] } -> { disimpan }
//       (nilai 0–100 atau null; ditolak 423 bila terkunci masa ujian/remidi kecuali admin; tercatat di riwayat & audit,
//        langsung tampil di rapor/akun guru)
//   GET /ujian/{ujian_id}/nilai/riwayat?mapel_id=&siswa_id=&kelas_id= -> { items: [{ siswa_id, nilai_lama, nilai_baru, sumber, oleh_nama, waktu }] }
const nilaiKelasContoh = {};
export function nilaiKelasTiruan(kelasId, mapelId) {
  const kunci = `${kelasId}:${mapelId}`;
  if (!nilaiKelasContoh[kunci]) {
    nilaiKelasContoh[kunci] = Array.from({ length: 8 }, (_, i) => ({
      siswa_id: `contoh-${kelasId}-${i + 1}`, nis: `26${String(i + 1).padStart(2, '0')}`, nama: `Siswa ${i + 1} (contoh)`,
      nilai: mapelId === 'contoh-mtk' ? 70 + ((i * 7) % 25) : null, sumber: mapelId === 'contoh-mtk' ? 'impor' : null,
      diedit_oleh_nama: mapelId === 'contoh-mtk' ? 'Siti Aminah (contoh)' : null, waktu: null,
    }));
  }
  const masa = masaTiruan();
  return { kelas: { id: kelasId, nama: kelasId.replace('contoh-', '').toUpperCase() }, mapel: { id: mapelId },
    boleh_ubah: !!masa.terbuka_sekarang, alasan_kunci: masa.terbuka_sekarang ? null : 'Masa ujian/remidi sedang ditutup.',
    items: nilaiKelasContoh[kunci].map((x) => ({ ...x })) };
}

export const muatNilaiKelas = (ujianId, kelasId, mapelId) => denganTiruan(
  async () => (await api.get(`/ujian/${ujianId}/nilai/kelas/${kelasId}`, { params: { mapel_id: mapelId } })).data,
  () => nilaiKelasTiruan(kelasId, mapelId),
);

export const simpanNilaiKelas = (ujianId, kelasId, mapelId, entries) => denganTiruan(
  async () => (await api.put(`/ujian/${ujianId}/nilai/kelas/${kelasId}`, { mapel_id: mapelId, entries })).data,
  () => {
    const daftar = nilaiKelasContoh[`${kelasId}:${mapelId}`] || [];
    entries.forEach((e) => { const x = daftar.find((d) => d.siswa_id === e.siswa_id); if (x) Object.assign(x, { nilai: e.nilai, sumber: 'input', diedit_oleh_nama: 'Anda (contoh)' }); });
    return { disimpan: entries.length };
  },
);

/** Galat satu isian nilai -> pesan atau ''. */
export const galatNilai = (v) => {
  if (v === '' || v == null) return '';
  const n = Number(v);
  if (Number.isNaN(n)) return 'Harus angka';
  if (n < 0 || n > 100) return '0–100';
  return '';
};
