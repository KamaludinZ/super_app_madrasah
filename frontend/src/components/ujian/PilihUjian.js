import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { JENIS_UJIAN, muatBerandaUjian } from '@/lib/ujian';
import { hariIniWIB } from '@/lib/tanggal';

// Ujian bawaan: yang sedang berlangsung, lalu yang terdekat akan datang, lalu yang terakhir.
export function ujianBawaan(items = [], hariIni = hariIniWIB()) {
  if (!items.length) return null;
  return items.find((u) => u.mulai <= hariIni && hariIni <= u.selesai)
    || [...items].filter((u) => u.mulai > hariIni).sort((a, b) => a.mulai.localeCompare(b.mulai))[0]
    || [...items].sort((a, b) => b.mulai.localeCompare(a.mulai))[0];
}

/**
 * Pemilih ujian semester aktif untuk halaman-halaman kepanitiaan. Pilihan disimpan di URL (?ujian=<id>) agar dapat
 * dibagikan/dimuat ulang. `onUbah(ujian | null, { tiruan })` dipanggil saat daftar dimuat & saat pilihan berganti.
 * `saring(ujian)` opsional membatasi pilihan (mis. hanya ujian tempat pengguna berhak).
 */
export default function PilihUjian({ onUbah, saring, label = 'Ujian' }) {
  const { activeRole } = useAuth();
  const [params, setParams] = useSearchParams();
  const [daftar, setDaftar] = useState(null);
  const [tiruan, setTiruan] = useState(false);
  const [galat, setGalat] = useState('');
  const dipilih = params.get('ujian');

  useEffect(() => {
    let hidup = true;
    muatBerandaUjian(activeRole)
      .then((d) => {
        if (!hidup) return;
        setDaftar(saring ? d.items.filter(saring) : d.items);
        setTiruan(d.tiruan);
      })
      .catch(() => { if (hidup) { setDaftar([]); setGalat('Gagal memuat daftar ujian.'); } });
    return () => { hidup = false; };
  }, [activeRole, saring]);

  const ujian = daftar ? (daftar.find((u) => u.id === dipilih) || ujianBawaan(daftar)) : null;

  useEffect(() => {
    if (!daftar) return;
    if (ujian && ujian.id !== dipilih) setParams((p) => { const q = new URLSearchParams(p); q.set('ujian', ujian.id); return q; }, { replace: true });
    onUbah?.(ujian || null, { tiruan });
  }, [daftar, ujian?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!daftar) return <div className="flex h-10 items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Memuat ujian…</div>;
  if (galat) return <p className="text-sm text-rose-700" role="alert">{galat}</p>;
  if (!daftar.length) return <p className="text-sm text-slate-500">Belum ada ujian pada semester ini.</p>;

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
      <label htmlFor="pilih-ujian" className="text-sm font-medium text-slate-700">{label}</label>
      <select
        id="pilih-ujian"
        value={ujian?.id || ''}
        onChange={(e) => setParams((p) => { const q = new URLSearchParams(p); q.set('ujian', e.target.value); return q; })}
        className="h-10 min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837] sm:min-w-[18rem]"
        data-testid="pilih-ujian"
      >
        {daftar.map((u) => <option key={u.id} value={u.id}>{(JENIS_UJIAN[u.jenis] || {}).label} · {u.nama}</option>)}
      </select>
    </div>
  );
}
