import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Plus, Pencil, Trash2, Download, Upload, FileText,
  DollarSign, TrendingUp, Search, Eye, EyeOff
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

// v1.1.1: Updated for dual budget system (BOS & Komite)
const EMPTY_BUDGET_FORM = {
  code: '',
  name: '',
  category: '',
  bidang: '',
  description: '',
  allocated_bos: 0,
  allocated_komite: 0,
  realized_bos: 0,
  realized_komite: 0,
  fiscal_year: '',
  quarter: '',
  month: null,
};

const EMPTY_DOCUMENT_FORM = {
  title: '',
  description: '',
  document_type: '',
  file_url: '',
  file_name: '',
  fiscal_year: '',
  quarter: '',
  is_public: true,
};

const CATEGORIES = ['Operasional', 'Pembangunan', 'Program', 'Pendidikan', 'Kesejahteraan', 'Lainnya'];
const BIDANG_OPTIONS = [
  { value: 'sarana_prasarana', label: 'Sarana & Prasarana' },
  { value: 'humas', label: 'Humas' },
  { value: 'kesiswaan', label: 'Kesiswaan' },
  { value: 'kurikulum', label: 'Kurikulum' },
  { value: 'tata_usaha', label: 'Tata Usaha' },
];
const SUMBER_DANA_OPTIONS = ['BOS', 'KOMITE'];
const DOCUMENT_TYPES = ['Laporan', 'Bukti', 'Proposal', 'Evaluasi', 'Rekapitulasi', 'Lainnya'];
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

