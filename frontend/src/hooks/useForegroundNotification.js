/**
 * Hook untuk handle notifikasi saat app terbuka (foreground)
 * - Listen service worker messages
 * - Play custom notification sound
 * - Show in-app toast (optional)
 */

import { useEffect } from 'react';
import audioPlayer from '@/lib/audioPlayer';

export default function useForegroundNotification() {
  useEffect(() => {
    // Check if service worker and notifications are supported
    if (!('serviceWorker' in navigator)) {
      return;
    }

    /**
     * Handle messages from service worker
     */
    const handleMessage = (event) => {
      const { type, action, payload } = event.data;

      if (type === 'NOTIFICATION_RECEIVED') {
        // Play notification sound when app is in foreground
        handleForegroundNotification(action, payload);
      }
    };

    /**
     * Handle foreground notification
     * - Play sound
     * - Show in-app toast (optional)
     */
    const handleForegroundNotification = async (action, payload) => {
      try {
        // Play notification sound based on action type
        if (action === 'teaching_reminder') {
          // Use bell sound for teaching reminders
          await audioPlayer.play('bell');
        } else if (action === 'new_announcement') {
          // Use bell sound for new announcements
          await audioPlayer.play('bell');
        } else {
          // Use chime for other notifications
          await audioPlayer.play('chime');
        }

        // Log for debugging
        console.log('🔔 Foreground notification received:', {
          action,
          title: payload.title,
          body: payload.body
        });

        // Optional: Show in-app toast notification
        // You can integrate with your toast/notification system here
        // Example: toast.info(payload.title, payload.body);

      } catch (error) {
        console.warn('Failed to play notification sound:', error);
      }
    };

    // Register message listener
    navigator.serviceWorker.addEventListener('message', handleMessage);

    // Initialize audio player on mount (unlock audio for iOS)
    audioPlayer.initialize().catch(() => {
      console.warn('Failed to initialize audio player');
    });

    // Cleanup
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  return null;
}

/**
 * Request permission to play audio on iOS
 * Call this on user interaction (e.g., button click, login)
 */
export async function requestAudioPermission() {
  return await audioPlayer.requestPermission();
}
