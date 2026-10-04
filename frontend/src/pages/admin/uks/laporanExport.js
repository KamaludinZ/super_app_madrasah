import { api } from '@/lib/api';
import { paramsPeriode } from './uksPeriode';

const saveBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[";\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Ubah { title, columns:[{key,label}], rows } menjadi CSV (dibuka Excel; BOM agar UTF-8 terbaca). */
export const toCsv = (sections) => {
  const lines = [];
  sections.forEach((sec, i) => {
    if (i > 0) lines.push('');
    if (sec.title) lines.push(csvCell(sec.title));
    lines.push(sec.columns.map((c) => csvCell(c.label)).join(';'));
    sec.rows.forEach((r) => lines.push(sec.columns.map((c) => csvCell(r[c.key])).join(';')));
  });
  return `﻿${lines.join('\r\n')}`;
};

/**
 * Unduh laporan dari endpoint backend `/uks/laporan-baru/{jenis}/export-{format}`.
 * Bila endpoint belum tersedia (404), Excel memakai cadangan CSV dari data yang
 * sedang tampil. Mengembalikan 'server' | 'csv'.
 */
export async function unduhLaporan({ jenis, format, periode, filenameBase, fallbackSections }) {
  try {
    const res = await api.get(`/uks/laporan-baru/${jenis}/export-${format}`, {
      params: paramsPeriode(periode),
      responseType: 'blob',
    });
    saveBlob(new Blob([res.data]), `${filenameBase}.${format === 'excel' ? 'xlsx' : 'pdf'}`);
    return 'server';
  } catch (e) {
    const status = e?.response?.status;
    if (status === 404 && format === 'excel' && fallbackSections?.length) {
      saveBlob(new Blob([toCsv(fallbackSections)], { type: 'text/csv;charset=utf-8' }), `${filenameBase}.csv`);
      return 'csv';
    }
    throw e;
  }
}
