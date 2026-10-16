import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Pencil, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { pesanGalatTatib } from '@/lib/aksesTatib';

/**
 * Tambah/ubah kategori tatib langsung di form input (menggantikan menu kategori terpisah).
 * `kategori`: kategori terpilih (tombol "Ubah" hanya muncul bila ada); `onSimpan(isian)` -> Promise kategori tersimpan.
 */
export default function KelolaKategoriInline({ kategori, onSimpan, disabled }) {
  const [mode, setMode] = useState(null); // null | 'tambah' | 'ubah'
  const [isian, setIsian] = useState({ nama: '', deskripsi: '' });
  const [saving, setSaving] = useState(false);

  const buka = (m) => {
    setMode(m);
    setIsian(m === 'ubah' && kategori ? { nama: kategori.nama, deskripsi: kategori.deskripsi || '' } : { nama: '', deskripsi: '' });
  };

  const simpan = async () => {
    if (!isian.nama.trim()) {
      toast.error('Nama kategori wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const hasil = await onSimpan({ ...isian, id: mode === 'ubah' ? kategori?.id : undefined });
      toast.success(mode === 'ubah' ? `Kategori "${hasil.nama}" diperbarui` : `Kategori "${hasil.nama}" ditambahkan`);
      setMode(null);
    } catch (err) {
      toast.error(pesanGalatTatib(err, err?.message || 'Gagal menyimpan kategori'));
    } finally {
      setSaving(false);
    }
  };

  if (disabled) return null;

  if (!mode) {
    return (
      <div className="flex flex-wrap gap-1">
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => buka('tambah')} data-testid="kategori-inline-tambah">
          <Plus className="h-3.5 w-3.5 mr-1" /> Tambah kategori
        </Button>
        {kategori && (
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => buka('ubah')} data-testid="kategori-inline-ubah">
            <Pencil className="h-3.5 w-3.5 mr-1" /> Ubah "{kategori.nama}"
          </Button>
        )}
      </div>
    );
  }

  return (
    // Bukan <form>: komponen ini bisa berada di dalam form lain (mis. form jenis aturan). Enter menyimpan kategori saja.
    <div
      role="group"
      aria-label={mode === 'ubah' ? 'Ubah kategori' : 'Kategori baru'}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); simpan(); }
        if (e.key === 'Escape') { e.stopPropagation(); setMode(null); }
      }}
      className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 space-y-2"
      data-testid="kategori-inline-form"
    >
      <p className="text-xs font-medium text-slate-600">{mode === 'ubah' ? 'Ubah kategori' : 'Kategori baru'}</p>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Input
          autoFocus
          value={isian.nama}
          onChange={(e) => setIsian({ ...isian, nama: e.target.value })}
          placeholder="Nama kategori"
          maxLength={60}
          data-testid="kategori-inline-nama"
        />
        <Input
          value={isian.deskripsi}
          onChange={(e) => setIsian({ ...isian, deskripsi: e.target.value })}
          placeholder="Deskripsi singkat (opsional)"
          maxLength={160}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setMode(null)} disabled={saving}>
          <X className="h-3.5 w-3.5 mr-1" /> Batal
        </Button>
        <Button type="button" size="sm" onClick={simpan} disabled={saving} data-testid="kategori-inline-simpan">
          {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Simpan kategori
        </Button>
      </div>
    </div>
  );
}
