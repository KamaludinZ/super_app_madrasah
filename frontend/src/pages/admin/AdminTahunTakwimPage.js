import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Calendar, Check, Trash2, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function AdminTahunTakwimPage() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    year: new Date().getFullYear(),
    name: '',
    start_date: '',
    end_date: '',
    is_active: false,
  });

  const refresh = async () => {
    const { data } = await api.get('/tahun-takwim');
    setItems(data);
  };
  useEffect(() => { refresh(); }, []);

  const openCreate = () => {
    setEditing(null);
    const year = new Date().getFullYear();
    setForm({
      year,
      name: `Tahun ${year}`,
      start_date: `${year}-01-01`,
      end_date: `${year}-12-31`,
      is_active: false,
    });
    setOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      year: item.year,
      name: item.name,
      start_date: item.start_date,
      end_date: item.end_date,
      is_active: item.is_active,
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.year || !form.name || !form.start_date || !form.end_date) {
      toast.error('Semua field wajib diisi');
      return;
    }
    try {
      if (editing) {
        await api.put(`/tahun-takwim/${editing.id}`, form);
        toast.success('Tahun Takwim diperbarui');
      } else {
        await api.post('/tahun-takwim', form);
        toast.success('Tahun Takwim ditambahkan');
      }
      setOpen(false);
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan');
    }
  };

  const handleActivate = async (item) => {
    if (!window.confirm(`Aktifkan ${item.name}?`)) return;
    try {
      await api.post(`/tahun-takwim/${item.id}/set-active`);
      toast.success('Diaktifkan');
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal mengaktifkan');
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Hapus ${item.name}?`)) return;
    try {
      await api.delete(`/tahun-takwim/${item.id}`);
      toast.success('Dihapus');
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <Calendar className="h-3 w-3 mr-1" /> Tahun Takwim
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold">Kelola Tahun Takwim</h1>
          <p className="text-sm text-slate-600 mt-1">
            Tahun Takwim mengatur kalender umum aplikasi (Januari - Desember). Digunakan untuk laporan keuangan dan anggaran tahunan.
          </p>
        </div>
        <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2">
          <Plus className="h-4 w-4" /> Tambah
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tahun</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono font-semibold">{item.year}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {new Date(item.start_date).toLocaleDateString('id-ID')} - {new Date(item.end_date).toLocaleDateString('id-ID')}
                    </TableCell>
                    <TableCell>
                      {item.is_active ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Aktif</Badge>
                      ) : (
                        <Badge variant="outline">Arsip</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => openEdit(item)} className="gap-1 mr-1">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      {!item.is_active && (
                        <Button size="sm" variant="outline" onClick={() => handleActivate(item)} className="gap-1 mr-1">
                          <Check className="h-3.5 w-3.5" /> Aktifkan
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(item)} className="text-rose-600">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Tahun Takwim' : 'Tambah Tahun Takwim'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tahun *</Label>
              <Input
                type="number"
                value={form.year}
                onChange={(e) => {
                  const year = parseInt(e.target.value);
                  setForm({
                    ...form,
                    year,
                    name: `Tahun ${year}`,
                    start_date: `${year}-01-01`,
                    end_date: `${year}-12-31`,
                  });
                }}
                placeholder="2026"
              />
              <p className="text-xs text-slate-500 mt-1">Contoh: 2026</p>
            </div>
            <div>
              <Label>Nama *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Tahun 2026"
              />
              <p className="text-xs text-slate-500 mt-1">Nama deskriptif untuk tahun ini</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tanggal Mulai *</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Tanggal Selesai *</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              <span className="text-sm">Set sebagai Tahun Takwim aktif (akan menonaktifkan tahun lain)</span>
            </label>
            <div className="rounded-lg border border-blue-200 p-3 bg-blue-50">
              <p className="text-xs text-blue-800">
                <strong>Info:</strong> Tahun Takwim mengatur kalender umum aplikasi. Tahun Pelajaran bisa melintasi 2 Tahun Takwim (contoh: 2025/2026).
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} className="bg-[#006837]">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
