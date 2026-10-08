import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldCheck, Loader2, Search, ChevronRight, Users, Scale, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { aksesTatib, halamanPoinTatib } from '@/lib/aksesTatib';
import RingkasanPoin, { formatPoin, rangkumPoin, BATAS_MINUS_PERHATIAN } from '@/components/tatib/RingkasanPoin';
import PanelPoinSiswa from '@/components/tatib/PanelPoinSiswa';
import RincianPoinDialog from '@/components/tatib/RincianPoinDialog';
import { bandingTerbaru, formatTanggalPoin } from '@/components/tatib/RiwayatPoin';
import BannerModeLihat from '@/components/tatib/BannerModeLihat';
import { ambilSiswaWaliKelas, ambilCatatanKelas } from '@/lib/poinTatib';

// Pantauan Walikelas: poin tata tertib siswa di kelas yang diampu (read-only).
// Ringkasan kelas di atas, daftar siswa di bawah; klik siswa -> saldo & riwayatnya.
// Siswa + rangkuman poin dari /tatib/walikelas/siswa, catatan dari /tatib/penanganan
// (server membatasi keduanya ke kelas yang diampu).
const URUTAN = {
  nama: { label: 'Nama (A–Z)', banding: (a, b) => (a.siswa.full_name || '').localeCompare(b.siswa.full_name || '') },
  saldo: { label: 'Saldo terendah', banding: (a, b) => a.saldo - b.saldo },
  pelanggaran: { label: 'Pelanggaran terbanyak', banding: (a, b) => a.totalMinus - b.totalMinus || b.jumlahPelanggaran - a.jumlahPelanggaran },
};

// Total plus & minus satu siswa: angka + jumlah catatan + bar perbandingan.
function SelPoin({ nilai, jumlah, warna }) {
  return (
    <span className={`tabular-nums ${warna}`}>
      {formatPoin(nilai)} <span className="text-xs text-slate-400">({jumlah})</span>
    </span>
  );
}

function BarPlusMinus({ plus, minus }) {
  const besar = plus + Math.abs(minus);
  if (!besar) return <div className="h-1.5 w-24 rounded-full bg-slate-100" />;
  return (
    <div className="flex h-1.5 w-24 overflow-hidden rounded-full bg-red-300" aria-hidden>
      <div className="bg-emerald-500" style={{ width: `${(plus / besar) * 100}%` }} />
    </div>
  );
}

