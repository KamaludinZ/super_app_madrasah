import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
  const nav = useNavigate();
  const { settings } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) {
      toast.error('Masukkan username atau email');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { identifier: identifier.trim() });
      setMsg(data.message || 'Jika akun terdaftar dengan email, instruksi reset telah dikirim.');
      setSent(true);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Gagal mengirim permintaan');
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

            <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-3">Lupa Password</Badge>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Reset Password</h1>
            <p className="text-sm text-slate-600 mb-6">
              Masukkan username atau email Anda. Kami akan kirim tautan reset password ke email yang terdaftar.
            </p>

            {sent ? (
              <Alert className="border-emerald-200 bg-emerald-50" data-testid="forgot-password-success">
                <Mail className="h-4 w-4 text-emerald-700" />
                <AlertDescription className="text-emerald-900">
                  {msg}
                  <div className="mt-3">
                    <Button onClick={() => nav('/login')} className="w-full bg-[#006837] hover:bg-[#0B7A3B]" data-testid="back-to-login">
                      Kembali ke Login
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" data-testid="forgot-password-form">
                <div>
                  <Label htmlFor="identifier" className="text-sm font-medium">Username atau Email</Label>
                  <Input id="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="contoh: guru1 atau guru1@matsa.sch.id" className="h-11 mt-1" autoFocus
                    data-testid="forgot-identifier-input" />
                </div>
                <Button type="submit" disabled={submitting}
                  className="w-full h-11 bg-[#006837] hover:bg-[#0B7A3B] gap-2"
                  data-testid="forgot-submit-button">
                  {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Mengirim...</> : <><Mail className="h-4 w-4" /> Kirim Tautan Reset</>}
                </Button>
              </form>
            )}

            <div className="mt-6 pt-4 border-t border-slate-200">
              <Link to="/login" className="inline-flex items-center gap-1 text-sm text-[#006837] hover:underline font-medium" data-testid="link-back-login">
                <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Halaman Login
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
