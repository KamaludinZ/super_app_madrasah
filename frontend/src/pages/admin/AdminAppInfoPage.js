import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Info, RefreshCw, CheckCircle2, AlertCircle, Database, Server,
  Calendar, Package, Loader2, ExternalLink, Shield, Zap, Github, Link2
} from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function AdminAppInfoPage() {
  const [appInfo, setAppInfo] = useState(null);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [info, health] = await Promise.all([
        api.get('/app-info'),
        api.get('/app-info/system-health')
      ]);
      setAppInfo(info.data);
      setSystemHealth(health.data);
    } catch (e) {
      toast.error('Gagal memuat info aplikasi');
    } finally {
      setLoading(false);
    }
  };

  const testGithubConnection = async () => {
    setTestingConnection(true);
    try {
      const { data } = await api.get('/app-info/check-update');

      // Set connection status based on response
      if (data.github_configured === false) {
        setConnectionStatus({
          status: 'not-configured',
          message: 'GitHub repository belum dikonfigurasi',
          details: data.message
        });
        toast.warning('GitHub belum dikonfigurasi');
      } else if (data.error) {
        setConnectionStatus({
          status: 'error',
          message: 'Koneksi gagal',
          details: data.message || data.error,
          error: data.error
        });
        toast.error('Koneksi ke GitHub gagal');
      } else {
        setConnectionStatus({
          status: 'connected',
          message: 'Koneksi berhasil',
          details: `Repository terhubung: KamaludinZ/super_app_madrasah`,
          latest_version: data.latest_version
        });
        toast.success('Koneksi ke GitHub berhasil!');
      }
    } catch (e) {
      setConnectionStatus({
        status: 'error',
        message: 'Koneksi gagal',
        details: e.response?.data?.message || 'Tidak dapat terhubung ke server',
        error: e.message
      });
      toast.error('Gagal menghubungi server');
    } finally {
      setTestingConnection(false);
    }
  };

  const checkForUpdates = async () => {
    setChecking(true);
    try {
      const { data } = await api.get('/app-info/check-update');
      setUpdateInfo(data);

      if (data.has_update) {
        toast.success(`Update tersedia: v${data.latest_version}`, {
          duration: 5000
        });
      } else if (data.error) {
        toast.error(data.message || 'Gagal memeriksa update');
      } else if (data.github_configured === false) {
        toast.warning('GitHub belum dikonfigurasi');
      } else {
        toast.info('Aplikasi sudah up-to-date');
      }
    } catch (e) {
      toast.error('Gagal memeriksa update');
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-[#006837]" />
          <p className="text-slate-600">Memuat informasi aplikasi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <Info className="h-3 w-3 mr-1" /> Informasi Aplikasi
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Info & Update Aplikasi</h1>
        <p className="text-sm text-slate-600 mt-1">
          Informasi lengkap tentang versi, fitur, dan pembaruan aplikasi
        </p>
      </div>

      {/* App Info Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">{appInfo?.app_name}</h2>
              <p className="text-sm text-slate-600">{appInfo?.description}</p>
            </div>
            <Badge className="bg-[#006837] text-white text-lg px-4 py-2">
              v{appInfo?.current_version}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <Calendar className="h-5 w-5 text-[#006837]" />
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase">Tanggal Rilis</p>
                <p className="text-sm font-medium">{appInfo?.release_date}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <Package className="h-5 w-5 text-[#006837]" />
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase">Environment</p>
                <p className="text-sm font-medium capitalize">{appInfo?.environment}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <Shield className="h-5 w-5 text-[#006837]" />
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase">Python Version</p>
                <p className="text-sm font-medium">{appInfo?.python_version}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <Database className="h-5 w-5 text-[#006837]" />
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase">Database</p>
                <p className="text-sm font-medium">{appInfo?.database}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-600" />
              Fitur Utama
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {appInfo?.features?.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Health Card */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Server className="h-5 w-5 text-[#006837]" />
            Kesehatan Sistem
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-[#006837]" />
                <div>
                  <p className="text-sm font-medium">Status Database</p>
                  <p className="text-xs text-slate-500">{systemHealth?.database?.message}</p>
                </div>
              </div>
              {systemHealth?.database?.status === 'healthy' ? (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Healthy
                </Badge>
              ) : (
                <Badge className="bg-rose-100 text-rose-800 border-rose-300">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Unhealthy
                </Badge>
              )}
            </div>

            {systemHealth?.database?.collections && (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-600 font-semibold uppercase">Collections</p>
                  <p className="text-2xl font-bold text-blue-900">{systemHealth.database.collections}</p>
                </div>
                {systemHealth?.database?.size_bytes && (
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="text-xs text-purple-600 font-semibold uppercase">Database Size</p>
                    <p className="text-2xl font-bold text-purple-900">
                      {(systemHealth.database.size_bytes / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* GitHub Configuration Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Github className="h-5 w-5 text-[#006837]" />
              Konfigurasi GitHub
            </h3>
            <Button
              onClick={testGithubConnection}
              disabled={testingConnection}
              variant="outline"
              className="gap-2"
            >
              {testingConnection ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4" />
                  Test Koneksi
                </>
              )}
            </Button>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Github className="h-4 w-4 text-slate-600" />
                <p className="text-sm font-medium text-slate-700">Repository GitHub</p>
              </div>
              <p className="text-sm text-slate-900 font-mono bg-white px-3 py-2 rounded border">
                KamaludinZ/super_app_madrasah
              </p>
              <a
                href="https://github.com/KamaludinZ/super_app_madrasah"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-2"
              >
                <ExternalLink className="h-3 w-3" />
                Buka di GitHub
              </a>
            </div>

            {connectionStatus && (
              <div className={`p-4 rounded-lg border ${
                connectionStatus.status === 'connected'
                  ? 'bg-emerald-50 border-emerald-200'
                  : connectionStatus.status === 'not-configured'
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-rose-50 border-rose-200'
              }`}>
                <div className="flex items-start gap-3">
                  {connectionStatus.status === 'connected' ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  ) : connectionStatus.status === 'not-configured' ? (
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-rose-600 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <h4 className={`font-semibold mb-1 ${
                      connectionStatus.status === 'connected'
                        ? 'text-emerald-900'
                        : connectionStatus.status === 'not-configured'
                        ? 'text-amber-900'
                        : 'text-rose-900'
                    }`}>
                      {connectionStatus.message}
                    </h4>
                    <p className={`text-sm ${
                      connectionStatus.status === 'connected'
                        ? 'text-emerald-700'
                        : connectionStatus.status === 'not-configured'
                        ? 'text-amber-700'
                        : 'text-rose-700'
                    }`}>
                      {connectionStatus.details}
                    </p>
                    {connectionStatus.latest_version && (
                      <p className="text-xs text-emerald-600 mt-2">
                        Latest release: v{connectionStatus.latest_version}
                      </p>
                    )}
                    {connectionStatus.error && (
                      <p className="text-xs text-rose-600 mt-2 font-mono">
                        Error: {connectionStatus.error}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-700">
                  <p className="font-semibold mb-1">Cara Kerja Auto-Update:</p>
                  <ul className="list-disc list-inside space-y-1 ml-1">
                    <li>Sistem akan mengecek GitHub Releases untuk versi terbaru</li>
                    <li>Jika ada update, Anda akan diberitahu dengan release notes</li>
                    <li>Download manual dari GitHub untuk update</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Update Check Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-[#006837]" />
              Pembaruan Aplikasi
            </h3>
            <Button
              onClick={checkForUpdates}
              disabled={checking}
              className="bg-[#006837] hover:bg-[#0B7A3B] gap-2"
            >
              {checking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memeriksa...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Cek Update
                </>
              )}
            </Button>
          </div>

          {updateInfo ? (
            <div className="space-y-4">
              {updateInfo.has_update ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-amber-900 mb-1">
                        Update Tersedia: v{updateInfo.latest_version}
                      </h4>
                      <p className="text-sm text-amber-700 mb-3">
                        Versi baru tersedia. Silakan download dan install untuk mendapatkan fitur terbaru.
                      </p>
                      {updateInfo.release_notes && (
                        <div className="bg-white p-3 rounded border border-amber-200 mb-3">
                          <p className="text-xs font-semibold text-slate-600 mb-2">Release Notes:</p>
                          <div className="text-sm text-slate-700 whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {updateInfo.release_notes}
                          </div>
                        </div>
                      )}
                      {updateInfo.download_url && (
                        <Button
                          onClick={() => window.open(updateInfo.download_url, '_blank')}
                          className="bg-amber-600 hover:bg-amber-700 gap-2"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Download Update
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ) : updateInfo.error ? (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-rose-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-rose-900 mb-1">Gagal Memeriksa Update</h4>
                      <p className="text-sm text-rose-700 mb-2">
                        {updateInfo.message}
                      </p>
                      {updateInfo.error && (
                        <p className="text-xs text-rose-600 font-mono mt-2">
                          Error: {updateInfo.error}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : updateInfo.github_configured === false ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-amber-900 mb-1">GitHub Belum Dikonfigurasi</h4>
                      <p className="text-sm text-amber-700">
                        {updateInfo.message}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <div>
                      <h4 className="font-semibold text-emerald-900">Aplikasi Up-to-date</h4>
                      <p className="text-sm text-emerald-700">
                        Anda menggunakan versi terbaru (v{updateInfo.current_version})
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {updateInfo.message && !updateInfo.error && updateInfo.github_configured !== false && !updateInfo.has_update && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">{updateInfo.message}</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Terakhir dicek: {new Date(updateInfo.checked_at).toLocaleString('id-ID')}
                </p>
                {updateInfo.github_configured && (
                  <Badge variant="outline" className="text-xs">
                    {updateInfo.error ? (
                      <span className="text-rose-600">Koneksi Error</span>
                    ) : (
                      <span className="text-emerald-600">Terhubung ke GitHub</span>
                    )}
                  </Badge>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <RefreshCw className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="text-sm">Klik "Cek Update" untuk memeriksa versi terbaru</p>
              <p className="text-xs mt-2">Pastikan sudah test koneksi GitHub terlebih dahulu</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
