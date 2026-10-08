/**
 * Titip / ubah tugas (POST/PUT /teacher-tasks): tanggal (hari ini atau sesudahnya), jadwal mengajar sendiri
 * pada hari tersebut, materi/tugas untuk siswa, jenis izin, catatan untuk guru piket.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { ScheduleItem, TeacherTask } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useAuth } from '@/store/auth';
import { useNetwork } from '@/store/network';
import { DAY_LABELS, dayKeyOf, todayISO } from '@/utils/time';
import { spacing } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { SelectField } from '@/components/ui/SelectField';
import { toast } from '@/components/ui/Toast';
import { IZIN } from './index';

export default function TitipanForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { online } = useNetwork();
  const list = useCached<TeacherTask[]>('titipan.list', () => api.piket.tasks(), { enabled: !!id });
  const editing = id ? (list.data ?? []).find((t) => t.id === id) : undefined;
  // Jadwal per jam (bukan grouped): titipan melekat pada satu slot jadwal seperti di web & pengisian piket.
  const jadwal = useCached<ScheduleItem[]>(`jadwal.raw.${user?.id}`, () => api.schedules.list({ teacher_id: user?.id }), { enabled: !!user?.id, staleTime: 10 * 60_000 });
  const [date, setDate] = useState(todayISO());
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [materi, setMateri] = useState('');
  const [izin, setIzin] = useState<string | null>(null);
  const [catatan, setCatatan] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    setDate(editing.date); setScheduleId(editing.schedule_id); setMateri(editing.task_content);
    setIzin(editing.leave_type ?? null); setCatatan(editing.notes ?? '');
  }, [editing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const hari = dayKeyOf(date);
  const opsi = useMemo(() => (jadwal.data ?? []).filter((s) => (s.day ?? '').toLowerCase() === hari)
    .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))
    .map((s) => ({ value: s.id, label: `${s.start_time}–${s.end_time} · ${s.class_name ?? '-'}`, description: s.subject_name ?? null })), [jadwal.data, hari]);

  useEffect(() => { if (scheduleId && !opsi.some((o) => o.value === scheduleId) && !editing) setScheduleId(null); }, [hari]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    const fail = (m: string) => { setError(m); toast.error(m); };
    if (!scheduleId) return fail('Pilih jadwal yang dititipkan.');
    if (!materi.trim()) return fail('Materi/tugas untuk siswa wajib diisi.');
    setError(null);
    setBusy(true);
    try {
      const body = { schedule_id: scheduleId, date, task_content: materi.trim(), notes: catatan.trim() || null, leave_type: izin };
      if (id) await api.piket.updateTask(id, body); else await api.piket.createTask(body);
      toast.success(id ? 'Titipan diperbarui' : 'Tugas dititipkan', 'Guru piket mendapat notifikasi.');
      await qc.invalidateQueries({ queryKey: ['titipan.list'] });
      router.back();
    } catch (e) {
      fail(errorMessage(e, 'Gagal menyimpan titipan.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={id ? 'Ubah Titipan' : 'Titip Tugas'} back
      footer={<Button title="Simpan titipan" icon="paper-plane-outline" size="lg" fullWidth loading={busy} disabled={!online} onPress={submit} />}>
      <View style={{ gap: spacing.md }}>
        <Card style={{ gap: spacing.md }}>
          <DateField label="Tanggal *" value={date} min={editing ? undefined : todayISO()} onChange={(v) => v && setDate(v)} />
          <SelectField label="Jadwal yang dititipkan *" value={scheduleId} allowNone={false} icon="calendar-outline" options={opsi} onChange={setScheduleId}
            placeholder={jadwal.loading ? 'Memuat jadwal…' : opsi.length ? 'Pilih jam pelajaran' : `Tidak ada jadwal Anda hari ${DAY_LABELS[hari] ?? ''}`} />
          <Input label="Materi / tugas untuk siswa *" value={materi} onChangeText={setMateri} multiline placeholder="mis. Kerjakan LKS hal. 24–25, dikumpulkan ke ketua kelas" />
        </Card>
        <Card style={{ gap: spacing.md }}>
          <SelectField label="Jenis izin" value={izin} options={Object.entries(IZIN).map(([value, label]) => ({ value, label }))} icon="medkit-outline"
            noneLabel="Tidak diisi" onChange={setIzin} />
          <Input label="Catatan untuk guru piket" value={catatan} onChangeText={setCatatan} multiline placeholder="Opsional" />
        </Card>
        {!online ? <Notice tone="warning" icon="cloud-offline-outline" text="Tidak ada koneksi. Menitipkan tugas memerlukan internet." /> : null}
        {error ? <Notice tone="error" icon="alert-circle-outline" text={error} /> : null}
      </View>
    </Screen>
  );
}
