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
import { Loader2, BookOpen, User, Calendar, Search, Eye, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { api } from '@/lib/api';

const KelasTugasPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [allTugas, setAllTugas] = useState([]);
  const [groupedTugas, setGroupedTugas] = useState({});
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedTugas, setSelectedTugas] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
      const res = await api.get('/kelas/tugas');
      console.log('Tugas loaded:', res.data);

      // Filter hanya tugas dengan target_role "kelas"
      const kelasTugas = res.data.filter((t) =>
        t.target_role?.includes?.('kelas') || t.target_role === 'kelas'
      );

      setAllTugas(kelasTugas);
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
      const res = await api.get(`/kelas/tugas/${tugas.id}`);
      setSelectedTugas(res.data);
      setDetailOpen(true);
    } catch (err) {
      console.error('Error loading tugas detail:', err);
      setError('Gagal memuat detail tugas');
    }
  };

  const handleSubjectClick = (subject) => {
    if (selectedSubject?.subject_id === subject.subject_id && selectedSubject?.teacher_id === subject.teacher_id) {
      setSelectedSubject(null); // Toggle off
    } else {
      setSelectedSubject(subject); // Select subject
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
        <h1 className="text-3xl font-bold">Tugas Pembelajaran</h1>
        <p className="text-muted-foreground">Pilih mata pelajaran untuk melihat tugas</p>
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
              placeholder="Cari mata pelajaran atau tugas..."
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
              {searchQuery ? 'Tidak ada mata pelajaran yang sesuai dengan pencarian' : 'Belum ada tugas tersedia'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group, idx) => {
            const isSelected = selectedSubject?.subject_id === group.subject_id && selectedSubject?.teacher_id === group.teacher_id;

            return (
              <Card key={idx} className="overflow-hidden">
                {/* Subject Card - Clickable */}
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

                {/* Tugas List - Only shown when subject is selected */}
                {isSelected && (
                  <CardContent className="p-0">
                    <Accordion type="single" collapsible className="w-full">
                      {group.items.map((tugas) => (
                        <AccordionItem key={tugas.id} value={tugas.id} className="border-0 border-b last:border-0">
                          <AccordionTrigger className="px-6 hover:bg-muted/50 hover:no-underline">
                            <div className="flex items-start justify-between gap-4 text-left flex-1 pr-4">
                              <div className="flex-1">
                                <h3 className="font-semibold mb-1">{tugas.judul}</h3>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default KelasTugasPage;
