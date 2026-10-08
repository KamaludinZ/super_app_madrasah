/**
 * Ajukan / ubah perizinan GTK (POST /gtk/izin, PUT /gtk/izin/{id}): jenis, rentang tanggal, keterangan,
 * dan tautan dokumen bukti (opsional, bisa menyusul).
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { GTKIzin } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useNetwork } from '@/store/network';
import { todayISO } from '@/utils/time';
import { spacing } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { SelectField } from '@/components/ui/SelectField';
import { toast } from '@/components/ui/Toast';
import { IZIN_LABELS } from './index';

export default function IzinForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { online } = useNetwork();
  const list = useCached<GTKIzin[]>('gtk.izin', api.gtk.izinMy, { enabled: !!id });
  const editing = id ? (list.data ?? []).find((x) => x.id === id) : undefined;
  const [jenis, setJenis] = useState('sakit');
  const [mulai, setMulai] = useState(todayISO());
  const [selesai, setSelesai] = useState(todayISO());
  const [ket, setKet] = useState('');
  const [dok, setDok] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    setJenis(editing.jenis); setMulai(editing.tanggal_mulai); setSelesai(editing.tanggal_selesai);
    setKet(editing.keterangan ?? ''); setDok(editing.dokumen_url ?? '');
  }, [editing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    const fail = (m: string) => { setError(m); toast.error(m); };
    if (mulai > selesai) return fail('Tanggal mulai harus sebelum atau sama dengan tanggal selesai.');
    const url = dok.trim();
    if (url && !/^https?:\/\//i.test(url)) return fail('Tautan dokumen harus diawali http:// atau https://');
    setError(null);
    setBusy(true);
    try {
      const body = { jenis, tanggal_mulai: mulai, tanggal_selesai: selesai, keterangan: ket.trim() || null, dokumen_url: url || null };
      if (id) await api.gtk.izinUpdate(id, body); else await api.gtk.izinCreate(body);
      toast.success(id ? 'Data izin diperbarui' : 'Izin diajukan');
      await qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('gtk.') });
      router.back();
    } catch (e) {
      fail(errorMessage(e, 'Gagal menyimpan data izin.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={id ? 'Ubah Perizinan' : 'Ajukan Perizinan'} back
      footer={<Button title="Simpan" icon="checkmark-circle-outline" size="lg" fullWidth loading={busy} disabled={!online} onPress={submit} />}>
      <Card style={{ gap: spacing.md }}>
        <SelectField label="Jenis izin *" value={jenis} allowNone={false} icon="pricetag-outline"
          options={Object.entries(IZIN_LABELS).map(([value, label]) => ({ value, label }))} onChange={(v) => v && setJenis(v)} />
        <View style={styles.two}>
          <DateField label="Tanggal mulai *" value={mulai} onChange={(v) => { if (v) { setMulai(v); if (v > selesai) setSelesai(v); } }} style={{ flex: 1 }} />
          <DateField label="Tanggal selesai *" value={selesai} min={mulai} onChange={(v) => v && setSelesai(v)} style={{ flex: 1 }} />
        </View>
        <Input label="Keterangan" value={ket} onChangeText={setKet} multiline placeholder="Keterangan tambahan (opsional)" />
        <Input label="Dokumen bukti (tautan)" icon="link-outline" value={dok} onChangeText={setDok} autoCapitalize="none" autoCorrect={false}
          keyboardType="url" placeholder="https://drive.google.com/…" hint="Opsional, bisa menyusul. Unggah surat ke Google Drive lalu tempel tautannya." />
      </Card>
      {!online ? <View style={{ marginTop: spacing.md }}><Notice tone="warning" icon="cloud-offline-outline" text="Tidak ada koneksi. Menyimpan izin memerlukan internet." /></View> : null}
      {error ? <View style={{ marginTop: spacing.md }}><Notice tone="error" icon="alert-circle-outline" text={error} /></View> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  two: { flexDirection: 'row', gap: spacing.sm },
});
