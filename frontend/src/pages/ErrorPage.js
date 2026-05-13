import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeft, AlertTriangle, ShieldX, ServerCrash } from 'lucide-react';

const ERROR_CONFIGS = {
  404: {
    code: '404',
    title: 'Halaman Tidak Ditemukan',
    description: 'Maaf, halaman yang Anda cari tidak tersedia atau sudah dipindahkan.',
    Icon: ShieldX,
    accent: 'text-amber-600 bg-amber-50',
  },
  500: {
    code: '500',
    title: 'Terjadi Kesalahan Server',
    description: 'Sistem mengalami gangguan. Tim kami akan segera memperbaikinya.',
    Icon: ServerCrash,
    accent: 'text-rose-600 bg-rose-50',
  },
  403: {
    code: '403',
    title: 'Akses Ditolak',
    description: 'Anda tidak memiliki izin untuk mengakses halaman ini. Silakan hubungi administrator.',
    Icon: ShieldX,
    accent: 'text-rose-600 bg-rose-50',
  },
  generic: {
    code: 'Oops',
    title: 'Terjadi Kesalahan',
    description: 'Ada masalah saat memuat halaman ini.',
    Icon: AlertTriangle,
    accent: 'text-amber-600 bg-amber-50',
  },
};

export default function ErrorPage({ code = 404, title, description }) {
  const config = ERROR_CONFIGS[code] || ERROR_CONFIGS.generic;
  const Icon = config.Icon;
  const nav = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-[var(--cream,#FAF8F1)]">
      <div className="max-w-md w-full text-center space-y-6" data-testid={`error-page-${code}`}>
        <div className={`mx-auto h-24 w-24 rounded-3xl ${config.accent} flex items-center justify-center`}>
          <Icon className="h-12 w-12" />
        </div>
        <div className="space-y-2">
          <p className="text-7xl font-extrabold text-[#006837] tracking-tight">{config.code}</p>
          <h1 className="text-2xl font-bold text-slate-900">{title || config.title}</h1>
          <p className="text-slate-600">{description || config.description}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button variant="outline" onClick={() => nav(-1)} className="gap-2" data-testid="btn-go-back">
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Button>
          <Button asChild className="bg-[#006837] hover:bg-[#005a30] gap-2">
            <Link to="/dashboard" data-testid="btn-go-home">
              <Home className="h-4 w-4" /> Ke Dashboard
            </Link>
          </Button>
        </div>
        <div className="pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            Super Apps MATSANDATAMA — MTsN 2 Kota Malang
          </p>
        </div>
      </div>
    </div>
  );
}
