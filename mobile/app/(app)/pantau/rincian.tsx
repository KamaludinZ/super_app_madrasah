/**
 * Rincian data unit layanan (Kepala Madrasah, hanya lihat) — native, pengganti halaman daftar web:
 *   jenis=konseling          /admin/bk/kunjungan          GET /bk/kunjungan
 *   jenis=sekolah-lanjutan   /admin/bk/sekolah-lanjutan   GET /bk/sekolah-lanjutan
 *   jenis=perpus-kunjungan   /admin/perpus/kunjungan      GET /perpus/kunjungan
 *   jenis=perpus-peminjaman  /admin/perpus/peminjaman     GET /perpus/peminjaman
 *   jenis=uks-kunjungan      /admin/uks/kunjungan         GET /uks/kunjungan
 * Daftar dengan rentang tanggal (bila didukung), pencarian, hitungan per status/jenis, dan rincian
 * yang bisa dibuka per baris. Pengelolaan data (tambah/ubah/hapus) tetap di modul web petugas.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { request, errorMessage } from '@/api/client';
import { Bars, cocok, SearchBox } from '@/pantau/ui';
import { useCached } from '@/hooks/useCached';
import { formatDateShort, todayISO } from '@/utils/time';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { DateField } from '@/components/ui/DateField';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

type Row = Record<string, any>;
type Jenis = 'konseling' | 'sekolah-lanjutan' | 'perpus-kunjungan' | 'perpus-peminjaman' | 'uks-kunjungan';
type Konfig = {
  judul: string; path: string; tanggal: boolean; kelompok: string; kelompokJudul: string;
  title: (r: Row) => string; sub: (r: Row) => (string | null | undefined)[]; badge?: (r: Row) => { label: string; tone: BadgeTone } | null;
  detail: (r: Row) => [string, unknown][]; cari: (r: Row) => string;
};

const tgl = (v?: string | null) => (v ? formatDateShort(v) : null);
const TONE: Record<string, BadgeTone> = {
  Rencana: 'neutral', Mendaftar: 'brand', Diterima: 'success', 'Tidak Diterima': 'error',
  Dipinjam: 'brand', Dikembalikan: 'success', Terlambat: 'error', Hilang: 'error',
  'Sudah Ditangani': 'success', 'Belum Ditangani': 'warning', Menunggu: 'warning',
};
const badgeStatus = (r: Row) => (r.status ? { label: String(r.status), tone: TONE[r.status] ?? 'neutral' } : null);

const KONFIG: Record<Jenis, Konfig> = {
  konseling: {
    judul: 'Kunjungan Konseling', path: '/bk/kunjungan', tanggal: true, kelompok: 'jenis_layanan', kelompokJudul: 'Per jenis layanan',
    title: (r) => r.siswa_nama ?? '-', sub: (r) => [tgl(r.tanggal), r.siswa_kelas ? `Kelas ${r.siswa_kelas}` : null],
    badge: (r) => (r.jenis_layanan ? { label: r.jenis_layanan, tone: 'brand' } : null),
    detail: (r) => [['Masalah', r.masalah], ['Penanganan', r.penanganan], ['Tindak lanjut', r.tindak_lanjut], ['Guru BK', r.petugas_nama]],
    cari: (r) => `${r.siswa_nama} ${r.siswa_kelas} ${r.jenis_layanan}`,
  },
  'sekolah-lanjutan': {
    judul: 'Data Sekolah Lanjutan', path: '/bk/sekolah-lanjutan', tanggal: false, kelompok: 'jenjang_tujuan', kelompokJudul: 'Per jenjang tujuan',
    title: (r) => r.siswa_nama ?? '-', sub: (r) => [r.siswa_kelas ? `Kelas ${r.siswa_kelas}` : null, r.jenjang_tujuan, r.nama_sekolah_tujuan],
    badge: badgeStatus,
    detail: (r) => [['Sekolah tujuan', r.nama_sekolah_tujuan], ['Jenjang', r.jenjang_tujuan], ['Tahun lulus', r.tahun_ajaran_lulus], ['Catatan', r.catatan]],
    cari: (r) => `${r.siswa_nama} ${r.siswa_kelas} ${r.nama_sekolah_tujuan} ${r.jenjang_tujuan}`,
  },
  'perpus-kunjungan': {
    judul: 'Kunjungan Perpustakaan', path: '/perpus/kunjungan', tanggal: true, kelompok: 'tujuan', kelompokJudul: 'Per tujuan',
    title: (r) => r.pengunjung_nama ?? '-', sub: (r) => [tgl(r.tanggal), r.waktu, r.tujuan],
    detail: (r) => [['Identitas', r.pengunjung_identitas], ['Keterangan', r.keterangan]],
    cari: (r) => `${r.pengunjung_nama} ${r.tujuan} ${r.pengunjung_identitas}`,
  },
  'perpus-peminjaman': {
    judul: 'Peminjaman Perpustakaan', path: '/perpus/peminjaman', tanggal: true, kelompok: 'status', kelompokJudul: 'Per status',
    title: (r) => r.koleksi_judul ?? '-', sub: (r) => [r.peminjam_nama, tgl(r.tanggal_pinjam)],
    badge: badgeStatus,
    detail: (r) => [['Peminjam', r.peminjam_nama], ['Identitas', r.peminjam_identitas], ['Dipinjam', tgl(r.tanggal_pinjam)],
      ['Rencana kembali', tgl(r.tanggal_kembali_rencana)], ['Dikembalikan', tgl(r.tanggal_kembali_aktual)], ['Catatan', r.catatan], ['Petugas', r.petugas_nama]],
    cari: (r) => `${r.koleksi_judul} ${r.peminjam_nama} ${r.peminjam_identitas}`,
  },
  'uks-kunjungan': {
    judul: 'Kunjungan UKS', path: '/uks/kunjungan', tanggal: true, kelompok: 'status', kelompokJudul: 'Per status',
    title: (r) => r.pasien_nama ?? '-', sub: (r) => [tgl(r.tanggal), r.waktu, r.pasien_kelas ? `Kelas ${r.pasien_kelas}` : r.pasien_tipe === 'gtk' ? 'GTK' : null],
    badge: badgeStatus,
    detail: (r) => [['Keluhan', r.keluhan], ['Diagnosa', [r.diagnosa_utama_nama, ...(r.diagnosa_tambahan_nama ?? [])].filter(Boolean).join(', ')],
      ['Penanganan', Array.isArray(r.jenis_penanganan_nama) ? r.jenis_penanganan_nama.join(', ') : r.jenis_penanganan_nama],
      ['Kondisi pulang', r.kondisi_pulang], ['Suhu', r.suhu ? `${r.suhu} °C` : null], ['Tekanan darah', r.tekanan_darah], ['Petugas', r.petugas_nama]],
    cari: (r) => `${r.pasien_nama} ${r.pasien_kelas} ${r.keluhan} ${r.diagnosa_utama_nama ?? ''}`,
  },
};

export default function PantauRincian() {
  const { colors } = useTheme();
  const p = useLocalSearchParams<{ jenis?: string }>();
  const jenis: Jenis = (p.jenis && p.jenis in KONFIG ? p.jenis : 'konseling') as Jenis;
  const k = KONFIG[jenis];
  const [dari, setDari] = useState(`${todayISO().slice(0, 7)}-01`);
  const [sampai, setSampai] = useState(todayISO());
  const [q, setQ] = useState('');
  const [buka, setBuka] = useState<string | null>(null);
  const res = useCached<Row[]>(`pantau.rincian.${jenis}.${k.tanggal ? `${dari}.${sampai}` : 'semua'}`,
    () => request<Row[]>(k.path, { query: k.tanggal ? { start_date: dari, end_date: sampai } : {} }));
  const rows = useMemo(() => (res.data ?? []).filter((r) => cocok(k.cari(r), q)), [res.data, q, k]);
  const kelompok = useMemo(() => {
    const m: Record<string, number> = {};
    (res.data ?? []).forEach((r) => { const key = r[k.kelompok] || 'Lainnya'; m[key] = (m[key] ?? 0) + 1; });
    return m;
  }, [res.data, k]);

  return (
    <Screen title={k.judul} subtitle={res.data ? `${res.data.length} data · hanya lihat` : 'Hanya lihat'} back
      refreshing={res.refreshing} onRefresh={res.refresh} offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}>
      <View style={{ gap: spacing.md }}>
        {k.tanggal ? (
          <View style={styles.two}>
            <DateField label="Dari" value={dari} max={sampai} onChange={(v) => v && setDari(v)} style={{ flex: 1 }} />
            <DateField label="Sampai" value={sampai} min={dari} max={todayISO()} onChange={(v) => v && setSampai(v)} style={{ flex: 1 }} />
          </View>
        ) : null}
        {res.loading ? <CardSkeleton lines={6} /> : !res.data ? (
          <ErrorState message={errorMessage(res.error, 'Data belum bisa dimuat.')} onRetry={res.refresh} compact />
        ) : (
          <>
            {res.data.length ? <Card style={{ gap: spacing.sm }}><T weight="semibold">{k.kelompokJudul}</T><Bars data={kelompok} /></Card> : null}
            <SearchBox value={q} onChange={setQ} placeholder="Cari…" />
            {rows.length === 0 ? <Card><EmptyState icon="file-tray-outline" title="Tidak ada data" message={k.tanggal ? 'Tidak ada data pada rentang tanggal ini.' : undefined} compact /></Card>
              : rows.slice(0, 300).map((r, i) => {
                const id = String(r.id ?? i);
                const terbuka = buka === id;
                const b = k.badge?.(r);
                const isi = k.detail(r).filter(([, v]) => v !== null && v !== undefined && v !== '');
                return (
                  <Card key={id} style={{ gap: spacing.sm }}>
                    <Pressable onPress={() => setBuka(terbuka ? null : id)} accessibilityRole="button" accessibilityState={{ expanded: terbuka }} style={styles.row}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <T weight="medium" numberOfLines={terbuka ? undefined : 1}>{k.title(r)}</T>
                        <T variant="caption" tone="muted" numberOfLines={1}>{k.sub(r).filter(Boolean).join(' · ') || '-'}</T>
                      </View>
                      {b ? <Badge label={b.label} tone={b.tone} small /> : null}
                      {isi.length ? <Icon name={terbuka ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} /> : null}
                    </Pressable>
                    {terbuka && isi.length ? (
                      <View style={[styles.detail, { borderTopColor: colors.divider }]}>
                        {isi.map(([label, v]) => (
                          <View key={label} style={styles.baris}>
                            <T variant="caption" tone="muted" style={{ width: 110 }}>{label}</T>
                            <T variant="caption" style={{ flex: 1 }}>{String(v)}</T>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </Card>
                );
              })}
            {rows.length > 300 ? <T variant="caption" tone="muted" center>Menampilkan 300 data terbaru — persempit rentang tanggal atau pencarian.</T> : null}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  two: { flexDirection: 'row', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  detail: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, gap: 4 },
  baris: { flexDirection: 'row', gap: spacing.sm },
});
