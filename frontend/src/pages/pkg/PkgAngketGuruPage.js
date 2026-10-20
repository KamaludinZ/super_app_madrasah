import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Loader2, Pencil, Plus, Save, Trash2, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import PenjagaMenuPkg from '@/components/pkg/PenjagaMenuPkg';
import { formatWIBPanjang } from '@/lib/datetime';
import { sebutan360 } from '@/lib/pkgAmbang';
import { ambilAngketGuru, hapusJawaban, hitungNilaiResponden, tambahJawaban, ubahJawaban } from '@/lib/pkgAngket';

const FORMAT = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const SKOR = [
  [0, 'Tidak ada bukti'],
  [1, 'Sebagian'],
  [2, 'Seluruhnya'],
];

// Form rekap jawaban satu responden: skor 0/1/2 tiap butir (urutan & komponen sesuai sheet template).
// `awal` = responden yang diubah (null = responden baru).
function FormResponden({ jenis, awal, onSimpan, onBatal }) {
  const [nama, setNama] = useState(awal?.nama_responden || '');
  const [jawaban, setJawaban] = useState(awal?.jawaban || jenis.butir.map(() => null));
  const [menyimpan, setMenyimpan] = useState(false);
  const { skor, maks, nilai, terisi } = hitungNilaiResponden(jawaban);
  const lengkap = terisi === jenis.butir.length;

  const atur = (i, n) => setJawaban((j) => j.map((x, k) => (k === i ? n : x)));
  const simpan = async () => {
    setMenyimpan(true);
    try {
      await onSimpan({ nama, jawaban });
    } finally {
      setMenyimpan(false);
    }
  };

  let komponen = null;
  return (
    <Card className="border-[#006837]/40" data-testid={`pkg-form-angket-${jenis.jenis}`}>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">{awal ? `Ubah responden ${awal.urutan}` : 'Responden baru'} · {jenis.label}</CardTitle>
          <div className="text-sm tabular-nums text-slate-700">
            Skor {skor}/{maks} · <span className="font-semibold text-[#006837]">{FORMAT.format(nilai)}</span> · {terisi}/{jenis.butir.length} butir
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input value={nama} onChange={(e) => setNama(e.target.value)} maxLength={120} placeholder="Nama/inisial responden (opsional)" className="sm:max-w-xs" />
          <div className="flex flex-wrap gap-1 text-xs">
            <span className="self-center text-slate-500">Isi semua:</span>
            {SKOR.map(([n]) => (
              <Button key={n} type="button" size="sm" variant="outline" className="h-7 px-2" onClick={() => setJawaban(jenis.butir.map(() => n))}>{n}</Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {jenis.butir.map((b, i) => {
          const judul = b.komponen !== komponen ? (komponen = b.komponen) : null;
          return (
            <React.Fragment key={b.no}>
              {judul && <div className="pt-3 text-xs font-semibold uppercase tracking-wide text-[#006837]">{judul}</div>}
              <div className="flex flex-col gap-2 rounded-lg border border-slate-100 p-2 sm:flex-row sm:items-center">
                <p className="flex-1 text-sm text-slate-800"><span className="mr-2 font-mono text-xs text-slate-400">{b.nomor}.</span>{b.pernyataan}</p>
                <div className="flex shrink-0 gap-1" role="radiogroup" aria-label={`Skor butir ${b.no}`}>
                  {SKOR.map(([n, label]) => (
                    <button key={n} type="button" role="radio" aria-checked={jawaban[i] === n} title={label}
                      onClick={() => atur(i, n)} data-testid={`pkg-angket-butir-${b.no}-${n}`}
                      className={`h-8 w-10 rounded-md border text-sm font-semibold tabular-nums transition ${jawaban[i] === n
                        ? 'border-[#006837] bg-[#006837] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-[#006837]/50'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div className="sticky bottom-0 flex flex-col gap-2 border-t border-slate-200 bg-white pt-3 sm:flex-row sm:items-center sm:justify-end">
          {!lengkap && <span className="text-xs text-amber-700 sm:mr-auto">Pilih skor untuk semua butir ({jenis.butir.length - terisi} belum diisi).</span>}
          <Button variant="outline" onClick={onBatal} className="gap-1"><X className="h-4 w-4" /> Batal</Button>
          <Button onClick={simpan} disabled={!lengkap || menyimpan} className="gap-1 bg-[#006837] hover:bg-[#005830]" data-testid="pkg-simpan-angket">
            {menyimpan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TabJenis({ jenis, bolehUbah, onTambah, onUbah, onHapus }) {
  const [form, setForm] = useState(null); // null | 'baru' | responden
  const penuh = jenis.jumlah_responden >= jenis.maks_responden;
  const tutup = () => setForm(null);
  const simpan = async (isi) => {
    if (form === 'baru') await onTambah(jenis.jenis, isi);
    else await onUbah(form, isi);
    tutup();
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
        <div className="flex-1 text-sm text-slate-700">
          {jenis.jumlah_responden}/{jenis.maks_responden} responden · {jenis.butir.length} butir · Hasil nilai{' '}
          <span className="font-semibold text-[#006837]">{jenis.nilai != null ? FORMAT.format(jenis.nilai) : '-'}</span>
          {jenis.sebutan && <Badge variant="outline" className="ml-2">{jenis.sebutan}</Badge>}
        </div>
        {bolehUbah && !form && (
          <Button size="sm" onClick={() => setForm('baru')} disabled={penuh} className="gap-1 bg-[#006837] hover:bg-[#005830]" data-testid={`pkg-tambah-responden-${jenis.jenis}`}>
            <Plus className="h-4 w-4" /> Input responden
          </Button>
        )}
      </div>
      {penuh && <p className="text-xs text-slate-500">Template resmi menyediakan {jenis.maks_responden} kolom penilai per angket; hapus responden untuk mengganti.</p>}
      {form && <FormResponden key={form === 'baru' ? 'baru' : form.id} jenis={jenis} awal={form === 'baru' ? null : form} onSimpan={simpan} onBatal={tutup} />}
      {jenis.responden.length === 0 && !form && <p className="py-6 text-center text-sm text-slate-500">Belum ada jawaban angket {jenis.label.toLowerCase()} yang diinput.</p>}
      {jenis.responden.map((r) => (
        <div key={r.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center" data-testid={`pkg-responden-${r.id}`}>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900">Penilai {r.urutan}{r.nama_responden ? ` · ${r.nama_responden}` : ''}</div>
            <div className="text-xs text-slate-500">Diinput {r.diinput_oleh_nama || '-'} · {r.diubah_pada ? formatWIBPanjang(r.diubah_pada) : '-'}</div>
          </div>
          <div className="text-sm tabular-nums">{r.skor}/{r.skor_maks} · <span className="font-semibold">{FORMAT.format(r.nilai)}</span>
            <span className="ml-1 text-xs text-slate-500">{sebutan360(r.nilai) || ''}</span></div>
          {bolehUbah && (
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" aria-label="Ubah" onClick={() => setForm(r)}><Pencil className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-rose-600" aria-label="Hapus" onClick={() => onHapus(r)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function IsiAngketGuru() {
  const { guruId } = useParams();
  const [searchParams] = useSearchParams();
  const periodeId = searchParams.get('periode') || undefined;
  const [data, setData] = useState(null);

  const muat = useCallback(async () => {
    try {
      setData(await ambilAngketGuru(guruId, periodeId));
    } catch (e) {
      toast.error(e.message);
      setData((d) => d || { galat: e.message });
    }
  }, [guruId, periodeId]);
  useEffect(() => { muat(); }, [muat]);

  const kembali = periodeId ? `/pkg/komponen?periode=${periodeId}` : '/pkg/komponen';
  if (!data) return <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>;
  if (data.galat) return <p className="py-12 text-center text-sm text-slate-600" role="alert">{data.galat}</p>;

  const bolehUbah = data.periode?.status === 'berjalan';
  const jalankan = async (fn, pesan) => {
    try {
      await fn();
      toast.success(pesan);
      await muat();
    } catch (e) {
      toast.error(e.message);
      throw e;
    }
  };
  const onTambah = (jenis, { nama, jawaban }) => jalankan(() => tambahJawaban(guruId, { jenis, periodeId: data.periode.id, nama, jawaban }), 'Jawaban responden disimpan');
  const onUbah = (r, { nama, jawaban }) => jalankan(() => ubahJawaban(r.id, { jenis: r.jenis, nama, jawaban }), 'Jawaban responden diperbarui');
  const onHapus = async (r) => {
    if (!(await confirmDialog(`Hapus jawaban penilai ${r.urutan}${r.nama_responden ? ` (${r.nama_responden})` : ''}?`))) return;
    jalankan(() => hapusJawaban(r.id), 'Jawaban responden dihapus').catch(() => {});
  };

  return (
    <div className="space-y-4" data-testid="pkg-angket-guru">
      <Link to={kembali} className="inline-flex items-center gap-1 text-sm text-[#006837] hover:underline"><ArrowLeft className="h-4 w-4" /> Komponen 360° &amp; Kehadiran</Link>
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[#006837]"><UserRound className="h-6 w-6" /></div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-900">{data.guru?.nama}</h2>
          <p className="text-xs text-slate-500">NIP {data.guru?.nip || '-'} · {data.periode?.nama_periode} · Angket 360°</p>
        </div>
      </div>
      {!bolehUbah && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Periode tidak sedang berjalan; jawaban angket hanya dapat dilihat.</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {data.jenis.map((j) => (
          <div key={j.jenis} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Rerata kuesioner {j.label}</div>
            <div className="text-2xl font-bold tabular-nums text-[#006837]">{j.nilai != null ? FORMAT.format(j.nilai) : '-'}</div>
            <div className="text-xs text-slate-500">{j.jumlah_responden} responden{j.sebutan ? ` · ${j.sebutan}` : ''}</div>
          </div>
        ))}
      </div>

      <Tabs defaultValue={data.jenis[0]?.jenis} className="space-y-3">
        <TabsList className="flex h-auto flex-wrap justify-start">
          {data.jenis.map((j) => <TabsTrigger key={j.jenis} value={j.jenis} data-testid={`pkg-angket-tab-${j.jenis}`}>{j.label}</TabsTrigger>)}
        </TabsList>
        {data.jenis.map((j) => (
          <TabsContent key={j.jenis} value={j.jenis}>
            <TabJenis jenis={j} bolehUbah={bolehUbah} onTambah={onTambah} onUbah={onUbah} onHapus={onHapus} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// Input rekap jawaban angket kertas 360° satu guru per responden (kepala & tim penilai) dengan skor 360° per jenis
// (lib/pkgAngket -> /pkg/angket/guru/{id}).
export default function PkgAngketGuruPage() {
  return (
    <PenjagaMenuPkg menuKey="komponen">
      <IsiAngketGuru />
    </PenjagaMenuPkg>
  );
}
