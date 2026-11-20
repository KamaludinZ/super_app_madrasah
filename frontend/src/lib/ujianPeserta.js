/**
 * Ujian Madrasah — Peserta per Ruang: pengelompokan siswa (dari data siswa yang sudah ada) ke ruang ujian beserta
 * nomor peserta. Satu siswa hanya di satu ruang per ujian; satu nomor peserta unik per ujian. Penempatan berlaku untuk
 * seluruh hari/sesi ujian; perubahan hanya oleh admin dan tercatat di jejak audit.
 *
 * Kontrak server (backend menyusul; koleksi `peserta_ruang`):
 *   GET /ujian/{ujian_id}/ruang/{ruang_id}/peserta
 *     -> { ruang: Ruang, boleh_ubah, items: [Peserta], nomor_lain: { NOMOR: nama } }
 *        (urut nomor peserta, lalu kelas & nama; nomor_lain = nomor peserta ruang lain pada ujian ini, huruf besar,
 *         untuk validasi ganda langsung di klien — hanya untuk admin)
 *   GET /ujian/{ujian_id}/kandidat?kelas_id=
 *     -> { kelas: [{ id, nama, jenjang, jumlah_siswa }], items: [Kandidat] }
 *        (rombel semester ujian; `items` hanya bila kelas_id diisi)
 *   POST /ujian/{ujian_id}/ruang/{ruang_id}/peserta { siswa_ids: [..] }
 *     -> { ditambahkan, dilewati: [{ siswa_id, nama, alasan }] }   (admin; jenjang siswa harus jenjang ruang,
 *        belum di ruang lain, kapasitas cukup)
 *   DELETE /ujian/{ujian_id}/ruang/{ruang_id}/peserta/{peserta_id} -> { ok }   (admin)
 *   PUT /ujian/{ujian_id}/ruang/{ruang_id}/nomor-peserta { items: [{ peserta_id, nomor_peserta }] }
 *     -> { disimpan, galat: [{ peserta_id, nama, pesan }] }   (admin; nomor unik per ujian, format huruf/angka/-./
 *        maks 30; baris bermasalah dilewati, baris lain tetap tersimpan; '' = kosongkan)
 *   PATCH /ujian/{ujian_id}/peserta/{peserta_id}/pindah { ruang_id, alasan }
 *     -> Peserta   (admin; satu siswa tetap SATU baris peserta per ujian — dipindah, bukan digandakan; ruang tujuan
 *        harus memuat jenjang siswa & masih ada kursi; nomor peserta ikut pindah; alasan tercatat di jejak audit)
 *
 *   Peserta  = { id, ruang_id, siswa_id, nama, nis, nisn, kelas, kelas_id, jenjang, nomor_peserta, sumber,
 *                ditetapkan_pada, ditetapkan_oleh_nama }
 *   Kandidat = { siswa_id, nama, nis, nisn, kelas, kelas_id, jenjang, nomor_peserta_um, ruang_id, ruang_nama }
 *              (ruang_id terisi bila siswa sudah ditempatkan pada ujian ini)
 */
import { api } from '@/lib/api';
import { denganTiruan } from '@/lib/ujian';
import { ruangTiruan } from '@/lib/ujianRuang';

// ---- Data tiruan ----
const NAMA_DEPAN = ['Ahmad', 'Aisyah', 'Bagus', 'Citra', 'Dimas', 'Fatimah', 'Ghani', 'Hana', 'Ilham', 'Jihan', 'Khalid', 'Laila', 'Muhammad', 'Nabila', 'Rizki', 'Salsabila'];
const NAMA_BELAKANG = ['Pratama', 'Azzahra', 'Saputra', 'Ramadhani', 'Hidayat', 'Nur Aini', 'Maulana', 'Putri', 'Firmansyah', 'Khoirunnisa'];
const KELAS_CONTOH = [
  { id: 'contoh-7a', nama: '7A', jenjang: 7 }, { id: 'contoh-7b', nama: '7B', jenjang: 7 },
  { id: 'contoh-8a', nama: '8A', jenjang: 8 }, { id: 'contoh-8b', nama: '8B', jenjang: 8 },
  { id: 'contoh-9a', nama: '9A', jenjang: 9 }, { id: 'contoh-9b', nama: '9B', jenjang: 9 },
];

