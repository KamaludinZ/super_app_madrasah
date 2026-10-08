/**
 * Buat / ubah materi atau tugas (POST/PUT /kelas/{jenis}): judul, deskripsi, isi (teks → HTML sederhana; isi
 * berformat dari web dipertahankan selama tidak diubah), tautan lampiran, tenggat (tugas), mapel dari jadwal
 * sendiri, dan sasaran: seluruh kelas dan/atau siswa tertentu per kelas (target_role kelas/siswa seperti web).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { GuruKonten, ScheduleItem, TargetSiswa } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useAuth } from '@/store/auth';
import { useNetwork } from '@/store/network';
import { htmlToText, textToHtml } from '@/utils/html';
import { parseISO, todayISO, wibParts } from '@/utils/time';
import { JENIS_LABEL, ajaran, asJenis, kontenKey } from '@/kelas/guru';
import { radius, spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { SelectField } from '@/components/ui/SelectField';
import { TimeField, isValidTime } from '@/components/ui/TimeField';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';

const pad = (n: number) => String(n).padStart(2, '0');
/** Konten dari editor web yang memakai format selain paragraf/baris baru (tebal, daftar, tabel, gambar). */
const berformat = (html?: string | null) => /<(?!\/?(p|br)\b)[a-z]/i.test(html ?? '');

