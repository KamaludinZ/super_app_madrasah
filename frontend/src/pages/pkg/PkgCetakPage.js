import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer, FileText, Loader2, Users, UserRound, ClipboardPen, Eye } from 'lucide-react';
import { toast } from 'sonner';
import PenjagaMenuPkg from '@/components/pkg/PenjagaMenuPkg';
import SaringanPeriodeRekap from '@/components/pkg/SaringanPeriodeRekap';
import BadgeStatusPenilaian from '@/components/pkg/BadgeStatusPenilaian';
import RiwayatUnduhan from '@/components/pkg/RiwayatUnduhan';
import DialogProsesCetak from '@/components/pkg/DialogProsesCetak';
import TombolCetakOffline from '@/components/pkg/TombolCetakOffline';
import DialogPratinjauPdf from '@/components/pkg/DialogPratinjauPdf';
import { isEmbeddedApp } from '@/lib/embed';
import { ambilRekap } from '@/lib/pkgRekap';
import { JENIS_DOKUMEN, JENIS_FORM, cetakFormKosong, simpanBerkas, unduhDokumen } from '@/lib/pkgCetak';
import { JENIS_ANGKET, cetakAngket } from '@/lib/pkgAngket';

// Format unduhan yang ditampilkan. Excel disembunyikan atas permintaan madrasah: berkas Excel template masih memuat
// isian master madrasah lain, sedangkan PDF selalu berisi data aplikasi. Backend tetap mendukung format xlsx.
const FORMAT_UNDUH = [['pdf', 'PDF', FileText]];

