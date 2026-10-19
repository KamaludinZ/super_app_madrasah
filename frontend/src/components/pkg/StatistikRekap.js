import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from 'recharts';
import { Sigma, TrendingUp, TrendingDown, Equal } from 'lucide-react';
import { hitungStatistik } from '@/lib/pkgRekap';

// Satu seri (jumlah guru per predikat, kelas berurutan) -> satu warna; tervalidasi (dataviz validate_palette).
const WARNA_BATANG = '#006837';
const PERSEN = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const persen = (n) => (n == null ? '-' : `${PERSEN.format(n)}%`);

function KartuStatistik({ icon: Icon, label, value, keterangan }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-1 flex items-center justify-between text-slate-500">
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="text-2xl font-extrabold tabular-nums text-slate-900">{value}</div>
      {keterangan && <div className="mt-0.5 truncate text-xs text-slate-500" title={keterangan}>{keterangan}</div>}
    </div>
  );
}

function TooltipPredikat({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-semibold text-slate-900">{d.label} <span className="font-normal text-slate-500">({d.rentang})</span></div>
      <div className="text-slate-700 tabular-nums">{d.jumlah} guru · {persen(d.persen)}</div>
    </div>
  );
}

// Ringkasan statistik capaian (KPI row) + grafik batang distribusi predikat jenjang dari lembar terkunci.
export default function StatistikRekap({ guru = [] }) {
  const st = useMemo(() => hitungStatistik(guru), [guru]);

  return (
    <div className="space-y-4" data-testid="pkg-rekap-statistik">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KartuStatistik icon={Sigma} label="Rata-rata" value={persen(st.rata)} keterangan={`${st.jumlah} lembar terkunci`} />
        <KartuStatistik icon={Equal} label="Median" value={persen(st.median)} />
        <KartuStatistik icon={TrendingUp} label="Tertinggi" value={persen(st.tertinggi?.nilai)} keterangan={st.tertinggi?.nama} />
        <KartuStatistik icon={TrendingDown} label="Terendah" value={persen(st.terendah?.nilai)} keterangan={st.terendah?.nama} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Distribusi Predikat Jenjang</CardTitle>
          <p className="text-xs text-slate-500">Jumlah guru per predikat dari lembar yang sudah dikunci.</p>
        </CardHeader>
        <CardContent>
          {st.jumlah === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Belum ada lembar terkunci pada periode ini.</p>
          ) : (
            <>
              <div className="h-56" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={st.sebaranPredikat} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }} barCategoryGap="30%">
                    <CartesianGrid horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="label" width={96} tick={{ fontSize: 12, fill: '#334155' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<TooltipPredikat />} cursor={{ fill: '#f1f5f9' }} />
                    <Bar dataKey="jumlah" fill={WARNA_BATANG} maxBarSize={24} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                      <LabelList dataKey="jumlah" position="right" style={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <table className="sr-only">
                <caption>Distribusi predikat jenjang</caption>
                <thead><tr><th>Predikat</th><th>Rentang capaian</th><th>Jumlah guru</th><th>Persen</th></tr></thead>
                <tbody>
                  {st.sebaranPredikat.map((p) => (
                    <tr key={p.kunci}><td>{p.kunci}</td><td>{p.rentang}</td><td>{p.jumlah}</td><td>{persen(p.persen)}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
