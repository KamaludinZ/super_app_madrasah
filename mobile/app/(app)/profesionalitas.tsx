/**
 * Profesionalitas GTK — native, sisi GTK dari /admin/gtk/profesionalitas (rekap penyusun tetap di web).
 * Per triwulan tahun takwim aktif: pengumpulan PDF Profesionalitas GTK & Riwayat Sertifikasi (tautan unggah +
 * konfirmasi), dan rekaman kegiatan/sertifikat milik sendiri (GET/POST/PUT/DELETE /ekinerja/sertifikasi).
 */
import React, { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { SertifikasiRecord } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useNetwork } from '@/store/network';
import { formatDateShort, wibParts } from '@/utils/time';
import { PERIODE_TRIWULAN, Pengumpulan, triwulanSekarang } from '@/ekinerja/Pengumpulan';
import { radius, spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { Input } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';

const KOSONG = { nama_kegiatan: '', penyelenggara: '', tanggal_mulai: '', tanggal_selesai: '', jumlah_jam: '' };

export default function Profesionalitas() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { online } = useNetwork();
  const takwim = useCached<{ year?: number } | null>('ekinerja.takwim', api.ekinerja.tahunTakwim, { staleTime: 60 * 60_000 });
  const year = takwim.data?.year ?? wibParts(Date.now()).year;
  const [tw, setTw] = useState(triwulanSekarang());
  const twLabel = PERIODE_TRIWULAN.find((p) => p.value === tw)?.label ?? tw;
  const key = `ekinerja.sertifikasi.${year}.${tw}`;
  const res = useCached<SertifikasiRecord[]>(key, () => api.ekinerja.sertifikasiMy(year, tw), { enabled: !takwim.loading });
  const [form, setForm] = useState<typeof KOSONG | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const buka = (r?: SertifikasiRecord) => {
    setEditId(r?.id ?? null);
    setForm(r ? { nama_kegiatan: r.nama_kegiatan, penyelenggara: r.penyelenggara ?? '', tanggal_mulai: r.tanggal_mulai ?? '', tanggal_selesai: r.tanggal_selesai ?? '', jumlah_jam: r.jumlah_jam ?? '' } : { ...KOSONG });
  };
  const simpan = async () => {
    if (!form) return;
    if (!form.nama_kegiatan.trim()) { toast.error('Nama kegiatan wajib diisi'); return; }
    setBusy(true);
    try {
      await api.ekinerja.sertifikasiSave(editId, {
        year, period: tw, nama_kegiatan: form.nama_kegiatan.trim(), penyelenggara: form.penyelenggara.trim() || null,
        tanggal_mulai: form.tanggal_mulai || null, tanggal_selesai: form.tanggal_selesai || null, jumlah_jam: form.jumlah_jam.trim() || null,
      });
      toast.success('Rekaman kegiatan tersimpan');
      setForm(null);
      await qc.invalidateQueries({ queryKey: [key] });
    } catch (e) { toast.error(errorMessage(e, 'Gagal menyimpan.')); } finally { setBusy(false); }
  };
  const hapus = (r: SertifikasiRecord) => Alert.alert('Hapus rekaman?', r.nama_kegiatan, [
    { text: 'Batal', style: 'cancel' },
    {
      text: 'Hapus', style: 'destructive', onPress: async () => {
        try { await api.ekinerja.sertifikasiDelete(r.id); toast.success('Rekaman dihapus'); await qc.invalidateQueries({ queryKey: [key] }); }
        catch (e) { toast.error(errorMessage(e, 'Gagal menghapus.')); }
      },
    },
  ]);

  return (
    <Screen title="Profesionalitas GTK" subtitle={`Pengembangan kompetensi · tahun ${year}`} back refreshing={res.refreshing} onRefresh={res.refresh}>
      <View style={{ gap: spacing.md }}>
        <SelectField label="Periode" value={tw} options={PERIODE_TRIWULAN} allowNone={false} icon="calendar-outline" onChange={(v) => v && setTw(v)} />
        <Pengumpulan type="profesionalitas_gtk" label="Profesionalitas GTK" year={year} period={tw} periodLabel={twLabel} />
        <Pengumpulan type="sertifikasi" label="Riwayat Sertifikasi" year={year} period={tw} periodLabel={twLabel} />

        <View style={styles.row}>
          <T variant="subtitle" style={{ flex: 1 }}>Kegiatan/sertifikat {twLabel}</T>
          <Button title="Tambah" icon="add" size="sm" disabled={!online} onPress={() => buka()} />
        </View>
        {res.loading ? <CardSkeleton lines={3} /> : (res.data ?? []).length === 0 ? (
          <Card><EmptyState icon="ribbon-outline" title="Belum ada rekaman" message="Catat pelatihan, diklat, atau seminar yang Anda ikuti pada periode ini." compact /></Card>
        ) : (res.data ?? []).map((r) => (
          <Card key={r.id} style={{ gap: 4 }}>
            <T weight="semibold">{r.nama_kegiatan}</T>
            <T variant="caption" tone="secondary">
              {[r.penyelenggara, r.tanggal_mulai ? `${formatDateShort(r.tanggal_mulai)}${r.tanggal_selesai && r.tanggal_selesai !== r.tanggal_mulai ? ` – ${formatDateShort(r.tanggal_selesai)}` : ''}` : null, r.jumlah_jam ? `${r.jumlah_jam} JP` : null].filter(Boolean).join(' · ') || '-'}
            </T>
            <View style={styles.row}>
              <View style={{ flex: 1 }} />
              <Button title="Ubah" icon="create-outline" variant="ghost" size="sm" disabled={!online} onPress={() => buka(r)} />
              <Button title="Hapus" icon="trash-outline" variant="ghost" size="sm" disabled={!online} onPress={() => hapus(r)} />
            </View>
          </Card>
        ))}
      </View>

      <Modal visible={!!form} transparent animationType="slide" onRequestClose={() => setForm(null)}>
        <Pressable style={styles.backdrop} onPress={() => setForm(null)} accessibilityLabel="Tutup" />
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.md }]}>
          <T variant="subtitle">{editId ? 'Ubah kegiatan' : 'Tambah kegiatan'}</T>
          {form ? (
            <>
              <Input label="Nama kegiatan *" value={form.nama_kegiatan} onChangeText={(v) => setForm({ ...form, nama_kegiatan: v })} placeholder="mis. Diklat Kurikulum Merdeka" />
              <Input label="Penyelenggara" value={form.penyelenggara} onChangeText={(v) => setForm({ ...form, penyelenggara: v })} />
              <View style={styles.two}>
                <DateField label="Mulai" value={form.tanggal_mulai || null} allowClear onChange={(v) => setForm({ ...form, tanggal_mulai: v ?? '' })} style={{ flex: 1 }} />
                <DateField label="Selesai" value={form.tanggal_selesai || null} min={form.tanggal_mulai || undefined} allowClear onChange={(v) => setForm({ ...form, tanggal_selesai: v ?? '' })} style={{ flex: 1 }} />
              </View>
              <Input label="Jumlah jam (JP)" value={form.jumlah_jam} onChangeText={(v) => setForm({ ...form, jumlah_jam: v })} keyboardType="number-pad" />
              <Button title="Simpan" icon="checkmark-circle-outline" loading={busy} disabled={!online} onPress={simpan} />
            </>
          ) : null}
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  two: { flexDirection: 'row', gap: spacing.sm },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
});
