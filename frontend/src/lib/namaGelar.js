/**
 * Susunan nama lengkap GTK dari nama tanpa gelar + gelar depan + gelar belakang.
 * Aturan (sama dengan backend susun_nama_lengkap):
 *  - gelar depan diletakkan sebelum nama, dipisah spasi:      "Dr. H. Ahmad Fauzi"
 *  - gelar belakang diletakkan setelah nama, dipisah koma:    "Ahmad Fauzi, S.Pd., M.Pd."
 *  - spasi berlebih dirapikan; koma/spasi di tepi gelar dibuang.
 */
const rapikan = (t) => String(t || '').replace(/\s+/g, ' ').trim();
const rapikanGelar = (t) => rapikan(t).replace(/^[,\s]+|[,\s]+$/g, '');

export function susunNamaLengkap({ nama_tanpa_gelar: nama, gelar_depan: depan, gelar_belakang: belakang } = {}) {
  const n = rapikan(nama);
  if (!n) return '';
  const d = rapikanGelar(depan);
  const b = rapikanGelar(belakang);
  return `${d ? `${d} ` : ''}${n}${b ? `, ${b}` : ''}`;
}

/** Nilai awal field nama untuk data lama yang belum punya nama_tanpa_gelar: pakai full_name apa adanya. */
export function nilaiAwalNama(user = {}) {
  return {
    nama_tanpa_gelar: user.nama_tanpa_gelar ?? (user.full_name || ''),
    gelar_depan: user.gelar_depan || '',
    gelar_belakang: user.gelar_belakang || '',
  };
}
