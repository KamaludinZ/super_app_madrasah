/**
 * Rincian satu izin sebagai lembar bawah, hanya-lihat: tidak ada tombol setujui/tolak/batalkan atau
 * menandai jam keluar/kembali (sama dengan DetailIzinDialog di web). `bolehCatat` (satpam, izin disetujui)
 * menampilkan formulir catatan satpam. `izin` = null menutup lembar.
 */
import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, useTheme } from '@/theme';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { InfoRow } from '@/components/ui/InfoRow';
import { formatDateLong, formatDateTime, todayISO } from '@/utils/time';
import { roleLabel } from '@/utils/roles';
import { Izin, STATUS_IZIN, WAKTU_IZIN, teksDurasi, waktuIzin } from './api';
import { FormCatatanIzin } from './FormCatatanIzin';
import { CatatanIzinTerbatas } from './CatatanIzinTerbatas';

export function DetailIzinSheet({ izin, jam, onTutup, bolehCatat = false, fokusCatatan = false, onBatalkan, onSetujui, onTolak, sibuk = false }: {
  izin: Izin | null; jam: string; onTutup: () => void; bolehCatat?: boolean; fokusCatatan?: boolean;
  onBatalkan?: (izin: Izin) => void; onSetujui?: (izin: Izin) => void; onTolak?: (izin: Izin) => void; sibuk?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const s = izin ? STATUS_IZIN[izin.status] ?? STATUS_IZIN.menunggu : null;
  const w = izin && izin.status === 'disetujui' && izin.tanggal === todayISO() ? WAKTU_IZIN[waktuIzin(izin, jam)] : null;
  const diputuskan = izin && (izin.status === 'disetujui' || izin.status === 'ditolak');
  const tampilCatatan = bolehCatat && izin?.status === 'disetujui';
  const bisaBatal = !!onBatalkan && izin?.status === 'menunggu';
  const bisaPutus = !!onSetujui && !!onTolak && izin?.status === 'menunggu';

  return (
    <Modal visible={!!izin} transparent animationType="slide" onRequestClose={onTutup}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.backdrop} onPress={onTutup} accessibilityLabel="Tutup detail izin" />
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.md }]}>
          {izin && s ? (
            <ScrollView contentContainerStyle={{ gap: spacing.md }} keyboardShouldPersistTaps="handled">
              <View style={styles.head}>
                <T variant="subtitle" style={{ flex: 1 }}>Detail izin</T>
                {w ? <Badge label={w.label} tone={w.tone} small /> : null}
                <Badge label={s.label} tone={s.tone} small />
              </View>
              <View style={styles.info}>
                <Icon name="eye-outline" size={14} color={colors.muted} />
                <T variant="small" tone="muted">
                  {tampilCatatan ? 'Hanya-lihat — izin tidak dapat diubah, tetapi Anda dapat menambah catatan.'
                    : bisaBatal ? 'Pengajuan Anda masih menunggu keputusan; Anda dapat membatalkannya.'
                      : bisaPutus ? 'Pengajuan ini menunggu keputusan Anda.'
                      : 'Hanya-lihat — tidak ada aksi pada izin ini.'}
                </T>
              </View>

              <View style={{ gap: spacing.sm }}>
                <InfoRow label="Pengaju" value={izin.pengaju_nama} />
                <InfoRow label="Peran" value={roleLabel(izin.pengaju_peran)} />
                <InfoRow label="Tanggal" value={formatDateLong(izin.tanggal)} />
                <InfoRow label="Jam" value={`${izin.jam_mulai}–${izin.jam_selesai} WIB${teksDurasi(izin.jam_mulai, izin.jam_selesai) ? ` (${teksDurasi(izin.jam_mulai, izin.jam_selesai)})` : ''}`} />
                <InfoRow label="Keperluan" value={izin.keperluan} />
                {izin.dibuat_pada ? <InfoRow label="Diajukan" value={formatDateTime(izin.dibuat_pada)} /> : null}
                {diputuskan ? (
                  <InfoRow label="Diputuskan" value={`${izin.diputuskan_oleh_nama || '-'}${izin.diputuskan_pada ? ` · ${formatDateTime(izin.diputuskan_pada)}` : ''}`} />
                ) : null}
                {izin.status === 'ditolak' ? <InfoRow label="Alasan ditolak" value={izin.alasan_penolakan || '-'} /> : null}
              </View>

              {tampilCatatan ? <FormCatatanIzin key={izin.id} izinId={izin.id} fokus={fokusCatatan} /> : null}
              {izin.status === 'disetujui' ? <CatatanIzinTerbatas izinId={izin.id} /> : null}

              {bisaPutus ? (
                <View style={styles.dua}>
                  <Button title="Tolak" icon="close-circle-outline" variant="outline" textColor={colors.error} disabled={sibuk}
                    onPress={() => onTolak!(izin)} style={{ flex: 1 }} />
                  <Button title="Setujui" icon="checkmark-circle-outline" loading={sibuk} onPress={() => onSetujui!(izin)} style={{ flex: 1 }} />
                </View>
              ) : null}
              {bisaBatal ? (
                <Button title={sibuk ? 'Membatalkan…' : 'Batalkan pengajuan'} icon="close-circle-outline" variant="outline"
                  textColor={colors.error} loading={sibuk} onPress={() => onBatalkan!(izin)} />
              ) : null}
              <Button title="Tutup" variant="outline" onPress={onTutup} />
            </ScrollView>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dua: { flexDirection: 'row', gap: spacing.sm },
  info: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -spacing.sm },
});
