import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';

export const KONDISI_BAWAAN = [{ label: 'Setiap kejadian', poin: 5 }];

// Ubah daftar kondisi formulir (nilai positif) menjadi payload API (tanda sesuai jalur).
export function kondisiKePayload(jenis, kondisi) {
  const tanda = jenis === 'pelanggaran' ? -1 : 1;
  return kondisi
    .filter((k) => (k.label || '').trim())
    .map((k) => ({ ...(k.id ? { id: k.id } : {}), label: k.label.trim(), poin: tanda * Math.abs(Number(k.poin) || 0) }));
}

// Editor kondisi pelaksanaan sebuah aturan: tiap kondisi punya nilai sendiri.
// Nilai diisi tanpa tanda; tanda plus/minus mengikuti jalur aturan (kebaikan/pelanggaran).
export default function EditorKondisiAturan({ jenis, kondisi, onChange }) {
  const tanda = jenis === 'pelanggaran' ? '−' : '+';
  const ubah = (i, patch) => onChange(kondisi.map((k, j) => (j === i ? { ...k, ...patch } : k)));

  return (
    <div className="space-y-2" data-testid="editor-kondisi-aturan">
      {kondisi.map((k, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={k.label}
            onChange={(e) => ubah(i, { label: e.target.value })}
            placeholder={i === 0 ? 'Mis. Pelanggaran pertama' : 'Mis. Pelanggaran berulang'}
            aria-label={`Nama kondisi ${i + 1}`}
          />
          <div className="flex shrink-0 items-center gap-1">
            <span className={`w-3 text-center font-semibold ${jenis === 'pelanggaran' ? 'text-red-600' : 'text-emerald-600'}`}>{tanda}</span>
            <Input
              type="number"
              min={0}
              className="w-20"
              value={k.poin}
              onChange={(e) => ubah(i, { poin: Math.abs(parseInt(e.target.value, 10) || 0) })}
              aria-label={`Nilai kondisi ${i + 1}`}
            />
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={kondisi.length === 1}
            onClick={() => onChange(kondisi.filter((_, j) => j !== i))}
            aria-label={`Hapus kondisi ${i + 1}`}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...kondisi, { label: '', poin: 0 }])}>
        <Plus className="h-4 w-4 mr-1" /> Tambah kondisi
      </Button>
      <p className="text-xs text-slate-500">Nilai poin saat dicatat mengikuti kondisi yang dipilih petugas. Kondisi pertama menjadi nilai bawaan.</p>
    </div>
  );
}
