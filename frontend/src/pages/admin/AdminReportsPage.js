import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Eye, Loader2, AlertTriangle, Filter, MessageSquare } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

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

export default function AdminReportsPage() {
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [responseDialogOpen, setResponseDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [responseForm, setResponseForm] = useState({ status: '', response: '' });
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [reports, filterType, filterStatus, filterClass]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reps, cls, sts] = await Promise.all([
        api.get('/reports'),
        api.get('/classes'),
        api.get('/reports/stats/summary'),
      ]);
      setReports(reps.data);
      setClasses(cls.data);
      setStats(sts.data);
    } catch (e) {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...reports];
    if (filterType) {
      filtered = filtered.filter((r) => r.type === filterType);
    }
    if (filterStatus) {
      filtered = filtered.filter((r) => r.status === filterStatus);
    }
    if (filterClass) {
      filtered = filtered.filter((r) => r.class_id === filterClass);
    }
    setFilteredReports(filtered);
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

  const openResponse = (report) => {
    setSelectedReport(report);
    setResponseForm({
      status: report.status,
      response: report.response || '',
    });
    setResponseDialogOpen(true);
  };

  const handleUpdateReport = async () => {
    if (!selectedReport) return;
    try {
      await api.put(`/reports/${selectedReport.id}`, responseForm);
      toast.success('Laporan berhasil diperbarui');
      setResponseDialogOpen(false);
      loadData();
    } catch (e) {
      toast.error('Gagal memperbarui laporan');
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
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <FileText className="h-3 w-3 mr-1" /> Data Laporan
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Semua Laporan</h1>
        <p className="text-sm text-slate-600 mt-1">
          Kelola semua laporan dari guru dan wali kelas
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
              <div className="text-xs text-slate-600">Total</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{stats.by_status?.baru || 0}</div>
              <div className="text-xs text-slate-600">Baru</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-amber-600">{stats.by_status?.ditinjau || 0}</div>
              <div className="text-xs text-slate-600">Ditinjau</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-purple-600">{stats.by_status?.dalam_proses || 0}</div>
              <div className="text-xs text-slate-600">Proses</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-emerald-600">{stats.by_status?.selesai || 0}</div>
              <div className="text-xs text-slate-600">Selesai</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="h-4 w-4 text-slate-600" />
            <div className="flex-1 min-w-[130px]">
              <Select value={filterType || undefined} onValueChange={(val) => setFilterType(val || '')}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Semua Jenis" />
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
            <div className="flex-1 min-w-[130px]">
              <Select value={filterStatus || undefined} onValueChange={(val) => setFilterStatus(val || '')}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[130px]">
              <Select value={filterClass || undefined} onValueChange={(val) => setFilterClass(val || '')}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Semua Kelas" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(filterType || filterStatus || filterClass) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setFilterType('');
                  setFilterStatus('');
                  setFilterClass('');
                }}
              >
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
      {loading ? (
        <Card>
          <CardContent className="p-8 text-center text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Memuat...
          </CardContent>
        </Card>
      ) : filteredReports.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-slate-500">
            Tidak ada laporan yang sesuai filter.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredReports.map((r) => (
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
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 flex-wrap">
                      <span>{new Date(r.reported_at).toLocaleString('id-ID')}</span>
                      {r.reporter_name && <span>• {r.reporter_name}</span>}
                      {r.class_name && <span>• {r.class_name}</span>}
                      {r.student_name && <span>• Siswa: {r.student_name}</span>}
                      {r.location && <span>• {r.location}</span>}
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
                    <Button
                      size="sm"
                      onClick={() => openResponse(r)}
                      className="bg-[#006837] hover:bg-[#0B7A3B] gap-1"
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> Tanggapi
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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

      {/* Response Dialog */}
      <Dialog open={responseDialogOpen} onOpenChange={setResponseDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tanggapi Laporan</DialogTitle>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4 pt-4">
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">Laporan</Label>
                <p className="font-semibold text-slate-900">{selectedReport.title}</p>
              </div>

              <div>
                <Label>Status *</Label>
                <Select
                  value={responseForm.status}
                  onValueChange={(v) => setResponseForm({ ...responseForm, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Tanggapan</Label>
                <Textarea
                  value={responseForm.response}
                  onChange={(e) => setResponseForm({ ...responseForm, response: e.target.value })}
                  placeholder="Tuliskan tanggapan Anda terhadap laporan ini..."
                  rows={6}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleUpdateReport}
                  className="flex-1 bg-[#006837] hover:bg-[#0B7A3B]"
                >
                  Simpan
                </Button>
                <Button onClick={() => setResponseDialogOpen(false)} variant="outline">
                  Batal
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
