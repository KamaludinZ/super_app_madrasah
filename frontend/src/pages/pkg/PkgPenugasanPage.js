import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Split, Loader2, Wand2, Save, AlertTriangle, Users } from 'lucide-react';
import { toast } from 'sonner';
import PenjagaMenuPkg from '@/components/pkg/PenjagaMenuPkg';
import DaftarTugasPerPenilai from '@/components/pkg/DaftarTugasPerPenilai';
import { ambilPenugasan, cekPenugasan, simpanPenugasan } from '@/lib/pkgKelola';

const KOSONG = '__kosong__';

// Isi guru yang belum punya penilai ke penilai dengan sisa jatah terbanyak (lalu beban paling ringan),
// tanpa pernah menugaskan seseorang menilai dirinya sendiri.
function bagiRata(dinilai, penilai, penugasan, jatah) {
  const hasil = { ...penugasan };
  const beban = Object.fromEntries(penilai.map((p) => [p.id, 0]));
  Object.values(hasil).forEach((pid) => { if (pid in beban) beban[pid] += 1; });
  dinilai.filter((g) => !hasil[g.id]).forEach((g) => {
    const calon = penilai.filter((p) => p.id !== g.id);
    if (!calon.length) return;
    calon.sort((a, b) => {
      const sisaA = (Number(jatah[a.id]) || 0) - beban[a.id];
      const sisaB = (Number(jatah[b.id]) || 0) - beban[b.id];
      return sisaB - sisaA || beban[a.id] - beban[b.id];
    });
    hasil[g.id] = calon[0].id;
    beban[calon[0].id] += 1;
  });
  return hasil;
}

