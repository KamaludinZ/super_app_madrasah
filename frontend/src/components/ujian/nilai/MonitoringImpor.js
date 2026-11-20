import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, FileSpreadsheet, Loader2 } from 'lucide-react';
import { formatWIBPanjang } from '@/lib/datetime';
import { aksesDitolak, pesanGalat } from '@/lib/ujian';
import { STATUS_IMPOR, muatRiwayatImpor } from '@/lib/ujianNilai';
import AksesDitolak from '@/components/security/AksesDitolak';

export function BadgeStatusImpor({ status }) {
  const s = STATUS_IMPOR[status] || STATUS_IMPOR.proses;
  return <Badge className={`${s.kelas} gap-1`} data-testid="badge-status-impor">{status === 'proses' && <Loader2 className="h-3 w-3 animate-spin" />}{s.label}</Badge>;
}

/**
 * Monitoring Impor: riwayat impor nilai UAS satu ujian (terbaru dulu) dengan status, jumlah baris berhasil & gagal,
 * dan ringkasan per sheet kelas. `onPilih(log)` membuka rincian galat.
 */
export default function MonitoringImpor({ ujian, segarkan = 0, onPilih, dipilihId }) {
  const [data, setData] = useState(null);
  const [ditolak, setDitolak] = useState('');

  const muat = useCallback(async () => {
    try {
      setData(await muatRiwayatImpor(ujian.id));
      setDitolak('');
    } catch (e) {
      if (aksesDitolak(e)) setDitolak(pesanGalat(e, 'Akses ditolak.'));
      else toast.error(pesanGalat(e, 'Gagal memuat riwayat impor.'));
    }
  }, [ujian]);
  useEffect(() => { muat(); }, [muat, segarkan]);

  const [saring, setSaring] = useState('semua');
  const semua = useMemo(() => data?.items || [], [data]);
  const items = saring === 'semua' ? semua : semua.filter((l) => l.status === saring);
  if (ditolak) return <AksesDitolak halaman="Nilai UAS" untuk="admin serta ketua dan sekretaris panitia" pesan={ditolak} />;
  const total = items.reduce((a, l) => ({ berhasil: a.berhasil + (l.berhasil || 0), gagal: a.gagal + (l.gagal || 0) }), { berhasil: 0, gagal: 0 });

  return (
    <Card data-testid="monitoring-impor">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4 text-[#006837]" /> Monitoring Impor Nilai</CardTitle>
        {data?.tiruan && <p className="text-xs text-amber-700">Server belum menyediakan data impor — menampilkan data contoh.</p>}
        {items.length > 0 && (
          <p className="text-xs text-slate-500">{items.length} impor · {total.berhasil} baris berhasil · {total.gagal} baris gagal</p>
        )}
      </CardHeader>
      <CardContent>
        {semua.length > 1 && (
          <div role="group" aria-label="Saring status impor" className="mb-2 flex flex-wrap gap-1.5">
            {[['semua', 'Semua'], ['proses', 'Diproses'], ['selesai', 'Selesai'], ['gagal', 'Gagal']].map(([k, label]) => (
              <button key={k} type="button" onClick={() => setSaring(k)} aria-pressed={saring === k}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${saring === k ? 'border-[#006837] bg-[#006837] text-white' : 'border-slate-200 text-slate-600 hover:bg-emerald-50'}`}
                data-testid={`saring-impor-${k}`}>
                {label} ({k === 'semua' ? semua.length : semua.filter((l) => l.status === k).length})
              </button>
            ))}
          </div>
        )}
        {!data ? <div className="p-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-[#006837]" /></div>
          : items.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">{semua.length ? 'Tidak ada impor dengan status ini.' : 'Belum ada impor nilai UAS untuk ujian ini.'}</p> : (
            <ul className="divide-y divide-slate-100" data-testid="riwayat-impor">
              {items.map((l) => (
                <li key={l.id}>
                  <button type="button" onClick={() => onPilih?.(l)} disabled={!onPilih} aria-pressed={dipilihId === l.id}
                    className={`flex w-full flex-col gap-1 rounded-lg px-2 py-3 text-left transition-colors ${onPilih ? 'hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837]' : ''} ${dipilihId === l.id ? 'bg-emerald-50' : ''}`}
                    data-testid={`impor-${l.id}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-[#006837]" />
                      <span className="text-sm font-medium text-slate-900">{l.mapel_nama} · Kelas {l.jenjang}</span>
                      <BadgeStatusImpor status={l.status} />
                    </div>
                    <div className="text-xs text-slate-500">{l.berkas} · {l.diunggah_oleh_nama} · {formatWIBPanjang(l.waktu)}</div>
                    {l.status === 'gagal' && l.pesan ? <div className="text-xs text-rose-700">{l.pesan}</div> : (
                      <div className="flex flex-wrap gap-x-3 text-xs">
                        <span className="text-emerald-700">{l.berhasil} berhasil</span>
                        <span className={l.gagal ? 'text-rose-700' : 'text-slate-400'}>{l.gagal} gagal</span>
                        {l.per_sheet?.map((s) => <span key={s.sheet} className="text-slate-500">{s.sheet}: {s.berhasil}/{s.total}</span>)}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
      </CardContent>
    </Card>
  );
}
