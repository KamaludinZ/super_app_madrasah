import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Megaphone, Pin, Eye, EyeOff } from 'lucide-react';
import { api, ROLE_LABELS } from '@/lib/api';
import { toast } from 'sonner';

const SEVERITIES = [
  { v: 'info', label: 'Info', color: 'bg-sky-100 text-sky-800' },
  { v: 'success', label: 'Sukses', color: 'bg-emerald-100 text-emerald-800' },
  { v: 'warning', label: 'Peringatan', color: 'bg-amber-100 text-amber-800' },
  { v: 'critical', label: 'Penting', color: 'bg-rose-100 text-rose-800' },
];

const ALL_ROLES = [
  'admin', 'guru', 'wali_kelas', 'siswa', 'tenaga_kependidikan',
  'guru_piket', 'guru_bk', 'guru_tata_tertib', 'guru_ekstrakurikuler',
];

function emptyForm() {
  return {
    id: null, title: '', body: '',
    target_roles: ['all'], severity: 'info',
    is_active: true, is_pinned: false,
    starts_at: '', ends_at: '',
  };
}

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/announcements');
      setItems(data || []);
    } catch { toast.error('Gagal memuat'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(emptyForm()); setOpen(true); };

  const openEdit = (a) => {
    setForm({
      id: a.id, title: a.title, body: a.body,
      target_roles: a.target_roles?.length ? a.target_roles : ['all'],
      severity: a.severity || 'info',
      is_active: !!a.is_active, is_pinned: !!a.is_pinned,
      starts_at: a.starts_at || '', ends_at: a.ends_at || '',
    });
    setOpen(true);
  };

  const toggleRole = (r) => {
    setForm((f) => {
      let roles = [...f.target_roles];
      if (r === 'all') {
        return { ...f, target_roles: ['all'] };
      }
      roles = roles.filter((x) => x !== 'all');
      if (roles.includes(r)) roles = roles.filter((x) => x !== r);
      else roles.push(r);
      if (roles.length === 0) roles = ['all'];
      return { ...f, target_roles: roles };
    });
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error('Judul dan isi wajib');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(), body: form.body.trim(),
        target_roles: form.target_roles,
        severity: form.severity,
        is_active: form.is_active, is_pinned: form.is_pinned,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
      };
      if (form.id) {
        await api.put(`/admin/announcements/${form.id}`, payload);
        toast.success('Pengumuman diperbarui');
      } else {
        await api.post('/admin/announcements', payload);
        toast.success('Pengumuman dibuat');
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus pengumuman ini?')) return;
    try {
      await api.delete(`/admin/announcements/${id}`);
      toast.success('Dihapus');
      load();
    } catch (e) { toast.error('Gagal menghapus'); }
  };

  const togglePin = async (a) => {
    try {
      await api.put(`/admin/announcements/${a.id}`, { is_pinned: !a.is_pinned });
      load();
    } catch (e) { toast.error('Gagal'); }
  };

  const toggleActive = async (a) => {
    try {
      await api.put(`/admin/announcements/${a.id}`, { is_active: !a.is_active });
      load();
    } catch (e) { toast.error('Gagal'); }
  };

  return (
    <div className="space-y-4" data-testid="admin-announcements-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-[#006837]" /> Kelola Pengumuman
          </h1>
          <p className="text-sm text-slate-500">Buat & kelola pengumuman untuk peran tertentu</p>
        </div>
        <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#005a30]" data-testid="btn-create-announcement">
          <Plus className="h-4 w-4 mr-1.5" /> Buat Pengumuman
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Daftar Pengumuman ({items.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-slate-500">Memuat…</div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Megaphone className="h-8 w-8 mx-auto text-slate-300 mb-2" />
              Belum ada pengumuman. Klik "Buat Pengumuman" untuk mulai.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((a) => (
                <div key={a.id} data-testid={`row-announcement-${a.id}`}
                     className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50">
                  <div className="flex flex-col items-center gap-1 pt-0.5">
                    <button onClick={() => togglePin(a)} title={a.is_pinned ? 'Lepas pin' : 'Pin'}>
                      <Pin className={`h-4 w-4 ${a.is_pinned ? 'text-amber-600' : 'text-slate-300'}`} />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{a.title}</p>
                      <Badge variant="outline" className="capitalize">{a.severity}</Badge>
                      {!a.is_active && <Badge variant="secondary">Nonaktif</Badge>}
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2 mt-1">{a.body}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      {(a.target_roles || []).map((r) => (
                        <Badge key={r} variant="outline" className="text-[10px] py-0">
                          {r === 'all' ? 'Semua Peran' : (ROLE_LABELS[r] || r)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => toggleActive(a)} title={a.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
                      {a.is_active ? <Eye className="h-4 w-4 text-[#006837]" /> : <EyeOff className="h-4 w-4 text-slate-400" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(a)} data-testid={`btn-edit-${a.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)} data-testid={`btn-delete-${a.id}`}>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit Pengumuman' : 'Buat Pengumuman'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label htmlFor="title">Judul *</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                     placeholder="Misal: Libur Idul Fitri 2026" data-testid="input-ann-title" />
            </div>
            <div>
              <Label htmlFor="body">Isi Pengumuman * (mendukung Markdown)</Label>
              <Textarea id="body" rows={6}
                        value={form.body}
                        onChange={(e) => setForm({ ...form, body: e.target.value })}
                        placeholder="Tulis isi pengumuman... gunakan **tebal**, *miring*, atau - poin"
                        data-testid="input-ann-body" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tingkat Penting</Label>
                <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((s) => <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-4 pt-6">
                <div className="flex items-center gap-2">
                  <Switch id="pinned" checked={form.is_pinned}
                          onCheckedChange={(v) => setForm({ ...form, is_pinned: v })} />
                  <Label htmlFor="pinned" className="text-sm cursor-pointer">Pin di atas</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="active" checked={form.is_active}
                          onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  <Label htmlFor="active" className="text-sm cursor-pointer">Aktif</Label>
                </div>
              </div>
            </div>

            <div>
              <Label>Target Peran</Label>
              <div className="flex flex-wrap gap-2 mt-1.5 p-3 border rounded-lg bg-slate-50">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox checked={form.target_roles.includes('all')}
                            onCheckedChange={() => toggleRole('all')} />
                  <span className="font-semibold text-[#006837]">Semua Peran</span>
                </label>
                {ALL_ROLES.map((r) => (
                  <label key={r} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox checked={!form.target_roles.includes('all') && form.target_roles.includes(r)}
                              disabled={form.target_roles.includes('all')}
                              onCheckedChange={() => toggleRole(r)} />
                    <span>{ROLE_LABELS[r] || r}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="starts">Tampil mulai (opsional)</Label>
                <Input id="starts" type="datetime-local" value={form.starts_at}
                       onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="ends">Tampil sampai (opsional)</Label>
                <Input id="ends" type="datetime-local" value={form.ends_at}
                       onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter className="pt-3">
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#006837] hover:bg-[#005a30]" data-testid="btn-save-announcement">
              {saving ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
