import React, { useEffect, useState } from 'react';
import { Download, Share, X, Plus } from 'lucide-react';
import {
  isStandalone,
  isIOS,
  getDeferredPrompt,
  promptInstall,
} from '@/lib/pwa';

const DISMISS_KEY = 'matsa_pwa_install_dismissed';

/**
 * InstallPWA - floating banner that invites users to install the app.
 * - Android/Chrome: uses native beforeinstallprompt.
 * - iOS/Safari: shows Add-to-Home-Screen instructions (no native prompt).
 * Hidden when already installed (standalone) or previously dismissed this session.
 */
export default function InstallPWA() {
  const [visible, setVisible] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) return; // already installed
    if (sessionStorage.getItem(DISMISS_KEY) === '1') return;

    const ios = isIOS();
    // Show if we already have a deferred prompt, or it's iOS (manual instructions).
    if (getDeferredPrompt()) {
      setCanPrompt(true);
      setVisible(true);
    } else if (ios) {
      setVisible(true);
    }

    const onInstallable = () => {
      setCanPrompt(true);
      setVisible(true);
    };
    const onInstalled = () => setVisible(false);

    window.addEventListener('pwa-installable', onInstallable);
    window.addEventListener('pwa-installed', onInstalled);
    return () => {
      window.removeEventListener('pwa-installable', onInstallable);
      window.removeEventListener('pwa-installed', onInstalled);
    };
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
    setShowIosHelp(false);
  };

  const handleInstall = async () => {
    if (canPrompt) {
      const res = await promptInstall();
      if (res && res.outcome === 'accepted') setVisible(false);
    } else if (isIOS()) {
      setShowIosHelp(true);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-3 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-md rounded-2xl border border-emerald-200 bg-white shadow-2xl overflow-hidden">
        {!showIosHelp ? (
          <div className="flex items-center gap-3 p-3">
            <img src="/icon-192.png" alt="Logo" className="h-11 w-11 rounded-xl object-contain bg-white border border-slate-100" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 leading-tight">Pasang Aplikasi</p>
              <p className="text-xs text-slate-500 leading-snug">Akses lebih cepat langsung dari layar utama HP Anda.</p>
            </div>
            <button
              onClick={handleInstall}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 active:scale-95 transition"
            >
              {isIOS() && !canPrompt ? <Share className="h-4 w-4" /> : <Download className="h-4 w-4" />}
              Pasang
            </button>
            <button onClick={dismiss} aria-label="Tutup" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="p-4">
            <div className="flex items-start justify-between">
              <p className="text-sm font-semibold text-slate-900">Cara Pasang di iPhone / iPad</p>
              <button onClick={dismiss} aria-label="Tutup" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ol className="mt-2 space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold">1</span>
                Ketuk tombol <Share className="inline h-4 w-4 text-blue-600" /> <b>Bagikan</b> di bilah bawah Safari.
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold">2</span>
                Pilih <b>Ke Layar Utama</b> <Plus className="inline h-4 w-4" />.
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold">3</span>
                Ketuk <b>Tambah</b>. Aplikasi muncul di layar utama.
              </li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
