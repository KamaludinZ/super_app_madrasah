import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HeartPulse, Syringe, Plus, Trash2, Loader2, Save, Search, Pencil, Eye, Upload, Download, FileSpreadsheet, X } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ui/confirm-dialog';

const emptyPatientPicker = {
  jenis_pasien: 'siswa', // 'siswa' or 'gtk'
  gtk_kategori: 'guru',
  tingkat: '',
  kelas_id: '',
  pasien_id: '',
};

const emptyCkgForm = {
  ...emptyPatientPicker,
  tanggal: new Date().toISOString().split('T')[0],
  tinggi_badan: '',
  berat_badan: '',
  tekanan_darah: '',
  nadi: '',
  suhu: '',
  spo2: '',
  pemeriksaan_mata: '',
  pemeriksaan_gigi: '',
  kesimpulan: '',
  rekomendasi: '',
  keterangan: '',
};

const emptyImunisasiForm = {
  ...emptyPatientPicker,
  tanggal: new Date().toISOString().split('T')[0],
  jenis_vaksin: '',
  dosis_ke: '',
  petugas_pemberi: '',
  efek_samping: '',
  keterangan: '',
};

export default function AdminUKSCkgPage() {
  const [tab, setTab] = useState('ckg');
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [gtkList, setGtkList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [ckgList, setCkgList] = useState([]);
  const [imunisasiList, setImunisasiList] = useState([]);

  const [showCkgModal, setShowCkgModal] = useState(false);
  const [ckgForm, setCkgForm] = useState(emptyCkgForm);
  const [editingCkgId, setEditingCkgId] = useState(null);
  const [savingCkg, setSavingCkg] = useState(false);

  const [showImunisasiModal, setShowImunisasiModal] = useState(false);
  const [imunisasiForm, setImunisasiForm] = useState(emptyImunisasiForm);
  const [editingImunisasiId, setEditingImunisasiId] = useState(null);
  const [savingImunisasi, setSavingImunisasi] = useState(false);

  const [detailItem, setDetailItem] = useState(null);
  const [detailType, setDetailType] = useState(null);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importTarget, setImportTarget] = useState(null); // 'ckg' | 'imunisasi'
  const [importJenisPasien, setImportJenisPasien] = useState('siswa');
  const [importFile, setImportFile] = useState(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [uploadingImport, setUploadingImport] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const openImport = (target) => {
    setImportTarget(target);
    setImportJenisPasien('siswa');
    setImportFile(null);
    setImportResult(null);
    setShowImportModal(true);
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const response = await api.get(`/uks/${importTarget}/template`, {
        params: { jenis_pasien: importJenisPasien },
        responseType: 'blob',
      });
      const filename = `Template_${importTarget === 'ckg' ? 'CKG' : 'Imunisasi'}_${importJenisPasien}.xlsx`;
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('Gagal mengunduh template');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleUploadImport = async () => {
    if (!importFile) { toast.error('Pilih file terlebih dahulu'); return; }
    setUploadingImport(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      const { data } = await api.post(`/uks/${importTarget}/import-excel`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(data);
      if (data.success > 0) {
        toast.success(`${data.success} data berhasil diimpor`);
        loadData();
      }
      if (data.errors?.length) {
        toast.error(`${data.errors.length} baris gagal diimpor`);
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal mengimpor file');
    } finally {
      setUploadingImport(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ckgRes, imunisasiRes, classesRes] = await Promise.all([
        api.get('/uks/ckg'),
        api.get('/uks/imunisasi'),
        api.get('/classes'),
      ]);
      setCkgList(ckgRes.data || []);
      setImunisasiList(imunisasiRes.data || []);
      setClasses(classesRes.data || []);
    } catch (e) {
      toast.error('Gagal memuat data CKG dan imunisasi');
    } finally {
      setLoading(false);
    }
  };

  const tingkatOptions = [...new Set(classes.map((c) => c.grade).filter((g) => g !== undefined && g !== null))].sort((a, b) => a - b);

  const loadStudentsForClass = async (classId) => {
    if (!classId) { setStudents([]); return; }
    try {
      const { data } = await api.get('/students', { params: { class_id: classId } });
      setStudents(data || []);
    } catch (e) {
      toast.error('Gagal memuat data siswa');
    }
  };

  const loadGtkList = async (kategori) => {
    try {
      const { data } = await api.get('/uks/warga-madrasah', { params: { role: kategori } });
      setGtkList(data || []);
    } catch (e) {
      toast.error('Gagal memuat data GTK');
    }
  };

  const kelasOptionsFor = (form) => classes.filter((c) => String(c.grade) === String(form.tingkat));
  const pasienOptionsFor = (form) => (form.jenis_pasien === 'gtk' ? gtkList : students);

  // ===== CKG =====
  const openCreateCkg = () => {
    setCkgForm(emptyCkgForm);
    setEditingCkgId(null);
    setStudents([]);
    setShowCkgModal(true);
  };

  const openEditCkg = (item) => {
    setCkgForm({
      ...emptyCkgForm,
      jenis_pasien: item.pasien_roles?.includes('siswa') ? 'siswa' : 'gtk',
      pasien_id: item.pasien_id,
      tanggal: item.tanggal || emptyCkgForm.tanggal,
      tinggi_badan: item.tinggi_badan ?? '',
      berat_badan: item.berat_badan ?? '',
      tekanan_darah: item.tekanan_darah || '',
      nadi: item.nadi ?? '',
      suhu: item.suhu ?? '',
      spo2: item.spo2 ?? '',
      pemeriksaan_mata: item.pemeriksaan_mata || '',
      pemeriksaan_gigi: item.pemeriksaan_gigi || '',
      kesimpulan: item.kesimpulan || '',
      rekomendasi: item.rekomendasi || '',
      keterangan: item.keterangan || '',
    });
    setEditingCkgId(item.id);
    setShowCkgModal(true);
  };

  useEffect(() => {
    if (showCkgModal && ckgForm.jenis_pasien === 'gtk') loadGtkList(ckgForm.gtk_kategori);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCkgModal, ckgForm.jenis_pasien, ckgForm.gtk_kategori]);

  const handleSaveCkg = async () => {
    if (!ckgForm.pasien_id || !ckgForm.tanggal) {
      toast.error('Pasien dan tanggal wajib diisi');
      return;
    }
    setSavingCkg(true);
    try {
      const payload = {
        pasien_id: ckgForm.pasien_id,
        tanggal: ckgForm.tanggal,
        tinggi_badan: ckgForm.tinggi_badan ? Number(ckgForm.tinggi_badan) : null,
        berat_badan: ckgForm.berat_badan ? Number(ckgForm.berat_badan) : null,
        tekanan_darah: ckgForm.tekanan_darah || null,
        nadi: ckgForm.nadi ? Number(ckgForm.nadi) : null,
        suhu: ckgForm.suhu ? Number(ckgForm.suhu) : null,
        spo2: ckgForm.spo2 ? Number(ckgForm.spo2) : null,
        pemeriksaan_mata: ckgForm.pemeriksaan_mata || null,
        pemeriksaan_gigi: ckgForm.pemeriksaan_gigi || null,
        kesimpulan: ckgForm.kesimpulan || null,
        rekomendasi: ckgForm.rekomendasi || null,
        keterangan: ckgForm.keterangan || null,
      };
      if (editingCkgId) {
        await api.put(`/uks/ckg/${editingCkgId}`, payload);
        toast.success('Data CKG berhasil diperbarui');
      } else {
        await api.post('/uks/ckg', payload);
        toast.success('Data CKG berhasil disimpan');
      }
      setShowCkgModal(false);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan data CKG');
    } finally {
      setSavingCkg(false);
    }
  };

  const handleDeleteCkg = async (id) => {
    if (!(await confirmDialog('Yakin ingin menghapus data CKG ini?'))) return;
    try {
      await api.delete(`/uks/ckg/${id}`);
      toast.success('Data CKG dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data');
    }
  };

  // ===== IMUNISASI =====
  const openCreateImunisasi = () => {
    setImunisasiForm(emptyImunisasiForm);
    setEditingImunisasiId(null);
    setStudents([]);
    setShowImunisasiModal(true);
  };

  const openEditImunisasi = (item) => {
    setImunisasiForm({
      ...emptyImunisasiForm,
      jenis_pasien: item.pasien_roles?.includes('siswa') ? 'siswa' : 'gtk',
      pasien_id: item.pasien_id,
      tanggal: item.tanggal || emptyImunisasiForm.tanggal,
      jenis_vaksin: item.jenis_vaksin || '',
      dosis_ke: item.dosis_ke || '',
      petugas_pemberi: item.petugas_pemberi || '',
      efek_samping: item.efek_samping || '',
      keterangan: item.keterangan || '',
    });
    setEditingImunisasiId(item.id);
    setShowImunisasiModal(true);
  };

  useEffect(() => {
    if (showImunisasiModal && imunisasiForm.jenis_pasien === 'gtk') loadGtkList(imunisasiForm.gtk_kategori);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showImunisasiModal, imunisasiForm.jenis_pasien, imunisasiForm.gtk_kategori]);

  const handleSaveImunisasi = async () => {
    if (!imunisasiForm.pasien_id || !imunisasiForm.tanggal || !imunisasiForm.jenis_vaksin) {
      toast.error('Pasien, tanggal, dan jenis vaksin wajib diisi');
      return;
    }
    setSavingImunisasi(true);
    try {
      const payload = {
        pasien_id: imunisasiForm.pasien_id,
        tanggal: imunisasiForm.tanggal,
        jenis_vaksin: imunisasiForm.jenis_vaksin,
        dosis_ke: imunisasiForm.dosis_ke || null,
        petugas_pemberi: imunisasiForm.petugas_pemberi || null,
        efek_samping: imunisasiForm.efek_samping || null,
        keterangan: imunisasiForm.keterangan || null,
      };
      if (editingImunisasiId) {
        await api.put(`/uks/imunisasi/${editingImunisasiId}`, payload);
        toast.success('Data imunisasi berhasil diperbarui');
      } else {
        await api.post('/uks/imunisasi', payload);
        toast.success('Data imunisasi berhasil disimpan');
      }
      setShowImunisasiModal(false);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan data imunisasi');
    } finally {
      setSavingImunisasi(false);
    }
  };

  const handleDeleteImunisasi = async (id) => {
    if (!(await confirmDialog('Yakin ingin menghapus data imunisasi ini?'))) return;
    try {
      await api.delete(`/uks/imunisasi/${id}`);
      toast.success('Data imunisasi dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data');
    }
  };

  const filteredCkg = ckgList.filter((item) => !search || (item.pasien_nama || '').toLowerCase().includes(search.toLowerCase()));
  const filteredImunisasi = imunisasiList.filter((item) => !search || (item.pasien_nama || '').toLowerCase().includes(search.toLowerCase()) || (item.jenis_vaksin || '').toLowerCase().includes(search.toLowerCase()));

  const renderPatientPicker = (form, setForm) => (
    <>
      <div className="space-y-2">
        <Label>Jenis Pasien <span className="text-rose-500">*</span></Label>
        <div className="flex gap-3">
          <Button
            type="button" variant={form.jenis_pasien === 'siswa' ? 'default' : 'outline'}
            className={form.jenis_pasien === 'siswa' ? 'bg-[#006837] hover:bg-[#005830]' : ''}
            onClick={() => setForm({ ...form, jenis_pasien: 'siswa', tingkat: '', kelas_id: '', pasien_id: '' })}
          >
            Siswa
          </Button>
          <Button
            type="button" variant={form.jenis_pasien === 'gtk' ? 'default' : 'outline'}
            className={form.jenis_pasien === 'gtk' ? 'bg-[#006837] hover:bg-[#005830]' : ''}
            onClick={() => setForm({ ...form, jenis_pasien: 'gtk', tingkat: '', kelas_id: '', pasien_id: '' })}
          >
            GTK
          </Button>
        </div>
      </div>

      {form.jenis_pasien === 'gtk' ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Kategori GTK</Label>
            <Select value={form.gtk_kategori} onValueChange={(v) => setForm({ ...form, gtk_kategori: v, pasien_id: '' })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="guru">Guru</SelectItem>
                <SelectItem value="tenaga_kependidikan">Tenaga Kependidikan</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Nama <span className="text-rose-500">*</span></Label>
            <Select value={form.pasien_id || 'none'} onValueChange={(v) => setForm({ ...form, pasien_id: v === 'none' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Pilih Nama" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Pilih Nama</SelectItem>
                {pasienOptionsFor(form).map((w) => <SelectItem key={w.id} value={w.id}>{w.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Tingkat <span className="text-rose-500">*</span></Label>
            <Select
              value={form.tingkat || 'none'}
              onValueChange={(v) => {
                const tingkat = v === 'none' ? '' : v;
                setForm({ ...form, tingkat, kelas_id: '', pasien_id: '' });
                setStudents([]);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Pilih Tingkat" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Pilih Tingkat</SelectItem>
                {tingkatOptions.map((g) => <SelectItem key={g} value={String(g)}>Kelas {g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Kelas <span className="text-rose-500">*</span></Label>
            <Select
              value={form.kelas_id || 'none'}
              onValueChange={(v) => {
                const kelasId = v === 'none' ? '' : v;
                setForm({ ...form, kelas_id: kelasId, pasien_id: '' });
                loadStudentsForClass(kelasId);
              }}
              disabled={!form.tingkat}
            >
              <SelectTrigger><SelectValue placeholder="Pilih Kelas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Pilih Kelas</SelectItem>
                {kelasOptionsFor(form).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Nama Siswa <span className="text-rose-500">*</span></Label>
            <Select value={form.pasien_id || 'none'} onValueChange={(v) => setForm({ ...form, pasien_id: v === 'none' ? '' : v })} disabled={!form.kelas_id}>
              <SelectTrigger><SelectValue placeholder={form.kelas_id ? 'Pilih Siswa' : 'Pilih kelas dahulu'} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Pilih Siswa</SelectItem>
                {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-6" data-testid="admin-uks-ckg-page">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <HeartPulse className="h-3 w-3 mr-1" /> Menu UKS
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Data CKG</h1>
        <p className="text-sm text-slate-600 mt-1">Hasil Cek Kesehatan Gratis (CKG) dan data imunisasi</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white border border-slate-200">
          <TabsTrigger value="ckg"><HeartPulse className="h-4 w-4 mr-2" /> Cek Kesehatan ({ckgList.length})</TabsTrigger>
          <TabsTrigger value="imunisasi"><Syringe className="h-4 w-4 mr-2" /> Imunisasi ({imunisasiList.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="ckg" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="relative max-w-sm w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="Cari nama pasien..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => openImport('ckg')} className="gap-2"><Upload className="h-4 w-4" /> Import</Button>
                <Button onClick={openCreateCkg} className="gap-2 bg-[#006837] hover:bg-[#005830]"><Plus className="h-4 w-4" /> Tambah Data CKG</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" /><p className="text-slate-500">Memuat data...</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Pasien</TableHead>
                        <TableHead>TB/BB</TableHead>
                        <TableHead>Tensi</TableHead>
                        <TableHead>Kesimpulan</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCkg.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500">Belum ada data CKG</TableCell></TableRow>
                      ) : (
                        filteredCkg.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono">{item.tanggal}</TableCell>
                            <TableCell className="font-semibold">{item.pasien_nama}<div className="text-xs text-slate-500 font-normal">{item.pasien_identitas}</div></TableCell>
                            <TableCell className="font-mono">{item.tinggi_badan ?? '-'} cm / {item.berat_badan ?? '-'} kg</TableCell>
                            <TableCell className="font-mono">{item.tekanan_darah || '-'}</TableCell>
                            <TableCell className="max-w-xs"><div className="line-clamp-2">{item.kesimpulan || '-'}</div></TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button size="icon" variant="ghost" onClick={() => { setDetailItem(item); setDetailType('ckg'); }} className="text-blue-600 hover:text-blue-700"><Eye className="h-4 w-4" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => openEditCkg(item)} className="text-slate-600 hover:text-slate-700"><Pencil className="h-4 w-4" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => handleDeleteCkg(item.id)} className="text-rose-600 hover:text-rose-700"><Trash2 className="h-4 w-4" /></Button>
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

        <TabsContent value="imunisasi" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="relative max-w-sm w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="Cari nama pasien atau vaksin..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => openImport('imunisasi')} className="gap-2"><Upload className="h-4 w-4" /> Import</Button>
                <Button onClick={openCreateImunisasi} className="gap-2 bg-[#006837] hover:bg-[#005830]"><Plus className="h-4 w-4" /> Tambah Data Imunisasi</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" /><p className="text-slate-500">Memuat data...</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Pasien</TableHead>
                        <TableHead>Jenis Vaksin</TableHead>
                        <TableHead>Dosis</TableHead>
                        <TableHead>Petugas/Lokasi</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredImunisasi.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500">Belum ada data imunisasi</TableCell></TableRow>
                      ) : (
                        filteredImunisasi.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono">{item.tanggal}</TableCell>
                            <TableCell className="font-semibold">{item.pasien_nama}<div className="text-xs text-slate-500 font-normal">{item.pasien_identitas}</div></TableCell>
                            <TableCell>{item.jenis_vaksin}</TableCell>
                            <TableCell>{item.dosis_ke || '-'}</TableCell>
                            <TableCell>{item.petugas_pemberi || '-'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button size="icon" variant="ghost" onClick={() => { setDetailItem(item); setDetailType('imunisasi'); }} className="text-blue-600 hover:text-blue-700"><Eye className="h-4 w-4" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => openEditImunisasi(item)} className="text-slate-600 hover:text-slate-700"><Pencil className="h-4 w-4" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => handleDeleteImunisasi(item.id)} className="text-rose-600 hover:text-rose-700"><Trash2 className="h-4 w-4" /></Button>
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

      {/* CKG Modal */}
      <Dialog open={showCkgModal} onOpenChange={setShowCkgModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingCkgId ? 'Edit' : 'Tambah'} Data CKG</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            {renderPatientPicker(ckgForm, setCkgForm)}

            <div className="space-y-2">
              <Label>Tanggal <span className="text-rose-500">*</span></Label>
              <Input type="date" value={ckgForm.tanggal} onChange={(e) => setCkgForm({ ...ckgForm, tanggal: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-600">Pemeriksaan Vital</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-3 border border-slate-200 rounded-lg">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Tinggi Badan (cm)</Label>
                  <Input type="number" step="0.1" min="0" value={ckgForm.tinggi_badan} onChange={(e) => setCkgForm({ ...ckgForm, tinggi_badan: e.target.value })} placeholder="cm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Berat Badan (kg)</Label>
                  <Input type="number" step="0.1" min="0" value={ckgForm.berat_badan} onChange={(e) => setCkgForm({ ...ckgForm, berat_badan: e.target.value })} placeholder="kg" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Tekanan Darah</Label>
                  <Input value={ckgForm.tekanan_darah} onChange={(e) => setCkgForm({ ...ckgForm, tekanan_darah: e.target.value })} placeholder="120/80" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Nadi (bpm)</Label>
                  <Input type="number" min="0" value={ckgForm.nadi} onChange={(e) => setCkgForm({ ...ckgForm, nadi: e.target.value })} placeholder="bpm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Suhu (°C)</Label>
                  <Input type="number" step="0.1" min="0" value={ckgForm.suhu} onChange={(e) => setCkgForm({ ...ckgForm, suhu: e.target.value })} placeholder="°C" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">SpO2 (%)</Label>
                  <Input type="number" min="0" max="100" value={ckgForm.spo2} onChange={(e) => setCkgForm({ ...ckgForm, spo2: e.target.value })} placeholder="%" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pemeriksaan Mata</Label>
                <Input value={ckgForm.pemeriksaan_mata} onChange={(e) => setCkgForm({ ...ckgForm, pemeriksaan_mata: e.target.value })} placeholder="mis. Normal / Minus 1" />
              </div>
              <div className="space-y-2">
                <Label>Pemeriksaan Gigi</Label>
                <Input value={ckgForm.pemeriksaan_gigi} onChange={(e) => setCkgForm({ ...ckgForm, pemeriksaan_gigi: e.target.value })} placeholder="mis. Ada karies" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Kesimpulan</Label>
              <Textarea rows={2} value={ckgForm.kesimpulan} onChange={(e) => setCkgForm({ ...ckgForm, kesimpulan: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Rekomendasi</Label>
              <Textarea rows={2} value={ckgForm.rekomendasi} onChange={(e) => setCkgForm({ ...ckgForm, rekomendasi: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Keterangan</Label>
              <Textarea rows={2} value={ckgForm.keterangan} onChange={(e) => setCkgForm({ ...ckgForm, keterangan: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCkgModal(false)} disabled={savingCkg}>Batal</Button>
            <Button onClick={handleSaveCkg} disabled={savingCkg} className="gap-2 bg-[#006837] hover:bg-[#005830]">
              {savingCkg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {savingCkg ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Imunisasi Modal */}
      <Dialog open={showImunisasiModal} onOpenChange={setShowImunisasiModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingImunisasiId ? 'Edit' : 'Tambah'} Data Imunisasi</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            {renderPatientPicker(imunisasiForm, setImunisasiForm)}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tanggal <span className="text-rose-500">*</span></Label>
                <Input type="date" value={imunisasiForm.tanggal} onChange={(e) => setImunisasiForm({ ...imunisasiForm, tanggal: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Dosis / Tahap</Label>
                <Input value={imunisasiForm.dosis_ke} onChange={(e) => setImunisasiForm({ ...imunisasiForm, dosis_ke: e.target.value })} placeholder="mis. 1, 2, Booster" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Jenis Vaksin <span className="text-rose-500">*</span></Label>
              <Input value={imunisasiForm.jenis_vaksin} onChange={(e) => setImunisasiForm({ ...imunisasiForm, jenis_vaksin: e.target.value })} placeholder="mis. BIAS Campak, DT, Td" />
            </div>
            <div className="space-y-2">
              <Label>Petugas / Lokasi Pemberi</Label>
              <Input value={imunisasiForm.petugas_pemberi} onChange={(e) => setImunisasiForm({ ...imunisasiForm, petugas_pemberi: e.target.value })} placeholder="mis. Puskesmas Lowokwaru" />
            </div>
            <div className="space-y-2">
              <Label>Efek Samping</Label>
              <Textarea rows={2} value={imunisasiForm.efek_samping} onChange={(e) => setImunisasiForm({ ...imunisasiForm, efek_samping: e.target.value })} placeholder="Catatan reaksi pasca imunisasi (jika ada)" />
            </div>
            <div className="space-y-2">
              <Label>Keterangan</Label>
              <Textarea rows={2} value={imunisasiForm.keterangan} onChange={(e) => setImunisasiForm({ ...imunisasiForm, keterangan: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImunisasiModal(false)} disabled={savingImunisasi}>Batal</Button>
            <Button onClick={handleSaveImunisasi} disabled={savingImunisasi} className="gap-2 bg-[#006837] hover:bg-[#005830]">
              {savingImunisasi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {savingImunisasi ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Data {importTarget === 'ckg' ? 'CKG' : 'Imunisasi'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>1. Unduh Template</Label>
              <p className="text-xs text-slate-500">Template berisi daftar nama & kelas siswa aktif semester ini, atau daftar GTK aktif.</p>
              <div className="flex gap-2">
                <Select value={importJenisPasien} onValueChange={setImportJenisPasien}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="siswa">Siswa</SelectItem>
                    <SelectItem value="gtk">GTK</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={handleDownloadTemplate} disabled={downloadingTemplate} className="gap-2 flex-1">
                  {downloadingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Unduh Template
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>2. Unggah File yang Sudah Diisi</Label>
              <div className="flex items-center gap-2">
                <Input type="file" accept=".xlsx,.xlsm" onChange={(e) => { setImportFile(e.target.files?.[0] || null); setImportResult(null); }} className="flex-1" />
                {importFile && (
                  <Button size="icon" variant="ghost" onClick={() => setImportFile(null)} className="text-rose-600 shrink-0"><X className="h-4 w-4" /></Button>
                )}
              </div>
              {importFile && (
                <p className="text-xs text-slate-500 flex items-center gap-1"><FileSpreadsheet className="h-3.5 w-3.5" /> {importFile.name}</p>
              )}
            </div>

            {importResult && (
              <div className="rounded-lg border border-slate-200 p-3 text-sm space-y-1">
                <div className="text-emerald-700 font-semibold">{importResult.success} data berhasil diimpor</div>
                {importResult.errors?.length > 0 && (
                  <div className="text-rose-600">
                    <div className="font-semibold">{importResult.errors.length} baris gagal:</div>
                    <ul className="list-disc list-inside max-h-32 overflow-y-auto">
                      {importResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportModal(false)}>Tutup</Button>
            <Button onClick={handleUploadImport} disabled={!importFile || uploadingImport} className="gap-2 bg-[#006837] hover:bg-[#005830]">
              {uploadingImport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploadingImport ? 'Mengimpor...' : 'Impor Data'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={!!detailItem} onOpenChange={(v) => { if (!v) { setDetailItem(null); setDetailType(null); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detail {detailType === 'ckg' ? 'CKG' : 'Imunisasi'}</DialogTitle></DialogHeader>
          {detailItem && detailType === 'ckg' && (
            <div className="space-y-3 py-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-slate-500 block text-xs">Pasien</span>{detailItem.pasien_nama}</div>
                <div><span className="text-slate-500 block text-xs">Tanggal</span>{detailItem.tanggal}</div>
              </div>
              <div>
                <span className="text-slate-500 block text-xs mb-1">Pemeriksaan Vital</span>
                <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50 rounded-lg p-2">
                  <div><span className="text-slate-400 block">TB</span>{detailItem.tinggi_badan ?? '-'} cm</div>
                  <div><span className="text-slate-400 block">BB</span>{detailItem.berat_badan ?? '-'} kg</div>
                  <div><span className="text-slate-400 block">Tensi</span>{detailItem.tekanan_darah || '-'}</div>
                  <div><span className="text-slate-400 block">Nadi</span>{detailItem.nadi ?? '-'} bpm</div>
                  <div><span className="text-slate-400 block">Suhu</span>{detailItem.suhu ?? '-'} °C</div>
                  <div><span className="text-slate-400 block">SpO2</span>{detailItem.spo2 ?? '-'}%</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-slate-500 block text-xs">Mata</span>{detailItem.pemeriksaan_mata || '-'}</div>
                <div><span className="text-slate-500 block text-xs">Gigi</span>{detailItem.pemeriksaan_gigi || '-'}</div>
              </div>
              {detailItem.kesimpulan && <div><span className="text-slate-500 block text-xs">Kesimpulan</span>{detailItem.kesimpulan}</div>}
              {detailItem.rekomendasi && <div><span className="text-slate-500 block text-xs">Rekomendasi</span>{detailItem.rekomendasi}</div>}
              {detailItem.keterangan && <div><span className="text-slate-500 block text-xs">Keterangan</span>{detailItem.keterangan}</div>}
              <div className="text-xs text-slate-400 pt-2 border-t">Dicatat oleh {detailItem.petugas_nama}</div>
            </div>
          )}
          {detailItem && detailType === 'imunisasi' && (
            <div className="space-y-3 py-2 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-slate-500 block text-xs">Pasien</span>{detailItem.pasien_nama}</div>
                <div><span className="text-slate-500 block text-xs">Tanggal</span>{detailItem.tanggal}</div>
              </div>
              <div><span className="text-slate-500 block text-xs">Jenis Vaksin</span>{detailItem.jenis_vaksin}</div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-slate-500 block text-xs">Dosis / Tahap</span>{detailItem.dosis_ke || '-'}</div>
                <div><span className="text-slate-500 block text-xs">Petugas/Lokasi</span>{detailItem.petugas_pemberi || '-'}</div>
              </div>
              {detailItem.efek_samping && <div><span className="text-slate-500 block text-xs">Efek Samping</span>{detailItem.efek_samping}</div>}
              {detailItem.keterangan && <div><span className="text-slate-500 block text-xs">Keterangan</span>{detailItem.keterangan}</div>}
              <div className="text-xs text-slate-400 pt-2 border-t">Dicatat oleh {detailItem.petugas_nama}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
