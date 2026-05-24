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
import { BookMarked, FileText, Plus, Pencil, Trash2, Loader2, Save, ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function AdminTatibKategoriPage() {
  const [tab, setTab] = useState('kategori');
  const [kategoriList, setKategoriList] = useState([]);
  const [jenisList, setJenisList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal states
  const [showKategoriModal, setShowKategoriModal] = useState(false);
  const [showJenisModal, setShowJenisModal] = useState(false);
  const [editingKategori, setEditingKategori] = useState(null);
  const [editingJenis, setEditingJenis] = useState(null);

  // Form states
  const [kategoriForm, setKategoriForm] = useState({
    nama: '',
    deskripsi: '',
    urutan: 0,
  });

  const [jenisForm, setJenisForm] = useState({
    kategori_id: '',
    nama: '',
    deskripsi: '',
    urutan: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [kategoriRes, jenisRes] = await Promise.all([
        api.get('/tatib/kategori'),
        api.get('/tatib/jenis'),
      ]);

      setKategoriList(kategoriRes.data || []);
      setJenisList(jenisRes.data || []);
    } catch (e) {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  // Kategori handlers
  const openKategoriModal = (item = null) => {
    if (item) {
      setEditingKategori(item);
      setKategoriForm({
        nama: item.nama || '',
        deskripsi: item.deskripsi || '',
        urutan: item.urutan || 0,
      });
    } else {
      setEditingKategori(null);
      setKategoriForm({
        nama: '',
        deskripsi: '',
        urutan: 0,
      });
    }
    setShowKategoriModal(true);
  };

  const handleSaveKategori = async () => {
    if (!kategoriForm.nama) {
      toast.error('Nama kategori wajib diisi');
      return;
    }

    setSaving(true);
    try {
      if (editingKategori) {
        await api.put(`/tatib/kategori/${editingKategori.id}`, kategoriForm);
        toast.success('Kategori berhasil diperbarui');
      } else {
        await api.post('/tatib/kategori', kategoriForm);
        toast.success('Kategori berhasil ditambahkan');
      }
      setShowKategoriModal(false);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan kategori');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKategori = async (id) => {
    if (!confirm('Yakin ingin menghapus kategori ini?')) return;
    try {
      await api.delete(`/tatib/kategori/${id}`);
      toast.success('Kategori dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus kategori');
    }
  };

  // Jenis handlers
  const openJenisModal = (item = null) => {
    if (item) {
      setEditingJenis(item);
      setJenisForm({
        kategori_id: item.kategori_id || '',
        nama: item.nama || '',
        deskripsi: item.deskripsi || '',
        urutan: item.urutan || 0,
      });
    } else {
      setEditingJenis(null);
      setJenisForm({
        kategori_id: '',
        nama: '',
        deskripsi: '',
        urutan: 0,
      });
    }
    setShowJenisModal(true);
  };

  const handleSaveJenis = async () => {
    if (!jenisForm.kategori_id || !jenisForm.nama) {
      toast.error('Kategori dan nama jenis wajib diisi');
      return;
    }

    setSaving(true);
    try {
      if (editingJenis) {
        await api.put(`/tatib/jenis/${editingJenis.id}`, jenisForm);
        toast.success('Jenis berhasil diperbarui');
      } else {
        await api.post('/tatib/jenis', jenisForm);
        toast.success('Jenis berhasil ditambahkan');
      }
      setShowJenisModal(false);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan jenis');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteJenis = async (id) => {
    if (!confirm('Yakin ingin menghapus jenis ini?')) return;
    try {
      await api.delete(`/tatib/jenis/${id}`);
      toast.success('Jenis dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus jenis');
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-tatib-kategori-page">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <ShieldAlert className="h-3 w-3 mr-1" /> Input Kategori & Jenis
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Input Kategori & Jenis</h1>
        <p className="text-sm text-slate-600 mt-1">Kelola Kategori dan Jenis Tata Tertib</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white border border-slate-200">
          <TabsTrigger value="kategori">
            <BookMarked className="h-4 w-4 mr-2" />
            Kategori ({kategoriList.length})
          </TabsTrigger>
          <TabsTrigger value="jenis">
            <FileText className="h-4 w-4 mr-2" />
            Jenis ({jenisList.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kategori" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openKategoriModal()} className="gap-2 bg-[#006837] hover:bg-[#005830]">
              <Plus className="h-4 w-4" />
              Tambah Kategori
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
                        <TableHead>NAMA KATEGORI</TableHead>
                        <TableHead>DESKRIPSI</TableHead>
                        <TableHead className="w-24">URUTAN</TableHead>
                        <TableHead className="text-right">AKSI</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kategoriList.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-12 text-slate-500">
                            <BookMarked className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                            <div className="font-semibold">Belum ada kategori</div>
                            <div className="text-xs mt-1">Klik tombol "Tambah Kategori" untuk memulai</div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        kategoriList.map((item, idx) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-center text-slate-500 font-mono">{idx + 1}</TableCell>
                            <TableCell className="font-semibold">{item.nama}</TableCell>
                            <TableCell className="max-w-md">
                              <div className="line-clamp-2">{item.deskripsi || '-'}</div>
                            </TableCell>
                            <TableCell className="text-center font-mono">{item.urutan}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => openKategoriModal(item)}
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleDeleteKategori(item.id)}
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

        <TabsContent value="jenis" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openJenisModal()} className="gap-2 bg-[#006837] hover:bg-[#005830]">
              <Plus className="h-4 w-4" />
              Tambah Jenis
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
                        <TableHead>KATEGORI</TableHead>
                        <TableHead>NAMA JENIS</TableHead>
                        <TableHead>DESKRIPSI</TableHead>
                        <TableHead className="w-24">URUTAN</TableHead>
                        <TableHead className="text-right">AKSI</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jenisList.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                            <FileText className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                            <div className="font-semibold">Belum ada jenis</div>
                            <div className="text-xs mt-1">Klik tombol "Tambah Jenis" untuk memulai</div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        jenisList.map((item, idx) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-center text-slate-500 font-mono">{idx + 1}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.kategori_nama}</Badge>
                            </TableCell>
                            <TableCell className="font-semibold">{item.nama}</TableCell>
                            <TableCell className="max-w-md">
                              <div className="line-clamp-2">{item.deskripsi || '-'}</div>
                            </TableCell>
                            <TableCell className="text-center font-mono">{item.urutan}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => openJenisModal(item)}
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleDeleteJenis(item.id)}
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

      {/* Kategori Modal */}
      <Dialog open={showKategoriModal} onOpenChange={setShowKategoriModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingKategori ? 'Edit Kategori' : 'Tambah Kategori Baru'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nama_kategori">Nama Kategori <span className="text-rose-500">*</span></Label>
              <Input
                id="nama_kategori"
                value={kategoriForm.nama}
                onChange={(e) => setKategoriForm({ ...kategoriForm, nama: e.target.value })}
                placeholder="Contoh: Pelanggaran Ringan, Prestasi Akademik"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deskripsi_kategori">Deskripsi</Label>
              <Textarea
                id="deskripsi_kategori"
                value={kategoriForm.deskripsi}
                onChange={(e) => setKategoriForm({ ...kategoriForm, deskripsi: e.target.value })}
                placeholder="Deskripsi kategori (opsional)"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="urutan_kategori">Urutan</Label>
              <Input
                id="urutan_kategori"
                type="number"
                value={kategoriForm.urutan}
                onChange={(e) => setKategoriForm({ ...kategoriForm, urutan: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-slate-500">Urutan tampilan (semakin kecil, semakin di atas)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowKategoriModal(false)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={handleSaveKategori} disabled={saving} className="gap-2 bg-[#006837] hover:bg-[#005830]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Jenis Modal */}
      <Dialog open={showJenisModal} onOpenChange={setShowJenisModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingJenis ? 'Edit Jenis' : 'Tambah Jenis Baru'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="kategori_jenis">Kategori <span className="text-rose-500">*</span></Label>
              <Select
                value={jenisForm.kategori_id || "none"}
                onValueChange={(v) => setJenisForm({ ...jenisForm, kategori_id: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih Kategori</SelectItem>
                  {kategoriList.map((kat) => (
                    <SelectItem key={kat.id} value={kat.id}>{kat.nama}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nama_jenis">Nama Jenis <span className="text-rose-500">*</span></Label>
              <Input
                id="nama_jenis"
                value={jenisForm.nama}
                onChange={(e) => setJenisForm({ ...jenisForm, nama: e.target.value })}
                placeholder="Contoh: Kehadiran, Kebersihan, Olimpiade"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deskripsi_jenis">Deskripsi</Label>
              <Textarea
                id="deskripsi_jenis"
                value={jenisForm.deskripsi}
                onChange={(e) => setJenisForm({ ...jenisForm, deskripsi: e.target.value })}
                placeholder="Deskripsi jenis (opsional)"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="urutan_jenis">Urutan</Label>
              <Input
                id="urutan_jenis"
                type="number"
                value={jenisForm.urutan}
                onChange={(e) => setJenisForm({ ...jenisForm, urutan: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowJenisModal(false)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={handleSaveJenis} disabled={saving} className="gap-2 bg-[#006837] hover:bg-[#005830]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
