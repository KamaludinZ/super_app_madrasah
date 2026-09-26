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
} from '@/components/ui/dialog';
import { Loader2, BookOpen, User, Calendar, Search, Eye, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { api } from '@/lib/api';
import { sanitizeHtml } from '@/lib/sanitizeHtml';

const KelasMateriPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [allMateri, setAllMateri] = useState([]);
  const [groupedMateri, setGroupedMateri] = useState({});
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedMateri, setSelectedMateri] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadMateri();
  }, []);

  useEffect(() => {
    groupMateriBySubject();
  }, [searchQuery, allMateri]);

  const loadMateri = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/kelas/materi');
      console.log('Materi loaded:', res.data);

      // Filter hanya materi dengan target_role "kelas"
      const kelasMateri = res.data.filter((m) =>
        m.target_role?.includes?.('kelas') || m.target_role === 'kelas'
      );

      setAllMateri(kelasMateri);
      setLoading(false);
    } catch (err) {
      console.error('Error loading materi:', err);
      setError(err.response?.data?.detail || 'Gagal memuat materi');
      setLoading(false);
    }
  };

  const groupMateriBySubject = () => {
    const grouped = {};
    let filtered = [...allMateri];

    if (searchQuery) {
      filtered = filtered.filter(
        (m) =>
          m.judul?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.subject_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.teacher_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    filtered.forEach((materi) => {
      const key = `${materi.subject_id}_${materi.teacher_id}`;
      if (!grouped[key]) {
        grouped[key] = {
          subject_name: materi.subject_name || 'Mata Pelajaran',
          teacher_name: materi.teacher_name || 'Guru',
          subject_id: materi.subject_id,
          teacher_id: materi.teacher_id,
          items: []
        };
      }
      grouped[key].items.push(materi);
    });

    setGroupedMateri(grouped);
  };

  const handleViewDetail = async (materi) => {
    try {
      const res = await api.get(`/kelas/materi/${materi.id}`);
      setSelectedMateri(res.data);
      setDetailOpen(true);
    } catch (err) {
      console.error('Error loading materi detail:', err);
      setError('Gagal memuat detail materi');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Memuat materi...</span>
      </div>
    );
  }

  const groups = Object.values(groupedMateri);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Materi Pembelajaran</h1>
        <p className="text-muted-foreground">Pilih mata pelajaran untuk melihat materi</p>
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
              placeholder="Cari mata pelajaran atau materi..."
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
              {searchQuery ? 'Tidak ada mata pelajaran yang sesuai dengan pencarian' : 'Belum ada materi tersedia'}
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
                      <Badge variant="secondary">{group.items.length} Materi</Badge>
                      <ChevronRight className={`h-5 w-5 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                    </div>
                  </div>
                </CardHeader>

                {/* Materi List - Only shown when subject is selected */}
                {isSelected && (
                  <CardContent className="p-0">
                    <Accordion type="single" collapsible className="w-full">
                      {group.items.map((materi) => (
                        <AccordionItem key={materi.id} value={materi.id} className="border-0 border-b last:border-0">
                          <AccordionTrigger className="px-6 hover:bg-muted/50 hover:no-underline">
                            <div className="flex items-start justify-between gap-4 text-left flex-1 pr-4">
                              <div className="flex-1">
                                <h3 className="font-semibold">{materi.judul}</h3>
                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(materi.created_at)}
                                </div>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-6 pb-4">
                            <div className="space-y-4">
                              {materi.deskripsi && (
                                <div className="text-sm text-muted-foreground">
                                  {materi.deskripsi}
                                </div>
                              )}
                              <div
                                className="prose prose-sm max-w-none p-4 bg-muted/30 rounded-lg border"
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(materi.konten) || 'Tidak ada konten' }}
                              />
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewDetail(materi)}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  Lihat Detail Lengkap
                                </Button>
                                {materi.file_url && (
                                  <Button variant="outline" size="sm" asChild>
                                    <a href={materi.file_url} target="_blank" rel="noopener noreferrer">
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
            <DialogTitle>{selectedMateri?.judul}</DialogTitle>
            <DialogDescription>
              Detail materi pembelajaran
            </DialogDescription>
          </DialogHeader>

          {selectedMateri && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Mata Pelajaran</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedMateri.subject_name || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Guru</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedMateri.teacher_name || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Tanggal Dibuat</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(selectedMateri.created_at)}
                  </p>
                </div>
              </div>

              {selectedMateri.deskripsi && (
                <div>
                  <p className="text-sm font-medium mb-2">Deskripsi</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedMateri.deskripsi}
                  </p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-2">Konten Materi</p>
                <div
                  className="border rounded-lg p-4 bg-muted/50"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedMateri.konten) || 'Tidak ada konten' }}
                />
              </div>

              {selectedMateri.file_url && (
                <div>
                  <p className="text-sm font-medium mb-2">File Lampiran</p>
                  <Button variant="outline" asChild>
                    <a href={selectedMateri.file_url} target="_blank" rel="noopener noreferrer">
                      Unduh File
                    </a>
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KelasMateriPage;
