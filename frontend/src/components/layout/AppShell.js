import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Calendar, ScanLine, History, Users, Building2, BookOpen,
  QrCode, Settings, LogOut, Menu, GraduationCap,
  ShieldCheck, BookMarked, ChevronRight,
  UserCheck, Sparkles, FileSpreadsheet, ClipboardList,
  ShieldAlert,
  FileUp,
  Trophy,
  ClipboardEdit, FileText,
  CalendarDays, Database, ListChecks, ArrowRightLeft,
  Megaphone, ChevronDown, Briefcase, Info, CheckCircle2, UserCircle, HelpCircle,
  Target, Award, DollarSign, LogIn, Loader2,
} from 'lucide-react';
import ViewContextDialog from './ViewContextDialog';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ROLE_LABELS, api } from '@/lib/api';
import { toast } from 'sonner';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { ChangePasswordDialog } from '@/components/security/ChangePasswordDialog';

/**
 * Build sidebar items based ONLY on activeRole.
 * STRICT: tiap role hanya menampilkan menu yang relevan dengan peran tersebut.
 * Jika user punya banyak peran, dia harus switch role untuk akses menu peran lain.
 *
 * Returns either:
 * - Array of items (for roles without groups)
 * - Array of groups with {title, items} structure (for admin with groups)
 */
