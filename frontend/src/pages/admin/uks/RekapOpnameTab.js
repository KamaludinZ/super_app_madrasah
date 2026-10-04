import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowDownCircle, ArrowUpCircle, Loader2, Package, Pill, RefreshCw, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { labelPeriode, paramsPeriode } from './uksPeriode';

// Ubah baris opname dari server (/uks/laporan-baru/opname) ke bentuk tabel.
export const fromServerOpname = (rows, namaKey) => (rows || []).map((r) => ({
  id: r.id, [namaKey]: r.nama, satuan: r.satuan, stok_minimum: r.stok_minimum,
  awal: r.stok_awal, masuk: r.masuk, keluar: r.keluar, akhir: r.stok_akhir,
  status: r.status, stok_saat_ini: r.stok_saat_ini, tanggal_kadaluarsa_terdekat: r.tanggal_kadaluarsa_terdekat,
}));

const STATUS_CLS = {
  Aman: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Menipis: 'bg-rose-100 text-rose-700 border-rose-200',
  Habis: 'bg-slate-200 text-slate-700 border-slate-300',
};

function OpnameTable({ rows, namaKey, jenisLabel }) {
  const [search, setSearch] = useState('');
  const filtered = rows.filter((r) => !search || (r[namaKey] || '').toLowerCase().includes(search.toLowerCase()));
  const sum = (k) => filtered.reduce((n, r) => n + (r[k] || 0), 0);

  if (rows.length === 0) {
    return <div className="py-10 text-center text-slate-500">Belum ada data {jenisLabel} terdaftar.</div>;
  }
  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input placeholder={`Cari nama ${jenisLabel}...`} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">No</TableHead>
                  <TableHead>Nama {jenisLabel}</TableHead>
                  <TableHead>Satuan</TableHead>
                  <TableHead className="text-center">Stok Awal</TableHead>
                  <TableHead className="text-center">Masuk</TableHead>
                  <TableHead className="text-center">Keluar</TableHead>
                  <TableHead className="text-center">Stok Akhir</TableHead>
                  <TableHead className="text-center">Stok Min</TableHead>
                  <TableHead className="text-center" title="Stok tersisa di sistem saat ini (dari batch masuk)">Stok Sistem</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Kadaluarsa Terdekat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-slate-500">Tidak ada {jenisLabel} yang cocok.</TableCell></TableRow>
                ) : filtered.map((r, i) => (
                  <TableRow key={r.id} data-testid="opname-row">
                    <TableCell className="text-center font-mono text-slate-500">{i + 1}</TableCell>
                    <TableCell className="font-medium">{r[namaKey]}</TableCell>
                    <TableCell>{r.satuan || '-'}</TableCell>
                    <TableCell className="text-center font-mono">{r.awal}</TableCell>
                    <TableCell className="text-center font-mono text-emerald-700">{r.masuk ? `+${r.masuk}` : 0}</TableCell>
                    <TableCell className="text-center font-mono text-rose-700">{r.keluar ? `-${r.keluar}` : 0}</TableCell>
                    <TableCell className="text-center font-mono font-semibold">{r.akhir}</TableCell>
                    <TableCell className="text-center font-mono">{r.stok_minimum ?? 0}</TableCell>
                    <TableCell className="text-center font-mono text-slate-500">{r.stok_saat_ini ?? '-'}</TableCell>
                    <TableCell className="text-center"><Badge className={STATUS_CLS[r.status]}>{r.status}</Badge></TableCell>
                    <TableCell className="font-mono">{r.tanggal_kadaluarsa_terdekat || '-'}</TableCell>
                  </TableRow>
                ))}
                {filtered.length > 0 && (
                  <TableRow className="bg-slate-50 font-semibold">
                    <TableCell colSpan={3} className="text-right">Total</TableCell>
                    <TableCell className="text-center font-mono">{sum('awal')}</TableCell>
                    <TableCell className="text-center font-mono text-emerald-700">+{sum('masuk')}</TableCell>
                    <TableCell className="text-center font-mono text-rose-700">-{sum('keluar')}</TableCell>
                    <TableCell className="text-center font-mono">{sum('akhir')}</TableCell>
                    <TableCell colSpan={4} className="text-xs font-normal text-slate-500">Total lintas satuan hanya sebagai gambaran umum.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RekapOpnameTab({ periode, onExportData }) {
  const [jenis, setJenis] = useState('obat');
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!onExportData) return;
    if (loading || error || !raw) { onExportData(null); return; }
    const cols = (nama) => [
      { key: 'no', label: 'No' }, { key: nama, label: 'Nama' }, { key: 'satuan', label: 'Satuan' },
      { key: 'awal', label: 'Stok Awal' }, { key: 'masuk', label: 'Masuk' }, { key: 'keluar', label: 'Keluar' },
      { key: 'akhir', label: 'Stok Akhir' }, { key: 'stok_minimum', label: 'Stok Min' }, { key: 'stok_saat_ini', label: 'Stok Sistem' }, { key: 'status', label: 'Status' },
      { key: 'tanggal_kadaluarsa_terdekat', label: 'Kadaluarsa Terdekat' },
    ];
    const num = (rows) => rows.map((r, i) => ({ ...r, no: i + 1 }));
    onExportData([
      { title: `Rekap Opname Obat - ${labelPeriode(periode)}`, columns: cols('nama_obat'), rows: num(fromServerOpname(raw.obat?.items, 'nama_obat')) },
      { title: `Rekap Opname BMHP - ${labelPeriode(periode)}`, columns: cols('nama_bmhp'), rows: num(fromServerOpname(raw.bmhp?.items, 'nama_bmhp')) },
    ]);
  }, [raw, loading, error, periode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    api.get('/uks/laporan-baru/opname', { params: paramsPeriode(periode) })
      .then((res) => { if (!cancelled) setRaw(res.data); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [periode, reload]);

  if (loading) return <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>;
  if (error || !raw) {
    return (
      <Card><CardContent className="p-8 text-center space-y-3">
        <p className="text-slate-600">Rekap opname gagal dimuat.</p>
        <Button variant="outline" onClick={() => setReload((n) => n + 1)} className="gap-2"><RefreshCw className="h-4 w-4" /> Coba lagi</Button>
      </CardContent></Card>
    );
  }

  const obatRows = fromServerOpname(raw.obat?.items, 'nama_obat');
  const bmhpRows = fromServerOpname(raw.bmhp?.items, 'nama_bmhp');
  const totalTx = (rows) => ({ masuk: rows.reduce((n, r) => n + r.masuk, 0), keluar: rows.reduce((n, r) => n + r.keluar, 0) });
  const to = totalTx(obatRows);
  const tb = totalTx(bmhpRows);

  return (
    <div className="space-y-3" data-testid="rekap-opname-tab">
      <p className="text-sm text-slate-600">Rekap persediaan (opname) — <span className="font-semibold">{labelPeriode(periode)}</span></p>
      <Tabs value={jenis} onValueChange={setJenis}>
        <TabsList className="bg-white border border-slate-200">
          <TabsTrigger value="obat"><Pill className="h-4 w-4 mr-2" /> Obat <Badge variant="outline" className="ml-2">{obatRows.length}</Badge></TabsTrigger>
          <TabsTrigger value="bmhp"><Package className="h-4 w-4 mr-2" /> BMHP <Badge variant="outline" className="ml-2">{bmhpRows.length}</Badge></TabsTrigger>
        </TabsList>
        <TabsContent value="obat" className="mt-4 space-y-3">
          <div className="flex gap-4 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1"><ArrowDownCircle className="h-4 w-4 text-emerald-600" /> Masuk periode ini: <b>{to.masuk}</b></span>
            <span className="inline-flex items-center gap-1"><ArrowUpCircle className="h-4 w-4 text-rose-600" /> Keluar periode ini: <b>{to.keluar}</b></span>
          </div>
          <OpnameTable rows={obatRows} namaKey="nama_obat" jenisLabel="obat" />
        </TabsContent>
        <TabsContent value="bmhp" className="mt-4 space-y-3">
          <div className="flex gap-4 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1"><ArrowDownCircle className="h-4 w-4 text-emerald-600" /> Masuk periode ini: <b>{tb.masuk}</b></span>
            <span className="inline-flex items-center gap-1"><ArrowUpCircle className="h-4 w-4 text-rose-600" /> Keluar periode ini: <b>{tb.keluar}</b></span>
          </div>
          <OpnameTable rows={bmhpRows} namaKey="nama_bmhp" jenisLabel="BMHP" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
