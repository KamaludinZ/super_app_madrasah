import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileBadge, Plus, Pencil, Loader2, CheckCircle2, Users, ClipboardCheck, ListChecks } from 'lucide-react';
import { toast } from 'sonner';
import FormSkDialog from '@/components/pkg/FormSkDialog';
import CeklistGuruDialog from '@/components/pkg/CeklistGuruDialog';
import PenjagaMenuPkg from '@/components/pkg/PenjagaMenuPkg';
import { formatWIBPanjang } from '@/lib/datetime';
import {
  adalahKepala, aktifkanSk, daftarGuru, daftarPeriode, daftarSk, simpanDinilaiSk, simpanPenilaiSk,
} from '@/lib/pkgKelola';

function TabelAnggota({ judul, icon: Icon, anggota, testid, kosong, aksi }) {
  return (
    <div data-testid={testid}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Icon className="h-4 w-4 text-[#006837]" /> {judul}</h3>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{anggota.length}</Badge>
          {aksi}
        </div>
      </div>
      {anggota.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 py-4 text-center text-sm text-slate-500">{kosong}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>NIP</TableHead>
                <TableHead>Mapel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {anggota.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.nama}</TableCell>
                  <TableCell className="tabular-nums text-slate-600">{a.nip || '-'}</TableCell>
                  <TableCell className="text-slate-600">{a.mapel || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function IsiHalamanSk() {
  const [periode, setPeriode] = useState([]);
  const [daftar, setDaftar] = useState(null);
  const [pilihId, setPilihId] = useState(null);
  const [form, setForm] = useState({ open: false, sk: null });
  const [mengaktifkan, setMengaktifkan] = useState(false);
  const [guru, setGuru] = useState([]);
  const [ceklist, setCeklist] = useState(null); // 'penilai' | 'dinilai'

  const muat = useCallback(async () => {
    const [p, s] = await Promise.all([daftarPeriode(), daftarSk()]);
    setPeriode(p);
    setDaftar(s);
    setPilihId((lama) => (s.some((x) => x.id === lama) ? lama : (s.find((x) => x.is_active) || s[0])?.id || null));
  }, []);

  useEffect(() => { muat().catch(() => toast.error('Gagal memuat data SK')); }, [muat]);
  useEffect(() => { daftarGuru().then(setGuru).catch(() => toast.error('Gagal memuat daftar guru')); }, []);

  const namaPeriode = useMemo(() => Object.fromEntries(periode.map((p) => [p.id, p])), [periode]);
  const sk = daftar?.find((x) => x.id === pilihId);

  // Kepala madrasah otomatis menjadi penilai (tercentang & terkunci).
  const kepalaTerkunci = useMemo(
    () => Object.fromEntries(guru.filter(adalahKepala).map((g) => [g.id, 'Kepala madrasah'])), [guru],
  );
  const idPenilai = useMemo(() => (sk ? sk.penilai.map((a) => a.id) : []), [sk]);
  // Kepala madrasah bukan objek penilaian, jadi tidak muncul di ceklist guru yang dinilai.
  const guruBukanKepala = useMemo(() => guru.filter((g) => !adalahKepala(g)), [guru]);
  const idDinilai = useMemo(() => (sk ? sk.dinilai.map((a) => a.id) : []), [sk]);
  const tanpaKunci = useMemo(() => ({}), []);

  const simpanPenilai = async (ids, alasan) => {
    await simpanPenilaiSk(sk.id, ids, alasan);
    toast.success('Tim penilai disimpan');
    setCeklist(null);
    await muat();
  };

  const simpanDinilai = async (ids, alasan) => {
    await simpanDinilaiSk(sk.id, ids, alasan);
    toast.success('Guru yang dinilai disimpan');
    setCeklist(null);
    await muat();
  };

  const aktifkan = async () => {
    setMengaktifkan(true);
    try {
      await aktifkanSk(sk.id);
      toast.success('SK dijadikan SK aktif periode ini');
      await muat();
    } catch (e) {
      toast.error(e.message || 'Gagal mengaktifkan SK');
    } finally {
      setMengaktifkan(false);
    }
  };

  if (!daftar) {
    return <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" data-testid="pkg-sk">
      <Card className="lg:col-span-1">
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2"><FileBadge className="h-4 w-4 text-[#006837]" /> Daftar SK</CardTitle>
          <Button size="sm" className="h-8 gap-1 bg-[#006837] hover:bg-[#005830]" onClick={() => setForm({ open: true, sk: null })} data-testid="pkg-sk-tambah">
            <Plus className="h-3.5 w-3.5" /> Tambah
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {daftar.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Belum ada SK. Tambahkan SK untuk periode PKG.</p>}
          {daftar.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setPilihId(s.id)}
              aria-pressed={s.id === pilihId}
              className={`w-full rounded-lg border p-3 text-left transition-colors ${s.id === pilihId ? 'border-[#006837] bg-emerald-50/60' : 'border-slate-200 hover:bg-slate-50'}`}
              data-testid={`pkg-sk-item-${s.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-slate-900 break-all">{s.nomor_sk}</span>
                {s.is_active && <Badge className="shrink-0 bg-emerald-100 text-emerald-700 border-emerald-200">Aktif</Badge>}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">{namaPeriode[s.periode_id]?.nama_periode || '-'}</div>
              <div className="mt-1 text-[11px] text-slate-400 tabular-nums">{s.penilai.length} penilai · {s.dinilai.length} dinilai</div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        {!sk ? (
          <CardContent className="py-12 text-center text-sm text-slate-500">Pilih SK untuk melihat rinciannya.</CardContent>
        ) : (
          <>
            <CardHeader className="pb-3 space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <CardTitle className="text-base break-all">{sk.nomor_sk}</CardTitle>
                  <p className="text-sm text-slate-600 mt-1">{sk.tentang || '-'}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {!sk.is_active && (
                    <Button size="sm" variant="outline" className="h-8 gap-1" onClick={aktifkan} disabled={mengaktifkan} data-testid="pkg-sk-aktifkan">
                      {mengaktifkan ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Jadikan aktif
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setForm({ open: true, sk })} data-testid="pkg-sk-ubah">
                    <Pencil className="h-3.5 w-3.5" /> Ubah
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>Tanggal SK: <span className="text-slate-700">{formatWIBPanjang(sk.tanggal_sk, false)}</span></span>
                <span>Periode: <span className="text-slate-700">{namaPeriode[sk.periode_id]?.nama_periode || '-'}</span></span>
                <span>Status: <span className="text-slate-700">{sk.is_active ? 'SK aktif' : 'Tidak aktif'}</span></span>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <TabelAnggota
                judul="Tim Penilai"
                icon={ClipboardCheck}
                anggota={sk.penilai}
                testid="pkg-sk-penilai"
                kosong="Belum ada penilai."
                aksi={(
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setCeklist('penilai')} data-testid="pkg-sk-atur-penilai">
                    <ListChecks className="h-3.5 w-3.5" /> Atur
                  </Button>
                )}
              />
              <TabelAnggota
                judul="Guru yang Dinilai"
                icon={Users}
                anggota={sk.dinilai}
                testid="pkg-sk-dinilai"
                kosong="Belum ada guru yang dinilai."
                aksi={(
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setCeklist('dinilai')} data-testid="pkg-sk-atur-dinilai">
                    <ListChecks className="h-3.5 w-3.5" /> Atur
                  </Button>
                )}
              />
            </CardContent>
          </>
        )}
      </Card>

      <CeklistGuruDialog
        open={ceklist === 'penilai' && !!sk}
        judul="Pilih Tim Penilai"
        deskripsi="Centang guru aktif yang menjadi penilai pada SK ini. Kepala madrasah otomatis berperan sebagai penilai. Penilai boleh juga menjadi guru yang dinilai."
        icon={ClipboardCheck}
        guru={guru}
        terpilih={idPenilai}
        terkunci={kepalaTerkunci}
        perluAlasan={!!sk?.penilaian_berjalan}
        onClose={() => setCeklist(null)}
        onSimpan={simpanPenilai}
        testid="pkg-ceklist-penilai"
      />

      <CeklistGuruDialog
        open={ceklist === 'dinilai' && !!sk}
        judul="Pilih Guru yang Dinilai"
        deskripsi="Centang guru yang dinilai pada periode SK ini. Kepala madrasah tidak menjadi objek penilaian. Anggota tim penilai boleh merangkap sebagai guru yang dinilai."
        icon={Users}
        guru={guruBukanKepala}
        terpilih={idDinilai}
        terkunci={tanpaKunci}
        perluAlasan={!!sk?.penilaian_berjalan}
        onClose={() => setCeklist(null)}
        onSimpan={simpanDinilai}
        testid="pkg-ceklist-dinilai"
      />

      <FormSkDialog
        open={form.open}
        sk={form.sk}
        periode={periode.filter((p) => p.status !== 'ditutup' || p.id === form.sk?.periode_id)}
        onClose={() => setForm({ open: false, sk: null })}
        onTersimpan={async (hasil) => { setForm({ open: false, sk: null }); await muat(); setPilihId(hasil.id); }}
      />
    </div>
  );
}

// Pengelolaan SK PKG & anggotanya (khusus kepala madrasah): daftar SK per periode, identitas SK,
// penetapan SK aktif, serta tim penilai & guru yang dinilai (lib/pkgKelola → /pkg/sk, /pkg/guru).
export default function PkgSkPage() {
  return (
    <PenjagaMenuPkg menuKey="sk">
      <IsiHalamanSk />
    </PenjagaMenuPkg>
  );
}
