/**
 * Formulir catatan satpam pada satu izin (sama dengan FormCatatanIzin web). Catatan hanya dapat dibaca
 * kepala madrasah & kepala tata usaha, jadi isi yang sudah terkirim tidak ditampilkan — cukup konfirmasi.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { errorMessage } from '@/api/client';
import { spacing, useTheme } from '@/theme';
import { T } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';
import { formatTime } from '@/utils/time';
import { CATATAN_MAKS, izinApi, validasiCatatan } from './api';

export function FormCatatanIzin({ izinId, fokus = false }: { izinId: string; fokus?: boolean }) {
  const { colors } = useTheme();
  const [isi, setIsi] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [mengirim, setMengirim] = useState(false);
  const [terkirim, setTerkirim] = useState<string[]>([]);

  const kirim = async () => {
    const g = validasiCatatan(isi);
    setGalat(g || null);
    if (g) return;
    setMengirim(true);
    try {
      const h = await izinApi.kirimCatatan(izinId, isi);
      setTerkirim((t) => [...t, h.catatan.dibuat_pada]);
      setIsi('');
      toast.success('Catatan tersimpan', h.tiruan ? 'Contoh — belum tersimpan di server.' : undefined);
    } catch (e) {
      setGalat(errorMessage(e, 'Gagal menyimpan catatan. Periksa koneksi lalu coba lagi.'));
    } finally {
      setMengirim(false);
    }
  };

  return (
    <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
      <Input
        label="Catatan satpam"
        value={isi}
        onChangeText={(t) => { setIsi(t); if (galat) setGalat(null); }}
        placeholder="Mis. keluar pukul 09.05 dijemput keluarga."
        multiline
        autoFocus={fokus}
        maxLength={CATATAN_MAKS}
        editable={!mengirim}
        error={galat}
        hint={`${isi.length}/${CATATAN_MAKS} · hanya dibaca Kepala Madrasah & Kepala TU`}
      />
      {terkirim.length ? (
        <View style={styles.row}>
          <Icon name="checkmark-circle" size={16} color={colors.success} />
          <T variant="caption" color={colors.success}>
            {terkirim.length} catatan tersimpan · terakhir {formatTime(terkirim[terkirim.length - 1])} WIB
          </T>
        </View>
      ) : null}
      <Button title="Simpan catatan" icon="create-outline" loading={mengirim} disabled={!isi.trim()} onPress={kirim} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
