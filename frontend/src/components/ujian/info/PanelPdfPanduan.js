import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertCircle, Eye, FileText, Loader2, RefreshCw, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatWIBPanjang } from '@/lib/datetime';
import { formatUkuranBerkas, pesanGalatUnggah } from '@/lib/ujianBerkas';
import { pesanGalat } from '@/lib/ujian';
import { bukaPanduanPdfAdmin, galatPdfPanduan, hapusPanduanPdf, unggahPanduanPdf } from '@/lib/ujianInfoKonten';

/**
 * PDF panduan CBT satu ujian: berkas terunggah (nama, ukuran, pengunggah, waktu), tombol lihat / ganti / hapus, atau
 * area unggah (klik atau seret berkas) bila belum ada. PDF maks. 10 MB; isinya diperiksa sebelum dikirim. Unggah dan
 * hapus langsung tersimpan (terpisah dari tombol Simpan isian teks). `bolehUbah` false = hanya lihat.
 */
export default function PanelPdfPanduan({ ujianId, pdf, bolehUbah, tiruan, onBerubah }) {
  const input = useRef(null);
  const [progres, setProgres] = useState(null);
  const [galat, setGalat] = useState('');
  const [seret, setSeret] = useState(false);
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false);
  const [menghapus, setMenghapus] = useState(false);
  const sibuk = progres !== null || menghapus;

  const unggah = async (file) => {
    if (!file || sibuk) return;
    const pesan = await galatPdfPanduan(file);
    if (pesan) { setGalat(pesan); return; }
    setGalat('');
    setProgres(0);
    try {
      const r = await unggahPanduanPdf(ujianId, file, setProgres);
      onBerubah(r.konten, r.tiruan);
      toast.success(pdf ? 'PDF panduan diganti' : 'PDF panduan diunggah', { description: 'Langsung tampil di halaman informasi ujian siswa.' });
    } catch (e) {
      setGalat(pesanGalatUnggah(e, 'kisi_kisi').replace(/^Kisi-kisi/, 'Panduan CBT'));
    } finally {
      setProgres(null);
      if (input.current) input.current.value = '';
    }
  };

  const hapus = async () => {
    setMenghapus(true);
    try {
      const r = await hapusPanduanPdf(ujianId);
      onBerubah(r.konten, r.tiruan);
      setKonfirmasiHapus(false);
      toast.success('PDF panduan dihapus');
    } catch (e) {
      setGalat(pesanGalat(e, 'Gagal menghapus PDF panduan.'));
      setKonfirmasiHapus(false);
    } finally {
      setMenghapus(false);
    }
  };

  const lihat = async () => {
    try {
      await bukaPanduanPdfAdmin(ujianId, tiruan);
    } catch (e) {
      setGalat(pesanGalat(e, 'PDF panduan tidak dapat dibuka.'));
    }
  };

  const pilih = () => input.current?.click();
  const masukan = (
    <input ref={input} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => unggah(e.target.files?.[0])}
      data-testid="pdf-panduan-input" aria-label="Pilih PDF panduan CBT" />
  );

  return (
    <div className="space-y-2" data-testid="panel-pdf-panduan">
      <div className="text-sm font-medium text-slate-800">PDF panduan</div>
      {pdf ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-rose-50 text-rose-600"><FileText className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-slate-900" title={pdf.nama_file} data-testid="pdf-panduan-nama">{pdf.nama_file}</div>
              <div className="text-xs text-slate-500">
                {[formatUkuranBerkas(pdf.ukuran_byte), pdf.diunggah_pada && formatWIBPanjang(pdf.diunggah_pada), pdf.diunggah_oleh_nama && `oleh ${pdf.diunggah_oleh_nama}`]
                  .filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
          {pdf.ada_di_disk === false && (
            <p className="mt-2 flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800" data-testid="pdf-panduan-hilang">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Berkas PDF tidak ditemukan di server, jadi siswa tidak dapat membukanya. Unggah ulang PDF panduan.
            </p>
          )}
          {progres !== null && <Progres nilai={progres} />}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={lihat} disabled={pdf.ada_di_disk === false} data-testid="pdf-panduan-lihat">
              <Eye className="h-3.5 w-3.5" /> Lihat
            </Button>
            {bolehUbah && (
              <>
                <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={pilih} disabled={sibuk} data-testid="pdf-panduan-ganti">
                  {progres !== null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Ganti
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-rose-700 hover:bg-rose-50 hover:text-rose-800" onClick={() => setKonfirmasiHapus(true)}
                  disabled={sibuk} data-testid="pdf-panduan-hapus">
                  <Trash2 className="h-3.5 w-3.5" /> Hapus
                </Button>
              </>
            )}
          </div>
        </div>
      ) : bolehUbah ? (
        <button type="button" onClick={pilih} disabled={sibuk}
          onDragOver={(e) => { e.preventDefault(); setSeret(true); }} onDragLeave={() => setSeret(false)}
          onDrop={(e) => { e.preventDefault(); setSeret(false); unggah(e.dataTransfer.files?.[0]); }}
          className={`flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed px-4 py-5 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006837] ${seret ? 'border-[#006837] bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
          data-testid="pdf-panduan-unggah">
          {progres !== null ? <Loader2 className="h-5 w-5 animate-spin text-[#006837]" /> : <Upload className="h-5 w-5 text-slate-500" />}
          <span className="text-sm font-medium text-slate-800">{progres !== null ? `Mengunggah… ${progres}%` : 'Unggah PDF panduan'}</span>
          <span className="text-xs text-slate-500">Klik atau seret berkas ke sini · PDF, maks. 10 MB</span>
        </button>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500" data-testid="pdf-panduan-kosong">Belum ada PDF panduan.</p>
      )}
      {galat && <p className="flex items-start gap-1.5 text-xs text-rose-600" role="alert" data-testid="pdf-panduan-galat"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {galat}</p>}
      {bolehUbah && masukan}

      <AlertDialog open={konfirmasiHapus} onOpenChange={(o) => { if (!menghapus) setKonfirmasiHapus(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus PDF panduan?</AlertDialogTitle>
            <AlertDialogDescription>
              Tombol &quot;Buka panduan (PDF)&quot; hilang dari halaman informasi ujian siswa. Video panduan (bila ada) tetap tampil.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={menghapus}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); hapus(); }} disabled={menghapus} className="bg-rose-600 hover:bg-rose-700" data-testid="pdf-panduan-hapus-ya">
              {menghapus && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Hapus PDF
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Progres({ nilai }) {
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={nilai} aria-valuemin={0} aria-valuemax={100} aria-label="Progres unggah">
      <div className="h-full bg-[#006837]" style={{ width: `${nilai}%` }} />
    </div>
  );
}
