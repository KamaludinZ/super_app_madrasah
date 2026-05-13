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
} from 'lucide-react';
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

function navForRole(role, roles) {
  const items = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, testid: 'nav-dashboard' },
  ];
  const teacherRoles = ['guru', 'wali_kelas', 'guru_piket', 'guru_bk', 'guru_tata_tertib', 'guru_ekstrakurikuler'];
  if (role === 'guru_piket') {
    items.push({ to: '/piket/tugas', label: 'Tugas Hari Ini', icon: ListChecks, testid: 'nav-piket-tasks', highlight: true });
  }
  if (teacherRoles.includes(role)) {
    items.push({ to: '/jurnal/scan', label: 'Jurnal Presisi', icon: ScanLine, testid: 'nav-scan', highlight: true });
    items.push({ to: '/jadwal', label: 'Jadwal Saya', icon: Calendar, testid: 'nav-jadwal' });
    items.push({ to: '/jadwal/atur', label: 'Atur Jadwal Saya', icon: ClipboardEdit, testid: 'nav-my-schedule' });
    items.push({ to: '/jurnal/riwayat', label: 'Riwayat Jurnal', icon: History, testid: 'nav-jurnal-history' });
    if (role !== 'guru_piket') {
      items.push({ to: '/piket/tugas', label: 'Titipkan Tugas', icon: FileText, testid: 'nav-titipan-tugas' });
    }
    if (role === 'guru' || role === 'wali_kelas') {
      items.push({ to: '/nilai/input', label: 'Input Nilai', icon: ClipboardEdit, testid: 'nav-grades-input' });
    }
    // Teachers (incl wali kelas tabs etc) also see Data Prestasi to input their own
    if (role !== 'wali_kelas') {
      items.push({ to: '/prestasi', label: 'Data Prestasi', icon: Trophy, testid: 'nav-prestasi-guru' });
    }
  }
  if (role === 'tenaga_kependidikan') {
    items.push({ to: '/prestasi', label: 'Data Prestasi', icon: Trophy, testid: 'nav-prestasi-tendik' });
  }
  if (role === 'wali_kelas') {
    items.push({ to: '/wali-kelas', label: 'Dashboard Kelas', icon: BookMarked, testid: 'nav-wali-kelas' });
    items.push({ to: '/wali-kelas/siswa', label: 'Data Siswa', icon: Users, testid: 'nav-wk-siswa' });
    items.push({ to: '/wali-kelas/kehadiran', label: 'Kehadiran Siswa', icon: UserCheck, testid: 'nav-wk-kehadiran' });
    items.push({ to: '/wali-kelas/kebersihan', label: 'Kebersihan Kelas', icon: Sparkles, testid: 'nav-wk-kebersihan' });
    items.push({ to: '/prestasi', label: 'Data Prestasi', icon: Trophy, testid: 'nav-prestasi-wk' });
    items.push({ to: '/rapor', label: 'E-Rapor Kelas', icon: FileText, testid: 'nav-rapor-wk' });
  }
  if (role === 'guru_piket') {
    items.push({ to: '/admin/jadwal-piket', label: 'Jadwal Piket', icon: ShieldAlert, testid: 'nav-piket' });
  }
  if (role === 'guru_ekstrakurikuler') {
    items.push({ to: '/ekstrakurikuler', label: 'Ekstrakurikuler Saya', icon: Sparkles, testid: 'nav-ekstra-coach' });
  }
  if (role === 'siswa') {
    items.push({ to: '/jadwal', label: 'Jadwal Saya', icon: Calendar, testid: 'nav-jadwal' });
    items.push({ to: '/prestasi', label: 'Data Prestasi', icon: Trophy, testid: 'nav-prestasi-siswa' });
    items.push({ to: '/ekstrakurikuler', label: 'Ekstrakurikuler', icon: Sparkles, testid: 'nav-ekstra-siswa' });
    items.push({ to: '/rapor', label: 'Rapor Saya', icon: FileText, testid: 'nav-rapor-siswa' });
  }
  if (role === 'admin') {
    items.push({ to: '/admin/academic-year', label: 'Tahun Pelajaran', icon: GraduationCap, testid: 'nav-academic-year' });
    items.push({ to: '/admin/users', label: 'Pengguna', icon: Users, testid: 'nav-users' });
    items.push({ to: '/admin/import', label: 'Import Excel', icon: FileUp, testid: 'nav-admin-import' });
    items.push({ to: '/admin/holidays', label: 'Hari Libur', icon: CalendarDays, testid: 'nav-admin-holidays' });
    items.push({ to: '/admin/mutasi', label: 'Data Mutasi', icon: ArrowRightLeft, testid: 'nav-admin-mutasi' });
    items.push({ to: '/admin/backup', label: 'Backup & Restore', icon: Database, testid: 'nav-admin-backup' });
    items.push({ to: '/piket/tugas', label: 'Tugas & Piket', icon: ListChecks, testid: 'nav-admin-piket-tasks' });
    items.push({ to: '/admin/siswa', label: 'Data Siswa', icon: GraduationCap, testid: 'nav-admin-siswa' });
    items.push({ to: '/admin/kehadiran', label: 'Kehadiran Siswa', icon: UserCheck, testid: 'nav-admin-kehadiran' });
    items.push({ to: '/admin/kebersihan', label: 'Kebersihan Kelas', icon: Sparkles, testid: 'nav-admin-kebersihan' });
    items.push({ to: '/admin/classes', label: 'Kelas', icon: BookOpen, testid: 'nav-classes' });
    items.push({ to: '/admin/rooms', label: 'Ruangan', icon: Building2, testid: 'nav-rooms' });
    items.push({ to: '/admin/subjects', label: 'Mata Pelajaran', icon: BookMarked, testid: 'nav-subjects' });
    items.push({ to: '/admin/schedules', label: 'Jadwal Pelajaran', icon: Calendar, testid: 'nav-schedules' });
    items.push({ to: '/admin/jadwal-piket', label: 'Jadwal Piket', icon: ShieldAlert, testid: 'nav-piket-admin' });
    items.push({ to: '/admin/jurnal', label: 'Data Jurnal', icon: ClipboardList, testid: 'nav-admin-jurnal' });
    items.push({ to: '/prestasi', label: 'Data Prestasi', icon: Trophy, testid: 'nav-prestasi-admin' });
    items.push({ to: '/ekstrakurikuler', label: 'Ekstrakurikuler', icon: Sparkles, testid: 'nav-ekstra-admin' });
    items.push({ to: '/nilai/input', label: 'Input Nilai', icon: ClipboardEdit, testid: 'nav-grades-input-admin' });
    items.push({ to: '/rapor', label: 'E-Rapor Digital', icon: FileText, testid: 'nav-rapor-admin' });
    items.push({ to: '/admin/qr-generator', label: 'QR Generator', icon: QrCode, testid: 'nav-qr' });
    items.push({ to: '/admin/audit-logs', label: 'Log Aktivitas', icon: ShieldCheck, testid: 'nav-audit' });
    items.push({ to: '/admin/settings', label: 'Pengaturan', icon: Settings, testid: 'nav-settings' });
  }
  return items;
}

