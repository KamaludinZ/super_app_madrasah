import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ThumbsUp, ThumbsDown, Scale } from 'lucide-react';

export function formatPoin(n) {
  const v = Number(n) || 0;
  return v > 0 ? `+${v}` : `${v}`;
}

// Batas bawaan "perlu perhatian" (akumulasi poin pelanggaran); nilai berlaku diambil dari server
// (GET /tatib/ambang, bawaan sama dengan BATAS_MINUS_PERHATIAN di backend/tatib_poin.py).
export const BATAS_MINUS_PERHATIAN = -20;

// Nilai bertanda satu catatan; catatan lama (sebelum migrasi) memakai tatib_poin.
export const nilaiPoin = (r) => Number(r?.poin ?? r?.tatib_poin ?? 0) || 0;

// Rangkum daftar catatan menjadi props RingkasanPoin.
export function rangkumPoin(records = []) {
  const plus = records.filter((r) => nilaiPoin(r) > 0);
  const minus = records.filter((r) => nilaiPoin(r) < 0);
  return {
    totalPlus: plus.reduce((s, r) => s + nilaiPoin(r), 0),
    totalMinus: minus.reduce((s, r) => s + nilaiPoin(r), 0),
    jumlahKebaikan: plus.length,
    jumlahPelanggaran: minus.length,
  };
}

// Kartu ringkasan poin tata tertib: kebaikan (plus) dan pelanggaran (minus)
// ditampilkan terpisah, lalu saldo = plus + minus. Dipakai di halaman siswa
// dan nanti di pantauan walikelas.
export default function RingkasanPoin({ totalPlus = 0, totalMinus = 0, jumlahKebaikan = 0, jumlahPelanggaran = 0 }) {
  const saldo = totalPlus + totalMinus;
  const besaran = totalPlus + Math.abs(totalMinus);
  const porsiPlus = besaran > 0 ? Math.round((totalPlus / besaran) * 100) : 0;

  return (
    <div className="space-y-3" data-testid="poin-ringkasan">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium">
              <ThumbsUp className="h-4 w-4" /> Poin Kebaikan
            </div>
            <p className="text-3xl font-bold text-emerald-700 mt-1 tabular-nums" data-testid="poin-total-plus">{formatPoin(totalPlus)}</p>
            <p className="text-xs text-slate-500">{jumlahKebaikan} catatan</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/40">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-700 text-sm font-medium">
              <ThumbsDown className="h-4 w-4" /> Poin Pelanggaran
            </div>
            <p className="text-3xl font-bold text-red-700 mt-1 tabular-nums" data-testid="poin-total-minus">{formatPoin(totalMinus)}</p>
            <p className="text-xs text-slate-500">{jumlahPelanggaran} catatan</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-slate-700 text-sm font-medium">
              <Scale className="h-4 w-4" /> Saldo Poin
            </div>
            <p
              className={`text-3xl font-bold mt-1 tabular-nums ${saldo < 0 ? 'text-red-700' : saldo > 0 ? 'text-emerald-700' : 'text-slate-900'}`}
              data-testid="poin-saldo"
            >
              {formatPoin(saldo)}
            </p>
            <p className="text-xs text-slate-500">kebaikan + pelanggaran</p>
          </CardContent>
        </Card>
      </div>

      {besaran > 0 && (
        <div>
          <div className="flex h-2 overflow-hidden rounded-full bg-red-200" role="img" aria-label={`Porsi poin kebaikan ${porsiPlus} persen`}>
            <div className="bg-emerald-500" style={{ width: `${porsiPlus}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-slate-500">
            <span>Kebaikan {porsiPlus}%</span>
            <span>Pelanggaran {100 - porsiPlus}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
