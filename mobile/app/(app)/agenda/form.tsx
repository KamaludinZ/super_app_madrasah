/**
 * Tambah / ubah agenda (POST /staff-events, PUT /staff-events/{id}): nama, deskripsi, tanggal mulai–selesai,
 * jam, lokasi, kategori (guru/tendik), prioritas, dan tampil di halaman publik atau privat.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { StaffEvent } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useAuth } from '@/store/auth';
import { useNetwork } from '@/store/network';
import { todayISO } from '@/utils/time';
import { PRIORITIES, categoryOptions } from '@/agenda/options';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { SelectField } from '@/components/ui/SelectField';
import { TimeField, isValidTime } from '@/components/ui/TimeField';
import { toast } from '@/components/ui/Toast';

export default function AgendaForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { online } = useNetwork();
  const list = useCached<StaffEvent[]>('agenda.list', api.agenda.list, { enabled: !!id });
  const editing = id ? (list.data ?? []).find((x) => x.id === id) : undefined;
  const cats = categoryOptions(user?.roles);
  const [f, setF] = useState({
    event_name: '', description: '', date: todayISO(), end_date: '', start_time: '', end_time: '', location: '',
    category: cats[0].value, priority: 'normal', status: 'pending', is_public: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!editing) return;
    setF({
      event_name: editing.event_name ?? '', description: editing.description ?? '', date: editing.date, end_date: editing.end_date ?? '',
      start_time: editing.start_time ?? '', end_time: editing.end_time ?? '', location: editing.location ?? '',
      category: editing.category ?? cats[0].value, priority: editing.priority ?? 'normal', status: editing.status ?? 'pending',
      is_public: editing.is_public !== false,
    });
  }, [editing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    const fail = (m: string) => { setError(m); toast.error(m); };
    if (!f.event_name.trim() || !f.date || !f.start_time || !f.end_time) return fail('Nama kegiatan, tanggal, dan jam wajib diisi.');
    if (!isValidTime(f.start_time) || !isValidTime(f.end_time)) return fail('Jam ditulis JJ:MM, mis. 07:30.');
    if (f.end_date && f.end_date < f.date) return fail('Tanggal selesai tidak boleh sebelum tanggal mulai.');
    if ((!f.end_date || f.end_date === f.date) && f.end_time <= f.start_time) return fail('Jam selesai harus setelah jam mulai.');
    setError(null);
    setBusy(true);
    try {
      const body = { ...f, event_name: f.event_name.trim(), description: f.description.trim() || null, location: f.location.trim() || null, end_date: f.end_date || null };
      if (id) await api.agenda.update(id, body); else await api.agenda.create(body);
      toast.success(id ? 'Agenda diperbarui' : 'Agenda ditambahkan');
      await qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('agenda.') });
      router.back();
    } catch (e) {
      fail(errorMessage(e, 'Gagal menyimpan agenda.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={id ? 'Ubah Agenda' : 'Tambah Agenda'} back
      footer={<Button title="Simpan" icon="checkmark-circle-outline" size="lg" fullWidth loading={busy} disabled={!online} onPress={submit} />}>
      <View style={{ gap: spacing.md }}>
        <Card style={{ gap: spacing.md }}>
          <Input label="Nama kegiatan *" value={f.event_name} onChangeText={set('event_name')} placeholder="mis. Rapat dinas bulanan" />
          <Input label="Deskripsi" value={f.description} onChangeText={set('description')} multiline placeholder="Keterangan kegiatan (opsional)" />
          <View style={styles.two}>
            <DateField label="Tanggal mulai *" value={f.date} onChange={(v) => v && setF((p) => ({ ...p, date: v, end_date: p.end_date && p.end_date < v ? '' : p.end_date }))} style={{ flex: 1 }} />
            <DateField label="Tanggal selesai" value={f.end_date || null} min={f.date} allowClear placeholder="Sama" onChange={(v) => set('end_date')(v ?? '')} style={{ flex: 1 }} />
          </View>
          <View style={styles.two}>
            <TimeField label="Jam mulai *" value={f.start_time} onChange={set('start_time')} style={{ flex: 1 }} />
            <TimeField label="Jam selesai *" value={f.end_time} onChange={set('end_time')} placeholder="09:00" style={{ flex: 1 }} />
          </View>
          <Input label="Lokasi" icon="location-outline" value={f.location} onChangeText={set('location')} placeholder="mis. Aula madrasah" />
        </Card>
        <Card style={{ gap: spacing.md }}>
          <SelectField label="Kategori" value={f.category} options={cats} allowNone={false} icon="pricetag-outline" onChange={(v) => v && set('category')(v)} />
          <SelectField label="Prioritas" value={f.priority} options={PRIORITIES} allowNone={false} icon="flag-outline" onChange={(v) => v && set('priority')(v)} />
          <View style={styles.row}>
            <View style={{ flex: 1, gap: 2 }}>
              <T weight="medium">Tampilkan di agenda publik</T>
              <T variant="caption" tone="muted">{f.is_public ? 'Terlihat di halaman agenda publik madrasah.' : 'Hanya Anda dan admin yang melihat.'}</T>
            </View>
            <Switch value={f.is_public} onValueChange={set('is_public')} trackColor={{ true: colors.brandPrimary, false: colors.border }} />
          </View>
        </Card>
        {!online ? <Notice tone="warning" icon="cloud-offline-outline" text="Tidak ada koneksi. Menyimpan agenda memerlukan internet." /> : null}
        {error ? <Notice tone="error" icon="alert-circle-outline" text={error} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  two: { flexDirection: 'row', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
