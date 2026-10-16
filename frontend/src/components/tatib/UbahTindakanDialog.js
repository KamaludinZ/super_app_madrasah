import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { pesanGalatTatib } from '@/lib/aksesTatib';
import { formatPoin } from '@/components/tatib/RingkasanPoin';
import { STATUS_PANGGILAN_WALI, STATUS_RTLPD, STATUS_SP, TINGKAT_SP } from '@/lib/tindakanTatib';

// Pilihan bergaya tombol (satu nilai). `nilai` null = "Tidak ada".
function PilihanTombol({ label, pilihan, nilai, onPilih, testid }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-1.5" role="radiogroup">
        {pilihan.map(({ value, teks }) => {
          const aktif = (nilai ?? null) === value;
          return (
            <button
              key={teks}
              type="button"
              role="radio"
              aria-checked={aktif}
              onClick={() => onPilih(value)}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${aktif ? 'border-slate-900 bg-slate-900 text-white' : 'hover:bg-slate-50'}`}
              data-testid={`${testid}-${value ?? 'tidak-ada'}`}
            >
              {teks}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

const sebagaiPilihan = (daftar) => daftar.map((v) => ({ value: v, teks: v }));

/**
 * Ubah status pembinaan satu siswa: keterangan SP (bawaan = usulan otomatis bila belum ditetapkan),
 * panggilan wali, status SP, RTLPD, dan catatan. `onSimpan(isian)` -> Promise item tersimpan.
 */
export default function UbahTindakanDialog({ siswa, onClose, onSimpan }) {
  const [isian, setIsian] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!siswa) return;
    setIsian({
      keterangan_sp: siswa.keterangan_sp ?? siswa.usulan_sp ?? null,
      status_panggilan_wali: siswa.status_panggilan_wali || STATUS_PANGGILAN_WALI[0],
      status_sp: siswa.status_sp || STATUS_SP[0],
      status_rtlpd: siswa.status_rtlpd || STATUS_RTLPD[0],
      catatan: '',
    });
  }, [siswa]);

  if (!siswa || !isian) return null;
  const ubah = (x) => setIsian((v) => ({ ...v, ...x }));
  const dariUsulan = !siswa.keterangan_sp && siswa.usulan_sp && isian.keterangan_sp === siswa.usulan_sp;

  const simpan = async () => {
    setSaving(true);
    try {
      await onSimpan(isian);
      toast.success(`Status pembinaan ${siswa.nama} disimpan`);
      onClose();
    } catch (e) {
      toast.error(pesanGalatTatib(e, e?.message || 'Gagal menyimpan status pembinaan'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="ubah-tindakan">
        <DialogHeader>
          <DialogTitle>Ubah Tindakan — {siswa.nama}</DialogTitle>
          <DialogDescription>
            {siswa.kelas || '-'} · pelanggaran {formatPoin(siswa.poin_negatif || 0)} · kebaikan {formatPoin(siswa.poin_positif || 0)}
            {siswa.usulan_sp ? ` · usulan otomatis ${siswa.usulan_sp}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <PilihanTombol
              label="Keterangan SP"
              pilihan={[{ value: null, teks: 'Tidak ada' }, ...sebagaiPilihan(TINGKAT_SP)]}
              nilai={isian.keterangan_sp}
              onPilih={(keterangan_sp) => ubah({ keterangan_sp })}
              testid="tindakan-ket-sp"
            />
            {dariUsulan && (
              <p className="mt-1 flex items-center gap-1 text-xs text-amber-700"><Sparkles className="h-3 w-3" /> Terisi dari usulan otomatis — ubah bila keputusan sekolah berbeda.</p>
            )}
          </div>
          <PilihanTombol label="Status panggilan wali" pilihan={sebagaiPilihan(STATUS_PANGGILAN_WALI)} nilai={isian.status_panggilan_wali}
            onPilih={(status_panggilan_wali) => ubah({ status_panggilan_wali })} testid="tindakan-wali" />
          <PilihanTombol label="Status SP" pilihan={sebagaiPilihan(STATUS_SP)} nilai={isian.status_sp}
            onPilih={(status_sp) => ubah({ status_sp })} testid="tindakan-status-sp" />
          <PilihanTombol label="Status RTLPD" pilihan={sebagaiPilihan(STATUS_RTLPD)} nilai={isian.status_rtlpd}
            onPilih={(status_rtlpd) => ubah({ status_rtlpd })} testid="tindakan-rtlpd" />
          <div>
            <Label htmlFor="tindakan-catatan">Catatan perubahan</Label>
            <Textarea id="tindakan-catatan" rows={2} maxLength={300} value={isian.catatan}
              onChange={(e) => ubah({ catatan: e.target.value })} placeholder="Mis. hasil pertemuan dengan wali (opsional)" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Batal</Button>
          <Button onClick={simpan} disabled={saving} data-testid="tindakan-simpan">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