export default function AdminRKAMPage() {
  const [activeTab, setActiveTab] = useState('budget');

  // Budget state
  const [budgetItems, setBudgetItems] = useState([]);
  const [budgetDialog, setBudgetDialog] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [budgetForm, setBudgetForm] = useState(EMPTY_BUDGET_FORM);
  const [budgetSearch, setBudgetSearch] = useState('');
  const [filterBidang, setFilterBidang] = useState('');
  const [filterSumberDana, setFilterSumberDana] = useState('');

  // Document state
  const [documents, setDocuments] = useState([]);
  const [documentDialog, setDocumentDialog] = useState(false);
  const [editingDocument, setEditingDocument] = useState(null);
  const [documentForm, setDocumentForm] = useState(EMPTY_DOCUMENT_FORM);
  const [documentSearch, setDocumentSearch] = useState('');

  // Common state
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fiscalYearFilter, setFiscalYearFilter] = useState('');

  useEffect(() => {
    // Set default fiscal year
    const now = new Date();
    const currentYear = now.getFullYear();
    const month = now.getMonth() + 1;
    const defaultFiscalYear = month >= 7 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;
    setFiscalYearFilter(defaultFiscalYear);
    setBudgetForm({ ...EMPTY_BUDGET_FORM, fiscal_year: defaultFiscalYear });
    setDocumentForm({ ...EMPTY_DOCUMENT_FORM, fiscal_year: defaultFiscalYear });
  }, []);

  useEffect(() => {
    if (fiscalYearFilter) {
      loadData();
    }
  }, [fiscalYearFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [budgetRes, docsRes] = await Promise.all([
        api.get('/rkam/budget-items', { params: { fiscal_year: fiscalYearFilter } }),
        api.get('/rkam/documents', { params: { fiscal_year: fiscalYearFilter } })
      ]);
      setBudgetItems(budgetRes.data);
      setDocuments(docsRes.data);
    } catch (e) {
      toast.error('Gagal memuat data');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // BUDGET FUNCTIONS
  // ============================================================================

  const openBudgetCreate = () => {
    setEditingBudget(null);
    setBudgetForm({ ...EMPTY_BUDGET_FORM, fiscal_year: fiscalYearFilter });
    setBudgetDialog(true);
  };

  const openBudgetEdit = (item) => {
    setEditingBudget(item.id);
    // v1.1.1: Load dual budget fields, with backward compatibility
    setBudgetForm({
      code: item.code || '',
      name: item.name || '',
      category: item.category || '',
      bidang: item.bidang || '',
      description: item.description || '',
      allocated_bos: item.allocated_bos ?? item.allocated_amount ?? 0,
      allocated_komite: item.allocated_komite ?? 0,
      realized_bos: item.realized_bos ?? item.realized_amount ?? 0,
      realized_komite: item.realized_komite ?? 0,
      fiscal_year: item.fiscal_year || '',
      quarter: item.quarter || '',
      month: item.month || null,
    });
    setBudgetDialog(true);
  };

  const handleBudgetSubmit = async () => {
    if (!budgetForm.name || !budgetForm.fiscal_year) {
      toast.error('Nama dan tahun anggaran wajib diisi');
      return;
    }

    setSubmitting(true);
    try {
      if (editingBudget) {
        await api.put(`/rkam/budget-items/${editingBudget}`, budgetForm);
        toast.success('Item anggaran berhasil diperbarui');
      } else {
        await api.post('/rkam/budget-items', budgetForm);
        toast.success('Item anggaran berhasil ditambahkan');
      }
      setBudgetDialog(false);
      loadData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Gagal menyimpan item anggaran');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBudgetDelete = async (id) => {
    if (!window.confirm('Hapus item anggaran ini?')) return;

    try {
      await api.delete(`/rkam/budget-items/${id}`);
      toast.success('Item anggaran berhasil dihapus');
      loadData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Gagal menghapus item anggaran');
    }
  };

  const handleExport = async () => {
    try {
      const response = await api.get('/rkam/budget-items/export', {
        params: { fiscal_year: fiscalYearFilter },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `RKAM_Budget_${fiscalYearFilter}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success('Export berhasil');
    } catch (e) {
      toast.error('Gagal export data');
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post(
        `/rkam/budget-items/import?fiscal_year=${fiscalYearFilter}`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );

      toast.success(response.data.message);
      if (response.data.errors && response.data.errors.length > 0) {
        console.error('Import errors:', response.data.errors);
      }
      loadData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Gagal import data');
    }

    e.target.value = null;
  };

  // ============================================================================
  // DOCUMENT FUNCTIONS
  // ============================================================================

  const openDocumentCreate = () => {
    setEditingDocument(null);
    setDocumentForm({ ...EMPTY_DOCUMENT_FORM, fiscal_year: fiscalYearFilter });
    setDocumentDialog(true);
  };

  const openDocumentEdit = (doc) => {
    setEditingDocument(doc.id);
    setDocumentForm({
      title: doc.title || '',
      description: doc.description || '',
      document_type: doc.document_type || '',
      file_url: doc.file_url || '',
      file_name: doc.file_name || '',
      fiscal_year: doc.fiscal_year || '',
      quarter: doc.quarter || '',
      is_public: doc.is_public !== false,
    });
    setDocumentDialog(true);
  };

  const handleDocumentSubmit = async () => {
    if (!documentForm.title || !documentForm.document_type || !documentForm.file_url || !documentForm.fiscal_year) {
      toast.error('Judul, tipe, file URL, dan tahun anggaran wajib diisi');
      return;
    }

    setSubmitting(true);
    try {
      if (editingDocument) {
        await api.put(`/rkam/documents/${editingDocument}`, documentForm);
        toast.success('Dokumen berhasil diperbarui');
      } else {
        await api.post('/rkam/documents', documentForm);
        toast.success('Dokumen berhasil ditambahkan');
      }
      setDocumentDialog(false);
      loadData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Gagal menyimpan dokumen');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDocumentDelete = async (id) => {
    if (!window.confirm('Hapus dokumen ini?')) return;

    try {
      await api.delete(`/rkam/documents/${id}`);
      toast.success('Dokumen berhasil dihapus');
      loadData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Gagal menghapus dokumen');
    }
  };

  // ============================================================================
  // FILTERS
  // ============================================================================

  const filteredBudgetItems = budgetItems.filter(item => {
    // Filter by bidang
    if (filterBidang && item.bidang !== filterBidang) return false;

    // Filter by sumber_dana
    if (filterSumberDana && item.sumber_dana !== filterSumberDana) return false;

    // Filter by search
    if (!budgetSearch) return true;
    const s = budgetSearch.toLowerCase();
    return (
      item.code?.toLowerCase().includes(s) ||
      item.name?.toLowerCase().includes(s) ||
      item.category?.toLowerCase().includes(s)
    );
  });

  const filteredDocuments = documents.filter(doc => {
    if (!documentSearch) return true;
    const s = documentSearch.toLowerCase();
    return (
      doc.title?.toLowerCase().includes(s) ||
      doc.description?.toLowerCase().includes(s) ||
      doc.document_type?.toLowerCase().includes(s)
    );
  });

  const formatRupiah = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // ============================================================================
  // SUMMARY CALCULATIONS
  // ============================================================================

  // v1.1.1: Calculate totals using dual budget fields
  const bosAllocated = budgetItems.reduce((sum, item) => sum + (item.allocated_bos || 0), 0);
  const bosRealized = budgetItems.reduce((sum, item) => sum + (item.realized_bos || 0), 0);
  const bosRemaining = bosAllocated - bosRealized;

  const komiteAllocated = budgetItems.reduce((sum, item) => sum + (item.allocated_komite || 0), 0);
  const komiteRealized = budgetItems.reduce((sum, item) => sum + (item.realized_komite || 0), 0);
  const komiteRemaining = komiteAllocated - komiteRealized;

  // Calculate overall totals
  const totalAllocated = bosAllocated + komiteAllocated;
  const totalRealized = bosRealized + komiteRealized;
  const totalRemaining = bosRemaining + komiteRemaining;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <DollarSign className="h-3 w-3 mr-1" /> DANA RKAM
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
          Rencana Kegiatan dan Anggaran Madrasah
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Kelola anggaran dan dokumen transparansi keuangan
        </p>
      </div>

      {/* Fiscal Year Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Label className="text-sm font-medium">Tahun Anggaran:</Label>
            <Input
              type="text"
              placeholder="2024/2025"
              value={fiscalYearFilter}
              onChange={(e) => setFiscalYearFilter(e.target.value)}
              className="w-40"
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* BOS Cards */}
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">BOS</Badge>
              <p className="text-xs text-slate-600">Total Anggaran</p>
            </div>
            <p className="text-xl font-bold text-slate-900">{formatRupiah(bosAllocated)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">BOS</Badge>
              <p className="text-xs text-slate-600">Realisasi</p>
            </div>
            <p className="text-xl font-bold text-green-600">{formatRupiah(bosRealized)}</p>
            <p className="text-xs text-blue-600 font-medium mt-1">
              {bosAllocated > 0 ? ((bosRealized / bosAllocated) * 100).toFixed(1) : 0}%
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">BOS</Badge>
              <p className="text-xs text-slate-600">Sisa Anggaran</p>
            </div>
            <p className="text-xl font-bold text-amber-600">{formatRupiah(bosRemaining)}</p>
          </CardContent>
        </Card>

        {/* KOMITE Cards */}
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">KOMITE</Badge>
              <p className="text-xs text-slate-600">Total Anggaran</p>
            </div>
            <p className="text-xl font-bold text-slate-900">{formatRupiah(komiteAllocated)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">KOMITE</Badge>
              <p className="text-xs text-slate-600">Realisasi</p>
            </div>
            <p className="text-xl font-bold text-green-600">{formatRupiah(komiteRealized)}</p>
            <p className="text-xs text-purple-600 font-medium mt-1">
              {komiteAllocated > 0 ? ((komiteRealized / komiteAllocated) * 100).toFixed(1) : 0}%
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">KOMITE</Badge>
              <p className="text-xs text-slate-600">Sisa Anggaran</p>
            </div>
            <p className="text-xl font-bold text-amber-600">{formatRupiah(komiteRemaining)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="budget">Detail Anggaran</TabsTrigger>
          <TabsTrigger value="documents">Arsip Dokumen</TabsTrigger>
        </TabsList>

        {/* BUDGET TAB */}
        <TabsContent value="budget" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Detail Anggaran</CardTitle>
                <div className="flex gap-2">
                  <input
                    type="file"
                    id="import-file"
                    accept=".xlsx,.xls"
                    onChange={handleImport}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('import-file').click()}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" /> Import
                  </Button>
                  <Button variant="outline" onClick={handleExport} className="gap-2">
                    <Download className="h-4 w-4" /> Export
                  </Button>
                  <Button onClick={openBudgetCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2">
                    <Plus className="h-4 w-4" /> Tambah
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-4 border-b space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Cari anggaran..."
                    value={budgetSearch}
                    onChange={(e) => setBudgetSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1 block">Filter by Bidang</Label>
                    <Select value={filterBidang || undefined} onValueChange={(v) => setFilterBidang(v === 'all' ? '' : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Semua Bidang" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Bidang</SelectItem>
                        {BIDANG_OPTIONS.map((bidang) => (
                          <SelectItem key={bidang.value} value={bidang.value}>
                            {bidang.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Filter by Sumber Dana</Label>
                    <Select value={filterSumberDana || undefined} onValueChange={(v) => setFilterSumberDana(v === 'all' ? '' : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Semua Sumber Dana" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Sumber Dana</SelectItem>
                        {SUMBER_DANA_OPTIONS.map((sumber) => (
                          <SelectItem key={sumber} value={sumber}>
                            {sumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kode</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Bidang</TableHead>
                      <TableHead>Sumber Dana</TableHead>
                      <TableHead className="text-right">Dialokasikan</TableHead>
                      <TableHead className="text-right">Realisasi</TableHead>
                      <TableHead className="text-right">Sisa</TableHead>
                      <TableHead>Triwulan</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8">
                          Memuat data...
                        </TableCell>
                      </TableRow>
                    ) : filteredBudgetItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-slate-500">
                          Belum ada data anggaran
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredBudgetItems.map((item) => {
                        const bidangLabel = BIDANG_OPTIONS.find(b => b.value === item.bidang)?.label;
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono text-sm">{item.code || '-'}</TableCell>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>
                              {item.category && <Badge variant="outline">{item.category}</Badge>}
                            </TableCell>
                            <TableCell>
                              {bidangLabel ? <Badge className="bg-blue-50 text-blue-700 border-blue-200">{bidangLabel}</Badge> : '-'}
                            </TableCell>
                            <TableCell>
                              {item.sumber_dana ? (
                                <Badge className={
                                  item.sumber_dana === 'BOS'
                                    ? 'bg-blue-100 text-blue-700 border-blue-200'
                                    : 'bg-purple-100 text-purple-700 border-purple-200'
                                }>
                                  {item.sumber_dana}
                                </Badge>
                              ) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatRupiah(item.allocated_amount)}
                            </TableCell>
                            <TableCell className="text-right text-green-600">
                              {formatRupiah(item.realized_amount)}
                            </TableCell>
                            <TableCell className="text-right text-amber-600">
                              {formatRupiah(item.remaining_amount)}
                            </TableCell>
                            <TableCell>{item.quarter || '-'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" onClick={() => openBudgetEdit(item)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleBudgetDelete(item.id)}
                                className="text-rose-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
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

        {/* DOCUMENTS TAB */}
        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Arsip Dokumen Transparansi</CardTitle>
                <Button onClick={openDocumentCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2">
                  <Plus className="h-4 w-4" /> Tambah Dokumen
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-4 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Cari dokumen..."
                    value={documentSearch}
                    onChange={(e) => setDocumentSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Judul</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead>Triwulan</TableHead>
                      <TableHead>Visibilitas</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          Memuat data...
                        </TableCell>
                      </TableRow>
                    ) : filteredDocuments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                          Belum ada dokumen
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredDocuments.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell>
                            <div className="font-medium">{doc.title}</div>
                            {doc.description && (
                              <div className="text-xs text-slate-500 line-clamp-1">{doc.description}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{doc.document_type}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">{doc.file_name}</TableCell>
                          <TableCell>{doc.quarter || '-'}</TableCell>
                          <TableCell>
                            {doc.is_public ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                                <Eye className="h-3 w-3" /> Publik
                              </Badge>
                            ) : (
                              <Badge className="bg-slate-100 text-slate-600 border-slate-200 gap-1">
                                <EyeOff className="h-3 w-3" /> Internal
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => window.open(doc.file_url, '_blank')}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => openDocumentEdit(doc)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDocumentDelete(doc.id)}
                                className="text-rose-600"
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* BUDGET DIALOG */}
      <Dialog open={budgetDialog} onOpenChange={setBudgetDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBudget ? 'Edit Item Anggaran' : 'Tambah Item Anggaran'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label>Kode</Label>
                <Input
                  value={budgetForm.code}
                  onChange={(e) => setBudgetForm({ ...budgetForm, code: e.target.value })}
                  placeholder="1.2.3"
                />
              </div>
              <div>
                <Label>Kategori</Label>
                <Select
                  value={budgetForm.category}
                  onValueChange={(v) => setBudgetForm({ ...budgetForm, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kategori..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Bidang</Label>
                <Select
                  value={budgetForm.bidang}
                  onValueChange={(v) => setBudgetForm({ ...budgetForm, bidang: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih bidang..." />
                  </SelectTrigger>
                  <SelectContent>
                    {BIDANG_OPTIONS.map((bidang) => (
                      <SelectItem key={bidang.value} value={bidang.value}>
                        {bidang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* v1.1.1: Sumber Dana field removed - now using dual budget system */}
            </div>

            <div>
              <Label>Nama Item Anggaran <span className="text-red-500">*</span></Label>
              <Input
                value={budgetForm.name}
                onChange={(e) => setBudgetForm({ ...budgetForm, name: e.target.value })}
                placeholder="Contoh: Pengadaan Buku Pelajaran"
                required
              />
            </div>

            <div>
              <Label>Deskripsi</Label>
              <Textarea
                value={budgetForm.description}
                onChange={(e) => setBudgetForm({ ...budgetForm, description: e.target.value })}
                placeholder="Detail item anggaran..."
                rows={3}
              />
            </div>

            {/* v1.1.1: Dual Budget System */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-blue-700 font-semibold">Anggaran BOS</Label>
                  <Input
                    type="number"
                    value={budgetForm.allocated_bos}
                    onChange={(e) =>
                      setBudgetForm({ ...budgetForm, allocated_bos: parseFloat(e.target.value) || 0 })
                    }
                    min="0"
                    step="1000"
                    className="border-blue-200 focus:border-blue-500"
                  />
                </div>
                <div>
                  <Label className="text-purple-700 font-semibold">Anggaran Komite</Label>
                  <Input
                    type="number"
                    value={budgetForm.allocated_komite}
                    onChange={(e) =>
                      setBudgetForm({ ...budgetForm, allocated_komite: parseFloat(e.target.value) || 0 })
                    }
                    min="0"
                    step="1000"
                    className="border-purple-200 focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-blue-600">Realisasi BOS</Label>
                  <Input
                    type="number"
                    value={budgetForm.realized_bos}
                    onChange={(e) =>
                      setBudgetForm({ ...budgetForm, realized_bos: parseFloat(e.target.value) || 0 })
                    }
                    min="0"
                    step="1000"
                    className="border-blue-200 focus:border-blue-500"
                  />
                </div>
                <div>
                  <Label className="text-purple-600">Realisasi Komite</Label>
                  <Input
                    type="number"
                    value={budgetForm.realized_komite}
                    onChange={(e) =>
                      setBudgetForm({ ...budgetForm, realized_komite: parseFloat(e.target.value) || 0 })
                    }
                    min="0"
                    step="1000"
                    className="border-purple-200 focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="bg-slate-50 p-3 rounded border border-slate-200 text-sm space-y-1">
                <p className="font-semibold text-slate-700">Ringkasan:</p>
                <p>Total Dialokasikan: <span className="font-bold">Rp {((budgetForm.allocated_bos || 0) + (budgetForm.allocated_komite || 0)).toLocaleString('id-ID')}</span></p>
                <p>Total Realisasi: <span className="font-bold text-green-600">Rp {((budgetForm.realized_bos || 0) + (budgetForm.realized_komite || 0)).toLocaleString('id-ID')}</span></p>
                <p>Sisa BOS: <span className="font-bold text-amber-600">Rp {((budgetForm.allocated_bos || 0) - (budgetForm.realized_bos || 0)).toLocaleString('id-ID')}</span></p>
                <p>Sisa Komite: <span className="font-bold text-amber-600">Rp {((budgetForm.allocated_komite || 0) - (budgetForm.realized_komite || 0)).toLocaleString('id-ID')}</span></p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Tahun Anggaran <span className="text-red-500">*</span></Label>
                <Input
                  value={budgetForm.fiscal_year}
                  onChange={(e) => setBudgetForm({ ...budgetForm, fiscal_year: e.target.value })}
                  placeholder="2024/2025"
                  required
                />
              </div>
              <div>
                <Label>Triwulan</Label>
                <Select
                  value={budgetForm.quarter || undefined}
                  onValueChange={(v) => setBudgetForm({ ...budgetForm, quarter: v === 'none' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak Ada</SelectItem>
                    {QUARTERS.map((q) => (
                      <SelectItem key={q} value={q}>
                        {q}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Bulan</Label>
                <Input
                  type="number"
                  value={budgetForm.month || ''}
                  onChange={(e) =>
                    setBudgetForm({ ...budgetForm, month: e.target.value ? parseInt(e.target.value) : null })
                  }
                  min="1"
                  max="12"
                  placeholder="1-12"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBudgetDialog(false)} disabled={submitting}>
              Batal
            </Button>
            <Button onClick={handleBudgetSubmit} className="bg-[#006837] hover:bg-[#0B7A3B]" disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DOCUMENT DIALOG */}
      <Dialog open={documentDialog} onOpenChange={setDocumentDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDocument ? 'Edit Dokumen' : 'Tambah Dokumen'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Judul Dokumen <span className="text-red-500">*</span></Label>
              <Input
                value={documentForm.title}
                onChange={(e) => setDocumentForm({ ...documentForm, title: e.target.value })}
                placeholder="Contoh: Laporan Realisasi Anggaran Q1"
                required
              />
            </div>

            <div>
              <Label>Deskripsi</Label>
              <Textarea
                value={documentForm.description}
                onChange={(e) => setDocumentForm({ ...documentForm, description: e.target.value })}
                placeholder="Deskripsi dokumen..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipe Dokumen <span className="text-red-500">*</span></Label>
                <Select
                  value={documentForm.document_type}
                  onValueChange={(v) => setDocumentForm({ ...documentForm, document_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih tipe..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Triwulan</Label>
                <Select
                  value={documentForm.quarter || undefined}
                  onValueChange={(v) => setDocumentForm({ ...documentForm, quarter: v === 'none' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak Ada</SelectItem>
                    {QUARTERS.map((q) => (
                      <SelectItem key={q} value={q}>
                        {q}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>URL File <span className="text-red-500">*</span></Label>
              <Input
                value={documentForm.file_url}
                onChange={(e) => setDocumentForm({ ...documentForm, file_url: e.target.value })}
                placeholder="https://..."
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                Upload file ke cloud storage, kemudian masukkan URL-nya di sini
              </p>
            </div>

            <div>
              <Label>Nama File <span className="text-red-500">*</span></Label>
              <Input
                value={documentForm.file_name}
                onChange={(e) => setDocumentForm({ ...documentForm, file_name: e.target.value })}
                placeholder="laporan-q1.pdf"
                required
              />
            </div>

            <div>
              <Label>Tahun Anggaran <span className="text-red-500">*</span></Label>
              <Input
                value={documentForm.fiscal_year}
                onChange={(e) => setDocumentForm({ ...documentForm, fiscal_year: e.target.value })}
                placeholder="2024/2025"
                required
              />
            </div>

            <div className="border-t pt-4">
              <Label className="flex items-center gap-3 cursor-pointer">
                <Switch
                  checked={documentForm.is_public}
                  onCheckedChange={(v) => setDocumentForm({ ...documentForm, is_public: v })}
                />
                <div className="flex items-center gap-2">
                  {documentForm.is_public ? (
                    <>
                      <Eye className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-medium">Tampilkan di Halaman Publik</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-4 w-4 text-slate-500" />
                      <span className="text-sm font-medium">Hanya untuk Internal</span>
                    </>
                  )}
                </div>
              </Label>
              <p className="text-xs text-slate-500 mt-2 ml-11">
                {documentForm.is_public
                  ? 'Dokumen ini akan muncul di halaman publik RKAM'
                  : 'Dokumen ini hanya akan terlihat oleh admin dan bendahara'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocumentDialog(false)} disabled={submitting}>
              Batal
            </Button>
            <Button onClick={handleDocumentSubmit} className="bg-[#006837] hover:bg-[#0B7A3B]" disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
