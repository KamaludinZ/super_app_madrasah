import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserRoundCog, ArrowLeft } from 'lucide-react';
import GuruPenggantiGuard from '@/components/guru-pengganti/GuruPenggantiGuard';
import MonthCalendar from '@/components/guru-pengganti/MonthCalendar';
import { DAY_KEYS, dateBlockReason, toLocalIso } from '@/lib/guruPengganti';
import {
  apiErrorMessage, getActivePeriod, listAssignments, listReplaceableTeachers, listTeacherSlots,
} from '@/lib/guruPenggantiSchedule';
import { DAY_LABELS } from '@/lib/api';
import { toast } from 'sonner';

const MAX_CHIPS = 2;

const firstName = (name = '') => name.split(/[ ,]/)[0];

export default function GuruPenggantiKalenderPage() {
  return (
    <GuruPenggantiGuard>
      <GuruPenggantiKalender />
    </GuruPenggantiGuard>
  );
}

function GuruPenggantiKalender() {
  const [month, setMonth] = useState(() => new Date());
  const [period, setPeriod] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [teacherId, setTeacherId] = useState('all');
  const [assignments, setAssignments] = useState([]);
  const [teacherSlots, setTeacherSlots] = useState([]);

  useEffect(() => {
    getActivePeriod().then(setPeriod).catch(() => {});
    listReplaceableTeachers().then(setTeachers).catch(() => {});
  }, []);

  // Penugasan aktif pada bulan yang ditampilkan (opsional: untuk satu guru, digantikan/pengganti).
  const monthStart = toLocalIso(new Date(month.getFullYear(), month.getMonth(), 1));
  const monthEnd = toLocalIso(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  useEffect(() => {
    let alive = true;
    listAssignments({
      from: monthStart, to: monthEnd, status: 'active',
      ...(teacherId !== 'all' ? { teacher_id: teacherId } : {}),
    })
      .then((list) => { if (alive) setAssignments(list); })
      .catch((e) => { if (alive) toast.error(apiErrorMessage(e, 'Gagal memuat penugasan')); });
    return () => { alive = false; };
  }, [monthStart, monthEnd, teacherId]);

  useEffect(() => {
    if (teacherId === 'all') { setTeacherSlots([]); return; }
    listTeacherSlots(teacherId).then(setTeacherSlots).catch(() => setTeacherSlots([]));
  }, [teacherId]);

  const byDate = useMemo(() => {
    const map = {};
    assignments.forEach((a) => { (map[a.date] = map[a.date] || []).push(a); });
    Object.values(map).forEach((list) => list.sort((x, y) => (x.start_time || '').localeCompare(y.start_time || '')));
    return map;
  }, [assignments]);

  // Hari mengajar guru terpilih → jumlah slot per hari (mis. { senin: 2, rabu: 1 }).
  const slotsPerDay = useMemo(
    () => teacherSlots.reduce((acc, s) => ({ ...acc, [s.day]: (acc[s.day] || 0) + 1 }), {}),
    [teacherSlots],
  );
  const teachingDays = Object.keys(slotsPerDay);
  const isTeachingDay = (date) => !!slotsPerDay[DAY_KEYS[date.getDay()]];

  const getDayClassName = (date) =>
    (isTeachingDay(date) && !dateBlockReason(date, period) ? '!bg-amber-50 !border-amber-300' : '');

  const monthPrefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const monthTotal = Object.entries(byDate)
    .filter(([iso]) => iso.startsWith(monthPrefix))
    .reduce((n, [, list]) => n + list.length, 0);

  const renderDay = (date, iso) => {
    const list = byDate[iso] || [];
    const slots = slotsPerDay[DAY_KEYS[date.getDay()]];
    if (!list.length && !slots) return null;
    return (
      <div className="flex flex-col gap-0.5 min-w-0">
        {slots && (
          <span className="text-[10px] font-medium text-amber-700 truncate">
            <span className="sm:hidden">{slots} slot</span>
            <span className="hidden sm:inline">Mengajar · {slots} slot</span>
          </span>
        )}
        {/* Mobile: cukup titik penanda jumlah */}
        {list.length > 0 && <span className="sm:hidden text-[10px] font-semibold text-[#006837]">{list.length} tugas</span>}
        {list.slice(0, MAX_CHIPS).map((a) => (
          <span
            key={a.id}
            title={`${a.class_name} jam ke-${a.jam_ke}: ${a.original_teacher_name} → ${a.substitute_teacher_name}`}
            className="hidden sm:block truncate rounded bg-[#006837]/10 text-[#006837] px-1 py-0.5 text-[10px] font-medium"
          >
            {a.class_name} · {firstName(a.substitute_teacher_name)}
          </span>
        ))}
        {list.length > MAX_CHIPS && (
          <span className="hidden sm:block text-[10px] text-slate-500">+{list.length - MAX_CHIPS} lagi</span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="guru-pengganti-kalender-page">
      <div>
        <Link to="/guru-pengganti" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-[#006837] mb-3">
          <ArrowLeft className="h-4 w-4" /> Daftar penugasan
        </Link>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2 flex w-fit">
          <UserRoundCog className="h-3 w-3 mr-1" /> Guru Pengganti
        </Badge>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Kalender Guru Pengganti</h1>
            <p className="text-sm text-slate-600 mt-1">{monthTotal} penugasan pada bulan ini</p>
          </div>
          <Select value={teacherId} onValueChange={setTeacherId}>
            <SelectTrigger className="w-full sm:w-64" data-testid="gp-calendar-teacher">
              <SelectValue placeholder="Semua guru" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua guru</SelectItem>
              {teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-3 sm:p-4">
          {teacherId !== 'all' && (
            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600 mb-3" data-testid="gp-teaching-days">
              <span className="inline-block h-3 w-3 rounded border border-amber-300 bg-amber-50" aria-hidden />
              {teachingDays.length ? (
                <span>
                  Hari mengajar:{' '}
                  <span className="font-semibold text-slate-900">
                    {DAY_KEYS.filter((d) => slotsPerDay[d]).map((d) => DAY_LABELS[d]).join(', ')}
                  </span>
                </span>
              ) : (
                <span className="italic">Guru ini belum memiliki jadwal mengajar.</span>
              )}
            </div>
          )}
          <MonthCalendar
            month={month}
            onMonthChange={setMonth}
            renderDay={renderDay}
            getDayClassName={getDayClassName}
            isDayDisabled={(date) => dateBlockReason(date, period)}
            minDate={period?.start_date}
            maxDate={period?.end_date}
          />
          <p className="text-[11px] text-slate-500 mt-3">
            Periode aktif: <span className="font-medium">{period?.name || '-'}</span>. Tanggal yang sudah lewat atau di luar
            periode ditampilkan redup dan tidak dapat ditugasi.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
