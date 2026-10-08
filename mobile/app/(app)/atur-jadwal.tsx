/**
 * Atur Jadwal Saya (guru / wali kelas) — native, pengganti /jadwal/atur. Jadwal mengajar sendiri (wali kelas:
 * jadwal kelas walinya) per hari dengan status (draft → dikirim → disetujui → terkunci). Tambah/ubah draft:
 * hari, kelas, mapel, jam pelajaran (multi-jam dari pengaturan teaching_slots; istirahat tidak bisa dipilih),
 * ruang otomatis mengikuti kelas & bentrok diperiksa server (409). Hapus draft, kirim satu/semua draft ke admin.
 */
import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { ApiError, errorMessage } from '@/api/client';
import type { ClassItem, ScheduleItem, SubjectItem, TeachingSlot } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useAuth } from '@/store/auth';
import { useNetwork } from '@/store/network';
import { DAY_LABELS } from '@/utils/time';
import { radius, spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { SelectField } from '@/components/ui/SelectField';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';

const DAYS = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Draft', tone: 'neutral' }, submitted: { label: 'Dikirim', tone: 'warning' },
  approved: { label: 'Disetujui', tone: 'success' }, locked: { label: 'Terkunci', tone: 'brand' },
};
type Form = { id: string | null; day: string; class_id: string | null; subject_id: string | null; slots: number[] };

