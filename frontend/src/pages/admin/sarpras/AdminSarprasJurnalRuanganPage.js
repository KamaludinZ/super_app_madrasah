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
import { BookOpenCheck, Plus, Trash2, Loader2, Save, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const emptyForm = {
  room_id: '', tanggal: new Date().toISOString().split('T')[0], jam_mulai: '', jam_selesai: '',
  kegiatan: '', penanggung_jawab_id: '', kondisi_setelah: '', keterangan: '',
};

export default function AdminSarprasJurnalRuanganPage() {
  const [list, setList] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [wargaList, setWargaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, roomsRes, wargaRes] = await Promise.all([
        api.get('/sarpras/jurnal-ruangan'),
        api.get('/rooms'),
        api.get('/sarpras/warga-madrasah'),
      ]);
      setList(res.data || []);
      setRooms(roomsRes.data || []);
      setWargaList(wargaRes.data || []);
    } catch (e) {
      toast.error('Gagal memuat jurnal ruangan');
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => { setForm(emptyForm); setShowModal(true); };

  const handleSave = async () => {
    if (!form.room_id || !form.tanggal || !form.kegiatan) {
      toast.error('Ruangan, tanggal, dan kegiatan wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, penanggung_jawab_id: form.penanggung_jawab_id || null };
      await api.post('/sarpras/jurnal-ruangan', payload);
      toast.success('Jurnal penggunaan ruangan berhasil dicatat');
      setShowModal(false);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus jurnal ini?')) return;
    try {
      await api.delete(`/sarpras/jurnal-ruangan/${id}`);
      toast.success('Jurnal dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data');
    }
  };

  const filtered = list.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (item.room_nama || '').toLowerCase().includes(q) || (item.kegiatan || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6" data-testid="admin-sarpras-jurnal-ruangan-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <BookOpenCheck className="h-3 w-3 mr-1" /> Menu Sarpras
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Jurnal Penggunaan Ruangan</h1>
          <p className="text-sm text-slate-600 mt-1">Catat riwayat penggunaan ruangan sehari-hari</p>
        </div>
        <Button onClick={openModal} className="gap-2 bg-[#006837] hover:bg-[#005830]">
          <Plus className="h-4 w-4" /> Catat Penggunaan
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Cari ruangan atau kegiatan..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" /><p className="text-slate-500">Memuat data...</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Ruangan</TableHead>
                    <TableHead>Kegiatan</TableHead>
                    <TableHead>Penanggung Jawab</TableHead>
                    <TableHead>Kondisi Setelah</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500">
                      <BookOpenCheck className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                      <div className="font-semibold">Belum ada jurnal penggunaan ruangan</div>
                    </TableCell></TableRow>
                  ) : (
                    filtered.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{item.tanggal} {item.jam_mulai ? `· ${item.jam_mulai}` : ''}</TableCell>
                        <TableCell className="font-semibold">{item.room_nama}</TableCell>
                        <TableCell className="max-w-xs"><div className="line-clamp-2">{item.kegiatan}</div></TableCell>
                        <TableCell>{item.penanggung_jawab_nama || '-'}</TableCell>
                        <TableCell>{item.kondisi_setelah || '-'}</TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id)} className="text-rose-600 hover:text-rose-700"><Trash2 className="h-4 w-4" /></Button>
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

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Catat Penggunaan Ruangan</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Ruangan <span className="text-rose-500">*</span></Label>
              <Select value={form.room_id || 'none'} onValueChange={(v) => setForm({ ...form, room_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Pilih Ruangan" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih Ruangan</SelectItem>
                  {rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tanggal <span className="text-rose-500">*</span></Label>
                <Input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Jam Mulai</Label>
                <Input type="time" value={form.jam_mulai} onChange={(e) => setForm({ ...form, jam_mulai: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Jam Selesai</Label>
                <Input type="time" value={form.jam_selesai} onChange={(e) => setForm({ ...form, jam_selesai: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Kegiatan <span className="text-rose-500">*</span></Label>
              <Textarea rows={2} value={form.kegiatan} onChange={(e) => setForm({ ...form, kegiatan: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Penanggung Jawab</Label>
              <Select value={form.penanggung_jawab_id || 'none'} onValueChange={(v) => setForm({ ...form, penanggung_jawab_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Pilih Penanggung Jawab" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak ada</SelectItem>
                  {wargaList.map((w) => <SelectItem key={w.id} value={w.id}>{w.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kondisi Setelah Digunakan</Label>
              <Input value={form.kondisi_setelah} onChange={(e) => setForm({ ...form, kondisi_setelah: e.target.value })} placeholder="Baik, Perlu dibersihkan, dsb" />
            </div>
            <div className="space-y-2">
              <Label>Keterangan</Label>
              <Textarea rows={2} value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2 bg-[#006837] hover:bg-[#005830]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
