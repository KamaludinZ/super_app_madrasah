import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { ROLE_LABELS } from '@/lib/api';

/**
 * Pesan akses ditolak untuk halaman yang dibatasi peran (ditampilkan, bukan dialihkan diam-diam).
 * `untuk`: siapa yang berhak, mis. "kepala madrasah"; `pesan`: pesan khusus (mis. detail 403 server).
 * Bila pengguna memiliki peran yang berhak (`peranBerhak`), disarankan berganti peran.
 */
export default function AksesDitolak({ halaman, untuk, pesan, peranBerhak = [] }) {
  const { user, activeRole } = useAuth();
  const punya = (user?.roles || []).filter((r) => peranBerhak.includes(r) && r !== activeRole);
  return (
    <Card className="mx-auto max-w-xl border-amber-200" data-testid="akses-ditolak">
      <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
          <ShieldAlert className="h-6 w-6 text-amber-600" />
        </div>
        <h1 className="text-lg font-semibold text-slate-900">Akses ditolak</h1>
        <p className="text-sm text-slate-600">
          {pesan || `${halaman ? `Halaman ${halaman}` : 'Halaman ini'} hanya untuk ${untuk}.`}
          {activeRole && <> Peran aktif Anda: <strong>{ROLE_LABELS[activeRole] || activeRole}</strong>.</>}
        </p>
        {punya.length > 0 && (
          <p className="text-xs text-slate-500">
            Anda juga memiliki peran {punya.map((r) => ROLE_LABELS[r] || r).join(', ')} — ganti peran lewat menu akun di pojok kanan atas.
          </p>
        )}
        <Button asChild variant="outline" className="mt-1">
          <Link to="/dashboard">Kembali ke Dashboard</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
