import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Edit2, Trash2, Upload, Plus, Download, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { useAuth } from '@/lib/AuthContext';
import { bolehInputTatib, tolakUbahTatib, pesanGalatTatib } from '@/lib/aksesTatib';
import BannerModeLihat from '@/components/tatib/BannerModeLihat';
import EditorKondisiAturan, { KONDISI_BAWAAN, kondisiKePayload } from '@/components/tatib/EditorKondisiAturan';
import { formatPoin } from '@/components/tatib/RingkasanPoin';

const AdminTatibInputPage = () => {
  const { activeRole } = useAuth();
  const bolehInput = bolehInputTatib(activeRole);
  const [aturanList, setAturanList] = useState([]);
  const [kategoriList, setKategoriList] = useState([]);
  const [jenisList, setJenisList] = useState([]);
  const [allJenisList, setAllJenisList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingAturan, setEditingAturan] = useState(null);
  const [importFile, setImportFile] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Filters
  const [filterKategori, setFilterKategori] = useState('');
  const [filterJenis, setFilterJenis] = useState('');
  const [filterTingkat, setFilterTingkat] = useState('');

  // Form
  const [aturanForm, setAturanForm] = useState({
    kode: '',
    nama_aturan: '',
    kategori_id: '',
    jenis_id: '',
    jenis_poin: 'pelanggaran',
    kondisi: KONDISI_BAWAAN,
    tingkat_kelas: '',
    deskripsi: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Filter jenis based on selected kategori in form
    if (aturanForm.kategori_id) {
      const filtered = allJenisList.filter(j => j.kategori_id === aturanForm.kategori_id);
      setJenisList(filtered);
    } else {
      setJenisList(allJenisList);
    }
  }, [aturanForm.kategori_id, allJenisList]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [aturanRes, kategoriRes, jenisRes] = await Promise.all([
        api.get('/tatib/aturan'),
        api.get('/tatib/kategori'),
        api.get('/tatib/jenis'),
      ]);
      setAturanList(aturanRes.data || []);
      setKategoriList(kategoriRes.data || []);
      setAllJenisList(jenisRes.data || []);
      setJenisList(jenisRes.data || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (aturan = null) => {
    if (tolakUbahTatib(activeRole)) return;
    if (aturan) {
      setEditingAturan(aturan);
      setAturanForm({
        kode: aturan.kode,
        nama_aturan: aturan.nama_aturan,
        kategori_id: aturan.kategori_id,
        jenis_id: aturan.jenis_id,
        jenis_poin: aturan.jenis_poin || ((aturan.poin || 0) < 0 ? 'pelanggaran' : 'kebaikan'),
        kondisi: (aturan.kondisi?.length ? aturan.kondisi : [{ label: 'Setiap kejadian', poin: aturan.poin }])
          .map((k) => ({ id: k.id, label: k.label, poin: Math.abs(Number(k.poin) || 0) })),
        tingkat_kelas: aturan.tingkat_kelas || '',
        deskripsi: aturan.deskripsi || '',
      });
    } else {
      setEditingAturan(null);
      setAturanForm({
        kode: '',
        nama_aturan: '',
        kategori_id: '',
        jenis_id: '',
        jenis_poin: 'pelanggaran',
        kondisi: KONDISI_BAWAAN,
        tingkat_kelas: '',
        deskripsi: '',
      });
    }
    setShowModal(true);
  };

  const handleSaveAturan = async () => {
    if (tolakUbahTatib(activeRole)) return;
    if (!aturanForm.kode || !aturanForm.nama_aturan || !aturanForm.kategori_id || !aturanForm.jenis_id) {
      toast.error('Kode, nama aturan, kategori, dan jenis wajib diisi');
      return;
    }

    const kondisi = kondisiKePayload(aturanForm.jenis_poin, aturanForm.kondisi);
    if (kondisi.length === 0) {
      toast.error('Isi minimal satu kondisi beserta nilainya');
      return;
    }
    // Nilai bawaan aturan = kondisi pertama; server menghitung ulang & memaksa tanda sesuai jalur.
    const { kondisi: _kondisiForm, ...isian } = aturanForm;
    const payload = { ...isian, kondisi, poin: kondisi[0].poin };

    setSaving(true);
    try {
      if (editingAturan) {
        await api.put(`/tatib/aturan/${editingAturan.id}`, payload);
        toast.success('Aturan berhasil diperbarui');
      } else {
        await api.post('/tatib/aturan', payload);
        toast.success('Aturan berhasil ditambahkan');
      }
      setShowModal(false);
      loadData();
    } catch (e) {
      toast.error(pesanGalatTatib(e, 'Gagal menyimpan aturan'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAturan = async (id) => {
    if (tolakUbahTatib(activeRole)) return;
    if (!(await confirmDialog('Yakin ingin menghapus aturan ini?'))) return;
    try {
      await api.delete(`/tatib/aturan/${id}`);
      toast.success('Aturan berhasil dihapus');
      loadData();
    } catch (e) {
      toast.error(pesanGalatTatib(e, 'Gagal menghapus aturan'));
    }
  };

  const handleImportExcel = async () => {
    if (tolakUbahTatib(activeRole)) return;
    if (!importFile) {
      toast.error('Pilih file Excel terlebih dahulu');
      return;
    }

    const formData = new FormData();
    formData.append('file', importFile);

    setUploading(true);
    setImportResult(null);
    try {
      const res = await api.post('/tatib/aturan/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(res.data);
      if (res.data.imported > 0) {
        toast.success(`Berhasil mengimpor ${res.data.imported} aturan`);
        loadData();
      }
      if (res.data.errors && res.data.errors.length > 0) {
        toast.warning(`${res.data.errors.length} baris gagal diimpor`);
      }
    } catch (e) {
      toast.error(pesanGalatTatib(e, 'Gagal mengimpor data'));
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = () => {
    // Generate simple CSV template
    const headers = ['kode', 'nama_aturan', 'kategori_id', 'jenis_id', 'poin', 'tingkat_kelas', 'deskripsi'];
    const csvContent = headers.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_tatib.csv';
    link.click();
  };

  // Filter aturan list
  const filteredAturan = aturanList.filter(a => {
    if (filterKategori && a.kategori_id !== filterKategori) return false;
    if (filterJenis && a.jenis_id !== filterJenis) return false;
    if (filterTingkat && a.tingkat_kelas !== filterTingkat) return false;
    return true;
  });

  const getKategoriName = (id) => {
    const kat = kategoriList.find(k => k.id === id);
    return kat ? kat.nama : '-';
  };

  const getJenisName = (id) => {
    const jns = allJenisList.find(j => j.id === id);
    return jns ? jns.nama : '-';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Input Tata Tertib</h1>
        {bolehInput && (
        <div className="flex gap-2">
          <Button onClick={() => setShowImportModal(true)} variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Import Excel
          </Button>
          <Button onClick={() => handleOpenModal()}>
            <Plus className="h-4 w-4 mr-2" />
            Tambah Aturan
          </Button>
        </div>
        )}
      </div>

      {!bolehInput && <BannerModeLihat />}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Kategori</Label>
              <Select value={filterKategori || "all"} onValueChange={(v) => setFilterKategori(v === "all" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  {kategoriList.map(k => (
                    <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Jenis</Label>
              <Select value={filterJenis || "all"} onValueChange={(v) => setFilterJenis(v === "all" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua Jenis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Jenis</SelectItem>
                  {allJenisList.map(j => (
                    <SelectItem key={j.id} value={j.id}>{j.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tingkat Kelas</Label>
              <Select value={filterTingkat || "all"} onValueChange={(v) => setFilterTingkat(v === "all" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua Tingkat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tingkat</SelectItem>
                  <SelectItem value="VII">VII</SelectItem>
                  <SelectItem value="VIII">VIII</SelectItem>
                  <SelectItem value="IX">IX</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Memuat data...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama Aturan</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead className="text-right">Poin</TableHead>
                  <TableHead>Tingkat Kelas</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAturan.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-bold">{a.kode}</TableCell>
                    <TableCell>{a.nama_aturan}</TableCell>
                    <TableCell>{getKategoriName(a.kategori_id)}</TableCell>
                    <TableCell>{getJenisName(a.jenis_id)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={a.poin >= 0 ? 'default' : 'destructive'}>
                        {a.kondisi?.length > 1
                          ? `${formatPoin(a.kondisi[0].poin)} … ${formatPoin(a.kondisi[a.kondisi.length - 1].poin)}`
                          : formatPoin(a.poin)}
                      </Badge>
                      {a.kondisi?.length > 1 && <div className="mt-1 text-[11px] text-slate-500">{a.kondisi.length} kondisi</div>}
                    </TableCell>
                    <TableCell>{a.tingkat_kelas || 'Semua'}</TableCell>
                    <TableCell>
                      {bolehInput ? (
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => handleOpenModal(a)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteAturan(a.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                      ) : <span className="text-slate-400">-</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingAturan ? 'Edit Aturan' : 'Tambah Aturan'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Kode*</Label>
              <Input
                value={aturanForm.kode}
                onChange={(e) => setAturanForm({ ...aturanForm, kode: e.target.value })}
                placeholder="Contoh: PEL-001"
              />
            </div>

            <div>
              <Label>Nama Aturan*</Label>
              <Input
                value={aturanForm.nama_aturan}
                onChange={(e) => setAturanForm({ ...aturanForm, nama_aturan: e.target.value })}
                placeholder="Nama aturan tata tertib"
              />
            </div>

            <div>
              <Label>Kategori*</Label>
              <Select
                value={aturanForm.kategori_id || "none"}
                onValueChange={(v) => setAturanForm({ ...aturanForm, kategori_id: v === "none" ? "" : v, jenis_id: "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih Kategori</SelectItem>
                  {kategoriList.map(k => (
                    <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Jenis*</Label>
              <Select
                value={aturanForm.jenis_id || "none"}
                onValueChange={(v) => setAturanForm({ ...aturanForm, jenis_id: v === "none" ? "" : v })}
                disabled={!aturanForm.kategori_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Jenis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih Jenis</SelectItem>
                  {jenisList.map(j => (
                    <SelectItem key={j.id} value={j.id}>{j.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Jalur poin*</Label>
              <Select value={aturanForm.jenis_poin} onValueChange={(v) => setAturanForm({ ...aturanForm, jenis_poin: v })}>
                <SelectTrigger data-testid="aturan-jalur"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pelanggaran">Pelanggaran (poin minus)</SelectItem>
                  <SelectItem value="kebaikan">Kebaikan (poin plus)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Kondisi &amp; nilai poin*</Label>
              <EditorKondisiAturan
                jenis={aturanForm.jenis_poin}
                kondisi={aturanForm.kondisi}
                onChange={(kondisi) => setAturanForm({ ...aturanForm, kondisi })}
              />
            </div>

            <div>
              <Label>Tingkat Kelas</Label>
              <Select
                value={aturanForm.tingkat_kelas || "all"}
                onValueChange={(v) => setAturanForm({ ...aturanForm, tingkat_kelas: v === "all" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Semua Tingkat" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tingkat</SelectItem>
                  <SelectItem value="VII">VII</SelectItem>
                  <SelectItem value="VIII">VIII</SelectItem>
                  <SelectItem value="IX">IX</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Deskripsi</Label>
              <Textarea
                value={aturanForm.deskripsi}
                onChange={(e) => setAturanForm({ ...aturanForm, deskripsi: e.target.value })}
                placeholder="Deskripsi aturan (opsional)"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Batal
            </Button>
            <Button onClick={handleSaveAturan} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Aturan dari Excel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Format Excel</AlertTitle>
              <AlertDescription>
                File Excel harus memiliki kolom: kode, nama_aturan, kategori_id, jenis_id, poin, tingkat_kelas (opsional), deskripsi (opsional)
              </AlertDescription>
            </Alert>

            <Button size="sm" variant="outline" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template CSV
            </Button>

            <div>
              <Label>Pilih File Excel (.xlsx, .xls, .csv)</Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => setImportFile(e.target.files[0])}
              />
            </div>

            {importResult && (
              <div className="space-y-2">
                <Alert variant={importResult.errors?.length > 0 ? 'destructive' : 'default'}>
                  <AlertTitle>Hasil Import</AlertTitle>
                  <AlertDescription>
                    {importResult.imported} aturan berhasil diimpor
                  </AlertDescription>
                </Alert>

                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="max-h-48 overflow-y-auto p-3 bg-red-50 rounded-md text-sm">
                    <p className="font-bold mb-2">Error:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {importResult.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowImportModal(false)}>
              Tutup
            </Button>
            <Button onClick={handleImportExcel} disabled={uploading || !importFile}>
              {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTatibInputPage;
