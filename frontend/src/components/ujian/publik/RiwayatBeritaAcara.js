import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, History } from 'lucide-react';
import { formatWIB } from '@/lib/datetime';
import { muatRiwayatBa } from '@/lib/ujianPublik';

/**
 * Riwayat berita acara hari ini pada tautan publik: ruang mana yang sudah dilaporkan pengawas pada sesi aktif (nama
 * pengawas & jam kirim) dan ruang yang belum. `segarkan` memuat ulang setelah kiriman baru.
 */
export default function RiwayatBeritaAcara({ token, ruangList = [], sesi, segarkan = 0 }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let hidup = true;
    muatRiwayatBa(token).then((d) => { if (hidup) setData(d); }).catch(() => {});
    return () => { hidup = false; };
  }, [token, segarkan]);
  if (!data || !sesi) return null;
  const sudah = Object.fromEntries(data.items.filter((i) => i.sesi_id === sesi.id).map((i) => [i.ruang_id, i]));
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="ba-riwayat">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900"><History className="h-4 w-4 text-[#006837]" /> Berita acara sesi ini</h2>
      <ul className="divide-y divide-slate-100 text-sm">
        {ruangList.map((r) => {
          const b = sudah[r.id];
          return (
            <li key={r.id} className="flex items-center gap-2 py-2" data-testid={`ba-riwayat-${r.id}`}>
              {b ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="h-4 w-4 shrink-0 text-slate-300" />}
              <span className="w-20 shrink-0 font-medium">Ruang {r.nama_ruang}</span>
              <span className="min-w-0 flex-1 truncate text-slate-600">
                {b ? `${b.pengawas_nama} · ${formatWIB(b.waktu_kirim, 'Time', { hour: '2-digit', minute: '2-digit' })} WIB` : 'Belum dilaporkan'}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