let siswaContoh = null;
let pesertaContoh = null; // { ruang_id: [Peserta] }

function siapkanContoh() {
  if (siswaContoh) return;
  siswaContoh = [];
  KELAS_CONTOH.forEach((k, ki) => {
    for (let i = 0; i < 12; i += 1) {
      const n = ki * 12 + i;
      siswaContoh.push({
        siswa_id: `contoh-siswa-${n + 1}`,
        nama: `${NAMA_DEPAN[n % NAMA_DEPAN.length]} ${NAMA_BELAKANG[(n * 3) % NAMA_BELAKANG.length]} (contoh)`,
        nis: String(2600 + n),
        nisn: String(10000000 + n * 37),
        kelas: k.nama, kelas_id: k.id, jenjang: k.jenjang,
        nomor_peserta_um: k.jenjang === 9 ? `24-0${(n % 9) + 1}-${String(n).padStart(3, '0')}` : '',
      });
    }
  });
  pesertaContoh = {};
  const ruang = ruangTiruan().items;
  const isi = (ruangId, kelasIds, jumlahPerKelas) => {
    pesertaContoh[ruangId] = [];
    kelasIds.forEach((kid) => {
      siswaContoh.filter((s) => s.kelas_id === kid).slice(0, jumlahPerKelas).forEach((s) => {
        if (Object.values(pesertaContoh).some((daftar) => daftar.some((p) => p.siswa_id === s.siswa_id))) return;
        pesertaContoh[ruangId].push({
          ...s, id: `contoh-peserta-${s.siswa_id}`, ruang_id: ruangId, nomor_peserta: '', sumber: 'input',
          ditetapkan_pada: '2026-11-15T09:00:00+07:00', ditetapkan_oleh_nama: 'Administrator (contoh)',
        });
      });
    });
  };
  isi(ruang[0].id, ['contoh-7a', 'contoh-8a'], 6);
  isi(ruang[1].id, ['contoh-7b', 'contoh-8b'], 5);
  isi(ruang[2].id, ['contoh-9a'], 6);
}

function ruangDari(ujianId, ruangId) {
  return ruangTiruan(ujianId).items.find((r) => r.id === ruangId) || { id: ruangId, nama_ruang: '?', jenjang: [7, 8, 9], kapasitas: 32 };
}

function galatContoh(status, detail) {
  const e = new Error(detail);
  e.response = { status, data: { detail } };
  return e;
}

export const urutPeserta = (items) => [...items].sort((a, b) => (a.nomor_peserta || '￿').localeCompare(b.nomor_peserta || '￿')
  || a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama));

export function pesertaRuangTiruan(ujianId, ruangId) {
  siapkanContoh();
  return { ruang: ruangDari(ujianId, ruangId), boleh_ubah: true, items: urutPeserta(pesertaContoh[ruangId] || []), nomor_lain: nomorRuangLainTiruan(ruangId) };
}

export function kandidatTiruan(kelasId) {
  siapkanContoh();
  const tempat = {};
  Object.entries(pesertaContoh).forEach(([rid, daftar]) => daftar.forEach((p) => { tempat[p.siswa_id] = rid; }));
  const namaRuang = Object.fromEntries(ruangTiruan().items.map((r) => [r.id, r.nama_ruang]));
  return {
    kelas: KELAS_CONTOH.map((k) => ({ ...k, jumlah_siswa: siswaContoh.filter((s) => s.kelas_id === k.id).length })),
    items: kelasId ? siswaContoh.filter((s) => s.kelas_id === kelasId).map((s) => ({
      ...s, ruang_id: tempat[s.siswa_id] || null, ruang_nama: tempat[s.siswa_id] ? namaRuang[tempat[s.siswa_id]] : null,
    })) : [],
  };
}

// ---- Pemanggil API ----
/** Peserta satu ruang -> { ruang, boleh_ubah, items, tiruan }. */
export const muatPesertaRuang = (ujianId, ruangId) => denganTiruan(
  async () => (await api.get(`/ujian/${ujianId}/ruang/${ruangId}/peserta`)).data,
  () => pesertaRuangTiruan(ujianId, ruangId),
);

