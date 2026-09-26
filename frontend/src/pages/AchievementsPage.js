import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Trophy, Plus, Pencil, Trash2, CheckCircle2, Clock, Search, Upload,
  Medal, Image as ImageIcon, Award, Calendar, MapPin, Building, X,
  GraduationCap, Users as UsersIcon, Briefcase, School, Target, Star, Filter,
  XCircle, FileText, ExternalLink, UserCog,
} from 'lucide-react';
import { api, openAuthedFile } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ui/confirm-dialog';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const CATEGORIES = [
  { value: 'akademik', label: 'Akademik', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'non_akademik', label: 'Non-Akademik', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { value: 'olahraga', label: 'Olahraga', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'seni', label: 'Seni & Budaya', color: 'bg-rose-100 text-rose-800 border-rose-200' },
  { value: 'keagamaan', label: 'Keagamaan', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'lainnya', label: 'Lainnya', color: 'bg-slate-100 text-slate-800 border-slate-200' },
];

const LEVELS = [
  { value: 'sekolah', label: 'Sekolah/Madrasah' },
  { value: 'kecamatan', label: 'Kecamatan' },
  { value: 'kab_kota', label: 'Kab/Kota' },
  { value: 'provinsi', label: 'Provinsi' },
  { value: 'nasional', label: 'Nasional' },
  { value: 'internasional', label: 'Internasional' },
];

