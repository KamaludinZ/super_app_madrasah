import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer, FileSpreadsheet, FileText, Loader2, Users, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import PenjagaMenuPkg from '@/components/pkg/PenjagaMenuPkg';
import SaringanPeriodeRekap from '@/components/pkg/SaringanPeriodeRekap';
import BadgeStatusPenilaian from '@/components/pkg/BadgeStatusPenilaian';
import RiwayatUnduhan from '@/components/pkg/RiwayatUnduhan';
import DialogProsesCetak from '@/components/pkg/DialogProsesCetak';
import { ambilRekap } from '@/lib/pkgRekap';
import { JENIS_DOKUMEN, simpanBerkas, unduhDokumen } from '@/lib/pkgCetak';

// Tombol unduh Excel & PDF untuk satu dokumen. `kunci` membedakan proses unduh yang sedang berjalan.
function TombolUnduh({ kunci, sedang, nonaktif, onUnduh }) {
  return (
    <div className="flex shrink-0 gap-2">
      {[['xlsx', 'Excel', FileSpreadsheet], ['pdf', 'PDF', FileText]].map(([format, label, Ikon]) => (
        <Button key={format} size="sm" variant={format === 'xlsx' ? 'outline' : 'default'}
          className={`h-8 gap-1 ${format === 'pdf' ? 'bg-[#006837] hover:bg-[#005830]' : ''}`}
          disabled={nonaktif || !!sedang} onClick={() => onUnduh(format)} data-testid={`pkg-unduh-${kunci}-${format}`}>
          {sedang === `${kunci}:${format}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ikon className="h-3.5 w-3.5" />} {label}
        </Button>
      ))}
    </div>
  );
}

function IsiHalamanCetak() {
  const [searchParams, setSearchParams] = useSearchParams();
  const periodeId = searchParams.get('periode') || undefined;
  const [rekap, setRekap] = useState(null);
  const [sedang, setSedang] = useState(null);
  const [jumlahUnduh, setJumlahUnduh] = useState(0);
  const [proses, setProses] = useState(null);
  const { keanggotaan } = useOutletContext() || {};

  const muat = useCallback(async () => {
    try {
      setRekap(await ambilRekap({ periodeId }));
    } catch (e) {
      toast.error(e.message || 'Gagal memuat data cetak');
    }
  }, [periodeId]);

  useEffect(() => { muat(); }, [muat]);

  const unduh = async (jenis, format, guru = null) => {
    const kunci = `${jenis === 'guru' ? guru.guru_id : 'rekap'}:${format}`;
    setSedang(kunci);
    setProses({ format, tahap: 'template', selesai: false });
    try {
      const { blob, namaBerkas, mesin, alasanCadangan } = await unduhDokumen({
        jenis, format, periode: rekap.periode, guru, onTahap: (tahap) => setProses((p) => p && { ...p, tahap }),
      });
      simpanBerkas(blob, namaBerkas);
      setJumlahUnduh((n) => n + 1);
      // PDF cadangan: dialog tetap terbuka dengan penanda; selain itu cukup notifikasi singkat.
      if (mesin === 'reportlab') setProses((p) => ({ ...p, selesai: true, namaBerkas, mesin, alasanCadangan }));
      else {
        setProses(null);
        toast.success(`${namaBerkas} diunduh`);
      }
    } catch (e) {
      if (e.penolakan) setProses({ format, penolakan: e.penolakan });
      else setProses((p) => ({ ...p, galat: e.message || 'Gagal menyiapkan berkas.' }));
    } finally {
      setSedang(null);
    }
  };

  if (!rekap) return <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>;

  const terkunci = rekap.guru.filter((g) => g.status === 'terkunci');

  return (
    <div className="space-y-4" data-testid="pkg-cetak">
      <div>
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Printer className="h-5 w-5 text-[#006837]" /> Cetak Excel &amp; PDF</h2>
        <p className="text-xs text-slate-500">Dokumen resmi dari template PKG; hanya lembar yang sudah dikunci yang tercetak.</p>
      </div>

      <SaringanPeriodeRekap nilai={rekap.periode?.id}
        onUbah={(id) => setSearchParams((sp) => { const baru = new URLSearchParams(sp); baru.set('periode', id); return baru; })} />

      <Card>
        <CardHeader className="pb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-[#006837]" /> {JENIS_DOKUMEN.rekap.judul}</CardTitle>
            <p className="text-xs text-slate-500 mt-1">{JENIS_DOKUMEN.rekap.keterangan} · {terkunci.length} dari {rekap.guru.length} lembar terkunci</p>
          </div>
          <TombolUnduh kunci="rekap" sedang={sedang} nonaktif={!terkunci.length} onUnduh={(f) => unduh('rekap', f)} />
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><UserRound className="h-4 w-4 text-[#006837]" /> {JENIS_DOKUMEN.guru.judul}</CardTitle>
          <p className="text-xs text-slate-500">{JENIS_DOKUMEN.guru.keterangan}</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {rekap.guru.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Belum ada guru dalam cakupan Anda pada periode ini.</p>}
          {rekap.guru.map((g) => (
            <div key={g.guru_id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center" data-testid={`pkg-cetak-guru-${g.guru_id}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{g.nama}</span>
                  <BadgeStatusPenilaian status={g.status} />
                </div>
                <div className="text-xs text-slate-500">{g.mapel || '-'} · Penilai: {g.penilai_nama || '-'}</div>
              </div>
              <TombolUnduh kunci={g.guru_id} sedang={sedang} nonaktif={g.status !== 'terkunci'} onUnduh={(f) => unduh('guru', f, g)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <DialogProsesCetak proses={proses} onTutup={() => setProses(null)} />

      {keanggotaan?.peran === 'kepala' && <RiwayatUnduhan periodeId={rekap.periode?.id} muatUlangKunci={jumlahUnduh} />}
    </div>
  );
}

// Cetak dokumen resmi PKG (kepala & penilai): rekap seluruh guru dan laporan per guru dalam Excel/PDF.
// Data guru dari rekap (cakupan peran); berkas sementara dari lib/pkgCetak (tiruan).
export default function PkgCetakPage() {
  return (
    <PenjagaMenuPkg menuKey="cetak">
      <IsiHalamanCetak />
    </PenjagaMenuPkg>
  );
}