function navForRole(role, userRoles = []) {
  const items = [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, testid: 'nav-dashboard' }];

  if (role === 'guru') {
    items.push({ to: '/jurnal/scan', label: 'Jurnal Presisi', icon: ScanLine, testid: 'nav-scan', highlight: true });
    items.push({ to: '/jadwal', label: 'Jadwal Saya', icon: Calendar, testid: 'nav-jadwal' });
    items.push({ to: '/jadwal/atur', label: 'Atur Jadwal Saya', icon: ClipboardEdit, testid: 'nav-my-schedule' });
    items.push({ to: '/jurnal/riwayat', label: 'Riwayat Jurnal', icon: History, testid: 'nav-jurnal-history' });
    items.push({ to: '/guru/indikator-materi', label: 'Input Indikator & Materi', icon: BookOpen, testid: 'nav-guru-indikator-materi' });
    items.push({ to: '/guru/kebersihan', label: 'Kebersihan Kelas', icon: Sparkles, testid: 'nav-guru-kebersihan' });
    items.push({ to: '/guru/laporan', label: 'Laporan', icon: FileText, testid: 'nav-guru-laporan' });
    items.push({ to: '/piket/tugas', label: 'Titipkan Tugas', icon: FileText, testid: 'nav-titipan-tugas' });
    items.push({ to: '/nilai/input', label: 'Input Nilai', icon: ClipboardEdit, testid: 'nav-grades-input' });
    items.push({ to: '/prestasi', label: 'Data Prestasi', icon: Trophy, testid: 'nav-prestasi-guru' });
    items.push({ to: '/verval/ajuan-saya', label: 'Ajuan Verval Saya', icon: CheckCircle2, testid: 'nav-verval-guru' });
  } else if (role === 'wali_kelas') {
    items.push({ to: '/wali-kelas', label: 'Dashboard Kelas', icon: BookMarked, testid: 'nav-wali-kelas' });
    items.push({ to: '/wali-kelas/siswa', label: 'Data Siswa', icon: Users, testid: 'nav-wk-siswa' });
    items.push({ to: '/wali-kelas/kehadiran', label: 'Kehadiran Siswa', icon: UserCheck, testid: 'nav-wk-kehadiran' });
    items.push({ to: '/wali-kelas/kebersihan', label: 'Kebersihan Kelas', icon: Sparkles, testid: 'nav-wk-kebersihan' });
    items.push({ to: '/wali-kelas/laporan', label: 'Data Laporan', icon: FileText, testid: 'nav-wk-laporan' });
    items.push({ to: '/jadwal', label: 'Jadwal Kelas', icon: Calendar, testid: 'nav-wk-jadwal' });
    items.push({ to: '/jadwal/atur', label: 'Atur Jadwal Kelas', icon: ClipboardEdit, testid: 'nav-wk-my-schedule' });
    items.push({ to: '/prestasi', label: 'Data Prestasi', icon: Trophy, testid: 'nav-prestasi-wk' });
    items.push({ to: '/rapor', label: 'E-Rapor Kelas', icon: FileText, testid: 'nav-rapor-wk' });
  } else if (role === 'guru_piket') {
    items.push({ to: '/piket/tugas', label: 'Tugas Hari Ini', icon: ListChecks, testid: 'nav-piket-tasks', highlight: true });
    items.push({ to: '/admin/jadwal-piket', label: 'Jadwal Piket', icon: ShieldAlert, testid: 'nav-piket' });
    items.push({ to: '/jurnal/riwayat', label: 'Riwayat Jurnal Piket', icon: History, testid: 'nav-jurnal-history-piket' });
    items.push({ to: '/guru/kebersihan', label: 'Kebersihan Kelas', icon: Sparkles, testid: 'nav-piket-kebersihan' });
  } else if (role === 'guru_bk') {
    items.push({ to: '/wali-kelas/siswa', label: 'Data Siswa', icon: Users, testid: 'nav-bk-siswa' });
    items.push({ to: '/admin/kehadiran', label: 'Kehadiran Siswa', icon: UserCheck, testid: 'nav-bk-kehadiran' });
    items.push({ to: '/admin/kebersihan', label: 'Kebersihan Kelas', icon: Sparkles, testid: 'nav-bk-kebersihan' });
    items.push({ to: '/admin/laporan', label: 'Data Laporan', icon: FileText, testid: 'nav-bk-laporan' });
    items.push({ to: '/prestasi', label: 'Data Prestasi', icon: Trophy, testid: 'nav-prestasi-bk' });
  } else if (role === 'guru_tata_tertib') {
    items.push({ to: '/wali-kelas/siswa', label: 'Data Siswa', icon: Users, testid: 'nav-tatib-siswa' });
    items.push({ to: '/wali-kelas/kehadiran', label: 'Kehadiran Siswa', icon: UserCheck, testid: 'nav-tatib-kehadiran' });
  } else if (role === 'guru_ekstrakurikuler') {
    items.push({ to: '/ekstrakurikuler', label: 'Ekstrakurikuler Saya', icon: Sparkles, testid: 'nav-ekstra-coach' });
    items.push({ to: '/prestasi', label: 'Data Prestasi', icon: Trophy, testid: 'nav-prestasi-ekskul' });
  } else if (role === 'tenaga_kependidikan') {
    items.push({ to: '/prestasi', label: 'Data Prestasi', icon: Trophy, testid: 'nav-prestasi-tendik' });
    items.push({ to: '/verval/ajuan-saya', label: 'Ajuan Verval Saya', icon: CheckCircle2, testid: 'nav-verval-tendik' });
  } else if (role === 'siswa') {
    items.push({ to: '/jadwal', label: 'Jadwal Saya', icon: Calendar, testid: 'nav-jadwal' });
    items.push({ to: '/prestasi', label: 'Data Prestasi', icon: Trophy, testid: 'nav-prestasi-siswa' });
    items.push({ to: '/ekstrakurikuler', label: 'Ekstrakurikuler', icon: Sparkles, testid: 'nav-ekstra-siswa' });
    items.push({ to: '/rapor', label: 'Rapor Saya', icon: FileText, testid: 'nav-rapor-siswa' });
    items.push({ to: '/verval/ajuan-saya', label: 'Ajuan Verval Saya', icon: CheckCircle2, testid: 'nav-verval-siswa' });
  } else if (role === 'orang_tua') {
    items.push({ to: '/dashboard', label: 'Anak Saya', icon: Users, testid: 'nav-ortu-anak' });
  } else if (role === 'admin') {
    // Admin uses grouped menu structure
    return [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, testid: 'nav-dashboard' },
      {
        title: 'Master App',
        items: [
          { to: '/admin/tahun-takwim', label: 'Tahun Takwim', icon: Calendar, testid: 'nav-tahun-takwim' },
          { to: '/admin/academic-year', label: 'Tahun Pelajaran', icon: GraduationCap, testid: 'nav-academic-year' },
          { to: '/admin/semesters', label: 'Semester', icon: CalendarDays, testid: 'nav-semesters' },
          { to: '/admin/kurikulum', label: 'Kurikulum', icon: BookOpen, testid: 'nav-curriculums' },
          { to: '/admin/subjects', label: 'Mata Pelajaran', icon: BookMarked, testid: 'nav-subjects' },
          { to: '/admin/rooms', label: 'Ruangan', icon: Building2, testid: 'nav-rooms' },
          { to: '/admin/classes', label: 'Kelas', icon: BookOpen, testid: 'nav-classes' },
          { to: '/admin/jabatan', label: 'Jabatan', icon: Briefcase, testid: 'nav-jabatan' },
          { to: '/admin/holidays', label: 'Hari Libur', icon: CalendarDays, testid: 'nav-admin-holidays' },
          { to: '/admin/qr-generator', label: 'QR Generator', icon: QrCode, testid: 'nav-qr' },
        ],
      },
      {
        title: 'Manajemen Pengguna',
        items: [
          { to: '/admin/users', label: 'Pengguna (GTK & Staff)', icon: Users, testid: 'nav-users' },
          { to: '/admin/pengguna-siswa', label: 'Pengguna Siswa', icon: UserCircle, testid: 'nav-pengguna-siswa' },
          { to: '/admin/mutasi', label: 'Data Mutasi', icon: ArrowRightLeft, testid: 'nav-admin-mutasi' },
          { to: '/admin/verval-siswa', label: 'Verval Data Siswa', icon: CheckCircle2, testid: 'nav-admin-verval-siswa' },
        ],
      },
      {
        title: 'Manajemen GTK',
        items: [
          { to: '/admin/gtk', label: 'Data GTK', icon: Briefcase, testid: 'nav-gtk' },
          { to: '/admin/gtk/laporan-absensi', label: 'Laporan Absensi', icon: UserCheck, testid: 'nav-gtk-absensi' },
          { to: '/admin/gtk/agenda-guru', label: 'Agenda Guru', icon: Calendar, testid: 'nav-gtk-agenda-guru' },
          { to: '/admin/gtk/agenda-tendik', label: 'Agenda Tendik', icon: Calendar, testid: 'nav-gtk-agenda-tendik' },
          { to: '/admin/gtk/e-kinerja', label: 'E-Kinerja', icon: Target, testid: 'nav-gtk-ekinerja' },
          { to: '/admin/gtk/profesionalitas', label: 'Profesionalitas GTK', icon: Award, testid: 'nav-gtk-profesionalitas' },
          { to: '/admin/verval-gtk', label: 'Verval Data GTK', icon: CheckCircle2, testid: 'nav-admin-verval-gtk' },
        ],
      },
      {
        title: 'Manajemen Siswa',
        items: [
          { to: '/admin/siswa', label: 'Data Siswa', icon: GraduationCap, testid: 'nav-admin-siswa' },
          { to: '/admin/kehadiran', label: 'Kehadiran Siswa', icon: UserCheck, testid: 'nav-admin-kehadiran' },
          { to: '/admin/buku-induk', label: 'Buku Induk Siswa', icon: FileText, testid: 'nav-admin-buku-induk' },
          { to: '/admin/pip/penerima', label: 'Data Penerima PIP', icon: DollarSign, testid: 'nav-admin-pip-penerima' },
          { to: '/admin/pip/ajuan', label: 'Daftar Ajuan PIP', icon: FileText, testid: 'nav-admin-pip-ajuan' },
          { to: '/admin/alumni', label: 'Data Alumni', icon: GraduationCap, testid: 'nav-admin-alumni' },
          { to: '/admin/naik-kelas', label: 'Naik Kelas & Kelulusan', icon: ArrowRightLeft, testid: 'nav-admin-promotions' },
        ],
      },
      {
        title: 'Akademik',
        items: [
          { to: '/admin/schedules', label: 'Jadwal Pelajaran', icon: Calendar, testid: 'nav-schedules' },
          { to: '/admin/jadwal-piket', label: 'Jadwal Piket', icon: ShieldAlert, testid: 'nav-piket-admin' },
          { to: '/admin/jurnal', label: 'Data Jurnal', icon: ClipboardList, testid: 'nav-admin-jurnal' },
          { to: '/admin/indikator-materi', label: 'Data Indikator & Materi', icon: BookOpen, testid: 'nav-admin-indikator-materi' },
          { to: '/nilai/input', label: 'Input Nilai', icon: ClipboardEdit, testid: 'nav-grades-input-admin' },
          { to: '/rapor', label: 'E-Rapor Digital', icon: FileText, testid: 'nav-rapor-admin' },
        ],
      },
      {
        title: 'Aktivitas & Program',
        items: [
          { to: '/prestasi', label: 'Data Prestasi', icon: Trophy, testid: 'nav-prestasi-admin' },
          { to: '/ekstrakurikuler', label: 'Ekstrakurikuler', icon: Sparkles, testid: 'nav-ekstra-admin' },
          { to: '/admin/kebersihan', label: 'Rekapitulasi Kebersihan', icon: Sparkles, testid: 'nav-admin-kebersihan' },
          { to: '/admin/laporan', label: 'Data Laporan', icon: FileText, testid: 'nav-admin-laporan' },
          { to: '/piket/tugas', label: 'Tugas & Piket', icon: ListChecks, testid: 'nav-admin-piket-tasks' },
          { to: '/admin/pengumuman', label: 'Pengumuman', icon: Megaphone, testid: 'nav-admin-announcements' },
        ],
      },
      {
        title: 'Manajemen Tatib & BK',
        items: [
          { to: '/admin/tatib/input', label: 'Input Tata Tertib', icon: ClipboardEdit, testid: 'nav-admin-tatib-input' },
          { to: '/admin/tatib/kategori', label: 'Input Kategori', icon: BookMarked, testid: 'nav-admin-tatib-kategori' },
          { to: '/admin/tatib/penanganan', label: 'Input Penanganan', icon: ShieldCheck, testid: 'nav-admin-tatib-penanganan' },
          { to: '/admin/tatib/data', label: 'Data Tata Tertib', icon: Database, testid: 'nav-admin-tatib-data' },
        ],
      },
      {
        title: 'Sistem & Utilitas',
        items: [
          { to: '/admin/app-info', label: 'Info & Update', icon: Info, testid: 'nav-admin-app-info' },
          { to: '/admin/import', label: 'Import Excel', icon: FileUp, testid: 'nav-admin-import' },
          { to: '/admin/backup', label: 'Backup & Restore', icon: Database, testid: 'nav-admin-backup' },
          { to: '/admin/audit-logs', label: 'Log Aktivitas', icon: ShieldCheck, testid: 'nav-audit' },
          { to: '/admin/settings', label: 'Pengaturan', icon: Settings, testid: 'nav-settings' },
        ],
      },
    ];
  }
  return items;
}

