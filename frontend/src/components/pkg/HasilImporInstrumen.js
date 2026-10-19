import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ShieldCheck, ShieldAlert, X } from 'lucide-react';
import { labelVersi } from '@/lib/pkgInstrumen';

// Ringkasan hasil impor instrumen yang baru diterapkan (ditampilkan sampai ditutup pengguna).
// `hasil` = { sumber, nama_berkas, cocok_resmi, kompetensi, sub, indikator, instrumen_sebelumnya }.
export default function HasilImporInstrumen({ hasil, onTutup }) {
  if (!hasil) return null;
  return (
    <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status" data-testid="pkg-hasil-impor">
      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold">Instrumen berhasil diimpor dan diterapkan.</p>
        <p>
          {hasil.kompetensi} kompetensi · {hasil.sub} sub-kompetensi · {hasil.indikator} indikator dari{' '}
          <span className="font-mono text-xs">{hasil.nama_berkas}</span>{hasil.sumber === 'template' ? ' (template resmi)' : ' (berkas unggahan)'}.
        </p>
        <p className={`flex items-center gap-1 text-xs ${hasil.cocok_resmi ? 'text-emerald-700' : 'text-amber-700'}`}>
          {hasil.cocok_resmi ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
          {hasil.cocok_resmi ? 'Checksum cocok dengan template resmi.' : 'Berkas bukan salinan identik template resmi.'}
        </p>
        {hasil.instrumen_sebelumnya && (
          <p className="text-xs text-emerald-800">
            Instrumen sebelumnya ({labelVersi(hasil.instrumen_sebelumnya)}) tetap tersimpan dan dipakai oleh penilaian yang sudah berjalan.
          </p>
        )}
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-emerald-800" onClick={onTutup} aria-label="Tutup ringkasan"><X className="h-4 w-4" /></Button>
    </div>
  );
}
