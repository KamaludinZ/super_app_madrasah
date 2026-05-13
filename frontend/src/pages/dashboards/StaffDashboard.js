import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Briefcase, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import { ROLE_LABELS } from '@/lib/api';

export default function StaffDashboard() {
  const { user, activeRole } = useAuth();
  return (
    <div className="space-y-6">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">Dashboard {ROLE_LABELS[activeRole]}</Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Assalamu'alaikum, {user?.full_name?.split(' ')[0]}</h1>
        <p className="text-sm text-slate-600 mt-1">Selamat datang di Super Apps MATSANDATAMA</p>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#006837]/10 flex items-center justify-center shrink-0">
              <Briefcase className="h-5 w-5 text-[#006837]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Peran Anda</h2>
              <p className="text-sm text-slate-600 mt-1">
                Anda terdaftar dengan peran <strong>{ROLE_LABELS[activeRole]}</strong>. Modul khusus untuk peran ini akan terus dikembangkan secara bertahap.
              </p>
              {user?.roles?.length > 1 && (
                <p className="text-xs text-slate-500 mt-2">
                  Anda juga memiliki peran tambahan: {user.roles.filter((r) => r !== activeRole).map((r) => ROLE_LABELS[r]).join(', ')}. Gunakan tombol peran di pojok kanan atas untuk berganti tampilan.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-3">Informasi Sekolah</h2>
          <Link to="/public/monitoring" target="_blank" rel="noopener" className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200 hover:border-emerald-300 transition-colors">
            <div>
              <div className="font-semibold text-emerald-900">Monitoring Jurnal Realtime</div>
              <div className="text-xs text-emerald-800/80">Pantau pengisian jurnal seluruh kelas</div>
            </div>
            <ExternalLink className="h-4 w-4 text-emerald-700" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
