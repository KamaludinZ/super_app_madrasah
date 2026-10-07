import React from 'react';
import { Link } from 'react-router-dom';
import { UserRoundCog } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/** Teks kolom "diisi oleh" (juga dipakai untuk ekspor Excel). */
export function filledByText(j) {
  if (j.diisi_oleh) return j.diisi_oleh; // teks dari server (GET /jurnal/my, /admin/jurnal)
  if (j.fill_mode === 'substitute') return j.substitute_label || `pengganti: ${j.filled_by_name || '-'}`;
  if (j.fill_mode === 'piket') return `piket: ${j.filled_by_name || '-'}`;
  if (j.fill_mode === 'admin') return `admin${j.filled_by_name ? `: ${j.filled_by_name}` : ''}`;
  return j.filled_by_name || j.teacher_name || 'Pengajar';
}

/** Badge ringkas "pengganti: nama" untuk tabel/dialog jurnal lain (admin, waka, kelas). */
export function SubstituteFilledBadge({ journal, className = '' }) {
  return (
    <Badge
      className={`bg-amber-100 text-amber-800 border-amber-300 gap-1 ${className}`}
      title={journal.teacher_name ? `Menggantikan ${journal.teacher_name}` : undefined}
      data-testid={`fill-badge-substitute-${journal.id}`}
    >
      <UserRoundCog className="h-3 w-3" aria-hidden /> {filledByText(journal)}
    </Badge>
  );
}

function SideBySideLink({ assignmentId }) {
  if (!assignmentId) return null;
  return (
    <Link to={`/guru-pengganti/jurnal/${assignmentId}`} className="text-[11px] text-[#006837] hover:underline">
      Lihat berdampingan
    </Link>
  );
}

/**
 * Isi kolom "Diisi oleh" pada riwayat jurnal. Catatan guru pengganti berlabel
 * "pengganti: nama guru pengganti" dan tampil di akun guru asli maupun guru pengganti.
 */
export default function FilledByCell({ journal: j }) {
  if (j.fill_mode === 'substitute') {
    return (
      <div className="space-y-0.5" data-testid={`journal-substitute-${j.id}`}>
        <Badge className="bg-amber-100 text-amber-800 border-amber-300 gap-1">
          <UserRoundCog className="h-3 w-3" aria-hidden /> {filledByText(j)}
        </Badge>
        {j.teacher_name && (
          <div className="text-[11px] text-slate-500">
            {j.filled_by_me === false ? 'Slot Anda' : `Menggantikan ${j.teacher_name}`}
          </div>
        )}
        <SideBySideLink assignmentId={j.substitute_assignment_id} />
      </div>
    );
  }
  if (j.fill_mode === 'piket') {
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200">✋ {filledByText(j)}</Badge>;
  }
  if (j.fill_mode === 'admin') {
    return <Badge className="bg-purple-100 text-purple-700 border-purple-200">{filledByText(j)}</Badge>;
  }
  return (
    <div className="space-y-0.5">
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Pengajar</Badge>
      {(j.filled_by_name || j.teacher_name) && (
        <div className="text-[11px] text-slate-600">{j.filled_by_name || j.teacher_name}</div>
      )}
      {j.replaced_assignment_id && (
        <>
          <div className="text-[11px] text-amber-700">Diisi saat digantikan</div>
          <SideBySideLink assignmentId={j.replaced_assignment_id} />
        </>
      )}
    </div>
  );
}