export default function WaliKelasPoinTatibPage() {
  const { activeRole } = useAuth();
  const khususWali = aksesTatib(activeRole) === 'kelas';
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState([]);
  const [batas, setBatas] = useState(BATAS_MINUS_PERHATIAN);
  const [kelas, setKelas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cari, setCari] = useState('');
  const [urut, setUrut] = useState('nama');
  const [hanyaPerhatian, setHanyaPerhatian] = useState(false);
  const [siswaPanel, setSiswaPanel] = useState(null);
  const [dipilih, setDipilih] = useState(null);

  useEffect(() => {
    if (!khususWali) return;
    (async () => {
      try {
        const [data, catatan] = await Promise.all([ambilSiswaWaliKelas(), ambilCatatanKelas()]);
        setStudents(data.siswa || []);
        setKelas(data.kelas);
        setBatas(data.batas_minus_perhatian ?? BATAS_MINUS_PERHATIAN);
        setRecords(catatan);
      } catch (e) {
        toast.error(e?.response?.data?.detail || 'Gagal memuat siswa kelas');
      } finally {
        setLoading(false);
      }
    })();
  }, [khususWali]);

  const baris = useMemo(() => {
    const q = cari.toLowerCase();
    return students
      .filter((s) => !q || [s.full_name, s.nis, s.nisn].filter(Boolean).join(' ').toLowerCase().includes(q))
      .map((s) => {
        const r = rangkumPoin(records.filter((x) => x.siswa_id === s.id));
        return { siswa: s, ...r, saldo: r.totalPlus + r.totalMinus, perhatian: r.totalMinus <= batas };
      })
      .filter((b) => !hanyaPerhatian || b.perhatian)
      .sort(URUTAN[urut].banding);
  }, [students, records, cari, urut, hanyaPerhatian, batas]);

  const ringkasanKelas = useMemo(() => rangkumPoin(records), [records]);
  const jumlahPerhatian = useMemo(
    () => students.filter((s) => rangkumPoin(records.filter((x) => x.siswa_id === s.id)).totalMinus <= batas).length,
    [students, records, batas],
  );
  const terbaru = useMemo(() => [...records].sort(bandingTerbaru).slice(0, 5), [records]);

  // Guard: hanya peran wali kelas; peran lain diarahkan ke halaman poin sesuai aksesnya.
  if (!khususWali) return <Navigate to={halamanPoinTatib(activeRole)} replace />;

  const namaKelas = kelas?.name;
  const rataSaldo = students.length ? (ringkasanKelas.totalPlus + ringkasanKelas.totalMinus) / students.length : 0;

  return (
    <div className="space-y-6" data-testid="walikelas-poin-tatib-page">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <ShieldCheck className="h-3 w-3 mr-1" /> Tata Tertib
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Pantauan Walikelas{namaKelas ? ` · Kelas ${namaKelas}` : ''}</h1>
        <p className="text-sm text-slate-600 mt-1">Poin kebaikan dan pelanggaran siswa di kelas yang Anda ampu</p>
      </div>

      <BannerModeLihat>Mode lihat saja — pencatatan poin dilakukan oleh guru tata tertib, waka kesiswaan, atau admin.</BannerModeLihat>

      {!loading && (
        <section className="space-y-3" data-testid="walikelas-ringkasan-kelas">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" /> {students.length} siswa</span>
            <span className={`inline-flex items-center gap-1.5 ${jumlahPerhatian ? 'text-amber-700 font-medium' : ''}`} data-testid="walikelas-jumlah-perhatian">
              <AlertTriangle className="h-4 w-4" /> {jumlahPerhatian} siswa perlu perhatian
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Scale className="h-4 w-4" /> Rata-rata saldo{' '}
              <span className="font-semibold tabular-nums text-slate-900">{formatPoin(Math.round(rataSaldo * 10) / 10)}</span>
            </span>
          </div>
          <RingkasanPoin {...ringkasanKelas} />
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Cari nama atau NIS..." value={cari} onChange={(e) => setCari(e.target.value)} className="pl-10" />
        </div>
        <Select value={urut} onValueChange={setUrut}>
          <SelectTrigger className="w-56" data-testid="walikelas-urut"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(URUTAN).map(([k, u]) => <SelectItem key={k} value={k}>{u.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <button
          type="button"
          aria-pressed={hanyaPerhatian}
          onClick={() => setHanyaPerhatian((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors ${hanyaPerhatian ? 'border-amber-400 bg-amber-50 text-amber-800' : 'hover:bg-slate-50 text-slate-700'}`}
          data-testid="walikelas-filter-perhatian"
        >
          <AlertTriangle className="h-4 w-4" /> Hanya perlu perhatian
        </button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" />
              <p className="text-slate-500">Memuat siswa kelas...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">No</TableHead>
                    <TableHead>Nama Siswa</TableHead>
                    <TableHead>NIS</TableHead>
                    <TableHead className="text-right">Kebaikan</TableHead>
                    <TableHead className="text-right">Pelanggaran</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="hidden sm:table-cell">Perbandingan</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {baris.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10 text-slate-500">
                        {students.length === 0 ? (kelas ? 'Belum ada siswa aktif di kelas ini.' : 'Anda belum tercatat sebagai wali kelas mana pun.') : 'Tidak ada siswa yang cocok.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    baris.map((b, i) => (
                      <TableRow
                        key={b.siswa.id}
                        className={`cursor-pointer ${b.perhatian ? 'bg-amber-50/70 hover:bg-amber-50' : 'hover:bg-slate-50'}`}
                        onClick={() => setSiswaPanel({ id: b.siswa.id, nama: b.siswa.full_name, nis: b.siswa.nis, kelas: b.siswa.class_name })}
                        data-testid={`walikelas-siswa-${b.siswa.id}`}
                      >
                        <TableCell className="text-slate-500 tabular-nums">{i + 1}</TableCell>
                        <TableCell className="font-medium">
                          <div className="flex flex-wrap items-center gap-2">
                            {b.siswa.full_name}
                            {b.perhatian && (
                              <Badge
                                variant="outline"
                                className="border-amber-400 bg-amber-100 text-amber-800"
                                title={`Akumulasi pelanggaran ${formatPoin(b.totalMinus)} (batas ${batas})`}
                                data-testid={`walikelas-perhatian-${b.siswa.id}`}
                              >
                                <AlertTriangle className="h-3 w-3 mr-1" /> Perlu perhatian
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{b.siswa.nis || '-'}</TableCell>
                        <TableCell className="text-right"><SelPoin nilai={b.totalPlus} jumlah={b.jumlahKebaikan} warna="text-emerald-700" /></TableCell>
                        <TableCell className="text-right"><SelPoin nilai={b.totalMinus} jumlah={b.jumlahPelanggaran} warna="text-red-700" /></TableCell>
                        <TableCell className={`text-right font-bold tabular-nums ${b.saldo < 0 ? 'text-red-700' : 'text-slate-900'}`}>{formatPoin(b.saldo)}</TableCell>
                        <TableCell className="hidden sm:table-cell"><BarPlusMinus plus={b.totalPlus} minus={b.totalMinus} /></TableCell>
                        <TableCell><ChevronRight className="h-4 w-4 text-slate-400" /></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {!loading && terbaru.length > 0 && (
        <section className="space-y-2" data-testid="walikelas-catatan-terbaru">
          <h2 className="text-lg font-semibold text-slate-900">Catatan Terbaru</h2>
          <Card>
            <CardContent className="divide-y p-0">
              {terbaru.map((r) => {
                const plus = (r.poin || 0) > 0;
                return (
                  <button
                    key={r.id}
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                    onClick={() => setDipilih(r)}
                    data-testid={`walikelas-terbaru-${r.id}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{r.siswa_nama}</p>
                      <p className="truncate text-xs text-slate-500">{formatTanggalPoin(r.tanggal)} · {r.tatib_nama}</p>
                    </div>
                    <span className={`shrink-0 font-bold tabular-nums ${plus ? 'text-emerald-700' : 'text-red-700'}`}>{formatPoin(r.poin)}</span>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </section>
      )}

      <RincianPoinDialog
        catatan={dipilih}
        onClose={() => setDipilih(null)}
        tampilkanSiswa
        onLihatSiswa={(r) => {
          setDipilih(null);
          setSiswaPanel({ id: r.siswa_id, nama: r.siswa_nama, nis: r.siswa_nis, kelas: r.siswa_kelas });
        }}
      />

      <PanelPoinSiswa siswa={siswaPanel} records={records} onClose={() => setSiswaPanel(null)} />
    </div>
  );
}
