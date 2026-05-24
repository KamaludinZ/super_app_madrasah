import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Html5Qrcode } from 'html5-qrcode';
import CameraScanner from '@/components/scanner/CameraScanner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScanLine, MapPin, CheckCircle2, XCircle, Loader2, Camera, ArrowLeft, ShieldCheck, Clock, Send, RotateCw, AlertCircle, KeyRound, Hash, UserCheck } from 'lucide-react';
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

const STATUS_OPTIONS = [
  { value: 'hadir', label: 'Hadir', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { value: 'sakit', label: 'Sakit', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { value: 'izin', label: 'Izin', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'alpa', label: 'Alpa', color: 'bg-rose-100 text-rose-700 border-rose-300' },
];

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
  const [students, setStudents] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Indikator & Materi options
  const [indikatorList, setIndikatorList] = useState([]);
  const [materiList, setMateriList] = useState([]);
  const [selectedIndikator, setSelectedIndikator] = useState('');
  const [selectedMateri, setSelectedMateri] = useState('');
  const [materiInputMode, setMateriInputMode] = useState('select'); // 'select' or 'manual'

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

  const handleQrDecoded = useCallback(async (token) => {
    console.log('[QR] Decoded token:', token);
    setQrToken(token);
    setPhase('validating');

    // Stop scanner immediately after decode
    await stopScanner();

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
        // Load students from the class
        if (data.context?.schedule?.class_id) {
          loadStudents(data.context.schedule.class_id);
        }
        // Load indikator & materi options
        if (data.context?.schedule?.subject_name) {
          loadIndikatorMateri(data.context.schedule.subject_name, data.context?.schedule?.semester);
        }
      } else {
        setPhase('error');
        toast.error('Validasi gagal: ' + (data.qr?.reason || data.schedule?.reason || data.gps?.reason || 'Tidak diketahui'));
      }
    } catch (e) {
      setPhase('error');
      setError(e?.response?.data?.detail || 'Gagal validasi QR');
    }
  }, [gps]);

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
        // Load students from the class
        if (data.context?.schedule?.class_id) {
          loadStudents(data.context.schedule.class_id);
        }
        // Load indikator & materi options
        if (data.context?.schedule?.subject_name) {
          loadIndikatorMateri(data.context.schedule.subject_name, data.context?.schedule?.semester);
        }
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

  const loadStudents = async (classId) => {
    setLoadingStudents(true);
    try {
      const { data } = await api.get('/students', { params: { class_id: classId } });
      setStudents(data);
      // Initialize all students as 'hadir' by default
      const initialRecords = {};
      data.forEach((stu) => {
        initialRecords[stu.id] = 'hadir';
      });
      setAttendanceRecords(initialRecords);
    } catch (e) {
      toast.error('Gagal memuat daftar siswa');
    } finally {
      setLoadingStudents(false);
    }
  };

  const loadIndikatorMateri = async (mataPelajaran, semester) => {
    try {
      const params = { mata_pelajaran: mataPelajaran };
      if (semester) params.semester = semester;

      const [indikatorRes, materiRes] = await Promise.all([
        api.get('/indikator', { params }),
        api.get('/materi', { params }),
      ]);

      setIndikatorList(indikatorRes.data || []);
      setMateriList(materiRes.data || []);
    } catch (e) {
      console.error('Failed to load indikator/materi:', e);
    }
  };

  // Auto-calculate attendance counts from individual records
  const attendanceSummary = useMemo(() => {
    return students.reduce((acc, s) => {
      const status = attendanceRecords[s.id] || 'hadir';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, { hadir: 0, sakit: 0, izin: 0, alpa: 0 });
  }, [students, attendanceRecords]);

  const setAllStatus = (status) => {
    const newRec = {};
    students.forEach((s) => { newRec[s.id] = status; });
    setAttendanceRecords(newRec);
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

      // Use auto-calculated counts from individual attendance
      const payload = isClassToken
        ? {
            class_token: qrToken.replace('CLASS:', ''),
            user_lat: gps?.lat ?? null,
            user_lon: gps?.lon ?? null,
            materi: form.materi,
            catatan: form.catatan,
            siswa_hadir: attendanceSummary.hadir,
            siswa_tidak_hadir: attendanceSummary.alpa,
            siswa_izin: attendanceSummary.izin,
            siswa_sakit: attendanceSummary.sakit,
          }
        : {
            qr_token: qrToken,
            user_lat: gps?.lat ?? null,
            user_lon: gps?.lon ?? null,
            materi: form.materi,
            catatan: form.catatan,
            siswa_hadir: attendanceSummary.hadir,
            siswa_tidak_hadir: attendanceSummary.alpa,
            siswa_izin: attendanceSummary.izin,
            siswa_sakit: attendanceSummary.sakit,
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
    setStudents([]);
    setAttendanceRecords({});
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
                      {validation.context?.schedule?.jtm_count && validation.context.schedule.jtm_count > 1 && (
                        <span className="ml-2 font-semibold">• {validation.context.schedule.jtm_count} JTM</span>
                      )}
                    </div>
                    {validation.context?.schedule?.hour_range && (
                      <div className="text-[10px] text-emerald-700 mt-0.5">
                        {validation.context.schedule.hour_range} ({validation.context.schedule.time_range || `${validation.context.schedule.start_time}-${validation.context.schedule.end_time}`})
                      </div>
                    )}
                  </div>
                </div>
                <ValidationDetails validation={validation} compact />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h2 className="text-base font-semibold text-slate-900 mb-4">Form Jurnal Mengajar</h2>
                <form onSubmit={handleSubmitJurnal} className="space-y-4" data-testid="jurnal-form">
                  {/* KD/Indikator Selection (Optional) */}
                  {indikatorList.length > 0 && (
                    <div>
                      <Label htmlFor="indikator">KD/Indikator (Opsional)</Label>
                      <Select value={selectedIndikator || "none"} onValueChange={(v) => setSelectedIndikator(v === "none" ? "" : v)}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Pilih KD/Indikator (opsional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Tidak memilih</SelectItem>
                          {indikatorList.map((ind) => (
                            <SelectItem key={ind.id} value={ind.id}>
                              {ind.kode_kd} - {ind.deskripsi.substring(0, 60)}...
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Materi Input - with options from database or manual */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label htmlFor="materi">Materi yang Diajarkan <span className="text-rose-600">*</span></Label>
                      {materiList.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setMateriInputMode(materiInputMode === 'select' ? 'manual' : 'select')}
                          className="h-6 text-xs"
                        >
                          {materiInputMode === 'select' ? 'Input Manual' : 'Pilih dari Daftar'}
                        </Button>
                      )}
                    </div>

                    {materiInputMode === 'select' && materiList.length > 0 ? (
                      <div className="space-y-2">
                        <Select
                          value={selectedMateri || "none"}
                          onValueChange={(val) => {
                            const realVal = val === "none" ? "" : val;
                            setSelectedMateri(realVal);
                            if (val === 'lainnya') {
                              setMateriInputMode('manual');
                              setForm({ ...form, materi: '' });
                            } else if (realVal) {
                              const materi = materiList.find((m) => m.id === realVal);
                              setForm({ ...form, materi: materi?.judul || '' });
                            } else {
                              setForm({ ...form, materi: '' });
                            }
                          }}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Pilih materi dari daftar..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="lainnya" className="font-semibold text-blue-600">
                              + Lainnya (Input Manual)
                            </SelectItem>
                            <SelectItem value="none">Tidak memilih</SelectItem>
                            {materiList.map((mat) => (
                              <SelectItem key={mat.id} value={mat.id}>
                                {mat.judul}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedMateri && selectedMateri !== 'lainnya' && (
                          <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded">
                            {materiList.find((m) => m.id === selectedMateri)?.deskripsi || 'Tidak ada deskripsi'}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Textarea
                        id="materi"
                        value={form.materi}
                        onChange={(e) => {
                          setForm({ ...form, materi: e.target.value });
                          setSelectedMateri('');
                        }}
                        placeholder="Contoh: Bab 3 - Bilangan Bulat Positif dan Negatif"
                        rows={3}
                        className="mt-1"
                        data-testid="jurnal-materi-input"
                        required
                      />
                    )}
                  </div>
                  <div>
                    <Label htmlFor="catatan">Catatan (Opsional)</Label>
                    <Textarea id="catatan" value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })}
                      placeholder="Catatan tambahan, tugas, kondisi kelas..." rows={2} className="mt-1" data-testid="jurnal-catatan-input" />
                  </div>
                  <Separator className="my-4" />

                  {/* Attendance Summary */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-[#006837]" />
                        <Label className="text-sm font-semibold">Presensi Siswa</Label>
                      </div>
                      <Button type="button" onClick={() => setAllStatus('hadir')} variant="outline" size="sm" className="h-7 text-xs">
                        Semua Hadir
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                      {STATUS_OPTIONS.map((opt) => (
                        <div key={opt.value} className={`rounded-lg border p-2 ${opt.color}`}>
                          <div className="text-[10px] font-semibold uppercase tracking-wide">{opt.label}</div>
                          <div className="text-xl font-extrabold tabular-nums" data-testid={`jurnal-count-${opt.value}`}>
                            {attendanceSummary[opt.value] || 0}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Student List */}
                    {loadingStudents ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-[#006837]" />
                      </div>
                    ) : students.length > 0 ? (
                      <div className="space-y-2 max-h-96 overflow-y-auto pr-2" data-testid="jurnal-attendance-list">
                        {students.map((s) => (
                          <div key={s.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 bg-white">
                            <div className="h-8 w-8 rounded-full bg-[#006837] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                              {s.full_name?.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold truncate">{s.full_name}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{s.nisn || '-'}</div>
                            </div>
                            <div className="flex gap-1">
                              {STATUS_OPTIONS.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setAttendanceRecords({ ...attendanceRecords, [s.id]: opt.value })}
                                  className={`px-2 py-1 rounded text-[10px] font-semibold border transition-colors ${
                                    attendanceRecords[s.id] === opt.value
                                      ? opt.color + ' ring-2 ring-offset-1 ring-[#006837]'
                                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                  }`}
                                  data-testid={`jurnal-attendance-${s.username}-${opt.value}`}
                                >
                                  {opt.label.charAt(0)}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-sm text-slate-500">
                        Tidak ada data siswa
                      </div>
                    )}
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
