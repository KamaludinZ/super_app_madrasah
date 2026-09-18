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
import { Stethoscope, History, Plus, Pencil, Trash2, Loader2, Save, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const KONDISI_PULANG_LIST = ['Membaik', 'Dirujuk', 'Dijemput Orang Tua', 'Istirahat di UKS'];

const emptyForm = {
  pasien_id: '',
  tanggal: new Date().toISOString().split('T')[0],
  waktu: '',
  keluhan: '',
  jenis_penanganan_id: '',
  penanganan: '',
  kondisi_pulang: '',
  dirujuk_ke: '',
  keterangan: '',
};

export default function AdminUKSKunjunganPage() {
  const [tab, setTab] = useState('input');
  const [list, setList] = useState([]);
  const [wargaList, setWargaList] = useState([]);
  const [jenisList, setJenisList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, wargaRes, jenisRes] = await Promise.all([
        api.get('/uks/kunjungan'),
        api.get('/uks/warga-madrasah'),
        api.get('/uks/jenis-penanganan'),
      ]);
      setList(res.data || []);
      setWargaList(wargaRes.data || []);
      setJenisList(jenisRes.data || []);
    } catch (e) {
      toast.error('Gagal memuat data kunjungan UKS');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (item = null) => {
    if (item) {
      setEditing(item);
      setForm({
        pasien_id: item.pasien_id || '',
        tanggal: item.tanggal || '',
        waktu: item.waktu || '',
        keluhan: item.keluhan || '',
        jenis_penanganan_id: item.jenis_penanganan_id || '',
        penanganan: item.penanganan || '',
        kondisi_pulang: item.kondisi_pulang || '',
        dirujuk_ke: item.dirujuk_ke || '',
        keterangan: item.keterangan || '',
      });
    } else {
      setEditing(null);
      setForm(emptyForm);
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.pasien_id || !form.tanggal || !form.keluhan) {
      toast.error('Pasien, tanggal, dan keluhan wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, jenis_penanganan_id: form.jenis_penanganan_id || null };
      if (editing) {
        await api.put(`/uks/kunjungan/${editing.id}`, payload);
        toast.success('Data kunjungan berhasil diperbarui');
      } else {
        await api.post('/uks/kunjungan', payload);
        toast.success('Data kunjungan berhasil ditambahkan');
      }
      setShowModal(false);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus data kunjungan ini?')) return;
    try {
      await api.delete(`/uks/kunjungan/${id}`);
      toast.success('Data kunjungan dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data');
    }
  };

  const filtered = list.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (item.pasien_nama || '').toLowerCase().includes(q) ||
      (item.keluhan || '').toLowerCase().includes(q);
  });

  const renderForm = () => (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Pasien <span className="text-rose-500">*</span></Label>
        <Select value={form.pasien_id || 'none'} onValueChange={(v) => setForm({ ...form, pasien_id: v === 'none' ? '' : v })}>
          <SelectTrigger><SelectValue placeholder="Pilih Pasien" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Pilih Pasien</SelectItem>
            {wargaList.map((w) => (
              <SelectItem key={w.id} value={w.id}>{w.full_name} {w.nis ? `(${w.nis})` : ''}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tanggal <span className="text-rose-500">*</span></Label>
          <Input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Waktu</Label>
          <Input type="time" value={form.waktu} onChange={(e) => setForm({ ...form, waktu: e.target.value })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Keluhan <span className="text-rose-500">*</span></Label>
        <Textarea rows={2} value={form.keluhan} onChange={(e) => setForm({ ...form, keluhan: e.target.value })} placeholder="Keluhan yang dialami pasien" />
      </div>
      <div className="space-y-2">
        <Label>Jenis Penanganan</Label>
        <Select value={form.jenis_penanganan_id || 'none'} onValueChange={(v) => setForm({ ...form, jenis_penanganan_id: v === 'none' ? '' : v })}>
          <SelectTrigger><SelectValue placeholder="Pilih Jenis Penanganan" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Pilih Jenis Penanganan</SelectItem>
            {jenisList.map((j) => <SelectItem key={j.id} value={j.id}>{j.nama}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Penanganan</Label>
        <Textarea rows={2} value={form.penanganan} onChange={(e) => setForm({ ...form, penanganan: e.target.value })} placeholder="Penanganan yang diberikan (opsional)" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Kondisi Pulang</Label>
          <Select value={form.kondisi_pulang || 'none'} onValueChange={(v) => setForm({ ...form, kondisi_pulang: v === 'none' ? '' : v })}>
            <SelectTrigger><SelectValue placeholder="Pilih Kondisi" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Pilih Kondisi</SelectItem>
              {KONDISI_PULANG_LIST.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Dirujuk Ke</Label>
          <Input value={form.dirujuk_ke} onChange={(e) => setForm({ ...form, dirujuk_ke: e.target.value })} placeholder="Jika dirujuk (opsional)" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Keterangan</Label>
        <Textarea rows={2} value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6" data-testid="admin-uks-kunjungan-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <Stethoscope className="h-3 w-3 mr-1" /> Menu UKS
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Data Kunjungan UKS</h1>
          <p className="text-sm text-slate-600 mt-1">Input kunjungan dan riwayat pelayanan kesehatan</p>
        </div>
        <Button onClick={() => openModal()} className="gap-2 bg-[#006837] hover:bg-[#005830]">
          <Plus className="h-4 w-4" /> Input Kunjungan
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white border border-slate-200">
          <TabsTrigger value="input"><Stethoscope className="h-4 w-4 mr-2" /> Input Kunjungan</TabsTrigger>
          <TabsTrigger value="riwayat"><History className="h-4 w-4 mr-2" /> Riwayat ({list.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="input" className="mt-4">
          <Card>
            <CardContent className="p-6">{renderForm()}
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} className="gap-2 bg-[#006837] hover:bg-[#005830]">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? 'Menyimpan...' : 'Simpan Kunjungan'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="riwayat" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="Cari pasien atau keluhan..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
            </CardContent>
          </Card>
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
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Pasien</TableHead>
                        <TableHead>Keluhan</TableHead>
                        <TableHead>Penanganan</TableHead>
                        <TableHead>Kondisi Pulang</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                            <History className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                            <div className="font-semibold">Belum ada riwayat kunjungan</div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono">{item.tanggal} {item.waktu ? `· ${item.waktu}` : ''}</TableCell>
                            <TableCell className="font-semibold">{item.pasien_nama}<div className="text-xs text-slate-500 font-normal">{item.pasien_identitas}</div></TableCell>
                            <TableCell className="max-w-xs"><div className="line-clamp-2">{item.keluhan}</div></TableCell>
                            <TableCell>{item.jenis_penanganan_nama || '-'}</TableCell>
                            <TableCell>{item.kondisi_pulang ? <Badge variant="outline">{item.kondisi_pulang}</Badge> : '-'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button size="icon" variant="ghost" onClick={() => openModal(item)} className="text-blue-600 hover:text-blue-700">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id)} className="text-rose-600 hover:text-rose-700">
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

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Kunjungan UKS' : 'Input Kunjungan UKS'}</DialogTitle>
          </DialogHeader>
          {renderForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2 bg-[#006837] hover:bg-[#005830]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
