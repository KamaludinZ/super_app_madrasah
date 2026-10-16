import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Database, Loader2, ThumbsDown, ThumbsUp, Users } from 'lucide-react';
import { toast } from 'sonner';
import { pesanGalatTatib } from '@/lib/aksesTatib';
import { formatPoin } from '@/components/tatib/RingkasanPoin';
import LabelAsalInput from '@/components/tatib/LabelAsalInput';
import FilterDataTatib from '@/components/tatib/FilterDataTatib';
import {
  FILTER_DATA_KOSONG, ambilDataTatib, pilihanFilterData, ringkasData, saringData, sebaranAsalInput,
} from '@/lib/dataTatib';

const formatTanggal = (tgl) => {
  if (!tgl) return '-';
  const d = new Date(`${tgl}T00:00:00`);
  return Number.isNaN(d.getTime()) ? tgl : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

function KartuRingkasan({ ikon: Ikon, label, nilai, sub, warna = 'text-slate-900' }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><Ikon className="h-3.5 w-3.5" /> {label}</p>
        <p className={`mt-1 text-2xl font-bold tabular-nums ${warna}`}>{nilai}</p>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// Data Tata Tertib (struktur baru): seluruh catatan poin dengan kategori, kode & jenis aturan, jalur, poin,
// asal input, dan keterangan. Cakupan data dibatasi server per peran.
const AdminTatibDataPage = () => {
  const [baris, setBaris] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(FILTER_DATA_KOSONG);

  useEffect(() => {
    ambilDataTatib()
      .then(setBaris)
      .catch((e) => toast.error(pesanGalatTatib(e, 'Gagal memuat data tata tertib')))
      .finally(() => setLoading(false));
  }, []);

  // Ringkasan & tabel mengikuti filter; pilihan jenis mengikuti kategori terpilih.
  const tersaring = useMemo(() => saringData(baris, filter), [baris, filter]);
  const pilihan = useMemo(() => pilihanFilterData(baris, filter.kategori), [baris, filter.kategori]);
  const ringkas = useMemo(() => ringkasData(tersaring), [tersaring]);
  const sebaran = useMemo(() => sebaranAsalInput(tersaring), [tersaring]);

  return (
    <div className="p-6 space-y-6" data-testid="tatib-data-page">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Database className="h-6 w-6" /> Data Tata Tertib</h1>
        <p className="text-sm text-slate-600">Seluruh pencatatan poin menurut kategori dan jenis aturan, beserta asal input dan keterangannya.</p>
      </div>

      <FilterDataTatib value={filter} onChange={setFilter} pilihan={pilihan} kosong={FILTER_DATA_KOSONG} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="data-ringkasan">
        <KartuRingkasan ikon={Database} label="Pencatatan" nilai={ringkas.jumlah} sub={`${ringkas.siswa} siswa`} />
        <KartuRingkasan ikon={ThumbsDown} label="Pelanggaran" nilai={ringkas.jumlah_pelanggaran} sub={`${formatPoin(ringkas.total_minus)} poin`} warna="text-red-700" />
        <KartuRingkasan ikon={ThumbsUp} label="Kebaikan" nilai={ringkas.jumlah_kebaikan} sub={`${formatPoin(ringkas.total_plus)} poin`} warna="text-emerald-700" />
        <KartuRingkasan ikon={Users} label="Saldo poin" nilai={formatPoin(ringkas.total_plus + ringkas.total_minus)} sub="kebaikan + pelanggaran" />
      </div>

      {!loading && tersaring.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="data-sebaran-asal">
          <span className="text-xs font-medium text-slate-500">Asal input:</span>
          {sebaran.map(({ asal, jumlah }) => (
            <span key={asal || 'belum'} className={`inline-flex items-center gap-1 ${jumlah ? '' : 'opacity-40'}`}>
              <LabelAsalInput asal={asal} /><span className="tabular-nums text-xs text-slate-600">{jumlah}</span>
            </span>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-8 text-slate-500"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat data...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Siswa</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Jenis Aturan</TableHead>
                    <TableHead className="text-right">Poin</TableHead>
                    <TableHead>Asal Input</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead>Pencatat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tersaring.map((b) => (
                    <TableRow key={b.id} data-testid={`data-${b.id}`}>
                      <TableCell className="whitespace-nowrap">{formatTanggal(b.tanggal)}</TableCell>
                      <TableCell>
                        <div className="font-medium whitespace-nowrap">{b.siswa_nama}</div>
                        <div className="text-xs text-slate-500">{b.siswa_nisn || b.siswa_nis || '-'}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{b.siswa_kelas || '-'}</TableCell>
                      <TableCell><Badge variant="outline" className="font-normal whitespace-nowrap">{b.kategori_nama}</Badge></TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-slate-500 mr-1">{b.kode_aturan}</span>{b.jenis_nama}
                      </TableCell>
                      <TableCell className={`text-right font-semibold tabular-nums ${b.poin < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatPoin(b.poin)}</TableCell>
                      <TableCell data-testid={`data-asal-${b.id}`}><LabelAsalInput asal={b.asal_input} /></TableCell>
                      <TableCell className="max-w-[16rem] text-sm text-slate-600"><span className="line-clamp-2">{b.keterangan || <span className="text-slate-300">-</span>}</span></TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{b.petugas_nama}</TableCell>
                    </TableRow>
                  ))}
                  {tersaring.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="py-8 text-center text-slate-500">
                        {baris.length ? 'Tidak ada pencatatan yang cocok dengan filter.' : 'Belum ada pencatatan tata tertib.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminTatibDataPage;
