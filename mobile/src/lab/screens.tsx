/**
 * Isi enam menu Lab (native, sama dengan halaman web /lab/{lab}/{menu}): daftar + rincian yang bisa dibuka,
 * formulir tambah/ubah dalam lembar bawah, dan hapus dengan konfirmasi. Dipanggil dari app/(app)/lab/[lab]/[menu].tsx.
 */
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '@/api/client';
import { useAuth } from '@/store/auth';
import { useNetwork } from '@/store/network';
import { useCached } from '@/hooks/useCached';
import { formatDateShort, todayISO } from '@/utils/time';
import { spacing, useTheme } from '@/theme';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { DateField } from '@/components/ui/DateField';
import { TimeField } from '@/components/ui/TimeField';
import { SelectField } from '@/components/ui/SelectField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { cocok, SearchBox } from '@/pantau/ui';
import {
  labApi, AlatBahan, AlatBahanList, JadwalLab, JurnalPengelolaan, JurnalPenggunaan, KerusakanLab, LabMeta, PeminjamanAlat,
} from './api';
import { AsetSelect, Baris, FormSheet, kodeAset, pecahAset, rupiah, WargaPicker } from './ui';

type P = { lab: string };
const angka = (v: string) => (v.trim() === '' ? 0 : Math.max(0, parseInt(v, 10) || 0));
const angkaOpsional = (v: string) => (v.trim() === '' ? null : Number(v.replace(/[^\d.]/g, '')) || null);

/** Muat ulang semua cache lab ini setelah perubahan. */
function useSegar(lab: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith(`lab.${lab}.`) });
}

function useAksi(lab: string) {
  const segar = useSegar(lab);
  const [sibuk, setSibuk] = useState(false);
  const jalankan = async (fn: () => Promise<unknown>, pesan: string, selesai?: () => void) => {
    setSibuk(true);
    try { await fn(); toast.success(pesan); selesai?.(); await segar(); } catch (e) { toast.error(errorMessage(e, 'Gagal menyimpan.')); } finally { setSibuk(false); }
  };
  const hapus = (judul: string, fn: () => Promise<unknown>) => Alert.alert('Hapus data?', judul, [
    { text: 'Batal', style: 'cancel' },
    { text: 'Hapus', style: 'destructive', onPress: () => void jalankan(fn, 'Data dihapus') },
  ]);
  return { sibuk, jalankan, hapus };
}

function Daftar<T extends { id: string }>({ res, kosong, children }: { res: { loading: boolean; data?: T[] | null; error: unknown; refresh: () => unknown }; kosong: string; children: (rows: T[]) => React.ReactNode }) {
  if (res.loading) return <CardSkeleton lines={5} />;
  if (!res.data) return <ErrorState message={errorMessage(res.error, 'Data lab belum bisa dimuat.')} onRetry={() => void res.refresh()} compact />;
  if (!res.data.length) return <Card><EmptyState icon="flask-outline" title={kosong} compact /></Card>;
  return <>{children(res.data)}</>;
}

