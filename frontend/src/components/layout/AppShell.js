import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Calendar, ScanLine, History, Users, Building2, BookOpen,
  ClipboardList, QrCode, FileText, Settings, LogOut, Menu, X, GraduationCap,
  Home, ShieldCheck, BookMarked, BarChart3, ChevronRight,
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
import { ROLE_LABELS } from '@/lib/api';
import { toast } from 'sonner';

function navForRole(role, roles) {
  const items = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, testid: 'nav-dashboard' },
  ];
  // Teacher-like roles can fill journal
  const teacherRoles = ['guru', 'wali_kelas', 'guru_piket', 'guru_bk', 'guru_tata_tertib', 'guru_ekstrakurikuler'];
  if (teacherRoles.includes(role)) {
    items.push({ to: '/jurnal/scan', label: 'Jurnal Presisi', icon: ScanLine, testid: 'nav-scan', highlight: true });
    items.push({ to: '/jadwal', label: 'Jadwal Saya', icon: Calendar, testid: 'nav-jadwal' });
    items.push({ to: '/jurnal/riwayat', label: 'Riwayat Jurnal', icon: History, testid: 'nav-jurnal-history' });
  }
  if (role === 'wali_kelas' || (roles || []).includes('wali_kelas')) {
    items.push({ to: '/wali-kelas', label: 'Wali Kelas', icon: BookMarked, testid: 'nav-wali-kelas' });
  }
  if (role === 'orang_tua') {
    items.push({ to: '/parent', label: 'Dashboard Anak', icon: Home, testid: 'nav-parent' });
  }
  if (role === 'siswa') {
    items.push({ to: '/jadwal', label: 'Jadwal Saya', icon: Calendar, testid: 'nav-jadwal' });
  }
  if (role === 'admin') {
    items.push({ to: '/admin/academic-year', label: 'Tahun Pelajaran', icon: GraduationCap, testid: 'nav-academic-year' });
    items.push({ to: '/admin/users', label: 'Pengguna', icon: Users, testid: 'nav-users' });
    items.push({ to: '/admin/classes', label: 'Kelas', icon: BookOpen, testid: 'nav-classes' });
    items.push({ to: '/admin/rooms', label: 'Ruangan', icon: Building2, testid: 'nav-rooms' });
    items.push({ to: '/admin/subjects', label: 'Mata Pelajaran', icon: BookMarked, testid: 'nav-subjects' });
    items.push({ to: '/admin/schedules', label: 'Jadwal Pelajaran', icon: Calendar, testid: 'nav-schedules' });
    items.push({ to: '/admin/qr-generator', label: 'QR Generator', icon: QrCode, testid: 'nav-qr' });
    items.push({ to: '/admin/audit-logs', label: 'Log Aktivitas', icon: ShieldCheck, testid: 'nav-audit' });
    items.push({ to: '/admin/settings', label: 'Pengaturan', icon: Settings, testid: 'nav-settings' });
  }
  return items;
}

function Sidebar({ items, current, onItemClick }) {
  return (
    <nav className="flex flex-col gap-1 px-3 py-4" data-testid="sidebar-nav">
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
  );
}

export default function AppShell({ children }) {
  const { user, activeRole, logout, switchRole, settings } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = navForRole(activeRole, user?.roles || []);

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
          <Sidebar items={items} current={loc.pathname} />
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
                  <Sidebar items={items} current={loc.pathname} onItemClick={() => setMobileOpen(false)} />
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
              {/* Role switcher */}
              {user?.roles?.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" data-testid="role-switcher-trigger" className="gap-2">
                      <Badge variant="secondary" className="bg-[#006837]/10 text-[#006837] border border-[#006837]/20">
                        {ROLE_LABELS[activeRole] || activeRole}
                      </Badge>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Berganti Peran</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {user.roles.map((r) => (
                      <DropdownMenuItem
                        key={r}
                        data-testid={`role-option-${r}`}
                        onClick={() => handleSwitchRole(r)}
                        className={activeRole === r ? 'bg-[#006837]/8 text-[#006837]' : ''}
                      >
                        {ROLE_LABELS[r] || r}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {user?.roles?.length === 1 && (
                <Badge variant="secondary" className="hidden sm:inline-flex bg-[#006837]/10 text-[#006837] border border-[#006837]/20">
                  {ROLE_LABELS[activeRole] || activeRole}
                </Badge>
              )}

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
