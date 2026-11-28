import React, { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  FileSpreadsheet, Download, Upload, CheckCircle2, AlertCircle,
  Users as UsersIcon, GraduationCap, Info, DoorOpen, School, BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

const ENTITIES = [
  {
    key: 'gtk-combined',
    label: 'GTK (Data + Akun)',
    icon: UsersIcon,
    templateName: 'template_gtk_lengkap_matsandatama.xlsx',
    templateUrl: '/users/gtk-combined-template',
    importUrl: '/users/import-gtk-combined',
    description: 'Import GTK lengkap dengan data dan akun login sekaligus. Hasil data dan akun masuk ke /admin/users.',
    fields: ['nama_lengkap*', 'roles* (pisah koma)', 'nip_nuptk', 'email', 'phone', 'gender (L/P)', 'username*', 'password*'],
  },
  {
    key: 'students-combined',
    label: 'Siswa (Data + Akun)',
    icon: GraduationCap,
    templateName: 'template_siswa_lengkap_matsandatama.xlsx',
    templateUrl: '/students/combined-template',
    importUrl: '/students/import-combined',
    description: 'Import siswa lengkap dengan data dan akun login sekaligus. Hasil data dan akun masuk ke /admin/pengguna-siswa.',
    fields: ['nama_lengkap*', 'nisn*', 'gender (L/P)', 'kelas* (mis. 7A)', 'tempat_lahir', 'tgl_lahir (YYYY-MM-DD)', 'alamat', 'email', 'phone', 'username*', 'password*'],
  },
  {
    key: 'rooms',
    label: 'Ruangan',
    icon: DoorOpen,
    templateName: 'template_ruangan_matsandatama.xlsx',
    templateUrl: '/rooms/excel-template',
    importUrl: '/rooms/import-excel',
    description: 'Import data ruangan (kelas, lab, ruang guru, dll). Hasil data masuk ke /admin/rooms.',
    fields: ['kode*', 'deskripsi', 'lat', 'lon', 'radius_meter', 'gps_aktif (ya/tidak)', 'qr_mode (static/dynamic)'],
  },
  {
    key: 'classes',
    label: 'Kelas',
    icon: School,
    templateName: 'template_kelas_matsandatama.xlsx',
    templateUrl: '/classes/excel-template',
    importUrl: '/classes/import-excel',
    description: 'Import data kelas (7A, 7B, 8A, dll). Hasil data masuk ke /admin/classes.',
    fields: ['nama*', 'tingkat*', 'paralel*', 'wali_kelas_username', 'ruang_kode', 'is_accelerated (ya/tidak)'],
  },
  {
    key: 'subjects',
    label: 'Mata Pelajaran',
    icon: BookOpen,
    templateName: 'template_mapel_matsandatama.xlsx',
    templateUrl: '/subjects/excel-template',
    importUrl: '/subjects/import-excel',
    description: 'Import data mata pelajaran (Matematika, IPA, Bahasa Indonesia, dll). Hasil data masuk ke /admin/subjects.',
    fields: ['kode*', 'nama*'],
  },
];

const MAKS_UKURAN_MB = 10;

/** Pesan galat impor yang jelas untuk pengguna (bukan sekadar "Failed to fetch"). */
async function pesanGalatImpor(e, cadangan) {
  if (e?.bacaGagal) return e.message;
  const res = e?.response;
  if (!res) {
    if (e?.code === 'ECONNABORTED') return 'Server terlalu lama memproses berkas. Coba bagi berkas menjadi beberapa bagian lalu impor lagi.';
    return 'Tidak dapat terhubung ke server (koneksi terputus). Bila internet Anda normal, kemungkinan unggahan diblokir Cloudflare/firewall server — rinciannya tercatat di menu Log Aktivitas > Errors.';
  }
  let data = res.data;
  if (data instanceof Blob) {
    try { data = JSON.parse(await data.text()); } catch { data = null; }
  }
  const d = data?.detail;
  if (typeof d === 'string' && d) return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg).filter(Boolean).join('; ') || cadangan;
  if (res.status === 413) return `Ukuran berkas terlalu besar untuk server. Hapus sheet/gambar yang tidak perlu (maks. ${MAKS_UKURAN_MB} MB).`;
  if (res.status === 401 || res.status === 403) return 'Sesi login berakhir atau tidak berwenang. Silakan login ulang sebagai admin.';
  if (res.status >= 500) return `Server mengalami gangguan (kode ${res.status}). Coba lagi beberapa saat lagi.`;
  return `${cadangan} (kode ${res.status})`;
}

