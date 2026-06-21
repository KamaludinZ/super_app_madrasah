import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CheckCircle, XCircle, Eye, Clock, AlertCircle, UserCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function AdminVervalSiswaPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchName, setSearchName] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      const params = { user_type: 'siswa' };
      if (statusFilter !== 'all') params.status = statusFilter;
      const { data } = await api.get('/verval-requests', { params });
      setRequests(data);
    } catch (e) {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [statusFilter]);

  const openDetail = (req) => {
    setSelectedRequest(req);
    setAdminNotes(req.admin_notes || '');
    setDetailOpen(true);
  };

  const handleApprove = async () => {
    if (!window.confirm('Setujui perubahan data ini?')) return;
    setActionLoading(true);
    try {
      await api.post(`/verval-requests/${selectedRequest.id}/approve`, { admin_notes: adminNotes });
      toast.success('Perubahan data disetujui');
      setDetailOpen(false);
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!adminNotes.trim()) {
      toast.error('Catatan penolakan wajib diisi');
      return;
    }
    if (!window.confirm('Tolak perubahan data ini? Siswa akan menerima catatan penolakan.')) return;
    setActionLoading(true);
    try {
      await api.post(`/verval-requests/${selectedRequest.id}/reject`, { admin_notes: adminNotes });
      toast.success('Perubahan data ditolak');
      setDetailOpen(false);
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal reject');
    } finally {
      setActionLoading(false);
    }
  };

  const statusBadge = (status) => {
    if (status === 'pending') return <Badge className="bg-amber-100 text-amber-800"><Clock className="h-3 w-3 mr-1" /> Menunggu</Badge>;
    if (status === 'approved') return <Badge className="bg-emerald-100 text-emerald-800"><CheckCircle className="h-3 w-3 mr-1" /> Disetujui</Badge>;
    if (status === 'rejected') return <Badge className="bg-rose-100 text-rose-800"><XCircle className="h-3 w-3 mr-1" /> Ditolak</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  const renderComparison = () => {
    if (!selectedRequest) return null;
    const { old_data, new_data } = selectedRequest;

    // Field labels yang user-friendly
    const fieldLabels = {
      full_name: 'Nama Lengkap',
      email: 'Email',
      phone: 'Nomor Telepon',
      nisn: 'NISN',
      nis: 'NIS',
      gender: 'Jenis Kelamin',
      birth_place: 'Tempat Lahir',
      birth_date: 'Tanggal Lahir',
      address: 'Alamat',
      // Add more fields as needed
    };

    // Cari field yang berubah
    const changedFields = Object.keys(new_data).filter(key => {
      return new_data[key] !== old_data[key];
    });

    if (changedFields.length === 0) {
      return <div className="text-center py-8 text-slate-500">Tidak ada perubahan data</div>;
    }

    return (
      <div className="space-y-4">
        {changedFields.map(field => (
          <div key={field} className="grid grid-cols-2 gap-4 border rounded-lg p-4">
            <div>
              <Label className="text-xs text-slate-600 mb-2 block">{fieldLabels[field] || field} - SEBELUM</Label>
              <div className="bg-rose-50 border border-rose-200 rounded p-3 min-h-[60px]">
                <p className="text-sm text-slate-900 break-words">{old_data[field] || <span className="text-slate-400 italic">Tidak ada data</span>}</p>
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-2 block">{fieldLabels[field] || field} - SESUDAH</Label>
              <div className="bg-emerald-50 border border-emerald-200 rounded p-3 min-h-[60px]">
                <p className="text-sm text-slate-900 font-semibold break-words">{new_data[field] || <span className="text-slate-400 italic">Tidak ada data</span>}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const filteredRequests = requests.filter((r) => {
    const keyword = searchName.trim().toLowerCase();
    if (!keyword) return true;
    const name = (r.submitted_by_name || '').toLowerCase();
    return name.includes(keyword);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <UserCheck className="h-3 w-3 mr-1" /> Verval Data Siswa
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold">Verifikasi & Validasi Data Siswa</h1>
          <p className="text-sm text-slate-600 mt-1">
            {filteredRequests.length} request ditampilkan • {pendingCount} menunggu review
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Semua Status</option>
            <option value="pending">Menunggu</option>
            <option value="approved">Disetujui</option>
            <option value="rejected">Ditolak</option>
            <option value="cancelled">Dibatalkan</option>
          </select>
          <Input
            placeholder="Cari nama siswa..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="w-[220px]"
          />
          <Button onClick={refresh} variant="outline" disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {pendingCount > 0 && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <p className="text-sm text-amber-900">
              Ada <strong>{pendingCount} request</strong> yang menunggu untuk direview.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal Pengajuan</TableHead>
                  <TableHead>Nama Siswa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Direview Oleh</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">Memuat...</TableCell>
                  </TableRow>
                ) : filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">Belum ada request verval</TableCell>
                  </TableRow>
                ) : filteredRequests.map(req => (
                  <TableRow key={req.id}>
                    <TableCell className="text-sm">
                      {new Date(req.created_at).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </TableCell>
                    <TableCell className="font-semibold">{req.submitted_by_name || req.user_id}</TableCell>
                    <TableCell>{statusBadge(req.status)}</TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {req.reviewed_by_name || '-'}
                      {req.reviewed_at && (
                        <div className="text-xs text-slate-400 mt-0.5">
                          {new Date(req.reviewed_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => openDetail(req)} className="gap-1">
                        <Eye className="h-3 w-3" /> Detail
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Comparison */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-[#006837]" />
              Verifikasi Perubahan Data Siswa
            </DialogTitle>
            <DialogDescription>
              Periksa perubahan data di bawah ini. Data <strong>sebelum</strong> ditampilkan di sebelah kiri,
              data <strong>perubahan yang diajukan</strong> di sebelah kanan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedRequest && (
              <>
                <div className="bg-slate-50 border rounded-lg p-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-slate-600">Diajukan oleh:</span> <strong>{selectedRequest.submitted_by_name}</strong></div>
                    <div><span className="text-slate-600">Status:</span> {statusBadge(selectedRequest.status)}</div>
                    <div><span className="text-slate-600">Tanggal:</span> {new Date(selectedRequest.created_at).toLocaleString('id-ID')}</div>
                    {selectedRequest.reviewed_by_name && (
                      <div><span className="text-slate-600">Direview:</span> {selectedRequest.reviewed_by_name}</div>
                    )}
                  </div>
                </div>

                {renderComparison()}

                {selectedRequest.status === 'pending' && (
                  <div>
                    <Label className="mb-2">Catatan Admin</Label>
                    <Textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Tambahkan catatan (opsional untuk approve, wajib untuk reject)"
                      rows={3}
                    />
                  </div>
                )}

                {selectedRequest.status !== 'pending' && selectedRequest.admin_notes && (
                  <div className="bg-slate-50 border rounded-lg p-3">
                    <Label className="text-xs text-slate-600 mb-1 block">Catatan Admin:</Label>
                    <p className="text-sm">{selectedRequest.admin_notes}</p>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDetailOpen(false)} disabled={actionLoading}>
              Tutup
            </Button>
            {selectedRequest?.status === 'pending' && (
              <>
                <Button
                  variant="outline"
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="text-rose-600 border-rose-300 hover:bg-rose-50"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Tolak
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Setujui
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
