/* Web Push subscription helpers for the PWA. */
import { api } from './api';

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function notificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

async function getRegistration() {
  const reg = await navigator.serviceWorker.getRegistration();
  if (reg) return reg;
  return navigator.serviceWorker.ready;
}

/** Returns true if this device already has an active push subscription synced to backend. */
export async function isSubscribedLocally() {
  if (!pushSupported()) return false;
  try {
    const reg = await getRegistration();
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return Boolean(sub);
  } catch {
    return false;
  }
}

/**
 * Subscribe the current device to push notifications.
 * Requests permission (needs a user gesture), then subscribes and syncs to backend.
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
export async function subscribeToPush() {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' };

  // 1) Get VAPID public key + enabled flag from backend
  let publicKey = '';
  try {
    const { data } = await api.get('/push/vapid-public-key');
    if (!data.enabled || !data.public_key) return { ok: false, reason: 'server_disabled' };
    publicKey = data.public_key;
  } catch {
    return { ok: false, reason: 'server_error' };
  }

  // 2) Ask permission
  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') return { ok: false, reason: 'denied' };

  // 3) Subscribe via PushManager
  try {
    const reg = await getRegistration();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }
    // 4) Sync to backend
    await api.post('/push/subscribe', { subscription: sub.toJSON() });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'subscribe_failed' };
  }
}

/** Unsubscribe this device. */
export async function unsubscribeFromPush() {
  if (!pushSupported()) return { ok: false };
  try {
    const reg = await getRegistration();
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      try { await api.post('/push/unsubscribe', { endpoint }); } catch { /* */ }
    }
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/**
 * Silently re-sync subscription if permission already granted but backend may not know
 * about this device (e.g. after re-login). Safe to call on app start when logged in.
 */
export async function ensurePushSynced() {
  if (!pushSupported()) return;
  if (Notification.permission !== 'granted') return;
  try {
    await subscribeToPush();
  } catch { /* */ }
}
