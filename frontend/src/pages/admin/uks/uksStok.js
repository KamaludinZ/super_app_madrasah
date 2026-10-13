import React from 'react';
import { Badge } from '@/components/ui/badge';
import { formatWIB } from '@/lib/datetime';
import { hariIniWIB } from '@/lib/tanggal';

// Stok Obat/BMHP disimpan per batch (tiap Obat/BMHP Masuk). Saat dipakai, server memotong
// batch yang kadaluarsanya paling dekat (FEFO); bila sama, yang masuk lebih dulu (FIFO).
// Batch yang SUDAH kadaluarsa dikunci: tidak bisa dipakai, tetapi stoknya tetap tercatat.

export const SEGERA_KADALUARSA_HARI = 30;

export const formatED = (tgl) => (tgl ? formatWIB(String(tgl).slice(0, 10), 'Date', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

function tambahHari(tgl, n) {
  const d = new Date(`${tgl}T00:00:00+07:00`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

/** 'habis' | 'kadaluarsa' | 'segera' | 'aman' untuk satu batch masuk. */
export function statusBatch(batch, hariIni = hariIniWIB()) {
  const ed = String(batch?.tanggal_kadaluarsa || '').slice(0, 10);
  if (!(batch?.stok_sisa > 0)) return 'habis';
  if (ed && ed < hariIni) return 'kadaluarsa';
  if (ed && ed <= tambahHari(hariIni, SEGERA_KADALUARSA_HARI)) return 'segera';
  return 'aman';
}

const GAYA_STATUS = {
  habis: ['Habis', 'bg-slate-100 text-slate-600 border-slate-200'],
  kadaluarsa: ['Kadaluarsa · dikunci', 'bg-rose-100 text-rose-700 border-rose-200'],
  segera: ['Segera kadaluarsa', 'bg-amber-100 text-amber-800 border-amber-200'],
  aman: ['Layak pakai', 'bg-emerald-100 text-emerald-700 border-emerald-200'],
};

export function BatchStatusBadge({ batch }) {
  const [label, cls] = GAYA_STATUS[statusBatch(batch)];
  return <Badge className={`${cls} whitespace-nowrap`}>{label}</Badge>;
}

/** Teks pilihan dropdown: "Paracetamol (Stok: 12 tablet · ED 24 Okt 2026)". */
export function labelPilihanStok(nama, item) {
  const bagian = [`Stok: ${item?.stok_tersisa ?? 0}${item?.satuan ? ` ${item.satuan}` : ''}`];
  if (item?.tanggal_kadaluarsa_terdekat) bagian.push(`ED ${formatED(item.tanggal_kadaluarsa_terdekat)}`);
  if (item?.stok_kadaluarsa > 0) bagian.push(`${item.stok_kadaluarsa} kadaluarsa dikunci`);
  return `${nama} (${bagian.join(' · ')})`;
}

/** Simulasi potongan FEFO lalu FIFO dari batch_layak (urutan sudah dari server). */
export function rencanaPotong(batchLayak, jumlah) {
  let sisa = Number(jumlah) || 0;
  const hasil = [];
  for (const b of batchLayak || []) {
    if (sisa <= 0) break;
    const ambil = Math.min(b.stok_sisa || 0, sisa);
    if (ambil > 0) hasil.push({ ...b, ambil });
    sisa -= ambil;
  }
  return { hasil, kurang: Math.max(sisa, 0) };
}

/** Petunjuk kecil di bawah baris pemakaian: batch mana yang akan dipotong. */
export function RencanaPotongHint({ item, jumlah, tambahan = 0 }) {
  if (!item) return null;
  const { hasil, kurang } = rencanaPotong(item.batch_layak, jumlah);
  return (
    <div className="text-[11px] leading-snug text-slate-500 mt-1" data-testid="rencana-potong">
      {hasil.length > 0 && (
        <span>
          Dipotong dari batch: {hasil.map((b, i) => (
            <span key={b.id || i}>{i > 0 && ', '}{b.ambil} {item.satuan || ''} (ED {formatED(b.tanggal_kadaluarsa)})</span>
          ))}
        </span>
      )}
      {kurang > tambahan && <span className="text-rose-600 font-medium"> · stok layak pakai kurang {kurang - tambahan}</span>}
      {item.stok_kadaluarsa > 0 && <span className="text-rose-600"> · {item.stok_kadaluarsa} {item.satuan || ''} kadaluarsa tidak dipakai</span>}
    </div>
  );
}

/** Sel "Kadaluarsa" di daftar Obat/BMHP: ED terdekat stok layak + stok kadaluarsa yang dikunci. */
export function KadaluarsaCell({ item }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 font-mono">
        {formatED(item.tanggal_kadaluarsa_terdekat)}
        {item.segera_kadaluarsa && <Badge className="bg-amber-100 text-amber-800 border-amber-200 font-sans">≤ {SEGERA_KADALUARSA_HARI} hari</Badge>}
      </div>
      {item.stok_kadaluarsa > 0 && (
        <div className="text-xs text-rose-600 font-medium">
          {item.stok_kadaluarsa} {item.satuan} sudah kadaluarsa ({item.jumlah_batch_kadaluarsa} batch, dikunci)
        </div>
      )}
    </div>
  );
}
