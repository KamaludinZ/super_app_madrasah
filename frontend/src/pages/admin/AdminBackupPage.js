import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Database, Download, Upload, Loader2, ShieldAlert, History,
  CheckCircle2, FileJson, HardDrive, Clock, Info, FileSpreadsheet,
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function AdminBackupPage() {
  const [info, setInfo] = useState(null);
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const [restoreMode, setRestoreMode] = useState('merge');
  const [restoreResult, setRestoreResult] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const inputRef = useRef(null);

  const refresh = async () => {
    try {
      const [i, l] = await Promise.all([
        api.get('/admin/backup/info'),
        api.get('/admin/backup/logs'),
      ]);
      setInfo(i.data);
      setLogs(l.data || []);
    } catch (e) { /* */ }
  };

  useEffect(() => { refresh(); }, []);

  const handleDownload = async () => {
    setBusy(true);
    try {
      const token = localStorage.getItem('matsa_token');
      const r = await fetch(`${BACKEND_URL}/api/admin/backup/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error('Gagal');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.download = `backup_matsandatama_${ts}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup berhasil diunduh');
      await refresh();
    } catch (e) {
      toast.error('Gagal export backup');
    } finally {
      setBusy(false);
    }
  };

  const doExcelExport = async (kind) => {
    setBusy(true);
    try {
      const token = localStorage.getItem('matsa_token');
      const r = await fetch(`${BACKEND_URL}/api/admin/export/${kind}-excel`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error('Gagal');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.download = `export_${kind}_${ts}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Export ${kind} berhasil diunduh`);
    } catch (e) {
      toast.error(`Gagal export ${kind}`);
    } finally {
      setBusy(false);
    }
  };

  const onFileSelected = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.json')) {
      toast.error('Hanya file .json yang didukung');
      return;
    }
    setRestoreFile(f);
    setRestoreOpen(true);
    setConfirmText('');
    setRestoreResult(null);
  };

  const doRestore = async () => {
    if (restoreMode === 'replace' && confirmText !== 'GANTI SEMUA') {
      toast.error('Ketik "GANTI SEMUA" untuk konfirmasi mode REPLACE');
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', restoreFile);
      fd.append('mode', restoreMode);
      const token = localStorage.getItem('matsa_token');
      const r = await fetch(`${BACKEND_URL}/api/admin/backup/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Gagal');
      setRestoreResult(data);
      const total = Object.values(data.restored || {}).reduce((a, b) => a + b, 0);
      toast.success(`Restore selesai: ${total} dokumen`);
      await refresh();
    } catch (e) {
      toast.error(e.message || 'Gagal restore');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-backup-page">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <Database className="h-3 w-3 mr-1" /> Backup & Restore
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Cadangan Database</h1>
        <p className="text-sm text-slate-600 mt-1">
          Backup data ke file JSON & pulihkan kapan saja. Backup termasuk sertifikat prestasi & file lain (base64 embed).
        </p>
      </div>

      {/* Statistik database */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-[#006837]" />
            <h2 className="text-base font-semibold">Statistik Database</h2>
            <Badge variant="outline" className="ml-auto">{info?.total_documents ?? '-'} total dokumen</Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
            {info && Object.entries(info.collections).map(([coll, count]) => (
              <div key={coll} className="rounded-lg border border-slate-200 bg-white p-2.5" data-testid={`coll-${coll}`}>
                <div className="font-bold tabular-nums text-slate-900 text-base">{count}</div>
                <div className="text-[10px] text-slate-500 truncate uppercase tracking-wide">{coll}</div>
              </div>
            ))}
            {!info && <div className="col-span-full text-center py-4 text-slate-500">Memuat...</div>}
          </div>
        </CardContent>
      </Card>

      {/* Export */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <Download className="h-5 w-5 text-emerald-700" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold">Backup (Export)</h2>
              <p className="text-xs text-slate-600 mt-1">Unduh seluruh data sebagai 1 file .json. Simpan di tempat aman (Google Drive, USB, dll)</p>
            </div>
          </div>
          <Alert className="border-blue-200 bg-blue-50">
            <Info className="h-4 w-4 text-blue-700" />
            <AlertDescription className="text-blue-900 text-sm">
              File backup termasuk: pengguna (tanpa password plaintext), kelas, jadwal, jurnal, prestasi (dgn foto sertifikat), nilai, ekstrakurikuler, audit log, dan semua koleksi lain.
            </AlertDescription>
          </Alert>
          <Button onClick={handleDownload} disabled={busy}
            className="bg-[#006837] hover:bg-[#0B7A3B] gap-2 h-11" data-testid="backup-download-button">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {busy ? 'Memproses...' : 'Unduh Backup (.json)'}
          </Button>
        </CardContent>
      </Card>

      {/* Restore */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <Upload className="h-5 w-5 text-amber-700" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold">Restore (Import)</h2>
              <p className="text-xs text-slate-600 mt-1">Pulihkan data dari file backup. Mode "Gabung" lebih aman (default).</p>
            </div>
          </div>
          <Alert className="border-rose-200 bg-rose-50">
            <ShieldAlert className="h-4 w-4 text-rose-700" />
            <AlertDescription className="text-rose-900 text-sm">
              <strong>Peringatan:</strong> Restore akan menambahkan/mengganti data berdasarkan ID. Mode <strong>REPLACE</strong> akan <strong>menghapus semua</strong> data sebelumnya — gunakan dengan sangat hati-hati.
            </AlertDescription>
          </Alert>
          <Button onClick={() => inputRef.current?.click()} disabled={busy}
            variant="outline"
            className="border-[#006837] text-[#006837] hover:bg-[#006837]/5 gap-2 h-11"
            data-testid="backup-restore-button">
            <Upload className="h-4 w-4" /> Pilih File Backup (.json)
          </Button>
          <input ref={inputRef} type="file" accept=".json" className="hidden" onChange={onFileSelected} />
        </CardContent>
      </Card>

      {/* Excel Exports */}
      <Card data-testid="excel-export-card">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-700" />
            <h2 className="text-base font-semibold">Export Data ke Excel</h2>
            <Badge variant="outline" className="ml-auto text-xs">Untuk laporan</Badge>
          </div>
          <p className="text-sm text-slate-600">
            Download snapshot data dalam format .xlsx — siap untuk laporan ke Kemenag/Dapodik atau diolah lebih lanjut.
            Berbeda dengan backup JSON, file Excel ini tidak bisa di-restore tetapi sangat mudah dibaca.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {[
              { kind: 'users', label: 'Pengguna', desc: 'Semua akun + roles', testid: 'excel-export-users' },
              { kind: 'students', label: 'Siswa', desc: 'Data siswa + kelas', testid: 'excel-export-students' },
              { kind: 'schedules', label: 'Jadwal', desc: 'Jadwal mingguan', testid: 'excel-export-schedules' },
              { kind: 'grades', label: 'Nilai', desc: 'Rekap nilai E-Rapor', testid: 'excel-export-grades' },
            ].map((e) => (
              <Button
                key={e.kind}
                variant="outline"
                disabled={busy}
                onClick={() => doExcelExport(e.kind)}
                data-testid={e.testid}
                className="h-auto flex-col items-start py-3 gap-1 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-400"
              >
                <div className="flex items-center gap-1.5 w-full">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
                  <span className="font-semibold text-sm">{e.label}</span>
                  <Download className="h-3 w-3 ml-auto opacity-50" />
                </div>
                <span className="text-[10px] text-slate-500 normal-case font-normal">{e.desc}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Backup logs */}
      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b border-slate-100 flex items-center gap-2">
            <History className="h-4 w-4 text-slate-500" />
            <h2 className="font-semibold">Riwayat Backup</h2>
            <Badge variant="outline" className="ml-auto">{logs.length}</Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Aksi</TableHead>
                <TableHead>Oleh</TableHead>
                <TableHead className="text-right">Total Dokumen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-xs">
                    {l.created_at ? new Date(l.created_at).toLocaleString('id-ID') : '-'}
                  </TableCell>
                  <TableCell>
                    {l.type === 'export' ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
                        <Download className="h-3 w-3" /> Export
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1">
                        <Upload className="h-3 w-3" /> {l.type === 'import_replace' ? 'Replace' : 'Merge'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{l.user_name || '-'}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{l.total_documents || 0}</TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-500">
                  <Clock className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                  Belum ada riwayat backup
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Restore dialog */}
      <Dialog open={restoreOpen} onOpenChange={(o) => { setRestoreOpen(o); if (!o) { setRestoreFile(null); setRestoreResult(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Konfirmasi Restore Database</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {restoreFile && (
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-2">
                <FileJson className="h-5 w-5 text-slate-600" />
                <div className="flex-1">
                  <div className="font-semibold text-sm">{restoreFile.name}</div>
                  <div className="text-xs text-slate-500">{(restoreFile.size / 1024).toFixed(1)} KB</div>
                </div>
              </div>
            )}
            {!restoreResult && (
              <>
                <div>
                  <Label className="text-sm font-semibold">Mode Restore</Label>
                  <RadioGroup value={restoreMode} onValueChange={setRestoreMode} className="mt-2 space-y-2">
                    <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <RadioGroupItem value="merge" data-testid="mode-merge" className="mt-0.5" />
                      <div>
                        <div className="font-semibold text-sm">Gabung (Recommended)</div>
                        <div className="text-xs text-slate-600">Tambah/update data berdasarkan ID. Data lain tidak diubah.</div>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 p-3 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100/50 cursor-pointer">
                      <RadioGroupItem value="replace" data-testid="mode-replace" className="mt-0.5" />
                      <div>
                        <div className="font-semibold text-sm text-rose-700">Ganti Total (DESTRUCTIVE)</div>
                        <div className="text-xs text-rose-700">Hapus semua data lalu insert dari file. Tidak bisa dibatalkan!</div>
                      </div>
                    </label>
                  </RadioGroup>
                </div>
                {restoreMode === 'replace' && (
                  <div>
                    <Label className="text-sm text-rose-700">Ketik "GANTI SEMUA" untuk konfirmasi:</Label>
                    <input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
                      className="mt-1 w-full px-3 py-2 border border-rose-300 rounded-md font-mono uppercase"
                      data-testid="confirm-text-input" />
                  </div>
                )}
              </>
            )}
            {restoreResult && (
              <div className="space-y-2">
                <Alert className="border-emerald-200 bg-emerald-50">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                  <AlertTitle className="text-emerald-900">Restore Berhasil</AlertTitle>
                  <AlertDescription className="text-emerald-900">
                    Total: {Object.values(restoreResult.restored || {}).reduce((a, b) => a + b, 0)} dokumen
                  </AlertDescription>
                </Alert>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {Object.entries(restoreResult.restored || {}).map(([coll, c]) => (
                    <div key={coll} className="flex items-center justify-between p-2 rounded bg-slate-50 text-xs">
                      <span className="font-mono">{coll}</span>
                      <span className="font-bold">{c} doc</span>
                    </div>
                  ))}
                </div>
                {(restoreResult.errors || []).length > 0 && (
                  <Alert className="border-rose-200 bg-rose-50">
                    <ShieldAlert className="h-4 w-4 text-rose-700" />
                    <AlertDescription className="text-rose-900 text-xs">
                      {restoreResult.errors.length} error: {restoreResult.errors.slice(0, 3).join('; ')}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreOpen(false)}>{restoreResult ? 'Tutup' : 'Batal'}</Button>
            {!restoreResult && (
              <Button onClick={doRestore} disabled={busy} className={restoreMode === 'replace' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#006837] hover:bg-[#0B7A3B]'} data-testid="confirm-restore-button">
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {restoreMode === 'replace' ? 'GANTI SEMUA DATA' : 'Restore (Gabung)'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
