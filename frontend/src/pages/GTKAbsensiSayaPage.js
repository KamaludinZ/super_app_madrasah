import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { UserCheck, FileText, Plus, Pencil, Trash2, Link as LinkIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ui/confirm-dialog';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function firstOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

const IZIN_LABELS = { sakit: 'Sakit', cuti: 'Cuti', dinas_luar: 'Dinas Luar', lainnya: 'Lainnya' };
const IZIN_COLORS = {
  sakit: 'bg-amber-100 text-amber-700', cuti: 'bg-blue-100 text-blue-700',
  dinas_luar: 'bg-purple-100 text-purple-700', lainnya: 'bg-slate-100 text-slate-700',
};
const IZIN_EMPTY_FORM = { jenis: 'sakit', tanggal_mulai: todayISO(), tanggal_selesai: todayISO(), keterangan: '', dokumen_url: '' };

export default function GTKAbsensiSayaPage() {
  const [activeTab, setActiveTab] = useState('rekap');

  return (
    <div className="space-y-6">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <UserCheck className="h-3 w-3 mr-1" /> Laporan Absensi Saya
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Laporan Absensi Saya</h1>
        <p className="text-sm text-slate-600 mt-1">Rekap kehadiran dari keterisian jurnal, dan pengajuan perizinan</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border border-slate-200">
          <TabsTrigger value="rekap" className="gap-2"><UserCheck className="h-4 w-4" /> Rekap Absensi</TabsTrigger>
          <TabsTrigger value="perizinan" className="gap-2"><FileText className="h-4 w-4" /> Perizinan</TabsTrigger>
        </TabsList>

        <TabsContent value="rekap" className="mt-4">
          <MyRekapTab />
        </TabsContent>
        <TabsContent value="perizinan" className="mt-4">
          <MyPerizinanTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MyRekapTab() {
  const [dateFrom, setDateFrom] = useState(firstOfMonthISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/gtk/absensi/my', { params: { date_from: dateFrom, date_to: dateTo } })
      .then(({ data }) => setData(data))
      .catch((e) => toast.error(e?.response?.data?.detail || 'Gagal memuat rekap absensi'))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  const statusBadge = (status) => {
    if (status === 'hadir') return <Badge className="bg-emerald-100 text-emerald-700">Hadir</Badge>;
    if (status === 'alpha') return <Badge className="bg-rose-100 text-rose-700">Alpha</Badge>;
    if (status === 'libur') return <Badge variant="outline" className="text-slate-500">Libur</Badge>;
    return <Badge className={IZIN_COLORS[status] || 'bg-slate-100 text-slate-700'}>{IZIN_LABELS[status] || status}</Badge>;
  };

  const s = data?.summary;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Dari Tanggal</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Sampai Tanggal</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        {s && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              ['Hadir', s.hadir, 'text-emerald-700'],
              ['Sakit', s.sakit, 'text-amber-700'],
              ['Cuti', s.cuti, 'text-blue-700'],
              ['Dinas Luar', s.dinas_luar, 'text-purple-700'],
              ['Lainnya', s.lainnya, 'text-slate-700'],
              ['Alpha', s.alpha, 'text-rose-700'],
            ].map(([label, val, cls]) => (
              <div key={label} className="rounded-lg border border-slate-200 p-3 text-center">
                <div className={`text-xl font-bold ${cls}`}>{val}</div>
                <div className="text-xs text-slate-500">{label}</div>
              </div>
            ))}
          </div>
        )}
        {s?.persentase_hadir !== null && s?.persentase_hadir !== undefined && (
          <div className="text-sm text-slate-600">Persentase kehadiran: <span className="font-semibold text-slate-900">{s.persentase_hadir}%</span></div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={2} className="text-center py-8 text-slate-500">Memuat data...</TableCell></TableRow>
              ) : !data || data.days.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="text-center py-8 text-slate-500">Tidak ada hari kerja pada rentang ini.</TableCell></TableRow>
              ) : (
                data.days.map((d) => (
                  <TableRow key={d.date}>
                    <TableCell className="text-sm font-medium">{d.date}</TableCell>
                    <TableCell>{statusBadge(d.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function MyPerizinanTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(IZIN_EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/gtk/izin/my');
      setItems(data || []);
    } catch (e) {
      toast.error('Gagal memuat data perizinan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(IZIN_EMPTY_FORM); setOpen(true); };
  const openEdit = (i) => {
    setEditing(i);
    setForm({
      jenis: i.jenis, tanggal_mulai: i.tanggal_mulai, tanggal_selesai: i.tanggal_selesai,
      keterangan: i.keterangan || '', dokumen_url: i.dokumen_url || '',
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (form.tanggal_mulai > form.tanggal_selesai) {
      toast.error('Tanggal mulai harus sebelum atau sama dengan tanggal selesai');
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await api.put(`/gtk/izin/${editing.id}`, form);
        toast.success('Data izin berhasil diperbarui');
      } else {
        await api.post('/gtk/izin', form);
        toast.success('Data izin berhasil ditambahkan');
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan data izin');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (i) => {
    if (!(await confirmDialog(`Hapus data izin ${IZIN_LABELS[i.jenis]} (${i.tanggal_mulai})?`))) return;
    try {
      await api.delete(`/gtk/izin/${i.id}`);
      toast.success('Data izin berhasil dihapus');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data izin');
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">Ajukan perizinan tidak hadir (sakit/cuti/dinas luar/lainnya) dengan rentang tanggal. Dokumen bukti tidak wajib diisi saat ini, bisa menyusul kemudian.</p>
          <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2 shrink-0 ml-3">
            <Plus className="h-4 w-4" /> Ajukan Izin
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jenis</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead>Dokumen</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">Memuat data...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">Belum ada data perizinan. Klik "Ajukan Izin" untuk membuat yang pertama.</TableCell></TableRow>
              ) : (
                items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell><Badge className={IZIN_COLORS[i.jenis]}>{IZIN_LABELS[i.jenis] || i.jenis}</Badge></TableCell>
                    <TableCell className="text-xs">{i.tanggal_mulai}{i.tanggal_mulai !== i.tanggal_selesai && ` s/d ${i.tanggal_selesai}`}</TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{i.keterangan || '-'}</TableCell>
                    <TableCell>
                      {i.dokumen_url ? (
                        <a href={i.dokumen_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                          <LinkIcon className="h-3 w-3" /> Sudah Upload
                        </a>
                      ) : (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">Belum Upload</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(i)} className="text-rose-600"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Perizinan' : 'Ajukan Perizinan'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Jenis Izin *</Label>
              <Select value={form.jenis} onValueChange={(v) => setForm({ ...form, jenis: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(IZIN_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tanggal Mulai *</Label>
                <Input type="date" value={form.tanggal_mulai} onChange={(e) => setForm({ ...form, tanggal_mulai: e.target.value })} />
              </div>
              <div>
                <Label>Tanggal Selesai *</Label>
                <Input type="date" value={form.tanggal_selesai} onChange={(e) => setForm({ ...form, tanggal_selesai: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Keterangan</Label>
              <Textarea value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} rows={2} placeholder="Keterangan tambahan (opsional)..." />
            </div>
            <div>
              <Label>Dokumen Bukti (URL)</Label>
              <Input value={form.dokumen_url} onChange={(e) => setForm({ ...form, dokumen_url: e.target.value })} placeholder="Tautan surat/dokumen (opsional, bisa menyusul)" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Batal</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="bg-[#006837] hover:bg-[#0B7A3B]">
              {submitting ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
