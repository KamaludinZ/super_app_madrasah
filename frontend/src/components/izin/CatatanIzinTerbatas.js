import React, { useEffect, useState } from 'react';
import { Loader2, Lock, NotebookPen } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { bolehBacaCatatan, muatCatatan, pesanGalat } from '@/lib/izinKamad';
import { formatWIBPanjang } from '@/lib/datetime';

/**
 * Catatan satpam pada satu izin — HANYA untuk kepala madrasah/kepala sekolah & kepala tata usaha
 * (dan admin). Peran lain tidak merender bagian ini dan tidak meminta datanya ke server.
 */
export default function CatatanIzinTerbatas({ izinId }) {
  const { activeRole } = useAuth();
  const boleh = bolehBacaCatatan(activeRole);
  const [status, setStatus] = useState({ memuat: true, items: [], galat: '' });

  useEffect(() => {
    if (!boleh || !izinId) return undefined;
    let aktif = true;
    setStatus({ memuat: true, items: [], galat: '' });
    muatCatatan(izinId)
      .then((h) => { if (aktif) setStatus({ memuat: false, items: h.items, galat: '' }); })
      .catch((e) => { if (aktif) setStatus({ memuat: false, items: [], galat: pesanGalat(e, 'Gagal memuat catatan satpam.') }); });
    return () => { aktif = false; };
  }, [boleh, izinId]);

  if (!boleh) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50/60 p-3" aria-label="Catatan satpam" data-testid="catatan-izin-terbatas">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <NotebookPen className="h-4 w-4 text-[#006837]" /> Catatan Satpam
        </h3>
        <span className="flex items-center gap-1 text-[11px] text-slate-500">
          <Lock className="h-3 w-3" /> Hanya Kepala Madrasah & Kepala TU
        </span>
      </div>
      {status.memuat ? (
        <div className="py-3 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto text-[#006837]" /></div>
      ) : status.galat ? (
        <p className="mt-2 text-xs text-rose-700">{status.galat}</p>
      ) : status.items.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500" data-testid="catatan-izin-kosong">Belum ada catatan satpam untuk izin ini.</p>
      ) : (
        <ol className="mt-2 space-y-2" data-testid="daftar-catatan-izin">
          {status.items.map((c) => (
            <li key={c.id} className="rounded-md border border-slate-200 bg-white px-2.5 py-2">
              <p className="text-sm text-slate-800 whitespace-pre-line break-words">{c.isi}</p>
              <p className="mt-1 text-[11px] text-slate-500">{c.penulis_nama || 'Satpam'} · {formatWIBPanjang(c.dibuat_pada)}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
