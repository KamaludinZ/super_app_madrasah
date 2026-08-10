/**
 * Hook untuk mengelola Web Push notification subscription
 * Handles:
 * - Request notification permission
 * - Subscribe/unsubscribe push notifications
 * - Store subscription di backend
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

/**
 * Convert VAPID key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function useNotificationSubscription() {
  const { user } = useAuth();
  const [permission, setPermission] = useState('default'); // 'default' | 'granted' | 'denied'
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [vapidPublicKey, setVapidPublicKey] = useState(null);

  /**
   * Check if notifications are supported
   */
  const isSupported = useCallback(() => {
    return (
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    );
  }, []);

  /**
   * Get current notification permission
   */
  const checkPermission = useCallback(() => {
    if (!isSupported()) {
      return 'unsupported';
    }
    return Notification.permission;
  }, [isSupported]);

  /**
   * Get current subscription status
   */
  const checkSubscription = useCallback(async () => {
    try {
      if (!isSupported()) {
        return null;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      return subscription;
    } catch (err) {
      console.error('Error checking subscription:', err);
      return null;
    }
  }, [isSupported]);

  /**
   * Request notification permission
   */
  const requestPermission = useCallback(async () => {
    if (!isSupported()) {
      setError('Notifikasi tidak didukung di browser ini');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        return true;
      } else {
        setError('Izin notifikasi ditolak');
        return false;
      }
    } catch (err) {
      console.error('Error requesting permission:', err);
      setError('Gagal meminta izin notifikasi');
      return false;
    }
  }, [isSupported]);

  /**
   * Fetch VAPID public key from backend
   */
  const fetchVapidKey = useCallback(async () => {
    if (vapidPublicKey) {
      return vapidPublicKey;
    }

    try {
      const { data } = await api.get('/push/vapid-public-key');
      const key = data.public_key || data;
      setVapidPublicKey(key);
      return key;
    } catch (err) {
      console.error('Error fetching VAPID key:', err);
      setError('Gagal mendapatkan konfigurasi push notification');
      return null;
    }
  }, [vapidPublicKey]);

  /**
   * Subscribe to push notifications
   */
  const subscribe = useCallback(async () => {
    if (!user) {
      setError('User tidak login');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Check permission first
      if (permission !== 'granted') {
        const granted = await requestPermission();
        if (!granted) {
          setIsLoading(false);
          return false;
        }
      }

      // Get VAPID public key
      const vapidKey = await fetchVapidKey();
      if (!vapidKey) {
        setIsLoading(false);
        return false;
      }

      // Wait for service worker
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push manager
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });

      // Send subscription to backend
      await api.post('/push/subscribe', {
        subscription: subscription.toJSON()
      });

      setIsSubscribed(true);
      setIsLoading(false);
      return true;

    } catch (err) {
      console.error('Error subscribing to push:', err);
      setError('Gagal subscribe notifikasi: ' + err.message);
      setIsLoading(false);
      return false;
    }
  }, [user, permission, requestPermission, fetchVapidKey]);

  /**
   * Unsubscribe from push notifications
   */
  const unsubscribe = useCallback(async () => {
    if (!user) {
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get current subscription
      const subscription = await checkSubscription();

      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe();

        // Remove subscription from backend
        await api.post('/push/unsubscribe');
      }

      setIsSubscribed(false);
      setIsLoading(false);
      return true;

    } catch (err) {
      console.error('Error unsubscribing from push:', err);
      setError('Gagal unsubscribe notifikasi');
      setIsLoading(false);
      return false;
    }
  }, [user, checkSubscription]);

  /**
   * Initialize: check permission and subscription status
   */
  useEffect(() => {
    if (!user || !isSupported()) {
      return;
    }

    const init = async () => {
      // Check permission
      const perm = checkPermission();
      setPermission(perm);

      // Check if already subscribed
      const sub = await checkSubscription();
      setIsSubscribed(!!sub);
    };

    init();
  }, [user, isSupported, checkPermission, checkSubscription]);

  return {
    isSupported: isSupported(),
    permission,
    isSubscribed,
    isLoading,
    error,
    requestPermission,
    subscribe,
    unsubscribe
  };
}

