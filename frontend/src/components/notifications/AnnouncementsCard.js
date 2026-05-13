import React, { useEffect, useState } from 'react';
import { Megaphone, Pin, ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';

const SEVERITY_STYLES = {
  info: 'bg-sky-50 border-sky-200 text-sky-900',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  warning: 'bg-amber-50 border-amber-200 text-amber-900',
  critical: 'bg-rose-50 border-rose-200 text-rose-900',
};

function relativeDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return iso; }
}

/**
 * Card pengumuman yang ditampilkan di dashboard non-admin (Guru/Siswa/Wali Kelas/dll).
 * Max 3 pengumuman, dengan tombol "Lihat semua".
 */
export default function AnnouncementsCard() {
  const [anns, setAnns] = useState([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    api.get('/announcements')
      .then(({ data }) => setAnns(data || []))
      .catch(() => setAnns([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!anns.length) return null;

  const top = anns.slice(0, 3);

  return (
    <Card data-testid="announcements-card" className="border-[#006837]/15 shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-5 w-5 text-[#006837]" />
            Pengumuman
          </CardTitle>
          <p className="text-xs text-slate-500 mt-0.5">{anns.length} pengumuman aktif</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => nav('/pengumuman')} className="h-8 text-xs" data-testid="btn-all-announcements">
          Lihat semua <ChevronRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {top.map((a) => (
          <div key={a.id} data-testid={`announcement-${a.id}`}
               className={`rounded-lg border px-3.5 py-3 ${SEVERITY_STYLES[a.severity] || SEVERITY_STYLES.info}`}>
            <div className="flex items-start gap-2">
              {a.is_pinned && <Pin className="h-3.5 w-3.5 mt-1 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm">{a.title}</p>
                  <Badge variant="outline" className="text-[10px] py-0 px-1 bg-white/60 capitalize">{a.severity}</Badge>
                  {!a.is_read && <Badge className="text-[9px] py-0 px-1 bg-rose-500 text-white border-0">BARU</Badge>}
                </div>
                <div className="text-xs text-slate-700 mt-1 prose prose-sm max-w-none prose-p:my-0.5 prose-headings:my-1">
                  <ReactMarkdown>{a.body}</ReactMarkdown>
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500">
                  <span>{relativeDate(a.created_at)}</span>
                  {a.created_by_name && <span>• oleh {a.created_by_name}</span>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
