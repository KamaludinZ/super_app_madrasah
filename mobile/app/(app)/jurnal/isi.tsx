/**
 * Isi Jurnal Mengajar. Mode (parameter `mode`):
 *  qr          online setelah scan QR      → POST /jurnal
 *  offline     scan QR saat offline        → antrean → POST /mobile/journals/offline
 *  substitute  slot guru pengganti         → POST /guru-pengganti/journals  (offline: antrean)
 *  original    slot sendiri yang digantikan → POST /guru-pengganti/journals/original (perlu online)
 *  piket       guru piket atas nama guru    → POST /piket/fill-journal (perlu online; opsional task_id titipan)
 *  slot        dari notifikasi pengingat   → diarahkan ke layar Scan
 * Bila jaringan putus saat mengirim, jurnal dialihkan ke antrean offline (selama izin offline ada).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { errorMessage, isNetworkError } from '@/api/client';
import type { PiketSchedule, ScheduleItem, Student } from '@/api/types';
import { CacheKeys, getCache } from '@/db/cache';
import { useCached } from '@/hooks/useCached';
import { useAuth } from '@/store/auth';
import { useNetwork } from '@/store/network';
import { useJournalDraft } from '@/store/journalDraft';
import { computeTimeEvidence, getPermit, StoredPermit, TimeEvidence } from '@/offline/permits';
import { enqueueJournal } from '@/offline/queue';
import { runSync } from '@/offline/sync';
import { cancelFollowUpReminder } from '@/notifications';
import { formatDateLong, todayISO } from '@/utils/time';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { AttendanceList, AttendanceMap, summarize } from '@/components/AttendanceList';

type Mode = 'qr' | 'offline' | 'substitute' | 'original' | 'piket' | 'slot';

const MODE_INFO: Record<Exclude<Mode, 'slot'>, { title: string; badge: string; tone: 'brand' | 'warning' | 'neutral' }> = {
  qr: { title: 'Isi Jurnal', badge: 'QR tervalidasi', tone: 'brand' },
  offline: { title: 'Isi Jurnal (Offline)', badge: 'Disimpan offline', tone: 'warning' },
  substitute: { title: 'Jurnal Guru Pengganti', badge: 'Guru Pengganti', tone: 'warning' },
  original: { title: 'Jurnal Saya (Digantikan)', badge: 'Tanpa QR', tone: 'neutral' },
  piket: { title: 'Isi Jurnal (Guru Piket)', badge: 'Atas nama guru', tone: 'neutral' },
};

export default function IsiJurnalScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const p = useLocalSearchParams<{ mode?: Mode; schedule_id?: string; date?: string; assignment_id?: string; task_id?: string }>();
  const mode: Mode = (p.mode as Mode) || 'qr';
  const scheduleId = p.schedule_id || '';
  const date = p.date || todayISO();
  const { user } = useAuth();
  const { online } = useNetwork();
  const draft = useJournalDraft();

  const [slot, setSlot] = useState<Partial<ScheduleItem> | null>(null);
  const [permit, setPermit] = useState<StoredPermit | null>(draft.permit);
  const [materi, setMateri] = useState('');
  const [catatan, setCatatan] = useState('');
  const [piketNote, setPiketNote] = useState('');
  const [attendance, setAttendance] = useState<AttendanceMap>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Info slot: dari validasi QR, izin offline, atau cache jadwal hari ini.
  useEffect(() => {
    if (!user) return;
    (async () => {
      if (mode === 'piket') {
        // Jadwal semua guru hari ini (layar Tugas Piket) — termasuk nama guru & titipan.
        const list = await getCache<PiketSchedule[]>(CacheKeys.piketToday, user.id);
        const s = list?.data.find((x) => x.id === scheduleId) ?? null;
        setSlot(s ?? { id: scheduleId });
        const task = s?.task && (!p.task_id || s.task.id === p.task_id) ? s.task : null;
        setMateri((m) => m || task?.task_content || '');
        setPiketNote((n) => n || (task ? `Titipan dari ${s?.teacher_name || 'guru pengajar'}` : 'Diisi oleh guru piket'));
        return;
      }
      const fromValidation = draft.validation?.context?.schedule ?? null;
      const today = await getCache<ScheduleItem[]>(CacheKeys.myToday, user.id);
      const fromToday = today?.data.find((s) => s.id === scheduleId && (mode !== 'substitute' || s.is_substitute)) ?? null;
      const pm = draft.permit ?? (scheduleId ? await getPermit(user.id, scheduleId, date) : null);
      setPermit(pm);
      setSlot({ ...(pm ?? {}), ...(fromValidation ?? {}), ...(fromToday ?? {}) } as Partial<ScheduleItem>);
    })().catch(() => {});
  }, [user, scheduleId, date, mode, draft.validation, draft.permit, p.task_id]);

  const classId = (slot?.class_id as string | undefined) || undefined;
  const needsAttendance = mode !== 'original';
  const students = useCached<Student[]>(
    classId ? CacheKeys.students(classId) : 'students.none',
    () => api.students.byClass(classId!),
    { enabled: !!classId && needsAttendance, staleTime: 10 * 60_000 },
  );
  const studentList = useMemo(
    () => [...(students.data ?? [])].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '')),
    [students.data],
  );

  if (mode === 'slot') return <Redirect href={`/scan?schedule_id=${encodeURIComponent(scheduleId)}&date=${date}` as any} />;
  const info = MODE_INFO[mode];

  const records = () => studentList.map((s) => ({ student_id: s.id, student_name: s.full_name, status: attendance[s.id] ?? 'hadir' }));

  /** Simpan ke antrean offline (dikirim otomatis ke /mobile/journals/offline saat online). */
  const enqueue = async (evidence: TimeEvidence | null) => {
    if (!user) return false;
    const pm = permit ?? (scheduleId ? await getPermit(user.id, scheduleId, date) : null);
    if (!pm) {
      setError('Tidak ada koneksi dan izin offline untuk slot ini belum tersimpan. Coba lagi saat online.');
      return false;
    }
    const ev = evidence ?? computeTimeEvidence(pm);
    const loc = draft.location;
    const counts = summarize(studentList, attendance);
    await enqueueJournal(user.id, {
      permit: pm.permit,
      qr_token: draft.qrToken ?? undefined,
      user_lat: loc?.lat ?? null,
      user_lon: loc?.lon ?? null,
      location_accuracy: loc?.accuracy ?? null,
      location_time: loc?.time ?? null,
      ...ev,
      materi: materi.trim(),
      catatan: catatan.trim() || null,
      attendance_details: records(),
    }, {
      schedule_id: pm.schedule_id, date: pm.date, class_name: pm.class_name, subject_name: pm.subject_name,
      room_name: pm.room_name, start_time: pm.start_time, end_time: pm.end_time, is_substitute: pm.is_substitute,
      original_teacher_name: pm.original_teacher_name, attendance_summary: counts,
    });
    if (online) runSync(user.id, { refreshCaches: false }).catch(() => {});
    return true;
  };

  const finish = (msg: string, detail?: string) => {
    toast.success(msg, detail);
    void cancelFollowUpReminder(scheduleId, date);
    qc.invalidateQueries();
    useJournalDraft.getState().reset();
    if (mode === 'piket' && router.canGoBack()) router.back();
    else router.replace('/(app)/(tabs)');
  };

  const submit = async () => {
    if (!materi.trim()) { setError('Materi wajib diisi.'); return; }
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const counts = summarize(studentList, attendance);
      if (mode === 'offline') {
        if (await enqueue(draft.timeEvidence)) finish('Jurnal disimpan di perangkat', 'Akan dikirim otomatis saat online.');
        return;
      }
      if (mode === 'substitute' && !online) {
        if (await enqueue(null)) finish('Jurnal pengganti disimpan di perangkat', 'Akan dikirim otomatis saat online.');
        return;
      }
      if ((mode === 'original' || mode === 'piket') && !online) {
        setError(mode === 'piket' ? 'Jurnal piket perlu koneksi internet. Coba lagi saat online.' : 'Jurnal saat digantikan perlu koneksi internet. Coba lagi saat online.');
        return;
      }
      try {
        if (mode === 'qr') {
          if (!draft.qrToken) { setError('QR belum dipindai. Kembali dan scan ulang.'); return; }
          await api.jurnal.create({
            qr_token: draft.qrToken,
            user_lat: draft.location?.lat ?? null,
            user_lon: draft.location?.lon ?? null,
            materi: materi.trim(),
            catatan: catatan.trim() || null,
            siswa_hadir: counts.hadir,
            siswa_sakit: counts.sakit,
            siswa_izin: counts.izin,
            siswa_tidak_hadir: counts.alpa,
            attendance_details: records().map(({ student_id, status }) => ({ student_id, status })),
          });
        } else if (mode === 'piket') {
          const task = (slot as PiketSchedule | null)?.task;
          await api.piket.fill({
            schedule_id: scheduleId,
            task_id: p.task_id || null,
            materi: materi.trim(),
            catatan: catatan.trim() || null,
            piket_note: piketNote.trim() || null,
            jenis_izin: task?.leave_type || null,
            siswa_hadir: counts.hadir,
            siswa_sakit: counts.sakit,
            siswa_izin: counts.izin,
            siswa_tidak_hadir: counts.alpa,
            attendance_records: records(),
          });
        } else if (mode === 'substitute') {
          await api.gp.fillJournal({ assignment_id: p.assignment_id!, materi: materi.trim(), catatan: catatan.trim() || undefined, attendance_records: records() });
        } else {
          await api.gp.fillOriginal({ assignment_id: p.assignment_id!, materi: materi.trim(), catatan: catatan.trim() || undefined });
        }
        finish('Jurnal tersimpan', `${slot?.class_name ?? ''} · ${slot?.subject_name ?? ''}`);
      } catch (e) {
        // Koneksi putus saat mengirim → alihkan ke antrean offline (QR & guru pengganti).
        if (isNetworkError(e) && mode !== 'original' && mode !== 'piket') {
          const pm = permit ?? (await getPermit(user.id, scheduleId, date));
          if (await enqueue(pm ? computeTimeEvidence(pm) : null)) {
            finish('Koneksi terputus — jurnal disimpan di perangkat', 'Akan dikirim otomatis saat online.');
          }
          return;
        }
        setError(errorMessage(e, 'Gagal menyimpan jurnal.'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title={info.title}
      subtitle={formatDateLong(new Date(`${date}T12:00:00+07:00`))}
      back
      footer={(
        <Button title={mode === 'offline' || (!online && mode === 'substitute') ? 'Simpan offline' : 'Simpan jurnal'} icon="save-outline" size="lg" loading={busy} onPress={submit} fullWidth />
      )}
    >
      <Card style={{ gap: spacing.sm }}>
        {slot ? (
          <>
            <View style={styles.headRow}>
              <T variant="heading" style={{ flex: 1 }} numberOfLines={1}>{slot.class_name || 'Kelas'}</T>
              <Badge label={info.badge} tone={info.tone} small />
            </View>
            <T tone="secondary">{slot.subject_name || '-'}</T>
            <View style={styles.meta}>
              <Icon name="time-outline" size={15} color={colors.muted} />
              <T variant="caption" tone="muted">{slot.start_time}–{slot.end_time}{slot.room_name ? ` · Ruang ${slot.room_name}` : ''}</T>
            </View>
            {mode === 'substitute' && (slot.original_teacher_name || permit?.original_teacher_name) ? (
              <T variant="caption" tone="secondary">Menggantikan {slot.original_teacher_name || permit?.original_teacher_name}</T>
            ) : null}
            {mode === 'piket' ? (
              <T variant="caption" tone="secondary">
                Atas nama {(slot as PiketSchedule).teacher_name || 'guru pengajar'}. Jurnal tercatat diisi oleh guru piket.
              </T>
            ) : null}
            {mode === 'original' ? (
              <T variant="caption" tone="secondary">
                Slot ini sedang diampu {slot.substitute?.substitute_teacher_name || 'guru pengganti'}. Catatan Anda (mis. materi/tugas yang dititipkan) disimpan berdampingan; absensi dicatat guru pengganti.
              </T>
            ) : null}
            {mode === 'offline' || (!online && mode === 'substitute') ? (
              <T variant="caption" tone="secondary">
                Waktu pengisian dicatat dari jam perangkat yang tervalidasi server, sehingga jurnal tetap tercatat sesuai jam mengajar walau baru terkirim nanti.
              </T>
            ) : null}
          </>
        ) : <CardSkeleton lines={2} />}
      </Card>

      <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
        <Input label="Materi yang disampaikan *" value={materi} onChangeText={setMateri} multiline placeholder="Mis. Bab 3: Sistem Pencernaan — diskusi & latihan soal" />
        <Input label="Catatan (opsional)" value={catatan} onChangeText={setCatatan} multiline placeholder="Mis. tugas rumah, kendala kelas, siswa perlu perhatian" />
        {mode === 'piket' ? (
          <Input label="Keterangan piket" value={piketNote} onChangeText={setPiketNote} placeholder="Mis. Titipan dari guru pengajar" />
        ) : null}
      </View>

      {needsAttendance ? (
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <T variant="subtitle">Absensi siswa</T>
          {!classId || students.loading ? <CardSkeleton lines={4} />
            : studentList.length === 0 ? (
              <Card><EmptyState icon="people-outline" title="Daftar siswa belum tersedia" message={online ? 'Kelas ini belum memiliki siswa terdaftar.' : 'Daftar siswa kelas ini belum pernah tersimpan di perangkat. Jurnal tetap bisa disimpan tanpa absensi rinci.'} compact /></Card>
            ) : <AttendanceList students={studentList} value={attendance} onChange={setAttendance} />}
        </View>
      ) : null}

      {error ? (
        <Card tone="error" style={[styles.errorCard, { marginTop: spacing.lg }]}>
          <Icon name="alert-circle-outline" size={18} color={colors.error} />
          <T variant="caption" tone="error" style={{ flex: 1 }}>{error}</T>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  errorCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
});
