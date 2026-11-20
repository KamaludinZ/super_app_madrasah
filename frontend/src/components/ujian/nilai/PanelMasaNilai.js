import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { CalendarClock, History, Loader2, Save } from 'lucide-react';
import { formatWIBPanjang } from '@/lib/datetime';
import { pesanGalat } from '@/lib/ujian';
import { galatMasa, muatMasaNilai, simpanMasaNilai } from '@/lib/ujianNilai';

const LABEL = { ujian: 'Masa ujian', remidi: 'Masa remidi' };

function BarisMasa({ jenis, nilai, onUbah, boleh }) {
  const galat = galatMasa(nilai);
  return (
    <div className={`space-y-2 rounded-lg border p-3 ${nilai.aktif ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200'}`} data-testid={`masa-${jenis}`}>
      <label className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-900">{LABEL[jenis]}</span>
        <Switch checked={nilai.aktif} disabled={!boleh} onCheckedChange={(v) => onUbah({ ...nilai, aktif: v })} aria-label={`Buka ${LABEL[jenis].toLowerCase()}`} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" value={nilai.mulai || ''} disabled={!boleh} onChange={(e) => onUbah({ ...nilai, mulai: e.target.value || null })} aria-label={`${LABEL[jenis]} mulai`} />
        <Input type="date" value={nilai.selesai || ''} disabled={!boleh} onChange={(e) => onUbah({ ...nilai, selesai: e.target.value || null })} aria-label={`${LABEL[jenis]} selesai`} />
      </div>
      {galat && <p className="text-xs text-red-600" role="alert">{galat}</p>}
    </div>
  );
}

/**
 * Panel Masa Ujian & Remidi: panitia membuka rentang tanggal tempat guru mata pelajaran boleh mengedit/menimpa nilai UAS
 * kelasnya di halaman Input Nilai. Di luar masa ini nilai UAS terkunci bagi guru, dan — setelah masa pernah diatur — juga
 * bagi ketua/sekretaris (impor & edit ditolak 423); admin tetap dapat mengubah dengan jejak audit.
 */
export default function PanelMasaNilai({ ujianId }) {
  const [data, setData] = useState(null);
  const [isi, setIsi] = useState(null);
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    let hidup = true;
    muatMasaNilai(ujianId).then((d) => { if (hidup) { setData(d); setIsi({ ujian: d.ujian, remidi: d.remidi }); } })
      .catch((e) => toast.error(pesanGalat(e, 'Gagal memuat masa ujian.')));
    return () => { hidup = false; };
  }, [ujianId]);

  if (!data || !isi) return <div className="p-4 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-[#006837]" /></div>;
  const adaGalat = !!(galatMasa(isi.ujian) || galatMasa(isi.remidi));
  const berubah = JSON.stringify(isi) !== JSON.stringify({ ujian: data.ujian, remidi: data.remidi });

  const simpan = async () => {
    setMenyimpan(true);
    try {
      const d = await simpanMasaNilai(ujianId, isi);
      setData(d);
      setIsi({ ujian: d.ujian, remidi: d.remidi });
      toast.success(`Masa ujian & remidi disimpan${d.tiruan ? ' (contoh)' : ''}`);
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal menyimpan masa.'));
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4" data-testid="panel-masa-nilai">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><CalendarClock className="h-4 w-4 text-[#006837]" /> Masa ujian & remidi</h3>
          <p className="text-xs text-slate-500">
            Guru mapel hanya dapat mengubah nilai UAS di dalam masa yang dibuka. Setelah masa diatur, impor & edit nilai oleh ketua/sekretaris
            juga hanya selama masa terbuka (admin tetap dapat). Nilai ulangan & UTS tidak terpengaruh.
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${data.terbuka_sekarang ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`} data-testid="status-masa-sekarang">
          {data.terbuka_sekarang ? `Terbuka sekarang: ${LABEL[data.terbuka_sekarang].toLowerCase()}` : 'Nilai UAS terkunci bagi guru'}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <BarisMasa jenis="ujian" nilai={isi.ujian} onUbah={(v) => setIsi((x) => ({ ...x, ujian: v }))} boleh={data.boleh_ubah} />
        <BarisMasa jenis="remidi" nilai={isi.remidi} onUbah={(v) => setIsi((x) => ({ ...x, remidi: v }))} boleh={data.boleh_ubah} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
          <History className="h-3 w-3" /> {data.diubah?.pada ? `Diubah ${formatWIBPanjang(data.diubah.pada)} oleh ${data.diubah.oleh_nama}` : 'Belum pernah diubah'}
        </span>
        {data.boleh_ubah && (
          <Button size="sm" onClick={simpan} disabled={menyimpan || !berubah || adaGalat} className="gap-1 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-simpan-masa">
            {menyimpan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Masa
          </Button>
        )}
      </div>
    </section>
  );
}
