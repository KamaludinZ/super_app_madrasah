import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronRight, ClipboardCheck, GraduationCap, Loader2, RefreshCw, Stethoscope, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { labelPeriode, paramsPeriode } from './uksPeriode';
import RincianDiagnosaModal from './RincianDiagnosaModal';

// Ubah respons server (/uks/laporan-baru/diagnosa) ke bentuk yang dipakai tabel.
export const fromServerRekap = (r) => ({
  rows: (r?.items || []).map((x) => ({
    id: x.diagnosa_id, nama: x.nama, kode: x.kode, utama: x.utama, jumlahPasien: x.jumlah_pasien,
    tambahan: x.tambahan, total: x.total, persen: x.persen,
  })),
  totalKunjungan: r?.ringkasan?.total_kunjungan || 0,
  denganDiagnosa: r?.ringkasan?.dengan_diagnosa || 0,
  tanpaDiagnosa: r?.ringkasan?.tanpa_diagnosa || 0,
  pasienUnik: r?.ringkasan?.pasien_unik || 0,
  pasienUnikTerdiagnosa: r?.ringkasan?.pasien_unik_terdiagnosa || 0,
});

function Stat({ icon: Icon, label, value, tone }) {
  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide opacity-80">{label} <Icon className="h-4 w-4 opacity-70" /></div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function RekapTable({ rekap, jenisLabel, pasienTipe, periode }) {
  const [selected, setSelected] = useState(null);
  if (rekap.totalKunjungan === 0) {
    return (
      <div className="py-10 text-center text-slate-500" data-testid="rekap-diagnosa-kosong">
        <ClipboardCheck className="h-10 w-10 mx-auto text-slate-300 mb-3" />
        <div className="font-medium">Tidak ada kunjungan {jenisLabel} pada periode ini.</div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={Stethoscope} label="Total Kunjungan" value={rekap.totalKunjungan} tone="bg-slate-50 border-slate-200 text-slate-700" />
        <Stat icon={ClipboardCheck} label="Dengan Diagnosa" value={rekap.denganDiagnosa} tone="bg-emerald-50 border-emerald-200 text-emerald-700" />
        <Stat icon={ClipboardCheck} label="Belum Didiagnosa" value={rekap.tanpaDiagnosa} tone="bg-amber-50 border-amber-200 text-amber-700" />
        <Stat icon={Users} label="Pasien Berbeda" value={rekap.pasienUnik} tone="bg-sky-50 border-sky-200 text-sky-700" />
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">No</TableHead>
                  <TableHead className="w-24">Kode</TableHead>
                  <TableHead>Penegakan Diagnosa</TableHead>
                  <TableHead className="text-center">Jumlah Kunjungan</TableHead>
                  <TableHead className="text-center">Jumlah Pasien</TableHead>
                  <TableHead className="text-center">Sebagai Tambahan</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">% dari Kunjungan Terdiagnosa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rekap.rows.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-500">Belum ada kunjungan yang memiliki diagnosa pada periode ini.</TableCell></TableRow>
                ) : rekap.rows.map((r, i) => (
                  <React.Fragment key={r.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => setSelected(r)}
                    data-testid="rekap-diagnosa-row"
                    title="Klik untuk melihat rincian kunjungan"
                  >
                    <TableCell className="text-center font-mono text-slate-500">{i + 1}</TableCell>
                    <TableCell className="font-mono">{r.kode || '-'}</TableCell>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-1">
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                        {r.nama || '(diagnosa terhapus)'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center font-mono">{r.utama}</TableCell>
                    <TableCell className="text-center font-mono">{r.jumlahPasien}</TableCell>
                    <TableCell className="text-center font-mono">{r.tambahan}</TableCell>
                    <TableCell className="text-center font-mono font-semibold">{r.total}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="h-2 w-20 rounded bg-slate-100 overflow-hidden"><div className="h-full bg-[#006837]" style={{ width: `${r.persen}%` }} /></div>
                        <span className="font-mono text-xs w-12 text-right">{r.persen}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  </React.Fragment>
                ))}
                {rekap.rows.length > 0 && (
                  <TableRow className="bg-slate-50 font-semibold">
                    <TableCell colSpan={3} className="text-right">Total kunjungan terdiagnosa</TableCell>
                    <TableCell className="text-center font-mono">{rekap.denganDiagnosa}</TableCell>
                    <TableCell className="text-center font-mono">{rekap.pasienUnikTerdiagnosa}</TableCell>
                    <TableCell className="text-center font-mono">{rekap.rows.reduce((n, r) => n + r.tambahan, 0)}</TableCell>
                    <TableCell className="text-center font-mono">{rekap.rows.reduce((n, r) => n + r.total, 0)}</TableCell>
                    <TableCell className="text-center font-mono text-xs">100%</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <p className="text-xs text-slate-500">Klik baris diagnosa untuk melihat rincian kunjungannya.</p>
      <RincianDiagnosaModal row={selected} jenisLabel={jenisLabel} pasienTipe={pasienTipe} periode={periode} onClose={() => setSelected(null)} />
    </div>
  );
}

export default function RekapDiagnosaTab({ periode, onExportData }) {
  const [jenis, setJenis] = useState('siswa');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);

  const buildExport = () => [['Siswa', fromServerRekap(data?.siswa)], ['GTK', fromServerRekap(data?.gtk)]].map(([label, r]) => ({
    title: `Rekap Penegakan Diagnosa - ${label} - ${labelPeriode(periode)}`,
    columns: [
      { key: 'no', label: 'No' }, { key: 'kode', label: 'Kode' }, { key: 'nama', label: 'Penegakan Diagnosa' },
      { key: 'utama', label: 'Jumlah Kunjungan' }, { key: 'jumlahPasien', label: 'Jumlah Pasien' },
      { key: 'tambahan', label: 'Sebagai Tambahan' }, { key: 'total', label: 'Total' }, { key: 'persen', label: '% Kunjungan Terdiagnosa' },
    ],
    rows: r.rows.map((x, i) => ({ ...x, no: i + 1, kode: x.kode || '-' })),
  }));

  useEffect(() => {
    if (onExportData) onExportData(loading || error || !data ? null : buildExport());
  }, [data, loading, error]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    api.get('/uks/laporan-baru/diagnosa', { params: paramsPeriode(periode) })
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [periode, reload]);

  if (loading) return <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>;
  if (error || !data) {
    return (
      <Card><CardContent className="p-8 text-center space-y-3">
        <p className="text-slate-600">Rekap diagnosa gagal dimuat.</p>
        <Button variant="outline" onClick={() => setReload((n) => n + 1)} className="gap-2"><RefreshCw className="h-4 w-4" /> Coba lagi</Button>
      </CardContent></Card>
    );
  }

  const rekapSiswa = fromServerRekap(data.siswa);
  const rekapGtk = fromServerRekap(data.gtk);

  return (
    <div className="space-y-3" data-testid="rekap-diagnosa-tab">
      <p className="text-sm text-slate-600">Rekap penegakan diagnosa per kunjungan — <span className="font-semibold">{labelPeriode(periode)}</span></p>
      <Tabs value={jenis} onValueChange={setJenis}>
        <TabsList className="bg-white border border-slate-200">
          <TabsTrigger value="siswa"><GraduationCap className="h-4 w-4 mr-2" /> Siswa <Badge variant="outline" className="ml-2">{rekapSiswa.totalKunjungan}</Badge></TabsTrigger>
          <TabsTrigger value="gtk"><Users className="h-4 w-4 mr-2" /> GTK <Badge variant="outline" className="ml-2">{rekapGtk.totalKunjungan}</Badge></TabsTrigger>
        </TabsList>
        <TabsContent value="siswa" className="mt-4"><RekapTable rekap={rekapSiswa} jenisLabel="siswa" pasienTipe="siswa" periode={periode} /></TabsContent>
        <TabsContent value="gtk" className="mt-4"><RekapTable rekap={rekapGtk} jenisLabel="GTK" pasienTipe="gtk" periode={periode} /></TabsContent>
      </Tabs>
    </div>
  );
}
