import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, FileClock, Loader2 } from 'lucide-react';
import DaftarPengajuanSaya from '@/components/izin/DaftarPengajuanSaya';
import { STATUS_IZIN, saringStatus, urutTerbaru } from '@/lib/izinKamad';

const FILTER = ['semua', 'menunggu', 'disetujui', 'ditolak', 'dibatalkan'];
// Saringan yang selalu tampil; "Dibatalkan" hanya bila ada pengajuan yang dibatalkan.
const FILTER_TETAP = ['semua', 'menunggu', 'disetujui', 'ditolak'];

/**
 * Panel "Pengajuan Saya": daftar pengajuan izin sendiri dengan saringan status. Hanya-lihat kecuali
 * `onBatalkan` diberikan; `tautanKelola` menampilkan tautan ke halaman pengajuan (dari dashboard).
 */
export default function PanelPengajuanSaya({ items = [], memuat = false, className = '', onPilih, onBatalkan, sibukId, tautanKelola }) {
  const [filter, setFilter] = useState('semua');
  const terurut = [...items].sort(urutTerbaru);
  const jumlah = (f) => saringStatus(items, f).length;

  return (
    <Card className={className} data-testid="panel-pengajuan-saya">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileClock className="h-4 w-4 text-[#006837]" /> Pengajuan Saya
          </CardTitle>
          {tautanKelola && (
            <Link to={tautanKelola} className="text-xs text-[#006837] font-semibold flex items-center gap-1 hover:underline shrink-0" data-testid="tautan-kelola-pengajuan">
              Ajukan / kelola <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
        <p className="text-xs text-slate-500">Status izin yang Anda ajukan, terbaru di atas.</p>
        <div className="flex flex-wrap gap-1.5 pt-1" role="tablist" aria-label="Saring status pengajuan">
          {FILTER.filter((f) => FILTER_TETAP.includes(f) || jumlah(f) > 0 || filter === f).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${filter === f ? 'border-[#006837] bg-[#006837] text-white' : 'border-slate-200 text-slate-600 hover:border-[#006837]/40'}`}
              data-testid={`filter-pengajuan-${f}`}
            >
              {f === 'semua' ? 'Semua' : STATUS_IZIN[f].label} <span className="tabular-nums opacity-80">{jumlah(f)}</span>
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {memuat && items.length === 0 ? (
          <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>
        ) : (
          <DaftarPengajuanSaya
            items={saringStatus(terurut, filter)}
            onPilih={onPilih}
            onBatalkan={onBatalkan}
            sibukId={sibukId}
            kosong={filter === 'semua' ? 'Belum ada pengajuan izin' : `Tidak ada pengajuan berstatus ${STATUS_IZIN[filter].label.toLowerCase()}`}
          />
        )}
      </CardContent>
    </Card>
  );
}
