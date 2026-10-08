/**
 * Problem Cek List (PCL) siswa — native, pengganti /siswa/pcl. Tab "Isi baru": petunjuk & jadwal, kategori
 * masalah yang bisa dibuka-tutup dengan centang item (GET /bk/pcl/form), tiga pertanyaan uraian →
 * POST /bk/pcl/submit (hanya saat jadwal dibuka). Tab "Riwayat": pengisian & tanggapan Guru BK.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { PCLForm, PCLSubmission } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useNetwork } from '@/store/network';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { CheckRow, ClosedCard, Petunjuk, Progress, formatSubmitted } from '@/bk/ui';

type Tab = 'baru' | 'riwayat';
type Essay = 'masalah_lain' | 'masalah_saat_ini' | 'tempat_curhat';

export default function SiswaPCL() {
  const router = useRouter();
  const { colors } = useTheme();
  const { online } = useNetwork();
  const form = useCached<PCLForm>('siswa.pcl.form', api.bk.pclForm);
  const hist = useCached<PCLSubmission[]>('siswa.pcl.history', api.bk.pclHistory);
  const [tab, setTab] = useState<Tab>('baru');
  const [selected, setSelected] = useState<Record<string, number[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [essay, setEssay] = useState<Record<Essay, string>>({ masalah_lain: '', masalah_saat_ini: '', tempat_curhat: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Pesan galat validasi: di bawah form + toast agar langsung terlihat walau form panjang. */
  const fail = (msg: string) => { setError(msg); toast.error(msg); };
  const f = form.data;
  const history = hist.data ?? [];
  const total = Object.values(selected).reduce((n, l) => n + l.length, 0);

  const toggle = (kode: string, idx: number) => setSelected((p) => {
    const cur = p[kode] ?? [];
    return { ...p, [kode]: cur.includes(idx) ? cur.filter((x) => x !== idx) : [...cur, idx] };
  });

  const submit = async () => {
    if (!total) return fail('Pilih minimal satu masalah yang pernah/sedang kamu alami.');
    setError(null);
    setBusy(true);
    try {
      await api.bk.pclSubmit({
        selected: Object.fromEntries(Object.entries(selected).map(([k, l]) => [k, [...l].sort((a, b) => a - b)])),
        masalah_lain: essay.masalah_lain.trim() || null, masalah_saat_ini: essay.masalah_saat_ini.trim() || null, tempat_curhat: essay.tempat_curhat.trim() || null,
      });
      toast.success('PCL terkirim', 'Terima kasih! Guru BK akan menanggapi.');
      setSelected({}); setExpanded(null); setEssay({ masalah_lain: '', masalah_saat_ini: '', tempat_curhat: '' });
      await hist.refresh();
      setTab('riwayat');
    } catch (e) {
      setError(errorMessage(e, 'Gagal mengirim PCL.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="PCL" subtitle="Problem Cek List" back
      refreshing={form.refreshing || hist.refreshing} onRefresh={() => { void form.refresh(); void hist.refresh(); }}
      offline={{ fromCache: form.fromCache, updatedAt: form.updatedAt }}
      footer={tab === 'baru' && f?.is_open ? <Button title="Kirim jawaban" icon="paper-plane-outline" size="lg" fullWidth loading={busy} disabled={!online} onPress={submit} /> : undefined}>
      <View style={{ gap: spacing.md }}>
        <SegmentedControl<Tab> segments={[{ value: 'baru', label: 'Isi baru' }, { value: 'riwayat', label: `Riwayat (${history.length})` }]} value={tab} onChange={setTab} />

        {tab === 'riwayat' ? (
          hist.loading ? <CardSkeleton lines={3} /> : history.length === 0 ? (
            <Card><EmptyState icon="time-outline" title="Belum ada riwayat" message="Pengisian PCL yang sudah dikirim tampil di sini." compact /></Card>
          ) : history.map((h) => (
            <Card key={h.id} onPress={() => router.push(`/siswa/pcl/${h.id}`)} style={styles.row}>
              <View style={{ flex: 1, gap: 4 }}>
                <T weight="semibold">{formatSubmitted(h.submitted_at)}</T>
                <T variant="caption" tone="muted">{h.scoring?.total_dipilih ?? 0} masalah dipilih ({h.scoring?.persentase_keseluruhan ?? 0}%)</T>
                <Badge label={h.tanggapan_bk ? 'Sudah ditanggapi BK' : 'Menunggu tanggapan'} tone={h.tanggapan_bk ? 'success' : 'neutral'} small />
              </View>
              <Icon name="chevron-forward" size={18} color={colors.muted} />
            </Card>
          ))
        ) : form.loading ? <CardSkeleton lines={6} /> : !f ? (
          <ErrorState message={errorMessage(form.error, 'Formulir PCL belum bisa dimuat.')} onRetry={form.refresh} />
        ) : !f.is_open ? <ClosedCard name="PCL" /> : (
          <>
            <Petunjuk petunjuk={f.petunjuk} info={f.info} start={f.open_start} end={f.open_end} />
            <Card><Progress value={total} total={f.total_items} /></Card>
            {f.categories.map((cat) => {
              const picked = selected[cat.kode] ?? [];
              const isOpen = expanded === cat.kode;
              return (
                <Card key={cat.kode} padded={false}>
                  <Pressable onPress={() => setExpanded(isOpen ? null : cat.kode)} style={styles.catHead} accessibilityRole="button" accessibilityState={{ expanded: isOpen }}>
                    <T weight="semibold" style={{ flex: 1 }}>{cat.nama}</T>
                    <Badge label={`${picked.length}/${cat.items.length}`} tone={picked.length ? 'brand' : 'neutral'} small />
                    <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
                  </Pressable>
                  {isOpen ? (
                    <View style={styles.catBody}>
                      {cat.items.map((text, idx) => <CheckRow key={idx} checked={picked.includes(idx)} onPress={() => toggle(cat.kode, idx)}>{text}</CheckRow>)}
                    </View>
                  ) : null}
                </Card>
              );
            })}
            <Card style={{ gap: spacing.md }}>
              <T variant="label" tone="muted">PERTANYAAN URAIAN</T>
              {f.essay_questions.map((q, i) => (
                <Input key={q.kode} label={`${i + 1}. ${q.pertanyaan}`} multiline value={essay[q.kode as Essay] ?? ''}
                  onChangeText={(v) => setEssay((p) => ({ ...p, [q.kode]: v }))} placeholder="Tulis jawabanmu (opsional)" />
              ))}
            </Card>
            {!online ? <Notice tone="warning" icon="cloud-offline-outline" text="Tidak ada koneksi. Mengirim PCL memerlukan internet." /> : null}
            {error ? <Notice tone="error" icon="alert-circle-outline" text={error} /> : null}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  catHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, minHeight: 52 },
  catBody: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
});