/** Kelas (rombel) & siswa kandidat peserta -> { kelas, items, tiruan }. */
export const muatKandidat = (ujianId, kelasId) => denganTiruan(
  async () => (await api.get(`/ujian/${ujianId}/kandidat`, { params: kelasId ? { kelas_id: kelasId } : {} })).data,
  () => kandidatTiruan(kelasId),
);

/** Tempatkan siswa ke ruang -> { ditambahkan, dilewati, tiruan }. */
export const tambahPeserta = (ujianId, ruangId, siswaIds) => denganTiruan(
  async () => (await api.post(`/ujian/${ujianId}/ruang/${ruangId}/peserta`, { siswa_ids: siswaIds })).data,
  () => {
    siapkanContoh();
    const ruang = ruangDari(ujianId, ruangId);
    const daftar = pesertaContoh[ruangId] || (pesertaContoh[ruangId] = []);
    const dilewati = [];
    let ditambahkan = 0;
    siswaIds.forEach((sid) => {
      const s = siswaContoh.find((x) => x.siswa_id === sid);
      const sudah = Object.entries(pesertaContoh).find(([, d]) => d.some((p) => p.siswa_id === sid));
      if (!s) dilewati.push({ siswa_id: sid, nama: sid, alasan: 'Siswa tidak ditemukan di data induk' });
      else if (sudah) dilewati.push({ siswa_id: sid, nama: s.nama, alasan: 'Sudah terdaftar di ruang lain pada ujian ini' });
      else if (!ruang.jenjang.includes(s.jenjang)) dilewati.push({ siswa_id: sid, nama: s.nama, alasan: `Kelas ${s.jenjang} bukan jenjang ruang ini` });
      else if (daftar.length >= ruang.kapasitas) dilewati.push({ siswa_id: sid, nama: s.nama, alasan: 'Kapasitas ruang penuh' });
      else {
        daftar.push({ ...s, id: `contoh-peserta-${sid}`, ruang_id: ruangId, nomor_peserta: '', sumber: 'input',
          ditetapkan_pada: new Date().toISOString(), ditetapkan_oleh_nama: 'Anda (contoh)' });
        ditambahkan += 1;
      }
    });
    return { ditambahkan, dilewati };
  },
);

/** Keluarkan peserta dari ruang -> { tiruan }. */
export const hapusPeserta = (ujianId, ruangId, pesertaId) => denganTiruan(
  async () => { await api.delete(`/ujian/${ujianId}/ruang/${ruangId}/peserta/${pesertaId}`); return {}; },
  () => {
    siapkanContoh();
    if (!pesertaContoh[ruangId]?.some((p) => p.id === pesertaId)) throw galatContoh(404, 'Peserta tidak ditemukan');
    pesertaContoh[ruangId] = pesertaContoh[ruangId].filter((p) => p.id !== pesertaId);
    return {};
  },
);

export const ALASAN_PINDAH_MIN = 5;

/** Pindahkan peserta ke ruang lain (tetap satu baris per siswa) -> { peserta, tiruan }. */
export const pindahPeserta = (ujianId, pesertaId, ruangTujuanId, alasan) => denganTiruan(
  async () => ({ peserta: (await api.patch(`/ujian/${ujianId}/peserta/${pesertaId}/pindah`, { ruang_id: ruangTujuanId, alasan })).data }),
  () => {
    siapkanContoh();
    const asal = Object.keys(pesertaContoh).find((rid) => pesertaContoh[rid].some((p) => p.id === pesertaId));
    if (!asal) throw galatContoh(404, 'Peserta tidak ditemukan');
    if (asal === ruangTujuanId) throw galatContoh(400, 'Ruang tujuan sama dengan ruang sekarang');
    const p = pesertaContoh[asal].find((x) => x.id === pesertaId);
    const tujuan = ruangDari(ujianId, ruangTujuanId);
    const isi = pesertaContoh[ruangTujuanId] || (pesertaContoh[ruangTujuanId] = []);
    if (!tujuan.jenjang.includes(p.jenjang)) throw galatContoh(409, `Ruang ${tujuan.nama_ruang} tidak memuat kelas ${p.jenjang}`);
    if (isi.length >= tujuan.kapasitas) throw galatContoh(409, `Ruang ${tujuan.nama_ruang} sudah penuh`);
    pesertaContoh[asal] = pesertaContoh[asal].filter((x) => x.id !== pesertaId);
    const baru = { ...p, ruang_id: ruangTujuanId };
    isi.push(baru);
    return { peserta: baru };
  },
);

