/**
 * Buat laporan (POST /reports): jenis (sarana prasarana / siswa bermasalah / catatan umum), judul, uraian,
 * prioritas; kelas & siswa (wajib untuk siswa bermasalah), lokasi (sarana prasarana).
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { ClassItem, Student } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useAuth } from '@/store/auth';
import { useNetwork } from '@/store/network';
import { JENIS, PRIORITAS } from '@/laporan/options';
import { spacing } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SelectField } from '@/components/ui/SelectField';
import { toast } from '@/components/ui/Toast';

export default function BuatLaporan() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { online } = useNetwork();
  const [jenis, setJenis] = useState('catatan');
  const [judul, setJudul] = useState('');
  const [uraian, setUraian] = useState('');
  const [prioritas, setPrioritas] = useState('sedang');
  const [classId, setClassId] = useState<string | null>(user?.homeroom_class_id ?? null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [lokasi, setLokasi] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const classes = useCached<ClassItem[]>('kebersihan.classes.all', async () => {
    const ay = await api.kebersihan.activeYear().catch(() => null);
    return api.kebersihan.classes(ay?.id);
  }, { staleTime: 30 * 60_000 });
  const students = useCached<Student[]>(`students.class.${classId}`, () => api.students.byClass(classId!), { enabled: !!classId && jenis !== 'sarana_prasarana', staleTime: 30 * 60_000 });

  const submit = async () => {
    const fail = (m: string) => { setError(m); toast.error(m); };
    if (!judul.trim() || !uraian.trim()) return fail('Judul dan uraian wajib diisi.');
    if (jenis === 'siswa' && !studentId) return fail('Pilih siswa yang dilaporkan.');
    setError(null);
    setBusy(true);
    try {
      await api.laporan.create({
        type: jenis, title: judul.trim(), description: uraian.trim(), priority: prioritas,
        class_id: jenis === 'sarana_prasarana' ? null : classId, student_id: jenis === 'siswa' ? studentId : null,
        location: jenis === 'sarana_prasarana' ? lokasi.trim() || null : null,
      });
      toast.success('Laporan terkirim', 'Admin/Guru BK akan menindaklanjuti.');
      await qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('laporan.list') });
      router.back();
    } catch (e) {
      fail(errorMessage(e, 'Gagal mengirim laporan.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Buat Laporan" back
      footer={<Button title="Kirim laporan" icon="paper-plane-outline" size="lg" fullWidth loading={busy} disabled={!online} onPress={submit} />}>
      <View style={{ gap: spacing.md }}>
        <Card style={{ gap: spacing.md }}>
          <SelectField label="Jenis laporan" value={jenis} options={JENIS} allowNone={false} icon="folder-outline" onChange={(v) => v && setJenis(v)} />
          <Input label="Judul *" value={judul} onChangeText={setJudul} placeholder={jenis === 'sarana_prasarana' ? 'mis. Proyektor kelas 8B rusak' : 'Ringkasan singkat'} />
          <Input label="Uraian *" value={uraian} onChangeText={setUraian} multiline placeholder="Jelaskan kejadian/kondisi secara lengkap" />
          <View style={{ gap: 6 }}>
            <T variant="label" tone="secondary">Prioritas</T>
            <SegmentedControl small value={prioritas} onChange={setPrioritas} segments={PRIORITAS.map(({ value, label }) => ({ value, label }))} />
          </View>
        </Card>
        <Card style={{ gap: spacing.md }}>
          {jenis === 'sarana_prasarana' ? (
            <Input label="Lokasi" icon="location-outline" value={lokasi} onChangeText={setLokasi} placeholder="mis. Ruang 8B, Lab IPA" />
          ) : (
            <>
              <SelectField label={jenis === 'siswa' ? 'Kelas *' : 'Kelas (opsional)'} value={classId} icon="school-outline" allowNone={jenis !== 'siswa'}
                options={[...(classes.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ value: c.id, label: c.name }))}
                onChange={(v) => { setClassId(v); setStudentId(null); }} />
              {jenis === 'siswa' ? (
                <SelectField label="Siswa *" value={studentId} icon="person-outline" allowNone={false}
                  placeholder={!classId ? 'Pilih kelas dulu' : students.loading ? 'Memuat siswa…' : 'Pilih siswa'}
                  options={(students.data ?? []).map((s) => ({ value: s.id, label: s.full_name, description: s.nisn ? `NISN ${s.nisn}` : null }))}
                  onChange={setStudentId} />
              ) : null}
            </>
          )}
        </Card>
        {!online ? <Notice tone="warning" icon="cloud-offline-outline" text="Tidak ada koneksi. Mengirim laporan memerlukan internet." /> : null}
        {error ? <Notice tone="error" icon="alert-circle-outline" text={error} /> : null}
      </View>
    </Screen>
  );
}
