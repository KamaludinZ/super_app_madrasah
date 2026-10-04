import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, CalendarDays, Loader2, Plus, Ruler, Scale, Syringe } from 'lucide-react';

function formatTanggal(dateStr) {
  const m = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : (dateStr || '-');
}

// IMT = BB (kg) / (TB (m))^2. Kategori dewasa Kemenkes hanya sebagai acuan umum;
// untuk remaja penilaian resmi memakai IMT/U, jadi label ini bersifat indikatif.
export const hitungImt = (tb, bb) => {
  const t = Number(tb);
  const b = Number(bb);
  if (!t || !b) return null;
  return Math.round((b / ((t / 100) ** 2)) * 10) / 10;
};

const kategoriImt = (imt) => {
  if (imt == null) return null;
  if (imt < 18.5) return { label: 'Kurus', className: 'bg-amber-100 text-amber-700 border-amber-200' };
  if (imt < 25) return { label: 'Normal', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  if (imt < 27) return { label: 'Gemuk', className: 'bg-orange-100 text-orange-700 border-orange-200' };
  return { label: 'Obesitas', className: 'bg-rose-100 text-rose-700 border-rose-200' };
};

const selisih = (now, prev, unit) => {
  if (now == null || prev == null || now === '' || prev === '') return null;
  const d = Math.round((Number(now) - Number(prev)) * 10) / 10;
  if (Number.isNaN(d)) return null;
  return `${d > 0 ? '+' : ''}${d} ${unit}`;
};

function Stat({ icon: Icon, label, value, hint, tone }) {
  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide opacity-80">
        {label} <Icon className="h-4 w-4 opacity-70" />
      </div>
      <div className="mt-1 text-lg font-bold">{value}</div>
      {hint && <div className="text-xs opacity-80">{hint}</div>}
    </div>
  );
}

/**
 * Isi tab "Riwayat CKG" pada halaman Riwayat UKS siswa. `items` diurutkan
 * terbaru ke terlama; ringkasan membandingkan pemeriksaan terakhir dengan sebelumnya.
 */
export default function RiwayatCkgTab({ items, loading, canManage = false }) {
  const list = items || [];

  if (loading) {
    return <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>;
  }

  if (list.length === 0) {
    return (
      <div className="py-10 text-center text-slate-500" data-testid="riwayat-ckg-kosong">
        <Syringe className="h-10 w-10 mx-auto text-slate-300 mb-3" />
        <div className="font-medium">Belum ada data pemeriksaan CKG untuk siswa ini.</div>
        <div className="text-xs mt-1">Hasil Cek Kesehatan Gratis (tinggi/berat badan, tensi, mata, gigi) akan tampil di sini setelah diinput petugas UKS.</div>
        {canManage && (
          <Button asChild size="sm" className="mt-4 gap-2 bg-[#006837] hover:bg-[#005830]">
            <Link to="/admin/uks/ckg"><Plus className="h-4 w-4" /> Input Data CKG</Link>
          </Button>
        )}
      </div>
    );
  }

  const last = list[0];
  const prev = list[1];
  const imtLast = hitungImt(last.tinggi_badan, last.berat_badan);
  const katLast = kategoriImt(imtLast);

  return (
    <div className="space-y-4" data-testid="riwayat-ckg-tab">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={CalendarDays} label="Pemeriksaan Terakhir" value={formatTanggal(last.tanggal)} hint={`${list.length} kali pemeriksaan`} tone="bg-slate-50 border-slate-200 text-slate-700" />
        <Stat icon={Ruler} label="Tinggi Badan" value={last.tinggi_badan != null ? `${last.tinggi_badan} cm` : '-'} hint={prev ? selisih(last.tinggi_badan, prev.tinggi_badan, 'cm') && `${selisih(last.tinggi_badan, prev.tinggi_badan, 'cm')} dari sebelumnya` : null} tone="bg-sky-50 border-sky-200 text-sky-700" />
        <Stat icon={Scale} label="Berat Badan" value={last.berat_badan != null ? `${last.berat_badan} kg` : '-'} hint={prev ? selisih(last.berat_badan, prev.berat_badan, 'kg') && `${selisih(last.berat_badan, prev.berat_badan, 'kg')} dari sebelumnya` : null} tone="bg-violet-50 border-violet-200 text-violet-700" />
        <Stat icon={Activity} label="IMT" value={imtLast != null ? imtLast : '-'} hint={katLast ? `${katLast.label} (indikatif)` : null} tone="bg-emerald-50 border-emerald-200 text-emerald-700" />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-center">TB (cm)</TableHead>
                  <TableHead className="text-center">BB (kg)</TableHead>
                  <TableHead className="text-center">IMT</TableHead>
                  <TableHead className="text-center">Tensi</TableHead>
                  <TableHead className="text-center">Nadi</TableHead>
                  <TableHead className="text-center">Suhu (°C)</TableHead>
                  <TableHead className="text-center">SpO2 (%)</TableHead>
                  <TableHead>Mata</TableHead>
                  <TableHead>Gigi</TableHead>
                  <TableHead>Kesimpulan / Rekomendasi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((c) => {
                  const imt = hitungImt(c.tinggi_badan, c.berat_badan);
                  const kat = kategoriImt(imt);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono whitespace-nowrap">{formatTanggal(c.tanggal)}</TableCell>
                      <TableCell className="text-center font-mono">{c.tinggi_badan ?? '-'}</TableCell>
                      <TableCell className="text-center font-mono">{c.berat_badan ?? '-'}</TableCell>
                      <TableCell className="text-center">
                        {imt != null ? <><span className="font-mono">{imt}</span>{kat && <div><Badge className={`${kat.className} text-[10px]`}>{kat.label}</Badge></div>}</> : '-'}
                      </TableCell>
                      <TableCell className="text-center font-mono">{c.tekanan_darah || '-'}</TableCell>
                      <TableCell className="text-center font-mono">{c.nadi ?? '-'}</TableCell>
                      <TableCell className="text-center font-mono">{c.suhu ?? '-'}</TableCell>
                      <TableCell className="text-center font-mono">{c.spo2 ?? '-'}</TableCell>
                      <TableCell className="max-w-[10rem]"><div className="line-clamp-2">{c.pemeriksaan_mata || '-'}</div></TableCell>
                      <TableCell className="max-w-[10rem]"><div className="line-clamp-2">{c.pemeriksaan_gigi || '-'}</div></TableCell>
                      <TableCell className="max-w-xs">
                        <div className="line-clamp-2">{c.kesimpulan || '-'}</div>
                        {c.rekomendasi && <div className="text-xs text-slate-500 line-clamp-2">Rekomendasi: {c.rekomendasi}</div>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <p className="text-xs text-slate-500">IMT dihitung dari TB dan BB. Kategori bersifat indikatif; penilaian status gizi remaja yang resmi memakai IMT menurut umur (IMT/U).</p>
    </div>
  );
}
