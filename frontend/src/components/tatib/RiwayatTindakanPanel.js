import React, { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { History, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { pesanGalatTatib } from '@/lib/aksesTatib';
import { formatPoin } from '@/components/tatib/RingkasanPoin';
import { LABEL_FIELD_TINDAKAN, ambilRiwayatTindakan } from '@/lib/tindakanTatib';

const formatWaktu = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso || '-' : d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });
};

/**
 * Panel samping riwayat perubahan tindakan satu siswa (terbaru dulu). `versi` dinaikkan pemanggil
 * setelah menyimpan agar riwayat dimuat ulang.
 */
export default function RiwayatTindakanPanel({ siswa, semesterId, onClose, versi = 0 }) {
  const [riwayat, setRiwayat] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!siswa) return undefined;
    let batal = false;
    setLoading(true);
    ambilRiwayatTindakan(siswa.siswa_id, { semester_id: semesterId })
      .then((r) => { if (!batal) setRiwayat(r); })
      .catch((e) => toast.error(pesanGalatTatib(e, 'Gagal memuat riwayat tindakan')))
      .finally(() => { if (!batal) setLoading(false); });
    return () => { batal = true; };
  }, [siswa, semesterId, versi]);

  return (
    <Sheet open={Boolean(siswa)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md" data-testid="riwayat-tindakan">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Riwayat Tindakan</SheetTitle>
          {siswa && (
            <SheetDescription>
              {siswa.nama} · {siswa.kelas || '-'} · pelanggaran {formatPoin(siswa.poin_negatif || 0)}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="mt-6">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : riwayat.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500" data-testid="riwayat-tindakan-kosong">Belum ada perubahan tindakan untuk siswa ini.</p>
          ) : (
            <ol className="relative space-y-5 border-l border-slate-200 pl-5">
              {riwayat.map((r) => (
                <li key={r.id} className="relative" data-testid={`riwayat-tindakan-${r.id}`}>
                  <span className="absolute -left-[1.6rem] top-1 h-2.5 w-2.5 rounded-full bg-slate-400 ring-4 ring-white" />
                  <p className="text-xs text-slate-500">
                    {formatWaktu(r.waktu)} · {r.oleh_nama || '-'}
                    {r.usulan_sp ? ` · usulan saat itu ${r.usulan_sp}` : ''}
                  </p>
                  {r.perubahan?.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-sm">
                      {r.perubahan.map((p) => (
                        <li key={p.field}>
                          <span className="text-slate-600">{LABEL_FIELD_TINDAKAN[p.field] || p.field}:</span>{' '}
                          <span className="text-slate-400 line-through">{p.dari || 'Tidak ada'}</span>{' → '}
                          <span className="font-medium">{p.ke || 'Tidak ada'}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {r.catatan && <p className="mt-1 text-sm italic text-slate-600">“{r.catatan}”</p>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
