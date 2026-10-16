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
