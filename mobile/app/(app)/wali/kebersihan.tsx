/**
 * Kebersihan Kelas wali — native, pengganti /wali-kelas/kebersihan. Penilaian kebersihan kelas per bulan
 * (GET /wali-kelas/cleanliness-report: tanggal, bintang, kondisi, penilai, catatan) dengan rata-rata;
 * ketuk satu hari untuk siswa piketnya (GET /wali-kelas/cleanliness-details).
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { request, errorMessage } from '@/api/client';
import { useAuth } from '@/store/auth';
import { bulanIni, MonthBar } from '@/pantau/ui';
import { useCached } from '@/hooks/useCached';
import { formatDateLong } from '@/utils/time';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

type Nilai = { date: string; rating: number; condition?: string; assessor_name?: string; notes?: string };
type Detail = { piket_students?: (string | { full_name?: string })[] };
const KONDISI: Record<string, BadgeTone> = { bersih: 'success', cukup: 'warning', kotor: 'error' };

function Bintang({ n }: { n: number }) {
  const { colors } = useTheme();
  return <View style={{ flexDirection: 'row' }}>{[1, 2, 3, 4, 5].map((i) => <Icon key={i} name={i <= Math.round(n) ? 'star' : 'star-outline'} size={14} color={i <= Math.round(n) ? colors.warning : colors.border} />)}</View>;
}

function Piket({ kelas, date }: { kelas: string; date: string }) {
  const res = useCached<Detail>(`wali.kebersihan.detail.${kelas}.${date}`, () => request('/wali-kelas/cleanliness-details', { query: { class_id: kelas, date } }));
  if (res.loading) return <CardSkeleton lines={1} />;
  const nama = (res.data?.piket_students ?? []).map((s) => (typeof s === 'string' ? s : s.full_name)).filter(Boolean);
  return <T variant="caption" tone="secondary">{nama.length ? `Piket: ${nama.join(', ')}` : 'Siswa piket tidak dicatat.'}</T>;
}

export default function WaliKebersihan() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const kelas = user?.homeroom_class_id ?? '';
  const [month, setMonth] = useState(bulanIni());
  const [buka, setBuka] = useState<string | null>(null);
  const res = useCached<Nilai[]>(`wali.kebersihan.${kelas}.${month}`, () => request('/wali-kelas/cleanliness-report', { query: { class_id: kelas, month } }), { enabled: !!kelas });
  const list = [...(res.data ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const rata = list.length ? list.reduce((n, r) => n + (r.rating || 0), 0) / list.length : 0;

  return (
    <Screen title="Kebersihan Kelas" subtitle="Kelas wali · per bulan" back refreshing={res.refreshing} onRefresh={res.refresh}
      offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}>
      <View style={{ gap: spacing.md }}>
        <MonthBar month={month} onChange={(m) => { setMonth(m); setBuka(null); }} />
        {!kelas ? <Card><EmptyState icon="school-outline" title="Belum ada kelas wali" compact /></Card>
          : res.loading ? <CardSkeleton lines={5} /> : !res.data ? (
            <ErrorState message={errorMessage(res.error, 'Penilaian kebersihan belum bisa dimuat.')} onRetry={res.refresh} compact />
          ) : (
            <>
              <Card style={[styles.row, { gap: spacing.md }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T weight="semibold">Rata-rata bulan ini</T>
                  <T variant="caption" tone="muted">{list.length} kali dinilai</T>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <T variant="title">{list.length ? rata.toFixed(1) : '—'}</T>
                  <Bintang n={rata} />
                </View>
              </Card>
              {list.length === 0 ? <Card><EmptyState icon="sparkles-outline" title="Belum dinilai" message="Belum ada penilaian kebersihan pada bulan ini." compact /></Card> : list.map((r) => {
                const terbuka = buka === r.date;
                return (
                  <Card key={r.date} style={{ gap: spacing.xs }}>
                    <Pressable onPress={() => setBuka(terbuka ? null : r.date)} accessibilityRole="button" accessibilityState={{ expanded: terbuka }} style={{ gap: 4 }}>
                      <View style={styles.row}>
                        <T weight="medium" style={{ flex: 1 }}>{formatDateLong(r.date)}</T>
                        <Bintang n={r.rating} />
                        {r.condition ? <Badge label={r.condition[0].toUpperCase() + r.condition.slice(1)} tone={KONDISI[r.condition] ?? 'neutral'} small /> : null}
                      </View>
                      <T variant="caption" tone="muted">Dinilai {r.assessor_name ?? '-'}{r.notes ? ` · ${r.notes}` : ''}</T>
                    </Pressable>
                    {terbuka ? <Piket kelas={kelas} date={r.date} /> : null}
                  </Card>
                );
              })}
            </>
          )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm } });
