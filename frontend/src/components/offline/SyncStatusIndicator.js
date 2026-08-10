/**
 * Sync Status Indicator
 *
 * Shows real-time sync status in a non-intrusive way
 * Displays progress during sync operations
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, WifiOff, Upload } from 'lucide-react';
import { getSyncStatus } from '@/lib/syncManager';

export function SyncStatusIndicator() {
  const [status, setStatus] = useState({
    isSyncing: false,
    isOnline: true,
    pending: 0,
  });
  const [recentlyCompleted, setRecentlyCompleted] = useState(false);

  const loadStatus = async () => {
    const syncStatus = await getSyncStatus();
    const wasSyncing = status.isSyncing;
    const isNowSyncing = syncStatus.isSyncing;

    setStatus({
      isSyncing: isNowSyncing,
      isOnline: syncStatus.isOnline,
      pending: syncStatus.pending,
    });

    // Show completion indicator briefly
    if (wasSyncing && !isNowSyncing && syncStatus.pending === 0) {
      setRecentlyCompleted(true);
      setTimeout(() => setRecentlyCompleted(false), 3000);
    }
  };

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 2000); // Update every 2s
    return () => clearInterval(interval);
  }, []);

  // Show offline indicator
  if (!status.isOnline) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="fixed top-20 right-4 z-40"
      >
        <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-2 shadow-lg flex items-center gap-2">
          <WifiOff className="h-4 w-4 text-rose-600" />
          <span className="text-sm font-medium text-rose-900">Mode Offline</span>
        </div>
      </motion.div>
    );
  }

  // Show syncing indicator
  if (status.isSyncing) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="fixed top-20 right-4 z-40"
      >
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 shadow-lg flex items-center gap-2">
          <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
          <span className="text-sm font-medium text-blue-900">Menyinkronkan jurnal...</span>
        </div>
      </motion.div>
    );
  }

  // Show completion indicator
  if (recentlyCompleted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="fixed top-20 right-4 z-40"
      >
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 shadow-lg flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-900">Sinkronisasi selesai</span>
        </div>
      </motion.div>
    );
  }

  // Show pending indicator (subtle)
  if (status.pending > 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="fixed top-20 right-4 z-40"
      >
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 shadow-lg flex items-center gap-2">
          <Upload className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-900">
            {status.pending} jurnal menunggu sync
          </span>
        </div>
      </motion.div>
    );
  }

  return null;
}

export default SyncStatusIndicator;