function Kartu({ judul, sub, badge, buka, onToggle, children, onUbah, onHapus }: {
  judul: string; sub?: string | null; badge?: { label: string; tone: BadgeTone } | null; buka: boolean; onToggle: () => void;
  children?: React.ReactNode; onUbah?: () => void; onHapus?: () => void;
}) {
  const { colors } = useTheme();
  const { online } = useNetwork();
  return (
    <Card style={{ gap: spacing.sm }}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: buka }} style={styles.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <T weight="medium" numberOfLines={buka ? undefined : 1}>{judul}</T>
          {sub ? <T variant="caption" tone="muted" numberOfLines={buka ? undefined : 1}>{sub}</T> : null}
        </View>
        {badge ? <Badge label={badge.label} tone={badge.tone} small /> : null}
        <Icon name={buka ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
      </Pressable>
      {buka ? (
        <View style={[styles.detail, { borderTopColor: colors.divider }]}>
          {children}
          <View style={styles.row}>
            <View style={{ flex: 1 }} />
            {onUbah ? <Button title="Ubah" icon="create-outline" variant="ghost" size="sm" disabled={!online} onPress={onUbah} /> : null}
            {onHapus ? <Button title="Hapus" icon="trash-outline" variant="ghost" size="sm" disabled={!online} onPress={onHapus} /> : null}
          </View>
        </View>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------- Alat & bahan
export function AlatBahanScreen({ lab, tambah, setTambah }: P & { tambah: boolean; setTambah: (b: boolean) => void }) {
  const { colors } = useTheme();
  const res = useCached<AlatBahanList>(`lab.${lab}.alat-bahan`, () => labApi.alatBahan(lab));
  const meta = useCached<LabMeta>(`lab.${lab}.meta`, () => labApi.meta(lab), { staleTime: 60 * 60_000 });
  const { sibuk, jalankan, hapus } = useAksi(lab);
  const [q, setQ] = useState('');
  const [tipe, setTipe] = useState<'semua' | 'tetap' | 'lancar'>('semua');
  const [buka, setBuka] = useState<string | null>(null);
  const [edit, setEdit] = useState<AlatBahan | null>(null);
  const kosong = { aset_tipe: 'tetap', nama: '', kategori: null as string | null, satuan: '', sumber_dana: 'Komite', baik: '', rusak: '', stok: '', min: '', lokasi: '', ket: '' };
  const [f, setF] = useState(kosong);
  const bukaForm = (a: AlatBahan | null) => {
    setEdit(a);
    setF(a ? {
      aset_tipe: a.aset_tipe, nama: a.nama, kategori: a.kategori ?? null, satuan: a.satuan ?? '', sumber_dana: a.sumber_dana ?? 'Komite',
      baik: String(a.jumlah_baik ?? ''), rusak: String(a.jumlah_rusak ?? ''), stok: String(a.stok ?? ''), min: String(a.stok_minimum ?? ''),
      lokasi: a.lokasi_penyimpanan ?? '', ket: a.keterangan ?? '',
    } : kosong);
    setTambah(true);
  };
  const tutup = () => { setTambah(false); setEdit(null); };
  const simpan = () => {
    if (!f.nama.trim()) { toast.error('Nama alat/bahan wajib diisi'); return; }
    void jalankan(() => labApi.simpanAlatBahan(lab, edit, {
      aset_tipe: f.aset_tipe, nama: f.nama.trim(), kategori: f.kategori, satuan: f.satuan.trim() || null, sumber_dana: f.sumber_dana,
      jumlah_baik: angka(f.baik), jumlah_rusak: angka(f.rusak), stok: angka(f.stok), stok_minimum: angka(f.min),
      lokasi_penyimpanan: f.lokasi.trim() || null, keterangan: f.ket.trim() || null, ruangan_id: edit?.ruangan_id ?? null,
    }), edit ? 'Alat/bahan diperbarui' : 'Alat/bahan ditambahkan', tutup);
  };
  const rows = (res.data?.items ?? []).filter((i) => (tipe === 'semua' || i.aset_tipe === tipe) && cocok(`${i.nama} ${i.kategori ?? ''}`, q));
  const menipis = (res.data?.items ?? []).filter((i) => i.aset_tipe === 'lancar' && (i.stok ?? 0) <= (i.stok_minimum ?? 0)).length;

  return (
    <View style={{ gap: spacing.md }}>
      <SegmentedControl small value={tipe} onChange={setTipe} segments={[{ value: 'semua', label: 'Semua' }, { value: 'tetap', label: 'Alat' }, { value: 'lancar', label: 'Bahan' }]} />
      <SearchBox value={q} onChange={setQ} placeholder="Cari alat atau bahan…" />
      {menipis ? <T variant="caption" color={colors.error}>{menipis} bahan stoknya di bawah batas minimum.</T> : null}
      {res.loading ? <CardSkeleton lines={5} /> : !res.data ? <ErrorState message={errorMessage(res.error, 'Data lab belum bisa dimuat.')} onRetry={res.refresh} compact />
        : rows.length === 0 ? <Card><EmptyState icon="flask-outline" title="Belum ada alat/bahan" compact /></Card>
          : rows.map((a) => {
            const tipis = a.aset_tipe === 'lancar' && (a.stok ?? 0) <= (a.stok_minimum ?? 0);
            return (
              <Kartu key={`${a.aset_tipe}-${a.id}`} judul={a.nama} buka={buka === a.id} onToggle={() => setBuka(buka === a.id ? null : a.id)}
                sub={[a.aset_tipe === 'tetap' ? `Baik ${a.jumlah_baik ?? 0} · Rusak ${a.jumlah_rusak ?? 0}` : `Stok ${a.stok ?? 0} ${a.satuan ?? ''}`, a.kategori].filter(Boolean).join(' · ')}
                badge={tipis ? { label: 'Menipis', tone: 'error' } : { label: a.aset_tipe === 'tetap' ? 'Alat' : 'Bahan', tone: 'neutral' }}
                onUbah={() => bukaForm(a)} onHapus={() => hapus(a.nama, () => labApi.hapusAlatBahan(lab, a))}>
                <Baris label="Sumber dana" value={a.sumber_dana} />
                <Baris label="Satuan" value={a.satuan} />
                {a.aset_tipe === 'lancar' ? <Baris label="Stok minimum" value={a.stok_minimum} /> : null}
                <Baris label="Penyimpanan" value={a.lokasi_penyimpanan} />
                <Baris label="Ruangan" value={a.ruangan_nama} />
                <Baris label="Keterangan" value={a.keterangan} />
              </Kartu>
            );
          })}
      <FormSheet judul={edit ? 'Ubah alat/bahan' : 'Tambah alat/bahan'} buka={tambah} onTutup={tutup} onSimpan={simpan} sibuk={sibuk}>
        {edit ? null : (
          <SegmentedControl value={f.aset_tipe} onChange={(v) => setF({ ...f, aset_tipe: v })}
            segments={[{ value: 'tetap', label: 'Alat (inventaris)' }, { value: 'lancar', label: 'Bahan habis pakai' }]} />
        )}
        <Input label="Nama *" value={f.nama} onChangeText={(v) => setF({ ...f, nama: v })} />
        <SelectField label="Kategori" value={f.kategori} options={(meta.data?.kategori_alat_bahan ?? ['Umum']).map((k) => ({ value: k, label: k }))} onChange={(v) => setF({ ...f, kategori: v })} />
        {f.aset_tipe === 'tetap' ? (
          <View style={styles.two}>
            <Input label="Jumlah baik" value={f.baik} onChangeText={(v) => setF({ ...f, baik: v })} keyboardType="number-pad" containerStyle={{ flex: 1 }} />
            <Input label="Jumlah rusak" value={f.rusak} onChangeText={(v) => setF({ ...f, rusak: v })} keyboardType="number-pad" containerStyle={{ flex: 1 }} />
          </View>
        ) : (
          <View style={styles.two}>
            <Input label="Stok" value={f.stok} onChangeText={(v) => setF({ ...f, stok: v })} keyboardType="number-pad" containerStyle={{ flex: 1 }} />
            <Input label="Stok minimum" value={f.min} onChangeText={(v) => setF({ ...f, min: v })} keyboardType="number-pad" containerStyle={{ flex: 1 }} />
          </View>
        )}
        <View style={styles.two}>
          <Input label="Satuan" value={f.satuan} onChangeText={(v) => setF({ ...f, satuan: v })} placeholder="unit, ml, gram" containerStyle={{ flex: 1 }} />
          <View style={{ flex: 1 }}>
            <SelectField label="Sumber dana" value={f.sumber_dana} allowNone={false} options={[{ value: 'Komite', label: 'Komite' }, { value: 'BMN', label: 'BMN' }]} onChange={(v) => v && setF({ ...f, sumber_dana: v })} />
          </View>
        </View>
        <Input label="Lokasi penyimpanan" value={f.lokasi} onChangeText={(v) => setF({ ...f, lokasi: v })} placeholder="mis. Lemari A rak 2" />
        <Input label="Keterangan" value={f.ket} onChangeText={(v) => setF({ ...f, ket: v })} multiline />
      </FormSheet>
    </View>
  );
}

// ---------------------------------------------------------------- Jadwal penggunaan
export function JadwalScreen({ lab, tambah, setTambah }: P & { tambah: boolean; setTambah: (b: boolean) => void }) {
  const { colors } = useTheme();
  const [minggu, setMinggu] = useState('1');
  const res = useCached<JadwalLab[]>(`lab.${lab}.jadwal`, () => labApi.daftar<JadwalLab>(lab, 'jadwal'));
  const meta = useCached<LabMeta>(`lab.${lab}.meta`, () => labApi.meta(lab), { staleTime: 60 * 60_000 });
  const guru = useCached<{ id: string; full_name: string }[]>(`lab.${lab}.guru`, () => labApi.guruLab(lab), { staleTime: 60 * 60_000 });
  const { sibuk, jalankan, hapus } = useAksi(lab);
  const [edit, setEdit] = useState<JadwalLab | null>(null);
  const kosong = { minggu_ke: minggu, hari: 'Senin', jam_mulai: '', jam_selesai: '', kelas: '', guru_nama: '', ket: '' };
  const [f, setF] = useState(kosong);
  const bukaForm = (j: JadwalLab | null) => {
    setEdit(j);
    setF(j ? { minggu_ke: String(j.minggu_ke), hari: j.hari, jam_mulai: j.jam_mulai ?? '', jam_selesai: j.jam_selesai ?? '', kelas: j.kelas, guru_nama: j.guru_nama, ket: j.keterangan ?? '' } : { ...kosong, minggu_ke: minggu });
    setTambah(true);
  };
  const tutup = () => { setTambah(false); setEdit(null); };
  const simpan = () => {
    if (!f.kelas.trim() || !f.guru_nama.trim()) { toast.error('Kelas dan guru wajib diisi'); return; }
    void jalankan(() => labApi.simpan(lab, 'jadwal', edit?.id ?? null, {
      minggu_ke: Number(f.minggu_ke), hari: f.hari, jam_mulai: f.jam_mulai || null, jam_selesai: f.jam_selesai || null,
      kelas: f.kelas.trim(), guru_nama: f.guru_nama.trim(), keterangan: f.ket.trim() || null,
    }), edit ? 'Jadwal diperbarui' : 'Jadwal ditambahkan', tutup);
  };
  const perHari = useMemo(() => {
    const m = new Map<string, JadwalLab[]>();
    (res.data ?? []).filter((j) => String(j.minggu_ke) === minggu).forEach((j) => m.set(j.hari, [...(m.get(j.hari) ?? []), j]));
    return (meta.data?.hari ?? ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']).filter((h) => m.get(h)?.length).map((h) => [h, m.get(h)!] as const);
  }, [res.data, minggu, meta.data]);

  return (
    <View style={{ gap: spacing.md }}>
      <SegmentedControl small value={minggu} onChange={setMinggu} segments={['1', '2', '3', '4'].map((m) => ({ value: m, label: `Minggu ${m}` }))} />
      {res.loading ? <CardSkeleton lines={5} /> : !res.data ? <ErrorState message={errorMessage(res.error, 'Jadwal belum bisa dimuat.')} onRetry={res.refresh} compact />
        : perHari.length === 0 ? <Card><EmptyState icon="calendar-outline" title={`Belum ada jadwal minggu ke-${minggu}`} compact /></Card>
          : perHari.map(([hari, list]) => (
            <Card key={hari} style={{ gap: spacing.sm }}>
              <T variant="label" weight="semibold" tone="secondary">{hari}</T>
              {list.map((j, i) => (
                <View key={j.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, paddingTop: spacing.sm }]}>
                  <View style={{ flex: 1 }}>
                    <T weight="medium">Kelas {j.kelas} · {j.guru_nama}</T>
                    <T variant="caption" tone="muted">{j.jam_mulai && j.jam_selesai ? `${j.jam_mulai}–${j.jam_selesai}` : 'Jam belum diisi'}{j.keterangan ? ` · ${j.keterangan}` : ''}</T>
                  </View>
                  <IconButton name="create-outline" accessibilityLabel="Ubah jadwal" onPress={() => bukaForm(j)} color={colors.onSurface} />
                  <IconButton name="trash-outline" accessibilityLabel="Hapus jadwal" onPress={() => hapus(`${j.hari} · kelas ${j.kelas}`, () => labApi.hapus(lab, 'jadwal', j.id))} color={colors.error} />
                </View>
              ))}
            </Card>
          ))}
      <FormSheet judul={edit ? 'Ubah jadwal lab' : 'Tambah jadwal lab'} buka={tambah} onTutup={tutup} onSimpan={simpan} sibuk={sibuk}>
        <View style={styles.two}>
          <View style={{ flex: 1 }}><SelectField label="Minggu ke" value={f.minggu_ke} allowNone={false} options={['1', '2', '3', '4'].map((m) => ({ value: m, label: m }))} onChange={(v) => v && setF({ ...f, minggu_ke: v })} /></View>
          <View style={{ flex: 1 }}><SelectField label="Hari" value={f.hari} allowNone={false} options={(meta.data?.hari ?? ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']).map((h) => ({ value: h, label: h }))} onChange={(v) => v && setF({ ...f, hari: v })} /></View>
        </View>
        <View style={styles.two}>
          <TimeField label="Jam mulai" value={f.jam_mulai} onChange={(v) => setF({ ...f, jam_mulai: v })} style={{ flex: 1 }} />
          <TimeField label="Jam selesai" value={f.jam_selesai} onChange={(v) => setF({ ...f, jam_selesai: v })} style={{ flex: 1 }} />
        </View>
        <Input label="Kelas *" value={f.kelas} onChangeText={(v) => setF({ ...f, kelas: v })} placeholder="mis. 8A" autoCapitalize="characters" />
        <SelectField label="Guru *" value={f.guru_nama || null} allowNone={false} options={(guru.data ?? []).map((g) => ({ value: g.full_name, label: g.full_name }))} onChange={(v) => setF({ ...f, guru_nama: v ?? '' })} />
        <Input label="Keterangan" value={f.ket} onChangeText={(v) => setF({ ...f, ket: v })} />
      </FormSheet>
    </View>
  );
}

// ---------------------------------------------------------------- Jurnal penggunaan
export function JurnalPenggunaanScreen({ lab, tambah, setTambah }: P & { tambah: boolean; setTambah: (b: boolean) => void }) {
  const res = useCached<JurnalPenggunaan[]>(`lab.${lab}.jurnal-penggunaan`, () => labApi.daftar<JurnalPenggunaan>(lab, 'jurnal-penggunaan'));
  const { sibuk, jalankan, hapus } = useAksi(lab);
  const [buka, setBuka] = useState<string | null>(null);
  const kosong = { tanggal: todayISO(), jam_mulai: '', jam_selesai: '', judul: '', alat: '', kegiatan: '', kondisi: '', ket: '' };
  const [f, setF] = useState(kosong);
  const tutup = () => { setTambah(false); setF(kosong); };
  const simpan = () => {
    if (!f.judul.trim()) { toast.error('Judul kegiatan/percobaan wajib diisi'); return; }
    void jalankan(() => labApi.simpan(lab, 'jurnal-penggunaan', null, {
      tanggal: f.tanggal, jam_mulai: f.jam_mulai || null, jam_selesai: f.jam_selesai || null, judul_percobaan: f.judul.trim(),
      alat_bahan_digunakan: f.alat.trim() || null, kegiatan: f.kegiatan.trim() || null, kondisi_setelah: f.kondisi.trim() || null, keterangan: f.ket.trim() || null,
    }), 'Jurnal penggunaan disimpan', tutup);
  };
  return (
    <View style={{ gap: spacing.md }}>
      <Daftar res={res} kosong="Belum ada jurnal penggunaan">{(rows) => rows.map((j) => (
        <Kartu key={j.id} judul={j.judul_percobaan} buka={buka === j.id} onToggle={() => setBuka(buka === j.id ? null : j.id)}
          sub={[formatDateShort(j.tanggal), j.jam_mulai && j.jam_selesai ? `${j.jam_mulai}–${j.jam_selesai}` : null, j.pengguna_nama].filter(Boolean).join(' · ')}
          onHapus={() => hapus(j.judul_percobaan, () => labApi.hapus(lab, 'jurnal-penggunaan', j.id))}>
          <Baris label="Alat & bahan" value={j.alat_bahan_digunakan} />
          <Baris label="Kegiatan" value={j.kegiatan} />
          <Baris label="Kondisi setelah" value={j.kondisi_setelah} />
          <Baris label="Penanggung jawab" value={j.penanggung_jawab_nama} />
          <Baris label="Keterangan" value={j.keterangan} />
        </Kartu>
      ))}</Daftar>
      <FormSheet judul="Isi jurnal penggunaan lab" buka={tambah} onTutup={tutup} onSimpan={simpan} sibuk={sibuk}>
        <DateField label="Tanggal" value={f.tanggal} max={todayISO()} onChange={(v) => v && setF({ ...f, tanggal: v })} />
        <View style={styles.two}>
          <TimeField label="Jam mulai" value={f.jam_mulai} onChange={(v) => setF({ ...f, jam_mulai: v })} style={{ flex: 1 }} />
          <TimeField label="Jam selesai" value={f.jam_selesai} onChange={(v) => setF({ ...f, jam_selesai: v })} style={{ flex: 1 }} />
        </View>
        <Input label="Judul kegiatan/percobaan *" value={f.judul} onChangeText={(v) => setF({ ...f, judul: v })} />
        <Input label="Alat & bahan digunakan" value={f.alat} onChangeText={(v) => setF({ ...f, alat: v })} multiline />
        <Input label="Kegiatan" value={f.kegiatan} onChangeText={(v) => setF({ ...f, kegiatan: v })} multiline />
        <Input label="Kondisi setelah digunakan" value={f.kondisi} onChangeText={(v) => setF({ ...f, kondisi: v })} placeholder="mis. Bersih, alat lengkap" />
        <Input label="Keterangan" value={f.ket} onChangeText={(v) => setF({ ...f, ket: v })} />
      </FormSheet>
    </View>
  );
}

// ---------------------------------------------------------------- Jurnal pengelolaan
export function JurnalPengelolaanScreen({ lab, tambah, setTambah }: P & { tambah: boolean; setTambah: (b: boolean) => void }) {
  const res = useCached<JurnalPengelolaan[]>(`lab.${lab}.jurnal-pengelolaan`, () => labApi.daftar<JurnalPengelolaan>(lab, 'jurnal-pengelolaan'));
  const { sibuk, jalankan, hapus } = useAksi(lab);
  const [buka, setBuka] = useState<string | null>(null);
  const kosong = { aset: null as string | null, tanggal: todayISO(), jenis: '', petugas: '', biaya: '', hasil: '', ket: '' };
  const [f, setF] = useState(kosong);
  const tutup = () => { setTambah(false); setF(kosong); };
  const simpan = () => {
    if (!f.aset || !f.jenis.trim()) { toast.error('Aset dan jenis perawatan wajib diisi'); return; }
    void jalankan(() => labApi.simpan(lab, 'jurnal-pengelolaan', null, {
      ...pecahAset(f.aset), tanggal: f.tanggal, jenis_perawatan: f.jenis.trim(), petugas_pelaksana: f.petugas.trim() || null,
      biaya: angkaOpsional(f.biaya), hasil: f.hasil.trim() || null, keterangan: f.ket.trim() || null,
    }), 'Jurnal pengelolaan disimpan', tutup);
  };
  return (
    <View style={{ gap: spacing.md }}>
      <Daftar res={res} kosong="Belum ada jurnal pengelolaan">{(rows) => rows.map((j) => (
        <Kartu key={j.id} judul={`${j.jenis_perawatan} · ${j.aset_nama ?? '-'}`} buka={buka === j.id} onToggle={() => setBuka(buka === j.id ? null : j.id)}
          sub={[formatDateShort(j.tanggal), j.petugas_pelaksana].filter(Boolean).join(' · ')}
          onHapus={() => hapus(j.jenis_perawatan, () => labApi.hapus(lab, 'jurnal-pengelolaan', j.id))}>
          <Baris label="Biaya" value={rupiah(j.biaya)} />
          <Baris label="Hasil" value={j.hasil} />
          <Baris label="Keterangan" value={j.keterangan} />
        </Kartu>
      ))}</Daftar>
      <FormSheet judul="Isi jurnal pengelolaan" buka={tambah} onTutup={tutup} onSimpan={simpan} sibuk={sibuk}>
        <AsetSelect lab={lab} value={f.aset} onChange={(v) => setF({ ...f, aset: v })} denganRuang />
        <DateField label="Tanggal" value={f.tanggal} max={todayISO()} onChange={(v) => v && setF({ ...f, tanggal: v })} />
        <Input label="Jenis perawatan *" value={f.jenis} onChangeText={(v) => setF({ ...f, jenis: v })} placeholder="mis. Kalibrasi, pembersihan" />
        <Input label="Petugas pelaksana" value={f.petugas} onChangeText={(v) => setF({ ...f, petugas: v })} />
        <Input label="Biaya (Rp)" value={f.biaya} onChangeText={(v) => setF({ ...f, biaya: v })} keyboardType="number-pad" />
        <Input label="Hasil" value={f.hasil} onChangeText={(v) => setF({ ...f, hasil: v })} multiline />
        <Input label="Keterangan" value={f.ket} onChangeText={(v) => setF({ ...f, ket: v })} />
      </FormSheet>
    </View>
  );
}

// ---------------------------------------------------------------- Peminjaman alat
const TONE_PINJAM: Record<string, BadgeTone> = { Dipinjam: 'warning', Dikembalikan: 'success', Terlambat: 'error', Hilang: 'error' };
export function PeminjamanScreen({ lab, tambah, setTambah }: P & { tambah: boolean; setTambah: (b: boolean) => void }) {
  const res = useCached<PeminjamanAlat[]>(`lab.${lab}.peminjaman-alat`, () => labApi.daftar<PeminjamanAlat>(lab, 'peminjaman-alat'));
  const { sibuk, jalankan, hapus } = useAksi(lab);
  const [buka, setBuka] = useState<string | null>(null);
  const [saring, setSaring] = useState<'aktif' | 'semua'>('aktif');
  const kosong = { aset: null as string | null, peminjam: null as { id: string; nama: string } | null, tanggal: todayISO(), kembali: null as string | null, jumlah: '1', keperluan: '' };
  const [f, setF] = useState(kosong);
  const tutup = () => { setTambah(false); setF(kosong); };
  const simpan = () => {
    if (!f.aset || !f.peminjam) { toast.error('Alat dan peminjam wajib dipilih'); return; }
    void jalankan(() => labApi.simpan(lab, 'peminjaman-alat', null, {
      ...pecahAset(f.aset), peminjam_id: f.peminjam!.id, tanggal_pinjam: f.tanggal, tanggal_kembali_rencana: f.kembali,
      jumlah: Math.max(1, angka(f.jumlah)), status: 'Dipinjam', keperluan: f.keperluan.trim() || null,
    }), 'Peminjaman dicatat', tutup);
  };
  const kembalikan = (p: PeminjamanAlat) => void jalankan(() => labApi.simpan(lab, 'peminjaman-alat', p.id, {
    aset_tipe: p.aset_tipe, aset_id: p.aset_id, peminjam_id: p.peminjam_id, tanggal_pinjam: p.tanggal_pinjam, tanggal_kembali_rencana: p.tanggal_kembali_rencana ?? null,
    tanggal_kembali_aktual: todayISO(), jumlah: p.jumlah, status: 'Dikembalikan', keperluan: p.keperluan ?? null, catatan: p.catatan ?? null,
  }), 'Ditandai dikembalikan');
  return (
    <View style={{ gap: spacing.md }}>
      <SegmentedControl small value={saring} onChange={setSaring} segments={[{ value: 'aktif', label: 'Sedang dipinjam' }, { value: 'semua', label: 'Semua' }]} />
      <Daftar res={{ ...res, data: res.data?.filter((p) => saring === 'semua' || p.status !== 'Dikembalikan') }} kosong="Tidak ada peminjaman">{(rows) => rows.map((p) => (
        <Kartu key={p.id} judul={`${p.aset_nama ?? '-'} × ${p.jumlah}`} buka={buka === p.id} onToggle={() => setBuka(buka === p.id ? null : p.id)}
          sub={[p.peminjam_nama, formatDateShort(p.tanggal_pinjam)].filter(Boolean).join(' · ')}
          badge={p.status ? { label: p.status, tone: TONE_PINJAM[p.status] ?? 'neutral' } : null}
          onHapus={() => hapus(p.aset_nama ?? 'Peminjaman', () => labApi.hapus(lab, 'peminjaman-alat', p.id))}>
          <Baris label="Rencana kembali" value={p.tanggal_kembali_rencana ? formatDateShort(p.tanggal_kembali_rencana) : null} />
          <Baris label="Dikembalikan" value={p.tanggal_kembali_aktual ? formatDateShort(p.tanggal_kembali_aktual) : null} />
          <Baris label="Keperluan" value={p.keperluan} />
          <Baris label="Catatan" value={p.catatan} />
          {p.status !== 'Dikembalikan' ? <Button title="Tandai dikembalikan" icon="return-down-back-outline" variant="outline" size="sm" loading={sibuk} onPress={() => kembalikan(p)} /> : null}
        </Kartu>
      ))}</Daftar>
      <FormSheet judul="Catat peminjaman alat" buka={tambah} onTutup={tutup} onSimpan={simpan} sibuk={sibuk}>
        <AsetSelect lab={lab} value={f.aset} onChange={(v) => setF({ ...f, aset: v })} />
        <WargaPicker lab={lab} terpilih={f.peminjam} onPilih={(w) => setF({ ...f, peminjam: w })} />
        <View style={styles.two}>
          <DateField label="Tanggal pinjam" value={f.tanggal} max={todayISO()} onChange={(v) => v && setF({ ...f, tanggal: v })} style={{ flex: 1 }} />
          <DateField label="Rencana kembali" value={f.kembali} min={f.tanggal} allowClear onChange={(v) => setF({ ...f, kembali: v })} style={{ flex: 1 }} />
        </View>
        <Input label="Jumlah" value={f.jumlah} onChangeText={(v) => setF({ ...f, jumlah: v })} keyboardType="number-pad" />
        <Input label="Keperluan" value={f.keperluan} onChangeText={(v) => setF({ ...f, keperluan: v })} />
      </FormSheet>
    </View>
  );
}

// ---------------------------------------------------------------- Laporan kerusakan
const TONE_RUSAK: Record<string, BadgeTone> = { Diajukan: 'warning', 'Proses Ganti': 'brand', 'Selesai Diganti': 'success' };
export function KerusakanScreen({ lab, tambah, setTambah }: P & { tambah: boolean; setTambah: (b: boolean) => void }) {
  const { user } = useAuth();
  const res = useCached<KerusakanLab[]>(`lab.${lab}.kerusakan`, () => labApi.daftar<KerusakanLab>(lab, 'kerusakan'));
  const meta = useCached<LabMeta>(`lab.${lab}.meta`, () => labApi.meta(lab), { staleTime: 60 * 60_000 });
  const { sibuk, jalankan, hapus } = useAksi(lab);
  const [buka, setBuka] = useState<string | null>(null);
  const [edit, setEdit] = useState<KerusakanLab | null>(null);
  const kosong = { aset: null as string | null, tanggal: todayISO(), jumlah: '1', deskripsi: '', status: 'Diajukan', tgl_perbaikan: null as string | null, biaya: '', hasil: '' };
  const [f, setF] = useState(kosong);
  const bukaForm = (k: KerusakanLab | null) => {
    setEdit(k);
    setF(k ? { aset: kodeAset(k.aset_tipe, k.aset_id), tanggal: k.tanggal_lapor, jumlah: String(k.jumlah_rusak), deskripsi: k.deskripsi_kerusakan, status: k.status ?? 'Diajukan',
      tgl_perbaikan: k.tanggal_perbaikan ?? null, biaya: k.biaya_perbaikan ? String(k.biaya_perbaikan) : '', hasil: k.hasil_perbaikan ?? '' } : kosong);
    setTambah(true);
  };
  const tutup = () => { setTambah(false); setEdit(null); };
  const simpan = () => {
    if (!f.aset || !f.deskripsi.trim()) { toast.error('Aset dan deskripsi kerusakan wajib diisi'); return; }
    void jalankan(() => labApi.simpan(lab, 'kerusakan', edit?.id ?? null, {
      ...pecahAset(f.aset), tanggal_lapor: f.tanggal, pelapor_id: edit?.pelapor_id ?? user?.id ?? null, jumlah_rusak: Math.max(1, angka(f.jumlah)),
      deskripsi_kerusakan: f.deskripsi.trim(), status: f.status, tanggal_perbaikan: f.tgl_perbaikan, biaya_perbaikan: angkaOpsional(f.biaya), hasil_perbaikan: f.hasil.trim() || null,
    }), edit ? 'Laporan diperbarui' : 'Kerusakan dilaporkan', tutup);
  };
  return (
    <View style={{ gap: spacing.md }}>
      <Daftar res={res} kosong="Belum ada laporan kerusakan">{(rows) => rows.map((k) => (
        <Kartu key={k.id} judul={`${k.aset_nama ?? '-'} × ${k.jumlah_rusak}`} buka={buka === k.id} onToggle={() => setBuka(buka === k.id ? null : k.id)}
          sub={[formatDateShort(k.tanggal_lapor), k.deskripsi_kerusakan].filter(Boolean).join(' · ')}
          badge={k.status ? { label: k.status, tone: TONE_RUSAK[k.status] ?? 'neutral' } : null}
          onUbah={() => bukaForm(k)} onHapus={() => hapus(k.aset_nama ?? 'Laporan', () => labApi.hapus(lab, 'kerusakan', k.id))}>
          <Baris label="Kerusakan" value={k.deskripsi_kerusakan} />
          <Baris label="Pelapor" value={k.pelapor_nama} />
          <Baris label="Tgl perbaikan" value={k.tanggal_perbaikan ? formatDateShort(k.tanggal_perbaikan) : null} />
          <Baris label="Biaya" value={rupiah(k.biaya_perbaikan)} />
          <Baris label="Hasil" value={k.hasil_perbaikan} />
        </Kartu>
      ))}</Daftar>
      <FormSheet judul={edit ? 'Perbarui laporan kerusakan' : 'Laporkan kerusakan'} buka={tambah} onTutup={tutup} onSimpan={simpan} sibuk={sibuk}>
        <AsetSelect lab={lab} value={f.aset} onChange={(v) => setF({ ...f, aset: v })} denganRuang />
        <View style={styles.two}>
          <DateField label="Tanggal lapor" value={f.tanggal} max={todayISO()} onChange={(v) => v && setF({ ...f, tanggal: v })} style={{ flex: 1 }} />
          <Input label="Jumlah rusak" value={f.jumlah} onChangeText={(v) => setF({ ...f, jumlah: v })} keyboardType="number-pad" containerStyle={{ flex: 1 }} />
        </View>
        <Input label="Deskripsi kerusakan *" value={f.deskripsi} onChangeText={(v) => setF({ ...f, deskripsi: v })} multiline />
        {edit ? (
          <>
            <SelectField label="Status" value={f.status} allowNone={false} options={(meta.data?.kerusakan_status ?? ['Diajukan', 'Proses Ganti', 'Selesai Diganti']).map((s) => ({ value: s, label: s }))} onChange={(v) => v && setF({ ...f, status: v })} />
            <DateField label="Tanggal perbaikan" value={f.tgl_perbaikan} allowClear onChange={(v) => setF({ ...f, tgl_perbaikan: v })} />
            <Input label="Biaya perbaikan (Rp)" value={f.biaya} onChangeText={(v) => setF({ ...f, biaya: v })} keyboardType="number-pad" />
            <Input label="Hasil perbaikan" value={f.hasil} onChangeText={(v) => setF({ ...f, hasil: v })} multiline />
          </>
        ) : null}
      </FormSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  two: { flexDirection: 'row', gap: spacing.sm },
  detail: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, gap: 4 },
});
