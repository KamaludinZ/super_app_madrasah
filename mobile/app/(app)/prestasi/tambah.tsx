/**
 * Ajukan prestasi (siswa/guru/tendik untuk diri sendiri) — isian sama dengan web: lomba, tingkat, peringkat,
 * tanggal/tahun, penyelenggaraan, hadiah, pembina, foto (wajib) & sertifikat dari kamera/galeri (maks 2 MB,
 * POST /achievements/upload/{jenis}). Dikirim sebagai ajuan verval (POST /verval-requests, prestasi_create).
 */
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { AcademicYear } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useAuth } from '@/store/auth';
import { useNetwork } from '@/store/network';
import {
  CARA_MENGIKUTI, CATEGORIES, JENIS_HADIAH, JENIS_LOMBA, JENIS_PENYELENGGARA, LEVELS, MODE_PELAKSANAAN, RANKS, holderAccess,
} from '@/prestasi/data';
import { radius, spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SelectField } from '@/components/ui/SelectField';
import { toast } from '@/components/ui/Toast';
import { AuthedImage } from '@/components/AuthedImage';

const MAX_BYTES = 2 * 1024 * 1024;
type Jenis = 'photo' | 'certificate';

export default function TambahPrestasi() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user, activeRole } = useAuth();
  const { online } = useNetwork();
  const access = holderAccess(activeRole);
  const years = useCached<AcademicYear[]>('academic-years', api.academicYears, { staleTime: 60 * 60_000 });

  const [f, setF] = useState({
    name: '', bidang_lomba: '', category: 'akademik', level: 'kab_kota', rank: 'Juara 1', date: '', year: String(new Date().getFullYear()),
    academic_year_label: '', jenis_lomba: 'individu', jenis_penyelenggara: '', organizer: '', mode_pelaksanaan: 'offline',
    tempat_pelaksanaan: '', cara_mengikuti: 'mandiri', nama_pembina: '', description: '', photo_url: '', certificate_url: '',
  });
  const [hadiah, setHadiah] = useState<string[]>([]);
  const [uploading, setUploading] = useState<Jenis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string | null) => setF((p) => ({ ...p, [k]: v ?? '' }));

  useEffect(() => {
    const active = years.data?.find((y) => y.is_active)?.name;
    if (active && !f.academic_year_label) setF((p) => ({ ...p, academic_year_label: active }));
  }, [years.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (jenis: Jenis) => {
    const run = async (camera: boolean) => {
      const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { toast.error(camera ? 'Izin kamera ditolak' : 'Izin galeri ditolak', 'Aktifkan di Pengaturan aplikasi.'); return; }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, exif: false };
      const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      const asset = r.canceled ? null : r.assets[0];
      if (!asset) return;
      if (asset.fileSize && asset.fileSize > MAX_BYTES) { toast.error('Berkas terlalu besar', 'Ukuran maksimal 2 MB.'); return; }
      setUploading(jenis);
      try {
        const type = asset.mimeType || 'image/jpeg';
        const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
        const { url } = await api.achievements.upload(jenis, { uri: asset.uri, name: asset.fileName || `${jenis}-${Date.now()}.${ext}`, type });
        setF((p) => ({ ...p, [jenis === 'photo' ? 'photo_url' : 'certificate_url']: url }));
      } catch (e) {
        toast.error(errorMessage(e, 'Gagal mengunggah berkas.'));
      } finally {
        setUploading(null);
      }
    };
    Alert.alert(jenis === 'photo' ? 'Foto prestasi' : 'Sertifikat', 'Ambil dari mana?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Galeri', onPress: () => void run(false) },
      { text: 'Kamera', onPress: () => void run(true) },
    ]);
  };

  const submit = async () => {
    if (!f.name.trim()) return setError('Nama lomba wajib diisi.');
    if (f.date && !/^\d{4}-\d{2}-\d{2}$/.test(f.date)) return setError('Tanggal lomba ditulis TTTT-BB-HH, mis. 2026-08-17.');
    const year = parseInt(f.year || f.date.slice(0, 4), 10);
    if (!year || year < 2000 || year > 2099) return setError('Tahun wajib diisi (2000–2099).');
    if (!hadiah.length) return setError('Pilih minimal satu penerimaan hadiah.');
    if (!f.photo_url) return setError('Foto memegang sertifikat/piala wajib diunggah.');
    if (!user || !access.canAdd) return;
    setError(null);
    setBusy(true);
    try {
      const payload = {
        ...f, name: f.name.trim(), year, jenis_hadiah: hadiah,
        holder_type: access.canAdd, holder_id: user.id, holder_name: '',
      };
      await api.verval.create({
        user_id: user.id,
        user_type: access.canAdd === 'siswa' ? 'siswa' : access.canAdd === 'tendik' ? 'tenaga_kependidikan' : 'guru',
        request_type: 'prestasi_create', target_collection: 'achievements', target_id: null, old_data: {}, new_data: payload,
      });
      toast.success('Ajuan prestasi terkirim', 'Menunggu peninjauan Admin/Wali Kelas.');
      await qc.invalidateQueries({ predicate: (q) => /^(prestasi|verval)\./.test(String(q.queryKey[0])) });
      router.back();
    } catch (e) {
      setError(errorMessage(e, 'Gagal mengirim ajuan.'));
    } finally {
      setBusy(false);
    }
  };

  if (!access.canAdd) {
    return <Screen title="Ajukan Prestasi" back><Notice tone="warning" icon="lock-closed-outline" text="Peran ini tidak mengajukan prestasi dari aplikasi." /></Screen>;
  }

  return (
    <Screen title="Ajukan Prestasi" subtitle="Ditinjau sebelum terverifikasi" back
      footer={<Button title="Kirim ajuan" icon="paper-plane-outline" size="lg" fullWidth loading={busy} disabled={!online || !!uploading} onPress={submit} />}>
      <View style={{ gap: spacing.md }}>
        <Card style={{ gap: spacing.md }}>
          <T variant="label" tone="muted">LOMBA</T>
          <Input label="Nama lomba *" value={f.name} onChangeText={set('name')} placeholder="mis. Olimpiade Sains Nasional" />
          <Input label="Bidang lomba" value={f.bidang_lomba} onChangeText={set('bidang_lomba')} placeholder="mis. Matematika, Pidato, Futsal" />
          <SelectField label="Kategori" value={f.category} options={CATEGORIES} onChange={set('category')} allowNone={false} icon="pricetag-outline" />
          <SelectField label="Tingkat" value={f.level} options={LEVELS} onChange={set('level')} allowNone={false} icon="podium-outline" />
          <SelectField label="Peringkat" value={f.rank} options={RANKS.map((r) => ({ value: r, label: r }))} onChange={set('rank')} allowNone={false} icon="medal-outline" />
          <View style={styles.two}>
            <Input label="Tanggal" value={f.date} placeholder="TTTT-BB-HH" keyboardType="numbers-and-punctuation" maxLength={10} containerStyle={{ flex: 3 }}
              onChangeText={(d) => setF((p) => ({ ...p, date: d, year: /^\d{4}/.test(d) ? d.slice(0, 4) : p.year }))} />
            <Input label="Tahun *" value={f.year} onChangeText={set('year')} keyboardType="number-pad" maxLength={4} containerStyle={{ flex: 2 }} />
          </View>
          <SelectField label="Tahun pelajaran" value={f.academic_year_label || null} options={(years.data ?? []).map((y) => ({ value: y.name, label: y.name }))}
            onChange={set('academic_year_label')} icon="calendar-outline" />
          <View style={{ gap: 6 }}>
            <T variant="label" tone="secondary">Jenis lomba</T>
            <SegmentedControl small segments={JENIS_LOMBA} value={f.jenis_lomba} onChange={set('jenis_lomba')} />
          </View>
        </Card>

        <Card style={{ gap: spacing.md }}>
          <T variant="label" tone="muted">PENYELENGGARAAN</T>
          <Input label="Nama penyelenggara" value={f.organizer} onChangeText={set('organizer')} />
          <SelectField label="Jenis penyelenggara" value={f.jenis_penyelenggara || null} options={JENIS_PENYELENGGARA} onChange={set('jenis_penyelenggara')} icon="business-outline" />
          <View style={{ gap: 6 }}>
            <T variant="label" tone="secondary">Mode pelaksanaan</T>
            <SegmentedControl small segments={MODE_PELAKSANAAN} value={f.mode_pelaksanaan} onChange={set('mode_pelaksanaan')} />
          </View>
          <Input label="Tempat pelaksanaan" value={f.tempat_pelaksanaan} onChangeText={set('tempat_pelaksanaan')} />
          <SelectField label="Diikuti secara" value={f.cara_mengikuti} options={CARA_MENGIKUTI} onChange={set('cara_mengikuti')} allowNone={false} icon="flag-outline" />
          <Input label="Nama pembina" value={f.nama_pembina} onChangeText={set('nama_pembina')} />
        </Card>

        <Card style={{ gap: spacing.md }}>
          <T variant="label" tone="muted">PENERIMAAN HADIAH *</T>
          <View style={styles.chips}>
            {JENIS_HADIAH.map((o) => (
              <Chip key={o.value} label={o.label} on={hadiah.includes(o.value)}
                onPress={() => setHadiah((h) => (h.includes(o.value) ? h.filter((x) => x !== o.value) : [...h, o.value]))} />
            ))}
          </View>
          <Input label="Keterangan" value={f.description} onChangeText={set('description')} multiline placeholder="Catatan tambahan (opsional)" />
        </Card>

        <Card style={{ gap: spacing.md }}>
          <T variant="label" tone="muted">BERKAS (JPG/PNG, MAKS 2 MB)</T>
          <View style={styles.two}>
            <FileSlot title="Foto memegang sertifikat/piala *" url={f.photo_url} uploading={uploading === 'photo'} onPick={() => pick('photo')} onClear={() => set('photo_url')('')} />
            <FileSlot title="Sertifikat" url={f.certificate_url} uploading={uploading === 'certificate'} onPick={() => pick('certificate')} onClear={() => set('certificate_url')('')} />
          </View>
        </Card>

        {!online ? <Notice tone="warning" icon="cloud-offline-outline" text="Tidak ada koneksi. Mengirim ajuan memerlukan internet." /> : null}
        {error ? <Notice tone="error" icon="alert-circle-outline" text={error} /> : null}
      </View>
    </Screen>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
      style={[styles.chip, { borderColor: on ? colors.brandPrimary : colors.border, backgroundColor: on ? colors.brandTertiary : colors.surface }]}>
      <Icon name={on ? 'checkbox' : 'square-outline'} size={16} color={on ? colors.onBrandTertiary : colors.muted} />
      <T variant="caption" weight={on ? 'semibold' : 'regular'} color={on ? colors.onBrandTertiary : undefined}>{label}</T>
    </Pressable>
  );
}

function FileSlot({ title, url, uploading, onPick, onClear }: { title: string; url: string; uploading: boolean; onPick: () => void; onClear: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <T variant="small" tone="secondary" numberOfLines={2}>{title}</T>
      {url ? (
        <>
          <AuthedImage path={url} label={title} />
          <Button title="Ganti" icon="refresh-outline" variant="ghost" size="sm" onPress={onPick} />
          <Button title="Hapus" icon="trash-outline" variant="ghost" size="sm" textColor={colors.error} onPress={onClear} />
        </>
      ) : (
        <Pressable onPress={onPick} disabled={uploading} accessibilityRole="button" accessibilityLabel={`Unggah ${title}`}
          style={[styles.slot, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
          <Icon name={uploading ? 'cloud-upload-outline' : 'camera-outline'} size={26} color={colors.muted} />
          <T variant="caption" tone="muted">{uploading ? 'Mengunggah…' : 'Pilih foto'}</T>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  two: { flexDirection: 'row', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: radius.pill ?? 999, paddingHorizontal: spacing.md, paddingVertical: 8 },
  slot: { aspectRatio: 4 / 3, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 4 },
});
