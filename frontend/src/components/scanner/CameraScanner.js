import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

/**
 * CameraScanner — isolated component for QR scanning.
 *
 * Mounting flow guarantees the target DIV exists BEFORE Html5Qrcode is constructed:
 * 1. Component mounts → div with ref is in DOM.
 * 2. useEffect[] runs ONCE after mount → ref.current is guaranteed non-null.
 * 3. We initialize Html5Qrcode using the actual element id.
 *
 * Robust error handling for common camera issues (permission, no camera, HTTPS, etc).
 */
export default function CameraScanner({ onDecoded, onCancel }) {
  const containerRef = useRef(null);
  const scannerRef = useRef(null);
  const [status, setStatus] = useState('starting'); // starting | ready | error
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      // Wait one frame to ensure ref is attached
      await new Promise((r) => requestAnimationFrame(() => r()));
      if (!mounted) return;

      const el = containerRef.current;
      if (!el) {
        setError('Elemen kamera tidak ditemukan');
        setStatus('error');
        return;
      }

      // Ensure unique id
      const elId = el.id || 'qr-camera-' + Date.now();
      if (!el.id) el.id = elId;

      try {
        // Probe camera permissions first
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setError('Browser ini tidak mendukung akses kamera. Coba gunakan Chrome / Safari terbaru, atau gunakan tab "Token Kelas" sebagai alternatif.');
          setStatus('error');
          return;
        }

        const html5 = new Html5Qrcode(elId, { verbose: false });
        scannerRef.current = html5;

        // Try environment camera first, fallback to any camera
        const cameraConfig = { facingMode: 'environment' };
        const scanConfig = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        };

        await html5.start(
          cameraConfig,
          scanConfig,
          (decodedText) => {
            // Stop and pass result up
            if (scannerRef.current) {
              html5.stop()
                .then(() => { scannerRef.current = null; })
                .catch(() => {})
                .finally(() => onDecoded?.(decodedText));
            }
          },
          () => { /* ignore per-frame failures */ }
        );

        if (mounted) setStatus('ready');
      } catch (e) {
        if (!mounted) return;
        const msg = (e?.message || String(e)).toLowerCase();
        let userMsg = 'Tidak dapat mengakses kamera.';
        if (msg.includes('permission') || msg.includes('notallowed')) {
          userMsg = 'Izin kamera ditolak. Mohon izinkan akses kamera lewat ikon kunci di address bar, lalu coba lagi.';
        } else if (msg.includes('notfound') || msg.includes('no camera')) {
          userMsg = 'Perangkat ini tidak memiliki kamera. Silakan gunakan tab "Token Kelas" untuk input manual.';
        } else if (msg.includes('notreadable') || msg.includes('starting video')) {
          userMsg = 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi lain (mis. Zoom/Meet) lalu coba lagi.';
        } else if (msg.includes('overconstrained')) {
          userMsg = 'Spesifikasi kamera tidak terpenuhi. Coba di perangkat lain.';
        } else if (msg.includes('securityerror') || msg.includes('https')) {
          userMsg = 'Akses kamera memerlukan koneksi HTTPS. Hubungi admin IT.';
        }
        setError(userMsg);
        setStatus('error');
      }
    };

    init();

    return () => {
      mounted = false;
      if (scannerRef.current) {
        try {
          scannerRef.current.stop()
            .then(() => scannerRef.current?.clear?.())
            .catch(() => {});
        } catch (_e) { /* noop */ }
        scannerRef.current = null;
      }
    };
  }, [onDecoded]);

  const stopAndCancel = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch (_e) { /* noop */ }
      scannerRef.current = null;
    }
    onCancel?.();
  };

  return (
    <div className="space-y-3">
      {status === 'starting' && (
        <div className="py-8 text-center text-slate-600">
          <Loader2 className="h-6 w-6 mx-auto animate-spin mb-2" />
          <p className="text-sm">Memulai kamera…</p>
          <p className="text-xs text-slate-500 mt-1">Browser akan meminta izin akses kamera.</p>
        </div>
      )}

      {status === 'error' && error && (
        <Alert className="bg-rose-50 border-rose-200">
          <AlertCircle className="h-4 w-4 text-rose-700" />
          <AlertDescription className="text-rose-900 text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {/* IMPORTANT: ref div MUST be rendered (not hidden) for Html5Qrcode to mount video inside */}
      <div
        ref={containerRef}
        id="qr-reader-mount"
        data-testid="jurnal-scan-camera"
        className={status === 'ready' ? 'rounded-lg overflow-hidden border-2 border-[#006837]/20' : (status === 'starting' ? 'opacity-0 h-0' : 'hidden')}
        style={{ minHeight: status === 'ready' ? 320 : 0, maxWidth: '100%' }}
      />

      {status === 'ready' && (
        <p className="text-xs text-slate-500 text-center">Arahkan kamera ke kartu QR di depan kelas. Sistem akan mendeteksi secara otomatis.</p>
      )}

      <Button variant="outline" onClick={stopAndCancel} className="w-full" data-testid="jurnal-scan-cancel">
        {status === 'error' ? 'Kembali' : 'Batal'}
      </Button>
    </div>
  );
}
