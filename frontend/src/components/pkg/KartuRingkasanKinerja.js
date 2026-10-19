import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, CheckCircle2, PencilLine, CircleDashed, Gauge } from 'lucide-react';

// Urutan & warna status dipakai bersama oleh kartu angka, bar sebaran, dan legenda.
const STATUS = [
  { key: 'selesai', label: 'Sudah Dinilai', keterangan: 'Terkirim & terkunci', icon: CheckCircle2, kartu: 'bg-emerald-50 border-emerald-200 text-emerald-700', bar: 'bg-emerald-500' },
  { key: 'sedang', label: 'Sedang Dinilai', keterangan: 'Masih draf', icon: PencilLine, kartu: 'bg-amber-50 border-amber-200 text-amber-700', bar: 'bg-amber-400' },
  { key: 'belum', label: 'Belum Dimulai', keterangan: 'Lembar belum dibuka', icon: CircleDashed, kartu: 'bg-rose-50 border-rose-200 text-rose-700', bar: 'bg-rose-300' },
];

const persen = (n, total) => (total ? Math.round((n / total) * 100) : 0);

function KartuAngka({ icon: Icon, label, value, color, subtitle, testid }) {
  return (
    <div className={`rounded-xl border p-4 ${color}`} data-testid={testid}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</span>
        <Icon className="h-4 w-4 opacity-80" />
      </div>
      <div className="text-2xl font-extrabold tabular-nums">{value}</div>
      {subtitle && <div className="text-[10px] mt-1 opacity-70">{subtitle}</div>}
    </div>
  );
}

// Ringkasan Kinerja Beranda PKG: jumlah guru yang sudah, sedang, dan belum dinilai pada periode berjalan.
// `ringkasan` = { total, selesai, sedang, belum } (kontrak rencana GET /pkg/beranda/ringkasan).
export default function KartuRingkasanKinerja({ ringkasan }) {
  const total = ringkasan?.total ?? 0;
  const capaian = persen(ringkasan?.selesai ?? 0, total);

  return (
    <Card data-testid="pkg-ringkasan">
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Gauge className="h-4 w-4 text-[#006837]" /> Ringkasan Kinerja
        </CardTitle>
        <span className="text-xs text-slate-500">Periode berjalan</span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KartuAngka icon={Users} label="Guru Dinilai" value={total} color="bg-slate-50 border-slate-200 text-slate-700" subtitle="Terdaftar di SK aktif" testid="pkg-ringkasan-total" />
          {STATUS.map((s) => (
            <KartuAngka
              key={s.key}
              icon={s.icon}
              label={s.label}
              value={ringkasan?.[s.key] ?? 0}
              color={s.kartu}
              subtitle={`${persen(ringkasan?.[s.key] ?? 0, total)}% · ${s.keterangan}`}
              testid={`pkg-ringkasan-${s.key}`}
            />
          ))}
        </div>

        {total === 0 ? (
          <p className="text-sm text-slate-500 text-center py-2">Belum ada guru yang dinilai pada periode ini.</p>
        ) : (
          <div className="space-y-2" data-testid="pkg-ringkasan-sebaran">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-slate-700">Penilaian tuntas</span>
              <span className="font-bold tabular-nums text-[#006837]">{capaian}%</span>
            </div>
            <div
              className="flex h-2.5 overflow-hidden rounded-full bg-slate-100"
              role="img"
              aria-label={STATUS.map((s) => `${s.label} ${ringkasan?.[s.key] ?? 0}`).join(', ')}
            >
              {STATUS.map((s) => (
                <div key={s.key} className={s.bar} style={{ width: `${((ringkasan?.[s.key] ?? 0) / total) * 100}%` }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
              {STATUS.map((s) => (
                <span key={s.key} className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${s.bar}`} />
                  {s.label} <span className="tabular-nums text-slate-500">{ringkasan?.[s.key] ?? 0}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
