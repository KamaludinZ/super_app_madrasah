/**
 * Tugaskan Guru Pengganti — 5 langkah (sama dengan web):
 *  1. Guru digantikan   GET /guru-pengganti/teachers
 *  2. Slot jam & kelas  GET /guru-pengganti/teachers/{id}/slots
 *  3. Tanggal           GET /guru-pengganti/slots/{schedule_id}/dates?month= (multi-pilih, lintas bulan)
 *  4. Guru pengganti    GET /guru-pengganti/substitute-candidates?schedule_id&dates (bentrok ditandai)
 *  5. Simpan            POST /guru-pengganti/assignments (alasan opsional)
 * Tombol kembali Android memundurkan langkah; mengganti pilihan di satu langkah mengosongkan langkah sesudahnya.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { GPCandidate, GPSlot, GPSlotDates, GPTeacher } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useNetwork } from '@/store/network';
import { addMonths, DAY_LABELS, formatDateLong, formatDayShort, monthOf, todayISO } from '@/utils/time';
import { radius, spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Icon, IconName } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Notice';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { MonthCalendar } from '@/components/MonthCalendar';

const MAX_DATES = 62;
const STEPS: { key: string; label: string; hint: string; icon: IconName }[] = [
  { key: 'original', label: 'Guru', hint: 'Pilih guru yang berhalangan hadir.', icon: 'person-remove-outline' },
  { key: 'slot', label: 'Slot', hint: 'Pilih slot jam & kelas yang akan digantikan.', icon: 'time-outline' },
  { key: 'dates', label: 'Tanggal', hint: 'Tandai satu atau beberapa tanggal sesuai hari jadwal.', icon: 'calendar-outline' },
  { key: 'substitute', label: 'Pengganti', hint: 'Pilih guru yang akan mengajar & mengisi jurnal.', icon: 'person-add-outline' },
  { key: 'review', label: 'Simpan', hint: 'Periksa ringkasan lalu simpan penugasan.', icon: 'checkmark-done-outline' },
];

type Draft = {
  original: GPTeacher | null;
  slot: GPSlot | null;
  dates: string[];
  substitute: GPCandidate | null;
  reason: string;
};
const EMPTY: Draft = { original: null, slot: null, dates: [], substitute: null, reason: '' };

export default function TugaskanPenggantiScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { online } = useNetwork();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ dates: string[]; draft: Draft } | null>(null);

  const complete = [!!draft.original, !!draft.slot, draft.dates.length > 0, !!draft.substitute, true];
  const canNext = complete[step];

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (saved || step === 0) return false;
      setStep((s) => s - 1);
      return true;
    });
    return () => sub.remove();
  }, [step, saved]);

  const save = async () => {
    if (!draft.slot || !draft.substitute || !draft.dates.length) return;
    setSaving(true);
    setSaveError(null);
    try {
      const r = await api.gp.assign({
        schedule_id: draft.slot.id,
        dates: [...draft.dates].sort(),
        substitute_teacher_id: draft.substitute.id,
        reason: draft.reason.trim() || null,
      });
      void qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('gp.') });
      toast.success(`${r.count} penugasan tersimpan`, `${draft.substitute.name} menggantikan ${draft.original?.name}`);
      setSaved({ dates: r.created.map((c) => c.date).sort(), draft });
    } catch (e) {
      setSaveError(errorMessage(e, 'Gagal menyimpan penugasan. Periksa koneksi lalu coba lagi.'));
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <Screen title="Penugasan tersimpan" back>
        <SaveSuccess result={saved} onList={() => router.back()} onAgain={() => { setSaved(null); setDraft(EMPTY); setStep(0); }} />
      </Screen>
    );
  }

  const s = STEPS[step];
  return (
    <Screen
      title="Tugaskan Guru Pengganti"
      subtitle={`Langkah ${step + 1} dari ${STEPS.length} · ${s.hint}`}
      back
      footer={(
        <View style={styles.footer}>
          <Button title={step === 0 ? 'Batal' : 'Kembali'} variant="outline" icon="arrow-back" onPress={() => (step === 0 ? router.back() : setStep(step - 1))} style={{ flex: 1 }} />
          {step < STEPS.length - 1 ? (
            <Button title="Lanjut" iconRight="arrow-forward" disabled={!canNext} onPress={() => setStep(step + 1)} style={{ flex: 1.4 }} />
          ) : (
            <Button title="Simpan penugasan" icon="save-outline" loading={saving} disabled={!online || !complete.slice(0, 4).every(Boolean)} onPress={save} style={{ flex: 1.4 }} />
          )}
        </View>
      )}
    >
      <Stepper step={step} complete={complete} onGo={(i) => { if (complete.slice(0, i).every(Boolean)) setStep(i); }} />
      {!online ? <Notice tone="warning" icon="cloud-offline-outline" text="Tidak ada koneksi. Penugasan guru pengganti memerlukan internet." /> : null}
      <View style={{ marginTop: spacing.md }}>
        {step === 0 ? (
          <StepOriginal value={draft.original} onPick={(t) => { setDraft({ ...EMPTY, original: t, reason: draft.reason }); setStep(1); }} />
        ) : step === 1 ? (
          <StepSlot teacher={draft.original!} value={draft.slot} onPick={(sl) => { setDraft({ ...draft, slot: sl, dates: [], substitute: null }); setStep(2); }} />
        ) : step === 2 ? (
          <StepDates slot={draft.slot!} value={draft.dates} onChange={(dates) => setDraft({ ...draft, dates, substitute: null })} />
        ) : step === 3 ? (
          <StepSubstitute slot={draft.slot!} dates={draft.dates} value={draft.substitute} onPick={(c) => { setDraft({ ...draft, substitute: c }); setStep(4); }} />
        ) : (
          <StepReview draft={draft} onReason={(reason) => setDraft({ ...draft, reason })} error={saveError} />
        )}
      </View>
    </Screen>
  );
}

// ---------------------------------------------------------------------------

function Stepper({ step, complete, onGo }: { step: number; complete: boolean[]; onGo: (i: number) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stepper}>
      {STEPS.map((s, i) => {
        const active = i === step;
        const done = i < step && complete[i];
        const bg = active ? colors.brandPrimary : done ? colors.brandTertiary : colors.surfaceTertiary;
        const fg = active ? colors.onBrandPrimary : done ? colors.onBrandTertiary : colors.muted;
        return (
          <Pressable key={s.key} onPress={() => onGo(i)} style={styles.stepItem} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={`Langkah ${i + 1}: ${s.label}`}>
            <View style={[styles.stepCircle, { backgroundColor: bg }]}>
              {done ? <Icon name="checkmark" size={16} color={fg} /> : <T variant="small" weight="bold" color={fg}>{i + 1}</T>}
            </View>
            <T variant="small" weight={active ? 'semibold' : 'medium'} color={active ? colors.brandPrimary : colors.muted} numberOfLines={1}>{s.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

function Choice({ selected, disabled, onPress, children }: { selected?: boolean; disabled?: boolean; onPress?: () => void; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Card onPress={disabled ? undefined : onPress} style={[styles.choice, selected ? { borderColor: colors.brandPrimary, borderWidth: 2 } : null, disabled ? { opacity: 0.55 } : null]}>
      <View style={{ flex: 1, gap: 2 }}>{children}</View>
      {selected ? <Icon name="checkmark-circle" size={22} color={colors.brandPrimary} /> : !disabled ? <Icon name="chevron-forward" size={18} color={colors.muted} /> : null}
    </Card>
  );
}

function StepOriginal({ value, onPick }: { value: GPTeacher | null; onPick: (t: GPTeacher) => void }) {
  const [q, setQ] = useState('');
  const res = useCached<GPTeacher[]>('gp.teachers', () => api.gp.teachers(), { staleTime: 5 * 60_000 });
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (res.data ?? []).filter((t) => !n || `${t.name} ${t.subject} ${t.nip_nuptk ?? ''}`.toLowerCase().includes(n));
  }, [res.data, q]);

  return (
    <View style={{ gap: spacing.sm }}>
      <Input icon="search" placeholder="Cari nama guru, mapel, atau NIP…" value={q} onChangeText={setQ} />
      {res.loading ? <CardSkeleton lines={2} /> : res.error && !res.data ? <ErrorState message="Daftar guru gagal dimuat." onRetry={res.refresh} compact />
        : list.length === 0 ? <Card><EmptyState icon="people-outline" title={q ? 'Tidak ada yang cocok' : 'Belum ada guru berjadwal'} message="Hanya guru yang punya jadwal di semester aktif yang bisa digantikan." compact /></Card>
          : list.map((t) => (
            <Choice key={t.id} selected={value?.id === t.id} onPress={() => onPick(t)}>
              <T weight="semibold">{t.name}</T>
              <T variant="caption" tone="secondary" numberOfLines={1}>{t.subject || 'Mapel belum diatur'}</T>
              <T variant="small" tone="muted">{t.schedule_count} slot · {t.days.map((d) => DAY_LABELS[d] ?? d).join(', ')}</T>
            </Choice>
          ))}
    </View>
  );
}

function StepSlot({ teacher, value, onPick }: { teacher: GPTeacher; value: GPSlot | null; onPick: (s: GPSlot) => void }) {
  const res = useCached<GPSlot[]>(`gp.slots.${teacher.id}`, () => api.gp.teacherSlots(teacher.id));
  const groups = useMemo(() => {
    const m = new Map<string, GPSlot[]>();
    (res.data ?? []).forEach((s) => m.set(s.day, [...(m.get(s.day) ?? []), s]));
    return [...m.entries()];
  }, [res.data]);

  return (
    <View style={{ gap: spacing.sm }}>
      <T tone="secondary">Jadwal <T weight="semibold">{teacher.name}</T> di semester aktif:</T>
      {res.loading ? <CardSkeleton lines={3} /> : res.error && !res.data ? <ErrorState message="Slot jadwal gagal dimuat." onRetry={res.refresh} compact />
        : groups.length === 0 ? <Card><EmptyState icon="calendar-outline" title="Tidak ada slot" message="Guru ini belum punya jadwal terbit di semester aktif." compact /></Card>
          : groups.map(([day, slots]) => (
            <View key={day} style={{ gap: spacing.sm }}>
              <T variant="label" weight="semibold" tone="muted" style={{ marginTop: spacing.sm }}>{(DAY_LABELS[day] ?? day).toUpperCase()}</T>
              {slots.map((s) => (
                <Choice key={s.id} selected={value?.id === s.id} onPress={() => onPick(s)}>
                  <T weight="semibold">{s.start_time}–{s.end_time}{s.jam_ke ? ` · Jam ke ${s.jam_ke}` : ''}</T>
                  <T variant="caption" tone="secondary">{s.class_name} · {s.subject_name}</T>
                  {s.room_name && s.room_name !== '-' ? <T variant="small" tone="muted">Ruang {s.room_name}</T> : null}
                </Choice>
              ))}
            </View>
          ))}
    </View>
  );
}

function StepDates({ slot, value, onChange }: { slot: GPSlot; value: string[]; onChange: (d: string[]) => void }) {
  const { colors } = useTheme();
  const today = todayISO();
  const [month, setMonth] = useState(monthOf(today));
  const res = useCached<GPSlotDates>(`gp.slotDates.${slot.id}.${month}`, () => api.gp.slotDates(slot.id, month), { staleTime: 15_000 });
  const info = useMemo(() => new Map((res.data?.dates ?? []).map((d) => [d.date, d])), [res.data]);
  const period = res.data?.period;
  const selected = new Set(value);
  const eligible = (res.data?.dates ?? []).filter((d) => d.selectable).map((d) => d.date);
  const blocked = (res.data?.dates ?? []).filter((d) => !d.selectable && d.date >= today);
  const allSelected = eligible.length > 0 && eligible.every((d) => selected.has(d));

  const minMonth = monthOf(period?.start_date && period.start_date > today ? period.start_date : today);
  const maxMonth = period?.end_date ? monthOf(period.end_date) : addMonths(monthOf(today), 6);

  const toggle = (iso: string) => {
    const next = new Set(selected);
    if (next.has(iso)) next.delete(iso);
    else {
      if (next.size >= MAX_DATES) { toast.warning(`Maksimal ${MAX_DATES} tanggal per penugasan`); return; }
      next.add(iso);
    }
    onChange([...next].sort());
  };
  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) eligible.forEach((d) => next.delete(d));
    else eligible.forEach((d) => next.add(d));
    if (next.size > MAX_DATES) { toast.warning(`Maksimal ${MAX_DATES} tanggal per penugasan`); return; }
    onChange([...next].sort());
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Card style={{ gap: 2 }}>
        <T weight="semibold">{slot.class_name} · {slot.subject_name}</T>
        <T variant="caption" tone="secondary">Setiap {DAY_LABELS[slot.day] ?? slot.day}, {slot.start_time}–{slot.end_time}{period?.name ? ` · ${period.name}` : ''}</T>
      </Card>

      <Card>
        <MonthCalendar
          month={month}
          onMonthChange={(d) => setMonth(addMonths(month, d))}
          canPrev={month > minMonth}
          canNext={month < maxMonth}
          loading={res.loading || res.refreshing}
          onPressDay={toggle}
          dayProps={(iso) => {
            const d = info.get(iso);
            if (!d) return { disabled: true };
            if (!d.selectable) return { disabled: true, dot: d.assignment ? 'warning' : null, hint: d.reason };
            return { selectable: true, selected: selected.has(iso) };
          }}
        />
        {eligible.length ? (
          <Button title={allSelected ? 'Batalkan semua di bulan ini' : `Pilih semua ${DAY_LABELS[slot.day] ?? ''} di bulan ini`} variant="ghost" size="sm" icon={allSelected ? 'close-circle-outline' : 'checkmark-done-outline'} onPress={toggleAll} />
        ) : null}
      </Card>

      {blocked.length ? (
        <Card style={{ gap: 4 }}>
          <T variant="label" weight="semibold" tone="muted">TIDAK BISA DIPILIH BULAN INI</T>
          {blocked.map((d) => (
            <View key={d.date} style={styles.blockRow}>
              <Icon name={d.assignment ? 'person-outline' : 'close-circle-outline'} size={14} color={d.assignment ? colors.warning : colors.muted} />
              <T variant="caption" tone="secondary" style={{ flex: 1 }}>{formatDayShort(d.date)} — {d.reason}</T>
            </View>
          ))}
        </Card>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <T variant="label" weight="semibold">Tanggal terpilih ({value.length})</T>
        {value.length === 0 ? <T variant="caption" tone="muted">Ketuk tanggal bertepi hijau pada kalender.</T> : (
          <View style={styles.chips}>
            {value.map((d) => (
              <Pressable key={d} onPress={() => toggle(d)} accessibilityRole="button" accessibilityLabel={`Hapus ${formatDateLong(d)}`}
                style={[styles.chip, { backgroundColor: colors.brandTertiary }]}>
                <T variant="small" weight="semibold" color={colors.onBrandTertiary}>{formatDayShort(d)}</T>
                <Icon name="close" size={14} color={colors.onBrandTertiary} />
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function StepSubstitute({ slot, dates, value, onPick }: { slot: GPSlot; dates: string[]; value: GPCandidate | null; onPick: (c: GPCandidate) => void }) {
  const [q, setQ] = useState('');
  const res = useCached<GPCandidate[]>(`gp.candidates.${slot.id}.${dates.join(',')}`, () => api.gp.candidates(slot.id, dates), { staleTime: 15_000 });
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (res.data ?? []).filter((c) => !n || `${c.name} ${c.subject} ${c.nip_nuptk ?? ''}`.toLowerCase().includes(n));
  }, [res.data, q]);
  const available = list.filter((c) => c.available);
  const busy = list.filter((c) => !c.available);

  return (
    <View style={{ gap: spacing.sm }}>
      <T variant="caption" tone="secondary">
        Untuk {slot.class_name}, {slot.start_time}–{slot.end_time} pada {dates.length} tanggal. Guru yang bentrok jadwal tidak bisa dipilih.
      </T>
      <Input icon="search" placeholder="Cari nama guru atau mapel…" value={q} onChangeText={setQ} />
      {res.loading ? <CardSkeleton lines={2} /> : res.error && !res.data ? <ErrorState message="Calon guru pengganti gagal dimuat." onRetry={res.refresh} compact /> : (
        <>
          <T variant="label" weight="semibold" tone="muted" style={{ marginTop: spacing.sm }}>TERSEDIA ({available.length})</T>
          {available.length === 0 ? <Card><EmptyState icon="person-outline" title="Tidak ada guru tersedia" message="Coba kurangi tanggal atau ubah kata kunci." compact /></Card> : available.map((c) => (
            <Choice key={c.id} selected={value?.id === c.id} onPress={() => onPick(c)}>
              <T weight="semibold">{c.name}</T>
              <T variant="caption" tone="secondary" numberOfLines={1}>{c.subject || 'Tidak mengajar mapel di semester ini'}</T>
            </Choice>
          ))}
          {busy.length ? <T variant="label" weight="semibold" tone="muted" style={{ marginTop: spacing.md }}>BENTROK ({busy.length})</T> : null}
          {busy.map((c) => (
            <Choice key={c.id} disabled>
              <T weight="semibold">{c.name}</T>
              <T variant="caption" tone="error" numberOfLines={2}>{c.unavailable}</T>
            </Choice>
          ))}
        </>
      )}
    </View>
  );
}

function StepReview({ draft, onReason, error }: { draft: Draft; onReason: (r: string) => void; error: string | null }) {
  const { colors } = useTheme();
  const { original, slot, dates, substitute } = draft;
  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.people}>
        <Card style={{ flex: 1, gap: 2 }}>
          <T variant="small" tone="muted">Guru digantikan</T>
          <T weight="semibold">{original?.name ?? '-'}</T>
        </Card>
        <Icon name="arrow-forward" size={18} color={colors.muted} />
        <Card style={{ flex: 1, gap: 2, borderColor: colors.brandPrimary, borderWidth: 1.5 }}>
          <T variant="small" color={colors.brandPrimary}>Guru pengganti</T>
          <T weight="semibold">{substitute?.name ?? '-'}</T>
        </Card>
      </View>
      <Card style={{ gap: spacing.sm }}>
        <Row icon="school-outline" text={`${slot?.class_name} · ${slot?.subject_name}`} />
        <Row icon="time-outline" text={`${DAY_LABELS[slot?.day ?? ''] ?? slot?.day}, ${slot?.start_time}–${slot?.end_time}${slot?.jam_ke ? ` · Jam ke ${slot.jam_ke}` : ''}`} />
        <Row icon="calendar-outline" text={`${dates.length} tanggal: ${dates.map(formatDayShort).join(', ')}`} />
      </Card>
      <Input
        label="Alasan (opsional)"
        value={draft.reason}
        onChangeText={(t) => onReason(t.slice(0, 200))}
        placeholder="Mis. sakit, dinas luar, cuti melahirkan"
        hint={`${draft.reason.length}/200 · Tampil di notifikasi & riwayat penugasan.`}
      />
      <Card style={{ gap: 4 }}>
        <Badge label="Setelah disimpan" icon="notifications-outline" tone="brand" small style={{ alignSelf: 'flex-start' }} />
        <T variant="caption" tone="secondary">
          Guru pengganti & guru yang digantikan menerima notifikasi. Slot muncul di jadwal hari itu milik guru pengganti, dan jurnalnya diisi oleh guru pengganti.
        </T>
      </Card>
      {error ? <Notice tone="error" icon="alert-circle-outline" text={error} /> : null}
    </View>
  );
}

function Row({ icon, text }: { icon: IconName; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Icon name={icon} size={16} color={colors.muted} />
      <T tone="secondary" style={{ flex: 1 }}>{text}</T>
    </View>
  );
}

function SaveSuccess({ result, onList, onAgain }: { result: { dates: string[]; draft: Draft }; onList: () => void; onAgain: () => void }) {
  const { colors } = useTheme();
  const { draft, dates } = result;
  return (
    <View style={{ gap: spacing.md }}>
      <Card style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }}>
        <View style={[styles.successIcon, { backgroundColor: colors.brandTertiary }]}>
          <Icon name="checkmark-done" size={36} color={colors.onBrandTertiary} />
        </View>
        <T variant="heading" center>{dates.length} penugasan tersimpan</T>
        <T tone="secondary" center>{draft.substitute?.name} menggantikan {draft.original?.name}</T>
        <T variant="caption" tone="muted" center>{draft.slot?.class_name} · {draft.slot?.subject_name} · {draft.slot?.start_time}–{draft.slot?.end_time}</T>
      </Card>
      <Card style={{ gap: 4 }}>
        {dates.map((d) => <Row key={d} icon="calendar-outline" text={formatDateLong(d)} />)}
      </Card>
      <Button title="Lihat daftar penugasan" icon="list-outline" size="lg" onPress={onList} fullWidth />
      <Button title="Tugaskan lagi" icon="add" variant="outline" onPress={onAgain} fullWidth />
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', gap: spacing.sm },
  stepper: { flexDirection: 'row', justifyContent: 'space-between' },
  stepItem: { flex: 1, alignItems: 'center', gap: 4 },
  stepCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  choice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: 'transparent' },
  blockRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  people: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  successIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
});
