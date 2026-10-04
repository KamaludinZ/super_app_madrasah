import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { labelPeriode, paramsPeriode } from './uksPeriode';

function formatTanggal(d) {
  const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : (d || '-');
}

const penangananRingkas = (k) => [
  (k.jenis_penanganan_nama || []).join(', '),
  k.penanganan,
].filter(Boolean).join(' — ');

/**
 * Modal rincian kunjungan untuk satu baris rekap diagnosa. Daftar kunjungan dimuat
 * dari GET /uks/laporan-baru/diagnosa/{id}/kunjungan saat modal dibuka.
 */
export default function RincianDiagnosaModal({ row, jenisLabel, pasienTipe, periode, onClose }) {
  const [search, setSearch] = useState('');
  const [peran, setPeran] = useState('semua');

  const [kunjungan, setKunjungan] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const periodeLabel = labelPeriode(periode);

  useEffect(() => {
    setSearch(''); setPeran('semua'); setKunjungan([]); setError(false);
    if (!row?.id) return undefined;
    let cancelled = false;
    setLoading(true);
    api.get(`/uks/laporan-baru/diagnosa/${encodeURIComponent(row.id)}/kunjungan`, { params: { ...paramsPeriode(periode), pasien_tipe: pasienTipe } })
      .then((res) => { if (!cancelled) setKunjungan(res.data?.items || []); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [row?.id, pasienTipe, periode]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = kunjungan
    .filter((k) => peran === 'semua' || k.peran === peran)
    .filter((k) => {
      const q = search.trim().toLowerCase();
      return !q || (k.pasien_nama || '').toLowerCase().includes(q) || (k.keluhan || '').toLowerCase().includes(q) || (k.pasien_kelas || '').toLowerCase().includes(q);
    });
  const nUtama = kunjungan.filter((k) => k.peran === 'utama').length;
  const nTambahan = kunjungan.length - nUtama;

  return (
    <Dialog open={!!row} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col" data-testid="rincian-diagnosa-modal">
        <DialogHeader>
          <DialogTitle>
            Rincian Kunjungan — {row?.nama || '(diagnosa terhapus)'}{row?.kode ? <span className="ml-2 font-mono text-sm text-slate-500">{row.kode}</span> : null}
          </DialogTitle>
          <DialogDescription>
            Pasien {jenisLabel} · {periodeLabel} · {nUtama} sebagai diagnosa utama, {nTambahan} sebagai diagnosa tambahan
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder={`Cari nama pasien, keluhan${jenisLabel === 'siswa' ? ', atau kelas' : ''}...`} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 self-start">
            {[['semua', 'Semua'], ['utama', `Utama (${nUtama})`], ['tambahan', `Tambahan (${nTambahan})`]].map(([v, l]) => (
              <button key={v} type="button" onClick={() => setPeran(v)} aria-pressed={peran === v}
                className={`px-3 py-1.5 text-sm rounded ${peran === v ? 'bg-[#006837] text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{l}</button>
            ))}
          </div>
        </div>

        <div className="overflow-auto border border-slate-200 rounded-md flex-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-center">No</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Pasien</TableHead>
                <TableHead>{jenisLabel === 'siswa' ? 'Kelas' : 'NIP/NUPTK'}</TableHead>
                <TableHead>Keluhan</TableHead>
                <TableHead>Penanganan</TableHead>
                <TableHead>Kondisi Pulang</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-[#006837]" /></TableCell></TableRow>
              ) : error ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-rose-600">Rincian kunjungan gagal dimuat.</TableCell></TableRow>
              ) : list.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-slate-500">Tidak ada kunjungan yang cocok.</TableCell></TableRow>
              ) : list.map((k, i) => (
                <TableRow key={`${k.id}-${k.peran}`}>
                  <TableCell className="text-center font-mono text-slate-500">{i + 1}</TableCell>
                  <TableCell className="font-mono whitespace-nowrap">{formatTanggal(k.tanggal)}{k.waktu ? <div className="text-xs text-slate-500">{k.waktu}</div> : null}</TableCell>
                  <TableCell className="font-medium">
                    {k.pasien_nama}
                    {k.peran === 'tambahan' && <div><Badge variant="outline" className="text-[10px]">diagnosa tambahan</Badge></div>}
                  </TableCell>
                  <TableCell>{jenisLabel === 'siswa' ? (k.pasien_kelas || '-') : (k.pasien_identitas || '-')}</TableCell>
                  <TableCell className="max-w-[14rem]"><div className="line-clamp-2">{k.keluhan || '-'}</div></TableCell>
                  <TableCell className="max-w-[14rem]"><div className="line-clamp-2">{penangananRingkas(k) || '-'}</div></TableCell>
                  <TableCell>{k.kondisi_pulang || '-'}</TableCell>
                  <TableCell>
                    <Badge className={k.status === 'Sudah Ditangani' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'}>{k.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-slate-500">Menampilkan {list.length} dari {kunjungan.length} kunjungan.</p>
      </DialogContent>
    </Dialog>
  );
}
