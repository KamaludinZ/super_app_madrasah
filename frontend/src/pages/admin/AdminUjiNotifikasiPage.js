import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BellRing, Loader2, Send, Smartphone, Globe, CheckCircle2, XCircle, MinusCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

const LABEL_KANAL = {
  pengumuman: 'Pengumuman',
  'pengingat-mengajar': 'Pengingat Mengajar',
  'guru-pengganti': 'Guru Pengganti',
  umum: 'Notifikasi Umum',
};

function StatusKirim({ hasil, ikon: Ikon, label }) {
  if (!hasil) return null;
  const ok = hasil.sent > 0;
  const lewat = hasil.skipped || (!hasil.sent && !hasil.failed);
  const Tanda = ok ? CheckCircle2 : lewat ? MinusCircle : XCircle;
  const warna = ok ? 'text-emerald-700' : lewat ? 'text-slate-400' : 'text-red-600';
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${warna}`} title={label}>
      <Ikon className="h-3.5 w-3.5" />
      <Tanda className="h-3.5 w-3.5" />
      {ok ? `${hasil.sent}` : lewat ? 'tidak ada' : `gagal ${hasil.failed}`}
    </span>
  );
}

// Admin: kirim contoh setiap jenis notifikasi ke AKUN SENDIRI untuk memeriksa tampilan di HP/browser
// (muncul, kanal Android, dan layar tujuan saat diketuk). Pengguna lain tidak menerima apa pun.
export default function AdminUjiNotifikasiPage() {
  const { activeRole } = useAuth();
  const [info, setInfo] = useState(null);
  const [hasil, setHasil] = useState({});
  const [proses, setProses] = useState('');

  const muat = useCallback(() => {
    api.get('/admin/notifikasi/uji').then(({ data }) => setInfo(data)).catch(() => toast.error('Gagal memuat daftar notifikasi'));
  }, []);

  useEffect(() => { if (activeRole === 'admin') muat(); }, [activeRole, muat]);

  if (activeRole !== 'admin') return <Navigate to="/dashboard" replace />;

  const kirim = async (jenis) => {
    setProses(jenis ? jenis[0] : 'semua');
    try {
      const { data } = await api.post('/admin/notifikasi/uji', { jenis: jenis || null });
      setInfo((i) => ({ ...i, perangkat: data.perangkat }));
      setHasil((h) => ({ ...h, ...Object.fromEntries(data.hasil.map((x) => [x.type, x])) }));
      const terkirim = data.hasil.filter((x) => x.aplikasi.sent > 0).length;
      toast.success(`${data.hasil.length} notifikasi uji dikirim · ${terkirim} sampai ke aplikasi HP`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal mengirim notifikasi uji');
    } finally {
      setProses('');
    }
  };

  const p = info?.perangkat;

  return (
    <div className="space-y-6" data-testid="admin-uji-notifikasi">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <BellRing className="h-3 w-3 mr-1" /> Notifikasi
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Uji Notifikasi</h1>
          <p className="text-sm text-slate-600 mt-1">Kirim contoh setiap jenis notifikasi ke akun Anda sendiri untuk diperiksa di HP</p>
        </div>
        <Button onClick={() => kirim(null)} disabled={!!proses || !info} className="bg-[#006837] hover:bg-[#005830]" data-testid="uji-kirim-semua">
          {proses === 'semua' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Kirim semua ({info?.jenis?.length || 0})
        </Button>
      </div>

      <p className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        Notifikasi hanya dikirim ke akun Anda, berjudul [UJI]. Di HP, ketuk tiap notifikasi untuk memastikan layar tujuannya benar.
      </p>

      {p && (
        <div className="grid gap-3 sm:grid-cols-2" data-testid="uji-status-perangkat">
          <Card className={p.perangkat_aplikasi ? '' : 'border-amber-300 bg-amber-50/60'}>
            <CardContent className="flex items-center gap-3 p-4">
              <Smartphone className="h-6 w-6 text-slate-500" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Aplikasi HP: {p.perangkat_aplikasi} perangkat</p>
                <p className="text-xs text-slate-500">
                  {!p.expo_aktif ? 'Push aplikasi dimatikan di server (EXPO_PUSH_ENABLED).'
                    : p.perangkat_aplikasi ? 'Siap menerima notifikasi.' : 'Belum ada HP terdaftar — buka aplikasi & izinkan notifikasi.'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Globe className="h-6 w-6 text-slate-500" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Web push: {p.web_push_langganan} browser</p>
                <p className="text-xs text-slate-500">{p.web_push_aktif ? 'Notifikasi browser/PWA (iPhone lewat PWA).' : 'Web push belum dikonfigurasi di server.'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="divide-y p-0">
          {!info ? (
            <div className="p-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-[#006837]" /></div>
          ) : info.jenis.map((j) => {
            const h = hasil[j.type];
            return (
              <div key={j.type} className="flex flex-wrap items-center gap-3 px-4 py-3" data-testid={`uji-jenis-${j.type}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{j.label}</p>
                  <p className="text-xs text-slate-500">
                    <span className="font-mono">{j.type}</span> · kanal {LABEL_KANAL[j.channel] || j.channel}{j.route ? ` · buka ${j.route}` : ''}
                  </p>
                </div>
                {h && (
                  <div className="flex items-center gap-3">
                    <StatusKirim hasil={h.aplikasi} ikon={Smartphone} label="Aplikasi HP" />
                    <StatusKirim hasil={h.web} ikon={Globe} label="Web push" />
                  </div>
                )}
                <Button size="sm" variant="outline" onClick={() => kirim([j.type])} disabled={!!proses}>
                  {proses === j.type ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Kirim
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
