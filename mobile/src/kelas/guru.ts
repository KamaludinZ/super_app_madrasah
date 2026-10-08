/**
 * Bantuan layar Materi & Tugas guru: jenis konten, kunci cache, kelas & mapel dari jadwal mengajar sendiri,
 * dan ringkasan sasaran (kelas penuh / siswa tertentu) dalam teks.
 */
import type { GuruKonten, ScheduleItem } from '@/api/types';

export type Jenis = 'materi' | 'tugas';
export const JENIS_LABEL: Record<Jenis, string> = { materi: 'Materi', tugas: 'Tugas' };
export const kontenKey = (jenis: Jenis) => `guru.${jenis}`;
export const asJenis = (v?: string | string[]): Jenis => (v === 'tugas' ? 'tugas' : 'materi');

/** Kelas & mapel unik dari jadwal mengajar guru (sasaran yang masuk akal). */
export function ajaran(jadwal: ScheduleItem[] | undefined) {
  const kelas = new Map<string, string>();
  const mapel = new Map<string, string>();
  (jadwal ?? []).forEach((s) => {
    if (s.class_id) kelas.set(s.class_id, s.class_name ?? '-');
    if (s.subject_id) mapel.set(s.subject_id, s.subject_name ?? '-');
  });
  const sort = (m: Map<string, string>) => [...m.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  return { kelas: sort(kelas), mapel: sort(mapel), namaKelas: kelas };
}

export function ringkasSasaran(k: GuruKonten, namaKelas: Map<string, string>) {
  const nm = (id: string) => namaKelas.get(id) ?? 'kelas lain';
  const parts: string[] = [];
  if ((k.target_kelas_ids ?? []).length) parts.push(`Kelas ${(k.target_kelas_ids ?? []).map(nm).join(', ')}`);
  (k.target_siswa ?? []).forEach((t) => {
    parts.push(t.student_ids === 'all' ? `Semua siswa ${nm(t.class_id)}` : `${t.student_ids.length} siswa ${nm(t.class_id)}`);
  });
  return parts.join(' · ') || 'Belum ada sasaran';
}
