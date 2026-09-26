import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Award, BookOpen, Search, Plus, Pencil, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { PengumpulanPanel } from '@/pages/admin/AdminEKinerjaPage';
import { confirmDialog } from '@/components/ui/confirm-dialog';

const EKINERJA_AUTHOR_ROLES = ['admin', 'kepala_sekolah', 'kepala_tata_usaha'];
const CURRENT_QUARTER = `TW${Math.floor(new Date().getMonth() / 3) + 1}`;

const SERTIFIKASI_EMPTY_FORM = {
  nama_kegiatan: '', penyelenggara: '', tanggal_mulai: '', tanggal_selesai: '', jumlah_jam: '',
};

export default function AdminProfesionalitasGTKPage() {
  const { activeRole } = useAuth();
  const isAuthor = EKINERJA_AUTHOR_ROLES.includes(activeRole);
  const [activeTab, setActiveTab] = useState('profesionalitas');
  const [activeTahunTakwim, setActiveTahunTakwim] = useState(null);
  const activeYear = activeTahunTakwim?.year || new Date().getFullYear();

  useEffect(() => {
    api.get('/tahun-takwim/active').then(({ data }) => setActiveTahunTakwim(data)).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <Award className="h-3 w-3 mr-1" /> Profesionalitas GTK
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Profesionalitas GTK</h1>
          <p className="text-sm text-slate-600 mt-1">Pengembangan Kompetensi dan Riwayat Sertifikasi</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border border-slate-200 flex-wrap h-auto">
          <TabsTrigger value="profesionalitas" className="gap-2">
            <Award className="h-4 w-4" /> Profesionalitas GTK
          </TabsTrigger>
          <TabsTrigger value="sertifikasi" className="gap-2">
            <BookOpen className="h-4 w-4" /> Riwayat Sertifikasi
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profesionalitas" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-3">Pendataan upload dokumen pengembangan profesionalitas GTK (mis. sertifikat pelatihan/diklat/seminar).</p>
              <PengumpulanPanel
                type="profesionalitas_gtk"
                year={activeYear}
                isAuthor={isAuthor}
                metaKey="quarterly_periods"
                periodOptions={null}
                label="Profesionalitas GTK"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sertifikasi" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <SertifikasiPanel year={activeYear} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SertifikasiPanel({ year }) {
  const { activeRole } = useAuth();
  const isAuthor = EKINERJA_AUTHOR_ROLES.includes(activeRole);
  const [quarterOptions, setQuarterOptions] = useState([]);
  const [period, setPeriod] = useState(CURRENT_QUARTER);

  useEffect(() => {
    api.get('/ekinerja/pengumpulan/meta').then(({ data }) => setQuarterOptions(data.quarterly_periods || [])).catch(() => {});
  }, []);

  const periodLabel = quarterOptions.find((p) => p.value === period)?.label || period;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs">Tahun Takwim Aktif: {year}</Badge>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Pilih periode..." /></SelectTrigger>
          <SelectContent>
            {quarterOptions.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <PengumpulanPanel
        type="sertifikasi"
        year={year}
        isAuthor={isAuthor}
        period={period}
        onPeriodChange={setPeriod}
        hidePeriodSelector
        metaKey="quarterly_periods"
        periodOptions={null}
        label="Riwayat Sertifikasi"
      />

      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-2">Rekaman Kegiatan/Sertifikat {periodLabel} {year}</h3>
        {isAuthor ? (
          <SertifikasiAdminTable year={year} period={period} />
        ) : (
          <SertifikasiOwnTable year={year} period={period} periodLabel={periodLabel} />
        )}
      </div>
    </div>
  );
}

function SertifikasiOwnTable({ year, period, periodLabel }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(SERTIFIKASI_EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/ekinerja/sertifikasi/my', { params: { year, period } });
      setRecords(data || []);
    } catch (e) {
      toast.error('Gagal memuat riwayat sertifikasi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [year, period]);

  const openCreate = () => { setEditing(null); setForm(SERTIFIKASI_EMPTY_FORM); setOpen(true); };
  const openEdit = (r) => {
    setEditing(r);
    setForm({
      nama_kegiatan: r.nama_kegiatan, penyelenggara: r.penyelenggara || '',
      tanggal_mulai: r.tanggal_mulai || '', tanggal_selesai: r.tanggal_selesai || '', jumlah_jam: r.jumlah_jam || '',
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.nama_kegiatan.trim()) {
      toast.error('Nama kegiatan wajib diisi');
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...form, year, period };
      if (editing) {
        await api.put(`/ekinerja/sertifikasi/${editing.id}`, payload);
        toast.success('Data berhasil diperbarui');
      } else {
        await api.post('/ekinerja/sertifikasi', payload);
        toast.success('Data berhasil ditambahkan');
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan data');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (r) => {
    if (!(await confirmDialog(`Hapus data "${r.nama_kegiatan}"?`))) return;
    try {
      await api.delete(`/ekinerja/sertifikasi/${r.id}`);
      toast.success('Data berhasil dihapus');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2">
          <Plus className="h-4 w-4" /> Tambah Rekaman
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Kegiatan</TableHead>
              <TableHead>Penyelenggara</TableHead>
              <TableHead>Periode Tanggal</TableHead>
              <TableHead>Jam</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">Memuat data...</TableCell></TableRow>
            ) : records.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">Belum ada rekaman untuk {periodLabel}. Anda bisa menambahkan lebih dari satu jika mengupload beberapa sertifikat.</TableCell></TableRow>
            ) : (
              records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.nama_kegiatan}</TableCell>
                  <TableCell className="text-sm">{r.penyelenggara || '-'}</TableCell>
                  <TableCell className="text-xs">{r.tanggal_mulai}{r.tanggal_selesai && ` s/d ${r.tanggal_selesai}`}</TableCell>
                  <TableCell>{r.jumlah_jam || '-'} jam</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(r)} className="text-rose-600"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Rekaman Sertifikasi' : 'Tambah Rekaman Sertifikasi'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Nama Kegiatan *</Label>
              <Input value={form.nama_kegiatan} onChange={(e) => setForm({ ...form, nama_kegiatan: e.target.value })} placeholder="Nama lengkap kegiatan..." />
            </div>
            <div>
              <Label>Penyelenggara</Label>
              <Input value={form.penyelenggara} onChange={(e) => setForm({ ...form, penyelenggara: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Tanggal Mulai</Label>
                <Input type="date" value={form.tanggal_mulai} onChange={(e) => setForm({ ...form, tanggal_mulai: e.target.value })} />
              </div>
              <div>
                <Label>Tanggal Selesai</Label>
                <Input type="date" value={form.tanggal_selesai} onChange={(e) => setForm({ ...form, tanggal_selesai: e.target.value })} />
              </div>
              <div>
                <Label>Jumlah Jam</Label>
                <Input type="number" value={form.jumlah_jam} onChange={(e) => setForm({ ...form, jumlah_jam: e.target.value })} placeholder="JP/Jam" />
              </div>
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
    </div>
  );
}

function SertifikasiAdminTable({ year, period }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get('/ekinerja/sertifikasi', { params: { year, period } })
      .then(({ data }) => setRecords(data || []))
      .catch(() => toast.error('Gagal memuat data'))
      .finally(() => setLoading(false));
  }, [year, period]);

  const filtered = records.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (r.gtk_name || '').toLowerCase().includes(s) || (r.nama_kegiatan || '').toLowerCase().includes(s);
  });

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input placeholder="Cari GTK atau kegiatan..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>GTK</TableHead>
              <TableHead>Nama Kegiatan</TableHead>
              <TableHead>Penyelenggara</TableHead>
              <TableHead>Periode Tanggal</TableHead>
              <TableHead>Jam</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">Memuat data...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">Belum ada rekaman untuk periode ini.</TableCell></TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.gtk_name}</TableCell>
                  <TableCell>{r.nama_kegiatan}</TableCell>
                  <TableCell className="text-sm">{r.penyelenggara || '-'}</TableCell>
                  <TableCell className="text-xs">{r.tanggal_mulai}{r.tanggal_selesai && ` s/d ${r.tanggal_selesai}`}</TableCell>
                  <TableCell>{r.jumlah_jam || '-'} jam</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
