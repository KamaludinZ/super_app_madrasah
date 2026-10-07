import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, Columns2, FileX2, Loader2, User, UserRoundCog } from 'lucide-react';
import { parseLocalIso } from '@/lib/guruPengganti';
import { getSideBySideJournals } from '@/lib/guruPenggantiSchedule';

/**
 * Jurnal berdampingan: catatan guru yang digantikan dan guru pengganti untuk slot & tanggal
 * yang sama ditampilkan berdampingan — keduanya entri terpisah, tidak saling menimpa.
 */
export default function JurnalBerdampinganPage() {
  const { assignmentId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getSideBySideJournals(assignmentId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [assignmentId]);

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Memuat jurnal...</div>;
  }
  if (!data?.assignment) {
    return (
      <div className="text-center py-16 text-slate-500" data-testid="side-by-side-not-found">
        <FileX2 className="h-10 w-10 mx-auto opacity-40 mb-2" />
        Penugasan guru pengganti tidak ditemukan.
      </div>
    );
  }

  const a = data.assignment;
  const dateLabel = parseLocalIso(a.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6" data-testid="jurnal-berdampingan-page">
      <div>
        <Link to="/jurnal/riwayat" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-[#006837] mb-3">
          <ArrowLeft className="h-4 w-4" /> Riwayat jurnal
        </Link>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2 flex w-fit">
          <Columns2 className="h-3 w-3 mr-1" /> Jurnal Berdampingan
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{a.subject_name} · {a.class_name}</h1>
        <p className="text-sm text-slate-600 mt-1">
          {dateLabel} · Jam ke-{a.jam_ke} ({a.start_time}-{a.end_time})
          {a.reason ? ` · Alasan: ${a.reason}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <JournalColumn
          tone="original"
          title="Guru yang Digantikan"
          teacherName={a.original_teacher_name}
          journal={data.original_journal}
          emptyText="Guru yang digantikan belum mengisi jurnal untuk slot ini."
        />
        <JournalColumn
          tone="substitute"
          title="Guru Pengganti"
          teacherName={a.substitute_teacher_name}
          journal={data.substitute_journal}
          emptyText="Guru pengganti belum mengisi jurnal untuk slot ini."
        />
      </div>

      <p className="text-xs text-slate-500">
        Kedua catatan disimpan sebagai entri terpisah pada slot yang sama; pengisian oleh satu guru tidak menimpa catatan guru lainnya.
      </p>
    </div>
  );
}

const TONES = {
  original: { icon: User, head: 'bg-slate-50 border-slate-200', accent: 'text-slate-700' },
  substitute: { icon: UserRoundCog, head: 'bg-amber-50 border-amber-200', accent: 'text-amber-800' },
};

function JournalColumn({ tone, title, teacherName, journal, emptyText }) {
  const t = TONES[tone];
  const Icon = t.icon;
  const total = journal
    ? (journal.siswa_hadir || 0) + (journal.siswa_sakit || 0) + (journal.siswa_izin || 0) + (journal.siswa_tidak_hadir || 0)
    : 0;
  return (
    <Card className="overflow-hidden" data-testid={`side-by-side-${tone}`}>
      <div className={`flex items-center justify-between gap-2 border-b px-4 py-3 ${t.head}`}>
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`h-4 w-4 shrink-0 ${t.accent}`} />
          <div className="min-w-0">
            <div className={`text-xs font-semibold uppercase tracking-wide ${t.accent}`}>{title}</div>
            <div className="text-sm font-semibold text-slate-900 truncate">{teacherName || '-'}</div>
          </div>
        </div>
        {journal ? (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 shrink-0">Terisi</Badge>
        ) : (
          <Badge variant="outline" className="text-slate-500 shrink-0">Belum diisi</Badge>
        )}
      </div>
      <CardContent className="p-4 space-y-3">
        {!journal ? (
          <div className="text-sm text-slate-400 italic py-6 text-center">{emptyText}</div>
        ) : (
          <>
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Clock className="h-3 w-3" />
              Diisi {new Date(journal.started_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              {journal.filled_by_name && <> oleh <span className="font-medium text-slate-700">{journal.filled_by_name}</span></>}
            </div>
            <Field label="Materi" value={journal.materi} />
            <Field label="Catatan" value={journal.catatan} />
            <div>
              <div className="text-xs text-slate-500 mb-1">Kehadiran siswa</div>
              {total === 0 ? (
                <div className="text-sm text-slate-400 italic">Tidak dicatat</div>
              ) : (
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Hadir {journal.siswa_hadir || 0}</Badge>
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200">Sakit {journal.siswa_sakit || 0}</Badge>
                  <Badge className="bg-blue-50 text-blue-700 border-blue-200">Izin {journal.siswa_izin || 0}</Badge>
                  <Badge className="bg-rose-50 text-rose-700 border-rose-200">Alpa {journal.siswa_tidak_hadir || 0}</Badge>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-sm ${value ? 'text-slate-900' : 'text-slate-400 italic'}`}>{value || '-'}</div>
    </div>
  );
}