function IsiHalamanPenugasan() {
  const [data, setData] = useState(null);
  const [penugasan, setPenugasan] = useState({});
  const [jatah, setJatah] = useState({});
  const [alasan, setAlasan] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);

  const muat = useCallback(async () => {
    const d = await ambilPenugasan();
    setData(d);
    setPenugasan(d.penugasan);
    setJatah(d.jatah);
  }, []);

  useEffect(() => { muat().catch(() => toast.error('Gagal memuat pembagian penilaian')); }, [muat]);

  const beban = useMemo(() => {
    const b = {};
    Object.values(penugasan).forEach((pid) => { b[pid] = (b[pid] || 0) + 1; });
    return b;
  }, [penugasan]);

  if (!data) return <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>;

  if (!data.sk) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-slate-500 space-y-2">
          <p>Belum ada SK aktif pada periode yang berjalan.</p>
          <p>Mulai periode di <Link to="/pkg/periode" className="text-[#006837] font-semibold hover:underline">Periode PKG</Link> dan tetapkan SK di <Link to="/pkg/sk" className="text-[#006837] font-semibold hover:underline">SK & Tim Penilai</Link>.</p>
        </CardContent>
      </Card>
    );
  }

  const cek = cekPenugasan(data.dinilai, data.penilai, penugasan);
  const berubah = JSON.stringify(penugasan) !== JSON.stringify(data.penugasan) || JSON.stringify(jatah) !== JSON.stringify(data.jatah);

  const simpan = async () => {
    if (data.penilaian_dimulai && !alasan.trim()) {
      toast.error('Penilaian sudah berjalan: isi alasan perubahan.');
      return;
    }
    setMenyimpan(true);
    try {
      const d = await simpanPenugasan({ penugasan, jatah, alasan: alasan.trim() });
      setData(d);
      setPenugasan(d.penugasan);
      setJatah(d.jatah);
      setAlasan('');
      toast.success('Pembagian penilaian disimpan');
    } catch (e) {
      toast.error(e.message || 'Gagal menyimpan pembagian');
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="pkg-penugasan">
      {data.penilaian_dimulai && (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" data-testid="pkg-penugasan-berjalan">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <span>Penilaian periode ini sudah berjalan. Perubahan pembagian tetap dapat disimpan oleh kepala madrasah dengan alasan, dan tercatat di jejak audit. Guru yang lembarnya sudah dibuat tidak dapat dipindah ke penilai lain.</span>
            <Textarea value={alasan} onChange={(e) => setAlasan(e.target.value)} rows={2} maxLength={300} placeholder="Alasan perubahan pembagian" className="bg-white" data-testid="pkg-penugasan-alasan" />
          </div>
        </div>
      )}

      {data.peringatan?.length > 0 && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" data-testid="pkg-penugasan-peringatan">
          <p className="font-semibold">Periksa data pembagian:</p>
          <ul className="mt-1 list-disc list-inside">{data.peringatan.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-[#006837]" /> Jatah per Penilai</CardTitle>
          <p className="text-xs text-slate-500">SK {data.sk.nomor_sk}. Isi jatah sesuai SK; jumlah guru yang dibagikan dibandingkan dengan jatah.</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.penilai.map((p) => {
            const n = beban[p.id] || 0;
            const j = Number(jatah[p.id]) || 0;
            const lebih = j > 0 && n > j;
            return (
              <div key={p.id} className={`rounded-lg border p-3 ${lebih ? 'border-rose-200 bg-rose-50/50' : 'border-slate-200'}`} data-testid={`pkg-jatah-${p.id}`}>
                <div className="text-sm font-semibold text-slate-900 truncate">{p.nama}</div>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span className={`tabular-nums font-bold ${lebih ? 'text-rose-700' : 'text-[#006837]'}`}>{n}</span>
                  <span className="text-slate-500">dari jatah</span>
                  <Input
                    type="number"
                    min={0}
                    max={99}
                    value={jatah[p.id] ?? ''}
                    onChange={(e) => setJatah((x) => ({ ...x, [p.id]: e.target.value === '' ? '' : Math.max(0, Math.min(99, Number(e.target.value))) }))}
                    className="h-8 w-16 tabular-nums"
                    aria-label={`Jatah ${p.nama}`}
                  />
                </div>
                {lebih && <div className="mt-1 text-xs text-rose-700">Melebihi jatah SK</div>}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Split className="h-4 w-4 text-[#006837]" /> Pembagian Guru yang Dinilai</CardTitle>
            <p className="text-xs text-slate-500 mt-1">Setiap guru dinilai oleh tepat satu penilai. Penilai hanya dapat membuka guru yang dibagikan kepadanya.</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setPenugasan((x) => bagiRata(data.dinilai, data.penilai, x, jatah))} disabled={!cek.tanpaPenilai.length} data-testid="pkg-penugasan-bagi-rata">
              <Wand2 className="h-3.5 w-3.5" /> Bagi rata yang kosong
            </Button>
            <Button size="sm" className="h-8 gap-1 bg-[#006837] hover:bg-[#005830]" onClick={simpan} disabled={!berubah || menyimpan} data-testid="pkg-penugasan-simpan">
              {menyimpan ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Simpan
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {cek.tanpaPenilai.length > 0 && (
            <p className="text-xs text-amber-700" data-testid="pkg-penugasan-tanpa-penilai">{cek.tanpaPenilai.length} guru belum memiliki penilai.</p>
          )}
          {data.dinilai.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500">Belum ada guru yang dinilai di SK aktif.</p>
          )}
          {data.dinilai.map((g) => {
            const pid = penugasan[g.id];
            const salah = cek.diriSendiri.includes(g.id) || cek.bukanPenilai.includes(g.id);
            return (
              <div key={g.id} className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center ${!pid || salah ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200'}`} data-testid={`pkg-penugasan-${g.id}`}>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900">{g.nama}</div>
                  <div className="text-xs text-slate-500">{g.mapel || '-'} · NIP {g.nip || '-'}</div>
                </div>
                <Select value={pid || KOSONG} onValueChange={(v) => setPenugasan((x) => {
                  const baru = { ...x };
                  if (v === KOSONG) delete baru[g.id]; else baru[g.id] = v;
                  return baru;
                })}
                >
                  <SelectTrigger className="h-9 sm:w-64" aria-label={`Penilai untuk ${g.nama}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={KOSONG}>— Belum dibagikan —</SelectItem>
                    {data.penilai.map((p) => (
                      <SelectItem key={p.id} value={p.id} disabled={p.id === g.id}>
                        {p.nama}{p.id === g.id ? ' (diri sendiri)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <DaftarTugasPerPenilai
        penilai={data.penilai}
        dinilai={data.dinilai}
        penugasan={data.penugasan}
        jatah={data.jatah}
        adaPerubahan={berubah}
      />
    </div>
  );
}

// Pembagian jatah penilaian (khusus kepala madrasah): petakan tiap guru yang dinilai ke satu penilai sesuai
// jatah SK pada periode berjalan (lib/pkgKelola → /pkg/penugasan).
export default function PkgPenugasanPage() {
  return (
    <PenjagaMenuPkg menuKey="penugasan">
      <IsiHalamanPenugasan />
    </PenjagaMenuPkg>
  );
}
