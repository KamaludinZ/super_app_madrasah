import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatPoin } from '@/components/tatib/RingkasanPoin';
import { pesanGalatTatib } from '@/lib/aksesTatib';
import KelolaKategoriInline from '@/components/tatib/KelolaKategoriInline';

const kosong = () => ({ kode_aturan: '', nama: '', jalur_poin: 'minus', besar_poin: '', kategori_id: '', deskripsi: '' });

const JALUR = [
  { value: 'minus', label: 'Minus', ket: 'Pelanggaran', aktif: 'border-red-500 bg-red-50 text-red-700 ring-1 ring-red-500' },
  { value: 'plus', label: 'Plus', ket: 'Kebaikan', aktif: 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500' },
];

/**
 * Dialog tambah/ubah jenis aturan. `jenis` = null untuk tambah.
 * `onSimpan(isian)` -> Promise jenis tersimpan (galat dilempar dengan pesan siap tampil).
 * `onTambahKategori(isian)` (opsional) -> Promise kategori baru; kategori itu langsung dipilih.
 */
export default function FormJenisAturan({ open, onOpenChange, jenis, kategoriList = [], onSimpan, onTambahKategori }) {
  const [form, setForm] = useState(kosong);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(jenis
      ? { kode_aturan: jenis.kode_aturan, nama: jenis.nama, jalur_poin: jenis.jalur_poin, besar_poin: String(jenis.besar_poin),
          kategori_id: jenis.kategori_id || '', deskripsi: jenis.deskripsi || '' }
      : kosong());
  }, [open, jenis]);

  const ubah = (isian) => setForm((f) => ({ ...f, ...isian }));
  const kategori = kategoriList.find((k) => k.id === form.kategori_id);
  // Kategori lama yang sudah dihapus tetap ditandai agar petugas memilih ulang.
  const kategoriHilang = Boolean(form.kategori_id) && kategoriList.length > 0 && !kategori;

  const tambahKategori = async (isian) => {
    const baru = await onTambahKategori(isian);
    ubah({ kategori_id: baru.id });
    return baru;
  };
  const besar = Math.abs(parseInt(form.besar_poin, 10) || 0);
  const pratinjau = form.jalur_poin === 'minus' ? -besar : besar;

  const simpan = async (e) => {
    e?.preventDefault();
    if (!form.kode_aturan.trim() || !form.nama.trim() || !form.kategori_id || !besar) {
      toast.error('Kode aturan, nama jenis, kategori, dan besar poin (minimal 1) wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const hasil = await onSimpan({ ...form, id: jenis?.id });
      toast.success(`${hasil.kode_aturan} ${jenis ? 'diperbarui' : 'ditambahkan'}`);
      onOpenChange(false);
    } catch (err) {
      toast.error(pesanGalatTatib(err, err?.message || 'Gagal menyimpan jenis aturan'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" data-testid="form-jenis-aturan">
        <DialogHeader>
          <DialogTitle>{jenis ? 'Ubah Jenis Aturan' : 'Tambah Jenis Aturan'}</DialogTitle>
          <DialogDescription>Besar poin di sini dipakai otomatis setiap kali jenis ini dicatat.</DialogDescription>
        </DialogHeader>

        <form onSubmit={simpan} className="space-y-4" id="form-jenis-aturan">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <div>
              <Label htmlFor="jenis-kode">Kode aturan*</Label>
              <Input
                id="jenis-kode"
                value={form.kode_aturan}
                onChange={(e) => ubah({ kode_aturan: e.target.value.toUpperCase() })}
                placeholder="Mis. DIS-01"
                maxLength={20}
                className="font-mono"
                data-testid="jenis-kode"
              />
            </div>
            <div>
              <Label htmlFor="jenis-nama">Nama jenis pelanggaran*</Label>
              <Input
                id="jenis-nama"
                value={form.nama}
                onChange={(e) => ubah({ nama: e.target.value })}
                placeholder="Mis. Terlambat masuk madrasah"
                maxLength={150}
                data-testid="jenis-nama"
              />
            </div>
          </div>

          <div>
            <Label>Kategori*</Label>
            <Select value={form.kategori_id || undefined} onValueChange={(kategori_id) => ubah({ kategori_id })}>
              <SelectTrigger className={kategoriHilang ? 'border-amber-500' : ''} data-testid="jenis-kategori">
                <SelectValue placeholder={kategoriList.length ? 'Pilih kategori' : 'Belum ada kategori — tambahkan dulu'} />
              </SelectTrigger>
              <SelectContent>
                {kategoriList.map((k) => <SelectItem key={k.id} value={k.id}>{k.nama}</SelectItem>)}
              </SelectContent>
            </Select>
            {kategoriHilang && <p className="mt-1 text-xs text-amber-700">Kategori sebelumnya sudah tidak ada; pilih kategori lain.</p>}
            {kategori?.deskripsi && <p className="mt-1 text-xs text-slate-500">{kategori.deskripsi}</p>}
            {onTambahKategori && (
              <div className="mt-2">
                <KelolaKategoriInline onSimpan={tambahKategori} />
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset>
              <legend className="text-sm font-medium mb-2">Jalur poin*</legend>
              <div className="grid grid-cols-2 gap-2" role="radiogroup">
                {JALUR.map((j) => (
                  <button
                    key={j.value}
                    type="button"
                    role="radio"
                    aria-checked={form.jalur_poin === j.value}
                    onClick={() => ubah({ jalur_poin: j.value })}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${form.jalur_poin === j.value ? j.aktif : 'hover:bg-slate-50'}`}
                    data-testid={`jenis-jalur-${j.value}`}
                  >
                    <span className="block font-semibold">{j.label}</span>
                    <span className="block text-xs opacity-80">{j.ket}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <div>
              <Label htmlFor="jenis-besar">Besar poin*</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="jenis-besar"
                  type="number"
                  min={1}
                  max={1000}
                  inputMode="numeric"
                  value={form.besar_poin}
                  onChange={(e) => ubah({ besar_poin: e.target.value.replace(/[^0-9]/g, '') })}
                  className="w-28 tabular-nums"
                  data-testid="jenis-besar"
                />
                <span className={`text-2xl font-bold tabular-nums ${pratinjau < 0 ? 'text-red-700' : pratinjau > 0 ? 'text-emerald-700' : 'text-slate-300'}`} data-testid="jenis-pratinjau">
                  {besar ? formatPoin(pratinjau) : '—'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">Isi angka positif; tanda mengikuti jalur.</p>
            </div>
          </div>

          <div>
            <Label htmlFor="jenis-deskripsi">Deskripsi</Label>
            <Textarea
              id="jenis-deskripsi"
              value={form.deskripsi}
              onChange={(e) => ubah({ deskripsi: e.target.value })}
              placeholder="Penjelasan singkat kapan jenis ini dipakai (opsional)"
              rows={3}
              maxLength={500}
            />
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Batal</Button>
          <Button type="submit" form="form-jenis-aturan" disabled={saving} data-testid="jenis-simpan">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