export default function KontenForm() {
  const params = useLocalSearchParams<{ jenis?: string; id?: string }>();
  const jenis = asJenis(params.jenis);
  const id = params.id;
  const router = useRouter();
  const qc = useQueryClient();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { online } = useNetwork();
  const list = useCached<GuruKonten[]>(kontenKey(jenis), () => api.kelas.guruList(jenis), { enabled: !!id });
  const editing = id ? (list.data ?? []).find((k) => k.id === id) : undefined;
  const jadwal = useCached<ScheduleItem[]>(`jadwal.t.${user?.id}`, () => api.schedules.grouped({ teacher_id: user?.id }), { enabled: !!user?.id, staleTime: 10 * 60_000 });
  const { kelas, mapel } = useMemo(() => ajaran(jadwal.data), [jadwal.data]);

  const [judul, setJudul] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [isi, setIsi] = useState('');
  const [isiAsli, setIsiAsli] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState('');
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [tglTenggat, setTglTenggat] = useState<string | null>(null);
  const [jamTenggat, setJamTenggat] = useState('23:59');
  const [kelasIds, setKelasIds] = useState<string[]>([]);
  const [siswa, setSiswa] = useState<TargetSiswa[]>([]);
  const [kelasSiswa, setKelasSiswa] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (!subjectId && mapel.length === 1) setSubjectId(mapel[0].value); }, [mapel]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!editing) return;
    setJudul(editing.judul); setDeskripsi(editing.deskripsi ?? ''); setFileUrl(editing.file_url ?? '');
    setSubjectId(editing.subject_id ?? null);
    setIsi(htmlToText(editing.konten).text);
    setIsiAsli(berformat(editing.konten) ? editing.konten ?? null : null);
    if (editing.deadline) {
      const p = wibParts(editing.deadline);
      setTglTenggat(`${p.year}-${pad(p.month + 1)}-${pad(p.day)}`); setJamTenggat(`${pad(p.hour)}:${pad(p.minute)}`);
    }
    setKelasIds(editing.target_kelas_ids ?? []);
    setSiswa((editing.target_siswa ?? []).map((t) => ({ ...t })));
  }, [editing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const students = useCached<{ id: string; full_name: string }[]>(`classStudents.${kelasSiswa}`, () => api.kelas.classStudents(kelasSiswa!), { enabled: !!kelasSiswa, staleTime: 30 * 60_000 });
  const pilihan = siswa.find((t) => t.class_id === kelasSiswa);
  const semua = pilihan?.student_ids === 'all';
  const dipilih = (sid: string) => semua || (Array.isArray(pilihan?.student_ids) && pilihan!.student_ids.includes(sid));

  const setPilihan = (ids: string[] | 'all') => setSiswa((prev) => {
    const rest = prev.filter((t) => t.class_id !== kelasSiswa);
    return ids === 'all' || ids.length ? [...rest, { class_id: kelasSiswa!, student_ids: ids }] : rest;
  });
  const toggleSiswa = (sid: string) => {
    const all = (students.data ?? []).map((s) => s.id);
    const cur = semua ? all : Array.isArray(pilihan?.student_ids) ? pilihan!.student_ids : [];
    setPilihan(cur.includes(sid) ? cur.filter((x) => x !== sid) : [...cur, sid]);
  };

  const submit = async () => {
    const fail = (m: string) => { setError(m); toast.error(m); };
    if (!judul.trim()) return fail('Judul wajib diisi.');
    if (!subjectId) return fail('Pilih mata pelajaran.');
    if (!isi.trim() && !isiAsli) return fail(`Isi ${jenis} wajib diisi.`);
    if (!kelasIds.length && !siswa.length) return fail('Pilih sasaran: kelas dan/atau siswa tertentu.');
    const url = fileUrl.trim();
    if (url && !/^https?:\/\//i.test(url)) return fail('Tautan lampiran harus diawali http:// atau https://');
    let deadline: string | null = null;
    if (jenis === 'tugas' && tglTenggat) {
      if (!isValidTime(jamTenggat)) return fail('Jam tenggat ditulis JJ:MM.');
      deadline = parseISO(`${tglTenggat}T${jamTenggat}:00`).toISOString();
    }
    setError(null);
    setBusy(true);
    try {
      const body = {
        judul: judul.trim(), deskripsi: deskripsi.trim() || null, file_url: url || null, subject_id: subjectId,
        konten: isiAsli ?? textToHtml(isi), ...(jenis === 'tugas' ? { deadline } : {}),
        target_role: [...(kelasIds.length ? ['kelas'] : []), ...(siswa.length ? ['siswa'] : [])],
        target_kelas_ids: kelasIds, target_siswa: siswa,
      };
      if (id) await api.kelas.guruUpdate(jenis, id, body); else await api.kelas.guruCreate(jenis, body);
      toast.success(id ? `${JENIS_LABEL[jenis]} diperbarui` : `${JENIS_LABEL[jenis]} dibagikan`, id ? undefined : 'Siswa sasaran menerima notifikasi.');
      await qc.invalidateQueries({ queryKey: [kontenKey(jenis)] });
      router.back();
    } catch (e) {
      fail(errorMessage(e, `Gagal menyimpan ${jenis}.`));
    } finally {
      setBusy(false);
    }
  };

  if (!jadwal.loading && !kelas.length) {
    return <Screen title={`Buat ${JENIS_LABEL[jenis]}`} back><Notice tone="warning" icon="alert-circle-outline" text="Anda belum memiliki jadwal mengajar di semester aktif, sehingga belum ada kelas sasaran." /></Screen>;
  }

  return (
    <Screen title={id ? `Ubah ${JENIS_LABEL[jenis]}` : `Buat ${JENIS_LABEL[jenis]}`} back
      footer={<Button title={id ? 'Simpan perubahan' : 'Bagikan'} icon="paper-plane-outline" size="lg" fullWidth loading={busy} disabled={!online} onPress={submit} />}>
      <View style={{ gap: spacing.md }}>
        <Card style={{ gap: spacing.md }}>
          <SelectField label="Mata pelajaran *" value={subjectId} options={mapel} allowNone={false} icon="book-outline" onChange={setSubjectId} />
          <Input label="Judul *" value={judul} onChangeText={setJudul} placeholder={jenis === 'tugas' ? 'mis. Latihan soal Bab 3' : 'mis. Sistem pencernaan manusia'} />
          <Input label="Deskripsi singkat" value={deskripsi} onChangeText={setDeskripsi} placeholder="Opsional" />
          {isiAsli ? (
            <Notice tone="warning" icon="information-circle-outline" text="Isi ini berformat dari web (tebal, daftar, tabel, dll.). Formatnya dipertahankan selama isi tidak diubah di sini." />
          ) : null}
          <Input label={`Isi ${jenis} *`} value={isi} onChangeText={(v) => { setIsi(v); setIsiAsli(null); }} multiline
            placeholder={jenis === 'tugas' ? 'Petunjuk pengerjaan untuk siswa' : 'Ringkasan materi untuk siswa'} />
          <Input label="Tautan lampiran" icon="link-outline" value={fileUrl} onChangeText={setFileUrl} autoCapitalize="none" autoCorrect={false}
            keyboardType="url" placeholder="https://drive.google.com/…" hint="Opsional: modul, video, atau berkas di Google Drive (akses “siapa saja yang memiliki link”)." />
        </Card>

        {jenis === 'tugas' ? (
          <Card style={{ gap: spacing.md }}>
            <T variant="label" tone="muted">TENGGAT</T>
            <View style={styles.two}>
              <DateField label="Tanggal" value={tglTenggat} min={id ? undefined : todayISO()} allowClear placeholder="Tanpa tenggat" onChange={setTglTenggat} style={{ flex: 3 }} />
              <TimeField label="Jam" value={jamTenggat} onChange={setJamTenggat} placeholder="23:59" style={{ flex: 2 }} />
            </View>
          </Card>
        ) : null}

        <Card style={{ gap: spacing.md }}>
          <T variant="label" tone="muted">SASARAN · SELURUH KELAS</T>
          <View style={styles.chips}>
            {kelas.map((k) => {
              const on = kelasIds.includes(k.value);
              return (
                <Pressable key={k.value} onPress={() => setKelasIds((p) => (on ? p.filter((x) => x !== k.value) : [...p, k.value]))}
                  accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                  style={[styles.chip, { borderColor: on ? colors.brandPrimary : colors.border, backgroundColor: on ? colors.brandTertiary : colors.surface }]}>
                  <Icon name={on ? 'checkbox' : 'square-outline'} size={16} color={on ? colors.brandPrimary : colors.muted} />
                  <T variant="caption" weight={on ? 'semibold' : 'regular'}>{k.label}</T>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <T variant="label" tone="muted">SASARAN · SISWA TERTENTU</T>
          {siswa.length ? (
            <T variant="caption" tone="secondary">
              {siswa.map((t) => `${kelas.find((k) => k.value === t.class_id)?.label ?? 'Kelas'}: ${t.student_ids === 'all' ? 'semua' : `${t.student_ids.length} siswa`}`).join(' · ')}
            </T>
          ) : <T variant="caption" tone="muted">Opsional — mis. untuk remedial atau pengayaan.</T>}
          <SelectField label="Kelas" value={kelasSiswa} options={kelas} icon="people-outline" noneLabel="Tutup" onChange={setKelasSiswa} placeholder="Pilih kelas untuk memilih siswa" />
          {kelasSiswa ? (students.loading ? <CardSkeleton lines={3} /> : (
            <>
              <View style={styles.row}>
                <Button title={semua ? 'Batalkan semua' : 'Pilih semua siswa'} variant="ghost" size="sm" onPress={() => setPilihan(semua ? [] : 'all')} />
              </View>
              {(students.data ?? []).map((s) => {
                const on = dipilih(s.id);
                return (
                  <Pressable key={s.id} onPress={() => toggleSiswa(s.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                    style={[styles.student, { borderColor: on ? colors.brandPrimary : colors.border, backgroundColor: on ? colors.brandTertiary : colors.surface }]}>
                    <Icon name={on ? 'checkbox' : 'square-outline'} size={20} color={on ? colors.brandPrimary : colors.muted} />
                    <T style={{ flex: 1 }} numberOfLines={1}>{s.full_name}</T>
                  </Pressable>
                );
              })}
            </>
          )) : null}
        </Card>

        {!online ? <Notice tone="warning" icon="cloud-offline-outline" text="Tidak ada koneksi. Membagikan memerlukan internet." /> : null}
        {error ? <Notice tone="error" icon="alert-circle-outline" text={error} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  two: { flexDirection: 'row', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 8 },
  student: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1 },
});
