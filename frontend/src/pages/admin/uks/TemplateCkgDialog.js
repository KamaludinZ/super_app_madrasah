import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { KOLOM_CKG, kolomTemplateCkg } from '@/lib/ckgKolom';
import PratinjauKolom from '@/components/students/PratinjauKolom';

export const SASARAN_TEMPLATE_CKG = {
  siswa: {
    label: 'Siswa',
    param: 'tingkat',
    opsi: [
      { value: 'all', label: 'Semua kelas' },
      { value: '7', label: 'Kelas 7' },
      { value: '8', label: 'Kelas 8' },
      { value: '9', label: 'Kelas 9' },
    ],
  },
  gtk: {
    label: 'GTK',
    param: 'jenis_gtk',
    opsi: [
      { value: 'all', label: 'Semua GTK' },
      { value: 'guru', label: 'Guru' },
      { value: 'tendik', label: 'Tenaga Kependidikan' },
    ],
  },
};

/** Nama berkas template CKG, mis. Template_CKG_Siswa_Kelas_7.xlsx / Template_CKG_GTK_Guru.xlsx */
export function namaBerkasTemplateCkg(sasaran, pilihan) {
  if (sasaran === 'siswa') return `Template_CKG_Siswa_${pilihan === 'all' ? 'Semua_Kelas' : `Kelas_${pilihan}`}.xlsx`;
  const nama = { all: 'Semua', guru: 'Guru', tendik: 'Tendik' }[pilihan] || 'Semua';
  return `Template_CKG_GTK_${nama}.xlsx`;
}

/**
 * Opsi kelas template siswa: Semua + tingkat 7/8/9 (MTs) + tingkat lain yang ada di data kelas,
 * masing-masing dengan daftar nama kelasnya (mis. "Kelas 7 · 7A, 7B").
 */
export function opsiKelasTemplate(classes = []) {
  const perTingkat = {};
  classes.forEach((c) => {
    const g = c.grade != null ? String(c.grade) : (String(c.name || '').match(/^\d+/) || [])[0];
    if (g) (perTingkat[g] = perTingkat[g] || []).push(c.name);
  });
  const tingkat = [...new Set(['7', '8', '9', ...Object.keys(perTingkat)])].sort((a, b) => Number(a) - Number(b));
  return [
    { value: 'all', label: 'Semua kelas', keterangan: classes.length ? `${classes.length} kelas` : '' },
    ...tingkat.map((t) => ({
      value: t,
      label: `Kelas ${t}`,
      keterangan: perTingkat[t] ? perTingkat[t].sort((a, b) => a.localeCompare(b, 'id', { numeric: true })).join(', ') : 'belum ada kelas',
      kosong: !perTingkat[t] && classes.length > 0,
    })),
  ];
}

/**
 * Opsi jenis template GTK beserta jumlah orangnya. GTK yang memiliki peran guru dan tendik
 * sekaligus dihitung sebagai guru (sama dengan menu Data GTK).
 */
export function opsiJenisGtk(guru, tendik) {
  if (!guru || !tendik) return SASARAN_TEMPLATE_CKG.gtk.opsi;
  const idGuru = new Set(guru.map((u) => u.id));
  const nGuru = idGuru.size;
  const nTendik = tendik.filter((u) => !idGuru.has(u.id)).length;
  const jumlah = { all: nGuru + nTendik, guru: nGuru, tendik: nTendik };
  return SASARAN_TEMPLATE_CKG.gtk.opsi.map((o) => ({ ...o, keterangan: `${jumlah[o.value]} orang`, kosong: jumlah[o.value] === 0 }));
}

/** Parameter query endpoint /uks/ckg/template untuk sasaran & pilihan. */
export function paramsTemplateCkg(sasaran, pilihan) {
  const p = { jenis_pasien: sasaran };
  if (pilihan !== 'all') p[SASARAN_TEMPLATE_CKG[sasaran].param] = pilihan;
  return p;
}

/** Label kelompok untuk judul berkas & toast, mis. "Siswa Kelas 7" / "GTK Guru". */
export function labelKelompokCkg(sasaran, pilihan) {
  if (sasaran === 'siswa') return pilihan === 'all' ? 'Siswa semua kelas' : `Siswa Kelas ${pilihan}`;
  return { all: 'Semua GTK', guru: 'GTK Guru', tendik: 'GTK Tenaga Kependidikan' }[pilihan] || 'Semua GTK';
}

/**
 * Cadangan bila server gagal membuat template: berkas kosong berisi judul kolom template CKG
 * (16 kolom baku + kolom bantu) dengan nama berkas sesuai kelompok.
 */
export async function templateCkgLokal(sasaran, pilihan) {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([
    kolomTemplateCkg().map((k) => k.label),
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template CKG');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[`Template CKG — ${labelKelompokCkg(sasaran, pilihan)}`],
    ['Daftar pasien belum terisi karena server tidak dapat dihubungi; isi Nama, NIK/ID pasien secara manual.']]), 'PETUNJUK');
  XLSX.writeFile(wb, namaBerkasTemplateCkg(sasaran, pilihan));
}

/**
 * Modal unduh template CKG bertingkat: pilih sasaran Siswa (kelas 7/8/9/semua) atau
 * GTK (guru/tendik/semua). Template berisi daftar pasien terisi otomatis dan kolom
 * pemeriksaan dengan susunan sama persis seperti tabel Data CKG.
 */
