import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, Building2, MapPin } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function AdminRoomsPage() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', gps_lat: '', gps_lon: '', gps_radius_meters: 30, gps_enabled: false, qr_mode: 'static' });

  const refresh = async () => { const { data } = await api.get('/rooms'); setItems(data); };
  useEffect(() => { refresh(); }, []);

  const openCreate = () => { setEditing(null); setForm({ name: '', description: '', gps_lat: '', gps_lon: '', gps_radius_meters: 30, gps_enabled: false, qr_mode: 'static' }); setOpen(true); };
  const openEdit = (r) => { setEditing(r); setForm({ ...r, gps_lat: r.gps_lat ?? '', gps_lon: r.gps_lon ?? '' }); setOpen(true); };

  const handleSubmit = async () => {
    if (!form.name) { toast.error('Nama ruangan wajib'); return; }
    const payload = { ...form,
      gps_lat: form.gps_lat === '' ? null : parseFloat(form.gps_lat),
      gps_lon: form.gps_lon === '' ? null : parseFloat(form.gps_lon),
      gps_radius_meters: parseFloat(form.gps_radius_meters) || 30,
    };
    try {
      if (editing) await api.put(`/rooms/${editing.id}`, payload); else await api.post('/rooms', payload);
      toast.success('Berhasil disimpan'); setOpen(false); refresh();
    } catch (e) { toast.error('Gagal'); }
  };

  const handleDelete = async (r) => {
    if (!window.confirm(`Hapus ruangan ${r.name}?`)) return;
    await api.delete(`/rooms/${r.id}`); toast.success('Dihapus'); refresh();
  };

  const captureGPS = () => {
    if (!navigator.geolocation) return toast.error('GPS tidak tersedia');
    navigator.geolocation.getCurrentPosition((pos) => {
      setForm({ ...form, gps_lat: pos.coords.latitude.toFixed(6), gps_lon: pos.coords.longitude.toFixed(6) });
      toast.success('Koordinat GPS berhasil diambil');
    }, () => toast.error('Gagal mendapatkan GPS'));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2"><Building2 className="h-3 w-3 mr-1" /> Manajemen Ruangan</Badge>
          <h1 className="text-2xl sm:text-3xl font-bold">Kelola Ruangan</h1>
          <p className="text-sm text-slate-600 mt-1">{items.length} ruangan terdaftar</p>
        </div>
        <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="add-room-button"><Plus className="h-4 w-4" /> Tambah Ruangan</Button>
      </div>

      <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table data-testid="admin-rooms-table">
        <TableHeader><TableRow>
          <TableHead>Kode</TableHead><TableHead>Deskripsi</TableHead><TableHead>GPS</TableHead><TableHead>Radius</TableHead><TableHead>QR Mode</TableHead><TableHead className="text-right">Aksi</TableHead>
        </TableRow></TableHeader>
        <TableBody>{items.map((r) => (
          <TableRow key={r.id} data-testid={`room-row-${r.name}`}>
            <TableCell className="font-mono font-semibold">{r.name}</TableCell>
            <TableCell className="text-sm">{r.description || '-'}</TableCell>
            <TableCell>
              {r.gps_lat ? (
                <span className={`text-xs font-mono ${r.gps_enabled ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {r.gps_lat.toFixed(4)}, {r.gps_lon.toFixed(4)}
                  <Badge className={`ml-2 text-xs ${r.gps_enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{r.gps_enabled ? 'ON' : 'OFF'}</Badge>
                </span>
              ) : <span className="text-xs text-slate-400">Tidak diset</span>}
            </TableCell>
            <TableCell className="text-sm">{r.gps_radius_meters}m</TableCell>
            <TableCell><Badge variant="outline" className="capitalize">{r.qr_mode}</Badge></TableCell>
            <TableCell className="text-right">
              <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(r)} className="text-rose-600"><Trash2 className="h-4 w-4" /></Button>
            </TableCell>
          </TableRow>
        ))}</TableBody>
      </Table></div></CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Ruangan' : 'Tambah Ruangan'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Kode Ruangan *</Label><Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="R-7A" data-testid="room-form-name" /></div>
            <div><Label>Deskripsi</Label><Input value={form.description || ''} onChange={(e) => setForm({...form, description: e.target.value})} placeholder="Ruang Kelas 7A" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Latitude</Label><Input type="number" step="any" value={form.gps_lat} onChange={(e) => setForm({...form, gps_lat: e.target.value})} placeholder="-7.9839" data-testid="room-form-lat" /></div>
              <div><Label>Longitude</Label><Input type="number" step="any" value={form.gps_lon} onChange={(e) => setForm({...form, gps_lon: e.target.value})} placeholder="112.6549" data-testid="room-form-lon" /></div>
            </div>
            <Button variant="outline" onClick={captureGPS} className="w-full gap-2" data-testid="capture-gps-button"><MapPin className="h-4 w-4" /> Ambil GPS dari Perangkat Ini</Button>
            <div><Label>Radius GPS (meter)</Label><Input type="number" value={form.gps_radius_meters} onChange={(e) => setForm({...form, gps_radius_meters: e.target.value})} data-testid="room-form-radius" /></div>
            <label className="flex items-center gap-3 cursor-pointer">
              <Switch checked={form.gps_enabled} onCheckedChange={(v) => setForm({...form, gps_enabled: v})} data-testid="room-form-gps-toggle" />
              <span className="text-sm font-medium">Aktifkan Validasi GPS untuk Ruangan Ini</span>
            </label>
            <div><Label>QR Mode</Label>
              <Select value={form.qr_mode} onValueChange={(v) => setForm({...form, qr_mode: v})}>
                <SelectTrigger data-testid="room-form-qr-mode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="static">Statis (rekomendasi)</SelectItem>
                  <SelectItem value="dynamic">Dinamis (TOTP, refresh 30s)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button onClick={handleSubmit} className="bg-[#006837]" data-testid="room-form-submit">Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
