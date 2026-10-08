/**
 * Proses Ajuan (wali kelas & Waka Kesiswaan) — native, pengganti pemrosesan di /admin/verval-siswa dan tab
 * "Menunggu" /prestasi. Tab Prestasi: ajuan prestasi siswa (GET /verval-requests?request_type=prestasi_create
 * &reviewer_view=true); tab Data Siswa: ajuan perubahan data diri siswa kelas wali (reviewer_view=true).
 * Rincian perubahan lama → baru, lampiran sertifikat/foto, lalu Setujui (POST …/approve) atau Tolak dengan
 * catatan wajib (POST …/reject). Cakupan data & izin ditentukan server menurut peran aktif.
 */
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { request, errorMessage } from '@/api/client';
import type { VervalRequest } from '@/api/types';
import { useAuth } from '@/store/auth';
import { useNetwork } from '@/store/network';
import { useCached } from '@/hooks/useCached';
import { openAuthedFile } from '@/utils/files';
import { formatDateShort, formatRelative } from '@/utils/time';
import { radius, spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';

type Ajuan = VervalRequest & { holder_full_name?: string | null; class_name?: string | null; user_name?: string | null };
type Jenis = 'prestasi' | 'data';
type Status = 'pending' | 'selesai';
const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Menunggu', tone: 'warning' }, approved: { label: 'Disetujui', tone: 'success' }, rejected: { label: 'Ditolak', tone: 'error' },
};
const TINGKAT: Record<string, string> = {
  sekolah: 'Sekolah', kecamatan: 'Kecamatan', kab_kota: 'Kab/Kota', kabupaten: 'Kabupaten', kota: 'Kota', provinsi: 'Provinsi', nasional: 'Nasional', internasional: 'Internasional',
};
// Field prestasi yang ditampilkan berurutan (sisanya diabaikan).
const PRESTASI: [string, string][] = [
  ['name', 'Nama lomba'], ['bidang_lomba', 'Bidang'], ['level', 'Tingkat'], ['rank', 'Peringkat'], ['organizer', 'Penyelenggara'],
  ['date', 'Tanggal'], ['jenis_lomba', 'Jenis lomba'], ['mode_pelaksanaan', 'Pelaksanaan'], ['tempat_pelaksanaan', 'Tempat'], ['nama_pembina', 'Pembina'], ['description', 'Keterangan'],
];
const SEMBUNYI = new Set(['id', 'updated_at', 'created_at', 'password_hash', 'holder_type', 'holder_id', 'student_id']);
const label = (k: string) => k.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const tampil = (v: unknown): string => (v === null || v === undefined || v === '' ? '—' : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v));

function Isi({ a }: { a: Ajuan }) {
  const { colors } = useTheme();
  const nd = (a.new_data ?? {}) as Record<string, unknown>;
  const od = (a.old_data ?? {}) as Record<string, unknown>;
  if (a.request_type === 'prestasi_create') {
    return (
      <View style={{ gap: 4 }}>
        {PRESTASI.filter(([k]) => nd[k]).map(([k, l]) => (
          <View key={k} style={styles.baris}>
            <T variant="caption" tone="muted" style={{ width: 100 }}>{l}</T>
            <T variant="caption" style={{ flex: 1 }}>{k === 'level' ? TINGKAT[String(nd[k])] ?? tampil(nd[k]) : k === 'date' ? formatDateShort(String(nd[k])) : tampil(nd[k])}</T>
          </View>
        ))}
        <View style={[styles.row, { marginTop: 4 }]}>
          {nd.certificate_url ? <Button title="Sertifikat" icon="document-outline" variant="outline" size="sm" onPress={() => openAuthedFile(String(nd.certificate_url))} /> : null}
          {nd.photo_url ? <Button title="Foto" icon="image-outline" variant="outline" size="sm" onPress={() => openAuthedFile(String(nd.photo_url))} /> : null}
        </View>
      </View>
    );
  }
  const ubah = Object.keys(nd).filter((k) => !SEMBUNYI.has(k) && tampil(nd[k]) !== tampil(od[k]));
  if (!ubah.length) return <T variant="caption" tone="muted">Tidak ada perbedaan data yang terbaca.</T>;
  return (
    <View style={{ gap: spacing.xs }}>
      {ubah.map((k) => (
        <View key={k} style={{ gap: 1 }}>
          <T variant="caption" weight="medium">{label(k)}</T>
          <T variant="small" tone="muted" style={{ textDecorationLine: 'line-through' }}>{tampil(od[k])}</T>
          <T variant="caption" color={colors.success}>{tampil(nd[k])}</T>
        </View>
      ))}
    </View>
  );
}

export default function ProsesAjuan() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { online } = useNetwork();
  const { activeRole } = useAuth();
  const p = useLocalSearchParams<{ jenis?: string }>();
  const kesiswaan = activeRole === 'waka_kesiswaan';
  const [jenis, setJenis] = useState<Jenis>(p.jenis === 'data' && !kesiswaan ? 'data' : 'prestasi');
  const [status, setStatus] = useState<Status>('pending');
  const [buka, setBuka] = useState<string | null>(null);
  const [tolak, setTolak] = useState<Ajuan | null>(null);
  const [catatan, setCatatan] = useState('');
  const [sibuk, setSibuk] = useState<string | null>(null);
  const key = `ajuan.${activeRole}.${jenis}`;
  const res = useCached<Ajuan[]>(key, () => request('/verval-requests', {
    query: { reviewer_view: true, request_type: jenis === 'prestasi' ? 'prestasi_create' : 'profile_update', user_type: jenis === 'data' ? 'siswa' : undefined },
  }));
  const rows = useMemo(() => (res.data ?? []).filter((a) => (status === 'pending' ? a.status === 'pending' : a.status !== 'pending')), [res.data, status]);
  const nTunggu = (res.data ?? []).filter((a) => a.status === 'pending').length;
  const muatUlang = () => qc.invalidateQueries({ predicate: (q) => /^(ajuan\.|prestasi|verval)/.test(String(q.queryKey[0])) });

  const setujui = async (a: Ajuan) => {
    setSibuk(a.id);
    try {
      await request(`/verval-requests/${a.id}/approve`, { method: 'POST', body: {} });
      toast.success('Ajuan disetujui');
      await muatUlang();
    } catch (e) { toast.error(errorMessage(e, 'Gagal menyetujui ajuan.')); } finally { setSibuk(null); }
  };
  const kirimTolak = async () => {
    if (!tolak) return;
    if (!catatan.trim()) { toast.error('Tuliskan alasan penolakan'); return; }
    setSibuk(tolak.id);
    try {
      await request(`/verval-requests/${tolak.id}/reject`, { method: 'POST', body: { admin_notes: catatan.trim() } });
      toast.success('Ajuan ditolak');
      setTolak(null); setCatatan('');
      await muatUlang();
    } catch (e) { toast.error(errorMessage(e, 'Gagal menolak ajuan.')); } finally { setSibuk(null); }
  };

  return (
    <Screen title="Proses Ajuan" subtitle={kesiswaan ? 'Ajuan prestasi siswa' : 'Ajuan siswa kelas wali'} back refreshing={res.refreshing} onRefresh={res.refresh}
      offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}>
      <View style={{ gap: spacing.md }}>
        {kesiswaan ? null : (
          <SegmentedControl<Jenis> value={jenis} onChange={(v) => { setJenis(v); setBuka(null); }}
            segments={[{ value: 'prestasi', label: 'Prestasi' }, { value: 'data', label: 'Data Siswa' }]} />
        )}
        <SegmentedControl<Status> small value={status} onChange={setStatus}
          segments={[{ value: 'pending', label: `Menunggu (${nTunggu})` }, { value: 'selesai', label: 'Sudah diproses' }]} />
        {res.loading ? <CardSkeleton lines={5} /> : !res.data ? (
          <ErrorState message={errorMessage(res.error, 'Ajuan belum bisa dimuat.')} onRetry={res.refresh} compact />
        ) : rows.length === 0 ? (
          <Card><EmptyState icon="checkmark-done-outline" title={status === 'pending' ? 'Tidak ada ajuan menunggu' : 'Belum ada ajuan diproses'} compact /></Card>
        ) : rows.map((a) => {
          const st = STATUS[a.status] ?? { label: a.status, tone: 'neutral' as BadgeTone };
          const nd = (a.new_data ?? {}) as Record<string, unknown>;
          const terbuka = buka === a.id;
          const siapa = a.holder_full_name ?? (nd.full_name as string | undefined) ?? a.user_name ?? 'Siswa';
          return (
            <Card key={a.id} style={{ gap: spacing.sm }}>
              <Pressable onPress={() => setBuka(terbuka ? null : a.id)} accessibilityRole="button" accessibilityState={{ expanded: terbuka }} style={{ gap: 2 }}>
                <View style={styles.row}>
                  <T weight="semibold" style={{ flex: 1 }} numberOfLines={1}>{siapa}</T>
                  <Badge label={st.label} tone={st.tone} small />
                </View>
                <T variant="caption" tone="secondary" numberOfLines={terbuka ? undefined : 1}>
                  {a.request_type === 'prestasi_create' ? (nd.name as string) ?? 'Ajuan prestasi' : 'Perubahan data diri'}
                </T>
                <T variant="small" tone="muted">
                  {[a.class_name ? `Kelas ${a.class_name}` : null, a.created_at ? formatRelative(a.created_at) : null, a.reviewed_by_name ? `oleh ${a.reviewed_by_name}` : null].filter(Boolean).join(' · ')}
                </T>
              </Pressable>
              {terbuka ? (
                <View style={[styles.detail, { borderTopColor: colors.divider }]}>
                  <Isi a={a} />
                  {a.admin_notes ? <T variant="caption" tone="secondary">Catatan: {a.admin_notes}</T> : null}
                  {a.status === 'pending' ? (
                    <View style={styles.row}>
                      <Button title="Tolak" icon="close-circle-outline" variant="outline" size="sm" disabled={!online || !!sibuk}
                        onPress={() => { setTolak(a); setCatatan(''); }} style={{ flex: 1 }} />
                      <Button title="Setujui" icon="checkmark-circle-outline" size="sm" loading={sibuk === a.id} disabled={!online || !!sibuk}
                        onPress={() => setujui(a)} style={{ flex: 1 }} />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </Card>
          );
        })}
      </View>

      <Modal visible={!!tolak} transparent animationType="slide" onRequestClose={() => setTolak(null)}>
        <Pressable style={styles.backdrop} onPress={() => setTolak(null)} accessibilityLabel="Tutup" />
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.md }]}>
          <T variant="subtitle">Tolak ajuan</T>
          <T variant="caption" tone="muted">Alasan penolakan akan dikirim ke pengaju.</T>
          <Input label="Alasan *" value={catatan} onChangeText={setCatatan} multiline placeholder="mis. Sertifikat tidak terbaca, mohon unggah ulang" />
          <Button title="Kirim penolakan" icon="close-circle-outline" loading={!!sibuk} disabled={!online} onPress={kirimTolak} />
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  baris: { flexDirection: 'row', gap: spacing.sm },
  detail: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, gap: spacing.sm },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
});
