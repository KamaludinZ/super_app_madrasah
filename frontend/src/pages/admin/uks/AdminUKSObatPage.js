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
import { Pill, ArrowDownCircle, ArrowUpCircle, Plus, Pencil, Trash2, Loader2, Save, Search, Merge, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { hariIniWIB } from '@/lib/tanggal';
import { BatchStatusBadge, KadaluarsaCell, RencanaPotongHint, formatED, labelPilihanStok } from './uksStok';


const emptyObatForm = { nama_obat: '', jenis: '', satuan: 'pcs', untuk_penanganan: '', dosis: '', stok_minimum: 0, keterangan: '' };
const emptyMasukForm = { obat_id: '', tanggal: hariIniWIB(), jumlah: 1, tanggal_kadaluarsa: '', sumber: '', keterangan: '' };
const emptyKeluarForm = { obat_id: '', tanggal: hariIniWIB(), jumlah: 1, keterangan: '' };

export default function AdminUKSObatPage() {
  const [tab, setTab] = useState('daftar');
  const [obatList, setObatList] = useState([]);
  const [masukList, setMasukList] = useState([]);
  const [keluarList, setKeluarList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const [showObatModal, setShowObatModal] = useState(false);
  const [editingObat, setEditingObat] = useState(null);
  const [obatForm, setObatForm] = useState(emptyObatForm);

  const [showMasukModal, setShowMasukModal] = useState(false);
  const [masukForm, setMasukForm] = useState(emptyMasukForm);

  const [showKeluarModal, setShowKeluarModal] = useState(false);
  const [keluarForm, setKeluarForm] = useState(emptyKeluarForm);

  // Obat ganda (nama sama, beda huruf besar/kecil/spasi) yang perlu digabung.
  const [gandaList, setGandaList] = useState([]);
  const [gabung, setGabung] = useState(null); // { items: [...], target_id }

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [obatRes, masukRes, keluarRes] = await Promise.all([
        api.get('/uks/obat'),
        api.get('/uks/obat-masuk'),
        api.get('/uks/obat-keluar'),
      ]);
      setObatList(obatRes.data || []);
      setMasukList(masukRes.data || []);
      setKeluarList(keluarRes.data || []);
      api.get('/uks/obat-ganda').then((r) => setGandaList(r.data || [])).catch(() => setGandaList([]));
    } catch (e) {
      toast.error('Gagal memuat data obat');
    } finally {
      setLoading(false);
    }
  };

  // Obat handlers
  const openObatModal = (item = null) => {
    if (item) {
      setEditingObat(item);
      setObatForm({
        nama_obat: item.nama_obat || '', jenis: item.jenis || '', satuan: item.satuan || 'pcs',
        untuk_penanganan: item.untuk_penanganan || '', dosis: item.dosis || '',
        stok_minimum: item.stok_minimum ?? 0, keterangan: item.keterangan || '',
      });
    } else {
      setEditingObat(null);
      setObatForm(emptyObatForm);
    }
    setShowObatModal(true);
  };

  const handleSaveObat = async () => {
    if (!obatForm.nama_obat) { toast.error('Nama obat wajib diisi'); return; }
    setSaving(true);
    try {
      const payload = { ...obatForm, stok_minimum: Number(obatForm.stok_minimum) || 0 };
      if (editingObat) {
        await api.put(`/uks/obat/${editingObat.id}`, payload);
        toast.success('Data obat berhasil diperbarui');
      } else {
        await api.post('/uks/obat', payload);
        toast.success('Data obat berhasil ditambahkan');
      }
      setShowObatModal(false);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteObat = async (id) => {
    if (!(await confirmDialog('Yakin ingin menghapus obat ini?'))) return;
    try {
      await api.delete(`/uks/obat/${id}`);
      toast.success('Data obat dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data');
    }
  };

  // Obat masuk handlers
  const openMasukModal = () => { setMasukForm(emptyMasukForm); setShowMasukModal(true); };

  const handleSaveMasuk = async () => {
    if (!masukForm.obat_id || !masukForm.jumlah) { toast.error('Obat dan jumlah wajib diisi'); return; }
    setSaving(true);
    try {
      await api.post('/uks/obat-masuk', { ...masukForm, jumlah: Number(masukForm.jumlah) });
      toast.success('Obat masuk berhasil dicatat');
      setShowMasukModal(false);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMasuk = async (id) => {
    if (!(await confirmDialog('Yakin ingin menghapus data ini? Stok akan disesuaikan kembali.'))) return;
    try {
      await api.delete(`/uks/obat-masuk/${id}`);
      toast.success('Data obat masuk dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data');
    }
  };

  // Obat keluar handlers
  const openKeluarModal = () => { setKeluarForm(emptyKeluarForm); setShowKeluarModal(true); };

  const handleSaveKeluar = async () => {
    if (!keluarForm.obat_id || !keluarForm.jumlah) { toast.error('Obat dan jumlah wajib diisi'); return; }
    setSaving(true);
    try {
      await api.post('/uks/obat-keluar', { ...keluarForm, jumlah: Number(keluarForm.jumlah) });
      toast.success('Obat keluar berhasil dicatat');
      setShowKeluarModal(false);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKeluar = async (id) => {
    if (!(await confirmDialog('Yakin ingin menghapus data ini? Stok akan disesuaikan kembali.'))) return;
    try {
      await api.delete(`/uks/obat-keluar/${id}`);
      toast.success('Data obat keluar dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data');
    }
  };

  const openGabung = (items) => setGabung({ items, target_id: items[0]?.id });

  const handleGabung = async () => {
    if (!gabung?.target_id) return;
    const sumber = gabung.items.filter((i) => i.id !== gabung.target_id);
    const target = gabung.items.find((i) => i.id === gabung.target_id);
    if (!(await confirmDialog(`Gabungkan ${sumber.map((i) => `"${i.nama_obat}"`).join(', ')} ke "${target?.nama_obat}"? Semua batch, obat keluar, dan riwayat penanganan dipindahkan; stok tidak berubah.`))) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/uks/obat/${gabung.target_id}/gabung`, { sumber_ids: sumber.map((i) => i.id) });
      toast.success(data?.message || 'Data obat digabung');
      setGabung(null);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menggabungkan data');
    } finally {
      setSaving(false);
    }
  };

  const keluarObat = obatList.find((o) => o.id === keluarForm.obat_id);
  const filteredObat = obatList.filter((o) => !search || (o.nama_obat || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6" data-testid="admin-uks-obat-page">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <Pill className="h-3 w-3 mr-1" /> Menu UKS
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Data Obat</h1>
        <p className="text-sm text-slate-600 mt-1">Kelola daftar obat, obat masuk, dan obat keluar</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white border border-slate-200">
          <TabsTrigger value="daftar"><Pill className="h-4 w-4 mr-2" /> Daftar Obat ({obatList.length})</TabsTrigger>
          <TabsTrigger value="masuk"><ArrowDownCircle className="h-4 w-4 mr-2" /> Obat Masuk ({masukList.length})</TabsTrigger>
          <TabsTrigger value="keluar"><ArrowUpCircle className="h-4 w-4 mr-2" /> Obat Keluar ({keluarList.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="daftar" className="mt-4 space-y-4">
          {gandaList.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2" data-testid="obat-ganda-banner">
              <div className="flex items-start gap-2 text-amber-900">
                <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold">Ada {gandaList.length} nama obat yang terdaftar ganda</div>
                  <p className="text-sm">Gabungkan agar obat tampil satu kali saat dipilih dan stok batch-nya menyatu.</p>
                </div>
              </div>
              {gandaList.map((g) => (
                <div key={g.nama_key} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white/70 px-3 py-2 text-sm">
                  <span>{g.items.map((i) => `${i.nama_obat} (stok ${i.stok_tersisa})`).join(' · ')}</span>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openGabung(g.items)}><Merge className="h-4 w-4" /> Gabungkan</Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Cari nama obat..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Button onClick={() => openObatModal()} className="gap-2 bg-[#006837] hover:bg-[#005830]">
              <Plus className="h-4 w-4" /> Tambah Obat
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" /><p className="text-slate-500">Memuat data...</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama Obat</TableHead>
                        <TableHead>Jenis</TableHead>
                        <TableHead>Untuk Penanganan</TableHead>
                        <TableHead>Dosis</TableHead>
                        <TableHead className="text-center">Stok Layak Pakai</TableHead>
                        <TableHead className="text-center">Stok Terpakai</TableHead>
                        <TableHead className="text-center">Stok Min</TableHead>
                        <TableHead>Kadaluarsa Terdekat</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredObat.length === 0 ? (
                        <TableRow><TableCell colSpan={9} className="text-center py-12 text-slate-500">
                          <Pill className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                          <div className="font-semibold">Belum ada data obat</div>
                        </TableCell></TableRow>
                      ) : (
                        filteredObat.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-semibold">{item.nama_obat}</TableCell>
                            <TableCell>{item.jenis || '-'}</TableCell>
                            <TableCell className="max-w-xs"><div className="line-clamp-2">{item.untuk_penanganan || '-'}</div></TableCell>
                            <TableCell className="max-w-xs"><div className="line-clamp-2">{item.dosis || '-'}</div></TableCell>
                            <TableCell className="text-center">
                              <Badge className={item.stok_menipis ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}>
                                {item.stok_tersisa ?? 0} {item.satuan}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center font-mono">{item.stok_terpakai ?? 0}</TableCell>
                            <TableCell className="text-center font-mono">{item.stok_minimum}</TableCell>
                            <TableCell><KadaluarsaCell item={item} /></TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button size="icon" variant="ghost" onClick={() => openObatModal(item)} className="text-blue-600 hover:text-blue-700"><Pencil className="h-4 w-4" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => handleDeleteObat(item.id)} className="text-rose-600 hover:text-rose-700"><Trash2 className="h-4 w-4" /></Button>
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

        <TabsContent value="masuk" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={openMasukModal} className="gap-2 bg-[#006837] hover:bg-[#005830]"><Plus className="h-4 w-4" /> Catat Obat Masuk</Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Obat</TableHead>
                      <TableHead className="text-center">Jumlah</TableHead>
                      <TableHead className="text-center">Sisa Batch</TableHead>
                      <TableHead>Kadaluarsa</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sumber</TableHead>
                      <TableHead>Petugas</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {masukList.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-12 text-slate-500">Belum ada data obat masuk</TableCell></TableRow>
                    ) : (
                      masukList.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono">{item.tanggal}</TableCell>
                          <TableCell className="font-semibold">{item.obat_nama}</TableCell>
                          <TableCell className="text-center"><Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">+{item.jumlah}</Badge></TableCell>
                          <TableCell className="text-center font-mono">{item.stok_sisa}</TableCell>
                          <TableCell className="font-mono">{formatED(item.tanggal_kadaluarsa)}</TableCell>
                          <TableCell><BatchStatusBadge batch={item} /></TableCell>
                          <TableCell>{item.sumber || '-'}</TableCell>
                          <TableCell>{item.petugas_nama || '-'}</TableCell>
                          <TableCell className="text-right">
                            <Button size="icon" variant="ghost" onClick={() => handleDeleteMasuk(item.id)} className="text-rose-600 hover:text-rose-700"><Trash2 className="h-4 w-4" /></Button>
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

        <TabsContent value="keluar" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={openKeluarModal} className="gap-2 bg-[#006837] hover:bg-[#005830]"><Plus className="h-4 w-4" /> Catat Obat Keluar</Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Obat</TableHead>
                      <TableHead className="text-center">Jumlah</TableHead>
                      <TableHead>Penerima</TableHead>
                      <TableHead>Petugas</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keluarList.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500">Belum ada data obat keluar</TableCell></TableRow>
                    ) : (
                      keluarList.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono">{item.tanggal}</TableCell>
                          <TableCell className="font-semibold">{item.obat_nama}</TableCell>
                          <TableCell className="text-center"><Badge className="bg-rose-100 text-rose-700 border-rose-200">-{item.jumlah}</Badge></TableCell>
                          <TableCell>{item.penerima_nama || '-'}</TableCell>
                          <TableCell>{item.petugas_nama || '-'}</TableCell>
                          <TableCell className="text-right">
                            <Button size="icon" variant="ghost" onClick={() => handleDeleteKeluar(item.id)} className="text-rose-600 hover:text-rose-700"><Trash2 className="h-4 w-4" /></Button>
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

      {/* Obat Modal */}
      <Dialog open={showObatModal} onOpenChange={setShowObatModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editingObat ? 'Edit Obat' : 'Tambah Obat Baru'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nama Obat <span className="text-rose-500">*</span></Label>
              <Input value={obatForm.nama_obat} onChange={(e) => setObatForm({ ...obatForm, nama_obat: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Jenis</Label>
                <Input value={obatForm.jenis} onChange={(e) => setObatForm({ ...obatForm, jenis: e.target.value })} placeholder="Tablet, Sirup, dsb" />
              </div>
              <div className="space-y-2">
                <Label>Satuan</Label>
                <Input value={obatForm.satuan} onChange={(e) => setObatForm({ ...obatForm, satuan: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Untuk Penanganan</Label>
              <Input value={obatForm.untuk_penanganan} onChange={(e) => setObatForm({ ...obatForm, untuk_penanganan: e.target.value })} placeholder="Contoh: Meredakan demam dan nyeri ringan" />
            </div>
            <div className="space-y-2">
              <Label>Dosis</Label>
              <Input value={obatForm.dosis} onChange={(e) => setObatForm({ ...obatForm, dosis: e.target.value })} placeholder="Contoh: 1 tablet tiap 6 jam setelah makan" />
            </div>
            <div className="space-y-2">
              <Label>Stok Minimum</Label>
              <Input type="number" min="0" value={obatForm.stok_minimum} onChange={(e) => setObatForm({ ...obatForm, stok_minimum: e.target.value })} />
              <p className="text-xs text-slate-500">Ambang batas untuk peringatan "Stok Menipis". Stok aktual dikelola lewat tab Obat Masuk.</p>
            </div>
            <div className="space-y-2">
              <Label>Keterangan</Label>
              <Textarea rows={2} value={obatForm.keterangan} onChange={(e) => setObatForm({ ...obatForm, keterangan: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowObatModal(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleSaveObat} disabled={saving} className="gap-2 bg-[#006837] hover:bg-[#005830]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Obat Masuk Modal */}
      <Dialog open={showMasukModal} onOpenChange={setShowMasukModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Catat Obat Masuk</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Obat <span className="text-rose-500">*</span></Label>
              <Select value={masukForm.obat_id || 'none'} onValueChange={(v) => setMasukForm({ ...masukForm, obat_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Pilih Obat" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih Obat</SelectItem>
                  {obatList.map((o) => <SelectItem key={o.id} value={o.id}>{labelPilihanStok(o.nama_obat, o)}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">Obat yang sama cukup dipilih di sini — tiap pencatatan menjadi batch baru dengan tanggal kadaluarsanya sendiri.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tanggal <span className="text-rose-500">*</span></Label>
                <Input type="date" value={masukForm.tanggal} onChange={(e) => setMasukForm({ ...masukForm, tanggal: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Jumlah <span className="text-rose-500">*</span></Label>
                <Input type="number" min="1" value={masukForm.jumlah} onChange={(e) => setMasukForm({ ...masukForm, jumlah: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tanggal Kadaluarsa</Label>
              <Input type="date" value={masukForm.tanggal_kadaluarsa} onChange={(e) => setMasukForm({ ...masukForm, tanggal_kadaluarsa: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Sumber</Label>
              <Input value={masukForm.sumber} onChange={(e) => setMasukForm({ ...masukForm, sumber: e.target.value })} placeholder="Pembelian, Donasi, Puskesmas" />
            </div>
            <div className="space-y-2">
              <Label>Keterangan</Label>
              <Textarea rows={2} value={masukForm.keterangan} onChange={(e) => setMasukForm({ ...masukForm, keterangan: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMasukModal(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleSaveMasuk} disabled={saving} className="gap-2 bg-[#006837] hover:bg-[#005830]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Obat Keluar Modal */}
      <Dialog open={showKeluarModal} onOpenChange={setShowKeluarModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Catat Obat Keluar</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Obat <span className="text-rose-500">*</span></Label>
              <Select value={keluarForm.obat_id || 'none'} onValueChange={(v) => setKeluarForm({ ...keluarForm, obat_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Pilih Obat" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih Obat</SelectItem>
                  {obatList.map((o) => (
                    <SelectItem key={o.id} value={o.id} disabled={!(o.stok_tersisa > 0)}>{labelPilihanStok(o.nama_obat, o)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tanggal <span className="text-rose-500">*</span></Label>
                <Input type="date" value={keluarForm.tanggal} onChange={(e) => setKeluarForm({ ...keluarForm, tanggal: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Jumlah <span className="text-rose-500">*</span></Label>
                <Input type="number" min="1" max={keluarObat?.stok_tersisa || undefined} value={keluarForm.jumlah} onChange={(e) => setKeluarForm({ ...keluarForm, jumlah: e.target.value })} />
              </div>
            </div>
            {keluarObat && <RencanaPotongHint item={keluarObat} jumlah={keluarForm.jumlah} />}
            <div className="space-y-2">
              <Label>Keterangan</Label>
              <Textarea rows={2} value={keluarForm.keterangan} onChange={(e) => setKeluarForm({ ...keluarForm, keterangan: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowKeluarModal(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleSaveKeluar} disabled={saving} className="gap-2 bg-[#006837] hover:bg-[#005830]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gabung Obat Ganda */}
      <Dialog open={!!gabung} onOpenChange={(o) => !o && setGabung(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Gabungkan Obat Ganda</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-slate-600">Pilih nama yang dipertahankan. Data lain dipindahkan ke nama ini lalu dihapus.</p>
            {(gabung?.items || []).map((i) => (
              <label key={i.id} className={`flex items-center justify-between gap-3 rounded-md border p-3 cursor-pointer ${gabung.target_id === i.id ? 'border-[#006837] bg-[#006837]/5' : 'border-slate-200'}`}>
                <span className="flex items-center gap-2">
                  <input type="radio" name="gabung-target" checked={gabung.target_id === i.id} onChange={() => setGabung({ ...gabung, target_id: i.id })} />
                  <span className="font-semibold">{i.nama_obat}</span>
                </span>
                <span className="text-xs text-slate-500">{i.jumlah_batch} batch · stok {i.stok_tersisa}{i.stok_kadaluarsa ? ` · ${i.stok_kadaluarsa} kadaluarsa` : ''}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGabung(null)} disabled={saving}>Batal</Button>
            <Button onClick={handleGabung} disabled={saving} className="gap-2 bg-[#006837] hover:bg-[#005830]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Merge className="h-4 w-4" />} Gabungkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
