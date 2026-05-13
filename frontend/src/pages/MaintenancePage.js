import React, { useEffect, useState } from 'react';
import { Wrench, Clock, Coffee, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

function formatRemaining(iso) {
  if (!iso) return null;
  try {
    const now = Date.now();
    const target = new Date(iso).getTime();
    const diff = target - now;
    if (diff <= 0) return null;
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    if (h > 0) return `${h} jam ${m} menit lagi`;
    return `${m} menit lagi`;
  } catch { return null; }
}

export default function MaintenancePage() {
  const [info, setInfo] = useState({});
  const [tick, setTick] = useState(0);

  useEffect(() => {
    api.get('/settings').then(({ data }) => setInfo(data)).catch(() => {});
    const id = setInterval(() => {
      setTick((t) => t + 1);
      api.get('/settings').then(({ data }) => {
        if (!data.maintenance_mode) window.location.reload();
        setInfo(data);
      }).catch(() => {});
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const remaining = formatRemaining(info.maintenance_ends_at);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-br from-emerald-50 via-amber-50/30 to-emerald-100/40"
         data-testid="maintenance-page">
      <div className="max-w-lg w-full">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-emerald-200/50">
          <div className="bg-gradient-to-r from-[#006837] to-[#0B7A3B] px-6 py-8 text-white text-center">
            <div className="mx-auto h-20 w-20 rounded-2xl bg-white/15 flex items-center justify-center mb-4">
              <Wrench className="h-10 w-10 animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold">Sistem Sedang Dalam Pemeliharaan</h1>
            <p className="text-emerald-50/90 text-sm mt-1">
              {info.school_name || 'MTsN 2 Kota Malang'}
            </p>
          </div>
          <div className="px-6 py-6 space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-emerald-900 text-sm leading-relaxed">
                {info.maintenance_message ||
                  'Kami sedang memperbarui sistem untuk memberikan pengalaman yang lebih baik. Mohon menunggu beberapa saat.'}
              </p>
            </div>

            {remaining && (
              <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <Clock className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-xs text-slate-500">Estimasi selesai</p>
                  <p className="font-semibold text-amber-900">{remaining}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              <Coffee className="h-5 w-5 text-slate-600" />
              <p className="text-sm text-slate-700">
                Silakan istirahat sejenak, ngopi dulu :) Halaman ini akan refresh otomatis ketika sistem kembali normal.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Badge variant="outline" className="text-xs">
                {info.app_name || 'Super Apps MATSANDATAMA'}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="gap-1.5" data-testid="btn-retry-maintenance">
                <RefreshCw className={`h-3.5 w-3.5 ${tick % 2 ? 'animate-spin' : ''}`} /> Cek lagi
              </Button>
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-slate-500 mt-4">
          Terima kasih atas pengertian Anda. — Tim IT Madrasah
        </p>
      </div>
    </div>
  );
}
