import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, Briefcase, Power } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function AdminJabatanPage() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    is_active: true,
  });

  const refresh = async () => {
    const { data } = await api.get('/jabatan');
    setItems(data);
  };

  useEffect(() => {
    refresh();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', category: '', is_active: true });
    setOpen(true);
  };

  const openEdit = (j) => {
    setEditing(j);
    setForm({
      name: j.name || '',
      description: j.description || '',
      category: j.category || '',
      is_active: j.is_active !== undefined ? j.is_active : true,
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name) {
      toast.error('Nama jabatan wajib diisi');
      return;
    }
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        category: form.category || null,
        is_active: form.is_active,
      };
      if (editing) {
        await api.put(`/jabatan/${editing.id}`, payload);
      } else {
        await api.post('/jabatan', payload);
      }
      toast.success('Jabatan berhasil disimpan');
      setOpen(false);
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan jabatan');
    }
  };

  const handleDelete = async (j) => {
    if (!window.confirm(`Hapus jabatan "${j.name}"? Pastikan tidak ada pengguna yang memiliki jabatan ini.`)) return;
    try {
      await api.delete(`/jabatan/${j.id}`);
      toast.success('Jabatan berhasil dihapus');
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus jabatan');
    }
  };

  const handleToggleActive = async (j) => {
    try {
      const { data } = await api.post(`/jabatan/${j.id}/toggle-active`);
      toast.success(data.message);
      refresh();
    } catch (e) {
      toast.error('Gagal mengubah status jabatan');
    }
  };

  const activeItems = items.filter((i) => i.is_active);
  const inactiveItems = items.filter((i) => !i.is_active);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-amber-600/10 text-amber-700 border-amber-600/20 mb-2">
            <Briefcase className="h-3 w-3 mr-1" /> Manajemen Jabatan
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold">Kelola Jabatan</h1>
          <p className="text-sm text-slate-600 mt-1">
            {activeItems.length} aktif • {inactiveItems.length} nonaktif
          </p>
        </div>
        <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="add-jabatan-button">
          <Plus className="h-4 w-4" /> Tambah Jabatan
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table data-testid="admin-jabatan-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Jabatan</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                      Belum ada data jabatan. Klik "Tambah Jabatan" untuk menambahkan.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((j) => (
                    <TableRow key={j.id} data-testid={`jabatan-row-${j.name}`}>
                      <TableCell className="font-semibold">{j.name}</TableCell>
                      <TableCell>
                        {j.category ? (
                          <Badge variant="outline" className="text-xs capitalize">
                            {j.category}
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-slate-600">
                        {j.description || '-'}
                      </TableCell>
                      <TableCell>
                        {j.is_active ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
                            Aktif
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-slate-200 text-slate-600">
                            Nonaktif
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleToggleActive(j)}
                          title={j.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                          className={j.is_active ? 'text-amber-600' : 'text-emerald-600'}
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(j)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(j)}
                          className="text-rose-600"
                          title="Hapus"
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
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Jabatan' : 'Tambah Jabatan'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nama Jabatan *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Kepala Sekolah, Wakil Kepala Kurikulum"
                data-testid="jabatan-form-name"
              />
            </div>
            <div>
              <Label>Kategori (opsional)</Label>
              <Select value={form.category || undefined} onValueChange={(v) => setForm({ ...form, category: v || null })}>
                <SelectTrigger data-testid="jabatan-form-category">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="struktural">Struktural</SelectItem>
                  <SelectItem value="fungsional">Fungsional</SelectItem>
                  <SelectItem value="koordinator">Koordinator</SelectItem>
                  <SelectItem value="penanggungjawab">Penanggung Jawab</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Deskripsi detail jabatan ini..."
                rows={3}
                data-testid="jabatan-form-description"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
                data-testid="jabatan-form-active"
              />
              <Label className="cursor-pointer">Jabatan aktif</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSubmit} className="bg-[#006837]" data-testid="jabatan-form-submit">
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
