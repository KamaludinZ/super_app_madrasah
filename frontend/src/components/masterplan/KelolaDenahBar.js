import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, RefreshCw, Trash2, Settings2, MapPinned, Check } from 'lucide-react';

const formatTanggal = (iso) => {
  if (!iso) return '-';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

// Bilah kelola denah (khusus admin): info denah aktif + aksi unggah / ganti / hapus + mode atur penanda.
export default function KelolaDenahBar({ denah, jumlahPenanda = 0, onUnggah, onHapus, sibuk = false, modeAtur = false, onModeAtur }) {
  return (
    <Card className="border-dashed" data-testid="masterplan-kelola-denah">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Settings2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Kelola Denah</p>
            <p className="text-xs text-slate-500">
              {denah
                ? `Denah aktif diperbarui ${formatTanggal(denah.updated_at)} · ${jumlahPenanda} penanda ruang`
                : 'Belum ada denah aktif'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {denah && onModeAtur && (
            <Button
              variant={modeAtur ? 'default' : 'outline'}
              onClick={() => onModeAtur(!modeAtur)}
              aria-pressed={modeAtur}
              className={modeAtur ? 'bg-amber-500 hover:bg-amber-600' : ''}
              data-testid="masterplan-mode-atur"
            >
              {modeAtur ? <Check className="mr-2 h-4 w-4" /> : <MapPinned className="mr-2 h-4 w-4" />}
              {modeAtur ? 'Selesai mengatur' : 'Atur penanda'}
            </Button>
          )}
          <Button onClick={onUnggah} disabled={sibuk} className="bg-[#006837] hover:bg-[#005830]" data-testid="masterplan-unggah">
            {denah ? <RefreshCw className="mr-2 h-4 w-4" /> : <Upload className="mr-2 h-4 w-4" />}
            {denah ? 'Ganti denah' : 'Unggah denah'}
          </Button>
          {denah && (
            <Button variant="outline" onClick={onHapus} disabled={sibuk} className="text-red-600 hover:bg-red-50 hover:text-red-700" data-testid="masterplan-hapus-denah">
              <Trash2 className="mr-2 h-4 w-4" /> Hapus denah
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
