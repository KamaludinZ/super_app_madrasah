/**
 * Cek List Kebiasaan Belajar (CLKB) siswa — native, pengganti /siswa/clkb. Tab "Isi baru": petunjuk & jadwal,
 * centang pernyataan (GET /bk/clkb/form), keterangan waktu belajar, minat topik, 3 kebiasaan yang ingin
 * diperbaiki → POST /bk/clkb/submit (hanya saat jadwal dibuka). Tab "Riwayat": pengisian & tanggapan Guru BK.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { CLKBForm, CLKBSubmission } from '@/api/types';
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

const TOPIK = [
  'Cara belajar yang efektif', 'Cara membaca yang efektif', 'Cara membuat ringkasan',
  'Cara menghafal yang efektif', 'Cara mempelajari jenis pelajaran tertentu',
];
type Tab = 'baru' | 'riwayat';

export default function SiswaCLKB() {
  const router = useRouter();
  const { online } = useNetwork();
  const form = useCached<CLKBForm>('siswa.clkb.form', api.bk.clkbForm);
  const hist = useCached<CLKBSubmission[]>('siswa.clkb.history', api.bk.clkbHistory);
  const [tab, setTab] = useState<Tab>('baru');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [jam, setJam] = useState('');
  const [dari, setDari] = useState('');
  const [sampai, setSampai] = useState('');
  const [perluInfo, setPerluInfo] = useState<boolean | null>(null);
  const [topik, setTopik] = useState<string[]>([]);
  const [topikLain, setTopikLain] = useState('');
  const [kebiasaan, setKebiasaan] = useState(['', '', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const f = form.data;
  const history = hist.data ?? [];
  const open = !!f?.is_open;

  const toggle = (no: number) => setSelected((prev) => { const n = new Set(prev); if (n.has(no)) n.delete(no); else n.add(no); return n; });
  const time = (v: string) => v.replace(/[^\d:.]/g, '').replace('.', ':').slice(0, 5);

  const submit = async () => {
    if (!selected.size) return setError('Pilih minimal satu pernyataan yang sesuai dengan dirimu.');
    for (const t of [dari, sampai]) if (t && !/^\d{1,2}:\d{2}$/.test(t)) return setError('Jam ditulis JJ:MM, mis. 19:00.');
    setError(null);
    setBusy(true);
    try {
      await api.bk.clkbSubmit({
        selected: [...selected].sort((a, b) => a - b),
        waktu_belajar_jam: jam.trim() || null, waktu_belajar_dari: dari || null, waktu_belajar_sampai: sampai || null,
        perlu_info_cara_belajar: perluInfo, topik_diminati: perluInfo ? topik : [], topik_lainnya: perluInfo ? topikLain.trim() || null : null,
        kebiasaan_diperbaiki: kebiasaan.map((k) => k.trim()).filter(Boolean),
      });
      toast.success('CLKB terkirim', 'Terima kasih! Guru BK akan menanggapi.');
      setSelected(new Set()); setJam(''); setDari(''); setSampai(''); setPerluInfo(null); setTopik([]); setTopikLain(''); setKebiasaan(['', '', '']);
      await hist.refresh();
      setTab('riwayat');
    } catch (e) {
      setError(errorMessage(e, 'Gagal mengirim CLKB.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="CLKB" subtitle="Cek List Kebiasaan Belajar" back
      refreshing={form.refreshing || hist.refreshing} onRefresh={() => { void form.refresh(); void hist.refresh(); }}
      offline={{ fromCache: form.fromCache, updatedAt: form.updatedAt }}
      footer={tab === 'baru' && open ? <Button title="Kirim jawaban" icon="paper-plane-outline" size="lg" fullWidth loading={busy} disabled={!online} onPress={submit} /> : undefined}>
      <View style={{ gap: spacing.md }}>
        <SegmentedControl<Tab> segments={[{ value: 'baru', label: 'Isi baru' }, { value: 'riwayat', label: `Riwayat (${history.length})` }]} value={tab} onChange={setTab} />

        {tab === 'riwayat' ? (
          hist.loading ? <CardSkeleton lines={3} /> : history.length === 0 ? (
            <Card><EmptyState icon="time-outline" title="Belum ada riwayat" message="Pengisian CLKB yang sudah dikirim tampil di sini." compact /></Card>
          ) : history.map((h) => (
            <Card key={h.id} onPress={() => router.push(`/siswa/clkb/${h.id}`)} style={styles.hist}>
              <View style={{ flex: 1, gap: 4 }}>
                <T weight="semibold">{formatSubmitted(h.submitted_at)}</T>
                <T variant="caption" tone="muted">{h.scoring?.total_selected ?? h.selected.length} dipilih · +{h.scoring?.plus_count ?? 0} positif · −{h.scoring?.minus_count ?? 0} negatif</T>
                <Badge label={h.tanggapan_bk ? 'Sudah ditanggapi BK' : 'Menunggu tanggapan'} tone={h.tanggapan_bk ? 'success' : 'neutral'} small />
              </View>
              <Icon name="chevron-forward" size={18} />
            </Card>
          ))
        ) : form.loading ? <CardSkeleton lines={6} /> : !f ? (
          <ErrorState message={errorMessage(form.error, 'Formulir CLKB belum bisa dimuat.')} onRetry={form.refresh} />
        ) : !open ? <ClosedCard name="CLKB" /> : (
          <>
            <Petunjuk petunjuk={f.petunjuk} info={f.info} start={f.open_start} end={f.open_end} />
            <Card><Progress value={selected.size} total={f.total_items} /></Card>
            <View style={{ gap: spacing.sm }}>
              {f.items.map((it) => <CheckRow key={it.no} no={it.no} checked={selected.has(it.no)} onPress={() => toggle(it.no)}>{it.pernyataan}</CheckRow>)}
            </View>

            <Card style={{ gap: spacing.md }}>
              <T variant="label" tone="muted">LENGKAPI KETERANGAN</T>
              <Input label="Rata-rata jam belajar per hari" value={jam} onChangeText={setJam} placeholder="Contoh: 2 jam" />
              <View style={styles.two}>
                <Input label="Dari jam" value={dari} onChangeText={(v) => setDari(time(v))} placeholder="19:00" keyboardType="numbers-and-punctuation" containerStyle={{ flex: 1 }} />
                <Input label="Sampai jam" value={sampai} onChangeText={(v) => setSampai(time(v))} placeholder="21:00" keyboardType="numbers-and-punctuation" containerStyle={{ flex: 1 }} />
              </View>
              <View style={{ gap: 6 }}>
                <T variant="label" tone="secondary">Apakah kamu memerlukan informasi tentang cara belajar yang baik?</T>
                <View style={styles.two}>
                  <Button title="Ya" variant={perluInfo === true ? 'primary' : 'outline'} size="sm" style={{ flex: 1 }} onPress={() => setPerluInfo(true)} />
                  <Button title="Tidak" variant={perluInfo === false ? 'primary' : 'outline'} size="sm" style={{ flex: 1 }} onPress={() => setPerluInfo(false)} />
                </View>
              </View>
              {perluInfo ? (
                <View style={{ gap: spacing.sm }}>
                  <T variant="label" tone="secondary">Topik yang ingin diketahui (boleh lebih dari satu)</T>
                  {TOPIK.map((t) => (
                    <CheckRow key={t} checked={topik.includes(t)} onPress={() => setTopik((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))}>{t}</CheckRow>
                  ))}
                  <Input value={topikLain} onChangeText={setTopikLain} placeholder="Lain-lain, sebutkan…" />
                </View>
              ) : null}
              <View style={{ gap: spacing.sm }}>
                <T variant="label" tone="secondary">Tiga kebiasaan belajar yang menurutmu perlu diperbaiki</T>
                {[0, 1, 2].map((i) => (
                  <Input key={i} value={kebiasaan[i]} placeholder={`Kebiasaan ${i + 1} (opsional)`}
                    onChangeText={(v) => setKebiasaan((p) => p.map((x, j) => (j === i ? v : x)))} />
                ))}
              </View>
            </Card>
            {!online ? <Notice tone="warning" icon="cloud-offline-outline" text="Tidak ada koneksi. Mengirim CLKB memerlukan internet." /> : null}
            {error ? <Notice tone="error" icon="alert-circle-outline" text={error} /> : null}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  two: { flexDirection: 'row', gap: spacing.sm },
  hist: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
