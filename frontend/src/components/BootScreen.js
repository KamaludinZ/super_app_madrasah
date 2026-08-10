import React, { useEffect, useState, useCallback } from 'react';
import { Check, X, Wifi, WifiOff, Signal, Smartphone, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

/**
 * BootScreen - Loading screen with network diagnostics
 *
 * Features:
 * - Real-time network type detection (WiFi/Cellular)
 * - Signal strength indicator
 * - Server ping test
 * - Connection status with retry
 * - Logo from settings
 * - iOS Safari compatibility (shows "Unknown" for network type)
 */
export default function BootScreen({ onComplete }) {
  const [logo, setLogo] = useState(null);
  const [schoolName, setSchoolName] = useState('');

  // Diagnostic states
  const [networkType, setNetworkType] = useState('checking');
  const [networkStrength, setNetworkStrength] = useState(null);
  const [ping, setPing] = useState(null);
  const [serverStatus, setServerStatus] = useState('checking');
  const [error, setError] = useState(null);
  const [retrying, setRetrying] = useState(false);

  /**
   * Detect network connection type and strength
   * iOS Safari limitation: will return 'unknown'
   */
  const checkNetwork = useCallback(() => {
    try {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

      if (!connection) {
        // iOS Safari or unsupported browser
        setNetworkType('unknown');
        setNetworkStrength(null);
        return;
      }

      const type = connection.effectiveType || connection.type;

      // Map effective types to user-friendly labels
      const typeMap = {
        'wifi': 'WiFi',
        'ethernet': 'WiFi',
        'cellular': 'Paket Data',
        '4g': 'Paket Data (4G)',
        '3g': 'Paket Data (3G)',
        '2g': 'Paket Data (2G)',
        'slow-2g': 'Paket Data (Lambat)',
      };

      setNetworkType(typeMap[type] || type || 'unknown');

      // Estimate signal strength based on downlink/rtt
      if (connection.downlink !== undefined) {
        // downlink in Mbps
        if (connection.downlink > 10) setNetworkStrength('excellent');
        else if (connection.downlink > 5) setNetworkStrength('good');
        else if (connection.downlink > 1) setNetworkStrength('fair');
        else setNetworkStrength('poor');
      } else if (connection.rtt !== undefined) {
        // rtt in ms (lower is better)
        if (connection.rtt < 100) setNetworkStrength('excellent');
        else if (connection.rtt < 300) setNetworkStrength('good');
        else if (connection.rtt < 600) setNetworkStrength('fair');
        else setNetworkStrength('poor');
      }
    } catch (err) {
      setNetworkType('unknown');
      setNetworkStrength(null);
    }
  }, []);

  /**
   * Ping server to measure response time
   */
  const pingServer = useCallback(async () => {
    const startTime = Date.now();
    try {
      await api.get('/health');
      const endTime = Date.now();
      setPing(endTime - startTime);
      return true;
    } catch (err) {
      setPing(null);
      return false;
    }
  }, []);

  /**
   * Fetch logo and app info (optional - may fail if not logged in)
   */
  const fetchAppInfo = useCallback(async () => {
    try {
      const { data } = await api.get('/app-info');
      if (data.logo) {
        setLogo(data.logo);
      }
      if (data.school_name) {
        setSchoolName(data.school_name);
      }
      return true;
    } catch (err) {
      // Ignore 401 errors (not logged in yet)
      // Boot screen runs before login, so app-info is optional
      return true;
    }
  }, []);

  /**
   * Main boot sequence
   */
  const runBootSequence = useCallback(async () => {
    setError(null);
    setServerStatus('checking');

    // Step 1: Check network
    checkNetwork();
    await new Promise(resolve => setTimeout(resolve, 300));

    // Step 2: Ping server (critical)
    const pingSuccess = await pingServer();
    await new Promise(resolve => setTimeout(resolve, 300));

    if (!pingSuccess) {
      setServerStatus('failed');
      setError('Gagal terhubung ke server. Periksa koneksi internet Anda.');
      return;
    }

    // Step 3: Try to fetch app info (optional, don't fail boot if 401)
    await fetchAppInfo();
    await new Promise(resolve => setTimeout(resolve, 300));

    // Success
    setServerStatus('connected');

    // Hide splash screen from index.html
    const splashScreen = document.getElementById('splash-screen');
    if (splashScreen) {
      splashScreen.classList.add('hidden');
      setTimeout(() => splashScreen.remove(), 500);
    }

    // Complete boot after short delay
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 500);
  }, [checkNetwork, pingServer, fetchAppInfo, onComplete]);

  /**
   * Retry connection
   */
  const handleRetry = useCallback(() => {
    setRetrying(true);
    runBootSequence().finally(() => {
      setRetrying(false);
    });
  }, [runBootSequence]);

  // Run boot sequence on mount
  useEffect(() => {
    runBootSequence();
  }, [runBootSequence]);

  // Listen for network changes
  useEffect(() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      connection.addEventListener('change', checkNetwork);
      return () => connection.removeEventListener('change', checkNetwork);
    }
  }, [checkNetwork]);

  /**
   * Get signal strength icon
   */
  const getSignalIcon = () => {
    if (networkStrength === 'excellent') return <Signal className="h-4 w-4 text-emerald-600" />;
    if (networkStrength === 'good') return <Signal className="h-4 w-4 text-green-600" />;
    if (networkStrength === 'fair') return <Signal className="h-4 w-4 text-yellow-600" />;
    if (networkStrength === 'poor') return <Signal className="h-4 w-4 text-red-600" />;
    return null;
  };

  /**
   * Get signal strength label
   */
  const getSignalLabel = () => {
    if (networkStrength === 'excellent') return 'Sangat Baik';
    if (networkStrength === 'good') return 'Baik';
    if (networkStrength === 'fair') return 'Cukup';
    if (networkStrength === 'poor') return 'Lemah';
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-md px-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          {/* Logo */}
          <div className="flex flex-col items-center space-y-3">
            <div className="w-24 h-24 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl flex items-center justify-center shadow-lg">
              {logo ? (
                <img src={logo} alt="Logo" className="max-w-[80%] max-h-[80%] object-contain" />
              ) : (
                <Smartphone className="h-12 w-12 text-emerald-600" />
              )}
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold text-slate-900">
                {schoolName || 'Super Apps MATSANDATAMA'}
              </h1>
              <p className="text-sm text-slate-600 mt-1">Memeriksa koneksi...</p>
            </div>
          </div>

          {/* Diagnostic Checklist */}
          <div className="space-y-3">
            {/* Network Type */}
            <DiagnosticItem
              icon={networkType === 'unknown' || networkType.includes('WiFi') ? Wifi : Smartphone}
              label="Jenis Koneksi"
              status={networkType !== 'checking' ? 'done' : 'checking'}
              value={
                <div className="flex items-center gap-2">
                  <span className={networkType === 'unknown' ? 'text-slate-500 italic' : ''}>
                    {networkType === 'checking' ? 'Memeriksa...' :
                     networkType === 'unknown' ? 'Tidak diketahui' : networkType}
                  </span>
                  {networkStrength && getSignalIcon()}
                </div>
              }
              note={networkType === 'unknown' ? 'iOS Safari: Info terbatas' : getSignalLabel()}
            />

            {/* Server Ping */}
            <DiagnosticItem
              icon={Signal}
              label="Ping ke Server"
              status={ping !== null ? 'done' : serverStatus === 'failed' ? 'error' : 'checking'}
              value={ping !== null ? `${ping} ms` : serverStatus === 'failed' ? 'Gagal' : 'Mengukur...'}
              note={ping && ping < 100 ? 'Sangat cepat' : ping && ping < 300 ? 'Cepat' : ping && ping < 600 ? 'Normal' : ping ? 'Lambat' : null}
            />

            {/* Server Connection */}
            <DiagnosticItem
              icon={serverStatus === 'connected' ? Check : serverStatus === 'failed' ? X : RefreshCw}
              label="Koneksi Server"
              status={serverStatus}
              value={
                serverStatus === 'connected' ? 'Terhubung' :
                serverStatus === 'failed' ? 'Gagal' : 'Menghubungkan...'
              }
              note={serverStatus === 'connected' ? 'Siap digunakan' : null}
            />
          </div>

          {/* Error Message & Retry */}
          {error && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">Koneksi Gagal</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
              <Button
                onClick={handleRetry}
                disabled={retrying}
                className="w-full"
                size="lg"
              >
                {retrying ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Mencoba Lagi...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Coba Lagi
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Progress Dots */}
          {!error && (
            <div className="flex justify-center gap-2">
              <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Diagnostic Item Component
 */
function DiagnosticItem({ icon: Icon, label, status, value, note }) {
  const getStatusColor = () => {
    if (status === 'done' || status === 'connected') return 'text-emerald-600';
    if (status === 'error' || status === 'failed') return 'text-red-600';
    return 'text-blue-600';
  };

  const getStatusIcon = () => {
    if (status === 'done' || status === 'connected') return <Check className="h-4 w-4" />;
    if (status === 'error' || status === 'failed') return <X className="h-4 w-4" />;
    return <RefreshCw className="h-4 w-4 animate-spin" />;
  };

  return (
    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
      <Icon className={`h-5 w-5 mt-0.5 ${getStatusColor()}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-slate-900">{label}</span>
          <div className={`flex items-center gap-1.5 ${getStatusColor()}`}>
            {getStatusIcon()}
          </div>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span className="text-sm text-slate-700">{value}</span>
          {note && <span className="text-xs text-slate-500 italic">{note}</span>}
        </div>
      </div>
    </div>
  );
}
