/**
 * Draf pengisian jurnal yang dibawa dari layar Scan ke layar Isi Jurnal (tidak disimpan ke disk).
 * QR terenkripsi server terlalu panjang untuk parameter URL, jadi disimpan di sini.
 */
import { create } from 'zustand';
import type { QRValidation } from '@/api/types';
import type { StoredPermit, TimeEvidence } from '@/offline/permits';

export type GeoFix = { lat: number; lon: number; accuracy: number | null; time: string } | null;

export type JournalDraft = {
  qrToken: string | null;
  location: GeoFix;
  /** Hasil POST /jurnal/validate (hanya bila online). */
  validation: QRValidation | null;
  /** Izin offline untuk slot ini (bila scan dilakukan offline). */
  permit: StoredPermit | null;
  /** Bukti waktu dihitung SAAT SCAN (guru sedang di kelas), bukan saat kirim. */
  timeEvidence: TimeEvidence | null;
  set: (p: Partial<Omit<JournalDraft, 'set' | 'reset'>>) => void;
  reset: () => void;
};

const empty = { qrToken: null, location: null, validation: null, permit: null, timeEvidence: null };

export const useJournalDraft = create<JournalDraft>((set) => ({
  ...empty,
  set: (p) => set(p),
  reset: () => set(empty),
}));
