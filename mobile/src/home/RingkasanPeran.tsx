/**
 * Ringkasan per peran di Beranda (Fase 5 aplikasi native, pengganti kartu Dashboard web):
 *  - Siswa: kehadiran bulan ini & tugas yang belum dikumpulkan (tenggat terdekat).
 *  - Kepala Madrasah: kehadiran siswa hari ini/bulan ini & jumlah jurnal mengajar hari ini, pintasan pemantauan.
 *  - GTK lain (guru, tendik, waka, wali kelas, dll.): persentase hadir bulan ini dari Laporan Absensi Saya.
 * Memakai cache yang sama dengan layar rinciannya agar tetap tampil saat offline.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/api/endpoints';
import type { GTKAbsensiMy, Journal, KehadiranStats, KelasTugas } from '@/api/types';
import { pantau, KehadiranOverall } from '@/pantau/api';
import { useCached } from '@/hooks/useCached';
import { dueInfo, monthOf, todayISO } from '@/utils/time';
import { radius, spacing, useTheme } from '@/theme';
import { T } from '@/components/ui/Text';
import { Icon, IconName } from '@/components/ui/Icon';

// Peran tanpa absensi GTK (bukan pegawai) atau yang punya ringkasan sendiri.
const TANPA_ABSENSI = ['siswa', 'kepala_sekolah', 'admin', 'orang_tua', 'parent'];

function Tile({ icon, label, value, hint, color, onPress }: { icon: IconName; label: string; value: string; hint?: string; color?: string; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={`${label} ${value}`}
      style={({ pressed }) => [styles.tile, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
      <View style={styles.tileHead}>
        <Icon name={icon} size={18} color={color ?? colors.brandPrimary} />
        <T variant="small" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>{label}</T>
      </View>
      <T variant="title" color={color}>{value}</T>
      {hint ? <T variant="small" tone="muted" numberOfLines={2}>{hint}</T> : null}
    </Pressable>
  );
}

const persen = (p: number | null | undefined, ada = true) => (ada && p != null ? `${Math.round(p)}%` : '—');

function useWarna() {
  const { colors } = useTheme();
  return (p: number | null | undefined, ada = true) => (!ada || p == null ? undefined : p >= 90 ? colors.success : p >= 75 ? colors.warning : colors.error);
}

function Siswa() {
  const router = useRouter();
  const warna = useWarna();
  const month = monthOf(todayISO());
  const [y, m] = month.split('-').map((x) => parseInt(x, 10));
  const hadir = useCached<KehadiranStats>(`siswa.kehadiran.stats.${month}`, () => api.students.myAttendanceStats(m, y));
  const tugas = useCached<KelasTugas[]>('siswa.tugas', api.kelas.tugas);
  const belum = (tugas.data ?? []).filter((t) => t.submission_status !== 'submitted' && !dueInfo(t.deadline)?.overdue)
    .sort((a, b) => (a.deadline ?? '9').localeCompare(b.deadline ?? '9'));
  const mon = hadir.data?.monthly;
  return (
    <View style={styles.grid}>
      <Tile icon="checkmark-done-outline" label="Kehadiran bulan ini" value={persen(mon?.percentage, !!mon?.total)} color={warna(mon?.percentage, !!mon?.total)}
        hint={mon?.total ? `${mon.hadir} dari ${mon.total} pertemuan` : 'Belum ada pertemuan'} onPress={() => router.push('/siswa/kehadiran')} />
      <Tile icon="document-text-outline" label="Tugas belum dikumpulkan" value={tugas.data ? String(belum.length) : '—'}
        hint={belum[0] ? `${belum[0].judul} · ${dueInfo(belum[0].deadline)?.label ?? 'tanpa tenggat'}` : 'Semua tugas aktif sudah dikumpulkan'}
        onPress={() => router.push('/siswa/tugas')} />
    </View>
  );
}

function Kepala() {
  const router = useRouter();
  const warna = useWarna();
  const month = monthOf(todayISO());
  const [y, m] = month.split('-').map((x) => parseInt(x, 10));
  const hadir = useCached<KehadiranOverall>(`pantau.kehadiran.${month}`, () => pantau.kehadiranOverall(m, y));
  const tgl = todayISO();
  const jurnal = useCached<{ items: Journal[] }>(`pantau.jurnal.${tgl}.semua`, () => api.jurnal.admin({ start_date: tgl, end_date: tgl, limit: 300 }));
  const d = hadir.data;
  return (
    <View style={styles.grid}>
      <Tile icon="people-outline" label="Kehadiran siswa hari ini" value={persen(d?.daily.percentage, !!d?.daily.total)} color={warna(d?.daily.percentage, !!d?.daily.total)}
        hint={d ? `Bulan ini ${persen(d.monthly.percentage, !!d.monthly.total)} · alpa ${d.daily.alpa} hari ini` : undefined} onPress={() => router.push('/pantau/kehadiran')} />
      <Tile icon="book-outline" label="Jurnal mengajar hari ini" value={jurnal.data ? String(jurnal.data.items.length) : '—'}
        hint="Ketuk untuk rincian per guru" onPress={() => router.push('/pantau/jurnal')} />
      <Tile icon="id-card-outline" label="Absensi GTK" value="Rekap" hint="Kehadiran guru & tendik bulan ini" onPress={() => router.push('/pantau/absensi-gtk')} />
      <Tile icon="wallet-outline" label="DANA RKAM" value="Serapan" hint="Anggaran & realisasi BOS/Komite" onPress={() => router.push('/pantau/rkam')} />
    </View>
  );
}

function Gtk() {
  const router = useRouter();
  const warna = useWarna();
  const to = todayISO();
  const from = `${to.slice(0, 7)}-01`;
  const res = useCached<GTKAbsensiMy>(`gtk.absensi.${from}.${to}`, () => api.gtk.absensiMy(from, to));
  const s = res.data?.summary;
  const izin = s ? s.sakit + s.cuti + s.dinas_luar + s.lainnya : 0;
  return (
    <View style={styles.grid}>
      <Tile icon="finger-print-outline" label="Kehadiran saya bulan ini" value={persen(s?.persentase_hadir, s?.persentase_hadir != null)}
        color={warna(s?.persentase_hadir, s?.persentase_hadir != null)}
        hint={s ? `Hadir ${s.hadir} · izin ${izin} · alpha ${s.alpha}` : undefined} onPress={() => router.push('/absensi-saya')} />
    </View>
  );
}

export function RingkasanPeran({ role }: { role?: string | null }) {
  if (!role) return null;
  const isi = role === 'siswa' ? <Siswa /> : role === 'kepala_sekolah' ? <Kepala /> : TANPA_ABSENSI.includes(role) ? null : <Gtk />;
  if (!isi) return null;
  return (
    <View style={{ gap: spacing.sm }}>
      <T variant="subtitle">Ringkasan</T>
      {isi}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexBasis: '48%', flexGrow: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
