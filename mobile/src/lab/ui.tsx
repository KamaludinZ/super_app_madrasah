/**
 * Komponen bersama layar Lab: lembar formulir (modal bawah, aman dari keyboard), pemilih aset lab
 * (alat/bahan + ruang lab itu sendiri), pencari warga madrasah (peminjam), dan baris rincian.
 */
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { labApi, AlatBahanList, Warga } from './api';
import { useCached } from '@/hooks/useCached';
import { radius, spacing, useTheme } from '@/theme';
import { T } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/SelectField';
import { SearchBox } from '@/pantau/ui';

export function FormSheet({ judul, buka, onTutup, onSimpan, sibuk, children, labelSimpan = 'Simpan' }: {
  judul: string; buka: boolean; onTutup: () => void; onSimpan: () => void; sibuk?: boolean; children: React.ReactNode; labelSimpan?: string;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={buka} transparent animationType="slide" onRequestClose={onTutup}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.backdrop} onPress={onTutup} accessibilityLabel="Tutup" />
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.md }]}>
          <ScrollView contentContainerStyle={{ gap: spacing.md }} keyboardShouldPersistTaps="handled">
            <T variant="subtitle">{judul}</T>
            {children}
            <Button title={labelSimpan} icon="checkmark-circle-outline" loading={sibuk} onPress={onSimpan} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Nilai pilihan aset: "tipe:id" (tetap | lancar | room). */
export const kodeAset = (tipe: string, id: string) => `${tipe}:${id}`;
export const pecahAset = (v: string | null) => { const [tipe, ...rest] = (v ?? '').split(':'); return { aset_tipe: tipe, aset_id: rest.join(':') }; };

export function AsetSelect({ lab, value, onChange, denganRuang, hanyaAlat }: { lab: string; value: string | null; onChange: (v: string | null) => void; denganRuang?: boolean; hanyaAlat?: boolean }) {
  const res = useCached<AlatBahanList>(`lab.${lab}.alat-bahan`, () => labApi.alatBahan(lab));
  const opsi = [
    ...(denganRuang && res.data?.room ? [{ value: kodeAset('room', res.data.room.id), label: `Ruang ${res.data.room.name}`, description: 'Ruangan lab' }] : []),
    ...(res.data?.items ?? []).filter((i) => !hanyaAlat || i.aset_tipe === 'tetap').map((i) => ({
      value: kodeAset(i.aset_tipe, i.id), label: i.nama,
      description: i.aset_tipe === 'tetap' ? `Alat · baik ${i.jumlah_baik ?? 0}, rusak ${i.jumlah_rusak ?? 0}` : `Bahan · stok ${i.stok ?? 0} ${i.satuan ?? ''}`,
    })),
  ];
  return <SelectField label="Alat / bahan *" value={value} options={opsi} allowNone={false} icon="flask-outline" onChange={onChange}
    hint={res.loading ? 'Memuat daftar alat…' : opsi.length ? undefined : 'Belum ada alat/bahan di lab ini.'} />;
}

export function WargaPicker({ lab, terpilih, onPilih }: { lab: string; terpilih: { id: string; nama: string } | null; onPilih: (w: { id: string; nama: string } | null) => void }) {
  const { colors } = useTheme();
  const [q, setQ] = useState('');
  const [hasil, setHasil] = useState<Warga[]>([]);
  useEffect(() => {
    const kata = q.trim();
    if (kata.length < 3) { setHasil([]); return undefined; }
    const t = setTimeout(() => { labApi.warga(lab, kata).then((r) => setHasil(r.slice(0, 8))).catch(() => setHasil([])); }, 400);
    return () => clearTimeout(t);
  }, [q, lab]);
  if (terpilih) {
    return (
      <View style={[styles.pilih, { borderColor: colors.brandPrimary }]}>
        <View style={{ flex: 1 }}>
          <T variant="small" tone="muted">Peminjam</T>
          <T weight="medium">{terpilih.nama}</T>
        </View>
        <Button title="Ganti" variant="ghost" size="sm" onPress={() => onPilih(null)} />
      </View>
    );
  }
  return (
    <View style={{ gap: spacing.xs }}>
      <T variant="label" tone="secondary">Peminjam * (siswa/GTK)</T>
      <SearchBox value={q} onChange={setQ} placeholder="Ketik min. 3 huruf nama…" />
      {hasil.map((w) => (
        <Pressable key={w.id} onPress={() => { onPilih({ id: w.id, nama: w.full_name }); setQ(''); }} accessibilityRole="button"
          style={[styles.hasil, { borderBottomColor: colors.divider }]}>
          <T weight="medium">{w.full_name}</T>
          <T variant="small" tone="muted">{(w.roles ?? []).includes('siswa') ? `Siswa${w.nis ? ` · NIS ${w.nis}` : ''}` : 'GTK'}</T>
        </Pressable>
      ))}
    </View>
  );
}

export function Baris({ label, value }: { label: string; value?: string | number | null }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <View style={styles.baris}>
      <T variant="caption" tone="muted" style={{ width: 110 }}>{label}</T>
      <T variant="caption" style={{ flex: 1 }}>{String(value)}</T>
    </View>
  );
}

export const rupiah = (n?: number | null) => (n ? `Rp${Math.round(n).toLocaleString('id-ID')}` : null);

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
  pilih: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: radius.md, padding: spacing.sm },
  hasil: { paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  baris: { flexDirection: 'row', gap: spacing.sm },
});
