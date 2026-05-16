import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Plus, Trash2, Eye, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

const TYPE_OPTIONS = [
  { value: 'sarana_prasarana', label: 'Sarana & Prasarana', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { value: 'siswa', label: 'Siswa Bermasalah', color: 'bg-rose-100 text-rose-700 border-rose-300' },
  { value: 'catatan', label: 'Catatan Umum', color: 'bg-blue-100 text-blue-700 border-blue-300' },
];

const PRIORITY_OPTIONS = [
  { value: 'rendah', label: 'Rendah', color: 'bg-slate-100 text-slate-700' },
  { value: 'sedang', label: 'Sedang', color: 'bg-blue-100 text-blue-700' },
  { value: 'tinggi', label: 'Tinggi', color: 'bg-amber-100 text-amber-700' },
  { value: 'mendesak', label: 'Mendesak', color: 'bg-rose-100 text-rose-700' },
];

const STATUS_OPTIONS = [
  { value: 'baru', label: 'Baru', color: 'bg-blue-100 text-blue-700' },
  { value: 'ditinjau', label: 'Ditinjau', color: 'bg-amber-100 text-amber-700' },
  { value: 'dalam_proses', label: 'Dalam Proses', color: 'bg-purple-100 text-purple-700' },
  { value: 'selesai', label: 'Selesai', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'ditolak', label: 'Ditolak', color: 'bg-rose-100 text-rose-700' },
];

export default function ReportPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [form, setForm] = useState({
    type: 'catatan',
    title: '',
    description: '',
    class_id: '',
    student_id: '',
    location: '',
    priority: 'sedang',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get active academic year first
      const ayRes = await api.get('/academic-years/active');
      const activeAY = ayRes.data;

      const [reps, cls] = await Promise.all([
        api.get('/reports'),
        // Load classes for active academic year
        activeAY ? api.get('/classes', { params: { academic_year_id: activeAY.id } }) : api.get('/classes'),
      ]);
      setReports(reps.data);
      setClasses(cls.data);
      console.log('Classes loaded:', cls.data.length, cls.data);
    } catch (e) {
      console.error('Error loading data:', e);
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async (classId) => {
    if (!classId) {
      setStudents([]);
      return;
    }
    try {
      const res = await api.get('/students', { params: { class_id: classId } });
      setStudents(res.data);
    } catch (e) {
      toast.error('Gagal memuat siswa');
    }
  };

  const openCreate = () => {
    setForm({
      type: 'catatan',
      title: '',
      description: '',
      class_id: '',
      student_id: '',
      location: '',
      priority: 'sedang',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.title || !form.description) {
      toast.error('Judul dan deskripsi wajib diisi');
      return;
    }

    try {
      await api.post('/reports', form);
      toast.success('Laporan berhasil dibuat');
      setDialogOpen(false);
      loadData();
    } catch (e) {
      toast.error('Gagal membuat laporan');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus laporan ini?')) return;
    try {
      await api.delete(`/reports/${id}`);
      toast.success('Laporan dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus');
    }
  };

  const viewDetail = async (id) => {
    try {
      const res = await api.get(`/reports/${id}`);
      setSelectedReport(res.data);
      setDetailDialogOpen(true);
    } catch (e) {
      toast.error('Gagal memuat detail');
    }
  };

  const getTypeBadge = (type) => {
    const opt = TYPE_OPTIONS.find((o) => o.value === type) || TYPE_OPTIONS[2];
    return <Badge className={opt.color}>{opt.label}</Badge>;
  };

  const getPriorityBadge = (priority) => {
    const opt = PRIORITY_OPTIONS.find((o) => o.value === priority) || PRIORITY_OPTIONS[1];
    return <Badge className={opt.color}>{opt.label}</Badge>;
  };

  const getStatusBadge = (status) => {
    const opt = STATUS_OPTIONS.find((o) => o.value === status) || STATUS_OPTIONS[0];
    return <Badge className={opt.color}>{opt.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <FileText className="h-3 w-3 mr-1" /> Laporan
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Buat Laporan</h1>
          <p className="text-sm text-slate-600 mt-1">
            Laporkan sarana rusak, siswa bermasalah, atau catatan lainnya
          </p>
        </div>
        <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2">
          <Plus className="h-4 w-4" /> Buat Laporan
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-8 text-center text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Memuat...
          </CardContent>
        </Card>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-slate-500">
            Belum ada laporan. Klik "Buat Laporan" untuk memulai.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <Card key={r.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {getTypeBadge(r.type)}
                      {getPriorityBadge(r.priority)}
                      {getStatusBadge(r.status)}
                    </div>
                    <h3 className="font-semibold text-slate-900 mb-1">{r.title}</h3>
                    <p className="text-sm text-slate-600 line-clamp-2">{r.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                      <span>{new Date(r.reported_at).toLocaleString('id-ID')}</span>
                      {r.class_name && <span>• Kelas: {r.class_name}</span>}
                      {r.student_name && <span>• Siswa: {r.student_name}</span>}
                      {r.location && <span>• Lokasi: {r.location}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => viewDetail(r.id)}
                      className="gap-1"
                    >
                      <Eye className="h-3.5 w-3.5" /> Detail
                    </Button>
                    {r.status === 'baru' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(r.id)}
                        className="text-rose-600 border-rose-300 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Buat Laporan Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Jenis Laporan *</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Prioritas *</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Judul Laporan *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ringkasan singkat masalah..."
              />
            </div>

            <div>
              <Label>Deskripsi Lengkap *</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Jelaskan masalah secara detail..."
                rows={5}
              />
            </div>

            {form.type === 'sarana_prasarana' && (
              <div>
                <Label>Lokasi</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Contoh: Ruang Kelas 7A, Lab Komputer, dll."
                />
              </div>
            )}

            <div>
              <Label>Kelas (Opsional)</Label>
              {classes.length === 0 ? (
                <div className="h-10 border border-amber-200 bg-amber-50 rounded-md flex items-center px-3 text-sm text-amber-700">
                  Tidak ada data kelas tersedia
                </div>
              ) : (
                <Select
                  value={form.class_id || undefined}
                  onValueChange={(v) => {
                    setForm({ ...form, class_id: v || '', student_id: '' });
                    if (v) loadStudents(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kelas (jika relevan)" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {form.type === 'siswa' && form.class_id && (
              <div>
                <Label>Siswa</Label>
                <Select
                  value={form.student_id || undefined}
                  onValueChange={(v) => setForm({ ...form, student_id: v || '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih siswa" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.full_name} ({s.username})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button onClick={handleSubmit} className="flex-1 bg-[#006837] hover:bg-[#0B7A3B]">
                Kirim Laporan
              </Button>
              <Button onClick={() => setDialogOpen(false)} variant="outline">
                Batal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Laporan</DialogTitle>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4 pt-4">
              <div className="flex gap-2 flex-wrap">
                {getTypeBadge(selectedReport.type)}
                {getPriorityBadge(selectedReport.priority)}
                {getStatusBadge(selectedReport.status)}
              </div>

              <div>
                <Label className="text-xs text-slate-500">Judul</Label>
                <p className="font-semibold text-slate-900">{selectedReport.title}</p>
              </div>

              <div>
                <Label className="text-xs text-slate-500">Deskripsi</Label>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedReport.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-500">Dilaporkan Oleh</Label>
                  <p className="text-sm">{selectedReport.reporter_name}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Tanggal Laporan</Label>
                  <p className="text-sm">{new Date(selectedReport.reported_at).toLocaleString('id-ID')}</p>
                </div>
              </div>

              {selectedReport.class_name && (
                <div>
                  <Label className="text-xs text-slate-500">Kelas</Label>
                  <p className="text-sm">{selectedReport.class_name}</p>
                </div>
              )}

              {selectedReport.student_name && (
                <div>
                  <Label className="text-xs text-slate-500">Siswa</Label>
                  <p className="text-sm">{selectedReport.student_name}</p>
                </div>
              )}

              {selectedReport.location && (
                <div>
                  <Label className="text-xs text-slate-500">Lokasi</Label>
                  <p className="text-sm">{selectedReport.location}</p>
                </div>
              )}

              {selectedReport.response && (
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <Label className="text-xs text-slate-500">Tanggapan Admin</Label>
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap bg-amber-50 p-3 rounded-lg">
                    {selectedReport.response}
                  </p>
                  {selectedReport.reviewer_name && (
                    <p className="text-xs text-slate-500 mt-2">
                      Ditanggapi oleh: {selectedReport.reviewer_name}
                      {selectedReport.reviewed_at && ` pada ${new Date(selectedReport.reviewed_at).toLocaleString('id-ID')}`}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
