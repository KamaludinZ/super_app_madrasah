/** Lembar tolak izin (kepala madrasah): alasan wajib 5–300 karakter, terlihat oleh pengaju. */
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, useTheme } from '@/theme';
import { T } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { roleLabel } from '@/utils/roles';
import { formatDateShort } from '@/utils/time';
import { ALASAN_TOLAK_MAKS, Izin, validasiAlasanTolak } from './api';

export function TolakIzinSheet({ izin, onTutup, onTolak }: {
  izin: Izin | null; onTutup: () => void; onTolak: (izin: Izin, alasan: string) => Promise<boolean>;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [alasan, setAlasan] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => { if (izin) { setAlasan(''); setGalat(null); } }, [izin?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const kirim = async () => {
    if (!izin) return;
    const g = validasiAlasanTolak(alasan);
    setGalat(g || null);
    if (g) return;
    setSibuk(true);
    const ok = await onTolak(izin, alasan.trim());
    setSibuk(false);
    if (ok) onTutup();
  };

  return (
    <Modal visible={!!izin} transparent animationType="slide" onRequestClose={() => { if (!sibuk) onTutup(); }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.backdrop} onPress={() => { if (!sibuk) onTutup(); }} accessibilityLabel="Tutup" />
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.md }]}>
          {izin ? (
            <ScrollView contentContainerStyle={{ gap: spacing.md }} keyboardShouldPersistTaps="handled">
              <T variant="subtitle">Tolak izin</T>
              <View style={[styles.ringkas, { backgroundColor: colors.surfaceSecondary }]}>
                <T weight="semibold">{izin.pengaju_nama} <T variant="small" tone="muted">{roleLabel(izin.pengaju_peran)}</T></T>
                <T variant="small" tone="muted">{formatDateShort(izin.tanggal)} · {izin.jam_mulai}–{izin.jam_selesai}</T>
                <T variant="caption">{izin.keperluan}</T>
              </View>
              <Input label="Alasan penolakan *" value={alasan} onChangeText={(t) => { setAlasan(t); if (galat) setGalat(null); }}
                multiline autoFocus maxLength={ALASAN_TOLAK_MAKS} editable={!sibuk} error={galat}
                placeholder="Mis. Bertepatan dengan rapat dinas; mohon ajukan di hari lain."
                hint={`${alasan.length}/${ALASAN_TOLAK_MAKS} · terlihat oleh pengaju`} />
              <View style={styles.dua}>
                <Button title="Batal" variant="outline" disabled={sibuk} onPress={onTutup} style={{ flex: 1 }} />
                <Button title="Tolak izin" icon="close-circle-outline" loading={sibuk} onPress={kirim} style={{ flex: 1, backgroundColor: colors.error }} />
              </View>
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
  ringkas: { borderRadius: radius.md, padding: spacing.md, gap: 2 },
  dua: { flexDirection: 'row', gap: spacing.sm },
});
