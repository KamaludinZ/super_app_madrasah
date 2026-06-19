import React, { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  FileSpreadsheet, Download, Upload, CheckCircle2, AlertCircle,
  Users as UsersIcon, GraduationCap, Info, KeyRound,
} from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const ENTITIES = [
  {
    key: 'gtk-initial',
    label: 'Data Awal GTK',
    icon: UsersIcon,
    templateName: 'template_data_awal_gtk_matsandatama.xlsx',
    templateUrl: '/api/users/gtk-initial-template',
    importUrl: '/api/users/import-gtk-initial',
    description: 'Import data awal GTK tanpa username/password. Hasil data masuk ke data GTK (master pengguna non-siswa).',
    fields: ['nama_lengkap*', 'roles* (pisah koma)', 'nip_nuptk', 'email', 'phone', 'gender (L/P)'],
  },
  {
    key: 'students-initial',
    label: 'Data Awal Siswa',
    icon: GraduationCap,
    templateName: 'template_data_awal_siswa_matsandatama.xlsx',
    templateUrl: '/api/students/initial-template',
    importUrl: '/api/students/import-initial',
    description: 'Import data awal siswa tanpa username/password. Hasil data masuk ke data siswa master.',
    fields: ['nama_lengkap*', 'nisn*', 'gender (L/P)', 'kelas* (mis. 7A)', 'tempat_lahir', 'tgl_lahir (YYYY-MM-DD)', 'alamat', 'email', 'phone'],
  },
  {
    key: 'gtk-account-bulk',
    label: 'Akun Massal GTK',
    icon: KeyRound,
    templateName: 'template_pengguna_matsandatama.xlsx',
    templateUrl: '/api/users/excel-template',
    importUrl: '/api/users/import-excel',
    description: 'Buat akun login massal untuk GTK (guru/tendik/wali kelas/dll). Hasil akun masuk ke /admin/users.',
    fields: ['username*', 'password*', 'nama_lengkap*', 'roles*', 'nip_nuptk', 'email', 'phone', 'gender (L/P)'],
  },
  {
    key: 'students-account-bulk',
    label: 'Akun Massal Siswa',
    icon: KeyRound,
    templateName: 'template_akun_siswa_belum_punya_akun.xlsx',
    templateUrl: '/api/students/bulk-account-template',
    importUrl: '/api/students/import-bulk-accounts',
    description: 'Buat akun login siswa dari daftar siswa yang belum punya akun. Hasil akun masuk ke /admin/pengguna-siswa.',
    fields: ['id*', 'nama_lengkap', 'nisn', 'username*', 'password*'],
  },
];

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
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xlsm')) {
      toast.error('Hanya file .xlsx/.xlsm yang didukung');
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
                      {typeof err === 'string' ? err : JSON.stringify(err)}
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
          Alur dipisah: data awal (tanpa akun) dan pembuatan akun massal (dengan username/password)
        </p>
      </div>

      <Tabs defaultValue="gtk-initial">
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
