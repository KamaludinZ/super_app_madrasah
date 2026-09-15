import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard, Calendar, ScanLine, Users, BookOpen, Settings,
  QrCode, Trophy, FileText, UserCheck, Sparkles, ClipboardList,
  Building2, BookMarked, GraduationCap, Megaphone, DollarSign,
  ShieldCheck, ArrowRightLeft, Globe, CalendarDays,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { activeRole } = useAuth();

  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = (command) => {
    setOpen(false);
    command();
  };

  // Define menu items based on role
  const getMenuItems = () => {
    const baseItems = [
      {
        group: 'Navigasi Utama',
        items: [
          {
            icon: LayoutDashboard,
            label: 'Dashboard',
            shortcut: 'D',
            onSelect: () => navigate('/dashboard'),
          },
        ],
      },
    ];

    if (activeRole === 'guru') {
      baseItems.push({
        group: 'Jurnal & Mengajar',
        items: [
          {
            icon: ScanLine,
            label: 'Jurnal Presisi - Scan QR',
            shortcut: 'J',
            onSelect: () => navigate('/jurnal/scan'),
            highlight: true,
          },
          {
            icon: FileText,
            label: 'Riwayat Jurnal',
            onSelect: () => navigate('/jurnal/riwayat'),
          },
          {
            icon: Calendar,
            label: 'Jadwal Saya',
            onSelect: () => navigate('/jadwal'),
          },
          {
            icon: BookOpen,
            label: 'Input Indikator & Materi',
            onSelect: () => navigate('/guru/indikator-materi'),
          },
        ],
      });
      baseItems.push({
        group: 'Data & Laporan',
        items: [
          {
            icon: ClipboardList,
            label: 'Input Nilai',
            onSelect: () => navigate('/nilai/input'),
          },
          {
            icon: Trophy,
            label: 'Data Prestasi',
            onSelect: () => navigate('/prestasi'),
          },
          {
            icon: FileText,
            label: 'Laporan',
            onSelect: () => navigate('/guru/laporan'),
          },
        ],
      });
    } else if (activeRole === 'admin') {
      baseItems.push({
        group: 'Master Data',
        items: [
          {
            icon: Users,
            label: 'Kelola Pengguna',
            shortcut: 'U',
            onSelect: () => navigate('/admin/users'),
          },
          {
            icon: GraduationCap,
            label: 'Data Siswa',
            shortcut: 'S',
            onSelect: () => navigate('/admin/siswa'),
          },
          {
            icon: BookOpen,
            label: 'Kelola Kelas',
            onSelect: () => navigate('/admin/classes'),
          },
          {
            icon: Building2,
            label: 'Kelola Ruangan',
            onSelect: () => navigate('/admin/rooms'),
          },
          {
            icon: BookMarked,
            label: 'Mata Pelajaran',
            onSelect: () => navigate('/admin/subjects'),
          },
        ],
      });
      baseItems.push({
        group: 'Akademik',
        items: [
          {
            icon: Calendar,
            label: 'Jadwal Pelajaran',
            shortcut: 'J',
            onSelect: () => navigate('/admin/schedules'),
          },
          {
            icon: ClipboardList,
            label: 'Data Jurnal',
            onSelect: () => navigate('/admin/jurnal'),
          },
          {
            icon: UserCheck,
            label: 'Kehadiran Siswa',
            onSelect: () => navigate('/admin/kehadiran'),
          },
          {
            icon: Trophy,
            label: 'Data Prestasi',
            onSelect: () => navigate('/prestasi'),
          },
        ],
      });
      baseItems.push({
        group: 'Sistem',
        items: [
          {
            icon: QrCode,
            label: 'QR Generator',
            shortcut: 'Q',
            onSelect: () => navigate('/admin/qr-generator'),
          },
          {
            icon: ShieldCheck,
            label: 'Log Aktivitas',
            onSelect: () => navigate('/admin/audit-logs'),
          },
          {
            icon: Settings,
            label: 'Pengaturan',
            shortcut: ',',
            onSelect: () => navigate('/admin/settings'),
          },
        ],
      });
    } else if (activeRole === 'siswa') {
      baseItems.push({
        group: 'Akademik Saya',
        items: [
          {
            icon: Calendar,
            label: 'Jadwal Saya',
            onSelect: () => navigate('/jadwal'),
          },
          {
            icon: BookOpen,
            label: 'Materi Mapel',
            onSelect: () => navigate('/siswa/materi'),
          },
          {
            icon: ClipboardList,
            label: 'Tugas',
            onSelect: () => navigate('/siswa/tugas'),
          },
          {
            icon: UserCheck,
            label: 'Kehadiran Saya',
            onSelect: () => navigate('/siswa/kehadiran'),
          },
          {
            icon: Trophy,
            label: 'Prestasi Saya',
            onSelect: () => navigate('/prestasi'),
          },
          {
            icon: FileText,
            label: 'Rapor Saya',
            onSelect: () => navigate('/rapor'),
          },
        ],
      });
    }

    // Add common items for all roles
    baseItems.push({
      group: 'Lainnya',
      items: [
        {
          icon: Megaphone,
          label: 'Pengumuman',
          onSelect: () => navigate('/pengumuman'),
        },
      ],
    });

    return baseItems;
  };

  const menuItems = getMenuItems();

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Cari menu atau tekan shortcut..." />
      <CommandList>
        <CommandEmpty>Tidak ada hasil ditemukan.</CommandEmpty>
        {menuItems.map((section, idx) => (
          <React.Fragment key={section.group}>
            {idx > 0 && <CommandSeparator />}
            <CommandGroup heading={section.group}>
              {section.items.map((item, itemIdx) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={itemIdx}
                    onSelect={() => runCommand(item.onSelect)}
                    className={item.highlight ? 'bg-amber-50 text-amber-900' : ''}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <span className="flex-1">{item.label}</span>
                    {item.shortcut && (
                      <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                        <span className="text-xs">⌘</span>
                        {item.shortcut}
                      </kbd>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </React.Fragment>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
