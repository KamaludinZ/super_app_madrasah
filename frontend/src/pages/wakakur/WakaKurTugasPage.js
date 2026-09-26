import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import {
  Loader2,
  ClipboardList,
  Calendar,
  Search,
  Eye,
  Download,
  ChevronRight,
  User,
  CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { sanitizeHtml } from '@/lib/sanitizeHtml';

const WakaKurTugasPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [allTugas, setAllTugas] = useState([]);
  const [groupedTugas, setGroupedTugas] = useState({});
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedTugas, setSelectedTugas] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  useEffect(() => {
    loadTugas();
  }, []);

  useEffect(() => {
    groupTugasBySubject();
  }, [searchQuery, allTugas]);

  const loadTugas = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/wakakur/tugas');
      console.log('Waka Kur Tugas loaded:', res.data);
      setAllTugas(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error loading tugas:', err);
      setError(err.response?.data?.detail || 'Gagal memuat tugas');
      setLoading(false);
    }
  };

  const groupTugasBySubject = () => {
    const grouped = {};
    let filtered = [...allTugas];

    if (searchQuery) {
      filtered = filtered.filter(
        (t) =>
          t.judul?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.subject_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.teacher_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    filtered.forEach((tugas) => {
      const key = `${tugas.subject_id}_${tugas.teacher_id}`;
      if (!grouped[key]) {
        grouped[key] = {
          subject_name: tugas.subject_name || 'Mata Pelajaran',
          teacher_name: tugas.teacher_name || 'Guru',
          subject_id: tugas.subject_id,
          teacher_id: tugas.teacher_id,
          items: []
        };
      }
      grouped[key].items.push(tugas);
    });

    setGroupedTugas(grouped);
  };

  const handleViewDetail = async (tugas) => {
    try {
      setSelectedTugas(tugas);
      setDetailOpen(true);
      setLoadingSubmissions(true);

      // Load submissions for this tugas
      const res = await api.get(`/wakakur/tugas/${tugas.id}/submissions`);
      setSubmissions(res.data.submissions || []);
      setLoadingSubmissions(false);
    } catch (err) {
      console.error('Error loading tugas detail:', err);
      toast.error('Gagal memuat detail tugas');
      setLoadingSubmissions(false);
    }
  };

  const handleSubjectClick = (subject) => {
    if (selectedSubject?.subject_id === subject.subject_id && selectedSubject?.teacher_id === subject.teacher_id) {
      setSelectedSubject(null);
    } else {
      setSelectedSubject(subject);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Memuat tugas...</span>
      </div>
    );
  }

  const groups = Object.values(groupedTugas);

  return (
    <div className="space-y-6">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <ClipboardList className="h-3 w-3 mr-1" /> Tugas Mapel (Waka Kurikulum)
        </Badge>
        <h1 className="text-3xl font-bold">Tugas Mapel</h1>
        <p className="text-muted-foreground">Lihat semua tugas pembelajaran (Read-Only)</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari tugas, mata pelajaran, atau guru..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* List of Subjects */}
      {groups.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              {searchQuery ? 'Tidak ada tugas yang sesuai dengan pencarian' : 'Belum ada tugas tersedia'}
            </p>
          </CardContent>
        </Card>
      ) : (
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
                        <ClipboardList className="h-5 w-5 text-primary" />
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
                                <h3 className="font-semibold">{tugas.judul}</h3>
                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
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
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(tugas.konten) || 'Tidak ada instruksi' }}
                              />
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewDetail(tugas)}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  Lihat Detail
                                </Button>
                                {tugas.file_url && (
                                  <Button variant="outline" size="sm" asChild>
                                    <a href={tugas.file_url} target="_blank" rel="noopener noreferrer">
                                      <Download className="h-4 w-4 mr-2" />
                                      Unduh File
                                    </a>
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
      )}

      {/* Detail Dialog with Submissions */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTugas?.judul}</DialogTitle>
            <DialogDescription>Detail lengkap tugas pembelajaran</DialogDescription>
          </DialogHeader>

          {selectedTugas && (
            <div className="space-y-6">
              {/* Information Grid */}
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

              {/* Konten */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Instruksi Tugas</h3>
                <div
                  className="prose prose-sm max-w-none p-4 bg-white border rounded-lg"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedTugas.konten) || 'Tidak ada instruksi' }}
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

export default WakaKurTugasPage;
