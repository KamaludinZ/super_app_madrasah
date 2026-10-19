import React from 'react';
import { Link } from 'react-router-dom';
import { Target, ShieldCheck, ShieldAlert } from 'lucide-react';
import { formatWIBPanjang } from '@/lib/datetime';
import { labelVersi } from '@/lib/pkgInstrumen';

// Penanda instrumen aktif yang menjadi acuan lembar penilaian baru.
// varian 'banner' (halaman Master Instrumen) atau 'lencana' (ringkas, menaut ke /pkg/instrumen).
export default function PenandaInstrumenAktif({ instrumen, varian = 'banner' }) {
  if (!instrumen) return null;
  const resmi = instrumen.cocok_resmi !== false;

  if (varian === 'lencana') {
    return (
      <Link
        to="/pkg/instrumen"
        className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
        title="Instrumen aktif acuan penilaian"
        data-testid="pkg-lencana-instrumen-aktif"
      >
        <Target className="h-3 w-3" /> Acuan: {labelVersi(instrumen)}
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border-2 border-[#006837]/30 bg-emerald-50/60 p-4 sm:flex-row sm:items-center" data-testid="pkg-penanda-instrumen-aktif">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#006837] text-white">
        <Target className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#006837]">Instrumen aktif · acuan penilaian</p>
        <p className="text-base font-bold text-slate-900">{labelVersi(instrumen)}</p>
        <p className="text-xs text-slate-600">
          Dipakai untuk setiap lembar penilaian baru{instrumen.diimpor_pada ? ` sejak ${formatWIBPanjang(instrumen.diimpor_pada)}` : ''}.
          Lembar yang sudah dibuat tetap memakai versi saat dibuat.
        </p>
      </div>
      <span className={`inline-flex shrink-0 items-center gap-1 text-xs font-medium ${resmi ? 'text-emerald-700' : 'text-amber-700'}`}>
        {resmi ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
        {resmi ? 'Sesuai template resmi' : 'Diubah dari template resmi'}
      </span>
    </div>
  );
}
