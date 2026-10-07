/**
 * Beranda.
 *  - Guru (dan siapa pun yang punya jadwal/slot pengganti hari ini): ringkasan & daftar slot hari ini
 *    (GET /schedules/my-today?include_substitute=true) dengan aksi sesuai jenis slot:
 *      slot sendiri           → Scan QR & isi jurnal (online/offline)
 *      slot sendiri digantikan → Isi jurnal saya tanpa QR (mode original)
 *      slot guru pengganti    → Isi jurnal pengganti (mode substitute)
 *  - Guru piket / admin: kartu Tugas Piket (slot hari ini tanpa jurnal & titipan menunggu) → /piket.
 *  - Semua peran: pintasan menu peran (sama dengan menu web) & pengumuman terbaru.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '@/api/endpoints';
import type { Announcement, PiketSchedule, ScheduleItem, TeacherTask } from '@/api/types';
import { CacheKeys } from '@/db/cache';
import { useCached } from '@/hooks/useCached';
import { useAuth } from '@/store/auth';
import { usePrefs } from '@/store/prefs';
import { listQueue } from '@/offline/queue';
import { radius, spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Icon, IconName } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { SlotCard, SlotAction } from '@/components/SlotCard';
import { formatDateLong, formatRelative, greeting, slotStatus, todayISO } from '@/utils/time';
import { canPiket, canScan, homeKind, roleLabel } from '@/utils/roles';
import { quickItems, useRoleMenu } from '@/menu';

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, activeRole } = useAuth();
  const kind = homeKind(activeRole);
  const pendingCount = usePrefs((s) => s.pendingCount);
  const failedCount = usePrefs((s) => s.failedCount);

  const today = useCached<ScheduleItem[]>(CacheKeys.myToday, api.schedules.myToday, { enabled: kind !== 'siswa' });
  const ann = useCached<Announcement[]>(CacheKeys.announcements, api.announcements.list);
  const menu = useRoleMenu();
  const shortcuts = quickItems(menu, 8);
  const piketOn = canPiket(activeRole, user?.roles);
  const piket = useCached<PiketSchedule[]>(CacheKeys.piketToday, api.piket.today, { enabled: piketOn });
  const piketTasks = useCached<TeacherTask[]>(`piket.tasks.${todayISO()}`, () => api.piket.tasks({ date: todayISO() }), { enabled: piketOn });

  // Slot yang jurnalnya masih di antrean offline (agar tidak tampil "belum diisi").
  const [queued, setQueued] = useState<Set<string>>(new Set());
  useFocusEffect(useCallback(() => {
    if (!user?.id) return;
    listQueue(user.id).then((items) => setQueued(new Set(
      items.filter((q) => q.status !== 'synced').map((q) => `${q.meta.schedule_id}|${q.meta.date}`),
    ))).catch(() => {});
  }, [user?.id, pendingCount]));

  const date = todayISO();
  const slots = useMemo(
    () => [...(today.data ?? [])].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')),
    [today.data],
  );
  const filled = slots.filter((s) => s.journal_filled).length;
  const isQueued = (s: ScheduleItem) => queued.has(`${s.id}|${s.date ?? date}`);
  const missing = slots.filter((s) => !s.journal_filled && !isQueued(s) && slotStatus(s.start_time, s.end_time) !== 'upcoming').length;

  const actionFor = (s: ScheduleItem): SlotAction | null => {
    const q = (p: Record<string, string | undefined | null>) =>
      Object.entries(p).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
    if (s.is_substitute && s.assignment_id) {
      return {
        label: 'Isi jurnal pengganti', icon: 'create-outline',
        onPress: () => router.push(`/jurnal/isi?${q({ mode: 'substitute', assignment_id: s.assignment_id, schedule_id: s.id, date: s.date ?? date })}` as any),
      };
    }
    if (s.substitute?.assignment_id) {
      return {
        label: 'Isi jurnal saya (tanpa QR)', icon: 'create-outline', variant: 'outline',
        onPress: () => router.push(`/jurnal/isi?${q({ mode: 'original', assignment_id: s.substitute!.assignment_id, schedule_id: s.id, date })}` as any),
      };
    }
    if (canScan(activeRole) || kind === 'guru') {
      return {
        label: 'Scan QR & isi jurnal', icon: 'qr-code-outline',
        onPress: () => router.push(`/scan?${q({ schedule_id: s.id, date })}` as any),
      };
    }
    return null;
  };

  const refreshing = today.refreshing || ann.refreshing || piket.refreshing;
  const onRefresh = () => {
    void today.refresh(); void ann.refresh();
    if (piketOn) { void piket.refresh(); void piketTasks.refresh(); }
  };
  const piketMissing = (piket.data ?? []).filter((x) => !x.has_journal && slotStatus(x.start_time, x.end_time) !== 'upcoming').length;
  const piketPendingTasks = (piketTasks.data ?? []).filter((t) => t.status === 'pending' || t.status === 'accepted').length;
  const latestAnn = (ann.data ?? []).slice(0, 3);
  const showSchedule = kind !== 'siswa' && (kind === 'guru' || slots.length > 0);

  return (
    <Screen
      headerTone="brand"
      title={`${greeting()}, ${firstName(user?.full_name || user?.username)}`}
      subtitle={`${formatDateLong(Date.now())} · ${roleLabel(activeRole)}`}
      refreshing={refreshing}
      onRefresh={onRefresh}
      offline={{ fromCache: today.fromCache || ann.fromCache, updatedAt: today.updatedAt ?? ann.updatedAt }}
    >
      {pendingCount + failedCount > 0 ? (
        <Card tone={failedCount ? 'error' : 'warning'} onPress={() => router.push('/antrean')} style={styles.queueCard}>
          <Icon name={failedCount ? 'alert-circle' : 'cloud-upload-outline'} size={22} color={failedCount ? colors.error : colors.onWarning} />
          <View style={{ flex: 1 }}>
            <T weight="semibold" color={failedCount ? colors.error : colors.onWarning}>
              {failedCount ? `${failedCount} jurnal gagal dikirim` : `${pendingCount} jurnal menunggu dikirim`}
            </T>
            <T variant="caption" color={failedCount ? colors.error : colors.onWarning}>
              {failedCount ? 'Ketuk untuk melihat alasannya.' : 'Akan terkirim otomatis saat online.'}
            </T>
          </View>
          <Icon name="chevron-forward" size={18} color={colors.muted} />
        </Card>
      ) : null}

      {piketOn ? (
        <Card onPress={() => router.push('/piket' as any)} style={[styles.piketCard, { borderColor: colors.brandPrimary }]}>
          <View style={[styles.piketIcon, { backgroundColor: colors.brandTertiary }]}>
            <Icon name="shield-checkmark-outline" size={24} color={colors.onBrandTertiary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T weight="semibold">Tugas Piket hari ini</T>
            <T variant="caption" tone="secondary">
              {piket.loading ? 'Memuat…' : `${piketMissing} slot belum berjurnal · ${piketPendingTasks} titipan`}
            </T>
          </View>
          {piketMissing + piketPendingTasks > 0 ? <Badge label={String(piketMissing + piketPendingTasks)} tone="error" small /> : null}
          <Icon name="chevron-forward" size={18} color={colors.muted} />
        </Card>
      ) : null}

      {showSchedule ? (
        <>
          <View style={styles.stats}>
            <Stat label="Jadwal" value={slots.length} icon="calendar-outline" />
            <Stat label="Terisi" value={filled} icon="checkmark-done-outline" tone="success" />
            <Stat label="Belum" value={missing} icon="alert-circle-outline" tone={missing ? 'error' : 'neutral'} />
          </View>

          <View style={styles.sectionHead}>
            <T variant="subtitle">Jadwal hari ini</T>
            <T variant="caption" tone="muted">{slots.length ? `${slots.length} slot` : ''}</T>
          </View>

          {today.loading ? (
            <View style={{ gap: spacing.md }}><CardSkeleton lines={3} /><CardSkeleton lines={3} /></View>
          ) : today.error && !today.data ? (
            <ErrorState message="Jadwal belum pernah tersimpan di perangkat. Sambungkan ke internet lalu tarik untuk menyegarkan." onRetry={today.refresh} compact />
          ) : slots.length === 0 ? (
            <Card><EmptyState icon="cafe-outline" title="Tidak ada jadwal mengajar hari ini" message="Slot guru pengganti yang ditugaskan kepada Anda juga akan muncul di sini." compact /></Card>
          ) : (
            <View style={{ gap: spacing.md }}>
              {slots.map((s) => (
                <SlotCard
                  key={`${s.id}-${s.assignment_id ?? ''}`}
                  slot={s}
                  status={slotStatus(s.start_time, s.end_time)}
                  queued={isQueued(s)}
                  action={actionFor(s)}
                />
              ))}
            </View>
          )}
        </>
      ) : null}

      {shortcuts.length ? (
        <>
          <View style={styles.sectionHead}>
            <T variant="subtitle">Menu {roleLabel(activeRole)}</T>
            <T variant="label" tone="brand" onPress={() => router.push('/(app)/(tabs)/menu')}>Semua menu</T>
          </View>
          <View style={styles.quickGrid}>
            {shortcuts.map((i) => (
              <Pressable key={i.key} onPress={() => router.push(i.href as any)} accessibilityRole="button" accessibilityLabel={i.label}
                style={({ pressed }) => [styles.quick, { opacity: pressed ? 0.7 : 1 }]}>
                <View style={[styles.quickIcon, { backgroundColor: i.highlight ? colors.brandPrimary : colors.brandTertiary }]}>
                  <Icon name={i.icon} size={22} color={i.highlight ? colors.onBrandPrimary : colors.onBrandTertiary} />
                </View>
                <T variant="small" weight="medium" center numberOfLines={2}>{i.label}</T>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <View style={styles.sectionHead}>
        <T variant="subtitle">Pengumuman terbaru</T>
        <T variant="label" tone="brand" onPress={() => router.push('/(app)/(tabs)/pengumuman')}>Lihat semua</T>
      </View>
      {ann.loading ? (
        <CardSkeleton lines={2} />
      ) : latestAnn.length === 0 ? (
        <Card><EmptyState icon="megaphone-outline" title="Belum ada pengumuman" compact /></Card>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {latestAnn.map((a) => (
            <Card key={a.id} onPress={() => router.push(`/pengumuman/${a.id}` as any)} style={styles.annCard}>
              <View style={[styles.annDot, { backgroundColor: a.is_read ? colors.border : colors.brandPrimary }]} />
              <View style={{ flex: 1, gap: 2 }}>
                <T weight={a.is_read ? 'medium' : 'semibold'} numberOfLines={1}>{a.title}</T>
                <T variant="caption" tone="muted" numberOfLines={2}>{stripMd(a.body)}</T>
                {a.created_at ? <T variant="small" tone="muted">{formatRelative(a.created_at)}</T> : null}
              </View>
              {a.is_pinned ? <Badge label="Disematkan" tone="brand" small /> : null}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

function Stat({ label, value, icon, tone = 'neutral' }: { label: string; value: number; icon: IconName; tone?: 'neutral' | 'success' | 'error' }) {
  const { colors } = useTheme();
  const fg = tone === 'success' ? colors.success : tone === 'error' ? colors.error : colors.brandPrimary;
  return (
    <Card style={styles.stat}>
      <Icon name={icon} size={20} color={fg} />
      <T variant="title" color={fg}>{value}</T>
      <T variant="caption" tone="muted">{label}</T>
    </Card>
  );
}

const firstName = (n?: string | null) => (n || '').replace(/^(drs?\.?|h\.|hj\.)\s*/i, '').split(/[\s,]/)[0] || 'Bapak/Ibu';
const stripMd = (s: string) => (s || '').replace(/[#*_`>\[\]]/g, '').replace(/\s+/g, ' ').trim();

const styles = StyleSheet.create({
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md },
  quick: { width: '25%', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  quickIcon: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  piketCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm, borderWidth: 1 },
  piketIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  queueCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, alignItems: 'flex-start', gap: 2, paddingVertical: spacing.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl, marginBottom: spacing.md },
  annCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  annDot: { width: 8, height: 8, borderRadius: radius.pill, marginTop: 7 },
});
