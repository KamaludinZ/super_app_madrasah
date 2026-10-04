import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarDays, CheckCircle2, History, Loader2, Plus, Stethoscope } from 'lucide-react';
import { pemakaianRingkas, penangananRingkas } from './RiwayatKunjunganPanel';

const STATUS_BADGE = {
  'Belum Ditangani': 'bg-amber-100 text-amber-700 border-amber-200',
  'Sudah Ditangani': 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

function formatTanggal(dateStr) {
  const m = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : (dateStr || '-');
}

function Stat({ icon: Icon, label, value, tone }) {
  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide opacity-80">
        {label} <Icon className="h-4 w-4 opacity-70" />
      </div>
      <div className="mt-1 text-lg font-bold truncate" title={typeof value === 'string' ? value : undefined}>{value}</div>
    </div>
  );
}

/**
 * Isi tab "Riwayat Kunjungan" pada halaman Riwayat UKS siswa: ringkasan,
 * filter tahun & status, dan tabel seluruh kunjungan (sudah urut terbaru).
 */
export default function RiwayatKunjunganTab({ items, loading, canManage = false }) {
  const [tahun, setTahun] = useState('semua');
  const [status, setStatus] = useState('semua');
  const list = items || [];

  const tahunOptions = [...new Set(list.map((k) => (k.tanggal || '').slice(0, 4)).filter(Boolean))].sort().reverse();

  const filtered = list
    .filter((k) => tahun === 'semua' || (k.tanggal || '').startsWith(tahun))
    .filter((k) => status === 'semua' || k.status === status);

  const diagnosaTerbanyak = (() => {
    const counts = {};
    filtered.forEach((k) => { if (k.diagnosa_utama_nama) counts[k.diagnosa_utama_nama] = (counts[k.diagnosa_utama_nama] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? `${top[0]} (${top[1]}×)` : '-';
  })();

  if (loading) {
    return <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>;
  }

  if (list.length === 0) {
    return (
      <div className="py-10 text-center text-slate-500" data-testid="riwayat-kunjungan-kosong">
        <History className="h-10 w-10 mx-auto text-slate-300 mb-3" />
        <div className="font-medium">Siswa ini belum pernah berkunjung ke UKS.</div>
        <div className="text-xs mt-1">Setiap kunjungan yang dicatat petugas UKS akan muncul di sini beserta diagnosa dan penanganannya.</div>
        {canManage && (
          <Button asChild size="sm" className="mt-4 gap-2 bg-[#006837] hover:bg-[#005830]">
            <Link to="/admin/uks/kunjungan"><Plus className="h-4 w-4" /> Catat Kunjungan</Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="riwayat-kunjungan-tab">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={Stethoscope} label="Total Kunjungan" value={filtered.length} tone="bg-slate-50 border-slate-200 text-slate-700" />
        <Stat icon={CheckCircle2} label="Sudah Ditangani" value={filtered.filter((k) => k.status === 'Sudah Ditangani').length} tone="bg-emerald-50 border-emerald-200 text-emerald-700" />
        <Stat icon={History} label="Diagnosa Terbanyak" value={diagnosaTerbanyak} tone="bg-sky-50 border-sky-200 text-sky-700" />
        <Stat icon={CalendarDays} label="Kunjungan Terakhir" value={filtered[0] ? formatTanggal(filtered[0].tanggal) : '-'} tone="bg-amber-50 border-amber-200 text-amber-700" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={tahun} onValueChange={setTahun}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua Tahun</SelectItem>
            {tahunOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua Status</SelectItem>
            <SelectItem value="Sudah Ditangani">Sudah Ditangani</SelectItem>
            <SelectItem value="Belum Ditangani">Belum Ditangani</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Keluhan</TableHead>
                  <TableHead>Diagnosa</TableHead>
                  <TableHead>Penanganan</TableHead>
                  <TableHead>Obat / BMHP</TableHead>
                  <TableHead>Kondisi Pulang</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Petugas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-10 text-slate-500" data-testid="riwayat-kunjungan-filter-kosong">
                    Tidak ada kunjungan {status !== 'semua' ? `berstatus "${status}" ` : ''}{tahun !== 'semua' ? `pada tahun ${tahun}` : ''}.
                    <button type="button" className="ml-1 font-medium text-[#006837] underline underline-offset-2" onClick={() => { setTahun('semua'); setStatus('semua'); }}>Tampilkan semua</button>
                  </TableCell></TableRow>
                ) : (
                  filtered.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="font-mono whitespace-nowrap">{formatTanggal(k.tanggal)}{k.waktu ? <div className="text-xs text-slate-500">{k.waktu}</div> : null}</TableCell>
                      <TableCell className="max-w-xs"><div className="line-clamp-2">{k.keluhan || '-'}</div></TableCell>
                      <TableCell className="max-w-[14rem]">
                        {k.diagnosa_utama_nama
                          ? <><div className="font-medium">{k.diagnosa_utama_nama}</div>{k.diagnosa_tambahan_nama?.length > 0 && <div className="text-xs text-slate-500">+ {k.diagnosa_tambahan_nama.join(', ')}</div>}</>
                          : <span className="text-xs text-slate-400">-</span>}
                      </TableCell>
                      <TableCell className="max-w-xs"><div className="line-clamp-2">{penangananRingkas(k) || '-'}</div></TableCell>
                      <TableCell className="max-w-[14rem] text-xs text-slate-600"><div className="line-clamp-2">{pemakaianRingkas(k) || '-'}</div></TableCell>
                      <TableCell>{k.kondisi_pulang || '-'}{k.dirujuk_ke ? <div className="text-xs text-slate-500">{k.dirujuk_ke}</div> : null}</TableCell>
                      <TableCell><Badge className={STATUS_BADGE[k.status] || ''}>{k.status}</Badge></TableCell>
                      <TableCell className="text-sm">{k.ditangani_oleh || k.petugas_nama || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
