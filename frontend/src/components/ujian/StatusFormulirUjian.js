import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import BadgeStatusFormulir from '@/components/ujian/BadgeStatusFormulir';
import { rentangTanggal } from '@/components/ujian/DaftarUjian';
import { useAuth } from '@/lib/AuthContext';
import { JENIS_UJIAN, muatBerandaUjian } from '@/lib/ujian';

/**
 * Status formulir semua ujian semester aktif dalam satu baris kartu yang bisa dipindai; klik kartu memilih ujian itu
 * (?ujian=<id>). `segarkan` (angka) memaksa muat ulang setelah aktivasi berubah.
 */
export default function StatusFormulirUjian({ segarkan = 0 }) {
  const { activeRole } = useAuth();
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const dipilih = params.get('ujian');

  useEffect(() => {
    let hidup = true;
    muatBerandaUjian(activeRole).then((d) => { if (hidup) setItems(d.items); }).catch(() => {});
    return () => { hidup = false; };
  }, [activeRole, segarkan]);

  if (items.length < 2) return null;
  return (
    <nav aria-label="Status formulir per ujian" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" data-testid="status-formulir-ujian">
      {items.map((u) => (
        <button key={u.id} type="button" aria-current={u.id === dipilih ? 'true' : undefined}
          onClick={() => setParams((p) => { const q = new URLSearchParams(p); q.set('ujian', u.id); return q; })}
          className={`flex min-w-[13rem] shrink-0 flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837] ${
            u.id === dipilih ? 'border-[#006837] bg-emerald-50' : 'border-slate-200 bg-white hover:border-[#006837]/40'}`}
          data-testid={`status-ujian-${u.id}`}>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{(JENIS_UJIAN[u.jenis] || {}).label} · {rentangTanggal(u.mulai, u.selesai)}</span>
          <span className="line-clamp-1 text-sm font-medium text-slate-900">{u.nama}</span>
          <BadgeStatusFormulir formulir={u.formulir} />
        </button>
      ))}
    </nav>
  );
}
