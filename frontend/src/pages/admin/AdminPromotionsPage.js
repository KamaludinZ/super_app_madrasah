import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowUp, RefreshCw, GraduationCap, Calendar,
  Users, CheckCircle2, AlertCircle, ChevronRight
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';

export default function AdminPromotionsPage() {
  const [classes, setClasses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [activeAY, setActiveAY] = useState(null);
  const [selectedType, setSelectedType] = useState('naik_kelas');
  const [fromClass, setFromClass] = useState('');
  const [toClass, setToClass] = useState('');
  const [toAY, setToAY] = useState('');
  const [toSemester, setToSemester] = useState('Ganjil');
  const [previewStudents, setPreviewStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [graduationDate, setGraduationDate] = useState('');
  const [certificatePrefix, setCertificatePrefix] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [ayRes, classRes] = await Promise.all([
        api.get('/academic-years'),
        api.get('/classes')
      ]);

      const years = ayRes.data || [];
      const active = years.find(y => y.is_active);

      setAcademicYears(years);
      setActiveAY(active);
      setClasses(classRes.data || []);

      // Set default graduation date to end of current academic year
      if (active) {
        const currentYear = new Date().getFullYear();
        setGraduationDate(`${currentYear}-06-30`);
      }
    } catch (e) {
      toast.error('Gagal memuat data');
    }
  };

  const handlePreview = async () => {
    if (!fromClass) {
      toast.error('Pilih kelas asal terlebih dahulu');
      return;
    }

    try {
      const { data } = await api.get('/promotions/preview', {
        params: { from_class_id: fromClass, type: selectedType }
      });

      setPreviewStudents(data.students || []);
      setSelectedStudents(data.students.map(s => s.id));
      toast.success(`Ditemukan ${data.student_count} siswa`);
    } catch (e) {
      toast.error('Gagal memuat preview');
    }
  };

  const handleProcess = () => {
    if (selectedStudents.length === 0) {
      toast.error('Pilih minimal 1 siswa');
      return;
    }

    if (selectedType === 'naik_kelas' && (!toClass || !toAY)) {
      toast.error('Pilih kelas tujuan dan tahun pelajaran');
      return;
    }

    if (selectedType === 'pindah_semester' && !toSemester) {
      toast.error('Pilih semester tujuan');
      return;
    }

    if (selectedType === 'lulus' && !graduationDate) {
      toast.error('Tentukan tanggal kelulusan');
      return;
    }

    setShowConfirm(true);
  };

  const handleConfirmProcess = async () => {
    try {
      setProcessing(true);

      const payload = {
        type: selectedType,
        student_ids: selectedStudents,
        from_class_id: fromClass,
        notes: notes || undefined,
      };

      if (selectedType === 'naik_kelas') {
        payload.to_class_id = toClass;
        payload.to_academic_year_id = toAY;
        payload.to_semester = toSemester;
      } else if (selectedType === 'pindah_semester') {
        payload.to_semester = toSemester;
        if (toClass) payload.to_class_id = toClass;
      } else if (selectedType === 'lulus') {
        payload.graduation_date = graduationDate;
        if (certificatePrefix) payload.certificate_number_prefix = certificatePrefix;
      }

      const endpoint = `/promotions/${selectedType.replace('_', '-')}`;
      const { data } = await api.post(endpoint, payload);

      toast.success(data.message);
      setShowConfirm(false);
      setPreviewStudents([]);
      setSelectedStudents([]);
      setFromClass('');
      setToClass('');
      setNotes('');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal memproses');
    } finally {
      setProcessing(false);
    }
  };

  const toggleStudent = (studentId) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const toggleAll = () => {
    if (selectedStudents.length === previewStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(previewStudents.map(s => s.id));
    }
  };

  // Filter classes by grade for naik kelas
  const sourceClasses = classes.filter(c =>
    selectedType === 'naik_kelas' ? c.grade < 9 : true
  );

  const targetClasses = classes.filter(c => {
    if (selectedType === 'naik_kelas' && fromClass) {
      const sourceClass = classes.find(cls => cls.id === fromClass);
      return sourceClass && c.grade === sourceClass.grade + 1;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          Kenaikan & Kelulusan
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
          Naik Kelas, Pindah Semester & Kelulusan
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Kelola proses kenaikan kelas, perpindahan semester, dan kelulusan siswa
        </p>
      </div>

      {/* Process Type Selection */}
      <Card>
        <CardContent className="p-6">
          <Tabs value={selectedType} onValueChange={setSelectedType}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="naik_kelas" className="gap-2">
                <ArrowUp className="h-4 w-4" />
                Naik Kelas
              </TabsTrigger>
              <TabsTrigger value="pindah_semester" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Pindah Semester
              </TabsTrigger>
              <TabsTrigger value="lulus" className="gap-2">
                <GraduationCap className="h-4 w-4" />
                Kelulusan
              </TabsTrigger>
            </TabsList>

            {/* Naik Kelas */}
            <TabsContent value="naik_kelas" className="space-y-4 mt-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Naik Kelas:</strong> Memindahkan siswa ke kelas yang lebih tinggi di tahun pelajaran baru.
                  ID siswa tetap sama, riwayat kelas tercatat lengkap.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold mb-2 block">Kelas Asal</label>
                  <Select value={fromClass} onValueChange={setFromClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kelas asal" />
                    </SelectTrigger>
                    <SelectContent>
                      {sourceClasses.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} (Kelas {c.grade})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-semibold mb-2 block">Tahun Pelajaran Tujuan</label>
                  <Select value={toAY} onValueChange={setToAY}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih TP tujuan" />
                    </SelectTrigger>
                    <SelectContent>
                      {academicYears.map(ay => (
                        <SelectItem key={ay.id} value={ay.id}>{ay.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-semibold mb-2 block">Kelas Tujuan</label>
                  <Select value={toClass} onValueChange={setToClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kelas tujuan" />
                    </SelectTrigger>
                    <SelectContent>
                      {targetClasses.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} (Kelas {c.grade})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-semibold mb-2 block">Semester</label>
                  <Select value={toSemester} onValueChange={setToSemester}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ganjil">Ganjil</SelectItem>
                      <SelectItem value="Genap">Genap</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* Pindah Semester */}
            <TabsContent value="pindah_semester" className="space-y-4 mt-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Pindah Semester:</strong> Untuk kelas akselerasi yang berpindah semester dalam satu tahun pelajaran.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold mb-2 block">Kelas Asal</label>
                  <Select value={fromClass} onValueChange={setFromClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kelas" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-semibold mb-2 block">Semester Tujuan</label>
                  <Select value={toSemester} onValueChange={setToSemester}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Semester 1</SelectItem>
                      <SelectItem value="2">Semester 2</SelectItem>
                      <SelectItem value="3">Semester 3</SelectItem>
                      <SelectItem value="4">Semester 4</SelectItem>
                      <SelectItem value="5">Semester 5</SelectItem>
                      <SelectItem value="6">Semester 6</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-semibold mb-2 block">Pindah Kelas Juga? (Opsional)</label>
                  <Select value={toClass || '__none__'} onValueChange={(val) => setToClass(val === '__none__' ? '' : val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tidak pindah kelas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Tidak pindah kelas</SelectItem>
                      {classes.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* Kelulusan */}
            <TabsContent value="lulus" className="space-y-4 mt-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-sm text-emerald-800">
                  <strong>Kelulusan:</strong> Menandai siswa kelas 9 yang telah lulus. Data siswa tetap tersimpan sebagai alumni.
                  Siswa akan muncul di menu Alumni.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold mb-2 block">Kelas (Kelas 9)</label>
                  <Select value={fromClass} onValueChange={setFromClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kelas 9" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.filter(c => c.grade === 9).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-semibold mb-2 block">Tanggal Kelulusan</label>
                  <Input
                    type="date"
                    value={graduationDate}
                    onChange={(e) => setGraduationDate(e.target.value)}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-semibold mb-2 block">
                    Prefix Nomor Ijazah (Opsional)
                  </label>
                  <Input
                    placeholder="Contoh: MTsN2MLG/2024"
                    value={certificatePrefix}
                    onChange={(e) => setCertificatePrefix(e.target.value)}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Jika diisi, nomor ijazah akan digenerate otomatis: PREFIX/0001, PREFIX/0002, dst
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-4">
            <label className="text-sm font-semibold mb-2 block">Catatan (Opsional)</label>
            <Textarea
              placeholder="Tambahkan catatan untuk proses ini..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex gap-3 mt-4">
            <Button onClick={handlePreview} className="gap-2">
              <Users className="h-4 w-4" />
              Preview Siswa
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Students */}
      {previewStudents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Daftar Siswa ({selectedStudents.length}/{previewStudents.length} dipilih)
              </span>
              <Button variant="outline" size="sm" onClick={toggleAll}>
                {selectedStudents.length === previewStudents.length ? 'Batal Pilih Semua' : 'Pilih Semua'}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {previewStudents.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50"
                >
                  <Checkbox
                    checked={selectedStudents.includes(student.id)}
                    onCheckedChange={() => toggleStudent(student.id)}
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">{student.full_name}</div>
                    <div className="text-sm text-slate-600">
                      NISN: {student.nisn || '-'} • NIS: {student.nis || '-'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-4">
              <Button
                onClick={handleProcess}
                disabled={selectedStudents.length === 0}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Proses {selectedStudents.length} Siswa
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Konfirmasi Proses
            </DialogTitle>
            <DialogDescription>
              Apakah Anda yakin akan memproses{' '}
              <strong>{selectedStudents.length} siswa</strong> untuk{' '}
              <strong>
                {selectedType === 'naik_kelas' ? 'naik kelas' :
                 selectedType === 'pindah_semester' ? 'pindah semester' :
                 'lulus'}
              </strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 bg-slate-50 rounded-lg space-y-2 text-sm">
            {selectedType === 'naik_kelas' && (
              <>
                <div>
                  <strong>Kelas Tujuan:</strong> {classes.find(c => c.id === toClass)?.name}
                </div>
                <div>
                  <strong>Tahun Pelajaran:</strong> {academicYears.find(ay => ay.id === toAY)?.name}
                </div>
              </>
            )}
            {selectedType === 'pindah_semester' && (
              <div>
                <strong>Semester Tujuan:</strong> {toSemester}
              </div>
            )}
            {selectedType === 'lulus' && (
              <>
                <div>
                  <strong>Tanggal Kelulusan:</strong> {graduationDate}
                </div>
                {certificatePrefix && (
                  <div>
                    <strong>Prefix Ijazah:</strong> {certificatePrefix}
                  </div>
                )}
              </>
            )}
            {notes && (
              <div>
                <strong>Catatan:</strong> {notes}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={processing}>
              Batal
            </Button>
            <Button onClick={handleConfirmProcess} disabled={processing}>
              {processing ? 'Memproses...' : 'Ya, Proses Sekarang'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
