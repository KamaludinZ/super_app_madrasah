import React, { useEffect, useState, useCallback } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  pushSupported,
  notificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  isSubscribedLocally,
  ensurePushSynced,
} from '@/lib/push';

const DISMISS_KEY = 'matsa_push_prompt_dismissed';

/**
 * EnableNotifications - global (auth-gated) banner that invites the user to turn on
 * push notifications. Mounted inside the authenticated app shell.
 * - Auto re-syncs the subscription silently if permission is already granted.
 * - Shows a prompt only when permission is still 'default' and not dismissed.
 */
export default function EnableNotifications() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported()) return;
    const perm = notificationPermission();
    if (perm === 'granted') {
      // Make sure backend knows this device.
      ensurePushSynced();
      return;
    }
    if (perm === 'denied') return;
    if (sessionStorage.getItem(DISMISS_KEY) === '1') return;
    // permission === 'default' -> show prompt after a short delay
    const t = setTimeout(() => setVisible(true), 2500);
    return () => clearTimeout(t);
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    const res = await subscribeToPush();
    setBusy(false);
    if (res.ok) {
      toast.success('Notifikasi diaktifkan di perangkat ini.');
      setVisible(false);
    } else if (res.reason === 'denied') {
      toast.error('Izin notifikasi ditolak. Aktifkan lewat pengaturan browser.');
      setVisible(false);
    } else if (res.reason === 'server_disabled') {
      toast.error('Push notifikasi belum aktif di server.');
      setVisible(false);
    } else {
      toast.error('Gagal mengaktifkan notifikasi. Coba lagi.');
    }
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[55] px-3 pt-3 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-md rounded-2xl border border-emerald-200 bg-white shadow-xl">
        <div className="flex items-center gap-3 p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
            <Bell className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 leading-tight">Aktifkan Notifikasi</p>
            <p className="text-xs text-slate-500 leading-snug">Dapatkan pemberitahuan pengumuman & info penting.</p>
          </div>
          <button
            onClick={enable}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 active:scale-95 transition disabled:opacity-60"
          >
            {busy ? 'Memproses…' : 'Aktifkan'}
          </button>
          <button onClick={dismiss} aria-label="Tutup" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * PushToggle - inline control to enable/disable notifications from the notification menu.
 */
export function PushToggle() {
  const [supported] = useState(() => pushSupported());
  const [subscribed, setSubscribed] = useState(false);
  const [perm, setPerm] = useState(() => notificationPermission());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    isSubscribedLocally().then(setSubscribed);
  }, [supported]);

  if (!supported) return null;

  const toggle = async () => {
    setBusy(true);
    if (subscribed) {
      await unsubscribeFromPush();
      setSubscribed(false);
      toast.info('Notifikasi dinonaktifkan di perangkat ini.');
    } else {
      const res = await subscribeToPush();
      if (res.ok) {
        setSubscribed(true);
        setPerm('granted');
        toast.success('Notifikasi diaktifkan.');
      } else if (res.reason === 'denied') {
        toast.error('Izin ditolak. Aktifkan lewat pengaturan browser.');
      } else if (res.reason === 'server_disabled') {
        toast.error('Push belum aktif di server.');
      } else {
        toast.error('Gagal mengaktifkan notifikasi.');
      }
    }
    setBusy(false);
  };

  return (
    <button
      onClick={toggle}
      disabled={busy || perm === 'denied'}
      className="w-full flex items-center justify-between text-xs h-8 px-2 rounded-md hover:bg-slate-50 disabled:opacity-60"
      title={perm === 'denied' ? 'Izin notifikasi diblokir di browser' : ''}
    >
      <span className="flex items-center gap-1.5 text-slate-600">
        {subscribed ? <Bell className="h-3.5 w-3.5 text-emerald-600" /> : <BellOff className="h-3.5 w-3.5" />}
        {perm === 'denied'
          ? 'Notifikasi diblokir browser'
          : subscribed
            ? 'Notifikasi perangkat: Aktif'
            : 'Aktifkan notifikasi perangkat'}
      </span>
      {perm !== 'denied' && (
        <span className={`text-[10px] font-semibold ${subscribed ? 'text-emerald-600' : 'text-slate-400'}`}>
          {busy ? '…' : subscribed ? 'ON' : 'OFF'}
        </span>
      )}
    </button>
  );
}
