import React from 'react';
import { Eye } from 'lucide-react';

// Penanda halaman Tata Tertib sedang dibuka peran read-only.
export default function BannerModeLihat({ children = 'Mode lihat saja — perubahan data tata tertib hanya oleh admin, guru tata tertib, dan waka kesiswaan.' }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600" data-testid="tatib-mode-lihat">
      <Eye className="h-4 w-4 shrink-0" />
      {children}
    </div>
  );
}
