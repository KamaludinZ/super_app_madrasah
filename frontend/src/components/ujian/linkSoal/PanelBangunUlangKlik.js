import React, { useState } from 'react';
import { toast } from 'sonner';
import { ArrowRight, CheckCircle2, DatabaseZap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatWIBPanjang } from '@/lib/datetime';
import { labelJenjang, namaMapelUjian } from '@/lib/mapelUjian';
import { pesanGalat } from '@/lib/ujian';
import { bangunUlangKlik } from '@/lib/ujianLinkSoal';

/**
 * Perintah admin "Bangun ulang penghitung klik": jumlah klik & klik terakhir tiap link soal dihitung ulang dari jejak
 * audit (ujian_akses_log), karena angka di portal hanyalah cache baca-cepat. Dipakai bila angka dicurigai selisih;
 * log tidak diubah dan perintah aman diulang. Hasilnya (mapel yang dikoreksi, sebelum → sesudah) ditampilkan di bawah.
 * `onSelesai(link, tiruan)` menerima daftar link soal terbaru.
 */
export default function PanelBangunUlangKlik({ ujianId, onSelesai }) {
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [proses, setProses] = useState(false);
  const [hasil, setHasil] = useState(null);

  const jalankan = async () => {
    setProses(true);
    try {
      const r = await bangunUlangKlik(ujianId);
      setHasil(r);
      onSelesai?.(r.link, r.tiruan);
      if (r.diperbaiki) toast.success(`${r.diperbaiki} penghitung klik dikoreksi dari jejak audit${r.tiruan ? ' (contoh)' : ''}.`);
      else toast.success(`Semua ${r.diperiksa} penghitung klik sudah sesuai jejak audit${r.tiruan ? ' (contoh)' : ''}.`);
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal membangun ulang penghitung klik.'));
    } finally {
      setProses(false);
      setKonfirmasi(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-3" aria-labelledby="judul-bangun-ulang" data-testid="panel-bangun-ulang-klik">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 id="judul-bangun-ulang" className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            <DatabaseZap className="h-4 w-4 text-[#006837]" /> Penghitung klik Mengerjakan
          </h2>
          <p className="text-xs text-slate-500">
            Angka klik di portal adalah salinan cepat dari jejak audit. Bila dicurigai selisih, hitung ulang dari jejak audit — log tidak diubah.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 gap-1.5" onClick={() => setKonfirmasi(true)} disabled={proses || !ujianId}
          data-testid="btn-bangun-ulang-klik">
          {proses ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DatabaseZap className="h-3.5 w-3.5" />} Bangun ulang penghitung
        </Button>
      </div>

      {hasil && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs" aria-live="polite" data-testid="hasil-bangun-ulang-klik">
          <p className="flex items-center gap-1.5 font-medium text-slate-700">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#006837]" />
            {hasil.diperbaiki
              ? `${hasil.diperbaiki} dari ${hasil.diperiksa} penghitung dikoreksi`
              : `Semua ${hasil.diperiksa} penghitung sudah sesuai`}
            <span className="font-normal text-slate-500">· {formatWIBPanjang(hasil.waktu)}</span>
          </p>
          {hasil.selisih?.length > 0 && (
            <ul className="mt-2 divide-y divide-slate-200">
              {hasil.selisih.map((s) => (
                <li key={`${s.jenjang}-${s.mapel}`} className="flex items-center justify-between gap-3 py-1.5" data-testid={`selisih-${s.jenjang}-${s.mapel}`}>
                  <span className="min-w-0 text-slate-700">{namaMapelUjian(s.mapel)} · {labelJenjang(s.jenjang)}</span>
                  <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
                    <span className="text-slate-400 line-through">{s.sebelum}</span>
                    <ArrowRight className="h-3 w-3 text-slate-400" aria-label="menjadi" />
                    <span className="font-semibold text-slate-900">{s.sesudah} klik</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <AlertDialog open={konfirmasi} onOpenChange={(o) => { if (!proses) setKonfirmasi(o); }}>
        <AlertDialogContent data-testid="konfirmasi-bangun-ulang-klik">
          <AlertDialogHeader>
            <AlertDialogTitle>Bangun ulang penghitung klik?</AlertDialogTitle>
            <AlertDialogDescription>
              Jumlah klik dan waktu klik terakhir setiap mapel di semua jenjang dihitung ulang dari jejak audit klik Mengerjakan,
              lalu angka di portal diganti dengan hasilnya. Jejak audit tidak diubah, dan perintah ini aman dijalankan ulang.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={proses}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); jalankan(); }} disabled={proses} className="gap-2 bg-[#006837] hover:bg-[#00552d]"
              data-testid="lanjut-bangun-ulang-klik">
              {proses ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseZap className="h-4 w-4" />} Bangun ulang
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
