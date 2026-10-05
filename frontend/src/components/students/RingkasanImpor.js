import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, Download, MinusCircle, XCircle } from 'lucide-react';

/** Baris laporan kesalahan (untuk diunduh) dari hasil impor. */
export function barisLaporanKesalahan(hasil) {
  return [
    ['Baris Excel', 'Identitas', 'Kolom', 'Status', 'Keterangan'],
    ...hasil.filter((h) => h.status === 'gagal').map((h) => [h.baris, h.identitas || '-', h.kolom || '-', 'Gagal', h.pesan || '']),
  ];
}

async function unduhLaporan(hasil, namaBerkas) {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet(barisLaporanKesalahan(hasil));
  ws['!cols'] = [{ wch: 11 }, { wch: 22 }, { wch: 28 }, { wch: 8 }, { wch: 70 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Kesalahan Impor');
  XLSX.writeFile(wb, namaBerkas);
}

function Kotak({ icon: Icon, label, nilai, warna }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${warna}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide opacity-80"><Icon className="h-3.5 w-3.5" /> {label}</div>
      <div className="text-xl font-bold tabular-nums">{nilai}</div>
    </div>
  );
}

/**
 * Ringkasan hasil impor + daftar kesalahan per baris (lokasi baris Excel, identitas,
 * kolom bermasalah, keterangan) dan unduhan laporan kesalahan.
 * `hasil` = { mode, tiruan, dibatalkan, ringkasan: {total, diproses, berhasil, tanpa_perubahan, gagal}, hasil: [...] }
 */
export default function RingkasanImpor({ hasil, dilewati, namaData = 'data' }) {
  const [semua, setSemua] = useState(false);
  const r = hasil.ringkasan;
  const gagal = hasil.hasil.filter((h) => h.status === 'gagal');
  const tampil = semua ? hasil.hasil : gagal;
  const dilewatiTotal = (dilewati?.kosong || 0) + (dilewati?.keterangan || 0);

  return (
    <div className="space-y-3" data-testid="ringkasan-hasil-impor">
      <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${hasil.tiruan ? 'border-amber-200 bg-amber-50 text-amber-800' : r.gagal ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
        {r.gagal || hasil.tiruan ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
        <div>
          <div className="font-semibold">
            {hasil.tiruan ? 'Hasil tiruan — data belum disimpan' : hasil.dibatalkan ? 'Impor dihentikan' : 'Impor selesai'}
            {' · '}mode {hasil.mode === 'timpa' ? 'timpa nilai berbeda' : 'isi hanya yang kosong'}
          </div>
          <div>
            {r.diproses} dari {r.total} baris {namaData} diproses
            {dilewatiTotal > 0 && `; ${dilewatiTotal} baris kosong/keterangan dilewati`}.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Kotak icon={CheckCircle2} label="Berhasil" nilai={r.berhasil} warna="border-emerald-200 bg-emerald-50 text-emerald-800" />
        <Kotak icon={MinusCircle} label="Tanpa perubahan" nilai={r.tanpa_perubahan || 0} warna="border-slate-200 bg-slate-50 text-slate-700" />
        <Kotak icon={XCircle} label="Gagal" nilai={r.gagal} warna="border-rose-200 bg-rose-50 text-rose-800" />
        <Kotak icon={AlertTriangle} label="Tidak diproses" nilai={r.total - r.diproses} warna="border-amber-200 bg-amber-50 text-amber-800" />
      </div>

      {hasil.hasil.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium text-slate-800">
              {semua ? 'Rincian semua baris' : gagal.length ? `Daftar kesalahan (${gagal.length} baris)` : 'Tidak ada kesalahan'}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSemua((v) => !v)} className="h-7 text-xs">
                {semua ? 'Hanya kesalahan' : 'Tampilkan semua baris'}
              </Button>
              {gagal.length > 0 && (
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => unduhLaporan(hasil.hasil, `Laporan_Kesalahan_Impor_${namaData}.xlsx`)} data-testid="btn-unduh-laporan-kesalahan">
                  <Download className="h-3.5 w-3.5" /> Unduh laporan
                </Button>
              )}
            </div>
          </div>
          {tampil.length > 0 && (
            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs" data-testid="tabel-kesalahan-impor">
                <thead className="sticky top-0 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Baris</th>
                    <th className="px-2 py-1.5 text-left">Identitas</th>
                    <th className="px-2 py-1.5 text-left">Kolom</th>
                    <th className="px-2 py-1.5 text-left">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {tampil.map((h) => (
                    <tr key={h.baris} className={`border-t border-slate-100 ${h.status === 'gagal' ? 'text-rose-800' : 'text-slate-700'}`}>
                      <td className="px-2 py-1 font-mono">{h.baris}</td>
                      <td className="px-2 py-1 font-mono">{h.identitas || '-'}</td>
                      <td className="px-2 py-1">{h.kolom || '-'}</td>
                      <td className="px-2 py-1">{h.pesan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
