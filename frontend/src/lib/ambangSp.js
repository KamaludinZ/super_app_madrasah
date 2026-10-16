// Pengaturan Ambang SP: batas akumulasi poin pelanggaran (nilai mutlak) untuk usulan SP1/SP2/SP3.
// SEMENTARA memakai data tiruan di memori (frontend dibangun lebih dulu). Kontrak yang diasumsikan:
//   GET /tatib/ambang-sp          -> { sp1, sp2, sp3, diubah_oleh_nama, diubah_pada, bawaan }
//   PUT /tatib/ambang-sp          { sp1, sp2, sp3, alasan } -> sama dengan GET (hanya admin)
//   GET /tatib/ambang-sp/riwayat  -> [{ id, waktu, oleh_nama, dari: {sp1,sp2,sp3}, ke: {sp1,sp2,sp3}, alasan }]
import { AMBANG_SP_BAWAAN } from '@/lib/tindakanTatib';

const jeda = (data) => new Promise((resolve) => setTimeout(() => resolve(structuredClone(data)), 150));

const ambangTiruan = { sp1: 25, sp2: 50, sp3: 75, diubah_oleh_nama: 'Sistem', diubah_pada: '2026-10-16T00:00:00', bawaan: false };

export { AMBANG_SP_BAWAAN };

export const ambilAmbangSP = () => jeda(ambangTiruan);

export const MAKS_AMBANG_SP = 10000;

// Galat per isian {sp1?, sp2?, sp3?} untuk nilai form (string/angka); objek kosong = valid.
// Aturan sama dengan server (validasi_ambang_sp): bilangan bulat 1..MAKS dan naik SP1 < SP2 < SP3.
export function validasiAmbang(nilai) {
  const galat = {};
  const angka = {};
  ['sp1', 'sp2', 'sp3'].forEach((k) => {
    const teks = String(nilai?.[k] ?? '').trim();
    if (!teks) galat[k] = 'Wajib diisi';
    else if (!/^\d+$/.test(teks)) galat[k] = 'Harus bilangan bulat';
    else {
      angka[k] = parseInt(teks, 10);
      if (angka[k] < 1 || angka[k] > MAKS_AMBANG_SP) galat[k] = `Antara 1 dan ${MAKS_AMBANG_SP}`;
    }
  });
  if (!galat.sp2 && !galat.sp1 && angka.sp2 <= angka.sp1) galat.sp2 = 'Harus lebih besar dari SP1';
  if (!galat.sp3 && !galat.sp2 && angka.sp3 <= angka.sp2) galat.sp3 = 'Harus lebih besar dari SP2';
  return galat;
}

// Simpan ambang baru (hanya admin di server). `alasan` opsional, ikut dicatat di riwayat audit.
export async function simpanAmbangSP({ sp1, sp2, sp3, alasan }) {
  const galat = validasiAmbang({ sp1, sp2, sp3 });
  if (Object.keys(galat).length) throw new Error('Ambang SP tidak valid');
  Object.assign(ambangTiruan, {
    sp1: Number(sp1), sp2: Number(sp2), sp3: Number(sp3), alasan: (alasan || '').trim() || null,
    diubah_oleh_nama: 'Anda', diubah_pada: new Date().toISOString(), bawaan: false,
  });
  return jeda(ambangTiruan);
}
