import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Html5Qrcode } from 'html5-qrcode';
import CameraScanner from '@/components/scanner/CameraScanner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScanLine, MapPin, CheckCircle2, XCircle, Loader2, Camera, ArrowLeft, ShieldCheck, Clock, Send, RotateCw, AlertCircle, KeyRound, Hash } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export default function JurnalScanPage() {
  const nav = useNavigate();
  const scannerRef = useRef(null);
  const [phase, setPhase] = useState('idle'); // idle | scanning | validating | validated | submitting | success | error
  const [qrToken, setQrToken] = useState(null);
  const [gps, setGps] = useState(null);
  const [validation, setValidation] = useState(null);
  const [form, setForm] = useState({
    materi: '', catatan: '',
    siswa_hadir: 0, siswa_tidak_hadir: 0, siswa_izin: 0, siswa_sakit: 0,
  });
  const [manualToken, setManualToken] = useState('');
  const [classToken, setClassToken] = useState('');
  const [scanMode, setScanMode] = useState('qr'); // qr | class_token
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState(null);

  // Get GPS on mount
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => setGps({ lat: null, lon: null, error: 'GPS tidak tersedia' }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // FIX: kamera initialization sekarang di komponen CameraScanner — lihat di phase==='scanning' render.
  // Komponen tsb menjamin DOM element ada SEBELUM Html5Qrcode di-init.

  const startScanner = useCallback(() => {
    setError(null);
    setPhase('scanning');
  }, []);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch (_e) { /* noop */ }
      scannerRef.current = null;
    }
    setCameraReady(false);
  };

  useEffect(() => () => { stopScanner(); }, []);

  const handleQrDecoded = async (token) => {
    setQrToken(token);
    setPhase('validating');
    try {
      const { data } = await api.post('/jurnal/validate', {
        qr_token: token,
        user_lat: gps?.lat ?? null,
        user_lon: gps?.lon ?? null,
      });
      setValidation(data);
      if (data.overall_valid) {
        setPhase('validated');
        toast.success('QR Code valid! Silakan isi jurnal.');
      } else {
        setPhase('error');
        toast.error('Validasi gagal: ' + (data.qr?.reason || data.schedule?.reason || data.gps?.reason || 'Tidak diketahui'));
      }
    } catch (e) {
      setPhase('error');
      setError(e?.response?.data?.detail || 'Gagal validasi QR');
    }
  };

  const handleClassTokenSubmit = async (e) => {
    e.preventDefault();
    const t = classToken.trim().toUpperCase();
    if (!t) return;
    setClassToken(t);
    setQrToken(`CLASS:${t}`); // marker for submit phase to use class-token endpoint
    setPhase('validating');
    try {
      const { data } = await api.post('/jurnal/validate-by-class-token', {
        class_token: t,
        user_lat: gps?.lat ?? null,
        user_lon: gps?.lon ?? null,
      });
      setValidation(data);
      if (data.overall_valid) {
        setPhase('validated');
        toast.success('Token kelas valid! Silakan isi jurnal.');
      } else {
        setPhase('error');
        toast.error('Validasi gagal: ' + (data.qr?.reason || data.schedule?.reason || data.gps?.reason || 'Tidak diketahui'));
      }
    } catch (err) {
      setPhase('error');
      setError(err?.response?.data?.detail || 'Gagal validasi token kelas');
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    handleQrDecoded(manualToken.trim());
  };

  const handleSubmitJurnal = async (e) => {
    e.preventDefault();
    if (!form.materi.trim()) {
      toast.error('Materi pelajaran wajib diisi');
      return;
    }
    setPhase('submitting');
    try {
      const isClassToken = qrToken?.startsWith('CLASS:');
      const endpoint = isClassToken ? '/jurnal/by-class-token' : '/jurnal';
      const payload = isClassToken
        ? {
            class_token: qrToken.replace('CLASS:', ''),
            user_lat: gps?.lat ?? null,
            user_lon: gps?.lon ?? null,
            ...form,
            siswa_hadir: parseInt(form.siswa_hadir) || 0,
            siswa_tidak_hadir: parseInt(form.siswa_tidak_hadir) || 0,
            siswa_izin: parseInt(form.siswa_izin) || 0,
            siswa_sakit: parseInt(form.siswa_sakit) || 0,
          }
        : {
            qr_token: qrToken,
            user_lat: gps?.lat ?? null,
            user_lon: gps?.lon ?? null,
            ...form,
            siswa_hadir: parseInt(form.siswa_hadir) || 0,
            siswa_tidak_hadir: parseInt(form.siswa_tidak_hadir) || 0,
            siswa_izin: parseInt(form.siswa_izin) || 0,
            siswa_sakit: parseInt(form.siswa_sakit) || 0,
          };
      await api.post(endpoint, payload);
      setPhase('success');
      toast.success('Jurnal berhasil disimpan!');
      setTimeout(() => nav('/jurnal/riwayat'), 1500);
    } catch (err) {
      setPhase('validated');
      const msg = err?.response?.data?.detail;
      toast.error(typeof msg === 'string' ? msg : (msg?.message || 'Gagal menyimpan jurnal'));
    }
  };

  const resetFlow = () => {
    setPhase('idle');
    setQrToken(null);
    setValidation(null);
    setError(null);
    setManualToken('');
    setClassToken('');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Badge className="bg-amber-100 text-amber-900 border-amber-200 mb-2">✦ Jurnal Presisi</Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Isi Jurnal Mengajar</h1>
          <p className="text-sm text-slate-600 mt-1">Scan QR Code di ruangan untuk membuka form jurnal</p>
        </div>
        <Button variant="ghost" onClick={() => nav(-1)} className="gap-2" data-testid="back-button">
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
      </div>

      {/* Security cues */}
      <Card className="border-[#006837]/20 bg-[#006837]/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-[#006837]" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-[#006837]">Validasi Berlapis</div>
              <div className="text-xs text-slate-600">Sistem akan memvalidasi: <strong>QR Code</strong> + <strong>Jadwal Mengajar</strong> + <strong>Lokasi GPS</strong></div>
            </div>
            <Badge variant="outline" className="text-xs">
              <MapPin className="h-3 w-3 mr-1" />
              {gps?.lat ? 'GPS Aktif' : 'GPS Belum'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <AnimatePresence mode="wait">
        {/* Phase: idle - Show scan options */}
        {phase === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {error && (
              <Alert className="bg-amber-50 border-amber-200 mb-3">
                <AlertCircle className="h-4 w-4 text-amber-700" />
                <AlertDescription className="text-amber-900 text-sm">{error}</AlertDescription>
              </Alert>
            )}
            <Card>
              <CardContent className="p-4 sm:p-6">
                <Tabs value={scanMode} onValueChange={setScanMode} className="w-full">
                  <TabsList className="grid grid-cols-3 mb-4">
                    <TabsTrigger value="qr" data-testid="tab-scan-qr"><Camera className="h-3.5 w-3.5 mr-1" /> Scan QR</TabsTrigger>
                    <TabsTrigger value="qr_token" data-testid="tab-scan-qr-token"><Hash className="h-3.5 w-3.5 mr-1" /> Token QR</TabsTrigger>
                    <TabsTrigger value="class_token" data-testid="tab-scan-class-token"><KeyRound className="h-3.5 w-3.5 mr-1" /> Token Kelas</TabsTrigger>
                  </TabsList>

                  <TabsContent value="qr" className="space-y-3 mt-0">
                    <p className="text-sm text-slate-600">Pindai kartu QR di depan kelas dengan kamera HP/laptop Anda.</p>
                    <Button onClick={startScanner} size="lg" className="w-full bg-[#006837] hover:bg-[#0B7A3B] gap-2 h-14 text-base" data-testid="jurnal-scan-start-button">
                      <Camera className="h-5 w-5" /> Buka Kamera & Scan QR
                    </Button>
                    <p className="text-xs text-slate-500">Catatan: izinkan akses kamera saat browser meminta. Untuk akses kamera, pastikan menggunakan koneksi HTTPS.</p>
                  </TabsContent>

                  <TabsContent value="qr_token" className="space-y-3 mt-0">
                    <p className="text-sm text-slate-600">Tempel token QR (string panjang) yang didapat dari admin atau halaman QR Generator.</p>
                    <form onSubmit={handleManualSubmit} className="flex gap-2">
                      <Input value={manualToken} onChange={(e) => setManualToken(e.target.value)} placeholder="Token QR..." className="flex-1 font-mono text-xs" data-testid="jurnal-manual-token-input" />
                      <Button type="submit" disabled={!manualToken.trim()} className="bg-[#006837] hover:bg-[#005a30]" data-testid="jurnal-manual-token-submit">Validasi</Button>
                    </form>
                    <p className="text-xs text-slate-500">Token QR biasanya berupa string acak yang ter-encrypt.</p>
                  </TabsContent>

                  <TabsContent value="class_token" className="space-y-3 mt-0">
                    <p className="text-sm text-slate-600">Masukkan <strong>Token Kelas</strong> (format mis. <code className="text-[11px] bg-slate-100 px-1 rounded">7A-2526-X9K2</code>). Token ini tertera di kartu QR dan bisa dilihat admin pada menu Kelas.</p>
                    <form onSubmit={handleClassTokenSubmit} className="flex gap-2">
                      <Input value={classToken} onChange={(e) => setClassToken(e.target.value.toUpperCase())} placeholder="Mis: 7A-2526-X9K2" className="flex-1 font-mono text-sm" data-testid="jurnal-class-token-input" />
                      <Button type="submit" disabled={!classToken.trim()} className="bg-[#006837] hover:bg-[#005a30]" data-testid="jurnal-class-token-submit">Validasi</Button>
                    </form>
                    <Alert className="bg-emerald-50 border-emerald-200">
                      <ShieldCheck className="h-4 w-4 text-emerald-700" />
                      <AlertDescription className="text-emerald-900 text-xs">
                        Token kelas adalah alternatif jika kamera tidak berfungsi. Sistem tetap memvalidasi jadwal & GPS Anda.
                      </AlertDescription>
                    </Alert>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Phase: scanning */}
        {phase === 'scanning' && (
          <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card>
              <CardContent className="p-4">
                <div className="mb-3 text-center">
                  <div className="text-sm font-semibold text-slate-900">Arahkan kamera ke QR Code ruangan</div>
                  <div className="text-xs text-slate-500">Sistem akan otomatis mendeteksi</div>
                </div>
                <CameraScanner
                  onDecoded={(token) => handleQrDecoded(token)}
                  onCancel={() => resetFlow()}
                />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Phase: validating */}
        {phase === 'validating' && (
          <motion.div key="validating" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card>
              <CardContent className="p-8 text-center">
                <Loader2 className="h-10 w-10 mx-auto text-[#006837] animate-spin mb-3" />
                <div className="font-semibold text-slate-900">Memvalidasi...</div>
                <div className="text-xs text-slate-600 mt-1">Memeriksa QR Code, Jadwal, dan GPS</div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Phase: error */}
        {phase === 'error' && validation && (
          <motion.div key="error" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-rose-200 bg-rose-50/50">
              <CardContent className="p-5">
                <div className="flex items-start gap-3 mb-4">
                  <XCircle className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-rose-900">Validasi Gagal</div>
                    <div className="text-sm text-rose-800/80">Jurnal tidak dapat dibuka karena alasan berikut:</div>
                  </div>
                </div>
                <ValidationDetails validation={validation} />
                <Button onClick={resetFlow} className="w-full mt-4 gap-2" data-testid="retry-scan">
                  <RotateCw className="h-4 w-4" /> Coba Lagi
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {phase === 'error' && !validation && error && (
          <motion.div key="error-msg" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button onClick={resetFlow} className="w-full mt-4" data-testid="retry-scan-2">Coba Lagi</Button>
          </motion.div>
        )}

        {/* Phase: validated -> show form */}
        {(phase === 'validated' || phase === 'submitting') && validation && (
          <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                  <div className="flex-1">
                    <div className="font-bold text-emerald-900">Terverifikasi: Jadwal & Lokasi</div>
                    <div className="text-xs text-emerald-800/80">
                      {validation.context?.schedule?.subject_name || ''} • {validation.context?.room?.name || ''}
                    </div>
                  </div>
                </div>
                <ValidationDetails validation={validation} compact />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h2 className="text-base font-semibold text-slate-900 mb-4">Form Jurnal Mengajar</h2>
                <form onSubmit={handleSubmitJurnal} className="space-y-4" data-testid="jurnal-form">
                  <div>
                    <Label htmlFor="materi">Materi yang Diajarkan <span className="text-rose-600">*</span></Label>
                    <Textarea id="materi" value={form.materi} onChange={(e) => setForm({ ...form, materi: e.target.value })}
                      placeholder="Contoh: Bab 3 - Bilangan Bulat Positif dan Negatif" rows={3} className="mt-1" data-testid="jurnal-materi-input" required />
                  </div>
                  <div>
                    <Label htmlFor="catatan">Catatan (Opsional)</Label>
                    <Textarea id="catatan" value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })}
                      placeholder="Catatan tambahan, tugas, kondisi kelas..." rows={2} className="mt-1" data-testid="jurnal-catatan-input" />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <NumberField label="Hadir" value={form.siswa_hadir} onChange={(v) => setForm({ ...form, siswa_hadir: v })} testid="jurnal-hadir" color="emerald" />
                    <NumberField label="Sakit" value={form.siswa_sakit} onChange={(v) => setForm({ ...form, siswa_sakit: v })} testid="jurnal-sakit" color="amber" />
                    <NumberField label="Izin" value={form.siswa_izin} onChange={(v) => setForm({ ...form, siswa_izin: v })} testid="jurnal-izin" color="blue" />
                    <NumberField label="Alpa" value={form.siswa_tidak_hadir} onChange={(v) => setForm({ ...form, siswa_tidak_hadir: v })} testid="jurnal-alpa" color="rose" />
                  </div>
                  <Button type="submit" disabled={phase === 'submitting'} className="w-full bg-[#006837] hover:bg-[#0B7A3B] gap-2 h-11" data-testid="jurnal-submit-button">
                    {phase === 'submitting' ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</> : <><Send className="h-4 w-4" /> Simpan Jurnal</>}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Phase: success */}
        {phase === 'success' && (
          <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="h-16 w-16 mx-auto text-emerald-600 mb-3" />
                <div className="text-xl font-bold text-emerald-900">Jurnal Berhasil Disimpan!</div>
                <div className="text-sm text-emerald-800/80 mt-1">Mengarahkan ke halaman riwayat...</div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NumberField({ label, value, onChange, testid, color }) {
  const colors = {
    emerald: 'border-emerald-200 bg-emerald-50/50',
    amber: 'border-amber-200 bg-amber-50/50',
    blue: 'border-blue-200 bg-blue-50/50',
    rose: 'border-rose-200 bg-rose-50/50',
  };
  return (
    <div className={`rounded-xl border p-2 ${colors[color]}`}>
      <Label className="text-xs font-semibold uppercase tracking-wide">{label}</Label>
      <Input type="number" min="0" value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 h-9 bg-white text-center font-mono font-bold" data-testid={testid} />
    </div>
  );
}

function ValidationDetails({ validation, compact = false }) {
  const items = [
    { key: 'qr', label: 'QR Code', icon: ScanLine },
    { key: 'schedule', label: 'Jadwal', icon: Clock },
    { key: 'gps', label: 'Lokasi GPS', icon: MapPin },
  ];
  return (
    <div className="space-y-2 mt-2" data-testid="jurnal-validation-result">
      {items.map(({ key, label, icon: Icon }) => {
        const v = validation[key];
        if (!v) return null;
        return (
          <div key={key} className="flex items-start gap-2 text-sm">
            <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${v.valid ? 'text-emerald-600' : 'text-rose-600'}`} />
            <div className="flex-1">
              <span className="font-semibold">{label}: </span>
              <span className={v.valid ? 'text-emerald-700' : 'text-rose-700'} data-testid={`jurnal-validation-reason-${key}`}>
                {v.reason}
              </span>
            </div>
            {v.valid ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-rose-600" />}
          </div>
        );
      })}
    </div>
  );
}
