import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Megaphone, Pin, Eye, EyeOff } from 'lucide-react';
import { api, ROLE_LABELS } from '@/lib/api';
import { toast } from 'sonner';

const SEVERITIES = [
  { v: 'info', label: 'Info', color: 'bg-sky-100 text-sky-800' },
  { v: 'success', label: 'Sukses', color: 'bg-emerald-100 text-emerald-800' },
  { v: 'warning', label: 'Peringatan', color: 'bg-amber-100 text-amber-800' },
  { v: 'critical', label: 'Penting', color: 'bg-rose-100 text-rose-800' },
];

export default function WakaKurPengumumanPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/announcements');
      setItems(data || []);
    } catch {
      toast.error('Gagal memuat pengumuman');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const getSeverityColor = (severity) => {
    const sev = SEVERITIES.find(s => s.v === severity);
    return sev ? sev.color : 'bg-slate-100 text-slate-800';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <Megaphone className="h-3 w-3 mr-1" /> Pengumuman (Waka Kurikulum)
          </Badge>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-[#006837]" /> Pengumuman
          </h1>
          <p className="text-sm text-slate-500">Lihat pengumuman madrasah (Read-Only)</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar Pengumuman ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-slate-500">Memuat…</div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Megaphone className="h-8 w-8 mx-auto text-slate-300 mb-2" />
              Belum ada pengumuman.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((a) => (
                <div key={a.id}
                     className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50">
                  <div className="flex flex-col items-center gap-1 pt-0.5">
                    {a.is_pinned && (
                      <Pin className="h-4 w-4 text-amber-600" title="Dipin" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{a.title}</p>
                      <Badge variant="outline" className={`capitalize ${getSeverityColor(a.severity)}`}>
                        {SEVERITIES.find(s => s.v === a.severity)?.label || a.severity}
                      </Badge>
                      {!a.is_active && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <EyeOff className="h-3 w-3" />
                          Nonaktif
                        </Badge>
                      )}
                      {a.is_active && (
                        <Badge variant="outline" className="flex items-center gap-1 bg-green-50 text-green-700 border-green-200">
                          <Eye className="h-3 w-3" />
                          Aktif
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{a.body}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      <span className="text-[10px] text-slate-500 font-medium">Target:</span>
                      {(a.target_roles || []).map((r) => (
                        <Badge key={r} variant="outline" className="text-[10px] py-0">
                          {r === 'all' ? 'Semua Peran' : (ROLE_LABELS[r] || r)}
                        </Badge>
                      ))}
                    </div>
                    {(a.starts_at || a.ends_at) && (
                      <div className="text-[10px] text-slate-500 mt-1.5">
                        {a.starts_at && <span>Mulai: {new Date(a.starts_at).toLocaleString('id-ID')}</span>}
                        {a.starts_at && a.ends_at && <span className="mx-1">•</span>}
                        {a.ends_at && <span>Sampai: {new Date(a.ends_at).toLocaleString('id-ID')}</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
