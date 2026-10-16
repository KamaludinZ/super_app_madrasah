import React from 'react';

/**
 * Pilihan kategori tatib berbentuk chip. "Semua" mengosongkan pilihan (value '').
 * `kategoriList`: [{ id, nama }]; `jumlahJenis`: { [kategori_id]: n } jenis aktif per kategori (opsional).
 */
export default function PilihKategoriTatib({ kategoriList = [], value, onPilih, jumlahJenis = {}, disabled, testid = 'pilih-kategori-tatib' }) {
  const chip = (id, label, n) => {
    const aktif = (value || '') === id;
    return (
      <button
        key={id || 'semua'}
        type="button"
        role="radio"
        aria-checked={aktif}
        disabled={disabled}
        onClick={() => onPilih(id)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-60 ${
          aktif ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
        }`}
        data-testid={`${testid}-${id || 'semua'}`}
      >
        {label}
        {n != null && <span className={`text-xs tabular-nums ${aktif ? 'text-slate-300' : 'text-slate-400'}`}>{n}</span>}
      </button>
    );
  };

  const total = Object.values(jumlahJenis).reduce((s, n) => s + n, 0);
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Kategori tata tertib" data-testid={testid}>
      {chip('', 'Semua', total || null)}
      {kategoriList.map((k) => chip(k.id, k.nama, jumlahJenis[k.id] ?? 0))}
    </div>
  );
}
