import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';
import { BULAN_ID, defaultPeriode, labelPeriode, rentangPeriode, tahunOptions, todayWib } from './uksPeriode';

function formatTanggal(d) {
  const [y, m, day] = d.split('-');
  return `${day}-${m}-${y}`;
}

const pad = (n) => String(n).padStart(2, '0');

// Periode "sekarang" (WIB) untuk membatasi pilihan masa depan.
const nowYm = () => {
  const t = todayWib();
  return { tahun: t.getUTCFullYear(), bulan: t.getUTCMonth() + 1 };
};

const isFuture = (p) => {
  const n = nowYm();
  if (Number(p.tahun) > n.tahun) return true;
  return p.mode === 'bulanan' && Number(p.tahun) === n.tahun && Number(p.bulan) > n.bulan;
};

// Geser periode satu langkah (bulan atau tahun) ke belakang (-1) / depan (+1).
export const geserPeriode = (p, arah) => {
  if (p.mode === 'tahunan') return { ...p, tahun: String(Number(p.tahun) + arah) };
  let y = Number(p.tahun);
  let m = Number(p.bulan) + arah;
  if (m < 1) { m = 12; y -= 1; }
  if (m > 12) { m = 1; y += 1; }
  return { ...p, tahun: String(y), bulan: pad(m) };
};

// Baca/tulis periode dari query string URL agar tahan refresh & bisa dibagikan.
export const periodeFromSearch = (search) => {
  const q = new URLSearchParams(search);
  const def = defaultPeriode();
  const mode = q.get('periode') === 'tahunan' ? 'tahunan' : 'bulanan';
  const tahun = /^\d{4}$/.test(q.get('tahun') || '') ? q.get('tahun') : def.tahun;
  const bulanQ = q.get('bulan') || '';
  const bulan = /^(0[1-9]|1[0-2])$/.test(bulanQ) ? bulanQ : def.bulan;
  const p = { mode, tahun, bulan };
  return isFuture(p) ? def : p;
};

export const periodeToSearch = (p) => {
  const q = new URLSearchParams({ periode: p.mode, tahun: p.tahun });
  if (p.mode === 'bulanan') q.set('bulan', p.bulan);
  return `?${q.toString()}`;
};

/** Pemilih periode laporan UKS: mode bulanan/tahunan, tahun, bulan, dan navigasi cepat. */
export default function PeriodeFilter({ value, onChange }) {
  const { start, end } = rentangPeriode(value);
  const n = nowYm();
  const next = geserPeriode(value, 1);
  const set = (p) => onChange(isFuture(p) ? { ...p, bulan: pad(n.bulan) } : p);
  const isCurrent = value.mode === 'tahunan'
    ? Number(value.tahun) === n.tahun
    : Number(value.tahun) === n.tahun && Number(value.bulan) === n.bulan;

  return (
    <Card>
      <CardContent className="p-4 flex flex-col lg:flex-row lg:items-end gap-3" data-testid="periode-filter">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-slate-500 uppercase">Periode</div>
          <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5">
            {['bulanan', 'tahunan'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => set({ ...value, mode: m })}
                className={`px-3 py-1.5 text-sm rounded ${value.mode === m ? 'bg-[#006837] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                aria-pressed={value.mode === m}
              >
                {m === 'bulanan' ? 'Bulanan' : 'Tahunan'}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-semibold text-slate-500 uppercase">Tahun</div>
          <Select value={value.tahun} onValueChange={(t) => set({ ...value, tahun: t })}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[...new Set([value.tahun, ...tahunOptions()])].sort().reverse().map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {value.mode === 'bulanan' && (
          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-500 uppercase">Bulan</div>
            <Select value={value.bulan} onValueChange={(b) => set({ ...value, bulan: b })}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BULAN_ID.map((nama, i) => {
                  const v = pad(i + 1);
                  const future = Number(value.tahun) === n.tahun && i + 1 > n.bulan;
                  return <SelectItem key={v} value={v} disabled={future}>{nama}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon" onClick={() => set(geserPeriode(value, -1))} aria-label="Periode sebelumnya"><ChevronLeft className="h-4 w-4" /></Button>
          <Button type="button" variant="outline" size="icon" onClick={() => set(next)} disabled={isFuture(next)} aria-label="Periode berikutnya"><ChevronRight className="h-4 w-4" /></Button>
          {!isCurrent && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...defaultPeriode(), mode: value.mode })}>
              {value.mode === 'tahunan' ? 'Tahun ini' : 'Bulan ini'}
            </Button>
          )}
        </div>
        <div className="lg:ml-auto flex items-center gap-2 text-sm text-slate-600">
          <CalendarRange className="h-4 w-4 text-slate-400" />
          <span><span className="font-semibold text-slate-800">{labelPeriode(value)}</span> · {formatTanggal(start)} s.d. {formatTanggal(end)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
