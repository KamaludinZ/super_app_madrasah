import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, RefreshCw, LogIn, TrendingUp, Calendar, DollarSign, Activity } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import MadrasahBackdrop from '@/components/branding/MadrasahBackdrop';
import { usePublicPagesVisibility } from '@/hooks/usePublicPagesVisibility';

export default function LoginPage() {
  const nav = useNavigate();
  const { user, login, settings } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { visibility, loading: visibilityLoading } = usePublicPagesVisibility();

  // Check if user is logged in (for dashboard-only pages)
  const isLoggedIn = !!localStorage.getItem('matsa_token');

  // Define all public pages with their visibility keys
  const allPublicPages = [
    {
      to: '/public/monitoring',
      icon: Activity,
      label: 'Monitoring Jurnal Publik',
      shortLabel: 'Monitoring Jurnal',
      description: 'Pantau aktivitas mengajar secara realtime',
      colorScheme: {
        bg: 'bg-gradient-to-br from-blue-50 to-blue-100/50',
        border: 'border-blue-200',
        icon: 'bg-blue-500',
        text: 'text-blue-900',
        textHover: 'group-hover:text-blue-700',
        iconColor: 'text-blue-600',
        bgMobile: 'bg-blue-50',
        hoverMobile: 'hover:bg-blue-100'
      },
      visibilityKey: 'monitoring_visibility',
      testId: 'link-public-monitoring'
    },
    {
      to: '/public/prestasi',
      icon: TrendingUp,
      label: 'Prestasi Madrasah',
      shortLabel: 'Prestasi Madrasah',
      description: 'Lihat pencapaian dan penghargaan',
      colorScheme: {
        bg: 'bg-gradient-to-br from-amber-50 to-amber-100/50',
        border: 'border-amber-200',
        icon: 'bg-amber-500',
        text: 'text-amber-900',
        textHover: 'group-hover:text-amber-700',
        iconColor: 'text-amber-600',
        bgMobile: 'bg-amber-50',
        hoverMobile: 'hover:bg-amber-100'
      },
      visibilityKey: 'prestasi_visibility',
      testId: 'link-public-prestasi'
    },
    {
      to: '/public/agenda',
      icon: Calendar,
      label: 'Agenda Kegiatan',
      shortLabel: 'Agenda Kegiatan',
      description: 'Jadwal dan kegiatan madrasah',
      colorScheme: {
        bg: 'bg-gradient-to-br from-purple-50 to-purple-100/50',
        border: 'border-purple-200',
        icon: 'bg-purple-500',
        text: 'text-purple-900',
        textHover: 'group-hover:text-purple-700',
        iconColor: 'text-purple-600',
        bgMobile: 'bg-purple-50',
        hoverMobile: 'hover:bg-purple-100'
      },
      visibilityKey: 'agenda_visibility',
      testId: 'link-public-agenda'
    },
    {
      to: '/public/rkam',
      icon: DollarSign,
      label: 'RKAM & Transparansi Keuangan',
      shortLabel: 'RKAM & Keuangan',
      description: 'Laporan anggaran dan realisasi dana',
      colorScheme: {
        bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50',
        border: 'border-emerald-200',
        icon: 'bg-emerald-600',
        text: 'text-emerald-900',
        textHover: 'group-hover:text-emerald-700',
        iconColor: 'text-emerald-600',
        bgMobile: 'bg-emerald-50',
        hoverMobile: 'hover:bg-emerald-100'
      },
      visibilityKey: 'rkam_visibility',
      testId: 'link-public-rkam'
    }
  ];

  // Filter pages based on visibility settings
  const visiblePublicPages = useMemo(() => {
    // While loading, show nothing to prevent showing wrong menus
    if (visibilityLoading) return [];

    return allPublicPages.filter(page => {
      const visibilitySetting = visibility[page.visibilityKey];

      // Hidden: never show
      if (visibilitySetting === 'hidden') return false;

      // Dashboard only: only show if logged in
      if (visibilitySetting === 'dashboard') return isLoggedIn;

      // Public: always show
      return true;
    });
  }, [visibility, visibilityLoading, isLoggedIn]);

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

          {visiblePublicPages.length > 0 && (
            <div className="pt-4 space-y-3 max-w-md">
              <div className="text-sm font-semibold text-slate-900 mb-3">Layanan Publik Tersedia</div>

              {visiblePublicPages.map((page) => {
                const Icon = page.icon;
                return (
                  <Link
                    key={page.to}
                    to={page.to}
                    className={`group flex items-start gap-3 p-4 rounded-xl ${page.colorScheme.bg} border ${page.colorScheme.border} hover:shadow-md transition-all duration-200`}
                    data-testid={page.testId}
                  >
                    <div className={`h-10 w-10 rounded-lg ${page.colorScheme.icon} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className={`font-semibold ${page.colorScheme.text} text-sm ${page.colorScheme.textHover}`}>{page.label}</div>
                      <div className={`text-xs ${page.colorScheme.text} mt-0.5`}>{page.description}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
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

              {visiblePublicPages.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-200 lg:hidden space-y-2">
                  <div className="text-xs font-semibold text-slate-700 mb-2">Layanan Publik</div>

                  {visiblePublicPages.map((page) => {
                    const Icon = page.icon;
                    return (
                      <Link
                        key={page.to}
                        to={page.to}
                        className={`group flex items-center gap-2 p-3 rounded-lg ${page.colorScheme.bgMobile} border ${page.colorScheme.border} ${page.colorScheme.hoverMobile} transition-colors`}
                        data-testid={`${page.testId}-mobile`}
                      >
                        <Icon className={`h-4 w-4 ${page.colorScheme.iconColor} shrink-0`} />
                        <div className={`flex-1 text-sm font-medium ${page.colorScheme.text}`}>{page.shortLabel}</div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Version info at bottom */}
      <div className="absolute bottom-4 left-0 right-0 text-center">
        <p className="text-xs text-slate-500">
          Super Apps MATSANDATAMA v1.1.0 &copy; {new Date().getFullYear()} - Kementerian Agama RI
        </p>
      </div>
    </div>
  );
}
