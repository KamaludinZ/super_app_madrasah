/**
 * Prestasi: pilihan isian (sama dengan web AchievementsPage), tab pemegang per peran, dan pemuat data
 * gabungan — prestasi terverifikasi (GET /achievements) + pengajuan yang masih menunggu/ditolak di verval
 * (GET /verval-requests?request_type=prestasi_create), agar ajuan tidak "hilang" sebelum disetujui.
 */
import { api } from '@/api/endpoints';
import type { Achievement } from '@/api/types';
import type { BadgeTone } from '@/components/ui/Badge';
import type { IconName } from '@/components/ui/Icon';

type Opt = { value: string; label: string };
const label = (list: Opt[], v?: string | null) => list.find((x) => x.value === v)?.label ?? v ?? '-';

export const CATEGORIES: (Opt & { tone: BadgeTone })[] = [
  { value: 'akademik', label: 'Akademik', tone: 'brand' },
  { value: 'non_akademik', label: 'Non-Akademik', tone: 'neutral' },
  { value: 'olahraga', label: 'Olahraga', tone: 'success' },
  { value: 'seni', label: 'Seni & Budaya', tone: 'error' },
  { value: 'keagamaan', label: 'Keagamaan', tone: 'warning' },
  { value: 'lainnya', label: 'Lainnya', tone: 'neutral' },
];
export const LEVELS: Opt[] = [
  { value: 'sekolah', label: 'Sekolah/Madrasah' },
  { value: 'kecamatan', label: 'Kecamatan' },
  { value: 'kab_kota', label: 'Kab/Kota' },
  { value: 'provinsi', label: 'Provinsi' },
  { value: 'nasional', label: 'Nasional' },
  { value: 'internasional', label: 'Internasional' },
];
export const RANKS = [
  'Juara 1', 'Juara 2', 'Juara 3', 'Juara Harapan 1', 'Juara Harapan 2', 'Juara Harapan 3',
  'Finalis', 'Peserta Terbaik', 'Medali Emas', 'Medali Perak', 'Medali Perunggu',
];
export const JENIS_LOMBA: Opt[] = [{ value: 'individu', label: 'Individu' }, { value: 'tim', label: 'Tim/Kelompok' }];
export const JENIS_PENYELENGGARA: Opt[] = [
  { value: 'kementerian_lembaga', label: 'Kementerian/Lembaga' },
  { value: 'perguruan_tinggi', label: 'Perguruan Tinggi' },
  { value: 'lembaga_pendidikan', label: 'Lembaga Pendidikan' },
  { value: 'swasta', label: 'Swasta' },
];
export const MODE_PELAKSANAAN: Opt[] = [{ value: 'offline', label: 'Offline' }, { value: 'online', label: 'Online' }];
export const CARA_MENGIKUTI: Opt[] = [
  { value: 'mandiri', label: 'Mandiri' },
  { value: 'delegasi_madrasah', label: 'Delegasi Madrasah' },
  { value: 'club', label: 'Melalui Club' },
];
export const JENIS_HADIAH: Opt[] = [
  { value: 'tropi', label: 'Tropi' },
  { value: 'medali', label: 'Medali' },
  { value: 'sertifikat', label: 'Sertifikat' },
  { value: 'uang_pembinaan', label: 'Uang Pembinaan' },
  { value: 'lainnya', label: 'Lainnya' },
];

export const categoryLabel = (v?: string | null) => label(CATEGORIES, v);
export const categoryTone = (v?: string | null): BadgeTone => CATEGORIES.find((c) => c.value === v)?.tone ?? 'neutral';
export const levelLabel = (v?: string | null) => label(LEVELS, v);
export const jenisLombaLabel = (v?: string | null) => label(JENIS_LOMBA, v);
export const penyelenggaraLabel = (v?: string | null) => label(JENIS_PENYELENGGARA, v);
export const modeLabel = (v?: string | null) => label(MODE_PELAKSANAAN, v);
export const caraLabel = (v?: string | null) => label(CARA_MENGIKUTI, v);
export const hadiahLabel = (v?: string | null) => label(JENIS_HADIAH, v);

export type Holder = 'siswa' | 'guru' | 'tendik' | 'madrasah';
export const HOLDERS: { value: Holder; label: string; icon: IconName }[] = [
  { value: 'siswa', label: 'Siswa', icon: 'school-outline' },
  { value: 'guru', label: 'Guru', icon: 'people-outline' },
  { value: 'tendik', label: 'Tendik', icon: 'briefcase-outline' },
  { value: 'madrasah', label: 'Madrasah', icon: 'business-outline' },
];

export const GURU_ROLES = ['guru', 'wali_kelas', 'guru_piket', 'guru_bk', 'guru_tata_tertib', 'guru_ekstrakurikuler'];

/** Tab pemegang yang tampil & tab tempat peran boleh mengajukan prestasi (mengikuti web). */
export function holderAccess(role: string | null | undefined) {
  if (role === 'siswa') return { tabs: ['siswa'] as Holder[], canAdd: 'siswa' as Holder, reviewer: false };
  if (role === 'wali_kelas') return { tabs: ['siswa'] as Holder[], canAdd: null, reviewer: true };
  if (role === 'guru_bk') return { tabs: ['siswa', 'guru'] as Holder[], canAdd: 'guru' as Holder, reviewer: true };
  if (role && GURU_ROLES.includes(role)) return { tabs: ['guru'] as Holder[], canAdd: 'guru' as Holder, reviewer: false };
  if (role === 'tenaga_kependidikan') return { tabs: ['tendik'] as Holder[], canAdd: 'tendik' as Holder, reviewer: false };
  // Kepala madrasah, waka, dll.: lihat seluruh prestasi (tanpa mengajukan dari aplikasi).
  return { tabs: ['siswa', 'guru', 'tendik', 'madrasah'] as Holder[], canAdd: null, reviewer: false };
}

export const holderOf = (a: Achievement): Holder =>
  (a.holder_type as Holder) || (a.student_id ? 'siswa' : 'madrasah');

/** Prestasi terverifikasi + ajuan verval yang menunggu/ditolak (id `verval-…`). */
export async function loadPrestasi(reviewer: boolean): Promise<Achievement[]> {
  const items = await api.achievements.list();
  let pending: Achievement[] = [];
  try {
    const reqs = await api.verval.prestasi(reviewer);
    pending = reqs
      .filter((r) => r.status === 'pending' || r.status === 'rejected')
      .map((r) => ({
        ...((r.new_data ?? {}) as Partial<Achievement>),
        name: String((r.new_data ?? {}).name ?? 'Prestasi'),
        id: `verval-${r.id}`,
        is_verified: false,
        _vervalRequestId: r.id,
        _vervalStatus: r.status,
        _adminNotes: r.admin_notes ?? null,
      }));
  } catch {
    // Non-fatal: tetap tampilkan prestasi yang sudah disetujui.
  }
  return [...pending, ...items];
}

export const prestasiKey = (role: string | null | undefined) => `prestasi.${role ?? 'x'}`;

export function statusOf(a: Achievement): { label: string; tone: BadgeTone; icon: IconName } {
  if (a._vervalStatus === 'rejected') return { label: 'Ditolak', tone: 'error', icon: 'close-circle-outline' };
  if (a.is_verified) return { label: 'Terverifikasi', tone: 'success', icon: 'checkmark-circle-outline' };
  return { label: 'Menunggu', tone: 'warning', icon: 'time-outline' };
}
