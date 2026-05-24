import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, DollarSign, Search, Download, Upload, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const EMPTY_FORM = {
  student_id: '',
  tahun_ajaran: '',
  semester: '',
  nominal: '',
  tanggal_penerimaan: '',
  bank: '',
  nomor_rekening: '',
  atas_nama: '',
  status_penyaluran: 'diajukan',
  keterangan: '',
};

const STATUS_PENYALURAN = [
  { value: 'diajukan', label: 'Diajukan', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'disetujui', label: 'Disetujui', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'disalurkan', label: 'Disalurkan', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'ditolak', label: 'Ditolak', color: 'bg-rose-100 text-rose-700 border-rose-200' },
];

export default function AdminPIPReceiverPage() {
  const [data, setData] = useState([]);
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTahunAjaran, setFilterTahunAjaran] = useState('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: studentsData } = await api.get('/users', { params: { role: 'siswa' } });
      setStudents(studentsData);

      // TODO: Load PIP receivers data from API
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
    setForm({ ...item });
    setOpen(true);
  };

  const handleSubmit = () => {
    if (!form.student_id || !form.tahun_ajaran || !form.nominal) {
      toast.error('Siswa, tahun ajaran, dan nominal wajib diisi');
      return;
    }
    toast.info('Fitur simpan data penerima PIP sedang dalam pengembangan');
    setOpen(false);
  };

  const handleDelete = (item) => {
    if (!window.confirm('Hapus data penerima PIP ini?')) return;
    toast.info('Fitur hapus sedang dalam pengembangan');
  };

  const handleExport = () => {
    toast.info('Fitur export sedang dalam pengembangan');
  };

  const handleImport = () => {
    toast.info('Fitur import sedang dalam pengembangan');
  };

  const filteredData = data.filter(d => {
    if (filterStatus !== 'all' && d.status_penyaluran !== filterStatus) return false;
    if (filterTahunAjaran !== 'all' && d.tahun_ajaran !== filterTahunAjaran) return false;
    if (!search) return true;
    const student = students.find(s => s.id === d.student_id);
    const name = student?.full_name?.toLowerCase() || '';
    const nisn = student?.nisn?.toLowerCase() || '';
    return name.includes(search.toLowerCase()) || nisn.includes(search.toLowerCase());
  });

  // Get unique tahun ajaran for filter
  const tahunAjaranList = [...new Set(data.map(d => d.tahun_ajaran))].filter(Boolean);

  // Summary statistics
  const totalPenerima = data.length;
  const totalNominal = data.reduce((sum, d) => sum + (parseFloat(d.nominal) || 0), 0);
  const totalDisalurkan = data.filter(d => d.status_penyaluran === 'disalurkan').length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <DollarSign className="h-3 w-3 mr-1" /> Data Penerima PIP
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Data Penerima PIP</h1>
          <p className="text-sm text-slate-600 mt-1">Program Indonesia Pintar (PIP)</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleImport} variant="outline" className="gap-2">
            <Upload className="h-4 w-4" /> Import
          </Button>
          <Button onClick={handleExport} variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2">
            <Plus className="h-4 w-4" /> Tambah Data
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Total Penerima</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#006837]">{totalPenerima}</div>
            <div className="text-xs text-slate-500">Siswa</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Total Nominal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#006837]">
              {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalNominal)}
            </div>
            <div className="text-xs text-slate-500">Keseluruhan</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Sudah Disalurkan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{totalDisalurkan}</div>
            <div className="text-xs text-slate-500">Dari {totalPenerima} penerima</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Cari nama atau NISN siswa..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  {STATUS_PENYALURAN.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterTahunAjaran} onValueChange={setFilterTahunAjaran}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tahun Ajaran</SelectItem>
                  {tahunAjaranList.map(ta => (
                    <SelectItem key={ta} value={ta}>{ta}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NISN</TableHead>
                  <TableHead>Nama Siswa</TableHead>
                  <TableHead>Kelas</TableHead>
                  <TableHead>Tahun Ajaran</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead>Nominal</TableHead>
                  <TableHead>Tgl Penerimaan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-slate-500">Memuat data...</TableCell>
                  </TableRow>
                ) : filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                      Belum ada data penerima PIP. Klik "Tambah Data" untuk membuat data baru.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((item) => {
                    const student = students.find(s => s.id === item.student_id);
                    const statusInfo = STATUS_PENYALURAN.find(s => s.value === item.status_penyaluran);
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">{student?.nisn || '-'}</TableCell>
                        <TableCell className="font-medium">{student?.full_name || '-'}</TableCell>
                        <TableCell className="text-sm">{student?.student_class_name || '-'}</TableCell>
                        <TableCell>{item.tahun_ajaran}</TableCell>
                        <TableCell className="capitalize">{item.semester}</TableCell>
                        <TableCell className="font-semibold text-[#006837]">
                          {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(item.nominal)}
                        </TableCell>
                        <TableCell className="text-sm">{item.tanggal_penerimaan || '-'}</TableCell>
                        <TableCell>
                          <Badge className={statusInfo?.color || 'bg-slate-100 text-slate-700'}>
                            {statusInfo?.label || item.status_penyaluran}
                          </Badge>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Data Penerima PIP' : 'Tambah Data Penerima PIP'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Siswa *</Label>
                <Select value={form.student_id} onValueChange={(v) => setForm({ ...form, student_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih siswa..." /></SelectTrigger>
                  <SelectContent>
                    {students.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.full_name} - {s.nisn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tahun Ajaran *</Label>
                <Input value={form.tahun_ajaran} onChange={(e) => setForm({ ...form, tahun_ajaran: e.target.value })} placeholder="2024/2025" />
              </div>
              <div>
                <Label>Semester</Label>
                <Select value={form.semester} onValueChange={(v) => setForm({ ...form, semester: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih semester..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ganjil">Ganjil</SelectItem>
                    <SelectItem value="genap">Genap</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nominal *</Label>
                <Input type="number" value={form.nominal} onChange={(e) => setForm({ ...form, nominal: e.target.value })} placeholder="450000" />
              </div>
              <div>
                <Label>Tanggal Penerimaan</Label>
                <Input type="date" value={form.tanggal_penerimaan} onChange={(e) => setForm({ ...form, tanggal_penerimaan: e.target.value })} />
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#006837]" /> Informasi Rekening
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nama Bank</Label>
                  <Input value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} placeholder="BRI, BNI, Mandiri, dll" />
                </div>
                <div>
                  <Label>Nomor Rekening</Label>
                  <Input value={form.nomor_rekening} onChange={(e) => setForm({ ...form, nomor_rekening: e.target.value })} placeholder="xxxx-xxxx-xxxx" />
                </div>
                <div className="col-span-2">
                  <Label>Atas Nama</Label>
                  <Input value={form.atas_nama} onChange={(e) => setForm({ ...form, atas_nama: e.target.value })} placeholder="Nama pemilik rekening" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status Penyaluran</Label>
                <Select value={form.status_penyaluran} onValueChange={(v) => setForm({ ...form, status_penyaluran: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_PENYALURAN.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