function ActivePeriodCard({ ay }) {
  if (!ay || !ay.name) {
    return (
      <div className="mx-3 mt-3 mb-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        Belum ada Tahun Pelajaran aktif. Buat di menu Tahun Pelajaran.
      </div>
    );
  }
  const activeSem = (ay.semesters || []).find((s) => s.is_active) || { label: '-', name: '-' };
  return (
    <div className="mx-3 mt-3 mb-1 rounded-xl bg-gradient-to-br from-[#006837] to-[#0B7A3B] p-3 text-white shadow-sm" data-testid="sidebar-active-period">
      <div className="flex items-center gap-1.5">
        <GraduationCap className="h-3.5 w-3.5 opacity-80" />
        <div className="text-[10px] uppercase tracking-wider font-semibold opacity-80">Tahun Pelajaran Aktif</div>
      </div>
      <div className="font-mono text-base font-extrabold tabular-nums tracking-tight">{ay.name}</div>
      <div className="mt-1.5 pt-1.5 border-t border-white/20 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider opacity-80">Semester</span>
        <Badge className="bg-amber-300/95 text-amber-900 border-0 capitalize text-[10px] font-bold px-2 py-0">
          {activeSem.label || activeSem.name}
        </Badge>
      </div>
    </div>
  );
}

function Sidebar({ items, current, onItemClick, activeAY }) {
  return (
    <div className="flex flex-col">
      <ActivePeriodCard ay={activeAY} />
      <nav className="flex flex-col gap-1 px-3 py-3" data-testid="sidebar-nav">
        {items.map((it) => {
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
        })}
      </nav>
    </div>
  );
}

export default function AppShell({ children }) {
  const { user, activeRole, logout, switchRole, settings } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeAY, setActiveAY] = useState(null);
  const items = navForRole(activeRole, user?.roles || []);

  useEffect(() => {
    api.get('/academic-years/active').then(({ data }) => setActiveAY(data)).catch(() => {});
  }, [activeRole]);

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
          <Sidebar items={items} current={loc.pathname} activeAY={activeAY} />
        </div>
        <div className="p-3 border-t border-slate-100 text-xs text-slate-500">
          {schoolName}
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
                <SheetContent side="left" className="w-72 p-0">
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
                  <div className="overflow-y-auto h-[calc(100vh-90px)]">
                    <Sidebar items={items} current={loc.pathname} onItemClick={() => setMobileOpen(false)} activeAY={activeAY} />
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
    </div>
  );
}
