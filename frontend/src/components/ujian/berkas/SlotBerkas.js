import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2, CircleDashed, FileText, Loader2, Lock, RefreshCw, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatWIBPanjang } from '@/lib/datetime';
import { waktuRelatif } from '@/lib/ujianMonitoringPublik';
import {
  ATURAN_BERKAS, formatUkuranBerkas, galatBerkas, galatIsiBerkas, galatPj, pesanGalatUnggah, unggahBerkas,
} from '@/lib/ujianBerkas';

/**
 * Satu slot unggah (kisi-kisi atau kartu soal) untuk satu mapel × jenjang: status terkirim/belum, nama & ukuran berkas,
 * waktu update, tombol unggah / ganti (unggah ulang menimpa), progres, dan pesan galat validasi yang jelas.
 */
export default function SlotBerkas({ ujianId, tugas, jenis, guruPjId, guru = [], onTerunggah }) {
  const aturan = ATURAN_BERKAS[jenis];
  const berkas = tugas[jenis];
  const input = useRef(null);
  const [progres, setProgres] = useState(null);
  const [galat, setGalat] = useState('');
  const [seret, setSeret] = useState(false);
  const [menunggu, setMenunggu] = useState(null); // berkas pengganti kartu soal yang menunggu konfirmasi
  const rahasia = jenis === 'kartu_soal';
  const id = (s) => `slot-${tugas.jenjang}-${tugas.mapel}-${jenis}${s ? `-${s}` : ''}`;

  const proses = async (file, sudahDikonfirmasi = false) => {
    if (!file || progres !== null) return;
    const pesan = galatPj(guruPjId, guru) || galatBerkas(jenis, file) || await galatIsiBerkas(jenis, file);
    if (pesan) { setGalat(pesan); return; }
    // Kartu soal ditimpa tanpa arsip dan isinya tidak dapat diunduh kembali oleh guru: minta konfirmasi dulu.
    if (rahasia && berkas && !sudahDikonfirmasi) { setGalat(''); setMenunggu(file); return; }
    setGalat('');
    setProgres(0);
    try {
      const r = await unggahBerkas(ujianId, jenis, { ...tugas, guruPjId }, file, setProgres);
      onTerunggah(tugas, jenis, r.berkas, r.tiruan);
      const judul = `${aturan.label} ${tugas.nama_mapel} Kelas ${tugas.jenjang}`;
      toast.success(berkas ? `${judul} diganti: "${berkas.nama_file}" → "${r.berkas?.nama_file || file.name}".` : `${judul} terkirim.`);
    } catch (err) {
      // Penggantian gagal: server mengganti secara atomik, jadi berkas lama masih yang berlaku.
      setGalat(`${pesanGalatUnggah(err, jenis)}${berkas ? ` Berkas lama "${berkas.nama_file}" tetap tersimpan.` : ''}`);
    } finally {
      setProgres(null);
    }
  };
  const pilih = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // berkas yang sama dapat dipilih lagi setelah galat
    proses(file);
  };
  // Seret & lepas satu berkas ke slot (laptop/komputer).
  const lepas = (e) => {
    e.preventDefault();
    setSeret(false);
    proses(e.dataTransfer?.files?.[0]);
  };

  const sibuk = progres !== null;
  return (
    <div className={`rounded-lg border p-3 transition-colors ${seret ? 'border-[#006837] bg-emerald-50/60' : 'border-slate-200'}`}
      data-testid={id()} data-status={berkas ? 'terkirim' : 'belum'}
      onDragOver={(e) => { e.preventDefault(); if (!seret) setSeret(true); }} onDragLeave={() => setSeret(false)} onDrop={lepas}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            {aturan.label} {rahasia && <Lock className="h-3.5 w-3.5 text-slate-400" aria-label="rahasia" />}
          </div>
          <div className="text-[11px] text-slate-500">{aturan.format} · maks. 10 MB</div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${berkas ? 'bg-emerald-50 text-[#006837]' : 'bg-slate-100 text-slate-500'}`}>
          {berkas ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />} {berkas ? 'Terkirim' : 'Belum'}
        </span>
      </div>

      {berkas && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-600" data-testid={id('info')}>
          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="min-w-0">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-medium text-slate-800" title={berkas.nama_file}>{berkas.nama_file}</span>
              <span className="shrink-0 rounded bg-slate-100 px-1 text-[10px] font-semibold uppercase text-slate-500" data-testid={id('format')}>
                {(String(berkas.nama_file || '').split('.').pop() || '').slice(0, 4)}
              </span>
            </span>
            {formatUkuranBerkas(berkas.ukuran_byte)} · diperbarui{' '}
            <time dateTime={berkas.updated_at} title={`${formatWIBPanjang(berkas.updated_at)} WIB`} data-testid={id('waktu')}>{waktuRelatif(berkas.updated_at)}</time>
            {berkas.guru_pj_nama ? ` · ${berkas.guru_pj_nama}` : ''}
          </span>
        </p>
      )}

      {sibuk && (
        <div className="mt-2" aria-live="polite">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={progres} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-[#006837] transition-all" style={{ width: `${progres}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Mengunggah… {progres}%</p>
        </div>
      )}
      {galat && (
        <div className="mt-2 flex items-start gap-1.5 rounded-md bg-rose-50 px-2 py-1.5 text-xs text-rose-700" role="alert" data-testid={id('galat')}>
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span className="min-w-0 flex-1">{galat}</span>
          <button type="button" onClick={() => setGalat('')} aria-label="Tutup pesan galat" className="shrink-0 rounded p-0.5 hover:bg-rose-100" data-testid={id('galat-tutup')}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <input ref={input} type="file" accept={aturan.accept} className="hidden" onChange={pilih} data-testid={id('input')} />
      <Button type="button" size="sm" variant={berkas ? 'outline' : 'default'} disabled={sibuk} onClick={() => input.current?.click()}
        className={`mt-2 h-8 gap-1.5 ${berkas ? '' : 'bg-[#006837] hover:bg-[#005830]'}`} data-testid={id('tombol')}>
        {sibuk ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : berkas ? <RefreshCw className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
        {berkas ? 'Ganti berkas' : `Unggah ${aturan.label.toLowerCase()}`}
      </Button>
      <p className="mt-1 text-[11px] text-slate-400">{berkas ? 'Berkas baru akan menggantikan berkas lama. ' : ''}<span className="hidden sm:inline">Atau seret berkas ke kotak ini.</span></p>
      {rahasia && (
        <p className="mt-1 text-[11px] text-slate-500" data-testid={id('catatan-rahasia')}>
          Setelah terkirim, isi kartu soal hanya dapat dibuka admin — simpan salinannya di perangkat Anda.
        </p>
      )}
      <AlertDialog open={!!menunggu} onOpenChange={(o) => { if (!o) setMenunggu(null); }}>
        <AlertDialogContent data-testid={id('konfirmasi')}>
          <AlertDialogHeader>
            <AlertDialogTitle>Ganti kartu soal {tugas.nama_mapel} Kelas {tugas.jenjang}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-slate-600">
                <p>Kartu soal lama <strong>{berkas?.nama_file}</strong> akan dihapus permanen dan diganti dengan <strong>{menunggu?.name}</strong>.
                  Tidak ada arsip versi lama.</p>
                <p>Pastikan berkas baru sudah final.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid={id('konfirmasi-batal')}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const f = menunggu; setMenunggu(null); proses(f, true); }}
              className="bg-[#006837] hover:bg-[#005830]" data-testid={id('konfirmasi-ganti')}>Ya, ganti</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
