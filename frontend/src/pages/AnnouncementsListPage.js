import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Megaphone, Pin, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import ReactMarkdown from 'react-markdown';

const SEVERITY_STYLES = {
  info: 'bg-sky-50 border-sky-200 text-sky-900',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  warning: 'bg-amber-50 border-amber-200 text-amber-900',
  critical: 'bg-rose-50 border-rose-200 text-rose-900',
};

export default function AnnouncementsListPage() {
  const [anns, setAnns] = useState([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    api.get('/announcements')
      .then(({ data }) => setAnns(data || []))
      .catch(() => setAnns([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4" data-testid="announcements-list-page">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => nav(-1)} aria-label="Kembali">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-[#006837]" /> Pengumuman
          </h1>
          <p className="text-sm text-slate-500">Semua pengumuman aktif</p>
        </div>
      </div>

      {loading ? (
        <Card><CardContent className="py-10 text-center text-slate-500">Memuat…</CardContent></Card>
      ) : anns.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Megaphone className="h-10 w-10 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-600">Belum ada pengumuman.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {anns.map((a) => (
            <Card key={a.id} data-testid={`announcement-${a.id}`}
                  className={`border-l-4 ${SEVERITY_STYLES[a.severity] || SEVERITY_STYLES.info}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {a.is_pinned && <Pin className="h-4 w-4 text-amber-600" />}
                    {a.title}
                  </CardTitle>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className="capitalize">{a.severity}</Badge>
                    {!a.is_read && <Badge className="bg-rose-500 text-white border-0">BARU</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none prose-headings:mt-2 prose-headings:mb-1 prose-p:my-1">
                  <ReactMarkdown>{a.body}</ReactMarkdown>
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                  <span>{new Date(a.created_at).toLocaleString('id-ID')}</span>
                  {a.created_by_name && <span>• oleh {a.created_by_name}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
