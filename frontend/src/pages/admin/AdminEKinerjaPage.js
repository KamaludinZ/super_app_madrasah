import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus, Pencil, Trash2, Target, FileText, Search, Upload, Download,
  Lock, Unlock, Hand, X as XIcon, ClipboardList, FileSpreadsheet, Award, FileBadge, CalendarCheck,
  NotebookPen, Link2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

const EKINERJA_AUTHOR_ROLES = ['admin', 'kepala_sekolah', 'kepala_tata_usaha'];

const RHK_EMPTY_FORM = {
  year: new Date().getFullYear(),
  rhk_atasan: '',
  leading_sektor: '',
  aspek: '',
  indikator_kinerja_individu: '',
  target: '',
  satuan_hasil: '',
  target_kuantitas: '',
  target_kualitas: '',
  target_waktu: '',
  target_biaya: '',
  perilaku_kerja: [],
  bulan_berlaku: [],
  output_url: '',
};


export default function AdminEKinerjaPage() {
  const { user, activeRole } = useAuth();
  const isEkinerjaAuthor = EKINERJA_AUTHOR_ROLES.includes(activeRole);

  const [activeTab, setActiveTab] = useState('rhk');
  const [gtkList, setGtkList] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // RHK state
  const [rhkList, setRhkList] = useState([]);
  const [rhkMeta, setRhkMeta] = useState({ leading_sektor: [], perilaku_kerja: [], bulan: [] });
  const [rhkSektorFilter, setRhkSektorFilter] = useState('all');
  const [rhkClaimFilter, setRhkClaimFilter] = useState('all'); // all | claimed | open
  const [rhkOpen, setRhkOpen] = useState(false);
  const [rhkEditing, setRhkEditing] = useState(null);
  const [rhkForm, setRhkForm] = useState(RHK_EMPTY_FORM);
  const [rhkSubmitting, setRhkSubmitting] = useState(false);
  const [activeTahunTakwim, setActiveTahunTakwim] = useState(null);
  const [rhkImporting, setRhkImporting] = useState(false);
  const [rhkDownloadingTemplate, setRhkDownloadingTemplate] = useState(false);

  const activeYear = activeTahunTakwim?.year || new Date().getFullYear();
  const currentMonthName = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][new Date().getMonth()];

  // LCKB state
  const isEkinerjaAuthorLckb = EKINERJA_AUTHOR_ROLES.includes(activeRole);
  const [lckbSubTab, setLckbSubTab] = useState('isi');
  const [lckbMonth, setLckbMonth] = useState(currentMonthName);
  const [lckbMyRows, setLckbMyRows] = useState([]);
  const [lckbMyLoading, setLckbMyLoading] = useState(false);
  const [lckbSavingRhkId, setLckbSavingRhkId] = useState(null);
  const [lckbSummary, setLckbSummary] = useState([]);
  const [lckbSummaryLoading, setLckbSummaryLoading] = useState(false);
  const [lckbSelectedGtk, setLckbSelectedGtk] = useState(null); // { id, name } for author drill-down view
  const [lckbGtkRows, setLckbGtkRows] = useState([]);
  const [lckbDownloading, setLckbDownloading] = useState(false);

  const loadMyLckb = async (year, month) => {
    setLckbMyLoading(true);
    try {
      const { data } = await api.get('/ekinerja/lckb/my', { params: { year, month } });
      setLckbMyRows(data || []);
    } catch (e) {
      toast.error('Gagal memuat LCKB');
    } finally {
      setLckbMyLoading(false);
    }
  };

  const loadLckbSummary = async (year, month) => {
    setLckbSummaryLoading(true);
    try {
      const { data } = await api.get('/ekinerja/lckb', { params: { year, month } });
      setLckbSummary(data || []);
    } catch (e) {
      toast.error('Gagal memuat rekap LCKB');
    } finally {
      setLckbSummaryLoading(false);
    }
  };

  const loadLckbForGtk = async (gtkId, year, month) => {
    try {
      const { data } = await api.get('/ekinerja/lckb', { params: { year, month, gtk_id: gtkId } });
      setLckbGtkRows(data || []);
    } catch (e) {
      toast.error('Gagal memuat LCKB GTK ini');
    }
  };

  useEffect(() => {
    if (!lckbMonth) return;
    if (isEkinerjaAuthorLckb) {
      if (lckbSelectedGtk) {
        loadLckbForGtk(lckbSelectedGtk.id, activeYear, lckbMonth);
      } else {
        loadLckbSummary(activeYear, lckbMonth);
      }
    } else {
      loadMyLckb(activeYear, lckbMonth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lckbMonth, activeYear, isEkinerjaAuthorLckb, lckbSelectedGtk?.id]);

  const handleSaveLckbRealisasi = async (row, realisasi_volume, keterangan) => {
    setLckbSavingRhkId(row.rhk_id);
    try {
      await api.put('/ekinerja/lckb/realisasi', {
        rhk_id: row.rhk_id, year: activeYear, month: lckbMonth, realisasi_volume, keterangan,
      });
      toast.success('Realisasi berhasil disimpan');
      loadMyLckb(activeYear, lckbMonth);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan realisasi');
    } finally {
      setLckbSavingRhkId(null);
    }
  };

  const handleDownloadLckbPdf = async (gtkId) => {
    setLckbDownloading(true);
    try {
      const params = { year: activeYear, month: lckbMonth };
      if (gtkId) params.gtk_id = gtkId;
      const response = await api.get('/ekinerja/lckb/pdf', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `LCKB_${lckbMonth}_${activeYear}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal mengunduh PDF LCKB');
    } finally {
      setLckbDownloading(false);
    }
  };

  // Jurnal Harian state
  const isEkinerjaAuthorJurnal = EKINERJA_AUTHOR_ROLES.includes(activeRole);
  const [jurnalSubTab, setJurnalSubTab] = useState('link');

  const loadRhk = async (year) => {
    try {
      const [{ data: rhk }, { data: meta }] = await Promise.all([
        api.get('/ekinerja/rhk', { params: year ? { year } : {} }),
        api.get('/ekinerja/rhk/meta'),
      ]);
      setRhkList(rhk || []);
      setRhkMeta(meta || { leading_sektor: [], perilaku_kerja: [], bulan: [] });
    } catch (e) {
      toast.error('Gagal memuat data RHK');
    }
  };

  useEffect(() => {
    loadData();
    (async () => {
      try {
        const { data } = await api.get('/tahun-takwim/active');
        setActiveTahunTakwim(data);
        loadRhk(data?.year);
      } catch (e) {
        loadRhk();
      }
    })();
  }, []);

  const loadData = async () => {
    try {
      const { data: usersData } = await api.get('/users');
      const gtk = usersData.filter(u =>
        u.roles?.some(r => ['guru', 'wali_kelas', 'tenaga_kependidikan'].includes(r))
      );
      setGtkList(gtk);
    } catch (e) {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  // ===== RHK handlers =====
  const openCreateRhk = () => {
    setRhkEditing(null);
    setRhkForm({ ...RHK_EMPTY_FORM, year: activeYear });
    setRhkOpen(true);
  };

  const openEditRhk = (rhk) => {
    setRhkEditing(rhk);
    setRhkForm({
      year: rhk.year, rhk_atasan: rhk.rhk_atasan || '', leading_sektor: rhk.leading_sektor || '',
      aspek: rhk.aspek || '', indikator_kinerja_individu: rhk.indikator_kinerja_individu || '',
      target: rhk.target || '', satuan_hasil: rhk.satuan_hasil || '', target_kuantitas: rhk.target_kuantitas || '', target_kualitas: rhk.target_kualitas || '',
      target_waktu: rhk.target_waktu || '', target_biaya: rhk.target_biaya || '',
      perilaku_kerja: rhk.perilaku_kerja || [], bulan_berlaku: rhk.bulan_berlaku || [],
      output_url: rhk.output_url || '',
    });
    setRhkOpen(true);
  };

  const toggleRhkPerilaku = (p) => {
    setRhkForm((prev) => ({
      ...prev,
      perilaku_kerja: prev.perilaku_kerja.includes(p) ? prev.perilaku_kerja.filter((x) => x !== p) : [...prev.perilaku_kerja, p],
    }));
  };

  const toggleRhkBulan = (b) => {
    setRhkForm((prev) => ({
      ...prev,
      bulan_berlaku: prev.bulan_berlaku.includes(b) ? prev.bulan_berlaku.filter((x) => x !== b) : [...prev.bulan_berlaku, b],
    }));
  };

  const handleSubmitRhk = async () => {
    if (!rhk_required_ok()) return;
    setRhkSubmitting(true);
    try {
      const payload = { ...rhkForm, year: Number(rhkForm.year) };
      if (rhkEditing) {
        await api.put(`/ekinerja/rhk/${rhkEditing.id}`, payload);
        toast.success('RHK berhasil diperbarui');
      } else {
        await api.post('/ekinerja/rhk', payload);
        toast.success('RHK berhasil ditambahkan');
      }
      setRhkOpen(false);
      loadRhk(activeYear);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan RHK');
    } finally {
      setRhkSubmitting(false);
    }
  };

  function rhk_required_ok() {
    if (!rhkForm.rhk_atasan || !rhkForm.leading_sektor || !rhkForm.indikator_kinerja_individu) {
      toast.error('RHK Atasan, Leading Sektor, dan Indikator Kinerja Individu wajib diisi');
      return false;
    }
    return true;
  }

  const handleDeleteRhk = async (rhk) => {
    if (!window.confirm(`Hapus RHK "${rhk.indikator_kinerja_individu}"?`)) return;
    try {
      await api.delete(`/ekinerja/rhk/${rhk.id}`);
      toast.success('RHK berhasil dihapus');
      loadRhk(activeYear);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus RHK');
    }
  };

  const handleToggleLockRhk = async (rhk) => {
    try {
      await api.put(`/ekinerja/rhk/${rhk.id}/${rhk.is_locked ? 'unlock' : 'lock'}`);
      toast.success(rhk.is_locked ? 'RHK dibuka kembali' : 'RHK dikunci');
      loadRhk(activeYear);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal mengubah status kunci RHK');
    }
  };

  const handleClaimRhk = async (rhk) => {
    try {
      await api.put(`/ekinerja/rhk/${rhk.id}/claim`);
      toast.success('RHK berhasil diambil');
      loadRhk(activeYear);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal mengambil RHK');
    }
  };

  const handleUnclaimRhk = async (rhk) => {
    if (!window.confirm('Lepaskan RHK ini?')) return;
    try {
      await api.put(`/ekinerja/rhk/${rhk.id}/unclaim`);
      toast.success('RHK berhasil dilepaskan');
      loadRhk(activeYear);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal melepas RHK');
    }
  };

  const handleDownloadRhkTemplate = async (filled) => {
    setRhkDownloadingTemplate(true);
    try {
      const response = await api.get(filled ? '/ekinerja/rhk/template-filled' : '/ekinerja/rhk/template', {
        params: filled ? { year: activeYear } : {},
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filled ? `Template_RHK_Data_${activeYear}.xlsx` : 'Template_RHK_Kosong.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Template berhasil diunduh');
    } catch (e) {
      toast.error('Gagal mengunduh template: ' + (e?.response?.data?.detail || e.message));
    } finally {
      setRhkDownloadingTemplate(false);
    }
  };

  const handleImportRhkExcel = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';

    setRhkImporting(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await api.post('/ekinerja/rhk/import-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`Import selesai: ${data.created} baru, ${data.updated} diperbarui${data.skipped ? `, ${data.skipped} dilewati` : ''}`);
      loadRhk(activeYear);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal mengimpor file Excel');
    } finally {
      setRhkImporting(false);
    }
  };

  const filteredRhk = rhkList.filter((r) => {
    if (rhkSektorFilter !== 'all' && r.leading_sektor !== rhkSektorFilter) return false;
    if (rhkClaimFilter === 'claimed' && !r.claimed_by) return false;
    if (rhkClaimFilter === 'open' && r.claimed_by) return false;
    if (search) {
      const s = search.toLowerCase();
      return (r.indikator_kinerja_individu || '').toLowerCase().includes(s) ||
             (r.rhk_atasan || '').toLowerCase().includes(s) ||
             (r.claimed_by_name || '').toLowerCase().includes(s);
    }
    return true;
  });


  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <Target className="h-3 w-3 mr-1" /> E-Kinerja GTK
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">E-Kinerja GTK</h1>
          <p className="text-sm text-slate-600 mt-1">Manajemen SKP dan LCKB Guru & Tenaga Kependidikan</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border border-slate-200 flex-wrap h-auto">
          <TabsTrigger value="rhk" className="gap-2">
            <ClipboardList className="h-4 w-4" /> RHK (Rencana Hasil Kerja)
          </TabsTrigger>
          <TabsTrigger value="skp" className="gap-2">
            <Target className="h-4 w-4" /> SKP (Sasaran Kinerja Pegawai)
          </TabsTrigger>
          <TabsTrigger value="lckb" className="gap-2">
            <FileText className="h-4 w-4" /> LCKB (Laporan Capaian Kinerja Bulanan)
          </TabsTrigger>
          <TabsTrigger value="angka_kredit" className="gap-2">
            <Award className="h-4 w-4" /> Angka Kredit
          </TabsTrigger>
          <TabsTrigger value="pak" className="gap-2">
            <FileBadge className="h-4 w-4" /> PAK
          </TabsTrigger>
          <TabsTrigger value="absensi" className="gap-2">
            <CalendarCheck className="h-4 w-4" /> Absensi
          </TabsTrigger>
          <TabsTrigger value="jurnal_harian" className="gap-2">
            <NotebookPen className="h-4 w-4" /> Jurnal Harian
          </TabsTrigger>
        </TabsList>

        {/* TAB RHK */}
        <TabsContent value="rhk" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">Tahun Takwim Aktif: {activeYear}</Badge>
                </div>
                {isEkinerjaAuthor && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={rhkDownloadingTemplate}
                      onClick={() => handleDownloadRhkTemplate(false)}
                    >
                      <Download className="h-3.5 w-3.5" /> Template Kosong
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={rhkDownloadingTemplate}
                      onClick={() => handleDownloadRhkTemplate(true)}
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" /> Template Berisi Data {activeYear}
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" disabled={rhkImporting} asChild>
                      <label className="cursor-pointer">
                        <Upload className="h-3.5 w-3.5" /> {rhkImporting ? 'Mengimpor...' : 'Import Excel'}
                        <input type="file" accept=".xlsx" className="hidden" onChange={handleImportRhkExcel} disabled={rhkImporting} />
                      </label>
                    </Button>
                  </div>
                )}
              </div>

              <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Cari indikator, RHK atasan, atau nama pengambil..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={rhkSektorFilter} onValueChange={setRhkSektorFilter}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="Leading Sektor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Leading Sektor</SelectItem>
                      {rhkMeta.leading_sektor.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={rhkClaimFilter} onValueChange={setRhkClaimFilter}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Status</SelectItem>
                      <SelectItem value="open">Belum Diambil</SelectItem>
                      <SelectItem value="claimed">Sudah Diambil</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {isEkinerjaAuthor && (
                  <Button onClick={openCreateRhk} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2">
                    <Plus className="h-4 w-4" /> Tambah RHK
                  </Button>
                )}
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tahun</TableHead>
                      <TableHead>Leading Sektor</TableHead>
                      <TableHead>Indikator Kinerja Individu</TableHead>
                      <TableHead>RHK Atasan</TableHead>
                      <TableHead>Bulan Berlaku</TableHead>
                      <TableHead>Diambil Oleh</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRhk.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                          Belum ada data RHK untuk tahun {activeYear}{isEkinerjaAuthor ? '. Klik "Tambah RHK" atau import Excel untuk membuat data baru.' : '.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRhk.map((rhk) => {
                        const isMine = rhk.claimed_by === user?.id;
                        return (
                          <TableRow key={rhk.id}>
                            <TableCell className="text-sm font-medium">{rhk.year}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{rhk.leading_sektor}</Badge></TableCell>
                            <TableCell className="max-w-xs">
                              <div className="font-medium text-sm">{rhk.indikator_kinerja_individu}</div>
                              {rhk.aspek && <div className="text-xs text-slate-500">Aspek: {rhk.aspek}</div>}
                              {rhk.output_url && (
                                <a href={rhk.output_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Lihat Output Dokumen</a>
                              )}
                            </TableCell>
                            <TableCell className="text-sm max-w-xs">{rhk.rhk_atasan}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1 max-w-[160px]">
                                {(rhk.bulan_berlaku || []).map((b) => (
                                  <Badge key={b} variant="secondary" className="text-[10px]">{b.slice(0, 3)}</Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {rhk.claimed_by_name || <span className="italic text-slate-400">Belum diambil</span>}
                            </TableCell>
                            <TableCell>
                              {rhk.is_locked ? (
                                <Badge className="bg-slate-200 text-slate-700 gap-1"><Lock className="h-3 w-3" /> Terkunci</Badge>
                              ) : rhk.claimed_by ? (
                                <Badge className="bg-blue-100 text-blue-700">Diambil</Badge>
                              ) : (
                                <Badge className="bg-emerald-100 text-emerald-700">Tersedia</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1 flex-wrap">
                                {!isEkinerjaAuthor && !rhk.is_locked && !rhk.claimed_by && (
                                  <Button size="sm" variant="outline" onClick={() => handleClaimRhk(rhk)} className="gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50">
                                    <Hand className="h-3.5 w-3.5" /> Ambil
                                  </Button>
                                )}
                                {isMine && (
                                  <Button size="sm" variant="outline" onClick={() => handleUnclaimRhk(rhk)} className="gap-1 text-amber-700 border-amber-300 hover:bg-amber-50">
                                    <XIcon className="h-3.5 w-3.5" /> Lepas
                                  </Button>
                                )}
                                {isEkinerjaAuthor && (
                                  <>
                                    <Button size="icon" variant="ghost" onClick={() => handleToggleLockRhk(rhk)} title={rhk.is_locked ? 'Buka Kunci' : 'Kunci'}>
                                      {rhk.is_locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                                    </Button>
                                    <Button size="icon" variant="ghost" onClick={() => openEditRhk(rhk)}><Pencil className="h-4 w-4" /></Button>
                                    <Button size="icon" variant="ghost" onClick={() => handleDeleteRhk(rhk)} className="text-rose-600"><Trash2 className="h-4 w-4" /></Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB SKP */}
        <TabsContent value="skp" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <PengumpulanPanel
                type="skp"
                year={activeYear}
                isAuthor={isEkinerjaAuthor}
                periodOptions={null}
                label="SKP"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB ANGKA KREDIT */}
        <TabsContent value="angka_kredit" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-3">Pendataan upload dokumen Angka Kredit dari MyASN e-Kinerja (untuk GTK berstatus PNS/PPPK).</p>
              <PengumpulanPanel
                type="angka_kredit"
                year={activeYear}
                isAuthor={isEkinerjaAuthor}
                periodOptions={null}
                metaKey="quarterly_periods"
                label="Angka Kredit"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB PAK */}
        <TabsContent value="pak" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-3">Pendataan upload dokumen PAK (Pengajuan Angka Kredit) dari MyASN e-Kinerja (untuk GTK berstatus PNS/PPPK).</p>
              <PengumpulanPanel
                type="pak"
                year={activeYear}
                isAuthor={isEkinerjaAuthor}
                periodOptions={null}
                metaKey="quarterly_periods"
                label="PAK"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB ABSENSI */}
        <TabsContent value="absensi" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-slate-500 mb-3">Pendataan upload PDF absensi bulanan GTK (link eksternal, terpisah dari sistem presensi harian).</p>
              <PengumpulanPanel
                type="absensi"
                year={activeYear}
                isAuthor={isEkinerjaAuthor}
                periodOptions={rhkMeta.bulan}
                label="Absensi"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB JURNAL HARIAN */}
        <TabsContent value="jurnal_harian" className="mt-4">
          {isEkinerjaAuthorJurnal ? (
            <Card>
              <CardContent className="p-4">
                <JurnalHarianAdminView />
              </CardContent>
            </Card>
          ) : (
            <Tabs value={jurnalSubTab} onValueChange={setJurnalSubTab}>
              <TabsList className="bg-white border border-slate-200">
                <TabsTrigger value="link" className="gap-2"><Link2 className="h-3.5 w-3.5" /> Link Bukti Dukung</TabsTrigger>
                <TabsTrigger value="isi" className="gap-2"><NotebookPen className="h-3.5 w-3.5" /> Isi Jurnal</TabsTrigger>
              </TabsList>
              <TabsContent value="link" className="mt-4">
                <Card>
                  <CardContent className="p-4">
                    <JurnalLinkManager />
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="isi" className="mt-4">
                <Card>
                  <CardContent className="p-4">
                    <JurnalHarianForm />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </TabsContent>

        {/* TAB LCKB */}
        <TabsContent value="lckb" className="mt-4">
          <Tabs value={lckbSubTab} onValueChange={setLckbSubTab}>
            <TabsList className="bg-white border border-slate-200">
              <TabsTrigger value="isi">Isi LCKB</TabsTrigger>
              <TabsTrigger value="upload">Upload PDF LCKB</TabsTrigger>
            </TabsList>

            <TabsContent value="isi" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-xs">Tahun Takwim Aktif: {activeYear}</Badge>
                      <Select value={lckbMonth} onValueChange={(v) => { setLckbMonth(v); setLckbSelectedGtk(null); }}>
                        <SelectTrigger className="w-40"><SelectValue placeholder="Pilih bulan..." /></SelectTrigger>
                        <SelectContent>
                          {rhkMeta.bulan.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {isEkinerjaAuthorLckb && lckbSelectedGtk && (
                        <Button variant="outline" size="sm" onClick={() => setLckbSelectedGtk(null)}>&larr; Kembali ke Rekap</Button>
                      )}
                    </div>
                    {(!isEkinerjaAuthorLckb || lckbSelectedGtk) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={lckbDownloading}
                        onClick={() => handleDownloadLckbPdf(lckbSelectedGtk?.id)}
                      >
                        <Download className="h-3.5 w-3.5" /> {lckbDownloading ? 'Mengunduh...' : 'Unduh PDF'}
                      </Button>
                    )}
                  </div>

                  {/* Author view: summary of all GTK, or drill-down into one GTK's LCKB (read-only) */}
                  {isEkinerjaAuthorLckb && !lckbSelectedGtk && (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>GTK</TableHead>
                            <TableHead>Jumlah RHK Bulan Ini</TableHead>
                            <TableHead>Sudah Diisi Realisasi</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lckbSummaryLoading ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-500">Memuat data...</TableCell></TableRow>
                          ) : lckbSummary.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-500">Belum ada GTK yang mengambil RHK untuk bulan {lckbMonth} {activeYear}.</TableCell></TableRow>
                          ) : (
                            lckbSummary.map((s) => (
                              <TableRow key={s.gtk_id}>
                                <TableCell className="font-medium">{s.gtk_name}</TableCell>
                                <TableCell>{s.total_rhk}</TableCell>
                                <TableCell>
                                  <Badge className={s.total_filled >= s.total_rhk ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
                                    {s.total_filled} / {s.total_rhk}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button size="sm" variant="outline" onClick={() => setLckbSelectedGtk({ id: s.gtk_id, name: s.gtk_name })}>Lihat Detail</Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {isEkinerjaAuthorLckb && lckbSelectedGtk && (
                    <div className="overflow-x-auto">
                      <div className="px-4 pt-3 text-sm font-semibold text-slate-700">LCKB: {lckbSelectedGtk.name} — {lckbMonth} {activeYear}</div>
                      <LckbTable rows={lckbGtkRows} readOnly />
                    </div>
                  )}

                  {/* Own GTK view: fill in realisasi per RHK line item */}
                  {!isEkinerjaAuthorLckb && (
                    <div className="overflow-x-auto">
                      {lckbMyLoading ? (
                        <div className="text-center py-8 text-slate-500">Memuat data...</div>
                      ) : (
                        <LckbTable rows={lckbMyRows} onSave={handleSaveLckbRealisasi} savingRhkId={lckbSavingRhkId} />
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="upload" className="mt-4">
              <Card>
                <CardContent className="p-4">
                  <PengumpulanPanel
                    type="lckb"
                    year={activeYear}
                    isAuthor={isEkinerjaAuthorLckb}
                    periodOptions={rhkMeta.bulan}
                    label="LCKB"
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      {/* Dialog untuk RHK */}
      <Dialog open={rhkOpen} onOpenChange={setRhkOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{rhkEditing ? 'Edit RHK' : 'Tambah RHK Baru'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tahun</Label>
                <Input type="number" value={rhkForm.year} onChange={(e) => setRhkForm({ ...rhkForm, year: e.target.value })} />
              </div>
              <div>
                <Label>Leading Sektor *</Label>
                <Select value={rhkForm.leading_sektor || undefined} onValueChange={(v) => setRhkForm({ ...rhkForm, leading_sektor: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih leading sektor..." /></SelectTrigger>
                  <SelectContent>
                    {rhkMeta.leading_sektor.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Rencana Hasil Kerja Atasan *</Label>
              <Textarea value={rhkForm.rhk_atasan} onChange={(e) => setRhkForm({ ...rhkForm, rhk_atasan: e.target.value })} rows={2} placeholder="RHK atasan yang menjadi acuan/turunan RHK ini" />
            </div>

            <div>
              <Label>Aspek</Label>
              <Input value={rhkForm.aspek} onChange={(e) => setRhkForm({ ...rhkForm, aspek: e.target.value })} placeholder="Mis. Kualitas, Kuantitas" />
            </div>

            <div>
              <Label>Indikator Kinerja Individu *</Label>
              <Textarea value={rhkForm.indikator_kinerja_individu} onChange={(e) => setRhkForm({ ...rhkForm, indikator_kinerja_individu: e.target.value })} rows={2} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Target</Label>
                <Input value={rhkForm.target} onChange={(e) => setRhkForm({ ...rhkForm, target: e.target.value })} placeholder="Mis. 12 bulan" />
              </div>
              <div>
                <Label>Satuan Hasil (untuk LCKB)</Label>
                <Input value={rhkForm.satuan_hasil} onChange={(e) => setRhkForm({ ...rhkForm, satuan_hasil: e.target.value })} placeholder="Mis. Dokumen dan Laporan" />
              </div>
              <div>
                <Label>Target Biaya (Rp)</Label>
                <Input value={rhkForm.target_biaya} onChange={(e) => setRhkForm({ ...rhkForm, target_biaya: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Target Kuantitas</Label>
                <Input value={rhkForm.target_kuantitas} onChange={(e) => setRhkForm({ ...rhkForm, target_kuantitas: e.target.value })} placeholder="Mis. 100%" />
              </div>
              <div>
                <Label>Target Kualitas</Label>
                <Input value={rhkForm.target_kualitas} onChange={(e) => setRhkForm({ ...rhkForm, target_kualitas: e.target.value })} placeholder="Mis. Baik" />
              </div>
              <div>
                <Label>Target Waktu</Label>
                <Input value={rhkForm.target_waktu} onChange={(e) => setRhkForm({ ...rhkForm, target_waktu: e.target.value })} placeholder="Mis. 12 bulan" />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Perilaku Kerja</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 border border-slate-200 rounded-lg">
                {rhkMeta.perilaku_kerja.map((p) => (
                  <label key={p} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={rhkForm.perilaku_kerja.includes(p)} onCheckedChange={() => toggleRhkPerilaku(p)} />
                    {p}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Bulan Berlaku (uraian tugas/rencana aksi muncul di LCKB bulan ini)</Label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-3 border border-slate-200 rounded-lg">
                {rhkMeta.bulan.map((b) => (
                  <label key={b} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={rhkForm.bulan_berlaku.includes(b)} onCheckedChange={() => toggleRhkBulan(b)} />
                    {b}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label>Output Dokumen/Data (URL)</Label>
              <Input value={rhkForm.output_url} onChange={(e) => setRhkForm({ ...rhkForm, output_url: e.target.value })} placeholder="Mis. tautan Google Drive bukti dukung" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRhkOpen(false)} disabled={rhkSubmitting}>Batal</Button>
            <Button onClick={handleSubmitRhk} disabled={rhkSubmitting} className="bg-[#006837] hover:bg-[#0B7A3B]">
              {rhkSubmitting ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function LckbTable({ rows, onSave, savingRhkId, readOnly }) {
  const [drafts, setDrafts] = useState({});

  const getDraft = (row) => drafts[row.rhk_id] || { realisasi_volume: row.realisasi_volume ?? '', keterangan: row.keterangan ?? '' };
  const setDraft = (rhkId, patch) => setDrafts((prev) => ({ ...prev, [rhkId]: { ...getDraftById(rhkId), ...patch } }));
  const getDraftById = (rhkId) => {
    const row = rows.find((r) => r.rhk_id === rhkId);
    return drafts[rhkId] || { realisasi_volume: row?.realisasi_volume ?? '', keterangan: row?.keterangan ?? '' };
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">NO</TableHead>
          <TableHead>Uraian Tugas / Program</TableHead>
          <TableHead className="w-24">Volume</TableHead>
          <TableHead className="w-40">Satuan</TableHead>
          <TableHead>Bukti Dukung</TableHead>
          <TableHead>Keterangan</TableHead>
          {!readOnly && <TableHead className="text-right">Aksi</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={readOnly ? 6 : 7} className="text-center py-8 text-slate-500">
              Belum ada RHK yang diambil untuk bulan ini.
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row, idx) => {
            const draft = getDraft(row);
            return (
              <TableRow key={row.rhk_id}>
                <TableCell className="text-sm">{idx + 1}</TableCell>
                <TableCell className="max-w-sm">
                  <div className="text-sm font-medium">{row.indikator_kinerja_individu}</div>
                  <div className="text-xs text-slate-500">{row.leading_sektor}</div>
                </TableCell>
                <TableCell>
                  {readOnly ? (
                    row.realisasi_volume ?? '0'
                  ) : (
                    <Input
                      className="w-20"
                      value={draft.realisasi_volume}
                      onChange={(e) => setDraft(row.rhk_id, { realisasi_volume: e.target.value })}
                      placeholder="0"
                    />
                  )}
                </TableCell>
                <TableCell className="text-sm">{row.satuan_hasil || '-'}</TableCell>
                <TableCell className="max-w-[160px]">
                  {row.output_url ? (
                    <a href={row.output_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline break-all">Lihat Dokumen</a>
                  ) : <span className="text-xs text-slate-400">-</span>}
                </TableCell>
                <TableCell>
                  {readOnly ? (
                    <span className="text-sm">{row.keterangan || '-'}</span>
                  ) : (
                    <Input
                      value={draft.keterangan}
                      onChange={(e) => setDraft(row.rhk_id, { keterangan: e.target.value })}
                      placeholder="Keterangan (opsional)"
                    />
                  )}
                </TableCell>
                {!readOnly && (
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      disabled={savingRhkId === row.rhk_id}
                      onClick={() => onSave(row, draft.realisasi_volume, draft.keterangan)}
                      className="bg-[#006837] hover:bg-[#0B7A3B]"
                    >
                      {savingRhkId === row.rhk_id ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}

const CURRENT_QUARTER = `TW${Math.floor(new Date().getMonth() / 3) + 1}`;
const CURRENT_MONTH_NAME = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][new Date().getMonth()];

// Generic "link pengumpulan + tracking upload" panel: dipakai untuk SKP
// (per triwulan) dan LCKB (per bulan), dan bisa dipakai lagi untuk Absensi.
// periodOptions null => pakai daftar triwulan dari backend (/ekinerja/pengumpulan/meta);
// periodOptions array of month strings => pakai bulan yang diberikan langsung.
export function PengumpulanPanel({
  type, year, isAuthor, periodOptions, label, metaKey = 'skp_periods',
  period: controlledPeriod, onPeriodChange, hidePeriodSelector = false,
}) {
  const isMonthly = Array.isArray(periodOptions);
  const [quarterOptions, setQuarterOptions] = useState([]);
  const [internalPeriod, setInternalPeriod] = useState(isMonthly ? CURRENT_MONTH_NAME : CURRENT_QUARTER);
  const period = controlledPeriod !== undefined ? controlledPeriod : internalPeriod;
  const setPeriod = onPeriodChange || setInternalPeriod;
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [linkDraft, setLinkDraft] = useState('');
  const [savingLink, setSavingLink] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!isMonthly) {
      api.get('/ekinerja/pengumpulan/meta').then(({ data }) => setQuarterOptions(data[metaKey] || [])).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMonthly, metaKey]);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/ekinerja/pengumpulan/status', { params: { type, year, period } });
      setStatus(data);
      setLinkDraft(data.link_url || '');
    } catch (e) {
      toast.error(`Gagal memuat status pengumpulan ${label}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (period) loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, year, period]);

  const handleSaveLink = async () => {
    if (!linkDraft.trim()) {
      toast.error('Link upload wajib diisi');
      return;
    }
    setSavingLink(true);
    try {
      await api.put('/ekinerja/pengumpulan/link', { type, year, period, link_url: linkDraft.trim() });
      toast.success(`Link pengumpulan ${label} berhasil disimpan`);
      loadStatus();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan link');
    } finally {
      setSavingLink(false);
    }
  };

  const handleConfirm = async (confirm) => {
    setConfirming(true);
    try {
      if (confirm) {
        await api.put('/ekinerja/pengumpulan/confirm', null, { params: { type, year, period } });
        toast.success(`Konfirmasi upload ${label} berhasil disimpan`);
      } else {
        await api.delete('/ekinerja/pengumpulan/confirm', { params: { type, year, period } });
        toast.success(`Konfirmasi upload ${label} dibatalkan`);
      }
      loadStatus();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan konfirmasi');
    } finally {
      setConfirming(false);
    }
  };

  const periodLabel = isMonthly ? period : (quarterOptions.find((p) => p.value === period)?.label || period);

  return (
    <div className="space-y-4">
      {!hidePeriodSelector && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">Tahun Takwim Aktif: {year}</Badge>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-56"><SelectValue placeholder={isMonthly ? 'Pilih bulan...' : 'Pilih triwulan...'} /></SelectTrigger>
            <SelectContent>
              {isMonthly
                ? periodOptions.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)
                : quarterOptions.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {isAuthor && (
        <div className="flex flex-wrap items-end gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50">
          <div className="flex-1 min-w-[240px]">
            <Label className="text-xs">Link Upload PDF {label} {periodLabel} {year}</Label>
            <Input
              value={linkDraft}
              onChange={(e) => setLinkDraft(e.target.value)}
              placeholder={`Mis. tautan Google Form / Google Drive untuk upload PDF ${label}`}
            />
          </div>
          <Button onClick={handleSaveLink} disabled={savingLink} className="bg-[#006837] hover:bg-[#0B7A3B]">
            {savingLink ? 'Menyimpan...' : 'Simpan Link'}
          </Button>
        </div>
      )}

      {!isAuthor && (
        <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-slate-900">Upload PDF {label} {periodLabel} {year}</div>
            {status?.link_url ? (
              <a href={status.link_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all">{status.link_url}</a>
            ) : (
              <div className="text-sm text-slate-500 italic">Link upload belum disiapkan oleh admin/KTU untuk periode ini.</div>
            )}
          </div>
          {status?.link_url && (
            status?.sudah_upload ? (
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-100 text-emerald-700">Sudah Upload</Badge>
                <Button size="sm" variant="outline" disabled={confirming} onClick={() => handleConfirm(false)}>Batalkan</Button>
              </div>
            ) : (
              <Button size="sm" disabled={confirming} onClick={() => handleConfirm(true)} className="bg-[#006837] hover:bg-[#0B7A3B]">
                {confirming ? 'Menyimpan...' : 'Sudah Upload'}
              </Button>
            )
          )}
        </div>
      )}

      {isAuthor && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>GTK</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Waktu Konfirmasi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={3} className="text-center py-8 text-slate-500">Memuat data...</TableCell></TableRow>
              ) : (status?.rekap || []).length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center py-8 text-slate-500">Belum ada data GTK.</TableCell></TableRow>
              ) : (
                status.rekap.map((r) => (
                  <TableRow key={r.gtk_id}>
                    <TableCell className="font-medium">{r.gtk_name}</TableCell>
                    <TableCell>
                      {r.sudah_upload ? (
                        <Badge className="bg-emerald-100 text-emerald-700">Sudah Upload</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700">Belum Upload</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">{r.confirmed_at ? new Date(r.confirmed_at).toLocaleString('id-ID') : '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {status && (
            <div className="px-1 pt-1 text-xs text-slate-500">
              {status.total_confirmed} dari {status.total_gtk} GTK sudah upload.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const JURNAL_LINK_EMPTY_FORM = { label: '', url: '' };
const JURNAL_ENTRY_EMPTY_FORM = { uraian_kegiatan: '', volume: '', satuan_hasil: '', link_id: '' };

function JurnalLinkManager() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(JURNAL_LINK_EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/ekinerja/jurnal-harian/link');
      setLinks(data || []);
    } catch (e) {
      toast.error('Gagal memuat daftar link');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(JURNAL_LINK_EMPTY_FORM); setOpen(true); };
  const openEdit = (l) => { setEditing(l); setForm({ label: l.label, url: l.url }); setOpen(true); };

  const handleSubmit = async () => {
    if (!form.label.trim() || !form.url.trim()) {
      toast.error('Label dan URL wajib diisi');
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await api.put(`/ekinerja/jurnal-harian/link/${editing.id}`, form);
        toast.success('Link berhasil diperbarui');
      } else {
        await api.post('/ekinerja/jurnal-harian/link', form);
        toast.success('Link berhasil ditambahkan');
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan link');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (l) => {
    if (!window.confirm(`Hapus link "${l.label}"?`)) return;
    try {
      await api.delete(`/ekinerja/jurnal-harian/link/${l.id}`);
      toast.success('Link berhasil dihapus');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus link');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">Siapkan link penampung dokumen/foto (mis. folder Google Drive) sesuai kategori kegiatan Anda, agar bisa dipilih langsung saat mengisi jurnal harian tanpa mengetik ulang.</p>
        <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2 shrink-0 ml-3">
          <Plus className="h-4 w-4" /> Tambah Link
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>URL</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-slate-500">Memuat data...</TableCell></TableRow>
            ) : links.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-slate-500">Belum ada link. Klik "Tambah Link" untuk membuat yang pertama.</TableCell></TableRow>
            ) : (
              links.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.label}</TableCell>
                  <TableCell className="max-w-xs truncate">
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">{l.url}</a>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(l)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(l)} className="text-rose-600"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Link' : 'Tambah Link Baru'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Label *</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Mis. Dokumentasi Rapat, Laporan Piket" />
            </div>
            <div>
              <Label>URL *</Label>
              <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="Tautan folder Google Drive / dokumen" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Batal</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="bg-[#006837] hover:bg-[#0B7A3B]">
              {submitting ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function JurnalHarianForm() {
  const [links, setLinks] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(JURNAL_ENTRY_EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: linkData }, { data: entryData }] = await Promise.all([
        api.get('/ekinerja/jurnal-harian/link'),
        api.get('/ekinerja/jurnal-harian/my'),
      ]);
      setLinks(linkData || []);
      setEntries(entryData || []);
    } catch (e) {
      toast.error('Gagal memuat jurnal harian');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(JURNAL_ENTRY_EMPTY_FORM); setOpen(true); };
  const openEdit = (e) => { setEditing(e); setForm({ uraian_kegiatan: e.uraian_kegiatan, volume: e.volume || '', satuan_hasil: e.satuan_hasil || '', link_id: e.link_id || '' }); setOpen(true); };

  const handleSubmit = async () => {
    if (!form.uraian_kegiatan.trim()) {
      toast.error('Uraian kegiatan wajib diisi');
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...form, link_id: form.link_id || null };
      if (editing) {
        await api.put(`/ekinerja/jurnal-harian/${editing.id}`, payload);
        toast.success('Jurnal berhasil diperbarui');
      } else {
        await api.post('/ekinerja/jurnal-harian', payload);
        toast.success('Jurnal berhasil ditambahkan');
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan jurnal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (e) => {
    if (!window.confirm('Hapus entri jurnal ini?')) return;
    try {
      await api.delete(`/ekinerja/jurnal-harian/${e.id}`);
      toast.success('Jurnal berhasil dihapus');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Gagal menghapus jurnal');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">Waktu pelaksanaan otomatis tercatat hari ini. Pilih link bukti dukung dari daftar yang sudah Anda siapkan di tab "Link Bukti Dukung".</p>
        <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2 shrink-0 ml-3">
          <Plus className="h-4 w-4" /> Tambah Jurnal
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>Uraian Kegiatan</TableHead>
              <TableHead>Volume/Satuan</TableHead>
              <TableHead>Bukti Dukung</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">Memuat data...</TableCell></TableRow>
            ) : entries.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">Belum ada jurnal harian. Klik "Tambah Jurnal" untuk mengisi hari ini.</TableCell></TableRow>
            ) : (
              entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm font-medium">{e.tanggal}</TableCell>
                  <TableCell className="max-w-sm text-sm">{e.uraian_kegiatan}</TableCell>
                  <TableCell className="text-sm">{[e.volume, e.satuan_hasil].filter(Boolean).join(' ') || '-'}</TableCell>
                  <TableCell className="text-sm">
                    {e.link_url ? (
                      <a href={e.link_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{e.link_label}</a>
                    ) : (
                      <span className="text-slate-400 italic">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(e)} className="text-rose-600"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Jurnal Harian' : 'Tambah Jurnal Harian'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Uraian Kegiatan *</Label>
              <Textarea value={form.uraian_kegiatan} onChange={(e) => setForm({ ...form, uraian_kegiatan: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Volume</Label>
                <Input value={form.volume} onChange={(e) => setForm({ ...form, volume: e.target.value })} placeholder="Mis. 1" />
              </div>
              <div>
                <Label>Satuan Hasil</Label>
                <Input value={form.satuan_hasil} onChange={(e) => setForm({ ...form, satuan_hasil: e.target.value })} placeholder="Mis. Dokumen" />
              </div>
            </div>
            <div>
              <Label>Bukti Dukung</Label>
              <Select value={form.link_id || undefined} onValueChange={(v) => setForm({ ...form, link_id: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih link yang sudah disiapkan..." /></SelectTrigger>
                <SelectContent>
                  {links.map((l) => <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {links.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">Belum ada link. Tambahkan dulu di tab "Link Bukti Dukung".</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Batal</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="bg-[#006837] hover:bg-[#0B7A3B]">
              {submitting ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function JurnalHarianAdminView() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/ekinerja/jurnal-harian');
      setEntries(data || []);
    } catch (e) {
      toast.error('Gagal memuat jurnal harian semua GTK');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = entries.filter((e) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (e.gtk_name || '').toLowerCase().includes(s) || (e.uraian_kegiatan || '').toLowerCase().includes(s);
  });

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input placeholder="Cari GTK atau uraian kegiatan..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              <TableHead>GTK</TableHead>
              <TableHead>Uraian Kegiatan</TableHead>
              <TableHead>Volume/Satuan</TableHead>
              <TableHead>Bukti Dukung</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">Memuat data...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">Belum ada jurnal harian.</TableCell></TableRow>
            ) : (
              filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm font-medium">{e.tanggal}</TableCell>
                  <TableCell className="text-sm">{e.gtk_name}</TableCell>
                  <TableCell className="max-w-sm text-sm">{e.uraian_kegiatan}</TableCell>
                  <TableCell className="text-sm">{[e.volume, e.satuan_hasil].filter(Boolean).join(' ') || '-'}</TableCell>
                  <TableCell className="text-sm">
                    {e.link_url ? (
                      <a href={e.link_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{e.link_label}</a>
                    ) : (
                      <span className="text-slate-400 italic">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
