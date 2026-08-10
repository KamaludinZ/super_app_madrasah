/**
 * Offline Storage Manager using IndexedDB
 *
 * Manages offline queue for journals and other data that needs to be synced
 * when internet connection is restored.
 */

const DB_NAME = 'matsandatama_offline';
const DB_VERSION = 1;

// Store names
const STORES = {
  JOURNAL_QUEUE: 'journal_queue',
  SYNC_STATUS: 'sync_status'
};

/**
 * Initialize IndexedDB
 */
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create journal queue store
      if (!db.objectStoreNames.contains(STORES.JOURNAL_QUEUE)) {
        const journalStore = db.createObjectStore(STORES.JOURNAL_QUEUE, {
          keyPath: 'id',
          autoIncrement: false
        });
        journalStore.createIndex('status', 'status', { unique: false });
        journalStore.createIndex('created_at', 'created_at', { unique: false });
        journalStore.createIndex('deadline_at', 'deadline_at', { unique: false });
      }

      // Create sync status store
      if (!db.objectStoreNames.contains(STORES.SYNC_STATUS)) {
        db.createObjectStore(STORES.SYNC_STATUS, {
          keyPath: 'key'
        });
      }
    };
  });
}

/**
 * Get database connection
 */
async function getDB() {
  return await initDB();
}

/**
 * Add journal to offline queue
 *
 * @param {Object} journalData - Journal data to queue
 * @returns {Promise<string>} - Queue ID
 */
export async function addToJournalQueue(journalData) {
  const db = await getDB();
  const now = new Date();

  const queueItem = {
    id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    data: journalData,
    status: 'pending', // 'pending' | 'syncing' | 'synced' | 'failed'
    created_at: now.toISOString(),
    deadline_at: journalData.deadline_at,
    sync_attempts: 0,
    last_sync_attempt: null,
    last_error: null,
    client_metadata: {
      user_agent: navigator.userAgent,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      online_at_creation: navigator.onLine
    }
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.JOURNAL_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORES.JOURNAL_QUEUE);
    const request = store.add(queueItem);

    request.onsuccess = () => resolve(queueItem.id);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all pending journals in queue
 *
 * @returns {Promise<Array>} - Array of pending journals
 */
export async function getPendingJournals() {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.JOURNAL_QUEUE], 'readonly');
    const store = transaction.objectStore(STORES.JOURNAL_QUEUE);
    const index = store.index('status');
    const request = index.getAll('pending');

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all journals in queue (any status)
 *
 * @returns {Promise<Array>} - Array of all journals
 */
export async function getAllQueuedJournals() {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.JOURNAL_QUEUE], 'readonly');
    const store = transaction.objectStore(STORES.JOURNAL_QUEUE);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get journal from queue by ID
 *
 * @param {string} id - Queue ID
 * @returns {Promise<Object|null>}
 */
export async function getQueuedJournal(id) {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.JOURNAL_QUEUE], 'readonly');
    const store = transaction.objectStore(STORES.JOURNAL_QUEUE);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update journal status in queue
 *
 * @param {string} id - Queue ID
 * @param {string} status - New status
 * @param {Object} updates - Additional updates
 * @returns {Promise<void>}
 */
export async function updateQueuedJournal(id, status, updates = {}) {
  const db = await getDB();
  const journal = await getQueuedJournal(id);

  if (!journal) {
    throw new Error(`Journal ${id} not found in queue`);
  }

  const updatedJournal = {
    ...journal,
    status,
    ...updates,
    updated_at: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.JOURNAL_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORES.JOURNAL_QUEUE);
    const request = store.put(updatedJournal);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Remove journal from queue
 *
 * @param {string} id - Queue ID
 * @returns {Promise<void>}
 */
export async function removeFromQueue(id) {
  const db = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.JOURNAL_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORES.JOURNAL_QUEUE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all synced journals from queue
 *
 * @returns {Promise<number>} - Number of journals cleared
 */
export async function clearSyncedJournals() {
  const db = await getDB();
  const journals = await getAllQueuedJournals();
  const syncedJournals = journals.filter(j => j.status === 'synced');

  let count = 0;
  for (const journal of syncedJournals) {
    await removeFromQueue(journal.id);
    count++;
  }

  return count;
}

/**
 * Get sync statistics
 *
 * @returns {Promise<Object>} - Sync stats
 */
export async function getSyncStats() {
  const journals = await getAllQueuedJournals();

  return {
    total: journals.length,
    pending: journals.filter(j => j.status === 'pending').length,
    syncing: journals.filter(j => j.status === 'syncing').length,
    synced: journals.filter(j => j.status === 'synced').length,
    failed: journals.filter(j => j.status === 'failed').length,
    oldest_pending: journals
      .filter(j => j.status === 'pending')
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0] || null
  };
}

/**
 * Check if journal deadline has passed (client-side check)
 *
 * @param {string} deadlineISO - Deadline ISO string
 * @param {number} graceMinutes - Grace period in minutes
 * @returns {Object} - { isPastDeadline, isPastGrace, minutesLate }
 */
export function checkDeadline(deadlineISO, graceMinutes = 30) {
  const now = new Date();
  const deadline = new Date(deadlineISO);
  const graceDeadline = new Date(deadline.getTime() + (graceMinutes * 60 * 1000));

  const isPastDeadline = now > deadline;
  const isPastGrace = now > graceDeadline;
  const minutesLate = isPastDeadline ? Math.floor((now - deadline) / 60000) : 0;

  return {
    isPastDeadline,
    isPastGrace,
    minutesLate,
    canStillSubmit: !isPastGrace
  };
}

/**
 * Calculate deadline for a schedule
 *
 * @param {Object} schedule - Schedule object with end_time
 * @param {number} hoursAfter - Hours after schedule end (default 1)
 * @returns {string} - Deadline ISO string
 */
export function calculateDeadline(schedule, hoursAfter = 1) {
  // Parse schedule end time (format: "HH:MM")
  const [hours, minutes] = schedule.end_time.split(':').map(Number);

  // Get schedule date (today)
  const now = new Date();
  const scheduleEnd = new Date(now);
  scheduleEnd.setHours(hours, minutes, 0, 0);

  // Add hours after
  const deadline = new Date(scheduleEnd.getTime() + (hoursAfter * 60 * 60 * 1000));

  return deadline.toISOString();
}

/**
 * Check if IndexedDB is supported
 *
 * @returns {boolean}
 */
export function isOfflineStorageSupported() {
  return 'indexedDB' in window;
}

/**
 * Get storage usage estimate
 *
 * @returns {Promise<Object>} - { usage, quota, percentage }
 */
export async function getStorageEstimate() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage,
      quota: estimate.quota,
      percentage: estimate.quota ? (estimate.usage / estimate.quota * 100).toFixed(2) : 0,
      usageMB: (estimate.usage / 1024 / 1024).toFixed(2),
      quotaMB: (estimate.quota / 1024 / 1024).toFixed(2)
    };
  }
  return null;
}

export default {
  addToJournalQueue,
  getPendingJournals,
  getAllQueuedJournals,
  getQueuedJournal,
  updateQueuedJournal,
  removeFromQueue,
  clearSyncedJournals,
  getSyncStats,
  checkDeadline,
  calculateDeadline,
  isOfflineStorageSupported,
  getStorageEstimate
};
