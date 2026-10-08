/**
 * E-Kinerja GTK — native, bagian pengisian dari /admin/gtk/e-kinerja (penyusun RHK/rekap tetap di web).
 * Tab Jurnal Harian: riwayat per tanggal (GET /ekinerja/jurnal-harian/my), tambah (tercatat hari ini), ubah,
 * hapus — juga dasar kehadiran tendik. Tab LCKB: realisasi bulanan per RHK yang diambil (GET /ekinerja/lckb/my,
 * PUT /ekinerja/lckb/realisasi). Tab Link: link bukti dukung yang dipilih saat mengisi jurnal.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { JurnalHarian, JurnalLink, LckbRow, RhkItem } from '@/api/types';
import { useAuth } from '@/store/auth';
import { useCached } from '@/hooks/useCached';
import { useNetwork } from '@/store/network';
import { formatDateLong, todayISO, wibParts } from '@/utils/time';
import { radius, spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SelectField } from '@/components/ui/SelectField';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { openUrl } from '@/components/RichText';

export const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
type Tab = 'jurnal' | 'lckb' | 'rhk' | 'link';

export default function EKinerja() {
  const [tab, setTab] = useState<Tab>('jurnal');
  return (
    <Screen title="E-Kinerja" subtitle="Jurnal harian, LCKB & bukti dukung" back>
      <View style={{ gap: spacing.md }}>
        <SegmentedControl<Tab> small segments={[{ value: 'jurnal', label: 'Jurnal' }, { value: 'lckb', label: 'LCKB' }, { value: 'rhk', label: 'RHK' }, { value: 'link', label: 'Link' }]} value={tab} onChange={setTab} />
        {tab === 'jurnal' ? <Jurnal /> : tab === 'lckb' ? <Lckb /> : tab === 'rhk' ? <Rhk /> : <Links />}
      </View>
    </Screen>
  );
}

function Jurnal() {
  const router = useRouter();
  const qc = useQueryClient();
  const { online } = useNetwork();
  const res = useCached<JurnalHarian[]>('ekinerja.jurnal', api.ekinerja.jurnalMy);
  const today = todayISO();
  const groups = useMemo(() => {
    const m = new Map<string, JurnalHarian[]>();
    (res.data ?? []).forEach((e) => m.set(e.tanggal, [...(m.get(e.tanggal) ?? []), e]));
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [res.data]);
  const hariIni = groups.find(([d]) => d === today)?.[1].length ?? 0;

  const remove = (e: JurnalHarian) => Alert.alert('Hapus entri jurnal?', e.uraian_kegiatan.slice(0, 80), [
    { text: 'Batal', style: 'cancel' },
    {
      text: 'Hapus', style: 'destructive', onPress: async () => {
        try { await api.ekinerja.jurnalDelete(e.id); toast.success('Entri dihapus'); await qc.invalidateQueries({ queryKey: ['ekinerja.jurnal'] }); }
        catch (err) { toast.error(errorMessage(err, 'Gagal menghapus entri.')); }
      },
    },
  ]);

  return (
    <>
      <Card style={styles.today}>
        <View style={{ flex: 1, gap: 2 }}>
          <T weight="semibold">Hari ini · {formatDateLong(today)}</T>
          <T variant="caption" tone="muted">{hariIni ? `${hariIni} kegiatan tercatat` : 'Belum ada kegiatan tercatat hari ini'}</T>
        </View>
        <Button title="Tambah" icon="add" size="sm" disabled={!online} onPress={() => router.push('/ekinerja/jurnal')} />
      </Card>
      {res.loading ? <CardSkeleton lines={4} /> : res.error && !res.data ? (
        <ErrorState message={errorMessage(res.error, 'Jurnal harian belum bisa dimuat.')} onRetry={res.refresh} />
      ) : groups.length === 0 ? (
        <Card><EmptyState icon="create-outline" title="Belum ada jurnal harian" message="Catat kegiatan kerja setiap hari; tanggal otomatis hari ini." compact /></Card>
      ) : groups.map(([d, list]) => (
        <Card key={d} style={{ gap: spacing.sm }}>
          <T variant="label" weight="semibold" tone="secondary">{formatDateLong(d)}{d === today ? ' · Hari ini' : ''}</T>
          {list.map((e, i) => (
            <View key={e.id} style={[{ gap: 4 }, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm }]}>
              <T>{e.uraian_kegiatan}</T>
              <View style={styles.row}>
                {[e.volume, e.satuan_hasil].filter(Boolean).length ? <Badge label={[e.volume, e.satuan_hasil].filter(Boolean).join(' ')} tone="neutral" small /> : null}
                {e.link_url ? <Button title={e.link_label ?? 'Bukti'} icon="link-outline" variant="ghost" size="sm" onPress={() => openUrl(e.link_url!)} /> : null}
                <View style={{ flex: 1 }} />
                <Button title="Ubah" icon="create-outline" variant="ghost" size="sm" disabled={!online} onPress={() => router.push({ pathname: '/ekinerja/jurnal', params: { id: e.id } })} />
                <Button title="Hapus" icon="trash-outline" variant="ghost" size="sm" disabled={!online} onPress={() => remove(e)} />
              </View>
            </View>
          ))}
        </Card>
      ))}
    </>
  );
}

function Lckb() {
  const { colors } = useTheme();
  const qc = useQueryClient();
  const { online } = useNetwork();
  const takwim = useCached<{ year?: number } | null>('ekinerja.takwim', api.ekinerja.tahunTakwim, { staleTime: 60 * 60_000 });
  const year = takwim.data?.year ?? wibParts(Date.now()).year;
  const [bulan, setBulan] = useState(BULAN[wibParts(Date.now()).month]);
  const res = useCached<LckbRow[]>(`ekinerja.lckb.${year}.${bulan}`, () => api.ekinerja.lckbMy(year, bulan), { enabled: !takwim.loading });
  const [draft, setDraft] = useState<Record<string, { v: string; k: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const d: Record<string, { v: string; k: string }> = {};
    (res.data ?? []).forEach((r) => { d[r.rhk_id] = { v: r.realisasi_volume ?? '', k: r.keterangan ?? '' }; });
    setDraft(d);
  }, [res.data]);

  const save = async (r: LckbRow) => {
    const d = draft[r.rhk_id] ?? { v: '', k: '' };
    setSaving(r.rhk_id);
    try {
      await api.ekinerja.lckbSave({ rhk_id: r.rhk_id, year, month: bulan, realisasi_volume: d.v.trim() || null, keterangan: d.k.trim() || null });
      toast.success('Realisasi tersimpan');
      await qc.invalidateQueries({ queryKey: [`ekinerja.lckb.${year}.${bulan}`] });
    } catch (e) { toast.error(errorMessage(e, 'Gagal menyimpan realisasi.')); } finally { setSaving(null); }
  };

  const terisi = (res.data ?? []).filter((r) => r.realisasi_volume).length;
  return (
    <>
      <SelectField label={`Bulan (tahun ${year})`} value={bulan} options={BULAN.map((b) => ({ value: b, label: b }))} allowNone={false} icon="calendar-outline" onChange={(v) => v && setBulan(v)} />
      {res.loading ? <CardSkeleton lines={4} /> : res.error && !res.data ? (
        <ErrorState message={errorMessage(res.error, 'LCKB belum bisa dimuat.')} onRetry={res.refresh} />
      ) : (res.data ?? []).length === 0 ? (
        <Card><EmptyState icon="clipboard-outline" title="Tidak ada RHK bulan ini" message="Ambil RHK yang menjadi tugas Anda di tab RHK; RHK yang berlaku pada bulan ini akan tampil untuk diisi realisasinya." compact /></Card>
      ) : (
        <>
          <T variant="caption" tone="muted">{terisi}/{res.data?.length} RHK sudah diisi realisasinya.</T>
          {(res.data ?? []).map((r) => {
            const d = draft[r.rhk_id] ?? { v: '', k: '' };
            const changed = d.v !== (r.realisasi_volume ?? '') || d.k !== (r.keterangan ?? '');
            return (
              <Card key={r.rhk_id} style={{ gap: spacing.sm }}>
                {r.leading_sektor ? <Badge label={r.leading_sektor} tone="neutral" small /> : null}
                <T weight="semibold">{r.indikator_kinerja_individu ?? '-'}</T>
                {r.rhk_atasan ? <T variant="caption" tone="muted">RHK atasan: {r.rhk_atasan}</T> : null}
                <View style={[styles.target, { backgroundColor: colors.surfaceSecondary }]}>
                  <T variant="caption" tone="secondary">Target: {[r.target, r.satuan_hasil].filter(Boolean).join(' ') || '-'}</T>
                </View>
                <View style={styles.two}>
                  <Input label="Realisasi" value={d.v} onChangeText={(v) => setDraft((p) => ({ ...p, [r.rhk_id]: { ...d, v } }))} placeholder="mis. 4" containerStyle={{ flex: 1 }} />
                  <Input label="Keterangan" value={d.k} onChangeText={(k) => setDraft((p) => ({ ...p, [r.rhk_id]: { ...d, k } }))} placeholder="Opsional" containerStyle={{ flex: 2 }} />
                </View>
                {changed ? <Button title="Simpan realisasi" icon="save-outline" size="sm" loading={saving === r.rhk_id} disabled={!online} onPress={() => save(r)} /> : null}
              </Card>
            );
          })}
        </>
      )}
    </>
  );
}

function Rhk() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { online } = useNetwork();
  const takwim = useCached<{ year?: number } | null>('ekinerja.takwim', api.ekinerja.tahunTakwim, { staleTime: 60 * 60_000 });
  const year = takwim.data?.year ?? wibParts(Date.now()).year;
  const res = useCached<RhkItem[]>(`ekinerja.rhk.${year}`, () => api.ekinerja.rhk(year), { enabled: !takwim.loading });
  const [filter, setFilter] = useState<'saya' | 'tersedia'>('saya');
  const [busy, setBusy] = useState<string | null>(null);
  const list = (res.data ?? []).filter((r) => (filter === 'saya' ? r.claimed_by === user?.id : !r.claimed_by && !r.is_locked));

  const act = async (r: RhkItem, ambil: boolean) => {
    setBusy(r.id);
    try {
      if (ambil) await api.ekinerja.rhkClaim(r.id); else await api.ekinerja.rhkUnclaim(r.id);
      toast.success(ambil ? 'RHK diambil' : 'RHK dilepas');
      await qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('ekinerja.') });
    } catch (e) { toast.error(errorMessage(e, 'Gagal memperbarui RHK.')); } finally { setBusy(null); }
  };
  const lepas = (r: RhkItem) => Alert.alert('Lepas RHK?', 'Realisasi LCKB untuk RHK ini tidak lagi tampil pada LCKB Anda.', [
    { text: 'Batal', style: 'cancel' }, { text: 'Lepas', style: 'destructive', onPress: () => void act(r, false) },
  ]);

  return (
    <>
      <SegmentedControl<'saya' | 'tersedia'> small value={filter} onChange={setFilter}
        segments={[{ value: 'saya', label: `RHK saya (${(res.data ?? []).filter((r) => r.claimed_by === user?.id).length})` }, { value: 'tersedia', label: 'Tersedia' }]} />
      {res.loading ? <CardSkeleton lines={4} /> : res.error && !res.data ? (
        <ErrorState message={errorMessage(res.error, 'RHK belum bisa dimuat.')} onRetry={res.refresh} />
      ) : list.length === 0 ? (
        <Card><EmptyState icon="flag-outline" title={filter === 'saya' ? 'Belum mengambil RHK' : 'Tidak ada RHK tersedia'}
          message={filter === 'saya' ? 'Pilih tab Tersedia lalu ambil RHK yang menjadi tugas Anda.' : `RHK tahun ${year} disusun pimpinan di E-Kinerja.`} compact /></Card>
      ) : list.map((r) => (
        <Card key={r.id} style={{ gap: spacing.sm }}>
          <View style={styles.row}>
            {r.leading_sektor ? <Badge label={r.leading_sektor} tone="neutral" small /> : null}
            {r.is_locked ? <Badge label="Terkunci" icon="lock-closed-outline" tone="warning" small /> : null}
          </View>
          <T weight="semibold">{r.indikator_kinerja_individu ?? '-'}</T>
          {r.rhk_atasan ? <T variant="caption" tone="muted">RHK atasan: {r.rhk_atasan}</T> : null}
          <T variant="caption" tone="secondary">Target: {[r.target, r.satuan_hasil].filter(Boolean).join(' ') || '-'}{(r.bulan_berlaku ?? []).length ? ` · ${(r.bulan_berlaku ?? []).length} bulan` : ''}</T>
          {filter === 'saya'
            ? <Button title="Lepas RHK" icon="remove-circle-outline" variant="ghost" size="sm" loading={busy === r.id} disabled={!online || r.is_locked} onPress={() => lepas(r)} />
            : <Button title="Ambil RHK" icon="hand-left-outline" variant="outline" size="sm" loading={busy === r.id} disabled={!online} onPress={() => void act(r, true)} />}
        </Card>
      ))}
    </>
  );
}

function Links() {
  const router = useRouter();
  const qc = useQueryClient();
  const { online } = useNetwork();
  const res = useCached<JurnalLink[]>('ekinerja.links', api.ekinerja.links);
  const remove = (l: JurnalLink) => Alert.alert('Hapus link?', l.label, [
    { text: 'Batal', style: 'cancel' },
    {
      text: 'Hapus', style: 'destructive', onPress: async () => {
        try { await api.ekinerja.linkDelete(l.id); toast.success('Link dihapus'); await qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('ekinerja.') }); }
        catch (e) { toast.error(errorMessage(e, 'Gagal menghapus link.')); }
      },
    },
  ]);
  return (
    <>
      <T variant="caption" tone="muted">Simpan tautan folder/berkas bukti kerja (mis. Google Drive) sekali, lalu pilih saat mengisi jurnal harian.</T>
      <Button title="Tambah link" icon="add-circle-outline" variant="outline" disabled={!online} onPress={() => router.push('/ekinerja/link')} />
      {res.loading ? <CardSkeleton lines={3} /> : (res.data ?? []).length === 0 ? (
        <Card><EmptyState icon="link-outline" title="Belum ada link bukti dukung" message="Tambahkan link agar bisa dipilih di jurnal harian." compact /></Card>
      ) : (res.data ?? []).map((l) => (
        <Card key={l.id} style={{ gap: 4 }}>
          <T weight="semibold">{l.label}</T>
          <T variant="caption" tone="muted" numberOfLines={1}>{l.url}</T>
          <View style={styles.row}>
            <Button title="Buka" icon="open-outline" variant="ghost" size="sm" onPress={() => openUrl(l.url)} />
            <View style={{ flex: 1 }} />
            <Button title="Ubah" icon="create-outline" variant="ghost" size="sm" disabled={!online} onPress={() => router.push({ pathname: '/ekinerja/link', params: { id: l.id } })} />
            <Button title="Hapus" icon="trash-outline" variant="ghost" size="sm" disabled={!online} onPress={() => remove(l)} />
          </View>
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  today: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  target: { borderRadius: radius.md, padding: spacing.sm },
  two: { flexDirection: 'row', gap: spacing.sm },
});
