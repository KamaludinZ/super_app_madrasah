import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Briefcase, ExternalLink, Megaphone } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import { api, ROLE_LABELS } from '@/lib/api';

export default function StaffDashboard() {
  const { user, activeRole } = useAuth();
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    try {
      const { data } = await api.get('/announcements');
      setAnnouncements(data.slice(0, 3)); // Show only 3 latest
    } catch (e) {}
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'warning': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'success': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default: return 'bg-sky-100 text-sky-800 border-sky-200';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">Dashboard {ROLE_LABELS[activeRole]}</Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Assalamu'alaikum, {user?.full_name?.split(' ')[0]}</h1>
        <p className="text-sm text-slate-600 mt-1">Selamat datang di Super Apps MATSANDATAMA</p>
      </div>

      {/* Pengumuman Section */}
      {announcements.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-lg">Pengumuman</CardTitle>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/pengumuman">Lihat Semua</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {announcements.map((ann) => (
              <div
                key={ann.id}
                className={`p-3 rounded-lg border ${getSeverityColor(ann.severity)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">{ann.title}</h3>
                    <p className="text-xs mt-1 line-clamp-2">{ann.body}</p>
                  </div>
                  {ann.is_pinned && (
                    <Badge variant="outline" className="text-xs">Pinned</Badge>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
