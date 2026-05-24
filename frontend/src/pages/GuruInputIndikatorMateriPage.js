import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { BookOpen, FileText, Plus, Pencil, Trash2, Loader2, Save, Upload, Download } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

export default function GuruInputIndikatorMateriPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('indikator');
  const [indikatorList, setIndikatorList] = useState([]);
  const [materiList, setMateriList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Modal states
  const [showIndikatorModal, setShowIndikatorModal] = useState(false);
  const [showMateriModal, setShowMateriModal] = useState(false);
  const [editingIndikator, setEditingIndikator] = useState(null);
  const [editingMateri, setEditingMateri] = useState(null);

  // Import states
  const [indikatorImportFile, setIndikatorImportFile] = useState(null);
  const [materiImportFile, setMateriImportFile] = useState(null);

  // Form states for Indikator
  const [indikatorForm, setIndikatorForm] = useState({
    kode: '',
    nama: '',
    mapel_id: '',
    tingkat_kelas: '',
    semester_id: '',
  });

  // Form states for Materi
  const [materiForm, setMateriForm] = useState({
    nama: '',
    deskripsi: '',
    mapel_id: '',
    tingkat_kelas: '',
    semester_id: '',
    indikator_id: '',
  });

  // Semester and subject options
  const [semesterList, setSemesterList] = useState([]);
  const [subjectList, setSubjectList] = useState([]);
  const [activeSemester, setActiveSemester] = useState(null);
  const tingkatKelasList = ['VII', 'VIII', 'IX'];

  useEffect(() => {
    loadSemesters();
    loadSubjects();
  }, []);

  useEffect(() => {
    if (activeSemester) {
      loadData();
    }
  }, [activeSemester]);

  const loadSemesters = async () => {
    try {
      const { data } = await api.get('/semesters');
      setSemesterList(data || []);
      const active = data.find(s => s.is_active);
      if (active) {
        setActiveSemester(active);
      }
    } catch (e) {
      console.error('Failed to load semesters:', e);
    }
  };

  const loadSubjects = async () => {
    try {
      const { data } = await api.get('/subjects');
      setSubjectList(data || []);
    } catch (e) {
      console.error('Failed to load subjects:', e);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [indikatorRes, materiRes] = await Promise.all([
        api.get('/indikator'),
        api.get('/materi'),
      ]);

      // Filter by created_by (current user)
      const userIndikator = (indikatorRes.data || []).filter(item => item.created_by === user?.id);
      const userMateri = (materiRes.data || []).filter(item => item.created_by === user?.id);

      setIndikatorList(userIndikator);
      setMateriList(userMateri);
    } catch (e) {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  // Get subject name by ID
  const getSubjectName = (id) => {
    const subject = subjectList.find(s => s.id === id);
    return subject ? subject.nama_pelajaran : '-';
  };

  // Get semester name by ID
  const getSemesterName = (id) => {
    const semester = semesterList.find(s => s.id === id);
    return semester ? semester.semester_name : '-';
  };

  // Indikator handlers
  const openIndikatorModal = (item = null) => {
    if (item) {
      setEditingIndikator(item);
      setIndikatorForm({
        kode: item.kode || '',
        nama: item.nama || '',
        mapel_id: item.mapel_id || '',
        tingkat_kelas: item.tingkat_kelas || '',
        semester_id: item.semester_id || '',
      });
    } else {
      setEditingIndikator(null);
      setIndikatorForm({
        kode: '',
        nama: '',
        mapel_id: '',
        tingkat_kelas: '',
        semester_id: activeSemester?.id || '',
      });
    }
    setShowIndikatorModal(true);
  };

  const handleSaveIndikator = async () => {
    if (!indikatorForm.kode || !indikatorForm.nama || !indikatorForm.mapel_id || !indikatorForm.semester_id) {
      toast.error('Mohon lengkapi semua field yang wajib');
      return;
    }

    setSaving(true);
    try {
      if (editingIndikator) {
        await api.put(`/indikator/${editingIndikator.id}`, indikatorForm);
        toast.success('Indikator berhasil diperbarui');
      } else {
        await api.post('/indikator', indikatorForm);
        toast.success('Indikator berhasil ditambahkan');
      }
      setShowIndikatorModal(false);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan indikator');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteIndikator = async (id) => {
    if (!window.confirm('Yakin ingin menghapus indikator ini?')) return;
    try {
      await api.delete(`/indikator/${id}`);
      toast.success('Indikator dihapus');
      loadData();
    } catch (e) {
      toast.error('Gagal menghapus indikator');
    }
  };

  // Materi handlers
  const openMateriModal = (item = null) => {
    if (item) {
      setEditingMateri(item);
      setMateriForm({
        nama: item.nama || '',
        deskripsi: item.deskripsi || '',
        mapel_id: item.mapel_id || '',
        tingkat_kelas: item.tingkat_kelas || '',
        semester_id: item.semester_id || '',
        indikator_id: item.indikator_id || '',
      });
    } else {
      setEditingMateri(null);
      setMateriForm({
        nama: '',
        deskripsi: '',
        mapel_id: '',
        tingkat_kelas: '',
        semester_id: activeSemester?.id || '',
        indikator_id: '',
      });
    }
    setShowMateriModal(true);
  };

  const handleSaveMateri = async () => {
    if (!materiForm.nama || !materiForm.mapel_id || !materiForm.semester_id) {
      toast.error('Mohon lengkapi semua field yang wajib');
      return;
    }

    setSaving(true);
    try {
      if (editingMateri) {
        await api.put(`/materi/${editingMateri.id}`, materiForm);
        toast.success('Materi berhasil diperbarui');
      } else {
        await api.post('/materi', materiForm);
        toast.success('Materi berhasil ditambahkan');
      }
      setShowMateriModal(false);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan materi');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMateri = async (id) => {
    if (!window.confirm('Yakin ingin menghapus materi ini?')) return;
    try {
      await api.delete(`/materi/${id}`);
      toast.success('Materi dihapus');
      loadData();
    } catch (e) {
      toast.error('Gagal menghapus materi');
    }
  };

  // Import handlers
  const handleIndikatorImport = async () => {
    if (!indikatorImportFile) {
      toast.error('Pilih file Excel terlebih dahulu');
      return;
    }

    const formData = new FormData();
    formData.append('file', indikatorImportFile);

    setUploading(true);
    try {
      const res = await api.post('/indikator/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`Berhasil mengimpor ${res.data.imported || 0} indikator`);
      setIndikatorImportFile(null);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal mengimpor data');
    } finally {
      setUploading(false);
    }
  };

  const handleMateriImport = async () => {
    if (!materiImportFile) {
      toast.error('Pilih file Excel terlebih dahulu');
      return;
    }

    const formData = new FormData();
    formData.append('file', materiImportFile);

    setUploading(true);
    try {
      const res = await api.post('/materi/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`Berhasil mengimpor ${res.data.imported || 0} materi`);
      setMateriImportFile(null);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal mengimpor data');
    } finally {
      setUploading(false);
    }
  };

  // Download template handlers
  const handleDownloadIndikatorTemplate = () => {
    // Create CSV template
    const headers = ['kode', 'nama', 'mapel_id', 'tingkat_kelas', 'semester_id'];
    const example = ['3.1', 'Menjelaskan dan melakukan operasi hitung bilangan bulat dan pecahan', 'subject_id_here', 'VII', 'semester_id_here'];
    const csvContent = [
      headers.join(','),
      example.join(','),
      '3.2,"Menjelaskan himpunan, himpunan bagian, komplemen himpunan",subject_id_here,VII,semester_id_here'
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_indikator.csv';
    link.click();
    toast.success('Template berhasil diunduh');
  };

  const handleDownloadMateriTemplate = () => {
    // Create CSV template
    const headers = ['nama', 'deskripsi', 'mapel_id', 'tingkat_kelas', 'semester_id', 'indikator_id'];
    const example = ['Operasi Penjumlahan dan Pengurangan Bilangan Bulat', 'Memahami konsep penjumlahan dan pengurangan', 'subject_id_here', 'VII', 'semester_id_here', 'indikator_id_here'];
    const csvContent = [
      headers.join(','),
      example.join(','),
      'Operasi Perkalian dan Pembagian,"Memahami konsep perkalian dan pembagian",subject_id_here,VII,semester_id_here,indikator_id_here'
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_materi.csv';
    link.click();
    toast.success('Template berhasil diunduh');
  };

  // Get filtered indikator for materi dropdown
  const getFilteredIndikator = () => {
    return indikatorList.filter(ind =>
      ind.mapel_id === materiForm.mapel_id &&
      ind.semester_id === materiForm.semester_id &&
      (!materiForm.tingkat_kelas || ind.tingkat_kelas === materiForm.tingkat_kelas)
    );
  };

  return (
    <div className="space-y-6" data-testid="guru-indikator-materi-page">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <BookOpen className="h-3 w-3 mr-1" /> Input Indikator & Materi
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Input Indikator & Materi</h1>
        <p className="text-sm text-slate-600 mt-1">Kelola KD/Indikator dan Materi/Pokok Bahasan untuk Jurnal Mengajar</p>
      </div>

      {activeSemester && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className="bg-white">Semester Aktif</Badge>
              <span className="font-semibold text-blue-900">{activeSemester.semester_name}</span>
              <span className="text-blue-600">({activeSemester.tahun_takwim})</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white border border-slate-200">
          <TabsTrigger value="indikator">
            <BookOpen className="h-4 w-4 mr-2" />
            KD/Indikator ({indikatorList.length})
          </TabsTrigger>
          <TabsTrigger value="materi">
            <FileText className="h-4 w-4 mr-2" />
            Materi/Pokok Bahasan ({materiList.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="indikator" className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-2 justify-between">
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleDownloadIndikatorTemplate} variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Download Template
              </Button>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => setIndikatorImportFile(e.target.files[0])}
                  className="max-w-xs"
                />
                <Button
                  onClick={handleIndikatorImport}
                  disabled={!indikatorImportFile || uploading}
                  className="gap-2"
                  variant="outline"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Import
                </Button>
              </div>
            </div>
            <Button onClick={() => openIndikatorModal()} className="gap-2 bg-[#006837] hover:bg-[#005830]">
              <Plus className="h-4 w-4" />
              Tambah KD/Indikator
            </Button>
          </div>

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
                        <TableHead>KODE</TableHead>
                        <TableHead>NAMA INDIKATOR</TableHead>
                        <TableHead>MATA PELAJARAN</TableHead>
                        <TableHead>TINGKAT</TableHead>
                        <TableHead>SEMESTER</TableHead>
                        <TableHead className="text-right">AKSI</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {indikatorList.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                            <BookOpen className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                            <div className="font-semibold">Belum ada data indikator</div>
                            <div className="text-xs mt-1">Klik tombol "Tambah KD/Indikator" atau Import data</div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        indikatorList.map((item, idx) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-center text-slate-500 font-mono">{idx + 1}</TableCell>
                            <TableCell className="font-mono font-semibold">{item.kode}</TableCell>
                            <TableCell className="max-w-md">
                              <div className="line-clamp-2">{item.nama}</div>
                            </TableCell>
                            <TableCell>{getSubjectName(item.mapel_id)}</TableCell>
                            <TableCell><Badge variant="outline">{item.tingkat_kelas || '-'}</Badge></TableCell>
                            <TableCell><Badge variant="outline" className="font-mono text-xs">{getSemesterName(item.semester_id)}</Badge></TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => openIndikatorModal(item)}
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleDeleteIndikator(item.id)}
                                  className="text-rose-600 hover:text-rose-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
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

        <TabsContent value="materi" className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-2 justify-between">
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleDownloadMateriTemplate} variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Download Template
              </Button>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => setMateriImportFile(e.target.files[0])}
                  className="max-w-xs"
                />
                <Button
                  onClick={handleMateriImport}
                  disabled={!materiImportFile || uploading}
                  className="gap-2"
                  variant="outline"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Import
                </Button>
              </div>
            </div>
            <Button onClick={() => openMateriModal()} className="gap-2 bg-[#006837] hover:bg-[#005830]">
              <Plus className="h-4 w-4" />
              Tambah Materi
            </Button>
          </div>

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
                        <TableHead>NAMA MATERI</TableHead>
                        <TableHead>DESKRIPSI</TableHead>
                        <TableHead>MATA PELAJARAN</TableHead>
                        <TableHead>TINGKAT</TableHead>
                        <TableHead>SEMESTER</TableHead>
                        <TableHead className="text-right">AKSI</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {materiList.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                            <FileText className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                            <div className="font-semibold">Belum ada data materi</div>
                            <div className="text-xs mt-1">Klik tombol "Tambah Materi" atau Import data</div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        materiList.map((item, idx) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-center text-slate-500 font-mono">{idx + 1}</TableCell>
                            <TableCell className="font-semibold">{item.nama}</TableCell>
                            <TableCell className="max-w-md">
                              <div className="line-clamp-2">{item.deskripsi || '-'}</div>
                            </TableCell>
                            <TableCell>{getSubjectName(item.mapel_id)}</TableCell>
                            <TableCell><Badge variant="outline">{item.tingkat_kelas || '-'}</Badge></TableCell>
                            <TableCell><Badge variant="outline" className="font-mono text-xs">{getSemesterName(item.semester_id)}</Badge></TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => openMateriModal(item)}
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleDeleteMateri(item.id)}
                                  className="text-rose-600 hover:text-rose-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
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

      {/* Indikator Modal */}
      <Dialog open={showIndikatorModal} onOpenChange={setShowIndikatorModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingIndikator ? 'Edit KD/Indikator' : 'Tambah KD/Indikator Baru'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="kode">Kode KD <span className="text-rose-500">*</span></Label>
              <Input
                id="kode"
                value={indikatorForm.kode}
                onChange={(e) => setIndikatorForm({ ...indikatorForm, kode: e.target.value })}
                placeholder="Contoh: 3.1, 4.2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nama">Nama Indikator <span className="text-rose-500">*</span></Label>
              <Textarea
                id="nama"
                value={indikatorForm.nama}
                onChange={(e) => setIndikatorForm({ ...indikatorForm, nama: e.target.value })}
                placeholder="Nama lengkap KD/Indikator"
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mapel_id">Mata Pelajaran <span className="text-rose-500">*</span></Label>
                <Select
                  value={indikatorForm.mapel_id || "none"}
                  onValueChange={(v) => setIndikatorForm({ ...indikatorForm, mapel_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Mata Pelajaran" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Pilih Mata Pelajaran</SelectItem>
                    {subjectList.map((mp) => (
                      <SelectItem key={mp.id} value={mp.id}>{mp.nama_pelajaran}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tingkat_kelas">Tingkat Kelas</Label>
                <Select
                  value={indikatorForm.tingkat_kelas || "all"}
                  onValueChange={(v) => setIndikatorForm({ ...indikatorForm, tingkat_kelas: v === "all" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Tingkat Kelas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Tingkat</SelectItem>
                    {tingkatKelasList.map((tk) => (
                      <SelectItem key={tk} value={tk}>Kelas {tk}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="semester_id">Semester <span className="text-rose-500">*</span></Label>
              <Select
                value={indikatorForm.semester_id || "none"}
                onValueChange={(v) => setIndikatorForm({ ...indikatorForm, semester_id: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Semester" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih Semester</SelectItem>
                  {semesterList.map((sem) => (
                    <SelectItem key={sem.id} value={sem.id}>
                      {sem.semester_name} ({sem.tahun_takwim})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIndikatorModal(false)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={handleSaveIndikator} disabled={saving} className="gap-2 bg-[#006837] hover:bg-[#005830]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Materi Modal */}
      <Dialog open={showMateriModal} onOpenChange={setShowMateriModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMateri ? 'Edit Materi/Pokok Bahasan' : 'Tambah Materi/Pokok Bahasan Baru'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nama_materi">Nama Materi <span className="text-rose-500">*</span></Label>
              <Input
                id="nama_materi"
                value={materiForm.nama}
                onChange={(e) => setMateriForm({ ...materiForm, nama: e.target.value })}
                placeholder="Nama materi atau pokok bahasan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deskripsi_materi">Deskripsi</Label>
              <Textarea
                id="deskripsi_materi"
                value={materiForm.deskripsi}
                onChange={(e) => setMateriForm({ ...materiForm, deskripsi: e.target.value })}
                placeholder="Deskripsi materi (opsional)"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mapel_id_materi">Mata Pelajaran <span className="text-rose-500">*</span></Label>
                <Select
                  value={materiForm.mapel_id || "none"}
                  onValueChange={(v) => setMateriForm({ ...materiForm, mapel_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Mata Pelajaran" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Pilih Mata Pelajaran</SelectItem>
                    {subjectList.map((mp) => (
                      <SelectItem key={mp.id} value={mp.id}>{mp.nama_pelajaran}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tingkat_kelas_materi">Tingkat Kelas</Label>
                <Select
                  value={materiForm.tingkat_kelas || "all"}
                  onValueChange={(v) => setMateriForm({ ...materiForm, tingkat_kelas: v === "all" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Tingkat Kelas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Tingkat</SelectItem>
                    {tingkatKelasList.map((tk) => (
                      <SelectItem key={tk} value={tk}>Kelas {tk}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="semester_id_materi">Semester <span className="text-rose-500">*</span></Label>
              <Select
                value={materiForm.semester_id || "none"}
                onValueChange={(v) => setMateriForm({ ...materiForm, semester_id: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Semester" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih Semester</SelectItem>
                  {semesterList.map((sem) => (
                    <SelectItem key={sem.id} value={sem.id}>
                      {sem.semester_name} ({sem.tahun_takwim})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="indikator_id">KD/Indikator Terkait (Opsional)</Label>
              <Select
                value={materiForm.indikator_id || "none"}
                onValueChange={(v) => setMateriForm({ ...materiForm, indikator_id: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih KD/Indikator (Opsional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak Ada</SelectItem>
                  {getFilteredIndikator().map((ind) => (
                    <SelectItem key={ind.id} value={ind.id}>
                      {ind.kode} - {ind.nama.substring(0, 50)}{ind.nama.length > 50 ? '...' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMateriModal(false)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={handleSaveMateri} disabled={saving} className="gap-2 bg-[#006837] hover:bg-[#005830]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
