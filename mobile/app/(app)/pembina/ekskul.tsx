/**
 * Ekstrakurikuler Saya (pembina, guru_ekstrakurikuler) — native, pengganti /ekstrakurikuler untuk pembina.
 * Ekskul yang dibina (GET /extracurriculars, coach_id = saya), lalu tab:
 *  - Anggota: daftar (GET …/members), tambah dari kandidat siswa (GET …/kandidat-siswa, POST …/members), keluarkan.
 *  - Absensi: per tanggal, status hadir/sakit/izin/alpa per anggota (POST …/attendance) + riwayat (GET …/attendance).
 *  - Nilai: predikat A–D & deskripsi per anggota per semester (GET/POST …/grades), masuk ke E-Rapor siswa.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { request, errorMessage } from '@/api/client';
import type { Extracurricular } from '@/api/types';
import { useAuth } from '@/store/auth';
import { useNetwork } from '@/store/network';
import { useCached } from '@/hooks/useCached';
import { formatDateLong, todayISO } from '@/utils/time';
import { radius, spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DateField } from '@/components/ui/DateField';
import { SelectField } from '@/components/ui/SelectField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { SearchBox } from '@/pantau/ui';

type Anggota = { id: string; student_id: string; student_name?: string; class_name?: string | null; is_active?: boolean };
type Kandidat = { id: string; full_name: string; nisn?: string | null; class_name?: string | null };
type Absen = { id: string; date: string; records: { student_id: string; status: string }[]; summary?: Record<string, number> };
type Nilai = { student_id: string; predicate?: string | null; description?: string | null; semester: string };
type Tab = 'anggota' | 'absensi' | 'nilai';
const STATUS: { v: string; l: string }[] = [{ v: 'hadir', l: 'H' }, { v: 'sakit', l: 'S' }, { v: 'izin', l: 'I' }, { v: 'alpa', l: 'A' }];
const PREDIKAT = ['A', 'B', 'C', 'D'];
const semesterBawaan = () => (Number(todayISO().slice(5, 7)) >= 7 ? 'ganjil' : 'genap');

function Pilihan({ opsi, nilai, onPilih }: { opsi: { v: string; l: string }[]; nilai: string | null; onPilih: (v: string) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {opsi.map((o) => {
        const on = nilai === o.v;
        const warna = o.v === 'alpa' || o.v === 'D' ? colors.error : o.v === 'sakit' || o.v === 'C' ? colors.warning : colors.brandPrimary;
        return (
          <Pressable key={o.v} onPress={() => onPilih(o.v)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={o.v}
            style={[styles.chip, { borderColor: on ? warna : colors.border, backgroundColor: on ? warna : colors.surface }]}>
            <T variant="small" weight="bold" color={on ? colors.onBrandPrimary : colors.onSurface}>{o.l}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

function TabAnggota({ e, anggota, segar }: { e: Extracurricular; anggota: Anggota[]; segar: () => Promise<unknown> }) {
  const { colors } = useTheme();
  const { online } = useNetwork();
  const [q, setQ] = useState('');
  const [pilih, setPilih] = useState<Kandidat[]>([]);
  const [hasil, setHasil] = useState<Kandidat[]>([]);
  const [sibuk, setSibuk] = useState(false);
  const ada = useMemo(() => new Set(anggota.map((a) => a.student_id)), [anggota]);
  useEffect(() => {
    const kata = q.trim();
    if (kata.length < 3) { setHasil([]); return undefined; }
    const t = setTimeout(() => {
      request<Kandidat[]>(`/extracurriculars/${e.id}/kandidat-siswa`, { query: { search: kata } })
        .then((r) => setHasil(r.filter((k) => !ada.has(k.id)).slice(0, 10))).catch(() => setHasil([]));
    }, 400);
    return () => clearTimeout(t);
  }, [q, e.id, ada]);
  const tambah = async () => {
    setSibuk(true);
    try {
      await request(`/extracurriculars/${e.id}/members`, { method: 'POST', body: { student_ids: pilih.map((k) => k.id) } });
      toast.success(`${pilih.length} anggota ditambahkan`);
      setPilih([]); setQ('');
      await segar();
    } catch (er) { toast.error(errorMessage(er, 'Gagal menambah anggota.')); } finally { setSibuk(false); }
  };
  const keluarkan = (a: Anggota) => Alert.alert('Keluarkan anggota?', a.student_name ?? '', [
    { text: 'Batal', style: 'cancel' },
    { text: 'Keluarkan', style: 'destructive', onPress: async () => {
      try { await request(`/extracurriculars/${e.id}/members/${a.id}`, { method: 'DELETE' }); toast.success('Anggota dikeluarkan'); await segar(); }
      catch (er) { toast.error(errorMessage(er, 'Gagal mengeluarkan anggota.')); }
    } },
  ]);
  return (
    <View style={{ gap: spacing.md }}>
      <Card style={{ gap: spacing.sm }}>
        <T weight="semibold">Tambah anggota</T>
        <SearchBox value={q} onChange={setQ} placeholder="Cari nama siswa (min. 3 huruf)…" />
        {hasil.filter((k) => !pilih.some((p) => p.id === k.id)).map((k) => (
          <Pressable key={k.id} onPress={() => setPilih([...pilih, k])} accessibilityRole="button" style={[styles.row, styles.hasil, { borderBottomColor: colors.divider }]}>
            <View style={{ flex: 1 }}>
              <T weight="medium">{k.full_name}</T>
              <T variant="small" tone="muted">{[k.class_name ? `Kelas ${k.class_name}` : null, k.nisn ? `NISN ${k.nisn}` : null].filter(Boolean).join(' · ')}</T>
            </View>
            <T variant="label" tone="brand">Pilih</T>
          </Pressable>
        ))}
        {pilih.length ? (
          <>
            <View style={styles.wrap}>
              {pilih.map((k) => (
                <Pressable key={k.id} onPress={() => setPilih(pilih.filter((p) => p.id !== k.id))} accessibilityLabel={`Batal pilih ${k.full_name}`}
                  style={[styles.tag, { backgroundColor: colors.brandTertiary }]}>
                  <T variant="small" color={colors.onBrandTertiary}>{k.full_name} ✕</T>
                </Pressable>
              ))}
            </View>
            <Button title={`Tambahkan ${pilih.length} siswa`} icon="person-add-outline" loading={sibuk} disabled={!online} onPress={tambah} />
          </>
        ) : null}
      </Card>
      {anggota.length === 0 ? <Card><EmptyState icon="people-outline" title="Belum ada anggota" compact /></Card> : (
        <Card style={{ gap: spacing.sm }}>
          <T weight="semibold">{anggota.length} anggota</T>
          {[...anggota].sort((a, b) => (a.student_name ?? '').localeCompare(b.student_name ?? '')).map((a, i) => (
            <View key={a.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, paddingTop: spacing.sm }]}>
              <View style={{ flex: 1 }}>
                <T weight="medium">{a.student_name ?? '-'}</T>
                <T variant="small" tone="muted">{a.class_name ? `Kelas ${a.class_name}` : '-'}</T>
              </View>
              <Button title="Keluarkan" variant="ghost" size="sm" disabled={!online} onPress={() => keluarkan(a)} />
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

function TabAbsensi({ e, anggota }: { e: Extracurricular; anggota: Anggota[] }) {
  const { colors } = useTheme();
  const { online } = useNetwork();
  const qc = useQueryClient();
  const riwayat = useCached<Absen[]>(`pembina.absen.${e.id}`, () => request(`/extracurriculars/${e.id}/attendance`));
  const [tgl, setTgl] = useState(todayISO());
  const [status, setStatus] = useState<Record<string, string>>({});
  const [sibuk, setSibuk] = useState(false);
  useEffect(() => {
    const ada = (riwayat.data ?? []).find((r) => r.date === tgl);
    const m: Record<string, string> = {};
    anggota.forEach((a) => { m[a.student_id] = ada?.records.find((r) => r.student_id === a.student_id)?.status ?? 'hadir'; });
    setStatus(m);
  }, [tgl, riwayat.data, anggota]);
  const simpan = async () => {
    setSibuk(true);
    try {
      await request(`/extracurriculars/${e.id}/attendance`, { method: 'POST', body: { date: tgl, records: anggota.map((a) => ({ student_id: a.student_id, status: status[a.student_id] ?? 'hadir' })) } });
      toast.success('Absensi disimpan');
      await qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]) === `pembina.absen.${e.id}` });
    } catch (er) { toast.error(errorMessage(er, 'Gagal menyimpan absensi.')); } finally { setSibuk(false); }
  };
  const sudah = (riwayat.data ?? []).some((r) => r.date === tgl);
  return (
    <View style={{ gap: spacing.md }}>
      <DateField label="Tanggal kegiatan" value={tgl} max={todayISO()} onChange={(v) => v && setTgl(v)} />
      {anggota.length === 0 ? <Card><EmptyState icon="people-outline" title="Belum ada anggota" compact /></Card> : (
        <Card style={{ gap: spacing.sm }}>
          <T variant="caption" tone="muted">{sudah ? 'Absensi tanggal ini sudah ada — simpan untuk memperbarui.' : 'Semua anggota bawaan hadir; ubah yang tidak hadir.'}</T>
          {[...anggota].sort((a, b) => (a.student_name ?? '').localeCompare(b.student_name ?? '')).map((a, i) => (
            <View key={a.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, paddingTop: spacing.sm }]}>
              <T weight="medium" style={{ flex: 1 }} numberOfLines={1}>{a.student_name ?? '-'}</T>
              <Pilihan opsi={STATUS} nilai={status[a.student_id] ?? 'hadir'} onPilih={(v) => setStatus({ ...status, [a.student_id]: v })} />
            </View>
          ))}
          <Button title="Simpan absensi" icon="checkmark-circle-outline" loading={sibuk} disabled={!online} onPress={simpan} />
        </Card>
      )}
      {(riwayat.data ?? []).length ? (
        <Card style={{ gap: spacing.xs }}>
          <T weight="semibold">Riwayat absensi</T>
          {(riwayat.data ?? []).slice(0, 12).map((r) => (
            <Pressable key={r.id ?? r.date} onPress={() => setTgl(r.date)} style={styles.row} accessibilityRole="button">
              <T variant="caption" style={{ flex: 1 }}>{formatDateLong(r.date)}</T>
              <T variant="small" tone="muted">H {r.summary?.hadir ?? 0} · S {r.summary?.sakit ?? 0} · I {r.summary?.izin ?? 0} · A {r.summary?.alpa ?? 0}</T>
            </Pressable>
          ))}
        </Card>
      ) : null}
    </View>
  );
}

function TabNilai({ e, anggota }: { e: Extracurricular; anggota: Anggota[] }) {
  const { colors } = useTheme();
  const { online } = useNetwork();
  const qc = useQueryClient();
  const [semester, setSemester] = useState(semesterBawaan());
  const res = useCached<Nilai[]>(`pembina.nilai.${e.id}.${semester}`, () => request(`/extracurriculars/${e.id}/grades`, { query: { semester } }));
  const [isi, setIsi] = useState<Record<string, { predicate: string | null; description: string }>>({});
  const [sibuk, setSibuk] = useState(false);
  useEffect(() => {
    const m: Record<string, { predicate: string | null; description: string }> = {};
    anggota.forEach((a) => { const g = (res.data ?? []).find((x) => x.student_id === a.student_id); m[a.student_id] = { predicate: g?.predicate ?? null, description: g?.description ?? '' }; });
    setIsi(m);
  }, [res.data, anggota]);
  const simpan = async () => {
    const grades = anggota.filter((a) => isi[a.student_id]?.predicate).map((a) => ({ student_id: a.student_id, predicate: isi[a.student_id].predicate, description: isi[a.student_id].description.trim() || null }));
    if (!grades.length) { toast.error('Isi predikat minimal satu anggota'); return; }
    setSibuk(true);
    try {
      await request(`/extracurriculars/${e.id}/grades`, { method: 'POST', body: { semester, grades } });
      toast.success(`Nilai ${grades.length} anggota disimpan`);
      await qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith(`pembina.nilai.${e.id}`) });
    } catch (er) { toast.error(errorMessage(er, 'Gagal menyimpan nilai.')); } finally { setSibuk(false); }
  };
  return (
    <View style={{ gap: spacing.md }}>
      <SelectField label="Semester" value={semester} allowNone={false} options={[{ value: 'ganjil', label: 'Ganjil' }, { value: 'genap', label: 'Genap' }]} onChange={(v) => v && setSemester(v)} />
      {res.loading ? <CardSkeleton lines={4} /> : anggota.length === 0 ? <Card><EmptyState icon="people-outline" title="Belum ada anggota" compact /></Card> : (
        <Card style={{ gap: spacing.md }}>
          <T variant="caption" tone="muted">Predikat & deskripsi tampil di E-Rapor siswa (tahun pelajaran aktif).</T>
          {[...anggota].sort((a, b) => (a.student_name ?? '').localeCompare(b.student_name ?? '')).map((a, i) => (
            <View key={a.id} style={[{ gap: spacing.xs }, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, paddingTop: spacing.sm }]}>
              <View style={styles.row}>
                <T weight="medium" style={{ flex: 1 }} numberOfLines={1}>{a.student_name ?? '-'}</T>
                <Pilihan opsi={PREDIKAT.map((p) => ({ v: p, l: p }))} nilai={isi[a.student_id]?.predicate ?? null}
                  onPilih={(v) => setIsi({ ...isi, [a.student_id]: { ...(isi[a.student_id] ?? { description: '' }), predicate: v } })} />
              </View>
              <Input value={isi[a.student_id]?.description ?? ''} placeholder="Deskripsi capaian (opsional)"
                onChangeText={(v) => setIsi({ ...isi, [a.student_id]: { ...(isi[a.student_id] ?? { predicate: null }), description: v } })} />
            </View>
          ))}
          <Button title="Simpan nilai" icon="checkmark-circle-outline" loading={sibuk} disabled={!online} onPress={simpan} />
        </Card>
      )}
    </View>
  );
}

export default function EkskulPembina() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const daftar = useCached<Extracurricular[]>('ekskul.list', api.ekskul.list);
  const milik = (daftar.data ?? []).filter((e) => e.coach_id === user?.id);
  const [pilihId, setPilihId] = useState<string | null>(null);
  const e = milik.find((x) => x.id === pilihId) ?? milik[0];
  const [tab, setTab] = useState<Tab>('anggota');
  const anggota = useCached<Anggota[]>(`pembina.anggota.${e?.id}`, () => request(`/extracurriculars/${e!.id}/members`), { enabled: !!e });
  const aktif = (anggota.data ?? []).filter((a) => a.is_active !== false);
  const segar = () => qc.invalidateQueries({ predicate: (q) => /^(pembina\.|ekskul\.)/.test(String(q.queryKey[0])) });

  return (
    <Screen title={e?.name ?? 'Ekstrakurikuler Saya'} subtitle={e ? `${aktif.length} anggota${e.schedule_day ? ` · ${e.schedule_day}` : ''}` : 'Pembina ekstrakurikuler'} back
      refreshing={daftar.refreshing || anggota.refreshing} onRefresh={() => void segar()} offline={{ fromCache: daftar.fromCache, updatedAt: daftar.updatedAt }}>
      <View style={{ gap: spacing.md }}>
        {daftar.loading ? <CardSkeleton lines={5} /> : !daftar.data ? (
          <ErrorState message={errorMessage(daftar.error, 'Data ekskul belum bisa dimuat.')} onRetry={daftar.refresh} compact />
        ) : !e ? (
          <Card><EmptyState icon="trophy-outline" title="Belum ada ekskul yang Anda bina" message="Hubungi admin untuk ditetapkan sebagai pembina ekstrakurikuler." compact /></Card>
        ) : (
          <>
            {milik.length > 1 ? (
              <SelectField label="Ekstrakurikuler" value={e.id} allowNone={false} icon="trophy-outline" options={milik.map((m) => ({ value: m.id, label: m.name }))} onChange={(v) => v && setPilihId(v)} />
            ) : null}
            <SegmentedControl<Tab> value={tab} onChange={setTab} segments={[{ value: 'anggota', label: 'Anggota' }, { value: 'absensi', label: 'Absensi' }, { value: 'nilai', label: 'Nilai' }]} />
            {anggota.loading ? <CardSkeleton lines={4} /> : tab === 'anggota' ? <TabAnggota e={e} anggota={aktif} segar={segar} />
              : tab === 'absensi' ? <TabAbsensi e={e} anggota={aktif} /> : <TabNilai e={e} anggota={aktif} />}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chip: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  hasil: { paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tag: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.md },
});
