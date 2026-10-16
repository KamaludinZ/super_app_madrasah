import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Gavel, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { bolehInputTatib, pesanGalatTatib } from '@/lib/aksesTatib';
import { formatPoin } from '@/components/tatib/RingkasanPoin';
import BannerModeLihat from '@/components/tatib/BannerModeLihat';
import { TINGKAT_SP, ambilTindakan } from '@/lib/tindakanTatib';

export const WARNA_SP = {
  SP1: 'bg-amber-100 text-amber-800 border-amber-200',
  SP2: 'bg-orange-100 text-orange-800 border-orange-200',
  SP3: 'bg-red-100 text-red-800 border-red-200',
};

const WARNA_STATUS = {
  'Tidak diperlukan': 'text-slate-500',
  'Tidak perlu': 'text-slate-500',
  Diajukan: 'border-amber-200 bg-amber-50 text-amber-800',
  Terlaksana: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Diserahkan: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Disusun: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};

export const BadgeStatus = ({ nilai }) => (
  <Badge variant="outline" className={`whitespace-nowrap font-normal ${WARNA_STATUS[nilai] || ''}`}>{nilai || '-'}</Badge>
);

const DaftarKategori = ({ items }) => (items?.length ? <span className="text-xs text-slate-600">{items.join(', ')}</span> : <span className="text-slate-300">-</span>);

// Tindakan Tatib: siswa yang tercatat poin (plus & minus), usulan SP otomatis dari ambang poin,
// dan status pembinaan (panggilan wali, SP, RTLPD) yang ditetapkan manual oleh peran input tatib.
export default function TatibTindakanPage() {
  const { activeRole } = useAuth();
  const bolehUbah = bolehInputTatib(activeRole);
  const [data, setData] = useState({ ambang: null, items: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ambilTindakan()
      .then(setData)
      .catch((e) => toast.error(pesanGalatTatib(e, 'Gagal memuat data tindakan tatib')))
      .finally(() => setLoading(false));
  }, []);

  const jumlahUsulan = useMemo(() => {
    const n = { SP1: 0, SP2: 0, SP3: 0 };
    data.items.forEach((s) => { if (s.usulan_sp) n[s.usulan_sp] += 1; });
    return n;
  }, [data.items]);

  return (
    <div className="p-6 space-y-6" data-testid="tatib-tindakan-page">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Gavel className="h-6 w-6" /> Tindakan Tatib</h1>
        <p className="text-sm text-slate-600">
          Siswa yang tercatat poin tata tertib. SP diusulkan otomatis dari ambang poin; status pembinaan ditetapkan manual.
        </p>
      </div>

      {!bolehUbah && <BannerModeLihat />}

      {data.ambang && (
        <div className="flex flex-wrap gap-2 text-sm" data-testid="tindakan-ringkasan">
          {TINGKAT_SP.map((sp) => (
            <span key={sp} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 ${WARNA_SP[sp]}`}>
              <span className="font-semibold">{sp}</span>
              <span className="text-xs opacity-80">≥ {data.ambang[sp.toLowerCase()]} poin</span>
              <span className="font-bold tabular-nums">{jumlahUsulan[sp]}</span>
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
                    <TableHead>NISN</TableHead>
                    <TableHead>Nama Siswa</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead className="text-right">Poin Positif</TableHead>
                    <TableHead>Kategori Positif</TableHead>
                    <TableHead className="text-right">Poin Negatif</TableHead>
                    <TableHead>Kategori Negatif</TableHead>
                    <TableHead>Keterangan SP</TableHead>
                    <TableHead>Panggilan Wali</TableHead>
                    <TableHead>Status SP</TableHead>
                    <TableHead>RTLPD</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((s) => (
                    <TableRow key={s.siswa_id} data-testid={`tindakan-${s.siswa_id}`}>
                      <TableCell className="font-mono text-xs">{s.nisn || '-'}</TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{s.nama}</TableCell>
                      <TableCell className="whitespace-nowrap">{s.kelas || '-'}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-emerald-700">{s.poin_positif ? formatPoin(s.poin_positif) : '0'}</TableCell>
                      <TableCell><DaftarKategori items={s.kategori_positif} /></TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-red-700">{s.poin_negatif || 0}</TableCell>
                      <TableCell><DaftarKategori items={s.kategori_negatif} /></TableCell>
                      <TableCell data-testid={`tindakan-sp-${s.siswa_id}`}>
                        {s.keterangan_sp || s.usulan_sp ? (
                          <div className="space-y-1">
                            <Badge variant="outline" className={WARNA_SP[s.keterangan_sp || s.usulan_sp]}>{s.keterangan_sp || s.usulan_sp}</Badge>
                            {!s.keterangan_sp && <div className="text-[11px] text-slate-500">usulan otomatis</div>}
                          </div>
                        ) : <span className="text-slate-300">-</span>}
                      </TableCell>
                      <TableCell><BadgeStatus nilai={s.status_panggilan_wali} /></TableCell>
                      <TableCell><BadgeStatus nilai={s.status_sp} /></TableCell>
                      <TableCell><BadgeStatus nilai={s.status_rtlpd} /></TableCell>
                    </TableRow>
                  ))}
                  {data.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={11} className="py-8 text-center text-slate-500">Belum ada siswa yang tercatat poin.</TableCell>
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
}
