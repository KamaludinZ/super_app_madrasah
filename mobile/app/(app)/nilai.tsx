/**
 * Input Nilai E-Rapor (guru) — native, pengganti /nilai/input. Kelas & mapel dari jadwal mengajar sendiri
 * (GET /schedules/grouped?teacher_id), semester (bawaan menurut bulan), nilai pengetahuan & keterampilan
 * 0–100 per siswa dengan nilai akhir & predikat otomatis (rumus sama dengan server), deskripsi opsional;
 * nilai tersimpan dimuat (GET /grades), simpan sekaligus (POST /grades/bulk). Baris kosong dilewati.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { DeviceEventEmitter, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { INPUT_FOCUS_EVENT } from '@/hooks/useKeyboardAwareScroll';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { GradeEntry, ScheduleItem, Student } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useAuth } from '@/store/auth';
import { useNetwork } from '@/store/network';
import { fonts, fontSize, radius, spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SelectField } from '@/components/ui/SelectField';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';

type Sem = 'ganjil' | 'genap';
type Row = { p: string; k: string; d: string };

const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
const valid = (v: string) => { const n = num(v); return n === null || (!Number.isNaN(n) && n >= 0 && n <= 100); };
/** Sama dengan server: akhir = rata-rata P & K (atau P saja); A ≥ 88, B ≥ 76, C ≥ 60, D. */
function akhir(r: Row) {
  const p = num(r.p); const k = num(r.k);
  const a = p !== null && k !== null ? (p + k) / 2 : p;
  if (a === null || Number.isNaN(a)) return null;
  return { a, pred: a >= 88 ? 'A' : a >= 76 ? 'B' : a >= 60 ? 'C' : 'D' };
}
const PRED_TONE: Record<string, BadgeTone> = { A: 'success', B: 'brand', C: 'warning', D: 'error' };

