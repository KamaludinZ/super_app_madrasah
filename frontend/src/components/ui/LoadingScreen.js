import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/**
 * LoadingScreen Component
 *
 * Full-screen loading screen dengan logo yang diambil dari settings.
 * Menampilkan logo di tengah dengan animasi pulse dan spinner.
 *
 * @param {Object} props
 * @param {string} props.message - Optional loading message
 * @param {boolean} props.showSpinner - Show spinner animation (default: true)
 * @param {string} props.variant - 'full' (fullscreen) or 'inline' (default: 'full')
 */
export default function LoadingScreen({
  message = 'Memuat...',
  showSpinner = true,
  variant = 'full'
}) {
  const [logo, setLogo] = useState(null);
  const [schoolName, setSchoolName] = useState('');

  useEffect(() => {
    // Fetch logo from settings
    const fetchLogo = async () => {
      try {
        const { data } = await api.get('/app-info');
        if (data.logo) {
          setLogo(data.logo);
        }
        if (data.school_name) {
          setSchoolName(data.school_name);
        }
      } catch (error) {
        // Fallback: jika gagal fetch, tidak apa-apa (logo tidak muncul)
      }
    };

    fetchLogo();
  }, []);

  const containerClasses = variant === 'full'
    ? 'fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100'
    : 'flex items-center justify-center py-12';

  return (
    <div className={containerClasses}>
      <div className="flex flex-col items-center space-y-6">
        {/* Logo Container */}
        <div className="relative">
          {/* Animated background circle */}
          {showSpinner && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div>
            </div>
          )}

          {/* Logo */}
          <div className="relative z-10 flex items-center justify-center w-32 h-32">
            {logo ? (
              <img
                src={logo}
                alt={schoolName || 'Logo'}
                className="max-w-full max-h-full object-contain animate-pulse"
                style={{ animationDuration: '2s' }}
              />
            ) : (
              // Fallback: skeleton loader saat logo belum dimuat
              <div className="w-24 h-24 bg-slate-200 rounded-lg animate-pulse"></div>
            )}
          </div>
        </div>

        {/* Loading Text */}
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">
            {schoolName || 'Super Apps MATSANDATAMA'}
          </h2>
          <p className="text-sm text-slate-600 animate-pulse">
            {message}
          </p>
        </div>

        {/* Loading Dots Animation */}
        {showSpinner && (
          <div className="flex space-x-2">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * FullPageLoader Component
 *
 * Simplified fullscreen loader (existing component wrapper)
 * Now uses LoadingScreen internally
 */
export function FullPageLoader({ message = 'Memuat...' }) {
  return <LoadingScreen message={message} variant="full" />;
}

/**
 * InlineLoader Component
 *
 * Inline loader untuk loading di dalam komponen
 */
export function InlineLoader({ message = 'Memuat...', showSpinner = true }) {
  return <LoadingScreen message={message} variant="inline" showSpinner={showSpinner} />;
}
