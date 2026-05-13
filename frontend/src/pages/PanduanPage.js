import React, { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
  Shield, BookOpen, Users, GraduationCap, ShieldAlert,
  HeartHandshake, Gavel, Sparkles, Briefcase, Mail, Database, Lock,
  ChevronRight, Search, FileText,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/lib/AuthContext';
import { PANDUAN_INDEX, PANDUAN_CONTENT } from '@/lib/panduanContent';

const ICONS = {
  Shield, BookOpen, Users, GraduationCap, ShieldAlert,
  HeartHandshake, Gavel, Sparkles, Briefcase, Mail, Database, Lock, FileText,
};

export default function PanduanPage() {
  const { slug } = useParams();
  const nav = useNavigate();
  const { user, activeRole } = useAuth();
  const [search, setSearch] = useState('');

  // Filter panduan berdasarkan role: admin lihat semua; user lain lihat panduan rolenya + global topics (smtp/backup tidak; tapi keamanan iya)
  const visibleItems = useMemo(() => {
    const isAdmin = (user?.roles || []).includes('admin');
    return PANDUAN_INDEX.filter((p) => {
      if (isAdmin) return true;
      if (!p.role) return true; // null role = visible to all
      return (user?.roles || []).includes(p.role);
    }).filter((p) => !search || p.title.toLowerCase().includes(search.toLowerCase()));
  }, [user, search]);

  const currentSlug = slug || visibleItems[0]?.slug || 'siswa';
  const currentItem = PANDUAN_INDEX.find((p) => p.slug === currentSlug);
  const content = PANDUAN_CONTENT[currentSlug] || '# Panduan tidak ditemukan';

  return (
    <div className="space-y-4" data-testid="panduan-page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-[#006837]" /> Panduan Pengguna
          </h1>
          <p className="text-sm text-slate-500">Pelajari cara menggunakan sistem sesuai peran Anda</p>
        </div>
        <Badge variant="outline" className="hidden sm:flex">Peran aktif: {activeRole}</Badge>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-4">
        {/* Sidebar nav */}
        <Card className="h-fit lg:sticky lg:top-20">
          <CardContent className="p-3">
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari panduan…" className="h-9 pl-8 text-sm"
                data-testid="panduan-search"
              />
            </div>
            <ScrollArea className="max-h-[460px]">
              <div className="flex flex-col gap-0.5">
                {visibleItems.map((p) => {
                  const Icon = ICONS[p.icon] || BookOpen;
                  const active = p.slug === currentSlug;
                  return (
                    <button
                      key={p.slug}
                      onClick={() => nav(`/panduan/${p.slug}`)}
                      data-testid={`panduan-link-${p.slug}`}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                        active
                          ? 'bg-[#006837] text-white'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">{p.title}</span>
                      {active && <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Content */}
        <Card>
          <CardContent className="p-6 lg:p-8">
            <div className="prose prose-slate max-w-none
                            prose-headings:text-[#006837] prose-headings:font-bold
                            prose-h1:text-2xl prose-h1:mb-3 prose-h1:mt-0
                            prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-2
                            prose-h3:text-base prose-h3:mt-4 prose-h3:mb-1.5
                            prose-p:leading-relaxed prose-p:my-2
                            prose-li:my-0.5
                            prose-code:bg-amber-50 prose-code:text-amber-900 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-[''] prose-code:after:content-['']
                            prose-blockquote:border-l-[#006837] prose-blockquote:bg-emerald-50/40 prose-blockquote:py-0.5 prose-blockquote:px-3 prose-blockquote:not-italic
                            prose-a:text-[#006837] prose-a:no-underline hover:prose-a:underline"
                  data-testid="panduan-content">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
