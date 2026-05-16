import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, ShieldCheck, RefreshCw, BookOpen, LogIn } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import MadrasahBackdrop from '@/components/branding/MadrasahBackdrop';

export default function LoginPage() {
  const nav = useNavigate();
  const { user, login, settings } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadCaptcha = async () => {
    try {
      const { data } = await api.get('/auth/captcha');
      setCaptcha(data);
      setCaptchaAnswer('');
    } catch (e) {
      toast.error('Gagal memuat captcha');
    }
  };

  useEffect(() => { loadCaptcha(); }, []);
  useEffect(() => { if (user) nav('/dashboard'); }, [user, nav]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password || !captcha || captchaAnswer === '') {
      toast.error('Mohon lengkapi semua kolom');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/login', {
        username, password,
        captcha_id: captcha.challenge_id,
        captcha_answer: parseInt(captchaAnswer, 10),
      });
      await login(data.access_token, data.user, data.active_role, {
        expires_in_minutes: data.expires_in_minutes,
        idle_timeout_minutes: data.idle_timeout_minutes,
      });
      toast.success(`Selamat datang, ${data.user.full_name}`);
      nav('/dashboard');
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Login gagal';
      toast.error(typeof msg === 'string' ? msg : 'Login gagal');
      loadCaptcha();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-hero-wash flex items-center justify-center p-4 relative overflow-hidden">
      <MadrasahBackdrop />
      <div className="absolute inset-0 bg-pattern-geometric opacity-30 pointer-events-none" />
      <div className="relative w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Left brand panel - hidden on mobile */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="hidden lg:block space-y-6"
        >
          <div className="flex items-center gap-4">
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-16 w-16 object-contain" />
            ) : (
              <div className="h-16 w-16 rounded-2xl bg-brand-gradient flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                MS
              </div>
            )}
            <div>
              <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">Kementerian Agama RI</Badge>
              <h1 className="text-3xl font-extrabold text-[#006837] leading-tight">
                Super Apps<br />MATSANDATAMA
              </h1>
            </div>
          </div>
          <p className="text-slate-700 max-w-md leading-relaxed">
            Sistem digital terintegrasi untuk pengelolaan akademik, jurnal mengajar, dan layanan administrasi {settings?.school_name || 'MTsN 2 Kota Malang'}.
          </p>
          <div className="space-y-3 max-w-md">
            <Feature icon={ShieldCheck} title="Jurnal Presisi" desc="Sistem anti-manipulasi dengan validasi QR + Jadwal + GPS" />
            <Feature icon={BookOpen} title="Multi-Peran" desc="9 peran berbeda dengan fitur switch role yang seamless" />
          </div>
          <div className="pt-4 space-y-2">
            <Link to="/public/monitoring" className="block text-sm text-[#006837] hover:underline font-medium" data-testid="link-public-monitoring">
              → Lihat Monitoring Jurnal Publik (Realtime)
            </Link>
            <Link to="/public/prestasi" className="block text-sm text-[#006837] hover:underline font-medium" data-testid="link-public-prestasi">
              → Lihat Prestasi Madrasah
            </Link>
          </div>
        </motion.div>

        {/* Form panel */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="shadow-xl border-slate-200 surface-ivory">
            <CardContent className="p-8">
              <div className="lg:hidden flex items-center gap-3 mb-6">
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
              <h2 className="text-2xl font-bold text-slate-900 mb-1">Masuk</h2>
              <p className="text-sm text-slate-600 mb-6">Gunakan username dan password yang diberikan admin</p>

              <form className="space-y-4" onSubmit={handleSubmit} data-testid="login-form">
                <div>
                  <Label htmlFor="username" className="text-sm font-medium">Username</Label>
                  <Input
                    id="username"
                    data-testid="login-username-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="contoh: admin"
                    className="h-11 mt-1"
                    autoComplete="username"
                    autoFocus
                  />
                </div>
                <div>
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <div className="relative mt-1">
                    <Input
                      id="password"
                      data-testid="login-password-input"
                      type={showPwd ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-11 pr-10"
                      autoComplete="current-password"
                    />
                    <button type="button" onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-slate-900"
                      data-testid="login-toggle-password">
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Math Captcha */}
                <div className="bg-[#FBF7EE] rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                      Verifikasi Keamanan
                    </Label>
                    <button type="button" onClick={loadCaptcha} className="text-[#006837] hover:text-[#0B7A3B]"
                      data-testid="captcha-refresh" aria-label="Muat ulang captcha">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 font-mono text-lg font-semibold text-slate-900 bg-white px-3 py-2 rounded-lg border border-slate-200 select-none"
                      data-testid="captcha-question">
                      {captcha?.question || 'Memuat...'}
                    </div>
                    <Input
                      data-testid="login-math-captcha-input"
                      type="number"
                      value={captchaAnswer}
                      onChange={(e) => setCaptchaAnswer(e.target.value)}
                      placeholder="Jawaban"
                      className="h-11 w-24"
                    />
                  </div>
                </div>

                <Button type="submit" disabled={submitting}
                  data-testid="login-submit-button"
                  className="w-full h-11 bg-[#006837] hover:bg-[#0B7A3B] text-white font-semibold">
                  {submitting ? 'Memproses...' : (<><LogIn className="h-4 w-4 mr-2" /> Masuk</>)}
                </Button>

                <div className="text-center pt-1">
                  <Link to="/forgot-password" className="text-xs text-[#006837] hover:underline font-medium" data-testid="link-forgot-password">
                    Lupa password?
                  </Link>
                </div>
              </form>

              <div className="mt-6 pt-4 border-t border-slate-200 lg:hidden space-y-1">
                <Link to="/public/monitoring" className="block text-sm text-[#006837] hover:underline" data-testid="link-public-monitoring-mobile">
                  → Monitoring Publik
                </Link>
                <Link to="/public/prestasi" className="block text-sm text-[#006837] hover:underline" data-testid="link-public-prestasi-mobile">
                  → Prestasi Madrasah
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }) {
  return (
    <div className="flex items-start gap-3 bg-white/60 border border-slate-200 rounded-xl p-4">
      <div className="h-10 w-10 rounded-lg bg-[#006837]/10 flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-[#006837]" />
      </div>
      <div>
        <div className="font-semibold text-slate-900 text-sm">{title}</div>
        <div className="text-xs text-slate-600">{desc}</div>
      </div>
    </div>
  );
}
