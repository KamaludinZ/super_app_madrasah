import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import { formatPoin, nilaiPoin } from '@/components/tatib/RingkasanPoin';
import { formatTanggalPoin } from '@/components/tatib/RiwayatPoin';
import { tambahTindakLanjut } from '@/lib/poinTatib';
import { pesanGalatTatib } from '@/lib/aksesTatib';
import { hariIniWIB } from '@/lib/tanggal';

const hariIni = () => hariIniWIB();

// Tindak lanjut penanganan satu pelanggaran: linimasa yang sudah dicatat + formulir tambah.
// Disimpan lewat POST /tatib/penanganan/{id}/tindak-lanjut (hanya peran input).
export default function TindakLanjutDialog({ catatan, onClose, onTersimpan, bolehUbah = true }) {
  const [tanggal, setTanggal] = useState(hariIni);
  const [uraian, setUraian] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTanggal(hariIni());
    setUraian('');
  }, [catatan?.id]);

  const daftar = [...(catatan?.tindak_lanjut || [])].sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || ''));

  const simpan = async () => {
    if (!uraian.trim() || !tanggal) {
      toast.error('Tanggal dan uraian tindak lanjut wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const baru = await tambahTindakLanjut(catatan.id, { tanggal, uraian: uraian.trim() });
      toast.success('Tindak lanjut dicatat');
      setUraian('');
      onTersimpan?.(baru);
    } catch (e) {
      toast.error(pesanGalatTatib(e, 'Gagal mencatat tindak lanjut'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!catatan} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" data-testid="tindak-lanjut-dialog">
        {catatan && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-[#006837]" /> Tindak Lanjut Pelanggaran
              </DialogTitle>
              <DialogDescription className="text-left">
                {catatan.siswa_nama}{catatan.siswa_kelas ? ` (${catatan.siswa_kelas})` : ''} · {catatan.tatib_nama}{' '}
                <span className="font-semibold text-red-700 tabular-nums">{formatPoin(nilaiPoin(catatan))}</span> · {formatTanggalPoin(catatan.tanggal)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-900">Riwayat penanganan</h3>
              {daftar.length === 0 ? (
                <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-slate-500">Belum ada tindak lanjut.</p>
              ) : (
                <ol className="space-y-3 border-l-2 border-slate-200 pl-4" data-testid="tindak-lanjut-daftar">
                  {daftar.map((t, i) => (
                    <li key={t.id || i} className="relative text-sm">
                      <span className="absolute -left-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-[#006837]" aria-hidden />
                      <p className="text-slate-900">{t.uraian}</p>
                      <p className="text-xs text-slate-500">{formatTanggalPoin(t.tanggal)}{t.petugas_nama ? ` · ${t.petugas_nama}` : ''}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {bolehUbah && (
              <div className="space-y-3 rounded-lg border bg-slate-50 p-3">
                <h3 className="text-sm font-semibold text-slate-900">Tambah tindak lanjut</h3>
                <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                  <div>
                    <Label>Tanggal*</Label>
                    <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
                  </div>
                  <div>
                    <Label>Uraian*</Label>
                    <Textarea
                      value={uraian}
                      onChange={(e) => setUraian(e.target.value)}
                      placeholder="Mis. pembinaan lisan, panggilan orang tua, surat pernyataan"
                      rows={2}
                      data-testid="tindak-lanjut-uraian"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={simpan} disabled={saving} data-testid="tindak-lanjut-simpan">
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Simpan Tindak Lanjut
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
