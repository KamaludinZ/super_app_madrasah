/**
 * Tambah / ubah entri jurnal harian E-Kinerja (POST/PUT /ekinerja/jurnal-harian): uraian kegiatan, volume,
 * satuan hasil, link bukti dukung. Tanggal entri baru otomatis hari ini (server, WIB).
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { JurnalHarian, JurnalLink } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useNetwork } from '@/store/network';
import { formatDateLong, todayISO } from '@/utils/time';
import { spacing } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { SelectField } from '@/components/ui/SelectField';
import { toast } from '@/components/ui/Toast';

export default function JurnalForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { online } = useNetwork();
  const list = useCached<JurnalHarian[]>('ekinerja.jurnal', api.ekinerja.jurnalMy, { enabled: !!id });
  const links = useCached<JurnalLink[]>('ekinerja.links', api.ekinerja.links);
  const editing = id ? (list.data ?? []).find((e) => e.id === id) : undefined;
  const [uraian, setUraian] = useState('');
  const [volume, setVolume] = useState('');
  const [satuan, setSatuan] = useState('');
  const [linkId, setLinkId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    setUraian(editing.uraian_kegiatan); setVolume(editing.volume ?? ''); setSatuan(editing.satuan_hasil ?? ''); setLinkId(editing.link_id ?? null);
  }, [editing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!uraian.trim()) { setError('Uraian kegiatan wajib diisi.'); toast.error('Uraian kegiatan wajib diisi.'); return; }
    setError(null);
    setBusy(true);
    try {
      const body = { uraian_kegiatan: uraian.trim(), volume: volume.trim() || null, satuan_hasil: satuan.trim() || null, link_id: linkId };
      if (id) await api.ekinerja.jurnalUpdate(id, body); else await api.ekinerja.jurnalCreate(body);
      toast.success(id ? 'Jurnal diperbarui' : 'Kegiatan tercatat');
      await qc.invalidateQueries({ queryKey: ['ekinerja.jurnal'] });
      router.back();
    } catch (e) {
      const m = errorMessage(e, 'Gagal menyimpan jurnal.'); setError(m); toast.error(m);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={id ? 'Ubah Jurnal Harian' : 'Tambah Jurnal Harian'} subtitle={formatDateLong(editing?.tanggal ?? todayISO())} back
      footer={<Button title="Simpan" icon="checkmark-circle-outline" size="lg" fullWidth loading={busy} disabled={!online} onPress={submit} />}>
      <View style={{ gap: spacing.md }}>
        <Card style={{ gap: spacing.md }}>
          <Input label="Uraian kegiatan *" value={uraian} onChangeText={setUraian} multiline placeholder="mis. Menyusun laporan inventaris lab IPA" />
          <View style={styles.two}>
            <Input label="Volume" value={volume} onChangeText={setVolume} placeholder="mis. 1" containerStyle={{ flex: 1 }} />
            <Input label="Satuan hasil" value={satuan} onChangeText={setSatuan} placeholder="mis. dokumen" containerStyle={{ flex: 2 }} />
          </View>
          <SelectField label="Link bukti dukung" value={linkId} icon="link-outline" noneLabel="Tanpa link"
            options={(links.data ?? []).map((l) => ({ value: l.id, label: l.label, description: l.url }))} onChange={setLinkId}
            placeholder={(links.data ?? []).length ? 'Pilih link (opsional)' : 'Belum ada link — tambah di tab Link Bukti'} />
          {!id ? <T variant="caption" tone="muted">Tanggal kegiatan otomatis hari ini.</T> : null}
        </Card>
        {!online ? <Notice tone="warning" icon="cloud-offline-outline" text="Tidak ada koneksi. Menyimpan jurnal memerlukan internet." /> : null}
        {error ? <Notice tone="error" icon="alert-circle-outline" text={error} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ two: { flexDirection: 'row', gap: spacing.sm } });
