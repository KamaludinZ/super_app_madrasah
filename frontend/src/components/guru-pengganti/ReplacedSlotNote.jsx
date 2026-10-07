import React from 'react';
import { Link } from 'react-router-dom';
import { UserRoundCog } from 'lucide-react';

/**
 * Keterangan pada slot milik guru asli yang hari ini digantikan.
 * Slot tetap terbuka: guru asli masih bisa mengisi jurnalnya sendiri (tersimpan berdampingan).
 */
export default function ReplacedSlotNote({ substitute }) {
  if (!substitute) return null;
  return (
    <Link
      to={`/guru-pengganti/jurnal/${substitute.assignment_id}`}
      className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[11px] text-amber-800 hover:bg-amber-100"
      title="Lihat jurnal berdampingan"
      data-testid={`replaced-note-${substitute.assignment_id}`}
    >
      <UserRoundCog className="h-3 w-3" aria-hidden />
      Digantikan {substitute.substitute_teacher_name || 'guru lain'}
      <span className="text-amber-600">· jurnal pengganti {substitute.journal_filled ? 'terisi' : 'belum diisi'}</span>
    </Link>
  );
}
