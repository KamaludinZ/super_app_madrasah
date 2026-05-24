import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, Award, BookOpen, Search, Upload, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const EMPTY_FORM = {
  gtk_id: '',
  jenis_kegiatan: 'pelatihan',
  nama_kegiatan: '',
  penyelenggara: '',
  tanggal_mulai: '',
  tanggal_selesai: '',
  jumlah_jam: '',
  sertifikat_no: '',
  sertifikat_file: null,
  keterangan: '',
};

const JENIS_KEGIATAN = [
  { value: 'pelatihan', label: 'Pelatihan/Workshop' },
  { value: 'seminar', label: 'Seminar/Webinar' },
  { value: 'diklat', label: 'Diklat' },
  { value: 'bimtek', label: 'Bimbingan Teknis' },
  { value: 'sertifikasi', label: 'Sertifikasi' },
  { value: 'penelitian', label: 'Penelitian' },
  { value: 'publikasi', label: 'Publikasi Ilmiah' },
  { value: 'lainnya', label: 'Lainnya' },
];

export default function AdminProfesionalitasGTKPage() {
  const [data, setData] = useState([]);
  const [gtkList, setGtkList] = useState([]);
  const [search, setSearch] = useState('');
  const [filterJenis, setFilterJenis] = useState('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: usersData } = await api.get('/users');
      const gtk = usersData.filter(u =>
        u.roles?.some(r => ['guru', 'wali_kelas', 'tenaga_kependidikan'].includes(r))
      );
      setGtkList(gtk);

      // TODO: Load profesionalitas data from API
      setData([]);
    } catch (e) {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({ ...item, sertifikat_file: null });
    setOpen(true);
  };

  const handleSubmit = () => {
    if (!form.gtk_id || !form.nama_kegiatan || !form.tanggal_mulai) {
      toast.error('GTK, nama kegiatan, dan tanggal mulai wajib diisi');
      return;
    }
    toast.info('Fitur simpan data profesionalitas sedang dalam pengembangan');
    setOpen(false);
  };

  const handleDelete = (item) => {
    if (!window.confirm('Hapus data ini?')) return;
    toast.info('Fitur hapus sedang dalam pengembangan');
  };

  const handleExport = () => {
    toast.info('Fitur export sedang dalam pengembangan');
  };

  const filteredData = data.filter(d => {
    if (filterJenis !== 'all' && d.jenis_kegiatan !== filterJenis) return false;
    if (!search) return true;
    const gtk = gtkList.find(g => g.id === d.gtk_id);
    const name = gtk?.full_name?.toLowerCase() || '';
    const kegiatan = d.nama_kegiatan?.toLowerCase() || '';
    return name.includes(search.toLowerCase()) || kegiatan.includes(search.toLowerCase());
  });

  // Group data by GTK for summary
  const summaryByGTK = gtkList.map(gtk => {
    const items = data.filter(d => d.gtk_id === gtk.id);
    const totalJam = items.reduce((sum, item) => sum + (parseInt(item.jumlah_jam) || 0), 0);
    return {
      gtk,
      totalKegiatan: items.length,
      totalJam,
    };
  }).filter(s => s.totalKegiatan > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <Award className="h-3 w-3 mr-1" /> Profesionalitas GTK
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Profesionalitas GTK</h1>
          <p className="text-sm text-slate-600 mt-1">Pengembangan Kompetensi dan Profesionalitas</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExport} variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2">
            <Plus className="h-4 w-4" /> Tambah Data
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summaryByGTK.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {summaryByGTK.slice(0, 6).map((summary) => (
            <Card key={summary.gtk.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-600">
                  {summary.gtk.full_name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-[#006837]">{summary.totalKegiatan}</div>
                    <div className="text-xs text-slate-500">Kegiatan</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-slate-700">{summary.totalJam}</div>
                    <div className="text-xs text-slate-500">Jam</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Cari GTK atau kegiatan..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterJenis} onValueChange={setFilterJenis}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Jenis Kegiatan</SelectItem>
                  {JENIS_KEGIATAN.map(j => (
                    <SelectItem key={j.value} value={j.value}>{j.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GTK</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Nama Kegiatan</TableHead>
                  <TableHead>Penyelenggara</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>Jam</TableHead>
                  <TableHead>Sertifikat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-500">Memuat data...</TableCell>
                  </TableRow>
                ) : filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                      Belum ada data profesionalitas. Klik "Tambah Data" untuk membuat data baru.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((item) => {
                    const gtk = gtkList.find(g => g.id === item.gtk_id);
                    const jenisInfo = JENIS_KEGIATAN.find(j => j.value === item.jenis_kegiatan);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{gtk?.full_name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{jenisInfo?.label || item.jenis_kegiatan}</Badge>
                        </TableCell>
                        <TableCell>{item.nama_kegiatan}</TableCell>
                        <TableCell className="text-sm">{item.penyelenggara || '-'}</TableCell>
                        <TableCell className="text-xs">
                          {item.tanggal_mulai}
                          {item.tanggal_selesai && ` s/d ${item.tanggal_selesai}`}
                        </TableCell>
                        <TableCell>{item.jumlah_jam || '-'} jam</TableCell>
                        <TableCell>
                          {item.sertifikat_no ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                              {item.sertifikat_no}
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(item)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(item)} className="text-rose-600">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Data Profesionalitas' : 'Tambah Data Profesionalitas'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>GTK *</Label>
                <Select value={form.gtk_id} onValueChange={(v) => setForm({ ...form, gtk_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih GTK..." /></SelectTrigger>
                  <SelectContent>
                    {gtkList.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Jenis Kegiatan</Label>
                <Select value={form.jenis_kegiatan} onValueChange={(v) => setForm({ ...form, jenis_kegiatan: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {JENIS_KEGIATAN.map(j => (
                      <SelectItem key={j.value} value={j.value}>{j.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Nama Kegiatan *</Label>
              <Input value={form.nama_kegiatan} onChange={(e) => setForm({ ...form, nama_kegiatan: e.target.value })} placeholder="Nama lengkap kegiatan..." />
            </div>

            <div>
              <Label>Penyelenggara</Label>
              <Input value={form.penyelenggara} onChange={(e) => setForm({ ...form, penyelenggara: e.target.value })} placeholder="Nama lembaga/institusi penyelenggara..." />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Tanggal Mulai *</Label>
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nomor Sertifikat</Label>
                <Input value={form.sertifikat_no} onChange={(e) => setForm({ ...form, sertifikat_no: e.target.value })} placeholder="Nomor sertifikat (jika ada)" />
              </div>
              <div>
                <Label>File Sertifikat</Label>
                <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setForm({ ...form, sertifikat_file: e.target.files[0] })} />
                <p className="text-xs text-slate-500 mt-1">Format: PDF, JPG, PNG (Max 2MB)</p>
              </div>
            </div>

            <div>
              <Label>Keterangan</Label>
              <Textarea value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} rows={2} placeholder="Keterangan tambahan..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} className="bg-[#006837] hover:bg-[#0B7A3B]">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