/** ArrayBuffer -> base64 (bertahap agar tidak melampaui batas argumen fungsi). */
function keBase64(buf) {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return window.btoa(s);
}

/**
 * Kirim berkas impor. Berkas dibaca ke memori lebih dulu: Chrome Android kadang membatalkan unggahan berkas yang
 * dipilih dari WhatsApp/Drive/folder tersinkron saat isinya dibaca ulang ("Network Error" tanpa pernah terkirim).
 * Bila unggahan multipart tetap terputus tanpa jawaban server, diulang sekali lewat jalur cadangan JSON base64.
 * Mengembalikan { data, cadangan }.
 */
async function kirimBerkasImpor(entity, file) {
  let isi;
  try {
    isi = await file.arrayBuffer();
  } catch {
    const e = new Error('Berkas tidak dapat dibaca dari perangkat. Simpan/unduh dulu berkas ke penyimpanan HP (mis. folder Download), lalu pilih lagi.');
    e.bacaGagal = true;
    throw e;
  }
  const blob = new Blob([isi], { type: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  try {
    const fd = new FormData();
    fd.append('file', blob, file.name);
    // Header multipart wajib: klien api bawaan memakai JSON sehingga FormData bisa terkirim sebagai JSON.
    const { data } = await api.post(entity.importUrl, fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 300000 });
    return { data, cadangan: false };
  } catch (e) {
    if (e?.response || e?.code === 'ECONNABORTED' || e?.code === 'ERR_CANCELED') throw e;
    const { data } = await api.post(`/impor-excel/${entity.key}/json`, { nama_berkas: file.name, isi_base64: keBase64(isi) }, { timeout: 300000 });
    return { data, cadangan: true };
  }
}

function normalizeSuccessCount(success) {
  if (Array.isArray(success)) return success.length;
  return Number(success || 0);
}

function ImportTab({ entity }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);
  const Icon = entity.icon;

  const downloadTemplate = async () => {
    try {
      const { data: blob } = await api.get(entity.templateUrl, { responseType: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = entity.templateName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('Template diunduh');
    } catch (e) {
      toast.error(await pesanGalatImpor(e, 'Gagal mengunduh template'));
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xlsm')) {
      toast.error('Hanya file .xlsx/.xlsm yang didukung');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    if (file.size > MAKS_UKURAN_MB * 1024 * 1024) {
      toast.error(`Ukuran berkas maksimal ${MAKS_UKURAN_MB} MB. Hapus sheet/gambar yang tidak perlu lalu simpan ulang.`);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setBusy(true);
    setResult(null);
    try {
      const { data, cadangan } = await kirimBerkasImpor(entity, file);
      if (cadangan) toast.info('Unggahan biasa terputus, berkas dikirim lewat jalur cadangan.');

      const errors = data.errors || [];
      const total = data.total_rows || 0;
      const success = normalizeSuccessCount(data.success);

      setResult({ success, errors, total });

      if (success > 0) {
        toast.success(`Berhasil import ${success} dari ${total} baris`);
      } else if (errors.length) {
        toast.warning(`Tidak ada data berhasil. ${errors.length} baris error.`);
      } else {
        toast.info('File kosong, tidak ada data diimport');
      }
    } catch (err) {
      toast.error(await pesanGalatImpor(err, 'Gagal import'), { duration: 8000 });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4" data-testid={`import-tab-${entity.key}`}>
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-[#006837]/10 flex items-center justify-center shrink-0">
              <Icon className="h-6 w-6 text-[#006837]" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-900">{entity.label}</h3>
              <p className="text-sm text-slate-600 mt-1">{entity.description}</p>
            </div>
          </div>

          <Alert className="border-amber-200 bg-amber-50">
            <Info className="h-4 w-4 text-amber-700" />
            <AlertTitle className="text-amber-900">Langkah penggunaan</AlertTitle>
            <AlertDescription className="text-amber-900 text-sm">
              <ol className="list-decimal pl-5 space-y-1 mt-1">
                <li>Klik <strong>Unduh Template</strong>, buka di Excel/LibreOffice.</li>
                <li>Isi mulai baris ke-2 sesuai kolom. Kolom bertanda <strong>*</strong> wajib diisi.</li>
                <li>Simpan sebagai <code>.xlsx</code> atau <code>.xlsm</code>, lalu klik <strong>Pilih File</strong>.</li>
                <li>Tunggu hasil. Baris error tidak menggagalkan baris lain.</li>
              </ol>
            </AlertDescription>
          </Alert>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Kolom yang dibutuhkan</div>
            <div className="flex flex-wrap gap-1.5">
              {entity.fields.map((f) => (
                <Badge key={f} variant="secondary" className="text-xs font-mono bg-white border border-slate-200">
                  {f}
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              onClick={downloadTemplate}
              variant="outline"
              className="h-12 gap-2 border-[#006837] text-[#006837] hover:bg-[#006837]/5"
              data-testid={`download-template-${entity.key}`}
            >
              <Download className="h-4 w-4" /> Unduh Template Excel
            </Button>
            <Button
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="h-12 gap-2 bg-[#006837] hover:bg-[#0B7A3B]"
              data-testid={`upload-file-${entity.key}`}
            >
              <Upload className="h-4 w-4" /> {busy ? 'Mengunggah...' : 'Pilih File .xlsx'}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xlsm"
              className="hidden"
              onChange={handleFile}
            />
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card data-testid={`import-result-${entity.key}`}>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              {result.success > 0 ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-600" />
              )}
              <h3 className="font-bold text-slate-900">Hasil Import</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-center">
                <div className="text-2xl font-bold text-slate-900">{result.total}</div>
                <div className="text-xs text-slate-600 uppercase tracking-wide">Total Baris</div>
              </div>
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center">
                <div className="text-2xl font-bold text-emerald-700">{result.success}</div>
                <div className="text-xs text-emerald-700 uppercase tracking-wide">Berhasil</div>
              </div>
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-center">
                <div className="text-2xl font-bold text-rose-700">{result.errors.length}</div>
                <div className="text-xs text-rose-700 uppercase tracking-wide">Error</div>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Detail Error</div>
                <div className="max-h-64 overflow-y-auto space-y-1 rounded-lg border border-rose-200 bg-rose-50/50 p-3">
                  {result.errors.map((err, i) => (
                    <div key={i} className="text-xs text-rose-900 font-mono py-1 border-b border-rose-100 last:border-0" data-testid={`import-error-${i}`}>
                      {typeof err === 'string' ? err : (err?.row ? `Baris ${err.row}: ${err.error || ''}` : JSON.stringify(err))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AdminImportPage() {
  return (
    <div className="space-y-6" data-testid="admin-import-page">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <FileSpreadsheet className="h-3 w-3 mr-1" /> Import Data Massal
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Import Data via Excel</h1>
        <p className="text-sm text-slate-600 mt-1">
          Import data lengkap dengan akun login sekaligus untuk GTK, Siswa, Ruangan, Kelas, dan Mata Pelajaran
        </p>
      </div>

      <Tabs defaultValue="gtk-combined">
        <div className="overflow-x-auto">
          <TabsList className="bg-white border border-slate-200 inline-flex w-auto min-w-full" data-testid="import-entity-tabs">
            {ENTITIES.map((e) => (
              <TabsTrigger key={e.key} value={e.key} data-testid={`import-tab-trigger-${e.key}`} className="gap-2 whitespace-nowrap">
                <e.icon className="h-3.5 w-3.5" />
                {e.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {ENTITIES.map((e) => (
          <TabsContent key={e.key} value={e.key} className="mt-5">
            <ImportTab entity={e} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
