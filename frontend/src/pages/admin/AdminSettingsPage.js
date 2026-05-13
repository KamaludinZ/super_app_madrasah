import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Upload, Save } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

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

  if (!form) return <div className="text-sm text-slate-500">Memuat...</div>;

  return (
    <div className="space-y-6">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2"><Settings className="h-3 w-3 mr-1" /> Pengaturan Sistem</Badge>
        <h1 className="text-2xl sm:text-3xl font-bold">Pengaturan & Branding</h1>
        <p className="text-sm text-slate-600 mt-1">Identitas sekolah, logo, dan konfigurasi global</p>
      </div>

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
                  <div className="h-16 w-16 bg-[#006837] text-white font-bold rounded-lg flex items-center justify-center">MS</div>
                }
                <Button variant="outline" onClick={() => fileLogoRef.current?.click()} className="gap-2" data-testid="upload-logo-button"><Upload className="h-4 w-4" /> Upload Logo</Button>
                <input ref={fileLogoRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && uploadFile(e.target.files[0], 'logo')} />
              </div>
            </div>
            <div>
              <Label>Favicon (ICO/PNG)</Label>
              <div className="mt-2 flex items-center gap-3">
                {form.favicon_url ? <img src={form.favicon_url} alt="Favicon" className="h-12 w-12 object-contain border border-slate-200 rounded p-1 bg-white" /> :
                  <div className="h-12 w-12 bg-slate-100 rounded" />
                }
                <Button variant="outline" onClick={() => fileFaviconRef.current?.click()} className="gap-2"><Upload className="h-4 w-4" /> Upload</Button>
                <input ref={fileFaviconRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && uploadFile(e.target.files[0], 'favicon')} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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

      <div className="flex justify-end">
        <Button onClick={handleSave} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="settings-save"><Save className="h-4 w-4" /> Simpan Pengaturan</Button>
      </div>
    </div>
  );
}
