import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, KeyRound, Loader2, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

export default function ResetPasswordPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');
  const { settings } = useAuth();
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setValidating(false);
      setTokenValid(false);
      return;
    }
    (async () => {
      try {
        await api.get(`/auth/reset-password/validate/${token}`);
        setTokenValid(true);
      } catch (e) {
        setTokenValid(false);
      } finally {
        setValidating(false);
      }
    })();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (pwd.length < 6) {
      toast.error('Password minimal 6 karakter');
      return;
    }
    if (pwd !== confirm) {
      toast.error('Konfirmasi password tidak cocok');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token, new_password: pwd });
      setDone(true);
      toast.success('Password berhasil diperbarui');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Gagal reset password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-hero-wash flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-pattern-geometric opacity-50 pointer-events-none" />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="relative w-full max-w-md">
        <Card className="shadow-xl border-slate-200 surface-ivory">
          <CardContent className="p-8">
            <div className="flex items-center gap-3 mb-6">
              {settings?.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="h-12 w-12 object-contain" />
              ) : (
                <div className="h-12 w-12 rounded-xl bg-brand-gradient flex items-center justify-center text-white font-bold">MS</div>
              )}
              <div>
                <div className="text-sm font-bold text-[#006837]">SUPER APPS</div>
                <div className="text-xs text-slate-600">MATSANDATAMA</div>
              </div>
            </div>

            {validating ? (
              <div className="py-8 text-center text-sm text-slate-600" data-testid="reset-validating">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#006837]" />
                Memeriksa tautan...
              </div>
            ) : !tokenValid ? (
              <Alert className="border-rose-200 bg-rose-50" data-testid="reset-token-invalid">
                <ShieldAlert className="h-4 w-4 text-rose-700" />
                <AlertDescription className="text-rose-900">
                  <div className="font-semibold mb-1">Tautan tidak valid</div>
                  <p className="text-sm">Tautan reset password kedaluwarsa atau sudah digunakan. Silakan minta tautan baru.</p>
                  <div className="mt-3 flex gap-2">
                    <Button onClick={() => nav('/forgot-password')} className="bg-[#006837] hover:bg-[#0B7A3B]" data-testid="request-new-link">
                      Minta Tautan Baru
                    </Button>
                    <Button onClick={() => nav('/login')} variant="outline" data-testid="back-to-login-invalid">
                      Login
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : done ? (
              <Alert className="border-emerald-200 bg-emerald-50" data-testid="reset-success">
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                <AlertDescription className="text-emerald-900">
                  <div className="font-semibold mb-1">Password berhasil diperbarui</div>
                  <p className="text-sm mb-3">Silakan login dengan password baru Anda.</p>
                  <Button onClick={() => nav('/login')} className="w-full bg-[#006837] hover:bg-[#0B7A3B]" data-testid="go-to-login">
                    Ke Halaman Login
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-3">Reset Password</Badge>
                <h1 className="text-2xl font-bold text-slate-900 mb-1">Buat Password Baru</h1>
                <p className="text-sm text-slate-600 mb-6">Masukkan password baru Anda di bawah ini.</p>

                <form onSubmit={handleSubmit} className="space-y-4" data-testid="reset-password-form">
                  <div>
                    <Label htmlFor="new-pwd" className="text-sm font-medium">Password Baru</Label>
                    <div className="relative mt-1">
                      <Input id="new-pwd" type={show ? 'text' : 'password'} value={pwd}
                        onChange={(e) => setPwd(e.target.value)} placeholder="Minimal 6 karakter"
                        className="h-11 pr-10" autoComplete="new-password" data-testid="new-password-input" />
                      <button type="button" onClick={() => setShow(!show)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-slate-900">
                        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="confirm-pwd" className="text-sm font-medium">Konfirmasi Password</Label>
                    <Input id="confirm-pwd" type={show ? 'text' : 'password'} value={confirm}
                      onChange={(e) => setConfirm(e.target.value)} placeholder="Ulangi password baru"
                      className="h-11 mt-1" autoComplete="new-password" data-testid="confirm-password-input" />
                  </div>
                  <Button type="submit" disabled={submitting}
                    className="w-full h-11 bg-[#006837] hover:bg-[#0B7A3B] gap-2"
                    data-testid="reset-submit-button">
                    {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Memproses...</> : <><KeyRound className="h-4 w-4" /> Simpan Password Baru</>}
                  </Button>
                </form>
              </>
            )}

            <div className="mt-6 pt-4 border-t border-slate-200 text-center">
              <Link to="/login" className="text-sm text-[#006837] hover:underline font-medium">
                ← Kembali ke Login
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