// Tombol pratinjau & unduh untuk satu dokumen. `kunci` membedakan proses yang sedang berjalan.
function TombolUnduh({ kunci, sedang, nonaktif, onUnduh, onPratinjau }) {
  return (
    <div className="flex shrink-0 gap-2">
      <Button size="sm" variant="outline" className="h-8 gap-1" disabled={nonaktif || !!sedang} onClick={onPratinjau}
        data-testid={`pkg-pratinjau-${kunci}`}>
        {sedang === `${kunci}:pratinjau` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />} Pratinjau
      </Button>
      {FORMAT_UNDUH.map(([format, label, Ikon]) => (
        <Button key={format} size="sm" variant={format === 'xlsx' ? 'outline' : 'default'}
          className={`h-8 gap-1 ${format === 'pdf' ? 'bg-[#006837] hover:bg-[#005830]' : ''}`}
          disabled={nonaktif || !!sedang} onClick={() => onUnduh(format)} data-testid={`pkg-unduh-${kunci}-${format}`}>
          {sedang === `${kunci}:${format}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ikon className="h-3.5 w-3.5" />} {label}
        </Button>
      ))}
    </div>
  );
}

// Form isian kosong untuk dicetak dan diisi offline oleh tim penilai, lalu diinput ke aplikasi.
function KartuFormKosong({ periodeId, onHasil }) {
  return (
    <Card data-testid="pkg-cetak-form-kosong">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><ClipboardPen className="h-4 w-4 text-[#006837]" /> Form Isian Kosong (cetak offline)</CardTitle>
        <p className="text-xs text-slate-500">Cetak formulir PDF untuk diisi tangan oleh tim penilai, lalu masukkan hasilnya ke aplikasi. Isi form mengikuti instrumen yang berlaku; identitas diisi tangan (form per guru ada di daftar tugas penilaian).</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-1.5 text-xs font-semibold text-slate-700">Formulir penilaian</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(JENIS_FORM).map(([jenis, info]) => (
              <TombolCetakOffline key={jenis} ambil={() => cetakFormKosong({ jenis, periodeId })} testId={`pkg-form-kosong-${jenis}`} onHasil={onHasil}
                variant={jenis === 'paket' ? 'default' : 'outline'} className={jenis === 'paket' ? 'bg-[#006837] hover:bg-[#005830]' : ''}>
                {info.judul}
              </TombolCetakOffline>
            ))}
            <TombolCetakOffline ambil={() => cetakFormKosong({ jenis: 'paket', periodeId, semuaGuru: true })} testId="pkg-form-kosong-semua-guru" onHasil={onHasil}>
              Paket semua guru
            </TombolCetakOffline>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">"Paket semua guru" = satu PDF berisi paket lengkap tiap guru dalam cakupan Anda (halaman terpisah, identitas terisi).</p>
        </div>
        <div>
          <div className="mb-1.5 text-xs font-semibold text-slate-700">Angket 360° (dibagikan ke responden)</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(JENIS_ANGKET).map(([jenis, info]) => (
              <TombolCetakOffline key={jenis} ambil={() => cetakAngket({ jenis, format: 'pdf', periodeId })} testId={`pkg-angket-kosong-${jenis}`} onHasil={onHasil}>
                {info.label}
              </TombolCetakOffline>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function IsiHalamanCetak() {
  const [searchParams, setSearchParams] = useSearchParams();
  const periodeId = searchParams.get('periode') || undefined;
  const [rekap, setRekap] = useState(null);
  const [sedang, setSedang] = useState(null);
  const [jumlahUnduh, setJumlahUnduh] = useState(0);
  const [proses, setProses] = useState(null);
  const [lembarPdf, setLembarPdf] = useState('lengkap');
  const [pratinjau, setPratinjau] = useState(null);
  const { keanggotaan } = useOutletContext() || {};

  const muat = useCallback(async () => {
    try {
      setRekap(await ambilRekap({ periodeId }));
    } catch (e) {
      toast.error(e.message || 'Gagal memuat data cetak');
    }
  }, [periodeId]);

  useEffect(() => { muat(); }, [muat]);

  // Pratinjau di dialog (web); di WebView aplikasi HP PDF tidak dapat tampil di halaman, jadi berkas langsung dibuka
  // lewat lembar berbagi (pilih aplikasi penampil PDF).
  const tampilkan = (hasil) => {
    if (isEmbeddedApp()) {
      simpanBerkas(hasil.blob, hasil.namaBerkas);
      toast.info('Pilih aplikasi PDF di lembar berbagi untuk melihat berkas.');
    } else {
      setPratinjau(hasil);
    }
  };

  const unduh = async (jenis, format, guru = null, { lihat = false } = {}) => {
    const kunci = `${jenis === 'guru' ? guru.guru_id : 'rekap'}:${lihat ? 'pratinjau' : format}`;
    setSedang(kunci);
    setProses({ format, tahap: 'template', selesai: false });
    try {
      const { blob, namaBerkas, mesin, alasanCadangan } = await unduhDokumen({
        jenis, format, periode: rekap.periode, guru, lembar: lembarPdf, onTahap: (tahap) => setProses((p) => p && { ...p, tahap }),
      });
      setJumlahUnduh((n) => n + 1);
      if (lihat) {
        setProses(null);
        tampilkan({ blob, namaBerkas, mesin });
        return;
      }
      simpanBerkas(blob, namaBerkas);
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
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Printer className="h-5 w-5 text-[#006837]" /> Cetak PDF</h2>
        <p className="text-xs text-slate-500">Dokumen resmi dari template PKG; hanya lembar yang sudah dikunci yang tercetak. Gunakan Pratinjau untuk melihat isi PDF sebelum diunduh.</p>
      </div>

      <SaringanPeriodeRekap nilai={rekap.periode?.id}
        onUbah={(id) => setSearchParams((sp) => { const baru = new URLSearchParams(sp); baru.set('periode', id); return baru; })} />

      <KartuFormKosong periodeId={rekap.periode?.id} onHasil={tampilkan} />

      <Card>
        <CardHeader className="pb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-[#006837]" /> {JENIS_DOKUMEN.rekap.judul}</CardTitle>
            <p className="text-xs text-slate-500 mt-1">{JENIS_DOKUMEN.rekap.keterangan} · {terkunci.length} dari {rekap.guru.length} lembar terkunci</p>
          </div>
          <TombolUnduh kunci="rekap" sedang={sedang} nonaktif={!terkunci.length} onUnduh={(f) => unduh('rekap', f)}
            onPratinjau={() => unduh('rekap', 'pdf', null, { lihat: true })} />
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><UserRound className="h-4 w-4 text-[#006837]" /> {JENIS_DOKUMEN.guru.judul}</CardTitle>
          <p className="text-xs text-slate-500">{JENIS_DOKUMEN.guru.keterangan}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs" role="radiogroup" aria-label="Isi PDF laporan per guru">
            <span className="text-slate-500">Isi PDF:</span>
            {[['lengkap', 'Laporan lengkap'], ['rekap', 'Rekapitulasi (04-RKAP-PKG) saja']].map(([nilai, label]) => (
              <button key={nilai} type="button" role="radio" aria-checked={lembarPdf === nilai} onClick={() => setLembarPdf(nilai)}
                data-testid={`pkg-lembar-pdf-${nilai}`}
                className={`rounded-full border px-3 py-1 ${lembarPdf === nilai ? 'border-[#006837] bg-emerald-50 text-[#006837]' : 'border-slate-200 text-slate-600'}`}>
                {label}
              </button>
            ))}
          </div>
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
              <TombolUnduh kunci={g.guru_id} sedang={sedang} nonaktif={g.status !== 'terkunci'} onUnduh={(f) => unduh('guru', f, g)}
                onPratinjau={() => unduh('guru', 'pdf', g, { lihat: true })} />
            </div>
          ))}
        </CardContent>
      </Card>

      <DialogProsesCetak proses={proses} onTutup={() => setProses(null)} />
      <DialogPratinjauPdf pratinjau={pratinjau} onTutup={() => setPratinjau(null)} />

      {keanggotaan?.peran === 'kepala' && <RiwayatUnduhan periodeId={rekap.periode?.id} muatUlangKunci={jumlahUnduh} />}
    </div>
  );
}

// Cetak dokumen resmi PKG (kepala & penilai): rekap seluruh guru dan laporan per guru dalam PDF.
// Data guru dari rekap (cakupan peran); berkas dari POST /pkg/cetak (lib/pkgCetak).
export default function PkgCetakPage() {
  return (
    <PenjagaMenuPkg menuKey="cetak">
      <IsiHalamanCetak />
    </PenjagaMenuPkg>
  );
}
