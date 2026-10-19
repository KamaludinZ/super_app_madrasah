import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarCog, Plus, Pencil, Play, Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import FormPeriodeDialog from '@/components/pkg/FormPeriodeDialog';
import PenjagaMenuPkg from '@/components/pkg/PenjagaMenuPkg';
import { api } from '@/lib/api';
import { formatWIB } from '@/lib/datetime';
import { TRANSISI_PERIODE, daftarPeriode, ubahStatusPeriode } from '@/lib/pkgKelola';

const STATUS = {
  draf: { label: 'Draf', kelas: 'bg-slate-100 text-slate-700 border-slate-200' },
  berjalan: { label: 'Berjalan', kelas: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  ditutup: { label: 'Ditutup', kelas: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const AKSI_STATUS = {
  berjalan: { label: 'Mulai', icon: Play, konfirmasi: (p) => `Mulai periode "${p.nama_periode}"? Penilai dapat membuka lembar penilaian pada periode ini.` },
  ditutup: { label: 'Tutup', icon: Lock, konfirmasi: (p) => `Tutup periode "${p.nama_periode}"? Penilaian tidak dapat diubah lagi setelah periode ditutup.` },
};

const tgl = (v) => formatWIB(v, 'Date', { day: 'numeric', month: 'short', year: 'numeric' });

function IsiHalamanPeriode() {
  const [daftar, setDaftar] = useState(null);
  const [semesters, setSemesters] = useState([]);
  const [form, setForm] = useState({ open: false, periode: null });
  const [memproses, setMemproses] = useState(null);

  const muat = useCallback(async () => setDaftar(await daftarPeriode()), []);

  useEffect(() => {
    muat().catch(() => toast.error('Gagal memuat periode PKG'));
    api.get('/semesters').then(({ data }) => setSemesters(data || [])).catch(() => setSemesters([]));
  }, [muat]);

  const ubahStatus = async (p) => {
    const tujuan = TRANSISI_PERIODE[p.status];
    if (!(await confirmDialog(AKSI_STATUS[tujuan].konfirmasi(p), { title: `${AKSI_STATUS[tujuan].label} Periode`, confirmText: AKSI_STATUS[tujuan].label }))) return;
    setMemproses(p.id);
    try {
      await ubahStatusPeriode(p.id, tujuan);
      toast.success(tujuan === 'berjalan' ? 'Periode dimulai' : 'Periode ditutup');
      await muat();
    } catch (e) {
      toast.error(e.message || 'Gagal mengubah status periode');
    } finally {
      setMemproses(null);
    }
  };

  return (
    <Card data-testid="pkg-periode-halaman">
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><CalendarCog className="h-4 w-4 text-[#006837]" /> Periode PKG</CardTitle>
          <p className="text-xs text-slate-500 mt-1">Hanya satu periode yang dapat berjalan. Alur status: Draf → Berjalan → Ditutup.</p>
        </div>
        <Button size="sm" className="h-8 gap-1 shrink-0 bg-[#006837] hover:bg-[#005830]" onClick={() => setForm({ open: true, periode: null })} data-testid="pkg-periode-tambah">
          <Plus className="h-3.5 w-3.5" /> Tetapkan Periode
        </Button>
      </CardHeader>
      <CardContent>
        {!daftar ? (
          <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>
        ) : daftar.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">Belum ada periode. Tetapkan periode PKG pertama.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Periode</TableHead>
                  <TableHead>Tahun Pelajaran</TableHead>
                  <TableHead>Masa Penilaian</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daftar.map((p) => {
                  const tujuan = TRANSISI_PERIODE[p.status];
                  const aksi = tujuan && AKSI_STATUS[tujuan];
                  const status = STATUS[p.status] || STATUS.draf;
                  return (
                    <TableRow key={p.id} data-testid={`pkg-periode-${p.id}`}>
                      <TableCell className="font-medium min-w-[180px]">{p.nama_periode}</TableCell>
                      <TableCell className="whitespace-nowrap text-slate-600">{p.tahun_pelajaran} · {p.semester}</TableCell>
                      <TableCell className="whitespace-nowrap text-slate-600 tabular-nums">{tgl(p.tanggal_buka)} – {tgl(p.tanggal_tutup)}</TableCell>
                      <TableCell><Badge className={status.kelas}>{status.label}</Badge></TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {p.status !== 'ditutup' && (
                          <Button size="sm" variant="ghost" className="h-8 gap-1" onClick={() => setForm({ open: true, periode: p })} data-testid={`pkg-periode-ubah-${p.id}`}>
                            <Pencil className="h-3.5 w-3.5" /> Ubah
                          </Button>
                        )}
                        {aksi && (
                          <Button size="sm" variant="outline" className="h-8 gap-1 ml-1" onClick={() => ubahStatus(p)} disabled={memproses === p.id} data-testid={`pkg-periode-status-${p.id}`}>
                            {memproses === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <aksi.icon className="h-3.5 w-3.5" />} {aksi.label}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <FormPeriodeDialog
        open={form.open}
        periode={form.periode}
        semesters={semesters}
        onClose={() => setForm({ open: false, periode: null })}
        onTersimpan={async () => { setForm({ open: false, periode: null }); await muat(); }}
      />
    </Card>
  );
}

// Penetapan periode PKG (khusus kepala madrasah): tetapkan/ubah periode, mulai, dan tutup.
// Data dari lib/pkgKelola (/pkg/periode).
export default function PkgPeriodePage() {
  return (
    <PenjagaMenuPkg menuKey="periode">
      <IsiHalamanPeriode />
    </PenjagaMenuPkg>
  );
}
