import { History } from 'lucide-react';

/** Pemberitahuan bahwa pengguna sedang melihat data tahun lain lewat "Konteks Lihat" pribadinya. */
export function ViewYearNotice({ viewYear }) {
  if (!viewYear?.isOverride) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" data-testid="view-year-notice">
      <History className="h-4 w-4 mt-0.5 shrink-0" />
      <span>
        Anda sedang melihat data <b>tahun {viewYear.year}</b>
        {viewYear.label ? ` (${viewYear.label})` : ''}. Pilihan ini hanya berlaku untuk akun Anda;
        kembalikan ke tahun aktif lewat tombol konteks lihat di bagian atas.
      </span>
    </div>
  );
}
