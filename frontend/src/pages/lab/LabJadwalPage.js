import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarClock, Plus, Pencil, Trash2, Loader2, Save, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { LAB_META } from './LabMeta';
import { confirmDialog } from '@/components/ui/confirm-dialog';

const MINGGU_LIST = [1, 2, 3, 4];
const emptyForm = { minggu_ke: 1, hari: 'Senin', jam_mulai: '', jam_selesai: '', jp_mulai: '', jp_selesai: '', kelas: '', guru_nama: '', keterangan: '' };

export default function LabJadwalPage() {
  const { labKey } = useParams();
  const meta = LAB_META[labKey] || LAB_META.ipa;
  const [list, setList] = useState([]);
  const [hariOptions, setHariOptions] = useState([]);
  const [guruOptions, setGuruOptions] = useState([]);
  const [mingguKe, setMingguKe] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, [labKey, mingguKe]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, metaRes, guruRes] = await Promise.all([
        api.get(`/lab/${labKey}/jadwal`, { params: { minggu_ke: mingguKe } }),
        api.get(`/lab/${labKey}/meta`),
        api.get(`/lab/${labKey}/guru-lab`),
      ]);
      setList(res.data || []);
      setHariOptions(metaRes.data.hari || []);
      setGuruOptions(guruRes.data || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal memuat jadwal lab');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (item = null) => {
    if (item) {
      setEditing(item);
      setForm({
        minggu_ke: item.minggu_ke, hari: item.hari, jam_mulai: item.jam_mulai || '', jam_selesai: item.jam_selesai || '',
        jp_mulai: item.jp_mulai ?? '', jp_selesai: item.jp_selesai ?? '', kelas: item.kelas || '', guru_nama: item.guru_nama || '',
        keterangan: item.keterangan || '',
      });
    } else {
      setEditing(null);
      setForm({ ...emptyForm, minggu_ke: mingguKe });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.hari || !form.kelas || !form.guru_nama) {
      toast.error('Hari, Kelas, dan Guru wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form, minggu_ke: Number(form.minggu_ke),
        jp_mulai: form.jp_mulai ? Number(form.jp_mulai) : null, jp_selesai: form.jp_selesai ? Number(form.jp_selesai) : null,
      };
      if (editing) {
        await api.put(`/lab/${labKey}/jadwal/${editing.id}`, payload);
        toast.success('Jadwal berhasil diperbarui');
      } else {
        await api.post(`/lab/${labKey}/jadwal`, payload);
        toast.success('Jadwal berhasil ditambahkan');
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
    if (!(await confirmDialog('Yakin ingin menghapus jadwal ini?'))) return;
    try {
      await api.delete(`/lab/${labKey}/jadwal/${id}`);
      toast.success('Jadwal dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data');
    }
  };

  const filtered = list.filter((item) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (item.guru_nama || '').toLowerCase().includes(s) || (item.kelas || '').toLowerCase().includes(s) || (item.hari || '').toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6" data-testid={`lab-${labKey}-jadwal-page`}>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <meta.icon className="h-3 w-3 mr-1" /> {meta.title}
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Jadwal Penggunaan {meta.title}</h1>
          <p className="text-sm text-slate-600 mt-1">Jadwal mingguan tetap penggunaan {meta.title} per kelas</p>
        </div>
        <Button onClick={() => openModal()} className="gap-2 bg-[#006837] hover:bg-[#005830]">
          <Plus className="h-4 w-4" /> Tambah Jadwal
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {MINGGU_LIST.map((m) => (
              <Button
                key={m}
                size="sm"
                variant={mingguKe === m ? 'default' : 'outline'}
                className={mingguKe === m ? 'bg-[#006837] hover:bg-[#005830]' : ''}
                onClick={() => setMingguKe(m)}
              >
                Minggu Ke-{m}
              </Button>
            ))}
            <div className="relative flex-1 min-w-[200px] ml-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Cari Guru, Kelas, atau Hari..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">NO</TableHead>
                  <TableHead>HARI</TableHead>
                  <TableHead>JAM</TableHead>
                  <TableHead>JP</TableHead>
                  <TableHead>KELAS</TableHead>
                  <TableHead>{meta.guruLabel?.toUpperCase() || 'GURU'}</TableHead>
                  <TableHead className="text-right">AKSI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-slate-500"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-slate-500">
                    <CalendarClock className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                    <div className="font-semibold">Belum ada jadwal untuk Minggu Ke-{mingguKe}</div>
                  </TableCell></TableRow>
                ) : (
                  filtered.map((item, idx) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm text-slate-500">{idx + 1}</TableCell>
                      <TableCell className="font-semibold">{item.hari}</TableCell>
                      <TableCell className="font-mono text-sm text-[#006837]">{item.jam_mulai}{item.jam_selesai ? `-${item.jam_selesai}` : ''}</TableCell>
                      <TableCell className="text-sm">{item.jp_mulai && item.jp_selesai ? `${item.jp_mulai}-${item.jp_selesai}` : '-'}</TableCell>
                      <TableCell><Badge className="bg-amber-100 text-amber-700 border-amber-200">{item.kelas}</Badge></TableCell>
                      <TableCell>{item.guru_nama}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openModal(item)} className="text-blue-600 hover:text-blue-700"><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id)} className="text-rose-600 hover:text-rose-700"><Trash2 className="h-4 w-4" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? 'Edit Jadwal Lab' : 'Tambah / Edit Jadwal Lab'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Minggu Ke-</Label>
                <Select value={String(form.minggu_ke)} onValueChange={(v) => setForm({ ...form, minggu_ke: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MINGGU_LIST.map((m) => <SelectItem key={m} value={String(m)}>Minggu Ke-{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Hari</Label>
                <Select value={form.hari} onValueChange={(v) => setForm({ ...form, hari: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{hariOptions.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Jam Belajar</Label>
                <div className="flex gap-2 items-center">
                  <Input type="time" value={form.jam_mulai} onChange={(e) => setForm({ ...form, jam_mulai: e.target.value })} />
                  <span className="text-slate-400">-</span>
                  <Input type="time" value={form.jam_selesai} onChange={(e) => setForm({ ...form, jam_selesai: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>JP (Jam Ke-)</Label>
                <div className="flex gap-2 items-center">
                  <Input type="number" min="1" value={form.jp_mulai} onChange={(e) => setForm({ ...form, jp_mulai: e.target.value })} placeholder="3" />
                  <span className="text-slate-400">-</span>
                  <Input type="number" min="1" value={form.jp_selesai} onChange={(e) => setForm({ ...form, jp_selesai: e.target.value })} placeholder="4" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kelas <span className="text-rose-500">*</span></Label>
                <Input value={form.kelas} onChange={(e) => setForm({ ...form, kelas: e.target.value })} placeholder="8D, 9K, dll" />
              </div>
              <div className="space-y-2">
                <Label>{meta.guruLabel} <span className="text-rose-500">*</span></Label>
                <Select value={form.guru_nama || undefined} onValueChange={(v) => setForm({ ...form, guru_nama: v })}>
                  <SelectTrigger><SelectValue placeholder={`Pilih ${meta.guruLabel}...`} /></SelectTrigger>
                  <SelectContent>
                    {guruOptions.map((g) => <SelectItem key={g.id} value={g.full_name}>{g.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {guruOptions.length === 0 && (
                  <p className="text-xs text-amber-600">Belum ada guru dengan peran {meta.guruLabel} terdaftar.</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2 bg-[#006837] hover:bg-[#005830]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Jadwal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
