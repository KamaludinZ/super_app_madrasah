import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ClipboardCheck, Plus, Pencil, Trash2, Loader2, Save, Search } from 'lucide-react';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { api } from '@/lib/api';

const emptyForm = { kode: '', nama: '', kategori: '', deskripsi: '', urutan: 0, aktif: true };

const KATEGORI_DIAGNOSA = ['Gejala Umum', 'Pernapasan', 'Pencernaan', 'Cedera', 'Kulit', 'Mata & THT', 'Gigi & Mulut', 'Reproduksi', 'Lainnya'];

const validateForm = (form, list, editingId) => {
  const errors = {};
  const nama = form.nama.trim().toLowerCase();
  const kode = form.kode.trim().toUpperCase();
  const others = list.filter((d) => d.id !== editingId);
  if (!nama) errors.nama = 'Nama diagnosa wajib diisi';
  else if (others.some((d) => (d.nama || '').trim().toLowerCase() === nama)) errors.nama = 'Nama diagnosa sudah terdaftar';
  if (kode) {
    if (!/^[A-Z0-9.\-]{1,10}$/.test(kode)) errors.kode = 'Kode hanya huruf, angka, titik, atau strip (maks. 10)';
    else if (others.some((d) => (d.kode || '').trim().toUpperCase() === kode)) errors.kode = 'Kode sudah dipakai diagnosa lain';
  }
  if (!form.kategori.trim()) errors.kategori = 'Kategori wajib dipilih';
  const urutan = Number(form.urutan);
  if (form.urutan === '' || !Number.isInteger(urutan) || urutan < 0) errors.urutan = 'Urutan harus bilangan bulat 0 atau lebih';
  return errors;
};

export default function AdminUKSDiagnosaPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [search, setSearch] = useState('');
  const [kategoriFilter, setKategoriFilter] = useState('semua');
  const [statusFilter, setStatusFilter] = useState('semua');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/uks/diagnosa');
      setList(res.data || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal memuat data penegakan diagnosa');
    } finally {
      setLoading(false);
    }
  };

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const kategoriOptions = [...new Set([...KATEGORI_DIAGNOSA, ...list.map((d) => d.kategori).filter(Boolean)])];

  const openModal = (item = null) => {
    if (item) {
      setEditing(item);
      setForm({ kode: item.kode || '', nama: item.nama || '', kategori: item.kategori || '', deskripsi: item.deskripsi || '', urutan: item.urutan || 0, aktif: item.aktif !== false });
    } else {
      setEditing(null);
      setForm({ ...emptyForm, urutan: list.length + 1 });
    }
    setErrors({});
    setShowModal(true);
  };

  const toPayload = (f) => ({
    kode: f.kode.trim().toUpperCase() || null,
    nama: f.nama.trim(),
    kategori: f.kategori.trim(),
    deskripsi: f.deskripsi.trim() || null,
    urutan: Number(f.urutan),
    aktif: f.aktif,
  });

  const handleSave = async () => {
    const found = validateForm(form, list, editing?.id);
    setErrors(found);
    if (Object.keys(found).length) { toast.error('Periksa kembali isian form'); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/uks/diagnosa/${editing.id}`, toPayload(form));
        toast.success('Penegakan diagnosa berhasil diperbarui');
      } else {
        await api.post('/uks/diagnosa', toPayload(form));
        toast.success('Penegakan diagnosa berhasil ditambahkan');
      }
      setShowModal(false);
      loadData();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      if (typeof detail === 'string') {
        if (detail.toLowerCase().includes('kode')) setErrors({ kode: detail });
        else if (detail.toLowerCase().includes('nama')) setErrors({ nama: detail });
      }
      toast.error(detail || 'Gagal menyimpan penegakan diagnosa');
    } finally {
      setSaving(false);
    }
  };

  // Menonaktifkan diagnosa tidak menghapus data kunjungan lama; hanya menyembunyikan
  // diagnosa dari pilihan form penanganan.
  const handleToggleAktif = async (item) => {
    const nextAktif = item.aktif === false;
    if (!nextAktif && !(await confirmDialog(`Nonaktifkan diagnosa "${item.nama}"? Diagnosa tidak akan muncul lagi sebagai pilihan di form penanganan.`))) return;
    setTogglingId(item.id);
    try {
      await api.put(`/uks/diagnosa/${item.id}`, toPayload({
        kode: item.kode || '', nama: item.nama || '', kategori: item.kategori || 'Lainnya',
        deskripsi: item.deskripsi || '', urutan: item.urutan || 0, aktif: nextAktif,
      }));
      setList((l) => l.map((d) => (d.id === item.id ? { ...d, aktif: nextAktif } : d)));
      toast.success(nextAktif ? 'Diagnosa diaktifkan' : 'Diagnosa dinonaktifkan');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal mengubah status diagnosa');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirmDialog('Yakin ingin menghapus penegakan diagnosa ini?'))) return;
    try {
      await api.delete(`/uks/diagnosa/${id}`);
      toast.success('Penegakan diagnosa dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus penegakan diagnosa');
    }
  };

  const q = search.trim().toLowerCase();
  const filtered = [...list]
    .filter((d) => !q || (d.nama || '').toLowerCase().includes(q) || (d.kode || '').toLowerCase().includes(q))
    .filter((d) => kategoriFilter === 'semua' || d.kategori === kategoriFilter)
    .filter((d) => statusFilter === 'semua' || (statusFilter === 'aktif' ? d.aktif !== false : d.aktif === false))
    .sort((a, b) => (a.urutan || 0) - (b.urutan || 0));

  return (
    <div className="space-y-6" data-testid="admin-uks-diagnosa-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <ClipboardCheck className="h-3 w-3 mr-1" /> Menu UKS
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Penegakan Diagnosa</h1>
          <p className="text-sm text-slate-600 mt-1">Kelola daftar diagnosa yang dipilih petugas saat mengisi penanganan kunjungan UKS</p>
        </div>
        <Button onClick={() => openModal()} className="gap-2 bg-[#006837] hover:bg-[#005830]">
          <Plus className="h-4 w-4" /> Tambah Diagnosa
        </Button>
      </div>


      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Cari nama atau kode diagnosa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={kategoriFilter} onValueChange={setKategoriFilter}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua Kategori</SelectItem>
            {kategoriOptions.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua Status</SelectItem>
            <SelectItem value="aktif">Aktif ({list.filter((d) => d.aktif !== false).length})</SelectItem>
            <SelectItem value="nonaktif">Nonaktif ({list.filter((d) => d.aktif === false).length})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">NO</TableHead>
                  <TableHead className="w-24">KODE</TableHead>
                  <TableHead>NAMA DIAGNOSA</TableHead>
                  <TableHead>KATEGORI</TableHead>
                  <TableHead>DESKRIPSI</TableHead>
                  <TableHead className="w-28 text-center">AKTIF</TableHead>
                  <TableHead className="text-right">AKSI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                      <ClipboardCheck className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                      {loading ? (
                        <div className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-[#006837]" /> Memuat data...</div>
                      ) : (
                        <>
                          <div className="font-semibold">{list.length === 0 ? 'Belum ada penegakan diagnosa' : 'Tidak ada diagnosa yang cocok dengan filter'}</div>
                          {list.length === 0 && <div className="text-xs mt-1">Klik "Tambah Diagnosa" untuk memulai</div>}
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item, idx) => (
                    <TableRow key={item.id} className={item.aktif === false ? 'opacity-60' : ''}>
                      <TableCell className="text-center text-slate-500 font-mono">{idx + 1}</TableCell>
                      <TableCell className="font-mono">{item.kode || '-'}</TableCell>
                      <TableCell className="font-semibold">{item.nama}</TableCell>
                      <TableCell>{item.kategori || '-'}</TableCell>
                      <TableCell className="max-w-md"><div className="line-clamp-2">{item.deskripsi || '-'}</div></TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Switch
                            checked={item.aktif !== false}
                            disabled={togglingId === item.id}
                            onCheckedChange={() => handleToggleAktif(item)}
                            aria-label={item.aktif === false ? `Aktifkan ${item.nama}` : `Nonaktifkan ${item.nama}`}
                          />
                          <span className={`text-xs ${item.aktif === false ? 'text-slate-500' : 'text-emerald-700'}`}>{item.aktif === false ? 'Nonaktif' : 'Aktif'}</span>
                        </div>
                      </TableCell>
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
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Penegakan Diagnosa' : 'Tambah Penegakan Diagnosa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Kode</Label>
                <Input value={form.kode} onChange={(e) => setField('kode', e.target.value.toUpperCase())} placeholder="ICD-10" aria-invalid={!!errors.kode} />
                {errors.kode && <p className="text-xs text-rose-600">{errors.kode}</p>}
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Nama Diagnosa <span className="text-rose-500">*</span></Label>
                <Input value={form.nama} onChange={(e) => setField('nama', e.target.value)} placeholder="Contoh: Demam, Dispepsia" aria-invalid={!!errors.nama} />
                {errors.nama && <p className="text-xs text-rose-600">{errors.nama}</p>}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2 col-span-2">
                <Label>Kategori <span className="text-rose-500">*</span></Label>
                <Select value={form.kategori || 'none'} onValueChange={(v) => setField('kategori', v === 'none' ? '' : v)}>
                  <SelectTrigger aria-invalid={!!errors.kategori}><SelectValue placeholder="Pilih Kategori" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Pilih Kategori</SelectItem>
                    {kategoriOptions.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.kategori && <p className="text-xs text-rose-600">{errors.kategori}</p>}
              </div>
              <div className="space-y-2">
                <Label>Urutan</Label>
                <Input type="number" min="0" step="1" value={form.urutan} onChange={(e) => setField('urutan', e.target.value)} aria-invalid={!!errors.urutan} />
                {errors.urutan && <p className="text-xs text-rose-600">{errors.urutan}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Textarea rows={3} value={form.deskripsi} onChange={(e) => setField('deskripsi', e.target.value)} placeholder="Ciri atau kriteria diagnosa (opsional)" />
            </div>
            <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
              <div>
                <Label>Aktif</Label>
                <p className="text-xs text-slate-500">Diagnosa nonaktif tidak muncul sebagai pilihan di form penanganan.</p>
              </div>
              <Switch checked={form.aktif} onCheckedChange={(v) => setField('aktif', v)} />
            </div>
          </div>
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
