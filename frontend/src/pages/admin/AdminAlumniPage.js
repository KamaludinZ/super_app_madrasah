import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  GraduationCap, Search, Calendar, Award, Users,
  FileText, Download, Eye, Edit
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function AdminAlumniPage() {
  const [alumni, setAlumni] = useState([]);
  const [stats, setStats] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedAY, setSelectedAY] = useState('');
  const [selectedAlumni, setSelectedAlumni] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    loadData();
  }, [selectedAY, search]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedAY) params.academic_year_id = selectedAY;
      if (search) params.search = search;

      const [alumniRes, statsRes, ayRes] = await Promise.all([
        api.get('/alumni', { params }),
        api.get('/alumni/stats'),
        api.get('/academic-years')
      ]);

      setAlumni(alumniRes.data || []);
      setStats(statsRes.data || []);
      setAcademicYears(ayRes.data || []);
    } catch (e) {
      toast.error('Gagal memuat data alumni');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = async (alumniItem) => {
    try {
      const { data } = await api.get(`/alumni/${alumniItem.id}`);
      setSelectedAlumni(data);
      setShowDetail(true);
    } catch (e) {
      toast.error('Gagal memuat detail alumni');
    }
  };

  const handleEdit = (alumniItem) => {
    setEditForm({
      id: alumniItem.id,
      full_name: alumniItem.full_name || '',
      email: alumniItem.email || '',
      phone: alumniItem.phone || '',
      address: alumniItem.address || '',
      graduation_certificate_number: alumniItem.graduation_certificate_number || '',
      graduation_date: alumniItem.graduation_date || '',
    });
    setShowEdit(true);
  };

  const handleSaveEdit = async () => {
    try {
      const { id, ...payload } = editForm;
      await api.put(`/alumni/${id}`, payload);
      toast.success('Data alumni berhasil diupdate');
      setShowEdit(false);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal update data alumni');
    }
  };

  // Group stats by AY
  const statsByAY = stats.reduce((acc, s) => {
    const key = s.academic_year_id || 'unknown';
    if (!acc[key]) acc[key] = { ay_name: s.academic_year_name, grades: {} };
    if (s.grade) {
      if (!acc[key].grades[s.grade]) acc[key].grades[s.grade] = 0;
      acc[key].grades[s.grade] += s.count;
    }
    return acc;
  }, {});

  const totalAlumni = stats.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          Alumni
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Data Alumni</h1>
        <p className="text-sm text-slate-600 mt-1">
          Siswa yang telah lulus dari kelas 9
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-100 rounded-lg">
                <GraduationCap className="h-6 w-6 text-emerald-700" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Total Alumni</p>
                <p className="text-2xl font-bold text-slate-900">{totalAlumni}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Calendar className="h-6 w-6 text-blue-700" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Tahun Pelajaran</p>
                <p className="text-2xl font-bold text-slate-900">
                  {Object.keys(statsByAY).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-100 rounded-lg">
                <Award className="h-6 w-6 text-amber-700" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Tahun Ini</p>
                <p className="text-2xl font-bold text-slate-900">
                  {alumni.filter(a => {
                    const ay = academicYears.find(y => y.is_active);
                    return ay && a.graduation_ay_id === ay.id;
                  }).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Cari nama, NISN, atau NIS..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedAY || '__all__'} onValueChange={(val) => setSelectedAY(val === '__all__' ? '' : val)}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Semua TP" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Semua TP</SelectItem>
                {academicYears.map(ay => (
                  <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Alumni List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Daftar Alumni ({alumni.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-500">Memuat data...</div>
          ) : alumni.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Tidak ada data alumni
            </div>
          ) : (
            <div className="space-y-2">
              {alumni.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:bg-slate-50"
                >
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">{a.full_name}</div>
                    <div className="text-sm text-slate-600">
                      NISN: {a.nisn || '-'} • NIS: {a.nis || '-'}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Lulus: {a.graduation_date} • {a.graduation_class_name || '-'} •
                      Ijazah: {a.graduation_certificate_number || 'Belum ada'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewDetail(a)}
                      className="gap-1"
                    >
                      <Eye className="h-4 w-4" />
                      Detail
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(a)}
                      className="gap-1"
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Alumni</DialogTitle>
          </DialogHeader>
          {selectedAlumni && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700">Nama Lengkap</label>
                  <p className="text-slate-900">{selectedAlumni.full_name}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">NISN</label>
                  <p className="text-slate-900">{selectedAlumni.nisn || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">NIS</label>
                  <p className="text-slate-900">{selectedAlumni.nis || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Tanggal Lulus</label>
                  <p className="text-slate-900">{selectedAlumni.graduation_date}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Kelas Terakhir</label>
                  <p className="text-slate-900">{selectedAlumni.graduation_class_name || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Nomor Ijazah</label>
                  <p className="text-slate-900">{selectedAlumni.graduation_certificate_number || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Email</label>
                  <p className="text-slate-900">{selectedAlumni.email || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Telepon</label>
                  <p className="text-slate-900">{selectedAlumni.phone || '-'}</p>
                </div>
              </div>

              {/* Class History */}
              {selectedAlumni.class_history && selectedAlumni.class_history.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Riwayat Kelas
                  </h3>
                  <div className="space-y-2">
                    {selectedAlumni.class_history.map((h, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded border border-slate-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">{h.class_name}</div>
                            <div className="text-xs text-slate-600">
                              {h.academic_year_name} • Semester {h.semester}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {h.reason === 'naik_kelas' ? 'Naik Kelas' :
                             h.reason === 'pindah_semester' ? 'Pindah Semester' :
                             h.reason === 'lulus' ? 'Lulus' :
                             h.reason === 'mutasi_masuk' ? 'Mutasi Masuk' :
                             h.reason === 'mutasi_keluar' ? 'Mutasi Keluar' :
                             h.reason}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          {h.start_date} {h.end_date ? `- ${h.end_date}` : '(aktif)'}
                        </div>
                        {h.notes && (
                          <div className="text-xs text-slate-600 mt-1 italic">{h.notes}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Data Alumni</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold">Nama Lengkap</label>
              <Input
                value={editForm.full_name || ''}
                onChange={(e) => setEditForm({...editForm, full_name: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Email</label>
              <Input
                type="email"
                value={editForm.email || ''}
                onChange={(e) => setEditForm({...editForm, email: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Telepon</label>
              <Input
                value={editForm.phone || ''}
                onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Alamat</label>
              <Input
                value={editForm.address || ''}
                onChange={(e) => setEditForm({...editForm, address: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Nomor Ijazah</label>
              <Input
                value={editForm.graduation_certificate_number || ''}
                onChange={(e) => setEditForm({...editForm, graduation_certificate_number: e.target.value})}
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Tanggal Lulus</label>
              <Input
                type="date"
                value={editForm.graduation_date || ''}
                onChange={(e) => setEditForm({...editForm, graduation_date: e.target.value})}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowEdit(false)}>
                Batal
              </Button>
              <Button onClick={handleSaveEdit}>
                Simpan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
