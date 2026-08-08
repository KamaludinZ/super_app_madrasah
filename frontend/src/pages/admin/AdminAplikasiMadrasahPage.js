import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, ExternalLink, Globe, Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

function emptyForm() {
  return {
    id: null,
    name: '',
    description: '',
    url: '',
    icon_url: '',
    is_active: true,
    order: 0,
  };
}

export default function AdminAplikasiMadrasahPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/school-apps');
      setItems(data || []);
    } catch (e) {
      toast.error('Gagal memuat aplikasi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (app) => {
    setForm({
      id: app.id,
      name: app.name,
      description: app.description || '',
      url: app.url,
      icon_url: app.icon_url || '',
      is_active: app.is_active !== false,
      order: app.order || 0,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.url.trim()) {
      toast.error('Nama dan URL wajib diisi');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        url: form.url.trim(),
        icon_url: form.icon_url.trim(),
        is_active: form.is_active,
        order: parseInt(form.order) || 0,
      };

      if (form.id) {
        await api.put(`/admin/school-apps/${form.id}`, payload);
        toast.success('Aplikasi diperbarui');
      } else {
        await api.post('/admin/school-apps', payload);
        toast.success('Aplikasi ditambahkan');
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus aplikasi ini?')) return;
    try {
      await api.delete(`/admin/school-apps/${id}`);
      toast.success('Aplikasi dihapus');
      load();
    } catch (e) {
      toast.error('Gagal menghapus');
    }
  };

  const toggleActive = async (app) => {
    try {
      await api.put(`/admin/school-apps/${app.id}`, {
        ...app,
        is_active: !app.is_active,
      });
      toast.success(app.is_active ? 'Aplikasi dinonaktifkan' : 'Aplikasi diaktifkan');
      load();
    } catch (e) {
      toast.error('Gagal mengubah status');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Globe className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <CardTitle>Aplikasi Madrasah</CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Kelola aplikasi dan link eksternal untuk siswa
              </p>
            </div>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Tambah Aplikasi
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-slate-500 py-8">Memuat...</p>
          ) : items.length === 0 ? (
            <p className="text-center text-slate-500 py-8">Belum ada aplikasi</p>
          ) : (
            <div className="space-y-3">
              {items.map((app) => (
                <div
                  key={app.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                >
                  {app.icon_url && (
                    <img
                      src={app.icon_url}
                      alt={app.name}
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  )}
                  {!app.icon_url && (
                    <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Globe className="h-6 w-6 text-purple-600" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{app.name}</h3>
                      {app.is_active ? (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-600">
                          <Eye className="h-3 w-3 mr-1" />
                          Aktif
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-500">
                          <EyeOff className="h-3 w-3 mr-1" />
                          Nonaktif
                        </Badge>
                      )}
                      {app.order > 0 && (
                        <Badge variant="outline" className="text-xs">
                          Urutan: {app.order}
                        </Badge>
                      )}
                    </div>
                    {app.description && (
                      <p className="text-sm text-slate-600 mt-1">{app.description}</p>
                    )}
                    <a
                      href={app.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {app.url}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleActive(app)}
                    >
                      {app.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(app)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(app.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {form.id ? 'Edit Aplikasi' : 'Tambah Aplikasi'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nama Aplikasi *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. E-Learning"
              />
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Deskripsi singkat aplikasi"
                rows={3}
              />
            </div>
            <div>
              <Label>URL Aplikasi *</Label>
              <Input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://elearning.mtsn2kotamalang.sch.id"
              />
            </div>
            <div>
              <Label>URL Icon/Logo</Label>
              <Input
                value={form.icon_url}
                onChange={(e) => setForm({ ...form, icon_url: e.target.value })}
                placeholder="https://example.com/logo.png"
              />
              <p className="text-xs text-slate-500 mt-1">
                Kosongkan untuk menggunakan icon default
              </p>
            </div>
            <div>
              <Label>Urutan Tampilan</Label>
              <Input
                type="number"
                value={form.order}
                onChange={(e) => setForm({ ...form, order: e.target.value })}
                placeholder="0"
              />
              <p className="text-xs text-slate-500 mt-1">
                Aplikasi dengan urutan lebih kecil akan ditampilkan lebih awal
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
              <Label>Aktifkan aplikasi</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
