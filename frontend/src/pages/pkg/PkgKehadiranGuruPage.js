import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, CalendarCheck, Loader2, Save, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import PenjagaMenuPkg from '@/components/pkg/PenjagaMenuPkg';
import { formatWIBPanjang } from '@/lib/datetime';
import { KOLOM_INPUT, MENIT_PER_HARI, PEMBAGI_HARI, ambilKehadiranGuru, hitungBulan, hitungIndeks, simpanKehadiran } from '@/lib/pkgKehadiran';

const ANGKA = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
const PERSEN = new Intl.NumberFormat('id-ID', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });

function IsiKehadiranGuru() {
  const { guruId } = useParams();
  const [searchParams] = useSearchParams();
  const periodeId = searchParams.get('periode') || undefined;
  const [data, setData] = useState(null);
  const [bulan, setBulan] = useState([]);
  const [menyimpan, setMenyimpan] = useState(false);
  const [ubah, setUbah] = useState(false);

  const muat = useCallback(async () => {
    try {
      const d = await ambilKehadiranGuru(guruId, periodeId);
      setData(d);
      setBulan(d.bulan);
      setUbah(false);
    } catch (e) {
      setData({ galat: e.message });
    }
  }, [guruId, periodeId]);
  useEffect(() => { muat(); }, [muat]);

  const kembali = periodeId ? `/pkg/komponen?periode=${periodeId}&tab=kehadiran` : '/pkg/komponen?tab=kehadiran';
  if (!data) return <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>;
  if (data.galat) return <p className="py-12 text-center text-sm text-slate-600" role="alert">{data.galat}</p>;

  const bolehUbah = data.periode?.status === 'berjalan';
  const atur = (i, kunci, nilai) => {
    const bersih = nilai === '' ? '' : Math.max(0, Math.floor(Number(nilai) || 0));
    setBulan((bs) => bs.map((b, k) => (k === i ? { ...b, [kunci]: bersih } : b)));
    setUbah(true);
  };
  const { tidakHadir, indeks } = hitungIndeks(bulan);
  const jumlah = (kunci) => bulan.reduce((a, b) => a + (Number(b[kunci]) || 0), 0);
  const simpan = async () => {
    setMenyimpan(true);
    try {
      await simpanKehadiran(guruId, { periodeId: data.periode.id, bulan });
      toast.success('Rekap kehadiran disimpan');
      await muat();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="pkg-kehadiran-guru">
      <Link to={kembali} className="inline-flex items-center gap-1 text-sm text-[#006837] hover:underline"><ArrowLeft className="h-4 w-4" /> Komponen 360° &amp; Kehadiran</Link>
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[#006837]"><UserRound className="h-6 w-6" /></div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-slate-900">{data.guru?.nama}</h2>
          <p className="text-xs text-slate-500">NIP {data.guru?.nip || '-'} · {data.periode?.nama_periode} · Rekapitulasi kehadiran (INDEK-HDIR)</p>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Indeks kehadiran</div>
          <div className="text-2xl font-bold tabular-nums text-[#006837]" data-testid="pkg-indeks-kehadiran">{PERSEN.format(indeks)}</div>
        </div>
      </div>
      {!bolehUbah && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Periode tidak sedang berjalan; rekap kehadiran hanya dapat dilihat.</p>}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><CalendarCheck className="h-4 w-4 text-[#006837]" /> Rekap per Bulan</CardTitle>
          <p className="text-xs text-slate-500">
            Konversi = (terlambat + pulang cepat) / {MENIT_PER_HARI} menit; tidak hadir = konversi + tanpa keterangan; indeks = 1 − total tidak hadir / {PEMBAGI_HARI}.
            Hadir, izin, dan sakit dicatat sebagai informasi (tidak masuk rumus template).
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-1.5 pr-2 font-medium">Bulan</th>
                {KOLOM_INPUT.map((k) => (
                  <th key={k.kunci} className={`px-1 py-1.5 text-center font-medium ${k.rumus ? '' : 'text-slate-400'}`}>{k.label}<div className="font-normal">({k.satuan})</div></th>
                ))}
                <th className="px-1 py-1.5 text-right font-medium">Konversi<div className="font-normal">(hari)</div></th>
                <th className="px-1 py-1.5 text-right font-medium">Tidak hadir<div className="font-normal">(hari)</div></th>
                <th className="pl-1 py-1.5 text-right font-medium">Hadir</th>
              </tr>
            </thead>
            <tbody>
              {bulan.map((b, i) => {
                const h = hitungBulan(b);
                return (
                  <tr key={b.bulan} className="border-b border-slate-100" data-testid={`pkg-kehadiran-${b.bulan}`}>
                    <td className="whitespace-nowrap py-1 pr-2 text-slate-800">{b.label}</td>
                    {KOLOM_INPUT.map((k) => (
                      <td key={k.kunci} className="px-1 py-1">
                        <Input type="number" inputMode="numeric" min={0} max={k.maks} value={b[k.kunci]} disabled={!bolehUbah}
                          onChange={(e) => atur(i, k.kunci, e.target.value)} aria-label={`${k.label} ${b.label}`}
                          className="h-8 w-20 text-right tabular-nums" />
                      </td>
                    ))}
                    <td className="px-1 py-1 text-right tabular-nums">{ANGKA.format(h.konversi)}</td>
                    <td className="px-1 py-1 text-right tabular-nums">{ANGKA.format(h.tidakHadir)}</td>
                    <td className="pl-1 py-1 text-right tabular-nums">{PERSEN.format(h.persenHadir)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-semibold">
                <td className="py-2 pr-2">Jumlah</td>
                {KOLOM_INPUT.map((k) => <td key={k.kunci} className="px-1 py-2 text-right tabular-nums">{ANGKA.format(jumlah(k.kunci))}</td>)}
                <td className="px-1 py-2 text-right tabular-nums">{ANGKA.format(bulan.reduce((a, b) => a + hitungBulan(b).konversi, 0))}</td>
                <td className="px-1 py-2 text-right tabular-nums">{ANGKA.format(tidakHadir)}</td>
                <td className="pl-1 py-2 text-right tabular-nums text-[#006837]">{PERSEN.format(indeks)}</td>
              </tr>
            </tfoot>
          </table>
          {bulan.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Tanggal buka/tutup periode belum lengkap.</p>}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <span className="text-xs text-slate-500 sm:mr-auto">
              {data.terisi ? `Terakhir disimpan ${data.diinput_oleh_nama || '-'} · ${data.diubah_pada ? formatWIBPanjang(data.diubah_pada) : '-'}` : 'Belum pernah diinput — tanpa data, indeks kehadiran dihitung 100%.'}
            </span>
            {bolehUbah && (
              <Button onClick={simpan} disabled={menyimpan || (!ubah && data.terisi)} className="gap-1 bg-[#006837] hover:bg-[#005830]" data-testid="pkg-simpan-kehadiran">
                {menyimpan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan rekap
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Input rekap kehadiran manual satu guru per bulan periode (kepala & tim penilai), format sheet INDEK-HDIR
// (lib/pkgKehadiran -> /pkg/kehadiran/{id}).
export default function PkgKehadiranGuruPage() {
  return (
    <PenjagaMenuPkg menuKey="komponen">
      <IsiKehadiranGuru />
    </PenjagaMenuPkg>
  );
}
