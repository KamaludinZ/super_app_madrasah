import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, CalendarRange, ClipboardCheck, FileBarChart, FileDown, FileSpreadsheet, Loader2, Package, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { unduhLaporan } from './laporanExport';
import RekapDiagnosaTab from './RekapDiagnosaTab';
import RekapOpnameTab from './RekapOpnameTab';
import PeriodeFilter, { periodeFromSearch, periodeToSearch } from './PeriodeFilter';
import { labelPeriode, rentangPeriode } from './uksPeriode';
import { useAuth } from '@/lib/AuthContext';

function formatTanggalPanjang(d) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

const JUDUL_LAPORAN = {
  diagnosa: 'Rekap Penegakan Diagnosa per Kunjungan',
  opname: 'Rekap Opname Obat & BMHP',
};

/** Kop laporan: nama madrasah, judul laporan aktif, dan periode yang sedang ditampilkan. */
export function HeaderPeriodeLaporan({ periode, tab, schoolName }) {
  const { start, end } = rentangPeriode(periode);
  return (
    <div className="rounded-xl border border-[#006837]/20 bg-[#006837]/5 px-4 py-3" data-testid="header-periode-laporan">
      <div className="text-xs font-semibold uppercase tracking-wide text-[#006837]">{schoolName || 'Unit Kesehatan Sekolah'} · Laporan UKS</div>
      <div className="mt-0.5 text-lg font-bold text-slate-900">{JUDUL_LAPORAN[tab]}</div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-slate-700">
        <CalendarRange className="h-4 w-4 text-[#006837]" />
        <span>Periode <span className="font-semibold">{periode.mode === 'tahunan' ? 'tahunan' : 'bulanan'}</span>: <span className="font-semibold" data-testid="label-periode-aktif">{labelPeriode(periode)}</span></span>
        <span className="text-slate-500">({formatTanggalPanjang(start)} – {formatTanggalPanjang(end)})</span>
      </div>
    </div>
  );
}

/**
 * Halaman Laporan UKS Baru: rekap penegakan diagnosa per kunjungan (dipisah
 * siswa & GTK) dan rekap opname obat & BMHP, dengan filter bulanan/tahunan.
 */
export default function AdminUKSLaporanBaruPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { settings } = useAuth();
  const [exportData, setExportData] = useState({ diagnosa: null, opname: null });
  const [downloading, setDownloading] = useState(null);

  // Saat mencetak, hanya area laporan yang terlihat (sidebar & kontrol disembunyikan).
  useEffect(() => {
    document.body.classList.add('cetak-laporan-uks');
    return () => document.body.classList.remove('cetak-laporan-uks');
  }, []);

  const filenameBase = () => {
    const per = periode.mode === 'tahunan' ? periode.tahun : `${periode.tahun}-${periode.bulan}`;
    return `laporan-uks-${tab === 'diagnosa' ? 'rekap-diagnosa' : 'opname-obat-bmhp'}-${per}`;
  };

  const handleUnduh = async (format) => {
    setDownloading(format);
    try {
      const hasil = await unduhLaporan({ jenis: tab, format, periode, filenameBase: filenameBase(), fallbackSections: exportData[tab] });
      if (hasil === 'csv') toast.info('Ekspor Excel dari server belum tersedia; laporan diunduh sebagai CSV yang bisa dibuka di Excel.');
      else toast.success('Laporan berhasil diunduh');
    } catch (e) {
      if (e?.response?.status === 404 && format === 'pdf') {
        toast.info('Ekspor PDF dari server belum tersedia. Gunakan tombol Cetak lalu pilih "Simpan sebagai PDF".');
      } else {
        toast.error('Gagal mengunduh laporan');
      }
    } finally {
      setDownloading(null);
    }
  };
  const [periode, setPeriode] = useState(() => periodeFromSearch(location.search));
  const [tab, setTab] = useState(() => (new URLSearchParams(location.search).get('tab') === 'opname' ? 'opname' : 'diagnosa'));

  // Simpan periode & tab di URL (tanpa menambah riwayat browser).
  useEffect(() => {
    const search = `${periodeToSearch(periode)}&tab=${tab}`;
    if (search !== location.search) navigate({ search }, { replace: true });
  }, [periode, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6" data-testid="admin-uks-laporan-baru-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <FileBarChart className="h-3 w-3 mr-1" /> Menu UKS
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Laporan UKS Baru</h1>
          <p className="text-sm text-slate-600 mt-1">Rekap penegakan diagnosa per kunjungan dan rekap opname obat &amp; BMHP</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="outline" className="gap-2" onClick={() => handleUnduh('excel')} disabled={!!downloading || !exportData[tab]} data-testid="unduh-excel">
            {downloading === 'excel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />} Unduh Excel
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => handleUnduh('pdf')} disabled={!!downloading || !exportData[tab]} data-testid="unduh-pdf">
            {downloading === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} Unduh PDF
          </Button>
          <Button className="gap-2 bg-[#006837] hover:bg-[#005830]" onClick={() => window.print()} disabled={!exportData[tab]} data-testid="cetak-laporan">
            <Printer className="h-4 w-4" /> Cetak
          </Button>
          <Button asChild variant="ghost" className="gap-2">
            <Link to="/admin/uks/laporan"><ArrowLeft className="h-4 w-4" /> Laporan UKS</Link>
          </Button>
        </div>
      </div>

      <div className="print:hidden"><PeriodeFilter value={periode} onChange={setPeriode} /></div>

      <div id="area-cetak-laporan-uks" className="space-y-4">
      <HeaderPeriodeLaporan periode={periode} tab={tab} schoolName={settings?.school_name} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white border border-slate-200 print:hidden">
          <TabsTrigger value="diagnosa"><ClipboardCheck className="h-4 w-4 mr-2" /> Rekap Diagnosa</TabsTrigger>
          <TabsTrigger value="opname"><Package className="h-4 w-4 mr-2" /> Opname Obat &amp; BMHP</TabsTrigger>
        </TabsList>

        <TabsContent value="diagnosa" className="mt-4">
          <RekapDiagnosaTab periode={periode} onExportData={(d) => setExportData((x) => ({ ...x, diagnosa: d }))} />
        </TabsContent>

        <TabsContent value="opname" className="mt-4">
          <RekapOpnameTab periode={periode} onExportData={(d) => setExportData((x) => ({ ...x, opname: d }))} />
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