export default function TemplateCkgDialog({ open, onOpenChange, classes = [] }) {
  const [sasaran, setSasaran] = useState('siswa');
  const [pilihan, setPilihan] = useState('all');
  const [loading, setLoading] = useState(false);

  const [gtk, setGtk] = useState({ guru: null, tendik: null });

  // Jumlah GTK per jenis untuk pilihan template GTK (dimuat sekali saat sasaran GTK dipilih).
  useEffect(() => {
    if (!open || sasaran !== 'gtk' || gtk.guru) return;
    Promise.all([
      api.get('/uks/warga-madrasah', { params: { role: 'guru' } }),
      api.get('/uks/warga-madrasah', { params: { role: 'tenaga_kependidikan' } }),
    ]).then(([g, t]) => setGtk({ guru: g.data || [], tendik: t.data || [] })).catch(() => {});
  }, [open, sasaran, gtk.guru]);

  const gantiSasaran = (v) => { setSasaran(v); setPilihan('all'); };

  const unduh = async () => {
    setLoading(true);
    try {
      const res = await api.get('/uks/ckg/template', { params: paramsTemplateCkg(sasaran, pilihan), responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      // Nama berkas dari server (mis. nama kelas resmi); cadangan: susunan nama di browser.
      const dariServer = (res.headers?.['content-disposition'] || '').match(/filename="?([^";]+)"?/);
      link.setAttribute('download', dariServer ? dariServer[1] : namaBerkasTemplateCkg(sasaran, pilihan));
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      const jumlah = res.headers?.['x-jumlah-data'];
      if (jumlah === '0') toast.warning(`Belum ada pasien ${labelKelompokCkg(sasaran, pilihan)}; template hanya berisi judul kolom.`);
      else toast.success(`Template CKG ${labelKelompokCkg(sasaran, pilihan)} berhasil diunduh${jumlah ? ` (${jumlah} pasien)` : ''}`);
      onOpenChange(false);
    } catch (e) {
      const st = e?.response?.status;
      if (st === 401 || st === 403) {
        toast.error('Hanya petugas UKS/admin yang dapat mengunduh template');
      } else {
        try {
          await templateCkgLokal(sasaran, pilihan);
          toast.warning(`Server tidak dapat membuat template; diunduh template kosong ${labelKelompokCkg(sasaran, pilihan)} (tanpa daftar pasien).`);
          onOpenChange(false);
        } catch (err) {
          toast.error('Gagal mengunduh template CKG');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const opsi = sasaran === 'siswa' ? opsiKelasTemplate(classes) : opsiJenisGtk(gtk.guru, gtk.tendik);
  const opsiDipilih = opsi.find((o) => o.value === pilihan);

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-[#006837]" /> Unduh Template CKG</DialogTitle>
          <DialogDescription>
            Template berisi daftar pasien terisi otomatis dan {KOLOM_CKG.length} kolom baku yang sama dengan tabel Data CKG.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Sasaran</Label>
            <RadioGroup value={sasaran} onValueChange={gantiSasaran} className="grid grid-cols-2 gap-2" data-testid="sasaran-template-ckg">
              {Object.entries(SASARAN_TEMPLATE_CKG).map(([k, v]) => (
                <Label key={k} htmlFor={`sasaran-ckg-${k}`}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 font-normal ${sasaran === k ? 'border-[#006837] bg-[#006837]/5' : 'border-slate-200'}`}>
                  <RadioGroupItem id={`sasaran-ckg-${k}`} value={k} /> {v.label}
                </Label>
              ))}
            </RadioGroup>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{sasaran === 'siswa' ? 'Kelas' : 'Jenis GTK'}</Label>
            <RadioGroup value={pilihan} onValueChange={setPilihan} className="grid grid-cols-2 gap-2" data-testid="pilihan-template-ckg">
              {opsi.map((o) => (
                <Label key={o.value} htmlFor={`pilihan-ckg-${o.value}`}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 font-normal ${pilihan === o.value ? 'border-[#006837] bg-[#006837]/5' : 'border-slate-200'}`}>
                  <RadioGroupItem id={`pilihan-ckg-${o.value}`} value={o.value} />
                  <span className="flex flex-col leading-tight">
                    <span>{o.label}</span>
                    {o.keterangan && <span className={`text-[11px] ${o.kosong ? 'text-amber-600' : 'text-slate-500'} truncate max-w-[9rem]`} title={o.keterangan}>{o.keterangan}</span>}
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </div>
          {opsiDipilih?.kosong && (
            <p className="text-xs text-amber-700">{sasaran === 'siswa' ? 'Belum ada kelas tingkat ini pada tahun ajaran aktif' : 'Belum ada GTK jenis ini'}; template hanya berisi judul kolom.</p>
          )}
          <PratinjauKolom kolom={kolomTemplateCkg()} judul="Pratinjau kolom template (sama dengan tabel Data CKG)" pilihBagian />
          <p className="text-xs text-slate-500" data-testid="nama-berkas-template-ckg">
            {labelKelompokCkg(sasaran, pilihan)} · berkas <span className="font-mono">{namaBerkasTemplateCkg(sasaran, pilihan)}</span>
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Batal</Button>
          <Button onClick={unduh} disabled={loading} className="gap-2 bg-[#006837] hover:bg-[#005830]" data-testid="btn-unduh-template-ckg">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Unduh Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
