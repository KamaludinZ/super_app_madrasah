import React, { useEffect, useState } from 'react';
import { History, Calendar, Clock, BookOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

export default function JurnalHistoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get('/jurnal/my').then(({ data }) => setItems(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">Riwayat Jurnal</Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Jurnal Mengajar Saya</h1>
        <p className="text-sm text-slate-600 mt-1">Total: <span className="font-semibold">{items.length}</span> entri</p>
      </div>
      {loading ? (
        <div className="text-sm text-slate-500">Memuat...</div>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-slate-500">
          <History className="h-10 w-10 mx-auto opacity-40 mb-2" />
          <div>Belum ada riwayat jurnal</div>
        </CardContent></Card>
      ) : (
        <div className="space-y-2" data-testid="jurnal-history-list">
          {items.map((j) => (
            <Card key={j.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2 flex-wrap gap-2">
                  <div>
                    <div className="font-semibold text-slate-900">{j.subject_name} — {j.class_name}</div>
                    <div className="text-xs text-slate-600 flex items-center gap-2 mt-0.5">
                      <Clock className="h-3 w-3" /> {new Date(j.started_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                      <span>•</span>
                      <span>{j.room_name}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">{j.qr_mode || 'static'}</Badge>
                </div>
                <div className="text-sm text-slate-800"><span className="font-semibold">Materi: </span>{j.materi}</div>
                {j.catatan && <div className="text-xs text-slate-600 mt-1">{j.catatan}</div>}
                <div className="flex gap-2 mt-3 text-xs">
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-2 py-0.5">Hadir: {j.siswa_hadir}</span>
                  <span className="bg-amber-50 text-amber-700 border border-amber-200 rounded px-2 py-0.5">Sakit: {j.siswa_sakit}</span>
                  <span className="bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-0.5">Izin: {j.siswa_izin}</span>
                  <span className="bg-rose-50 text-rose-700 border border-rose-200 rounded px-2 py-0.5">Alpa: {j.siswa_tidak_hadir}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