export const NOMOR_PESERTA_MAKS = 30;
const POLA_NOMOR = /^[A-Za-z0-9][A-Za-z0-9./-]*$/;

/** Galat format satu nomor peserta (sama dengan validasi server), '' bila sah/kosong. */
export function galatFormatNomor(nomor) {
  const n = (nomor || '').trim();
  if (!n) return '';
  if (n.length > NOMOR_PESERTA_MAKS) return `Maksimal ${NOMOR_PESERTA_MAKS} karakter`;
  if (!POLA_NOMOR.test(n)) return 'Hanya huruf, angka, titik, garis miring, dan tanda minus';
  return '';
}

/** Nomor ganda dalam isian -> { peserta_id: pesan }. `lain` = { nomor: nama } nomor yang dipakai ruang lain. */
export function galatNomorGanda(isian, lain = {}) {
  const galat = {};
  const dipakai = {};
  isian.forEach(({ peserta_id: id, nomor_peserta: nomor, nama }) => {
    const n = (nomor || '').trim().toUpperCase();
    if (!n) return;
    if (lain[n]) galat[id] = `Sudah dipakai ${lain[n]} di ruang lain`;
    else if (dipakai[n]) galat[id] = `Sama dengan nomor ${dipakai[n]}`;
    else dipakai[n] = nama;
  });
  return galat;
}

/** Usulan nomor berurutan: awalan + angka mulai, panjang angka tetap (mis. '26-01-' + 001). */
export function nomorBerurutan(jumlah, { awalan = '', mulai = 1, digit = 3 } = {}) {
  return Array.from({ length: jumlah }, (_, i) => `${awalan}${String(Number(mulai) + i).padStart(Number(digit) || 1, '0')}`);
}

/** Nomor peserta yang sudah dipakai di ruang lain (data contoh) -> { NOMOR: nama }. */
export function nomorRuangLainTiruan(ruangId) {
  siapkanContoh();
  const hasil = {};
  Object.entries(pesertaContoh).forEach(([rid, daftar]) => {
    if (rid === ruangId) return;
    daftar.forEach((p) => { if (p.nomor_peserta) hasil[p.nomor_peserta.toUpperCase()] = p.nama; });
  });
  return hasil;
}

/** Simpan nomor peserta satu ruang -> { disimpan, galat, tiruan }. items = [{ peserta_id, nomor_peserta }]. */
export const simpanNomorPeserta = (ujianId, ruangId, items) => denganTiruan(
  async () => (await api.put(`/ujian/${ujianId}/ruang/${ruangId}/nomor-peserta`, { items })).data,
  () => {
    siapkanContoh();
    const daftar = pesertaContoh[ruangId] || [];
    const isian = items.map((i) => ({ ...i, nama: daftar.find((p) => p.id === i.peserta_id)?.nama || i.peserta_id }));
    const ganda = galatNomorGanda(isian, nomorRuangLainTiruan(ruangId));
    const galat = [];
    let disimpan = 0;
    isian.forEach((i) => {
      const pesan = galatFormatNomor(i.nomor_peserta) || ganda[i.peserta_id];
      if (pesan) { galat.push({ peserta_id: i.peserta_id, nama: i.nama, pesan }); return; }
      const p = daftar.find((x) => x.id === i.peserta_id);
      if (p) { p.nomor_peserta = (i.nomor_peserta || '').trim(); p.sumber = 'input'; disimpan += 1; }
    });
    return { disimpan, galat };
  },
);

// ---- Template nomor peserta per ruang (.xlsx) ----
// Satu berkas = satu ruang dan HANYA berisi siswa yang sudah dibagi ke ruang itu. Kolom sama dengan
// KOLOM_TEMPLATE_PESERTA di backend/ujian_peserta_xlsx.py; ID Siswa dipakai mencocokkan baris saat impor.
//   GET /ujian/{ujian_id}/ruang/{ruang_id}/template-peserta  -> berkas .xlsx (sheet "Peserta" + sheet tersembunyi "_meta")
export const KOLOM_TEMPLATE_PESERTA = ['No', 'ID Siswa', 'NIS', 'NISN', 'Nama', 'Kelas', 'Jenjang', 'No. Peserta', 'No. Peserta UM (data siswa)'];
export const BARIS_HEADER_TEMPLATE = 4; // judul (1), keterangan (2), kosong (3), header (4)

