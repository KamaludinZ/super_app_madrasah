import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, GraduationCap, RefreshCw, BookOpen, Key } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import MadrasahBackdrop from '@/components/branding/MadrasahBackdrop';

const KelasLoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  // Data dropdown
  const [academicYears, setAcademicYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [classes, setClasses] = useState([]);

  // Form data
  const [formData, setFormData] = useState({
    academic_year_id: '',
    semester_id: '',
    class_name: '',
    token: '',
    captcha_id: '',
    captcha_answer: '',
  });

  // Captcha
  const [captcha, setCaptcha] = useState(null);

  // Load initial data
  useEffect(() => {
    loadInitialData();
    loadCaptcha();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoadingData(true);

      // Load academic years (public endpoint)
      const ayRes = await api.get('/kelas/public/academic-years');
      const academicYearsData = ayRes.data || [];
      setAcademicYears(academicYearsData);

      // Load semesters (public endpoint)
      const semRes = await api.get('/kelas/public/semesters');
      const semestersData = semRes.data || [];
      setSemesters(semestersData);

      // Load classes (public endpoint)
      const classRes = await api.get('/kelas/public/classes');
      setClasses(classRes.data || []);

      // Auto-select active academic year and semester
      const activeAY = academicYearsData.find(ay => ay.is_active);
      const activeSem = semestersData.find(sem => sem.is_active);

      if (activeAY) {
        setFormData(prev => ({ ...prev, academic_year_id: activeAY.id }));
      }

      if (activeSem) {
        setFormData(prev => ({ ...prev, semester_id: activeSem.id }));
      }

      setLoadingData(false);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Gagal memuat data. Silakan refresh halaman.');
      setLoadingData(false);
    }
  };

  // Filter semesters by selected academic year
  const filteredSemesters = useMemo(() => {
    if (!formData.academic_year_id) return [];
    return semesters.filter(sem => sem.academic_year_id === formData.academic_year_id);
  }, [semesters, formData.academic_year_id]);

  // Filter classes by selected semester
  const filteredClasses = useMemo(() => {
    if (!formData.semester_id) return [];
    return classes.filter(cls => cls.semester_id === formData.semester_id);
  }, [classes, formData.semester_id]);

  const loadCaptcha = async () => {
    try {
      const res = await api.get('/auth/captcha');
      setCaptcha(res.data);
      setFormData((prev) => ({ ...prev, captcha_id: res.data.challenge_id, captcha_answer: '' }));
    } catch (err) {
      console.error('Error loading captcha:', err);
    }
  };

  // Format token with auto-dash insertion
  // Format: {CLASS_NAME}-{YEAR}-{CODE}
  // Example: 7A-2526-5UVZ or 7A-2026-AH5Q (2-3 chars - 4 DIGITS - 4 alphanumeric)
  const formatToken = (value) => {
    // Remove all non-alphanumeric characters and convert to uppercase
    const cleanValue = value.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (cleanValue.length === 0) return '';

    let formatted = '';

    // Part 1: Class name (2-3 characters: 7A, 8B, 10A, etc.)
    // Valid patterns:
    //   - digit + letter (7A, 8B, 9C)
    //   - 2 digits + letter (10A, 11B, 12C)
    // Part 2: Year (4 consecutive digits starting with 2: 2026, 2526)

    // Try matching pattern: (digit+letter OR 2digits+letter) followed by (year starting with 2)
    let yearMatch = cleanValue.match(/^(\d[A-Z])(\d{4})/);  // Pattern: 7A2026

    if (!yearMatch) {
      // Try 3-char class name pattern: 10A2026
      yearMatch = cleanValue.match(/^(\d{2}[A-Z])(\d{4})/);
    }

    if (yearMatch) {
      // Found valid class name + year pattern
      const classNameEnd = yearMatch[1].length;
      const part1 = yearMatch[1];
      formatted += part1;

      // Part 2: Year (must be 4 digits)
      const part2 = yearMatch[2];
      formatted += '-' + part2;

      // Part 3: Random code (4 characters after year)
      if (cleanValue.length > classNameEnd + 4) {
        const part3 = cleanValue.slice(classNameEnd + 4, classNameEnd + 8);
        formatted += '-' + part3;
      }
    } else {
      // No valid year pattern found yet, just show what user typed
      // Detect potential class name (default 2 chars, 3 if pattern matches)
      let classNameEnd = 2;

      // If starts with 2 digits followed by letter, use 3 chars
      if (cleanValue.match(/^\d{2}[A-Z]/)) {
        classNameEnd = 3;
      }

      const part1 = cleanValue.slice(0, classNameEnd);
      formatted += part1;

      if (cleanValue.length > classNameEnd) {
        const rest = cleanValue.slice(classNameEnd);
        formatted += '-' + rest;
      }
    }

    return formatted;
  };

  const handleChange = (field, value) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };

      // Reset semester when academic year changes
      if (field === 'academic_year_id') {
        newData.semester_id = '';
        newData.class_name = '';
      }

      // Reset class when semester changes
      if (field === 'semester_id') {
        newData.class_name = '';
      }

      return newData;
    });
    setError('');
  };

  const handleTokenChange = (e) => {
    const formatted = formatToken(e.target.value);
    setFormData((prev) => ({ ...prev, token: formatted }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.academic_year_id || !formData.semester_id || !formData.class_name || !formData.token) {
      setError('Semua field harus diisi');
      return;
    }

    if (!formData.captcha_answer) {
      setError('Jawaban captcha harus diisi');
      return;
    }

    try {
      setLoading(true);

      // Get semester code from semester_id
      const selectedSemester = semesters.find(s => s.id === formData.semester_id);
      if (!selectedSemester) {
        setError('Semester tidak valid');
        setLoading(false);
        return;
      }

      const res = await api.post('/kelas/auth/login', {
        academic_year_id: formData.academic_year_id,
        semester: selectedSemester.code,
        class_name: formData.class_name,
        token: formData.token,
        captcha_id: formData.captcha_id,
        captcha_answer: formData.captcha_answer,
      });

      // Use AuthContext login function to update both localStorage AND React state
      await login(res.data.access_token, res.data.user, res.data.active_role);

      toast.success('Login berhasil! Selamat datang di Kelas Digital');
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.detail || 'Login gagal. Silakan coba lagi.');
      loadCaptcha(); // Reload captcha on error
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="min-h-screen bg-hero-wash flex items-center justify-center p-4 relative overflow-hidden">
        <MadrasahBackdrop />
        <div className="absolute inset-0 bg-pattern-geometric opacity-30 pointer-events-none" />
        <div className="relative flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#006837]" />
          <p className="text-sm text-slate-600">Memuat data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hero-wash flex items-center justify-center p-4 relative overflow-hidden">
      <MadrasahBackdrop />
      <div className="absolute inset-0 bg-pattern-geometric opacity-30 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-2xl"
      >
        <Card className="shadow-xl border-slate-200 surface-ivory">
          <CardContent className="p-8">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-lg">
                  <BookOpen className="h-8 w-8 text-white" />
                </div>
              </div>
              <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-3">Kelas Digital</Badge>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">Akses Kelas Digital</h2>
              <p className="text-sm text-slate-600">Masuk menggunakan token kelas untuk mengakses materi dan tugas pembelajaran</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="border-red-300 bg-red-50">
                  <AlertDescription className="text-red-800">{error}</AlertDescription>
                </Alert>
              )}

              {/* Grid 2 kolom untuk Tahun Pelajaran dan Semester */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="academic_year" className="text-sm font-medium">
                    Tahun Pelajaran <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.academic_year_id}
                    onValueChange={(value) => handleChange('academic_year_id', value)}
                  >
                    <SelectTrigger id="academic_year" className="h-11">
                      <SelectValue placeholder="Pilih Tahun Pelajaran" />
                    </SelectTrigger>
                    <SelectContent>
                      {academicYears.map((ay) => (
                        <SelectItem key={ay.id} value={ay.id}>
                          <div className="flex items-center gap-2">
                            <span>{ay.name}</span>
                            {ay.is_active && (
                              <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full font-medium">
                                Aktif
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="semester" className="text-sm font-medium">
                    Semester <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.semester_id}
                    onValueChange={(value) => handleChange('semester_id', value)}
                    disabled={!formData.academic_year_id}
                  >
                    <SelectTrigger id="semester" className="h-11">
                      <SelectValue placeholder="Pilih Semester" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredSemesters.map((sem) => (
                        <SelectItem key={sem.id} value={sem.id}>
                          <div className="flex items-center gap-2">
                            <span>{sem.name}</span>
                            {sem.is_active && (
                              <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full font-medium">
                                Aktif
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!formData.academic_year_id && (
                    <p className="text-xs text-slate-500 italic">Pilih tahun pelajaran terlebih dahulu</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="class_name" className="text-sm font-medium">
                  Nama Kelas <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.class_name}
                  onValueChange={(value) => handleChange('class_name', value)}
                  disabled={!formData.semester_id}
                >
                  <SelectTrigger id="class_name" className="h-11">
                    <SelectValue placeholder="Pilih Kelas" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredClasses.map((cls) => (
                      <SelectItem key={cls.id} value={cls.name}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!formData.semester_id && (
                  <p className="text-xs text-slate-500 italic">Pilih semester terlebih dahulu</p>
                )}
                {formData.semester_id && filteredClasses.length === 0 && (
                  <p className="text-xs text-amber-600">Tidak ada kelas tersedia untuk semester ini</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="token" className="text-sm font-medium">
                  Token Kelas <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    id="token"
                    type="text"
                    placeholder="Contoh: 7A-2526-5UVZ"
                    value={formData.token}
                    onChange={handleTokenChange}
                    className="pl-11 h-11 font-mono text-base tracking-wide uppercase"
                    maxLength={13}
                    autoComplete="off"
                    spellCheck="false"
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Format otomatis diterapkan saat Anda mengetik. Token dapat diperoleh dari wali kelas.
                </p>
              </div>

              {/* Captcha gambar angka */}
              <div className="bg-[#FBF7EE] rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="kelas-captcha" className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    Verifikasi Keamanan
                  </Label>
                  <button
                    type="button"
                    onClick={loadCaptcha}
                    className="flex items-center gap-1 text-xs text-[#006837] hover:text-[#0B7A3B]"
                    aria-label="Ganti gambar captcha"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Ganti gambar
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="h-[60px] w-full sm:w-[172px] shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white flex items-center justify-center">
                    {captcha?.image ? (
                      <img src={captcha.image} alt="Kode captcha berupa angka" width={172} height={60}
                        className="h-full w-full object-contain select-none pointer-events-none" draggable={false} />
                    ) : (
                      <span className="text-sm text-slate-400">Memuat...</span>
                    )}
                  </div>
                  <Input
                    id="kelas-captcha"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={captcha?.length || 5}
                    value={formData.captcha_answer}
                    onChange={(e) => handleChange('captcha_answer', e.target.value.replace(/\D/g, ''))}
                    placeholder="Ketik angka"
                    className="h-11 flex-1 font-mono tracking-[0.3em] text-center"
                  />
                </div>
                <p className="mt-2 text-[11px] text-slate-500">Ketik angka yang terlihat pada gambar.</p>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-[#006837] hover:bg-[#0B7A3B] text-white font-semibold"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <BookOpen className="mr-2 h-4 w-4" />
                    Masuk ke Kelas Digital
                  </>
                )}
              </Button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-xs text-[#006837] hover:underline font-medium"
                >
                  ← Kembali ke Login Utama
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      {/* Version info at bottom */}
      <div className="absolute bottom-4 left-0 right-0 text-center">
        <p className="text-xs text-slate-500">
          Super Apps MATSANDATAMA v1.2.3 &copy; {new Date().getFullYear()} - Kementerian Agama RI
        </p>
      </div>
    </div>
  );
};

export default KelasLoginPage;
