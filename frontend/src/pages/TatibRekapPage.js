import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, Loader2, AlertTriangle, ArrowUp, ArrowDown, ArrowUpDown, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { aksesTatib, halamanPoinTatib } from '@/lib/aksesTatib';
import RingkasanPoin, { formatPoin } from '@/components/tatib/RingkasanPoin';
import BannerModeLihat from '@/components/tatib/BannerModeLihat';
import FilterRekapTatib, { FILTER_REKAP_KOSONG } from '@/components/tatib/FilterRekapTatib';
import { ambilRekap, unduhRekap } from '@/lib/poinTatib';
import { Button } from '@/components/ui/button';

const KOLOM_KELAS = [
  { key: 'kelas', label: 'Kelas' },
  { key: 'jumlah_siswa', label: 'Siswa', kanan: true },
  { key: 'total_plus', label: 'Kebaikan', kanan: true },
  { key: 'total_minus', label: 'Pelanggaran', kanan: true },
  { key: 'saldo', label: 'Saldo', kanan: true },
  { key: 'siswa_perlu_perhatian', label: 'Perlu Perhatian', kanan: true },
];
const JUMLAHKAN = ['jumlah_siswa', 'total_plus', 'total_minus', 'saldo', 'siswa_perlu_perhatian'];

function DaftarTeratas({ judul, items, warna, testid }) {
  const maks = Math.max(1, ...items.map((p) => p.jumlah));
  return (
    <Card data-testid={testid}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{judul}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && <p className="text-sm text-slate-500">Belum ada data.</p>}
        {items.map((p) => (
          <div key={p.kode || p.nama} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate text-slate-800">{p.nama}</span>
              <span className="shrink-0 tabular-nums text-slate-500">{p.jumlah}×</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100">
              <div className={`h-1.5 rounded-full ${warna}`} style={{ width: `${(p.jumlah / maks) * 100}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// Rekap Pengawas: rekap poin tata tertib lintas kelas untuk pimpinan & pengelola tatib (read-only).
// Data dari GET /tatib/rekap; unduhan .xlsx dari GET /tatib/rekap/export (filter yang sama).
export default function TatibRekapPage() {
  const { activeRole } = useAuth();
  const akses = aksesTatib(activeRole);
  const bolehLihat = akses === 'lihat' || akses === 'input';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [urut, setUrut] = useState({ key: 'kelas', naik: true });
  const [filter, setFilter] = useState(FILTER_REKAP_KOSONG);
  const [memuatUlang, setMemuatUlang] = useState(false);
  const [mengunduh, setMengunduh] = useState(false);

  const unduh = async () => {
    if (!data || mengunduh) return;
    setMengunduh(true);
    const id = toast.loading('Menyiapkan berkas rekap...');
    try {
      const { blob, nama } = await unduhRekap(filter);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nama;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`Rekap diunduh: ${nama}`, { id });
    } catch (e) {
      toast.error(e?.response?.status === 403 ? 'Peran Anda tidak dapat mengunduh rekap ini.' : 'Gagal mengunduh rekap. Coba lagi.', { id });
    } finally {
      setMengunduh(false);
    }
  };

  const gantiUrut = (key) => setUrut((u) => (u.key === key ? { key, naik: !u.naik } : { key, naik: key === 'kelas' }));

  const kelasUrut = useMemo(() => {
    const daftar = [...(data?.per_kelas || [])];
    daftar.sort((a, b) => {
      const x = a[urut.key];
      const y = b[urut.key];
      const hasil = typeof x === 'string' ? x.localeCompare(y, 'id', { numeric: true }) : x - y;
      return urut.naik ? hasil : -hasil;
    });
    return daftar;
  }, [data, urut]);

  const total = useMemo(
    () => Object.fromEntries(JUMLAHKAN.map((k) => [k, (data?.per_kelas || []).reduce((n, r) => n + (r[k] || 0), 0)])),
    [data],
  );

  useEffect(() => {
    if (!bolehLihat) return;
    if (filter.start_date && filter.end_date && filter.start_date > filter.end_date) return;
    let batal = false;
    setMemuatUlang(true);
    ambilRekap(filter)
      .then((d) => { if (!batal) setData(d); })
      .catch((e) => toast.error(e?.response?.data?.detail || 'Gagal memuat rekap poin'))
      .finally(() => { if (!batal) { setLoading(false); setMemuatUlang(false); } });
    return () => { batal = true; };
  }, [bolehLihat, filter]);

  if (!bolehLihat) return <Navigate to={halamanPoinTatib(activeRole)} replace />;

  if (loading) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" />
        <p className="text-slate-500">Memuat rekap...</p>
      </div>
    );
  }

  if (!data) {
    return <p className="p-12 text-center text-sm text-slate-500">Rekap poin belum bisa dimuat. Coba muat ulang halaman.</p>;
  }

  const r = data.ringkasan;
  const urutSaldo = [...data.per_kelas].sort((a, b) => a.saldo - b.saldo);
  const papan = [
    { label: 'Total catatan', nilai: r.jumlah_kebaikan + r.jumlah_pelanggaran, ket: `${r.jumlah_kebaikan} kebaikan · ${r.jumlah_pelanggaran} pelanggaran` },
    { label: 'Siswa perlu perhatian', nilai: r.siswa_perlu_perhatian, ket: 'akumulasi pelanggaran tinggi', peringatan: r.siswa_perlu_perhatian > 0 },
    { label: 'Saldo kelas terendah', nilai: urutSaldo[0] ? formatPoin(urutSaldo[0].saldo) : '-', ket: urutSaldo[0] ? `Kelas ${urutSaldo[0].kelas}` : '' },
    { label: 'Saldo kelas tertinggi', nilai: urutSaldo.length ? formatPoin(urutSaldo[urutSaldo.length - 1].saldo) : '-', ket: urutSaldo.length ? `Kelas ${urutSaldo[urutSaldo.length - 1].kelas}` : '' },
  ];

  return (
    <div className="space-y-6" data-testid="tatib-rekap-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <BarChart3 className="h-3 w-3 mr-1" /> Tata Tertib
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Rekap Pengawas</h1>
        <p className="text-sm text-slate-600 mt-1">Rekap poin tata tertib — sebaran poin kebaikan dan pelanggaran lintas kelas</p>
      </div>
        <Button onClick={unduh} disabled={mengunduh || memuatUlang || !data.per_kelas.length} data-testid="rekap-unduh">
          {mengunduh ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          {mengunduh ? 'Menyiapkan...' : 'Unduh Rekap'}
        </Button>
      </div>

      <BannerModeLihat>Rekap ini hanya untuk dilihat — data dicatat lewat halaman Catat Poin Tatib.</BannerModeLihat>


      <FilterRekapTatib value={filter} onChange={setFilter} />
      {memuatUlang && (
        <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Memperbarui rekap...</p>
      )}

      <RingkasanPoin
        totalPlus={r.total_plus}
        totalMinus={r.total_minus}
        jumlahKebaikan={r.jumlah_kebaikan}
        jumlahPelanggaran={r.jumlah_pelanggaran}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="rekap-papan">
        {papan.map((t) => (
          <Card key={t.label} className={t.peringatan ? 'border-amber-300 bg-amber-50/60' : ''}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-slate-500">{t.label}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${t.peringatan ? 'text-amber-700' : 'text-slate-900'}`}>{t.nilai}</p>
              <p className="text-xs text-slate-500 truncate">{t.ket}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Per Kelas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {KOLOM_KELAS.map((k) => (
                      <TableHead key={k.key} className={k.kanan ? 'text-right' : ''}>
                        <button
                          type="button"
                          onClick={() => gantiUrut(k.key)}
                          className={`inline-flex items-center gap-1 font-medium hover:text-slate-900 ${k.kanan ? 'flex-row-reverse' : ''}`}
                          aria-sort={urut.key === k.key ? (urut.naik ? 'ascending' : 'descending') : 'none'}
                        >
                          {k.label}
                          {urut.key === k.key ? (urut.naik ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                        </button>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kelasUrut.map((k) => (
                    <TableRow key={k.kelas} data-testid={`rekap-kelas-${k.kelas}`}>
                      <TableCell className="font-semibold">{k.kelas}</TableCell>
                      <TableCell className="text-right tabular-nums">{k.jumlah_siswa}</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-700">
                        {formatPoin(k.total_plus)} <span className="text-xs text-slate-400">({k.jumlah_kebaikan})</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-red-700">
                        {formatPoin(k.total_minus)} <span className="text-xs text-slate-400">({k.jumlah_pelanggaran})</span>
                      </TableCell>
                      <TableCell className={`text-right font-bold tabular-nums ${k.saldo < 0 ? 'text-red-700' : 'text-slate-900'}`}>{formatPoin(k.saldo)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {k.siswa_perlu_perhatian > 0 ? (
                          <span className="inline-flex items-center gap-1 text-amber-700">
                            <AlertTriangle className="h-3.5 w-3.5" /> {k.siswa_perlu_perhatian}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-slate-50 font-semibold" data-testid="rekap-kelas-total">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right tabular-nums">{total.jumlah_siswa}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-700">{formatPoin(total.total_plus)}</TableCell>
                    <TableCell className="text-right tabular-nums text-red-700">{formatPoin(total.total_minus)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPoin(total.saldo)}</TableCell>
                    <TableCell className="text-right tabular-nums">{total.siswa_perlu_perhatian}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <DaftarTeratas judul="Kebaikan Terbanyak" items={data.teratas_kebaikan || []} warna="bg-emerald-500" testid="rekap-teratas-kebaikan" />
        <DaftarTeratas judul="Pelanggaran Terbanyak" items={data.teratas_pelanggaran || []} warna="bg-red-400" testid="rekap-teratas-pelanggaran" />
      </div>
    </div>
  );
}
