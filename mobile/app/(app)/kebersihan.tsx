/**
 * Kebersihan Kelas — native, pengganti /guru/kebersihan. Guru mapel memilih dari kelas yang diajarnya
 * (GET /cleanliness/guru/classes/all); guru piket & wali kelas dari semua kelas tahun aktif (wali: kelasnya
 * terpilih). Penilaian hari ini: bintang 1–5, kondisi, siswa piket, catatan → POST /cleanliness/class
 * (penilaian hari ini yang sudah ada dimuat untuk diperbarui). Riwayat: penilaian saya / riwayat kelas.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { ClassItem, CleanlinessRecord, Student } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useAuth } from '@/store/auth';
import { useNetwork } from '@/store/network';
import { formatDateLong, formatDateShort, todayISO } from '@/utils/time';
import { radius, spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SelectField } from '@/components/ui/SelectField';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';

const GURU_MAPEL = ['guru', 'guru_ipa', 'guru_ips', 'guru_bahasa', 'guru_seni', 'guru_agama', 'guru_tik'];
const KONDISI: { value: string; label: string; tone: BadgeTone }[] = [
  { value: 'bersih', label: 'Bersih', tone: 'success' }, { value: 'cukup', label: 'Cukup', tone: 'warning' }, { value: 'kotor', label: 'Kotor', tone: 'error' },
];
type Tab = 'nilai' | 'riwayat';

export default function Kebersihan() {
  const { colors } = useTheme();
  const qc = useQueryClient();
  const { user, activeRole } = useAuth();
  const { online } = useNetwork();
  const isGuru = GURU_MAPEL.includes(activeRole ?? '');
  const today = todayISO();
  const classes = useCached<ClassItem[]>(`kebersihan.classes.${isGuru ? 'guru' : 'all'}`, async () => {
    if (isGuru) return api.kebersihan.guruClasses();
    const ay = await api.kebersihan.activeYear().catch(() => null);
    return api.kebersihan.classes(ay?.id);
  }, { staleTime: 30 * 60_000 });
  const [classId, setClassId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('nilai');

  useEffect(() => {
    if (classId || !classes.data?.length) return;
    const home = classes.data.find((c) => c.id === user?.homeroom_class_id);
    if (home) setClassId(home.id);
    else if (classes.data.length === 1) setClassId(classes.data[0].id);
  }, [classes.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const history = useCached<CleanlinessRecord[]>(`kebersihan.class.${classId}`, () => api.kebersihan.classHistory(classId!), { enabled: !!classId });
  const students = useCached<Student[]>(`students.class.${classId}`, () => api.students.byClass(classId!), { enabled: !!classId, staleTime: 30 * 60_000 });
  const mine = useCached<CleanlinessRecord[]>('kebersihan.mine', api.kebersihan.guruHistory, { enabled: isGuru || activeRole === 'guru_piket' });

  const existing = (history.data ?? []).find((h) => h.date === today);
  const [rating, setRating] = useState(3);
  const [kondisi, setKondisi] = useState('bersih');
  const [notes, setNotes] = useState('');
  const [piket, setPiket] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRating(existing?.rating ?? 3); setKondisi(existing?.condition ?? 'bersih');
    setNotes(existing?.notes ?? ''); setPiket(existing?.piket_students ?? []);
  }, [classId, existing?.date, existing?.recorded_at]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!classId) { toast.error('Pilih kelas dulu'); return; }
    setBusy(true);
    try {
      await api.kebersihan.submit({ class_id: classId, date: today, rating, condition: kondisi, notes: notes.trim() || null, piket_students: piket });
      toast.success(existing ? 'Penilaian kebersihan diperbarui' : 'Penilaian kebersihan tersimpan');
      await qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('kebersihan.') });
    } catch (e) {
      toast.error(errorMessage(e, 'Gagal menyimpan penilaian.'));
    } finally {
      setBusy(false);
    }
  };

  const nama = useMemo(() => new Map((students.data ?? []).map((s) => [s.id, s.full_name])), [students.data]);
  const riwayat = isGuru || activeRole === 'guru_piket' ? mine : history;

  return (
    <Screen title="Kebersihan Kelas" subtitle={formatDateLong(today)} back
      refreshing={classes.refreshing || history.refreshing} onRefresh={() => { void classes.refresh(); void history.refresh(); void mine.refresh(); }}
      offline={{ fromCache: classes.fromCache, updatedAt: classes.updatedAt }}
      footer={tab === 'nilai' && classId ? <Button title={existing ? 'Perbarui penilaian' : 'Simpan penilaian'} icon="checkmark-circle-outline" size="lg" fullWidth loading={busy} disabled={!online} onPress={submit} /> : undefined}>
      <View style={{ gap: spacing.md }}>
        <SegmentedControl<Tab> segments={[{ value: 'nilai', label: 'Penilaian hari ini' }, { value: 'riwayat', label: 'Riwayat' }]} value={tab} onChange={setTab} />
        <SelectField label={isGuru ? 'Kelas yang Anda ajar' : 'Kelas'} value={classId} allowNone={false} icon="school-outline"
          placeholder={classes.loading ? 'Memuat kelas…' : (classes.data ?? []).length ? 'Pilih kelas' : 'Tidak ada kelas'}
          options={[...(classes.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.id, label: c.name }))}
          onChange={setClassId} />

        {tab === 'nilai' ? (
          !classId ? (
            <Card><EmptyState icon="sparkles-outline" title="Pilih kelas" message={isGuru ? 'Guru menilai kebersihan kelas yang diajarnya, hanya untuk hari ini.' : 'Pilih kelas yang akan dinilai.'} compact /></Card>
          ) : history.loading ? <CardSkeleton lines={4} /> : (
            <>
              {existing ? <Notice tone="success" icon="checkmark-circle-outline" text="Kelas ini sudah dinilai hari ini. Simpan lagi untuk memperbarui." /> : null}
              <Card style={{ gap: spacing.md }}>
                <T variant="label" tone="muted">NILAI</T>
                <View style={styles.stars}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable key={n} onPress={() => setRating(n)} accessibilityRole="button" accessibilityLabel={`Nilai ${n}`} hitSlop={6}>
                      <Icon name={n <= rating ? 'star' : 'star-outline'} size={34} color={n <= rating ? colors.warning : colors.border} />
                    </Pressable>
                  ))}
                </View>
                <SegmentedControl small segments={KONDISI.map(({ value, label }) => ({ value, label }))} value={kondisi} onChange={setKondisi} />
                <Input label="Catatan" value={notes} onChangeText={setNotes} multiline placeholder="mis. sampah di laci, papan belum dihapus" />
              </Card>
              <Card style={{ gap: spacing.sm }}>
                <View style={styles.row}>
                  <T variant="label" tone="muted" style={{ flex: 1 }}>SISWA PIKET ({piket.length})</T>
                  {piket.length ? <Button title="Kosongkan" variant="ghost" size="sm" onPress={() => setPiket([])} /> : null}
                </View>
                {students.loading ? <CardSkeleton lines={3} /> : (students.data ?? []).map((s) => {
                  const on = piket.includes(s.id);
                  return (
                    <Pressable key={s.id} onPress={() => setPiket((p) => (on ? p.filter((x) => x !== s.id) : [...p, s.id]))}
                      accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                      style={[styles.student, { borderColor: on ? colors.brandPrimary : colors.border, backgroundColor: on ? colors.brandTertiary : colors.surface }]}>
                      <Icon name={on ? 'checkbox' : 'square-outline'} size={20} color={on ? colors.brandPrimary : colors.muted} />
                      <T style={{ flex: 1 }} numberOfLines={1}>{s.full_name}</T>
                    </Pressable>
                  );
                })}
              </Card>
              {!online ? <Notice tone="warning" icon="cloud-offline-outline" text="Tidak ada koneksi. Menyimpan penilaian memerlukan internet." /> : null}
            </>
          )
        ) : riwayat.loading ? <CardSkeleton lines={3} /> : (riwayat.data ?? []).length === 0 ? (
          <Card><EmptyState icon="time-outline" title="Belum ada riwayat" message={riwayat === history && !classId ? 'Pilih kelas untuk melihat riwayatnya.' : 'Penilaian kebersihan akan tampil di sini.'} compact /></Card>
        ) : (riwayat.data ?? []).map((h, i) => {
          const k = KONDISI.find((x) => x.value === h.condition);
          return (
            <Card key={h.id ?? `${h.class_id}-${h.date}-${i}`} style={{ gap: 4 }}>
              <View style={styles.row}>
                <T weight="semibold" style={{ flex: 1 }}>{h.class_name ? `Kelas ${h.class_name} · ` : ''}{formatDateShort(h.date)}</T>
                {k ? <Badge label={k.label} tone={k.tone} small /> : null}
              </View>
              <View style={styles.row}>
                {[1, 2, 3, 4, 5].map((n) => <Icon key={n} name={n <= (h.rating ?? 0) ? 'star' : 'star-outline'} size={14} color={n <= (h.rating ?? 0) ? colors.warning : colors.border} />)}
                <T variant="caption" tone="muted">· {(h.piket_students ?? []).length} siswa piket</T>
              </View>
              {h.notes ? <T variant="caption" tone="secondary">{h.notes}</T> : null}
              {(h.piket_students ?? []).length && nama.size ? (
                <T variant="small" tone="muted" numberOfLines={2}>{(h.piket_students ?? []).map((id) => nama.get(id)).filter(Boolean).join(', ')}</T>
              ) : null}
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  student: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1 },
});
