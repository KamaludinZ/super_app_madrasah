/**
 * Profil Saya (guru & tendik) — native, tampilan /profile/guru & /profile/tendik. Kelengkapan data per bagian
 * (GET /gtk/{id}/kelengkapan) dan data GTK (GET /users/me/profile) yang bisa dibuka-tutup: data diri,
 * kepegawaian, kontak & administrasi, tempat tinggal, perkawinan, riwayat pendidikan/diklat/penghargaan,
 * data anak, riwayat pesantren, dan arsip berkas (dibuka dengan sesi aplikasi). NIK/KK/rekening disamarkan.
 * Perubahan data diajukan lewat formulir verval (web).
 * Dengan parameter `id` (dari Data GTK) menampilkan GTK lain dalam mode lihat (GET /users/{id}) untuk Kepala Madrasah.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { GtkKelengkapan } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useAuth } from '@/store/auth';
import { initials, roleLabel } from '@/utils/roles';
import { openAuthedFile } from '@/utils/files';
import { PROFILE_FIELD_LABELS } from '@/verval/labels';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon, IconName } from '@/components/ui/Icon';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';

type Obj = Record<string, any>;
const SENSITIF = new Set(['nik', 'nomor_kk', 'nomor_rekening', 'npwp', 'bpjs_kesehatan', 'bpjs_ketenagakerjaan']);
const SECTIONS: { id: string; title: string; icon: IconName; fields: string[] }[] = [
  { id: 'diri', title: 'Data diri', icon: 'person-outline', fields: ['full_name', 'nama_tanpa_gelar', 'gelar_depan', 'gelar_belakang', 'gender', 'birth_place', 'birth_date', 'nik', 'nomor_kk', 'nama_ibu_kandung', 'agama', 'golongan_darah'] },
  { id: 'pegawai', title: 'Kepegawaian', icon: 'briefcase-outline', fields: ['status_kepegawaian', 'jenis_ptk', 'tugas_utama', 'nip', 'nuptk', 'peg_id', 'npk', 'nrg', 'pangkat_golongan', 'status_penugasan', 'status_keaktifan', 'tmt_pns', 'no_sk_pns', 'tanggal_sk_pns', 'tmt_pegawai', 'tmt_guru', 'tanggal_pensiun', 'no_sk_pensiun'] },
  { id: 'kontak', title: 'Kontak & administrasi', icon: 'call-outline', fields: ['phone', 'email', 'email_madrasah', 'npwp', 'bpjs_kesehatan', 'bpjs_ketenagakerjaan', 'bank', 'nama_rekening', 'nomor_rekening'] },
  { id: 'tinggal', title: 'Tempat tinggal', icon: 'home-outline', fields: ['status_tempat_tinggal', 'alamat', 'rt', 'rw', 'kelurahan', 'kecamatan', 'kab_kota', 'provinsi', 'kode_pos', 'jarak_ke_sekolah', 'transportasi', 'waktu_tempuh'] },
  { id: 'kawin', title: 'Status perkawinan', icon: 'heart-outline', fields: ['status_perkawinan', 'nama_pasangan'] },
];
const LISTS: { field: string; title: string; icon: IconName; kosong?: string }[] = [
  { field: 'riwayat_pendidikan', title: 'Riwayat pendidikan', icon: 'school-outline' },
  { field: 'riwayat_diklat', title: 'Riwayat diklat', icon: 'ribbon-outline' },
  { field: 'riwayat_penghargaan', title: 'Riwayat penghargaan', icon: 'trophy-outline' },
  { field: 'data_anak', title: 'Data anak', icon: 'people-outline', kosong: 'tidak_punya_anak' },
  { field: 'riwayat_pesantren', title: 'Riwayat pesantren', icon: 'book-outline', kosong: 'tidak_pernah_pesantren' },
];
const BERKAS: [string, string][] = [['berkas_ktp', 'KTP'], ['berkas_kk', 'Kartu Keluarga'], ['berkas_ijazah', 'Ijazah Terakhir'], ['berkas_sk', 'SK Pengangkatan']];

const label = (k: string) => PROFILE_FIELD_LABELS[k] ?? k.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const show = (k: string, v: unknown): string | null => {
  if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) return null;
  if (k === 'gender') return v === 'L' ? 'Laki-laki' : v === 'P' ? 'Perempuan' : String(v);
  if (typeof v === 'boolean') return v ? 'Ya' : 'Tidak';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object') return null;
  return String(v).replace(/_/g, ' ');
};
const mask = (v: string) => (v.length > 6 ? `${v.slice(0, 4)}${'•'.repeat(v.length - 6)}${v.slice(-2)}` : '••••');

export default function ProfilGtk() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, activeRole } = useAuth();
  const p = useLocalSearchParams<{ id?: string }>();
  const lain = !!p.id && p.id !== user?.id;
  const gid = (lain ? p.id : user?.id) ?? '';
  const judul = lain ? 'Data GTK' : 'Profil Saya';
  const res = useCached<Obj>(lain ? `pantau.gtk.${gid}` : 'gtk.profil', lain ? () => api.gtk.user(gid) : api.gtk.profil);
  const kel = useCached<GtkKelengkapan>(lain ? `pantau.gtk.${gid}.kelengkapan` : 'gtk.kelengkapan', () => api.gtk.kelengkapan(gid), { enabled: !!gid });
  const [open, setOpen] = useState<string | null>('diri');
  const [reveal, setReveal] = useState(false);
  const d = res.data ?? {};
  const k = kel.data?.kelengkapan;
  const val = (f: string) => { const x = show(f, d[f]); return x && SENSITIF.has(f) && !reveal ? mask(x) : x; };

  const Section = ({ id, title, icon, count, children }: { id: string; title: string; icon: IconName; count?: number; children: React.ReactNode }) => {
    const isOpen = open === id;
    return (
      <Card padded={false}>
        <Pressable onPress={() => setOpen(isOpen ? null : id)} style={styles.secHead} accessibilityRole="button" accessibilityState={{ expanded: isOpen }}>
          <Icon name={icon} size={20} color={colors.brandPrimary} />
          <T weight="semibold" style={{ flex: 1 }}>{title}</T>
          {count !== undefined ? <Badge label={String(count)} tone="neutral" small /> : null}
          <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
        </Pressable>
        {isOpen ? <View style={styles.secBody}>{children}</View> : null}
      </Card>
    );
  };

  if (!res.data) {
    return (
      <Screen title={judul} back refreshing={res.refreshing} onRefresh={res.refresh}>
        {res.loading ? <CardSkeleton lines={6} /> : <ErrorState message={errorMessage(res.error, 'Profil belum bisa dimuat.')} onRetry={res.refresh} />}
      </Screen>
    );
  }

  return (
    <Screen title={judul} subtitle={lain ? 'Data GTK (EMIS) · hanya lihat' : 'Data GTK (EMIS)'} back refreshing={res.refreshing || kel.refreshing} onRefresh={() => { void res.refresh(); void kel.refresh(); }}
      offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}>
      <View style={{ gap: spacing.md }}>
        <Card style={styles.idCard}>
          <View style={[styles.avatar, { backgroundColor: colors.brandPrimary }]}>
            <T variant="title" color={colors.onBrandPrimary}>{initials(d.full_name)}</T>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="subtitle">{d.full_name}</T>
            <T variant="caption" tone="secondary">{[d.nip ? `NIP ${d.nip}` : null, d.nuptk ? `NUPTK ${d.nuptk}` : null, d.peg_id ? `Peg ID ${d.peg_id}` : null].filter(Boolean).join(' · ') || roleLabel(activeRole ?? '')}</T>
            {d.status_kepegawaian ? <T variant="caption" tone="muted">{String(d.status_kepegawaian).replace(/_/g, ' ')}</T> : null}
          </View>
        </Card>

        {k ? (
          <Card style={{ gap: spacing.sm }}>
            <View style={styles.row}>
              <T weight="semibold" style={{ flex: 1 }}>Kelengkapan data</T>
              <T variant="subtitle" color={k.persen >= 100 ? colors.success : k.persen >= 60 ? colors.warning : colors.error}>{k.persen}%</T>
            </View>
            {k.bagian.map((b) => (
              <View key={b.key} style={{ gap: 2 }}>
                <View style={styles.row}>
                  <Icon name={b.terisi >= b.total ? 'checkmark-circle' : 'alert-circle-outline'} size={16} color={b.terisi >= b.total ? colors.success : colors.warning} />
                  <T variant="caption" style={{ flex: 1 }}>{b.label}</T>
                  <T variant="caption" tone="muted">{b.terisi}/{b.total}</T>
                </View>
                {b.kurang?.length ? <T variant="small" tone="muted" style={{ marginLeft: 24 }} numberOfLines={3}>Belum: {b.kurang.join(', ')}</T> : null}
              </View>
            ))}
            {lain ? null : (
              <Button title={k.persen < 100 ? 'Lengkapi data / ajukan perubahan' : 'Ajukan perubahan data'} icon="create-outline" variant="outline" size="sm"
                onPress={() => router.push({ pathname: '/web', params: { path: activeRole === 'tenaga_kependidikan' ? '/profile/tendik' : '/profile/guru', title: 'Ubah Data Diri' } })} />
            )}
          </Card>
        ) : null}

        <View style={styles.row}>
          <T variant="caption" tone="muted" style={{ flex: 1 }}>NIK, KK, NPWP, BPJS & rekening disamarkan.</T>
          <Button title={reveal ? 'Samarkan' : 'Tampilkan'} icon={reveal ? 'eye-off-outline' : 'eye-outline'} variant="ghost" size="sm" onPress={() => setReveal((r) => !r)} />
        </View>

        {SECTIONS.map((s) => {
          const rows = s.fields.map((f) => [label(f), val(f)] as const).filter(([, v]) => v);
          return (
            <Section key={s.id} id={s.id} title={s.title} icon={s.icon}>
              {rows.length ? rows.map(([l, v]) => <Row key={l} label={l} value={v!} />) : <T variant="caption" tone="muted">Belum diisi.</T>}
            </Section>
          );
        })}

        {LISTS.map((l) => {
          const items: Obj[] = Array.isArray(d[l.field]) ? d[l.field] : [];
          return (
            <Section key={l.field} id={l.field} title={l.title} icon={l.icon} count={items.length}>
              {items.length ? items.map((it, i) => {
                const entries = Object.entries(it).filter(([kk, v]) => kk !== 'id' && !/^file_|_url$/.test(kk) && show(kk, v));
                return (
                  <View key={it.id ?? i} style={[styles.item, { borderColor: colors.divider }]}>
                    {entries.slice(0, 6).map(([kk, v]) => <Row key={kk} label={label(kk)} value={show(kk, v)!} />)}
                  </View>
                );
              }) : <T variant="caption" tone="muted">{l.kosong && d[l.kosong] ? (l.field === 'data_anak' ? 'Tidak memiliki anak.' : 'Tidak pernah mondok di pesantren.') : 'Belum diisi.'}</T>}
            </Section>
          );
        })}

        <Section id="berkas" title="Arsip berkas" icon="folder-open-outline" count={BERKAS.filter(([f]) => d[f]).length}>
          {BERKAS.map(([f, l]) => (
            <View key={f} style={styles.row}>
              <Icon name={d[f] ? 'document-attach-outline' : 'remove-circle-outline'} size={18} color={d[f] ? colors.brandPrimary : colors.border} />
              <T style={{ flex: 1 }} tone={d[f] ? 'default' : 'muted'}>{l}</T>
              {d[f] ? <Button title="Buka" variant="ghost" size="sm" onPress={() => openAuthedFile(String(d[f]))} /> : <T variant="small" tone="muted">Belum diunggah</T>}
            </View>
          ))}
        </Section>
      </View>
    </Screen>
  );
}

function Row({ label: l, value }: { label: string; value: string }) {
  return (
    <View style={styles.kv}>
      <T variant="caption" tone="muted" style={styles.kvLabel}>{l}</T>
      <T style={{ flex: 1 }} selectable>{value}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  idCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  secHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, minHeight: 52 },
  secBody: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  kv: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  kvLabel: { width: 128, paddingTop: 2 },
  item: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, gap: 4 },
});
