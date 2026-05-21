import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, GraduationCap, Check, Trash2, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function AdminAcademicYearPage() {
  const [items, setItems] = useState([]);
  const [tahunTakwimList, setTahunTakwimList] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '',
    tahun_takwim_ids: [],
    start_date: '',
    end_date: '',
    is_active: false,
  });

  const refresh = async () => {
    const { data } = await api.get('/academic-years');
    setItems(data);
  };

  const loadTahunTakwim = async () => {
    try {
      const { data } = await api.get('/tahun-takwim');
      setTahunTakwimList(data);
    } catch (e) {
      console.error('Failed to load Tahun Takwim:', e);
    }
  };

  useEffect(() => {
    refresh();
    loadTahunTakwim();
  }, []);

  const openCreate = () => {
    setEditing(null);
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    setForm({
      name: `${currentYear}/${nextYear}`,
      tahun_takwim_ids: [],
      start_date: `${currentYear}-07-01`,
      end_date: `${nextYear}-06-30`,
      is_active: false,
    });
    setOpen(true);
  };
  const openEdit = (ay) => {
    setEditing(ay);
    setForm({
      name: ay.name,
      tahun_takwim_ids: ay.tahun_takwim_ids || [],
      start_date: ay.start_date || '',
      end_date: ay.end_date || '',
      is_active: ay.is_active,
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name) { toast.error('Nama wajib'); return; }
    try {
      if (editing) {
        await api.put(`/academic-years/${editing.id}`, form);
        toast.success('Tahun pelajaran diperbarui');
      } else {
        await api.post('/academic-years', form);
        toast.success('Tahun pelajaran ditambahkan');
      }
      setOpen(false); refresh();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Gagal menyimpan'); }
  };

  const handleActivate = async (ay) => {
    if (!window.confirm(`Aktifkan ${ay.name}?`)) return;
    await api.put(`/academic-years/${ay.id}/activate`); toast.success('Diaktifkan'); refresh();
  };

  const handleDelete = async (ay) => {
    if (!window.confirm(`Hapus ${ay.name}?`)) return;
    try { await api.delete(`/academic-years/${ay.id}`); toast.success('Dihapus'); refresh(); }
    catch (e) { toast.error('Gagal'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2"><GraduationCap className="h-3 w-3 mr-1" /> Tahun Pelajaran</Badge>
          <h1 className="text-2xl sm:text-3xl font-bold">Kelola Tahun Pelajaran</h1>
          <p className="text-sm text-slate-600 mt-1">Tahun pelajaran aktif menjadi acuan semua data baru. Kelola semester di menu Semester.</p>
        </div>
        <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="add-ay-button"><Plus className="h-4 w-4" /> Tambah</Button>
      </div>

      <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table>
        <TableHeader><TableRow>
          <TableHead>Nama</TableHead><TableHead>Tahun Takwim</TableHead><TableHead>Periode</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead>
        </TableRow></TableHeader>
        <TableBody>{items.map((ay) => {
          const ttYears = (ay.tahun_takwim_ids || []).map(ttId => {
            const tt = tahunTakwimList.find(t => t.id === ttId);
            return tt ? tt.year : ttId;
          }).join('/');
          return (
            <TableRow key={ay.id} data-testid={`ay-row-${ay.name}`}>
              <TableCell className="font-mono font-semibold">{ay.name}</TableCell>
              <TableCell className="text-xs text-slate-600">
                {ttYears || <span className="text-slate-400">-</span>}
              </TableCell>
              <TableCell className="text-xs text-slate-600">
                {ay.start_date && ay.end_date ? (
                  <>{new Date(ay.start_date).toLocaleDateString('id-ID')} - {new Date(ay.end_date).toLocaleDateString('id-ID')}</>
                ) : '-'}
              </TableCell>
              <TableCell>{ay.is_active ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Aktif</Badge> : <Badge variant="outline">Arsip</Badge>}</TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" onClick={() => openEdit(ay)} className="gap-1 mr-1" data-testid={`edit-ay-${ay.name}`}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                {!ay.is_active && <Button size="sm" variant="outline" onClick={() => handleActivate(ay)} className="gap-1" data-testid={`activate-ay-${ay.name}`}><Check className="h-3.5 w-3.5" /> Aktifkan</Button>}
                <Button size="icon" variant="ghost" onClick={() => handleDelete(ay)} className="text-rose-600 ml-1"><Trash2 className="h-4 w-4" /></Button>
              </TableCell>
            </TableRow>
          );
        })}</TableBody>
      </Table></div></CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Tahun Pelajaran' : 'Tambah Tahun Pelajaran'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nama Tahun Pelajaran *</Label>
              <Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="2026/2027" data-testid="ay-form-name" />
              <p className="text-xs text-slate-500 mt-1">Format: YYYY/YYYY (contoh: 2026/2027)</p>
            </div>

            <div>
              <Label>Tahun Takwim yang Dilintasi *</Label>
              <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                {tahunTakwimList.length === 0 && (
                  <p className="text-xs text-slate-500">Tidak ada Tahun Takwim. Buat di menu Tahun Takwim terlebih dahulu.</p>
                )}
                {tahunTakwimList.map((tt) => (
                  <label key={tt.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded">
                    <input
                      type="checkbox"
                      checked={form.tahun_takwim_ids.includes(tt.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setForm({...form, tahun_takwim_ids: [...form.tahun_takwim_ids, tt.id].sort()});
                        } else {
                          setForm({...form, tahun_takwim_ids: form.tahun_takwim_ids.filter(id => id !== tt.id)});
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm font-medium">{tt.year}</span>
                    <span className="text-xs text-slate-500">- {tt.name}</span>
                    {tt.is_active && <Badge className="ml-auto bg-emerald-500 text-[9px]">AKTIF</Badge>}
                  </label>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Pilih 1-2 tahun takwim yang dilintasi TP ini (contoh: TP 2025/2026 melintasi tahun 2025 dan 2026)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tanggal Mulai *</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({...form, start_date: e.target.value})}
                />
                <p className="text-xs text-slate-500 mt-1">Biasanya 1 Juli</p>
              </div>
              <div>
                <Label>Tanggal Selesai *</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({...form, end_date: e.target.value})}
                />
                <p className="text-xs text-slate-500 mt-1">Biasanya 30 Juni</p>
              </div>
            </div>

            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({...form, is_active: e.target.checked})} />
              <span className="text-sm">Set sebagai TP aktif (akan menonaktifkan TP lain)</span>
            </label>
            <div className="rounded-lg border border-blue-200 p-3 bg-blue-50">
              <p className="text-xs text-blue-800">
                <strong>Info:</strong> Setelah membuat TP, buat semester-semester di menu Semester dan tentukan kurikulum yang digunakan untuk tiap semester.
              </p>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button onClick={handleSubmit} className="bg-[#006837]" data-testid="ay-form-submit">Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
