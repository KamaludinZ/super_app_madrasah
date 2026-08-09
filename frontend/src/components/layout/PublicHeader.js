import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, TrendingUp, Calendar, DollarSign, LogIn, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState, useMemo } from 'react';
import { usePublicPagesVisibility } from '@/hooks/usePublicPagesVisibility';

export default function PublicHeader({ settings }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { visibility, loading } = usePublicPagesVisibility();

  // Check if user is logged in by checking for token
  const isLoggedIn = !!localStorage.getItem('matsa_token');

  const allNavLinks = [
    {
      to: '/public/monitoring',
      icon: Activity,
      label: 'Monitoring Jurnal',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      hoverColor: 'hover:bg-blue-100',
      visibilityKey: 'monitoring_visibility'
    },
    {
      to: '/public/prestasi',
      icon: TrendingUp,
      label: 'Prestasi',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      hoverColor: 'hover:bg-amber-100',
      visibilityKey: 'prestasi_visibility'
    },
    {
      to: '/public/agenda',
      icon: Calendar,
      label: 'Agenda',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      hoverColor: 'hover:bg-purple-100',
      visibilityKey: 'agenda_visibility'
    },
    {
      to: '/public/rkam',
      icon: DollarSign,
      label: 'RKAM',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      hoverColor: 'hover:bg-emerald-100',
      visibilityKey: 'rkam_visibility'
    }
  ];

  // Filter nav links based on visibility settings
  const navLinks = useMemo(() => {
    if (loading) return allNavLinks; // Show all while loading to prevent flash

    return allNavLinks.filter(link => {
      const visibilitySetting = visibility[link.visibilityKey];

      // Hidden: never show
      if (visibilitySetting === 'hidden') return false;

      // Dashboard only: only show if logged in
      if (visibilitySetting === 'dashboard') return isLoggedIn;

      // Public: always show
      return true;
    });
  }, [visibility, loading, isLoggedIn]);

  const isActive = (path) => location.pathname === path;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-3">
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-10 w-10 object-contain" />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#006837] to-[#0B7A3B] flex items-center justify-center text-white font-bold text-sm">
                MS
              </div>
            )}
            <div className="hidden sm:block">
              <div className="text-xs text-slate-500">Layanan Publik</div>
              <div className="font-bold text-[#006837] text-sm">
                {settings?.school_name || 'MATSANDATAMA'}
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    active
                      ? `${link.bgColor} ${link.color} font-semibold`
                      : `text-slate-600 hover:bg-slate-50`
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-sm">{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button size="sm" className="bg-[#006837] hover:bg-[#0B7A3B] hidden sm:flex">
                <LogIn className="h-4 w-4 mr-2" />
                Masuk
              </Button>
              <Button size="sm" className="bg-[#006837] hover:bg-[#0B7A3B] sm:hidden">
                <LogIn className="h-4 w-4" />
              </Button>
            </Link>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden pb-4 space-y-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    active
                      ? `${link.bgColor} ${link.color} font-semibold`
                      : `text-slate-600 hover:bg-slate-50`
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}
