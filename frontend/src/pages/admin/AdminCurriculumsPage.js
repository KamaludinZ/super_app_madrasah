import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, BookOpen } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

function emptyForm() {
  return { id: null, code: '', name: '', description: '' };
}

export default function AdminCurriculumsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/curriculums');
      setItems(data || []);
    } catch { toast.error('Gagal memuat kurikulum'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error('Kode dan nama wajib');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description.trim() || null,
      };
      if (form.id) {
        await api.put(`/curriculums/${form.id}`, payload);
        toast.success('Kurikulum diperbarui');
      } else {
        await api.post('/curriculums', payload);
        toast.success('Kurikulum ditambahkan');
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Hapus kurikulum "${name}"?`)) return;
    try {
      await api.delete(`/curriculums/${id}`);
      toast.success('Dihapus');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Tidak dapat dihapus');
    }
  };

  return (
    <div className="space-y-4" data-testid="admin-curriculums-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-[#006837]" /> Kurikulum
          </h1>
          <p className="text-sm text-slate-500">Kelola kurikulum yang dipakai di sekolah</p>
        </div>
        <Button onClick={() => { setForm(emptyForm()); setOpen(true); }} className="bg-[#006837] hover:bg-[#005a30]" data-testid="btn-add-curriculum">
          <Plus className="h-4 w-4 mr-1.5" /> Tambah Kurikulum
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Daftar Kurikulum ({items.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-slate-500">Memuat…</div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <BookOpen className="h-8 w-8 mx-auto text-slate-300 mb-2" />
              Belum ada kurikulum. Contoh: K-13, Kurikulum Merdeka, Kurikulum Madrasah.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((c) => (
                <div key={c.id} className="flex items-center gap-3 py-3" data-testid={`row-curriculum-${c.id}`}>
                  <div className="h-10 w-10 rounded-lg bg-[#006837]/10 text-[#006837] flex items-center justify-center">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{c.name}</span>
                      <Badge variant="outline" className="font-mono">{c.code}</Badge>
                    </div>
                    {c.description && <p className="text-xs text-slate-500 mt-0.5">{c.description}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setForm({ id: c.id, code: c.code, name: c.name, description: c.description || '' }); setOpen(true); }} data-testid={`btn-edit-curriculum-${c.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id, c.name)} data-testid={`btn-delete-curriculum-${c.id}`}>
                      <Trash2 className="h-4 w-4 text-rose-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{form.id ? 'Edit Kurikulum' : 'Tambah Kurikulum'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="cur-code">Kode * (UPPERCASE, unik)</Label>
              <Input id="cur-code" value={form.code}
                     onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                     placeholder="K13, KM, KMA" data-testid="input-curriculum-code" />
            </div>
            <div>
              <Label htmlFor="cur-name">Nama Kurikulum *</Label>
              <Input id="cur-name" value={form.name}
                     onChange={(e) => setForm({ ...form, name: e.target.value })}
                     placeholder="Kurikulum 2013 / Merdeka / Madrasah 2024" data-testid="input-curriculum-name" />
            </div>
            <div>
              <Label htmlFor="cur-desc">Deskripsi (opsional)</Label>
              <Input id="cur-desc" value={form.description}
                     onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#006837] hover:bg-[#005a30]" data-testid="btn-save-curriculum">
              {saving ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