function ActivePeriodCard({ ctx, onClick }) {
  if (!ctx || !ctx.year_name) {
    return (
      <div className="mx-3 mt-3 mb-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        Belum ada Tahun Pelajaran aktif. Buat di menu Tahun Pelajaran.
      </div>
    );
  }
  // Show orange override UI only if user has override AND it's different from active global
  const showOverrideUI = ctx.is_override && !ctx.isViewingSameSemesterAsActive;
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="sidebar-active-period"
      className={`group mx-3 mt-3 mb-1 rounded-xl p-3 text-white shadow-sm w-[calc(100%-1.5rem)] text-left transition-all hover:shadow-md ${
        showOverrideUI
          ? 'bg-gradient-to-br from-amber-600 to-amber-700 ring-2 ring-amber-300/50'
          : 'bg-gradient-to-br from-[#006837] to-[#0B7A3B]'
      }`}
    >
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 opacity-80" />
          <div className="text-[10px] uppercase tracking-wider font-semibold opacity-80">
            {showOverrideUI ? 'Mode Lihat' : 'Periode Aktif'}
          </div>
        </div>
        <ChevronDown className="h-3 w-3 opacity-70 group-hover:opacity-100" />
      </div>

      {/* Tahun Takwim - tampilkan dari semester yang dipilih */}
      {ctx.tahun_takwim_info && ctx.tahun_takwim_info.length > 0 && (() => {
        // Ambil Tahun Takwim pertama dari semester yang dipilih (bukan is_active)
        const currentTT = ctx.tahun_takwim_info[0];
        if (!currentTT) return null;
        return (
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider opacity-70">Tahun Takwim</span>
            <Badge className="bg-white/20 text-white border-white/30 text-[10px] font-bold px-2 py-0">
              {currentTT.year}
            </Badge>
          </div>
        );
      })()}

      {/* Tahun Pelajaran */}
      <div className="mt-1.5 pt-1.5 border-t border-white/20 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider opacity-80">
          <GraduationCap className="h-3 w-3 inline mr-1 opacity-80" />
          Tahun Pelajaran
        </span>
      </div>
      <div className="font-mono text-base font-extrabold tabular-nums tracking-tight" data-testid="sidebar-tp-name">{ctx.year_name}</div>

      {/* Semester */}
      <div className="mt-2 pt-2 border-t border-white/20 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider opacity-80">Semester</span>
        <Badge data-testid="sidebar-semester" className="bg-amber-300/95 text-amber-900 border-0 capitalize text-[10px] font-bold px-2 py-0">
          {ctx.semester_name || '-'}
        </Badge>
      </div>

      {/* Kurikulum */}
      <div className="mt-1 flex items-center justify-between gap-1">
        <span className="text-[10px] uppercase tracking-wider opacity-80 shrink-0">Kurikulum</span>
        {ctx.curriculum_name ? (
          <Badge data-testid="sidebar-curriculum" className="bg-white/20 text-white border-white/30 text-[10px] font-semibold px-2 py-0 truncate max-w-[120px]" title={ctx.curriculum_name}>
            {ctx.curriculum_name}
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-rose-100/90 text-rose-800 border-rose-200 text-[10px] font-semibold px-2 py-0" data-testid="sidebar-curriculum-empty">
            Belum diset
          </Badge>
        )}
      </div>

      {showOverrideUI && (
        <div className="text-[9px] mt-1 italic opacity-90">Klik untuk ubah / reset</div>
      )}
      {!showOverrideUI && (
        <div className="text-[9px] mt-1 italic opacity-70">Klik untuk pindah TP lampau</div>
      )}
    </button>
  );
}

