/**
 * Profil Saya (siswa) — native, pengganti tampilan /profile/siswa. Kartu identitas, kelengkapan data per
 * bagian (GET /students/{id}/kelengkapan) beserta isian yang kurang, lalu seluruh data EMIS yang bisa
 * dibuka-tutup (GET /students/{id}/detail): data siswa, orang tua/wali, alamat, keahlian, tahfidz, beasiswa,
 * pendidikan lain, kebutuhan khusus, berkas (dibuka dengan sesi aplikasi) & riwayat kelas.
 * NIK/No. KK disamarkan sampai diketuk "Tampilkan". Perubahan data diajukan lewat formulir verval (web).
 * Dengan parameter `id` (dari Data Siswa) menampilkan siswa lain dalam mode lihat untuk Kepala Madrasah & peran pemantau.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { ClassHistoryItem, Kelengkapan, StudentDetailResponse } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useAuth } from '@/store/auth';
import { formatDateShort } from '@/utils/time';
import { initials } from '@/utils/roles';
import { openAuthedFile } from '@/utils/files';
import { radius, spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon, IconName } from '@/components/ui/Icon';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';

type Obj = Record<string, any>;
type Field = [key: string, label: string, sensitive?: boolean];

const PARENT: Field[] = [
  ['nama', 'Nama lengkap'], ['status', 'Status'], ['citizenship', 'Kewarganegaraan'], ['nik', 'NIK', true],
  ['asal_negara', 'Asal negara'], ['tempat_lahir', 'Tempat lahir'], ['tgl_lahir', 'Tanggal lahir'], ['pendidikan', 'Pendidikan terakhir'],
  ['pekerjaan', 'Pekerjaan utama'], ['penghasilan', 'Penghasilan bulanan'], ['no_hp', 'No. HP'],
];
const ADDR: Field[] = [
  ['status_tempat_tinggal', 'Status tempat tinggal'], ['status_kepemilikan', 'Status kepemilikan'], ['alamat', 'Alamat'],
  ['rt', 'RT'], ['rw', 'RW'], ['kelurahan', 'Kelurahan/Desa'], ['kecamatan', 'Kecamatan'], ['kabupaten', 'Kabupaten/Kota'],
  ['provinsi', 'Provinsi'], ['kode_pos', 'Kode pos'], ['jarak_tempuh', 'Jarak tempuh'], ['transportasi', 'Transportasi'], ['waktu_tempuh', 'Waktu tempuh'],
];
const BERKAS: [string, string][] = [
  ['berkas_kartu_keluarga', 'Kartu Keluarga'], ['berkas_akta_kelahiran', 'Akta Kelahiran'], ['berkas_ijazah_sd', 'Ijazah SD/MI'],
  ['berkas_kip', 'KIP'], ['berkas_pkh', 'PKH'], ['berkas_kks', 'KKS'], ['berkas_kartu_pelajar', 'Kartu Pelajar'],
];
const REASON: Record<string, string> = {
  pembagian_kelas: 'Pembagian kelas', pindah_kelas: 'Pindah kelas', naik_kelas: 'Naik kelas', pindah_semester: 'Pindah semester',
  mutasi_masuk: 'Mutasi masuk', mutasi_keluar: 'Mutasi keluar', lulus: 'Lulus', tinggal_kelas: 'Tinggal kelas',
};

const show = (v: unknown): string | null => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'boolean') return v ? 'Ya' : 'Tidak';
  if (Array.isArray(v)) return v.length ? v.join(', ') : null;
  return String(v);
};
const mask = (v: string) => (v.length > 6 ? `${v.slice(0, 4)}${'•'.repeat(v.length - 6)}${v.slice(-2)}` : '••••');

export default function ProfilSiswa() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const p = useLocalSearchParams<{ id?: string }>();
  const lain = !!p.id && p.id !== user?.id;
  const sid = (lain ? p.id : user?.id) ?? '';
  const ck = lain ? `pantau.siswa.${sid}` : 'siswa.profil';
  const judul = lain ? 'Data Siswa' : 'Profil Saya';
  const res = useCached<StudentDetailResponse>(ck, () => api.students.detail(sid), { enabled: !!sid });
  const kel = useCached<{ kelengkapan: Kelengkapan }>(`${ck}.kelengkapan`, () => api.students.kelengkapan(sid), { enabled: !!sid });
  const hist = useCached<ClassHistoryItem[]>(`${ck}.riwayat`, () => api.students.classHistory(sid), { enabled: !!sid });
  const [open, setOpen] = useState<string | null>('siswa');
  const [reveal, setReveal] = useState(false);

  const s = res.data?.student ?? {};
  const d: Obj = res.data?.detail ?? {};
  const k = kel.data?.kelengkapan;
  const val = (v: unknown, sensitive?: boolean) => { const x = show(v); return x && sensitive && !reveal ? mask(x) : x; };
  const refresh = () => { void res.refresh(); void kel.refresh(); void hist.refresh(); };

  const Section = ({ id, title, icon, children, count }: { id: string; title: string; icon: IconName; children: React.ReactNode; count?: number }) => {
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
  const Rows = ({ src, fields }: { src: Obj; fields: Field[] }) => {
    const rows = fields.map(([key, label, sens]) => [label, val(src?.[key], sens)] as const).filter(([, v]) => v);
    return rows.length ? <>{rows.map(([l, v]) => <Row key={l} label={l} value={v!} />)}</> : <T variant="caption" tone="muted">Belum diisi.</T>;
  };

  if (!res.data) {
    return (
      <Screen title={judul} back refreshing={res.refreshing} onRefresh={refresh}>
        {res.loading ? <CardSkeleton lines={6} /> : <ErrorState message={errorMessage(res.error, 'Profil belum bisa dimuat.')} onRetry={res.refresh} />}
      </Screen>
    );
  }

  return (
    <Screen title={judul} subtitle={lain ? 'Data EMIS siswa · hanya lihat' : 'Data diri siswa (EMIS)'} back refreshing={res.refreshing || kel.refreshing} onRefresh={refresh}
      offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}>
      <View style={{ gap: spacing.md }}>
        <Card style={styles.idCard}>
          <View style={[styles.avatar, { backgroundColor: colors.brandPrimary }]}>
            <T variant="title" color={colors.onBrandPrimary}>{initials(s.full_name)}</T>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="subtitle">{s.full_name}</T>
            <T variant="caption" tone="secondary">{[s.nisn ? `NISN ${s.nisn}` : null, s.nis ? `NIS ${s.nis}` : null].filter(Boolean).join(' · ') || '-'}</T>
            {hist.data?.[0]?.class_name ? <T variant="caption" tone="muted">Kelas {hist.data[0].class_name}</T> : null}
          </View>
        </Card>

        {k ? (
          <Card style={{ gap: spacing.sm }}>
            <View style={styles.row}>
              <T weight="semibold" style={{ flex: 1 }}>Kelengkapan data</T>
              <T variant="subtitle" color={k.persen >= 100 ? colors.success : k.persen >= 60 ? colors.warning : colors.error}>{k.persen}%</T>
            </View>
            <View style={[styles.bar, { backgroundColor: colors.surfaceSecondary }]}>
              <View style={{ width: `${Math.min(100, k.persen)}%`, height: '100%', borderRadius: 4, backgroundColor: k.persen >= 100 ? colors.success : colors.warning }} />
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
                onPress={() => router.push({ pathname: '/web', params: { path: '/profile/siswa', title: 'Ubah Data Diri' } })} />
            )}
          </Card>
        ) : null}

        <View style={styles.row}>
          <T variant="caption" tone="muted" style={{ flex: 1 }}>NIK & No. KK disamarkan demi privasi.</T>
          <Button title={reveal ? 'Samarkan' : 'Tampilkan'} icon={reveal ? 'eye-off-outline' : 'eye-outline'} variant="ghost" size="sm" onPress={() => setReveal((r) => !r)} />
        </View>

        <Section id="siswa" title="Data siswa" icon="person-outline">
          <Rows src={s} fields={[['full_name', 'Nama lengkap'], ['nisn', 'NISN'], ['nis', 'NIS'], ['birth_place', 'Tempat lahir'], ['birth_date', 'Tanggal lahir']]} />
          {s.gender ? <Row label="Jenis kelamin" value={s.gender === 'L' ? 'Laki-laki' : s.gender === 'P' ? 'Perempuan' : String(s.gender)} /> : null}
          <Rows src={d} fields={[
            ['citizenship', 'Kewarganegaraan'], ['nik', 'NIK', true], ['asal_negara', 'Asal negara'], ['agama', 'Agama'],
            ['jumlah_saudara', 'Jumlah saudara'], ['anak_ke', 'Anak ke'], ['cita_cita', 'Cita-cita'], ['hobi', 'Hobi'],
            ['pembiaya_sekolah', 'Pembiaya sekolah'], ['pra_sekolah', 'Pra sekolah'], ['imunisasi', 'Imunisasi'],
            ['nomor_kip', 'Nomor KIP'], ['nomor_kk', 'Nomor KK', true], ['nama_kepala_keluarga', 'Kepala keluarga'],
            ['santri_mahad', "Santri ma'had"], ['kamar_mahad', "Kamar ma'had"],
          ]} />
        </Section>

        <Section id="ortu" title="Orang tua & wali" icon="people-outline">
          {(['ayah', 'ibu', 'wali'] as const).map((p) => (
            <View key={p} style={{ gap: 6 }}>
              <T variant="label" tone="muted">{p === 'ayah' ? 'AYAH KANDUNG' : p === 'ibu' ? 'IBU KANDUNG' : `WALI${d.wali?.hubungan_wali ? ` (${d.wali.hubungan_wali})` : ''}`}</T>
              <Rows src={d[p] ?? {}} fields={PARENT} />
            </View>
          ))}
        </Section>

        <Section id="alamat" title="Alamat" icon="home-outline">
          <T variant="label" tone="muted">ALAMAT SISWA</T>
          <Rows src={d.alamat_siswa ?? {}} fields={ADDR} />
          {(['alamat_ayah', 'alamat_ibu', 'alamat_wali'] as const).map((a) => (d[a]?.alamat ? (
            <View key={a} style={{ gap: 6 }}>
              <T variant="label" tone="muted">{a === 'alamat_ayah' ? 'ALAMAT AYAH' : a === 'alamat_ibu' ? 'ALAMAT IBU' : 'ALAMAT WALI'}</T>
              <Rows src={d[a]} fields={ADDR} />
            </View>
          ) : null))}
        </Section>

        <Section id="keahlian" title="Keahlian" icon="sparkles-outline" count={(d.keahlian ?? []).length}>
          {(d.keahlian ?? []).length ? (d.keahlian as Obj[]).map((x, i) => (
            <Item key={i} title={x.nama_keahlian || x.bidang_keahlian || `Keahlian ${i + 1}`}
              lines={[x.bidang_keahlian, x.sertifikasi, x.lembaga_penyelenggara, x.hasil_tingkat_skor]} file={x.file_bukti_sertifikat} />
          )) : <T variant="caption" tone="muted">Belum diisi.</T>}
        </Section>

        <Section id="tahfidz" title="Tahfidz" icon="book-outline">
          <Rows src={d.tahfidz ?? {}} fields={[['juz_alquran_dihafal', "Juz Al-Qur'an dihafal"]]} />
          {d.tahfidz?.file_bukti_syahadah ? <FileBtn label="Bukti syahadah" path={d.tahfidz.file_bukti_syahadah} /> : null}
          {d.tahfidz?.file_bukti_tahsin ? <FileBtn label="Bukti tahsin" path={d.tahfidz.file_bukti_tahsin} /> : null}
        </Section>

        <Section id="beasiswa" title="Beasiswa & bantuan" icon="ribbon-outline" count={(d.beasiswa ?? []).length}>
          {(d.beasiswa ?? []).length ? (d.beasiswa as Obj[]).map((x, i) => (
            <Item key={i} title={x.nama_beasiswa || x.kategori || `Beasiswa ${i + 1}`}
              lines={[[x.tahun, x.kategori].filter(Boolean).join(' · '), x.nama_instansi_pemberi || x.jenis_instansi_pemberi,
                x.jangka_waktu_bulan ? `${x.jangka_waktu_bulan} bulan` : null, x.nominal_beasiswa ? `Rp ${x.nominal_beasiswa}` : null]} />
          )) : <T variant="caption" tone="muted">Belum diisi.</T>}
        </Section>

        <Section id="pendidikan" title="Pendidikan lain" icon="school-outline" count={(d.pendidikan_lain ?? []).length}>
          {(d.pendidikan_lain ?? []).length ? (d.pendidikan_lain as Obj[]).map((x, i) => (
            <Item key={i} title={x.nama_lembaga || `Lembaga ${i + 1}`} lines={[x.jenis_lembaga, x.frekuensi_belajar, x.mulai_belajar ? `Mulai ${x.mulai_belajar}` : null, x.lokasi_lembaga]} />
          )) : <T variant="caption" tone="muted">Belum diisi.</T>}
        </Section>

        <Section id="khusus" title="Kebutuhan khusus" icon="heart-outline">
          <Rows src={d} fields={[['jenis_kebutuhan_khusus', 'Jenis kebutuhan khusus'], ['kebutuhan_disabilitas', 'Disabilitas']]} />
        </Section>

        <Section id="berkas" title="Berkas" icon="folder-open-outline" count={BERKAS.filter(([key]) => d[key]).length}>
          {BERKAS.map(([key, label]) => (
            <View key={key} style={styles.row}>
              <Icon name={d[key] ? 'document-attach-outline' : 'remove-circle-outline'} size={18} color={d[key] ? colors.brandPrimary : colors.border} />
              <T style={{ flex: 1 }} tone={d[key] ? undefined : 'muted'}>{label}</T>
              {d[key] ? <Button title="Buka" variant="ghost" size="sm" onPress={() => openAuthedFile(String(d[key]))} /> : <T variant="small" tone="muted">Belum diunggah</T>}
            </View>
          ))}
        </Section>

        <Section id="riwayat" title="Riwayat kelas" icon="time-outline" count={hist.data?.length}>
          {hist.loading ? <CardSkeleton lines={2} /> : (hist.data ?? []).length ? (hist.data ?? []).map((h, i) => (
            <View key={h.id ?? i} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: i === 0 ? colors.brandPrimary : colors.border }]} />
              <View style={{ flex: 1 }}>
                <T weight="medium">Kelas {h.class_name ?? '-'}{h.semester ? ` · Semester ${h.semester}` : ''}</T>
                <T variant="caption" tone="muted">
                  {[h.academic_year_name, h.reason ? REASON[h.reason] ?? h.reason : null, h.start_date ? `sejak ${formatDateShort(h.start_date)}` : null].filter(Boolean).join(' · ')}
                </T>
              </View>
            </View>
          )) : <T variant="caption" tone="muted">{hist.error ? 'Riwayat kelas belum bisa dimuat.' : 'Belum ada riwayat kelas.'}</T>}
        </Section>

        {lain ? null : <Button title="Lihat prestasi saya" icon="trophy-outline" variant="outline" onPress={() => router.push('/prestasi')} />}
      </View>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kv}>
      <T variant="caption" tone="muted" style={styles.kvLabel}>{label}</T>
      <T style={{ flex: 1 }} selectable>{value}</T>
    </View>
  );
}

function Item({ title, lines, file }: { title: string; lines: (string | null | undefined)[]; file?: string | null }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.item, { borderColor: colors.divider }]}>
      <T weight="medium">{title}</T>
      {lines.filter(Boolean).map((l, i) => <T key={i} variant="caption" tone="secondary">{l}</T>)}
      {file ? <FileBtn label="Bukti" path={file} /> : null}
    </View>
  );
}

function FileBtn({ label, path }: { label: string; path: string }) {
  return <Button title={label} icon="document-attach-outline" variant="ghost" size="sm" style={{ alignSelf: 'flex-start' }} onPress={() => openAuthedFile(path)} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  idCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  secHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, minHeight: 52 },
  secBody: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  kv: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  kvLabel: { width: 128, paddingTop: 2 },
  item: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, gap: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
