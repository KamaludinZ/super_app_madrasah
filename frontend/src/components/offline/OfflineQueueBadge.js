/**
 * Offline Queue Badge
 *
 * Shows a badge with the number of pending journal submissions
 * Provides quick access to manual sync and queue status
 */

import React, { useState, useEffect } from 'react';
import { Upload, Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { getSyncStatus } from '@/lib/syncManager';
import { manualSync } from '@/lib/syncManager';
import { toast } from 'sonner';

export function OfflineQueueBadge() {
  const [status, setStatus] = useState({
    pending: 0,
    syncing: 0,
    synced: 0,
    failed: 0,
    isOnline: true,
    canSync: false,
  });
  const [syncing, setSyncing] = useState(false);
  const [open, setOpen] = useState(false);

  const loadStatus = async () => {
    const syncStatus = await getSyncStatus();
    setStatus(syncStatus);
  };

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 5000); // Update every 5s
    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    if (!status.isOnline) {
      toast.error('Tidak ada koneksi internet');
      return;
    }

    setSyncing(true);
    try {
      const results = await manualSync((current, total) => {
        // Progress callback
        console.log(`Syncing: ${current}/${total}`);
      });

      await loadStatus(); // Refresh status

      if (results.synced > 0) {
        toast.success(`${results.synced} jurnal berhasil disinkronkan`);
      }

      if (results.failed > 0) {
        toast.error(`${results.failed} jurnal gagal disinkronkan`);
      }

      if (results.synced === 0 && results.failed === 0) {
        toast.info('Tidak ada jurnal yang perlu disinkronkan');
      }
    } catch (error) {
      toast.error(error.message || 'Gagal melakukan sinkronisasi');
      await loadStatus();
    } finally {
      setSyncing(false);
    }
  };

  // Don't show if no pending items
  if (status.pending === 0 && status.syncing === 0 && status.failed === 0) {
    return null;
  }

  const totalPending = status.pending + status.syncing;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 relative"
          data-testid="offline-queue-badge"
        >
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">Antrean Offline</span>
          {totalPending > 0 && (
            <Badge className="bg-amber-500 text-white border-0 h-5 min-w-5 px-1.5">
              {totalPending}
            </Badge>
          )}
          {status.failed > 0 && (
            <div className="absolute -top-1 -right-1 h-3 w-3 bg-rose-500 rounded-full border-2 border-white" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-slate-900 mb-1">Status Antrean Offline</h3>
            <p className="text-xs text-slate-600">
              Jurnal yang menunggu untuk disinkronkan ke server
            </p>
          </div>

          {/* Status Cards */}
          <div className="space-y-2">
            {status.pending > 0 && (
              <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-900">Menunggu Upload</span>
                </div>
                <Badge className="bg-amber-500 text-white border-0">
                  {status.pending}
                </Badge>
              </div>
            )}

            {status.syncing > 0 && (
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                  <span className="text-sm font-medium text-blue-900">Sedang Sync</span>
                </div>
                <Badge className="bg-blue-500 text-white border-0">
                  {status.syncing}
                </Badge>
              </div>
            )}

            {status.synced > 0 && (
              <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-900">Berhasil</span>
                </div>
                <Badge className="bg-emerald-500 text-white border-0">
                  {status.synced}
                </Badge>
              </div>
            )}

            {status.failed > 0 && (
              <div className="flex items-center justify-between p-3 bg-rose-50 border border-rose-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-rose-600" />
                  <span className="text-sm font-medium text-rose-900">Gagal</span>
                </div>
                <Badge className="bg-rose-500 text-white border-0">
                  {status.failed}
                </Badge>
              </div>
            )}
          </div>

          {/* Connection Status */}
          <div className={`flex items-center gap-2 text-xs ${
            status.isOnline ? 'text-emerald-600' : 'text-rose-600'
          }`}>
            <div className={`h-2 w-2 rounded-full ${
              status.isOnline ? 'bg-emerald-500' : 'bg-rose-500'
            }`} />
            {status.isOnline ? 'Online' : 'Offline'}
          </div>

          {/* Manual Sync Button */}
          {status.canSync && (
            <Button
              onClick={handleManualSync}
              disabled={syncing}
              className="w-full bg-[#006837] hover:bg-[#0B7A3B] gap-2"
              data-testid="manual-sync-button"
            >
              {syncing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyinkronkan...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Sinkronkan Sekarang
                </>
              )}
            </Button>
          )}

          {!status.isOnline && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-800">
                Tidak ada koneksi internet. Jurnal akan otomatis disinkronkan saat online kembali.
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default OfflineQueueBadge;