export default function AturJadwal() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user, activeRole } = useAuth();
  const { online } = useNetwork();
  const waliView = activeRole === 'wali_kelas' && !!user?.homeroom_class_id;
  const q = waliView ? { class_id: user!.homeroom_class_id! } : { teacher_id: user?.id };
  const key = `atur-jadwal.${waliView ? `c.${q.class_id}` : `t.${user?.id}`}`;
  const res = useCached<ScheduleItem[]>(key, () => api.schedules.grouped(q), { enabled: !!user?.id });
  const kelas = useCached<ClassItem[]>('kebersihan.classes.all', async () => {
    const ay = await api.kebersihan.activeYear().catch(() => null);
    return api.kebersihan.classes(ay?.id);
  }, { staleTime: 30 * 60_000 });
  const mapel = useCached<SubjectItem[]>('akademik.subjects', api.kelas.subjects, { staleTime: 60 * 60_000 });
  const slotsRes = useCached<{ teaching_slots?: TeachingSlot[] | Record<string, TeachingSlot[]> }>('settings.slots', api.schedules.teachingSlots, { staleTime: 60 * 60_000 });
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  const slotsHari = (day: string): TeachingSlot[] => {
    const ts = slotsRes.data?.teaching_slots;
    return Array.isArray(ts) ? ts : (ts?.[day] ?? []);
  };
  const byDay = useMemo(() => {
    const m = new Map<string, ScheduleItem[]>();
    (res.data ?? []).forEach((s) => { const d = (s.day ?? '').toLowerCase(); m.set(d, [...(m.get(d) ?? []), s]); });
    m.forEach((l) => l.sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? '')));
    return m;
  }, [res.data]);
  const drafts = (res.data ?? []).filter((s) => (s.status ?? 'draft') === 'draft' && (!waliView || s.teacher_id === user?.id));
  const invalidate = () => qc.invalidateQueries({ predicate: (x) => /^(atur-jadwal|jadwal)\./.test(String(x.queryKey[0])) });

  const kelasOpts = [...(kelas.data ?? [])].filter((c) => !waliView || c.id === user?.homeroom_class_id).sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.id, label: c.name }));
  const mapelOpts = [...(mapel.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)).map((m) => ({ value: m.id, label: m.name, description: m.code ?? null }));

  const buka = (s?: ScheduleItem) => {
    if (s && (s.status === 'submitted' || s.status === 'locked' || s.status === 'approved')) { toast.error('Hanya jadwal draft yang bisa diubah'); return; }
    setForm({ id: s?.id ?? null, day: (s?.day ?? 'senin').toLowerCase(), class_id: s?.class_id ?? (waliView ? user!.homeroom_class_id! : null), subject_id: s?.subject_id ?? null, slots: s?.slot_indexes ?? [] });
  };

  const simpan = async () => {
    if (!form) return;
    if (!form.class_id || !form.subject_id) { toast.error('Kelas dan mapel wajib dipilih'); return; }
    if (!form.slots.length) { toast.error('Pilih minimal 1 jam mengajar'); return; }
    const daySlots = slotsHari(form.day);
    const idx = [...form.slots].sort((a, b) => a - b);
    setBusy(true);
    try {
      await api.schedules.save(form.id, {
        day: form.day, class_id: form.class_id, subject_id: form.subject_id, teacher_id: user!.id, slot_indexes: idx,
        start_time: daySlots[idx[0]]?.start_time, end_time: daySlots[idx[idx.length - 1]]?.end_time,
        semester: new Date().getMonth() >= 6 ? 'ganjil' : 'genap',
      });
      toast.success('Jadwal disimpan sebagai draft');
      setForm(null);
      await invalidate();
    } catch (e) {
      const d = e instanceof ApiError && e.status === 409 && typeof e.detail === 'object' ? (e.detail as { message?: string }).message : null;
      toast.error(d ?? errorMessage(e, 'Gagal menyimpan jadwal.'));
    } finally { setBusy(false); }
  };

  const hapus = (s: ScheduleItem) => Alert.alert('Hapus jadwal?', `${s.subject_name ?? ''} · ${s.class_name ?? ''}`, [
    { text: 'Batal', style: 'cancel' },
    { text: 'Hapus', style: 'destructive', onPress: async () => { try { await api.schedules.remove(s.id); toast.success('Dihapus'); await invalidate(); } catch (e) { toast.error(errorMessage(e, 'Gagal menghapus.')); } } },
  ]);
  const kirim = (list: ScheduleItem[]) => Alert.alert(list.length > 1 ? `Kirim ${list.length} draft ke admin?` : 'Kirim jadwal ke admin?', 'Setelah dikirim jadwal tidak bisa diubah lagi.', [
    { text: 'Batal', style: 'cancel' },
    {
      text: 'Kirim', onPress: async () => {
        let ok = 0;
        for (const s of list) { try { await api.schedules.submit(s.id); ok += 1; } catch { /* lanjut */ } }
        if (ok === list.length) toast.success(`${ok} jadwal terkirim ke admin`); else toast.error(`${ok}/${list.length} jadwal terkirim`, 'Sebagian gagal, coba lagi.');
        await invalidate();
      },
    },
  ]);

  return (
    <Screen title="Atur Jadwal Saya" subtitle={waliView ? 'Jadwal kelas wali' : 'Jadwal mengajar · ajukan ke admin'} back
      refreshing={res.refreshing} onRefresh={res.refresh} offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}
      footer={(
        <View style={styles.footer}>
          {drafts.length ? <Button title={`Kirim ${drafts.length} draft`} icon="paper-plane-outline" variant="outline" disabled={!online} onPress={() => kirim(drafts)} style={{ flex: 1 }} /> : null}
          <Button title="Tambah jadwal" icon="add-circle-outline" disabled={!online} onPress={() => buka()} style={{ flex: 1 }} />
        </View>
      )}>
      <View style={{ gap: spacing.md }}>
        <Notice tone="success" icon="information-circle-outline" text="Jadwal baru tersimpan sebagai draft. Kirim ke admin untuk disetujui; jadwal yang dikirim atau disetujui tidak bisa diubah dari sini." />
        {res.loading ? <CardSkeleton lines={5} /> : (res.data ?? []).length === 0 ? (
          <Card><EmptyState icon="calendar-outline" title="Belum ada jadwal" message="Tambahkan jam mengajar Anda per hari, lalu kirim ke admin." compact /></Card>
        ) : DAYS.filter((d) => byDay.get(d)?.length).map((d) => (
          <Card key={d} style={{ gap: spacing.sm }}>
            <T variant="label" weight="semibold" tone="secondary">{DAY_LABELS[d]}</T>
            {byDay.get(d)!.map((s, i) => {
              const st = STATUS[s.status ?? 'draft'] ?? STATUS.draft;
              const draft = (s.status ?? 'draft') === 'draft' && s.teacher_id === user?.id;
              return (
                <View key={s.id} style={[styles.item, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider }]}>
                  <View style={styles.row}>
                    <T weight="bold" style={{ width: 92 }}>{s.start_time}–{s.end_time}</T>
                    <View style={{ flex: 1 }}>
                      <T weight="medium" numberOfLines={1}>{s.subject_name ?? '-'}</T>
                      <T variant="caption" tone="muted" numberOfLines={1}>{waliView ? s.teacher_name ?? '-' : `Kelas ${s.class_name ?? '-'}`}{s.room_name ? ` · ${s.room_name}` : ''}</T>
                    </View>
                    <Badge label={st.label} tone={st.tone} small />
                  </View>
                  {draft ? (
                    <View style={styles.row}>
                      <View style={{ flex: 1 }} />
                      <Button title="Ubah" icon="create-outline" variant="ghost" size="sm" disabled={!online} onPress={() => buka(s)} />
                      <Button title="Hapus" icon="trash-outline" variant="ghost" size="sm" disabled={!online} onPress={() => hapus(s)} />
                      <Button title="Kirim" icon="paper-plane-outline" variant="ghost" size="sm" disabled={!online} onPress={() => kirim([s])} />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </Card>
        ))}
      </View>

      <Modal visible={!!form} transparent animationType="slide" onRequestClose={() => setForm(null)}>
        <Pressable style={styles.backdrop} onPress={() => setForm(null)} accessibilityLabel="Tutup" />
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.md }]}>
          <ScrollView contentContainerStyle={{ gap: spacing.md }} keyboardShouldPersistTaps="handled">
            <T variant="subtitle">{form?.id ? 'Ubah jadwal (draft)' : 'Tambah jadwal'}</T>
            {form ? (
              <>
                <SelectField label="Hari" value={form.day} options={DAYS.map((d) => ({ value: d, label: DAY_LABELS[d] }))} allowNone={false} icon="today-outline"
                  onChange={(v) => v && setForm({ ...form, day: v, slots: [] })} />
                <SelectField label="Kelas *" value={form.class_id} options={kelasOpts} allowNone={false} icon="school-outline" onChange={(v) => setForm({ ...form, class_id: v })} />
                <SelectField label="Mata pelajaran *" value={form.subject_id} options={mapelOpts} allowNone={false} icon="book-outline" onChange={(v) => setForm({ ...form, subject_id: v })} />
                <T variant="label" tone="secondary">Jam mengajar * (boleh lebih dari satu)</T>
                {slotsRes.loading ? <CardSkeleton lines={2} /> : slotsHari(form.day).length === 0 ? (
                  <T variant="caption" tone="muted">Jam pelajaran hari ini belum diatur admin.</T>
                ) : (
                  <View style={styles.slots}>
                    {slotsHari(form.day).map((sl, i) => {
                      const on = form.slots.includes(i);
                      return (
                        <Pressable key={i} disabled={sl.is_break} onPress={() => setForm({ ...form, slots: on ? form.slots.filter((x) => x !== i) : [...form.slots, i] })}
                          accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: !!sl.is_break }}
                          style={[styles.slot, { borderColor: on ? colors.brandPrimary : colors.border, backgroundColor: on ? colors.brandPrimary : sl.is_break ? colors.surfaceSecondary : colors.surface, opacity: sl.is_break ? 0.6 : 1 }]}>
                          <T variant="small" weight="semibold" color={on ? colors.onBrandPrimary : undefined}>{sl.name || (sl.is_break ? 'Istirahat' : `Jam ke-${i + 1}`)}</T>
                          <T variant="small" color={on ? colors.onBrandPrimary : colors.muted}>{sl.start_time}–{sl.end_time}</T>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
                <Button title="Simpan draft" icon="save-outline" loading={busy} disabled={!online} onPress={simpan} />
              </>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  item: { gap: 4, paddingTop: spacing.sm },
  footer: { flexDirection: 'row', gap: spacing.sm },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { maxHeight: '88%', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slot: { width: '31%', flexGrow: 1, borderWidth: 1.5, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center', gap: 2 },
});