function Sidebar({ items, current, onItemClick, viewCtx, onTPClick }) {
  // Check if items is grouped (has title property) or flat
  const isGrouped = items.some((item) => item.title);

  // State to track which groups are expanded (default all expanded)
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const groups = {};
    items.forEach((item, idx) => {
      if (item.title) {
        groups[item.title || idx] = true;
      }
    });
    return groups;
  });

  const toggleGroup = (groupKey) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const renderMenuItem = (it) => {
    const Icon = it.icon;
    const active = current === it.to;
    return (
      <Link
        key={it.to}
        to={it.to}
        data-testid={it.testid}
        onClick={onItemClick}
        className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
          active
            ? 'bg-[#006837] text-white shadow-sm'
            : 'text-slate-700 hover:bg-[#006837]/8 hover:text-[#006837]'
        } ${it.highlight && !active ? 'bg-amber-50 text-amber-900 border border-amber-200' : ''}`}
      >
        <Icon className="h-4 w-4" />
        <span className="flex-1">{it.label}</span>
        {active && <ChevronRight className="h-3.5 w-3.5" />}
      </Link>
    );
  };

  return (
    <div className="flex flex-col">
      <ActivePeriodCard ctx={viewCtx} onClick={onTPClick} />
      <nav className="flex flex-col gap-1 px-3 py-3" data-testid="sidebar-nav">
        {isGrouped ? (
          items.map((item, idx) => {
            // If item has 'to' property, it's a regular menu item
            if (item.to) {
              return renderMenuItem(item);
            }
            // Otherwise it's a group
            const groupKey = item.title || idx;
            const isExpanded = expandedGroups[groupKey];
            return (
              <div key={groupKey} className="mt-3 first:mt-0">
                <button
                  onClick={() => toggleGroup(groupKey)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-[#006837] transition-colors rounded-lg hover:bg-slate-50"
                  data-testid={`group-toggle-${groupKey}`}
                >
                  <span>{item.title}</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                </button>
                {isExpanded && (
                  <div className="flex flex-col gap-1 mt-1">
                    {item.items.map((it) => renderMenuItem(it))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          items.map((it) => renderMenuItem(it))
        )}
      </nav>
    </div>
  );
}

export default function AppShell({ children }) {
  const { user, activeRole, logout, switchRole, stopImpersonate, settings, refreshMe } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [viewCtx, setViewCtx] = useState(null);
  const [vcDialogOpen, setVcDialogOpen] = useState(false);
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [appVersion, setAppVersion] = useState(null);
  const [stoppingImpersonate, setStoppingImpersonate] = useState(false);
  const items = navForRole(activeRole, user?.roles || []);

  const handleStopImpersonate = async () => {
    if (stoppingImpersonate) return;
    setStoppingImpersonate(true);
    try {
      await stopImpersonate();
      toast.success('Kembali ke akun admin');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal kembali ke akun admin');
      setStoppingImpersonate(false);
    }
  };

  // Auto-prompt password change on first load if needed.
  useEffect(() => {
    const ps = user?.password_status;
    if (ps?.should_prompt) {
      const alreadyShown = sessionStorage.getItem('matsa_pw_prompt_shown');
      if (!alreadyShown) {
        setPwDialogOpen(true);
        sessionStorage.setItem('matsa_pw_prompt_shown', '1');
      }
    }
  }, [user?.id]);

  const refreshViewCtx = React.useCallback(() => {
    api.get('/auth/view-context').then(({ data }) => {
      // Enhance data with logic to detect if override is same as active
      const activeSemester = (data.available_semesters || []).find(s => s.is_active);
      const isViewingSameSemesterAsActive = data.semester_id && activeSemester && data.semester_id === activeSemester.id;
      data.isViewingSameSemesterAsActive = isViewingSameSemesterAsActive;
      setViewCtx(data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    refreshViewCtx();
  }, [activeRole, refreshViewCtx]);

  // Load app version
  useEffect(() => {
    api.get('/app-info')
      .then(({ data }) => setAppVersion(data.current_version))
      .catch(() => setAppVersion('1.0.0')); // fallback
  }, []);

  const handleLogout = async () => {
    await logout();
    nav('/login');
  };

  const handleSwitchRole = async (r) => {
    try {
      await switchRole(r);
      toast.success(`Berganti ke peran: ${ROLE_LABELS[r] || r}`);
      nav('/dashboard');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal berganti peran');
    }
  };

  const userInitial = (user?.full_name || user?.username || 'U').substring(0, 2).toUpperCase();
  const appName = settings?.app_name || 'Super Apps MATSANDATAMA';
  const schoolName = settings?.school_name || 'MTsN 2 Kota Malang';

  return (
    <div className="min-h-screen bg-[var(--cream)] flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-white border-r border-slate-200 sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-10 w-10 object-contain" />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-[#006837] flex items-center justify-center text-white font-bold">MS</div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-bold text-[#006837] truncate">SUPER APPS</div>
              <div className="text-xs text-slate-600 truncate">MATSANDATAMA</div>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Sidebar items={items} current={loc.pathname} viewCtx={viewCtx} onTPClick={() => setVcDialogOpen(true)} />
        </div>
        <div className="p-3 border-t border-slate-100">
          <div className="text-xs text-slate-600 font-medium">{schoolName}</div>
          {appVersion && (
            <div className="text-[10px] text-slate-400 mt-1">Version {appVersion}</div>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
          <div className="flex items-center justify-between px-4 lg:px-6 h-16">
            <div className="flex items-center gap-3 min-w-0">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden" data-testid="mobile-menu-trigger">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0 flex flex-col">
                  <div className="px-5 py-5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      {settings?.logo_url ? (
                        <img src={settings.logo_url} alt="Logo" className="h-10 w-10 object-contain" />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-[#006837] flex items-center justify-center text-white font-bold">MS</div>
                      )}
                      <div>
                        <div className="text-sm font-bold text-[#006837]">SUPER APPS</div>
                        <div className="text-xs text-slate-600">MATSANDATAMA</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <Sidebar items={items} current={loc.pathname} onItemClick={() => setMobileOpen(false)} viewCtx={viewCtx} onTPClick={() => { setVcDialogOpen(true); setMobileOpen(false); }} />
                  </div>
                  <div className="p-3 border-t border-slate-100">
                    <div className="text-xs text-slate-600 font-medium">{schoolName}</div>
                    {appVersion && (
                      <div className="text-[10px] text-slate-400 mt-1">Version {appVersion}</div>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
              <div className="min-w-0">
                <div className="text-base sm:text-lg font-semibold text-slate-900 truncate">
                  {appName}
                </div>
                <div className="text-xs text-slate-500 hidden sm:block">{schoolName}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Panduan button */}
              <Button
                variant="ghost" size="icon"
                onClick={() => nav('/panduan')}
                className="rounded-full hover:bg-[#006837]/8 hidden sm:inline-flex"
                data-testid="topbar-panduan-btn"
                title="Panduan Pengguna"
              >
                <HelpCircle className="h-5 w-5 text-slate-700" />
              </Button>

              {/* Notification Bell */}
              <NotificationBell />

              {/* Back to Admin button - show only when impersonating */}
              {user?.is_impersonating && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStopImpersonate}
                  disabled={stoppingImpersonate}
                  className="gap-2 bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100 hover:text-amber-900"
                  data-testid="stop-impersonate-btn"
                  title={`Kembali ke akun ${user.impersonator_username}`}
                >
                  {stoppingImpersonate ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogIn className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">Kembali ke Admin</span>
                </Button>
              )}

              {/* Role switcher next to avatar - ALWAYS visible */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="role-switcher-trigger" className="gap-2 h-9 hidden sm:flex">
                    <Badge variant="secondary" className="bg-[#006837]/10 text-[#006837] border-0 px-1.5 py-0">
                      {ROLE_LABELS[activeRole] || activeRole}
                    </Badge>
                    <ChevronRight className="h-3.5 w-3.5 rotate-90 text-slate-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    {user?.roles?.length > 1 ? 'Berganti Peran' : 'Peran Aktif'}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {(user?.roles || []).map((r) => (
                    <DropdownMenuItem
                      key={r}
                      data-testid={`role-option-${r}`}
                      onClick={() => r !== activeRole && handleSwitchRole(r)}
                      className={activeRole === r ? 'bg-[#006837]/8 text-[#006837] font-semibold' : ''}
                    >
                      {ROLE_LABELS[r] || r}
                      {activeRole === r && <span className="ml-auto text-xs">aktif</span>}
                    </DropdownMenuItem>
                  ))}
                  {user?.roles?.length === 1 && (
                    <div className="px-2 py-1.5 text-xs text-slate-500">Anda hanya memiliki 1 peran</div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Avatar + profile menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid="profile-menu-trigger" className="rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-[#006837] text-white text-xs font-semibold">{userInitial}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>
                    <div className="font-semibold">{user?.full_name}</div>
                    <div className="text-xs text-slate-500 font-normal">@{user?.username}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {/* Mobile-only: show role switcher in menu */}
                  <div className="sm:hidden">
                    {(user?.roles || []).map((r) => (
                      <DropdownMenuItem
                        key={`mobile-${r}`}
                        onClick={() => r !== activeRole && handleSwitchRole(r)}
                        className={activeRole === r ? 'bg-[#006837]/8 text-[#006837]' : ''}
                      >
                        {ROLE_LABELS[r] || r}
                        {activeRole === r && <span className="ml-auto text-xs">aktif</span>}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </div>
                  <DropdownMenuItem onClick={() => nav('/profile')} data-testid="menu-profile">
                    <UserCircle className="h-4 w-4 mr-2" /> Profil Saya
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setPwDialogOpen(true); }} data-testid="menu-change-password">
                    <ShieldCheck className="h-4 w-4 mr-2" /> Ubah Password
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => nav('/panduan')} data-testid="menu-panduan" className="sm:hidden">
                    <HelpCircle className="h-4 w-4 mr-2" /> Panduan Pengguna
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout} data-testid="logout-button">
                    <LogOut className="h-4 w-4 mr-2" /> Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full">
          <motion.div
            key={loc.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Password change suggestion dialog (auto-prompts on first load if needed) */}
      <ChangePasswordDialog
        open={pwDialogOpen}
        onOpenChange={setPwDialogOpen}
        reason={user?.password_status?.reason}
        message={user?.password_status?.message}
        onSuccess={() => refreshMe?.()}
        onDismiss={() => refreshMe?.()}
      />

      {/* View Context dialog (per-user TP/Semester override) */}
      <ViewContextDialog
        open={vcDialogOpen}
        onOpenChange={setVcDialogOpen}
        onUpdated={() => { refreshViewCtx(); refreshMe?.(); }}
      />
    </div>
  );
}
