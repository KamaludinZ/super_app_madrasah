import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CheckCircle, XCircle, Eye, Clock, AlertCircle, UserCheck, FileText, Trophy, ListChecks, Ban } from 'lucide-react';
import { api, openAuthedFile } from '@/lib/api';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ui/confirm-dialog';

export default function AdminVervalSiswaPage() {
  const [requests, setRequests] = useState([]);
  const [allRequests, setAllRequests] = useState([]); // unfiltered, for the stats overview
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
      const params = { user_type: 'siswa', reviewer_view: true };
      if (statusFilter !== 'all') params.status = statusFilter;
      const { data } = await api.get('/verval-requests', { params });
      setRequests(data);
      if (statusFilter === 'all') {
        setAllRequests(data);
      } else {
        const { data: all } = await api.get('/verval-requests', { params: { user_type: 'siswa', reviewer_view: true } });
        setAllRequests(all);
      }
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
    if (!(await confirmDialog('Setujui perubahan data ini?'))) return;
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
    if (!(await confirmDialog('Tolak perubahan data ini? Siswa akan menerima catatan penolakan.'))) return;
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

  const requestTypeBadge = (rt) => {
    if (rt === 'prestasi_create') {
      return <Badge variant="outline" className="gap-1 text-xs border-amber-300 text-amber-700"><Trophy className="h-3 w-3" /> Prestasi</Badge>;
    }
    return <Badge variant="outline" className="gap-1 text-xs border-slate-300 text-slate-600"><FileText className="h-3 w-3" /> Profil</Badge>;
  };

  const PRESTASI_FIELD_LABELS = {
    name: 'Nama Lomba',
    bidang_lomba: 'Bidang Lomba',
    category: 'Kategori Lomba',
    level: 'Tingkat Lomba',
    rank: 'Peringkat',
    organizer: 'Nama Penyelenggara',
    date: 'Tanggal Lomba',
    year: 'Tahun',
    academic_year_label: 'Tahun Pelajaran',
    jenis_lomba: 'Jenis Lomba',
    jenis_penyelenggara: 'Jenis Penyelenggara',
    mode_pelaksanaan: 'Mode Pelaksanaan',
    tempat_pelaksanaan: 'Tempat Pelaksanaan',
    cara_mengikuti: 'Diikuti Secara',
    jenis_hadiah: 'Penerimaan Hadiah',
    nama_pembina: 'Nama Pembina',
    description: 'Deskripsi',
    certificate_url: 'Sertifikat',
    photo_url: 'Foto Pemegang Sertifikat/Piala',
    holder_type: 'Jenis Pemegang',
    holder_id: 'ID Pemegang',
  };

  const HIDDEN_PRESTASI_FIELDS = new Set(['holder_type', 'holder_id', 'holder_name']);

  const pretty = (field, v) => {
    if (v === null || v === undefined || v === '') return <span className="text-slate-400 italic">Tidak ada data</span>;
    if (field === 'certificate_url' || field === 'photo_url') {
      return <button type="button" onClick={() => openAuthedFile(String(v))} className="text-blue-600 underline text-sm">Lihat file</button>;
    }
    if (field === 'jenis_hadiah' && Array.isArray(v)) {
      return v.length ? v.join(', ') : <span className="text-slate-400 italic">Tidak ada data</span>;
    }
    if (typeof v === 'object') {
      return <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(v, null, 2)}</pre>;
    }
    return String(v);
  };

  const renderComparison = () => {
    if (!selectedRequest) return null;
    const { request_type } = selectedRequest;
    // Identitas Pribadi (nama/NISN/NIS/jenis kelamin/tempat & tanggal lahir) dititip di
    // _users_patch pada request bertarget student_details; ratakan agar tampil sebagai
    // field biasa di perbandingan, bukan blok JSON mentah.
    const old_data = { ...(selectedRequest.old_data || {}), ...(selectedRequest.old_data?._users_patch || {}) };
    const new_data = { ...(selectedRequest.new_data || {}), ...(selectedRequest.new_data?._users_patch || {}) };
    delete old_data._users_patch;
    delete new_data._users_patch;

    if (request_type === 'prestasi_create') {
      const fields = Object.keys(new_data || {}).filter((f) => !HIDDEN_PRESTASI_FIELDS.has(f));
      if (fields.length === 0) {
        return <div className="text-center py-8 text-slate-500">Tidak ada data prestasi yang diajukan</div>;
      }
      return (
        <div className="space-y-3">
          {fields.map(field => (
            <div key={field} className="border rounded-lg p-3">
              <Label className="text-xs text-slate-600 mb-1 block">{PRESTASI_FIELD_LABELS[field] || field}</Label>
              <div className="bg-emerald-50 border border-emerald-200 rounded p-3 min-h-[44px]">
                <p className="text-sm text-slate-900 font-medium break-words">{pretty(field, (new_data || {})[field])}</p>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Field labels yang user-friendly (profile_update)
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
      // Field detail siswa (StudentDetailModel / student_details)
      citizenship: 'Kewarganegaraan',
      nik: 'NIK',
      jumlah_saudara: 'Jumlah Saudara',
      anak_ke: 'Anak Ke-',
      agama: 'Agama',
      cita_cita: 'Cita-cita',
      hobi: 'Hobi',
      pembiaya_sekolah: 'Yang Membiayai Sekolah',
      pra_sekolah: 'Pra-Sekolah',
      imunisasi: 'Imunisasi',
      nomor_kip: 'Nomor KIP',
      nomor_kk: 'Nomor KK',
      nama_kepala_keluarga: 'Nama Kepala Keluarga',
      ayah: 'Data Ayah',
      ibu: 'Data Ibu',
      wali: 'Data Wali',
      alamat_ayah: 'Alamat Ayah',
      alamat_ibu: 'Alamat Ibu',
      alamat_wali: 'Alamat Wali',
      alamat_siswa: 'Alamat Siswa',
      keahlian: 'Keahlian',
      tahfidz: 'Tahfidz',
      beasiswa: 'Beasiswa & Bantuan',
      pendidikan_lain: 'Pendidikan Lain',
      jenis_kebutuhan_khusus: 'Jenis Kebutuhan Khusus',
      kebutuhan_disabilitas: 'Kebutuhan Disabilitas',
      berkas_kartu_keluarga: 'Berkas Kartu Keluarga',
      berkas_akta_kelahiran: 'Berkas Akta Kelahiran',
      berkas_ijazah_sd: 'Berkas Ijazah SD/MI',
      berkas_kip: 'Berkas KIP',
      berkas_pkh: 'Berkas PKH',
      berkas_kks: 'Berkas KKS',
      berkas_kartu_pelajar: 'Berkas Kartu Pelajar',
    };

    const prettyProfile = (v) => {
      if (v === null || v === undefined || v === '') return <span className="text-slate-400 italic">Tidak ada data</span>;
      if (Array.isArray(v)) {
        return v.length ? v.join(', ') : <span className="text-slate-400 italic">Tidak ada data</span>;
      }
      if (typeof v === 'object') {
        return <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(v, null, 2)}</pre>;
      }
      if (typeof v === 'string' && v.startsWith('/api/')) {
        return <button type="button" onClick={() => openAuthedFile(v)} className="text-blue-600 underline text-sm">Lihat file</button>;
      }
      return String(v);
    };

    // Cari field yang berubah
    const changedFields = Object.keys(new_data).filter(key => {
      return JSON.stringify(new_data[key]) !== JSON.stringify(old_data[key]);
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
                <p className="text-sm text-slate-900 break-words">{prettyProfile(old_data[field])}</p>
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-600 mb-2 block">{fieldLabels[field] || field} - SESUDAH</Label>
              <div className="bg-emerald-50 border border-emerald-200 rounded p-3 min-h-[60px]">
                <p className="text-sm text-slate-900 font-semibold break-words">{prettyProfile(new_data[field])}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const stats = {
    total: allRequests.length,
    pending: allRequests.filter((r) => r.status === 'pending').length,
    approved: allRequests.filter((r) => r.status === 'approved').length,
    rejected: allRequests.filter((r) => r.status === 'rejected').length,
    cancelled: allRequests.filter((r) => r.status === 'cancelled').length,
  };
  const pendingCount = stats.pending;
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

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatBox icon={ListChecks} label="Total" value={stats.total} color="bg-slate-50 border-slate-200 text-slate-700" />
        <StatBox icon={Clock} label="Menunggu" value={stats.pending} color="bg-amber-50 border-amber-200 text-amber-700" />
        <StatBox icon={CheckCircle} label="Disetujui" value={stats.approved} color="bg-emerald-50 border-emerald-200 text-emerald-700" />
        <StatBox icon={XCircle} label="Ditolak" value={stats.rejected} color="bg-rose-50 border-rose-200 text-rose-700" />
        <StatBox icon={Ban} label="Dibatalkan" value={stats.cancelled} color="bg-slate-50 border-slate-200 text-slate-500" />
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
                  <TableHead>Jenis Pengajuan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Direview Oleh</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">Memuat...</TableCell>
                  </TableRow>
                ) : filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">Belum ada request verval</TableCell>
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
                    <TableCell>{requestTypeBadge(req.request_type)}</TableCell>
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
                    <div><span className="text-slate-600">Jenis Pengajuan:</span> {requestTypeBadge(selectedRequest.request_type)}</div>
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

function StatBox({ icon: Icon, label, value, color }) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</span>
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <div className="text-2xl font-extrabold tabular-nums mt-1">{value}</div>
    </div>
  );
}
