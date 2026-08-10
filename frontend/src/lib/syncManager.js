/**
 * Sync Manager
 *
 * Handles automatic synchronization of offline queue when online
 * Features:
 * - Auto-retry with exponential backoff
 * - Background sync API integration
 * - Network status monitoring
 * - Batch sync with rate limiting
 */

import { api } from '@/lib/api';
import {
  getPendingJournals,
  updateQueuedJournal,
  removeFromQueue,
  getSyncStats,
  getAllQueuedJournals
} from '@/lib/offlineStorage';

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS = [1000, 5000, 15000]; // 1s, 5s, 15s
const BATCH_SIZE = 5; // Sync max 5 journals at once

/**
 * Sync a single journal to server
 *
 * @param {Object} queueItem - Queue item from IndexedDB
 * @returns {Promise<Object>} - { success, serverId, error }
 */
async function syncJournal(queueItem) {
  try {
    // Update status to syncing
    await updateQueuedJournal(queueItem.id, 'syncing', {
      sync_attempts: queueItem.sync_attempts + 1,
      last_sync_attempt: new Date().toISOString()
    });

    // Send to server with offline metadata
    const payload = {
      ...queueItem.data,
      _offline_metadata: {
        queue_id: queueItem.id,
        created_at_client: queueItem.created_at,
        deadline_at: queueItem.deadline_at,
        sync_attempts: queueItem.sync_attempts + 1,
        was_offline: true
      }
    };

    const response = await api.post('/journals/submit-offline', payload);

    // Mark as synced
    await updateQueuedJournal(queueItem.id, 'synced', {
      synced_at: new Date().toISOString(),
      server_journal_id: response.data.id,
      server_response: response.data
    });

    return {
      success: true,
      serverId: response.data.id,
      queueId: queueItem.id
    };

  } catch (error) {
    const errorMessage = error.response?.data?.detail || error.message;

    // Check if it's a deadline error (don't retry)
    const isDeadlineError = errorMessage.includes('deadline') ||
                           errorMessage.includes('terlambat') ||
                           error.response?.status === 400;

    if (isDeadlineError) {
      // Mark as failed permanently
      await updateQueuedJournal(queueItem.id, 'failed', {
        last_error: errorMessage,
        error_type: 'deadline_passed',
        failed_at: new Date().toISOString()
      });

      return {
        success: false,
        error: errorMessage,
        retry: false,
        queueId: queueItem.id
      };
    }

    // Other errors - mark for retry
    await updateQueuedJournal(queueItem.id, 'pending', {
      last_error: errorMessage,
      error_type: 'sync_failed'
    });

    return {
      success: false,
      error: errorMessage,
      retry: true,
      queueId: queueItem.id
    };
  }
}

/**
 * Sync all pending journals
 *
 * @param {Function} onProgress - Progress callback (current, total, item)
 * @returns {Promise<Object>} - { synced, failed, errors }
 */
export async function syncPendingJournals(onProgress = null) {
  const pending = await getPendingJournals();

  if (pending.length === 0) {
    return { synced: 0, failed: 0, errors: [] };
  }

  const results = {
    synced: 0,
    failed: 0,
    errors: []
  };

  // Process in batches
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);

    // Sync batch concurrently
    const batchResults = await Promise.all(
      batch.map(item => syncJournal(item))
    );

    // Update results
    for (const result of batchResults) {
      if (result.success) {
        results.synced++;
      } else {
        results.failed++;
        results.errors.push({
          queueId: result.queueId,
          error: result.error,
          retry: result.retry
        });
      }

      // Call progress callback
      if (onProgress) {
        onProgress(i + results.synced + results.failed, pending.length, result);
      }
    }

    // Rate limiting between batches (avoid overwhelming server)
    if (i + BATCH_SIZE < pending.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * Auto-sync when online
 *
 * @returns {Promise<Object>} - Sync results
 */
export async function autoSync() {
  if (!navigator.onLine) {
    return { synced: 0, failed: 0, skipped: true, reason: 'offline' };
  }

  try {
    const stats = await getSyncStats();

    if (stats.pending === 0) {
      return { synced: 0, failed: 0, skipped: true, reason: 'nothing_to_sync' };
    }

    const results = await syncPendingJournals();
    return { ...results, skipped: false };

  } catch (error) {
    console.error('Auto-sync failed:', error);
    return { synced: 0, failed: 0, skipped: true, reason: error.message };
  }
}

/**
 * Register background sync (if supported)
 */
export async function registerBackgroundSync() {
  if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('sync-journals');
      console.log('Background sync registered');
      return true;
    } catch (error) {
      console.warn('Background sync registration failed:', error);
      return false;
    }
  }
  return false;
}

/**
 * Start sync listener (monitors network status)
 *
 * @param {Function} onSyncComplete - Callback when sync completes
 */
export function startSyncListener(onSyncComplete = null) {
  let syncTimeout = null;

  const handleOnline = async () => {
    console.log('Network back online, starting auto-sync...');

    // Debounce: wait 2 seconds after online to sync
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(async () => {
      const results = await autoSync();

      if (onSyncComplete) {
        onSyncComplete(results);
      }

      // Show user notification
      if (results.synced > 0) {
        console.log(`✓ ${results.synced} jurnal berhasil disinkronkan`);
      }

      if (results.failed > 0) {
        console.warn(`✗ ${results.failed} jurnal gagal disinkronkan`);
      }
    }, 2000);
  };

  // Listen for online event
  window.addEventListener('online', handleOnline);

  // Also try to sync immediately if online
  if (navigator.onLine) {
    handleOnline();
  }

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    clearTimeout(syncTimeout);
  };
}

/**
 * Manual sync trigger
 *
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} - Sync results
 */
export async function manualSync(onProgress = null) {
  if (!navigator.onLine) {
    throw new Error('Tidak ada koneksi internet');
  }

  return await syncPendingJournals(onProgress);
}

/**
 * Retry failed journals
 *
 * @returns {Promise<Object>} - Sync results
 */
export async function retryFailedJournals() {
  // Get failed journals and reset to pending
  const allJournals = await getAllQueuedJournals();
  const failed = allJournals.filter(j =>
    j.status === 'failed' &&
    j.error_type !== 'deadline_passed' // Don't retry deadline errors
  );

  for (const journal of failed) {
    await updateQueuedJournal(journal.id, 'pending', {
      last_error: null,
      error_type: null
    });
  }

  // Sync
  return await syncPendingJournals();
}

/**
 * Get sync status for UI
 *
 * @returns {Promise<Object>}
 */
export async function getSyncStatus() {
  const stats = await getSyncStats();
  const isOnline = navigator.onLine;

  return {
    ...stats,
    isOnline,
    canSync: isOnline && stats.pending > 0,
    hasFailures: stats.failed > 0,
    isSyncing: stats.syncing > 0
  };
}

export default {
  syncPendingJournals,
  autoSync,
  registerBackgroundSync,
  startSyncListener,
  manualSync,
  retryFailedJournals,
  getSyncStatus
};
