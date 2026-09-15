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
import { Loader2, ClipboardList, Calendar, Plus, Edit, Trash2, ChevronDown, ChevronRight, Eye, Download, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Editor } from '@tinymce/tinymce-react';

const GuruTugasPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tugasKelas, setTugasKelas] = useState([]);
  const [tugasSiswa, setTugasSiswa] = useState([]);
  const [activeTab, setActiveTab] = useState('kelas');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTugas, setEditingTugas] = useState(null);
  const [saving, setSaving] = useState(false);

  // Detail dialog state
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTugas, setSelectedTugas] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    judul: '',
    deskripsi: '',
    konten: '',
    file_url: '',
    deadline: '',
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
    loadTugas();
    loadSubjects();
  }, []);

  const loadTugas = async () => {
    try {
      setLoading(true);
      const res = await api.get('/kelas/tugas');

      // Filter by target_role
      const kelas = res.data.filter((m) => m.target_role?.includes?.('kelas') || m.target_role === 'kelas');
      const siswa = res.data.filter((m) => m.target_role?.includes?.('siswa') || m.target_role === 'siswa');

      setTugasKelas(kelas);
      setTugasSiswa(siswa);
      setLoading(false);
    } catch (err) {
      console.error('Error loading tugas:', err);
      setError(err.response?.data?.detail || 'Gagal memuat tugas');
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

  const handleOpenDialog = (tugas = null) => {
    if (tugas) {
      // Edit mode
      setEditingTugas(tugas);

      // Format deadline for datetime-local input (YYYY-MM-DDTHH:MM)
      let deadlineFormatted = '';
      if (tugas.deadline) {
        try {
          const date = new Date(tugas.deadline);
          deadlineFormatted = format(date, "yyyy-MM-dd'T'HH:mm");
        } catch (e) {
          console.error('Error formatting deadline:', e);
        }
      }

      setFormData({
        judul: tugas.judul || '',
        deskripsi: tugas.deskripsi || '',
        konten: tugas.konten || '',
        file_url: tugas.file_url || '',
        deadline: deadlineFormatted,
        subject_id: tugas.subject_id || '',
        target_role: Array.isArray(tugas.target_role) ? tugas.target_role : [tugas.target_role],
        target_kelas_ids: tugas.target_kelas_ids || [],
        target_siswa: tugas.target_siswa || [],
      });
    } else {
      // Add mode
      setEditingTugas(null);
      setFormData({
        judul: '',
        deskripsi: '',
        konten: '',
        file_url: '',
        deadline: '',
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
    setEditingTugas(null);
    setFormData({
      judul: '',
      deskripsi: '',
      konten: '',
      file_url: '',
      deadline: '',
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

      // Convert deadline to ISO string if present
      let deadlineISO = null;
      if (formData.deadline) {
        try {
          deadlineISO = new Date(formData.deadline).toISOString();
        } catch (e) {
          console.error('Error converting deadline:', e);
        }
      }

      const payload = {
        ...formData,
        konten: content,
        deadline: deadlineISO
      };

      if (editingTugas) {
        // Update
        await api.put(`/kelas/tugas/${editingTugas.id}`, payload);
        toast.success('Tugas berhasil diupdate');
      } else {
        // Create
        await api.post('/kelas/tugas', payload);
        toast.success('Tugas berhasil dibuat');
      }

      handleCloseDialog();
      loadTugas();
    } catch (err) {
      console.error('Error saving tugas:', err);
      toast.error(err.response?.data?.detail || 'Gagal menyimpan tugas');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tugasId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus tugas ini?')) {
      return;
    }

    try {
      await api.delete(`/kelas/tugas/${tugasId}`);
      toast.success('Tugas berhasil dihapus');
      loadTugas();
    } catch (err) {
      console.error('Error deleting tugas:', err);
      toast.error(err.response?.data?.detail || 'Gagal menghapus tugas');
    }
  };

  const handleViewDetail = async (tugas) => {
    try {
      setSelectedTugas(tugas);
      setDetailOpen(true);
      setLoadingSubmissions(true);

      // Load submissions for this tugas
      const res = await api.get(`/kelas/tugas/${tugas.id}/submissions`);
      setSubmissions(res.data.submissions || []);
      setLoadingSubmissions(false);
    } catch (err) {
      console.error('Error loading tugas detail:', err);
      toast.error('Gagal memuat detail tugas');
      setLoadingSubmissions(false);
    }
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
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-gray-600">Memuat data tugas...</p>
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

  const renderTugasList = (tugasList) => {
    if (tugasList.length === 0) {
      return (
        <div className="text-center text-gray-500 py-12">
          Belum ada tugas yang dibagikan
        </div>
      );
    }

    return (
      <Accordion type="single" collapsible className="w-full">
        {tugasList.map((tugas) => (
          <AccordionItem key={tugas.id} value={tugas.id}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-start justify-between gap-4 text-left flex-1 pr-4">
                <div className="flex-1">
                  <h3 className="font-semibold">{tugas.judul}</h3>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(tugas.created_at), 'dd MMMM yyyy, HH:mm', {
                        locale: id,
                      })}
                    </div>
                    {tugas.subject_name && (
                      <span className="text-blue-600 font-medium">
                        {tugas.subject_name}
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
                  dangerouslySetInnerHTML={{ __html: tugas.konten }}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDetail(tugas)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Detail
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenDialog(tugas)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(tugas.id)}
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
            <ClipboardList className="h-8 w-8" />
            Tugas Mapel
          </h1>
          <p className="text-gray-600 mt-2">
            Kelola tugas pembelajaran untuk kelas dan siswa
          </p>
        </div>
        <Button
          onClick={() => handleOpenDialog()}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Tambah Tugas
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Tugas</CardTitle>
          <CardDescription>
            Tugas yang telah Anda bagikan kepada kelas dan siswa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="kelas">
                Tugas Kelas ({tugasKelas.length})
              </TabsTrigger>
              <TabsTrigger value="siswa">
                Tugas Siswa ({tugasSiswa.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="kelas" className="mt-6">
              {renderTugasList(tugasKelas)}
            </TabsContent>

            <TabsContent value="siswa" className="mt-6">
              {renderTugasList(tugasSiswa)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTugas ? 'Edit Tugas' : 'Tambah Tugas Baru'}
            </DialogTitle>
            <DialogDescription>
              Isi form di bawah ini untuk {editingTugas ? 'mengupdate' : 'membuat'} tugas
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="judul">Judul Tugas *</Label>
              <Input
                id="judul"
                placeholder="Masukkan judul tugas"
                value={formData.judul}
                onChange={(e) => setFormData(prev => ({ ...prev, judul: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deskripsi">Deskripsi Singkat</Label>
              <Input
                id="deskripsi"
                placeholder="Deskripsi singkat tugas (opsional)"
                value={formData.deskripsi}
                onChange={(e) => setFormData(prev => ({ ...prev, deskripsi: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deadline">Deadline</Label>
                <Input
                  id="deadline"
                  type="datetime-local"
                  value={formData.deadline}
                  onChange={(e) => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
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
              <Label htmlFor="konten">Deskripsi Tugas *</Label>
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
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingTugas ? 'Update' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTugas?.judul}</DialogTitle>
            <DialogDescription>Detail lengkap tugas pembelajaran</DialogDescription>
          </DialogHeader>

          {selectedTugas && (
            <div className="space-y-6">
              {/* Informasi Tugas */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-500">Mata Pelajaran</p>
                  <p className="text-base font-semibold">{selectedTugas.subject_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Guru</p>
                  <p className="text-base font-semibold">{selectedTugas.teacher_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Dibuat pada</p>
                  <p className="text-base">{formatDate(selectedTugas.created_at)}</p>
                </div>
                {selectedTugas.deadline && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Deadline</p>
                    <p className="text-base font-semibold text-red-600">
                      {formatDate(selectedTugas.deadline)}
                    </p>
                  </div>
                )}
              </div>

              {/* Deskripsi */}
              {selectedTugas.deskripsi && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Deskripsi Singkat</h3>
                  <p className="text-sm text-gray-700 p-3 bg-blue-50 rounded border border-blue-200">
                    {selectedTugas.deskripsi}
                  </p>
                </div>
              )}

              {/* Konten Tugas */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Instruksi Tugas</h3>
                <div
                  className="prose prose-sm max-w-none p-4 bg-white border rounded-lg"
                  dangerouslySetInnerHTML={{ __html: selectedTugas.konten || 'Tidak ada instruksi' }}
                />
              </div>

              {/* File Attachment */}
              {selectedTugas.file_url && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">File Lampiran</h3>
                  <Button variant="outline" asChild>
                    <a href={selectedTugas.file_url} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      Unduh File
                    </a>
                  </Button>
                </div>
              )}

              {/* Submissions List */}
              <div>
                <h3 className="text-sm font-semibold mb-3">
                  Daftar Siswa & Pengumpulan Tugas ({submissions.length} submissions)
                </h3>

                {loadingSubmissions ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span className="text-gray-600">Memuat data pengumpulan...</span>
                  </div>
                ) : submissions.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed">
                    <p className="text-gray-500">Belum ada siswa yang mengumpulkan tugas</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                            Nama Siswa
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                            NIS
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                            Jawaban
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                            File Tugas
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                            Waktu Kirim
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {submissions.map((submission, idx) => (
                          <tr key={submission.id || idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {submission.student_name || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {submission.student_nis || '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                              <div className="line-clamp-2" title={submission.jawaban}>
                                {submission.jawaban || '-'}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {submission.file_url ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  asChild
                                  className="h-7"
                                >
                                  <a href={submission.file_url} target="_blank" rel="noopener noreferrer">
                                    <Download className="h-3 w-3 mr-1" />
                                    File
                                  </a>
                                </Button>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {formatDate(submission.submitted_at)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Sudah
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
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

export default GuruTugasPage;
