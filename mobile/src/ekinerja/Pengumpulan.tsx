/**
 * Kartu pengumpulan dokumen E-Kinerja untuk GTK (sama dengan PengumpulanPanel web, sisi non-penyusun):
 * tautan unggah PDF yang disiapkan admin/KTU untuk jenis+tahun+periode (GET /ekinerja/pengumpulan/status),
 * tombol buka tautan, dan konfirmasi "Sudah upload" / batalkan (PUT/DELETE /ekinerja/pengumpulan/confirm).
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { PengumpulanStatus } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useNetwork } from '@/store/network';
import { formatDateTime } from '@/utils/time';
import { spacing } from '@/theme';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import { openUrl } from '@/components/RichText';

export const PERIODE_TRIWULAN = [
  { value: 'TW1', label: 'Triwulan 1 (Jan–Mar)' }, { value: 'TW2', label: 'Triwulan 2 (Apr–Jun)' },
  { value: 'TW3', label: 'Triwulan 3 (Jul–Sep)' }, { value: 'TW4', label: 'Triwulan 4 (Okt–Des)' }, { value: 'TAHUNAN', label: 'Tahunan' },
];
export const triwulanSekarang = () => `TW${Math.floor(new Date().getMonth() / 3) + 1}`;

export function Pengumpulan({ type, label, year, period, periodLabel }: { type: string; label: string; year: number; period: string; periodLabel: string }) {
  const qc = useQueryClient();
  const { online } = useNetwork();
  const key = `ekinerja.kumpul.${type}.${year}.${period}`;
  const res = useCached<PengumpulanStatus>(key, () => api.ekinerja.pengumpulan(type, year, period));
  const [busy, setBusy] = useState(false);
  const s = res.data;

  const konfirmasi = async (sudah: boolean) => {
    setBusy(true);
    try {
      await api.ekinerja.konfirmasi(type, year, period, sudah);
      toast.success(sudah ? `Konfirmasi upload ${label} tersimpan` : 'Konfirmasi dibatalkan');
      await qc.invalidateQueries({ queryKey: [key] });
    } catch (e) { toast.error(errorMessage(e, 'Gagal menyimpan konfirmasi.')); } finally { setBusy(false); }
  };

  if (res.loading) return <CardSkeleton lines={2} />;
  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={styles.row}>
        <T weight="semibold" style={{ flex: 1 }}>Upload PDF {label} · {periodLabel} {year}</T>
        {s?.sudah_upload ? <Badge label="Sudah upload" icon="checkmark-circle-outline" tone="success" small /> : null}
      </View>
      {s?.link_url ? (
        <>
          <T variant="caption" tone="muted" numberOfLines={1}>{s.link_url}</T>
          <View style={styles.row}>
            <Button title="Buka tautan upload" icon="open-outline" variant="outline" size="sm" onPress={() => openUrl(s.link_url!)} style={{ flex: 1 }} />
            {s.sudah_upload
              ? <Button title="Batalkan" variant="ghost" size="sm" loading={busy} disabled={!online} onPress={() => konfirmasi(false)} />
              : <Button title="Sudah upload" icon="checkmark" size="sm" loading={busy} disabled={!online} onPress={() => konfirmasi(true)} />}
          </View>
          {s.sudah_upload && s.confirmed_at ? <T variant="small" tone="muted">Dikonfirmasi {formatDateTime(s.confirmed_at)}</T> : null}
        </>
      ) : (
        <T variant="caption" tone="muted">Tautan upload belum disiapkan admin/KTU untuk periode ini.</T>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm } });
