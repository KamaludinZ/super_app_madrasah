/**
 * Banner untuk meminta izin notifikasi "waktunya mengajar"
 * Hanya muncul untuk guru yang belum subscribe
 */

import { useState } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import useNotificationSubscription from '@/hooks/useNotificationSubscription';

export default function NotificationPermissionBanner() {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe
  } = useNotificationSubscription();

  const [isDismissed, setIsDismissed] = useState(false);

  // Don't show banner if:
  // - Already subscribed
  // - Permission denied
  // - Not supported
  // - User dismissed
  const shouldShow = isSupported && !isSubscribed && permission !== 'denied' && !isDismissed;

  if (!shouldShow) {
    return null;
  }

  const handleSubscribe = async () => {
    const success = await subscribe();
    if (success) {
      // Auto-hide banner on success
      setTimeout(() => setIsDismissed(true), 2000);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  return (
    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4 relative">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <Bell className="h-6 w-6 text-blue-400" />
        </div>

        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-blue-800">
            Aktifkan Pengingat Mengajar
          </h3>
          <p className="mt-1 text-sm text-blue-700">
            Terima notifikasi otomatis 10 menit sebelum dan saat waktu mengajar tiba.
            Tidak akan melewatkan jadwal lagi!
          </p>

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleSubscribe}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isLoading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Mengaktifkan...</span>
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4" />
                  <span>Aktifkan Notifikasi</span>
                </>
              )}
            </button>

            <button
              onClick={handleDismiss}
              className="text-sm text-blue-600 hover:text-blue-800 transition"
            >
              Nanti saja
            </button>
          </div>

          {error && (
            <p className="mt-2 text-sm text-red-600">
              {error}
            </p>
          )}

          {!isSupported && (
            <p className="mt-2 text-sm text-yellow-700">
              <BellOff className="inline h-4 w-4 mr-1" />
              Browser Anda tidak mendukung notifikasi push
            </p>
          )}
        </div>

        <button
          onClick={handleDismiss}
          className="flex-shrink-0 ml-3 text-blue-400 hover:text-blue-600 transition"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
