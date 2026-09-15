import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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

export default function WakaKurNaikKelasPage() {
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
          <ArrowUp className="h-3 w-3 mr-1" /> Kenaikan & Kelulusan (Waka Kurikulum)
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
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-sm text-purple-800">
                  <strong>Pindah Semester:</strong> Memindahkan siswa ke semester berikutnya dalam TP yang sama, bisa dengan atau tanpa perpindahan kelas.
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
                      <SelectItem value="Ganjil">Ganjil</SelectItem>
                      <SelectItem value="Genap">Genap</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-semibold mb-2 block">Kelas Tujuan (Opsional)</label>
                  <Select value={toClass} onValueChange={setToClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tetap di kelas yang sama" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Tetap di kelas yang sama</SelectItem>
                      {classes.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* Lulus */}
            <TabsContent value="lulus" className="space-y-4 mt-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-sm text-emerald-800">
                  <strong>Kelulusan:</strong> Memproses kelulusan siswa kelas 9. Siswa akan dipindahkan ke status alumni dan mendapat nomor ijazah.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold mb-2 block">Kelas Asal</label>
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
                  <label className="text-sm font-semibold mb-2 block">Prefix Nomor Ijazah (Opsional)</label>
                  <Input
                    value={certificatePrefix}
                    onChange={(e) => setCertificatePrefix(e.target.value)}
                    placeholder="Contoh: DN.01.02/PP.00.3/"
                  />
                  <p className="text-xs text-slate-600 mt-1">
                    Jika kosong, sistem akan generate otomatis dengan format: DN/TP/nomor_urut
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Catatan */}
          <div className="mt-4">
            <label className="text-sm font-semibold mb-2 block">Catatan (Opsional)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan tambahan untuk proses ini..."
              rows={2}
            />
          </div>

          <div className="mt-4">
            <Button
              onClick={handlePreview}
              className="gap-2 bg-[#006837] hover:bg-[#0B7A3B]"
              disabled={!fromClass}
            >
              <Users className="h-4 w-4" />
              Preview Siswa
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Students */}
      {previewStudents.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Users className="h-5 w-5" />
                Daftar Siswa ({selectedStudents.length}/{previewStudents.length})
              </h3>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedStudents.length === previewStudents.length}
                  onCheckedChange={toggleAll}
                  id="select-all"
                />
                <label htmlFor="select-all" className="text-sm cursor-pointer">
                  Pilih Semua
                </label>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {previewStudents.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50"
                >
                  <Checkbox
                    checked={selectedStudents.includes(student.id)}
                    onCheckedChange={() => toggleStudent(student.id)}
                    id={`student-${student.id}`}
                  />
                  <label
                    htmlFor={`student-${student.id}`}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="font-semibold">{student.full_name}</div>
                    <div className="text-sm text-slate-600">
                      NISN: {student.nisn || '-'} • NIS: {student.nis || '-'} • Kelas: {student.class_name}
                    </div>
                  </label>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t">
              <Button
                onClick={handleProcess}
                className="gap-2 bg-[#006837] hover:bg-[#0B7A3B] w-full"
                disabled={selectedStudents.length === 0}
              >
                <ChevronRight className="h-4 w-4" />
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
            <DialogTitle>Konfirmasi Proses</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin memproses {selectedType.replace('_', ' ')} untuk {selectedStudents.length} siswa?
              Proses ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            {selectedType === 'naik_kelas' && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Dari:</span>
                  <span className="font-semibold">{classes.find(c => c.id === fromClass)?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Ke:</span>
                  <span className="font-semibold">{classes.find(c => c.id === toClass)?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Tahun Pelajaran:</span>
                  <span className="font-semibold">{academicYears.find(ay => ay.id === toAY)?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Semester:</span>
                  <span className="font-semibold">{toSemester}</span>
                </div>
              </>
            )}

            {selectedType === 'lulus' && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Tanggal Kelulusan:</span>
                <span className="font-semibold">{graduationDate}</span>
              </div>
            )}

            <div className="flex justify-between text-sm pt-2 border-t">
              <span className="text-slate-600">Jumlah Siswa:</span>
              <span className="font-bold text-lg">{selectedStudents.length}</span>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowConfirm(false)}
              disabled={processing}
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirmProcess}
              disabled={processing}
              className="gap-2 bg-[#006837] hover:bg-[#0B7A3B]"
            >
              {processing ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Ya, Proses
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
