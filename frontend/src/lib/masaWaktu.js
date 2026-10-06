/**
 * Hitung lama waktu kalender (tahun & bulan penuh) — dipakai untuk umur dan masa kerja GTK.
 */

/** 'YYYY-MM-DD' (atau ISO) -> Date lokal tengah malam; null bila tidak valid. */
export function bacaTanggal(teks) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(teks || '').trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(y, mo - 1, d);
  return t.getFullYear() === y && t.getMonth() === mo - 1 && t.getDate() === d ? t : null;
}

/**
 * Selisih tahun & bulan penuh dari `dari` sampai `sampai` (default hari ini).
 * -> { tahun, bulan } ; null bila tanggal kosong/tidak valid atau di masa depan.
 */
export function selisihTahunBulan(dari, sampai = new Date()) {
  const a = dari instanceof Date ? dari : bacaTanggal(dari);
  const b = sampai instanceof Date ? sampai : bacaTanggal(sampai);
  if (!a || !b || a > b) return null;
  let bulan = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) bulan -= 1; // bulan berjalan belum genap
  return { tahun: Math.floor(bulan / 12), bulan: bulan % 12 };
}

/** { tahun, bulan } -> "45 tahun 3 bulan" */
export const teksTahunBulan = (s) => (s ? `${s.tahun} tahun ${s.bulan} bulan` : '');

/** Status kepegawaian dari kode/data lama -> 'pns' | 'pppk' | 'non_asn' | null */
export function kodeKepegawaian(status) {
  const raw = String(status || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (raw === 'pns') return 'pns';
  if (raw === 'pppk' || raw === 'p3k') return 'pppk';
  if (['non_asn', 'nonasn', 'honorer', 'gtt', 'ptt', 'gty', 'pty'].includes(raw)) return 'non_asn';
  return null;
}

/**
 * Masa kerja GTK: PNS & PPPK dihitung dari TMT PNS, Non ASN dari TMT Pegawai.
 * -> { lama: {tahun, bulan} | null, sumber: 'TMT PNS' | 'TMT Pegawai', tmt, pesan }
 */
export function masaKerjaGtk({ status_kepegawaian: status, tmt_pns: tmtPns, tmt_pegawai: tmtPegawai } = {}, hariIni = new Date()) {
  const kode = kodeKepegawaian(status);
  if (!kode) return { lama: null, sumber: null, tmt: '', pesan: 'Status kepegawaian belum diisi' };
  const asn = kode === 'pns' || kode === 'pppk';
  const sumber = asn ? 'TMT PNS' : 'TMT Pegawai';
  const tmt = asn ? tmtPns : tmtPegawai;
  if (!tmt) return { lama: null, sumber, tmt: '', pesan: `${sumber} belum diisi` };
  const lama = selisihTahunBulan(tmt, hariIni);
  if (!lama) return { lama: null, sumber, tmt, pesan: bacaTanggal(tmt) ? `${sumber} setelah hari ini` : `${sumber} tidak valid` };
  return { lama, sumber, tmt, pesan: '' };
}
