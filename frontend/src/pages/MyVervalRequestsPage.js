import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Eye, Clock, AlertCircle, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function MyVervalRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/verval-requests');
      setRequests(data);
    } catch (e) {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const openDetail = (req) => {
    setSelectedRequest(req);
    setDetailOpen(true);
  };

  const statusBadge = (status) => {
    if (status === 'pending') return <Badge className="bg-amber-100 text-amber-800"><Clock className="h-3 w-3 mr-1" /> Menunggu Review</Badge>;
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
      nip_nuptk: 'NIP/NUPTK',
      nisn: 'NISN',
      nis: 'NIS',
      gender: 'Jenis Kelamin',
      birth_place: 'Tempat Lahir',
      birth_date: 'Tanggal Lahir',
      address: 'Alamat',
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
              <div className="bg-slate-50 border border-slate-200 rounded p-3 min-h-[60px]">
                <p className="text-sm text-slate-900 break-words">{old_data[field] || <span className="text-slate-400 italic">Tidak ada data</span>}</p>
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-2 block">{fieldLabels[field] || field} - PERUBAHAN</Label>
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
  const rejectedCount = requests.filter(r => r.status === 'rejected').length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <FileText className="h-3 w-3 mr-1" /> Ajuan Verval Saya
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold">Riwayat Ajuan Verval Data</h1>
          <p className="text-sm text-slate-600 mt-1">
            Lihat status pengajuan perubahan data Anda
          </p>
        </div>
        <Button onClick={refresh} variant="outline" disabled={loading}>
          Refresh
        </Button>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">Total Ajuan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{requests.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-amber-800">Menunggu Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-900">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card className={rejectedCount > 0 ? 'bg-rose-50 border-rose-200' : ''}>
          <CardHeader className="pb-3">
            <CardTitle className={`text-sm font-medium ${rejectedCount > 0 ? 'text-rose-800' : 'text-slate-600'}`}>Ditolak</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${rejectedCount > 0 ? 'text-rose-900' : 'text-slate-900'}`}>{rejectedCount}</div>
          </CardContent>
        </Card>
      </div>

      {rejectedCount > 0 && (
        <Card className="bg-rose-50 border-rose-200">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-rose-600" />
            <div className="text-sm text-rose-900">
              <p className="font-semibold">Ada ajuan yang ditolak</p>
              <p className="text-xs">Silakan lihat catatan admin untuk detail penolakan.</p>
            </div>
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
                  <TableHead>Status</TableHead>
                  <TableHead>Direview Oleh</TableHead>
                  <TableHead>Tanggal Review</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">Memuat...</TableCell>
                  </TableRow>
                ) : requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="h-12 w-12 text-slate-300" />
                        <p>Belum ada ajuan verval</p>
                        <p className="text-xs">Ajuan akan muncul ketika Anda mengubah data profil</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : requests.map(req => (
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
                    <TableCell>{statusBadge(req.status)}</TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {req.reviewed_by_name || <span className="text-slate-400">Belum direview</span>}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {req.reviewed_at ? new Date(req.reviewed_at).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      }) : '-'}
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

      {/* Dialog Detail */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#006837]" />
              Detail Ajuan Perubahan Data
            </DialogTitle>
            <DialogDescription>
              Berikut adalah perubahan data yang Anda ajukan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedRequest && (
              <>
                <div className="bg-slate-50 border rounded-lg p-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-slate-600">Status:</span> {statusBadge(selectedRequest.status)}</div>
                    <div><span className="text-slate-600">Tanggal Pengajuan:</span> {new Date(selectedRequest.created_at).toLocaleString('id-ID')}</div>
                    {selectedRequest.reviewed_by_name && (
                      <>
                        <div><span className="text-slate-600">Direview oleh:</span> <strong>{selectedRequest.reviewed_by_name}</strong></div>
                        <div><span className="text-slate-600">Tanggal Review:</span> {new Date(selectedRequest.reviewed_at).toLocaleString('id-ID')}</div>
                      </>
                    )}
                  </div>
                </div>

                {renderComparison()}

                {selectedRequest.admin_notes && (
                  <Card className={selectedRequest.status === 'rejected' ? 'bg-rose-50 border-rose-200' : 'bg-blue-50 border-blue-200'}>
                    <CardContent className="p-4">
                      <Label className="text-xs text-slate-600 mb-2 block flex items-center gap-1">
                        {selectedRequest.status === 'rejected' ? <XCircle className="h-3 w-3 text-rose-600" /> : <CheckCircle className="h-3 w-3 text-blue-600" />}
                        Catatan Admin:
                      </Label>
                      <p className="text-sm text-slate-900">{selectedRequest.admin_notes}</p>
                    </CardContent>
                  </Card>
                )}

                {selectedRequest.status === 'pending' && (
                  <Card className="bg-amber-50 border-amber-200">
                    <CardContent className="p-4 flex items-center gap-3">
                      <Clock className="h-5 w-5 text-amber-600" />
                      <div className="text-sm text-amber-900">
                        <p className="font-semibold">Menunggu Review Admin</p>
                        <p className="text-xs">Ajuan Anda sedang diproses. Harap bersabar menunggu.</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
