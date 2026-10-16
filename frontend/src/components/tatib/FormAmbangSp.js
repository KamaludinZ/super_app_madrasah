import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, RotateCcw, Save } from 'lucide-react';
import { TINGKAT_SP, WARNA_SP } from '@/lib/tindakanTatib';
import { AMBANG_SP_BAWAAN, MAKS_AMBANG_SP, validasiAmbang } from '@/lib/ambangSp';

const keForm = (a) => ({ sp1: String(a?.sp1 ?? ''), sp2: String(a?.sp2 ?? ''), sp3: String(a?.sp3 ?? ''), alasan: '' });

/**
 * Form ambang SP1/SP2/SP3 dengan validasi langsung (bulat, 1..MAKS, naik). `ambang` = nilai berlaku.
 * `onSimpan({sp1, sp2, sp3, alasan})` -> Promise. `onUbah(nilai|null)` (opsional) menerima nilai valid untuk pratinjau.
 */
export default function FormAmbangSp({ ambang, onSimpan, onUbah, disabled }) {
  const [form, setForm] = useState(() => keForm(ambang));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(keForm(ambang)); }, [ambang]);

  const galat = useMemo(() => validasiAmbang(form), [form]);
  const valid = Object.keys(galat).length === 0;
  const nilai = valid ? { sp1: Number(form.sp1), sp2: Number(form.sp2), sp3: Number(form.sp3) } : null;
  const berubah = Boolean(nilai) && TINGKAT_SP.some((sp) => nilai[sp.toLowerCase()] !== ambang?.[sp.toLowerCase()]);

  useEffect(() => { onUbah?.(berubah ? nilai : null); }, [form]); // eslint-disable-line react-hooks/exhaustive-deps

  const ubah = (isian) => setForm((f) => ({ ...f, ...isian }));
  const bawaan = TINGKAT_SP.every((sp) => Number(form[sp.toLowerCase()]) === AMBANG_SP_BAWAAN[sp.toLowerCase()]);

  const simpan = async (e) => {
    e.preventDefault();
    if (!valid || !berubah) return;
    setSaving(true);
    try {
      await onSimpan({ ...nilai, alasan: form.alasan });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={simpan} className="space-y-4" data-testid="form-ambang-sp">
      <div className="grid gap-4 sm:grid-cols-3">
        {TINGKAT_SP.map((sp) => {
          const k = sp.toLowerCase();
          return (
            <div key={sp}>
              <Label htmlFor={`ambang-input-${k}`} className="flex items-center gap-2">
                <span className={`rounded border px-1.5 text-xs font-semibold ${WARNA_SP[sp]}`}>{sp}</span> minimal poin pelanggaran
              </Label>
              <Input
                id={`ambang-input-${k}`}
                type="number"
                inputMode="numeric"
                min={1}
                max={MAKS_AMBANG_SP}
                value={form[k]}
                onChange={(e) => ubah({ [k]: e.target.value })}
                disabled={disabled}
                aria-invalid={Boolean(galat[k])}
                className={`mt-1 tabular-nums ${galat[k] ? 'border-red-500' : ''}`}
                data-testid={`ambang-input-${k}`}
              />
              {galat[k] && <p className="mt-1 text-xs text-red-600" role="alert" data-testid={`ambang-galat-${k}`}>{galat[k]}</p>}
            </div>
          );
        })}
      </div>

      <div>
        <Label htmlFor="ambang-alasan">Alasan perubahan</Label>
        <Textarea id="ambang-alasan" rows={2} maxLength={300} value={form.alasan} disabled={disabled}
          onChange={(e) => ubah({ alasan: e.target.value })} placeholder="Mis. keputusan rapat dewan guru (opsional, dicatat di riwayat)" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={disabled || bawaan}
          onClick={() => ubah({ sp1: String(AMBANG_SP_BAWAAN.sp1), sp2: String(AMBANG_SP_BAWAAN.sp2), sp3: String(AMBANG_SP_BAWAAN.sp3) })}
          data-testid="ambang-bawaan">
          Pakai nilai bawaan ({AMBANG_SP_BAWAAN.sp1}/{AMBANG_SP_BAWAAN.sp2}/{AMBANG_SP_BAWAAN.sp3})
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={disabled || saving || (!berubah && !form.alasan)} onClick={() => setForm(keForm(ambang))}>
            <RotateCcw className="h-4 w-4 mr-2" /> Batal
          </Button>
          <Button type="submit" disabled={disabled || saving || !valid || !berubah} data-testid="ambang-simpan">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Simpan ambang
          </Button>
        </div>
      </div>
    </form>
  );
}