export const namaBerkasTemplate = (ujian, ruang) => `template_nomor_peserta_${(ujian?.nama || 'ujian').replace(/[^\w]+/g, '_')}_ruang_${ruang?.nama_ruang || ''}.xlsx`
  .replace(/_+/g, '_');

export const barisTemplate = (peserta) => peserta.map((p, i) => [
  i + 1, p.siswa_id, p.nis || '', p.nisn || '', p.nama, p.kelas, p.jenjang, p.nomor_peserta || '', p.nomor_peserta_um || '',
]);

async function templateTiruan(ujian, ruang, peserta) {
  const XLSX = await import('xlsx');
  const aoa = [
    [`TEMPLATE NOMOR PESERTA — ${ujian?.nama || ''}`],
    [`Ruang ${ruang.nama_ruang} · Kelas ${ruang.jenjang.join(' + ')} · Isi kolom "No. Peserta" saja; jangan ubah kolom ID Siswa.`],
    [],
    KOLOM_TEMPLATE_PESERTA,
    ...barisTemplate(peserta),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [6, 14, 10, 12, 34, 8, 8, 16, 22].map((wch) => ({ wch }));
  const meta = XLSX.utils.aoa_to_sheet([['ujian_id', ujian?.id || ''], ['ruang_id', ruang.id], ['jenis', 'template_nomor_peserta']]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Peserta');
  XLSX.utils.book_append_sheet(wb, meta, '_meta');
  wb.Workbook = { Sheets: [{ Hidden: 0 }, { Hidden: 1 }] };
  const isi = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([isi], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** Unduh template nomor peserta satu ruang -> { blob, nama, tiruan }. */
export async function unduhTemplatePeserta(ujian, ruang, peserta) {
  const nama = namaBerkasTemplate(ujian, ruang);
  try {
    const res = await api.get(`/ujian/${ujian.id}/ruang/${ruang.id}/template-peserta`, { responseType: 'blob' });
    const cd = res.headers?.['content-disposition'] || '';
    return { blob: res.data, nama: /filename="?([^";]+)"?/i.exec(cd)?.[1] || nama, tiruan: false };
  } catch (e) {
    if (await blobEndpointBelumAda(e)) return { blob: await templateTiruan(ujian, ruang, peserta), nama, tiruan: true };
    throw await galatDariBlob(e);
  }
}

// Galat respons blob: isi JSON { detail } dibaca dulu agar pesan server tampil seperti galat biasa.
async function bacaDetailBlob(e) {
  const data = e?.response?.data;
  if (!(data instanceof Blob)) return data?.detail;
  try { return JSON.parse(await data.text())?.detail; } catch { return undefined; }
}

export async function blobEndpointBelumAda(e) {
  return e?.response?.status === 404 && (await bacaDetailBlob(e)) === 'Not Found';
}

export async function galatDariBlob(e) {
  if (!(e?.response?.data instanceof Blob)) return e;
  const detail = await bacaDetailBlob(e);
  e.response = { ...e.response, data: { detail } };
  return e;
}

/** Simpan blob sebagai berkas unduhan di peramban. */
export function simpanBerkas(blob, nama) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nama;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- Impor nomor peserta per ruang (.xlsx) ----
//   POST /ujian/{ujian_id}/ruang/{ruang_id}/impor-peserta   (multipart: berkas=<.xlsx>)
//     -> { total, tersimpan, dilewati: [{ baris, siswa_id, nama, alasan }] }   (admin)
//   Satu berkas = satu ruang (sheet _meta harus menunjuk ruang ini). Per baris: siswa harus ada di data induk, jenjang
//   sesuai ruang, belum terdaftar di ruang lain pada ujian yang sama, dan nomor peserta sah & tidak ganda. Siswa yang
//   belum ada di ruang ini ikut ditempatkan (sumber 'impor_template'). Baris bermasalah dilewati beserta alasannya.
export const MAKS_BERKAS_IMPOR = 5 * 1024 * 1024;

export function validasiBerkasImpor(file) {
  if (!file) return 'Pilih berkas terlebih dahulu';
  if (!file.name.toLowerCase().endsWith('.xlsx')) return 'Berkas harus berformat Excel .xlsx (template dari aplikasi)';
  if (file.size === 0) return 'Berkas kosong';
  if (file.size > MAKS_BERKAS_IMPOR) return 'Ukuran berkas maksimal 5 MB';
  return null;
}

async function imporTiruan(ujianId, ruangId, file) {
  siapkanContoh();
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const meta = wb.Sheets._meta ? Object.fromEntries(XLSX.utils.sheet_to_json(wb.Sheets._meta, { header: 1 })) : {};
  if (meta.ruang_id && meta.ruang_id !== ruangId) throw galatContoh(400, 'Berkas ini template untuk ruang lain. Impor dari halaman ruang yang sesuai.');
  const rows = XLSX.utils.sheet_to_json(wb.Sheets.Peserta || wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
  const header = rows[BARIS_HEADER_TEMPLATE - 1] || [];
  if (KOLOM_TEMPLATE_PESERTA.some((k, i) => String(header[i] || '').trim() !== k)) {
    throw galatContoh(400, 'Kolom berkas tidak sesuai template. Unduh ulang template ruang ini lalu isi kolom No. Peserta.');
  }
  const ruang = ruangDari(ujianId, ruangId);
  const daftar = pesertaContoh[ruangId] || (pesertaContoh[ruangId] = []);
  const lain = nomorRuangLainTiruan(ruangId);
  const dipakai = {};
  const dilewati = [];
  let tersimpan = 0;
  let total = 0;
  rows.slice(BARIS_HEADER_TEMPLATE).forEach((r, i) => {
    const baris = BARIS_HEADER_TEMPLATE + i + 1;
    const [, sid, , , namaSel, , , nomorSel] = r.map((x) => String(x ?? '').trim());
    if (!sid && !nomorSel) return;
    total += 1;
    const s = siswaContoh.find((x) => x.siswa_id === sid);
    const nama = s?.nama || namaSel || sid;
    const lewati = (alasan) => dilewati.push({ baris, siswa_id: sid, nama, alasan });
    if (!s) return lewati('Siswa tidak ditemukan di data induk');
    const diRuangLain = Object.entries(pesertaContoh).find(([rid, d]) => rid !== ruangId && d.some((p) => p.siswa_id === sid));
    if (diRuangLain) return lewati('Sudah terdaftar di ruang lain pada ujian ini');
    if (!ruang.jenjang.includes(s.jenjang)) return lewati(`Kelas ${s.jenjang} bukan jenjang ruang ini`);
    const fmt = galatFormatNomor(nomorSel);
    if (!nomorSel) return lewati('No. Peserta kosong');
    if (fmt) return lewati(fmt);
    const kunci = nomorSel.toUpperCase();
    if (lain[kunci]) return lewati(`No. Peserta ${nomorSel} sudah dipakai ${lain[kunci]}`);
    if (dipakai[kunci]) return lewati(`No. Peserta ${nomorSel} ganda dengan baris ${dipakai[kunci]}`);
    dipakai[kunci] = baris;
    let p = daftar.find((x) => x.siswa_id === sid);
    if (!p) {
      if (daftar.length >= ruang.kapasitas) return lewati('Kapasitas ruang penuh');
      p = { ...s, id: `contoh-peserta-${sid}`, ruang_id: ruangId, ditetapkan_pada: new Date().toISOString(), ditetapkan_oleh_nama: 'Anda (contoh)' };
      daftar.push(p);
    }
    Object.assign(p, { nomor_peserta: nomorSel, sumber: 'impor_template' });
    tersimpan += 1;
    return undefined;
  });
  return { total, tersimpan, dilewati };
}

/** Impor template nomor peserta satu ruang -> { total, tersimpan, dilewati, tiruan }. */
export const imporNomorPeserta = (ujianId, ruangId, file) => denganTiruan(
  async () => {
    const fd = new FormData();
    fd.append('berkas', file);
    return (await api.post(`/ujian/${ujianId}/ruang/${ruangId}/impor-peserta`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
  },
  () => imporTiruan(ujianId, ruangId, file),
);
