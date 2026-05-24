import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, FileText, Search, Download, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const EMPTY_FORM = {
  student_id: '',
  tahun_ajaran: '',
  semester: '',
  nominal_pengajuan: '',
  tanggal_pengajuan: '',
  status_ajuan: 'pending',
  alasan_pengajuan: '',
  dokumen_pendukung: '',
  catatan_verifikasi: '',
  diverifikasi_oleh: '',
  tanggal_verifikasi: '',
};

const STATUS_AJUAN = [
  { value: 'pending', label: 'Menunggu Verifikasi', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  { value: 'disetujui', label: 'Disetujui', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
  { value: 'ditolak', label: 'Ditolak', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: XCircle },
];

export default function AdminPIPProposalPage() {
  const [data, setData] = useState([]);
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTahunAjaran, setFilterTahunAjaran] = useState('all');
  const [open, setOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [verifying, setVerifying] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [verifyForm, setVerifyForm] = useState({ status_ajuan: '', catatan_verifikasi: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: studentsData } = await api.get('/users', { params: { role: 'siswa' } });
      setStudents(studentsData);

      // TODO: Load PIP proposals data from API
      setData([]);
    } catch (e) {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, tanggal_pengajuan: new Date().toISOString().split('T')[0] });
    setOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({ ...item });
    setOpen(true);
  };

  const openVerify = (item) => {
    setVerifying(item);
    setVerifyForm({
      status_ajuan: item.status_ajuan || 'pending',
      catatan_verifikasi: item.catatan_verifikasi || '',
    });
    setVerifyOpen(true);
  };

  const handleSubmit = () => {
    if (!form.student_id || !form.tahun_ajaran || !form.nominal_pengajuan) {
      toast.error('Siswa, tahun ajaran, dan nominal pengajuan wajib diisi');
      return;
    }
    toast.info('Fitur simpan ajuan PIP sedang dalam pengembangan');
    setOpen(false);
  };

  const handleVerify = () => {
    if (!verifyForm.status_ajuan || verifyForm.status_ajuan === 'pending') {
      toast.error('Pilih status verifikasi (Disetujui/Ditolak)');
      return;
    }
    toast.info('Fitur verifikasi ajuan PIP sedang dalam pengembangan');
    setVerifyOpen(false);
  };

  const handleDelete = (item) => {
    if (!window.confirm('Hapus ajuan PIP ini?')) return;
    toast.info('Fitur hapus sedang dalam pengembangan');
  };

  const handleExport = () => {
    toast.info('Fitur export sedang dalam pengembangan');
  };

  const filteredData = data.filter(d => {
    if (filterStatus !== 'all' && d.status_ajuan !== filterStatus) return false;
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
  const totalAjuan = data.length;
  const totalPending = data.filter(d => d.status_ajuan === 'pending').length;
  const totalDisetujui = data.filter(d => d.status_ajuan === 'disetujui').length;
  const totalDitolak = data.filter(d => d.status_ajuan === 'ditolak').length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <FileText className="h-3 w-3 mr-1" /> Daftar Ajuan PIP
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Daftar Ajuan PIP</h1>
          <p className="text-sm text-slate-600 mt-1">Pengajuan Program Indonesia Pintar</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExport} variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2">
            <Plus className="h-4 w-4" /> Tambah Ajuan
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Total Ajuan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#006837]">{totalAjuan}</div>
            <div className="text-xs text-slate-500">Semua ajuan</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Menunggu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{totalPending}</div>
            <div className="text-xs text-slate-500">Belum diverifikasi</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Disetujui</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{totalDisetujui}</div>
            <div className="text-xs text-slate-500">Ajuan disetujui</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Ditolak</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">{totalDitolak}</div>
            <div className="text-xs text-slate-500">Ajuan ditolak</div>
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
                  {STATUS_AJUAN.map(s => (
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
                  <TableHead>Nominal</TableHead>
                  <TableHead>Tgl Pengajuan</TableHead>
                  <TableHead>Status</TableHead>
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
                      Belum ada ajuan PIP. Klik "Tambah Ajuan" untuk membuat ajuan baru.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((item) => {
                    const student = students.find(s => s.id === item.student_id);
                    const statusInfo = STATUS_AJUAN.find(s => s.value === item.status_ajuan);
                    const StatusIcon = statusInfo?.icon;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">{student?.nisn || '-'}</TableCell>
                        <TableCell className="font-medium">{student?.full_name || '-'}</TableCell>
                        <TableCell className="text-sm">{student?.student_class_name || '-'}</TableCell>
                        <TableCell>{item.tahun_ajaran}</TableCell>
                        <TableCell className="font-semibold text-[#006837]">
                          {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(item.nominal_pengajuan)}
                        </TableCell>
                        <TableCell className="text-sm">{item.tanggal_pengajuan || '-'}</TableCell>
                        <TableCell>
                          <Badge className={statusInfo?.color || 'bg-slate-100 text-slate-700'}>
                            {StatusIcon && <StatusIcon className="h-3 w-3 mr-1" />}
                            {statusInfo?.label || item.status_ajuan}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {item.status_ajuan === 'pending' && (
                              <Button size="sm" variant="outline" onClick={() => openVerify(item)} className="gap-1 h-8">
                                <CheckCircle className="h-3 w-3" /> Verifikasi
                              </Button>
                            )}
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

      {/* Dialog Form Ajuan */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Ajuan PIP' : 'Tambah Ajuan PIP'}</DialogTitle>
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
                <Label>Nominal Pengajuan *</Label>
                <Input type="number" value={form.nominal_pengajuan} onChange={(e) => setForm({ ...form, nominal_pengajuan: e.target.value })} placeholder="450000" />
              </div>
              <div>
                <Label>Tanggal Pengajuan</Label>
                <Input type="date" value={form.tanggal_pengajuan} onChange={(e) => setForm({ ...form, tanggal_pengajuan: e.target.value })} />
              </div>
            </div>

            <div>
              <Label>Alasan Pengajuan</Label>
              <Textarea value={form.alasan_pengajuan} onChange={(e) => setForm({ ...form, alasan_pengajuan: e.target.value })} rows={3} placeholder="Jelaskan alasan pengajuan PIP..." />
            </div>

            <div>
              <Label>Dokumen Pendukung</Label>
              <Input value={form.dokumen_pendukung} onChange={(e) => setForm({ ...form, dokumen_pendukung: e.target.value })} placeholder="URL/path dokumen pendukung" />
              <p className="text-xs text-slate-500 mt-1">Kartu Keluarga, Surat Keterangan Tidak Mampu, dll</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} className="bg-[#006837] hover:bg-[#0B7A3B]">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Verifikasi */}
      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Verifikasi Ajuan PIP</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {verifying && (
              <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                <div className="text-sm font-medium">{students.find(s => s.id === verifying.student_id)?.full_name}</div>
                <div className="text-xs text-slate-600">NISN: {students.find(s => s.id === verifying.student_id)?.nisn}</div>
                <div className="text-xs text-slate-600">Nominal: {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(verifying.nominal_pengajuan)}</div>
              </div>
            )}

            <div>
              <Label>Status Verifikasi *</Label>
              <Select value={verifyForm.status_ajuan} onValueChange={(v) => setVerifyForm({ ...verifyForm, status_ajuan: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="disetujui">Disetujui</SelectItem>
                  <SelectItem value="ditolak">Ditolak</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Catatan Verifikasi</Label>
              <Textarea
                value={verifyForm.catatan_verifikasi}
                onChange={(e) => setVerifyForm({ ...verifyForm, catatan_verifikasi: e.target.value })}
                rows={3}
                placeholder="Catatan untuk verifikasi..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyOpen(false)}>Batal</Button>
            <Button onClick={handleVerify} className="bg-[#006837] hover:bg-[#0B7A3B]">Simpan Verifikasi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
