import React from 'react';

// Satu penanda ruang di atas denah. Posisi (posisi_x, posisi_y) dalam persen terhadap gambar denah;
// titik penanda tepat di koordinat, nama ruang di bawahnya.
// `onMulaiGeser(e, marker)` (mode atur admin) membuat penanda bisa diseret untuk menggeser posisinya.
export default function PenandaRuang({ marker, aktif = false, sorot = false, tampilNama = true, onPilih, onMulaiGeser }) {
  const tegas = aktif || sorot;
  return (
    <button
      type="button"
      className={`group absolute flex -translate-x-1/2 flex-col items-center focus:outline-none ${onMulaiGeser ? 'cursor-grab touch-none active:cursor-grabbing' : ''}`}
      style={{ left: `${marker.posisi_x}%`, top: `calc(${marker.posisi_y}% - 7px)`, zIndex: tegas ? 20 : 10 }}
      onClick={() => onPilih?.(marker)}
      onPointerDown={onMulaiGeser ? (e) => onMulaiGeser(e, marker) : undefined}
      aria-label={`Ruang ${marker.kode_ruang ? `${marker.kode_ruang} ` : ''}${marker.nama_ruang}`}
      aria-pressed={aktif}
      data-testid={`masterplan-marker-${marker.id}`}
      data-penanda
    >
      <span
        className={`block rounded-full border-2 border-white shadow transition-all group-focus-visible:ring-2 group-focus-visible:ring-[#006837] ${
          tegas ? 'h-4 w-4 bg-amber-500 ring-4 ring-amber-300/60' : 'h-3.5 w-3.5 bg-[#006837] group-hover:scale-125'
        }`}
        aria-hidden
      />
      {(tampilNama || tegas || marker.kode_ruang) && (
        <span
          className={`mt-0.5 block whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium shadow-sm sm:text-xs ${
            tegas ? 'bg-amber-500 text-white' : 'bg-white/90 text-slate-800 group-hover:bg-white'
          }`}
        >
          {marker.kode_ruang && <span className="font-mono font-bold">{marker.kode_ruang}</span>}
          {marker.kode_ruang && tampilNama && <span className="mx-1 opacity-50">·</span>}
          {(tampilNama || !marker.kode_ruang) && <span>{marker.nama_ruang}</span>}
        </span>
      )}
    </button>
  );
}
