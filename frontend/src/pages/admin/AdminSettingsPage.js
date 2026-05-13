import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Upload, Save, Plus, Trash2, Clock, CalendarDays } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { api, DAY_LABELS } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const ALL_DAYS = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];

export default function AdminSettingsPage() {
  const { setSettings: setGlobalSettings } = useAuth();
  const [form, setForm] = useState(null);
  const fileLogoRef = useRef(null);
  const fileFaviconRef = useRef(null);

  const refresh = async () => {
    const { data } = await api.get('/admin/settings');
    setForm(data);
  };
  useEffect(() => { refresh(); }, []);

  const handleSave = async () => {
    try {
      const payload = { ...form };
      delete payload._id; delete payload.id;
      payload.gps_default_radius = parseFloat(payload.gps_default_radius) || 30;
      payload.grace_minutes = parseInt(payload.grace_minutes) || 15;
      payload.idle_timeout_minutes = parseInt(payload.idle_timeout_minutes) || 30;
      payload.session_max_hours = parseInt(payload.session_max_hours) || 12;
      const { data } = await api.put('/admin/settings', payload);
      setForm(data); setGlobalSettings(data);
      toast.success('Pengaturan disimpan');
    } catch (e) { toast.error('Gagal'); }
  };

  const uploadFile = async (file, kind) => {
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('kind', kind);
      const token = localStorage.getItem('matsa_token');
      const r = await fetch(`${BACKEND_URL}/api/admin/settings/upload-logo`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      if (!r.ok) throw new Error('Upload gagal');
      toast.success(`${kind === 'logo' ? 'Logo' : 'Favicon'} berhasil diunggah`);
      refresh();
    } catch (e) { toast.error(e.message); }
  };

  const toggleActiveDay = (d) => {
    const cur = form.active_days || [];
    const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d];
    // sort by ALL_DAYS
    next.sort((a, b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b));
    setForm({ ...form, active_days: next });
  };

  const updateSlot = (idx, field, val) => {
    const slots = [...(form.teaching_slots || [])];
    slots[idx] = { ...slots[idx], [field]: val };
    setForm({ ...form, teaching_slots: slots });
  };
  const addSlot = () => {
    const slots = [...(form.teaching_slots || [])];
    const last = slots[slots.length - 1];
    slots.push({
      name: `Jam ke-${slots.filter((s) => !s.is_break).length + 1}`,
      start_time: last?.end_time || '07:00',
      end_time: '08:00', is_break: false,
    });
    setForm({ ...form, teaching_slots: slots });
  };
  const addBreak = () => {
    const slots = [...(form.teaching_slots || [])];
    const last = slots[slots.length - 1];
    slots.push({
      name: 'Istirahat',
      start_time: last?.end_time || '09:00',
      end_time: '09:15', is_break: true,
    });
    setForm({ ...form, teaching_slots: slots });
  };
  const removeSlot = (idx) => {
    const slots = [...(form.teaching_slots || [])];
    slots.splice(idx, 1); setForm({ ...form, teaching_slots: slots });
  };

  if (!form) return <div className="text-sm text-slate-500">Memuat...</div>;

  return (
    <div className="space-y-6">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2"><Settings className="h-3 w-3 mr-1" /> Pengaturan Sistem</Badge>
        <h1 className="text-2xl sm:text-3xl font-bold">Pengaturan & Branding</h1>
        <p className="text-sm text-slate-600 mt-1">Identitas sekolah, jam mengajar, dan konfigurasi global</p>
      </div>

      <Tabs defaultValue="identity">
        <TabsList>
          <TabsTrigger value="identity" data-testid="tab-identity">Identitas</TabsTrigger>
          <TabsTrigger value="workday" data-testid="tab-workday">Hari & Jam Mengajar</TabsTrigger>
          <TabsTrigger value="jurnal" data-testid="tab-jurnal-config">Jurnal & GPS</TabsTrigger>
          <TabsTrigger value="session" data-testid="tab-session">Sesi & Keamanan</TabsTrigger>
        </TabsList>

        <TabsContent value="identity" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <h2 className="text-base font-semibold">Identitas Sekolah</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Nama Aplikasi</Label><Input value={form.app_name || ''} onChange={(e) => setForm({...form, app_name: e.target.value})} data-testid="settings-app-name" /></div>
                <div><Label>Nama Sekolah</Label><Input value={form.school_name || ''} onChange={(e) => setForm({...form, school_name: e.target.value})} data-testid="settings-school-name" /></div>
                <div><Label>NPSN</Label><Input value={form.npsn || ''} onChange={(e) => setForm({...form, npsn: e.target.value})} /></div>
                <div><Label>Akreditasi</Label><Input value={form.accreditation || ''} onChange={(e) => setForm({...form, accreditation: e.target.value})} /></div>
                <div><Label>Nama Kepala Madrasah</Label><Input value={form.headmaster_name || ''} onChange={(e) => setForm({...form, headmaster_name: e.target.value})} /></div>
                <div><Label>Email</Label><Input value={form.email || ''} onChange={(e) => setForm({...form, email: e.target.value})} /></div>
                <div><Label>Telepon</Label><Input value={form.phone || ''} onChange={(e) => setForm({...form, phone: e.target.value})} /></div>
                <div><Label>Alamat</Label><Input value={form.address || ''} onChange={(e) => setForm({...form, address: e.target.value})} /></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 space-y-4">
              <h2 className="text-base font-semibold">Logo & Favicon</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Logo Utama (PNG/SVG, max 5MB)</Label>
                  <div className="mt-2 flex items-center gap-3">
                    {form.logo_url ? <img src={form.logo_url} alt="Logo" className="h-16 w-16 object-contain border border-slate-200 rounded-lg p-1 bg-white" /> :
                      <div className="h-16 w-16 bg-[#006837] text-white font-bold rounded-lg flex items-center justify-center">MS</div>}
                    <Button variant="outline" onClick={() => fileLogoRef.current?.click()} className="gap-2" data-testid="upload-logo-button"><Upload className="h-4 w-4" /> Upload Logo</Button>
                    <input ref={fileLogoRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && uploadFile(e.target.files[0], 'logo')} />
                  </div>
                </div>
                <div>
                  <Label>Favicon (ICO/PNG)</Label>
                  <div className="mt-2 flex items-center gap-3">
                    {form.favicon_url ? <img src={form.favicon_url} alt="Favicon" className="h-12 w-12 object-contain border border-slate-200 rounded p-1 bg-white" /> :
                      <div className="h-12 w-12 bg-slate-100 rounded" />}
                    <Button variant="outline" onClick={() => fileFaviconRef.current?.click()} className="gap-2"><Upload className="h-4 w-4" /> Upload</Button>
                    <input ref={fileFaviconRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && uploadFile(e.target.files[0], 'favicon')} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workday" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <h2 className="text-base font-semibold flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Hari Aktif Sekolah</h2>
              <p className="text-xs text-slate-600">Pilih hari aktif. Jadwal & Monitoring publik akan mengikuti hari ini.</p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2" data-testid="settings-active-days">
                {ALL_DAYS.map((d) => {
                  const active = (form.active_days || []).includes(d);
                  return (
                    <button key={d} type="button" onClick={() => toggleActiveDay(d)}
                      className={`p-3 rounded-xl border font-semibold text-sm transition-colors ${active ? 'bg-[#006837] text-white border-[#006837]' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                      data-testid={`active-day-${d}`}>{DAY_LABELS[d]}</button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-base font-semibold flex items-center gap-2"><Clock className="h-4 w-4" /> Template Jam Mengajar</h2>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={addSlot} className="gap-1" data-testid="add-slot-button"><Plus className="h-3.5 w-3.5" /> Tambah Jam</Button>
                  <Button size="sm" variant="outline" onClick={addBreak} className="gap-1" data-testid="add-break-button"><Plus className="h-3.5 w-3.5" /> Tambah Istirahat</Button>
                </div>
              </div>
              <p className="text-xs text-slate-600">Template ini akan digunakan untuk pengisian Jadwal Pelajaran dengan tampilan grid yang lebih mudah.</p>
              <div className="space-y-2" data-testid="slots-editor">
                {(form.teaching_slots || []).map((slot, idx) => (
                  <div key={idx} className={`grid grid-cols-12 gap-2 items-center p-3 rounded-lg border ${slot.is_break ? 'bg-amber-50/40 border-amber-200' : 'bg-white border-slate-200'}`}>
                    <Input className="col-span-4" value={slot.name} onChange={(e) => updateSlot(idx, 'name', e.target.value)} placeholder="Nama slot" />
                    <Input className="col-span-3" type="time" value={slot.start_time} onChange={(e) => updateSlot(idx, 'start_time', e.target.value)} />
                    <Input className="col-span-3" type="time" value={slot.end_time} onChange={(e) => updateSlot(idx, 'end_time', e.target.value)} />
                    <label className="col-span-1 flex items-center gap-1 text-xs">
                      <Checkbox checked={slot.is_break || false} onCheckedChange={(v) => updateSlot(idx, 'is_break', v)} /> <span className="truncate">Istirahat</span>
                    </label>
                    <Button size="icon" variant="ghost" onClick={() => removeSlot(idx)} className="text-rose-600 col-span-1"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                {(!form.teaching_slots || form.teaching_slots.length === 0) && (
                  <div className="text-center py-6 text-sm text-slate-500">Belum ada jam mengajar. Klik "Tambah Jam" untuk mulai.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jurnal" className="mt-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <h2 className="text-base font-semibold">Konfigurasi Jurnal Presisi</h2>
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200">
                <div>
                  <div className="font-semibold text-sm">GPS Validation Default</div>
                  <div className="text-xs text-slate-600">Aktifkan validasi GPS secara default untuk ruangan baru</div>
                </div>
                <Switch checked={form.gps_default_enabled} onCheckedChange={(v) => setForm({...form, gps_default_enabled: v})} data-testid="settings-gps-default" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><Label>Radius GPS Default (m)</Label><Input type="number" value={form.gps_default_radius} onChange={(e) => setForm({...form, gps_default_radius: e.target.value})} data-testid="settings-gps-radius" /></div>
                <div><Label>Grace Period (menit)</Label><Input type="number" value={form.grace_minutes} onChange={(e) => setForm({...form, grace_minutes: e.target.value})} data-testid="settings-grace-minutes" /></div>
                <div><Label>QR Mode Default</Label>
                  <Select value={form.qr_default_mode} onValueChange={(v) => setForm({...form, qr_default_mode: v})}>
                    <SelectTrigger data-testid="settings-qr-mode"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="static">Statis</SelectItem><SelectItem value="dynamic">Dinamis</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="session" className="mt-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <h2 className="text-base font-semibold">Manajemen Sesi Login</h2>
              <p className="text-xs text-slate-600">Atur lama sesi login dan auto-logout untuk kenyamanan guru saat berpindah kelas.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Maksimum Sesi (jam)</Label>
                  <Input type="number" min="1" max="24" value={form.session_max_hours || 12} onChange={(e) => setForm({...form, session_max_hours: e.target.value})} data-testid="settings-session-hours" />
                  <p className="text-xs text-slate-500 mt-1">Sesi akan otomatis berakhir setelah X jam (default 12 jam = 1 hari kerja)</p>
                </div>
                <div>
                  <Label>Auto-Logout setelah tidak aktif (menit)</Label>
                  <Input type="number" min="5" max="180" value={form.idle_timeout_minutes || 30} onChange={(e) => setForm({...form, idle_timeout_minutes: e.target.value})} data-testid="settings-idle-timeout" />
                  <p className="text-xs text-slate-500 mt-1">Default 30 menit. Cocok untuk guru yang berpindah kelas tanpa logout berulang.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end sticky bottom-4">
        <Button onClick={handleSave} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2 shadow-lg" data-testid="settings-save"><Save className="h-4 w-4" /> Simpan Pengaturan</Button>
      </div>
    </div>
  );
}
