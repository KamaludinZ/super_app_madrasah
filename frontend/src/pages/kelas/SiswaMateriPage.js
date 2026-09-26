import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, BookOpen, User, Calendar, Search, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { api } from '@/lib/api';
import { sanitizeHtml } from '@/lib/sanitizeHtml';

const SiswaMateriPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [materiList, setMateriList] = useState([]);
  const [filteredMateri, setFilteredMateri] = useState([]);
  const [selectedMateri, setSelectedMateri] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadMateri();
  }, []);

  useEffect(() => {
    filterMateri();
  }, [searchQuery, materiList]);

  const loadMateri = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/kelas/materi');
      console.log('Materi loaded:', res.data);
      setMateriList(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error loading materi:', err);
      setError(err.response?.data?.detail || 'Gagal memuat materi');
      setLoading(false);
    }
  };

  const filterMateri = () => {
    let filtered = [...materiList];

    if (searchQuery) {
      filtered = filtered.filter(
        (m) =>
          m.judul?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.subject_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.teacher_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredMateri(filtered);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Materi Pembelajaran</h1>
        <p className="text-muted-foreground">Daftar materi pembelajaran yang tersedia untuk Anda</p>
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
              placeholder="Cari materi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Materi List */}
      {filteredMateri.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              {searchQuery ? 'Tidak ada materi yang sesuai dengan pencarian' : 'Belum ada materi tersedia'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMateri.map((materi) => (
            <Card key={materi.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="line-clamp-2">{materi.judul}</CardTitle>
                <CardDescription className="space-y-2">
                  <Badge variant="outline" className="mr-2">
                    <BookOpen className="h-3 w-3 mr-1" />
                    {materi.subject_name || 'Mata Pelajaran'}
                  </Badge>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center text-sm text-muted-foreground">
                  <User className="h-4 w-4 mr-2" />
                  {materi.teacher_name || 'Guru'}
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 mr-2" />
                  {formatDate(materi.created_at)}
                </div>
                {materi.deskripsi && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {materi.deskripsi}
                  </p>
                )}
                <Button
                  className="w-full"
                  onClick={() => handleViewDetail(materi)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Lihat Detail
                </Button>
              </CardContent>
            </Card>
          ))}
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

export default SiswaMateriPage;
