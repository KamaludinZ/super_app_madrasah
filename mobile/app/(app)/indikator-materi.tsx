/**
 * Indikator & Materi (guru) — native, pengganti /guru/indikator-materi. Semester aktif, filter mapel dari jadwal
 * mengajar; tab KD/Indikator (kode, nama, tingkat) & Materi/Pokok Bahasan (nama, deskripsi, tingkat, indikator
 * terkait) milik sendiri: tambah, ubah, hapus (/indikator, /materi). Data ini dipakai sebagai pilihan saat
 * mengisi jurnal. Impor Excel massal tetap lewat web.
 */
import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { IndikatorFull, MateriFull, ScheduleItem, SemesterItem } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useAuth } from '@/store/auth';
import { useNetwork } from '@/store/network';
import { ajaran } from '@/kelas/guru';
import { radius, spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SelectField } from '@/components/ui/SelectField';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';

const TINGKAT = ['VII', 'VIII', 'IX'].map((t) => ({ value: t, label: `Kelas ${t}` }));
type Tab = 'indikator' | 'materi';
type Form = { id: string | null; kode: string; nama: string; deskripsi: string; mapel_id: string | null; tingkat: string | null; indikator_id: string | null };

export default function IndikatorMateri() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { online } = useNetwork();
  const semesters = useCached<SemesterItem[]>('akademik.semesters', api.akademik.semesters, { staleTime: 60 * 60_000 });
  const sem = (semesters.data ?? []).find((s) => s.is_active);
  const jadwal = useCached<ScheduleItem[]>(`jadwal.t.${user?.id}`, () => api.schedules.grouped({ teacher_id: user?.id }), { enabled: !!user?.id, staleTime: 10 * 60_000 });
  const { mapel } = useMemo(() => ajaran(jadwal.data), [jadwal.data]);
  const ind = useCached<IndikatorFull[]>(`akademik.indikator.${sem?.id}`, () => api.akademik.indikatorSaya(sem!.id), { enabled: !!sem });
  const mat = useCached<MateriFull[]>(`akademik.materi.${sem?.id}`, () => api.akademik.materiSaya(sem!.id), { enabled: !!sem });
  const [tab, setTab] = useState<Tab>('indikator');
  const [mapelId, setMapelId] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  const namaMapel = (id?: string) => mapel.find((m) => m.value === id)?.label ?? 'Mapel lain';
  const indList = (ind.data ?? []).filter((i) => !mapelId || i.mapel_id === mapelId).sort((a, b) => (a.kode ?? '').localeCompare(b.kode ?? '', undefined, { numeric: true }));
  const matList = (mat.data ?? []).filter((m) => !mapelId || m.mapel_id === mapelId);
  const indById = new Map((ind.data ?? []).map((i) => [i.id, i]));
  const invalidate = () => qc.invalidateQueries({ predicate: (q) => /^akademik\.(indikator|materi)\./.test(String(q.queryKey[0])) });

  const buka = (x?: IndikatorFull | MateriFull) => setForm({
    id: x?.id ?? null, kode: (x as IndikatorFull)?.kode ?? '', nama: x?.nama ?? '', deskripsi: (x as MateriFull)?.deskripsi ?? '',
    mapel_id: x?.mapel_id ?? mapelId ?? (mapel.length === 1 ? mapel[0].value : null), tingkat: x?.tingkat_kelas ?? null,
    indikator_id: (x as MateriFull)?.indikator_id ?? null,
  });

  const simpan = async () => {
    if (!form || !sem) return;
    if (!form.mapel_id) { toast.error('Pilih mata pelajaran'); return; }
    if (!form.nama.trim() || (tab === 'indikator' && !form.kode.trim())) { toast.error(tab === 'indikator' ? 'Kode dan nama indikator wajib diisi' : 'Nama materi wajib diisi'); return; }
    setBusy(true);
    try {
      if (tab === 'indikator') {
        await api.akademik.indikatorSave(form.id, { kode: form.kode.trim(), nama: form.nama.trim(), mapel_id: form.mapel_id, semester_id: sem.id, tingkat_kelas: form.tingkat });
      } else {
        await api.akademik.materiSave(form.id, { nama: form.nama.trim(), deskripsi: form.deskripsi.trim() || null, mapel_id: form.mapel_id, semester_id: sem.id, tingkat_kelas: form.tingkat, indikator_id: form.indikator_id });
      }
      toast.success('Tersimpan');
      setForm(null);
      await invalidate();
    } catch (e) { toast.error(errorMessage(e, 'Gagal menyimpan.')); } finally { setBusy(false); }
  };

  const hapus = (id: string, nama: string) => Alert.alert(`Hapus ${tab === 'indikator' ? 'indikator' : 'materi'}?`, nama, [
    { text: 'Batal', style: 'cancel' },
    {
      text: 'Hapus', style: 'destructive', onPress: async () => {
        try {
          if (tab === 'indikator') await api.akademik.indikatorDelete(id); else await api.akademik.materiDelete(id);
          toast.success('Dihapus'); await invalidate();
        } catch (e) { toast.error(errorMessage(e, 'Gagal menghapus.')); }
      },
    },
  ]);

  const loading = semesters.loading || (tab === 'indikator' ? ind.loading : mat.loading);
  return (
    <Screen title="Indikator & Materi" subtitle={sem ? `Semester aktif: ${sem.name ?? sem.code ?? ''}${sem.academic_year_name ? ` · ${sem.academic_year_name}` : ''}` : 'Pilihan KD & materi untuk jurnal'} back
      refreshing={ind.refreshing || mat.refreshing} onRefresh={() => { void ind.refresh(); void mat.refresh(); }}
      footer={sem ? <Button title={tab === 'indikator' ? 'Tambah indikator' : 'Tambah materi'} icon="add-circle-outline" size="lg" fullWidth disabled={!online} onPress={() => buka()} /> : undefined}>
      <View style={{ gap: spacing.md }}>
        <SegmentedControl<Tab> value={tab} onChange={setTab} segments={[{ value: 'indikator', label: `KD/Indikator (${indList.length})` }, { value: 'materi', label: `Materi (${matList.length})` }]} />
        <SelectField label="Mata pelajaran" value={mapelId} options={mapel} icon="book-outline" noneLabel="Semua mapel" placeholder="Semua mapel" onChange={setMapelId} />
        {!semesters.loading && !sem ? <Notice tone="warning" icon="alert-circle-outline" text="Belum ada semester aktif. Hubungi admin." /> : null}
        {loading ? <CardSkeleton lines={4} /> : tab === 'indikator' ? (
          indList.length === 0 ? <Card><EmptyState icon="list-outline" title="Belum ada KD/indikator" message="Tambahkan agar bisa dipilih saat mengisi jurnal mengajar." compact /></Card>
            : indList.map((i) => (
              <Card key={i.id} style={{ gap: 4 }}>
                <View style={styles.row}>
                  <Badge label={i.kode ?? '-'} tone="brand" small />
                  <T variant="caption" tone="muted" style={{ flex: 1 }}>{namaMapel(i.mapel_id)}{i.tingkat_kelas ? ` · Kelas ${i.tingkat_kelas}` : ''}</T>
                </View>
                <T>{i.nama}</T>
                <View style={styles.row}>
                  <View style={{ flex: 1 }} />
                  <Button title="Ubah" icon="create-outline" variant="ghost" size="sm" disabled={!online} onPress={() => buka(i)} />
                  <Button title="Hapus" icon="trash-outline" variant="ghost" size="sm" disabled={!online} onPress={() => hapus(i.id, i.nama ?? '')} />
                </View>
              </Card>
            ))
        ) : (
          matList.length === 0 ? <Card><EmptyState icon="library-outline" title="Belum ada materi" message="Tambahkan pokok bahasan agar bisa dipilih saat mengisi jurnal." compact /></Card>
            : matList.map((m) => (
              <Card key={m.id} style={{ gap: 4 }}>
                <T variant="caption" tone="muted">{namaMapel(m.mapel_id)}{m.tingkat_kelas ? ` · Kelas ${m.tingkat_kelas}` : ''}{m.indikator_id && indById.get(m.indikator_id) ? ` · ${indById.get(m.indikator_id)!.kode}` : ''}</T>
                <T weight="medium">{m.nama}</T>
                {m.deskripsi ? <T variant="caption" tone="secondary">{m.deskripsi}</T> : null}
                <View style={styles.row}>
                  <View style={{ flex: 1 }} />
                  <Button title="Ubah" icon="create-outline" variant="ghost" size="sm" disabled={!online} onPress={() => buka(m)} />
                  <Button title="Hapus" icon="trash-outline" variant="ghost" size="sm" disabled={!online} onPress={() => hapus(m.id, m.nama)} />
                </View>
              </Card>
            ))
        )}
      </View>

      <Modal visible={!!form} transparent animationType="slide" onRequestClose={() => setForm(null)}>
        <Pressable style={styles.backdrop} onPress={() => setForm(null)} accessibilityLabel="Tutup" />
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.md }]}>
          <ScrollView contentContainerStyle={{ gap: spacing.md }} keyboardShouldPersistTaps="handled">
            <T variant="subtitle">{form?.id ? 'Ubah' : 'Tambah'} {tab === 'indikator' ? 'KD/Indikator' : 'Materi'}</T>
            {form ? (
              <>
                <SelectField label="Mata pelajaran *" value={form.mapel_id} options={mapel} allowNone={false} icon="book-outline" onChange={(v) => setForm({ ...form, mapel_id: v })} />
                <SelectField label="Tingkat kelas" value={form.tingkat} options={TINGKAT} noneLabel="Semua tingkat" icon="layers-outline" onChange={(v) => setForm({ ...form, tingkat: v })} />
                {tab === 'indikator' ? <Input label="Kode *" value={form.kode} onChangeText={(v) => setForm({ ...form, kode: v })} placeholder="mis. 3.1" autoCapitalize="none" /> : null}
                <Input label={tab === 'indikator' ? 'Nama indikator *' : 'Nama materi *'} value={form.nama} onChangeText={(v) => setForm({ ...form, nama: v })} multiline />
                {tab === 'materi' ? (
                  <>
                    <Input label="Deskripsi" value={form.deskripsi} onChangeText={(v) => setForm({ ...form, deskripsi: v })} multiline placeholder="Opsional" />
                    <SelectField label="Indikator terkait" value={form.indikator_id} icon="link-outline" noneLabel="Tidak terkait"
                      options={(ind.data ?? []).filter((i) => i.mapel_id === form.mapel_id).map((i) => ({ value: i.id, label: `${i.kode} · ${i.nama}` }))}
                      onChange={(v) => setForm({ ...form, indikator_id: v })} />
                  </>
                ) : null}
                <Button title="Simpan" icon="checkmark-circle-outline" loading={busy} disabled={!online} onPress={simpan} />
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { maxHeight: '85%', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
});
