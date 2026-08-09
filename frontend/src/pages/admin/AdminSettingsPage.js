import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Upload, Save, Plus, Trash2, Clock, CalendarDays, Mail, Send, ServerCog, FileText, User, Eye, EyeOff, Globe } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { api, DAY_LABELS } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { notifyPublicPagesVisibilityChanged } from '@/hooks/usePublicPagesVisibility';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const ALL_DAYS = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];

export default function AdminSettingsPage() {
  const { setSettings: setGlobalSettings } = useAuth();
  const [form, setForm] = useState(null);
  const [selectedDay, setSelectedDay] = useState('senin'); // untuk tab per-hari
  const [usePerDaySlots, setUsePerDaySlots] = useState(false);
  const fileLogoRef = useRef(null);
  const fileFaviconRef = useRef(null);
  const fileLetterheadRef = useRef(null);

  const refresh = async () => {
    const { data } = await api.get('/admin/settings');
    // Check if teaching_slots is a dict (per-day) or list (global)
    const isPerDay = data.teaching_slots && typeof data.teaching_slots === 'object' && !Array.isArray(data.teaching_slots);
    setUsePerDaySlots(isPerDay);
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

      // Notify components that public pages visibility settings may have changed
      notifyPublicPagesVisibilityChanged();

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
      const kindLabels = { logo: 'Logo', favicon: 'Favicon', letterhead: 'Kop Surat' };
      toast.success(`${kindLabels[kind] || kind} berhasil diunggah`);
      refresh();
    } catch (e) { toast.error(e.message); }
  };

  const POSITION_OPTIONS = [
    { value: 'kepala_madrasah', label: 'Kepala Madrasah' },
    { value: 'kepala_tu', label: 'Kepala Tata Usaha' },
    { value: 'wakil_kesiswaan', label: 'Wakil Kepala Bidang Kesiswaan' },
    { value: 'wakil_kurikulum', label: 'Wakil Kepala Bidang Kurikulum' },
    { value: 'wakil_humas', label: 'Wakil Kepala Bidang Humas' },
    { value: 'wakil_sarpras', label: 'Wakil Kepala Bidang Sarpras' },
  ];

  const addLeader = () => {
    const leadership = [...(form.leadership || [])];
    leadership.push({ name: '', nip: '', position: 'kepala_madrasah' });
    setForm({ ...form, leadership });
  };

  const updateLeader = (idx, field, val) => {
    const leadership = [...(form.leadership || [])];
    leadership[idx] = { ...leadership[idx], [field]: val };
    setForm({ ...form, leadership });
  };

  const removeLeader = (idx) => {
    const leadership = [...(form.leadership || [])];
    leadership.splice(idx, 1);
    setForm({ ...form, leadership });
  };

  const toggleActiveDay = (d) => {
    const cur = form.active_days || [];
    const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d];
    // sort by ALL_DAYS
    next.sort((a, b) => ALL_DAYS.indexOf(a) - ALL_DAYS.indexOf(b));
    setForm({ ...form, active_days: next });
  };

  // Helper to get current slots (works for both global and per-day)
  const getCurrentSlots = () => {
    if (!form?.teaching_slots) return [];
    if (usePerDaySlots) {
      return form.teaching_slots[selectedDay] || [];
    }
    return Array.isArray(form.teaching_slots) ? form.teaching_slots : [];
  };

  // Helper to update slots (works for both global and per-day)
  const setCurrentSlots = (newSlots) => {
    if (usePerDaySlots) {
      const updated = { ...(form.teaching_slots || {}) };
      updated[selectedDay] = newSlots;
      setForm({ ...form, teaching_slots: updated });
    } else {
      setForm({ ...form, teaching_slots: newSlots });
    }
  };

  const updateSlot = (idx, field, val) => {
    const slots = [...getCurrentSlots()];
    slots[idx] = { ...slots[idx], [field]: val };
    setCurrentSlots(slots);
  };

  const addSlot = () => {
    const slots = [...getCurrentSlots()];
    const last = slots[slots.length - 1];
    slots.push({
      name: `Jam ke-${slots.filter((s) => !s.is_break).length + 1}`,
      start_time: last?.end_time || '07:00',
      end_time: '08:00', is_break: false,
    });
    setCurrentSlots(slots);
  };

  const addBreak = () => {
    const slots = [...getCurrentSlots()];
    const last = slots[slots.length - 1];
    slots.push({
      name: 'Istirahat',
      start_time: last?.end_time || '09:00',
      end_time: '09:15', is_break: true,
    });
    setCurrentSlots(slots);
  };

  const removeSlot = (idx) => {
    const slots = [...getCurrentSlots()];
    slots.splice(idx, 1);
    setCurrentSlots(slots);
  };

  // Toggle between global and per-day mode
  const togglePerDayMode = () => {
    if (!usePerDaySlots) {
      // Convert from global to per-day
      const globalSlots = Array.isArray(form.teaching_slots) ? form.teaching_slots : [];
      const perDaySlots = {};
      (form.active_days || ALL_DAYS).forEach(day => {
        perDaySlots[day] = JSON.parse(JSON.stringify(globalSlots)); // deep copy
      });
      setForm({ ...form, teaching_slots: perDaySlots });
      setUsePerDaySlots(true);
    } else {
      // Convert from per-day to global (use first day's config)
      const firstDay = (form.active_days || ALL_DAYS)[0];
      const globalSlots = form.teaching_slots[firstDay] || [];
      setForm({ ...form, teaching_slots: globalSlots });
      setUsePerDaySlots(false);
    }
  };

  // Copy slots from one day to another
  const copyDaySlots = (fromDay, toDay) => {
    if (!usePerDaySlots) return;
    const updated = { ...(form.teaching_slots || {}) };
    updated[toDay] = JSON.parse(JSON.stringify(updated[fromDay] || []));
    setForm({ ...form, teaching_slots: updated });
    toast.success(`Template ${DAY_LABELS[fromDay]} disalin ke ${DAY_LABELS[toDay]}`);
  };

  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpTestEmail, setSmtpTestEmail] = useState('');
  const handleTestSmtp = async () => {
    if (!smtpTestEmail.trim()) {
      toast.error('Masukkan email tujuan uji coba');
      return;
    }
    setSmtpTesting(true);
    try {
      // Save first, then test - send current form fields as overrides
      const payload = {
        smtp_host: form.smtp_host,
        smtp_port: parseInt(form.smtp_port) || 587,
        smtp_user: form.smtp_user,
        smtp_password: form.smtp_password,
        smtp_use_tls: !!form.smtp_use_tls,
        smtp_use_ssl: !!form.smtp_use_ssl,
        smtp_from_email: form.smtp_from_email,
        smtp_from_name: form.smtp_from_name,
        to_email: smtpTestEmail.trim(),
      };
      const { data } = await api.post('/admin/settings/test-smtp', payload);
      if (data.success) {
        toast.success(`Email uji coba terkirim ke ${smtpTestEmail}`);
      } else {
        toast.error(data.error || 'SMTP gagal');
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal uji SMTP');
    } finally {
      setSmtpTesting(false);
    }
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
          <TabsTrigger value="smtp" data-testid="tab-smtp">SMTP & Email</TabsTrigger>
          <TabsTrigger value="public-pages" data-testid="tab-public-pages">Halaman Public</TabsTrigger>
          <TabsTrigger value="maintenance" data-testid="tab-maintenance">Maintenance</TabsTrigger>
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

          <Card>
            <CardContent className="p-5 space-y-4">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" /> Kop Surat
              </h2>
              <div>
                <Label>Kop Surat (PNG/JPG, max 5MB)</Label>
                <div className="mt-2 flex items-center gap-3">
                  {form.letterhead_url ? (
                    <img src={form.letterhead_url} alt="Kop Surat" className="h-24 border border-slate-200 rounded-lg p-2 bg-white object-contain" />
                  ) : (
                    <div className="h-24 w-full max-w-md bg-slate-100 rounded-lg flex items-center justify-center text-xs text-slate-500">
                      Belum ada kop surat
                    </div>
                  )}
                  <Button variant="outline" onClick={() => fileLetterheadRef.current?.click()} className="gap-2">
                    <Upload className="h-4 w-4" /> Upload Kop Surat
                  </Button>
                  <input ref={fileLetterheadRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && uploadFile(e.target.files[0], 'letterhead')} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <User className="h-4 w-4" /> Daftar Pimpinan
                </h2>
                <Button size="sm" variant="outline" onClick={addLeader} className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> Tambah Pimpinan
                </Button>
              </div>
              <p className="text-xs text-slate-600">
                Kelola daftar pimpinan madrasah untuk keperluan laporan dan dokumen resmi.
              </p>
              <div className="space-y-3">
                {(form.leadership || []).map((leader, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-start p-3 rounded-lg border bg-white border-slate-200">
                    <div className="col-span-12 sm:col-span-4">
                      <Label className="text-xs">Nama</Label>
                      <Input
                        value={leader.name || ''}
                        onChange={(e) => updateLeader(idx, 'name', e.target.value)}
                        placeholder="Nama lengkap"
                        className="mt-1"
                      />
                    </div>
                    <div className="col-span-12 sm:col-span-3">
                      <Label className="text-xs">NIP (opsional)</Label>
                      <Input
                        value={leader.nip || ''}
                        onChange={(e) => updateLeader(idx, 'nip', e.target.value)}
                        placeholder="NIP"
                        className="mt-1"
                      />
                    </div>
                    <div className="col-span-10 sm:col-span-4">
                      <Label className="text-xs">Jabatan</Label>
                      <Select value={leader.position || 'kepala_madrasah'} onValueChange={(v) => updateLeader(idx, 'position', v)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {POSITION_OPTIONS.map((pos) => (
                            <SelectItem key={pos.value} value={pos.value}>{pos.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex items-end justify-end">
                      <Button size="icon" variant="ghost" onClick={() => removeLeader(idx)} className="text-rose-600 mt-5">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {(!form.leadership || form.leadership.length === 0) && (
                  <div className="text-center py-6 text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg">
                    Belum ada data pimpinan. Klik "Tambah Pimpinan" untuk mulai.
                  </div>
                )}
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
                <div className="flex gap-2 items-center">
                  <label className="flex items-center gap-2 text-xs font-medium">
                    <Switch checked={usePerDaySlots} onCheckedChange={togglePerDayMode} />
                    <span>Beda per Hari</span>
                  </label>
                  <Button size="sm" variant="outline" onClick={addSlot} className="gap-1" data-testid="add-slot-button"><Plus className="h-3.5 w-3.5" /> Tambah Jam</Button>
                  <Button size="sm" variant="outline" onClick={addBreak} className="gap-1" data-testid="add-break-button"><Plus className="h-3.5 w-3.5" /> Tambah Istirahat</Button>
                </div>
              </div>
              <p className="text-xs text-slate-600">
                {usePerDaySlots
                  ? 'Template jam mengajar per hari aktif. Setiap hari bisa memiliki jam yang berbeda.'
                  : 'Template ini akan digunakan untuk semua hari aktif sekolah.'}
              </p>

              {/* Day selector for per-day mode */}
              {usePerDaySlots && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {(form.active_days || ALL_DAYS).map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setSelectedDay(day)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          selectedDay === day
                            ? 'bg-[#006837] text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {DAY_LABELS[day]}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-slate-600">Salin template ke:</span>
                    {(form.active_days || ALL_DAYS).filter(d => d !== selectedDay).map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => copyDaySlots(selectedDay, day)}
                        className="px-2 py-1 rounded text-xs bg-blue-50 text-blue-700 hover:bg-blue-100"
                      >
                        {DAY_LABELS[day]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2" data-testid="slots-editor">
                {getCurrentSlots().map((slot, idx) => (
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
                {getCurrentSlots().length === 0 && (
                  <div className="text-center py-6 text-sm text-slate-500">
                    Belum ada jam mengajar{usePerDaySlots ? ` untuk ${DAY_LABELS[selectedDay]}` : ''}. Klik "Tambah Jam" untuk mulai.
                  </div>
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

        <TabsContent value="smtp" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#006837]/10 flex items-center justify-center shrink-0">
                  <ServerCog className="h-5 w-5 text-[#006837]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Konfigurasi Server Email (SMTP)</h2>
                  <p className="text-xs text-slate-600 mt-1">Diperlukan untuk fitur Reset Password via Email. Disarankan menggunakan SMTP dari Gmail / SendGrid / Mailgun.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Label>SMTP Host</Label>
                  <Input value={form.smtp_host || ''} onChange={(e) => setForm({...form, smtp_host: e.target.value})}
                    placeholder="smtp.gmail.com" data-testid="settings-smtp-host" />
                </div>
                <div>
                  <Label>SMTP Port</Label>
                  <Input type="number" value={form.smtp_port || 587} onChange={(e) => setForm({...form, smtp_port: e.target.value})}
                    placeholder="587" data-testid="settings-smtp-port" />
                </div>
                <div>
                  <Label>Username SMTP</Label>
                  <Input value={form.smtp_user || ''} onChange={(e) => setForm({...form, smtp_user: e.target.value})}
                    placeholder="user@gmail.com" data-testid="settings-smtp-user" />
                </div>
                <div className="sm:col-span-2">
                  <Label>Password SMTP / App Password</Label>
                  <Input type="password" value={form.smtp_password || ''} onChange={(e) => setForm({...form, smtp_password: e.target.value})}
                    placeholder="••••••••" autoComplete="new-password" data-testid="settings-smtp-password" />
                  <p className="text-xs text-slate-500 mt-1">Untuk Gmail, gunakan App Password (bukan password akun Gmail biasa).</p>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <div>
                    <div className="font-semibold text-sm">Gunakan TLS (STARTTLS)</div>
                    <div className="text-xs text-slate-600">Default untuk port 587</div>
                  </div>
                  <Switch checked={!!form.smtp_use_tls} onCheckedChange={(v) => setForm({...form, smtp_use_tls: v})} data-testid="settings-smtp-tls" />
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <div>
                    <div className="font-semibold text-sm">Gunakan SSL Langsung</div>
                    <div className="text-xs text-slate-600">Aktifkan untuk port 465</div>
                  </div>
                  <Switch checked={!!form.smtp_use_ssl} onCheckedChange={(v) => setForm({...form, smtp_use_ssl: v})} data-testid="settings-smtp-ssl" />
                </div>
                <div>
                  <Label>From Email (Pengirim)</Label>
                  <Input value={form.smtp_from_email || ''} onChange={(e) => setForm({...form, smtp_from_email: e.target.value})}
                    placeholder="noreply@matsa.sch.id" data-testid="settings-smtp-from-email" />
                </div>
                <div>
                  <Label>From Name</Label>
                  <Input value={form.smtp_from_name || ''} onChange={(e) => setForm({...form, smtp_from_name: e.target.value})}
                    placeholder="Super Apps MATSANDATAMA" data-testid="settings-smtp-from-name" />
                </div>
                <div className="sm:col-span-2">
                  <Label>URL Publik Aplikasi (untuk tautan reset email)</Label>
                  <Input value={form.app_public_url || ''} onChange={(e) => setForm({...form, app_public_url: e.target.value})}
                    placeholder="https://matsa.preview.emergentagent.com" data-testid="settings-app-public-url" />
                  <p className="text-xs text-slate-500 mt-1">Kosongkan untuk auto-detect dari request browser.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <Mail className="h-5 w-5 text-amber-700" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Uji Coba Pengiriman Email</h2>
                  <p className="text-xs text-slate-600 mt-1">Simpan pengaturan SMTP dulu, lalu masukkan email penerima untuk verifikasi.</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input type="email" value={smtpTestEmail} onChange={(e) => setSmtpTestEmail(e.target.value)}
                  placeholder="penerima@email.com" className="flex-1" data-testid="settings-smtp-test-email" />
                <Button onClick={handleTestSmtp} disabled={smtpTesting || !form.smtp_host}
                  className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="settings-smtp-test-button">
                  <Send className="h-4 w-4" /> {smtpTesting ? 'Mengirim...' : 'Kirim Test'}
                </Button>
              </div>
              {!form.smtp_host && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                  Isi <strong>SMTP Host</strong> terlebih dahulu, lalu klik <strong>Simpan Pengaturan</strong>, baru lakukan uji coba.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="public-pages" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                  <Globe className="h-5 w-5 text-blue-700" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">Pengaturan Halaman Public</h2>
                  <p className="text-xs text-slate-600 mt-1">
                    Atur visibilitas halaman public: akses terbuka untuk umum, disembunyikan, atau hanya tampil di dashboard untuk user yang login.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                {/* RKAM Page */}
                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <Label className="text-sm font-semibold">RKAM (Rencana Kerja & Anggaran Madrasah)</Label>
                      <p className="text-xs text-slate-600 mt-0.5">Halaman /public/rkam</p>
                    </div>
                    <Select
                      value={form.rkam_visibility || 'public'}
                      onValueChange={(v) => setForm({...form, rkam_visibility: v})}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">
                          <div className="flex items-center gap-2">
                            <Globe className="h-3.5 w-3.5" />
                            <span>Public (Terbuka)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="hidden">
                          <div className="flex items-center gap-2">
                            <EyeOff className="h-3.5 w-3.5" />
                            <span>Disembunyikan</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="dashboard">
                          <div className="flex items-center gap-2">
                            <Eye className="h-3.5 w-3.5" />
                            <span>Dashboard Only</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Agenda Page */}
                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <Label className="text-sm font-semibold">Agenda Kegiatan Madrasah</Label>
                      <p className="text-xs text-slate-600 mt-0.5">Halaman /public/agenda</p>
                    </div>
                    <Select
                      value={form.agenda_visibility || 'public'}
                      onValueChange={(v) => setForm({...form, agenda_visibility: v})}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">
                          <div className="flex items-center gap-2">
                            <Globe className="h-3.5 w-3.5" />
                            <span>Public (Terbuka)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="hidden">
                          <div className="flex items-center gap-2">
                            <EyeOff className="h-3.5 w-3.5" />
                            <span>Disembunyikan</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="dashboard">
                          <div className="flex items-center gap-2">
                            <Eye className="h-3.5 w-3.5" />
                            <span>Dashboard Only</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Prestasi Page */}
                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <Label className="text-sm font-semibold">Prestasi Siswa</Label>
                      <p className="text-xs text-slate-600 mt-0.5">Halaman /public/prestasi</p>
                    </div>
                    <Select
                      value={form.prestasi_visibility || 'public'}
                      onValueChange={(v) => setForm({...form, prestasi_visibility: v})}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">
                          <div className="flex items-center gap-2">
                            <Globe className="h-3.5 w-3.5" />
                            <span>Public (Terbuka)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="hidden">
                          <div className="flex items-center gap-2">
                            <EyeOff className="h-3.5 w-3.5" />
                            <span>Disembunyikan</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="dashboard">
                          <div className="flex items-center gap-2">
                            <Eye className="h-3.5 w-3.5" />
                            <span>Dashboard Only</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Monitoring Page */}
                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <Label className="text-sm font-semibold">Monitoring Aktivitas Guru</Label>
                      <p className="text-xs text-slate-600 mt-0.5">Halaman /public/monitoring</p>
                    </div>
                    <Select
                      value={form.monitoring_visibility || 'public'}
                      onValueChange={(v) => setForm({...form, monitoring_visibility: v})}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">
                          <div className="flex items-center gap-2">
                            <Globe className="h-3.5 w-3.5" />
                            <span>Public (Terbuka)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="hidden">
                          <div className="flex items-center gap-2">
                            <EyeOff className="h-3.5 w-3.5" />
                            <span>Disembunyikan</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="dashboard">
                          <div className="flex items-center gap-2">
                            <Eye className="h-3.5 w-3.5" />
                            <span>Dashboard Only</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                <strong>Keterangan:</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li><strong>Public (Terbuka):</strong> Dapat diakses siapa saja tanpa login melalui /public/*</li>
                  <li><strong>Disembunyikan:</strong> Halaman tidak dapat diakses baik public maupun dashboard</li>
                  <li><strong>Dashboard Only:</strong> Hanya tampil di menu dashboard untuk user yang sudah login, tidak bisa diakses public</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                Mode Maintenance
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Saat aktif, semua pengguna non-admin akan melihat halaman maintenance. Admin tetap dapat mengakses sistem untuk perbaikan.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
                <div className="flex-1">
                  <Label className="text-sm font-semibold text-amber-900">Aktifkan Mode Maintenance</Label>
                  <p className="text-xs text-amber-800 mt-0.5">Pengguna non-admin tidak bisa mengakses aplikasi.</p>
                </div>
                <Switch
                  checked={!!form.maintenance_mode}
                  onCheckedChange={(v) => setForm({ ...form, maintenance_mode: v })}
                  data-testid="toggle-maintenance"
                />
              </div>
              <div>
                <Label htmlFor="mm-msg">Pesan Maintenance (opsional)</Label>
                <textarea
                  id="mm-msg" rows={3}
                  value={form.maintenance_message || ''}
                  onChange={(e) => setForm({ ...form, maintenance_message: e.target.value })}
                  className="mt-1 w-full rounded-md border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#006837]/30"
                  placeholder="Contoh: Sistem sedang diperbarui ke versi 2.0. Mohon menunggu hingga pukul 22:00 WIB."
                  data-testid="input-maintenance-message"
                />
              </div>
              <div>
                <Label htmlFor="mm-end">Estimasi Selesai (opsional)</Label>
                <Input
                  id="mm-end" type="datetime-local"
                  value={form.maintenance_ends_at || ''}
                  onChange={(e) => setForm({ ...form, maintenance_ends_at: e.target.value })}
                  data-testid="input-maintenance-ends"
                />
              </div>
              <p className="text-xs text-slate-500 italic">
                Jangan lupa klik <strong>Simpan Pengaturan</strong> di bawah agar perubahan berlaku.
              </p>
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
