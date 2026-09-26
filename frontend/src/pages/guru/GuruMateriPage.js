import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  BookOpen,
  Calendar,
  Plus,
  Edit,
  Trash2,
  ChevronDown,
  ChevronRight,
  Eye,
  Download
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Editor } from '@tinymce/tinymce-react';
import { sanitizeHtml } from '@/lib/sanitizeHtml';

const GuruMateriPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [materiKelas, setMateriKelas] = useState([]);
  const [materiSiswa, setMateriSiswa] = useState([]);
  const [activeTab, setActiveTab] = useState('kelas');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMateri, setEditingMateri] = useState(null);
  const [saving, setSaving] = useState(false);

  // Detail dialog state
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedMateri, setSelectedMateri] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    judul: '',
    deskripsi: '',
    konten: '',
    file_url: '',
    subject_id: '',
    target_role: [],
    target_kelas_ids: [],
    target_siswa: [],
  });

  // Master data
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [studentsByClass, setStudentsByClass] = useState({});
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState({});
  const [expandedClasses, setExpandedClasses] = useState({});

  // TinyMCE ref
  const editorRef = useRef(null);

  useEffect(() => {
    loadMateri();
    loadSubjects();
  }, []);

  const loadMateri = async () => {
    try {
      setLoading(true);
      const res = await api.get('/kelas/materi');

      // Filter by target_role
      const kelas = res.data.filter((m) => m.target_role?.includes?.('kelas') || m.target_role === 'kelas');
      const siswa = res.data.filter((m) => m.target_role?.includes?.('siswa') || m.target_role === 'siswa');

      setMateriKelas(kelas);
      setMateriSiswa(siswa);
      setLoading(false);
    } catch (err) {
      console.error('Error loading materi:', err);
      setError(err.response?.data?.detail || 'Gagal memuat materi');
      setLoading(false);
    }
  };

  const loadSubjects = async () => {
    try {
      // Fix: Use correct endpoint path
      const res = await api.get('/subjects');
      console.log('Subjects loaded:', res.data);
      setSubjects(res.data || []);
    } catch (err) {
      console.error('Error loading subjects:', err);
      toast.error('Gagal memuat daftar mata pelajaran');
    }
  };

  const loadClasses = async () => {
    try {
      setLoadingClasses(true);
      // Fix: Use correct endpoint path
      const res = await api.get('/classes');
      console.log('Classes loaded:', res.data);
      setClasses(res.data || []);
      setLoadingClasses(false);
    } catch (err) {
      console.error('Error loading classes:', err);
      toast.error('Gagal memuat daftar kelas');
      setLoadingClasses(false);
    }
  };

  const loadStudentsForClass = async (classId) => {
    if (studentsByClass[classId]) return; // Already loaded

    try {
      setLoadingStudents(prev => ({ ...prev, [classId]: true }));
      const res = await api.get(`/classes/${classId}/students`);
      console.log(`Students for class ${classId}:`, res.data);
      // Extract students array from response
      const students = res.data.students || [];
      setStudentsByClass(prev => ({
        ...prev,
        [classId]: students
      }));
      setLoadingStudents(prev => ({ ...prev, [classId]: false }));
    } catch (err) {
      console.error('Error loading students:', err);
      toast.error('Gagal memuat daftar siswa');
      setLoadingStudents(prev => ({ ...prev, [classId]: false }));
    }
  };

  const handleOpenDialog = (materi = null) => {
    if (materi) {
      // Edit mode
      setEditingMateri(materi);
      setFormData({
        judul: materi.judul || '',
        deskripsi: materi.deskripsi || '',
        konten: materi.konten || '',
        file_url: materi.file_url || '',
        subject_id: materi.subject_id || '',
        target_role: Array.isArray(materi.target_role) ? materi.target_role : [materi.target_role],
        target_kelas_ids: materi.target_kelas_ids || [],
        target_siswa: materi.target_siswa || [],
      });
    } else {
      // Add mode
      setEditingMateri(null);
      setFormData({
        judul: '',
        deskripsi: '',
        konten: '',
        file_url: '',
        subject_id: '',
        target_role: [],
        target_kelas_ids: [],
        target_siswa: [],
      });
    }
    loadClasses();
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingMateri(null);
    setFormData({
      judul: '',
      deskripsi: '',
      konten: '',
      file_url: '',
      subject_id: '',
      target_role: [],
      target_kelas_ids: [],
      target_siswa: [],
    });
    setExpandedClasses({});
  };

  const handleSave = async () => {
    // Get content from TinyMCE
    const content = editorRef.current ? editorRef.current.getContent() : formData.konten;

    if (!formData.judul.trim()) {
      toast.error('Judul harus diisi');
      return;
    }
    if (!content.trim()) {
      toast.error('Konten harus diisi');
      return;
    }
    if (!formData.subject_id) {
      toast.error('Mata pelajaran harus dipilih');
      return;
    }
    if (formData.target_role.length === 0) {
      toast.error('Target (Kelas/Siswa) harus dipilih');
      return;
    }

    try {
      setSaving(true);

      const payload = {
        ...formData,
        konten: content
      };

      if (editingMateri) {
        // Update
        await api.put(`/kelas/materi/${editingMateri.id}`, payload);
        toast.success('Materi berhasil diupdate');
      } else {
        // Create
        await api.post('/kelas/materi', payload);
        toast.success('Materi berhasil dibuat');
      }

      handleCloseDialog();
      loadMateri();
    } catch (err) {
      console.error('Error saving materi:', err);
      toast.error(err.response?.data?.detail || 'Gagal menyimpan materi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (materiId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus materi ini?')) {
      return;
    }

    try {
      await api.delete(`/kelas/materi/${materiId}`);
      toast.success('Materi berhasil dihapus');
      loadMateri();
    } catch (err) {
      console.error('Error deleting materi:', err);
      toast.error(err.response?.data?.detail || 'Gagal menghapus materi');
    }
  };

  const handleViewDetail = (materi) => {
    setSelectedMateri(materi);
    setDetailOpen(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd MMMM yyyy, HH:mm', { locale: id });
    } catch {
      return dateString;
    }
  };

  const handleTargetRoleChange = (role, checked) => {
    setFormData(prev => {
      const newTargetRole = checked
        ? [...prev.target_role, role]
        : prev.target_role.filter(r => r !== role);

      return {
        ...prev,
        target_role: newTargetRole,
        // Clear kelas selection if kelas unchecked
        target_kelas_ids: newTargetRole.includes('kelas') ? prev.target_kelas_ids : [],
        // Clear siswa selection if siswa unchecked
        target_siswa: newTargetRole.includes('siswa') ? prev.target_siswa : [],
      };
    });
  };

  const handleClassToggle = (classId, checked) => {
    setFormData(prev => ({
      ...prev,
      target_kelas_ids: checked
        ? [...prev.target_kelas_ids, classId]
        : prev.target_kelas_ids.filter(id => id !== classId)
    }));

    // Load students if siswa target is selected and class is checked
    if (checked && formData.target_role.includes('siswa')) {
      loadStudentsForClass(classId);
    }
  };

  const toggleClassExpand = (classId) => {
    setExpandedClasses(prev => ({
      ...prev,
      [classId]: !prev[classId]
    }));

    // Load students when expanding
    if (!expandedClasses[classId] && !studentsByClass[classId]) {
      loadStudentsForClass(classId);
    }
  };

  const handleStudentToggle = (classId, studentId, checked) => {
    setFormData(prev => {
      const targetSiswa = [...prev.target_siswa];
      const classIndex = targetSiswa.findIndex(ts => ts.class_id === classId);

      if (checked) {
        // Add student
        if (classIndex >= 0) {
          // Class exists, add student
          if (targetSiswa[classIndex].student_ids === 'all') {
            targetSiswa[classIndex].student_ids = [studentId];
          } else if (!targetSiswa[classIndex].student_ids.includes(studentId)) {
            targetSiswa[classIndex].student_ids.push(studentId);
          }
        } else {
          // Add new class with this student
          targetSiswa.push({
            class_id: classId,
            student_ids: [studentId]
          });
        }
      } else {
        // Remove student
        if (classIndex >= 0) {
          if (targetSiswa[classIndex].student_ids === 'all') {
            // Convert 'all' to array excluding this student
            const allStudents = studentsByClass[classId] || [];
            targetSiswa[classIndex].student_ids = allStudents
              .filter(s => s.id !== studentId)
              .map(s => s.id);
          } else {
            targetSiswa[classIndex].student_ids = targetSiswa[classIndex].student_ids.filter(id => id !== studentId);
            // Remove class entry if no students left
            if (targetSiswa[classIndex].student_ids.length === 0) {
              targetSiswa.splice(classIndex, 1);
            }
          }
        }
      }

      return {
        ...prev,
        target_siswa: targetSiswa
      };
    });
  };

  const handleSelectAllStudents = (classId, checked) => {
    setFormData(prev => {
      const targetSiswa = [...prev.target_siswa];
      const classIndex = targetSiswa.findIndex(ts => ts.class_id === classId);

      if (checked) {
        // Select all students
        if (classIndex >= 0) {
          targetSiswa[classIndex].student_ids = 'all';
        } else {
          targetSiswa.push({
            class_id: classId,
            student_ids: 'all'
          });
        }
      } else {
        // Deselect all
        if (classIndex >= 0) {
          targetSiswa.splice(classIndex, 1);
        }
      }

      return {
        ...prev,
        target_siswa: targetSiswa
      };
    });
  };

  const isStudentSelected = (classId, studentId) => {
    const classData = formData.target_siswa.find(ts => ts.class_id === classId);
    if (!classData) return false;
    if (classData.student_ids === 'all') return true;
    return classData.student_ids.includes(studentId);
  };

  const isAllStudentsSelected = (classId) => {
    const classData = formData.target_siswa.find(ts => ts.class_id === classId);
    if (!classData) return false;
    return classData.student_ids === 'all';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
          <p className="text-sm text-gray-600">Memuat data materi...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const renderMateriList = (materiList) => {
    if (materiList.length === 0) {
      return (
        <div className="text-center text-gray-500 py-12">
          Belum ada materi yang dibagikan
        </div>
      );
    }

    return (
      <Accordion type="single" collapsible className="w-full">
        {materiList.map((materi) => (
          <AccordionItem key={materi.id} value={materi.id}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-start justify-between gap-4 text-left flex-1 pr-4">
                <div className="flex-1">
                  <h3 className="font-semibold">{materi.judul}</h3>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(materi.created_at), 'dd MMMM yyyy, HH:mm', {
                        locale: id,
                      })}
                    </div>
                    {materi.subject_name && (
                      <span className="text-green-600 font-medium">
                        {materi.subject_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <div
                  className="prose prose-sm max-w-none p-4 bg-gray-50 rounded-lg"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(materi.konten) }}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDetail(materi)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Detail
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenDialog(materi)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(materi.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Hapus
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpen className="h-8 w-8" />
            Materi Mapel
          </h1>
          <p className="text-gray-600 mt-2">
            Kelola materi pembelajaran untuk kelas dan siswa
          </p>
        </div>
        <Button
          onClick={() => handleOpenDialog()}
          className="bg-green-600 hover:bg-green-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Tambah Materi
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Materi</CardTitle>
          <CardDescription>
            Materi yang telah Anda bagikan kepada kelas dan siswa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="kelas">
                Materi Kelas ({materiKelas.length})
              </TabsTrigger>
              <TabsTrigger value="siswa">
                Materi Siswa ({materiSiswa.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="kelas" className="mt-6">
              {renderMateriList(materiKelas)}
            </TabsContent>

            <TabsContent value="siswa" className="mt-6">
              {renderMateriList(materiSiswa)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingMateri ? 'Edit Materi' : 'Tambah Materi Baru'}
            </DialogTitle>
            <DialogDescription>
              Isi form di bawah ini untuk {editingMateri ? 'mengupdate' : 'membuat'} materi
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="judul">Judul Materi *</Label>
              <Input
                id="judul"
                placeholder="Masukkan judul materi"
                value={formData.judul}
                onChange={(e) => setFormData(prev => ({ ...prev, judul: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deskripsi">Deskripsi Singkat</Label>
              <Input
                id="deskripsi"
                placeholder="Deskripsi singkat materi (opsional)"
                value={formData.deskripsi}
                onChange={(e) => setFormData(prev => ({ ...prev, deskripsi: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="file_url">Link File (Google Drive, dll)</Label>
              <Input
                id="file_url"
                type="url"
                placeholder="https://drive.google.com/..."
                value={formData.file_url}
                onChange={(e) => setFormData(prev => ({ ...prev, file_url: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Mata Pelajaran *</Label>
              <Select
                value={formData.subject_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, subject_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih mata pelajaran" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.length === 0 ? (
                    <div className="p-2 text-sm text-gray-500">Tidak ada mata pelajaran</div>
                  ) : (
                    subjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name} ({subject.code})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="konten">Konten Materi *</Label>
              <Editor
                apiKey="914ugy3g940jpbs86mwf0hfp2442e33421r8pr7pofty6jci"
                onInit={(evt, editor) => editorRef.current = editor}
                initialValue={formData.konten}
                init={{
                  height: 400,
                  menubar: true,
                  plugins: [
                    'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                    'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                    'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount'
                  ],
                  toolbar: 'undo redo | blocks | ' +
                    'bold italic forecolor | alignleft aligncenter ' +
                    'alignright alignjustify | bullist numlist outdent indent | ' +
                    'removeformat | link image | code | help',
                  content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }',
                  branding: false,
                  promotion: false,
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Target *</Label>
              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="target-kelas"
                    checked={formData.target_role.includes('kelas')}
                    onCheckedChange={(checked) => handleTargetRoleChange('kelas', checked)}
                  />
                  <label htmlFor="target-kelas" className="text-sm font-medium cursor-pointer">
                    Untuk Kelas
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="target-siswa"
                    checked={formData.target_role.includes('siswa')}
                    onCheckedChange={(checked) => handleTargetRoleChange('siswa', checked)}
                  />
                  <label htmlFor="target-siswa" className="text-sm font-medium cursor-pointer">
                    Untuk Siswa
                  </label>
                </div>
              </div>
            </div>

            {formData.target_role.includes('kelas') && (
              <div className="space-y-2">
                <Label>Pilih Kelas *</Label>
                {loadingClasses ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memuat kelas...
                  </div>
                ) : classes.length === 0 ? (
                  <div className="text-sm text-gray-500 p-3 border rounded-md">
                    Tidak ada kelas tersedia
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
                    {classes.map((kelas) => (
                      <div key={kelas.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`class-${kelas.id}`}
                          checked={formData.target_kelas_ids.includes(kelas.id)}
                          onCheckedChange={(checked) => handleClassToggle(kelas.id, checked)}
                        />
                        <label
                          htmlFor={`class-${kelas.id}`}
                          className="text-sm cursor-pointer"
                        >
                          {kelas.name}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {formData.target_role.includes('siswa') && (
              <div className="space-y-2">
                <Label>Pilih Siswa *</Label>
                {loadingClasses ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memuat data...
                  </div>
                ) : (
                  <div className="border rounded-md p-3 max-h-96 overflow-y-auto space-y-2">
                    {classes.map((kelas) => (
                      <div key={kelas.id} className="border rounded-md p-2">
                        {/* Class Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 flex-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => toggleClassExpand(kelas.id)}
                            >
                              {expandedClasses[kelas.id] ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                            <Checkbox
                              id={`class-all-${kelas.id}`}
                              checked={isAllStudentsSelected(kelas.id)}
                              onCheckedChange={(checked) => handleSelectAllStudents(kelas.id, checked)}
                            />
                            <label
                              htmlFor={`class-all-${kelas.id}`}
                              className="text-sm font-medium cursor-pointer flex-1"
                            >
                              {kelas.name} - Semua Siswa
                            </label>
                          </div>
                        </div>

                        {/* Students List */}
                        {expandedClasses[kelas.id] && (
                          <div className="ml-6 mt-2 space-y-1">
                            {loadingStudents[kelas.id] ? (
                              <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Memuat siswa...
                              </div>
                            ) : studentsByClass[kelas.id]?.length === 0 ? (
                              <div className="text-xs text-gray-500 py-2">Tidak ada siswa</div>
                            ) : (
                              studentsByClass[kelas.id]?.map((student) => (
                                <div key={student.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`student-${student.id}`}
                                    checked={isStudentSelected(kelas.id, student.id)}
                                    onCheckedChange={(checked) => handleStudentToggle(kelas.id, student.id, checked)}
                                  />
                                  <label
                                    htmlFor={`student-${student.id}`}
                                    className="text-xs cursor-pointer"
                                  >
                                    {student.full_name} ({student.nis})
                                  </label>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={saving}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingMateri ? 'Update' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedMateri?.judul}</DialogTitle>
            <DialogDescription>Detail lengkap materi pembelajaran</DialogDescription>
          </DialogHeader>

          {selectedMateri && (
            <div className="space-y-6">
              {/* Informasi Materi */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-500">Mata Pelajaran</p>
                  <p className="text-base font-semibold">{selectedMateri.subject_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Guru</p>
                  <p className="text-base font-semibold">{selectedMateri.teacher_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Dibuat pada</p>
                  <p className="text-base">{formatDate(selectedMateri.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Target</p>
                  <p className="text-base">
                    {Array.isArray(selectedMateri.target_role)
                      ? selectedMateri.target_role.join(', ')
                      : selectedMateri.target_role || '-'}
                  </p>
                </div>
              </div>

              {/* Deskripsi */}
              {selectedMateri.deskripsi && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Deskripsi Singkat</h3>
                  <p className="text-sm text-gray-700 p-3 bg-blue-50 rounded border border-blue-200">
                    {selectedMateri.deskripsi}
                  </p>
                </div>
              )}

              {/* Konten Materi */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Konten Materi</h3>
                <div
                  className="prose prose-sm max-w-none p-4 bg-white border rounded-lg"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedMateri.konten) || 'Tidak ada konten' }}
                />
              </div>

              {/* File Attachment */}
              {selectedMateri.file_url && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">File Lampiran</h3>
                  <Button variant="outline" asChild>
                    <a href={selectedMateri.file_url} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      Unduh File
                    </a>
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GuruMateriPage;