export default function InputNilai() {
  const { colors } = useTheme();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { online } = useNetwork();
  const jadwal = useCached<ScheduleItem[]>(`jadwal.t.${user?.id}`, () => api.schedules.grouped({ teacher_id: user?.id }), { enabled: !!user?.id, staleTime: 10 * 60_000 });
  const [classId, setClassId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [sem, setSem] = useState<Sem>(new Date().getMonth() >= 6 ? 'ganjil' : 'genap');
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [openDesc, setOpenDesc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Kombinasi kelas–mapel yang diampu (dari jadwal).
  const combos = useMemo(() => {
    const m = new Map<string, { class_id: string; class_name: string; subject_id: string; subject_name: string }>();
    (jadwal.data ?? []).forEach((s) => {
      if (!s.subject_id) return;
      m.set(`${s.class_id}|${s.subject_id}`, { class_id: s.class_id, class_name: s.class_name ?? '-', subject_id: s.subject_id, subject_name: s.subject_name ?? '-' });
    });
    return [...m.values()];
  }, [jadwal.data]);
  const kelasOpts = useMemo(() => [...new Map(combos.map((c) => [c.class_id, c.class_name])).entries()]
    .map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)), [combos]);
  const mapelOpts = useMemo(() => combos.filter((c) => c.class_id === classId).map((c) => ({ value: c.subject_id, label: c.subject_name })), [combos, classId]);

  useEffect(() => { if (!classId && kelasOpts.length === 1) setClassId(kelasOpts[0].value); }, [kelasOpts]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (mapelOpts.length === 1) setSubjectId(mapelOpts[0].value); }, [classId]); // eslint-disable-line react-hooks/exhaustive-deps

  const ready = !!classId && !!subjectId;
  const students = useCached<Student[]>(`students.class.${classId}`, () => api.students.byClass(classId!), { enabled: !!classId, staleTime: 30 * 60_000 });
  const grades = useCached<GradeEntry[]>(`nilai.${classId}.${subjectId}.${sem}`, () => api.nilai.list({ class_id: classId!, subject_id: subjectId!, semester: sem }), { enabled: ready });

  useEffect(() => {
    const m: Record<string, Row> = {};
    (grades.data ?? []).forEach((g) => {
      m[g.student_id] = { p: g.nilai_pengetahuan == null ? '' : String(g.nilai_pengetahuan), k: g.nilai_keterampilan == null ? '' : String(g.nilai_keterampilan), d: g.description ?? '' };
    });
    setRows(m);
  }, [grades.data, classId, subjectId, sem]);

  const setVal = (sid: string, key: keyof Row, v: string) =>
    setRows((r) => ({ ...r, [sid]: { ...(r[sid] ?? { p: '', k: '', d: '' }), [key]: key === 'd' ? v : v.replace(/[^\d.,]/g, '').slice(0, 5) } }));

  const list = students.data ?? [];
  const terisi = list.filter((s) => { const r = rows[s.id]; return r && (r.p || r.k); }).length;
  const invalid = list.filter((s) => { const r = rows[s.id]; return r && (!valid(r.p) || !valid(r.k)); });

  const save = async () => {
    if (!ready) { toast.error('Pilih kelas dan mata pelajaran'); return; }
    if (invalid.length) { toast.error('Nilai harus 0–100', `Periksa: ${invalid.slice(0, 3).map((s) => s.full_name).join(', ')}`); return; }
    const entries = list.map((s) => ({ s, r: rows[s.id] }))
      .filter(({ r }) => r && (r.p.trim() || r.k.trim() || r.d.trim()))
      .map(({ s, r }) => ({ student_id: s.id, nilai_pengetahuan: num(r.p), nilai_keterampilan: num(r.k), description: r.d.trim() }));
    if (!entries.length) { toast.error('Belum ada nilai yang diisi'); return; }
    setBusy(true);
    try {
      const res = await api.nilai.saveBulk({ class_id: classId!, subject_id: subjectId!, semester: sem, entries });
      toast.success(`Nilai ${res.success} siswa tersimpan`);
      await qc.invalidateQueries({ queryKey: [`nilai.${classId}.${subjectId}.${sem}`] });
    } catch (e) {
      toast.error(errorMessage(e, 'Gagal menyimpan nilai.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Input Nilai" subtitle="E-Rapor · kelas & mapel yang Anda ampu" back
      refreshing={jadwal.refreshing || grades.refreshing} onRefresh={() => { void jadwal.refresh(); void grades.refresh(); }}
      footer={ready && list.length ? <Button title={`Simpan nilai (${terisi}/${list.length})`} icon="save-outline" size="lg" fullWidth loading={busy} disabled={!online} onPress={save} /> : undefined}>
      <View style={{ gap: spacing.md }}>
        <Card style={{ gap: spacing.md }}>
          <SelectField label="Kelas" value={classId} allowNone={false} icon="school-outline"
            placeholder={jadwal.loading ? 'Memuat jadwal…' : kelasOpts.length ? 'Pilih kelas' : 'Belum ada jadwal mengajar'}
            options={kelasOpts} onChange={(v) => { setClassId(v); setSubjectId(null); }} />
          <SelectField label="Mata pelajaran" value={subjectId} allowNone={false} icon="book-outline"
            placeholder={classId ? 'Pilih mapel' : 'Pilih kelas dulu'} options={mapelOpts} onChange={setSubjectId} />
          <SegmentedControl<Sem> small value={sem} onChange={setSem} segments={[{ value: 'ganjil', label: 'Semester Ganjil' }, { value: 'genap', label: 'Semester Genap' }]} />
        </Card>

        {!jadwal.loading && combos.length === 0 ? (
          <Notice tone="warning" icon="alert-circle-outline" text="Anda belum memiliki jadwal mengajar di tahun pelajaran aktif. Hubungi admin untuk pendataan jadwal." />
        ) : !ready ? (
          <Card><EmptyState icon="create-outline" title="Pilih kelas & mapel" message="Nilai dapat diisi untuk kelas dan mapel yang Anda ampu." compact /></Card>
        ) : students.loading || grades.loading ? <CardSkeleton lines={6} /> : (
          <>
            <View style={styles.head}>
              <T variant="small" tone="muted" style={{ flex: 1 }}>SISWA</T>
              <T variant="small" tone="muted" style={styles.colH}>PENG.</T>
              <T variant="small" tone="muted" style={styles.colH}>KETR.</T>
              <T variant="small" tone="muted" style={styles.colA}>AKHIR</T>
            </View>
            {list.map((s, i) => {
              const r = rows[s.id] ?? { p: '', k: '', d: '' };
              const ak = akhir(r);
              const bad = (v: string) => !valid(v);
              return (
                <Card key={s.id} style={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
                  <View style={styles.row}>
                    <Pressable style={{ flex: 1 }} onPress={() => setOpenDesc(openDesc === s.id ? null : s.id)} accessibilityRole="button" accessibilityHint="Tampilkan deskripsi">
                      <T weight="medium" numberOfLines={2}>{i + 1}. {s.full_name}</T>
                      <T variant="small" tone="muted">{r.d ? 'Ada deskripsi' : 'Ketuk untuk deskripsi'}</T>
                    </Pressable>
                    {(['p', 'k'] as const).map((key) => (
                      <TextInput key={key} value={r[key]} onChangeText={(v) => setVal(s.id, key, v)} keyboardType="decimal-pad" maxLength={5} onFocus={() => DeviceEventEmitter.emit(INPUT_FOCUS_EVENT)}
                        placeholder="–" placeholderTextColor={colors.muted} accessibilityLabel={`${key === 'p' ? 'Pengetahuan' : 'Keterampilan'} ${s.full_name}`}
                        style={[styles.cell, { borderColor: bad(r[key]) ? colors.error : colors.borderStrong, color: colors.onSurface, backgroundColor: colors.surface }]} />
                    ))}
                    <View style={styles.colA}>
                      {ak ? <Badge label={`${Number.isInteger(ak.a) ? ak.a : ak.a.toFixed(1)} ${ak.pred}`} tone={PRED_TONE[ak.pred]} small /> : <T tone="muted">–</T>}
                    </View>
                  </View>
                  {openDesc === s.id ? (
                    <Input value={r.d} onChangeText={(v) => setVal(s.id, 'd', v)} multiline placeholder="Deskripsi capaian (opsional)" />
                  ) : null}
                </Card>
              );
            })}
            {!online ? <Notice tone="warning" icon="cloud-offline-outline" text="Tidak ada koneksi. Menyimpan nilai memerlukan internet." /> : null}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  colH: { width: 58, textAlign: 'center' },
  colA: { width: 64, alignItems: 'center' },
  cell: { width: 58, height: 44, borderWidth: 1.5, borderRadius: radius.md, textAlign: 'center', fontFamily: fonts.medium, fontSize: fontSize.lg },
});
