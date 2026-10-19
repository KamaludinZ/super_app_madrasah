import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, Users, Lock, PencilLine, CircleDashed, Percent, Loader2, AlertTriangle, RotateCw } from 'lucide-react';
import PenjagaMenuPkg from '@/components/pkg/PenjagaMenuPkg';
import BadgeStatusPenilaian from '@/components/pkg/BadgeStatusPenilaian';
import RekapPerTim from '@/components/pkg/RekapPerTim';
import SaringanPeriodeRekap from '@/components/pkg/SaringanPeriodeRekap';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ambilRekap } from '@/lib/pkgRekap';

const CAKUPAN = {
  semua: 'Seluruh guru yang dinilai pada SK periode ini',
  penilai: 'Guru yang Anda nilai pada periode ini',
  pribadi: 'Hasil penilaian Anda (setelah dikunci)',
};

const PERSEN = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const persen = (n) => (n == null ? '-' : `${PERSEN.format(n)}%`);

function KartuAngka({ icon: Icon, label, value, color }) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</span>
        <Icon className="h-4 w-4 opacity-80" />
      </div>
      <div className="text-2xl font-extrabold tabular-nums">{value}</div>
    </div>
  );
}

function IsiHalamanRekap() {
  const [searchParams, setSearchParams] = useSearchParams();
  const periodeId = searchParams.get('periode') || undefined;
  const [rekap, setRekap] = useState(null);
  const [galat, setGalat] = useState(null);

  const muat = useCallback(async () => {
    setGalat(null);
    try {
      setRekap(await ambilRekap({ periodeId }));
    } catch (e) {
      setGalat(e);
    }
  }, [periodeId]);

  // Periode terpilih disimpan di URL (?periode=) agar tampilan rekap dapat dibagikan.
  const gantiPeriode = (id) => setSearchParams((sp) => { const baru = new URLSearchParams(sp); baru.set('periode', id); return baru; });

  useEffect(() => { muat(); }, [muat]);

  if (galat) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center" role="alert">
        <AlertTriangle className="h-8 w-8 text-amber-600" />
        <p className="text-sm text-slate-700">{galat.message || 'Gagal memuat rekap.'}</p>
        <Button variant="outline" size="sm" onClick={muat} className="gap-2"><RotateCw className="h-4 w-4" /> Coba lagi</Button>
      </div>
    );
  }
  if (!rekap) return <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>;

  const r = rekap.ringkasan;

  return (
    <div className="space-y-4" data-testid="pkg-rekap">
      <div>
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><BarChart3 className="h-5 w-5 text-[#006837]" /> Rekap Hasil Penilaian</h2>
        <p className="text-xs text-slate-500">{rekap.periode?.nama_periode} · {CAKUPAN[rekap.cakupan] || ''}</p>
      </div>

      <SaringanPeriodeRekap nilai={rekap.periode?.id} onUbah={gantiPeriode} />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3" data-testid="pkg-rekap-ringkasan">
        <KartuAngka icon={Users} label="Guru" value={r.total} color="bg-slate-50 border-slate-200 text-slate-700" />
        <KartuAngka icon={Lock} label="Terkunci" value={r.terkunci} color="bg-emerald-50 border-emerald-200 text-emerald-700" />
        <KartuAngka icon={PencilLine} label="Draf" value={r.draf} color="bg-amber-50 border-amber-200 text-amber-700" />
        <KartuAngka icon={CircleDashed} label="Belum" value={r.belum} color="bg-rose-50 border-rose-200 text-rose-700" />
        <KartuAngka icon={Percent} label="Rata-rata Capaian" value={persen(r.rata_capaian)} color="bg-sky-50 border-sky-200 text-sky-700" />
      </div>

      <Tabs defaultValue="guru">
        {rekap.cakupan !== 'pribadi' && (
          <TabsList>
            <TabsTrigger value="guru" data-testid="pkg-rekap-tab-guru">Per Guru</TabsTrigger>
            <TabsTrigger value="tim" data-testid="pkg-rekap-tab-tim">Per Tim Penilai</TabsTrigger>
          </TabsList>
        )}
        <TabsContent value="tim">
          <RekapPerTim guru={rekap.guru} nomorSk={rekap.sk?.nomor_sk} />
        </TabsContent>
        <TabsContent value="guru">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Nilai per Guru</CardTitle>
              <p className="text-xs text-slate-500">Nilai, capaian, dan predikat hanya untuk lembar yang sudah dikirim &amp; dikunci.</p>
            </CardHeader>
            <CardContent>
              {rekap.guru.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">Belum ada data penilaian pada periode ini.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Guru</TableHead>
                        <TableHead>Penilai</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Nilai</TableHead>
                        <TableHead className="text-right">Capaian</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Predikat</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rekap.guru.map((g) => (
                          <TableRow key={g.guru_id} data-testid={`pkg-rekap-${g.guru_id}`}>
                            <TableCell className="min-w-[180px]">
                              <Link to={`/pkg/rekap/${g.guru_id}`} className="font-medium text-slate-900 hover:text-[#006837] hover:underline">{g.nama}</Link>
                              <div className="text-xs text-slate-500">{g.mapel || '-'} · NIP {g.nip || '-'}</div>
                            </TableCell>
                            <TableCell className="text-sm text-slate-600 whitespace-nowrap">{g.penilai_nama || '-'}</TableCell>
                            <TableCell><BadgeStatusPenilaian status={g.status} /></TableCell>
                            <TableCell className="text-right tabular-nums">{g.nilai_akhir == null ? '-' : `${g.nilai_akhir}/${g.nilai_maks}`}</TableCell>
                            <TableCell className="text-right tabular-nums">{persen(g.capaian_persen)}</TableCell>
                            <TableCell className="whitespace-nowrap">{g.level_capaian || '-'}</TableCell>
                            <TableCell className="min-w-[200px] text-xs text-slate-600">{g.predikat || '-'}</TableCell>
                          </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Rekap hasil penilaian (anggota SK; cakupan data menurut peran ditentukan server): ringkasan status & rata-rata
// capaian serta nilai per guru. Data sementara dari lib/pkgRekap (tiruan).
export default function PkgRekapPage() {
  return (
    <PenjagaMenuPkg menuKey="rekap">
      <IsiHalamanRekap />
    </PenjagaMenuPkg>
  );
}
