import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, BookOpen, User, Calendar, Search, Eye, Send, CheckCircle, Clock, AlertCircle, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { api } from '@/lib/api';

const SiswaTugasPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tugasKelas, setTugasKelas] = useState([]);
  const [tugasSiswa, setTugasSiswa] = useState([]);
  const [groupedTugasKelas, setGroupedTugasKelas] = useState({});
  const [groupedTugasSiswa, setGroupedTugasSiswa] = useState({});
  const [selectedTugas, setSelectedTugas] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [submission, setSubmission] = useState({ jawaban: '', file_url: '' });
  const [activeTab, setActiveTab] = useState('kelas');
  const [selectedSubjectKelas, setSelectedSubjectKelas] = useState(null);
  const [selectedSubjectSiswa, setSelectedSubjectSiswa] = useState(null);

  useEffect(() => {
    loadTugas();
  }, []);

  useEffect(() => {
    groupTugasBySubject();
  }, [searchQuery, tugasKelas, tugasSiswa]);

  const loadTugas = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/kelas/tugas');
      console.log('Tugas loaded:', res.data);

      // Backend already returns filtered and merged data
      // Now we need to separate by target_role for tabs
      const kelas = res.data.filter((t) =>
        t.target_role === 'kelas' || (Array.isArray(t.target_role) && t.target_role.includes('kelas'))
      );
      const siswa = res.data.filter((t) =>
        t.target_role === 'siswa' || (Array.isArray(t.target_role) && t.target_role.includes('siswa'))
      );

      console.log('Tugas Kelas:', kelas.length, 'Tugas Siswa:', siswa.length);
      setTugasKelas(kelas);
      setTugasSiswa(siswa);
      setLoading(false);
    } catch (err) {
      console.error('Error loading tugas:', err);
      setError(err.response?.data?.detail || 'Gagal memuat tugas');
      setLoading(false);
    }
  };

  const groupTugasBySubject = () => {
    // Group tugas kelas by subject
    const groupedKelas = {};
    let filteredKelas = [...tugasKelas];
    if (searchQuery) {
      filteredKelas = filteredKelas.filter(
        (t) =>
          t.judul?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.subject_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.teacher_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    filteredKelas.forEach((tugas) => {
      const key = `${tugas.subject_id}_${tugas.teacher_id}`;
      if (!groupedKelas[key]) {
        groupedKelas[key] = {
          subject_name: tugas.subject_name || 'Mata Pelajaran',
          teacher_name: tugas.teacher_name || 'Guru',
          subject_id: tugas.subject_id,
          teacher_id: tugas.teacher_id,
          items: []
        };
      }
      groupedKelas[key].items.push(tugas);
    });
    setGroupedTugasKelas(groupedKelas);

    // Group tugas siswa by subject
    const groupedSiswa = {};
    let filteredSiswa = [...tugasSiswa];
    if (searchQuery) {
      filteredSiswa = filteredSiswa.filter(
        (t) =>
          t.judul?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.subject_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.teacher_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    filteredSiswa.forEach((tugas) => {
      const key = `${tugas.subject_id}_${tugas.teacher_id}`;
      if (!groupedSiswa[key]) {
        groupedSiswa[key] = {
          subject_name: tugas.subject_name || 'Mata Pelajaran',
          teacher_name: tugas.teacher_name || 'Guru',
          subject_id: tugas.subject_id,
          teacher_id: tugas.teacher_id,
          items: []
        };
      }
      groupedSiswa[key].items.push(tugas);
    });
    setGroupedTugasSiswa(groupedSiswa);
  };

  const handleViewDetail = async (tugas) => {
    try {
      const res = await api.get(`/kelas/tugas/${tugas.id}`);
      setSelectedTugas(res.data);
      setDetailOpen(true);
    } catch (err) {
      console.error('Error loading tugas detail:', err);
      setError('Gagal memuat detail tugas');
    }
  };

  const handleOpenSubmit = (tugas) => {
    setSelectedTugas(tugas);
    setSubmission({ jawaban: '', file_url: '' });
    setSubmitOpen(true);
  };

  const handleSubmitTugas = async () => {
    try {
      setError('');
      setSuccess('');
      if (!submission.jawaban.trim()) {
        setError('Jawaban tidak boleh kosong');
        return;
      }

      await api.post(`/kelas/tugas/${selectedTugas.id}/submit`, submission);
      setSubmitOpen(false);
      setSubmission({ jawaban: '', file_url: '' });

      // Reload data first, then show success
      await loadTugas();
      setSuccess('Tugas berhasil dikumpulkan!');

      // Auto clear success message after 5 seconds
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      console.error('Error submitting tugas:', err);
      setError(err.response?.data?.detail || 'Gagal mengumpulkan tugas');
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

  const isOverdue = (deadline) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  };

  const getStatusBadge = (tugas) => {
    if (tugas.submission_status === 'submitted') {
      return (
        <Badge className="bg-green-500">
          <CheckCircle className="h-3 w-3 mr-1" />
          Sudah Dikumpulkan
        </Badge>
      );
    }
    if (isOverdue(tugas.deadline)) {
      return (
        <Badge variant="destructive">
          <AlertCircle className="h-3 w-3 mr-1" />
          Terlambat
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <Clock className="h-3 w-3 mr-1" />
        Belum Dikumpulkan
      </Badge>
    );
  };

  const handleSubjectClickKelas = (subject) => {
    if (selectedSubjectKelas?.subject_id === subject.subject_id && selectedSubjectKelas?.teacher_id === subject.teacher_id) {
      setSelectedSubjectKelas(null);
    } else {
      setSelectedSubjectKelas(subject);
    }
  };

  const handleSubjectClickSiswa = (subject) => {
    if (selectedSubjectSiswa?.subject_id === subject.subject_id && selectedSubjectSiswa?.teacher_id === subject.teacher_id) {
      setSelectedSubjectSiswa(null);
    } else {
      setSelectedSubjectSiswa(subject);
    }
  };

  const renderTugasList = (groupedTugas, selectedSubject, handleSubjectClick) => {
    const groups = Object.values(groupedTugas);

    if (groups.length === 0) {
      return (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              {searchQuery ? 'Tidak ada tugas yang sesuai dengan pencarian' : 'Belum ada tugas tersedia'}
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {groups.map((group, idx) => {
          const isSelected = selectedSubject?.subject_id === group.subject_id && selectedSubject?.teacher_id === group.teacher_id;

          return (
            <Card key={idx} className="overflow-hidden">
              <CardHeader
                className="bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                onClick={() => handleSubjectClick(group)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      {group.subject_name}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <User className="h-4 w-4" />
                      {group.teacher_name}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{group.items.length} Tugas</Badge>
                    <ChevronRight className={`h-5 w-5 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                  </div>
                </div>
              </CardHeader>
              {isSelected && (
                <CardContent className="p-0">
              <Accordion type="single" collapsible className="w-full">
                {group.items.map((tugas) => (
                  <AccordionItem key={tugas.id} value={tugas.id} className="border-0 border-b last:border-0">
                    <AccordionTrigger className="px-6 hover:bg-muted/50 hover:no-underline">
                      <div className="flex items-start justify-between gap-4 text-left flex-1 pr-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{tugas.judul}</h3>
                            {getStatusBadge(tugas)}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            Deadline: {formatDate(tugas.deadline)}
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-4">
                      <div className="space-y-4">
                        {tugas.deskripsi && (
                          <div className="text-sm text-muted-foreground">
                            {tugas.deskripsi}
                          </div>
                        )}
                        <div
                          className="prose prose-sm max-w-none p-4 bg-muted/30 rounded-lg border"
                          dangerouslySetInnerHTML={{ __html: tugas.konten || 'Tidak ada instruksi' }}
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetail(tugas)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Lihat Detail Lengkap
                          </Button>
                          {tugas.file_url && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={tugas.file_url} target="_blank" rel="noopener noreferrer">
                                Unduh File
                              </a>
                            </Button>
                          )}
                          {tugas.submission_status !== 'submitted' && (
                            <Button
                              size="sm"
                              onClick={() => handleOpenSubmit(tugas)}
                              disabled={isOverdue(tugas.deadline)}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              {isOverdue(tugas.deadline) ? 'Terlambat' : 'Kumpulkan'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Memuat tugas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tugas Pembelajaran</h1>
        <p className="text-muted-foreground">Daftar tugas yang harus Anda kerjakan</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 text-green-900 border-green-200">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari tugas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <CardContent className="pt-6">
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
              {renderTugasList(groupedTugasKelas, selectedSubjectKelas, handleSubjectClickKelas)}
            </TabsContent>

            <TabsContent value="siswa" className="mt-6">
              {renderTugasList(groupedTugasSiswa, selectedSubjectSiswa, handleSubjectClickSiswa)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTugas?.judul}</DialogTitle>
            <DialogDescription>Detail tugas pembelajaran</DialogDescription>
          </DialogHeader>

          {selectedTugas && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Mata Pelajaran</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedTugas.subject_name || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Guru</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedTugas.teacher_name || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Deadline</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(selectedTugas.deadline)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Status</p>
                  {getStatusBadge(selectedTugas)}
                </div>
              </div>

              {selectedTugas.deskripsi && (
                <div>
                  <p className="text-sm font-medium mb-2">Deskripsi</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedTugas.deskripsi}
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-2">Instruksi Tugas</p>
                <div
                  className="border rounded-lg p-4 bg-muted/50"
                  dangerouslySetInnerHTML={{ __html: selectedTugas.konten || 'Tidak ada instruksi' }}
                />
              </div>

              {selectedTugas.file_url && (
                <div>
                  <p className="text-sm font-medium mb-2">File Lampiran</p>
                  <Button variant="outline" asChild>
                    <a href={selectedTugas.file_url} target="_blank" rel="noopener noreferrer">
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
            {selectedTugas && selectedTugas.submission_status !== 'submitted' && !isOverdue(selectedTugas.deadline) && (
              <Button
                onClick={() => {
                  setDetailOpen(false);
                  handleOpenSubmit(selectedTugas);
                }}
              >
                <Send className="h-4 w-4 mr-2" />
                Kumpulkan Tugas
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit Dialog */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Kumpulkan Tugas: {selectedTugas?.judul}</DialogTitle>
            <DialogDescription>
              Pastikan jawaban Anda sudah benar sebelum dikumpulkan
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Anda tidak dapat mengubah jawaban setelah dikumpulkan
              </AlertDescription>
            </Alert>

            <div>
              <label className="text-sm font-medium">Jawaban Anda *</label>
              <Textarea
                rows={10}
                placeholder="Ketik jawaban tugas Anda di sini..."
                value={submission.jawaban}
                onChange={(e) => setSubmission({ ...submission, jawaban: e.target.value })}
                className="mt-2"
              />
            </div>

            <div>
              <label className="text-sm font-medium">URL File (Opsional)</label>
              <Input
                placeholder="https://drive.google.com/..."
                value={submission.file_url}
                onChange={(e) => setSubmission({ ...submission, file_url: e.target.value })}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Masukkan link ke file tugas Anda (Google Drive, Dropbox, dll.)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={handleSubmitTugas}
              disabled={!submission.jawaban.trim()}
            >
              <Send className="h-4 w-4 mr-2" />
              Kumpulkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SiswaTugasPage;