const LEVEL_ICONS = {
  'kab_kota': { icon: Award, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  'provinsi': { icon: Medal, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  'nasional': { icon: Trophy, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
  'internasional': { icon: Star, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
};

const RANKS = [
  'Juara 1', 'Juara 2', 'Juara 3',
  'Juara Harapan 1', 'Juara Harapan 2', 'Juara Harapan 3',
  'Finalis', 'Peserta Terbaik', 'Medali Emas', 'Medali Perak', 'Medali Perunggu',
];

const HOLDER_TABS = [
  { value: 'siswa', label: 'Prestasi Siswa', icon: GraduationCap, color: 'text-emerald-700' },
  { value: 'guru', label: 'Prestasi Guru', icon: UsersIcon, color: 'text-blue-700' },
  { value: 'tendik', label: 'Prestasi Tendik', icon: Briefcase, color: 'text-purple-700' },
  { value: 'madrasah', label: 'Prestasi Madrasah', icon: School, color: 'text-amber-700' },
];

const JENIS_LOMBA = [
  { value: 'individu', label: 'Individu' },
  { value: 'tim', label: 'Tim/Kelompok' },
];

const JENIS_PENYELENGGARA = [
  { value: 'kementerian_lembaga', label: 'Kementerian/Lembaga' },
  { value: 'perguruan_tinggi', label: 'Perguruan Tinggi' },
  { value: 'lembaga_pendidikan', label: 'Lembaga Pendidikan' },
  { value: 'swasta', label: 'Swasta' },
];

const MODE_PELAKSANAAN = [
  { value: 'offline', label: 'Offline' },
  { value: 'online', label: 'Online' },
];

const CARA_MENGIKUTI = [
  { value: 'mandiri', label: 'Mandiri' },
  { value: 'delegasi_madrasah', label: 'Delegasi Madrasah' },
  { value: 'club', label: 'Melalui Club' },
];

const JENIS_HADIAH = [
  { value: 'tropi', label: 'Tropi' },
  { value: 'medali', label: 'Medali' },
  { value: 'sertifikat', label: 'Sertifikat' },
  { value: 'uang_pembinaan', label: 'Uang Pembinaan' },
  { value: 'lainnya', label: 'Lainnya' },
];

function jenisLombaLabel(v) { return JENIS_LOMBA.find((x) => x.value === v)?.label || v || '-'; }
function jenisPenyelenggaraLabel(v) { return JENIS_PENYELENGGARA.find((x) => x.value === v)?.label || v || '-'; }
function modePelaksanaanLabel(v) { return MODE_PELAKSANAAN.find((x) => x.value === v)?.label || v || '-'; }
function caraMengikutiLabel(v) { return CARA_MENGIKUTI.find((x) => x.value === v)?.label || v || '-'; }
function jenisHadiahLabel(v) { return JENIS_HADIAH.find((x) => x.value === v)?.label || v; }

function fileUrl(u) {
  if (!u) return '';
  if (u.startsWith('http') || u.startsWith('data:')) return u;
  return `${BACKEND_URL}${u}`;
}

const EMPTY = {
  holder_type: 'siswa',
  holder_id: '',
  holder_name: '',
  name: '',
  bidang_lomba: '',
  category: 'akademik',
  level: 'kab_kota',
  rank: 'Juara 1',
  organizer: '',
  date: '',
  year: '',
  academic_year_label: '',
  jenis_lomba: 'individu',
  jenis_penyelenggara: '',
  mode_pelaksanaan: 'offline',
  tempat_pelaksanaan: '',
  cara_mengikuti: 'mandiri',
  jenis_hadiah: [],
  nama_pembina: '',
  description: '',
  certificate_url: '',
  photo_url: '',
};

function catColor(cat) {
  return CATEGORIES.find((c) => c.value === cat)?.color || 'bg-slate-100 text-slate-800 border-slate-200';
}
function catLabel(cat) {
  return CATEGORIES.find((c) => c.value === cat)?.label || cat || '-';
}
function levelLabel(l) {
  return LEVELS.find((x) => x.value === l)?.label || l || '-';
}

function holderTypeOf(a) {
  if (a.holder_type) return a.holder_type;
  // Legacy backward compat
  if (a.student_id) return 'siswa';
  return 'madrasah';
}

export default function AchievementsPage() {
  const { activeRole, user } = useAuth();
  const [academicYears, setAcademicYears] = useState([]);
  const activeAcademicYear = useMemo(() => academicYears.find((ay) => ay.is_active), [academicYears]);
  const isAdmin = activeRole === 'admin';
  const isWaliKelas = activeRole === 'wali_kelas';
  const isSiswa = activeRole === 'siswa';
  const isGuru = ['guru', 'wali_kelas', 'guru_piket', 'guru_bk', 'guru_tata_tertib', 'guru_ekstrakurikuler'].includes(activeRole);
  const isTendik = activeRole === 'tenaga_kependidikan';
  const canVerify = isAdmin || isWaliKelas;
  const submitsViaVerval = !isAdmin;
  // Guru BK's "Data Prestasi" menu item is meant to browse student achievements
  // (like admin's reporting view), not just their own guru submissions.
  const isGuruBk = activeRole === 'guru_bk';

  // Default tab based on role
  const defaultHolder = isSiswa ? 'siswa' : isGuruBk ? 'siswa' : isGuru ? 'guru' : isTendik ? 'tendik' : 'siswa';

  const [holderTab, setHolderTab] = useState(defaultHolder);
  // Default to "Semua" so admin/wali kelas don't land on an empty "Menunggu"
  // tab when there are no pending submissions but plenty of verified ones.
  const [statusTab, setStatusTab] = useState('all');
  const [items, setItems] = useState([]);
  const [students, setStudents] = useState([]);
  const [staff, setStaff] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [filterYear, setFilterYear] = useState('all');
  const [filterLevel, setFilterLevel] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const refresh = async () => {
    try {
      const { data } = await api.get('/achievements');
      let combined = data || [];

      // Gabungkan juga pengajuan prestasi yang masih pending/rejected di verval-requests,
      // karena baru masuk ke /achievements setelah disetujui. Tanpa ini, pengajuan
      // "hilang" dari halaman ini sampai di-approve.
      // - admin & wali_kelas: reviewer_view=true -> semua pengajuan (wali_kelas dibatasi
      //   ke siswa binaannya oleh backend).
      // - guru_bk: reviewer_view=true -> semua pengajuan prestasi siswa (bukan hanya
      //   miliknya sendiri), agar bisa memantau status "Menunggu" di tab Data Prestasi.
      // - role lain: hanya pengajuan milik sendiri.
      try {
        const isReviewer = isAdmin || isWaliKelas || isGuruBk;
        const { data: vReqs } = await api.get('/verval-requests', {
          params: {
            request_type: 'prestasi_create',
            ...(isReviewer ? { reviewer_view: true } : {}),
          },
        });
        const pendingOrRejected = (vReqs || [])
          .filter((r) => r.status === 'pending' || r.status === 'rejected')
          .map((r) => ({
            ...(r.new_data || {}),
            id: `verval-${r.id}`,
            is_verified: false,
            submitted_by: r.submitted_by,
            _isPendingRequest: true,
            _vervalRequestId: r.id,
            _vervalStatus: r.status,
            _adminNotes: r.admin_notes,
          }));
        combined = [...pendingOrRejected, ...combined];
      } catch (e) {
        // Non-fatal: tetap tampilkan achievements yang sudah approved.
      }

      setItems(combined);
    } catch (e) {
      toast.error('Gagal memuat data prestasi');
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await refresh();
        try {
          const { data } = await api.get('/academic-years');
          setAcademicYears(data || []);
        } catch (e) { /* non-fatal */ }
        if (canVerify || isAdmin) {
          if (isWaliKelas) {
            // Wali kelas uses /students endpoint with their homeroom_class_id
            const myClassId = user?.homeroom_class_id;
            console.log('Wali Kelas - homeroom_class_id:', myClassId);
            if (myClassId) {
              const studentsResp = await api.get('/students', {
                params: { class_id: myClassId }
              });
              const classStudents = studentsResp.data || [];
              console.log('Students from /students endpoint:', classStudents);
              setStudents(classStudents);
            } else {
              console.warn('Wali kelas has no homeroom_class_id assigned');
              setStudents([]); // No class assigned
            }
          } else {
            // Admin uses /users endpoint for all students and staff
            const usersResp = await api.get('/users');
            const all = usersResp.data || [];
            setStudents(all.filter((u) => (u.roles || []).includes('siswa')));
            setStaff(all.filter((u) => (u.roles || []).some((r) => r !== 'siswa')));
          }
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRole, user?.homeroom_class_id]);

  // Default holder tab can be siswa for admin, but allow switching
  const openCreate = () => {
    setEditing(null);
    let initialHolder = holderTab;
    let initialId = '';
    if (isSiswa) { initialHolder = 'siswa'; initialId = user?.id || ''; }
    else if (isWaliKelas) { initialHolder = 'siswa'; initialId = ''; } // Wali kelas always creates for siswa
    else if (isGuru && !isWaliKelas) { initialHolder = 'guru'; initialId = user?.id || ''; }
    else if (isTendik) { initialHolder = 'tendik'; initialId = user?.id || ''; }
    setForm({ ...EMPTY, holder_type: initialHolder, holder_id: initialId, academic_year_label: activeAcademicYear?.name || '' });
    setOpen(true);
  };

  const openEdit = (a) => {
    if (a._isPendingRequest) return; // Pengajuan pending/ditolak belum bisa diedit, hanya dibatalkan.
    setEditing(a);
    const ht = holderTypeOf(a);
    setForm({
      ...EMPTY,
      ...a,
      holder_type: ht,
      holder_id: a.holder_id || a.student_id || '',
      holder_name: a.holder_name || '',
      year: a.year || (a.date ? parseInt(String(a.date).split('-')[0]) : ''),
      date: a.date || '',
      jenis_hadiah: a.jenis_hadiah || [],
    });
    setOpen(true);
  };

  const REQUIRED_FIELDS = [
    { key: 'name', label: 'Nama Lomba' },
    { key: 'bidang_lomba', label: 'Bidang Lomba' },
    { key: 'category', label: 'Kategori Lomba' },
    { key: 'level', label: 'Tingkat Lomba' },
    { key: 'rank', label: 'Peringkat' },
    { key: 'date', label: 'Tanggal Lomba' },
    { key: 'academic_year_label', label: 'Tahun Pelajaran' },
    { key: 'jenis_lomba', label: 'Jenis Lomba' },
    { key: 'jenis_penyelenggara', label: 'Jenis Penyelenggara' },
    { key: 'organizer', label: 'Nama Penyelenggara' },
    { key: 'mode_pelaksanaan', label: 'Mode Pelaksanaan' },
    { key: 'tempat_pelaksanaan', label: 'Tempat Pelaksanaan' },
    { key: 'cara_mengikuti', label: 'Diikuti Secara' },
    { key: 'nama_pembina', label: 'Nama Pembina' },
    { key: 'certificate_url', label: 'Upload Sertifikat' },
    { key: 'photo_url', label: 'Upload Foto Memegang Sertifikat/Piala' },
  ];

  const handleSubmit = async () => {
    for (const f of REQUIRED_FIELDS) {
      if (!form[f.key]) { toast.error(`${f.label} wajib diisi`); return; }
    }
    if (!(form.jenis_hadiah || []).length) { toast.error('Pilih minimal satu Penerimaan Hadiah'); return; }
    if (!form.year) { toast.error('Tahun wajib diisi'); return; }
    if (form.holder_type !== 'madrasah' && !form.holder_id) {
      toast.error('Pilih ' + (form.holder_type === 'siswa' ? 'siswa' : 'pemegang prestasi'));
      return;
    }
    if (form.holder_type === 'madrasah' && !form.holder_name) {
      // Default to school name
      form.holder_name = 'Madrasah';
    }
    try {
      const payload = {
        ...form,
        year: form.year ? parseInt(form.year) : (form.date ? parseInt(String(form.date).split('-')[0]) : null),
      };
      if (editing) {
        await api.put(`/achievements/${editing.id}`, payload);
        toast.success('Prestasi diperbarui');
      } else if (isAdmin) {
        await api.post('/achievements', payload);
        toast.success('Prestasi disimpan');
      } else {
        // Non-admin (siswa, guru, tendik, wali_kelas) - submit via verval request
        await api.post('/verval-requests', {
          user_id: user?.id,
          user_type: isSiswa ? 'siswa' : (isTendik ? 'tenaga_kependidikan' : 'guru'),
          request_type: 'prestasi_create',
          target_collection: 'achievements',
          target_id: null,
          old_data: {},
          new_data: payload,
        });
        toast.success('Pengajuan prestasi dikirim untuk review admin');
      }
      setOpen(false);
      await refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan');
    }
  };

  const handleVerify = async (a) => {
    try {
      await api.put(`/achievements/${a.id}/verify`, {});
      toast.success(`Prestasi "${a.name}" diverifikasi`);
      await refresh();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Gagal verifikasi'); }
  };

  const handleDelete = async (a) => {
    if (a._isPendingRequest) {
      if (!(await confirmDialog(`Batalkan pengajuan prestasi "${a.name}"?`))) return;
      try {
        await api.delete(`/verval-requests/${a._vervalRequestId}`);
        toast.success('Pengajuan prestasi dibatalkan');
        await refresh();
      } catch (e) { toast.error(e?.response?.data?.detail || 'Gagal membatalkan pengajuan'); }
      return;
    }
    if (!(await confirmDialog(`Hapus prestasi "${a.name}"?`))) return;
    try {
      await api.delete(`/achievements/${a.id}`);
      toast.success('Prestasi dihapus');
      await refresh();
    } catch (e) { toast.error('Gagal hapus'); }
  };

  const [uploadingFile, setUploadingFile] = useState(null); // 'certificate' | 'photo' | null

  const handleFile = async (e, jenis) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      toast.error('Maks 2MB.');
      return;
    }
    const fd = new FormData();
    fd.append('file', f);
    setUploadingFile(jenis);
    try {
      const { data } = await api.post(`/achievements/upload/${jenis}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const field = jenis === 'certificate' ? 'certificate_url' : 'photo_url';
      setForm((prev) => ({ ...prev, [field]: data.url }));
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Gagal upload file');
    } finally {
      setUploadingFile(null);
      e.target.value = '';
    }
  };

  const filteredByHolder = useMemo(() => {
    return items.filter((a) => holderTypeOf(a) === holderTab);
  }, [items, holderTab]);

  const filtered = useMemo(() => {
    return filteredByHolder.filter((a) => {
      if (statusTab === 'pending' && a.is_verified) return false;
      if (statusTab === 'verified' && !a.is_verified) return false;
      if (filterYear !== 'all' && a.year !== parseInt(filterYear)) return false;
      if (filterLevel !== 'all' && a.level !== filterLevel) return false;
      if (search) {
        const s = search.toLowerCase();
        return (a.name || '').toLowerCase().includes(s) ||
               (a.holder_full_name || '').toLowerCase().includes(s) ||
               (a.holder_name || '').toLowerCase().includes(s) ||
               (a.organizer || '').toLowerCase().includes(s) ||
               (a.bidang_lomba || '').toLowerCase().includes(s);
      }
      return true;
    });
  }, [filteredByHolder, statusTab, search, filterYear, filterLevel]);

  const stats = useMemo(() => {
    const all = filteredByHolder;
    const byLevel = {};
    const byYear = {};

    all.forEach((a) => {
      // Count by level
      if (a.level) {
        byLevel[a.level] = (byLevel[a.level] || 0) + 1;
      }
      // Count by year
      if (a.year) {
        byYear[a.year] = (byYear[a.year] || 0) + 1;
      }
    });

    return {
      total: all.length,
      pending: all.filter((a) => !a.is_verified).length,
      verified: all.filter((a) => a.is_verified).length,
      by_level: byLevel,
      by_year: byYear,
    };
  }, [filteredByHolder]);

  const availableYears = Object.keys(stats.by_year || {}).sort((a, b) => b - a);

  const clearFilters = () => {
    setFilterYear('all');
    setFilterLevel('all');
  };

  const hasActiveFilters = filterYear !== 'all' || filterLevel !== 'all';

  if (loading) return <div className="text-sm text-slate-500">Memuat...</div>;

  // Decide which holder tabs to show: siswa always; others if admin or pure tendik/guru
  const visibleHolderTabs = HOLDER_TABS.filter((t) => {
    if (isAdmin) return true; // Admin sees all tabs
    if (isWaliKelas) return t.value === 'siswa'; // Wali kelas only sees siswa tab
    if (isSiswa) return t.value === 'siswa';
    if (isGuruBk) return t.value === 'siswa' || t.value === 'guru'; // Guru BK browses siswa prestasi too
    if (isGuru && !isWaliKelas) return t.value === 'guru'; // Pure guru (not wali kelas)
    if (isTendik) return t.value === 'tendik';
    return false;
  });

  const canAddInTab = () => {
    if (holderTab === 'siswa') return isSiswa || isAdmin || isWaliKelas;
    if (holderTab === 'guru') return isGuru || isAdmin;
    if (holderTab === 'tendik') return isTendik || isAdmin;
    if (holderTab === 'madrasah') return isAdmin;
    return false;
  };

  return (
    <div className="space-y-6" data-testid="achievements-page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <Trophy className="h-3 w-3 mr-1" /> Data Prestasi
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Data Prestasi</h1>
          <p className="text-sm text-slate-600 mt-1">
            Catatan prestasi siswa, guru, tenaga kependidikan, dan madrasah
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {submitsViaVerval && (
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/verval/ajuan-saya">
                <FileText className="h-4 w-4" /> Lihat Ajuan Saya <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          )}
          {canAddInTab() && (
            <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="add-achievement-button">
              <Plus className="h-4 w-4" /> Tambah Prestasi
            </Button>
          )}
        </div>
      </div>

      {submitsViaVerval && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-3 flex items-start gap-2 text-sm text-blue-900">
            <FileText className="h-4 w-4 mt-0.5 shrink-0" />
            <p>Prestasi yang Anda tambahkan akan direview terlebih dahulu oleh Admin/Wali Kelas sebelum berstatus &quot;Terverifikasi&quot;. Pengajuan yang masih menunggu atau ditolak tetap tampil di daftar di bawah ini.</p>
          </CardContent>
        </Card>
      )}

      {/* Holder Type Tabs */}
      <Tabs value={holderTab} onValueChange={setHolderTab}>
        <div className="overflow-x-auto">
          <TabsList className="bg-white border border-slate-200 inline-flex min-w-full sm:min-w-0" data-testid="holder-tabs">
            {visibleHolderTabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="gap-2 whitespace-nowrap" data-testid={`holder-tab-${t.value}`}>
                <t.icon className={`h-3.5 w-3.5 ${t.color}`} />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value={holderTab} className="mt-4 space-y-4">
          {/* Stats Overview */}
          <div className="space-y-3">
            {/* Stats by Level */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {/* Total Prestasi */}
              <div className="rounded-xl border p-3 bg-blue-50 border-blue-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wide">Total</span>
                  <Target className="h-4 w-4 text-blue-600" />
                </div>
                <div className="text-2xl font-extrabold tabular-nums">{stats.total}</div>
              </div>

              {/* Stats by Level */}
              {Object.entries(LEVEL_ICONS).map(([level, config]) => {
                const Icon = config.icon;
                const count = stats.by_level[level] || 0;
                const label = levelLabel(level);
                return (
                  <div key={level} className={`rounded-xl border p-3 ${config.bg} ${config.border}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-ellipsis overflow-hidden whitespace-nowrap">{label}</span>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    <div className="text-2xl font-extrabold tabular-nums">{count}</div>
                  </div>
                );
              })}
            </div>

            {/* Stats summary for current tab */}
            <div className="grid grid-cols-3 gap-3">
              <SmallStat icon={Trophy} label="Total" value={stats.total} color="bg-slate-50 border-slate-200 text-slate-700" />
              <SmallStat icon={Clock} label="Menunggu" value={stats.pending} color="bg-amber-50 border-amber-200 text-amber-700" />
              <SmallStat icon={CheckCircle2} label="Terverifikasi" value={stats.verified} color="bg-emerald-50 border-emerald-200 text-emerald-700" />
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={hasActiveFilters ? 'border-[#006837] text-[#006837]' : ''}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filter {hasActiveFilters && `(${[filterYear !== 'all', filterLevel !== 'all'].filter(Boolean).length})`}
            </Button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-900">Filter Prestasi</h3>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="h-4 w-4 mr-1" />
                      Hapus Filter
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Tahun</Label>
                    <Select value={filterYear} onValueChange={setFilterYear}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Semua Tahun" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Tahun</SelectItem>
                        {availableYears.map(y => (
                          <SelectItem key={y} value={y}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Tingkat</Label>
                    <Select value={filterLevel} onValueChange={setFilterLevel}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Semua Tingkat" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Tingkat</SelectItem>
                        {LEVELS.map(lvl => (
                          <SelectItem key={lvl.value} value={lvl.value}>{lvl.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status sub-tabs */}
          <Tabs value={statusTab} onValueChange={setStatusTab}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <TabsList className="bg-white border border-slate-200">
                <TabsTrigger value="all" data-testid="status-tab-all">Semua</TabsTrigger>
                <TabsTrigger value="pending" data-testid="status-tab-pending">Menunggu {stats.pending > 0 && <Badge className="ml-1.5 px-1.5 py-0 text-xs bg-amber-100 text-amber-800 border-amber-200">{stats.pending}</Badge>}</TabsTrigger>
                <TabsTrigger value="verified" data-testid="status-tab-verified">Terverifikasi {stats.verified > 0 && <Badge className="ml-1.5 px-1.5 py-0 text-xs bg-emerald-100 text-emerald-800 border-emerald-200">{stats.verified}</Badge>}</TabsTrigger>
                <TabsTrigger value="gallery" data-testid="status-tab-gallery">Galeri</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <Search className="h-4 w-4 text-slate-400 shrink-0" />
                <Input
                  placeholder="Cari nama lomba, peraih, atau penyelenggara..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="achievement-search"
                />
              </div>
            </div>

            <TabsContent value={statusTab} className="mt-4">
              <Card>
                <CardContent className="p-0">
                  {statusTab === 'gallery' ? (
                    <div className="p-4">
                      {filtered.filter((a) => a.is_verified).length === 0 ? (
                        <EmptyState icon={Award} title="Belum ada prestasi terverifikasi" subtitle="Galeri akan terisi setelah Admin/Wali Kelas memverifikasi prestasi." />
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {filtered.filter((a) => a.is_verified).map((a) => (
                            <GalleryCard key={a.id} a={a} onClick={() => setDetail(a)} />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table data-testid="achievement-table">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12 text-center">No</TableHead>
                            <TableHead className="w-20">Tahun</TableHead>
                            <TableHead>Nama Lomba</TableHead>
                            <TableHead>Bidang Lomba</TableHead>
                            {holderTab !== 'madrasah' && <TableHead>Pemegang</TableHead>}
                            <TableHead>Penyelenggara</TableHead>
                            <TableHead>Tingkat Lomba</TableHead>
                            <TableHead>Peringkat</TableHead>
                            <TableHead>Kategori Lomba</TableHead>
                            <TableHead className="w-24 text-center">Sertifikat</TableHead>
                            <TableHead className="w-24 text-center">Status</TableHead>
                            <TableHead className="text-right">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filtered.map((a, idx) => (
                            <TableRow key={a.id} data-testid={`achievement-row-${a.id}`} className="cursor-pointer hover:bg-slate-50" onClick={() => setDetail(a)}>
                              <TableCell className="text-center text-slate-500 font-mono">{idx + 1}</TableCell>
                              <TableCell className="font-mono font-semibold">{a.year || (a.date ? String(a.date).split('-')[0] : '-')}</TableCell>
                              <TableCell className="font-medium">
                                <div className="line-clamp-2 max-w-[260px]">{a.name}</div>
                              </TableCell>
                              <TableCell className="text-sm">{a.bidang_lomba || <span className="italic text-slate-400">-</span>}</TableCell>
                              {holderTab !== 'madrasah' && (
                                <TableCell>
                                  <div className="font-medium text-sm">{a.holder_full_name || a.holder_name || '-'}</div>
                                  {holderTab === 'siswa' && a.class_name && <div className="text-xs text-slate-500">{a.class_name}</div>}
                                  {holderTab !== 'siswa' && a.holder_nip_nuptk && <div className="text-xs text-slate-500 font-mono">{a.holder_nip_nuptk}</div>}
                                </TableCell>
                              )}
                              <TableCell className="text-sm max-w-[200px]">
                                <div className="line-clamp-2">{a.organizer || <span className="italic text-slate-400">-</span>}</div>
                              </TableCell>
                              <TableCell className="text-sm">{levelLabel(a.level)}</TableCell>
                              <TableCell className="text-sm font-semibold">{a.rank || '-'}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={catColor(a.category) + ' text-xs'}>{catLabel(a.category)}</Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                {a.certificate_url ? (
                                  <ImageIcon className="h-4 w-4 text-emerald-600 mx-auto" />
                                ) : (
                                  <span className="text-slate-300 text-xs">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {a._isPendingRequest && a._vervalStatus === 'rejected' ? (
                                  <Badge className="bg-rose-100 text-rose-800 border-rose-200 gap-1 text-xs">
                                    <XCircle className="h-3 w-3" /> Ditolak
                                  </Badge>
                                ) : a.is_verified ? (
                                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1 text-xs">
                                    <CheckCircle2 className="h-3 w-3" /> Verified
                                  </Badge>
                                ) : (
                                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 gap-1 text-xs">
                                    <Clock className="h-3 w-3" /> Menunggu
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex justify-end gap-1">
                                  {canVerify && !a.is_verified && !a._isPendingRequest && (
                                    <Button size="icon" variant="ghost" onClick={() => handleVerify(a)} className="text-emerald-600 hover:text-emerald-700" title="Verifikasi" data-testid={`verify-achievement-${a.id}`}>
                                      <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {!a._isPendingRequest && (isAdmin || ((a.submitted_by === user?.id || (a.holder_id || a.student_id) === user?.id) && !a.is_verified)) && (
                                    <Button size="icon" variant="ghost" onClick={() => openEdit(a)} title="Edit" data-testid={`edit-achievement-${a.id}`}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {(a._isPendingRequest ? (a._vervalStatus === 'pending' && (isAdmin || a.submitted_by === user?.id)) : (isAdmin || ((a.submitted_by === user?.id || (a.holder_id || a.student_id) === user?.id) && !a.is_verified))) && (
                                    <Button size="icon" variant="ghost" onClick={() => handleDelete(a)} className="text-rose-600 hover:text-rose-700" title={a._isPendingRequest ? 'Batalkan Pengajuan' : 'Hapus'} data-testid={`delete-achievement-${a.id}`}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {filtered.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={holderTab === 'madrasah' ? 11 : 12} className="text-center py-12">
                                <EmptyState
                                  icon={Trophy}
                                  title="Belum ada data prestasi"
                                  subtitle={canAddInTab() ? "Klik 'Tambah Prestasi' untuk menambah data" : 'Belum ada prestasi pada filter ini'}
                                />
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      {/* Form Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Prestasi' : 'Tambah Prestasi'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
            {/* Holder Type selector - locked for siswa/guru/tendik unless admin - hidden for wali_kelas */}
            {!isWaliKelas && (
              <div className="sm:col-span-2">
                <Label>Kategori Pemegang Prestasi *</Label>
                <Select
                  value={form.holder_type}
                  onValueChange={(v) => setForm({ ...form, holder_type: v, holder_id: (isAdmin || (v === 'siswa' && isWaliKelas)) ? '' : user?.id })}
                  disabled={!isAdmin && editing}
                >
                  <SelectTrigger data-testid="ach-form-holder-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HOLDER_TABS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Holder ID/Name selector based on type */}
            {form.holder_type === 'siswa' && (isAdmin || isWaliKelas) && (
              <div className="sm:col-span-2">
                <Label>Siswa * {isWaliKelas && students.length > 0 && `(${students.length} siswa di kelas Anda)`}</Label>
                <Select value={form.holder_id || ''} onValueChange={(v) => setForm({ ...form, holder_id: v })}>
                  <SelectTrigger data-testid="ach-form-student">
                    <SelectValue placeholder={students.length === 0
                      ? (isWaliKelas ? 'Tidak ada siswa di kelas Anda' : 'Tidak ada data siswa')
                      : 'Pilih siswa...'
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {students.length === 0 ? (
                      <div className="px-2 py-6 text-center text-sm text-slate-500">
                        {isWaliKelas ? 'Tidak ada siswa di kelas Anda' : 'Tidak ada data siswa'}
                      </div>
                    ) : (
                      students
                        .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
                        .map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.full_name} {s.nisn ? `(NISN: ${s.nisn})` : ''} {s.class_name ? `- ${s.class_name}` : ''}
                          </SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(form.holder_type === 'guru' || form.holder_type === 'tendik') && isAdmin && (
              <div className="sm:col-span-2">
                <Label>{form.holder_type === 'guru' ? 'Guru' : 'Tenaga Kependidikan'} *</Label>
                <Select value={form.holder_id || ''} onValueChange={(v) => setForm({ ...form, holder_id: v })}>
                  <SelectTrigger data-testid="ach-form-staff"><SelectValue placeholder="Pilih pemegang..." /></SelectTrigger>
                  <SelectContent>
                    {staff
                      .filter((u) => form.holder_type === 'guru'
                        ? (u.roles || []).some((r) => ['guru','wali_kelas','guru_piket','guru_bk','guru_tata_tertib','guru_ekstrakurikuler'].includes(r))
                        : (u.roles || []).includes('tenaga_kependidikan'))
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.full_name} {s.nip_nuptk ? `(${s.nip_nuptk})` : ''}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.holder_type === 'madrasah' && (
              <div className="sm:col-span-2">
                <Label>Nama Pemegang (Opsional)</Label>
                <Input
                  value={form.holder_name || ''}
                  onChange={(e) => setForm({ ...form, holder_name: e.target.value })}
                  placeholder="Mis. Tim Robotik, Madrasah, atau biarkan kosong"
                  data-testid="ach-form-holder-name"
                />
              </div>
            )}

            <div className="sm:col-span-2">
              <Label>Nama Lomba *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Mis. Olimpiade Matematika Madrasah 2025"
                data-testid="ach-form-name" />
            </div>
            <div className="sm:col-span-2">
              <Label>Bidang Lomba *</Label>
              <Input value={form.bidang_lomba || ''} onChange={(e) => setForm({ ...form, bidang_lomba: e.target.value })}
                placeholder="Mis. Matematika, Fisika, Lari 100m, Pidato Bahasa Arab..."
                data-testid="ach-form-bidang" />
            </div>
            <div>
              <Label>Kategori Lomba *</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger data-testid="ach-form-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tingkat Lomba *</Label>
              <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                <SelectTrigger data-testid="ach-form-level"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Peringkat *</Label>
              <Select value={form.rank} onValueChange={(v) => setForm({ ...form, rank: v })}>
                <SelectTrigger data-testid="ach-form-rank"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RANKS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tanggal Lomba *</Label>
              <Input type="date" value={form.date || ''}
                onChange={(e) => {
                  const d = e.target.value;
                  setForm({ ...form, date: d, year: d ? String(d).split('-')[0] : form.year });
                }}
                data-testid="ach-form-date" />
            </div>
            <div>
              <Label>Tahun *</Label>
              <Input type="number" min="2000" max="2099" value={form.year || ''}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
                placeholder="2025"
                data-testid="ach-form-year" />
            </div>
            <div>
              <Label>Tahun Pelajaran *</Label>
              <Select value={form.academic_year_label || ''} onValueChange={(v) => setForm({ ...form, academic_year_label: v })}>
                <SelectTrigger data-testid="ach-form-academic-year"><SelectValue placeholder="Pilih tahun pelajaran..." /></SelectTrigger>
                <SelectContent>
                  {academicYears.length === 0 ? (
                    <div className="px-2 py-6 text-center text-sm text-slate-500">Belum ada data tahun pelajaran</div>
                  ) : (
                    academicYears.map((ay) => (
                      <SelectItem key={ay.id} value={ay.name}>
                        {ay.name}{ay.is_active ? ' (Aktif)' : ''}
                      </SelectItem>
                    ))
                  )}
                  {form.academic_year_label && !academicYears.some((ay) => ay.name === form.academic_year_label) && (
                    <SelectItem value={form.academic_year_label}>{form.academic_year_label}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Jenis Lomba *</Label>
              <Select value={form.jenis_lomba} onValueChange={(v) => setForm({ ...form, jenis_lomba: v })}>
                <SelectTrigger data-testid="ach-form-jenis-lomba"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {JENIS_LOMBA.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Jenis Penyelenggara *</Label>
              <Select value={form.jenis_penyelenggara || ''} onValueChange={(v) => setForm({ ...form, jenis_penyelenggara: v })}>
                <SelectTrigger data-testid="ach-form-jenis-penyelenggara"><SelectValue placeholder="Pilih jenis..." /></SelectTrigger>
                <SelectContent>
                  {JENIS_PENYELENGGARA.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Nama Penyelenggara *</Label>
              <Input value={form.organizer || ''} onChange={(e) => setForm({ ...form, organizer: e.target.value })}
                placeholder="Mis. Kanwil Kemenag Provinsi Jawa Timur"
                data-testid="ach-form-organizer" />
            </div>
            <div>
              <Label>Mode Pelaksanaan *</Label>
              <Select value={form.mode_pelaksanaan} onValueChange={(v) => setForm({ ...form, mode_pelaksanaan: v })}>
                <SelectTrigger data-testid="ach-form-mode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODE_PELAKSANAAN.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tempat Pelaksanaan *</Label>
              <Input value={form.tempat_pelaksanaan || ''} onChange={(e) => setForm({ ...form, tempat_pelaksanaan: e.target.value })}
                placeholder="Mis. Aula Kanwil Kemenag / Zoom Meeting"
                data-testid="ach-form-tempat" />
            </div>
            <div>
              <Label>Diikuti Secara *</Label>
              <Select value={form.cara_mengikuti} onValueChange={(v) => setForm({ ...form, cara_mengikuti: v })}>
                <SelectTrigger data-testid="ach-form-cara-mengikuti"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CARA_MENGIKUTI.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nama Pembina *</Label>
              <Input value={form.nama_pembina || ''} onChange={(e) => setForm({ ...form, nama_pembina: e.target.value })}
                placeholder="Nama guru/pembina pendamping"
                data-testid="ach-form-pembina" />
            </div>
            <div className="sm:col-span-2">
              <Label>Penerimaan Hadiah *</Label>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {JENIS_HADIAH.map((o) => {
                  const checked = (form.jenis_hadiah || []).includes(o.value);
                  return (
                    <label key={o.value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          const cur = form.jenis_hadiah || [];
                          const next = v ? [...cur, o.value] : cur.filter((x) => x !== o.value);
                          setForm({ ...form, jenis_hadiah: next });
                        }}
                        data-testid={`ach-form-hadiah-${o.value}`}
                      />
                      {o.label}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label>Deskripsi</Label>
              <Textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detail tambahan / cerita prestasi..."
                rows={3}
                data-testid="ach-form-description" />
            </div>
            <div>
              <Label>Upload Sertifikat * (maks 2MB)</Label>
              <FileSlot
                url={fileUrl(form.certificate_url)}
                uploading={uploadingFile === 'certificate'}
                onUpload={(e) => handleFile(e, 'certificate')}
                onClear={() => setForm({ ...form, certificate_url: '' })}
                testId="ach-form-certificate"
              />
            </div>
            <div>
              <Label>Upload Foto Memegang Sertifikat/Piala * (maks 2MB)</Label>
              <FileSlot
                url={fileUrl(form.photo_url)}
                uploading={uploadingFile === 'photo'}
                onUpload={(e) => handleFile(e, 'photo')}
                onClear={() => setForm({ ...form, photo_url: '' })}
                testId="ach-form-photo"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} className="bg-[#006837] hover:bg-[#0B7A3B]" data-testid="ach-form-submit">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-600" /> {detail?.name}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              {(detail.certificate_url || detail.photo_url) && (
                <div className="grid grid-cols-2 gap-2">
                  {detail.certificate_url && (
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Sertifikat</div>
                      <AuthedImage path={detail.certificate_url} alt="Sertifikat" className="w-full max-h-72 object-contain rounded-lg border border-slate-200 bg-slate-50" />
                    </div>
                  )}
                  {detail.photo_url && (
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Foto Pemegang Sertifikat/Piala</div>
                      <AuthedImage path={detail.photo_url} alt="Foto" className="w-full max-h-72 object-contain rounded-lg border border-slate-200 bg-slate-50" />
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <DetailItem icon={Calendar} label="Tahun" value={detail.year || (detail.date ? String(detail.date).split('-')[0] : '-')} />
                <DetailItem icon={Calendar} label="Tahun Pelajaran" value={detail.academic_year_label} />
                <DetailItem icon={Award} label="Peringkat" value={detail.rank} />
                <DetailItem icon={MapPin} label="Tingkat Lomba" value={levelLabel(detail.level)} />
                <DetailItem icon={Calendar} label="Tanggal" value={detail.date} />
                <DetailItem icon={UsersIcon} label="Jenis Lomba" value={jenisLombaLabel(detail.jenis_lomba)} />
                <DetailItem icon={Building} label="Penyelenggara" value={detail.organizer} />
                <DetailItem icon={Building} label="Jenis Penyelenggara" value={jenisPenyelenggaraLabel(detail.jenis_penyelenggara)} />
                <DetailItem icon={Trophy} label="Bidang Lomba" value={detail.bidang_lomba} />
                <DetailItem icon={MapPin} label="Mode Pelaksanaan" value={modePelaksanaanLabel(detail.mode_pelaksanaan)} />
                <DetailItem icon={MapPin} label="Tempat Pelaksanaan" value={detail.tempat_pelaksanaan} />
                <DetailItem icon={UsersIcon} label="Diikuti Secara" value={caraMengikutiLabel(detail.cara_mengikuti)} />
                <DetailItem icon={UserCog} label="Nama Pembina" value={detail.nama_pembina} />
                {(detail.jenis_hadiah || []).length > 0 && (
                  <div className="col-span-2 flex flex-wrap gap-1.5">
                    {detail.jenis_hadiah.map((h) => (
                      <Badge key={h} variant="secondary" className="text-xs">{jenisHadiahLabel(h)}</Badge>
                    ))}
                  </div>
                )}
                <div className="col-span-2"><Badge variant="outline" className={catColor(detail.category)}>{catLabel(detail.category)}</Badge></div>
                {(detail.holder_full_name || detail.holder_name) && (
                  <div className="col-span-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-xs text-slate-500 uppercase tracking-wide">
                      {holderTypeOf(detail) === 'siswa' ? 'Siswa' :
                       holderTypeOf(detail) === 'guru' ? 'Guru' :
                       holderTypeOf(detail) === 'tendik' ? 'Tenaga Kependidikan' : 'Madrasah'}
                    </div>
                    <div className="font-semibold">{detail.holder_full_name || detail.holder_name}</div>
                    {detail.class_name && <div className="text-xs text-slate-600">Kelas {detail.class_name}</div>}
                    {detail.holder_nip_nuptk && <div className="text-xs text-slate-600 font-mono">{detail.holder_nip_nuptk}</div>}
                  </div>
                )}
                {detail.description && (
                  <div className="col-span-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Deskripsi</div>
                    <div className="text-sm whitespace-pre-line">{detail.description}</div>
                  </div>
                )}
              </div>
              {detail._isPendingRequest && detail._vervalStatus === 'rejected' && detail._adminNotes && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
                  <div className="text-xs text-rose-700 uppercase tracking-wide mb-1">Catatan Penolakan</div>
                  <div className="text-sm text-rose-900">{detail._adminNotes}</div>
                </div>
              )}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                {detail._isPendingRequest && detail._vervalStatus === 'rejected' ? (
                  <Badge className="bg-rose-100 text-rose-800 border-rose-200 gap-1">
                    <XCircle className="h-3 w-3" /> Pengajuan Ditolak
                  </Badge>
                ) : detail.is_verified ? (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Sudah Diverifikasi
                    {detail.verifier_name && <span className="ml-1 font-normal">oleh {detail.verifier_name}</span>}
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200">Menunggu Verifikasi</Badge>
                )}
                {canVerify && !detail.is_verified && !detail._isPendingRequest && (
                  <Button onClick={() => { handleVerify(detail); setDetail(null); }} className="bg-emerald-600 hover:bg-emerald-700 gap-2" data-testid="verify-from-detail">
                    <CheckCircle2 className="h-4 w-4" /> Verifikasi Sekarang
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AuthedImage({ path, alt, className }) {
  const [imgSrc, setImgSrc] = useState(null);

  useEffect(() => {
    let revoke = null;
    if (path) {
      api.get(path, { responseType: 'blob' }).then(({ data }) => {
        const blobUrl = URL.createObjectURL(data);
        revoke = blobUrl;
        setImgSrc(blobUrl);
      }).catch(() => setImgSrc(null));
    } else {
      setImgSrc(null);
    }
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [path]);

  if (!imgSrc) return <div className={`${className} bg-slate-100 animate-pulse`} />;
  return <img src={imgSrc} alt={alt} className={className} />;
}

function FileSlot({ url, uploading, onUpload, onClear, testId }) {
  const isImage = url && !url.toLowerCase().endsWith('.pdf');
  const [imgSrc, setImgSrc] = useState(null);

  useEffect(() => {
    let revoke = null;
    if (isImage && url) {
      const path = url.replace(/^https?:\/\/[^/]+/, '');
      api.get(path, { responseType: 'blob' }).then(({ data }) => {
        const blobUrl = URL.createObjectURL(data);
        revoke = blobUrl;
        setImgSrc(blobUrl);
      }).catch(() => setImgSrc(null));
    } else {
      setImgSrc(null);
    }
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, isImage]);

  return (
    <div className="mt-2 flex items-start gap-3">
      {url ? (
        <div className="relative">
          {isImage ? (
            imgSrc ? (
              <img src={imgSrc} alt="File" className="h-28 w-28 object-cover rounded-lg border border-slate-200" />
            ) : (
              <div className="h-28 w-28 rounded-lg border border-slate-200 bg-slate-50 animate-pulse" />
            )
          ) : (
            <button type="button" onClick={() => openAuthedFile(url)}
              className="h-28 w-28 flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
              <FileText className="h-8 w-8 mb-1" />
              <span className="text-xs">Lihat PDF</span>
            </button>
          )}
          <button type="button" onClick={onClear}
            className="absolute -top-2 -right-2 h-6 w-6 bg-rose-600 text-white rounded-full flex items-center justify-center hover:bg-rose-700">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <label className="h-28 w-28 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#006837] hover:bg-[#006837]/5">
          {uploading ? (
            <span className="text-xs text-slate-500">Mengunggah...</span>
          ) : (
            <>
              <Upload className="h-6 w-6 text-slate-400 mb-1" />
              <span className="text-xs text-slate-500">Upload</span>
            </>
          )}
          <input type="file" accept="image/*,.pdf" className="hidden" onChange={onUpload} disabled={uploading} data-testid={testId} />
        </label>
      )}
    </div>
  );
}

function SmallStat({ icon: Icon, label, value, color }) {
  return (
    <div className={`rounded-xl border p-3 ${color}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</span>
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <div className="text-2xl font-extrabold tabular-nums mt-1">{value}</div>
    </div>
  );
}

function GalleryCard({ a, onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
      data-testid={`gallery-card-${a.id}`}
    >
      <div className="aspect-video bg-slate-100 flex items-center justify-center">
        {(a.photo_url || a.certificate_url) ? (
          <AuthedImage path={a.photo_url || a.certificate_url} alt={a.name} className="w-full h-full object-cover" />
        ) : (
          <Trophy className="h-12 w-12 text-slate-300" />
        )}
      </div>
      <div className="p-3">
        <div className="font-bold text-slate-900 line-clamp-2">{a.name}</div>
        <div className="text-xs text-slate-600 mt-1">
          {a.holder_full_name || a.holder_name || '-'}
          {a.year && ` • ${a.year}`}
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Badge variant="outline" className={catColor(a.category) + ' text-[10px]'}>{catLabel(a.category)}</Badge>
          {a.rank && <Badge variant="secondary" className="text-[10px]">{a.rank}</Badge>}
          {a.level && <Badge variant="outline" className="text-[10px]">{levelLabel(a.level)}</Badge>}
        </div>
      </div>
    </button>
  );
}

function DetailItem({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg">
      <Icon className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
      <div>
        <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="text-center py-8">
      <Icon className="h-10 w-10 mx-auto text-slate-300 mb-3" />
      <div className="font-semibold text-slate-700">{title}</div>
      <div className="text-sm text-slate-500 mt-1">{subtitle}</div>
    </div>
  );
}
