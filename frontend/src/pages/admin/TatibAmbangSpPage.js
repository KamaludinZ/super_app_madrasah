import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { pesanGalatTatib } from '@/lib/aksesTatib';
import { TINGKAT_SP, WARNA_SP } from '@/lib/tindakanTatib';
import FormAmbangSp from '@/components/tatib/FormAmbangSp';
import { ambilAmbangSP, simpanAmbangSP } from '@/lib/ambangSp';

const formatWaktu = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });
};

// Skala visual: posisi tiap ambang pada garis 0..(SP3 + 25%).
function SkalaAmbang({ ambang }) {
  const maks = Math.max(ambang.sp3 * 1.25, 1);
  return (
    <div className="pt-6 pb-2" data-testid="ambang-skala">
      <div className="relative h-3 rounded-full bg-gradient-to-r from-slate-100 via-amber-200 to-red-300">
        {TINGKAT_SP.map((sp) => {
          const nilai = ambang[sp.toLowerCase()];
          return (
            <div key={sp} className="absolute -top-6 -translate-x-1/2 text-center" style={{ left: `${(nilai / maks) * 100}%` }}>
              <span className="block text-[11px] font-semibold text-slate-700">{sp}</span>
              <span className="mx-auto mt-0.5 block h-5 w-0.5 bg-slate-700" />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-400"><span>0 poin</span><span>{Math.round(maks)} poin</span></div>
    </div>
  );
}

// Pengaturan Ambang SP: batas akumulasi poin pelanggaran yang membuat sistem mengusulkan SP1/SP2/SP3
// di Tindakan Tatib. Usulan hanya saran; keputusan SP tetap ditetapkan manual.
export default function TatibAmbangSpPage() {
  const [ambang, setAmbang] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ambilAmbangSP()
      .then(setAmbang)
      .catch((e) => toast.error(pesanGalatTatib(e, 'Gagal memuat ambang SP')))
      .finally(() => setLoading(false));
  }, []);

  const simpan = async (nilai) => {
    try {
      const hasil = await simpanAmbangSP(nilai);
      setAmbang(hasil);
      toast.success(`Ambang SP disimpan: ${hasil.sp1} / ${hasil.sp2} / ${hasil.sp3} poin`);
    } catch (e) {
      toast.error(pesanGalatTatib(e, e?.message || 'Gagal menyimpan ambang SP'));
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="tatib-ambang-sp-page">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><SlidersHorizontal className="h-6 w-6" /> Pengaturan Ambang SP</h1>
        <p className="text-sm text-slate-600">
          Batas akumulasi poin pelanggaran yang membuat sistem mengusulkan SP di Tindakan Tatib. Usulan hanya saran — keputusan SP tetap ditetapkan manual.
        </p>
      </div>

      {loading || !ambang ? (
        <div className="flex items-center justify-center p-8 text-slate-500"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat data...</div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ambang yang berlaku</CardTitle>
            <CardDescription data-testid="ambang-terakhir">
              {ambang.bawaan ? 'Memakai nilai bawaan sistem.' : `Terakhir diubah ${formatWaktu(ambang.diubah_pada)} oleh ${ambang.diubah_oleh_nama || '-'}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              {TINGKAT_SP.map((sp) => (
                <div key={sp} className={`rounded-lg border p-4 ${WARNA_SP[sp]}`} data-testid={`ambang-${sp.toLowerCase()}`}>
                  <p className="text-sm font-semibold">{sp}</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums">≥ {ambang[sp.toLowerCase()]}</p>
                  <p className="text-xs opacity-80">poin pelanggaran</p>
                </div>
              ))}
            </div>
            <SkalaAmbang ambang={ambang} />
          </CardContent>
        </Card>
      )}

      {ambang && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ubah ambang</CardTitle>
            <CardDescription>Nilai harus naik: SP1 &lt; SP2 &lt; SP3. Ambang baru langsung dipakai saat sistem mengusulkan SP.</CardDescription>
          </CardHeader>
          <CardContent>
            <FormAmbangSp ambang={ambang} onSimpan={simpan} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
