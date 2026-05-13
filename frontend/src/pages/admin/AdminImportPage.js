import React, { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  FileSpreadsheet, Download, Upload, CheckCircle2, AlertCircle,
  Users as UsersIcon, BookOpen, Building2, BookMarked, GraduationCap, Info,
} from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const ENTITIES = [
  {
    key: 'users', label: 'Pengguna', icon: UsersIcon,
    templateName: 'template_pengguna_matsandatama.xlsx',
    templateUrl: '/api/users/excel-template',
    importUrl: '/api/users/import-excel',
    description: 'Tambah Admin, Guru, Wali Kelas, Tendik, dll. (selain siswa).',
    fields: ['username*', 'password*', 'nama_lengkap*', 'roles* (pisah koma)', 'nip_nuptk', 'nisn', 'email', 'phone', 'gender (L/P)', 'kelas_siswa', 'wali_kelas'],
  },
  {
    key: 'students', label: 'Siswa', icon: GraduationCap,
    templateName: 'template_siswa_matsandatama.xlsx',
    templateUrl: '/api/students/excel-template',
    importUrl: '/api/students/import-excel',
    description: 'Khusus pendaftaran massal siswa (role siswa otomatis).',
    fields: ['username*', 'password*', 'nama_lengkap*', 'nisn*', 'gender (L/P)', 'kelas* (mis. 7A)', 'tempat_lahir', 'tgl_lahir (YYYY-MM-DD)', 'alamat', 'email', 'phone'],
  },
  {
    key: 'classes', label: 'Kelas', icon: BookOpen,
    templateName: 'template_kelas_matsandatama.xlsx',
    templateUrl: '/api/classes/excel-template',
    importUrl: '/api/classes/import-excel',
    description: 'Kelas dibuat di Tahun Pelajaran AKTIF.',
    fields: ['nama*', 'tingkat* (7/8/9)', 'paralel*', 'wali_kelas_username', 'ruang_kode', 'is_accelerated (ya/tidak)'],
  },
  {
    key: 'rooms', label: 'Ruangan', icon: Building2,
    templateName: 'template_ruangan_matsandatama.xlsx',
    templateUrl: '/api/rooms/excel-template',
    importUrl: '/api/rooms/import-excel',
    description: 'Ruangan kelas/lab dengan koordinat GPS opsional.',
    fields: ['kode*', 'deskripsi', 'lat', 'lon', 'radius_meter (default 30)', 'gps_aktif (ya/tidak)', 'qr_mode (static/dynamic)'],
  },
  {
    key: 'subjects', label: 'Mata Pelajaran', icon: BookMarked,
    templateName: 'template_mapel_matsandatama.xlsx',
    templateUrl: '/api/subjects/excel-template',
    importUrl: '/api/subjects/import-excel',
    description: 'Mata pelajaran dengan kode unik.',
    fields: ['kode*', 'nama*'],
  },
];

function ImportTab({ entity }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);
  const Icon = entity.icon;

  const downloadTemplate = async () => {
    try {
      const token = localStorage.getItem('matsa_token');
      const r = await fetch(`${BACKEND_URL}${entity.templateUrl}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error('Gagal unduh template');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = entity.templateName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Template diunduh');
    } catch (e) {
      toast.error(e.message || 'Gagal unduh template');
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      toast.error('Hanya file .xlsx yang didukung');
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const token = localStorage.getItem('matsa_token');
      const r = await fetch(`${BACKEND_URL}${entity.importUrl}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Gagal import');
      setResult({
        success: data.success || 0,
        errors: data.errors || [],
        total: data.total_rows || 0,
      });
      if (data.success > 0) {
        toast.success(`Berhasil import ${data.success} dari ${data.total_rows} baris`);
      } else if (data.errors?.length) {
        toast.warning(`Tidak ada data berhasil. ${data.errors.length} baris error.`);
      } else {
        toast.info('File kosong, tidak ada data diimport');
      }
    } catch (err) {
      toast.error(err.message || 'Gagal import');
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
              <h3 className="text-lg font-bold text-slate-900">Import {entity.label}</h3>
              <p className="text-sm text-slate-600 mt-1">{entity.description}</p>
            </div>
          </div>

          <Alert className="border-amber-200 bg-amber-50">
            <Info className="h-4 w-4 text-amber-700" />
            <AlertTitle className="text-amber-900">Langkah penggunaan</AlertTitle>
            <AlertDescription className="text-amber-900 text-sm">
              <ol className="list-decimal pl-5 space-y-1 mt-1">
                <li>Klik <strong>Unduh Template</strong>, buka di Excel/LibreOffice.</li>
                <li>Isi mulai baris ke-2 sesuai kolom. Kolom dengan tanda <strong>*</strong> wajib diisi.</li>
                <li>Simpan sebagai <code>.xlsx</code>, lalu klik <strong>Pilih File</strong> untuk upload.</li>
                <li>Tunggu hasil. Baris yang error tidak menggagalkan baris lain.</li>
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
            <Button onClick={downloadTemplate} variant="outline"
              className="h-12 gap-2 border-[#006837] text-[#006837] hover:bg-[#006837]/5"
              data-testid={`download-template-${entity.key}`}>
              <Download className="h-4 w-4" /> Unduh Template Excel
            </Button>
            <Button onClick={() => inputRef.current?.click()} disabled={busy}
              className="h-12 gap-2 bg-[#006837] hover:bg-[#0B7A3B]"
              data-testid={`upload-file-${entity.key}`}>
              <Upload className="h-4 w-4" /> {busy ? 'Mengunggah...' : 'Pilih File .xlsx'}
            </Button>
            <input ref={inputRef} type="file" accept=".xlsx,.xlsm" className="hidden" onChange={handleFile} />
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
                      {err}
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
          Tambah data dalam jumlah banyak sekaligus menggunakan file Excel (.xlsx)
        </p>
      </div>

      <Tabs defaultValue="users">
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
