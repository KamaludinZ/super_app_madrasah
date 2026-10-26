import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList,
} from 'recharts';
import { ArrowRight, BarChart3, ChevronLeft, ChevronRight, ClipboardList, Loader2, Table2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ASAL_CATAT, ASAL_INPUT, ASAL_PRESISI, daftarBulan, rekapAsalInput } from '@/lib/jurnalAsal';

const TINGGI_BARIS = 30;
const SERI = [ASAL_PRESISI, ASAL_CATAT];

function TooltipGuru({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-semibold text-slate-900">{d.teacher_name}</div>
      {SERI.map((k) => (
        <div key={k} className="flex items-center gap-2 text-slate-700">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: ASAL_INPUT[k].warna }} aria-hidden="true" />
          <span className="flex-1">{ASAL_INPUT[k].label}</span>
          <span className="font-semibold tabular-nums text-slate-900">{d[k]}</span>
        </div>
      ))}
      <div className="mt-1 flex justify-between border-t border-slate-100 pt-1 text-slate-600">
        <span>Total jurnal</span><span className="font-semibold tabular-nums text-slate-900">{d.total}</span>
      </div>
    </div>
  );
}

function Ringkasan({ total }) {
  const persen = (n) => (total.total ? Math.round((n / total.total) * 100) : 0);
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total jurnal</div>
        <div className="text-xl font-extrabold tabular-nums text-slate-900">{total.total}</div>
      </div>
      {SERI.map((k) => (
        <div key={k} className="rounded-lg border border-slate-200 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: ASAL_INPUT[k].warna }} aria-hidden="true" /> {ASAL_INPUT[k].label}
          </div>
          <div className="text-xl font-extrabold tabular-nums text-slate-900">
            {total[k]} <span className="text-xs font-medium text-slate-500">({persen(total[k])}%)</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Dashboard kepala madrasah: jumlah jurnal per guru per bulan, dibedakan warna menurut asal input
 * (Jurnal Presisi = tepat waktu, Catat Jurnal = diisi di luar jam). Bulan dapat dipilih mundur 12 bulan.
 * Data dari GET /admin/jurnal/asal-input (lib/jurnalAsal.rekapAsalInput).
 */
export default function GrafikAsalInputJurnal() {
  const bulanList = useMemo(() => daftarBulan(12), []);
  const [bulan, setBulan] = useState(bulanList[0].value);
  const [data, setData] = useState(null);
  const [galat, setGalat] = useState(null);
  const [tabel, setTabel] = useState(false);

  useEffect(() => {
    let batal = false;
    setData(null);
    setGalat(null);
    rekapAsalInput(bulan).then((d) => { if (!batal) setData(d); }).catch((e) => { if (!batal) setGalat(e.message); });
    return () => { batal = true; };
  }, [bulan]);

  const indeks = bulanList.findIndex((b) => b.value === bulan);
  const guru = (data?.guru || []).map((g) => ({ ...g, nama: g.teacher_name?.split(' ').slice(0, 3).join(' ') }));

  return (
    <Card data-testid="grafik-asal-input-jurnal">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-[#006837]" /> Pengisian Jurnal per Guru menurut Asal Input
          </CardTitle>
          <Link to="/admin/jurnal" className="flex items-center gap-1 text-xs font-semibold text-[#006837] hover:underline">
            Lihat Data Jurnal <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Bulan sebelumnya"
            disabled={indeks >= bulanList.length - 1} onClick={() => setBulan(bulanList[indeks + 1].value)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select value={bulan} onValueChange={setBulan}>
            <SelectTrigger className="h-9 w-44" aria-label="Pilih bulan" data-testid="grafik-asal-input-bulan"><SelectValue /></SelectTrigger>
            <SelectContent>
              {bulanList.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Bulan berikutnya"
            disabled={indeks <= 0} onClick={() => setBulan(bulanList[indeks - 1].value)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="ml-auto gap-1 text-xs" onClick={() => setTabel((t) => !t)} aria-pressed={tabel}>
            {tabel ? <BarChart3 className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />} {tabel ? 'Tampilkan grafik' : 'Tampilkan tabel'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-slate-500">
          Jurnal yang diisi guru sendiri pada bulan terpilih. <strong>Jurnal Presisi</strong> diisi tepat waktu lewat scan QR/token kelas;
          {' '}<strong>Catat Jurnal</strong> diisi di luar jam setelah pelajaran selesai. Monitoring publik menghitung keduanya sebagai jurnal terisi.
        </p>
        {galat ? (
          <p className="py-8 text-center text-sm text-rose-600" role="alert">{galat}</p>
        ) : !data ? (
          <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-[#006837]" /></div>
        ) : (
          <>
            <Ringkasan total={data.total} />
            {guru.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">Belum ada guru berjadwal atau jurnal pada {data.label}.</p>
            ) : tabel ? (
              <div className="max-h-[560px] overflow-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <caption className="sr-only">Jumlah jurnal per guru {data.label} menurut asal input</caption>
                  <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Guru</th>
                      {SERI.map((k) => <th key={k} className="px-3 py-2 text-right font-medium">{ASAL_INPUT[k].label}</th>)}
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {guru.map((g) => (
                      <tr key={g.teacher_id}>
                        <td className="px-3 py-1.5 text-slate-900">{g.teacher_name}</td>
                        {SERI.map((k) => <td key={k} className="px-3 py-1.5 text-right tabular-nums text-slate-700">{g[k]}</td>)}
                        <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-slate-900">{g.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="max-h-[560px] overflow-y-auto pr-1">
                <div style={{ height: Math.max(220, guru.length * TINGGI_BARIS + 60) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={guru} layout="vertical" margin={{ top: 4, right: 36, left: 8, bottom: 4 }} barCategoryGap={6}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" allowDecimals={false} fontSize={11} tick={{ fill: '#64748b' }} stroke="#cbd5e1" />
                      <YAxis type="category" dataKey="nama" width={150} fontSize={11} tick={{ fill: '#334155' }} stroke="#cbd5e1" interval={0} />
                      <Tooltip content={<TooltipGuru />} cursor={{ fill: 'rgba(0,104,55,0.06)' }} />
                      <Legend verticalAlign="top" height={28} iconType="square"
                        formatter={(v) => <span className="text-xs text-slate-700">{v}</span>} />
                      <Bar dataKey={ASAL_PRESISI} name={ASAL_INPUT[ASAL_PRESISI].label} stackId="asal" fill={ASAL_INPUT[ASAL_PRESISI].warna}
                        stroke="#ffffff" strokeWidth={2} maxBarSize={18} />
                      <Bar dataKey={ASAL_CATAT} name={ASAL_INPUT[ASAL_CATAT].label} stackId="asal" fill={ASAL_INPUT[ASAL_CATAT].warna}
                        stroke="#ffffff" strokeWidth={2} radius={[0, 4, 4, 0]} maxBarSize={18}>
                        <LabelList dataKey="total" position="right" fontSize={11} fill="#475569" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
