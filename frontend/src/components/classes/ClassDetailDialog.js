import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, UserPlus, UserMinus, Search, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function ClassDetailDialog({ classData, open, onOpenChange, onRefresh }) {
  const [students, setStudents] = useState([]);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [addForm, setAddForm] = useState({
    reason: 'pembagian_kelas',
    start_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    if (open && classData) {
      loadStudents();
      loadAvailableStudents();
    }
  }, [open, classData]);

  const loadStudents = async () => {
    if (!classData) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/classes/${classData.id}/students`);
      setStudents(data.students || []);
    } catch (e) {
      toast.error('Gagal memuat data siswa');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableStudents = async () => {
    if (!classData) return;
    try {
      const { data } = await api.get(`/classes/${classData.id}/available-students`);
      setAvailableStudents(data || []);
    } catch (e) {
      toast.error('Gagal memuat siswa tersedia');
    }
  };

  const handleAddStudent = async (studentId) => {
    try {
      await api.post(`/classes/${classData.id}/students/${studentId}`, addForm);
      toast.success('Siswa berhasil ditambahkan ke kelas');
      loadStudents();
      loadAvailableStudents();
      setShowAddStudent(false);
      setSearchQuery('');
      setAddForm({
        reason: 'pembagian_kelas',
        start_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      if (onRefresh) onRefresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menambahkan siswa');
    }
  };

  const handleRemoveStudent = async (studentId, studentName) => {
    if (!window.confirm(`Hapus ${studentName} dari kelas ${classData.name}?`)) return;
    try {
      await api.delete(`/classes/${classData.id}/students/${studentId}`, {
        data: { end_date: new Date().toISOString().split('T')[0] }
      });
      toast.success('Siswa berhasil dihapus dari kelas');
      loadStudents();
      loadAvailableStudents();
      if (onRefresh) onRefresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus siswa');
    }
  };

  const filteredAvailable = availableStudents.filter(s =>
    s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.nisn?.includes(searchQuery) ||
    s.nis?.includes(searchQuery)
  );

  const capacity = classData?.capacity || 40;
  const currentCount = students.length;
  const availableSlots = capacity - currentCount;
  const isFull = currentCount >= capacity;

  const reasonLabels = {
    pembagian_kelas: 'Pembagian Kelas',
    pindah_kelas: 'Pindah Kelas',
    naik_kelas: 'Naik Kelas',
    mutasi_masuk: 'Mutasi Masuk',
    mutasi_keluar: 'Mutasi Keluar'
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Detail Kelas: {classData?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Class Info */}
          <div className="bg-slate-50 p-4 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-slate-600">Kapasitas:</span>
                <div className="font-semibold">
                  <span className={currentCount >= capacity ? 'text-rose-600' : 'text-slate-900'}>
                    {currentCount}/{capacity}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-slate-600">Sisa Slot:</span>
                <div className="font-semibold">
                  {availableSlots > 0 ? (
                    <span className="text-emerald-600">{availableSlots} tempat</span>
                  ) : (
                    <span className="text-rose-600">Penuh</span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-slate-600">Wali Kelas:</span>
                <div className="font-semibold text-slate-900">
                  {classData?.homeroom_teacher_name || '-'}
                </div>
              </div>
              <div>
                <span className="text-slate-600">Ruang:</span>
                <div className="font-semibold text-slate-900">
                  {classData?.room_name || '-'}
                </div>
              </div>
            </div>
          </div>

          {/* Current Students */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-lg">Siswa di Kelas ({currentCount})</h3>
              <Button
                onClick={() => setShowAddStudent(!showAddStudent)}
                size="sm"
                disabled={isFull}
                className="gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Tambah Siswa
              </Button>
            </div>

            {isFull && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg mb-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span className="text-sm">
                  Kelas sudah mencapai kapasitas maksimal. Hapus siswa terlebih dahulu untuk menambah yang baru.
                </span>
              </div>
            )}

            {loading ? (
              <p className="text-center py-4 text-slate-500">Memuat...</p>
            ) : students.length === 0 ? (
              <p className="text-center py-8 text-slate-400">Belum ada siswa di kelas ini</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No</TableHead>
                      <TableHead>NISN</TableHead>
                      <TableHead>NIS</TableHead>
                      <TableHead>Nama Lengkap</TableHead>
                      <TableHead>Jenis Kelamin</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((s, idx) => (
                      <TableRow key={s.id}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell className="font-mono text-xs">{s.nisn || '-'}</TableCell>
                        <TableCell className="font-mono text-xs">{s.nis || '-'}</TableCell>
                        <TableCell className="font-semibold">{s.full_name}</TableCell>
                        <TableCell>
                          {s.gender === 'L' ? 'Laki-laki' : s.gender === 'P' ? 'Perempuan' : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleRemoveStudent(s.id, s.full_name)}
                            className="text-rose-600"
                            title="Hapus dari kelas"
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Add Student Section */}
          {showAddStudent && (
            <div className="border-t pt-4">
              <h3 className="font-semibold text-lg mb-3">Tambah Siswa ke Kelas</h3>

              <div className="space-y-3 mb-4">
                <div>
                  <Label>Alasan</Label>
                  <Select value={addForm.reason} onValueChange={(v) => setAddForm({...addForm, reason: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(reasonLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tanggal Mulai</Label>
                  <Input
                    type="date"
                    value={addForm.start_date}
                    onChange={(e) => setAddForm({...addForm, start_date: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Catatan (Opsional)</Label>
                  <Input
                    value={addForm.notes}
                    onChange={(e) => setAddForm({...addForm, notes: e.target.value})}
                    placeholder="Keterangan tambahan..."
                  />
                </div>
              </div>

              <div className="mb-3">
                <Label>Cari Siswa</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari berdasarkan nama, NISN, atau NIS..."
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                {filteredAvailable.length === 0 ? (
                  <p className="text-center py-8 text-slate-400">
                    {searchQuery ? 'Tidak ada siswa yang sesuai pencarian' : 'Semua siswa sudah memiliki kelas'}
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>NISN</TableHead>
                        <TableHead>NIS</TableHead>
                        <TableHead>Nama Lengkap</TableHead>
                        <TableHead>Jenis Kelamin</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAvailable.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-mono text-xs">{s.nisn || '-'}</TableCell>
                          <TableCell className="font-mono text-xs">{s.nis || '-'}</TableCell>
                          <TableCell className="font-semibold">{s.full_name}</TableCell>
                          <TableCell>
                            {s.gender === 'L' ? 'Laki-laki' : s.gender === 'P' ? 'Perempuan' : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => handleAddStudent(s.id)}
                              className="gap-1"
                            >
                              <UserPlus className="h-3 w-3" />
                              Tambah
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
