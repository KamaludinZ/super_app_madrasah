import React from 'react';
import { UserRoundCog } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/**
 * Penanda slot hasil penugasan guru pengganti, pembeda dari jadwal reguler.
 * `originalTeacherName` (opsional) ditampilkan sebagai keterangan aksesibel/tooltip.
 */
export default function SubstituteBadge({ originalTeacherName, className = '' }) {
  const label = originalTeacherName ? `Guru Pengganti — menggantikan ${originalTeacherName}` : 'Guru Pengganti';
  return (
    <Badge
      className={`bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100 gap-1 whitespace-nowrap ${className}`}
      title={label}
      aria-label={label}
      data-testid="substitute-badge"
    >
      <UserRoundCog className="h-3 w-3" aria-hidden /> Guru Pengganti
    </Badge>
  );
}
