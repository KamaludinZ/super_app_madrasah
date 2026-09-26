import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, BookOpen, User, Calendar, Search, Eye, Send, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { api } from '@/lib/api';
import { sanitizeHtml } from '@/lib/sanitizeHtml';

const SiswaTugasPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tugasList, setTugasList] = useState([]);
  const [filteredTugas, setFilteredTugas] = useState([]);
  const [selectedTugas, setSelectedTugas] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [submission, setSubmission] = useState({ jawaban: '', file_url: '' });

  useEffect(() => {
    loadTugas();
  }, []);

  useEffect(() => {
    filterTugas();
  }, [searchQuery, tugasList]);

  const loadTugas = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/kelas/tugas');
      console.log('Tugas loaded:', res.data);
      setTugasList(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error loading tugas:', err);
      setError(err.response?.data?.detail || 'Gagal memuat tugas');
      setLoading(false);
    }
  };

  const filterTugas = () => {
    let filtered = [...tugasList];

    if (searchQuery) {
      filtered = filtered.filter(
        (t) =>
          t.judul?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.subject_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.teacher_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredTugas(filtered);
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
      if (!submission.jawaban.trim()) {
        setError('Jawaban tidak boleh kosong');
        return;
      }

      await api.post(`/kelas/tugas/${selectedTugas.id}/submit`, submission);
      setSuccess('Tugas berhasil dikumpulkan!');
      setSubmitOpen(false);
      setSubmission({ jawaban: '', file_url: '' });
      loadTugas();
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

      {/* Tugas List */}
      {filteredTugas.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              {searchQuery ? 'Tidak ada tugas yang sesuai dengan pencarian' : 'Belum ada tugas tersedia'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTugas.map((tugas) => (
            <Card
              key={tugas.id}
              className={`hover:shadow-lg transition-shadow ${
                tugas.submission_status === 'submitted'
                  ? 'border-l-4 border-l-green-500'
                  : isOverdue(tugas.deadline)
                  ? 'border-l-4 border-l-red-500'
                  : 'border-l-4 border-l-yellow-500'
              }`}
            >
              <CardHeader>
                <div className="flex justify-between items-start gap-2">
                  <CardTitle className="line-clamp-2 flex-1">{tugas.judul}</CardTitle>
                  {getStatusBadge(tugas)}
                </div>
                <CardDescription>
                  <Badge variant="outline">
                    <BookOpen className="h-3 w-3 mr-1" />
                    {tugas.subject_name || 'Mata Pelajaran'}
                  </Badge>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center text-sm text-muted-foreground">
                  <User className="h-4 w-4 mr-2" />
                  {tugas.teacher_name || 'Guru'}
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 mr-2" />
                  Deadline: {formatDate(tugas.deadline)}
                </div>
                {tugas.deskripsi && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {tugas.deskripsi}
                  </p>
                )}
                <div className="space-y-2">
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => handleViewDetail(tugas)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Lihat Detail
                  </Button>
                  {tugas.submission_status !== 'submitted' && (
                    <Button
                      className="w-full"
                      onClick={() => handleOpenSubmit(tugas)}
                      disabled={isOverdue(tugas.deadline)}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {isOverdue(tugas.deadline) ? 'Terlambat' : 'Kumpulkan Tugas'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
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
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedTugas.konten) || 'Tidak ada instruksi' }}
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
