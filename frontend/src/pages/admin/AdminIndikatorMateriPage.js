import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BookOpen, FileText, Search, Loader2, Eye, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function AdminIndikatorMateriPage() {
  const [tab, setTab] = useState('indikator');
  const [indikatorList, setIndikatorList] = useState([]);
  const [materiList, setMateriList] = useState([]);
  const [guruList, setGuruList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filterGuru, setFilterGuru] = useState('all');
  const [filterSemester, setFilterSemester] = useState('');
  const [filterMapel, setFilterMapel] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
    loadGuru();
  }, []);

  const loadGuru = async () => {
    try {
      const { data } = await api.get('/users');
      const guru = data.filter(u => (u.roles || []).includes('guru'));
      setGuruList(guru);
    } catch (e) {
      console.error('Failed to load guru:', e);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterGuru && filterGuru !== 'all') params.guru_id = filterGuru;
      if (filterSemester) params.semester = filterSemester;
      if (filterMapel) params.mata_pelajaran = filterMapel;

      const [indikatorRes, materiRes] = await Promise.all([
        api.get('/indikator', { params }),
        api.get('/materi', { params }),
      ]);

      setIndikatorList(indikatorRes.data || []);
      setMateriList(materiRes.data || []);
    } catch (e) {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterGuru, filterSemester, filterMapel]);

  const handleDeleteIndikator = async (id) => {
    if (!confirm('Yakin ingin menghapus indikator ini?')) return;
    try {
      await api.delete(`/indikator/${id}`);
      toast.success('Indikator dihapus');
      loadData();
    } catch (e) {
      toast.error('Gagal menghapus indikator');
    }
  };

  const handleDeleteMateri = async (id) => {
    if (!confirm('Yakin ingin menghapus materi ini?')) return;
    try {
      await api.delete(`/materi/${id}`);
      toast.success('Materi dihapus');
      loadData();
    } catch (e) {
      toast.error('Gagal menghapus materi');
    }
  };

  const filteredIndikator = indikatorList.filter(item => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (item.kode_kd || '').toLowerCase().includes(s) ||
           (item.deskripsi || '').toLowerCase().includes(s) ||
           (item.mata_pelajaran || '').toLowerCase().includes(s);
  });

  const filteredMateri = materiList.filter(item => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (item.judul || '').toLowerCase().includes(s) ||
           (item.deskripsi || '').toLowerCase().includes(s) ||
           (item.mata_pelajaran || '').toLowerCase().includes(s);
  });

  // Get unique semesters and mapel for filters
  const allSemesters = [...new Set([...indikatorList, ...materiList].map(i => i.semester).filter(Boolean))];
  const allMapel = [...new Set([...indikatorList, ...materiList].map(i => i.mata_pelajaran).filter(Boolean))];

  return (
    <div className="space-y-6" data-testid="admin-indikator-materi-page">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <BookOpen className="h-3 w-3 mr-1" /> Data Indikator & Materi
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Data Indikator & Materi</h1>
        <p className="text-sm text-slate-600 mt-1">Kelola KD/Indikator dan Materi/Pokok Bahasan per Guru</p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Cari..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                autoComplete="off"
                name="indikator-search"
                type="search"
              />
            </div>

            <Select value={filterGuru} onValueChange={setFilterGuru}>
              <SelectTrigger>
                <SelectValue placeholder="Filter Guru" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Guru</SelectItem>
                {guruList.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterSemester || "all"} onValueChange={(v) => setFilterSemester(v === "all" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter Semester" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Semester</SelectItem>
                {allSemesters.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterMapel || "all"} onValueChange={(v) => setFilterMapel(v === "all" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter Mata Pelajaran" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Mapel</SelectItem>
                {allMapel.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white border border-slate-200">
          <TabsTrigger value="indikator">
            <BookOpen className="h-4 w-4 mr-2" />
            KD/Indikator ({filteredIndikator.length})
          </TabsTrigger>
          <TabsTrigger value="materi">
            <FileText className="h-4 w-4 mr-2" />
            Materi/Pokok Bahasan ({filteredMateri.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="indikator" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" />
                  <p className="text-slate-500">Memuat data...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">NO</TableHead>
                        <TableHead>KODE KD</TableHead>
                        <TableHead>DESKRIPSI</TableHead>
                        <TableHead>MATA PELAJARAN</TableHead>
                        <TableHead>SEMESTER</TableHead>
                        <TableHead>TINGKAT</TableHead>
                        <TableHead>DIBUAT OLEH</TableHead>
                        <TableHead className="text-right">AKSI</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredIndikator.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                            <BookOpen className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                            <div className="font-semibold">Tidak ada data indikator</div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredIndikator.map((item, idx) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-center text-slate-500 font-mono">{idx + 1}</TableCell>
                            <TableCell className="font-mono font-semibold">{item.kode_kd}</TableCell>
                            <TableCell className="max-w-md">
                              <div className="line-clamp-2">{item.deskripsi}</div>
                            </TableCell>
                            <TableCell>{item.mata_pelajaran}</TableCell>
                            <TableCell><Badge variant="outline" className="font-mono text-xs">{item.semester}</Badge></TableCell>
                            <TableCell>{item.tingkat_kelas || '-'}</TableCell>
                            <TableCell className="text-sm">{item.created_by_name || '-'}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteIndikator(item.id)}
                                className="text-rose-600 hover:text-rose-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="materi" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" />
                  <p className="text-slate-500">Memuat data...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">NO</TableHead>
                        <TableHead>JUDUL MATERI</TableHead>
                        <TableHead>DESKRIPSI</TableHead>
                        <TableHead>MATA PELAJARAN</TableHead>
                        <TableHead>SEMESTER</TableHead>
                        <TableHead>TINGKAT</TableHead>
                        <TableHead>DIBUAT OLEH</TableHead>
                        <TableHead className="text-right">AKSI</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMateri.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                            <FileText className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                            <div className="font-semibold">Tidak ada data materi</div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredMateri.map((item, idx) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-center text-slate-500 font-mono">{idx + 1}</TableCell>
                            <TableCell className="font-semibold">{item.judul}</TableCell>
                            <TableCell className="max-w-md">
                              <div className="line-clamp-2">{item.deskripsi || '-'}</div>
                            </TableCell>
                            <TableCell>{item.mata_pelajaran}</TableCell>
                            <TableCell><Badge variant="outline" className="font-mono text-xs">{item.semester}</Badge></TableCell>
                            <TableCell>{item.tingkat_kelas || '-'}</TableCell>
                            <TableCell className="text-sm">{item.created_by_name || '-'}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteMateri(item.id)}
                                className="text-rose-600 hover:text-rose-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
