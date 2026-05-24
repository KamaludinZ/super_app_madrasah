import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  KeyRound, User, Shield, QrCode, History, Copy, Eye, EyeOff,
  CheckCircle2, AlertCircle, Loader2, RotateCcw, Power, Hash, Mail, Phone,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function StudentAccountInfoDialog({ student, open, onClose, isGTK = false }) {
  const [tab, setTab] = useState('akun');
  const [data, setData] = useState(student);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [busy, setBusy] = useState(false);

  // Auto-detect if this is GTK based on roles
  const isStaff = isGTK || (data?.roles || []).some(r => !['siswa', 'orang_tua'].includes(r));

  useEffect(() => {
    if (!student?.id) return;
    (async () => {
      setLoading(true);
      try {
        // Fetch fresh user data directly by ID
        const [userData, audits] = await Promise.all([
          api.get(`/users/${student.id}`).catch(() => ({ data: null })),
          api.get('/admin/audit-logs', { params: { target_id: student.id, limit: 30 } }).catch(() => ({ data: [] })),
        ]);
        if (userData.data) setData(userData.data);
        setLogs(audits.data || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [student?.id, student.username, student.full_name]);

  const handleResetPassword = async () => {
    if (newPassword.length < 6) { toast.error('Password minimal 6 karakter'); return; }
    setBusy(true);
    try {
      await api.put(`/users/${student.id}`, { new_password: newPassword });
      toast.success('Password berhasil di-reset');
      setNewPassword('');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal reset');
    } finally {
      setBusy(false);
    }
  };

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let p = '';
    for (let i = 0; i < 8; i++) p += chars[Math.floor(Math.random() * chars.length)];
    setGeneratedPassword(p);
    setNewPassword(p);
  };

  const handleToggleActive = async () => {
    setBusy(true);
    try {
      await api.put(`/users/${student.id}`, { is_active: !data.is_active });
      toast.success(`Akun ${!data.is_active ? 'diaktifkan' : 'dinonaktifkan'}`);
      setData({ ...data, is_active: !data.is_active });
    } catch (e) {
      toast.error('Gagal toggle');
    } finally {
      setBusy(false);
    }
  };

  const copyText = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Disalin ke clipboard');
  };

  // Simple text-based QR placeholder (real QR would need a library)
  const loginInfo = JSON.stringify({
    app: 'MATSANDATAMA',
    username: data?.username,
    url: window.location.origin + '/login',
  });

  const handleOpenChange = (isOpen) => {
    if (!isOpen) {
      onClose();
      // Blur any focused element after modal closes
      requestAnimationFrame(() => {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
        data-testid="account-info-dialog"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#006837]" />
            <span>Info Akun: {data?.full_name}</span>
            {data?.is_active ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 ml-2">Aktif</Badge>
            ) : (
              <Badge variant="outline" className="ml-2">Nonaktif</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" />
            Memuat data akun...
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-slate-100">
              <TabsTrigger value="akun" data-testid="tab-akun"><User className="h-3.5 w-3.5 mr-1" /> Detail Akun</TabsTrigger>
              <TabsTrigger value="qr" data-testid="tab-qr"><QrCode className="h-3.5 w-3.5 mr-1" /> QR Akses</TabsTrigger>
              <TabsTrigger value="audit" data-testid="tab-audit"><History className="h-3.5 w-3.5 mr-1" /> Log Aktivitas <Badge variant="secondary" className="ml-1.5 px-1.5 text-xs">{logs.length}</Badge></TabsTrigger>
            </TabsList>

            <TabsContent value="akun" className="mt-4 space-y-4">
              <Card>
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-slate-700">Informasi Akun</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InfoItem icon={User} label="Username" value={data?.username} mono copy onCopy={() => copyText(data.username)} />
                    <InfoItem icon={Hash} label={isStaff ? "NIP/NUPTK" : "NISN"} value={isStaff ? (data?.nip_nuptk || '-') : (data?.nisn || '-')} mono />
                    <InfoItem icon={Mail} label="Email" value={data?.email || '-'} />
                    <InfoItem icon={Phone} label="No HP" value={data?.phone || '-'} mono />
                  </div>
                  <div className="pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
                      <div>
                        <div className="font-semibold text-sm">Status Akun</div>
                        <div className="text-xs text-slate-500">Saat nonaktif, pengguna tidak bisa login</div>
                      </div>
                      <Switch checked={!!data?.is_active} onCheckedChange={handleToggleActive} disabled={busy} data-testid="toggle-active" />
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 mt-2">
                    Login terakhir: {data?.last_login_at ? new Date(data.last_login_at).toLocaleString('id-ID') : <span className="italic">belum pernah login</span>}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-slate-700">Reset Password</h3>
                  <Alert className="border-amber-200 bg-amber-50">
                    <AlertCircle className="h-4 w-4 text-amber-700" />
                    <AlertDescription className="text-amber-900 text-xs">
                      Password lama akan langsung tidak berlaku setelah reset. Beritahukan password baru kepada {isStaff ? 'GTK' : 'siswa'} secara langsung.
                    </AlertDescription>
                  </Alert>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label className="text-xs uppercase text-slate-500">Password Baru</Label>
                      <div className="relative mt-1">
                        <Input type={showPassword ? 'text' : 'password'} value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Min. 6 karakter"
                          className="pr-10 font-mono"
                          data-testid="new-password-input" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <Button variant="outline" onClick={handleGeneratePassword} className="gap-1" data-testid="generate-password">
                      <RotateCcw className="h-3.5 w-3.5" /> Acak
                    </Button>
                  </div>
                  {generatedPassword && (
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-between">
                      <div>
                        <div className="text-xs text-blue-700 mb-0.5">Password baru:</div>
                        <div className="text-xl font-bold font-mono tracking-wider text-blue-900">{generatedPassword}</div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => copyText(generatedPassword)} className="gap-1">
                        <Copy className="h-3.5 w-3.5" /> Salin
                      </Button>
                    </div>
                  )}
                  <Button onClick={handleResetPassword} disabled={busy || !newPassword}
                    className="w-full bg-[#006837] hover:bg-[#0B7A3B] gap-2 h-11"
                    data-testid="reset-password-button">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                    Reset Password
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="qr" className="mt-4 space-y-4">
              <Card>
                <CardContent className="p-6 text-center space-y-4">
                  <div>
                    <h3 className="font-semibold text-slate-900">QR Akses Cepat</h3>
                    <p className="text-xs text-slate-600 mt-1">Cetak & tempelkan untuk kemudahan akses login cepat</p>
                  </div>
                  <div className="inline-block p-4 bg-white border-2 border-slate-300 rounded-2xl">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(loginInfo)}`}
                      alt="QR akses"
                      className="w-60 h-60"
                      data-testid="qr-image"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-left max-w-md mx-auto">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <div className="text-xs text-slate-500 uppercase">Username</div>
                      <div className="font-mono font-bold">{data?.username}</div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <div className="text-xs text-slate-500 uppercase">URL Login</div>
                      <div className="font-mono text-xs">{window.location.origin}/login</div>
                    </div>
                  </div>
                  <Button onClick={() => window.print()} variant="outline" className="gap-2">
                    <QrCode className="h-4 w-4" /> Cetak QR
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  <div className="p-4 border-b border-slate-100">
                    <h3 className="font-semibold text-sm">Log Aktivitas Terkait Akun Ini</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Daftar perubahan & aksi terhadap data pengguna ini</p>
                  </div>
                  <div className="overflow-x-auto max-h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Waktu</TableHead>
                          <TableHead>Aksi</TableHead>
                          <TableHead>Oleh</TableHead>
                          <TableHead>Detail</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map((l) => (
                          <TableRow key={l.id}>
                            <TableCell className="text-xs font-mono whitespace-nowrap">{new Date(l.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{l.action}</Badge>
                            </TableCell>
                            <TableCell className="text-xs">{l.user_name || l.user_id || '-'}</TableCell>
                            <TableCell className="text-xs max-w-xs">
                              {l.details ? JSON.stringify(l.details).substring(0, 80) : <span className="text-slate-400">-</span>}
                            </TableCell>
                          </TableRow>
                        ))}
                        {logs.length === 0 && (
                          <TableRow><TableCell colSpan={4} className="text-center py-12 text-slate-500">
                            <History className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                            Belum ada log untuk akun ini
                          </TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoItem({ icon: Icon, label, value, mono, copy, onCopy }) {
  return (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-50">
      <Icon className="h-4 w-4 text-slate-500 mt-1 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs uppercase text-slate-500">{label}</div>
        <div className={`text-sm font-semibold ${mono ? 'font-mono' : ''} truncate`}>{value || '-'}</div>
      </div>
      {copy && value && (
        <button onClick={onCopy} className="text-slate-400 hover:text-slate-700" title="Salin">
          <Copy className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
